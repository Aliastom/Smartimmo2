import { OcrResult } from '@/types/documents';
import { PDFDocument } from 'pdf-lib';

/**
 * Service OCR pour extraction de texte depuis PDF/images
 * Stub pour développement, à brancher sur Tesseract, Google Vision, AWS Textract, etc.
 */

export interface OcrProvider {
  extractText(buffer: Buffer, mime: string): Promise<OcrResult>;
  extractTextFromPdf(buffer: Buffer): Promise<OcrResult>;
  extractTextFromImage(buffer: Buffer, mime: string): Promise<OcrResult>;
}

/**
 * Provider mock pour développement
 * Extrait le texte simple des PDFs, retourne du texte factice pour les images
 */
class MockOcrProvider implements OcrProvider {
  async extractText(buffer: Buffer, mime: string): Promise<OcrResult> {
    if (mime === 'application/pdf') {
      return await this.extractTextFromPdf(buffer);
    } else if (mime.startsWith('image/')) {
      return await this.extractTextFromImage(buffer, mime);
    }

    throw new Error(`Unsupported MIME type for OCR: ${mime}`);
  }

  async extractTextFromPdf(buffer: Buffer): Promise<OcrResult> {
    try {
      // Utiliser pdf-lib pour extraire le texte des PDFs natifs
      // Note: pdf-lib ne fait pas d'OCR, juste extraction de texte natif
      const pdfDoc = await PDFDocument.load(buffer);
      const pages = pdfDoc.getPages();
      
      const pagesData = [];
      let fullText = '';

      for (let i = 0; i < pages.length; i++) {
        // pdf-lib n'a pas de méthode getText(), on simule
        // En production, utiliser pdf-parse ou pdfjs-dist
        const pageText = `[Page ${i + 1} - Texte extrait simulé pour développement]\n\n`;
        pagesData.push({
          pageNumber: i + 1,
          text: pageText,
          confidence: 1.0,
        });
        fullText += pageText;
      }

      return {
        text: fullText,
        pages: pagesData,
        metadata: {
          pageCount: pages.length,
          provider: 'mock',
        },
      };
    } catch (error) {
      console.error('Error extracting text from PDF:', error);
      return {
        text: '',
        pages: [],
        metadata: {
          error: 'Failed to extract text from PDF',
          provider: 'mock',
        },
      };
    }
  }

  async extractTextFromImage(buffer: Buffer, mime: string): Promise<OcrResult> {
    // Stub: retourner du texte factice
    return {
      text: '[OCR Mock] Texte simulé extrait de l\'image. En production, utiliser Tesseract.js ou un service cloud.',
      pages: [
        {
          pageNumber: 1,
          text: '[OCR Mock] Texte simulé extrait de l\'image.',
          confidence: 0.85,
        },
      ],
      metadata: {
        provider: 'mock',
        mime,
      },
    };
  }
}

/**
 * Provider Tesseract.js (pour OCR local)
 * À implémenter si besoin d'OCR côté serveur
 */
class TesseractOcrProvider implements OcrProvider {
  async extractText(buffer: Buffer, mime: string): Promise<OcrResult> {
    // TODO: Implémenter avec tesseract.js
    // const { createWorker } = require('tesseract.js');
    // const worker = await createWorker('fra');
    // const { data: { text } } = await worker.recognize(buffer);
    // await worker.terminate();
    throw new Error('TesseractOcrProvider not implemented yet');
  }

  async extractTextFromPdf(buffer: Buffer): Promise<OcrResult> {
    throw new Error('TesseractOcrProvider not implemented yet');
  }

  async extractTextFromImage(buffer: Buffer, mime: string): Promise<OcrResult> {
    throw new Error('TesseractOcrProvider not implemented yet');
  }
}

/**
 * Provider Cloud (Google Vision, AWS Textract, Azure Computer Vision)
 * À implémenter selon le service choisi
 */
class CloudOcrProvider implements OcrProvider {
  private apiKey: string;
  private endpoint: string;

  constructor(config: { apiKey: string; endpoint: string }) {
    this.apiKey = config.apiKey;
    this.endpoint = config.endpoint;
  }

  async extractText(buffer: Buffer, mime: string): Promise<OcrResult> {
    // TODO: Implémenter avec le service cloud choisi
    throw new Error('CloudOcrProvider not implemented yet');
  }

  async extractTextFromPdf(buffer: Buffer): Promise<OcrResult> {
    throw new Error('CloudOcrProvider not implemented yet');
  }

  async extractTextFromImage(buffer: Buffer, mime: string): Promise<OcrResult> {
    throw new Error('CloudOcrProvider not implemented yet');
  }
}

/**
 * Service OCR principal
 */
export class OcrService {
  private provider: OcrProvider;

  constructor(provider?: OcrProvider) {
    this.provider = provider || new MockOcrProvider();
  }

  /**
   * Extrait le texte d'un document (PDF ou image)
   */
  async extractText(buffer: Buffer, mime: string): Promise<OcrResult> {
    return await this.provider.extractText(buffer, mime);
  }

  /**
   * Vérifie si un document est "OCRable" (contient déjà du texte ou non)
   */
  async isPdfTextual(buffer: Buffer): Promise<boolean> {
    try {
      const result = await this.provider.extractTextFromPdf(buffer);
      // Si on obtient plus de 100 caractères, c'est probablement textuel
      return result.text.length > 100;
    } catch {
      return false;
    }
  }

  /**
   * Détermine la stratégie OCR (texte natif vs OCR)
   */
  async determineOcrStrategy(
    buffer: Buffer,
    mime: string
  ): Promise<'native' | 'ocr' | 'hybrid'> {
    if (mime === 'application/pdf') {
      const isTextual = await this.isPdfTextual(buffer);
      return isTextual ? 'native' : 'ocr';
    } else if (mime.startsWith('image/')) {
      return 'ocr';
    }

    throw new Error(`Unsupported MIME type: ${mime}`);
  }
}

// Instance singleton
let ocrServiceInstance: OcrService | null = null;

export function getOcrService(): OcrService {
  if (!ocrServiceInstance) {
    const ocrProvider = process.env.OCR_PROVIDER || 'mock';

    if (ocrProvider === 'tesseract') {
      console.warn('Tesseract OCR not implemented, falling back to mock');
      ocrServiceInstance = new OcrService();
    } else if (ocrProvider === 'cloud') {
      console.warn('Cloud OCR not implemented, falling back to mock');
      ocrServiceInstance = new OcrService();
    } else {
      ocrServiceInstance = new OcrService();
    }
  }

  return ocrServiceInstance;
}

export default OcrService;

