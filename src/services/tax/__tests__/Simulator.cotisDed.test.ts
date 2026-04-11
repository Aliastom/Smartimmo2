/**
 * Cas pensions + CSG déductible : base IR alignée RFR-type.
 *
 * Non-régression : cas de référence validation fiscale 2026.1 (voir describe dédié).
 */
import { describe, it, expect } from 'vitest';
import { Simulator } from '../Simulator';
import type { FiscalInputs, TaxParams } from '@/types/fiscal';
import { buildIrDecoteFromStored } from '@/services/tax/irDecoteDGFiP';
import { irNetAffichageEuro } from '@/services/tax/irNetAffichageEuro';

/** Aligné version publiée 2026.1 (barème IR + décote DGFiP stockés en base). */
const mockTaxParams: TaxParams = {
  version: '2026.1',
  year: 2026,
  irBrackets: [
    { lower: 0, upper: 11600, rate: 0.0 },
    { lower: 11600, upper: 29579, rate: 0.11 },
    { lower: 29579, upper: 84577, rate: 0.3 },
    { lower: 84577, upper: 181917, rate: 0.41 },
    { lower: 181917, upper: null, rate: 0.45 },
  ],
  irDecote: buildIrDecoteFromStored({
    seuilCelibataire: 1983,
    seuilCouple: 3278,
    plafondCelibataire: 897,
    plafondCouple: 1483,
    taux: 0.4525,
  }),
  psRate: 0.172,
  micro: {
    foncierAbattement: 0.3,
    foncierPlafond: 15000,
    bicAbattement: 0.5,
    bicPlafond: 77700,
  },
  deficitFoncier: {
    plafondImputationRevenuGlobal: 10700,
    dureeReport: 10,
  },
  per: {
    tauxPlafond: 0.1,
    plancherLegal: 4399,
    dureeReportReliquats: 3,
  },
  lmp: {
    recettesMin: 23000,
    tauxRecettesProMin: 0.5,
    inscriptionRCSObligatoire: true,
  },
  sciIS: {
    tauxReduit: 0.15,
    plafondTauxReduit: 42500,
    tauxNormal: 0.25,
  },
  salaryDeduction: { taux: 0.1, min: 472, max: 13522 },
  source: 'Test',
  dateMAJ: new Date(),
};

describe('Simulator - cotisations sociales déductibles (pensions)', () => {
  it('reconstitue la base ~24 851 € (29 180 − 10 % − 1 411) et abaisse fortement l’IR vs sans cotis', async () => {
    const inputs: FiscalInputs = {
      year: 2026,
      foyer: {
        salaire: 0,
        autresRevenus: 0,
        pensionsBrutes: 29180,
        parts: 1.5,
        isCouple: false,
        cotisationsSocialesDeductibles: 1411,
        cotisationsPensionsMode: 'manuel',
      },
      biens: [],
      options: {
        autofill: false,
        baseCalcul: 'encaisse',
        optimiserRegimes: false,
      },
    };

    const sansCotis: FiscalInputs = {
      ...inputs,
      foyer: { ...inputs.foyer, cotisationsSocialesDeductibles: 0 },
    };

    const [avec, sans] = await Promise.all([
      Simulator.simulate(inputs, mockTaxParams),
      Simulator.simulate(sansCotis, mockTaxParams),
    ]);

    expect(avec.ir.revenuImposable).toBe(24851);
    expect(sans.ir.revenuImposable).toBe(26262);
    expect(avec.ir.impotNet).toBeLessThan(sans.ir.impotNet);
    // Barème 2026.1 + décote (impôt brut < seuil) → ~293,5 € ; arrondi euro vs simulateur impots.gouv peut afficher 294 €
    expect(avec.ir.impotNet).toBeCloseTo(293.49, 1);
    expect(sans.ir.impotNet).toBeCloseTo(518.96, 1);
  });
});

/**
 * Cas réel figé pour la validation produit 2026 (pensions, barème + décote 2026.1).
 * Voie pensions : `pensionsBrutes` 29 180 € → abattement 10 % → cotisations déductibles.
 */
describe('Référence validation fiscale 2026 — cas pensions (non-régression)', () => {
  it('base 24 851 €, IR net moteur ≈ 293,5 €, affichage total / reste = 294 € (PAS 0, sans immo/PER)', async () => {
    const inputs: FiscalInputs = {
      year: 2026,
      foyer: {
        salaire: 0,
        autresRevenus: 0,
        pensionsBrutes: 29180,
        parts: 1.5,
        isCouple: false,
        cotisationsSocialesDeductibles: 1411,
        cotisationsPensionsMode: 'manuel',
      },
      biens: [],
      options: {
        autofill: false,
        baseCalcul: 'encaisse',
        optimiserRegimes: false,
        prelevementSourceDejaPaye: 0,
        acomptesDejaPayes: 0,
      },
    };

    const sim = await Simulator.simulate(inputs, mockTaxParams);

    expect(sim.ir.revenuImposable).toBe(24851);
    expect(sim.ps.montant).toBe(0);

    expect(sim.ir.impotNet).toBeGreaterThan(293.4);
    expect(sim.ir.impotNet).toBeLessThan(293.55);
    expect(sim.ir.impotNet).toBeCloseTo(293.49, 1);

    const irAffiche = irNetAffichageEuro(sim.ir.impotNet);
    expect(irAffiche).toBe(294);

    const psEuroAffichage = Math.round(sim.ps.montant);
    const totalImpotsEuroAffichage = irAffiche + psEuroAffichage;
    expect(totalImpotsEuroAffichage).toBe(294);

    const resteAPayerEuroAffichage = Math.max(
      0,
      totalImpotsEuroAffichage -
        (inputs.options?.prelevementSourceDejaPaye ?? 0) -
        (inputs.options?.acomptesDejaPayes ?? 0)
    );
    expect(resteAPayerEuroAffichage).toBe(294);
  });
});

describe('computeRevenuProFoyerIR — voie historique', () => {
  it('sans pensionsBrutes : salaire net + cotis globales (équivalent ancien moteur)', async () => {
    const inputs: FiscalInputs = {
      year: 2026,
      foyer: {
        salaire: 26262,
        autresRevenus: 0,
        parts: 1.5,
        isCouple: false,
        cotisationsSocialesDeductibles: 1411,
      },
      biens: [],
      options: {
        autofill: false,
        baseCalcul: 'encaisse',
        optimiserRegimes: false,
      },
    };
    const sim = await Simulator.simulate(inputs, mockTaxParams);
    expect(sim.ir.revenuImposable).toBe(24851);
  });
});
