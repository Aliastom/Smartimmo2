/**
 * Utilitaire pour gérer les catégories de transactions
 * Mapping unique des couleurs et labels
 */

export const TRANSACTION_CATEGORIES = {
  LOYER: { 
    label: 'Loyer', 
    tone: 'emerald' as const,
    type: 'income' as const,
  },
  CHARGES: { 
    label: 'Charges', 
    tone: 'amber' as const,
    type: 'expense' as const,
  },
  DEPOT_RECU: { 
    label: 'Dépôt reçu', 
    tone: 'emerald' as const,
    type: 'income' as const,
  },
  DEPOT_RENDU: { 
    label: 'Dépôt rendu', 
    tone: 'rose' as const,
    type: 'expense' as const,
  },
  AVOIR: { 
    label: 'Avoir', 
    tone: 'emerald' as const,
    type: 'income' as const,
  },
  PENALITE: { 
    label: 'Pénalité', 
    tone: 'amber' as const,
    type: 'expense' as const,
  },
  AUTRE: { 
    label: 'Autre', 
    tone: 'gray' as const,
    type: 'neutral' as const,
  },
} as const;

export type TransactionCategory = keyof typeof TRANSACTION_CATEGORIES;

/**
 * Obtenir le tone (couleur) d'une catégorie
 * Règle : entrées = emerald, sorties = amber/rose
 */
export function getCategoryTone(category: string): 'emerald' | 'amber' | 'rose' | 'gray' {
  const cat = TRANSACTION_CATEGORIES[category as TransactionCategory];
  return cat?.tone || 'gray';
}

/**
 * Obtenir le label d'une catégorie
 */
export function getCategoryLabel(category: string): string {
  const cat = TRANSACTION_CATEGORIES[category as TransactionCategory];
  return cat?.label || category;
}

/**
 * Obtenir les classes Tailwind pour un tone
 */
export function getCategoryClasses(tone: 'emerald' | 'amber' | 'rose' | 'gray'): string {
  const classMap = {
    emerald: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20',
    amber: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20',
    rose: 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/20',
    gray: 'bg-base-200 text-base-content opacity-90 ring-1 ring-inset ring-gray-600/20',
  };
  return classMap[tone];
}

/**
 * Vérifier si une catégorie est un revenu
 */
export function isIncome(category: string): boolean {
  return ['LOYER', 'DEPOT_RECU', 'AVOIR'].includes(category);
}

