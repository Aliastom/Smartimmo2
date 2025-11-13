import * as fs from 'fs';
import * as mammoth from 'mammoth';

/**
 * Service d'extraction de texte depuis des fichiers DOCX/DOC
 * Utilise mammoth pour extraire le texte brut sans OCR
 * 
 * IMPORTANT: Compatible avec l'API existante /api/ocr
 * - Même signature que les autres extracteurs
 * - Retourne du texte brut pour le pipeline existant
 * - Aucune amélioration/post-traitement spécifique
 */
export class DocxTextExtractor {
  
  /**
   * Extrait le texte brut d'un fichier DOCX/DOC depuis un chemin de fichier
   * @param filePath - Chemin vers le fichier DOCX/DOC
   * @returns Texte brut extrait
   */
  public static async extractTextFromFile(filePath: string): Promise<string> {
    const exists = fs.existsSync(filePath);
    if (!exists) {
      throw new Error(`File not found: ${filePath}`);
    }

    try {
      console.log(`[DocxExtractor] Extraction texte depuis ${filePath}`);
      
      // Extraction texte brut avec mammoth
      const { value } = await mammoth.extractRawText({ path: filePath });
      
      // IMPORTANT : pas d'amélioration/normalisation spécifique ici
      // Le texte passe par le même pipeline que PDF (normalizeText dans /api/ocr)
      const rawText = value ?? '';
      
      console.log(`[DocxExtractor] Extracted ${rawText.length} characters from DOCX`);
      
      return rawText;
      
    } catch (error) {
      console.error('[DocxExtractor] Erreur extraction DOCX:', error);
      throw new Error(`Failed to extract text from DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extrait le texte brut d'un fichier DOCX/DOC depuis un Buffer
   * @param buffer - Buffer du fichier DOCX/DOC  
   * @returns Texte brut extrait
   */
  public static async extractTextFromBuffer(buffer: Buffer): Promise<string> {
    try {
      console.log(`[DocxExtractor] Extraction texte depuis buffer (${buffer.length} bytes)`);
      
      // Extraction texte brut avec mammoth depuis buffer
      const { value } = await mammoth.extractRawText({ buffer });
      
      // IMPORTANT : pas d'amélioration/normalisation spécifique ici
      const rawText = value ?? '';
      
      console.log(`[DocxExtractor] Extracted ${rawText.length} characters from DOCX buffer`);
      
      return rawText;
      
    } catch (error) {
      console.error('[DocxExtractor] Erreur extraction DOCX depuis buffer:', error);
      throw new Error(`Failed to extract text from DOCX buffer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Vérifie si un type MIME correspond à un document Word supporté
   * @param mimeType - Type MIME à vérifier
   * @returns true si supporté pour extraction directe
   */
  public static isSupportedMimeType(mimeType: string): boolean {
    const supportedTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/msword', // .doc
    ];
    
    return supportedTypes.includes(mimeType.toLowerCase());
  }

  /**
   * Vérifie si une extension de fichier correspond à un document Word supporté
   * @param filename - Nom de fichier à vérifier
   * @returns true si supporté pour extraction directe
   */
  public static isSupportedFilename(filename: string): boolean {
    const lowerName = filename.toLowerCase();
    return lowerName.endsWith('.docx') || lowerName.endsWith('.doc');
  }
}
