import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { 
  getSuggestedCategoryId, 
  generateRentLabel, 
  generateReceiptNote, 
  generateIdempotencyKey 
} from '@/utils/categoryUtils';

const receiptSchema = z.object({
  leaseId: z.string().min(1, 'Le bail est requis'),
  amount: z.number().positive('Le montant doit être positif'),
  rentAmount: z.number().min(0, 'Le montant du loyer doit être positif ou nul').optional(),
  chargesAmount: z.number().min(0, 'Le montant des charges doit être positif ou nul').optional(),
  paidAt: z.string().datetime('Date de paiement invalide'),
  method: z.string().optional().default('TRANSFER'),
  notes: z.string().optional(),
  generateReceipt: z.boolean().optional().default(true),
  receiptPdfBase64: z.string().optional(), // PDF en base64 pour l'attacher
  attachments: z.array(z.string()).optional().default([]), // IDs des documents uploadés
  monthsCovered: z.string().optional(), // Format AAAA-MM
  idempotencyKey: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    console.log('[API /receipts] Starting request...');
    const body = await request.json();
    console.log('[API /receipts] Request body:', body);
    
    const validatedData = receiptSchema.parse(body);
    console.log('[API /receipts] Validated data:', validatedData);

    const {
      leaseId,
      amount,
      rentAmount,
      chargesAmount,
      paidAt,
      method,
      notes,
      generateReceipt,
      receiptPdfBase64,
      attachments,
      monthsCovered,
      idempotencyKey,
    } = validatedData;

    // 1. Charger le bail et récupérer les informations nécessaires
    console.log('[API /receipts] Loading lease:', leaseId);
    const lease = await prisma.lease.findUnique({
      where: { id: leaseId },
      include: {
        Property: {
          select: { id: true, name: true }
        },
        Tenant: {
          select: { id: true, firstName: true, lastName: true }
        }
      }
    });

    console.log('[API /receipts] Lease found:', lease);

    if (!lease) {
      console.log('[API /receipts] Lease not found');
      return NextResponse.json({ error: 'Bail non trouvé' }, { status: 404 });
    }

    // 2. Déterminer les montants finaux (utiliser ceux fournis ou fallback sur le bail)
    const finalRentAmount = rentAmount !== undefined ? rentAmount : (lease.rentAmount || 0);
    const finalChargesAmount = chargesAmount !== undefined ? chargesAmount : (lease.chargesRecupMensuelles || 0);
    const finalTotalAmount = finalRentAmount + finalChargesAmount;

    console.log('[API /receipts] Montants finaux:', {
      rentAmount: finalRentAmount,
      chargesAmount: finalChargesAmount,
      totalAmount: finalTotalAmount
    });

    // 3. Déterminer la catégorie comptable
    console.log('[API /receipts] Getting suggested category...');
    const categoryId = await getSuggestedCategoryId('LOYER');
    console.log('[API /receipts] Category ID:', categoryId);
    
    if (!categoryId) {
      console.log('[API /receipts] No category found');
      return NextResponse.json({ error: 'Catégorie comptable non trouvée' }, { status: 500 });
    }

    // 3. Générer les données de la transaction
    const paidAtDate = new Date(paidAt);
    const finalIdempotencyKey = idempotencyKey || generateIdempotencyKey(leaseId, finalTotalAmount, paidAtDate);
    
    // Déterminer la période couverte
    let finalMonthsCovered = monthsCovered;
    if (!finalMonthsCovered) {
      const month = paidAtDate.getMonth() + 1;
      const year = paidAtDate.getFullYear();
      finalMonthsCovered = `${year}-${month.toString().padStart(2, '0')}`;
    }

    const label = generateRentLabel(
      parseInt(finalMonthsCovered.split('-')[1]),
      parseInt(finalMonthsCovered.split('-')[0]),
      lease.Property.name
    );

    const finalNotes = generateReceiptNote(notes);

    // 4. Créer la transaction
    let transaction;
    try {
      // Essayer de créer une nouvelle transaction
      transaction = await prisma.transaction.create({
        data: {
          propertyId: lease.Property.id,
          leaseId,
          categoryId,
          label,
          amount: finalTotalAmount,
          date: paidAtDate,
          month: parseInt(finalMonthsCovered.split('-')[1]),
          year: parseInt(finalMonthsCovered.split('-')[0]),
          accounting_month: finalMonthsCovered,
          nature: 'LOYER',
          paidAt: paidAtDate,
          method,
          notes: finalNotes,
          source: 'RECEIPT',
          idempotencyKey: finalIdempotencyKey,
          monthsCovered: finalMonthsCovered,
        },
      });
    } catch (error: any) {
      // Si erreur de contrainte unique, chercher la transaction existante
      if (error.code === 'P2002' || error.message?.includes('unique')) {
        console.log('Transaction already exists, finding existing one...');
        const existingTransaction = await prisma.transaction.findFirst({
          where: {
            leaseId,
            amount,
            paidAt: paidAtDate,
          }
        });

        if (existingTransaction) {
          // Mettre à jour la transaction existante
          transaction = await prisma.transaction.update({
            where: { id: existingTransaction.id },
            data: {
              notes: finalNotes,
              updatedAt: new Date(),
            },
          });
        } else {
          throw error; // Re-throw si on ne trouve pas la transaction existante
        }
      } else {
        throw error; // Re-throw les autres erreurs
      }
    }

    // 5. Créer aussi un enregistrement Payment pour l'interface
    const payment = await prisma.payment.create({
      data: {
        propertyId: lease.Property.id,
        leaseId,
        periodYear: parseInt(finalMonthsCovered.split('-')[0]),
        periodMonth: parseInt(finalMonthsCovered.split('-')[1]),
        date: paidAtDate,
        amount: finalTotalAmount,
        nature: 'LOYER',
        categoryId,
        label,
        method,
        notes: finalNotes,
      },
    });

    console.log('[API /receipts] Payment créé:', payment.id);

    // 6. Générer la quittance PDF si demandé
    let receiptDocument = null;
    if (generateReceipt) {
      try {
        // Pour l'instant, créer un document placeholder
        // TODO: Implémenter la génération PDF côté serveur avec une approche compatible
        
        const monthLabel = new Date(paidAtDate).toLocaleDateString('fr-FR', { month: 'long' });
        const monthCapitalized = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
        
        // Créer un nom de fichier unique
        const fileName = `quittance_${monthCapitalized.toLowerCase()}_${paidAtDate.getFullYear()}_${lease.Tenant?.lastName || 'locataire'}.pdf`;
        const fileId = `receipt_${transaction.id}_${Date.now()}`;
        const filePath = `/uploads/receipts/${fileId}.pdf`;
        
        // Calculer la taille du PDF si fourni
        let pdfSize = 0;
        let pdfUrl = filePath;
        
        if (receiptPdfBase64) {
          try {
            // Extraire les données base64 (enlever le préfixe data:application/pdf;base64,)
            const base64Data = receiptPdfBase64.replace(/^data:application\/pdf;base64,/, '');
            
            // Convertir en Buffer
            const pdfBuffer = Buffer.from(base64Data, 'base64');
            pdfSize = pdfBuffer.length;
            
            // Créer le chemin du fichier
            const actualFilePath = `public/uploads/receipts/${fileId}.pdf`;
            pdfUrl = `/uploads/receipts/${fileId}.pdf`;
            
            // Sauvegarder le fichier
            const fs = await import('fs/promises');
            await fs.writeFile(actualFilePath, pdfBuffer);
            
            console.log('[API /receipts] PDF sauvegardé:', actualFilePath, 'taille:', pdfSize, 'bytes');
          } catch (error) {
            console.error('[API /receipts] Erreur lors de la sauvegarde du PDF:', error);
            pdfSize = 0;
          }
        }

        // Récupérer l'ID du type de document RENT_RECEIPT
        const rentReceiptType = await prisma.documentType.findUnique({
          where: { code: 'RENT_RECEIPT' },
        });

        if (!rentReceiptType) {
          throw new Error('Document type RENT_RECEIPT not found');
        }

        receiptDocument = await prisma.document.create({
          data: {
            fileName,
            mime: 'application/pdf',
            size: pdfSize,
            url: pdfUrl,
            documentTypeId: rentReceiptType.id, // Utiliser le nouveau système de types
            propertyId: lease.Property.id,
            transactionId: transaction.id,
            leaseId,
            metadata: JSON.stringify({
              rentAmount: finalRentAmount,
              chargesAmount: finalChargesAmount,
              total: finalTotalAmount,
              receiptType: 'rent_receipt',
              generatedAt: new Date().toISOString(),
              pdfGenerated: true,
              hasPdfData: !!receiptPdfBase64,
            }),
          },
        });
        
        console.log('[API /receipts] Document quittance créé (PDF à générer):', receiptDocument.id);
      } catch (error) {
        console.error('[API /receipts] Erreur lors de la création du document quittance:', error);
        // Ne pas faire échouer la transaction si la création du document échoue
        receiptDocument = null;
      }
    }

    // 6. Lier les documents uploadés
    const linkedDocuments = [];
    if (attachments && attachments.length > 0) {
      for (const attachmentId of attachments) {
        const document = await prisma.document.update({
          where: { id: attachmentId },
          data: {
            transactionId: transaction.id,
            type: 'ATTACHMENT',
          },
        });
        linkedDocuments.push(document);
      }
    }

    // 7. Retourner le résultat
    return NextResponse.json({
      success: true,
      transaction: {
        id: transaction.id,
        label: transaction.label,
        amount: transaction.amount,
        date: transaction.date,
        nature: transaction.nature,
        source: transaction.source,
      },
      payment: {
        id: payment.id,
        label: payment.label,
        amount: payment.amount,
        date: payment.date,
        nature: payment.nature,
      },
      amounts: {
        rentAmount: finalRentAmount,
        chargesAmount: finalChargesAmount,
        total: finalTotalAmount,
      },
      documents: [
        ...(receiptDocument ? [receiptDocument] : []),
        ...linkedDocuments,
      ],
      lease: {
        id: lease.id,
        propertyName: lease.Property.name,
        tenantName: `${lease.Tenant.firstName} ${lease.Tenant.lastName}`,
      },
    });

  } catch (error) {
    console.error('[API /receipts] Error creating receipt transaction:', error);
    console.error('[API /receipts] Error stack:', error instanceof Error ? error.stack : 'No stack');
    
    if (error instanceof z.ZodError) {
      console.error('[API /receipts] Zod validation error:', error.errors);
      return NextResponse.json({ 
        error: 'Données invalides', 
        details: error.errors 
      }, { status: 400 });
    }

    return NextResponse.json({ 
      error: 'Erreur lors de la création de la transaction',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
