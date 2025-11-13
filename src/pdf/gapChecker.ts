import { getManifestForLeaseType, LeaseManifestField, LeaseType } from './lease.manifest';
import { trimString, parseNumber, parseInteger, isFilled as isFilledUtil } from './format';

/**
 * Structure des données pour la génération de bail
 */
export interface LeaseData {
  landlord: {
    fullName?: string;
    address1?: string;
    address2?: string;
    postalCode?: string;
    city?: string;
    email?: string;
    phone?: string;
    siret?: string;
    iban?: string;
    bic?: string;
  } | null;
  Tenant: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    birthDate?: string | Date | null;
  };
  Property: {
    name?: string;
    address?: string;
    postalCode?: string;
    city?: string;
    surface?: number | null;
    rooms?: number | null;
  };
  lease: {
    startDate: string | Date;
    endDate?: string | Date | null;
    rentAmount: number;
    charges?: number | null;
    deposit?: number | null;
    paymentDay?: number | null;
    noticeMonths?: number | null;
    indexationType?: string | null;
    overridesJson?: string | null;
  };
}

/**
 * Résultat du Gap Checker
 */
export interface GapCheckResult {
  isComplete: boolean;
  missingFields: LeaseManifestField[];
  landlordMissing: string[];
  propertyMissing: string[];
  leaseMissing: string[];
  tenantMissing: string[];
  data: LeaseData;
}

/**
 * Récupère une valeur nested dans un objet via un path (ex: "tenant.firstName")
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Définit une valeur nested dans un objet via un path
 */
function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  const lastKey = keys.pop()!;
  const target = keys.reduce((current, key) => {
    if (!current[key]) current[key] = {};
    return current[key];
  }, obj);
  target[lastKey] = value;
}

/**
 * Nettoie et normalise une valeur
 */
function cleanValue(value: any, fieldPath: string = ''): any {
  if (value === null || value === undefined) {
    return null;
  }
  
  if (typeof value === 'string') {
    const trimmed = trimString(value);
    if (trimmed === '') return null;
    
    // Convertir les nombres depuis strings si applicable
    if (fieldPath.includes('Amount') || fieldPath.includes('surface') || fieldPath.includes('Day') || fieldPath.includes('Months')) {
      const isFloat = fieldPath.includes('Amount') || fieldPath.includes('surface');
      const num = isFloat ? parseNumber(trimmed) : parseInteger(trimmed);
      return isNaN(num) ? trimmed : num;
    }
    
    return trimmed;
  }
  
  if (typeof value === 'number') {
    // 0 est une valeur valide, NaN ne l'est pas
    return isNaN(value) ? null : value;
  }
  
  return value;
}

/**
 * Nettoie récursivement un objet
 */
function cleanData(data: any): any {
  if (Array.isArray(data)) {
    return data.map(cleanData);
  }
  
  if (data !== null && typeof data === 'object') {
    const cleaned: any = {};
    for (const key in data) {
      cleaned[key] = cleanData(data[key]);
    }
    return cleaned;
  }
  
  return cleanValue(data);
}

/**
 * Vérifie si une valeur est considérée comme "remplie"
 * Utilise la fonction du module format pour cohérence
 */
function isFilled(value: any): boolean {
  return isFilledUtil(value);
}

/**
 * Vérifie si les données sont complètes pour générer un bail
 */
export function checkLeaseDataGaps(
  leaseType: LeaseType,
  data: LeaseData
): GapCheckResult {
  const manifest = getManifestForLeaseType(leaseType);
  const missingFields: LeaseManifestField[] = [];
  const landlordMissing: string[] = [];
  const propertyMissing: string[] = [];
  const leaseMissing: string[] = [];
  const tenantMissing: string[] = [];

  // Nettoyer toutes les données
  let cleanedData = cleanData(data);

  // Merger les overrides si présents
  if (data.lease.overridesJson) {
    try {
      const overrides = JSON.parse(data.lease.overridesJson);
      cleanedData = deepMerge(cleanedData, cleanData(overrides));
    } catch (error) {
      console.error('Error parsing overridesJson:', error);
    }
  }

  // Vérifier chaque champ requis
  for (const field of manifest) {
    if (!field.required) continue;
    
    const value = getNestedValue(cleanedData, field.path);
    
    if (!isFilled(value)) {
      missingFields.push(field);
      
      // Catégoriser par type
      const [category] = field.path.split('.');
      switch (category) {
        case 'landlord':
          landlordMissing.push(field.path);
          break;
        case 'property':
          propertyMissing.push(field.path);
          break;
        case 'lease':
          leaseMissing.push(field.path);
          break;
        case 'tenant':
          tenantMissing.push(field.path);
          break;
      }
    }
  }

  // Log dev-only
  if (process.env.NODE_ENV === 'development' && missingFields.length > 0) {
    console.debug('[LEASE GEN] missing', {
      landlordMissing,
      propertyMissing,
      leaseMissing,
      tenantMissing,
      total: missingFields.length,
    });
  }

  return {
    isComplete: missingFields.length === 0,
    missingFields,
    landlordMissing,
    propertyMissing,
    leaseMissing,
    tenantMissing,
    data: cleanedData,
  };
}

/**
 * Applique les valeurs par défaut du manifest
 */
export function applyDefaults(leaseType: LeaseType, data: LeaseData): LeaseData {
  const manifest = getManifestForLeaseType(leaseType);
  const result = { ...data };

  for (const field of manifest) {
    if (field.defaultValue !== undefined) {
      const currentValue = getNestedValue(result, field.path);
      if (currentValue === null || currentValue === undefined) {
        setNestedValue(result, field.path, field.defaultValue);
      }
    }
  }

  return result;
}

/**
 * Deep merge de deux objets
 */
function deepMerge(target: any, source: any): any {
  const output = { ...target };
  
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  
  return output;
}

function isObject(item: any): boolean {
  return item && typeof item === 'object' && !Array.isArray(item);
}

