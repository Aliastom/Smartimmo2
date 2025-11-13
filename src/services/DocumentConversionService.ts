import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink, readFile } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const execAsync = promisify(exec);

export interface ConversionResult {
  success: boolean;
  pdfBuffer?: Buffer;
  originalMime?: string;
  convertedFrom?: string;
  error?: string;
  conversionTimeMs?: number;
}

export class DocumentConversionService {
  private static instance: DocumentConversionService;
  private readonly tempDir = path.join(process.cwd(), 'temp', 'conversions');
  
  // Formats supportés pour conversion
  private readonly supportedFormats = {
    // Documents Word
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/msword': 'doc', 
    'application/vnd.oasis.opendocument.text': 'odt',
    
    // Feuilles de calcul
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.oasis.opendocument.spreadsheet': 'ods',
    
    // Présentations
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.oasis.opendocument.presentation': 'odp',
    
    // Texte
    'text/plain': 'txt',
    'application/rtf': 'rtf'
  };

  private constructor() {
    // Créer le répertoire temp si nécessaire
    this.ensureTempDir();
  }

  public static getInstance(): DocumentConversionService {
    if (!DocumentConversionService.instance) {
      DocumentConversionService.instance = new DocumentConversionService();
    }
    return DocumentConversionService.instance;
  }

  private async ensureTempDir(): Promise<void> {
    try {
      const fs = await import('fs');
      await fs.promises.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.error('[Conversion] Erreur création répertoire temp:', error);
    }
  }

  /**
   * Vérifie si un fichier nécessite une conversion
   */
  public needsConversion(mimeType: string): boolean {
    return mimeType in this.supportedFormats;
  }

  /**
   * Retourne la liste des formats supportés
   */
  public getSupportedFormats(): { mimeType: string; extension: string }[] {
    return Object.entries(this.supportedFormats).map(([mimeType, extension]) => ({
      mimeType,
      extension
    }));
  }

  /**
   * Convertit un fichier en PDF
   */
  public async convertToPDF(
    buffer: Buffer, 
    originalMime: string, 
    originalName?: string
  ): Promise<ConversionResult> {
    const startTime = Date.now();
    
    if (!this.needsConversion(originalMime)) {
      return {
        success: false,
        error: `Format ${originalMime} non supporté pour la conversion`
      };
    }

    const extension = this.supportedFormats[originalMime];
    const fileId = crypto.randomUUID();
    const inputPath = path.join(this.tempDir, `input_${fileId}.${extension}`);
    const outputPath = path.join(this.tempDir, `output_${fileId}.pdf`);

    try {
      console.log(`[Conversion] Début conversion ${originalMime} → PDF`);
      
      // Écrire le fichier d'entrée
      await writeFile(inputPath, buffer);
      
      // Conversion avec LibreOffice headless
      const command = [
        'libreoffice',
        '--headless',
        '--convert-to pdf',
        `--outdir "${this.tempDir}"`,
        `"${inputPath}"`
      ].join(' ');

      console.log(`[Conversion] Commande: ${command}`);
      
      const { stdout, stderr } = await execAsync(command, { 
        timeout: 30000, // 30 secondes max
        cwd: this.tempDir
      });

      if (stderr && !stderr.includes('Conversion') && !stderr.includes('Warning')) {
        throw new Error(`LibreOffice error: ${stderr}`);
      }

      // Lire le PDF généré
      const expectedOutputPath = path.join(this.tempDir, `input_${fileId}.pdf`);
      let pdfBuffer: Buffer;
      
      try {
        pdfBuffer = await readFile(expectedOutputPath);
      } catch (readError) {
        // Essayer avec le nom original
        pdfBuffer = await readFile(outputPath);
      }

      const conversionTimeMs = Date.now() - startTime;
      
      console.log(`[Conversion] Succès en ${conversionTimeMs}ms - PDF: ${pdfBuffer.length} bytes`);

      // Nettoyer les fichiers temporaires
      await this.cleanup([inputPath, expectedOutputPath, outputPath]);

      return {
        success: true,
        pdfBuffer,
        originalMime,
        convertedFrom: extension,
        conversionTimeMs
      };

    } catch (error: any) {
      console.error(`[Conversion] Erreur:`, error);
      
      // Nettoyer en cas d'erreur
      await this.cleanup([inputPath, outputPath]);
      
      return {
        success: false,
        error: error.message || 'Erreur de conversion inconnue',
        conversionTimeMs: Date.now() - startTime
      };
    }
  }

  /**
   * Nettoie les fichiers temporaires
   */
  private async cleanup(filePaths: string[]): Promise<void> {
    for (const filePath of filePaths) {
      try {
        await unlink(filePath);
      } catch (error) {
        // Ignorer les erreurs de suppression (fichier pas trouvé, etc.)
        console.debug(`[Conversion] Fichier ${filePath} non supprimé:`, error);
      }
    }
  }

  /**
   * Vérifie que LibreOffice est disponible
   */
  public async checkLibreOfficeAvailability(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('libreoffice --version', { timeout: 5000 });
      console.log('[Conversion] LibreOffice disponible:', stdout.trim());
      return true;
    } catch (error) {
      console.error('[Conversion] LibreOffice non disponible:', error);
      return false;
    }
  }
}

// Export de l'instance singleton
export const documentConversionService = DocumentConversionService.getInstance();
