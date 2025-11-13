/**
 * Tests unitaires pour l'agent Dedup
 */

import { describe, it, expect } from 'vitest';
import { getDedupAgent } from '@/services/dedup-agent.service';
import { TextSimilarityService } from '@/services/text-similarity.service';
import { DedupInput } from '@/types/dedup';

describe('TextSimilarityService', () => {
  it('devrait retourner 1.0 pour deux textes identiques', () => {
    const text = 'Quittance de loyer pour le mois de juin 2025';
    const similarity = TextSimilarityService.calculateSimilarity(text, text);
    expect(similarity).toBe(1.0);
  });

  it('devrait retourner 0 pour deux textes complètement différents', () => {
    const text1 = 'Quittance de loyer';
    const text2 = 'Facture électricité';
    const similarity = TextSimilarityService.calculateSimilarity(text1, text2);
    expect(similarity).toBeLessThan(0.3);
  });

  it('devrait retourner une similarité élevée pour des textes similaires', () => {
    const text1 =
      'Quittance de loyer pour le mois de juin 2025. Montant: 850 euros. Locataire: M. Dupont';
    const text2 =
      'Quittance de loyer pour le mois de juin 2025. Montant: 850 euros. Locataire: M. Dupont';
    const similarity = TextSimilarityService.calculateSimilarity(text1, text2);
    expect(similarity).toBeGreaterThan(0.9);
  });

  it('devrait gérer les textes vides', () => {
    const similarity = TextSimilarityService.calculateSimilarity('', '');
    expect(similarity).toBe(0);
  });
});

describe('DedupAgentService', () => {
  describe('Doublon exact (checksum identique)', () => {
    it('devrait détecter un doublon exact', async () => {
      const input: DedupInput = {
        newFile: {
          tempId: 'tmp_123',
          name: 'document.pdf',
          mime: 'application/pdf',
          size: 100000,
          pages: 1,
          checksum: 'sha256:identical',
          ocr: { chars: 500, quality: 0.8, text: 'Texte du document...' },
          extracted: { typePredictions: [{ label: 'Facture', score: 0.9 }] },
          context: { propertyId: 'prop_1' },
        },
        candidates: [
          {
            id: 'doc_1',
            name: 'document.pdf',
            uploadedAt: '2025-01-01T10:00:00Z',
            mime: 'application/pdf',
            size: 100000,
            pages: 1,
            checksum: 'sha256:identical',
            ocr: { quality: 0.8, textPreview: 'Texte du document...' },
            extracted: { type: 'Facture' },
            context: { propertyId: 'prop_1' },
            url: '/doc_1',
          },
        ],
      };

      const agent = getDedupAgent();
      const result = await agent.analyze(input);

      expect(result.status).toBe('exact_duplicate');
      expect(result.signals.checksumMatch).toBe(true);
      expect(result.suggestedAction).toBe('cancel');
      expect(result.modal.level).toBe('danger');
      expect(result.modal.title).toContain('exact');
    });
  });

  describe('Quasi-doublon (haute similarité)', () => {
    it('devrait détecter un quasi-doublon par similarité textuelle', async () => {
      const texteSimilaire =
        'Quittance de loyer Juin 2025 Locataire Dupont Montant 850 euros';

      const input: DedupInput = {
        newFile: {
          tempId: 'tmp_456',
          name: 'quittance.pdf',
          mime: 'application/pdf',
          size: 150000,
          pages: 1,
          checksum: 'sha256:new',
          ocr: { chars: 800, quality: 0.85, text: texteSimilaire },
          extracted: { typePredictions: [{ label: 'Quittance', score: 0.8 }] },
          context: { propertyId: 'prop_2' },
        },
        candidates: [
          {
            id: 'doc_2',
            name: 'quittance_old.pdf',
            uploadedAt: '2025-06-01T12:00:00Z',
            mime: 'application/pdf',
            size: 145000,
            pages: 1,
            checksum: 'sha256:old',
            ocr: { quality: 0.82, textPreview: texteSimilaire },
            extracted: { type: 'Quittance' },
            context: { propertyId: 'prop_2' },
            url: '/doc_2',
          },
        ],
      };

      const agent = getDedupAgent();
      const result = await agent.analyze(input);

      expect(result.status).toBe('probable_duplicate');
      expect(result.signals.textSimilarity).toBeGreaterThan(0.9);
      expect(result.modal.level).toBe('warning');
    });

    it('devrait détecter un quasi-doublon par période identique', async () => {
      const input: DedupInput = {
        newFile: {
          tempId: 'tmp_789',
          name: 'bail.pdf',
          mime: 'application/pdf',
          size: 500000,
          pages: 10,
          checksum: 'sha256:new',
          ocr: { chars: 5000, quality: 0.9, text: 'Contrat de bail...' },
          extracted: {
            typePredictions: [{ label: 'Bail', score: 0.95 }],
            period: { from: '2025-01-01', to: '2028-01-01' },
          },
          context: { propertyId: 'prop_3', leaseId: 'lease_1' },
        },
        candidates: [
          {
            id: 'doc_3',
            name: 'bail_v1.pdf',
            uploadedAt: '2024-12-15T14:00:00Z',
            mime: 'application/pdf',
            size: 480000,
            pages: 10,
            checksum: 'sha256:old',
            ocr: { quality: 0.88, textPreview: 'Contrat de bail...' },
            extracted: {
              type: 'Bail',
              period: { from: '2025-01-01', to: '2028-01-01' },
            },
            context: { propertyId: 'prop_3', leaseId: 'lease_1' },
            url: '/doc_3',
          },
        ],
      };

      const agent = getDedupAgent();
      const result = await agent.analyze(input);

      expect(result.status).toBe('probable_duplicate');
      expect(result.signals.samePeriod).toBe(true);
    });
  });

  describe('Pas de doublon', () => {
    it('ne devrait pas détecter de doublon pour des documents différents', async () => {
      const input: DedupInput = {
        newFile: {
          tempId: 'tmp_999',
          name: 'facture_juillet.pdf',
          mime: 'application/pdf',
          size: 200000,
          pages: 2,
          checksum: 'sha256:unique',
          ocr: { chars: 1000, quality: 0.9, text: 'Facture EDF Juillet 2025...' },
          extracted: {
            typePredictions: [{ label: 'Facture', score: 0.85 }],
            period: { from: '2025-07-01', to: '2025-07-31' },
          },
          context: { propertyId: 'prop_4' },
        },
        candidates: [
          {
            id: 'doc_4',
            name: 'facture_juin.pdf',
            uploadedAt: '2025-06-20T10:00:00Z',
            mime: 'application/pdf',
            size: 195000,
            pages: 2,
            checksum: 'sha256:different',
            ocr: { quality: 0.88, textPreview: 'Facture EDF Juin 2025...' },
            extracted: {
              type: 'Facture',
              period: { from: '2025-06-01', to: '2025-06-30' },
            },
            context: { propertyId: 'prop_4' },
            url: '/doc_4',
          },
        ],
      };

      const agent = getDedupAgent();
      const result = await agent.analyze(input);

      expect(result.status).toBe('not_duplicate');
      expect(result.signals.samePeriod).toBe(false);
      expect(result.signals.textSimilarity).toBeLessThan(0.9);
    });

    it('devrait retourner not_duplicate quand aucun candidat', async () => {
      const input: DedupInput = {
        newFile: {
          tempId: 'tmp_111',
          name: 'premier_doc.pdf',
          mime: 'application/pdf',
          size: 100000,
          pages: 1,
          checksum: 'sha256:first',
          ocr: { chars: 500, quality: 0.8, text: 'Premier document...' },
          extracted: { typePredictions: [{ label: 'Autre', score: 0.5 }] },
          context: {},
        },
        candidates: [],
      };

      const agent = getDedupAgent();
      const result = await agent.analyze(input);

      expect(result.status).toBe('not_duplicate');
      expect(result.suggestedAction).toBe('keep_both');
    });
  });

  describe('Comparaison de qualité', () => {
    it('devrait suggérer replace si le nouveau fichier est meilleur', async () => {
      const texteSimilaire = 'Document important avec texte identique';

      const input: DedupInput = {
        newFile: {
          tempId: 'tmp_quality',
          name: 'doc_hd.pdf',
          mime: 'application/pdf',
          size: 500000, // Plus grand
          pages: 5,
          checksum: 'sha256:new',
          ocr: { chars: 2000, quality: 0.95, text: texteSimilaire }, // Meilleure qualité
          extracted: { typePredictions: [{ label: 'Document', score: 0.9 }] },
          context: { propertyId: 'prop_5' },
        },
        candidates: [
          {
            id: 'doc_5',
            name: 'doc_sd.pdf',
            uploadedAt: '2025-01-01T10:00:00Z',
            mime: 'application/pdf',
            size: 200000, // Plus petit
            pages: 5,
            checksum: 'sha256:old',
            ocr: { quality: 0.7, textPreview: texteSimilaire }, // Moins bonne qualité
            extracted: { type: 'Document' },
            context: { propertyId: 'prop_5' },
            url: '/doc_5',
          },
        ],
      };

      const agent = getDedupAgent();
      const result = await agent.analyze(input);

      expect(result.status).toBe('probable_duplicate');
      expect(result.signals.qualityComparison).toBe('new_better');
      expect(result.suggestedAction).toBe('replace');
      expect(result.modal.primaryCta.action).toBe('replace');
    });

    it('devrait suggérer cancel si le fichier existant est meilleur', async () => {
      const texteSimilaire = 'Document avec texte similaire';

      const input: DedupInput = {
        newFile: {
          tempId: 'tmp_quality2',
          name: 'doc_sd.pdf',
          mime: 'application/pdf',
          size: 200000, // Plus petit
          pages: 3,
          checksum: 'sha256:new',
          ocr: { chars: 1000, quality: 0.7, text: texteSimilaire }, // Moins bonne qualité
          extracted: { typePredictions: [{ label: 'Document', score: 0.8 }] },
          context: { propertyId: 'prop_6' },
        },
        candidates: [
          {
            id: 'doc_6',
            name: 'doc_hd.pdf',
            uploadedAt: '2025-01-01T10:00:00Z',
            mime: 'application/pdf',
            size: 500000, // Plus grand
            pages: 3,
            checksum: 'sha256:old',
            ocr: { quality: 0.95, textPreview: texteSimilaire }, // Meilleure qualité
            extracted: { type: 'Document' },
            context: { propertyId: 'prop_6' },
            url: '/doc_6',
          },
        ],
      };

      const agent = getDedupAgent();
      const result = await agent.analyze(input);

      expect(result.status).toBe('probable_duplicate');
      expect(result.signals.qualityComparison).toBe('existing_better');
      expect(result.suggestedAction).toBe('cancel');
      expect(result.modal.primaryCta.action).toBe('cancel');
    });
  });

  describe('Contextes différents', () => {
    it('devrait suggérer keep_both si les contextes sont différents', async () => {
      const texteSimilaire = 'État des lieux standard';

      const input: DedupInput = {
        newFile: {
          tempId: 'tmp_context',
          name: 'edl.pdf',
          mime: 'application/pdf',
          size: 300000,
          pages: 4,
          checksum: 'sha256:new',
          ocr: { chars: 1500, quality: 0.85, text: texteSimilaire },
          extracted: { typePredictions: [{ label: 'État des Lieux', score: 0.9 }] },
          context: { propertyId: 'prop_AAA', leaseId: 'lease_1' },
        },
        candidates: [
          {
            id: 'doc_7',
            name: 'edl.pdf',
            uploadedAt: '2024-12-01T10:00:00Z',
            mime: 'application/pdf',
            size: 305000,
            pages: 4,
            checksum: 'sha256:old',
            ocr: { quality: 0.87, textPreview: texteSimilaire },
            extracted: { type: 'État des Lieux' },
            context: { propertyId: 'prop_BBB', leaseId: 'lease_2' }, // Contexte différent !
            url: '/doc_7',
          },
        ],
      };

      const agent = getDedupAgent();
      const result = await agent.analyze(input);

      expect(result.status).toBe('probable_duplicate');
      expect(result.signals.sameContext).toBe(false);
      expect(result.suggestedAction).toBe('keep_both');
    });
  });
});

