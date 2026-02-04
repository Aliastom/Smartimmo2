import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/getCurrentUser';
import { createTransactionServicePrisma } from '@/domain/services/transactionServiceFactory';
import { getGestionSettings, mapTransactionServiceErrorToHttpStatus } from '@/domain/services/transactionServiceHelpers';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;

    const transaction = await prisma.transaction.findFirst({
      where: { id: params.id, organizationId },
      include: {
        Property: {
          select: {
            id: true,
            name: true,
            address: true
          }
        },
        Lease_Transaction_leaseIdToLease: {
          select: {
            id: true,
            status: true,
            Tenant: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          }
        },
        Category: {
          select: {
            id: true,
            label: true
          }
        },
        Lease_Transaction_bailIdToLease: {
          select: {
            id: true,
            status: true,
            Tenant: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    });

    if (!transaction) {
      return NextResponse.json(
        { error: 'Transaction non trouvée' },
        { status: 404 }
      );
    }

    return NextResponse.json(transaction);
  } catch (error) {
    console.error('Erreur lors de la récupération de la transaction:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de la transaction' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    const body = await request.json();

    const transaction = await prisma.transaction.findFirst({
      where: { id: params.id, organizationId },
      select: { id: true }
    });

    if (!transaction) {
      return NextResponse.json(
        { error: 'Transaction non trouvée' },
        { status: 404 }
      );
    }

    // Mise à jour partielle (utilisée pour le rapprochement)
    const updated = await prisma.transaction.update({
      where: { id: params.id },
      data: {
        rapprochementStatus: body.rapprochementStatus,
        dateRapprochement: body.rapprochementStatus === 'rapprochee' ? new Date() : null,
        bankRef: body.bankRef || null,
      }
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Erreur lors de la mise à jour partielle de la transaction:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour partielle de la transaction' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    const body = await request.json();

    // Extraire les documentIds depuis stagedLinkItemIds (UploadStagedItem → Document)
    let stagedLinkDocumentIds: string[] = [];
    if (body.stagedLinkItemIds && body.stagedLinkItemIds.length > 0) {
      const stagedLinks = await prisma.uploadStagedItem.findMany({
        where: {
          id: { in: body.stagedLinkItemIds },
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
      
      stagedLinkDocumentIds = stagedLinks
        .filter(item => item.Document)
        .map(item => item.Document!.id);
    }

    // Récupérer les settings de gestion déléguée
    const gestionSettings = await getGestionSettings();

    // Créer TransactionService avec repos Prisma
    const transactionService = createTransactionServicePrisma();

    // Appeler TransactionService (logique métier centralisée)
    const result = await transactionService.updateTransaction(params.id, {
      propertyId: body.propertyId,
      leaseId: body.leaseId !== undefined ? body.leaseId : undefined,
      categoryId: body.categoryId,
      natureId: body.natureId,
      nature: body.nature,
      label: body.label,
      amount: body.amount ? parseFloat(body.amount) : undefined,
      date: body.date,
      reference: body.reference,
      notes: body.notes,
      paidAt: body.paidAt || body.paymentDate || undefined,
      method: body.method || body.paymentMethod || undefined,
      accountingMonth: body.accountingMonth || body.periodStart || undefined,
      monthsCovered: body.monthsCovered,
      rapprochementStatus: body.rapprochementStatus,
      bankRef: body.bankRef,
      montantLoyer: body.montantLoyer ? parseFloat(body.montantLoyer) : undefined,
      chargesRecup: body.chargesRecup ? parseFloat(body.chargesRecup) : undefined,
      chargesNonRecup: body.chargesNonRecup ? parseFloat(body.chargesNonRecup) : undefined,
      isAutoAmount: body.isAutoAmount,
      stagedDocumentIds: body.stagedDocumentIds || [],
      stagedLinkItemIds: stagedLinkDocumentIds,
      ...gestionSettings,
    });

    // Gestion spécifique API : Migration des fichiers (tmp/ → documents/)
    // TransactionService a déjà créé les liens DocumentLink, on migre juste les fichiers
    if (body.stagedDocumentIds && body.stagedDocumentIds.length > 0) {
      const { getStorageService } = await import('@/services/storage.service');
      const storageService = getStorageService();
      
      for (const docId of body.stagedDocumentIds) {
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
        
        if (!doc || !doc.bucketKey || doc.bucketKey.startsWith('documents/')) {
          continue;
        }
        
        try {
          const fileBuffer = await storageService.downloadDocument(doc.bucketKey);
          const fileExtension = doc.filenameOriginal?.split('.').pop() || 'pdf';
          const finalFilename = `${doc.id}.${fileExtension}`;
          
          const uploadResult = await storageService.uploadDocument(
            fileBuffer,
            doc.id,
            finalFilename,
            doc.mime || 'application/octet-stream'
          );
          
          try {
            await storageService.deleteDocument(doc.bucketKey);
          } catch (deleteError) {
            console.warn(`[API] Impossible de supprimer l'ancien fichier ${doc.bucketKey}:`, deleteError);
          }
          
          await prisma.document.update({
            where: { id: doc.id },
            data: {
              bucketKey: uploadResult.key,
              url: `/api/documents/${doc.id}/file`
            }
          });
        } catch (uploadError: any) {
          console.error(`[API] ❌ Erreur upload document final pour ${docId}:`, uploadError);
        }
      }
    }

    // Supprimer les UploadStagedItem après traitement
    if (body.stagedLinkItemIds && body.stagedLinkItemIds.length > 0) {
      await prisma.uploadStagedItem.deleteMany({
        where: { id: { in: body.stagedLinkItemIds } }
      });
    }

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Erreur lors de la mise à jour de la transaction:', error);
    
    // Mapper l'erreur TransactionService vers le bon status HTTP
    const status = mapTransactionServiceErrorToHttpStatus(error);
    const errorMessage = error.message || 'Erreur lors de la mise à jour de la transaction';
    
    return NextResponse.json(
      { error: errorMessage },
      { status }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    
    // Récupérer le mode de suppression depuis les query params
    const url = new URL(request.url);
    const mode = (url.searchParams.get("mode") as "delete_docs" | "keep_docs_globalize") ?? "keep_docs_globalize";
    const deleteChildren = url.searchParams.get("deleteChildren") === "true";

    // Récupérer les bucketKeys AVANT suppression (pour supprimer les fichiers physiques après)
    let documentsToDelete: Array<{ id: string; bucketKey: string; fileName: string; filenameOriginal: string | null }> = [];
    if (mode === 'delete_docs') {
      const documentLinks = await prisma.documentLink.findMany({
        where: {
          linkedType: 'transaction',
          linkedId: params.id,
          Document: {
            organizationId
          }
        },
        include: {
          Document: {
            select: {
              id: true,
              bucketKey: true,
              fileName: true,
              filenameOriginal: true
            }
          }
        }
      });
      documentsToDelete = documentLinks
        .filter(link => link.Document)
        .map(link => ({
          id: link.Document!.id,
          bucketKey: link.Document!.bucketKey || '',
          fileName: link.Document!.fileName,
          filenameOriginal: link.Document!.filenameOriginal
        }));
    }

    // Créer TransactionService avec repos Prisma
    const transactionService = createTransactionServicePrisma();

    // Appeler TransactionService (logique métier centralisée)
    const result = await transactionService.deleteTransaction(params.id, {
      mode,
      deleteChildren,
    });

    // Gestion spécifique API : Supprimer les fichiers physiques si mode delete_docs
    if (mode === 'delete_docs' && documentsToDelete.length > 0) {
      const { getStorageService } = await import('@/services/storage.service');
      const storageService = getStorageService();
      
      for (const doc of documentsToDelete) {
        if (doc.bucketKey) {
          try {
            const normalizedKey = storageService.normalizeBucketKey(
              doc.bucketKey,
              doc.id,
              doc.filenameOriginal || doc.fileName || 'document'
            );
            await storageService.deleteDocument(normalizedKey);
          } catch (error) {
            // Ne pas faire échouer la suppression si le fichier n'existe pas
            console.warn(`[API] ⚠️  Fichier physique non trouvé pour document ${doc.id}:`, error);
          }
        }
      }
    }

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Erreur lors de la suppression de la transaction:', error);
    
    // Mapper l'erreur TransactionService vers le bon status HTTP
    const status = mapTransactionServiceErrorToHttpStatus(error);
    const errorMessage = error.message || 'Erreur lors de la suppression de la transaction';
    
    return NextResponse.json(
      { error: errorMessage },
      { status }
    );
  }
}
