import { describe, it, expect } from 'vitest';
import {
  computeRevenuProFoyerIR,
  abattementForfaitaireRevenus,
} from '../computeRevenuProFoyerIR';
import type { HouseholdInfo, TaxParams } from '@/types/fiscal';

const tp: TaxParams = {
  version: '2026.1',
  year: 2026,
  irBrackets: [{ lower: 0, upper: 11600, rate: 0 }],
  salaryDeduction: { taux: 0.1, min: 472, max: 13522 },
  psRate: 0.172,
  micro: {
    foncierAbattement: 0.3,
    foncierPlafond: 15000,
    bicAbattement: 0.5,
    bicPlafond: 77700,
  },
  deficitFoncier: { plafondImputationRevenuGlobal: 10700, dureeReport: 10 },
  per: { tauxPlafond: 0.1, plancherLegal: 4399, dureeReportReliquats: 3 },
  lmp: { recettesMin: 23000, tauxRecettesProMin: 0.5, inscriptionRCSObligatoire: true },
  sciIS: { tauxReduit: 0.15, plafondTauxReduit: 42500, tauxNormal: 0.25 },
  source: 'test',
  dateMAJ: new Date(),
};

describe('computeRevenuProFoyerIR', () => {
  it('voie pensions : 29 180 − 10 % − 1 411 = 24 851', () => {
    const foyer: HouseholdInfo = {
      salaire: 0,
      autresRevenus: 0,
      parts: 1.5,
      isCouple: false,
      pensionsBrutes: 29180,
      cotisationsSocialesDeductibles: 1411,
      cotisationsPensionsMode: 'manuel',
    };
    expect(abattementForfaitaireRevenus(29180, tp)).toBe(2918);
    expect(computeRevenuProFoyerIR(foyer, tp)).toBe(24851);
  });

  it('mode estimé : taux BDD sur net après abattement (sans valeur en dur 1411)', () => {
    const netApres = 29180 - 2918;
    const taux = 1411 / netApres;
    const tpEst: TaxParams = {
      ...tp,
      pensionSocialesDeductiblesEstime: { tauxSurNetApresAbattement: taux },
    };
    const foyer: HouseholdInfo = {
      salaire: 0,
      autresRevenus: 0,
      parts: 1,
      isCouple: false,
      pensionsBrutes: 29180,
      cotisationsSocialesDeductibles: 99999,
      cotisationsPensionsMode: 'estime',
    };
    expect(computeRevenuProFoyerIR(foyer, tpEst)).toBe(24851);
  });

  it('voie historique : salaire net − cotis', () => {
    const foyer: HouseholdInfo = {
      salaire: 26262,
      autresRevenus: 0,
      parts: 1,
      isCouple: false,
      cotisationsSocialesDeductibles: 1411,
    };
    expect(computeRevenuProFoyerIR(foyer, tp)).toBe(24851);
  });
});
