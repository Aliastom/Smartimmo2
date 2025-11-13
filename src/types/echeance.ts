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

// Couleurs pour les badges
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

