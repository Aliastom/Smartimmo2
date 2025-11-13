/**
 * Utilitaire pour les styles et couleurs des badges de transactions
 */

export type TransactionNature = 
  | 'LOYER' 
  | 'CHARGES' 
  | 'DEPOT_GARANTIE_RECU' 
  | 'DEPOT_GARANTIE_RENDU' 
  | 'AVOIR_REGULARISATION' 
  | 'PENALITE_RETENUE' 
  | 'AUTRE';

export type AccountingType = 'REVENU' | 'DEPENSE' | 'NON_DEFINI';

/**
 * Couleurs pour les badges de Nature (métier)
 */
export function getNatureStyle(nature: TransactionNature): { bg: string; text: string; label: string } {
  switch (nature) {
    case 'LOYER':
      return { bg: 'bg-green-100', text: 'text-green-800', label: 'Loyer' };
    case 'PENALITE_RETENUE':
      return { bg: 'bg-green-100', text: 'text-green-800', label: 'Pénalité' };
    case 'CHARGES':
      return { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Charges' };
    case 'DEPOT_GARANTIE_RECU':
      return { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Dépôt reçu' };
    case 'DEPOT_GARANTIE_RENDU':
      return { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Dépôt rendu' };
    case 'AVOIR_REGULARISATION':
      return { bg: 'bg-base-200', text: 'text-base-content', label: 'Avoir' };
    case 'AUTRE':
      return { bg: 'bg-slate-100', text: 'text-slate-800', label: 'Autre' };
    default:
      return { bg: 'bg-base-200', text: 'text-base-content', label: nature };
  }
}

/**
 * Couleurs pour les badges de Type comptable (INCOME/EXPENSE)
 */
export function getAccountingTypeStyle(type: AccountingType): { bg: string; text: string; label: string } {
  switch (type) {
    case 'REVENU':
      return { bg: 'bg-green-100', text: 'text-green-700', label: 'Revenu' };
    case 'DEPENSE':
      return { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Dépense' };
    case 'NON_DEFINI':
      return { bg: 'bg-base-200', text: 'text-base-content opacity-90', label: 'Non défini' };
    default:
      return { bg: 'bg-base-200', text: 'text-base-content opacity-90', label: type };
  }
}

/**
 * Liste des natures disponibles pour le select
 */
export const TRANSACTION_NATURES: Array<{ value: TransactionNature; label: string }> = [
  { value: 'LOYER', label: 'Loyer' },
  { value: 'CHARGES', label: 'Charges' },
  { value: 'DEPOT_GARANTIE_RECU', label: 'Dépôt de garantie reçu' },
  { value: 'DEPOT_GARANTIE_RENDU', label: 'Dépôt de garantie rendu' },
  { value: 'AVOIR_REGULARISATION', label: 'Avoir / Régularisation' },
  { value: 'PENALITE_RETENUE', label: 'Pénalité / Retenue' },
  { value: 'AUTRE', label: 'Autre' },
];

/**
 * Validation : vérifier la cohérence entre nature et type de catégorie
 */
export function validateNatureCategoryType(nature: TransactionNature, categoryType?: AccountingType | string): {
  valid: boolean;
  error?: string;
} {
  if (!categoryType) {
    return { valid: true }; // Pas de catégorie = OK
  }

  switch (nature) {
    case 'LOYER':
    case 'PENALITE_RETENUE':
    case 'DEPOT_GARANTIE_RECU': // Dépôt reçu = revenu
      if (categoryType !== 'REVENU') {
        return {
          valid: false,
          error: 'Catégorie incompatible avec la nature sélectionnée (attendu : Revenu)',
        };
      }
      break;
    case 'CHARGES':
    case 'DEPOT_GARANTIE_RENDU': // Dépôt rendu = dépense
      if (categoryType !== 'DEPENSE') {
        return {
          valid: false,
          error: 'Catégorie incompatible avec la nature sélectionnée (attendu : Dépense)',
        };
      }
      break;
    // AVOIR, AUTRE : pas de restriction (tous types acceptés)
  }

  return { valid: true };
}

/**
 * Filtrer les catégories par nature
 */
export function filterCategoriesByNature(
  categories: Array<{ id: string; name: string; type: string }>,
  nature: TransactionNature
): Array<{ id: string; name: string; type: string }> {
  switch (nature) {
    case 'LOYER':
    case 'PENALITE_RETENUE':
    case 'DEPOT_GARANTIE_RECU': // Dépôt reçu = revenu
      return categories.filter(c => c.type === 'REVENU');
    case 'CHARGES':
    case 'DEPOT_GARANTIE_RENDU': // Dépôt rendu = dépense
      return categories.filter(c => c.type === 'DEPENSE');
    case 'AVOIR_REGULARISATION': // Avoir = "Non défini" ou tous types
    case 'AUTRE': // Autre = tous types
    default:
      return categories; // Toutes les catégories (pas de filtre)
  }
}

/**
 * Couleurs pour les montants selon le type de catégorie
 */
export function getAmountStyle(categoryType?: string, amount?: number): { text: string } {
  if (!categoryType) {
    return { text: 'text-neutral-700' }; // Couleur neutre par défaut
  }

  switch (categoryType) {
    case 'REVENU':
      return { text: 'text-success' }; // Vert pour les revenus
    case 'DEPENSE':
      return { text: 'text-orange-600' }; // Orange pour les dépenses
    case 'NON_DEFINI':
      return { text: 'text-base-content opacity-80' }; // Gris pour non défini
    default:
      return { text: 'text-neutral-700' }; // Couleur neutre par défaut
  }
}

