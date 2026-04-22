/**
 * Base de données locale IndexedDB via Dexie
 * Gère le stockage offline des données et les opérations en attente de synchronisation
 * 
 * ⚠️ CRITIQUE: Dexie est importé dynamiquement pour éviter les problèmes d'ordre d'import avec fake-indexeddb
 * - Dexie accède à indexedDB.prototype dans Version.stores (ligne 58)
 * - ET dans idbReady() qui utilise la référence GLOBALE indexedDB (ligne 3716)
 * - On doit ajouter prototype sur indexedDB ET sur globalThis.indexedDB AVANT d'importer Dexie
 */

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
  organizationId: string;
  nom: string;
  contact?: string | null;
  email?: string | null;
  telephone?: string | null;
  modeCalcul: string; // 'LOYERS_UNIQUEMENT' | 'REVENUS_TOTAUX'
  taux: number;
  fraisMin?: number | null;
  baseSurEncaissement: boolean;
  tvaApplicable: boolean;
  tauxTva?: number | null;
  actif: boolean;
  createdAt?: string;
  updatedAt?: string;
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

export interface CachedCategory {
  id: string;
  slug: string;
  label: string;
  type: string;
  fiscalLineHint?: string | null;
  deductible?: boolean | null;
  capitalizable?: boolean | null;
  system?: boolean | null;
  actif: boolean;
  cachedAt: string;
}

export interface CachedDocumentType {
  id: string;
  code: string;
  label: string;
  category?: string | null;
  isActive: boolean;
  openTransaction?: boolean; // ✅ Ajouter le champ openTransaction
  cachedAt: string;
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
  pilotageIgnored?: boolean | null;
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
  source?: string | null;
  idempotencyKey?: string | null;
  externalId?: string | null;
  externalType?: string | null;
  monthsCovered?: string | null;
  parentTransactionId?: string | null;
  moisIndex?: number | null;
  moisTotal?: number | null;
  rapprochementStatus?: string | null;
  dateRapprochement?: string | null;
  bankRef?: string | null;
  montantLoyer?: number | null;
  chargesRecup?: number | null;
  chargesNonRecup?: number | null;
  isAutoAmount?: boolean | null;
  managementCompanyId?: string | null;
  isAuto?: boolean | null;
  autoSource?: string | null;
  createdAt: string;
  updatedAt: string;
  _localUpdatedAt?: string;
  _syncedAt?: string;
  // ⚠️ FIX ROBUSTE : serverId stocké pour résolution just-in-time des DocumentLinks
  // Quand une transaction locale (UUID) est créée côté serveur (cuid), on stocke le cuid ici
  serverId?: string | null;
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
  natureCode?: string | null;
  defaultCategoryId?: string | null;
  createdAt: string;
  updatedAt: string;
  _localUpdatedAt?: string;
  _syncedAt?: string;
}

/** Liaison échéance (projection) ↔ transaction (réalisation) */
export interface LocalEcheanceTransactionLink {
  id: string;
  organizationId: string;
  echeanceId: string;
  transactionId: string;
  matchType: string;
  confidenceScore?: number | null;
  occurrenceDate?: string | null;
  createdAt: string;
  updatedAt: string;
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
  isFavorite?: boolean;
  _localUpdatedAt?: string;
  _syncedAt?: string;
  // ⚠️ GARDE-FOU : Flag pour indiquer qu'un document existe déjà côté serveur (upload via API)
  // Les documents avec _remoteReady=true ne doivent JAMAIS être purgés comme brouillons orphelins
  _remoteReady?: boolean;
}

export interface LocalDocumentLink {
  documentId: string;
  linkedType: string;
  linkedId: string;
  entityName?: string | null;
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

export interface LocalFiscalSimulation {
  id: string;
  organizationId: string;
  userId: string;
  name?: string | null;
  year: number;
  fiscalVersionId?: string | null;
  inputsJson: string;
  resultJson: string;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
  _syncedAt?: string;
}

/**
 * État de l'application stocké localement (app-shell context)
 * Permet de stocker le contexte de session (organizationId, userId, etc.) de manière déterministe
 */
export interface AppState {
  id: string; // Toujours 'current' (singleton)
  currentOrganizationId?: string | null;
  userId?: string | null;
  sessionId?: string | null;
  updatedAt: string; // ISO string
}

/** Cache des données agrégées fiscales (réponse /api/fiscal/aggregate) - offline-first */
export interface FiscalAggregateCache {
  id: string; // `${organizationId}:${year}:${baseCalcul}`
  organizationId: string;
  year: number;
  baseCalcul: string;
  payload: string; // JSON stringified { biens, totaux, year }
  updatedAt: string;
  source: 'server';
}

/** Cache local de la session fiscale (déclaration / barème) pour offline */
export interface FiscalSessionCache {
  organizationId: string;
  declarationYear: number;
  incomeYear: number;
  baremeCode: string;
  updatedAt: string;
}

export interface LocalUserProfile {
  id: string;
  organizationId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  postalCode?: string | null;
  company?: string | null;
  siret?: string | null;
  signature?: string | null;
  logo?: string | null;
  createdAt: string;
  updatedAt: string;
  _localUpdatedAt?: string;
  _syncedAt?: string;
}

// Type pour Table (sera importé dynamiquement avec Dexie)
type Table<T, TKey> = any;

// Instance singleton - lazy initialization pour éviter l'instanciation au top-level
let dbInstance: any | null = null;
let SmartimmoLocalDBClass: any | null = null;

// ⚠️ CRITIQUE: Garde anti-boucle pour éviter les appels multiples simultanés
let dbOpenInProgress = false;
let dbOpenPromise: Promise<any> | null = null;
let dbStatus: 'OK' | 'RECOVERED' | 'UNAVAILABLE' = 'OK';

/**
 * Obtient l'instance singleton de SmartimmoLocalDB.
 * 
 * ⚠️ IMPORTANT: Cette fonction utilise une instanciation lazy pour garantir que:
 * - indexedDB est disponible avant l'instanciation de Dexie
 * - Dexie est importé dynamiquement (await import('dexie')) APRÈS vérification d'indexedDB
 * - Les dépendances sont injectées immédiatement après l'import, avant toute utilisation
 * - Aucune instanciation n'a lieu au top-level du module (évite les problèmes d'ordre d'import)
 * 
 * @throws Error si appelé côté serveur (pas de window/globalThis)
 */
export async function getLocalDB(): Promise<any> {
  // ⚠️ CRITIQUE: Vérifier que nous sommes dans un environnement client
  if (typeof window === 'undefined') {
    throw new Error('LocalDB ne peut être utilisé que côté client (window is undefined)');
  }
  
  // Flag pour l'instrumentation (test uniquement)
  const isTest = process.env.VITEST === 'true' || process.env.NODE_ENV === 'test' || process.env.DEBUG_DEXIE_TEST === '1';
  
  // ⚠️ Instanciation lazy: créer l'instance uniquement à la première utilisation
  if (!dbInstance) {
    // ÉTAPE 0: En test, initialiser fake-indexeddb si nécessaire AVANT toute vérification
    // ⚠️ CRITIQUE: Cette initialisation doit se faire AVANT l'import Dexie pour garantir l'ordre
    if (isTest) {
      const indexedDBBeforeInit = 
        (typeof globalThis !== 'undefined' && (globalThis as any).indexedDB) ||
        (typeof window !== 'undefined' && (window as any).indexedDB);
      
      if (isTest && process.env.DEBUG_DEXIE_TEST === '1') {
        console.log('[DEXIE-INSTRUMENTATION] AVANT init fake-indexeddb:', {
          hasGlobalIndexedDB: !!indexedDBBeforeInit,
          typeofIndexedDB: typeof indexedDBBeforeInit,
          hasPrototype: indexedDBBeforeInit ? 'prototype' in indexedDBBeforeInit : false,
        });
      }
      
      // Si indexedDB n'existe pas ou n'a pas de prototype, initialiser fake-indexeddb
      if (!indexedDBBeforeInit || (indexedDBBeforeInit && typeof indexedDBBeforeInit === 'object' && !('prototype' in indexedDBBeforeInit))) {
        try {
          // Import dynamique de fake-indexeddb pour garantir l'initialisation
          await import('fake-indexeddb/auto');
          
          if (isTest && process.env.DEBUG_DEXIE_TEST === '1') {
            console.log('[DEXIE-INSTRUMENTATION] fake-indexeddb/auto importé');
          }
        } catch (e) {
          if (isTest) {
            console.warn('[DEXIE-INSTRUMENTATION] Impossible d\'importer fake-indexeddb/auto:', e);
          }
        }
      }
    }
    
    // ÉTAPE 1: Vérifier que indexedDB est disponible
    let indexedDB = 
      (typeof globalThis !== 'undefined' && (globalThis as any).indexedDB) ||
      (typeof window !== 'undefined' && (window as any).indexedDB);
    
    if (!indexedDB) {
      // En test, essayer d'initialiser fake-indexeddb une dernière fois
      if (isTest) {
        try {
          await import('fake-indexeddb/auto');
          indexedDB = 
            (typeof globalThis !== 'undefined' && (globalThis as any).indexedDB) ||
            (typeof window !== 'undefined' && (window as any).indexedDB);
        } catch (e) {
          // Ignorer
        }
      }
      
      if (!indexedDB) {
        throw new Error(
          'IndexedDB non disponible. ' +
          'En test, vérifier que fake-indexeddb/auto est importé EN PREMIER dans le fichier de test'
        );
      }
    }
    
    // Instrumentation: logger l'état AVANT import Dexie
    if (isTest && process.env.DEBUG_DEXIE_TEST === '1') {
      console.log('[DEXIE-INSTRUMENTATION] AVANT import Dexie:', {
        hasIndexedDB: !!indexedDB,
        typeofIndexedDB: typeof indexedDB,
        hasPrototype: indexedDB ? 'prototype' in indexedDB : false,
        prototypeValue: indexedDB && 'prototype' in indexedDB ? indexedDB.prototype : undefined,
        globalThisIndexedDB: typeof globalThis !== 'undefined' ? !!(globalThis as any).indexedDB : false,
        windowIndexedDB: typeof window !== 'undefined' ? !!window.indexedDB : false,
      });
    }
    
    // Récupérer IDBKeyRange aussi
    const IDBKeyRange = 
      (typeof globalThis !== 'undefined' && (globalThis as any).IDBKeyRange) ||
      (typeof window !== 'undefined' && (window as any).IDBKeyRange);
    
    // ÉTAPE 2: Ajouter prototype à indexedDB si absent (fake-indexeddb n'en a pas)
    // ⚠️ CRITIQUE: Dexie accède à indexedDB.prototype dans Version.stores (ligne 58)
    // ET dans idbReady() qui utilise la référence GLOBALE indexedDB (ligne 3716)
    // On doit ajouter prototype sur indexedDB ET sur globalThis.indexedDB AVANT d'importer Dexie
    let indexedDBToInject = indexedDB;
    if (indexedDB && typeof indexedDB === 'object' && !('prototype' in indexedDB)) {
      try {
        Object.defineProperty(indexedDB, 'prototype', {
          value: {},
          writable: true,
          enumerable: true,
          configurable: true,
        });
        indexedDBToInject = indexedDB;
        
        if (isTest && process.env.DEBUG_DEXIE_TEST === '1') {
          console.log('[DEXIE-INSTRUMENTATION] ✅ Prototype ajouté directement sur indexedDB original');
        }
      } catch (e) {
        // Si on ne peut pas modifier directement, utiliser un wrapper
        indexedDBToInject = Object.create(indexedDB, {
          prototype: {
            value: {},
            writable: true,
            enumerable: true,
            configurable: true,
          },
        });
        
        // Copier toutes les propriétés
        for (const key in indexedDB) {
          if (Object.prototype.hasOwnProperty.call(indexedDB, key)) {
            try {
              (indexedDBToInject as any)[key] = (indexedDB as any)[key];
            } catch (e) {
              // Ignorer les propriétés non configurables
            }
          }
        }
        
        if (isTest && process.env.DEBUG_DEXIE_TEST === '1') {
          console.log('[DEXIE-INSTRUMENTATION] ⚠️ Wrapper créé (fallback)');
        }
      }
      
      // ⚠️ IMPORTANT: Ne pas essayer d'assigner à window.indexedDB ou globalThis.indexedDB
      // car ces propriétés sont en lecture seule dans le navigateur (getter only)
      // On se contente d'utiliser Dexie.dependencies pour injecter indexedDB
    }
    
    // Assert explicite: indexedDB doit avoir un prototype AVANT l'import Dexie
    if (!indexedDBToInject || !('prototype' in indexedDBToInject) || !indexedDBToInject.prototype) {
      throw new Error(
        '[HARD ASSERT] indexedDB invalide AVANT import Dexie. ' +
        `indexedDB: ${!!indexedDBToInject}, has prototype: ${indexedDBToInject ? 'prototype' in indexedDBToInject : false}, ` +
        `prototype value: ${indexedDBToInject?.prototype ? 'OK' : 'UNDEFINED'}`
      );
    }
    
    // ⚠️ IMPORTANT: Ne pas essayer d'assigner à window.indexedDB ou globalThis.indexedDB
    // car ces propriétés sont en lecture seule dans le navigateur (getter only)
    // Dexie utilisera Dexie.dependencies.indexedDB qui sera configuré après l'import
    
    // ÉTAPE 3: Importer Dexie dynamiquement (IMPORT DYNAMIQUE DIRECT)
    // ⚠️ CRITIQUE: Cet import dynamique se fait APRÈS vérification d'indexedDB ET ajout de prototype
    // ET après avoir forcé toutes les références globales
    // Cela garantit que fake-indexeddb est prêt et que indexedDB a un prototype avant que Dexie ne soit évalué
    const DexieModule = await import('dexie');
    const Dexie = DexieModule.default;
    
    // Instrumentation: logger l'état APRÈS import Dexie et détecter la vraie référence utilisée
    if (isTest && process.env.DEBUG_DEXIE_TEST === '1') {
      // Détecter TOUTES les références globales possibles (dans l'ordre de priorité de Dexie)
      const globalRefs = {
        globalThis: typeof globalThis !== 'undefined' ? (globalThis as any).indexedDB : undefined,
        self: typeof self !== 'undefined' ? (self as any).indexedDB : undefined,
        window: typeof window !== 'undefined' ? (window as any).indexedDB : undefined,
        global: typeof global !== 'undefined' ? (global as any).indexedDB : undefined,
      };
      
      // Déterminer quelle référence Dexie utilisera pour _global
      const _globalRef = typeof globalThis !== 'undefined' ? globalRefs.globalThis :
                        typeof self !== 'undefined' ? globalRefs.self :
                        typeof window !== 'undefined' ? globalRefs.window :
                        globalRefs.global;
      const _globalName = typeof globalThis !== 'undefined' ? 'globalThis' :
                         typeof self !== 'undefined' ? 'self' :
                         typeof window !== 'undefined' ? 'window' : 'global';
      
      console.log('[DEXIE-INSTRUMENTATION] APRÈS import Dexie:', {
        hasDexie: !!Dexie,
        hasDexieDependencies: !!Dexie.dependencies,
        dexieDependenciesIndexedDB: !!Dexie.dependencies?.indexedDB,
        dexieDependenciesHasPrototype: Dexie.dependencies?.indexedDB ? 'prototype' in Dexie.dependencies.indexedDB : false,
        dexieDependenciesIndexedDBTypeof: typeof Dexie.dependencies?.indexedDB,
        // Référence que Dexie utilisera pour _global (selon l'ordre de priorité)
        _globalWillUse: _globalName,
        _globalRef: {
          exists: !!_globalRef,
          typeof: typeof _globalRef,
          hasPrototype: _globalRef ? 'prototype' in _globalRef : false,
          sameAsInjected: _globalRef === indexedDBToInject,
        },
        // Références globales (dans l'ordre de priorité Dexie)
        globalRefs: {
          globalThis: {
            exists: !!globalRefs.globalThis,
            typeof: typeof globalRefs.globalThis,
            hasPrototype: globalRefs.globalThis ? 'prototype' in globalRefs.globalThis : false,
            sameAsInjected: globalRefs.globalThis === indexedDBToInject,
          },
          self: {
            exists: !!globalRefs.self,
            typeof: typeof globalRefs.self,
            hasPrototype: globalRefs.self ? 'prototype' in globalRefs.self : false,
            sameAsInjected: globalRefs.self === indexedDBToInject,
          },
          window: {
            exists: !!globalRefs.window,
            typeof: typeof globalRefs.window,
            hasPrototype: globalRefs.window ? 'prototype' in globalRefs.window : false,
            sameAsInjected: globalRefs.window === indexedDBToInject,
          },
          global: {
            exists: !!globalRefs.global,
            typeof: typeof globalRefs.global,
            hasPrototype: globalRefs.global ? 'prototype' in globalRefs.global : false,
            sameAsInjected: globalRefs.global === indexedDBToInject,
          },
        },
        // Vérifier si Dexie.dependencies.indexedDB correspond à _global ou à notre injection
        dexieMatches_global: Dexie.dependencies?.indexedDB === _globalRef,
        dexieMatchesInjected: Dexie.dependencies?.indexedDB === indexedDBToInject,
      });
      
      // ⚠️ IMPORTANT: Ne pas essayer d'assigner à window.indexedDB ou globalThis.indexedDB
      // car ces propriétés sont en lecture seule dans le navigateur (getter only)
      // On se contente de vérifier que Dexie.dependencies.indexedDB est correctement configuré
    }
    
    // ÉTAPE 4: Injecter les dépendances dans Dexie.dependencies AVANT toute instanciation Dexie
    // ⚠️ CRITIQUE: Cette configuration est utilisée par getDbNamesTable qui crée des Dexie internes
    // ET par idbReady() qui utilise globalThis.indexedDB
    // MAIS: domDeps est initialisé au moment de l'évaluation du module Dexie (lignes 5014-5023)
    // et utilise _global.indexedDB. Si _global.indexedDB n'a pas de prototype à ce moment-là,
    // domDeps.indexedDB n'aura pas de prototype, et Dexie.dependencies sera initialisé avec domDeps
    // (ligne 5102). Il faut donc FORCER Dexie.dependencies APRÈS l'import pour écraser domDeps.
    Dexie.dependencies = {
      indexedDB: indexedDBToInject,
      IDBKeyRange: IDBKeyRange || undefined,
    };
    
    // ⚠️ IMPORTANT: Ne pas essayer d'assigner à window.indexedDB ou globalThis.indexedDB
    // car ces propriétés sont en lecture seule dans le navigateur (getter only)
    // Pour les tests Node.js uniquement, on peut essayer d'assigner à global.indexedDB
    // mais avec un try-catch pour éviter les erreurs si la propriété est en lecture seule
    if (isTest && typeof global !== 'undefined') {
      try {
        (global as any).indexedDB = indexedDBToInject;
      } catch (e) {
        // Ignorer si la propriété est en lecture seule (c'est OK, Dexie.dependencies suffit)
      }
    }
    
    // ⚠️ CRITIQUE: Vérifier que Dexie.dependencies.indexedDB a bien été écrasé (pas domDeps)
    // et qu'il a un prototype. Si ce n'est pas le cas, forcer à nouveau.
    // Note: domDeps est initialisé au moment de l'évaluation du module Dexie (lignes 5014-5023)
    // et utilise _global.indexedDB. Si _global.indexedDB n'a pas de prototype à ce moment-là,
    // domDeps.indexedDB n'aura pas de prototype, et Dexie.dependencies sera initialisé avec domDeps
    // (ligne 5102). Il faut donc FORCER Dexie.dependencies APRÈS l'import pour écraser domDeps.
    if (!Dexie.dependencies?.indexedDB || !('prototype' in Dexie.dependencies.indexedDB) || !Dexie.dependencies.indexedDB.prototype) {
      if (isTest && process.env.DEBUG_DEXIE_TEST === '1') {
        console.warn('[db.ts] ⚠️ Dexie.dependencies.indexedDB invalide après injection:', {
          hasIndexedDB: !!Dexie.dependencies?.indexedDB,
          hasPrototype: Dexie.dependencies?.indexedDB ? 'prototype' in Dexie.dependencies.indexedDB : false,
          prototypeValue: Dexie.dependencies?.indexedDB && 'prototype' in Dexie.dependencies.indexedDB ? Dexie.dependencies.indexedDB.prototype : undefined,
          indexedDBToInject: !!indexedDBToInject,
          indexedDBToInjectHasPrototype: indexedDBToInject ? 'prototype' in indexedDBToInject : false,
        });
      }
      Dexie.dependencies.indexedDB = indexedDBToInject;
      Dexie.dependencies.IDBKeyRange = IDBKeyRange || undefined;
    }
    
    // ⚠️ PATCH TEMPORAIRE: Détecter la vraie référence utilisée par Dexie au moment du crash
    // En test, on va patcher temporairement idbReady() pour qu'il utilise notre indexedDB
    if (isTest) {
      // idbReady() utilise directement `indexedDB` (ligne 3716), pas `_global.indexedDB`
      // On doit s'assurer que cette référence globale existe
      // En Node.js, on assigne à `global.indexedDB` qui sera accessible comme variable globale
      // Mais idbReady() est défini dans une closure qui capture `indexedDB` depuis le scope global
      // au moment de l'évaluation du module Dexie. Si à ce moment-là `indexedDB` n'existe pas,
      // idbReady() va échouer. On ne peut pas corriger ça après coup, mais on peut s'assurer
      // que `global.indexedDB` existe AVANT l'import Dexie (fait dans setup.ts).
      
      // Vérifier que la référence globale `indexedDB` existe (pour idbReady())
      // En Node.js, `indexedDB` n'existe pas par défaut, donc on doit l'assigner à `global.indexedDB`
      // Mais idbReady() utilise directement `indexedDB`, pas `global.indexedDB`
      // On ne peut pas créer de vraie variable globale avec `var indexedDB` dans un module ESM
      // Donc on doit utiliser un autre mécanisme
      
      // Patch temporaire: vérifier que toutes les références sont OK
      // ⚠️ IMPORTANT: Ne pas lire window.indexedDB ou globalThis.indexedDB directement
      // car ces propriétés sont en lecture seule dans le navigateur (getter only)
      // On se contente de vérifier Dexie.dependencies.indexedDB
      const allRefs = {
        globalThis: undefined, // Ne pas lire window.indexedDB (getter only, peut causer des erreurs)
        global: (() => {
          // Lire global.indexedDB uniquement en test et avec protection
          if (isTest && typeof global !== 'undefined') {
            try {
              return (global as any).indexedDB;
            } catch {
              return undefined;
            }
          }
          return undefined;
        })(),
        dexieDeps: Dexie.dependencies?.indexedDB,
      };
      
      if (process.env.DEBUG_DEXIE_TEST === '1') {
        console.log('[db.ts] PATCH TEMPORAIRE - Références indexedDB:', {
          globalThis: {
            exists: !!allRefs.globalThis,
            hasPrototype: allRefs.globalThis ? 'prototype' in allRefs.globalThis : false,
            sameAsInjected: allRefs.globalThis === indexedDBToInject,
          },
          global: {
            exists: !!allRefs.global,
            hasPrototype: allRefs.global ? 'prototype' in allRefs.global : false,
            sameAsInjected: allRefs.global === indexedDBToInject,
          },
          dexieDeps: {
            exists: !!allRefs.dexieDeps,
            hasPrototype: allRefs.dexieDeps ? 'prototype' in allRefs.dexieDeps : false,
            sameAsInjected: allRefs.dexieDeps === indexedDBToInject,
          },
        });
      }
    }
    
    // Vérifier que la configuration a bien pris
    if (!Dexie.dependencies?.indexedDB || !('prototype' in Dexie.dependencies.indexedDB)) {
      throw new Error(
        '[HARD ASSERT] Dexie.dependencies.indexedDB invalide. ' +
        'indexedDB doit avoir un prototype valide pour Dexie.'
      );
    }
    
    // ⚠️ IMPORTANT: Ne pas essayer d'assigner à window.indexedDB ou globalThis.indexedDB
    // car ces propriétés sont en lecture seule dans le navigateur (getter only)
    // Dexie utilisera Dexie.dependencies.indexedDB qui est correctement configuré ci-dessus
    // On vérifie uniquement que Dexie.dependencies.indexedDB est valide (déjà fait plus haut)
    
    // ÉTAPE 5: Créer la classe SmartimmoLocalDB dynamiquement (après l'import de Dexie)
    if (!SmartimmoLocalDBClass) {
      SmartimmoLocalDBClass = class extends Dexie {
  // Tables de données
  Property!: Table<LocalProperty, string>;
  
  // Tables de métadonnées
  pendingOperations!: Table<PendingOperation, string>;
  syncMeta!: Table<SyncMeta, string>;
  AppState!: Table<AppState, string>;
  
  // Tables de données de référence (cache) - Noms Supabase
  FiscalType!: Table<CachedFiscalType, string>;
  FiscalRegime!: Table<CachedFiscalRegime, string>;
  ManagementCompany!: Table<CachedManagementCompany, string>;
  NatureEntity!: Table<CachedNature, string>;
  Category!: Table<CachedCategory, string>;
  DocumentType!: Table<CachedDocumentType, string>;
  Signal!: Table<CachedSignal, string>;
  FiscalCompatibility!: Table<CachedFiscalCompatibility, string>;
  
  // Tables de données métier (offline-first) - Noms Supabase
  Lease!: Table<LocalLease, string>;
  Tenant!: Table<LocalTenant, string>;
  Loan!: Table<LocalLoan, string>;
  Transaction!: Table<LocalTransaction, string>;
  EcheanceRecurrente!: Table<LocalEcheanceRecurrente, string>;
  EcheanceTransactionLink!: Table<LocalEcheanceTransactionLink, string>;
  Document!: Table<LocalDocument, string>;
        DocumentLink!: Table<LocalDocumentLink, [string, string, string]>;
  Photo!: Table<LocalPhoto, string>;
  LoanBorrower!: Table<LocalLoanBorrower, string>;
  OccupancyHistory!: Table<LocalOccupancyHistory, string>;
  RentIndexation!: Table<LocalRentIndexation, string>;
  FiscalSimulation!: Table<LocalFiscalSimulation, string>;
  UserProfile!: Table<LocalUserProfile, string>;
  FiscalAggregateCache!: Table<FiscalAggregateCache, string>;
  FiscalSessionCache!: Table<FiscalSessionCache, string>;

  constructor() {
          // ⚠️ CRITIQUE: Passer explicitement indexedDB et IDBKeyRange au constructeur Dexie
          // pour garantir que db._deps.indexedDB utilise le wrapper avec prototype
          const indexedDBForConstructor = Dexie.dependencies?.indexedDB;
          const IDBKeyRangeForConstructor = Dexie.dependencies?.IDBKeyRange;
          
          if (!indexedDBForConstructor || !('prototype' in indexedDBForConstructor) || !indexedDBForConstructor.prototype) {
            throw new Error(
              '[HARD ASSERT] indexedDB invalide dans constructeur. ' +
              `indexedDB: ${!!indexedDBForConstructor}, has prototype: ${indexedDBForConstructor ? 'prototype' in indexedDBForConstructor : false}, ` +
              `prototype value: ${indexedDBForConstructor?.prototype ? 'OK' : 'UNDEFINED'}`
            );
          }
          
          super('SmartimmoLocalDB', {
            indexedDB: indexedDBForConstructor,
            IDBKeyRange: IDBKeyRangeForConstructor || undefined,
          });
          
          // ⚠️ VALIDATION: Vérifier que db._deps.indexedDB a bien le prototype
          const dbDepsIndexedDB = (this as any)._deps?.indexedDB;
          if (!dbDepsIndexedDB || !('prototype' in dbDepsIndexedDB) || !dbDepsIndexedDB.prototype) {
            throw new Error(
              '[HARD ASSERT] db._deps.indexedDB invalide après super(). ' +
              `dbDepsIndexedDB: ${!!dbDepsIndexedDB}, has prototype: ${dbDepsIndexedDB ? 'prototype' in dbDepsIndexedDB : false}, ` +
              `prototype value: ${dbDepsIndexedDB?.prototype ? 'OK' : 'UNDEFINED'}`
            );
          }
          
          // Instrumentation: logger l'état AVANT this.version(1).stores()
          const isTestInConstructor = process.env.VITEST === 'true' || process.env.NODE_ENV === 'test' || process.env.DEBUG_DEXIE_TEST === '1';
          if (isTestInConstructor && process.env.DEBUG_DEXIE_TEST === '1') {
            console.log('[DEXIE-INSTRUMENTATION] AVANT this.version(1).stores():', {
              dbDepsIndexedDB: !!dbDepsIndexedDB,
              dbDepsHasPrototype: dbDepsIndexedDB ? 'prototype' in dbDepsIndexedDB : false,
              dbDepsPrototypeValue: dbDepsIndexedDB && 'prototype' in dbDepsIndexedDB ? dbDepsIndexedDB.prototype : undefined,
              dexieDependenciesIndexedDB: !!Dexie.dependencies?.indexedDB,
              dexieDependenciesHasPrototype: Dexie.dependencies?.indexedDB ? 'prototype' in Dexie.dependencies.indexedDB : false,
              globalThisIndexedDB: typeof globalThis !== 'undefined' ? !!(globalThis as any).indexedDB : false,
              globalThisHasPrototype: typeof globalThis !== 'undefined' && (globalThis as any).indexedDB ? 'prototype' in (globalThis as any).indexedDB : false,
            });
          }
          
          // ⚠️ CRITIQUE PATCH FINAL: Forcer toutes les références indexedDB AVANT stores()
          // Version.stores() peut déclencher getDbNamesTable() qui crée une instance Dexie interne
          // Cette instance doit utiliser la même référence indexedDB avec prototype
          // On force explicitement Dexie.dependencies et toutes les références globales juste avant stores()
          if (isTestInConstructor) {
            // Forcer Dexie.dependencies une dernière fois (au cas où getDbNamesTable serait appelé)
            const indexedDBForStores = Dexie.dependencies?.indexedDB || indexedDBForConstructor;
            if (indexedDBForStores && ('prototype' in indexedDBForStores) && indexedDBForStores.prototype) {
              Dexie.dependencies.indexedDB = indexedDBForStores;
              Dexie.dependencies.IDBKeyRange = IDBKeyRangeForConstructor || undefined;
            }
            
            // ⚠️ IMPORTANT: Ne pas essayer d'assigner à window.indexedDB ou globalThis.indexedDB
            // car ces propriétés sont en lecture seule dans le navigateur (getter only)
            // Dexie utilisera Dexie.dependencies.indexedDB qui est correctement configuré
            
            // ⚠️ CRITIQUE: En Node.js, créer une variable globale `indexedDB` accessible directement
            // Le problème est que `idbReady()` dans Dexie utilise directement `indexedDB` (pas `_global.indexedDB`)
            // Cette référence est capturée au moment de l'évaluation du module Dexie.
            // En Node.js, `indexedDB` n'existe pas comme variable globale par défaut, donc `idbReady()` capture `undefined`.
            // 
            // IMPORTANT: Le module Dexie est enveloppé dans une IIFE qui reçoit `this` comme `global`.
            // Dans Node.js, `this` dans un module ESM est `undefined`, donc `global` sera `globalThis` ou `global`.
            // Mais `idbReady()` utilise directement `indexedDB`, pas `_global.indexedDB`.
            // Cette référence est capturée au moment de l'évaluation du module Dexie.
            // Si à ce moment-là `indexedDB` n'existe pas, `idbReady()` va échouer.
            //
            // Solution: Utiliser `global.indexedDB` qui sera accessible comme variable globale en Node.js
            // et s'assurer que c'est fait AVANT tout import Dexie (déjà fait ici car setup.ts est exécuté en premier).
            //
            // Note: En Node.js, `global.indexedDB` est accessible comme variable globale dans certains contextes,
            // mais pas dans tous. On doit s'assurer que c'est accessible partout.
            //
            // ⚠️ CRITIQUE: En Node.js, on doit créer une variable globale `indexedDB` accessible directement
            // Le problème est que `idbReady()` capture `indexedDB` depuis le scope global au moment
            // de l'évaluation du module Dexie. Si `indexedDB` n'existe pas à ce moment-là, `idbReady()`
            // va échouer. On doit donc créer `global.indexedDB` AVANT l'import Dexie (déjà fait ici).
            //
            // En Node.js avec ESM, on ne peut pas créer de vraie variable globale avec `var indexedDB`
            // car les modules ESM ont leur propre scope. Cependant, on peut utiliser `global.indexedDB`
            // qui sera accessible comme variable globale dans le contexte Node.js.
            //
            // ⚠️ IMPORTANT: Pour les tests Node.js uniquement, on peut essayer d'assigner à global.indexedDB
            // mais avec un try-catch pour éviter les erreurs si la propriété est en lecture seule
            if (typeof global !== 'undefined') {
              try {
                if (!(global as any).indexedDB || (global as any).indexedDB !== indexedDBForStores) {
                  (global as any).indexedDB = indexedDBForStores;
                  if (process.env.DEBUG_DEXIE_TEST === '1') {
                    console.log('[db.ts] 🔧 global.indexedDB forcé AVANT stores()');
                  }
                }
              } catch (e) {
                // Ignorer si la propriété est en lecture seule (c'est OK, Dexie.dependencies suffit)
              }
            }
          }
    
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
      const properties = await tx.table('Property').toArray();
      const now = new Date().toISOString();
      for (const prop of properties) {
        if (!prop.updatedAt) {
          await tx.table('Property').update(prop.id, { updatedAt: now });
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
      categories: 'id, type, actif, cachedAt',
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
      categories: 'id, type, actif, cachedAt',
      documentTypes: 'id, code, isActive, cachedAt',
      signals: 'id, code, isActive, cachedAt',
      fiscalCompatibilities: 'id, scope, cachedAt',
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
      categories: 'id, type, actif, cachedAt',
      documentTypes: 'id, code, isActive, cachedAt',
      signals: 'id, code, isActive, cachedAt',
      fiscalCompatibilities: 'id, scope, cachedAt',
      leases: 'id, organizationId, propertyId, tenantId, updatedAt, status, [organizationId+status]',
      tenants: 'id, organizationId, email, status, updatedAt, [organizationId+status]',
      loans: 'id, organizationId, propertyId, isActive, updatedAt, [organizationId+isActive]',
      payments: 'id, organizationId, propertyId, leaseId, date, updatedAt, [organizationId+propertyId]',
      transactions: 'id, organizationId, propertyId, leaseId, date, updatedAt, [organizationId+propertyId]',
      echeances: 'id, organizationId, propertyId, leaseId, isActive, updatedAt, [organizationId+isActive]',
      documents: 'id, organizationId, propertyId, leaseId, tenantId, transactionId, loanId, updatedAt, deletedAt, [organizationId+deletedAt]',
      documentLinks: '[documentId+linkedType+linkedId], documentId, linkedType, linkedId, [linkedType+linkedId]',
      photos: 'id, organizationId, propertyId, updatedAt, [organizationId+propertyId]',
      loanBorrowers: 'id, loanId, organizationId, updatedAt, [organizationId+loanId]',
      occupancyHistory: 'id, propertyId, tenantId, leaseId, startDate, updatedAt, [propertyId+tenantId]',
      rentIndexations: 'id, leaseId, organizationId, effectiveDate, updatedAt, [organizationId+leaseId]',
    });
    
    // Version 7: Ajouter fiscalSimulations
    this.version(7).stores({
      properties: 'id, organizationId, updatedAt, isArchived, [organizationId+isArchived]',
      pendingOperations: 'id, entity, entityId, status, createdAt, [entity+status], [status+createdAt]',
      syncMeta: 'table',
      fiscalTypes: 'id, isActive, cachedAt',
      fiscalRegimes: 'id, isActive, cachedAt',
      managementCompanies: 'id, actif, cachedAt',
      natures: 'key, active, cachedAt',
      categories: 'id, type, actif, cachedAt',
      documentTypes: 'id, code, isActive, cachedAt',
      signals: 'id, code, isActive, cachedAt',
      fiscalCompatibilities: 'id, scope, cachedAt',
      leases: 'id, organizationId, propertyId, tenantId, updatedAt, status, [organizationId+status]',
      tenants: 'id, organizationId, email, status, updatedAt, [organizationId+status]',
      loans: 'id, organizationId, propertyId, isActive, updatedAt, [organizationId+isActive]',
      payments: 'id, organizationId, propertyId, leaseId, date, updatedAt, [organizationId+propertyId]',
      transactions: 'id, organizationId, propertyId, leaseId, date, updatedAt, [organizationId+propertyId]',
      echeances: 'id, organizationId, propertyId, leaseId, isActive, updatedAt, [organizationId+isActive]',
      documents: 'id, organizationId, propertyId, leaseId, tenantId, transactionId, loanId, updatedAt, deletedAt, [organizationId+deletedAt]',
      documentLinks: '[documentId+linkedType+linkedId], documentId, linkedType, linkedId, [linkedType+linkedId]',
      photos: 'id, organizationId, propertyId, updatedAt, [organizationId+propertyId]',
      loanBorrowers: 'id, loanId, organizationId, updatedAt, [organizationId+loanId]',
      occupancyHistory: 'id, propertyId, tenantId, leaseId, startDate, updatedAt, [propertyId+tenantId]',
      rentIndexations: 'id, leaseId, organizationId, effectiveDate, updatedAt, [organizationId+leaseId]',
      fiscalSimulations: 'id, organizationId, userId, year, createdAt, updatedAt, [organizationId+year]',
    }).upgrade(async (tx) => {
      const properties = await tx.table('properties').toArray();
      for (const prop of properties) {
        if (!('_syncedAt' in prop)) {
          await tx.table('Property').update(prop.id, { 
            _syncedAt: prop.updatedAt || new Date().toISOString(),
            _localUpdatedAt: undefined,
          });
        }
      }
    });
    
    // Version 8: Ajouter documentLinks pour les liaisons polymorphiques
    this.version(8).stores({
      properties: 'id, organizationId, updatedAt, isArchived, [organizationId+isArchived]',
      pendingOperations: 'id, entity, entityId, status, createdAt, [entity+status], [status+createdAt]',
      syncMeta: 'table',
      fiscalTypes: 'id, isActive, cachedAt',
      fiscalRegimes: 'id, isActive, cachedAt',
      managementCompanies: 'id, actif, cachedAt',
      natures: 'key, active, cachedAt',
      categories: 'id, type, actif, cachedAt',
      documentTypes: 'id, code, isActive, cachedAt',
      signals: 'id, code, isActive, cachedAt',
      fiscalCompatibilities: 'id, scope, cachedAt',
      leases: 'id, organizationId, propertyId, tenantId, updatedAt, status, [organizationId+status]',
      tenants: 'id, organizationId, email, status, updatedAt, [organizationId+status]',
      loans: 'id, organizationId, propertyId, isActive, updatedAt, [organizationId+isActive]',
      payments: 'id, organizationId, propertyId, leaseId, date, updatedAt, [organizationId+propertyId]',
      transactions: 'id, organizationId, propertyId, leaseId, date, updatedAt, [organizationId+propertyId]',
      echeances: 'id, organizationId, propertyId, leaseId, isActive, updatedAt, [organizationId+isActive]',
      documents: 'id, organizationId, propertyId, leaseId, tenantId, transactionId, loanId, updatedAt, deletedAt, [organizationId+deletedAt]',
      documentLinks: '[documentId+linkedType+linkedId], documentId, linkedType, linkedId, [linkedType+linkedId]',
      photos: 'id, organizationId, propertyId, updatedAt, [organizationId+propertyId]',
      loanBorrowers: 'id, loanId, organizationId, updatedAt, [organizationId+loanId]',
      occupancyHistory: 'id, propertyId, tenantId, leaseId, startDate, updatedAt, [propertyId+tenantId]',
      rentIndexations: 'id, leaseId, organizationId, effectiveDate, updatedAt, [organizationId+leaseId]',
      fiscalSimulations: 'id, organizationId, userId, year, createdAt, updatedAt, [organizationId+year]',
    });
    
    // Version 9: Renommer toutes les tables pour utiliser les noms Supabase (PascalCase)
    this.version(9).stores({
      pendingOperations: 'id, entity, entityId, status, createdAt, [entity+status], [status+createdAt]',
      syncMeta: 'table',
      FiscalType: 'id, isActive, cachedAt',
      FiscalRegime: 'id, isActive, cachedAt',
      ManagementCompany: 'id, organizationId, actif, cachedAt, [organizationId]',
      NatureEntity: 'key, active, cachedAt',
      Category: 'id, type, actif, cachedAt',
      DocumentType: 'id, code, isActive, cachedAt',
      Signal: 'id, code, isActive, cachedAt',
      FiscalCompatibility: 'id, scope, cachedAt',
      Property: 'id, organizationId, updatedAt, isArchived, [organizationId+isArchived]',
      Lease: 'id, organizationId, propertyId, tenantId, updatedAt, status, [organizationId+status]',
      Tenant: 'id, organizationId, email, status, updatedAt, [organizationId+status]',
      Loan: 'id, organizationId, propertyId, isActive, updatedAt, [organizationId+isActive]',
      Transaction: 'id, organizationId, propertyId, leaseId, date, updatedAt, [organizationId+propertyId]',
      EcheanceRecurrente: 'id, organizationId, propertyId, leaseId, isActive, updatedAt, [organizationId+isActive]',
      Document: 'id, organizationId, propertyId, leaseId, tenantId, transactionId, loanId, updatedAt, deletedAt, [organizationId+deletedAt]',
      DocumentLink: '[documentId+linkedType+linkedId], documentId, linkedType, linkedId, [linkedType+linkedId]',
      Photo: 'id, organizationId, propertyId, updatedAt, [organizationId+propertyId]',
      LoanBorrower: 'id, loanId, organizationId, updatedAt, [organizationId+loanId]',
      OccupancyHistory: 'id, propertyId, tenantId, leaseId, startDate, updatedAt, [propertyId+tenantId]',
      RentIndexation: 'id, leaseId, organizationId, effectiveDate, updatedAt, [organizationId+leaseId]',
      FiscalSimulation: 'id, organizationId, userId, year, createdAt, updatedAt, [organizationId+year]',
    }).upgrade(async (tx) => {
      const migrations: Array<{ from: string; to: string }> = [
        { from: 'properties', to: 'Property' },
        { from: 'leases', to: 'Lease' },
        { from: 'tenants', to: 'Tenant' },
        { from: 'loans', to: 'Loan' },
        { from: 'transactions', to: 'Transaction' },
        { from: 'echeances', to: 'EcheanceRecurrente' },
        { from: 'documents', to: 'Document' },
        { from: 'documentLinks', to: 'DocumentLink' },
        { from: 'photos', to: 'Photo' },
        { from: 'loanBorrowers', to: 'LoanBorrower' },
        { from: 'occupancyHistory', to: 'OccupancyHistory' },
        { from: 'rentIndexations', to: 'RentIndexation' },
        { from: 'fiscalSimulations', to: 'FiscalSimulation' },
        { from: 'categories', to: 'Category' },
        { from: 'natures', to: 'NatureEntity' },
        { from: 'documentTypes', to: 'DocumentType' },
        { from: 'signals', to: 'Signal' },
        { from: 'fiscalTypes', to: 'FiscalType' },
        { from: 'fiscalRegimes', to: 'FiscalRegime' },
        { from: 'fiscalCompatibilities', to: 'FiscalCompatibility' },
        { from: 'managementCompanies', to: 'ManagementCompany' },
      ];
      
      for (const { from, to } of migrations) {
        try {
          const oldTable = tx.table(from);
          const newTable = tx.table(to);
          const data = await oldTable.toArray();
          if (data.length > 0) {
            await newTable.bulkPut(data);
          }
        } catch (e) {
          // Table peut ne pas exister (c'est OK)
          console.log(`[Migration] Table ${from} n'existe pas, ignorée`);
        }
      }
    });
    
    // Version 10: Ajouter la table AppState pour stocker le contexte de session
    this.version(10).stores({
      pendingOperations: 'id, entity, entityId, status, createdAt, [entity+status], [status+createdAt]',
      syncMeta: 'table',
      AppState: 'id', // Singleton: id = 'current'
      FiscalType: 'id, isActive, cachedAt',
      FiscalRegime: 'id, isActive, cachedAt',
      ManagementCompany: 'id, organizationId, actif, cachedAt, [organizationId]',
      NatureEntity: 'key, active, cachedAt',
      Category: 'id, type, actif, cachedAt',
      DocumentType: 'id, code, isActive, cachedAt',
      Signal: 'id, code, isActive, cachedAt',
      FiscalCompatibility: 'id, scope, cachedAt',
      Property: 'id, organizationId, updatedAt, isArchived, [organizationId+isArchived]',
      Lease: 'id, organizationId, propertyId, tenantId, updatedAt, status, [organizationId+status]',
      Tenant: 'id, organizationId, email, status, updatedAt, [organizationId+status]',
      Loan: 'id, organizationId, propertyId, isActive, updatedAt, [organizationId+isActive]',
      Transaction: 'id, organizationId, propertyId, leaseId, date, updatedAt, [organizationId+propertyId]',
      EcheanceRecurrente: 'id, organizationId, propertyId, leaseId, isActive, updatedAt, [organizationId+isActive]',
      Document: 'id, organizationId, propertyId, leaseId, tenantId, transactionId, loanId, updatedAt, deletedAt, [organizationId+deletedAt]',
      DocumentLink: '[documentId+linkedType+linkedId], documentId, linkedType, linkedId, [linkedType+linkedId]',
      Photo: 'id, organizationId, propertyId, updatedAt, [organizationId+propertyId]',
      LoanBorrower: 'id, loanId, organizationId, updatedAt, [organizationId+loanId]',
      OccupancyHistory: 'id, propertyId, tenantId, leaseId, startDate, updatedAt, [propertyId+tenantId]',
      RentIndexation: 'id, leaseId, organizationId, effectiveDate, updatedAt, [organizationId+leaseId]',
      FiscalSimulation: 'id, organizationId, userId, year, createdAt, updatedAt, [organizationId+year]',
    });
    
    // Version 11: Ajouter la table UserProfile
    this.version(11).stores({
      pendingOperations: 'id, entity, entityId, status, createdAt, [entity+status], [status+createdAt]',
      syncMeta: 'table',
      AppState: 'id', // Singleton: id = 'current'
      FiscalType: 'id, isActive, cachedAt',
      FiscalRegime: 'id, isActive, cachedAt',
      ManagementCompany: 'id, organizationId, actif, cachedAt, [organizationId]',
      NatureEntity: 'key, active, cachedAt',
      Category: 'id, type, actif, cachedAt',
      DocumentType: 'id, code, isActive, cachedAt',
      Signal: 'id, code, isActive, cachedAt',
      FiscalCompatibility: 'id, scope, cachedAt',
      Property: 'id, organizationId, updatedAt, isArchived, [organizationId+isArchived]',
      Lease: 'id, organizationId, propertyId, tenantId, updatedAt, status, [organizationId+status]',
      Tenant: 'id, organizationId, email, status, updatedAt, [organizationId+status]',
      Loan: 'id, organizationId, propertyId, isActive, updatedAt, [organizationId+isActive]',
      Transaction: 'id, organizationId, propertyId, leaseId, date, updatedAt, [organizationId+propertyId]',
      EcheanceRecurrente: 'id, organizationId, propertyId, leaseId, isActive, updatedAt, [organizationId+isActive]',
      Document: 'id, organizationId, propertyId, leaseId, tenantId, transactionId, loanId, updatedAt, deletedAt, [organizationId+deletedAt]',
      DocumentLink: '[documentId+linkedType+linkedId], documentId, linkedType, linkedId, [linkedType+linkedId]',
      Photo: 'id, organizationId, propertyId, updatedAt, [organizationId+propertyId]',
      LoanBorrower: 'id, loanId, organizationId, updatedAt, [organizationId+loanId]',
      OccupancyHistory: 'id, propertyId, tenantId, leaseId, startDate, updatedAt, [propertyId+tenantId]',
      RentIndexation: 'id, leaseId, organizationId, effectiveDate, updatedAt, [organizationId+leaseId]',
      FiscalSimulation: 'id, organizationId, userId, year, createdAt, updatedAt, [organizationId+year]',
      UserProfile: 'id, organizationId, updatedAt, [organizationId]',
    });
    
    // Version 12: Ajouter l'index composite [entity+entityId+operation] pour pendingOperations
    this.version(12).stores({
      pendingOperations: 'id, entity, entityId, status, operation, createdAt, [entity+status], [status+createdAt], [entity+entityId+operation]',
      syncMeta: 'table',
      AppState: 'id',
      FiscalType: 'id, isActive, cachedAt',
      FiscalRegime: 'id, isActive, cachedAt',
      ManagementCompany: 'id, organizationId, actif, cachedAt, [organizationId]',
      NatureEntity: 'key, active, cachedAt',
      Category: 'id, type, actif, cachedAt',
      DocumentType: 'id, code, isActive, cachedAt',
      Signal: 'id, code, isActive, cachedAt',
      FiscalCompatibility: 'id, scope, cachedAt',
      Property: 'id, organizationId, updatedAt, isArchived, [organizationId+isArchived]',
      Lease: 'id, organizationId, propertyId, tenantId, updatedAt, status, [organizationId+status]',
      Tenant: 'id, organizationId, email, status, updatedAt, [organizationId+status]',
      Loan: 'id, organizationId, propertyId, isActive, updatedAt, [organizationId+isActive]',
      Transaction: 'id, organizationId, propertyId, leaseId, date, updatedAt, [organizationId+propertyId]',
      EcheanceRecurrente: 'id, organizationId, propertyId, leaseId, isActive, updatedAt, [organizationId+isActive]',
      Document: 'id, organizationId, propertyId, leaseId, tenantId, transactionId, loanId, updatedAt, deletedAt, [organizationId+deletedAt]',
      DocumentLink: '[documentId+linkedType+linkedId], documentId, linkedType, linkedId, [linkedType+linkedId]',
      Photo: 'id, organizationId, propertyId, updatedAt, [organizationId+propertyId]',
      LoanBorrower: 'id, loanId, organizationId, updatedAt, [organizationId+loanId]',
      OccupancyHistory: 'id, propertyId, tenantId, leaseId, startDate, updatedAt, [propertyId+tenantId]',
      RentIndexation: 'id, leaseId, organizationId, effectiveDate, updatedAt, [organizationId+leaseId]',
      FiscalSimulation: 'id, organizationId, userId, year, createdAt, updatedAt, [organizationId+year]',
      UserProfile: 'id, organizationId, updatedAt, [organizationId]',
    });
    
    // Version 13: Ajouter l'index organizationId dans ManagementCompany pour permettre les requêtes filtrées
    this.version(13).stores({
      pendingOperations: 'id, entity, entityId, status, operation, createdAt, [entity+status], [status+createdAt], [entity+entityId+operation]',
      syncMeta: 'table',
      AppState: 'id',
      FiscalType: 'id, isActive, cachedAt',
      FiscalRegime: 'id, isActive, cachedAt',
      ManagementCompany: 'id, organizationId, actif, cachedAt, [organizationId]',
      NatureEntity: 'key, active, cachedAt',
      Category: 'id, type, actif, cachedAt',
      DocumentType: 'id, code, isActive, cachedAt',
      Signal: 'id, code, isActive, cachedAt',
      FiscalCompatibility: 'id, scope, cachedAt',
      Property: 'id, organizationId, updatedAt, isArchived, [organizationId+isArchived]',
      Lease: 'id, organizationId, propertyId, tenantId, updatedAt, status, [organizationId+status]',
      Tenant: 'id, organizationId, email, status, updatedAt, [organizationId+status]',
      Loan: 'id, organizationId, propertyId, isActive, updatedAt, [organizationId+isActive]',
      Transaction: 'id, organizationId, propertyId, leaseId, date, updatedAt, [organizationId+propertyId]',
      EcheanceRecurrente: 'id, organizationId, propertyId, leaseId, isActive, updatedAt, [organizationId+isActive]',
      Document: 'id, organizationId, propertyId, leaseId, tenantId, transactionId, loanId, updatedAt, deletedAt, [organizationId+deletedAt]',
      DocumentLink: '[documentId+linkedType+linkedId], documentId, linkedType, linkedId, [linkedType+linkedId]',
      Photo: 'id, organizationId, propertyId, updatedAt, [organizationId+propertyId]',
      LoanBorrower: 'id, loanId, organizationId, updatedAt, [organizationId+loanId]',
      OccupancyHistory: 'id, propertyId, tenantId, leaseId, startDate, updatedAt, [propertyId+tenantId]',
      RentIndexation: 'id, leaseId, organizationId, effectiveDate, updatedAt, [organizationId+leaseId]',
      FiscalSimulation: 'id, organizationId, userId, year, createdAt, updatedAt, [organizationId+year]',
      UserProfile: 'id, organizationId, updatedAt, [organizationId]',
    }).upgrade(async (tx) => {
      // Migration : Ajouter organizationId aux données existantes de ManagementCompany si manquant
      // Les données seront corrigées lors de la prochaine sync qui va overwrite depuis Supabase
      // Pour l'instant, on ne fait rien car l'API retourne déjà organizationId
      // et lors de la prochaine sync, les données seront mises à jour avec organizationId
      console.log('[Migration v13] Index organizationId ajouté à ManagementCompany');
    });

    // Version 14: Ajouter l'index organizationId dans pendingOperations pour permettre les requêtes filtrées
    this.version(14).stores({
      pendingOperations: 'id, entity, entityId, status, operation, organizationId, createdAt, [entity+status], [status+createdAt], [entity+entityId+operation], [organizationId+status]',
      syncMeta: 'table',
      AppState: 'id',
      FiscalType: 'id, isActive, cachedAt',
      FiscalRegime: 'id, isActive, cachedAt',
      ManagementCompany: 'id, organizationId, actif, cachedAt, [organizationId]',
      NatureEntity: 'key, active, cachedAt',
      Category: 'id, type, actif, cachedAt',
      DocumentType: 'id, code, isActive, cachedAt',
      Signal: 'id, code, isActive, cachedAt',
      FiscalCompatibility: 'id, scope, cachedAt',
      Property: 'id, organizationId, updatedAt, isArchived, [organizationId+isArchived]',
      Lease: 'id, organizationId, propertyId, tenantId, updatedAt, status, [organizationId+status]',
      Tenant: 'id, organizationId, email, status, updatedAt, [organizationId+status]',
      Loan: 'id, organizationId, propertyId, isActive, updatedAt, [organizationId+isActive]',
      Transaction: 'id, organizationId, propertyId, leaseId, date, updatedAt, [organizationId+propertyId]',
      EcheanceRecurrente: 'id, organizationId, propertyId, leaseId, isActive, updatedAt, [organizationId+isActive]',
      Document: 'id, organizationId, propertyId, leaseId, tenantId, transactionId, loanId, updatedAt, deletedAt, [organizationId+deletedAt]',
      DocumentLink: '[documentId+linkedType+linkedId], documentId, linkedType, linkedId, [linkedType+linkedId]',
      Photo: 'id, organizationId, propertyId, updatedAt, [organizationId+propertyId]',
      LoanBorrower: 'id, loanId, organizationId, updatedAt, [organizationId+loanId]',
      OccupancyHistory: 'id, propertyId, tenantId, leaseId, startDate, updatedAt, [propertyId+tenantId]',
      RentIndexation: 'id, leaseId, organizationId, effectiveDate, updatedAt, [organizationId+leaseId]',
      FiscalSimulation: 'id, organizationId, userId, year, createdAt, updatedAt, [organizationId+year]',
      UserProfile: 'id, organizationId, updatedAt, [organizationId]',
    }).upgrade(async (tx) => {
      console.log('[Migration v14] Index organizationId ajouté à pendingOperations');
    });

    // Version 15: Table cache agrégat fiscal pour offline-first
    this.version(15).stores({
      pendingOperations: 'id, entity, entityId, status, operation, organizationId, createdAt, [entity+status], [status+createdAt], [entity+entityId+operation], [organizationId+status]',
      syncMeta: 'table',
      AppState: 'id',
      FiscalType: 'id, isActive, cachedAt',
      FiscalRegime: 'id, isActive, cachedAt',
      ManagementCompany: 'id, organizationId, actif, cachedAt, [organizationId]',
      NatureEntity: 'key, active, cachedAt',
      Category: 'id, type, actif, cachedAt',
      DocumentType: 'id, code, isActive, cachedAt',
      Signal: 'id, code, isActive, cachedAt',
      FiscalCompatibility: 'id, scope, cachedAt',
      Property: 'id, organizationId, updatedAt, isArchived, [organizationId+isArchived]',
      Lease: 'id, organizationId, propertyId, tenantId, updatedAt, status, [organizationId+status]',
      Tenant: 'id, organizationId, email, status, updatedAt, [organizationId+status]',
      Loan: 'id, organizationId, propertyId, isActive, updatedAt, [organizationId+isActive]',
      Transaction: 'id, organizationId, propertyId, leaseId, date, updatedAt, [organizationId+propertyId]',
      EcheanceRecurrente: 'id, organizationId, propertyId, leaseId, isActive, updatedAt, [organizationId+isActive]',
      Document: 'id, organizationId, propertyId, leaseId, tenantId, transactionId, loanId, updatedAt, deletedAt, [organizationId+deletedAt]',
      DocumentLink: '[documentId+linkedType+linkedId], documentId, linkedType, linkedId, [linkedType+linkedId]',
      Photo: 'id, organizationId, propertyId, updatedAt, [organizationId+propertyId]',
      LoanBorrower: 'id, loanId, organizationId, updatedAt, [organizationId+loanId]',
      OccupancyHistory: 'id, propertyId, tenantId, leaseId, startDate, updatedAt, [propertyId+tenantId]',
      RentIndexation: 'id, leaseId, organizationId, effectiveDate, updatedAt, [organizationId+leaseId]',
      FiscalSimulation: 'id, organizationId, userId, year, createdAt, updatedAt, [organizationId+year]',
      UserProfile: 'id, organizationId, updatedAt, [organizationId]',
      FiscalAggregateCache: 'id, organizationId, updatedAt',
    }).upgrade(async () => {
      console.log('[Migration v15] Table FiscalAggregateCache ajoutée (offline-first fiscal)');
    });

    this.version(16).stores({
      FiscalSessionCache: 'organizationId, updatedAt',
    }).upgrade(async () => {
      console.log('[Migration v16] Table FiscalSessionCache ajoutée (session fiscale offline)');
    });

    this.version(17).stores({
      EcheanceTransactionLink:
        'id, echeanceId, transactionId, organizationId, [echeanceId+transactionId]',
    }).upgrade(async () => {
      console.log('[Migration v17] Table EcheanceTransactionLink (liaison échéance-transaction)');
    });
  }
      };
    }
    
    // Instrumentation: logger l'état AVANT instanciation SmartimmoLocalDBClass
    if (isTest && process.env.DEBUG_DEXIE_TEST === '1') {
      console.log('[DEXIE-INSTRUMENTATION] AVANT new SmartimmoLocalDBClass():', {
        dexieDependenciesIndexedDB: !!Dexie.dependencies?.indexedDB,
        dexieDependenciesHasPrototype: Dexie.dependencies?.indexedDB ? 'prototype' in Dexie.dependencies.indexedDB : false,
        globalThisIndexedDB: typeof globalThis !== 'undefined' ? !!(globalThis as any).indexedDB : false,
        globalThisHasPrototype: typeof globalThis !== 'undefined' && (globalThis as any).indexedDB ? 'prototype' in (globalThis as any).indexedDB : false,
      });
    }
    
    // ÉTAPE 6: Créer l'instance
    dbInstance = new SmartimmoLocalDBClass();
  }
  
  // ⚠️ CRITIQUE: Si la DB est déjà marquée comme UNAVAILABLE, ne pas réessayer automatiquement
  if (dbStatus === 'UNAVAILABLE' && dbInstance && !dbInstance.isOpen()) {
    // Retourner null sans émettre d'événement (déjà émis précédemment)
    return null;
  }
  
  // ⚠️ CRITIQUE: Utiliser openDbWithRecovery pour gérer les erreurs d'ouverture
  // Cette fonction centralise toute la logique de récupération
  if (dbInstance) {
    // ⚠️ GARDE ANTI-BOUCLE: Si une ouverture est déjà en cours, attendre sa résolution
    if (dbOpenInProgress && dbOpenPromise) {
      return dbOpenPromise;
    }
    
    // Marquer qu'une ouverture est en cours
    dbOpenInProgress = true;
    dbOpenPromise = (async () => {
      try {
        // Importer dynamiquement pour éviter les dépendances circulaires
        const { openDbWithRecovery } = await import('./dbRecovery');
        
        // Créer un callback qui émet un événement pour que le contexte puisse réagir
        const setStatusCallback = (status: any, error?: Error | null) => {
          // Mettre à jour le statut global
          dbStatus = status;
          
          if (typeof window !== 'undefined') {
            if (status === 'UNAVAILABLE') {
              window.dispatchEvent(new CustomEvent('localdb:unavailable', {
                detail: { error }
              }));
            } else if (status === 'RECOVERED') {
              window.dispatchEvent(new CustomEvent('localdb:recovered'));
            } else {
              window.dispatchEvent(new CustomEvent('localdb:ok'));
            }
          }
        };
        
        const result = await openDbWithRecovery(dbInstance, setStatusCallback);
        
        if (result.status === 'UNAVAILABLE') {
          // Ne pas throw, retourner null pour permettre à l'app de continuer
          return null;
        }
        
        return result.db;
      } catch (error: any) {
        console.error('[getLocalDB] ❌ Erreur lors de l\'ouverture avec récupération:', error);
        
        // Mettre à jour le statut global
        dbStatus = 'UNAVAILABLE';
        
        // Émettre un événement pour que le contexte puisse réagir
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('localdb:unavailable', {
            detail: { error }
          }));
        }
        
        // Ne pas throw, retourner null pour permettre à l'app de continuer
        return null;
      } finally {
        // Réinitialiser le flag d'ouverture en cours
        dbOpenInProgress = false;
        dbOpenPromise = null;
      }
    })();
    
    return dbOpenPromise;
  }
  
  return dbInstance;
}

/**
 * Fonction utilitaire pour réinitialiser le statut de la DB (pour retry forcé)
 * ⚠️ CRITIQUE: Utilisée uniquement par le bouton "Réessayer" dans LocalDbUnavailableScreen
 * ⚠️ CLIENT-ONLY: Ne peut être utilisée que côté client
 */
export function resetDbStatus() {
  if (typeof window === 'undefined') {
    throw new Error('resetDbStatus() ne peut être appelé que côté client');
  }
  dbStatus = 'OK';
  dbOpenInProgress = false;
  dbOpenPromise = null;
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

/**
 * Force la migration vers la version 9 si nécessaire
 */
export async function ensureMigrationToV9(): Promise<void> {
  if (typeof window === 'undefined') return;
  
  try {
    const db = await getLocalDB();
    
    // ⚠️ CRITIQUE: Si la DB est indisponible, ne pas tenter la migration
    if (!db) {
      console.warn('[Migration] ⚠️ DB indisponible, migration ignorée');
      // Émettre un événement pour que le contexte puisse réagir
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('localdb:unavailable', {
          detail: { error: new Error('DB indisponible lors de la migration') }
        }));
      }
      return;
    }
    
    if (db.isOpen()) {
      const currentVersion = await db.verno;
      
      if (currentVersion < 9) {
        await db.close();
        await db.open();
        const newVersion = await db.verno;
        if (newVersion < 9) {
          console.error(`[Migration] ❌ Migration échouée vers la version 9 (version: ${newVersion})`);
        }
      }
    } else {
      await db.open();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const currentVersion = await db.verno;
      
      if (currentVersion === 9) {
        const tableNames = db.tables.map((t: any) => t.name);
        const expectedTables = ['Property', 'Lease', 'Tenant', 'Loan', 'Transaction', 'Document', 'Category'];
        const missingTables = expectedTables.filter(name => !tableNames.includes(name));
        if (missingTables.length > 0) {
          console.error(`[Migration] ❌ Tables manquantes dans IndexedDB:`, missingTables);
        }
      } else if (currentVersion < 9) {
        console.error(`[Migration] ❌ La base n'a pas été migrée vers la version 9 (version: ${currentVersion})`);
      }
    }
  } catch (error: any) {
    console.error(`[Migration] ❌ Erreur lors de la migration:`, error);
    // Émettre un événement pour que le contexte puisse réagir
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('localdb:unavailable', {
        detail: { error }
      }));
    }
  }
}
