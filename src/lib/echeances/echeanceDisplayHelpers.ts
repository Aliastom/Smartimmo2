/**
 * Helpers centralisés pour l'affichage Nature + Catégorie des échéances.
 * Ne jamais utiliser l'ancien type d'échéance comme source d'affichage de la nature.
 */

import { resolveNatureCodeForEcheance } from './echeanceTypeMigration';
import { NATURE_CODE_LABELS } from '@/types/echeance';

export type NatureForDisplay = { key: string; label: string };
export type CategoryForDisplay = { id: string; label: string };

/**
 * Retourne le label d'affichage de la NATURE pour une échéance.
 * Règles :
 * - priorité à echeance.natureCode résolu via référentiel
 * - fallback : natureCode dérivé du type (resolveNatureCodeForEcheance) puis NATURE_CODE_LABELS
 * - NE JAMAIS utiliser le libellé de l'échéance ou l'ancien type (ECHEANCE_TYPE_LABELS)
 */
export function getNatureLabelForEcheance(
  echeance: { natureCode?: string | null; type?: string; sens?: string },
  natures?: NatureForDisplay[]
): string {
  const natureCode = resolveNatureCodeForEcheance(echeance as any);
  if (natures?.length) {
    const n = natures.find((x) => x.key === natureCode);
    if (n?.label) return n.label;
  }
  return NATURE_CODE_LABELS[natureCode] ?? natureCode ?? '—';
}

/**
 * Retourne le libellé de catégorie pour une échéance.
 * Règles :
 * - priorité à echeance.defaultCategoryId
 * - fallback sur catégorie par défaut de la nature
 * - sinon "Non définie"
 */
export function getCategoryLabelForEcheance(
  echeance: { defaultCategoryId?: string | null; natureCode?: string | null; type?: string; sens?: string },
  categories: CategoryForDisplay[],
  getDefaultCategoryId?: (natureKey: string) => string | undefined
): string {
  const categoryId = (echeance as any).defaultCategoryId;
  if (categoryId) {
    const c = categories.find((x) => x.id === categoryId);
    if (c?.label) return c.label;
  }
  if (getDefaultCategoryId) {
    const natureCode = resolveNatureCodeForEcheance(echeance as any);
    const defaultId = getDefaultCategoryId(natureCode);
    if (defaultId) {
      const c = categories.find((x) => x.id === defaultId);
      if (c?.label) return c.label;
    }
  }
  return 'Non définie';
}
