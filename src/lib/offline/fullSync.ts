/**
 * Service de synchronisation initiale complète (Full Sync)
 * Télécharge toutes les données d'une organisation pour le mode offline
 */

import { getLocalDB } from './db';
import { SyncMeta } from './types';
import { logToServer } from '@/lib/utils/logger';
// Import dynamique de preloadImportantPages pour éviter les problèmes de SSR
// import { preloadImportantPages } from './preloadPages';

export interface FullSyncResult {
  success: boolean;
  tables: Record<string, { synced: number; errors: number }>;
  error?: string;
}

export interface TableSyncConfig {
  tableName: string; // Nom de la table IndexedDB
  apiRoute: string; // Route API (ex: '/api/properties', '/api/leases')
  syncMetaKey: string; // Clé dans syncMeta (ex: 'Property', 'Lease')
  transform?: (item: any) => any; // Fonction de transformation optionnelle
}

const FULL_SYNC_TRANSIENT_LOG_TTL_MS = 30_000;
const fullSyncTransientLogCache = new Map<string, number>();

function isTransientFullSyncError(errorMessage: string): boolean {
  const lower = errorMessage.toLowerCase();
  return (
    lower.includes('cannot read properties of null') ||
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('aborterror')
  );
}

function logFullSyncTableIssue(tableName: string, errorMessage: string): void {
  if (!isTransientFullSyncError(errorMessage)) {
    logToServer(`[APP-SHELL][FULL-SYNC] ❌ Table ${tableName}: erreur lors du traitement - ${errorMessage}`);
    return;
  }

  const now = Date.now();
  const cacheKey = `${tableName}:${errorMessage}`;
  const lastLoggedAt = fullSyncTransientLogCache.get(cacheKey) ?? 0;
  if (now - lastLoggedAt < FULL_SYNC_TRANSIENT_LOG_TTL_MS) {
    return;
  }

  fullSyncTransientLogCache.set(cacheKey, now);
  logToServer(
    `[APP-SHELL][FULL-SYNC] ⚠️ Table ${tableName}: erreur transitoire au démarrage (non bloquante) - ${errorMessage}`
  );
}

/**
 * Configuration des tables à synchroniser
 */
const TABLE_CONFIGS: TableSyncConfig[] = [
  {
    tableName: 'Property',
    apiRoute: '/api/properties?limit=10000&includeArchived=true',
    syncMetaKey: 'Property',
    transform: (item: any) => ({
      ...item,
      acquisitionDate: item.acquisitionDate ? new Date(item.acquisitionDate).toISOString() : new Date().toISOString(),
      archivedAt: item.archivedAt ? new Date(item.archivedAt).toISOString() : null,
      createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: item.updatedAt ? new Date(item.updatedAt).toISOString() : new Date().toISOString(),
      evalDate: item.evalDate ? new Date(item.evalDate).toISOString() : null,
    }),
  },
  {
    tableName: 'Lease',
    apiRoute: '/api/leases?limit=10000',
    syncMetaKey: 'Lease',
    transform: (item: any) => ({
      ...item,
      startDate: item.startDate ? new Date(item.startDate).toISOString() : new Date().toISOString(),
      endDate: item.endDate ? new Date(item.endDate).toISOString() : null,
      createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: item.updatedAt ? new Date(item.updatedAt).toISOString() : new Date().toISOString(),
    }),
  },
  {
    tableName: 'Tenant',
    apiRoute: '/api/tenants?limit=10000',
    syncMetaKey: 'Tenant',
    transform: (item: any) => ({
      ...item,
      birthDate: item.birthDate ? new Date(item.birthDate).toISOString() : null,
      createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: item.updatedAt ? new Date(item.updatedAt).toISOString() : new Date().toISOString(),
    }),
  },
  {
    tableName: 'Loan',
    apiRoute: '/api/loans?limit=10000',
    syncMetaKey: 'Loan',
    transform: (item: any) => ({
      ...item,
      principal: typeof item.principal === 'object' && item.principal !== null ? parseFloat(item.principal.toString()) : item.principal,
      annualRatePct: typeof item.annualRatePct === 'object' && item.annualRatePct !== null ? parseFloat(item.annualRatePct.toString()) : item.annualRatePct,
      insurancePct: typeof item.insurancePct === 'object' && item.insurancePct !== null ? parseFloat(item.insurancePct.toString()) : item.insurancePct,
      feesUpfront: typeof item.feesUpfront === 'object' && item.feesUpfront !== null ? parseFloat(item.feesUpfront.toString()) : item.feesUpfront,
      startDate: item.startDate ? new Date(item.startDate).toISOString() : new Date().toISOString(),
      endDate: item.endDate ? new Date(item.endDate).toISOString() : null,
      createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: item.updatedAt ? new Date(item.updatedAt).toISOString() : new Date().toISOString(),
    }),
  },
  // Payment table removed - replaced by Transaction table
  // {
  //   tableName: 'Payment',
  //   apiRoute: '/api/payments?limit=10000',
  //   syncMetaKey: 'Payment',
  //   transform: (item: any) => ({
  //     ...item,
  //     date: item.date ? new Date(item.date).toISOString() : new Date().toISOString(),
  //     createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString(),
  //     updatedAt: item.updatedAt ? new Date(item.updatedAt).toISOString() : new Date().toISOString(),
  //   }),
  // },
  {
    tableName: 'Transaction',
    apiRoute: '/api/transactions?limit=10000',
    syncMetaKey: 'Transaction',
    transform: (item: any) => {
      // Extraire la clé de la nature depuis l'objet nature (si présent)
      let natureKey = item.nature;
      if (item.nature && typeof item.nature === 'object') {
        natureKey = item.nature.id || item.nature.code || item.nature.key || item.nature;
      }
      
      return {
        ...item,
        nature: natureKey, // ⚠️ CRITIQUE: S'assurer que nature est une string (clé), pas un objet
        // ⚠️ CRITIQUE: Mapper accountingMonth (camelCase API) vers accounting_month (snake_case IndexedDB)
        accounting_month: item.accounting_month || item.accountingMonth || null,
        date: item.date ? new Date(item.date).toISOString() : new Date().toISOString(),
        paidAt: item.paidAt ? new Date(item.paidAt).toISOString() : null,
        rapprochementStatus: item.rapprochementStatus || item.status || null, // ⚠️ CRITIQUE: Ajouté pour les KPI Dashboard
        dateRapprochement: item.dateRapprochement ? new Date(item.dateRapprochement).toISOString() : null,
        bankRef: item.bankRef || null,
        createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: item.updatedAt ? new Date(item.updatedAt).toISOString() : new Date().toISOString(),
      };
    },
  },
  {
    tableName: 'EcheanceRecurrente',
    apiRoute: '/api/echeances?limit=10000',
    syncMetaKey: 'EcheanceRecurrente',
    transform: (item: any) => ({
      ...item,
      montant: typeof item.montant === 'object' && item.montant !== null ? parseFloat(item.montant.toString()) : item.montant,
      startAt: item.startAt ? new Date(item.startAt).toISOString() : new Date().toISOString(),
      endAt: item.endAt ? new Date(item.endAt).toISOString() : null,
      createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: item.updatedAt ? new Date(item.updatedAt).toISOString() : new Date().toISOString(),
    }),
  },
  {
    tableName: 'Document',
    apiRoute: '/api/documents?limit=10000&includeDeleted=true',
    syncMetaKey: 'Document',
    transform: (item: any) => ({
      ...item,
      uploadedAt: item.uploadedAt ? new Date(item.uploadedAt).toISOString() : new Date().toISOString(),
      deletedAt: item.deletedAt ? new Date(item.deletedAt).toISOString() : null,
      createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: item.updatedAt ? new Date(item.updatedAt).toISOString() : new Date().toISOString(),
    }),
  },
  {
    tableName: 'Photo',
    apiRoute: '/api/photos?limit=10000',
    syncMetaKey: 'Photo',
    transform: (item: any) => ({
      ...item,
      createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: item.updatedAt ? new Date(item.updatedAt).toISOString() : new Date().toISOString(),
    }),
  },
  {
    tableName: 'LoanBorrower',
    apiRoute: '/api/loans?limit=10000',
    syncMetaKey: 'LoanBorrower',
    transform: (item: any) => ({
      ...item,
      birthDate: item.birthDate ? new Date(item.birthDate).toISOString() : null,
      responsibilityPct: typeof item.responsibilityPct === 'object' && item.responsibilityPct !== null ? parseFloat(item.responsibilityPct.toString()) : item.responsibilityPct,
      createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: item.updatedAt ? new Date(item.updatedAt).toISOString() : new Date().toISOString(),
    }),
  },
  {
    tableName: 'OccupancyHistory',
    apiRoute: '/api/properties?limit=10000',
    syncMetaKey: 'OccupancyHistory',
    transform: (item: any) => ({
      ...item,
      startDate: item.startDate ? new Date(item.startDate).toISOString() : new Date().toISOString(),
      endDate: item.endDate ? new Date(item.endDate).toISOString() : null,
      createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: item.updatedAt ? new Date(item.updatedAt).toISOString() : new Date().toISOString(),
    }),
  },
  {
    tableName: 'RentIndexation',
    apiRoute: '/api/leases?limit=10000',
    syncMetaKey: 'RentIndexation',
    transform: (item: any) => ({
      ...item,
      effectiveDate: item.effectiveDate ? new Date(item.effectiveDate).toISOString() : new Date().toISOString(),
      indexDate: item.indexDate ? new Date(item.indexDate).toISOString() : null,
      createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString(),
    }),
  },
  // Tables de référence (admin/globales)
  {
    tableName: 'NatureEntity',
    apiRoute: '/api/admin/natures',
    syncMetaKey: 'NatureEntity',
    transform: (item: any) => ({
      ...item,
      cachedAt: new Date().toISOString(),
    }),
  },
  {
    tableName: 'Category',
    apiRoute: '/api/accounting/categories',
    syncMetaKey: 'Category',
    transform: (item: any) => ({
      ...item,
      cachedAt: new Date().toISOString(),
    }),
  },
  {
    tableName: 'Signal',
    apiRoute: '/api/admin/signals',
    syncMetaKey: 'Signal',
    transform: (item: any) => ({
      id: item.id || item.code,
      code: item.code || item.id,
      label: item.label || item.name,
      category: item.category || null,
      isActive: item.isActive !== false,
      cachedAt: new Date().toISOString(),
    }),
  },
  {
    tableName: 'DocumentType',
    apiRoute: '/api/document-types',
    syncMetaKey: 'DocumentType',
    transform: (item: any) => ({
      id: item.id || item.code,
      code: item.code || item.id,
      label: item.label || item.name,
      category: item.category || item.scope || null,
      isActive: item.isActive !== false,
      openTransaction: item.openTransaction || false, // ✅ Récupérer le champ openTransaction depuis l'API
      cachedAt: new Date().toISOString(),
    }),
  },
  {
    tableName: 'FiscalType',
    apiRoute: '/api/admin/tax/types?active=true',
    syncMetaKey: 'FiscalType',
    transform: (item: any) => ({
      ...item,
      cachedAt: new Date().toISOString(),
    }),
  },
  {
    tableName: 'FiscalRegime',
    apiRoute: '/api/admin/tax/regimes?active=true',
    syncMetaKey: 'FiscalRegime',
    transform: (item: any) => ({
      ...item,
      cachedAt: new Date().toISOString(),
    }),
  },
  {
    tableName: 'FiscalCompatibility',
    apiRoute: '/api/admin/tax/compat',
    syncMetaKey: 'FiscalCompatibility',
    transform: (item: any) => ({
      ...item,
      cachedAt: new Date().toISOString(),
    }),
  },
  {
    tableName: 'ManagementCompany',
    apiRoute: '/api/gestion/societes',
    syncMetaKey: 'ManagementCompany',
    transform: (item: any) => ({
      ...item,
      cachedAt: new Date().toISOString(),
    }),
  },
  {
    tableName: 'FiscalSimulation',
    apiRoute: '/api/fiscal/simulations?limit=10000',
    syncMetaKey: 'FiscalSimulation',
    transform: (item: any) => ({
      ...item,
      createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: item.updatedAt ? new Date(item.updatedAt).toISOString() : new Date().toISOString(),
    }),
  },
  {
    tableName: 'UserProfile',
    apiRoute: '/api/profiles',
    syncMetaKey: 'UserProfile',
    transform: (item: any) => ({
      ...item,
      createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: item.updatedAt ? new Date(item.updatedAt).toISOString() : new Date().toISOString(),
    }),
  },
];

/**
 * Vérifie si la synchronisation initiale complète a déjà été effectuée pour une organisation
 */
export async function hasInitialFullSyncDone(organizationId: string): Promise<boolean> {
  try {
    const db = await getLocalDB();
    const syncMeta = await db.syncMeta.get(`fullSync_${organizationId}`);
    return syncMeta?.lastSyncAt !== null && syncMeta?.lastSyncAt !== undefined;
  } catch (error) {
    // Erreur silencieuse
    return false;
  }
}

/**
 * Effectue une synchronisation initiale complète pour une organisation
 * Télécharge toutes les données de toutes les tables configurées
 */
export async function initialFullSync(organizationId: string): Promise<FullSyncResult> {
  const db = await getLocalDB();
  const results: FullSyncResult = {
    success: true,
    tables: {},
  };

  logToServer(`[APP-SHELL][FULL-SYNC] Démarrage initialFullSync pour organizationId=${organizationId}`);

  try {
    // Synchroniser chaque table
    for (const config of TABLE_CONFIGS) {
      try {
        // Log supprimé

        // Charger les données depuis l'API (avec credentials pour l'authentification)
        const response = await fetch(config.apiRoute, {
          credentials: 'include', // Inclure les cookies pour l'authentification
        });
        
        if (!response.ok) {
          // Pour les tables de référence, une erreur 404 n'est pas critique
          const isReferenceTable = [
            'NatureEntity',
            'Category',
            'Signal',
            'DocumentType',
            'FiscalType',
            'FiscalRegime',
            'FiscalCompatibility',
            'ManagementCompany',
          ].includes(config.tableName);
          
          if (response.status === 404 && isReferenceTable) {
            logToServer(`[APP-SHELL][FULL-SYNC] ⚠️ Table ${config.tableName}: endpoint non disponible (404), ignoré`);
            results.tables[config.tableName] = { synced: 0, errors: 0 };
            continue;
          }
          
          // Pour les autres erreurs, marquer comme erreur
          logToServer(`[APP-SHELL][FULL-SYNC] ❌ Table ${config.tableName}: erreur ${response.status}`);
          results.tables[config.tableName] = { synced: 0, errors: 1 };
          continue;
        }

        const data = await response.json();
        
        
        // Gérer différents formats de réponse
        let items: any[] = [];
        if (Array.isArray(data)) {
          items = data;
        } else if (data.data && Array.isArray(data.data)) {
          // Format pour properties et transactions (retournent { data: [...], pagination: {...} })
          // Vérifier data.data AVANT data.items pour ces tables
          items = data.data;
        } else if (data.items && Array.isArray(data.items)) {
          // Format pour leases, loans, payments (retournent { items: [...] })
          items = data.items;
        } else if (config.tableName === 'NatureEntity' && data.data && Array.isArray(data.data)) {
          // Format spécifique pour les natures : { success: true, data: [...] }
          items = data.data;
        } else if (data.leases && Array.isArray(data.leases)) {
          // Format spécifique pour les baux
          items = data.leases;
        } else if (data.documents && Array.isArray(data.documents)) {
          // Format spécifique pour les documents
          items = data.documents;
        } else if (data.transactions && Array.isArray(data.transactions)) {
          // Format spécifique pour les transactions (fallback si pas dans data.data)
          items = data.transactions;
        } else if (data.simulations && Array.isArray(data.simulations)) {
          // Format spécifique pour les simulations fiscales
          items = data.simulations;
        } else if (data.societes && Array.isArray(data.societes)) {
          // Format spécifique pour les sociétés de gestion
          items = data.societes;
        } else if (data.documentTypes && Array.isArray(data.documentTypes)) {
          // Format spécifique pour les types de documents
          items = data.documentTypes;
        } else if (data.signals && Array.isArray(data.signals)) {
          // Format spécifique pour les signaux
          items = data.signals;
        } else if (config.tableName === 'UserProfile' && 'data' in data) {
          // Format pour userProfile : { data: {...} } - un seul profil par organisation
          // Convertir en tableau pour le traitement uniforme (même si data.data est null)
          items = data.data ? [data.data] : [];
        } else if (data[config.tableName] && Array.isArray(data[config.tableName])) {
          items = data[config.tableName];
        } else {
          // Format inattendu - logger pour debug
          console.warn(`[FullSync] Format de réponse inattendu pour ${config.tableName}:`, Object.keys(data));
          console.warn(`[FullSync] Réponse complète:`, data);
          // Ne pas continuer si on n'a pas pu extraire les items
          logToServer(`[APP-SHELL][FULL-SYNC] ❌ Table ${config.tableName}: format de réponse inattendu, aucune donnée extraite`);
          results.tables[config.tableName] = { synced: 0, errors: 1 };
          continue;
        }
        
        // Si aucun item n'a été extrait après toutes les tentatives, logger une erreur
        if (items.length === 0 && config.tableName === 'Transaction') {
          console.error(`[FullSync] ⚠️ Transaction: items.length === 0 après extraction. Structure de data:`, {
            keys: Object.keys(data || {}),
            hasData: !!(data?.data),
            hasItems: !!(data?.items),
            hasTransactions: !!(data?.transactions),
            dataType: Array.isArray(data?.data),
            dataLength: data?.data?.length,
          });
        }
        
        // Pour les tables imbriquées (loanBorrowers, occupancyHistory, rentIndexations)
        // Extraire depuis les données parentes si nécessaire
        if (config.tableName === 'LoanBorrower' && items.length > 0 && items[0].LoanBorrower) {
          items = items.flatMap((loan: any) => 
            (Array.isArray(loan.LoanBorrower) ? loan.LoanBorrower : [])
              .map((borrower: any) => ({ ...borrower, loanId: loan.id }))
          );
        }
        if (config.tableName === 'OccupancyHistory' && items.length > 0 && items[0].OccupancyHistory) {
          items = items.flatMap((property: any) => 
            (Array.isArray(property.OccupancyHistory) ? property.OccupancyHistory : [])
              .map((history: any) => ({ ...history, propertyId: property.id }))
          );
        }
        if (config.tableName === 'RentIndexation' && items.length > 0 && items[0].RentIndexation) {
          items = items.flatMap((lease: any) => 
            (Array.isArray(lease.RentIndexation) ? lease.RentIndexation : [])
              .map((indexation: any) => ({ ...indexation, leaseId: lease.id }))
          );
        }

        // Déterminer si c'est une table de référence (pas de filtre organizationId)
        const isReferenceTable = [
          'NatureEntity',
          'Category',
          'Signal',
          'DocumentType',
          'FiscalType',
          'FiscalRegime',
          'FiscalCompatibility',
          'ManagementCompany',
        ].includes(config.tableName);

        // Filtrer par organizationId (uniquement pour les tables métier)
        const filteredItems = isReferenceTable
          ? items // Tables de référence globales : pas de filtre organizationId
          : items.filter((item: any) => {
              // Pour les sous-entités, vérifier via le parent si nécessaire
              if (config.tableName === 'LoanBorrower' && item.loanId) {
                // Le loanId doit pointer vers un loan de cette organisation
                // On vérifiera lors de la sauvegarde que le loan parent existe
                return true; // On laisse passer, le filtrage se fera via le parent
              }
              if (config.tableName === 'OccupancyHistory' && item.propertyId) {
                return true; // On laisse passer, le filtrage se fera via le parent
              }
              if (config.tableName === 'RentIndexation' && item.leaseId) {
                return true; // On laisse passer, le filtrage se fera via le parent
              }
              // Pour les autres tables métier, exiger strictement l'organizationId
              const matches = item.organizationId === organizationId;
              
              return matches;
            });
        

        // Log pour diagnostiquer
        if (filteredItems.length !== items.length) {
          // Log supprimé
        }
        
        // Pour les sous-entités, ne synchroniser que si on a des données
        if (config.tableName === 'LoanBorrower' && filteredItems.length === 0) {
          // Log supprimé
        }
        if (config.tableName === 'OccupancyHistory' && filteredItems.length === 0) {
          // Log supprimé
        }
        if (config.tableName === 'RentIndexation' && filteredItems.length === 0) {
          // Log supprimé
        }

        // OVERWRITE TOTAL : Transformer et sauvegarder dans IndexedDB
        // ⚠️ Récupérer la table de manière explicite
        let table: any;
        
        // ⚠️ GESTION SPÉCIALE POUR TRANSACTION : db.Transaction est une fonction au lieu d'un objet Table
        // Récupérer la vraie table via db.tables.find()
        if (config.tableName === 'Transaction') {
          table = (db as any).Transaction;
          
          // Si ce n'est pas valide (fonction au lieu de Table), utiliser db.tables
          if (!table || typeof table === 'function' || typeof table.where !== 'function') {
            const transactionTable = db.tables.find(t => t.name === 'Transaction');
            if (transactionTable && typeof transactionTable.where === 'function') {
              table = transactionTable;
            } else {
              console.error(`[FullSync] ❌ Table Transaction non trouvée dans db.tables`);
              logToServer(`[APP-SHELL][FULL-SYNC] ❌ Table Transaction non trouvée dans db.tables`);
              results.tables[config.tableName] = { synced: 0, errors: 1 };
              continue;
            }
          }
        } else {
          table = (db as any)[config.tableName];
        }
        
        // Vérifier que c'est bien une table Dexie valide
        if (!table || typeof table.where !== 'function') {
          console.error(`[FullSync] ❌ Table ${config.tableName} n'est pas une table Dexie valide`, {
            tableType: typeof table,
            hasWhere: table && typeof table.where === 'function',
          });
          logToServer(`[APP-SHELL][FULL-SYNC] ❌ Table ${config.tableName} n'est pas une table Dexie valide (type: ${typeof table})`);
          results.tables[config.tableName] = { synced: 0, errors: 1 };
          continue;
        }
        
        let synced = 0;
        let errors = 0;

        // Compter les items locaux avant suppression
        // ⚠️ CRITIQUE: Certaines tables n'ont pas d'index sur organizationId (occupancyHistory, rentIndexations)
        // Pour ces tables, on compte tous les items ou on filtre différemment
        let localCount = 0;
        if (isReferenceTable) {
          localCount = await table.count(); // Tables de référence : compter tous les items
        } else if (config.tableName === 'OccupancyHistory' || config.tableName === 'RentIndexation') {
          // Ces tables n'ont pas d'index organizationId, on compte tous les items
          // Le filtrage se fera lors de la transformation/filtrage des items
          localCount = await table.count();
        } else {
          localCount = await table.where('organizationId').equals(organizationId).count(); // Tables métier : filtrer par organizationId
        }


        // Transformer toutes les données Supabase
        const now = new Date().toISOString();
        const itemsToSave = filteredItems.map((item: any) => {
          try {
            const transformed = config.transform ? config.transform(item) : item;
            // Supabase = source de vérité absolue : toujours écraser les données locales
            return {
              ...transformed,
              _syncedAt: now,
            };
          } catch (error) {
            // Erreur silencieuse
            errors++;
            return null;
          }
        }).filter((item: any) => item !== null);

        // OVERWRITE TOTAL : Supprimer tous les items
        if (isReferenceTable) {
          // Tables de référence : supprimer tous les items (pas de filtre organizationId)
          await table.clear();
        } else if (config.tableName === 'OccupancyHistory') {
          // occupancyHistory n'a pas d'index organizationId, on supprime via propertyId
          // On récupère d'abord les propertyIds de l'organisation
          const propertyIds = await db.Property.where('organizationId').equals(organizationId).primaryKeys();
          if (propertyIds.length > 0) {
            await table.where('propertyId').anyOf(propertyIds).delete();
          }
        } else {
          // Tables métier : supprimer uniquement les items de cette organisation
          await table.where('organizationId').equals(organizationId).delete();
        }

        // Puis bulkPut toutes les données Supabase
        if (itemsToSave.length > 0) {
          try {
            await table.bulkPut(itemsToSave);
            synced = itemsToSave.length;
          } catch (bulkPutError: any) {
            console.error(`[FullSync] ❌ Erreur lors de bulkPut pour ${config.tableName}:`, bulkPutError);
            logToServer(`[APP-SHELL][FULL-SYNC] ❌ Erreur bulkPut ${config.tableName}: ${bulkPutError.message}`);
            errors++;
          }
        } else if (config.tableName === 'Transaction' && filteredItems.length > 0) {
          // Log spécifique pour Transaction si items filtrés mais itemsToSave vide
          console.error(`[FullSync] ⚠️ Transaction: ${filteredItems.length} items filtrés mais itemsToSave.length=0`);
          logToServer(`[APP-SHELL][FULL-SYNC] ⚠️ Transaction: ${filteredItems.length} items filtrés mais 0 à sauvegarder`);
        }

        // Log propre pour vérification (terminal)
        logToServer(`[APP-SHELL][FULL-SYNC] table=${config.tableName} local=${localCount} remote=${filteredItems.length} synced=${synced} overwritten=true`);
        

        // Mettre à jour syncMeta
        await db.syncMeta.put({
          table: config.syncMetaKey,
          lastSyncAt: new Date().toISOString(),
        });

        results.tables[config.tableName] = { synced, errors };
        // Log supprimé
      } catch (error: any) {
        // Logger l'erreur pour debug (surtout pour Transaction)
        console.error(`[FullSync] ❌ Erreur lors de la sync de ${config.tableName}:`, error);
        const message = error?.message || String(error);
        logFullSyncTableIssue(config.tableName, message);
        // Ne pas bloquer la full sync si une table échoue
        results.tables[config.tableName] = { synced: 0, errors: 1 };
        // On continue même en cas d'erreur pour permettre la sync des autres tables
      }
    }

    // Marquer la full sync comme terminée pour cette organisation
    // Même si certaines tables ont échoué, on considère la sync comme "faite"
    // pour éviter de relancer indéfiniment
    await db.syncMeta.put({
      table: `fullSync_${organizationId}`,
      lastSyncAt: new Date().toISOString(),
    });

    const totalErrors = Object.values(results.tables).reduce((sum, t) => sum + t.errors, 0);
    const totalSynced = Object.values(results.tables).reduce((sum, t) => sum + t.synced, 0);
    
    // Log récapitulatif dans le terminal
    logToServer(`[APP-SHELL][FULL-SYNC] initialFullSync terminé: totalSynced=${totalSynced}, totalErrors=${totalErrors}, tables=${Object.keys(results.tables).length}`);
    
    // DÉSACTIVÉ : Préchargement automatique des pages supprimé
    // Le préchargement se fait uniquement depuis la page /app?view=sync
    // if (typeof window !== 'undefined' && results.success) {
    //   console.log('[FullSync] 🚀 Démarrage du préchargement des pages HTML...');
    //   try {
    //     // Import dynamique pour éviter les problèmes de SSR
    //     const { preloadImportantPages } = await import('./preloadPages');
    //     const preloadResult = await preloadImportantPages();
    //     console.log(
    //       `[FullSync] ✅ Préchargement des pages terminé: ${preloadResult.success} succès, ${preloadResult.failed} échecs`
    //     );
    //     if (preloadResult.failed > 0) {
    //       console.warn('[FullSync] ⚠️ Certaines pages n\'ont pas pu être préchargées:', preloadResult.errors);
    //     }
    //   } catch (error: any) {
    //     console.error('[FullSync] ⚠️ Erreur lors du préchargement des pages:', error);
    //     console.error('[FullSync] Détails erreur préchargement:', error.message, error.stack);
    //     // Ne pas échouer la full sync si le préchargement échoue
    //   }
    // } else {
    //   console.warn(`[FullSync] ⚠️ Préchargement des pages ignoré: window=${typeof window !== 'undefined'}, success=${results.success}`);
    // }

    return results;
  } catch (error: any) {
    // Erreur silencieuse (sera gérée par l'appelant)
    results.success = false;
    results.error = error.message || 'Erreur lors de la synchronisation complète';
    return results;
  }
}

/**
 * Réinitialise la full sync pour une organisation (utile pour forcer une resync)
 */
export async function resetFullSync(organizationId: string): Promise<void> {
  const db = await getLocalDB();
  await db.syncMeta.delete(`fullSync_${organizationId}`);
  // Log supprimé
}




