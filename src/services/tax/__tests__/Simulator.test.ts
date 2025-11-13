/**
 * Tests unitaires pour le Simulator fiscal
 * 
 * Execute: npm run test src/services/tax/__tests__/Simulator.test.ts
 */

import { describe, it, expect } from 'vitest';
import { Simulator } from '../Simulator';
import type { FiscalInputs, TaxParams } from '@/types/fiscal';

// Paramètres fiscaux de test (simplifié)
const mockTaxParams: TaxParams = {
  version: '2025.1',
  year: 2025,
  irBrackets: [
    { lower: 0, upper: 11294, rate: 0.00 },
    { lower: 11294, upper: 28797, rate: 0.11 },
    { lower: 28797, upper: 82341, rate: 0.30 },
    { lower: 82341, upper: 177106, rate: 0.41 },
    { lower: 177106, upper: null, rate: 0.45 },
  ],
  irDecote: {
    threshold: 1929,
    formula: (tax: number, parts: number) => {
      const seuil = parts === 1 ? 1929 : 3858;
      return Math.max(0, seuil - 0.75 * tax);
    },
  },
  psRate: 0.172,
  micro: {
    foncierAbattement: 0.30,
    foncierPlafond: 15000,
    bicAbattement: 0.50,
    bicPlafond: 77700,
  },
  deficitFoncier: {
    plafondImputationRevenuGlobal: 10700,
    dureeReport: 10,
  },
  per: {
    tauxPlafond: 0.10,
    plancherLegal: 4399,
    dureeReportReliquats: 3,
  },
  lmp: {
    recettesMin: 23000,
    tauxRecettesProMin: 0.50,
    inscriptionRCSObligatoire: true,
  },
  sciIS: {
    tauxReduit: 0.15,
    plafondTauxReduit: 42500,
    tauxNormal: 0.25,
  },
  source: 'Test',
  dateMAJ: new Date(),
};

describe('Simulator - Foncier micro', () => {
  it('devrait calculer correctement avec micro-foncier (loyer 12 000€)', async () => {
    const inputs: FiscalInputs = {
      year: 2025,
      foyer: {
        salaire: 30000,
        autresRevenus: 0,
        parts: 2,
        isCouple: true,
      },
      biens: [
        {
          id: 'bien1',
          nom: 'Appartement',
          type: 'NU',
          loyers: 12000,
          charges: 0,
          interets: 0,
          assuranceEmprunt: 0,
          taxeFonciere: 0,
          fraisGestion: 0,
          assurancePNO: 0,
          chargesCopro: 0,
          autresCharges: 0,
          travaux: {
            entretien: 0,
            amelioration: 0,
            dejaRealises: 0,
          },
          regimeSuggere: 'micro',
        },
      ],
      options: {
        autofill: false,
        baseCalcul: 'encaisse',
        optimiserRegimes: false,
      },
    };
    
    const simulation = await Simulator.simulate(inputs, mockTaxParams);
    
    // Vérifier le résultat
    expect(simulation.biens[0].regime).toBe('micro');
    expect(simulation.biens[0].recettesBrutes).toBe(12000);
    
    // Abattement 30% = 3600€
    expect(simulation.biens[0].chargesDeductibles).toBe(3600);
    
    // Résultat fiscal = 12000 - 3600 = 8400€
    expect(simulation.biens[0].resultatFiscal).toBe(8400);
  });
});

describe('Simulator - Foncier réel avec déficit', () => {
  it('devrait calculer un déficit foncier < 10 700€', async () => {
    const inputs: FiscalInputs = {
      year: 2025,
      foyer: {
        salaire: 50000,
        autresRevenus: 0,
        parts: 2,
        isCouple: true,
      },
      biens: [
        {
          id: 'bien1',
          nom: 'Maison',
          type: 'NU',
          loyers: 12000,
          charges: 2000,
          interets: 5000,
          assuranceEmprunt: 500,
          taxeFonciere: 1500,
          fraisGestion: 1000,
          assurancePNO: 300,
          chargesCopro: 0,
          autresCharges: 0,
          travaux: {
            entretien: 10700,  // Créer un déficit
            amelioration: 0,
            dejaRealises: 10700,
          },
          regimeSuggere: 'reel',
          regimeChoisi: 'reel',
        },
      ],
      options: {
        autofill: false,
        baseCalcul: 'encaisse',
        optimiserRegimes: false,
      },
    };
    
    const simulation = await Simulator.simulate(inputs, mockTaxParams);
    
    const bien = simulation.biens[0];
    
    // Total charges = 2000 + 5000 + 500 + 1500 + 1000 + 300 + 10700 = 21000€
    expect(bien.chargesDeductibles).toBe(21000);
    
    // Résultat = 12000 - 21000 = -9000€ (déficit)
    expect(bien.resultatFiscal).toBe(-9000);
    expect(bien.deficit).toBe(9000);
    
    // Déficit hors intérêts = charges - intérêts = 21000 - 5000 - 12000 = 4000€
    // Donc déficit imputable sur revenu global = 4000€ (< 10700€)
    expect(bien.deficitImputableRevenuGlobal).toBeLessThanOrEqual(10700);
  });
  
  it('devrait plafonner le déficit foncier à 10 700€ sur revenu global', async () => {
    const inputs: FiscalInputs = {
      year: 2025,
      foyer: {
        salaire: 50000,
        autresRevenus: 0,
        parts: 2,
        isCouple: true,
      },
      biens: [
        {
          id: 'bien1',
          nom: 'Maison',
          type: 'NU',
          loyers: 10000,
          charges: 5000,
          interets: 3000,
          assuranceEmprunt: 0,
          taxeFonciere: 1500,
          fraisGestion: 1000,
          assurancePNO: 0,
          chargesCopro: 0,
          autresCharges: 0,
          travaux: {
            entretien: 15000,  // Créer un gros déficit
            amelioration: 0,
            dejaRealises: 15000,
          },
          regimeSuggere: 'reel',
          regimeChoisi: 'reel',
        },
      ],
      options: {
        autofill: false,
        baseCalcul: 'encaisse',
        optimiserRegimes: false,
      },
    };
    
    const simulation = await Simulator.simulate(inputs, mockTaxParams);
    
    const bien = simulation.biens[0];
    
    // Déficit important
    expect(bien.deficit).toBeGreaterThan(10700);
    
    // Déficit imputable plafonné à 10 700€
    expect(bien.deficitImputableRevenuGlobal).toBeLessThanOrEqual(10700);
    
    // Le reste est reportable
    expect(bien.deficitReportable).toBeGreaterThan(0);
  });
});

describe('Simulator - LMNP réel avec amortissements', () => {
  it('devrait déduire les amortissements en LMNP réel', async () => {
    const inputs: FiscalInputs = {
      year: 2025,
      foyer: {
        salaire: 40000,
        autresRevenus: 0,
        parts: 2,
        isCouple: true,
      },
      biens: [
        {
          id: 'bien1',
          nom: 'Studio meublé',
          type: 'LMNP',
          loyers: 15000,
          charges: 2000,
          interets: 2000,
          assuranceEmprunt: 300,
          taxeFonciere: 800,
          fraisGestion: 1000,
          assurancePNO: 200,
          chargesCopro: 500,
          autresCharges: 0,
          travaux: {
            entretien: 1000,
            amelioration: 0,
            dejaRealises: 1000,
          },
          amortissements: {
            batiment: 3000,
            mobilier: 500,
            fraisAcquisition: 200,
          },
          regimeSuggere: 'reel',
          regimeChoisi: 'reel',
        },
      ],
      options: {
        autofill: false,
        baseCalcul: 'encaisse',
        optimiserRegimes: false,
      },
    };
    
    const simulation = await Simulator.simulate(inputs, mockTaxParams);
    
    const bien = simulation.biens[0];
    
    // Vérifier les amortissements
    const amortTotal = 3000 + 500 + 200;
    expect(bien.amortissements).toBe(amortTotal);
    
    // Résultat = recettes - charges - amortissements
    expect(bien.resultatFiscal).toBeLessThan(bien.recettesBrutes);
  });
});

describe('Simulator - Calcul IR avec tranches', () => {
  it('devrait calculer l\'IR correctement avec tranches', async () => {
    const inputs: FiscalInputs = {
      year: 2025,
      foyer: {
        salaire: 60000,
        autresRevenus: 0,
        parts: 2,
        isCouple: true,
      },
      biens: [],
      options: {
        autofill: false,
        baseCalcul: 'encaisse',
        optimiserRegimes: false,
      },
    };
    
    const simulation = await Simulator.simulate(inputs, mockTaxParams);
    
    // Revenu par part = 60000 / 2 = 30000€
    expect(simulation.ir.revenuParPart).toBe(30000);
    
    // Devrait être dans la tranche 11% et 30%
    expect(simulation.ir.trancheMarginate).toBe(0.30);
    
    // L'impôt doit être > 0
    expect(simulation.ir.impotNet).toBeGreaterThan(0);
  });
});

describe('Simulator - Prélèvements sociaux', () => {
  it('devrait calculer les PS à 17.2% sur revenus immobiliers', async () => {
    const inputs: FiscalInputs = {
      year: 2025,
      foyer: {
        salaire: 30000,
        autresRevenus: 0,
        parts: 1,
        isCouple: false,
      },
      biens: [
        {
          id: 'bien1',
          nom: 'Appartement',
          type: 'NU',
          loyers: 10000,
          charges: 2000,
          interets: 0,
          assuranceEmprunt: 0,
          taxeFonciere: 0,
          fraisGestion: 0,
          assurancePNO: 0,
          chargesCopro: 0,
          autresCharges: 0,
          travaux: {
            entretien: 0,
            amelioration: 0,
            dejaRealises: 0,
          },
          regimeSuggere: 'reel',
          regimeChoisi: 'reel',
        },
      ],
      options: {
        autofill: false,
        baseCalcul: 'encaisse',
        optimiserRegimes: false,
      },
    };
    
    const simulation = await Simulator.simulate(inputs, mockTaxParams);
    
    // Base PS = revenus fonciers nets = 10000 - 2000 = 8000€
    expect(simulation.ps.baseImposable).toBe(8000);
    
    // PS = 8000 * 17.2% = 1376€
    expect(simulation.ps.montant).toBe(8000 * 0.172);
    expect(simulation.ps.taux).toBe(0.172);
  });
});

describe('Simulator - PER', () => {
  it('devrait calculer l\'économie IR du PER', async () => {
    const inputs: FiscalInputs = {
      year: 2025,
      foyer: {
        salaire: 50000,
        autresRevenus: 0,
        parts: 2,
        isCouple: true,
      },
      biens: [],
      per: {
        versementPrevu: 5000,
        plafondDisponible: 5000,
        reliquats: {},
      },
      options: {
        autofill: false,
        baseCalcul: 'encaisse',
        optimiserRegimes: false,
      },
    };
    
    const simulation = await Simulator.simulate(inputs, mockTaxParams);
    
    expect(simulation.per).toBeDefined();
    expect(simulation.per!.versement).toBe(5000);
    
    // Économie IR = versement × TMI
    expect(simulation.per!.economieIR).toBeGreaterThan(0);
    
    // Pas d'économie PS
    expect(simulation.per!.economiePS).toBe(0);
  });
});

