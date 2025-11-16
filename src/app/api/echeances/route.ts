import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { expandEcheances } from '@/lib/echeances/expandEcheances';
import { EcheanceType, Periodicite, SensEcheance } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { requireAuth } from '@/lib/auth/getCurrentUser';

/**
 * Schema de validation pour les query params
 */

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

const EcheancesQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}$/, 'Format attendu: YYYY-MM'),
  to: z.string().regex(/^\d{4}-\d{2}$/, 'Format attendu: YYYY-MM'),
  propertyId: z.string().optional(),
  leaseId: z.string().optional(),
});

/**
 * Schema de validation pour POST (création)
 */
const CreateEcheanceSchema = z.object({
  label: z.string().min(1, 'Le libellé est requis'),
  type: z.nativeEnum(EcheanceType, { required_error: 'Le type est requis' }),
  periodicite: z.nativeEnum(Periodicite, { required_error: 'La périodicité est requise' }),
  montant: z.number().positive('Le montant doit être positif'),
  recuperable: z.boolean().default(false),
  sens: z.nativeEnum(SensEcheance, { required_error: 'Le sens est requis' }),
  propertyId: z.string().nullable().optional(),
  leaseId: z.string().nullable().optional(),
  startAt: z.string().datetime('Date de début invalide'),
  endAt: z.string().datetime().nullable().optional(),
  isActive: z.boolean().default(true),
}).refine(
  (data) => {
    // Si endAt est fourni, il doit être >= startAt
    if (data.endAt) {
      return new Date(data.endAt) >= new Date(data.startAt);
    }
    return true;
  },
  { message: "La date de fin doit être supérieure ou égale à la date de début" }
);

/**
 * GET /api/echeances
 * Récupère les occurrences d'échéances récurrentes pour une période donnée
 * 
 * Query params:
 * - from: YYYY-MM (requis)
 * - to: YYYY-MM (requis)
 * - propertyId?: string (optionnel)
 * - leaseId?: string (optionnel)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    const { searchParams } = new URL(request.url);
    
    // Validation des query params
    const validation = EcheancesQuerySchema.safeParse({
      from: searchParams.get('from'),
      to: searchParams.get('to'),
      propertyId: searchParams.get('propertyId') || undefined,
      leaseId: searchParams.get('leaseId') || undefined,
    });

    if (!validation.success) {
      return NextResponse.json(
        { status: 'error', message: 'Paramètres invalides', errors: validation.error.errors },
        { status: 400 }
      );
    }

    const { from, to, propertyId, leaseId } = validation.data;

    // Parser les dates de la plage
    const [fromYear, fromMonth] = from.split('-').map(Number);
    const [toYear, toMonth] = to.split('-').map(Number);
    const fromDate = new Date(fromYear, fromMonth - 1, 1);
    const toDate = new Date(toYear, toMonth, 0, 23, 59, 59); // Dernier jour du mois

    // Construire le filtre Prisma
    const where: any = {
      organizationId,
      isActive: true,
      startAt: { lte: toDate },
      OR: [
        { endAt: null },
        { endAt: { gte: fromDate } },
      ],
    };

    // Filtrer par propertyId si fourni
    if (propertyId) {
      where.propertyId = propertyId;
    }

    // Filtrer par leaseId si fourni
    if (leaseId) {
      where.leaseId = leaseId;
    }

    // Charger les échéances récurrentes actives qui recoupent la plage
    const echeances = await prisma.echeanceRecurrente.findMany({
      where,
      select: {
        id: true,
        propertyId: true,
        leaseId: true,
        label: true,
        type: true,
        periodicite: true,
        montant: true,
        recuperable: true,
        sens: true,
        startAt: true,
        endAt: true,
        isActive: true,
      },
      orderBy: { startAt: 'asc' },
    });

    // Convertir les Decimal en number pour expandEcheances
    const echeancesInput = echeances.map((e) => ({
      ...e,
      montant: typeof e.montant === 'object' && 'toNumber' in e.montant 
        ? (e.montant as any).toNumber() 
        : parseFloat(e.montant.toString()),
      startAt: e.startAt instanceof Date ? e.startAt : new Date(e.startAt),
      endAt: e.endAt ? (e.endAt instanceof Date ? e.endAt : new Date(e.endAt)) : null,
    }));

    // Expand en occurrences mensuelles
    const occurrences = expandEcheances(echeancesInput, from, to);

    // Formater pour l'API (optionnel: ajouter plus d'infos si nécessaire)
    const formattedOccurrences = occurrences.map((occ) => ({
      date: occ.date,
      type: occ.type.toLowerCase(), // Pour compatibilité avec AgendaItem
      label: occ.label,
      amount: occ.amount,
      propertyId: occ.propertyId,
      leaseId: occ.leaseId,
      sens: occ.sens,
      recuperable: echeancesInput.find((e) => e.id === occ.echeanceId)?.recuperable || false,
      entity: occ.propertyId
        ? { kind: 'property' as const, id: occ.propertyId }
        : occ.leaseId
        ? { kind: 'lease' as const, id: occ.leaseId }
        : undefined,
    }));

    return NextResponse.json({
      status: 'success',
      occurrences: formattedOccurrences,
      count: formattedOccurrences.length,
    });
  } catch (error: any) {
    console.error('[API] Error in /api/echeances:', error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'Erreur lors de la récupération des échéances' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/echeances
 * Création d'une nouvelle échéance récurrente
 * 
 * Permissions: ADMIN uniquement
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    
    const body = await request.json();
    const validation = CreateEcheanceSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: validation.error.errors },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Préparer les données pour Prisma
    const createData: any = {
      ...data,
      montant: new Decimal(data.montant),
      startAt: new Date(data.startAt),
      endAt: data.endAt ? new Date(data.endAt) : null,
    };

    // Créer l'échéance
    if (createData.propertyId) {
      const property = await prisma.property.findFirst({
        where: { id: createData.propertyId, organizationId },
        select: { id: true },
      });
      if (!property) {
        return NextResponse.json({ error: 'Propriété introuvable' }, { status: 404 });
      }
    }

    if (createData.leaseId) {
      const lease = await prisma.lease.findFirst({
        where: { id: createData.leaseId, organizationId },
        select: { id: true },
      });
      if (!lease) {
        return NextResponse.json({ error: 'Bail introuvable' }, { status: 404 });
      }
    }

    const echeance = await prisma.echeanceRecurrente.create({
      data: {
        ...createData,
        organizationId,
      },
      include: {
        Property: {
          select: { id: true, name: true },
        },
        Lease: {
          select: { id: true, type: true, status: true },
        },
      },
    });

    // Convertir Decimal pour JSON
    const result = {
      ...echeance,
      montant: typeof echeance.montant === 'object' && 'toNumber' in echeance.montant
        ? (echeance.montant as any).toNumber()
        : parseFloat(echeance.montant.toString()),
    };

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('[API] Error in POST /api/echeances:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la création' },
      { status: 500 }
    );
  }
}

