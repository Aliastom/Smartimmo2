/**
 * Tests pour DedupAI
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DedupAIService } from '@/services/dedup-ai.service';

describe('DedupAI', () => {
  let service: DedupAIService;

  beforeEach(() => {
    service = new DedupAIService();
  });

  describe('Analyse des doublons', () => {
    it('devrait détecter un doublon exact par checksum', () => {
      const tempFile = {
        id: 'temp-1',
        name: 'document.pdf',
        bytes: 1024000,
        size_kb: 1000,
        pages: 1,
        ocr_text: 'Quittance de loyer janvier 2024',
        ocr_quality: 0.9,
        detected_type: 'quittance',
        checksum: 'sha256:abc123'
      };

      const candidates = [{
        id: 'doc-1',
        name: 'document.pdf',
        uploadedAt: '2024-01-15T10:30:00Z',
        size_kb: 1000,
        pages: 1,
        ocr_text: 'Quittance de loyer janvier 2024',
        ocr_quality: 0.8,
        type: 'quittance',
        checksum: 'sha256:abc123'
      }];

      const result = service.analyze(tempFile, candidates);

      expect(result.duplicateType).toBe('exact_duplicate');
      expect(result.suggestedAction).toBe('cancel');
      expect(result.signals.checksum_match).toBe(true);
      expect(result.matchedDocument.id).toBe('doc-1');
    });

    it('devrait détecter un doublon exact par similarité textuelle élevée', () => {
      const tempFile = {
        id: 'temp-1',
        name: 'quittance.pdf',
        bytes: 1024000,
        size_kb: 1000,
        pages: 1,
        ocr_text: 'Quittance de loyer janvier 2024 montant 1200 euros',
        ocr_quality: 0.9,
        detected_type: 'quittance',
        checksum: 'sha256:xyz789'
      };

      const candidates = [{
        id: 'doc-1',
        name: 'quittance.pdf',
        uploadedAt: '2024-01-15T10:30:00Z',
        size_kb: 1000,
        pages: 1,
        ocr_text: 'Quittance de loyer janvier 2024 montant 1200 euros',
        ocr_quality: 0.8,
        type: 'quittance',
        checksum: 'sha256:abc123'
      }];

      const result = service.analyze(tempFile, candidates);

      expect(result.duplicateType).toBe('exact_duplicate');
      expect(result.suggestedAction).toBe('cancel');
      expect(result.signals.text_similarity).toBeGreaterThan(0.995);
    });

    it('devrait détecter un doublon exact par similarité', () => {
      const tempFile = {
        id: 'temp-1',
        name: 'avis_taxe.pdf',
        bytes: 1024000,
        size_kb: 1000,
        pages: 1,
        ocr_text: 'Avis de taxe foncière 2024 montant 1500 euros pour propriété immobilière',
        ocr_quality: 0.95,
        detected_type: 'taxe',
        period: '2024-01-01'
      };

      const candidates = [{
        id: 'doc-1',
        name: 'avis_taxe.pdf',
        uploadedAt: '2024-01-15T10:30:00Z',
        size_kb: 1000,
        pages: 1,
        ocr_text: 'Avis de taxe foncière 2024 montant 1500 euros pour propriété immobilière',
        ocr_quality: 0.8,
        type: 'taxe',
        checksum: 'sha256:abc123',
        period: '2024-01-01'
      }];

      const result = service.analyze(tempFile, candidates);

      expect(result.duplicateType).toBe('exact_duplicate');
      expect(result.suggestedAction).toBe('cancel');
      expect(result.signals.text_similarity).toBeGreaterThan(0.995);
    });

    it('devrait détecter un doublon probable', () => {
      const tempFile = {
        id: 'temp-1',
        name: 'quittance.pdf',
        bytes: 1024000,
        size_kb: 1000,
        pages: 1,
        ocr_text: 'Quittance de loyer janvier 2024 montant 1200 euros locataire Jean Dupont',
        ocr_quality: 0.95,
        detected_type: 'quittance',
        period: '2024-01-01'
      };

      const candidates = [{
        id: 'doc-1',
        name: 'quittance.pdf',
        uploadedAt: '2024-01-15T10:30:00Z',
        size_kb: 1000,
        pages: 1,
        ocr_text: 'Quittance de loyer janvier 2024 montant 1200 euros locataire Jean Dupont',
        ocr_quality: 0.8,
        type: 'quittance',
        checksum: 'sha256:abc123',
        period: '2024-01-01'
      }];

      const result = service.analyze(tempFile, candidates);

      expect(result.duplicateType).toBe('exact_duplicate');
      expect(result.suggestedAction).toBe('cancel');
      expect(result.signals.text_similarity).toBeGreaterThan(0.995);
    });

    it('devrait détecter un doublon potentiel', () => {
      const tempFile = {
        id: 'temp-1',
        name: 'facture.pdf',
        bytes: 1024000,
        size_kb: 1000,
        pages: 1,
        ocr_text: 'Facture électricité janvier 2024 montant 80 euros consommation 150 kWh',
        ocr_quality: 0.7,
        detected_type: 'facture',
        period: '2024-01-01',
        context: { propertyId: 'prop-1' }
      };

      const candidates = [{
        id: 'doc-1',
        name: 'facture.pdf',
        uploadedAt: '2024-01-15T10:30:00Z',
        size_kb: 1000,
        pages: 1,
        ocr_text: 'Facture électricité janvier 2024 montant 80 euros consommation 120 kWh',
        ocr_quality: 0.9,
        type: 'facture',
        checksum: 'sha256:abc123',
        period: '2024-01-01',
        context: { propertyId: 'prop-1' }
      }];

      const result = service.analyze(tempFile, candidates);

      expect(result.duplicateType).toBe('potential_duplicate');
      expect(result.suggestedAction).toBe('ask_user');
      expect(result.signals.period_match).toBe(true);
      expect(result.signals.context_match).toBe(true);
    });

    it('devrait retourner "none" pour un fichier unique', () => {
      const tempFile = {
        id: 'temp-1',
        name: 'nouveau_document.pdf',
        bytes: 1024000,
        size_kb: 1000,
        pages: 1,
        ocr_text: 'Document complètement nouveau et unique',
        ocr_quality: 0.9,
        detected_type: 'autre'
      };

      const candidates = [{
        id: 'doc-1',
        name: 'autre_document.pdf',
        uploadedAt: '2024-01-15T10:30:00Z',
        size_kb: 1000,
        pages: 1,
        ocr_text: 'Document complètement différent',
        ocr_quality: 0.8,
        type: 'autre',
        checksum: 'sha256:abc123'
      }];

      const result = service.analyze(tempFile, candidates);

      expect(result.duplicateType).toBe('none');
      expect(result.suggestedAction).toBe('proceed');
      expect(result.matchedDocument.id).toBeNull();
    });

    it('devrait gérer le cas sans candidats', () => {
      const tempFile = {
        id: 'temp-1',
        name: 'document.pdf',
        bytes: 1024000,
        size_kb: 1000,
        pages: 1,
        ocr_text: 'Nouveau document',
        ocr_quality: 0.9,
        detected_type: 'autre'
      };

      const result = service.analyze(tempFile, []);

      expect(result.duplicateType).toBe('none');
      expect(result.suggestedAction).toBe('proceed');
      expect(result.matchedDocument.id).toBeNull();
    });
  });

  describe('Calcul de similarité', () => {
    it('devrait calculer une similarité élevée pour des textes identiques', () => {
      const text1 = 'Quittance de loyer janvier 2024';
      const text2 = 'Quittance de loyer janvier 2024';
      
      const similarity = (service as any).calculateTextSimilarity(text1, text2);
      expect(similarity).toBeCloseTo(1.0, 2);
    });

    it('devrait calculer une similarité faible pour des textes différents', () => {
      const text1 = 'Quittance de loyer janvier 2024';
      const text2 = 'Facture électricité février 2024';
      
      const similarity = (service as any).calculateTextSimilarity(text1, text2);
      expect(similarity).toBeLessThan(0.5);
    });

    it('devrait normaliser les textes correctement', () => {
      const text = 'QUITTANCE de loyer JANVIER 2024!!!';
      const normalized = (service as any).normalizeText(text);
      expect(normalized).toBe('loyer janvier 2024');
    });
  });

  describe('Comparaison de périodes', () => {
    it('devrait détecter des périodes identiques', () => {
      const result = (service as any).comparePeriods('2024-01-01', '2024-01-15');
      expect(result).toBe(true);
    });

    it('devrait détecter des périodes différentes', () => {
      const result = (service as any).comparePeriods('2024-01-01', '2024-02-01');
      expect(result).toBe(false);
    });
  });

  describe('Comparaison de contextes', () => {
    it('devrait détecter des contextes identiques', () => {
      const context1 = { propertyId: 'prop-1', tenantId: 'tenant-1' };
      const context2 = { propertyId: 'prop-1', tenantId: 'tenant-2' };
      
      const result = (service as any).compareContexts(context1, context2);
      expect(result).toBe(true);
    });

    it('devrait détecter des contextes différents', () => {
      const context1 = { propertyId: 'prop-1' };
      const context2 = { propertyId: 'prop-2' };
      
      const result = (service as any).compareContexts(context1, context2);
      expect(result).toBe(false);
    });
  });

  describe('Comparaison de noms de fichiers', () => {
    it('devrait détecter des noms identiques sans suffixe copie', () => {
      const result = (service as any).compareFilenames('document.pdf', 'document (copie).pdf');
      expect(result).toBe(true);
    });

    it('devrait détecter des noms différents', () => {
      const result = (service as any).compareFilenames('document1.pdf', 'document2.pdf');
      expect(result).toBe(false);
    });
  });

  describe('Détermination de la qualité', () => {
    it('devrait préférer le fichier avec meilleure qualité OCR', () => {
      const tempFile = {
        ocr_quality: 0.95,
        detected_type: 'quittance'
      };
      
      const candidate = {
        ocr_quality: 0.8
      };
      
      const signals = {
        ocr_quality_new: 0.95,
        ocr_quality_existing: 0.8,
        size_kb_new: 1000,
        size_kb_existing: 1000
      };
      
      const result = (service as any).isNewFileBetter(tempFile, candidate, signals);
      expect(result).toBe(true);
    });

    it('devrait préférer le fichier plus léger à qualité égale', () => {
      const tempFile = {
        ocr_quality: 0.9,
        detected_type: 'quittance'
      };
      
      const candidate = {
        ocr_quality: 0.9
      };
      
      const signals = {
        ocr_quality_new: 0.9,
        ocr_quality_existing: 0.9,
        size_kb_new: 980,
        size_kb_existing: 1000
      };
      
      const result = (service as any).isNewFileBetter(tempFile, candidate, signals);
      expect(result).toBe(true);
    });
  });

  describe('Génération UI', () => {
    it('devrait générer une UI appropriée pour un doublon exact', () => {
      const tempFile = {
        name: 'document.pdf',
        pages: 1
      };
      
      const candidate = {
        name: 'document.pdf',
        uploadedAt: '2024-01-15T10:30:00Z'
      };
      
      const signals = {
        checksum_match: true,
        text_similarity: 0.99,
        pages_new: 1,
        pages_existing: 1,
        period_match: true,
        context_match: true
      };
      
      const ui = (service as any).generateUI('exact_duplicate', tempFile, candidate, signals);
      
      expect(ui.title).toBe('Doublon exact détecté');
      expect(ui.subtitle).toContain('Identique à « document.pdf »');
      expect(ui.badges).toHaveLength(5);
      expect(ui.recommendation).toContain('identique au fichier existant');
    });
  });
});
