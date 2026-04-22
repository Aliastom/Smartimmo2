import type { RentalPropertyResult, TypeBien } from '@/types/fiscal';

/**
 * Règle d’affichage 2044 (foncier) — alignée sur {@link Simulator.simulateProperty} :
 * seuls les biens `type === 'NU'` sont traités comme revenus fonciers (2044).
 *
 * En base, le type fiscal vient de `Property.fiscalTypeId` → modèle `FiscalType.id`
 * (ex. `NU`, `MEUBLE`, …) ; l’agrégateur peut donc produire `MEUBLE` en plus de LMNP/LMP.
 */
export function isRevenuFoncierDeclaration2044(bien: Pick<RentalPropertyResult, 'type'>): boolean {
  return bien.type === 'NU';
}

/** Location meublée / BIC (hors 2044 foncière), même IDs que le simulateur. */
export function isLocationMeubleeOuBicHors2044Foncier(bien: Pick<RentalPropertyResult, 'type'>): boolean {
  const t = bien.type;
  return t === 'MEUBLE' || t === 'LMNP' || t === 'LMP';
}

export function isSciISHors2044Foncier(bien: Pick<RentalPropertyResult, 'type'>): boolean {
  return bien.type === 'SCI_IS';
}

/** Libellé UX du régime (micro / réel), selon que le bien est foncier ou BIC. */
export function libelleRegimeFiscalPourAffichage(bien: RentalPropertyResult): string {
  const r = bien.regimeUtilise || bien.regime;
  const foncier = isRevenuFoncierDeclaration2044(bien);
  if (r === 'micro') return foncier ? 'Micro-foncier' : 'Micro-BIC';
  return foncier ? 'Régime réel (foncier)' : 'Régime réel simplifié (BIC)';
}

/** Libellé lisible du type fiscal (`FiscalType.id` côté bien). */
export function libelleTypeFiscalPourAffichage(type: TypeBien): string {
  switch (type) {
    case 'NU':
      return 'Location nue';
    case 'MEUBLE':
      return 'Location meublée (BIC)';
    case 'LMNP':
      return 'LMNP';
    case 'LMP':
      return 'LMP';
    case 'SCI_IS':
      return 'SCI à l’IS';
  }
}
