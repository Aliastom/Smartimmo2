/**
 * Revenus du foyer soumis au barème IR (hors foncier/BIC/PER).
 *
 * Deux voies :
 * - **Legacy** : `salaire` + `autresRevenus` déjà nets imposables côté saisie, moins `cotisationsSocialesDeductibles` (global).
 * - **Pensions explicites** : si `pensionsBrutes` > 0, chaîne DGFIP-type sur les pensions uniquement :
 *   brut → abattement forfaitaire (mêmes paramètres que l’article 83 / barème `salaryDeduction`) → déductions sociales déductibles
 *   (manuelles ou estimées via taux JSON BDD), puis + revenus d’activité (`salaire` + `autresRevenus`, nets imposables).
 */
import type { HouseholdInfo, TaxParams } from '@/types/fiscal';

export function abattementForfaitaireRevenus(
  brut: number,
  taxParams: TaxParams
): number {
  const sd = taxParams.salaryDeduction;
  const taux = sd?.taux ?? 0.1;
  const min = sd?.min ?? 472;
  const max = sd?.max ?? 13522;
  return Math.min(Math.max(brut * taux, min), max);
}

/** Cotisations déductibles sur pensions (€) après abattement 10 %, selon mode foyer + BDD. */
export function computeCotisationsPensionsEffectives(
  foyer: HouseholdInfo,
  taxParams: TaxParams,
  netPensionApresAbattement: number
): number {
  const mode = foyer.cotisationsPensionsMode ?? 'manuel';
  if (mode === 'estime') {
    const taux = taxParams.pensionSocialesDeductiblesEstime?.tauxSurNetApresAbattement;
    if (taux != null && taux > 0) {
      return Math.round(netPensionApresAbattement * taux);
    }
  }
  return Math.max(0, Number(foyer.cotisationsSocialesDeductibles) || 0);
}

export function computeRevenuProFoyerIR(
  foyer: HouseholdInfo,
  taxParams: TaxParams
): number {
  const salaire = Math.max(0, Number(foyer.salaire) || 0);
  const autres = Math.max(0, Number(foyer.autresRevenus) || 0);
  const pensionsBrutes = Math.max(0, Number(foyer.pensionsBrutes) || 0);

  if (pensionsBrutes <= 0) {
    const cotis = Math.max(0, Number(foyer.cotisationsSocialesDeductibles) || 0);
    return Math.max(0, salaire + autres - cotis);
  }

  const dedPension = abattementForfaitaireRevenus(pensionsBrutes, taxParams);
  const netPensionApresAbattement = pensionsBrutes - dedPension;
  const cotisPension = computeCotisationsPensionsEffectives(
    foyer,
    taxParams,
    netPensionApresAbattement
  );

  const pensionNetImposable = Math.max(0, netPensionApresAbattement - cotisPension);
  return Math.max(0, salaire + autres + pensionNetImposable);
}
