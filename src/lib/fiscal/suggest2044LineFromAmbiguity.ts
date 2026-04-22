import type { Fiscal2044Ambiguity } from '@/types/fiscal';

const HINT_TO_LINE: Record<string, string> = {
  '2044_211': '211',
  '2044_212': '212',
  '2044_213': '213',
  '2044_215': '215',
  '2044_221': '221',
  '2044_222': '222',
  '2044_223': '223',
  '2044_224': '224',
  '2044_225': '225',
  '2044_226': '226',
  '2044_227': '227',
  '2044_229': '229',
  '2044_230': '230',
  '2044_420': '420',
};

/** Libellés 2044 (charges / recettes) pour suggestions d’affichage uniquement. */
export const FISCAL_2044_LINE_LABELS: Record<string, string> = {
  '211': 'Loyers (ligne 211)',
  '212': 'Recettes diverses (ligne 212)',
  '213': 'Subventions / indemnités (ligne 213)',
  '215': 'Autres recettes imposables (ligne 215)',
  '221': 'Frais de gestion (ligne 221)',
  '222': 'Autres frais administratifs (ligne 222)',
  '223': 'Primes d’assurance (ligne 223)',
  '224': 'Travaux, entretien et réparations (ligne 224)',
  '225': 'Charges récupérables non récupérées (ligne 225)',
  '226': 'Indemnités / relogement (ligne 226)',
  '227': 'Taxes foncières (ligne 227)',
  '230': 'Régularisations / divers (ligne 230)',
};

function normalizeHint(value?: string | null): string | null {
  if (!value) return null;
  const k = value.trim().toUpperCase();
  return HINT_TO_LINE[k] ?? null;
}

/** Même heuristique que le ventilateur 2044 (fallback catégorie → ligne). */
function fallbackLineFromSlugLabel(slug: string, label: string): string {
  const s = slug.toLowerCase();
  const l = label.toLowerCase();
  if (s.includes('assurance') || l.includes('assurance')) return '223';
  if (s.includes('taxe-fonciere') || l.includes('taxe fonci') || l.includes('taxe fonc')) return '227';
  const travaux = s.includes('travaux') || s.includes('entretien') || l.includes('travaux') || l.includes('entretien');
  if (travaux) return '224';
  if (s.includes('frais-gestion') || s.includes('gestion') || l.includes('gestion') || l.includes('honoraire'))
    return '221';
  return '230';
}

function isGenericDiversCategory(slug: string, label: string): boolean {
  const s = slug.toLowerCase();
  const l = label.toLowerCase();
  return s.includes('divers') || l.includes('divers') || l.includes('autre') || s.includes('autre');
}

export type Suggested2044Line = {
  line: string;
  label: string;
  /** Indice à coller sur la catégorie (admin / natures) si pertinent */
  fiscalLineHint: string;
  /** Justification de la suggestion (transparence UI). */
  source: 'category' | 'transaction-label' | 'fiscal-hint' | 'fallback-reason' | 'none';
};

/**
 * Propose une ligne 2044 cohérente pour l’assistant déclaration (affichage / guidance).
 * Ne modifie pas les montants ni la ventilation moteur.
 */
function buildSuggestion(line: string, source: Suggested2044Line['source']): Suggested2044Line {
  const label = FISCAL_2044_LINE_LABELS[line] || `Ligne ${line} (2044)`;
  return { line, label, fiscalLineHint: `2044_${line}`, source };
}

/**
 * Heuristiques "métier" basées sur le libellé de transaction :
 * on favorise une proposition intelligible pour l'utilisateur avant le fallback technique.
 */
function lineFromTransactionLabel(label: string): string | null {
  const l = label.toLowerCase();
  if (!l) return null;
  if (l.includes('commission') || l.includes('honoraire') || l.includes('gestion') || l.includes('syndic')) {
    return '221';
  }
  if (l.includes('assurance') || l.includes('pno')) return '223';
  if (l.includes('taxe fonci')) return '227';
  if (
    l.includes('travaux') ||
    l.includes('artisan') ||
    l.includes('plomberie') ||
    l.includes('electric') ||
    l.includes('reparation') ||
    l.includes('entretien')
  ) {
    return '224';
  }
  if (l.includes('charge recuperable') || l.includes('regularisation locataire')) return '225';
  if (l.includes('indemnite') || l.includes('relogement')) return '226';
  if (l.includes('loyer')) return '211';
  return null;
}

export function suggest2044LineFromAmbiguity(a: Fiscal2044Ambiguity): Suggested2044Line | null {
  // 1) Priorité à la catégorie métier actuelle (le plus parlant pour l'utilisateur)
  const slug = a.categorySlug || '';
  const categoryLabel = a.categoryLabel || '';
  if ((slug || categoryLabel) && !isGenericDiversCategory(slug, categoryLabel)) {
    const byCategory = fallbackLineFromSlugLabel(slug, categoryLabel);
    if (byCategory) return buildSuggestion(byCategory, 'category');
  }

  // 2) Puis heuristique libellé transaction
  const byTxLabel = lineFromTransactionLabel(a.label || '');
  if (byTxLabel) return buildSuggestion(byTxLabel, 'transaction-label');

  // 3) Puis fiscalLineHint (si exploitable)
  const hinted = normalizeHint(a.fiscalLineHint);
  if (hinted && hinted !== '229' && hinted !== '420') {
    return buildSuggestion(hinted, 'fiscal-hint');
  }

  // 4) Dernier recours : fallback technique détecté dans le reason moteur
  const fromReason = a.reason.match(/fallback vers (\d{3})/i);
  if (fromReason?.[1]) {
    return buildSuggestion(fromReason[1], 'fallback-reason');
  }

  return null;
}

export function groupKeyForAmbiguity(a: Fiscal2044Ambiguity): string {
  const r = a.reason.toLowerCase();
  if (r.includes('capitalisable')) return 'capitalisable';
  if (r.includes('fiscallinehint') && (r.includes('229') || r.includes('420'))) return 'hint-totaux';
  if (r.includes('charge sans fiscallinehint')) return 'sans-hint-charge';
  if (r.includes('recette sans')) return 'recettes';
  if (r.includes('nature non reconnue')) return 'nature';
  if (r.includes('229/420')) return 'hint-totaux';
  return 'autres';
}

export const AMBIGUITY_GROUP_ORDER: string[] = [
  'sans-hint-charge',
  'recettes',
  'capitalisable',
  'hint-totaux',
  'nature',
  'autres',
];

export function groupTitleForAmbiguity(key: string): string {
  switch (key) {
    case 'sans-hint-charge':
      return 'Régularisations / divers (ou autre ligne via catégorie)';
    case 'recettes':
      return 'Recettes — ventilation à confirmer';
    case 'capitalisable':
      return 'Dépenses capitalisables (hors ventilation courante)';
    case 'hint-totaux':
      return 'Indicateur fiscal pointant vers un total automatique';
    case 'nature':
      return 'Nature de transaction à préciser';
    default:
      return 'Autres cas à clarifier';
  }
}
