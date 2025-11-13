import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { readFile, writeFile, mkdir, unlink, rename } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { cleanupExpiredTemps } from '@/lib/cleanupTemp';
import { validateDocumentContext, type FinalizeDocumentRequest } from '@/types/document-link';
import { prisma } from '@/lib/prisma';
// import { BailSigneLinksService } from '@/lib/services/bailSigneLinksService'; // OBSOLÃˆTE
import { DocumentAutoLinkingServiceServer, AutoLinkingContext } from '@/lib/services/documentAutoLinkingService.server';



/**
 * POST /api/documents/finalize
 * Finalise l'upload aprÃ¨s validation utilisateur
 * 
 * Accepte maintenant:
 * - context: { entityType, entityId? } pour liaison polymorphique
 * - dedup: { decision, matchedId?, setAsPrimary? } pour gestion des doublons
 * 
 * DÃ©cisions de dÃ©duplication:
 * - link_existing: CrÃ©e uniquement un DocumentLink vers le document existant (pas de nouveau Document)
 * - replace: CrÃ©e un nouveau Document et le dÃ©finit comme principal pour le contexte
 * - keep_both: CrÃ©e un nouveau Document en parallÃ¨le (isPrimary=false par dÃ©faut)
 * - cancel: Annule l'opÃ©ration
 */

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    console.log(`[Finalize] ðŸš€ API de finalisation appelÃ©e - ${new Date().toISOString()}`);
    
    // Nettoyage des fichiers expirÃ©s
    cleanupExpiredTemps().catch(console.error);

    const body = await request.json() as Partial<FinalizeDocumentRequest> & {
      // Anciens paramÃ¨tres pour rÃ©trocompatibilitÃ©
      chosenTypeId?: string;
      predictions?: any[];
      ocrText?: string;
      replaceDuplicateId?: string;
      keepDespiteDuplicate?: boolean;
      userReason?: string;
    };

    const {
      tempId,
      typeCode,
      chosenTypeId, // RÃ©trocompatibilitÃ©
      context,
      dedup,
      customName,
      predictions,
      ocrText,
      replaceDuplicateId, // RÃ©trocompatibilitÃ©
      keepDespiteDuplicate, // RÃ©trocompatibilitÃ©
      userReason,
    } = body;

    // Validation
    if (!tempId) {
      return NextResponse.json(
        { success: false, error: 'tempId manquant' },
        { status: 400 }
      );
    }

    // Charger le meta.json
    const tempDir = join(tmpdir(), 'smartimmo', 'uploads');
    const metaPath = join(tempDir, `${tempId}.meta.json`);
    
    let meta: any;
    try {
      const metaContent = await readFile(metaPath, 'utf-8');
      meta = JSON.parse(metaContent);
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'TEMP_NOT_FOUND', details: 'Fichier temporaire non trouvÃ©' },
        { status: 410 }
      );
    }

    // VÃ©rifier l'expiration
    if (meta.expiresAt && meta.expiresAt < Date.now()) {
      await unlink(meta.filePath).catch(() => {});
      await unlink(metaPath).catch(() => {});
      
      return NextResponse.json(
        { success: false, error: 'TEMP_EXPIRED', details: 'Le fichier temporaire a expirÃ© (TTL: 10 min)' },
        { status: 410 }
      );
    }

    // VÃ©rifier que le fichier existe
    try {
      await readFile(meta.filePath);
    } catch {
      return NextResponse.json(
        { success: false, error: 'TEMP_NOT_FOUND', details: 'Fichier temporaire non trouvÃ© sur le disque' },
        { status: 410 }
      );
    }

    // Valider le contexte (ou utiliser GLOBAL par dÃ©faut)
    const documentContext = context || { entityType: 'GLOBAL' as const };
    const validation = validateDocumentContext(documentContext);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    // GÃ©rer la dÃ©cision de dÃ©duplication
    const decision = dedup?.decision;
    const matchedId = dedup?.matchedId;

    // === CAS 1: CANCEL ===
    if (decision === 'cancel') {
      // Supprimer le fichier temporaire et retourner
      await unlink(meta.filePath).catch(() => {});
      await unlink(metaPath).catch(() => {});
      
      return NextResponse.json({
        success: true,
        cancelled: true,
        message: 'Upload annulÃ© par l\'utilisateur'
      });
    }

    // === CAS 2: LINK_EXISTING ===
    // Ne crÃ©e AUCUN nouveau Document, seulement un DocumentLink
    if (decision === 'link_existing' && matchedId) {
      // VÃ©rifier que le document existant existe
      const existingDoc = await prisma.document.findUnique({
        where: { id: matchedId },
        select: { 
          id: true, 
          filenameOriginal: true,
          documentTypeId: true,
          uploadedAt: true
        }
      });

      if (!existingDoc) {
        return NextResponse.json(
          { success: false, error: 'Document correspondant introuvable' },
          { status: 404 }
        );
      }

      // VÃ©rifier si un lien existe dÃ©jÃ 
      const existingLink = await prisma.documentLink.findFirst({
        where: {
          documentId: matchedId,
          entityType: documentContext.entityType,
          entityId: documentContext.entityId || null,
        }
      });

      if (existingLink) {
        // Lien dÃ©jÃ  existant, on ne fait rien
        console.log(`[Finalize] Lien dÃ©jÃ  existant pour document ${matchedId} vers ${documentContext.entityType}/${documentContext.entityId}`);
      } else {
        // CrÃ©er le lien seulement si ce n'est pas un contexte GLOBAL
        // (les liens GLOBAL sont gÃ©rÃ©s par DocumentAutoLinkingServiceServer)
        if (documentContext.entityType !== 'GLOBAL') {
          await prisma.documentLink.create({
            data: {
              documentId: matchedId,
              linkedType: documentContext.entityType.toLowerCase(),
              linkedId: documentContext.entityId || documentContext.entityType
            }
          });
        }

        // Note: La liaison GLOBAL est maintenant gÃ©rÃ©e par DocumentAutoLinkingServiceServer
        // pour Ã©viter les doublons

        console.log(`[Finalize] Lien crÃ©Ã© pour document existant ${matchedId} vers ${documentContext.entityType}/${documentContext.entityId}`);
      }

      // Supprimer le fichier temporaire (pas besoin de le stocker)
      await unlink(meta.filePath).catch(() => {});
      await unlink(metaPath).catch(() => {});

      return NextResponse.json({
        success: true,
        linked: true,
        documentId: matchedId,
        message: 'Document liÃ© au contexte existant',
        document: {
          id: existingDoc.id,
          name: existingDoc.filenameOriginal,
          uploadedAt: existingDoc.uploadedAt,
        }
      });
    }

    // === CAS 3 & 4: REPLACE ou KEEP_BOTH (ou crÃ©ation normale) ===
    // Dans ces cas, on crÃ©e un nouveau Document

    const now = new Date();

    // Si REPLACE, gÃ©rer le remplacement
    if (decision === 'replace' && matchedId) {
      // Mettre isPrimary=false sur tous les liens existants pour ce contexte
      await prisma.documentLink.updateMany({
        where: {
          entityType: documentContext.entityType,
          entityId: documentContext.entityId || null,
          isPrimary: true,
        },
        data: {
          isPrimary: false,
        }
      });

      console.log(`[Finalize] Remplacement: liens existants mis en isPrimary=false pour ${documentContext.entityType}/${documentContext.entityId}`);
    }

    // CompatibilitÃ© avec l'ancien systÃ¨me de versioning
    if (replaceDuplicateId) {
      await prisma.document.update({
        where: { id: replaceDuplicateId },
        data: {
          deletedAt: now,
          deletedBy: 'system',
        }
      });
    }

    // RÃ©cupÃ©rer le type de document
    const finalTypeCode = typeCode || chosenTypeId;
    let documentTypeId: string | null = null;
    let typeLabel: string = '';
    
    // Pour les doublons conservÃ©s, essayer de rÃ©cupÃ©rer le type de l'original AVANT de modifier le SHA256
    if ((decision === 'keep_both' || userReason === 'doublon_conserve_manuellement')) {
      // Chercher l'original avec le SHA256 original (pas modifiÃ©)
      const originalDoc = await prisma.document.findFirst({
        where: { 
          fileSha256: meta.sha256, // SHA256 original, pas modifiÃ©
          status: 'active'
        },
        select: { 
          id: true,
          documentTypeId: true,
          DocumentType: {
            select: { id: true, label: true, code: true }
          }
        }
      });
      
      if (originalDoc?.documentTypeId) {
        documentTypeId = originalDoc.documentTypeId;
        typeLabel = originalDoc.DocumentType?.label || '';
        console.log(`[Finalize] Type hÃ©ritÃ© de l'original (${originalDoc.id}): ${typeLabel} (${originalDoc.DocumentType?.code})`);
      } else {
        console.log(`[Finalize] L'original n'a pas de type, utilisation du type fourni par l'utilisateur`);
      }
    }
    
    // Si pas de type hÃ©ritÃ©, utiliser le type fourni
    if (!documentTypeId && finalTypeCode) {
      const documentType = await prisma.documentType.findUnique({
        where: { code: finalTypeCode },
        select: { id: true, label: true }
      });
      
      if (documentType) {
        documentTypeId = documentType.id;
        typeLabel = documentType.label;
        console.log(`[Finalize] Type utilisÃ© depuis finalTypeCode: ${typeLabel} (${finalTypeCode})`);
      }
    }

    // DÃ©terminer detectedTypeId Ã  partir des predictions
    let detectedTypeId: string | null = null;
    let typeConfidence: number | null = null;
    
    if (predictions && predictions.length > 0 && predictions[0].typeCode) {
      const detectedType = await prisma.documentType.findUnique({
        where: { code: predictions[0].typeCode },
        select: { id: true }
      });
      
      if (detectedType) {
        detectedTypeId = detectedType.id;
        typeConfidence = predictions[0].score || null;
      }
    }

    // Pour les doublons conservÃ©s manuellement, modifier le hash pour Ã©viter la contrainte d'unicitÃ©
    let finalSha256 = meta.sha256;
    if (decision === 'keep_both' || userReason === 'doublon_conserve_manuellement') {
      // Ajouter un suffixe unique au hash pour permettre la conservation du doublon
      finalSha256 = `${meta.sha256}_duplicate_${Date.now()}`;
    }

    // CrÃ©er le document en base
    const document = await prisma.document.create({
      data: {
        filenameOriginal: customName || meta.originalName,
        fileName: `${meta.originalName}`.replace(/[^a-zA-Z0-9._-]/g, '_'),
        mime: meta.mime,
        size: meta.size,
        fileSha256: finalSha256,
        documentTypeId,
        detectedTypeId,
        typeConfidence,
        typeAlternatives: predictions && predictions.length > 0 ? JSON.stringify(predictions) : null,
        ocrStatus: 'success',
        ocrVendor: 'tesseract',
        ocrConfidence: 0.7,
        extractedText: meta.extractedText || ocrText || null,
        indexed: false,
        status: documentTypeId ? 'classified' : 'pending',
        source: 'upload',
        uploadedBy: null,
        uploadedAt: now,
        // Conserver linkedTo/linkedId pour rÃ©trocompatibilitÃ©
        linkedTo: documentContext.entityType.toLowerCase(),
        linkedId: documentContext.entityId || null,
        userReason: userReason || null,
        // Conserver les relations legacy pour rÃ©trocompatibilitÃ©
        ...(documentContext.entityType === 'PROPERTY' && documentContext.entityId ? {
          propertyId: documentContext.entityId
        } : {}),
        ...(documentContext.entityType === 'LEASE' && documentContext.entityId ? {
          leaseId: documentContext.entityId
        } : {}),
        ...(documentContext.entityType === 'TRANSACTION' && documentContext.entityId ? {
          transactionId: documentContext.entityId
        } : {}),
        ...(documentContext.entityType === 'TENANT' && documentContext.entityId ? {
          tenantId: documentContext.entityId
        } : {}),
        bucketKey: '', // Sera mis Ã  jour
        url: '', // Sera mis Ã  jour
        version: 1,
      },
      include: {
        DocumentType: {
          select: {
            id: true,
            code: true,
            label: true,
          }
        },
        Property: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    });

    // DÃ©placer le fichier vers le stockage dÃ©finitif
    const storageDir = join(process.cwd(), 'storage', 'documents');
    await mkdir(storageDir, { recursive: true });

    const finalFilename = `${document.id}.${meta.ext}`;
    const finalPath = join(storageDir, finalFilename);
    
    // DÃ©placer (ou copier puis supprimer)
    try {
      await rename(meta.filePath, finalPath);
    } catch (renameError) {
      console.warn('[Finalize] Rename failed, falling back to copy:', renameError);
      const fileBuffer = await readFile(meta.filePath);
      await writeFile(finalPath, fileBuffer);
      // Supprimer le fichier temporaire aprÃ¨s copie rÃ©ussie
      try {
        await unlink(meta.filePath);
      } catch (unlinkError) {
        console.warn('[Finalize] Failed to delete temp file:', unlinkError);
        // Ne pas faire Ã©chouer l'opÃ©ration pour Ã§a
      }
    }

    // Supprimer le meta.json
    await unlink(metaPath).catch(console.error);

    // DÃ©finir l'URL finale du document
    const finalDocumentUrl = `/api/documents/${document.id}/file`;
    
    // Mettre Ã  jour le document avec les chemins finaux
    await prisma.document.update({
      where: { id: document.id },
      data: {
        bucketKey: `storage/documents/${finalFilename}`,
        url: finalDocumentUrl,
      }
    });

    // CrÃ©er les DocumentLinks
    const linksToCreate = [];
    
    // 1. Lien vers l'entitÃ© spÃ©cifique (si ce n'est pas GLOBAL)
    if (documentContext.entityType !== 'GLOBAL') {
      linksToCreate.push({
        documentId: document.id,
        linkedType: documentContext.entityType.toLowerCase(),
        linkedId: documentContext.entityId || documentContext.entityType
      });
    }
    
    // 2. Lien GLOBAL pour que le document apparaisse sur la page documents
    // (l'auto-linking utilise upsert donc pas de doublon mÃªme si crÃ©Ã© deux fois)
    linksToCreate.push({
      documentId: document.id,
      linkedType: 'global',
      linkedId: 'global'
    });
    
    // CrÃ©er tous les liens (utilise upsert pour Ã©viter les doublons)
    for (const linkData of linksToCreate) {
      try {
        await prisma.documentLink.upsert({
          where: {
            documentId_linkedType_linkedId: {
              documentId: linkData.documentId,
              linkedType: linkData.linkedType,
              linkedId: linkData.linkedId
            }
          },
          update: {},
          create: linkData
        });
        console.log(`[Finalize] âœ… Lien crÃ©Ã©/trouvÃ©: ${linkData.linkedType} -> ${linkData.linkedId}`);
      } catch (error) {
        console.warn(`[Finalize] âš ï¸ Erreur lors de la crÃ©ation/mise Ã  jour du lien: ${linkData.linkedType} -> ${linkData.linkedId}`, error);
      }
    }

    // Si c'est un document BAIL_SIGNE, crÃ©er les liaisons spÃ©cifiques et mettre Ã  jour le statut du bail
    console.log(`[Finalize] ðŸ” VÃ©rification du type de document:`, {
      documentId: document.id,
      documentTypeId: document.documentTypeId,
      documentTypeCode: document.DocumentType?.code,
      finalTypeCode: finalTypeCode,
      isBailSigne: document.DocumentType?.code === 'BAIL_SIGNE'
    });
    
    if (document.DocumentType?.code === 'BAIL_SIGNE') {
      console.log(`[Finalize] ðŸ” Document BAIL_SIGNE dÃ©tectÃ©: ${document.id}`);
      console.log(`[Finalize] ðŸ” documentContext:`, JSON.stringify(documentContext, null, 2));
      console.log(`[Finalize] ðŸ” document.leaseId:`, document.leaseId);
      
      try {
        // RÃ©cupÃ©rer les informations du bail depuis le contexte ou les relations legacy
        let leaseId: string | null = null;
        let propertyId: string | null = null;
        let tenantsIds: string[] = [];

        if (documentContext.entityType === 'LEASE' && documentContext.entityId) {
          leaseId = documentContext.entityId;
          console.log(`[Finalize] âœ… leaseId rÃ©cupÃ©rÃ© depuis documentContext: ${leaseId}`);
        } else if (document.leaseId) {
          leaseId = document.leaseId;
          console.log(`[Finalize] âœ… leaseId rÃ©cupÃ©rÃ© depuis document.leaseId: ${leaseId}`);
        } else {
          console.log(`[Finalize] âŒ Aucun leaseId trouvÃ©`);
        }

        if (leaseId) {
          // RÃ©cupÃ©rer les informations du bail
          const lease = await prisma.lease.findUnique({
            where: { id: leaseId },
            include: { Tenant: true, Property: true }
          });

          if (lease) {
            propertyId = lease.propertyId;
            tenantsIds = lease.tenantId ? [lease.tenantId] : [];

            // DÃ‰SACTIVÃ‰ : Les liens sont maintenant crÃ©Ã©s par DocumentAutoLinkingServiceServer
            // Cela Ã©vite les doublons (on avait 7 liaisons au lieu de 4)
            // Le service automatique gÃ¨re : LEASE (PRIMARY), PROPERTY (DERIVED), TENANT (DERIVED), GLOBAL (DERIVED)
            console.log(`[Finalize] Les liaisons seront crÃ©Ã©es automatiquement par DocumentAutoLinkingServiceServer pour le bail ${leaseId}`);
            
            /* ANCIEN CODE (doublons) :
            const linksToCreate = [
              { documentId: document.id, linkedType: 'lease', linkedId: leaseId },
              { documentId: document.id, linkedType: 'property', linkedId: lease.propertyId },
              { documentId: document.id, linkedType: 'tenant', linkedId: lease.tenantId },
              { documentId: document.id, linkedType: 'global', linkedId: 'global' }
            ];

            for (const link of linksToCreate) {
              try {
                await prisma.documentLink.create({ data: link });
                console.log(`[Finalize] Lien crÃ©Ã©: ${link.linkedType} â†’ ${link.linkedId}`);
              } catch (error: any) {
                // Ignorer les erreurs de duplicate
                if (!error.message?.includes('Unique constraint')) {
                  console.error(`[Finalize] Erreur crÃ©ation lien ${link.linkedType}:`, error);
                }
              }
            }
            
            console.log(`[Finalize] ${linksToCreate.length} liens crÃ©Ã©s pour document ${document.id}`);
            */

            // DÃ©terminer le statut final : ACTIF si dans la pÃ©riode active, sinon SIGNÃ‰
            const today = new Date();
            const startDate = new Date(lease.startDate);
            const endDate = lease.endDate ? new Date(lease.endDate) : null;
            
            let finalStatus = 'SIGNÃ‰';
            if (endDate && today >= startDate && today <= endDate) {
              finalStatus = 'ACTIF';
            } else if (!endDate && today >= startDate) {
              finalStatus = 'ACTIF';
            }
            
            // Mettre Ã  jour le statut du bail et ajouter l'URL du PDF signÃ©
            await prisma.lease.update({
              where: { id: leaseId },
              data: {
                status: finalStatus,
                signedPdfUrl: finalDocumentUrl,
                updatedAt: new Date()
              }
            });
            console.log(`[Finalize] âœ… Statut du bail ${leaseId} mis Ã  jour Ã  '${finalStatus}' avec URL: ${finalDocumentUrl}`);
          }
        } else {
          console.warn(`[Finalize] Document BAIL_SIGNE ${document.id} sans leaseId, liaisons spÃ©cifiques non crÃ©Ã©es`);
        }
      } catch (linkError) {
        console.error(`[Finalize] âŒ Erreur lors de la crÃ©ation des liaisons BAIL_SIGNE:`, linkError);
        // Ne pas faire Ã©chouer la finalisation pour une erreur de liaison
      }
    }

    // Liaison automatique pour tous les types de documents
    if (document.DocumentType?.code) {
      try {
        const documentTypeCode = document.DocumentType.code;
        
        // VÃ©rifier si ce type de document a des rÃ¨gles de liaison automatique
        if (DocumentAutoLinkingServiceServer.hasAutoLinkingRules(documentTypeCode)) {
          let autoLinkingContext: AutoLinkingContext = {};
          
          // Construire le contexte selon le type d'entitÃ©
          if (documentContext.entityType === 'LEASE' && documentContext.entityId) {
            // RÃ©cupÃ©rer les informations du bail
            const lease = await prisma.lease.findUnique({
              where: { id: documentContext.entityId },
              include: { Tenant: true, Property: true }
            });
            
            if (lease) {
              autoLinkingContext = {
                leaseId: documentContext.entityId,
                propertyId: lease.propertyId,
                tenantsIds: lease.tenantId ? [lease.tenantId] : []
              };
            }
          } else if (documentContext.entityType === 'PROPERTY' && documentContext.entityId) {
            // Contexte pour une propriÃ©tÃ©
            autoLinkingContext = {
              propertyId: documentContext.entityId
            };
          } else if (documentContext.entityType === 'TENANT' && documentContext.entityId) {
            // Contexte pour un locataire
            autoLinkingContext = {
              tenantsIds: [documentContext.entityId]
            };
          }
          // Pour GLOBAL ou autres, autoLinkingContext reste vide

          // CrÃ©er les liaisons automatiques
          await DocumentAutoLinkingServiceServer.createAutoLinks(
            document.id,
            documentTypeCode,
            autoLinkingContext
          );
          
          console.log(`[Finalize] Liaisons automatiques crÃ©Ã©es pour document ${document.id} (type: ${documentTypeCode}, contexte: ${documentContext.entityType})`);
        }
      } catch (autoLinkError) {
        console.error(`[Finalize] Erreur lors de la crÃ©ation des liaisons automatiques:`, autoLinkError);
        // Ne pas faire Ã©chouer la finalisation pour une erreur de liaison automatique
      }
    }

    // Mettre Ã  jour le statut du document vers 'active' aprÃ¨s finalisation
    // Corriger aussi le statut OCR si nÃ©cessaire
    const updateData: any = { status: 'active' };
    
    // Si le document a du texte extrait mais ocrStatus est 'pending', le corriger
    if (document.extractedText && document.extractedText.length > 0 && document.ocrStatus === 'pending') {
      updateData.ocrStatus = 'success';
      updateData.ocrVendor = 'unified-service';
      updateData.ocrConfidence = 0.8;
      console.log(`[Finalize] Correction du statut OCR pending -> success pour document ${document.id}`);
    }
    
    const finalDocument = await prisma.document.update({
      where: { id: document.id },
      data: updateData
    });

    console.log(`[Finalize] Document crÃ©Ã©: ${document.id}, type: ${typeLabel || 'aucun'}, stockage: ${finalFilename}, contexte: ${documentContext.entityType}/${documentContext.entityId}, statut: ${finalDocument.status}`);

    return NextResponse.json({
      success: true,
      documentId: finalDocument.id,
      typeLabel: typeLabel || null,
      status: finalDocument.status,
      downloadUrl: `/api/documents/${finalDocument.id}/file`,
      document: {
        id: finalDocument.id,
        name: finalDocument.filenameOriginal,
        type: finalDocument.DocumentType,
        fileName: finalDocument.fileName,
        uploadedAt: finalDocument.uploadedAt,
        Property: finalDocument.Property,
        status: finalDocument.status,
      }
    });

  } catch (error) {
    console.error('[Finalize] Erreur:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erreur lors de la finalisation',
        details: error instanceof Error ? error.message : 'Erreur inconnue'
      },
      { status: 500 }
    );
  }
}
