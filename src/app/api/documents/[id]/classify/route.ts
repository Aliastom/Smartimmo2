import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { classificationService } from '@/services/ClassificationService';

/**
 * POST /api/documents/[id]/classify - Relancer la classification d'un document
 */

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // TODO: Ajouter protection authentification
    const { id } = params;
    const body = await request.json();
    const { forceReanalysis = false } = body;

    console.log(`[API/Documents/${id}/classify] Demande de reclassification reçue. Force reanalysis: ${forceReanalysis}`);

    // Récupérer le document avec son fichier
    const document = await prisma.document.findUnique({
      where: { id },
      select: {
        id: true,
        filenameOriginal: true,
        extractedText: true,
        size: true,
        mime: true,
        url: true, // Pour récupérer le fichier original
      },
    });

    if (!document) {
      return NextResponse.json(
        { success: false, error: 'Document introuvable' },
        { status: 404 }
      );
    }

    // Utiliser le texte stocké en base (qui devrait être identique à celui de l'upload)
    let rawText = document.extractedText || '';
    let extractionSource: 'pdf-parse' | 'tesseract' | 'pdf-ocr' = 'pdf-parse';
    
    console.log(`[API/Documents/${id}/classify] Utilisation du texte stocké:`, {
      textLength: rawText.length,
      textPreview: rawText.substring(0, 200),
      originalTextLength: document.extractedText?.length || 0
    });

    if (!rawText || rawText.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Aucun texte exploitable trouvé pour ce document' },
        { status: 400 }
      );
    }

    let predictions = [];
    let autoAssigned = false;
    let assignedTypeCode = null;

    if (forceReanalysis) {
      // Re-analyse complète avec le service de classification
      console.log(`[API/Documents/${id}/classify] Re-analyse forcée avec le service de classification`);
      console.log(`[API/Documents/${id}/classify] Données du document:`, {
        filenameOriginal: document.filenameOriginal,
        size: document.size,
        extractedTextLength: rawText.length,
        extractedTextPreview: rawText.substring(0, 200),
        extractionSource: extractionSource
      });

      const classificationResult = await classificationService.classify(rawText, {
        name: document.filenameOriginal,
        size: document.size,
        ocrStatus: 'unknown' // Même paramètre que dans l'upload
      });

      console.log(`[API/Documents/${id}/classify] Résultat classification:`, {
        top3Length: classificationResult.classification.top3.length,
        bestScore: classificationResult.classification.top3[0]?.normalizedScore,
        bestType: classificationResult.classification.top3[0]?.typeLabel,
        autoAssigned: classificationResult.classification.autoAssigned
      });

      // Formater les prédictions comme attendu par le frontend
      predictions = Array.isArray(classificationResult.classification.top3)
        ? classificationResult.classification.top3.map(r => ({
            typeCode: r.typeCode,
            label: r.typeLabel,
            score: r.normalizedScore,
            threshold: r.threshold
          }))
        : [];

      autoAssigned = classificationResult.classification.autoAssigned;
      assignedTypeCode = classificationResult.classification.autoAssigned && classificationResult.classification.top3.length > 0
        ? classificationResult.classification.top3[0].typeCode
        : null;

      // Mettre à jour le document avec les nouvelles prédictions
      await prisma.document.update({
        where: { id },
        data: {
          typeAlternatives: JSON.stringify(predictions),
          detectedTypeId: classificationResult.classification.autoAssigned && classificationResult.classification.top3.length > 0
            ? (await prisma.documentType.findUnique({ where: { code: classificationResult.classification.top3[0].typeCode } }))?.id
            : null,
          typeConfidence: classificationResult.classification.autoAssigned && classificationResult.classification.top3.length > 0
            ? classificationResult.classification.top3[0].normalizedScore
            : null,
          status: classificationResult.classification.autoAssigned ? 'classified' : 'pending',
        },
      });
    } else {
      // Récupérer les prédictions existantes (plus rapide)
      console.log(`[API/Documents/${id}/classify] Récupération des prédictions existantes`);
      
      if (document.typeAlternatives) {
        try {
          const existingPredictions = JSON.parse(document.typeAlternatives);
          predictions = Array.isArray(existingPredictions) ? existingPredictions : [];
          autoAssigned = document.status === 'classified';
          assignedTypeCode = document.detectedTypeId ? 
            (await prisma.documentType.findUnique({ where: { id: document.detectedTypeId } }))?.code || null 
            : null;
          
          console.log(`[API/Documents/${id}/classify] Prédictions existantes récupérées:`, {
            predictionsCount: predictions.length,
            autoAssigned,
            assignedTypeCode
          });
        } catch (error) {
          console.error(`[API/Documents/${id}/classify] Erreur parsing prédictions existantes:`, error);
          predictions = [];
        }
      }
    }

    console.log(`[API/Documents/${id}/classify] Reclassification terminée. Auto-assigné: ${autoAssigned}`);

    return NextResponse.json({
      success: true,
      data: {
        predictions,
        autoAssigned,
        assignedTypeCode,
      },
    });
  } catch (error: any) {
    console.error(`[API/Documents/${id}/classify] Erreur lors de la reclassification:`, error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
