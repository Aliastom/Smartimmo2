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
  loanType: z.string().optional().nullable(),
  repaymentType: z.string().optional().nullable(),
  amortizationProfile: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
  stagedDocumentIds: z.array(z.string()).optional(),
  stagedLinkItemIds: z.array(z.string()).optional(),
  borrowers: z.array(z.object({
    firstName: z.string(),
    lastName: z.string(),
    birthDate: z.string().optional().nullable(),
    email: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    responsibilityPct: z.number().optional().nullable(),
  })).optional(),
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

    // Map pour agréger les montants par co-emprunteur
    const borrowersMap = new Map<string, { name: string; principal: number; crd: number; monthlyPayment: number }>();

    for (const loan of allActiveLoans) {
      const principal = Number(loan.principal);
      totalPrincipal += principal;

      // Calculer le schedule et le CRD au mois 'to'
      const schedule = buildSchedule({
        principal,
        annualRatePct: Number(loan.annualRatePct),
        durationMonths: loan.durationMonths,
        defermentMonths: loan.defermentMonths,
        insurancePct: loan.insurancePct ? Number(loan.insurancePct) : 0,
        startDate: loan.startDate,
      });

      const crd = crdAtDate(schedule, toMonth);
      totalCRD += crd;

      // Mensualité (dernière ligne du schedule pour avoir la mensualité typique)
      const monthlyPayment = schedule.length > 0 ? schedule[schedule.length - 1].paymentTotal : 0;
      monthlyPaymentSum += monthlyPayment;

      // Charger les co-emprunteurs pour ce prêt
      const borrowers = await prisma.loanBorrower.findMany({
        where: { loanId: loan.id, organizationId },
        select: {
          firstName: true,
          lastName: true,
          responsibilityPct: true,
        },
      });

      if (borrowers.length > 0) {
        // Répartir les montants selon les pourcentages
        for (const borrower of borrowers) {
          const name = `${borrower.firstName} ${borrower.lastName}`;
          const pct = borrower.responsibilityPct ? Number(borrower.responsibilityPct) / 100 : 1 / borrowers.length;
          
          const existing = borrowersMap.get(name);
          if (existing) {
            existing.principal += principal * pct;
            existing.crd += crd * pct;
            existing.monthlyPayment += monthlyPayment * pct;
          } else {
            borrowersMap.set(name, {
              name,
              principal: principal * pct,
              crd: crd * pct,
              monthlyPayment: monthlyPayment * pct,
            });
          }
        }
      } else {
        // Si pas de co-emprunteur, attribuer au propriétaire par défaut
        const defaultName = 'Propriétaire';
        const existing = borrowersMap.get(defaultName);
        if (existing) {
          existing.principal += principal;
          existing.crd += crd;
          existing.monthlyPayment += monthlyPayment;
        } else {
          borrowersMap.set(defaultName, {
            name: defaultName,
            principal,
            crd,
            monthlyPayment,
          });
        }
      }
    }

    const monthlyPaymentAvg = activeLoansCount > 0 ? monthlyPaymentSum / activeLoansCount : 0;

    // Convertir la map en array et trier par montant décroissant
    const borrowersData = Array.from(borrowersMap.values())
      .map(b => ({
        name: b.name,
        principal: Math.round(b.principal * 100) / 100,
        crd: Math.round(b.crd * 100) / 100,
        monthlyPayment: Math.round(b.monthlyPayment * 100) / 100,
      }))
      .sort((a, b) => b.principal - a.principal);

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
        loanType: loan.loanType,
        repaymentType: loan.repaymentType,
        amortizationProfile: loan.amortizationProfile,
        notes: loan.notes,
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
        borrowers: borrowersData,
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

    // Créer le prêt dans une transaction
    const result = await prisma.$transaction(async (tx) => {
      // Créer le prêt
      const loan = await tx.loan.create({
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
          loanType: data.loanType || null,
          repaymentType: data.repaymentType || null,
          amortizationProfile: data.amortizationProfile || null,
          notes: data.notes || null,
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

      // Créer les co-emprunteurs
      if (data.borrowers && data.borrowers.length > 0) {
        await Promise.all(data.borrowers.map(borrower =>
          tx.loanBorrower.create({
            data: {
              loanId: loan.id,
              organizationId,
              firstName: borrower.firstName,
              lastName: borrower.lastName,
              birthDate: borrower.birthDate ? new Date(borrower.birthDate) : null,
              email: borrower.email || null,
              phone: borrower.phone || null,
              responsibilityPct: borrower.responsibilityPct != null ? new Decimal(borrower.responsibilityPct) : null,
            },
          })
        ));
      }

      // Mettre à jour le statut des documents (la finalisation sera faite après la transaction)
      if (data.stagedDocumentIds && data.stagedDocumentIds.length > 0) {
        await tx.document.updateMany({
          where: {
            id: { in: data.stagedDocumentIds },
            organizationId,
          },
          data: {
            loanId: loan.id,
            status: 'active',
            uploadSessionId: null,
            intendedContextType: null,
            intendedContextTempKey: null,
          },
        });
      }

      return loan;
    });

    // Finaliser les documents et créer les liens APRÈS la transaction
    if (data.stagedDocumentIds && data.stagedDocumentIds.length > 0) {
      const { getStorageService } = await import('@/services/storage.service');
      const storageService = getStorageService();
      
      // Finaliser chaque document : migrer de tmp/ vers documents/
      for (const docId of data.stagedDocumentIds) {
        const doc = await prisma.document.findFirst({
          where: { id: docId, organizationId },
          select: {
            id: true,
            bucketKey: true,
            filenameOriginal: true,
            fileName: true,
            mime: true
          }
        });
        
        if (!doc || !doc.bucketKey) continue;
        
        // Si le bucketKey est déjà dans documents/, pas besoin de migrer
        if (doc.bucketKey.startsWith('documents/')) continue;
        
        // Lire le fichier temporaire
        let fileBuffer: Buffer;
        try {
          fileBuffer = await storageService.downloadDocument(doc.bucketKey);
        } catch (error: any) {
          console.error(`[API] Erreur lecture fichier temporaire pour ${docId}:`, error);
          continue;
        }
        
        // Générer le nom de fichier final
        const fileExtension = doc.filenameOriginal?.split('.').pop() || 'pdf';
        const finalFilename = `${doc.id}.${fileExtension}`;
        
        // Upload vers le stockage permanent
        try {
          const uploadResult = await storageService.uploadDocument(
            fileBuffer,
            doc.id,
            finalFilename,
            doc.mime || 'application/octet-stream'
          );
          
          // Supprimer l'ancien fichier temporaire
          try {
            await storageService.deleteDocument(doc.bucketKey);
          } catch (deleteError) {
            console.warn(`[API] Impossible de supprimer l'ancien fichier ${doc.bucketKey}:`, deleteError);
          }
          
          // Mettre à jour le document avec le nouveau bucketKey
          await prisma.document.update({
            where: { id: doc.id },
            data: {
              bucketKey: uploadResult.key,
              url: `/api/documents/${doc.id}/file`
            }
          });
        } catch (uploadError: any) {
          console.error(`[API] Erreur upload document final pour ${docId}:`, uploadError);
        }
      }
      
      // Créer les liens DocumentLink
      const { createDocumentLinks } = await import('@/lib/services/documentLinkService');
      for (const docId of data.stagedDocumentIds) {
        await createDocumentLinks(docId, result);
      }
    }

    // Traiter les liens vers documents existants
    if (data.stagedLinkItemIds && data.stagedLinkItemIds.length > 0) {
      const stagedLinks = await prisma.uploadStagedItem.findMany({
        where: {
          id: { in: data.stagedLinkItemIds },
          kind: 'link',
          organizationId,
        },
        include: {
          Document: {
            select: {
              id: true,
            },
          },
        },
      });

      const { createDocumentLinks } = await import('@/lib/services/documentLinkService');
      for (const stagedLink of stagedLinks) {
        if (stagedLink.Document) {
          await createDocumentLinks(stagedLink.Document.id, result);
        }
      }
    }

    return NextResponse.json({
      id: result.id,
      propertyId: result.propertyId,
      propertyName: result.property.name,
      label: result.label,
      principal: Number(result.principal),
      annualRatePct: Number(result.annualRatePct),
      durationMonths: result.durationMonths,
      defermentMonths: result.defermentMonths,
      insurancePct: result.insurancePct ? Number(result.insurancePct) : null,
      feesUpfront: result.feesUpfront ? Number(result.feesUpfront) : null,
      startDate: result.startDate.toISOString(),
      endDate: result.endDate?.toISOString() || null,
      rateType: result.rateType,
      loanType: result.loanType,
      repaymentType: result.repaymentType,
      amortizationProfile: result.amortizationProfile,
      notes: result.notes,
      isActive: result.isActive,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error('Erreur lors de la création du prêt:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création du prêt' },
      { status: 500 }
    );
  }
}
