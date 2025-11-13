import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import { validateNatureCategoryType } from '@/utils/accountingStyles';

// GET /api/payments/[id] - Récupérer un paiement

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: params.id },
      include: {
        Property: {
          select: { id: true, name: true }
        },
        Lease: {
          select: { 
            id: true, 
            Tenant: { 
              select: { firstName: true, lastName: true } 
            } 
          }
        },
        Category: {
          select: {
            id: true,
            label: true,
            type: true,
            deductible: true,
            capitalizable: true,
          }
        },
        PaymentAttachment: true,
      },
    });

    // Récupérer les documents liés au paiement via metadata.paymentId
    let paymentDocuments = [];
    if (payment) {
      // Trouver les documents liés à ce paiement via metadata
      paymentDocuments = await prisma.document.findMany({
        where: {
          metadata: {
            contains: `"paymentId":"${payment.id}"`
          }
        },
        select: {
          id: true,
          fileName: true,
          mime: true,
          size: true,
          url: true,
          DocumentType: {
            select: {
              code: true,
              label: true,
              icon: true,
            }
          },
          createdAt: true,
        }
      });
    }

    if (!payment) {
      return NextResponse.json({ error: 'Paiement non trouvé' }, { status: 404 });
    }

    // Sérialiser les données (même DTO que GET liste)
    const toDTO = (p: any) => ({
      id: p.id,
      propertyId: p.propertyId,
      leaseId: p.leaseId,
      periodYear: p.periodYear,
      periodMonth: p.periodMonth,
      date: p.date.toISOString(),
      amount: Number(p.amount),
      nature: p.nature,
      accountingCategoryId: p.categoryId,
      accountingCategory: p.accountingCategory,
      label: p.label,
      method: p.method,
      reference: p.reference,
      notes: p.notes,
      Property: p.Property,
      lease: p.lease,
      attachments: [
        // Attachments du payment
        ...(p.attachments?.map((a: any) => ({
          id: a.id,
          filename: a.filename,
          mimeType: a.mimeType,
          size: a.size,
          url: a.url,
        })) ?? []),
        // Documents du paiement (via metadata)
        ...(paymentDocuments?.map((d: any) => ({
          id: d.id,
          filename: d.fileName,
          mimeType: d.mime,
          size: d.size,
          url: d.url,
          documentType: d.DocumentType,
        })) ?? []),
      ],
    });

    return NextResponse.json(toDTO(payment));
  } catch (error) {
    console.error('[GET /api/payments/[id]] Error:', error);
    return NextResponse.json({ 
      error: 'Erreur lors de la récupération du paiement' 
    }, { status: 500 });
  }
}

// PATCH /api/payments/[id] - Modifier un paiement
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const {
      propertyId,
      leaseId,
      date,
      periodYear,
      periodMonth,
      amount,
      nature,
      accountingCategoryId,
      label,
      method,
      reference,
      notes,
      addAttachments = [],
      removeAttachmentIds = [],
    } = body;

    console.log('[PATCH /api/payments/[id]] Full Body:', body);
    console.log('[PATCH /api/payments/[id]] Extracted:', { 
      id: params.id, 
      propertyId, 
      leaseId, 
      date,
      periodYear,
      periodMonth,
      nature,
      accountingCategoryId,
      amount,
      label,
      method,
      reference,
      notes,
      addAttachments: addAttachments.length,
      removeAttachmentIds: removeAttachmentIds.length
    });

    // Validation
    if (amount !== undefined && amount <= 0) {
      return NextResponse.json({ error: 'Le montant doit être positif' }, { status: 400 });
    }

    // Validation nature/catégorie + créer snapshot
    let categorySnapshot = null;
    if (accountingCategoryId) {
      const category = await prisma.category.findUnique({
        where: { id: accountingCategoryId },
        select: { 
          label: true,
          type: true,
          deductible: true,
          capitalizable: true,
        },
      });

      if (!category) {
        return NextResponse.json({ error: 'Catégorie comptable introuvable' }, { status: 400 });
      }

      const validation = validateNatureCategoryType(nature as any, category.type as any);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }

      // Créer le snapshot pour figer l'historique
      categorySnapshot = JSON.stringify({
        label: category.label,
        type: category.type,
        deductible: category.deductible,
        capitalizable: category.capitalizable,
      });
    }

    // Vérifier qu'au moins un champ est fourni pour modification
    const hasDataToUpdate = (date !== undefined && date !== '') || 
                           (nature !== undefined && nature !== '') || 
                           (accountingCategoryId !== undefined) || 
                           (label !== undefined && label !== '') || 
                           (amount !== undefined && amount !== '') || 
                           method !== undefined || 
                           reference !== undefined || 
                           notes !== undefined || 
                           addAttachments.length > 0 || 
                           removeAttachmentIds.length > 0;
    
    if (!hasDataToUpdate) {
      return NextResponse.json({ error: 'Aucune donnée à modifier' }, { status: 400 });
    }

    // Vérifier que le paiement existe
    const existingPayment = await prisma.payment.findUnique({
      where: { id: params.id },
      include: { attachments: true }
    });

    if (!existingPayment) {
      return NextResponse.json({ error: 'Paiement non trouvé' }, { status: 404 });
    }

    // Validation cohérence leaseId/propertyId
    if (leaseId && propertyId) {
      // Vérifier si le bien ou le bail a changé par rapport à l'existant
      const propertyChanged = propertyId !== existingPayment.propertyId;
      const leaseChanged = leaseId !== existingPayment.leaseId;
      
      // Si l'un des deux a changé, vérifier la cohérence
      if (propertyChanged || leaseChanged) {
        const lease = await prisma.lease.findFirst({
          where: { 
            id: leaseId, 
            propertyId: propertyId,
            status: { in: ['ACTIF', 'SIGNÉ'] }
          }
        });
        if (!lease) {
          return NextResponse.json({ 
            error: 'Le bail sélectionné n\'appartient pas au bien choisi' 
          }, { status: 400 });
        }
      }
    }

    // Calculer periodYear/periodMonth si nécessaire
    let finalPeriodYear = periodYear;
    let finalPeriodMonth = periodMonth;

    if (nature && ['LOYER', 'CHARGES'].includes(nature) && leaseId && 
        (periodYear === undefined || periodMonth === undefined)) {
      // Dériver de la date
      const paymentDate = new Date(date || existingPayment.date);
      finalPeriodYear = paymentDate.getFullYear();
      finalPeriodMonth = paymentDate.getMonth() + 1;
    } else if (nature && !['LOYER', 'CHARGES'].includes(nature)) {
      // Pour les autres natures, utiliser le mois de la date
      const paymentDate = new Date(date || existingPayment.date);
      finalPeriodYear = paymentDate.getFullYear();
      finalPeriodMonth = paymentDate.getMonth() + 1;
    }

    // Supprimer les attachments
    if (removeAttachmentIds.length > 0) {
      const attachmentsToDelete = await prisma.paymentAttachment.findMany({
        where: { 
          id: { in: removeAttachmentIds },
          paymentId: params.id 
        }
      });

      // Supprimer les fichiers physiques
      for (const attachment of attachmentsToDelete) {
        try {
          const filePath = join(process.cwd(), 'public', attachment.url);
          await unlink(filePath);
        } catch (error) {
          console.warn(`Failed to delete file ${attachment.url}:`, error);
        }
      }

      // Supprimer de la DB
      await prisma.paymentAttachment.deleteMany({
        where: { 
          id: { in: removeAttachmentIds },
          paymentId: params.id 
        }
      });
    }

    // Ajouter les nouveaux attachments
    const newAttachments = [];
    if (addAttachments.length > 0) {
      const uploadDir = join(process.cwd(), 'public', 'uploads', 'payments', params.id);
      await mkdir(uploadDir, { recursive: true });

      for (const attachment of addAttachments) {
        // Vérifier la taille (10 Mo max)
        const sizeInBytes = (attachment.base64.length * 3) / 4;
        if (sizeInBytes > 10 * 1024 * 1024) {
          return NextResponse.json({ 
            error: `Fichier trop volumineux: ${attachment.filename} (max 10 Mo)` 
          }, { status: 400 });
        }

        // Vérifier le type MIME
        const allowedMimes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        if (!allowedMimes.includes(attachment.mime)) {
          return NextResponse.json({ 
            error: `Type de fichier non supporté: ${attachment.filename}` 
          }, { status: 400 });
        }

        // Convertir base64 en buffer
        const base64Data = attachment.base64.replace(/^data:[^;]+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        // Générer un nom de fichier unique
        const timestamp = Date.now();
        const extension = attachment.filename.split('.').pop();
        const filename = `${timestamp}_${attachment.filename}`;
        const filePath = join(uploadDir, filename);
        const url = `/uploads/payments/${params.id}/${filename}`;

        // Sauvegarder le fichier
        await writeFile(filePath, buffer);

        // Créer l'entrée en DB
        const newAttachment = await prisma.paymentAttachment.create({
          data: {
            paymentId: params.id,
            filename: attachment.filename,
            mimeType: attachment.mime,
            size: buffer.length,
            url,
          },
        });

        newAttachments.push(newAttachment);
      }
    }

    // Mettre à jour le paiement - seulement les champs fournis
    const updateData: any = {};
    if (propertyId !== undefined && propertyId !== '') updateData.propertyId = propertyId;
    if (leaseId !== undefined) {
      // Si leaseId est une chaîne vide, on le met à null pour supprimer la référence
      updateData.leaseId = leaseId === '' ? null : leaseId;
    }
    if (date !== undefined && date !== '') updateData.date = new Date(date);
    if (finalPeriodYear !== undefined) updateData.periodYear = finalPeriodYear;
    if (finalPeriodMonth !== undefined) updateData.periodMonth = finalPeriodMonth;
    if (amount !== undefined && amount !== '') updateData.amount = amount;
    if (nature !== undefined && nature !== '') updateData.nature = nature;
    if (accountingCategoryId !== undefined) {
      updateData.categoryId = accountingCategoryId;
      if (categorySnapshot) {
        updateData.snapshotAccounting = categorySnapshot;
      }
    }
    if (label !== undefined && label !== '') updateData.label = label;
    if (method !== undefined) updateData.method = method;
    if (reference !== undefined) updateData.reference = reference;
    if (notes !== undefined) updateData.notes = notes;

    console.log('[PATCH /api/payments/[id]] Update data:', updateData);

    const updatedPayment = await prisma.payment.update({
      where: { id: params.id },
      data: updateData,
      include: {
        Property: {
          select: { id: true, name: true }
        },
        Lease: {
          select: { 
            id: true, 
            Tenant: { 
              select: { firstName: true, lastName: true } 
            } 
          }
        },
        Category: {
          select: {
            id: true,
            label: true,
            type: true,
            deductible: true,
            capitalizable: true,
          }
        },
        PaymentAttachment: true,
      },
    });

    // Sérialiser la réponse
    const toDTO = (p: any) => ({
      id: p.id,
      propertyId: p.propertyId,
      leaseId: p.leaseId,
      periodYear: p.periodYear,
      periodMonth: p.periodMonth,
      date: p.date.toISOString(),
      amount: Number(p.amount),
      nature: p.nature,
      accountingCategoryId: p.categoryId,
      accountingCategory: p.accountingCategory,
      label: p.label,
      method: p.method,
      reference: p.reference,
      notes: p.notes,
      Property: p.Property,
      lease: p.lease,
      attachments: p.attachments?.map((a: any) => ({
        id: a.id,
        filename: a.filename,
        mimeType: a.mimeType,
        size: a.size,
        url: a.url,
      })) ?? [],
    });

    console.log(`[PATCH /api/payments/[id]] Updated payment ${params.id}`);

    return NextResponse.json(toDTO(updatedPayment));
  } catch (error: any) {
    console.error('[PATCH /api/payments/[id]] Error:', error);
    return NextResponse.json({ 
      error: 'Erreur lors de la modification du paiement',
      details: error.message 
    }, { status: 500 });
  }
}

// DELETE /api/payments/[id] - Supprimer un paiement
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Vérifier que le paiement existe
    const payment = await prisma.payment.findUnique({
      where: { id: params.id },
      include: { attachments: true }
    });

    if (!payment) {
      return NextResponse.json({ error: 'Paiement non trouvé' }, { status: 404 });
    }

    // Supprimer les fichiers physiques des pièces jointes
    for (const attachment of payment.PaymentAttachment) {
      try {
        const filePath = join(process.cwd(), 'public', attachment.url);
        await unlink(filePath);
      } catch (error) {
        console.warn(`Failed to delete file ${attachment.url}:`, error);
      }
    }

    // Supprimer le paiement (cascade supprime les attachments)
    await prisma.payment.delete({
      where: { id: params.id }
    });

    console.log(`[DELETE /api/payments/[id]] Deleted payment ${params.id}`);

    return NextResponse.json({ success: true, message: 'Paiement supprimé avec succès' });
  } catch (error: any) {
    console.error('[DELETE /api/payments/[id]] Error:', error);
    return NextResponse.json({ 
      error: 'Erreur lors de la suppression du paiement',
      details: error.message 
    }, { status: 500 });
  }
}
