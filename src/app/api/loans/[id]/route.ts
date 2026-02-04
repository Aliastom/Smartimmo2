import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { buildSchedule, sliceSchedule, crdAtDate } from '@/lib/finance/amortization';
import { Decimal } from '@prisma/client/runtime/library';
import { requireAuth } from '@/lib/auth/getCurrentUser';

// Schéma de validation pour la mise à jour d'un prêt

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

const updateLoanSchema = z.object({
  propertyId: z.string().min(1).optional(),
  label: z.string().min(1).optional(),
  principal: z.number().positive().optional(),
  annualRatePct: z.number().min(0).optional(),
  durationMonths: z.number().int().positive().optional(),
  defermentMonths: z.number().int().min(0).optional(),
  insurancePct: z.number().min(0).optional().nullable(),
  feesUpfront: z.number().min(0).optional().nullable(),
  startDate: z.string().datetime().optional(),
  paymentDay: z.number().int().min(1).max(31, 'Le jour de paiement doit être entre 1 et 31').optional().nullable(),
  rateType: z.enum(['FIXED']).optional(),
  loanType: z.string().optional().nullable(),
  repaymentType: z.string().optional().nullable(),
  amortizationProfile: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  stagedDocumentIds: z.array(z.string()).optional(),
  stagedLinkItemIds: z.array(z.string()).optional(),
});

/**
 * GET /api/loans/[id]
 * Récupère les détails d'un prêt avec son schedule
 * Query params: ?from=YYYY-MM&to=YYYY-MM (pour borner le schedule)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from') || undefined;
    const to = searchParams.get('to') || undefined;

    const loan = await prisma.loan.findFirst({
      where: { id: params.id, organizationId },
      include: {
        property: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!loan) {
      return NextResponse.json(
        { error: 'Prêt non trouvé' },
        { status: 404 }
      );
    }

    // Construire le schedule complet
    const fullSchedule = buildSchedule({
      principal: Number(loan.principal),
      annualRatePct: Number(loan.annualRatePct),
      durationMonths: loan.durationMonths,
      defermentMonths: loan.defermentMonths,
      insurancePct: loan.insurancePct ? Number(loan.insurancePct) : 0,
      startDate: loan.startDate,
      paymentDay: loan.paymentDay || undefined,
    });

    // Borner le schedule si from/to sont spécifiés
    const schedule = sliceSchedule(fullSchedule, from, to);

    // Calculer les KPIs
    const toMonth = to || new Date().toISOString().substring(0, 7);
    const currentCRD = crdAtDate(fullSchedule, toMonth);

    // Intérêts totaux estimés (somme cumulée sur toute la durée)
    const totalInterestEstimated = fullSchedule.length > 0
      ? fullSchedule[fullSchedule.length - 1].cumulativeInterest
      : 0;

    const totalInsuranceEstimated = fullSchedule.length > 0
      ? fullSchedule[fullSchedule.length - 1].cumulativeInsurance
      : 0;

    // Mensualité typique (hors/avec assurance)
    const typicalRow = fullSchedule.find((row) => row.month > loan.defermentMonths) || fullSchedule[0];
    const monthlyPaymentWithoutInsurance = typicalRow
      ? typicalRow.paymentPrincipal + typicalRow.paymentInterest
      : 0;
    const monthlyPaymentWithInsurance = typicalRow ? typicalRow.paymentTotal : 0;

    return NextResponse.json({
      loan: {
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
        paymentDay: loan.paymentDay,
        rateType: loan.rateType,
        loanType: loan.loanType,
        repaymentType: loan.repaymentType,
        amortizationProfile: loan.amortizationProfile,
        notes: loan.notes,
        isActive: loan.isActive,
        createdAt: loan.createdAt.toISOString(),
        updatedAt: loan.updatedAt.toISOString(),
      },
      schedule,
      kpis: {
        monthlyPaymentWithoutInsurance: Math.round(monthlyPaymentWithoutInsurance * 100) / 100,
        monthlyPaymentWithInsurance: Math.round(monthlyPaymentWithInsurance * 100) / 100,
        currentCRD: Math.round(currentCRD * 100) / 100,
        totalInterestEstimated: Math.round(totalInterestEstimated * 100) / 100,
        totalInsuranceEstimated: Math.round(totalInsuranceEstimated * 100) / 100,
      },
    });
  } catch (error) {
    console.error('Erreur lors de la récupération du prêt:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du prêt' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/loans/[id]
 * Met à jour un prêt (soft update sur isActive)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    const body = await request.json();
    const validation = updateLoanSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: validation.error.errors },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Vérifier que le prêt existe
    const existingLoan = await prisma.loan.findFirst({
      where: { id: params.id, organizationId },
    });

    if (!existingLoan) {
      return NextResponse.json(
        { error: 'Prêt non trouvé' },
        { status: 404 }
      );
    }

    // Si propertyId est modifié, vérifier que la nouvelle propriété existe
    if (data.propertyId && data.propertyId !== existingLoan.propertyId) {
      const property = await prisma.property.findFirst({
        where: { id: data.propertyId, organizationId },
      });

      if (!property) {
        return NextResponse.json(
          { error: 'Propriété non trouvée' },
          { status: 404 }
        );
      }
    }

    // Préparer les données de mise à jour
    const updateData: any = {};

    if (data.propertyId !== undefined) updateData.propertyId = data.propertyId;
    if (data.label !== undefined) updateData.label = data.label;
    if (data.principal !== undefined) updateData.principal = new Decimal(data.principal);
    if (data.annualRatePct !== undefined) updateData.annualRatePct = new Decimal(data.annualRatePct);
    if (data.durationMonths !== undefined) updateData.durationMonths = data.durationMonths;
    if (data.defermentMonths !== undefined) updateData.defermentMonths = data.defermentMonths;
    if (data.insurancePct !== undefined) {
      updateData.insurancePct = data.insurancePct != null ? new Decimal(data.insurancePct) : null;
    }
    if (data.feesUpfront !== undefined) {
      updateData.feesUpfront = data.feesUpfront != null ? new Decimal(data.feesUpfront) : null;
    }
    if (data.startDate !== undefined) {
      updateData.startDate = new Date(data.startDate);
      // Recalculer endDate
      const newStartDate = new Date(data.startDate);
      const newEndDate = new Date(newStartDate);
      const duration = data.durationMonths !== undefined ? data.durationMonths : existingLoan.durationMonths;
      newEndDate.setMonth(newEndDate.getMonth() + duration);
      updateData.endDate = newEndDate;
    } else if (data.durationMonths !== undefined) {
      // Si durationMonths change mais pas startDate, recalculer endDate
      const newEndDate = new Date(existingLoan.startDate);
      newEndDate.setMonth(newEndDate.getMonth() + data.durationMonths);
      updateData.endDate = newEndDate;
    }
    if (data.paymentDay !== undefined) updateData.paymentDay = data.paymentDay;
    if (data.rateType !== undefined) updateData.rateType = data.rateType;
    if (data.loanType !== undefined) updateData.loanType = data.loanType;
    if (data.repaymentType !== undefined) updateData.repaymentType = data.repaymentType;
    if (data.amortizationProfile !== undefined) updateData.amortizationProfile = data.amortizationProfile;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    // Mettre à jour le prêt
    const loan = await prisma.loan.update({
      where: { id: params.id, organizationId },
      data: updateData,
      include: {
        property: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // ✅ Traiter les documents en staging (stagedDocumentIds)
    if (data.stagedDocumentIds && data.stagedDocumentIds.length > 0) {
      // Mettre à jour les documents avec loanId et status: 'active'
      await prisma.document.updateMany({
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

      // Finaliser les documents (migrer de tmp/ vers documents/)
      const { getStorageService } = await import('@/services/storage.service');
      const storageService = getStorageService();
      
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
        // ✅ Passer loanId pour que createDocumentLinks crée le lien pour le prêt
        await createDocumentLinks(docId, {
          id: loan.id,
          propertyId: loan.propertyId,
          loanId: loan.id, // ✅ Indiquer que c'est un prêt
        });
      }
    }

    // ✅ Traiter les liens vers documents existants (stagedLinkItemIds)
    // ⚠️ IMPORTANT: stagedLinkItemIds contient les IDs des documents existants (pas les IDs des uploadStagedItem)
    if (data.stagedLinkItemIds && data.stagedLinkItemIds.length > 0) {
      const { createDocumentLinks } = await import('@/lib/services/documentLinkService');
      
      // Vérifier que les documents existent et appartiennent à l'organisation
      const existingDocuments = await prisma.document.findMany({
        where: {
          id: { in: data.stagedLinkItemIds },
          organizationId,
        },
        select: {
          id: true,
        },
      });
      
      // Créer les liens pour chaque document existant
      for (const doc of existingDocuments) {
        // ✅ Passer loanId pour que createDocumentLinks crée le lien pour le prêt
        await createDocumentLinks(doc.id, {
          id: loan.id,
          propertyId: loan.propertyId,
          loanId: loan.id, // ✅ Indiquer que c'est un prêt
        });
      }
    }

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
      paymentDay: loan.paymentDay,
      rateType: loan.rateType,
      loanType: loan.loanType,
      repaymentType: loan.repaymentType,
      amortizationProfile: loan.amortizationProfile,
      notes: loan.notes,
      isActive: loan.isActive,
      createdAt: loan.createdAt.toISOString(),
      updatedAt: loan.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour du prêt:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du prêt' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/loans/[id]
 * Suppression soft (isActive = false)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    const { searchParams } = new URL(request.url);
    const hard = searchParams.get('hard') === '1';
    // Vérifier que le prêt existe
    const loan = await prisma.loan.findFirst({
      where: { id: params.id, organizationId },
    });

    if (!loan) {
      return NextResponse.json(
        { error: 'Prêt non trouvé' },
        { status: 404 }
      );
    }

    if (hard) {
      // Hard delete : supprimer définitivement et nettoyer les liens
      await prisma.$transaction(async (tx) => {
        await tx.documentLink.deleteMany({
          where: { linkedType: 'loan', linkedId: params.id },
        });
        await tx.document.updateMany({
          where: { loanId: params.id, organizationId },
          data: { loanId: null },
        });
        await tx.loan.delete({
          where: { id: params.id },
        });
      });
    } else {
      // Soft delete : mettre isActive à false
      await prisma.loan.update({
        where: { id: params.id, organizationId },
        data: {
          isActive: false,
        },
      });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Erreur lors de la suppression du prêt:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du prêt' },
      { status: 500 }
    );
  }
}
