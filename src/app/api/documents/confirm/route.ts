import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import crypto from 'crypto';
import { tempUploads } from '../upload/route';
import { prisma } from '@/lib/prisma';



/**
 * POST /api/documents/confirm
 * Finalise l'upload d'un document aprÃ¨s validation
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

    // RÃ©cupÃ©rer le fichier temporaire
    const upload = tempUploads.get(tempId);
    if (!upload) {
      return NextResponse.json(
        { success: false, error: 'Fichier temporaire non trouvÃ© ou expirÃ©' },
        { status: 404 }
      );
    }

    // VÃ©rifier que le type existe
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

    // VÃ©rifier si c'est un doublon sans action choisie
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

    // GÃ©nÃ©rer le chemin de stockage
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    
    const uploadDir = join(process.cwd(), 'uploads', String(year), month);
    await mkdir(uploadDir, { recursive: true });

    // Nom du fichier (sanitize)
    const sanitizedFilename = upload.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const timestamp = Date.now();
    const filename = `${timestamp}_${sanitizedFilename}`;
    const filePath = join(uploadDir, filename);
    const relativeFilePath = `uploads/${year}/${month}/${filename}`;

    // Ã‰crire le fichier sur disque
    await writeFile(filePath, upload.file);

    // Si c'est un remplacement (versioning)
    if (replaceDuplicateId) {
      // Marquer l'ancien comme remplacÃ©
      await prisma.document.update({
        where: { id: replaceDuplicateId },
        data: {
          deletedAt: now,
          replacesDocumentId: replaceDuplicateId,
        }
      });
    }

    // 3) CrÃ©er le document en base SEULEMENT lors de la confirmation
    const document = await prisma.document.create({
      data: {
        filenameOriginal: customName || upload.filename,
        fileName: `${crypto.randomUUID()}_${upload.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`,
        mime: upload.mime,
        size: upload.file.length,
        fileSha256: upload.sha256,
        status: 'classified',
        ocrStatus: 'success',
        source: 'upload',
        uploadedAt: now,
        documentTypeId: documentType.id,
        bucketKey: relativeFilePath,
        url: `/uploads/${year}/${month}/${filename}`,
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

    // Nettoyer le fichier temporaire
    tempUploads.delete(tempId);

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

