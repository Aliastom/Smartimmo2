import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { EcheanceType, Periodicite, SensEcheance } from '@prisma/client';

/**
 * Schema de validation pour les query params de la liste
 */

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

const ListQuerySchema = z.object({
  search: z.string().optional(),
  type: z.string().optional(), // CSV de types
  sens: z.nativeEnum(SensEcheance).optional(),
  periodicite: z.string().optional(), // CSV de périodicités
  propertyId: z.string().optional(),
  leaseId: z.string().optional(),
  active: z.enum(['0', '1']).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  from: z.string().regex(/^\d{4}-\d{2}$/).optional(), // Filtre par chevauchement
  to: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

/**
 * GET /api/echeances/list
 * Liste brute paginée des échéances récurrentes pour CRUD
 * 
 * Query params:
 * - search?: string (recherche dans label)
 * - type?: string (CSV de types, ex: "LOYER_ATTENDU,COPRO")
 * - sens?: "DEBIT" | "CREDIT"
 * - periodicite?: string (CSV)
 * - propertyId?: string
 * - leaseId?: string
 * - active?: "0" | "1" (par défaut tous)
 * - page?: number (défaut 1)
 * - pageSize?: number (défaut 20, max 100)
 * - from?: YYYY-MM (filtre par chevauchement d'activité)
 * - to?: YYYY-MM
 */
export async function GET(request: NextRequest) {
  try {
    // TODO: Ajouter protection authentification RBAC (ADMIN + USER lecture)
    
    const { searchParams } = new URL(request.url);
    
    // Validation
    const validation = ListQuerySchema.safeParse({
      search: searchParams.get('search') || undefined,
      type: searchParams.get('type') || undefined,
      sens: searchParams.get('sens') || undefined,
      periodicite: searchParams.get('periodicite') || undefined,
      propertyId: searchParams.get('propertyId') || undefined,
      leaseId: searchParams.get('leaseId') || undefined,
      active: searchParams.get('active') || undefined,
      page: searchParams.get('page') || '1',
      pageSize: searchParams.get('pageSize') || '20',
      from: searchParams.get('from') || undefined,
      to: searchParams.get('to') || undefined,
    });

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Paramètres invalides', details: validation.error.errors },
        { status: 400 }
      );
    }

    const {
      search,
      type,
      sens,
      periodicite,
      propertyId,
      leaseId,
      active,
      page,
      pageSize,
      from,
      to,
    } = validation.data;

    // Construire le where
    const where: any = {};

    // Filtre actif
    if (active === '1') {
      where.isActive = true;
    } else if (active === '0') {
      where.isActive = false;
    }
    // Si active n'est pas défini, on prend tout

    // Recherche textuelle
    if (search) {
      where.label = { contains: search, mode: 'insensitive' };
    }

    // Filtre type (CSV)
    if (type) {
      const types = type.split(',').filter(Boolean);
      where.type = { in: types as EcheanceType[] };
    }

    // Filtre sens
    if (sens) {
      where.sens = sens;
    }

    // Filtre périodicité (CSV)
    if (periodicite) {
      const periodicites = periodicite.split(',').filter(Boolean);
      where.periodicite = { in: periodicites as Periodicite[] };
    }

    // Filtre propertyId
    if (propertyId) {
      where.propertyId = propertyId;
    }

    // Filtre leaseId
    if (leaseId) {
      where.leaseId = leaseId;
    }

    // Filtre par période (chevauchement)
    if (from && to) {
      const [fromYear, fromMonth] = from.split('-').map(Number);
      const [toYear, toMonth] = to.split('-').map(Number);
      const fromDate = new Date(fromYear, fromMonth - 1, 1);
      const toDate = new Date(toYear, toMonth, 0, 23, 59, 59);

      where.startAt = { lte: toDate };
      where.OR = [
        { endAt: null },
        { endAt: { gte: fromDate } },
      ];
    }

    // Total et pagination
    const total = await prisma.echeanceRecurrente.count({ where });
    const skip = (page - 1) * pageSize;

    const echeances = await prisma.echeanceRecurrente.findMany({
      where,
      include: {
        Property: {
          select: { id: true, name: true },
        },
        Lease: {
          select: { id: true, type: true, status: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
      skip,
      take: pageSize,
    });

    // Convertir Decimal en number pour le JSON
    const items = echeances.map((e) => ({
      ...e,
      montant: typeof e.montant === 'object' && 'toNumber' in e.montant
        ? (e.montant as any).toNumber()
        : parseFloat(e.montant.toString()),
    }));

    return NextResponse.json({
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error: any) {
    console.error('[API] Error in /api/echeances/list:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération des échéances' },
      { status: 500 }
    );
  }
}

