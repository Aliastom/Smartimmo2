import { describe, it, expect } from 'vitest';
import { computeLmnpSuggestion } from '@/services/lmnp/LmnpSuggestionEngine';
import type { LmnpLearningPatternMatch } from '@/services/lmnp/LmnpLearningService';

describe('LmnpSuggestionEngine', () => {
  it('priorité learning sur document_type quand pattern appris', () => {
    const patterns: LmnpLearningPatternMatch[] = [
      {
        id: 'learn-1',
        documentTypeCode: 'TAXE_HABITATION',
        categoryId: null,
        natureCode: null,
        textTokens: ['taxe', 'habitation'],
        ocrTokens: [],
        lmnpBucket: 'CHARGES_FISCALES',
        lmnpLabel: 'Taxe habitation (profil appris)',
        confidence: 0.88,
        usageCount: 5,
      },
    ];
    const result = computeLmnpSuggestion({
      transactionLabel: 'Taxe habitation',
      linkedDocuments: [
        {
          id: 'd1',
          filename: 'avis.pdf',
          documentTypeCode: 'TAXE_HABITATION',
          documentTypeLabel: "Taxe d'habitation",
        },
      ],
      learningPatterns: patterns,
    });
    expect(result.source).toBe('learning');
    expect(result.suggestedLabel).toContain('appris');
    expect(result.matchedLearningPatternId).toBe('learn-1');
  });

  it('TAXE_HABITATION -> CHARGES_FISCALES', () => {
    const result = computeLmnpSuggestion({
      transactionLabel: 'Taxe habitation 2025',
      linkedDocuments: [
        {
          id: 'd1',
          filename: 'avis_taxe_habitation_2025.pdf',
          documentTypeCode: 'TAXE_HABITATION',
          documentTypeLabel: "Taxe d'habitation",
        },
      ],
    });
    expect(result.suggestedBucket).toBe('CHARGES_FISCALES');
    expect(result.source).toBe('document_type');
  });

  it('FACTURE_CHARGES -> CHARGES_EXPLOITATION', () => {
    const result = computeLmnpSuggestion({
      transactionLabel: 'EDF studio',
      linkedDocuments: [
        {
          id: 'd2',
          filename: 'facture_edf.pdf',
          documentTypeCode: 'FACTURE_CHARGES',
          documentTypeLabel: 'Facture charges',
        },
      ],
    });
    expect(result.suggestedBucket).toBe('CHARGES_EXPLOITATION');
    expect(result.source).toBe('document_type');
  });
});

