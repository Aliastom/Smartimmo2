/**
 * Types pour la gestion déléguée (sociétés de gestion)
 */

import { ModeCalcul } from './calcCommission';

export interface ManagementCompany {
  id: string;
  nom: string;
  contact?: string | null;
  email?: string | null;
  telephone?: string | null;
  modeCalcul: ModeCalcul;
  taux: number;
  fraisMin?: number | null;
  baseSurEncaissement: boolean;
  tvaApplicable: boolean;
  tauxTva?: number | null;
  actif: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateManagementCompanyDto {
  nom: string;
  contact?: string;
  email?: string;
  telephone?: string;
  modeCalcul: ModeCalcul;
  taux: number;
  fraisMin?: number;
  baseSurEncaissement: boolean;
  tvaApplicable: boolean;
  tauxTva?: number;
  actif?: boolean;
}

export interface UpdateManagementCompanyDto extends Partial<CreateManagementCompanyDto> {
  id: string;
}

export interface AssignPropertiesDto {
  propertyIds: string[];
}

