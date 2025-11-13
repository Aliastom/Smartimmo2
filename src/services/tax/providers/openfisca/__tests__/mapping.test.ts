/**
 * Tests pour le mapping OpenFisca → NormalizedTaxParams
 */

import { describe, it, expect } from '@jest/globals';
import { mapOpenFiscaToPartials } from '../map';

describe('OpenFisca Mapping', () => {
  describe('IR Brackets', () => {
    it('should map IR brackets correctly', () => {
      const mockOfData = {
        parameters: {
          impot_revenu: {
            bareme: {
              '2024': [ // Revenus 2024 pour impôts 2025
                { seuil_min: 0, seuil_max: 11294, taux: 0 },
                { seuil_min: 11294, seuil_max: 28797, taux: 0.11 },
                { seuil_min: 28797, seuil_max: null, taux: 0.30 }
              ]
            }
          }
        }
      };
      
      const partials = mapOpenFiscaToPartials(2025, mockOfData, '1.0.0');
      
      const irPartial = partials.find(p => p.section === 'IR');
      expect(irPartial).toBeDefined();
      expect(irPartial?.data.irBrackets).toHaveLength(3);
      expect(irPartial?.data.irBrackets[0]).toEqual({ lower: 0, upper: 11294, rate: 0 });
      expect(irPartial?.data.irBrackets[1]).toEqual({ lower: 11294, upper: 28797, rate: 0.11 });
      expect(irPartial?.meta.notes).toContain('OpenFisca');
    });
    
    it('should handle missing IR brackets', () => {
      const mockOfData = { parameters: {} };
      
      const partials = mapOpenFiscaToPartials(2025, mockOfData);
      
      const irPartial = partials.find(p => p.section === 'IR');
      expect(irPartial).toBeUndefined();
    });
  });
  
  describe('IR Décote', () => {
    it('should map décote correctly', () => {
      const mockOfData = {
        parameters: {
          impot_revenu: {
            decote: {
              '2024': {
                seuil_celibataire: 1929,
                seuil_couple: 3858,
                facteur: 0.75
              }
            }
          }
        }
      };
      
      const partials = mapOpenFiscaToPartials(2025, mockOfData);
      
      const decotePartial = partials.find(p => p.section === 'IR_DECOTE');
      expect(decotePartial).toBeDefined();
      expect(decotePartial?.data.irDecote).toEqual({
        seuilCelibataire: 1929,
        seuilCouple: 3858,
        facteur: 0.75
      });
    });
  });
  
  describe('PS Rate', () => {
    it('should map PS rate correctly (fraction)', () => {
      const mockOfData = {
        parameters: {
          prelevements_sociaux: {
            patrimoine: {
              2025: {
                taux_global: 0.172
              }
            }
          }
        }
      };
      
      const partials = mapOpenFiscaToPartials(2025, mockOfData);
      
      const psPartial = partials.find(p => p.section === 'PS');
      expect(psPartial).toBeDefined();
      expect(psPartial?.data.psRate).toBe(0.172);
    });
    
    it('should convert PS rate from percentage to fraction', () => {
      const mockOfData = {
        parameters: {
          prelevements_sociaux: {
            patrimoine: {
              2025: {
                taux_global: 17.2 // En pourcentage
              }
            }
          }
        }
      };
      
      const partials = mapOpenFiscaToPartials(2025, mockOfData);
      
      const psPartial = partials.find(p => p.section === 'PS');
      expect(psPartial?.data.psRate).toBe(0.172);
    });
  });
});

