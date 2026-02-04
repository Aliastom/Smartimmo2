export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { leaseRepository } from '../../../infra/repositories/leaseRepository';
import { LeasesService, LeaseFilters } from '@/lib/services/leasesService';
import { requireAuth } from '@/lib/auth/getCurrentUser';
import { z } from 'zod';
import { getLeaseRuntimeStatus } from '../../../domain/leases/status';
import { createLeaseServicePrisma } from '@/domain/services/leaseServiceFactory';
import { mapLeaseServiceErrorToHttpStatus } from '@/domain/services/leaseServiceHelpers';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

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
    const user = await requireAuth();
    const organizationId = user.organizationId;
    const { searchParams } = new URL(request.url);
    
    // Vérifier si c'est une requête pour les KPIs
    const kpis = searchParams.get('kpis');
    if (kpis === 'true') {
      const kpiData = await LeasesService.getKPIs(organizationId);
      return NextResponse.json(kpiData);
    }

    // Vérifier si c'est une requête pour les alertes
    const alerts = searchParams.get('alerts');
    if (alerts === 'true') {
      const alertData = await LeasesService.getAlerts(organizationId);
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
    const result = await LeasesService.search(filters, organizationId);
    
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
    const user = await requireAuth();
    const organizationId = user.organizationId;
    const body = await request.json();
    
    // Validation minimale (shape)
    const validatedData = leaseSchema.parse(body);
    
    // Appel du service (toute la logique métier est dans LeaseService)
    const leaseService = createLeaseServicePrisma();
    const result = await leaseService.createLease({
      organizationId,
      propertyId: validatedData.propertyId,
      tenantId: validatedData.tenantId,
      type: validatedData.type,
      furnishedType: validatedData.furnishedType,
      startDate: validatedData.startDate,
      endDate: validatedData.endDate,
      rentAmount: validatedData.rentAmount,
      deposit: validatedData.deposit,
      paymentDay: validatedData.paymentDay,
      indexationType: validatedData.indexationType,
      notes: validatedData.notes,
      status: validatedData.status,
      chargesRecupMensuelles: validatedData.chargesRecupMensuelles,
      chargesNonRecupMensuelles: validatedData.chargesNonRecupMensuelles,
    });
    
    return NextResponse.json(result.lease, { status: 201 });
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
    
    if (error instanceof Error) {
      const status = mapLeaseServiceErrorToHttpStatus(error);
      return NextResponse.json({ 
        error: error.message,
        details: error.message
      }, { status });
    }
    
    return NextResponse.json({ 
      error: 'Erreur lors de la création du bail', 
      details: 'Erreur inconnue' 
    }, { status: 500 });
  }
}
