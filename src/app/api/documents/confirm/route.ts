import { NextRequest, NextResponse } from 'next/server';
import { readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/getCurrentUser';
import { getStorageService } from '@/services/storage.service';

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

/**
 * POST /api/documents/confirm
 * Finalise l'upload d'un document après validation
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;

    const body = await request.json();
    const {
      tempId,
      finalTypeCode,
      keepDespiteDuplicate = false,
      scope = 'global',
      linkedTo,
      customName,
      replaceDuplicateId, // Pour versioning
    } = body;

    if (!tempId) {
      return NextResponse.json(
        { success: false, error: 'tempId manquant' },
        { status: 400 }
      );
    }

    if (!finalTypeCode) {
      return NextResponse.json(
        { success: false, error: 'Type de document manquant' },
        { status: 400 }
      );
    }

    // Récupérer le fichier temporaire depuis le disque
    const tempDir = join(tmpdir(), 'smartimmo', 'uploads');
    const metaFilePath = join(tempDir, `${tempId}.meta.json`);
    
    let upload: any;
    try {
      const metaContent = await readFile(metaFilePath, 'utf-8');
      upload = JSON.parse(metaContent);

      if (upload.organizationId && upload.organizationId !== organizationId) {
        return NextResponse.json(
          { success: false, error: 'Document temporaire appartenant à une autre organisation' },
          { status: 403 }
        );
      }

      upload.organizationId = upload.organizationId || organizationId;

      // Vérifier l'expiration
      if (Date.now() > upload.expiresAt) {
        return NextResponse.json(
          { success: false, error: 'Fichier temporaire expiré' },
          { status: 404 }
        );
      }
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Fichier temporaire non trouvé ou expiré' },
        { status: 404 }
      );
    }

    // Vérifier que le type existe
    const documentType = await prisma.documentType.findUnique({
      where: { code: finalTypeCode },
      select: { id: true, code: true, label: true }
    });

    if (!documentType) {
      return NextResponse.json(
        { success: false, error: 'Type de document invalide' },
        { status: 400 }
      );
    }

    // Vérifier si c'est un doublon sans action choisie
    if (!keepDespiteDuplicate && !replaceDuplicateId) {
      const existingDoc = await prisma.document.findFirst({
        where: {
          fileSha256: upload.sha256,
          deletedAt: null,
          organizationId: upload.organizationId,
        },
      });

      if (existingDoc) {
        return NextResponse.json(
          {
            success: false,
            error: 'Document en doublon',
            duplicate: {
              isDuplicate: true,
              ofDocumentId: existingDoc.id,
            }
          },
          { status: 409 }
        );
      }
    }

    // Lire le fichier temporaire
    const tempFilePath = upload.filePath;
    const fileBuffer = await readFile(tempFilePath);

    const propertyId =
      scope === 'property' && linkedTo?.propertyId ? linkedTo.propertyId : undefined;
    const leaseId = linkedTo?.leaseId;
    const tenantId = linkedTo?.tenantId;

    if (propertyId) {
      const property = await prisma.property.findFirst({
        where: { id: propertyId, organizationId: upload.organizationId },
        select: { id: true },
      });
      if (!property) {
        return NextResponse.json(
          { success: false, error: 'Bien introuvable ou non autorisé' },
          { status: 404 }
        );
      }
    }

    if (leaseId) {
      const lease = await prisma.lease.findFirst({
        where: { id: leaseId, organizationId: upload.organizationId },
        select: { id: true },
      });
      if (!lease) {
        return NextResponse.json(
          { success: false, error: 'Bail introuvable ou non autorisé' },
          { status: 404 }
        );
      }
    }

    if (tenantId) {
      const tenant = await prisma.tenant.findFirst({
        where: { id: tenantId, organizationId: upload.organizationId },
        select: { id: true },
      });
      if (!tenant) {
        return NextResponse.json(
          { success: false, error: 'Locataire introuvable ou non autorisé' },
          { status: 404 }
        );
      }
    }

    // Lire le fichier temporaire
    const fileBuffer = await readFile(tempFilePath);
    
    // Créer le document en base d'abord pour obtenir l'ID
    const now = new Date();
    const tempDocument = await prisma.document.create({
      data: {
        organizationId: upload.organizationId,
        filenameOriginal: customName || upload.originalName,
        fileName: `${crypto.randomUUID()}_${upload.originalName.replace(/[^a-zA-Z0-9._-]/g, '_')}`,
        mime: upload.mime,
        size: upload.size,
        fileSha256: upload.sha256,
        status: 'classified',
        ocrStatus: 'success',
        source: 'upload',
        uploadedAt: now,
        documentTypeId: documentType.id,
        bucketKey: '', // Sera mis à jour après upload
        url: '', // Sera mis à jour après upload
        // Texte OCR extrait lors de l'upload
        extractedText: upload.extractedText || null,
        extractionSource: upload.extractionSource || null,
        // Liaison selon le scope
        ...(propertyId ? { propertyId } : {}),
        ...(leaseId ? { leaseId } : {}),
        ...(tenantId ? { tenantId } : {}),
      },
    });

    // Upload vers le stockage (local ou Supabase selon STORAGE_TYPE)
    const storageService = getStorageService();
    const sanitizedFilename = (customName || upload.originalName).replace(/[^a-zA-Z0-9._-]/g, '_');
    const { key: bucketKey, url: storageUrl } = await storageService.uploadDocument(
      fileBuffer,
      tempDocument.id,
      sanitizedFilename,
      upload.mime
    );

    // Mettre à jour le document avec les infos de stockage
    const finalDocumentUrl = `/api/documents/${tempDocument.id}/file`;

    // Si c'est un remplacement (versioning)
    if (replaceDuplicateId) {
      const duplicateDoc = await prisma.document.findFirst({
        where: { id: replaceDuplicateId, organizationId: upload.organizationId },
        select: { id: true },
      });

      if (!duplicateDoc) {
        return NextResponse.json(
          { success: false, error: 'Document à remplacer introuvable ou non autorisé' },
          { status: 404 }
        );
      }

      // Marquer l'ancien comme remplacé
      await prisma.document.update({
        where: { id: replaceDuplicateId },
        data: {
          deletedAt: now,
          replacesDocumentId: replaceDuplicateId,
        }
      });
    }

    // Mettre à jour le document avec les infos de stockage
    const document = await prisma.document.update({
      where: { id: tempDocument.id },
      data: {
        bucketKey,
        url: finalDocumentUrl,
      },
      include: {
        DocumentType: {
          select: {
            code: true,
            label: true,
            icon: true,
            color: true,
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

    // Nettoyer les fichiers temporaires
    try {
      await unlink(tempFilePath);
      await unlink(metaFilePath);
    } catch (error) {
      console.warn('[Confirm] Erreur lors du nettoyage des fichiers temporaires:', error);
    }

    return NextResponse.json({
      success: true,
      data: {
        documentId: document.id,
        document: {
          id: document.id,
          name: document.filenameOriginal,
          type: document.DocumentType,
          fileName: document.fileName,
          uploadedAt: document.uploadedAt,
          Property: document.Property,
        }
      }
    });

  } catch (error) {
    console.error('[Confirm Upload] Erreur:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erreur lors de la finalisation de l\'upload',
        details: error instanceof Error ? error.message : 'Erreur inconnue'
      },
      { status: 500 }
    );
  }
}
