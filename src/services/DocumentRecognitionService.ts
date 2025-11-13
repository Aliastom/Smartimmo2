import { prisma } from '@/lib/prisma';
import { classificationService } from './ClassificationService';

/**
 * Service unifié de reconnaissance de documents
 * Utilise le même processus OCR/IA que la page centrale d'upload
 */
export class DocumentRecognitionService {
  private classificationService = classificationService;

  /**
   * Analyse complète d'un document (OCR + Classification)
   * Utilise le même processus que /api/documents/upload
   */
  async analyzeDocument(file: File): Promise<{
    success: boolean;
    text?: string;
    predictions?: Array<{
      typeCode: string;
      label: string;
      score: number;
      threshold: number;
      typeId: string;
    }>;
    autoAssigned?: boolean;
    assignedTypeCode?: string | null;
    error?: string;
  }> {
    try {
      console.log('[DocumentRecognition] Début de l\'analyse:', file.name);

      // 1. Extraction OCR via l'API existante
      const ocrResult = await this.extractTextWithOCR(file);
      
      if (!ocrResult.success) {
        return {
          success: false,
          error: ocrResult.error || 'Erreur lors de l\'extraction OCR'
        };
      }

      console.log('[DocumentRecognition] OCR réussi:', {
        textLength: ocrResult.text?.length || 0,
        source: ocrResult.source
      });

      // 2. Classification via le service existant
      const classificationResult = await this.classificationService.classify(
        ocrResult.text || '',
        {
          name: file.name,
          size: file.size,
          pages: ocrResult.pagesOcred,
          ocrStatus: ocrResult.source === 'pdf-parse' ? 'native' : 'scanned'
        }
      );

      console.log('[DocumentRecognition] Classification terminée:', {
        predictionsCount: classificationResult.classification?.top3?.length || 0,
        autoAssigned: classificationResult.classification?.autoAssigned
      });

      // 3. Formater les prédictions pour le frontend
      const predictions = classificationResult.classification?.top3?.map(pred => ({
        typeCode: pred.typeCode,
        label: pred.typeLabel,
        score: pred.normalizedScore,
        threshold: pred.threshold,
        typeId: pred.typeId
      })) || [];

      return {
        success: true,
        text: ocrResult.text,
        predictions,
        autoAssigned: classificationResult.classification?.autoAssigned,
        assignedTypeCode: classificationResult.classification?.autoAssigned ? predictions[0]?.typeCode : null
      };

    } catch (error) {
      console.error('[DocumentRecognition] Erreur lors de l\'analyse:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      };
    }
  }

  /**
   * Extraction OCR via l'API existante /api/ocr
   */
  private async extractTextWithOCR(file: File): Promise<{
    success: boolean;
    text?: string;
    source?: 'pdf-parse' | 'tesseract' | 'pdf-ocr';
    pagesOcred?: number;
    error?: string;
  }> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const response = await fetch(`${baseUrl}/api/ocr`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!data.ok) {
        return {
          success: false,
          error: data.error || 'Erreur extraction OCR'
        };
      }

      return {
        success: true,
        text: data.text || '',
        source: data.meta?.source || 'pdf-parse',
        pagesOcred: data.meta?.pagesOcred
      };

    } catch (error) {
      console.error('[DocumentRecognition] Erreur OCR:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur OCR'
      };
    }
  }

  /**
   * Analyse d'un document existant (pour les brouillons)
   * Utilise le texte déjà extrait et recalcule les prédictions
   */
  async analyzeExistingDocument(document: {
    id: string;
    fileName: string;
    textContent?: string;
  }): Promise<{
    success: boolean;
    predictions?: Array<{
      typeCode: string;
      label: string;
      score: number;
      threshold: number;
      typeId: string;
    }>;
    error?: string;
  }> {
    try {
      console.log('[DocumentRecognition] Analyse du document existant:', document.id);

      // Si pas de texte, essayer de le récupérer depuis la base
      let text = document.textContent;
      if (!text) {
        const docFromDb = await prisma.document.findUnique({
          where: { id: document.id },
          select: { textContent: true }
        });
        text = docFromDb?.textContent || '';
      }

      if (!text) {
        return {
          success: false,
          error: 'Aucun texte disponible pour l\'analyse'
        };
      }

      // Classification du texte existant
      const classificationResult = await this.classificationService.classify(
        text,
        {
          name: document.fileName,
          size: 0, // Taille inconnue pour les documents existants
          ocrStatus: 'unknown'
        }
      );

      // Formater les prédictions
      const predictions = classificationResult.classification?.top3?.map(pred => ({
        typeCode: pred.typeCode,
        label: pred.typeLabel,
        score: pred.normalizedScore,
        threshold: pred.threshold,
        typeId: pred.typeId
      })) || [];

      console.log('[DocumentRecognition] Prédictions générées:', predictions.length);

      return {
        success: true,
        predictions
      };

    } catch (error) {
      console.error('[DocumentRecognition] Erreur analyse document existant:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur analyse'
      };
    }
  }

  /**
   * Analyse basée sur le nom de fichier uniquement (fallback)
   * Utilisée quand l'OCR n'est pas disponible
   */
  async analyzeByFilename(fileName: string): Promise<{
    success: boolean;
    predictions?: Array<{
      typeCode: string;
      label: string;
      score: number;
      threshold: number;
      typeId: string;
    }>;
    error?: string;
  }> {
    try {
      console.log('[DocumentRecognition] Analyse par nom de fichier:', fileName);

      // Récupérer tous les types de documents actifs
      const documentTypes = await prisma.documentType.findMany({
        where: {
          isActive: true
        },
        select: {
          id: true,
          label: true,
          code: true
        }
      });

      const fileNameLower = fileName.toLowerCase();
      const predictions = [];

      // Logique de scoring basée sur le nom du fichier
      for (const type of documentTypes) {
        let score = 0;
        const label = type.label.toLowerCase();

        // Mots-clés spécifiques
        if (fileNameLower.includes('quittance') && (label.includes('quittance') || label.includes('loyer'))) {
          score = 0.8;
        } else if (fileNameLower.includes('bail') && label.includes('bail')) {
          score = 0.7;
        } else if (fileNameLower.includes('facture') && label.includes('facture')) {
          score = 0.6;
        } else if (fileNameLower.includes('assurance') && label.includes('assurance')) {
          score = 0.6;
        } else if (fileNameLower.includes('taxe') && label.includes('taxe')) {
          score = 0.6;
        } else if (fileNameLower.includes('contrat') && label.includes('contrat')) {
          score = 0.5;
        } else if (fileNameLower.includes('avis') && label.includes('avis')) {
          score = 0.5;
        } else {
          // Score de base pour les autres types
          score = 0.1;
        }

        if (score > 0.1) {
          predictions.push({
            typeCode: type.code,
            label: type.label,
            score: score,
            threshold: 0.85, // Seuil par défaut
            typeId: type.id
          });
        }
      }

      // Trier par score décroissant et limiter à 5
      predictions.sort((a, b) => b.score - a.score);
      const topPredictions = predictions.slice(0, 5);

      console.log('[DocumentRecognition] Prédictions par nom de fichier:', topPredictions.length);

      return {
        success: true,
        predictions: topPredictions
      };

    } catch (error) {
      console.error('[DocumentRecognition] Erreur analyse par nom:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur analyse nom'
      };
    }
  }
}

// Instance singleton
export const documentRecognitionService = new DocumentRecognitionService();
