/**
 * Tests pour les utilitaires (merge, validate, diff, hash)
 */

import { describe, it, expect } from '@jest/globals';
import {
  createHash,
  mergePartials,
  validateParams,
  diffParams
} from '../utils';
import { TaxPartial, NormalizedTaxParams } from '../types';

describe('Utils', () => {
  describe('createHash', () => {
    it('should create consistent SHA256 hash', () => {
      const hash1 = createHash('test content');
      const hash2 = createHash('test content');
      const hash3 = createHash('different content');
      
      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(hash3);
      expect(hash1).toHaveLength(64); // SHA256 = 64 hex chars
    });
  });
  
  describe('mergePartials', () => {
    it('should merge partials with priority', () => {
      const partials: TaxPartial[] = [
        {
          section: 'IR',
          data: {
            irBrackets: [
              { lower: 0, upper: 11294, rate: 0 },
              { lower: 11294, upper: null, rate: 0.11 }
            ]
          },
          meta: {
            source: 'BOFIP',
            url: 'https://bofip.test',
            fetchedAt: new Date('2025-01-01'),
            hash: 'abc123',
            confidence: 'high'
          }
        },
        {
          section: 'PS',
          data: { psRate: 0.172 },
          meta: {
            source: 'DGFIP',
            url: 'https://dgfip.test',
            fetchedAt: new Date('2025-01-01'),
            hash: 'def456',
            confidence: 'medium'
          }
        }
      ];
      
      const result = mergePartials(partials);
      
      expect(result.params.irBrackets).toHaveLength(2);
      expect(result.params.psRate).toBe(0.172);
      expect(result.provenance.IR).toHaveLength(1);
      expect(result.provenance.PS).toHaveLength(1);
    });
    
    it('should prioritize BOFIP over DGFIP', () => {
      const partials: TaxPartial[] = [
        {
          section: 'PS',
          data: { psRate: 0.172 },
          meta: {
            source: 'BOFIP',
            url: 'https://bofip.test',
            fetchedAt: new Date('2025-01-01'),
            hash: 'abc',
            confidence: 'high'
          }
        },
        {
          section: 'PS',
          data: { psRate: 0.170 },
          meta: {
            source: 'DGFIP',
            url: 'https://dgfip.test',
            fetchedAt: new Date('2025-01-01'),
            hash: 'def',
            confidence: 'medium'
          }
        }
      ];
      
      const result = mergePartials(partials);
      
      // BOFIP should win
      expect(result.params.psRate).toBe(0.172);
      expect(result.warnings.length).toBeGreaterThan(0); // Should warn about divergence
    });
  });
  
  describe('validateParams', () => {
    it('should validate correct params', () => {
      const params: NormalizedTaxParams = {
        year: 2025,
        irBrackets: [
          { lower: 0, upper: 11294, rate: 0 },
          { lower: 11294, upper: 28797, rate: 0.11 },
          { lower: 28797, upper: null, rate: 0.30 }
        ],
        psRate: 0.172,
        irDecote: {
          seuilCelibataire: 1929,
          seuilCouple: 3858,
          facteur: 0.75
        }
      };
      
      const result = validateParams(params);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should detect invalid year', () => {
      const params: NormalizedTaxParams = {
        year: 2050, // Too far in future
        irBrackets: []
      };
      
      const result = validateParams(params);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Année invalide'))).toBe(true);
    });
    
    it('should detect non-increasing brackets', () => {
      const params: NormalizedTaxParams = {
        year: 2025,
        irBrackets: [
          { lower: 0, upper: 11294, rate: 0 },
          { lower: 28797, upper: 11294, rate: 0.11 } // Wrong order
        ]
      };
      
      const result = validateParams(params);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('non croissantes'))).toBe(true);
    });
    
    it('should detect out-of-bounds rates', () => {
      const params: NormalizedTaxParams = {
        year: 2025,
        irBrackets: [
          { lower: 0, upper: 11294, rate: 1.5 } // > 1
        ]
      };
      
      const result = validateParams(params);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('hors bornes'))).toBe(true);
    });
  });
  
  describe('diffParams', () => {
    it('should detect no changes', () => {
      const params: NormalizedTaxParams = {
        year: 2025,
        psRate: 0.172
      };
      
      const diffs = diffParams(params, params);
      
      expect(diffs).toHaveLength(0);
    });
    
    it('should detect simple value change', () => {
      const before: NormalizedTaxParams = {
        year: 2025,
        psRate: 0.172
      };
      
      const after: NormalizedTaxParams = {
        year: 2025,
        psRate: 0.174
      };
      
      const diffs = diffParams(before, after);
      
      expect(diffs).toHaveLength(1);
      expect(diffs[0].path).toBe('psRate');
      expect(diffs[0].before).toBe(0.172);
      expect(diffs[0].after).toBe(0.174);
    });
    
    it('should detect array changes', () => {
      const before: NormalizedTaxParams = {
        year: 2025,
        irBrackets: [
          { lower: 0, upper: 11294, rate: 0 }
        ]
      };
      
      const after: NormalizedTaxParams = {
        year: 2025,
        irBrackets: [
          { lower: 0, upper: 11294, rate: 0 },
          { lower: 11294, upper: 28797, rate: 0.11 }
        ]
      };
      
      const diffs = diffParams(before, after);
      
      expect(diffs.length).toBeGreaterThan(0);
      expect(diffs.some(d => d.path.includes('length'))).toBe(true);
    });
    
    it('should detect nested object changes', () => {
      const before: NormalizedTaxParams = {
        year: 2025,
        irDecote: {
          seuilCelibataire: 1929,
          seuilCouple: 3858,
          facteur: 0.75
        }
      };
      
      const after: NormalizedTaxParams = {
        year: 2025,
        irDecote: {
          seuilCelibataire: 2000, // Changed
          seuilCouple: 3858,
          facteur: 0.75
        }
      };
      
      const diffs = diffParams(before, after);
      
      expect(diffs).toHaveLength(1);
      expect(diffs[0].path).toBe('irDecote.seuilCelibataire');
      expect(diffs[0].before).toBe(1929);
      expect(diffs[0].after).toBe(2000);
    });
  });
});

