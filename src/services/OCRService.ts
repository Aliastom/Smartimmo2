export interface OCRResult {
  success: boolean;
  text: string;
  source: 'tesseract' | 'manual';
  length: number;
  preview: string;
  error?: string;
}

export class OCRService {
  private static instance: OCRService;
  private worker: Worker | null = null;
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): OCRService {
    if (!OCRService.instance) {
      OCRService.instance = new OCRService();
    }
    return OCRService.instance;
  }

  /**
   * Initialise le worker OCR
   */
  private async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Créer le worker OCR
      this.worker = new Worker('/workers/ocr-worker.js', { type: 'module' });
      
      // Écouter les messages du worker
      this.worker.onmessage = (event) => {
        console.log('Message reçu du worker OCR:', event.data);
      };
      
      this.worker.onerror = (error) => {
        console.error('Erreur worker OCR:', error);
      };
      
      this.isInitialized = true;
      console.log('Service OCR initialisé');
    } catch (error) {
      console.error('Erreur initialisation OCR:', error);
      throw error;
    }
  }

  /**
   * Extrait le texte d'un fichier avec OCR
   */
  public async extractText(file: File): Promise<OCRResult> {
    try {
      await this.initialize();
      
      if (!this.worker) {
        throw new Error('Worker OCR non initialisé');
      }

      // Convertir le fichier en buffer
      const buffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(buffer);

      // Envoyer la demande d'extraction au worker
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout OCR (30s)'));
        }, 30000);

        const handleMessage = (event: MessageEvent) => {
          if (event.data.type === 'EXTRACT_RESULT') {
            clearTimeout(timeout);
            this.worker?.removeEventListener('message', handleMessage);
            resolve(event.data.data);
          }
        };

        this.worker?.addEventListener('message', handleMessage);
        
        this.worker?.postMessage({
          type: 'EXTRACT_TEXT',
          data: {
            buffer: uint8Array,
            fileName: file.name
          }
        });
      });

    } catch (error) {
      console.error('Erreur extraction OCR:', error);
      return {
        success: false,
        text: '',
        source: 'tesseract',
        length: 0,
        preview: '',
        error: error instanceof Error ? error.message : 'Erreur OCR'
      };
    }
  }

  /**
   * Nettoie le worker
   */
  public async cleanup(): Promise<void> {
    if (this.worker) {
      this.worker.postMessage({ type: 'CLEANUP' });
      this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
      console.log('Service OCR nettoyé');
    }
  }
}

export const ocrService = OCRService.getInstance();

