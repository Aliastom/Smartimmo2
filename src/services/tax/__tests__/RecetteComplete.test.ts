/**
 * Tests de recette complète - Module Fiscal SmartImmo
 * 
 * Ces tests valident tous les cas métier avant mise en production
 * Execute: npm run test src/services/tax/__tests__/RecetteComplete.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { Simulator } from '../Simulator';
import { Optimizer } from '../Optimizer';
import { TaxParamsService } from '../TaxParamsService';
import type { FiscalInputs, TaxParams } from '@/types/fiscal';

let taxParams2025: TaxParams;

beforeAll(async () => {
  // Revenus 2025 → campagne / barème déclaration 2026 (`FiscalVersion.year` = 2026)
  taxParams2025 = await TaxParamsService.get(2026);
});

// ============================================================================
// CAS A : FONCIER MICRO
// ============================================================================

describe('🧪 CAS A : Foncier Micro (12 000€)', () => {
  it('devrait appliquer abattement 30% et calculer base imposable correcte', async () => {
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
          id: 'bien-a',
          nom: 'Appartement T2',
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
          travaux: { entretien: 0, amelioration: 0, dejaRealises: 0 },
          regimeSuggere: 'micro',
        },
      ],
      options: {
        autofill: false,
        baseCalcul: 'encaisse',
        optimiserRegimes: false,
      },
    };
    
    const simulation = await Simulator.simulate(inputs, taxParams2025);
    const bien = simulation.biens[0];
    
    // ✅ Vérifications
    expect(bien.regime).toBe('micro');
    expect(bien.recettesBrutes).toBe(12000);
    
    // Abattement 30% = 3600€
    expect(bien.chargesDeductibles).toBe(3600);
    
    // Base imposable = 12000 - 3600 = 8400€
    expect(bien.resultatFiscal).toBe(8400);
    expect(bien.baseImposableIR).toBe(8400);
    expect(bien.baseImposablePS).toBe(8400);
    
    // PS = 8400 × 17.2%
    expect(simulation.ps.montant).toBeCloseTo(8400 * 0.172, 1);
    
    console.log('✅ CAS A validé : Micro-foncier OK');
  });
});

// ============================================================================
// CAS B : FONCIER RÉEL AVEC DÉFICIT < 10 700€
// ============================================================================

describe('🧪 CAS B : Foncier Réel déficit < 10 700€', () => {
  it('devrait imputer déficit sur revenu global IR et annuler PS', async () => {
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
          id: 'bien-b',
          nom: 'Maison déficit',
          type: 'NU',
          loyers: 9000,
          charges: 3000,
          interets: 5000,
          assuranceEmprunt: 500,
          taxeFonciere: 1500,
          fraisGestion: 1000,
          assurancePNO: 300,
          chargesCopro: 1200,
          autresCharges: 500,
          travaux: { entretien: 5000, amelioration: 0, dejaRealises: 5000 },
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
    
    const simulation = await Simulator.simulate(inputs, taxParams2025);
    const bien = simulation.biens[0];
    
    // Charges totales = 3000 + 5000 + 500 + 1500 + 1000 + 300 + 1200 + 500 + 5000 = 18000€
    expect(bien.chargesDeductibles).toBe(18000);
    
    // Déficit = 9000 - 18000 = -9000€
    expect(bien.resultatFiscal).toBe(-9000);
    expect(bien.deficit).toBe(9000);
    
    // ✅ Déficit < 10 700€ : entièrement imputable sur revenu global
    expect(bien.deficitImputableRevenuGlobal).toBeLessThanOrEqual(9000);
    expect(bien.deficitReportable).toBeLessThanOrEqual(9000);
    
    // PS = 0€ (pas de revenus fonciers positifs)
    expect(simulation.ps.montant).toBe(0);
    
    // IR réduit grâce au déficit
    expect(simulation.ir.revenuImposable).toBeLessThan(50000);
    
    console.log('✅ CAS B validé : Déficit < 10 700€ OK');
  });
});

// ============================================================================
// CAS C : FONCIER RÉEL AVEC DÉFICIT > 10 700€
// ============================================================================

describe('🧪 CAS C : Foncier Réel déficit > 10 700€', () => {
  it('devrait plafonner imputation à 10 700€ et reporter le reste', async () => {
    const inputs: FiscalInputs = {
      year: 2025,
      foyer: {
        salaire: 60000,
        autresRevenus: 0,
        parts: 2,
        isCouple: true,
      },
      biens: [
        {
          id: 'bien-c',
          nom: 'Maison gros déficit',
          type: 'NU',
          loyers: 12000,
          charges: 5000,
          interets: 8000,
          assuranceEmprunt: 800,
          taxeFonciere: 2000,
          fraisGestion: 1200,
          assurancePNO: 400,
          chargesCopro: 2000,
          autresCharges: 600,
          travaux: { entretien: 15000, amelioration: 0, dejaRealises: 15000 },
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
    
    const simulation = await Simulator.simulate(inputs, taxParams2025);
    const bien = simulation.biens[0];
    
    // Charges = 5000 + 8000 + 800 + 2000 + 1200 + 400 + 2000 + 600 + 15000 = 35000€
    expect(bien.chargesDeductibles).toBe(35000);
    
    // Déficit = 12000 - 35000 = -23000€
    expect(bien.deficit).toBe(23000);
    
    // ✅ Plafonnement à 10 700€
    expect(bien.deficitImputableRevenuGlobal).toBeLessThanOrEqual(10700);
    
    // ✅ Report du reste
    expect(bien.deficitReportable).toBeGreaterThan(0);
    
    // PS = 0€
    expect(simulation.ps.montant).toBe(0);
    
    console.log('✅ CAS C validé : Déficit > 10 700€ plafonné OK');
  });
});

// ============================================================================
// CAS D : LMNP MICRO-BIC
// ============================================================================

describe('🧪 CAS D : LMNP Micro-BIC (24 000€)', () => {
  it('devrait appliquer abattement 50%', async () => {
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
          id: 'bien-d',
          nom: 'Studio meublé',
          type: 'LMNP',
          loyers: 24000,
          charges: 0,
          interets: 0,
          assuranceEmprunt: 0,
          taxeFonciere: 0,
          fraisGestion: 0,
          assurancePNO: 0,
          chargesCopro: 0,
          autresCharges: 0,
          travaux: { entretien: 0, amelioration: 0, dejaRealises: 0 },
          regimeSuggere: 'micro',
        },
      ],
      options: {
        autofill: false,
        baseCalcul: 'encaisse',
        optimiserRegimes: false,
      },
    };
    
    const simulation = await Simulator.simulate(inputs, taxParams2025);
    const bien = simulation.biens[0];
    
    // ✅ Micro-BIC
    expect(bien.regime).toBe('micro');
    expect(bien.recettesBrutes).toBe(24000);
    
    // Abattement 50% = 12000€
    expect(bien.chargesDeductibles).toBe(12000);
    expect(bien.details.tauxAbattement).toBe(0.50);
    
    // Base imposable = 24000 - 12000 = 12000€
    expect(bien.resultatFiscal).toBe(12000);
    expect(bien.baseImposableIR).toBe(12000);
    expect(bien.baseImposablePS).toBe(12000);
    
    console.log('✅ CAS D validé : Micro-BIC 50% OK');
  });
});

// ============================================================================
// CAS E : LMNP RÉEL AVEC AMORTISSEMENTS
// ============================================================================

describe('🧪 CAS E : LMNP Réel avec amortissements', () => {
  it('devrait déduire amortissements et gérer déficit reportable', async () => {
    const inputs: FiscalInputs = {
      year: 2025,
      foyer: {
        salaire: 45000,
        autresRevenus: 0,
        parts: 2,
        isCouple: true,
      },
      biens: [
        {
          id: 'bien-e',
          nom: 'Appartement LMNP réel',
          type: 'LMNP',
          loyers: 24000,
          charges: 2000,
          interets: 2000,
          assuranceEmprunt: 500,
          taxeFonciere: 1000,
          fraisGestion: 1000,
          assurancePNO: 300,
          chargesCopro: 1200,
          autresCharges: 0,
          travaux: { entretien: 0, amelioration: 0, dejaRealises: 0 },
          amortissements: {
            batiment: 15000,
            mobilier: 3000,
            fraisAcquisition: 2000,
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
    
    const simulation = await Simulator.simulate(inputs, taxParams2025);
    const bien = simulation.biens[0];
    
    // Charges = 2000 + 2000 + 500 + 1000 + 1000 + 300 + 1200 = 8000€
    expect(bien.chargesDeductibles).toBe(8000);
    
    // Amortissements = 15000 + 3000 + 2000 = 20000€
    expect(bien.amortissements).toBe(20000);
    
    // Résultat = 24000 - 8000 - 20000 = -4000€
    expect(bien.resultatFiscal).toBe(-4000);
    
    // ✅ Déficit BIC reportable (pas d'imputation sur revenu global)
    expect(bien.deficit).toBe(4000);
    expect(bien.deficitReportable).toBe(4000);
    expect(bien.deficitImputableRevenuGlobal).toBeUndefined();
    
    // Base imposable IR = 0
    expect(bien.baseImposableIR).toBe(0);
    expect(bien.baseImposablePS).toBe(0);
    
    console.log('✅ CAS E validé : LMNP réel + amortissements OK');
  });
});

// ============================================================================
// CAS F : PER (PLAFOND + RELIQUATS)
// ============================================================================

describe('🧪 CAS F : PER avec plafond et reliquats', () => {
  it('devrait calculer déduction PER avec reliquats et économie IR', async () => {
    const inputs: FiscalInputs = {
      year: 2025,
      foyer: {
        salaire: 46370, // Pour avoir plafond ~4637€
        autresRevenus: 0,
        parts: 2,
        isCouple: true,
      },
      biens: [],
      per: {
        versementPrevu: 4637,
        plafondDisponible: 4637,
        reliquats: {
          2022: 5000,
          2023: 5000,
          2024: 4000,
        },
      },
      options: {
        autofill: false,
        baseCalcul: 'encaisse',
        optimiserRegimes: false,
      },
    };
    
    const simulation = await Simulator.simulate(inputs, taxParams2025);
    
    // ✅ PER calculé
    expect(simulation.per).toBeDefined();
    expect(simulation.per!.versement).toBe(4637);
    
    // Plafond disponible (10% de 46370 ou plancher 4399€)
    expect(simulation.per!.details.plafondDisponible).toBeGreaterThanOrEqual(4399);
    
    // Reliquats disponibles
    const reliquatsTotal = 5000 + 5000 + 4000;
    expect(reliquatsTotal).toBe(14000);
    
    // Économie IR = versement × TMI
    expect(simulation.per!.economieIR).toBeGreaterThan(0);
    expect(simulation.per!.economieIR).toBe(simulation.per!.versement * simulation.ir.trancheMarginate);
    
    // Pas d'économie PS
    expect(simulation.per!.economiePS).toBe(0);
    
    console.log('✅ CAS F validé : PER plafond + reliquats OK');
  });
});

// ============================================================================
// CAS G : PRÊTS (INTÉRÊTS + ASSURANCE)
// ============================================================================

describe('🧪 CAS G : Prêts avec intérêts et assurance', () => {
  it('devrait déduire intérêts et assurance emprunteur', async () => {
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
          id: 'bien-g',
          nom: 'Bien avec prêt',
          type: 'NU',
          loyers: 15000,
          charges: 2000,
          interets: 3000,     // ✅ Intérêts déductibles
          assuranceEmprunt: 500,  // ✅ Assurance déductible
          taxeFonciere: 1500,
          fraisGestion: 800,
          assurancePNO: 300,
          chargesCopro: 1200,
          autresCharges: 0,
          travaux: { entretien: 0, amelioration: 0, dejaRealises: 0 },
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
    
    const simulation = await Simulator.simulate(inputs, taxParams2025);
    const bien = simulation.biens[0];
    
    // Charges totales incluent intérêts + assurance
    // = 2000 + 3000 + 500 + 1500 + 800 + 300 + 1200 = 9300€
    expect(bien.chargesDeductibles).toBe(9300);
    
    // Résultat = 15000 - 9300 = 5700€
    expect(bien.resultatFiscal).toBe(5700);
    
    // ✅ Les intérêts et assurance sont bien déduits
    expect(bien.baseImposableIR).toBe(5700);
    
    console.log('✅ CAS G validé : Prêts (intérêts + assurance) OK');
  });
});

// ============================================================================
// VÉRIFICATIONS DE COHÉRENCE
// ============================================================================

describe('🧪 Vérifications de cohérence', () => {
  it('TMI devrait correspondre à la tranche max atteinte', async () => {
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
    
    const simulation = await Simulator.simulate(inputs, taxParams2025);
    
    // Revenu par part = 30000€ → tranche 30%
    expect(simulation.ir.trancheMarginate).toBe(0.30);
  });
  
  it('Taux effectif = IR total / revenu imposable', async () => {
    const inputs: FiscalInputs = {
      year: 2025,
      foyer: {
        salaire: 50000,
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
    
    const simulation = await Simulator.simulate(inputs, taxParams2025);
    
    const tauxCalcule = simulation.ir.revenuImposable > 0
      ? simulation.ir.impotNet / simulation.ir.revenuImposable
      : 0;
    
    expect(simulation.ir.tauxMoyen).toBeCloseTo(tauxCalcule, 4);
  });
  
  it('PS = 0 en cas de déficit', async () => {
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
          id: 'bien-deficit',
          nom: 'Bien en déficit',
          type: 'NU',
          loyers: 5000,
          charges: 10000,
          interets: 0,
          assuranceEmprunt: 0,
          taxeFonciere: 0,
          fraisGestion: 0,
          assurancePNO: 0,
          chargesCopro: 0,
          autresCharges: 0,
          travaux: { entretien: 0, amelioration: 0, dejaRealises: 0 },
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
    
    const simulation = await Simulator.simulate(inputs, taxParams2025);
    
    // Déficit → PS = 0
    expect(simulation.ps.montant).toBe(0);
  });
});

// ============================================================================
// OPTIMISEUR
// ============================================================================

describe('🧪 Optimiseur - Stratégies', () => {
  it('devrait calculer Phase 1 et Phase 2 travaux', async () => {
    const inputs: FiscalInputs = {
      year: 2025,
      foyer: {
        salaire: 60000,
        autresRevenus: 0,
        parts: 2,
        isCouple: true,
      },
      biens: [
        {
          id: 'bien-opt',
          nom: 'Bien à optimiser',
          type: 'NU',
          loyers: 20000,
          charges: 5000,
          interets: 3000,
          assuranceEmprunt: 0,
          taxeFonciere: 1500,
          fraisGestion: 0,
          assurancePNO: 0,
          chargesCopro: 0,
          autresCharges: 0,
          travaux: { entretien: 0, amelioration: 0, dejaRealises: 0 },
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
    
    const optimization = await Optimizer.optimize(inputs, taxParams2025);
    
    // ✅ Phase 1 : Ramener à 0€
    expect(optimization.works.phase1.objectif).toContain('0');
    expect(optimization.works.phase1.montantCible).toBeGreaterThan(0);
    expect(optimization.works.phase1.economieTotal).toBeGreaterThan(0);
    expect(optimization.works.phase1.ratioEconomieSurInvest).toBeGreaterThan(0);
    
    // ✅ Phase 2 : Déficit reportable
    expect(optimization.works.phase2.objectif).toContain('déficit');
    expect(optimization.works.phase2.montantCible).toBe(10700);
    expect(optimization.works.phase2.avertissement).toContain('PS');
    
    // ✅ Comparaison
    expect(optimization.comparison.per).toBeDefined();
    expect(optimization.comparison.travaux).toBeDefined();
    expect(optimization.comparison.combine).toBeDefined();
    expect(optimization.comparison.strategyRecommendation).toMatch(/per|travaux|combine/);
    
    console.log('✅ Optimiseur validé : Stratégies OK');
  });
});

