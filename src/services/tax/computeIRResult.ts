/**
 * Calcul IR (barème + parts + décote) — extrait pour réutilisation UI (ex. comparaison parts).
 * Décote : formule DGFiP via `computeIrDecoteDGFiP` (paramètres JSON, identiques admin).
 */
import type { IRResult, TaxParams } from '@/types/fiscal';
import { computeIrDecoteDGFiP } from '@/services/tax/irDecoteDGFiP';

export function computeIRResult(
  revenuImposable: number,
  parts: number,
  taxParams: TaxParams,
  isCouple: boolean
): IRResult {
  if (revenuImposable <= 0 || parts <= 0) {
    return {
      revenuImposable: Math.max(0, revenuImposable),
      revenuParPart: 0,
      impotBrut: 0,
      decote: 0,
      impotNet: 0,
      tauxMoyen: 0,
      trancheMarginate: 0,
      detailsTranches: [],
    };
  }

  const revenuParPart = revenuImposable / parts;
  const detailsTranches: IRResult['detailsTranches'] = [];
  let impotBrut = 0;
  let trancheMarginate = 0;

  for (const tranche of taxParams.irBrackets) {
    const lower = tranche.lower;
    const upper = tranche.upper || Infinity;

    if (revenuParPart > lower) {
      const baseTrancheImposable = Math.min(revenuParPart, upper) - lower;
      const impotTranche = baseTrancheImposable * tranche.rate;

      detailsTranches.push({
        tranche,
        baseTrancheImposable,
        impotTranche,
      });

      impotBrut += impotTranche;
      trancheMarginate = tranche.rate;
    }
  }

  impotBrut *= parts;

  const decote =
    taxParams.irDecote && impotBrut > 0
      ? computeIrDecoteDGFiP(impotBrut, isCouple, taxParams.irDecote)
      : 0;

  const impotNet = Math.max(0, impotBrut - decote);
  const tauxMoyen = revenuImposable > 0 ? impotNet / revenuImposable : 0;

  return {
    revenuImposable,
    revenuParPart,
    impotBrut,
    decote,
    impotNet,
    tauxMoyen,
    trancheMarginate,
    detailsTranches,
  };
}
