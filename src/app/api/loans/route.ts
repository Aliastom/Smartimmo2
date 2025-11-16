import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { buildSchedule, crdAtDate } from '@/lib/finance/amortization';
import { Decimal } from '@prisma/client/runtime/library';
import { requireAuth } from '@/lib/auth/getCurrentUser';

// Schéma de validation pour la création d'un prêt

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export const createLoanSchema = z.object({
  propertyId: z.string().min(1, 'L\'ID de la propriété est requis'),
  label: z.string().min(1, 'Le libellé est requis'),
  principal: z.number().positive('Le capital doit être positif'),
  annualRatePct: z.number().min(0, 'Le taux annuel doit être positif ou nul'),
  durationMonths: z.number().int().positive('La durée doit être un nombre de mois positif'),
  defermentMonths: z.number().int().min(0, 'Le différé ne peut pas être négatif').default(0),
  insurancePct: z.number().min(0, 'Le taux d\'assurance doit être positif ou nul').optional().nullable(),
  feesUpfront: z.number().min(0, 'Les frais doivent être positifs ou nuls').optional().nullable(),
  startDate: z.string().datetime('La date de début est invalide'),
  rateType: z.enum(['FIXED']).default('FIXED'),
  isActive: z.boolean().default(true),
});

// Schéma de validation pour les query params
const querySchema = z.object({
  q: z.string().optional(),
  propertyId: z.string().optional(),
  active: z.enum(['0', '1']).optional(),
  rateType: z.enum(['FIXED']).optional(),
  page: z.string().default('1'),
  pageSize: z.string().default('20'),
  from: z.string().regex(/^\d{4}-\d{2}$/).optional(), // YYYY-MM
  to: z.string().regex(/^\d{4}-\d{2}$/).optional(),   // YYYY-MM
});

/**
 * GET /api/loans
 * Liste paginée des prêts avec KPIs
 * Query params: ?q=&propertyId=&active=1&rateType=&page=1&pageSize=20&from=YYYY-MM&to=YYYY-MM
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    const { searchParams } = new URL(request.url);
    
    // Validation
    const validation = querySchema.safeParse({
      q: searchParams.get('q') || undefined,
      propertyId: searchParams.get('propertyId') || undefined,
      active: searchParams.get('active') || undefined,
      rateType: searchParams.get('rateType') || undefined,
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

    const { q, propertyId, active, rateType, page, pageSize, from, to } = validation.data;
    
    const pageNum = parseInt(page);
    const pageSizeNum = Math.min(parseInt(pageSize), 100);
    const skip = (pageNum - 1) * pageSizeNum;

    // Construire le where
    const where: any = { organizationId };

    if (propertyId) {
      where.propertyId = propertyId;
    }

    if (active === '1') {
      where.isActive = true;
    } else if (active === '0') {
      where.isActive = false;
    }

    if (rateType) {
      where.rateType = rateType;
    }

    // Recherche textuelle (label)
    if (q) {
      where.label = {
        contains: q,
        mode: 'insensitive' as const,
      };
    }

    // Récupérer les prêts
    const [loans, total] = await Promise.all([
      prisma.loan.findMany({
        where,
        include: {
          property: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          startDate: 'desc',
        },
        skip,
        take: pageSizeNum,
      }),
      prisma.loan.count({ where }),
    ]);

    // Calculer les KPIs et CRD si période spécifiée
    const toMonth = to || new Date().toISOString().substring(0, 7);
    
    // IMPORTANT : Pour les KPIs, on calcule sur TOUS les prêts actifs, pas seulement ceux de la page
    const allActiveLoansWhere: any = { isActive: true, organizationId };
    if (propertyId) {
      allActiveLoansWhere.propertyId = propertyId;
    }

    const allActiveLoans = await prisma.loan.findMany({
      where: allActiveLoansWhere,
    });

    let totalPrincipal = 0;
    let totalCRD = 0;
    let monthlyPaymentSum = 0;
    let activeLoansCount = allActiveLoans.length;

    for (const loan of allActiveLoans) {
      totalPrincipal += Number(loan.principal);

      // Calculer le schedule et le CRD au mois 'to'
      const schedule = buildSchedule({
        principal: Number(loan.principal),
        annualRatePct: Number(loan.annualRatePct),
        durationMonths: loan.durationMonths,
        defermentMonths: loan.defermentMonths,
        insurancePct: loan.insurancePct ? Number(loan.insurancePct) : 0,
        startDate: loan.startDate,
      });

      const crd = crdAtDate(schedule, toMonth);
      totalCRD += crd;

      // Mensualité (dernière ligne du schedule pour avoir la mensualité typique)
      if (schedule.length > 0) {
        monthlyPaymentSum += schedule[schedule.length - 1].paymentTotal;
      }
    }

    const monthlyPaymentAvg = activeLoansCount > 0 ? monthlyPaymentSum / activeLoansCount : 0;

    const items = loans.map((loan) => {
      // Calculer la mensualité pour chaque prêt
      const schedule = buildSchedule({
        principal: Number(loan.principal),
        annualRatePct: Number(loan.annualRatePct),
        durationMonths: loan.durationMonths,
        defermentMonths: loan.defermentMonths,
        insurancePct: loan.insurancePct ? Number(loan.insurancePct) : 0,
        startDate: loan.startDate,
      });

      const monthlyPayment = schedule.length > 0 ? schedule[schedule.length - 1].paymentTotal : 0;

      return {
        id: loan.id,
        propertyId: loan.propertyId,
        propertyName: loan.property.name,
        label: loan.label,
        principal: Number(loan.principal),
        annualRatePct: Number(loan.annualRatePct),
        durationMonths: loan.durationMonths,
        defermentMonths: loan.defermentMonths,
        insurancePct: loan.insurancePct ? Number(loan.insurancePct) : null,
        feesUpfront: loan.feesUpfront ? Number(loan.feesUpfront) : null,
        startDate: loan.startDate.toISOString(),
        endDate: loan.endDate?.toISOString() || null,
        rateType: loan.rateType,
        isActive: loan.isActive,
        monthlyPayment: Math.round(monthlyPayment * 100) / 100,
        createdAt: loan.createdAt.toISOString(),
        updatedAt: loan.updatedAt.toISOString(),
      };
    });

    return NextResponse.json({
      items,
      total,
      page: pageNum,
      pageSize: pageSizeNum,
      kpis: {
        totalPrincipal: Math.round(totalPrincipal * 100) / 100,
        totalCRD: Math.round(totalCRD * 100) / 100,
        monthlyPaymentAvg: Math.round(monthlyPaymentAvg * 100) / 100,
        activeLoansCount,
      },
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des prêts:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des prêts' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/loans
 * Création d'un nouveau prêt
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    const body = await request.json();
    const validation = createLoanSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: validation.error.errors },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Vérifier que la propriété existe
    const property = await prisma.property.findFirst({
      where: { id: data.propertyId, organizationId },
    });

    if (!property) {
      return NextResponse.json(
        { error: 'Propriété non trouvée' },
        { status: 404 }
      );
    }

    // Calculer endDate si pas fournie
    const startDate = new Date(data.startDate);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + data.durationMonths);

    // Créer le prêt
    const loan = await prisma.loan.create({
      data: {
        propertyId: data.propertyId,
        label: data.label,
        principal: new Decimal(data.principal),
        annualRatePct: new Decimal(data.annualRatePct),
        durationMonths: data.durationMonths,
        defermentMonths: data.defermentMonths,
        insurancePct: data.insurancePct != null ? new Decimal(data.insurancePct) : null,
        feesUpfront: data.feesUpfront != null ? new Decimal(data.feesUpfront) : null,
        startDate,
        endDate,
        rateType: data.rateType,
        isActive: data.isActive,
        organizationId,
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({
      id: loan.id,
      propertyId: loan.propertyId,
      propertyName: loan.property.name,
      label: loan.label,
      principal: Number(loan.principal),
      annualRatePct: Number(loan.annualRatePct),
      durationMonths: loan.durationMonths,
      defermentMonths: loan.defermentMonths,
      insurancePct: loan.insurancePct ? Number(loan.insurancePct) : null,
      feesUpfront: loan.feesUpfront ? Number(loan.feesUpfront) : null,
      startDate: loan.startDate.toISOString(),
      endDate: loan.endDate?.toISOString() || null,
      rateType: loan.rateType,
      isActive: loan.isActive,
      createdAt: loan.createdAt.toISOString(),
      updatedAt: loan.updatedAt.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error('Erreur lors de la création du prêt:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création du prêt' },
      { status: 500 }
    );
  }
}
