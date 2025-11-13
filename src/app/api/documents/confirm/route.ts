import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { writeFile, mkdir, readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

/**
 * POST /api/documents/confirm
 * Finalise l'upload d'un document après validation
 */
export async function POST(request: NextRequest) {
  try {
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

    // Générer le chemin de stockage
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    
    const uploadDir = join(process.cwd(), 'uploads', String(year), month);
    await mkdir(uploadDir, { recursive: true });

    // Nom du fichier (sanitize)
    const sanitizedFilename = upload.originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const timestamp = Date.now();
    const filename = `${timestamp}_${sanitizedFilename}`;
    const filePath = join(uploadDir, filename);
    const relativeFilePath = `uploads/${year}/${month}/${filename}`;

    // Écrire le fichier sur disque
    await writeFile(filePath, fileBuffer);

    // Si c'est un remplacement (versioning)
    if (replaceDuplicateId) {
      // Marquer l'ancien comme remplacé
      await prisma.document.update({
        where: { id: replaceDuplicateId },
        data: {
          deletedAt: now,
          replacesDocumentId: replaceDuplicateId,
        }
      });
    }

    // Créer le document en base SEULEMENT lors de la confirmation
    const document = await prisma.document.create({
      data: {
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
        bucketKey: relativeFilePath,
        url: `/uploads/${year}/${month}/${filename}`,
        // Texte OCR extrait lors de l'upload
        extractedText: upload.extractedText || null,
        extractionSource: upload.extractionSource || null,
        // Liaison selon le scope
        ...(scope === 'property' && linkedTo?.propertyId ? {
          propertyId: linkedTo.propertyId
        } : {}),
        ...(linkedTo?.leaseId ? {
          leaseId: linkedTo.leaseId
        } : {}),
        ...(linkedTo?.tenantId ? {
          tenantId: linkedTo.tenantId
        } : {}),
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
