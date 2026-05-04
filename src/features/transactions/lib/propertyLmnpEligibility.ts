import type { LocalProperty } from '@/lib/offline/types';
import type { CachedFiscalRegime, CachedFiscalType } from '@/lib/offline/db';

/**
 * Indique si la vue fiscale LMNP / BIC meublé est pertinente pour ce bien.
 * Utilise les données locales (activité LMNP, mode location, libellés fiscal type/régime en cache).
 */
export function computeLmnpFiscalViewEligible(
  property: LocalProperty | null | undefined,
  fiscalType?: CachedFiscalType | null,
  fiscalRegime?: CachedFiscalRegime | null
): boolean {
  if (!property) return false;

  const fiscalTypeLbl = fiscalType
    ? `${fiscalType.label} ${fiscalType.description ?? ''}`.toUpperCase()
    : '';

  /** Location nue / non meublée : hors vue LMNP. « NON MEUBLÉE » contenait « MEUBL » → faux positif avec includes('MEUBL'). */
  if (fiscalTypeLbl) {
    if (fiscalTypeLbl.includes('NON MEUBL') || /\bLOCATION\s+NUE\b/.test(fiscalTypeLbl)) {
      return false;
    }
  }

  if (property.lmnpActivityId?.trim()) return true;

  const rm = (property.rentalMode || '').toUpperCase();
  if (rm === 'SEASONAL_AIRBNB' || rm.includes('AIRBNB') || rm.includes('SEASONAL')) return true;

  if (!fiscalType) return false;

  const lbl = fiscalTypeLbl;
  const cat = (fiscalType.category || '').toUpperCase();

  const isLmnpFamily =
    lbl.includes('LMNP') ||
    lbl.includes('LMP') ||
    lbl.includes('MEUBL') ||
    lbl.includes('LOCATION MEUBL');

  const isBicCategory = cat.includes('BIC');

  if (!isLmnpFamily && !(isBicCategory && lbl.includes('MEUBL'))) {
    return false;
  }

  if (fiscalRegime) {
    const rl = (fiscalRegime.label || '').toUpperCase();
    const isReel = rl.includes('RÉEL') || rl.includes('REEL');
    const isMicro = rl.includes('MICRO');
    if (isReel || isMicro) return true;
  }

  return isLmnpFamily;
}
