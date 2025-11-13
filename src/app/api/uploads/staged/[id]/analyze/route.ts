import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { documentRecognitionService } from '@/services/DocumentRecognitionService';

/**
 * POST /api/uploads/staged/[id]/analyze
 * Analyser un document brouillon avec le vrai processus OCR/IA
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('[API] Analyse du document brouillon:', params.id);

    // 1. Récupérer le document brouillon
    const document = await prisma.document.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        fileName: true,
        textContent: true,
        status: true,
        filePath: true
      }
    });

    if (!document) {
      return NextResponse.json(
        { success: false, error: 'Document non trouvé' },
        { status: 404 }
      );
    }

    if (document.status !== 'draft') {
      return NextResponse.json(
        { success: false, error: 'Document n\'est pas en mode brouillon' },
        { status: 400 }
      );
    }

    console.log('[API] Document trouvé:', {
      id: document.id,
      fileName: document.fileName,
      hasText: !!document.textContent
    });

    // 2. Analyser le document avec le service unifié
    let analysisResult;

    if (document.textContent) {
      // Utiliser le texte existant
      console.log('[API] Analyse avec texte existant');
      analysisResult = await documentRecognitionService.analyzeExistingDocument({
        id: document.id,
        fileName: document.fileName,
        textContent: document.textContent
      });
    } else {
      // Fallback vers l'analyse par nom de fichier
      console.log('[API] Analyse par nom de fichier (pas de texte)');
      analysisResult = await documentRecognitionService.analyzeByFilename(document.fileName);
    }

    if (!analysisResult.success) {
      return NextResponse.json(
        { success: false, error: analysisResult.error },
        { status: 500 }
      );
    }

    console.log('[API] Analyse terminée:', {
      predictionsCount: analysisResult.predictions?.length || 0
    });

    // 3. Retourner les résultats
    return NextResponse.json({
      success: true,
      data: {
        documentId: document.id,
        fileName: document.fileName,
        predictions: analysisResult.predictions || [],
        analysisMethod: document.textContent ? 'full_analysis' : 'filename_analysis'
      }
    });

  } catch (error) {
    console.error('[API] Erreur lors de l\'analyse:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
