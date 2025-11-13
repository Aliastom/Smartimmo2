import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { documentRecognitionService } from '@/services/DocumentRecognitionService';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    console.log('[API] POST /api/uploads/staged - Début');
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const uploadSessionId = formData.get('uploadSessionId') as string;
    const typeId = formData.get('typeId') as string;
    const intendedContextType = formData.get('intendedContextType') as string;
    const intendedContextTempKey = formData.get('intendedContextTempKey') as string;

    console.log('[API] POST /api/uploads/staged - Données reçues:', {
      fileName: file?.name,
      fileSize: file?.size,
      uploadSessionId,
      typeId,
      intendedContextType,
      intendedContextTempKey
    });

    if (!file || !uploadSessionId) {
      console.log('[API] POST /api/uploads/staged - Erreur: Fichier ou session manquant');
      return NextResponse.json(
        { success: false, error: 'Fichier et session d\'upload requis' },
        { status: 400 }
      );
    }

    // Vérifier que la session d'upload existe et n'est pas expirée
    const uploadSession = await prisma.uploadSession.findFirst({
      where: {
        id: uploadSessionId,
        expiresAt: {
          gt: new Date()
        }
      }
    });

    if (!uploadSession) {
      return NextResponse.json(
        { success: false, error: 'Session d\'upload invalide ou expirée' },
        { status: 400 }
      );
    }

    // Générer un nom de fichier unique
    const fileExtension = file.name.split('.').pop();
    const uniqueFilename = `${uuidv4()}.${fileExtension}`;
    const tempDir = join(process.cwd(), 'storage', 'tmp');
    const filePath = join(tempDir, uniqueFilename);

    // Créer le dossier tmp s'il n'existe pas
    await mkdir(tempDir, { recursive: true });

    // Sauvegarder le fichier temporairement
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Calculer le hash SHA256 du fichier
    const crypto = require('crypto');
    const fileSha256 = crypto.createHash('sha256').update(buffer).digest('hex');

    // 🔍 VÉRIFICATION DES BROUILLONS EXISTANTS
    const existingDraft = await prisma.document.findFirst({
      where: {
        fileSha256,
        status: 'draft'
      }
    });

    if (existingDraft) {
      console.log('[API] Document existe déjà en brouillon:', existingDraft.id);
      return NextResponse.json({
        success: false,
        code: 'DRAFT_EXISTS',
        error: 'Ce document existe déjà en brouillon. Veuillez purger les brouillons avant de ré-uploader ce document.',
        draftId: existingDraft.id,
        fileName: existingDraft.filenameOriginal
      }, { status: 400 });
    }

    // 🔍 DÉTECTION DES DOUBLONS - Conforme à la spécification
    const existingDocument = await prisma.document.findFirst({
      where: {
        fileSha256,
        status: 'active' // Seulement les documents actifs
      },
      include: {
        DocumentType: {
          select: {
            id: true,
            label: true
          }
        },
        DocumentLink: {
          select: {
            linkedType: true,
            linkedId: true
          }
        }
      }
    });

    if (existingDocument) {
      console.log('[API] Doublon exact détecté:', existingDocument.id);
      
      // Retourner 409 avec payload exploitable selon la spécification
      return NextResponse.json({
        code: "DUPLICATE_FILE",
        policy: "block",
        existing: {
          id: existingDocument.id,
          fileName: existingDocument.filenameOriginal,
          typeLabel: existingDocument.DocumentType?.label || 'Type inconnu',
          links: existingDocument.DocumentLink.map(link => ({
            type: link.linkedType,
            id: link.linkedId
          }))
        }
      }, { status: 409 });
    }

    // Vérifier que le type de document existe si fourni
    let validTypeId = null;
    if (typeId) {
      const documentType = await prisma.documentType.findUnique({
        where: { id: typeId }
      });
      if (documentType) {
        validTypeId = typeId;
      }
    }

    // Analyser le document avec le service unifié (OCR + Classification)
    console.log('[API] Analyse du document avec le service unifié:', file.name);
    const analysisResult = await documentRecognitionService.analyzeDocument(file);
    
    let textContent = null;
    let predictions = [];
    let assignedTypeCode: string | null = null;
    
      if (analysisResult.success) {
        textContent = analysisResult.text;
        predictions = analysisResult.predictions || [];
        assignedTypeCode = analysisResult.assignedTypeCode || null;
        console.log('[API] Analyse réussie:', {
          textLength: textContent?.length || 0,
          predictionsCount: predictions.length,
          autoAssigned: analysisResult.autoAssigned,
          assignedTypeCode: assignedTypeCode
        });

        // Vérifier les near-duplicates avec le texte extrait
        if (textContent && textContent.length > 100) {
          // Calculer le hash du texte normalisé
          const normalizedText = textContent.toLowerCase().replace(/\s+/g, ' ').trim();
          const textSha256 = crypto.createHash('sha256').update(normalizedText).digest('hex');
          
          // TODO: Implémenter la détection de doublons similaires si nécessaire
          // Pour l'instant, on se contente de la détection de doublons exacts
          console.log('[API] Hash du texte calculé:', textSha256.substring(0, 16) + '...');
        }
      } else {
        console.warn('[API] Analyse échouée, utilisation du fallback:', analysisResult.error);
      }

    // Déterminer le type de document à connecter
    let finalDocumentTypeId: string | undefined = undefined;
    if (assignedTypeCode) {
      // Trouver le documentType par code
      const assignedDocumentType = await prisma.documentType.findUnique({
        where: { code: assignedTypeCode },
        select: { id: true }
      });
      if (assignedDocumentType) {
        finalDocumentTypeId = assignedDocumentType.id;
        console.log('[API] Type auto-assigné trouvé:', { code: assignedTypeCode, id: finalDocumentTypeId });
      }
    } else if (validTypeId) {
      finalDocumentTypeId = validTypeId;
    }

    // Calculer textSha256 si on a du texte
    let textSha256: string | null = null;
    if (textContent && textContent.length > 100) {
      const normalizedText = textContent.toLowerCase().replace(/\s+/g, ' ').trim();
      textSha256 = crypto.createHash('sha256').update(normalizedText).digest('hex');
    }

    // Créer le document en mode draft avec le texte extrait
    const document = await prisma.document.create({
      data: {
        ownerId: 'default',
        bucketKey: `tmp/${uniqueFilename}`,
        filenameOriginal: file.name,
        fileName: file.name,
        mime: file.type,
        fileSha256,
        textSha256,
        size: file.size,
        url: `/storage/tmp/${uniqueFilename}`,
        status: 'draft',
        source: 'staged-upload',
        // ✅ Définir correctement le statut OCR selon le résultat de l'analyse
        ocrStatus: textContent && textContent.length > 0 ? 'success' : 'failed',
        ocrVendor: analysisResult.success ? 'unified-service' : undefined,
        ocrConfidence: analysisResult.success ? 0.8 : undefined,
        ocrError: !analysisResult.success ? analysisResult.error : undefined,
        UploadSession: {
          connect: { id: uploadSessionId }
        },
        intendedContextType,
        intendedContextTempKey,
        DocumentType: finalDocumentTypeId ? {
          connect: { id: finalDocumentTypeId }
        } : undefined,
        extractedText: textContent // Ajouter le texte extrait par OCR
      }
    });

    return NextResponse.json({
      success: true,
      document: {
        id: document.id,
        name: document.fileName,
        status: 'draft',
        type: typeId,
        intendedContext: {
          type: intendedContextType,
          tempKey: intendedContextTempKey
        },
        size: document.size,
        mime: document.mime,
        uploadedAt: document.uploadedAt,
        // Ajouter les résultats de l'analyse
        analysis: {
          textExtracted: !!textContent,
          textLength: textContent?.length || 0,
          predictions: predictions,
          autoAssigned: analysisResult.autoAssigned,
          assignedTypeCode: analysisResult.assignedTypeCode
        }
      }
    });
  } catch (error) {
    console.error('[API] POST /api/uploads/staged - Erreur:', error);
    console.error('[API] POST /api/uploads/staged - Stack:', error instanceof Error ? error.stack : 'No stack');
    return NextResponse.json(
      { success: false, error: 'Erreur lors de l\'upload du fichier' },
      { status: 500 }
    );
  }
}
