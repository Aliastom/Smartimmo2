/**
 * Interface pour le repository ManagementCompany
 */

import type { ManagementCompany } from '@/lib/gestion/types';

export interface CreateManagementCompanyData {
  organizationId: string;
  nom: string;
  contact?: string | null;
  email?: string | null;
  telephone?: string | null;
  modeCalcul: string;
  taux: number;
  fraisMin?: number | null;
  baseSurEncaissement: boolean;
  tvaApplicable: boolean;
  tauxTva?: number | null;
  actif: boolean;
}

export interface UpdateManagementCompanyData {
  nom?: string;
  contact?: string | null;
  email?: string | null;
  telephone?: string | null;
  modeCalcul?: string;
  taux?: number;
  fraisMin?: number | null;
  baseSurEncaissement?: boolean;
  tvaApplicable?: boolean;
  tauxTva?: number | null;
  actif?: boolean;
}

export interface IManagementCompanyRepository {
  create(data: CreateManagementCompanyData): Promise<ManagementCompany>;
  update(id: string, data: UpdateManagementCompanyData): Promise<ManagementCompany>;
  delete(id: string, organizationId: string): Promise<void>;
  findById(id: string, organizationId: string): Promise<ManagementCompany | null>;
  findAll(organizationId: string): Promise<ManagementCompany[]>;
  assignProperties?(id: string, propertyIds: string[]): Promise<void>;
}
