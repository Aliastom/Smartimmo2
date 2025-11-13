/**
 * Tests pour le système de confiance
 */

import { describe, it, expect } from '@jest/globals';
import { calculateConfidence, isConfidenceAcceptable } from '../confidence';
import { TaxPartial } from '../../../sources/types';

describe('Système de confiance', () => {
  describe('calculateConfidence', () => {
    it('should give max confidence (1.0) for OpenFisca + concordant web source', () => {
      const partials: TaxPartial[] = [
        {
          section: 'IR',
          data: { irBrackets: [{ lower: 0, upper: 11294, rate: 0 }] },
          meta: {
            source: 'BOFIP',
            url: 'OpenFisca v1.0',
            fetchedAt: new Date(),
            hash: 'abc',
            confidence: 'high',
            notes: 'Extrait OpenFisca-France'
          }
        },
        {
          section: 'IR',
          data: { irBrackets: [{ lower: 0, upper: 11294, rate: 0 }] }, // Concordant
          meta: {
            source: 'BOFIP',
            url: 'https://bofip.test',
            fetchedAt: new Date(),
            hash: 'def',
            confidence: 'high'
          }
        }
      ];
      
      const conf = calculateConfidence('IR', partials);
      
      expect(conf).toBeGreaterThanOrEqual(0.8); // Haute confiance
    });
    
    it('should give 0.6 for OpenFisca alone', () => {
      const partials: TaxPartial[] = [
        {
          section: 'PS',
          data: { psRate: 0.172 },
          meta: {
            source: 'BOFIP',
            url: 'OpenFisca v1.0',
            fetchedAt: new Date(),
            hash: 'abc',
            confidence: 'high',
            notes: 'Extrait OpenFisca-France'
          }
        }
      ];
      
      const conf = calculateConfidence('PS', partials);
      
      expect(conf).toBe(0.6);
    });
    
    it('should give 0 for no sources', () => {
      const conf = calculateConfidence('IR', []);
      expect(conf).toBe(0);
    });
  });
  
  describe('isConfidenceAcceptable', () => {
    it('should require 0.8 for critical sections (IR, PS)', () => {
      expect(isConfidenceAcceptable('IR', 0.8)).toBe(true);
      expect(isConfidenceAcceptable('IR', 0.6)).toBe(false);
      
      expect(isConfidenceAcceptable('PS', 0.8)).toBe(true);
      expect(isConfidenceAcceptable('PS', 0.6)).toBe(false);
    });
    
    it('should require 0.6 for non-critical sections', () => {
      expect(isConfidenceAcceptable('MICRO', 0.6)).toBe(true);
      expect(isConfidenceAcceptable('MICRO', 0.4)).toBe(false);
      
      expect(isConfidenceAcceptable('PER', 0.6)).toBe(true);
      expect(isConfidenceAcceptable('PER', 0.4)).toBe(false);
    });
  });
});

