export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { leaseRepository } from '../../../infra/repositories/leaseRepository';
import { LeasesService, LeaseFilters } from '@/lib/services/leasesService';
import { z } from 'zod';
import { getLeaseRuntimeStatus } from '../../../domain/leases/status';

const leaseSchema = z.object({
  propertyId: z.string().min(1, 'L\'ID du bien est requis'),
  tenantId: z.string().min(1, 'L\'ID du locataire est requis'),
  type: z.enum(['residential', 'commercial', 'garage']),
  furnishedType: z.enum(['vide', 'meuble', 'garage']).optional(),
  startDate: z.string().min(1, 'La date de début est requise'),
  endDate: z.string().optional(),
  rentAmount: z.number().min(1, 'Le montant du loyer doit être supérieur à 0'),
  deposit: z.number().min(0, 'Le montant du dépôt ne peut pas être négatif').default(0),
  paymentDay: z.number().min(1).max(31, 'Le jour de paiement doit être entre 1 et 31').optional(),
  indexationType: z.enum(['none', 'insee', 'manual']).optional(),
  notes: z.string().optional(),
  status: z.enum(['BROUILLON', 'ENVOYÉ', 'SIGNÉ', 'ACTIF', 'RÉSILIÉ', 'ARCHIVÉ']).optional(),
  // Gestion déléguée - Granularité des charges
  chargesRecupMensuelles: z.number().min(0).optional(),
  chargesNonRecupMensuelles: z.number().min(0).optional(),
}).refine((data) => {
  // Vérifier que la date de fin est postérieure à la date de début
  if (data.endDate && data.startDate) {
    return new Date(data.endDate) > new Date(data.startDate);
  }
  return true;
}, {
  message: 'La date de fin doit être postérieure à la date de début.',
  path: ['endDate'],
}).refine((data) => {
  // Vérifier le plafond du dépôt selon le type de bail
  // Si furnishedType n'est pas défini, on ne valide pas
  if (!data.furnishedType || !data.deposit || data.deposit === 0) return true;
  
  const maxDeposit = data.furnishedType === 'meuble' ? data.rentAmount * 2 : data.rentAmount;
  return data.deposit <= maxDeposit;
}, {
  message: 'Dépôt de garantie supérieur au plafond légal pour le type de bail.',
  path: ['deposit'],
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Vérifier si c'est une requête pour les KPIs
    const kpis = searchParams.get('kpis');
    if (kpis === 'true') {
      const kpiData = await LeasesService.getKPIs();
      return NextResponse.json(kpiData);
    }

    // Vérifier si c'est une requête pour les alertes
    const alerts = searchParams.get('alerts');
    if (alerts === 'true') {
      const alertData = await LeasesService.getAlerts();
      return NextResponse.json(alertData);
    }

    // Construire les filtres
    const filters: LeaseFilters = {
      search: searchParams.get('search') || undefined,
      status: searchParams.get('status')?.split(',').filter(Boolean) || [],
      type: searchParams.get('type')?.split(',').filter(Boolean) || [],
      propertyId: searchParams.get('propertyId') || undefined,
      tenantId: searchParams.get('tenantId') || undefined,
      upcomingExpiration: searchParams.get('upcomingExpiration') === 'true',
      missingDocuments: searchParams.get('missingDocuments') === 'true',
      indexationDue: searchParams.get('indexationDue') === 'true',
      limit: parseInt(searchParams.get('limit') || '50'),
      offset: parseInt(searchParams.get('offset') || '0')
    };

    // Rechercher les baux
    const result = await LeasesService.search(filters);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('[GET /api/leases] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur interne lors du chargement des baux' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validation avec Zod
    const validatedData = leaseSchema.parse(body);
    
    // Vérifier l'unicité des baux actifs pour cette propriété
    const existingLeases = await leaseRepository.findByPropertyId(validatedData.propertyId);
    const newStartDate = new Date(validatedData.startDate);
    const newEndDate = validatedData.endDate ? new Date(validatedData.endDate) : null;
    
    // Vérifier s'il y a des baux actifs qui se chevauchent
    const overlappingLeases = existingLeases.filter(lease => {
      if (lease.status !== 'ACTIF') return false;
      
      const existingStartDate = new Date(lease.startDate);
      const existingEndDate = lease.endDate ? new Date(lease.endDate) : null;
      
      // Vérifier le chevauchement
      if (newEndDate && existingEndDate) {
        // Les deux ont une date de fin
        return (newStartDate < existingEndDate && newEndDate > existingStartDate);
      } else if (newEndDate && !existingEndDate) {
        // Le nouveau bail a une fin, l'existant n'en a pas
        return newEndDate > existingStartDate;
      } else if (!newEndDate && existingEndDate) {
        // Le nouveau bail n'a pas de fin, l'existant en a une
        return newStartDate < existingEndDate;
      } else {
        // Aucun n'a de date de fin
        return true;
      }
    });
    
    if (overlappingLeases.length > 0) {
      return NextResponse.json({ 
        error: 'Un autre bail actif existe sur cette période pour ce bien.' 
      }, { status: 400 });
    }
    
    // Convert string dates to Date objects
    const startDate = new Date(validatedData.startDate);
    const now = new Date();
    
    // Déterminer le statut initial
    let status = validatedData.status || 'BROUILLON';
    if (status === 'SIGNÉ' && startDate <= now) {
      status = 'ACTIF';
    }
    
    // Gérer endDate : si chaîne vide ou non fournie, calculer selon le type (meublé = 1 an, vide = 3 ans)
    let endDate: Date | null = null;
    if (validatedData.endDate && validatedData.endDate.trim() !== '') {
      endDate = new Date(validatedData.endDate);
    } else if (status === 'SIGNÉ' || status === 'ACTIF') {
      // Calculer automatiquement selon le type de bail
      // Meublé = 1 an, Vide = 3 ans (durée légale minimale)
      const duration = (validatedData.furnishedType === 'meuble' || validatedData.furnishedType === 'MEUBLE') ? 1 : 3;
      endDate = new Date(startDate);
      endDate.setFullYear(endDate.getFullYear() + duration);
      console.log(`🗓️ Date de fin calculée automatiquement : ${endDate.toISOString()} (${duration} an${duration > 1 ? 's' : ''} après le début - Type: ${validatedData.furnishedType})`);
    }
    
    const processedData = {
      propertyId: validatedData.propertyId,
      tenantId: validatedData.tenantId,
      type: validatedData.type,
      furnishedType: validatedData.furnishedType || 'vide',
      startDate,
      endDate,
      rentAmount: validatedData.rentAmount,
      deposit: validatedData.deposit || 0,
      paymentDay: validatedData.paymentDay || null,
      indexationType: validatedData.indexationType || 'none',
      notes: validatedData.notes || '',
      status,
      // Gestion déléguée - Granularité des charges
      chargesRecupMensuelles: validatedData.chargesRecupMensuelles || null,
      chargesNonRecupMensuelles: validatedData.chargesNonRecupMensuelles || null,
    };
    
    const lease = await leaseRepository.create(processedData);
    return NextResponse.json(lease, { status: 201 });
  } catch (error) {
    console.error('Error creating lease:', error);
    
    // Gestion des erreurs Zod
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Erreur de validation',
        details: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }))
      }, { status: 400 });
    }
    
    return NextResponse.json({ 
      error: 'Erreur lors de la création du bail', 
      details: error instanceof Error ? error.message : 'Erreur inconnue' 
    }, { status: 500 });
  }
}
