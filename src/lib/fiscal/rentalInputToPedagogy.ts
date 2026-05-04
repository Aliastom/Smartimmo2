import type { RentalPropertyInput, RentalPropertyResult, RegimeFiscal } from '@/types/fiscal';
import { computeLmnpReelPedagogyDisplay } from '@/lib/fiscal/immoTaxDisplayAlloc';

/** Construit un résultat minimal compatible avec la pédagogie LMNP à partir de l’agrégat FiscalAggregator. */
export function rentalPropertyInputToPedagogyUx(bien: RentalPropertyInput) {
  const recettesBrutes = bien.loyers + (bien.autresRevenus || 0);
  const chargesDeductibles =
    bien.charges +
    bien.interets +
    bien.assuranceEmprunt +
    bien.taxeFonciere +
    bien.fraisGestion +
    bien.assurancePNO +
    bien.chargesCopro +
    bien.autresCharges +
    (bien.travaux?.entretien || 0);
  const amortissements = bien.amortissements
    ? (bien.amortissements.batiment || 0) +
      (bien.amortissements.mobilier || 0) +
      (bien.amortissements.fraisAcquisition || 0)
    : 0;
  const rc = String(bien.regimeChoisi || '').toLowerCase();
  const regimeUtilise: RegimeFiscal = rc.includes('micro') ? 'micro' : 'reel';

  const pseudoResult: RentalPropertyResult = {
    id: bien.id,
    nom: bien.nom,
    type: bien.type,
    regime: regimeUtilise,
    regimeUtilise,
    regimeSuggere: bien.regimeSuggere,
    recettesBrutes,
    chargesDeductibles,
    amortissements,
    resultatFiscal: recettesBrutes - chargesDeductibles - amortissements,
    baseImposableIR: Math.max(0, recettesBrutes - chargesDeductibles - amortissements),
    baseImposablePS: Math.max(0, recettesBrutes - chargesDeductibles - amortissements),
    details: { eligibleMicro: false },
    breakdown: bien.breakdown,
    meubleTourismeClasse: bien.meubleTourismeClasse,
  };

  return computeLmnpReelPedagogyDisplay([pseudoResult]);
}
