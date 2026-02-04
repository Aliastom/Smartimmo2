/**
 * Repository de base offline-first générique
 * Factorise la logique commune pour tous les repositories offline
 */

import { getLocalDB } from '../db';
import { PendingOperation } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { DbUnavailableError } from '../dbErrors';

export interface BaseEntity {
  id: string;
  organizationId: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

export interface RepositoryConfig<T extends BaseEntity> {
  entityName: string; // 'property', 'lease', 'tenant', etc.
  tableName: keyof ReturnType<typeof getLocalDB>; // Table IndexedDB (ex: 'Property', 'Lease')
  apiRoute: string; // Route API (ex: '/api/properties', '/api/leases')
  idField?: string; // Champ ID (par défaut: 'id')
}

/**
 * Repository de base offline-first générique
 * Gère la lecture depuis IndexedDB, l'écriture locale + pendingOperations, et la sync
 */
export abstract class BaseOfflineRepository<T extends BaseEntity> {
  protected _dbPromise: Promise<any> | null = null;
  protected config: RepositoryConfig<T>;

  constructor(config: RepositoryConfig<T>) {
    this.config = config;
  }

  protected async getDb() {
    // ⚠️ CRITIQUE: Vérifier que nous sommes côté client
    if (typeof window === 'undefined') {
      throw new DbUnavailableError('getDb() ne peut être appelé que côté client');
    }
    
    if (!this._dbPromise) {
      this._dbPromise = getLocalDB();
    }
    const db = await this._dbPromise;
    
    // ⚠️ CRITIQUE: Si la DB est indisponible, throw une erreur typée (ne pas masquer)
    if (!db) {
      throw new DbUnavailableError(`La base de données locale n'est pas accessible pour ${this.config.entityName}`);
    }
    
    return db;
  }

  /**
   * Récupère tous les enregistrements d'une organisation depuis IndexedDB
   * ⚠️ CRITIQUE: Ne jamais masquer DB_UNAVAILABLE en retournant [] silencieusement
   */
  async getAll(organizationId: string, filters?: any): Promise<T[]> {
    const db = await this.getDb();
    const table = db[this.config.tableName] as any;
    let query = table.where('organizationId').equals(organizationId);

    // Appliquer les filtres personnalisés si fournis
    if (filters && typeof this.applyFilters === 'function') {
      query = this.applyFilters(query, filters);
    }

    return query.toArray();
  }

  /**
   * Récupère un enregistrement par ID depuis IndexedDB
   * ⚠️ CRITIQUE: Ne jamais masquer DB_UNAVAILABLE en retournant null silencieusement
   */
  async getById(id: string, organizationId: string): Promise<T | null> {
    const db = await this.getDb();
    const table = db[this.config.tableName] as any;
    const item = await table.get(id);

    if (!item || item.organizationId !== organizationId) {
      return null;
    }

    return item as T;
  }

  /**
   * Crée ou met à jour un enregistrement localement
   */
  async upsert(
    data: Partial<T> & { organizationId: string },
    organizationId: string
  ): Promise<T> {
    try {
      const now = new Date().toISOString();
      const itemId = data.id || uuidv4();
      
      // 🔍 DEBUG: Log dès l'entrée dans upsert pour voir ce qui est dans data
      if (process.env.NODE_ENV === 'development' && 'status' in data) {
        console.log(`[BaseOfflineRepository] 🔍 ENTRÉE upsert - ${this.config.entityName}:`, {
          id: itemId,
          dataStatus: data.status,
          dataKeys: Object.keys(data),
          hasStatusInData: 'status' in data,
        });
      }

      // Sauvegarder dans IndexedDB
      const db = await this.getDb();
    
    // ⚠️ GESTION SPÉCIALE : db.Transaction peut être une fonction au lieu d'un objet Table
    // Utiliser db.tables.find() pour obtenir la vraie table
    let table: any;
    if (this.config.tableName === 'Transaction') {
      // Pour Transaction, chercher dans db.tables d'abord
      const transactionTable = db.tables.find((t: any) => t.name === 'Transaction');
      if (transactionTable && typeof transactionTable.put === 'function') {
        table = transactionTable;
      } else {
        // Fallback : essayer db.Transaction directement
        const dbTransaction = (db as any).Transaction;
        if (dbTransaction && typeof dbTransaction.put === 'function') {
          table = dbTransaction;
        } else {
          // Dernier recours : utiliser db.Transaction comme fonction (si c'est une méthode)
          // Mais normalement, db.Transaction devrait être une table
          console.error('[BaseOfflineRepository] Table Transaction non accessible:', {
            hasTables: !!db.tables,
            tablesCount: db.tables?.length,
            dbTransactionType: typeof dbTransaction,
            dbTransactionPut: typeof dbTransaction?.put
          });
          throw new Error('Table Transaction non accessible dans IndexedDB');
        }
      }
    } else {
      table = db[this.config.tableName] as any;
    }
    
    if (!table || typeof table.put !== 'function') {
      console.error('[BaseOfflineRepository] Table invalide:', {
        tableName: this.config.tableName,
        tableType: typeof table,
        hasPut: typeof table?.put
      });
      throw new Error(`Table ${String(this.config.tableName)} n'est pas accessible ou n'a pas de méthode put`);
    }
    
    // ✅ VÉRIFIER si l'item existe RÉELLEMENT dans IndexedDB pour déterminer create vs update
    const existing = await table.get(itemId);
    const isUpdate = !!existing && existing.organizationId === organizationId;
    
    // 🔍 DEBUG: Log pour voir l'existant
    if (isUpdate && process.env.NODE_ENV === 'development' && 'status' in data) {
      console.log(`[BaseOfflineRepository] 🔍 EXISTANT - ${this.config.entityName}:`, {
        id: itemId,
        existingStatus: existing.status,
        dataStatus: data.status,
      });
    }

    // Normaliser les données (à surcharger dans les sous-classes si besoin)
    const normalizedData = await this.normalizeForLocal(data, isUpdate);
    
    // 🔍 DEBUG: Log pour voir ce qui est dans normalizedData
    if (isUpdate && process.env.NODE_ENV === 'development' && 'status' in data) {
      console.log(`[BaseOfflineRepository] 🔍 normalizeForLocal - ${this.config.entityName}:`, {
        id: itemId,
        dataStatus: data.status,
        normalizedDataStatus: normalizedData.status,
        normalizedDataKeys: Object.keys(normalizedData),
        hasStatusInNormalized: 'status' in normalizedData,
      });
    }
    
    // ⚠️ CRITIQUE: Pour un update, merger avec l'existant pour ne pas perdre les autres champs
    // table.put() remplace complètement l'objet, donc il faut inclure tous les champs existants
    // ⚠️ FIX: S'assurer que les champs booléens comme isActive sont explicitement propagés
    // Le spread peut avoir des problèmes avec false, donc on force explicitement
    const mergedData: any = { ...existing, ...normalizedData };
    
    // ✅ FIX CRITIQUE: Forcer explicitement les champs critiques qui doivent être écrasés
    // Le spread peut ne pas écraser correctement certains champs (booléens, strings, etc.)
    if (normalizedData) {
      // Forcer isActive si présent
      if ('isActive' in normalizedData) {
        mergedData.isActive = Boolean(normalizedData.isActive);
      }
      // Forcer status si présent (CRITIQUE pour la résiliation)
      if ('status' in normalizedData && normalizedData.status !== undefined) {
        mergedData.status = normalizedData.status;
      }
      // Forcer d'autres champs critiques si nécessaire
      if ('isArchived' in normalizedData) {
        mergedData.isArchived = Boolean(normalizedData.isArchived);
      }
    }
    
    // ✅ CRITIQUE: Construire localItem en forçant explicitement les champs critiques
    const localItemBase: any = isUpdate
      ? {
          ...mergedData,
          id: itemId,
          organizationId,
          updatedAt: now,
          createdAt: existing.createdAt, // Conserver la date de création originale
          _localUpdatedAt: now,
        }
      : {
          ...normalizedData,
          id: itemId,
          organizationId,
          updatedAt: now,
          createdAt: data.createdAt || now,
          _localUpdatedAt: now,
        };
    
    // ✅ FIX CRITIQUE: Forcer explicitement le status dans localItem si présent dans normalizedData
    // Le spread peut ne pas fonctionner correctement dans certains cas
    if (isUpdate && normalizedData && 'status' in normalizedData && normalizedData.status !== undefined) {
      localItemBase.status = normalizedData.status;
      if (process.env.NODE_ENV === 'development') {
        console.log(`[BaseOfflineRepository] ✅ Status forcé dans localItem:`, {
          id: itemId,
          status: normalizedData.status,
          localItemBaseStatus: localItemBase.status,
        });
      }
    }
    
    const localItem = localItemBase as T;
    
    // 🔍 DEBUG: Log pour diagnostiquer le problème de mise à jour isActive
    if (isUpdate && process.env.NODE_ENV === 'development' && 'isActive' in normalizedData) {
      console.log(`[BaseOfflineRepository] 🔄 Update ${this.config.entityName}:`, {
        id: itemId,
        existingIsActive: existing.isActive,
        normalizedIsActive: normalizedData.isActive,
        finalIsActive: localItem.isActive,
        normalizedDataKeys: Object.keys(normalizedData),
      });
    }
    
    try {
      // 🔍 DEBUG: Log avant put pour diagnostiquer
      if (isUpdate && process.env.NODE_ENV === 'development' && 'status' in normalizedData) {
        console.log(`[BaseOfflineRepository] 🔄 AVANT put - Update ${this.config.entityName}:`, {
          id: itemId,
          existingStatus: existing.status,
          normalizedStatus: normalizedData.status,
          mergedStatus: mergedData.status,
          localItemStatus: localItem.status,
        });
      }
      
      await table.put(localItem);
      
      // 🔍 DEBUG: Vérifier que l'écriture a bien fonctionné
      if (isUpdate && process.env.NODE_ENV === 'development') {
        const verify = await table.get(itemId);
        const debugInfo: any = {
          id: itemId,
          updatedAt: verify?.updatedAt,
        };
        
        if ('isActive' in normalizedData) {
          debugInfo.isActive = verify?.isActive;
          debugInfo.expectedIsActive = normalizedData.isActive;
        }
        if ('status' in normalizedData) {
          debugInfo.status = verify?.status;
          debugInfo.expectedStatus = normalizedData.status;
          debugInfo.statusMatch = verify?.status === normalizedData.status;
        }
        
        console.log(`[BaseOfflineRepository] ✅ APRÈS put - Vérification:`, debugInfo);
        
        // ⚠️ ALERTE si le status n'a pas été mis à jour
        if ('status' in normalizedData && verify?.status !== normalizedData.status) {
          console.error(`[BaseOfflineRepository] ❌ ERREUR: Le status n'a pas été mis à jour!`, {
            expected: normalizedData.status,
            actual: verify?.status,
            entity: this.config.entityName,
            id: itemId,
          });
        }
      }
    } catch (error: any) {
      console.error(`[BaseOfflineRepository] ❌ Erreur lors de table.put() pour ${this.config.entityName}:`, {
        id: itemId,
        error: error.message,
        stack: error.stack,
        localItem: JSON.stringify(localItem, null, 2),
      });
      throw error;
    }

    // Créer une opération en attente
    // ✅ Pour UPDATE, envoyer seulement les champs modifiés (pas tout l'objet)
    const pendingPayload = isUpdate 
      ? normalizedData // Seulement les champs modifiés
      : localItem; // Tout l'objet pour CREATE
    
    // ⚠️ CRITIQUE: Créer la pendingOp même en offline
    // Cette opération DOIT réussir pour que l'action soit traçable
    if (process.env.NODE_ENV === 'development') {
      console.log(`[BaseOfflineRepository] 📝 Création de la pendingOp pour ${this.config.entityName}:`, {
        operation: isUpdate ? 'update' : 'create',
        entityId: itemId,
        organizationId,
        payloadKeys: Object.keys(pendingPayload),
      });
    }
    
    try {
      await this.createPendingOperation(
        isUpdate ? 'update' : 'create',
        itemId,
        pendingPayload,
        organizationId
      );
      if (process.env.NODE_ENV === 'development') {
        console.log(`[BaseOfflineRepository] ✅ PendingOp créée avec succès pour ${this.config.entityName}:`, itemId);
      }
    } catch (pendingOpError: any) {
      // ⚠️ CRITIQUE: Si la création de la pendingOp échoue, on doit le savoir
      console.error(`[BaseOfflineRepository] ❌ ERREUR CRITIQUE: Impossible de créer la pendingOp pour ${this.config.entityName}:`, {
        entityId: itemId,
        organizationId,
        operation: isUpdate ? 'update' : 'create',
        error: pendingOpError.message,
        stack: pendingOpError.stack,
      });
      // ⚠️ CRITIQUE: Propager l'erreur pour que l'appelant sache que la pendingOp n'a pas été créée
      throw new Error(`Échec de la création de la pendingOp: ${pendingOpError.message}`);
    }

      // DÉSACTIVÉ : Auto-sync immédiate après création/modification
      // La synchronisation se fait uniquement sur clic du bouton
      // if (typeof navigator !== 'undefined' && navigator.onLine) {
      //   this.triggerSync(organizationId).catch(console.error);
      // }

      return localItem;
    } catch (error: any) {
      // ⚠️ CRITIQUE: Si DB indisponible, throw une erreur typée (ne pas masquer)
      if (error instanceof DbUnavailableError) {
        throw error; // Re-throw tel quel
      }
      throw error;
    }
  }

  /**
   * Supprime un enregistrement localement (soft delete ou hard delete)
   */
  async delete(
    id: string,
    organizationId: string,
    mode: 'soft' | 'hard' = 'soft'
  ): Promise<void> {
    try {
      const item = await this.getById(id, organizationId);

    if (!item) {
      throw new Error(`${this.config.entityName} non trouvé`);
    }

    const now = new Date().toISOString();
    const db = await this.getDb();
    const table = db[this.config.tableName] as any;

    if (mode === 'soft') {
      // Soft delete: utiliser deletedAt ou isArchived selon l'entité
      const updateData = await this.getSoftDeleteData(item, now);
      await table.update(id, {
        ...updateData,
        updatedAt: now,
        _localUpdatedAt: now,
      });

      // Créer une opération en attente pour soft delete
      await this.createPendingOperation('update', id, updateData, organizationId);
    } else {
      // Hard delete: supprimer complètement
      console.log(`[BaseOfflineRepository] 🗑️ Hard delete ${this.config.entityName} ${id} pour org ${organizationId}`);
      await table.delete(id);
      console.log(`[BaseOfflineRepository] ✅ Supprimé de IndexedDB: ${this.config.entityName} ${id}`);

      // Créer une opération en attente pour hard delete
      console.log(`[BaseOfflineRepository] 📝 Création pendingOp delete pour ${this.config.entityName} ${id}`);
      await this.createPendingOperation('delete', id, {}, organizationId);
      console.log(`[BaseOfflineRepository] ✅ PendingOp delete créée pour ${this.config.entityName} ${id}`);
    }

      // ✅ DÉSACTIVÉ : Auto-sync immédiate après suppression
      // La synchronisation se fait uniquement sur clic du bouton ou sync auto
      // if (typeof navigator !== 'undefined' && navigator.onLine) {
      //   this.triggerSync(organizationId);
      // }
    } catch (error: any) {
      // ⚠️ CRITIQUE: Si DB indisponible, throw une erreur typée (ne pas masquer)
      if (error instanceof DbUnavailableError) {
        throw error; // Re-throw tel quel
      }
      throw error;
    }
  }

  /**
   * Normalise les données pour le stockage local
   * À surcharger dans les sous-classes si besoin de transformations spécifiques
   */
  protected async normalizeForLocal(
    data: Partial<T>,
    isUpdate: boolean
  ): Promise<Partial<T>> {
    return data;
  }

  /**
   * Retourne les données pour le soft delete
   * À surcharger dans les sous-classes selon le schéma de l'entité
   */
  protected async getSoftDeleteData(
    item: T,
    deletedAt: string
  ): Promise<Partial<T>> {
    // Par défaut, utiliser deletedAt ou isArchived
    if ('deletedAt' in item) {
      return { deletedAt } as Partial<T>;
    }
    if ('isArchived' in item) {
      return { isArchived: true, archivedAt: deletedAt } as Partial<T>;
    }
    // Fallback: ajouter deletedAt si possible
    return { deletedAt } as Partial<T>;
  }

  /**
   * Applique les filtres personnalisés
   * À surcharger dans les sous-classes si besoin
   */
  protected applyFilters?(query: any, filters: any): any;

  /**
   * Crée une opération en attente
   * ✅ OPTIMISATION: Supprime les pendingOps existantes pour la même entité/opération pour éviter les doublons
   */
  private async createPendingOperation(
    operation: 'create' | 'update' | 'delete',
    entityId: string,
    payload: any,
    organizationId: string
  ): Promise<void> {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[BaseOfflineRepository] 📝 createPendingOperation - Début:`, {
        entity: this.config.entityName,
        entityId,
        operation,
        organizationId,
      });
    }
    
    let db;
    try {
      db = await this.getDb();
      if (process.env.NODE_ENV === 'development') {
        console.log(`[BaseOfflineRepository] 📝 DB récupérée pour createPendingOperation`);
      }
    } catch (dbError: any) {
      console.error(`[BaseOfflineRepository] ❌ ERREUR CRITIQUE: Impossible d'accéder à la DB:`, {
        error: dbError.message,
        stack: dbError.stack,
      });
      throw new Error(`Impossible d'accéder à IndexedDB pour créer la pendingOp: ${dbError.message}`);
    }
    
    // ✅ OPTIMISATION: Supprimer les pendingOps existantes pour la même entité/opération
    // Cela évite les doublons si upsert() est appelé plusieurs fois rapidement
    try {
      // Utiliser l'index [entity+status] puis filtrer manuellement
      const allPendingOps = await db.pendingOperations
        .where('[entity+status]')
        .equals([this.config.entityName, 'pending'])
        .toArray();
      
      const allSyncingOps = await db.pendingOperations
        .where('[entity+status]')
        .equals([this.config.entityName, 'syncing'])
        .toArray();
      
      // Filtrer pour trouver les ops correspondant à entityId + operation
      const existingOps = [...allPendingOps, ...allSyncingOps].filter(
        op => op.entityId === entityId && op.operation === operation
      );
      
      if (existingOps.length > 0) {
        // ✅ CRITIQUE: Supprimer TOUTES les pendingOps existantes AVANT de créer la nouvelle
        // Utiliser une transaction pour garantir l'atomicité
        await db.transaction('rw', db.pendingOperations, async () => {
          await Promise.all(existingOps.map(op => db.pendingOperations.delete(op.id)));
        });
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`[BaseOfflineRepository] 🗑️ ${existingOps.length} pendingOp(s) existante(s) supprimée(s) pour éviter les doublons:`, {
            entity: this.config.entityName,
            entityId,
            operation,
            deletedIds: existingOps.map(op => op.id)
          });
        }
      }
    } catch (error: any) {
      // Si erreur, continuer quand même (ne pas bloquer)
      console.warn(`[BaseOfflineRepository] ⚠️ Impossible de vérifier les pendingOps existantes:`, {
        error: error.message,
        stack: error.stack,
      });
    }
    
    const now = new Date().toISOString();
    const pendingOp: PendingOperation = {
      id: uuidv4(),
      entity: this.config.entityName,
      entityId,
      operation,
      payload,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      retryCount: 0,
      organizationId, // ✅ CRITIQUE: Ajouter organizationId à la pendingOp
    };

    if (process.env.NODE_ENV === 'development') {
      console.log(`[BaseOfflineRepository] 📝 Tentative d'ajout de la pendingOp dans IndexedDB:`, {
        id: pendingOp.id,
        entity: pendingOp.entity,
        entityId: pendingOp.entityId,
        operation: pendingOp.operation,
        organizationId: pendingOp.organizationId,
      });
    }

    try {
      await db.pendingOperations.add(pendingOp);
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`[BaseOfflineRepository] ✅ PendingOp ajoutée dans IndexedDB avec succès`);
      }
      
      // Émettre des événements pour notifier qu'une nouvelle pendingOp a été créée
      // Cela permettra à la vue sync de se rafraîchir automatiquement
      if (typeof window !== 'undefined') {
        if (process.env.NODE_ENV === 'development') {
          console.log(`[BaseOfflineRepository] 📢 Émission des événements pendingOp:created et sync:refresh`);
        }
        // Émettre l'événement spécifique pendingOp:created
        window.dispatchEvent(new CustomEvent('pendingOp:created', {
          detail: { pendingOp, organizationId }
        }));
        // Émettre aussi sync:refresh pour forcer le rafraîchissement de la vue sync
        window.dispatchEvent(new CustomEvent('sync:refresh'));
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`[BaseOfflineRepository] ✅ PendingOp créée avec succès:`, {
          id: pendingOp.id,
          entity: pendingOp.entity,
          entityId: pendingOp.entityId,
          operation: pendingOp.operation,
          organizationId: pendingOp.organizationId,
          status: pendingOp.status,
        });
      }
    } catch (error: any) {
      console.error(`[BaseOfflineRepository] ❌ ERREUR CRITIQUE lors de la création de la pendingOp:`, {
        entity: pendingOp.entity,
        entityId: pendingOp.entityId,
        operation: pendingOp.operation,
        organizationId: pendingOp.organizationId,
        error: error.message,
        stack: error.stack,
        errorName: error.name,
        pendingOp: JSON.stringify(pendingOp, null, 2),
      });
      // ⚠️ CRITIQUE: Propager l'erreur pour que l'appelant sache que la pendingOp n'a pas été créée
      throw error;
    }
  }

  /**
   * Déclenche la synchronisation (à implémenter par le service de sync global)
   */
  protected triggerSync(organizationId: string): void {
    // Déclencher la synchronisation globale (non bloquant)
    if (typeof window !== 'undefined') {
      import('../syncGlobal').then(({ getGlobalSyncService }) => {
        getGlobalSyncService().syncAllPendingToRemote(organizationId).catch(console.error);
      });
    }
  }

  /**
   * Force une synchronisation complète
   */
  async forceSync(organizationId: string): Promise<any> {
    // À implémenter avec le service de sync global
    throw new Error('forceSync doit être implémenté par le service de sync');
  }
}




