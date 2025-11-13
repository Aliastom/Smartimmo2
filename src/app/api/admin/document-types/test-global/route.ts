import { NextRequest, NextResponse } from 'next/server';
import { classificationService } from '@/services/ClassificationService';

// POST /api/admin/document-types/test-global - Tester la classification sur tous les types
export async function POST(request: NextRequest) {
  try {
    // Gérer FormData (fichier) ou JSON (texte)
    let testText = '';
    let fileInfo: any = undefined;
    let runId: string | undefined;
    let ocrMeta: any = undefined; // Métadonnées réelles de l'OCR
    
    try {
      const contentType = request.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        // Gestion du JSON (texte libre ou fichier traité côté client)
        const body = await request.json();
        testText = body.text || ''; // 1) Texte normalisé fourni par /api/ocr
        runId = body.runId;
        fileInfo = body.fileInfo || {
          name: 'texte-libre',
          size: testText.length,
          ocrStatus: 'manual' as const
        };
        
        // Récupérer les métadonnées OCR réelles (pas de simulation)
        ocrMeta = body.ocrMeta;
      } else if (contentType?.includes('multipart/form-data')) {
        // Gestion des fichiers (fallback)
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const textFromForm = formData.get('text') as string;
        const runIdFromForm = formData.get('runId') as string;
        
        runId = runIdFromForm;
        
        if (file) {
          return NextResponse.json({
            success: false,
            error: 'Extraction côté serveur désactivée',
            details: {
              suggestion: 'L\'extraction se fait maintenant côté client. Veuillez utiliser l\'interface web.'
            }
          }, { status: 400 });
        } else if (textFromForm) {
          testText = textFromForm;
          fileInfo = {
            name: 'texte-libre',
            size: textFromForm.length,
            ocrStatus: 'manual' as const
          };
        }
      } else {
        return NextResponse.json({
          success: false,
          error: 'Type de contenu non supporté'
        }, { status: 400 });
      }
    } catch (parseError) {
      console.error('Erreur de parsing:', parseError);
      return NextResponse.json(
        { success: false, error: 'Erreur de parsing des données' },
        { status: 400 }
      );
    }

    if (!testText) {
      return NextResponse.json(
        { success: false, error: 'Aucun texte fourni pour le test' },
        { status: 400 }
      );
    }

    // 3) Log debug (sera aussi loggé dans ClassificationService)
    console.log(`[Test Global] Texte reçu: ${testText.length} caractères, runId: ${runId}`);

    // 1) Utiliser le texte normalisé fourni par /api/ocr
    const result = await classificationService.classify(testText, fileInfo, runId);

    // Si on a un type spécifique sélectionné, tester l'extraction
    const documentTypeId = request.nextUrl.searchParams.get('documentTypeId');
    if (documentTypeId) {
      // TODO: Implémenter l'extraction pour un type spécifique
      // extractionResult = await classificationService.extractForType(testText, documentTypeId);
    }

    return NextResponse.json({
      success: true,
      data: {
        runId: result.runId,
        configVersion: result.configVersion,
        fileInfo: result.fileInfo,
        classification: result.classification,
        extraction: [],
        debug: {
          ...result.debug,
          // Passer les vraies métadonnées OCR (pas de simulation)
          ocrMeta: ocrMeta || undefined
        }
      },
    });
  } catch (error) {
    console.error('Error in global document type test:', error);
    
    return NextResponse.json(
      { success: false, error: 'Erreur lors du test global' },
      { status: 500 }
    );
  }
}
