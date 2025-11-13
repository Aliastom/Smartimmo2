/**
 * Module de gestion déléguée
 * Exports principaux pour la fonctionnalité de sociétés de gestion
 * 
 * Note: La fonction isGestionDelegueEnabled() a été déplacée dans
 * src/lib/settings/appSettings.ts pour utiliser les paramètres configurables.
 */

export { calcCommission, isValidModeCalcul } from './calcCommission';
export type { 
  ModeCalcul, 
  CalcCommissionParams, 
  CalcCommissionResult 
} from './calcCommission';

export type {
  ManagementCompany,
  CreateManagementCompanyDto,
  UpdateManagementCompanyDto,
  AssignPropertiesDto,
} from './types';

