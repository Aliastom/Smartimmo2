/**
 * Repository offline-first pour les transactions (Transaction)
 */

import { BaseOfflineRepository } from './BaseOfflineRepository';
import { getLocalDB } from '../db';
import type { LocalTransaction } from '../db';

export interface TransactionFilters {
  propertyId?: string;
  leaseId?: string;
  dateFrom?: string;
  dateTo?: string;
  nature?: string;
}

export class TransactionRepositoryOffline extends BaseOfflineRepository<LocalTransaction> {
  constructor() {
    super({
      entityName: 'transaction',
      tableName: 'Transaction',
      apiRoute: '/api/transactions',
    });
  }

  /**
   * Récupère toutes les transactions d'une organisation avec filtres optionnels
   */
  async getAll(organizationId: string, filters: TransactionFilters = {}): Promise<LocalTransaction[]> {
    // ⚠️ GESTION SPÉCIALE : db.Transaction est une fonction au lieu d'un objet Table
    // Récupérer la vraie table via db.tables.find()
    const db = await this.getDb();
    let table = (db as any).Transaction;
    if (!table || typeof table === 'function' || typeof table.where !== 'function') {
      const transactionTable = db.tables.find((t: any) => t.name === 'Transaction');
      if (transactionTable && typeof transactionTable.where === 'function') {
        table = transactionTable;
      } else {
        throw new Error('Table Transaction non accessible dans IndexedDB');
      }
    }
    
    let query = table.where('organizationId').equals(organizationId);

    if (filters.propertyId) {
      query = query.filter(t => t.propertyId === filters.propertyId);
    }

    if (filters.leaseId) {
      query = query.filter(t => t.leaseId === filters.leaseId);
    }

    if (filters.nature) {
      query = query.filter(t => t.nature === filters.nature);
    }

    if (filters.dateFrom || filters.dateTo) {
      query = query.filter(t => {
        const date = new Date(t.date);
        if (filters.dateFrom && date < new Date(filters.dateFrom)) return false;
        if (filters.dateTo && date > new Date(filters.dateTo)) return false;
        return true;
      });
    }

    const transactions = await query.toArray();
    
    // DÉSACTIVÉ : Sync automatique supprimée pour respecter le principe offline-first
    // La synchronisation doit être explicite via la page /app?view=sync ou les boutons dédiés
    // if (typeof navigator !== 'undefined' && navigator.onLine) {
    //   const { getGlobalSyncService } = await import('../syncGlobal');
    //   getGlobalSyncService().syncAllFromRemote(organizationId).catch(console.error);
    // }

    return transactions;
  }

  /**
   * Récupère une transaction par ID depuis IndexedDB
   * Surcharge pour gérer le cas spécial de la table Transaction
   */
  async getById(id: string, organizationId: string): Promise<LocalTransaction | null> {
    // ⚠️ GESTION SPÉCIALE : db.Transaction est une fonction au lieu d'un objet Table
    const db = await this.getDb();
    let table = (db as any).Transaction;
    if (!table || typeof table === 'function' || typeof table.get !== 'function') {
      const transactionTable = db.tables.find((t: any) => t.name === 'Transaction');
      if (transactionTable && typeof transactionTable.get === 'function') {
        table = transactionTable;
      } else {
        throw new Error('Table Transaction non accessible dans IndexedDB');
      }
    }

    const item = await table.get(id);

    if (!item || item.organizationId !== organizationId) {
      return null;
    }

    return item as LocalTransaction;
  }

  /**
   * Surcharge upsert pour gérer le cas spécial de la table Transaction
   * Utilise la même approche que getById/getAll pour accéder à la table
   */
  async upsert(
    data: Partial<LocalTransaction> & { organizationId: string },
    organizationId: string
  ): Promise<LocalTransaction> {
    const now = new Date().toISOString();
    const isUpdate = !!data.id;
    const itemId = data.id || crypto.randomUUID();

    // ⚠️ GESTION SPÉCIALE : db.Transaction est une fonction au lieu d'un objet Table
    // Récupérer la vraie table via db.tables.find() (comme dans getById/getAll)
    const db = await this.getDb();
    let table = (db as any).Transaction;
    if (!table || typeof table === 'function' || typeof table.put !== 'function') {
      const transactionTable = db.tables.find((t: any) => t.name === 'Transaction');
      if (transactionTable && typeof transactionTable.put === 'function') {
        table = transactionTable;
      } else {
        throw new Error('Table Transaction non accessible dans IndexedDB');
      }
    }

    let localItem: LocalTransaction;

    if (isUpdate) {
      // ⚠️ CRITIQUE : Pour un update, récupérer la transaction existante et merger avec les nouvelles données
      // Sinon, table.put() remplace complètement l'objet et perd tous les autres champs
      const existingTransaction = await this.getById(itemId, organizationId);
      if (!existingTransaction) {
        throw new Error('Transaction non trouvée pour mise à jour');
      }

      // Normaliser les données de mise à jour
    const normalizedData = await this.normalizeForLocal(data, isUpdate);
      
      // Merger les données existantes avec les nouvelles données
      localItem = {
        ...existingTransaction,
      ...normalizedData,
      id: itemId,
      organizationId,
      updatedAt: now,
      _localUpdatedAt: now,
    } as LocalTransaction;

      try {
        // Utiliser put() pour remplacer complètement (mais avec l'objet complet merge)
        await table.put(localItem);
      } catch (error: any) {
        console.error('[TransactionRepositoryOffline] Erreur upsert (update):', error);
        throw new Error(`Erreur lors de la mise à jour de la transaction: ${error.message}`);
      }
      } else {
      // Pour une création, construire l'objet complet
      const normalizedData = await this.normalizeForLocal(data, isUpdate);
      localItem = {
        ...normalizedData,
        id: itemId,
        organizationId,
        updatedAt: now,
        createdAt: data.createdAt || now,
        _localUpdatedAt: now,
      } as LocalTransaction;

      try {
        await table.add(localItem);
    } catch (error: any) {
        console.error('[TransactionRepositoryOffline] Erreur upsert (create):', error);
        throw new Error(`Erreur lors de la création de la transaction: ${error.message}`);
      }
    }

    // Créer une opération en attente
    await this.createPendingOperation(
      isUpdate ? 'update' : 'create',
      itemId,
      localItem,
      organizationId
    );

    return localItem;
  }
}

// Instance singleton
let repositoryInstance: TransactionRepositoryOffline | null = null;

export function getTransactionRepositoryOffline(): TransactionRepositoryOffline {
  if (typeof window === 'undefined') {
    throw new Error('TransactionRepositoryOffline ne peut être utilisé que côté client');
  }

  if (!repositoryInstance) {
    repositoryInstance = new TransactionRepositoryOffline();
  }

  return repositoryInstance;
}




