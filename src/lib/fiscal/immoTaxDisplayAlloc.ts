import type { RentalPropertyResult } from '@/types/fiscal';

export function isMicroBicRegime(b: RentalPropertyResult): boolean {
  const u = String(b.regimeUtilise ?? b.regime ?? '').toLowerCase();
  const r = String(b.regime ?? '').toLowerCase();
  return r === 'micro' || u === 'micro' || u === 'micro_bic';
}

/**
 * Chaîne d’affichage **pédagogique** LMNP / BIC au réel (agrégat des biens au réel uniquement).
 * Ne modifie pas le moteur : les montants IR finaux restent `consolidation.revenusBIC`.
 */
export function computeLmnpReelPedagogyDisplay(reelBiens: RentalPropertyResult[]) {
  if (!reelBiens.length) return null;

  const recettesBrutes = reelBiens.reduce((s, b) => s + (b.recettesBrutes ?? 0), 0);
  const chargesDeductibles = reelBiens.reduce((s, b) => s + (b.chargesDeductibles ?? 0), 0);
  const amortissementsComptabilises = reelBiens.reduce((s, b) => s + (b.amortissements ?? 0), 0);

  const resultatAvantAmortissements = recettesBrutes - chargesDeductibles;
  const amortissementsDeductiblesCetteAnnee = Math.min(
    amortissementsComptabilises,
    Math.max(0, resultatAvantAmortissements),
  );
  const amortissementsNonDeduitsReportables =
    amortissementsComptabilises - amortissementsDeductiblesCetteAnnee;
  const resultatApresAmortissements = resultatAvantAmortissements - amortissementsDeductiblesCetteAnnee;
  const resultatFiscalBicMax0Ux = Math.max(0, resultatApresAmortissements);

  const hasDeficitAvantAmort = resultatAvantAmortissements < -1e-6;
  const deficitBicHorsAmortissements = hasDeficitAvantAmort ? -resultatAvantAmortissements : 0;
  const hasAmortissementsNonDeduits = amortissementsNonDeduitsReportables > 1e-6;

  return {
    recettesBrutes,
    chargesDeductibles,
    amortissementsComptabilises,
    resultatAvantAmortissements,
    amortissementsDeductiblesCetteAnnee,
    amortissementsNonDeduitsReportables,
    resultatApresAmortissements,
    resultatFiscalBicMax0Ux,
    hasDeficitAvantAmort,
    deficitBicHorsAmortissements,
    hasAmortissementsNonDeduits,
  };
}

/**
 * Agrège, pour les seuls biens BIC (meublé / LMNP / LMP), des totaux pour micro + réel et la somme des résultats fiscaux.
 */
export function aggregateBicPedagogyFromBiens(biensBic: RentalPropertyResult[]) {
  let recettes = 0;
  let chargesReel = 0;
  let amortissements = 0;
  let abattementMicro = 0;
  let sumResultatFiscal = 0;
  let recettesMicroBic = 0;
  let reelBicCount = 0;

  for (const b of biensBic) {
    recettes += b.recettesBrutes ?? 0;
    sumResultatFiscal += b.resultatFiscal ?? 0;
    if (isMicroBicRegime(b)) {
      abattementMicro += b.details?.abattement ?? b.chargesDeductibles ?? 0;
      recettesMicroBic += b.recettesBrutes ?? 0;
    } else {
      reelBicCount += 1;
      chargesReel += b.chargesDeductibles ?? 0;
      amortissements += b.amortissements ?? 0;
    }
  }

  return {
    recettes,
    chargesReel,
    amortissements,
    abattementMicro,
    sumResultatFiscal,
    recettesMicroBic,
    reelBicCount,
  };
}

/**
 * Ventilation indicative au prorata de deux bases (≥ 0).
 * L’IR réel est non linéaire ; cette répartition sert uniquement à la lisibilité.
 */
export function allocateProRataTwoWeights(total: number, wNu: number, wBic: number): { nu: number; bic: number } {
  const a = Math.max(0, wNu);
  const b = Math.max(0, wBic);
  const s = a + b;
  if (s <= 0 || total === 0) {
    return { nu: 0, bic: 0 };
  }
  return {
    nu: total * (a / s),
    bic: total * (b / s),
  };
}
