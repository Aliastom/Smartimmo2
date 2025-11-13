import { ocrService, OCRResult } from './OCRService';

export interface TextExtractionResult {
  text: string;
  source: 'pdf-text' | 'tesseract' | 'manual' | 'simulation';
  length: number;
  preview: string;
  success: boolean;
  error?: string;
}

export class TextExtractionService {
  private static instance: TextExtractionService;

  private constructor() {}

  public static getInstance(): TextExtractionService {
    if (!TextExtractionService.instance) {
      TextExtractionService.instance = new TextExtractionService();
    }
    return TextExtractionService.instance;
  }

  /**
   * Extrait le texte d'un fichier avec OCR réel
   */
  public async extractFromFile(file: File): Promise<TextExtractionResult> {
    try {
      const fileName = file.name.toLowerCase();
      
      // Pour les PDFs, essayer d'abord l'extraction native
      if (fileName.endsWith('.pdf')) {
        const nativeResult = await this.extractFromPdfNative(file);
        if (nativeResult.success) {
          return nativeResult;
        }
        // Si l'extraction native échoue, utiliser OCR
        console.log('PDF sans texte natif détecté, utilisation de l\'OCR...');
      }
      
      // Utiliser l'OCR pour tous les types de fichiers
      console.log(`Extraction OCR pour: ${fileName}`);
      const ocrResult: OCRResult = await ocrService.extractText(file);
      
      return {
        text: ocrResult.text,
        source: ocrResult.source,
        length: ocrResult.length,
        preview: ocrResult.preview,
        success: ocrResult.success,
        error: ocrResult.error
      };
      
    } catch (error) {
      console.error('Erreur extraction fichier:', error);
      return {
        text: '',
        source: 'manual',
        length: 0,
        preview: '',
        success: false,
        error: error instanceof Error ? error.message : 'Erreur extraction'
      };
    }
  }

  /**
   * Tente d'extraire le texte natif d'un PDF
   * Version simplifiée qui ne nécessite pas de bibliothèque externe
   */
  private async extractFromPdfNative(file: File): Promise<TextExtractionResult> {
    try {
      // Pour l'instant, on considère que tous les PDFs nécessitent de l'OCR
      // Dans une vraie implémentation, on utiliserait pdf-parse ou une API PDF
      return {
        text: '',
        source: 'pdf-text',
        length: 0,
        preview: '',
        success: false,
        error: 'PDF nécessite OCR - traitement en cours...'
      };
    } catch (error) {
      return {
        text: '',
        source: 'pdf-text',
        length: 0,
        preview: '',
        success: false,
        error: error instanceof Error ? error.message : 'Erreur PDF'
      };
    }
  }

  /**
   * Génère un aperçu du texte (300 caractères)
   */
  private getPreview(text: string): string {
    if (text.length <= 300) return text;
    return text.substring(0, 300) + '...';
  }

  /**
   * Nettoie les ressources OCR
   */
  public async cleanup(): Promise<void> {
    await ocrService.cleanup();
  }
}

export const textExtractionService = TextExtractionService.getInstance();