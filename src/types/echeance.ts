/**
 * Types pour les échéances récurrentes
 */

import { EcheanceType, Periodicite, SensEcheance } from '@prisma/client';

export interface EcheanceRecurrente {
  id: string;
  propertyId: string | null;
  leaseId: string | null;
  label: string;
  type: EcheanceType;
  periodicite: Periodicite;
  montant: number;
  recuperable: boolean;
  sens: SensEcheance;
  startAt: Date | string;
  endAt: Date | string | null;
  isActive: boolean;
  /** Code nature transaction (autonome). Fallback sur type si null. */
  natureCode?: string | null;
  /** Catégorie par défaut pour la transaction générée. */
  defaultCategoryId?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  Property?: {
    id: string;
    name: string;
  } | null;
  Lease?: {
    id: string;
    type: string;
    status: string;
  } | null;
}

export interface EcheanceListResponse {
  items: EcheanceRecurrente[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface EcheanceFormData {
  label: string;
  type: EcheanceType;
  periodicite: Periodicite;
  montant: number;
  recuperable: boolean;
  sens: SensEcheance;
  propertyId: string | null;
  leaseId: string | null;
  startAt: string; // Format YYYY-MM-DD pour input date
  endAt: string | null; // Format YYYY-MM-DD ou null
  isActive: boolean;
}

// Labels pour les enums
export const ECHEANCE_TYPE_LABELS: Record<EcheanceType, string> = {
  PRET: 'Prêt',
  COPRO: 'Copropriété',
  PNO: 'Assurance PNO',
  ASSURANCE: 'Assurance',
  IMPOT: 'Impôts',
  CFE: 'CFE',
  ENTRETIEN: 'Entretien',
  AUTRE: 'Autre',
  LOYER_ATTENDU: 'Loyer attendu',
  CHARGE_RECUP: 'Charges récupérables',
};

/** Labels pour affichage des natures (référentiel métier) */
export const NATURE_CODE_LABELS: Record<string, string> = {
  DEPENSE_TAXE: 'Taxe',
  DEPENSE_ASSURANCE: 'Assurance',
  DEPENSE_BANQUE: 'Banque',
  DEPENSE_ENTRETIEN: 'Entretien',
  DEPENSE_COPRO: 'Copropriété',
  RECETTE_LOYER: 'Loyer',
  RECETTE_AUTRE: 'Autre recette',
};

/**
 * @deprecated Pour l'affichage de la nature, utiliser getNatureLabelForEcheance de echeanceDisplayHelpers.
 * Cette fonction tombait sur ECHEANCE_TYPE_LABELS (ex. PNO → "Assurance PNO") au lieu du vrai label nature.
 */
export function getEcheanceDisplayLabel(e: { natureCode?: string | null; type?: string }): string {
  if (e.natureCode && NATURE_CODE_LABELS[e.natureCode]) return NATURE_CODE_LABELS[e.natureCode];
  if (e.type && ECHEANCE_TYPE_LABELS[e.type as keyof typeof ECHEANCE_TYPE_LABELS]) return ECHEANCE_TYPE_LABELS[e.type as keyof typeof ECHEANCE_TYPE_LABELS];
  return e.natureCode || e.type || '—';
}

export const PERIODICITE_LABELS: Record<Periodicite, string> = {
  MONTHLY: 'Mensuel',
  QUARTERLY: 'Trimestriel',
  YEARLY: 'Annuel',
  ONCE: 'Ponctuel',
};

export const SENS_LABELS: Record<SensEcheance, string> = {
  DEBIT: 'Débit (Charge)',
  CREDIT: 'Crédit (Revenu)',
};

/** Statut temporel (projection) : à venir / échue / désactivée. Pas de notion de "retard" paiement. */
export type EcheanceStatutTemporel = 'desactive' | 'a_venir' | 'echue';

/** Statut de génération : la projection a-t-elle été matérialisée par une transaction ? (phase 3+) */
export type EcheanceStatutGeneration = 'a_generer' | 'partielle' | 'generee' | 'montant_superieur';

/** Alias legacy pour compat (à terme supprimé) */
export type EcheanceStatutGenerationLegacy = EcheanceStatutGeneration | 'sur_liee';

export const STATUT_TEMPOREL_LABELS: Record<EcheanceStatutTemporel, string> = {
  desactive: 'Désactivée',
  a_venir: 'À venir',
  echue: 'Échue',
};

export const STATUT_GENERATION_LABELS: Record<EcheanceStatutGeneration, string> = {
  a_generer: 'À générer',
  partielle: 'Partielle',
  generee: 'Générée',
  montant_superieur: 'Montant supérieur',
};

export const SUGGESTION_LEVEL_LABELS: Record<EcheanceSuggestionLevel, string> = {
  FORT: 'Fort',
  PROBABLE: 'Probable',
  FAIBLE: 'Faible',
};

// Couleurs pour les badges (legacy type)
export const TYPE_COLORS: Record<EcheanceType, string> = {
  PRET: 'bg-purple-100 text-purple-800',
  COPRO: 'bg-blue-100 text-blue-800',
  PNO: 'bg-indigo-100 text-indigo-800',
  ASSURANCE: 'bg-cyan-100 text-cyan-800',
  IMPOT: 'bg-orange-100 text-orange-800',
  CFE: 'bg-amber-100 text-amber-800',
  ENTRETIEN: 'bg-teal-100 text-teal-800',
  AUTRE: 'bg-gray-100 text-gray-800',
  LOYER_ATTENDU: 'bg-green-100 text-green-800',
  CHARGE_RECUP: 'bg-lime-100 text-lime-800',
};

/** Couleurs des badges par nature : Dépense → rouge/orange, Recette → vert */
export const NATURE_CODE_COLORS: Record<string, string> = {
  DEPENSE_TAXE: 'bg-orange-100 text-orange-800 border border-orange-200',
  DEPENSE_ASSURANCE: 'bg-red-100 text-red-800 border border-red-200',
  DEPENSE_BANQUE: 'bg-amber-100 text-amber-800 border border-amber-200',
  DEPENSE_ENTRETIEN: 'bg-orange-100 text-orange-800 border border-orange-200',
  DEPENSE_COPRO: 'bg-amber-100 text-amber-800 border border-amber-200',
  RECETTE_LOYER: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  RECETTE_AUTRE: 'bg-green-100 text-green-800 border border-green-200',
};

/** Retourne la classe CSS du badge pour une nature. Dépense → rouge/orange, Recette → vert */
export function getNatureBadgeClass(natureCode: string | null | undefined): string {
  if (!natureCode) return 'bg-gray-100 text-gray-800 border border-gray-200';
  if (NATURE_CODE_COLORS[natureCode]) return NATURE_CODE_COLORS[natureCode];
  if (natureCode.startsWith('RECETTE_')) return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
  return 'bg-orange-100 text-orange-800 border border-orange-200'; // Dépense par défaut
}

/** Retourne le libellé de la catégorie ou "Non définie" si absent */
export function getCategoryLabelById(
  categoryId: string | null | undefined,
  categories: Array<{ id: string; label: string }>
): string {
  if (!categoryId) return 'Non définie';
  const c = categories.find((x) => x.id === categoryId);
  return c?.label ?? 'Non définie';
}

/** Résout le libellé de catégorie pour une échéance, avec fallback sur la catégorie par défaut de la nature */
export function getCategoryLabelForEcheance(
  echeance: { defaultCategoryId?: string | null; natureCode?: string | null; type?: string },
  categories: Array<{ id: string; label: string }>,
  resolveNatureCode: (e: any) => string,
  getDefaultCategoryId?: (natureKey: string) => string | undefined
): string {
  const categoryId = (echeance as any).defaultCategoryId;
  if (categoryId) {
    const c = categories.find((x) => x.id === categoryId);
    if (c?.label) return c.label;
  }
  if (getDefaultCategoryId) {
    const natureCode = resolveNatureCode(echeance);
    const defaultId = getDefaultCategoryId(natureCode);
    if (defaultId) {
      const c = categories.find((x) => x.id === defaultId);
      if (c?.label) return c.label;
    }
  }
  return 'Non définie';
}

