/**
 * Base de données locale IndexedDB via Dexie
 * Gère le stockage offline des données et les opérations en attente de synchronisation
 */

import Dexie, { Table } from 'dexie';
import { LocalProperty, PendingOperation, SyncMeta } from './types';

// Types pour les données de référence en cache
export interface CachedFiscalType {
  id: string;
  label: string;
  category: string;
  description?: string | null;
  isActive: boolean;
  cachedAt: string;
}

export interface CachedFiscalRegime {
  id: string;
  label: string;
  appliesToIds: string; // JSON array
  engagementYears?: number | null;
  eligibility?: string | null; // JSON
  calcProfile: string;
  description?: string | null;
  isActive: boolean;
  cachedAt: string;
}

export interface CachedManagementCompany {
  id: string;
  name: string;
  siret?: string | null;
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
  actif: boolean;
  cachedAt: string;
}

export interface CachedNature {
  key: string;
  label: string;
  flow: string;
  active: boolean;
  compatibleTypes?: string[];
  defaultCategory?: string;
  cachedAt: string;
}

export interface CachedAccountingCategory {
  id: string;
  slug: string;
  label: string;
  type: string;
  deductible?: boolean | null;
  capitalizable?: boolean | null;
  actif: boolean;
  cachedAt: string;
}

export interface CachedDocumentType {
  id: string;
  code: string;
  label: string;
  category?: string | null;
  isActive: boolean;
  cachedAt: string;
  // On peut stocker les métadonnées principales (pas tout le détail)
}

export interface CachedSignal {
  id: string;
  code: string;
  label: string;
  category?: string | null;
  isActive: boolean;
  cachedAt: string;
}

export interface CachedFiscalCompatibility {
  id: string;
  scope: string;
  left: string;
  right: string;
  rule: string;
  note?: string | null;
  cachedAt: string;
}

// Types locaux pour les entités métier (offline-first)
export interface LocalLease {
  id: string;
  organizationId: string;
  propertyId: string;
  tenantId: string;
  type: string;
  startDate: string;
  endDate?: string | null;
  rentAmount: number;
  deposit?: number | null;
  paymentDay?: number | null;
  notes?: string | null;
  noticeMonths?: number | null;
  indexationType?: string | null;
  furnishedType?: string | null;
  overridesJson?: string | null;
  status: string;
  signedPdfUrl?: string | null;
  chargesRecupMensuelles?: number | null;
  chargesNonRecupMensuelles?: number | null;
  createdAt: string;
  updatedAt: string;
  _localUpdatedAt?: string;
  _syncedAt?: string;
}

export interface LocalTenant {
  id: string;
  organizationId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  birthDate?: string | null;
  nationality?: string | null;
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
  occupation?: string | null;
  employer?: string | null;
  monthlyIncome?: number | null;
  emergencyContact?: string | null;
  emergencyPhone?: string | null;
  status: string;
  tags?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  _localUpdatedAt?: string;
  _syncedAt?: string;
}

export interface LocalLoan {
  id: string;
  organizationId: string;
  propertyId: string;
  label: string;
  principal: number;
  annualRatePct: number;
  durationMonths: number;
  defermentMonths: number;
  insurancePct?: number | null;
  feesUpfront?: number | null;
  startDate: string;
  endDate?: string | null;
  paymentDay?: number | null;
  rateType: string;
  loanType?: string | null;
  repaymentType?: string | null;
  amortizationProfile?: string | null;
  notes?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _localUpdatedAt?: string;
  _syncedAt?: string;
}

export interface LocalPayment {
  id: string;
  organizationId: string;
  propertyId: string;
  leaseId?: string | null;
  periodYear: number;
  periodMonth: number;
  date: string;
  amount: number;
  nature: string;
  categoryId?: string | null;
  snapshotAccounting?: string | null;
  label: string;
  method?: string | null;
  reference?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  _localUpdatedAt?: string;
  _syncedAt?: string;
}

export interface LocalTransaction {
  id: string;
  organizationId: string;
  propertyId: string;
  leaseId?: string | null;
  bailId?: string | null;
  categoryId?: string | null;
  label: string;
  amount: number;
  date: string;
  reference?: string | null;
  month?: number | null;
  year?: number | null;
  accounting_month?: string | null;
  isRecurring?: boolean | null;
  nature?: string | null;
  paidAt?: string | null;
  method?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  _localUpdatedAt?: string;
  _syncedAt?: string;
}

export interface LocalEcheanceRecurrente {
  id: string;
  organizationId: string;
  propertyId?: string | null;
  leaseId?: string | null;
  label: string;
  type: string;
  periodicite: string;
  montant: number;
  recuperable: boolean;
  sens: string;
  startAt: string;
  endAt?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _localUpdatedAt?: string;
  _syncedAt?: string;
}

export interface LocalDocument {
  id: string;
  organizationId: string;
  ownerId: string;
  bucketKey: string;
  filenameOriginal: string;
  filenameNormalized?: string | null;
  fileName: string;
  mime: string;
  size: number;
  url: string;
  previewUrl?: string | null;
  fileSha256?: string | null;
  textSha256?: string | null;
  simHash?: string | null;
  documentTypeId?: string | null;
  detectedTypeId?: string | null;
  typeConfidence?: number | null;
  typeAlternatives?: string | null;
  ocrStatus: string;
  ocrError?: string | null;
  ocrVendor?: string | null;
  ocrConfidence?: number | null;
  extractedText?: string | null;
  indexed: boolean;
  status: string;
  source: string;
  uploadedBy?: string | null;
  uploadedAt: string;
  tagsJson?: string | null;
  tags?: string | null;
  metadata?: string | null;
  linkedTo?: string | null;
  linkedId?: string | null;
  uploadSessionId?: string | null;
  intendedContextType?: string | null;
  intendedContextTempKey?: string | null;
  propertyId?: string | null;
  transactionId?: string | null;
  leaseId?: string | null;
  loanId?: string | null;
  tenantId?: string | null;
  version: number;
  replacesDocumentId?: string | null;
  deletedAt?: string | null;
  deletedBy?: string | null;
  createdAt: string;
  updatedAt: string;
  userReason?: string | null;
  _localUpdatedAt?: string;
  _syncedAt?: string;
}

export interface LocalPhoto {
  id: string;
  organizationId: string;
  fileName: string;
  mime: string;
  url: string;
  size: number;
  propertyId: string;
  room?: string | null;
  tag?: string | null;
  metadata?: string | null;
  createdAt: string;
  updatedAt: string;
  _localUpdatedAt?: string;
  _syncedAt?: string;
}

export interface LocalLoanBorrower {
  id: string;
  loanId: string;
  organizationId: string;
  firstName: string;
  lastName: string;
  birthDate?: string | null;
  email?: string | null;
  phone?: string | null;
  responsibilityPct?: number | null;
  createdAt: string;
  updatedAt: string;
  _localUpdatedAt?: string;
  _syncedAt?: string;
}

export interface LocalOccupancyHistory {
  id: string;
  propertyId: string;
  tenantId: string;
  leaseId?: string | null;
  startDate: string;
  endDate?: string | null;
  monthlyRent: number;
  createdAt: string;
  updatedAt: string;
  _localUpdatedAt?: string;
  _syncedAt?: string;
}

export interface LocalRentIndexation {
  id: string;
  leaseId: string;
  organizationId: string;
  previousRentAmount: number;
  newRentAmount: number;
  effectiveDate: string;
  indexType?: string | null;
  indexValue?: number | null;
  indexDate?: string | null;
  reason?: string | null;
  notes?: string | null;
  createdAt: string;
  createdBy?: string | null;
  _localUpdatedAt?: string;
  _syncedAt?: string;
}

export class SmartimmoLocalDB extends Dexie {
  // Tables de données
  properties!: Table<LocalProperty, string>;
  
  // Tables de métadonnées
  pendingOperations!: Table<PendingOperation, string>;
  syncMeta!: Table<SyncMeta, string>;
  
  // Tables de données de référence (cache)
  fiscalTypes!: Table<CachedFiscalType, string>;
  fiscalRegimes!: Table<CachedFiscalRegime, string>;
  managementCompanies!: Table<CachedManagementCompany, string>;
  natures!: Table<CachedNature, string>;
  accountingCategories!: Table<CachedAccountingCategory, string>;
  documentTypes!: Table<CachedDocumentType, string>;
  signals!: Table<CachedSignal, string>;
  fiscalCompatibilities!: Table<CachedFiscalCompatibility, string>;
  
  // Tables de données métier (offline-first)
  leases!: Table<LocalLease, string>;
  tenants!: Table<LocalTenant, string>;
  loans!: Table<LocalLoan, string>;
  payments!: Table<LocalPayment, string>;
  transactions!: Table<LocalTransaction, string>;
  echeances!: Table<LocalEcheanceRecurrente, string>;
  documents!: Table<LocalDocument, string>;
  photos!: Table<LocalPhoto, string>;
  loanBorrowers!: Table<LocalLoanBorrower, string>;
  occupancyHistory!: Table<LocalOccupancyHistory, string>;
  rentIndexations!: Table<LocalRentIndexation, string>;

  constructor() {
    super('SmartimmoLocalDB');
    
    // Version 1: Schéma initial
    this.version(1).stores({
      properties: 'id, organizationId, updatedAt, isArchived',
      pendingOperations: 'id, entity, entityId, status, createdAt',
      syncMeta: 'table',
    });
    
    // Version 2: Ajouter des index pour améliorer les performances
    this.version(2).stores({
      properties: 'id, organizationId, updatedAt, isArchived, [organizationId+isArchived]',
      pendingOperations: 'id, entity, entityId, status, createdAt, [entity+status], [status+createdAt]',
      syncMeta: 'table',
    }).upgrade(async (tx) => {
      // Migration: s'assurer que toutes les propriétés ont un updatedAt valide
      const properties = await tx.table('properties').toArray();
      const now = new Date().toISOString();
      for (const prop of properties) {
        if (!prop.updatedAt) {
          await tx.table('properties').update(prop.id, { updatedAt: now });
        }
      }
    });
    
    // Version 3: Ajouter les tables de cache pour les données de référence
    this.version(3).stores({
      properties: 'id, organizationId, updatedAt, isArchived, [organizationId+isArchived]',
      pendingOperations: 'id, entity, entityId, status, createdAt, [entity+status], [status+createdAt]',
      syncMeta: 'table',
      fiscalTypes: 'id, isActive, cachedAt',
      fiscalRegimes: 'id, isActive, cachedAt',
      managementCompanies: 'id, actif, cachedAt',
    });
    
    // Version 4: Ajouter toutes les autres données de référence admin
    this.version(4).stores({
      properties: 'id, organizationId, updatedAt, isArchived, [organizationId+isArchived]',
      pendingOperations: 'id, entity, entityId, status, createdAt, [entity+status], [status+createdAt]',
      syncMeta: 'table',
      fiscalTypes: 'id, isActive, cachedAt',
      fiscalRegimes: 'id, isActive, cachedAt',
      managementCompanies: 'id, actif, cachedAt',
      natures: 'key, active, cachedAt',
      accountingCategories: 'id, type, actif, cachedAt',
      documentTypes: 'id, code, isActive, cachedAt',
      signals: 'id, code, isActive, cachedAt',
      fiscalCompatibilities: 'id, scope, cachedAt',
    });
    
    // Version 5: Ajouter toutes les tables métier pour offline-first
    this.version(5).stores({
      properties: 'id, organizationId, updatedAt, isArchived, [organizationId+isArchived]',
      pendingOperations: 'id, entity, entityId, status, createdAt, [entity+status], [status+createdAt]',
      syncMeta: 'table',
      fiscalTypes: 'id, isActive, cachedAt',
      fiscalRegimes: 'id, isActive, cachedAt',
      managementCompanies: 'id, actif, cachedAt',
      natures: 'key, active, cachedAt',
      accountingCategories: 'id, type, actif, cachedAt',
      documentTypes: 'id, code, isActive, cachedAt',
      signals: 'id, code, isActive, cachedAt',
      fiscalCompatibilities: 'id, scope, cachedAt',
      // Tables métier
      leases: 'id, organizationId, propertyId, tenantId, updatedAt, status, [organizationId+status]',
      tenants: 'id, organizationId, email, status, updatedAt, [organizationId+status]',
      loans: 'id, organizationId, propertyId, isActive, updatedAt, [organizationId+isActive]',
      payments: 'id, organizationId, propertyId, leaseId, date, updatedAt, [organizationId+propertyId]',
      transactions: 'id, organizationId, propertyId, leaseId, date, updatedAt, [organizationId+propertyId]',
      echeances: 'id, organizationId, propertyId, leaseId, isActive, updatedAt, [organizationId+isActive]',
    });
    
    // Version 6: Ajouter toutes les tables manquantes avec _syncedAt uniforme
    this.version(6).stores({
      properties: 'id, organizationId, updatedAt, isArchived, [organizationId+isArchived]',
      pendingOperations: 'id, entity, entityId, status, createdAt, [entity+status], [status+createdAt]',
      syncMeta: 'table',
      fiscalTypes: 'id, isActive, cachedAt',
      fiscalRegimes: 'id, isActive, cachedAt',
      managementCompanies: 'id, actif, cachedAt',
      natures: 'key, active, cachedAt',
      accountingCategories: 'id, type, actif, cachedAt',
      documentTypes: 'id, code, isActive, cachedAt',
      signals: 'id, code, isActive, cachedAt',
      fiscalCompatibilities: 'id, scope, cachedAt',
      // Tables métier existantes
      leases: 'id, organizationId, propertyId, tenantId, updatedAt, status, [organizationId+status]',
      tenants: 'id, organizationId, email, status, updatedAt, [organizationId+status]',
      loans: 'id, organizationId, propertyId, isActive, updatedAt, [organizationId+isActive]',
      payments: 'id, organizationId, propertyId, leaseId, date, updatedAt, [organizationId+propertyId]',
      transactions: 'id, organizationId, propertyId, leaseId, date, updatedAt, [organizationId+propertyId]',
      echeances: 'id, organizationId, propertyId, leaseId, isActive, updatedAt, [organizationId+isActive]',
      // Nouvelles tables métier
      documents: 'id, organizationId, propertyId, leaseId, tenantId, transactionId, loanId, updatedAt, deletedAt, [organizationId+deletedAt]',
      photos: 'id, organizationId, propertyId, updatedAt, [organizationId+propertyId]',
      loanBorrowers: 'id, loanId, organizationId, updatedAt, [organizationId+loanId]',
      occupancyHistory: 'id, propertyId, tenantId, leaseId, startDate, updatedAt, [propertyId+tenantId]',
      rentIndexations: 'id, leaseId, organizationId, effectiveDate, updatedAt, [organizationId+leaseId]',
    }).upgrade(async (tx) => {
      // Migration: Ajouter _syncedAt à properties si absent (uniformiser avec les autres tables)
      const properties = await tx.table('properties').toArray();
      for (const prop of properties) {
        if (!('_syncedAt' in prop)) {
          await tx.table('properties').update(prop.id, { 
            _syncedAt: prop.updatedAt || new Date().toISOString(),
            _localUpdatedAt: undefined,
          });
        }
      }
    });
  }
}

// Instance singleton
let dbInstance: SmartimmoLocalDB | null = null;

export function getLocalDB(): SmartimmoLocalDB {
  if (typeof window === 'undefined') {
    throw new Error('LocalDB ne peut être utilisé que côté client');
  }
  
  if (!dbInstance) {
    dbInstance = new SmartimmoLocalDB();
  }
  
  return dbInstance;
}

// Helper pour vérifier si IndexedDB est disponible
export function isIndexedDBAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  
  try {
    return 'indexedDB' in window && indexedDB !== null;
  } catch {
    return false;
  }
}





