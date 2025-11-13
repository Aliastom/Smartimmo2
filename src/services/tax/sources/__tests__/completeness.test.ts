/**
 * Tests pour la complétude et la fusion sécurisée
 */

import { describe, it, expect } from '@jest/globals';
import {
  validateSection,
  mergeSafely
} from '../utils';
import { TaxSection, CompletenessReport, NormalizedTaxParams } from '../types';

describe('Validation par section', () => {
  describe('validateSection - IR', () => {
    it('should validate valid IR brackets', () => {
      const brackets = [
        { lower: 0, upper: 11294, rate: 0 },
        { lower: 11294, upper: 28797, rate: 0.11 },
        { lower: 28797, upper: null, rate: 0.30 }
      ];
      
      expect(validateSection('IR', brackets)).toBe('ok');
    });
    
    it('should reject IR with < 3 brackets', () => {
      const brackets = [
        { lower: 0, upper: 11294, rate: 0 }
      ];
      
      expect(validateSection('IR', brackets)).toBe('invalid');
    });
    
    it('should reject IR with missing fields', () => {
      const brackets = [
        { lower: 0, rate: 0 }, // Missing upper
        { lower: 11294, upper: 28797, rate: 0.11 },
        { lower: 28797, upper: null, rate: 0.30 }
      ];
      
      expect(validateSection('IR', brackets)).toBe('invalid');
    });
  });
  
  describe('validateSection - PS', () => {
    it('should validate valid PS rate', () => {
      expect(validateSection('PS', 0.172)).toBe('ok');
    });
    
    it('should reject PS out of bounds', () => {
      expect(validateSection('PS', 1.5)).toBe('invalid');
      expect(validateSection('PS', 0)).toBe('invalid');
      expect(validateSection('PS', -0.1)).toBe('invalid');
    });
    
    it('should reject non-number PS', () => {
      expect(validateSection('PS', '0.172')).toBe('invalid');
      expect(validateSection('PS', null)).toBe('invalid');
    });
  });
  
  describe('validateSection - MICRO', () => {
    it('should validate valid MICRO', () => {
      const micro = {
        foncier: {
          plafond: 15000,
          abattement: 0.30
        }
      };
      
      expect(validateSection('MICRO', micro)).toBe('ok');
    });
    
    it('should reject MICRO without foncier.abattement', () => {
      const micro = {
        foncier: {
          plafond: 15000
        }
      };
      
      expect(validateSection('MICRO', micro)).toBe('invalid');
    });
  });
});

describe('Fusion sécurisée (mergeSafely)', () => {
  it('should merge only OK sections', () => {
    const active: NormalizedTaxParams = {
      year: 2025,
      irBrackets: [
        { lower: 0, upper: 11294, rate: 0 },
        { lower: 11294, upper: null, rate: 0.11 }
      ],
      psRate: 0.172,
      micro: {
        foncier: { plafond: 15000, abattement: 0.30 },
        bic: {
          vente: { plafond: 188700, abattement: 0.71 },
          services: { plafond: 77700, abattement: 0.50 }
        }
      }
    };
    
    const incoming: NormalizedTaxParams = {
      year: 2025,
      psRate: 0.174, // Nouvelle valeur
      per: {
        plafondBase: 4500,
        plafondMaxPASSMultiple: 8
      }
    };
    
    const completeness: CompletenessReport = {
      IR: { status: 'missing' },
      IR_DECOTE: { status: 'missing' },
      PS: { status: 'ok', source: 'BOFIP', url: 'test' },
      MICRO: { status: 'missing' },
      DEFICIT: { status: 'missing' },
      PER: { status: 'ok', source: 'SERVICE_PUBLIC', url: 'test' },
      SCI_IS: { status: 'missing' }
    };
    
    const merged = mergeSafely(active, incoming, completeness);
    
    // Vérifications
    expect(merged.irBrackets).toEqual(active.irBrackets); // Conservé (missing)
    expect(merged.psRate).toBe(0.174); // Mis à jour (ok)
    expect(merged.micro).toEqual(active.micro); // Conservé (missing)
    expect(merged.per).toEqual(incoming.per); // Mis à jour (ok)
  });
  
  it('should not merge invalid sections', () => {
    const active: NormalizedTaxParams = {
      year: 2025,
      psRate: 0.172
    };
    
    const incoming: NormalizedTaxParams = {
      year: 2025,
      psRate: 0.174
    };
    
    const completeness: CompletenessReport = {
      IR: { status: 'missing' },
      IR_DECOTE: { status: 'missing' },
      PS: { status: 'invalid', reason: 'Validation échouée' },
      MICRO: { status: 'missing' },
      DEFICIT: { status: 'missing' },
      PER: { status: 'missing' },
      SCI_IS: { status: 'missing' }
    };
    
    const merged = mergeSafely(active, incoming, completeness);
    
    // PS ne doit PAS être mise à jour car invalide
    expect(merged.psRate).toBe(0.172);
  });
  
  it('should preserve all values when no sections are OK', () => {
    const active: NormalizedTaxParams = {
      year: 2025,
      irBrackets: [{ lower: 0, upper: 11294, rate: 0 }],
      psRate: 0.172
    };
    
    const incoming: NormalizedTaxParams = {
      year: 2025,
      irBrackets: [{ lower: 0, upper: 11295, rate: 0 }],
      psRate: 0.174
    };
    
    const completeness: CompletenessReport = {
      IR: { status: 'missing' },
      IR_DECOTE: { status: 'missing' },
      PS: { status: 'missing' },
      MICRO: { status: 'missing' },
      DEFICIT: { status: 'missing' },
      PER: { status: 'missing' },
      SCI_IS: { status: 'missing' }
    };
    
    const merged = mergeSafely(active, incoming, completeness);
    
    // Tout doit être conservé
    expect(merged).toEqual(active);
  });
});

