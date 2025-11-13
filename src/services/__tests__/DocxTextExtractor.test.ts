/**
 * Tests unitaires pour DocxTextExtractor
 * Tests basiques pour vérifier le bon fonctionnement de l'extraction DOCX
 */

import { DocxTextExtractor } from '../DocxTextExtractor';

describe('DocxTextExtractor', () => {
  
  describe('isSupportedMimeType', () => {
    it('should support DOCX mime type', () => {
      expect(DocxTextExtractor.isSupportedMimeType('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe(true);
    });

    it('should support DOC mime type', () => {
      expect(DocxTextExtractor.isSupportedMimeType('application/msword')).toBe(true);
    });

    it('should not support PDF mime type', () => {
      expect(DocxTextExtractor.isSupportedMimeType('application/pdf')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(DocxTextExtractor.isSupportedMimeType('APPLICATION/VND.OPENXMLFORMATS-OFFICEDOCUMENT.WORDPROCESSINGML.DOCUMENT')).toBe(true);
    });
  });

  describe('isSupportedFilename', () => {
    it('should support .docx extension', () => {
      expect(DocxTextExtractor.isSupportedFilename('document.docx')).toBe(true);
    });

    it('should support .doc extension', () => {
      expect(DocxTextExtractor.isSupportedFilename('document.doc')).toBe(true);
    });

    it('should not support .pdf extension', () => {
      expect(DocxTextExtractor.isSupportedFilename('document.pdf')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(DocxTextExtractor.isSupportedFilename('Document.DOCX')).toBe(true);
    });
  });

  describe('extractTextFromFile', () => {
    it('should throw error for non-existent file', async () => {
      await expect(DocxTextExtractor.extractTextFromFile('/non/existent/file.docx'))
        .rejects
        .toThrow('File not found');
    });
  });

  describe('extractTextFromBuffer', () => {
    it('should handle empty buffer gracefully', async () => {
      const emptyBuffer = Buffer.alloc(0);
      
      // L'extraction sur un buffer vide devrait soit retourner une string vide
      // soit lever une erreur, mais pas crasher
      try {
        const result = await DocxTextExtractor.extractTextFromBuffer(emptyBuffer);
        expect(typeof result).toBe('string');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });
  });
});
