/**
 * Adapter IndexedDB pour ITransactionRepository
 * Utilise directement la DB locale via Dexie
 */

import { getLocalDB } from '@/lib/offline/db';
import { v4 as uuidv4 } from 'uuid';
import type {
  ITransactionRepository,
  Transaction,
  CreateTransactionData,
  UpdateTransactionData,
  TransactionWhere,
  TransactionContext,
} from '../interfaces/ITransactionRepository';

export class IndexedDBTransactionRepository implements ITransactionRepository {
  private _dbPromise: Promise<any> | null = null;

  private async getDb() {
    if (!this._dbPromise) {
      this._dbPromise = getLocalDB();
    }
    return this._dbPromise;
  }

  /**
   * Obtient la table Transaction de manière fiable
   * ⚠️ GESTION SPÉCIALE : db.Transaction peut être une fonction au lieu d'un objet Table
   */
  private async getTransactionTable() {
    const db = await this.getDb();
    
    // Essayer db.Transaction directement
    if (db.Transaction && typeof db.Transaction.add === 'function') {
      return db.Transaction;
    }
    
    // Fallback : chercher dans db.tables
    const transactionTable = db.tables?.find((t: any) => t.name === 'Transaction');
    if (transactionTable && typeof transactionTable.add === 'function') {
      return transactionTable;
    }
    
    throw new Error('Table Transaction non accessible dans IndexedDB');
  }

  async create(data: CreateTransactionData, ctx?: TransactionContext): Promise<Transaction> {
    const db = await this.getDb();
    // ⚙️ NORMALISATION: Convertir les dates en string ISO complète pour IndexedDB
    // IndexedDB doit stocker les dates au format ISO complet "2025-12-22T00:00:00.000Z"
    // Le formulaire peut envoyer "2025-12-22" (format date HTML), il faut le convertir
    
    // Normaliser date
    let normalizedDate: string = data.date;
    if (normalizedDate) {
      if (normalizedDate instanceof Date) {
        normalizedDate = normalizedDate.toISOString();
      } else if (typeof normalizedDate === 'string') {
        if (normalizedDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
          normalizedDate = `${normalizedDate}T00:00:00.000Z`;
        } else if (!normalizedDate.includes('T')) {
          try {
            const dateObj = new Date(normalizedDate);
            if (!isNaN(dateObj.getTime())) {
              normalizedDate = dateObj.toISOString();
            }
          } catch (e) {
            normalizedDate = new Date().toISOString(); // Fallback
          }
        }
      }
    } else {
      normalizedDate = new Date().toISOString(); // Fallback si date absente
    }
    
    // Normaliser paidAt
    let normalizedPaidAt: string | null = data.paidAt ?? null;
    if (normalizedPaidAt !== null && normalizedPaidAt !== undefined) {
      if (normalizedPaidAt instanceof Date) {
        normalizedPaidAt = normalizedPaidAt.toISOString() as any;
      } else if (typeof normalizedPaidAt === 'string') {
        // Format date HTML: "2025-12-22" (sans heure) → convertir en ISO complet
        if (normalizedPaidAt.match(/^\d{4}-\d{2}-\d{2}$/)) {
          normalizedPaidAt = `${normalizedPaidAt}T00:00:00.000Z` as any;
        } else if (!normalizedPaidAt.includes('T')) {
          // Autre format sans 'T', essayer de le parser
          try {
            const dateObj = new Date(normalizedPaidAt);
            if (!isNaN(dateObj.getTime())) {
              normalizedPaidAt = dateObj.toISOString() as any;
            }
          } catch (e) {
            // En cas d'erreur, garder null
            normalizedPaidAt = null;
          }
        }
        // Si c'est déjà un format ISO avec 'T', le garder tel quel
      }
    }
    
    const transaction: Transaction = {
      id: crypto.randomUUID(),
      organizationId: data.organizationId,
      propertyId: data.propertyId,
      leaseId: data.leaseId ?? null,
      bailId: data.bailId ?? null,
      categoryId: data.categoryId ?? null,
      label: data.label,
      amount: data.amount,
      date: normalizedDate,
      reference: data.reference ?? null,
      notes: data.notes ?? null,
      paidAt: normalizedPaidAt,
      method: data.method ?? null,
      accounting_month: data.accounting_month ?? null,
      monthsCovered: data.monthsCovered ?? null,
      moisIndex: data.moisIndex ?? null,
      moisTotal: data.moisTotal ?? null,
      rapprochementStatus: data.rapprochementStatus ?? 'non_rapprochee',
      dateRapprochement: data.dateRapprochement ?? null,
      bankRef: data.bankRef ?? null,
      montantLoyer: data.montantLoyer ?? null,
      chargesRecup: data.chargesRecup ?? null,
      chargesNonRecup: data.chargesNonRecup ?? null,
      isAutoAmount: data.isAutoAmount ?? null,
      nature: data.nature ?? null,
      parentTransactionId: data.parentTransactionId ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const transactionTable = await this.getTransactionTable();
    await transactionTable.add(transaction);
    
    // ✅ Créer une pendingOp pour la synchronisation
    const organizationId = data.organizationId || ctx?.organizationId;
    if (!organizationId) {
      console.warn('[IndexedDBTransactionRepository] OrganizationId manquant pour créer la pendingOp, transaction créée localement uniquement');
    } else {
      const now = new Date().toISOString();
      const pendingOp = {
        id: uuidv4(),
        entity: 'transaction',
        entityId: transaction.id,
        operation: 'create',
        payload: transaction, // Envoyer toute la transaction comme payload
        status: 'pending',
        createdAt: now,
        updatedAt: now,
        retryCount: 0,
        organizationId, // ✅ CRITIQUE: Pour affichage page Sync et filtrage par org
      };
      
      await db.pendingOperations.add(pendingOp);
    }
    
    return transaction;
  }

  async update(id: string, data: UpdateTransactionData, ctx?: TransactionContext): Promise<Transaction> {
    const db = await this.getDb();
    const transactionTable = await this.getTransactionTable();
    const existing = await transactionTable.get(id);
    if (!existing) {
      throw new Error(`Transaction ${id} not found`);
    }

    // 🔍 DIAGNOSTIC: Log pour tracer les champs method et paidAt
    const { logToServer } = await import('@/lib/utils/logger');
    await logToServer(`[IndexedDBTransactionRepository] 🔍 update - existing.method=${existing.method}, existing.paidAt=${existing.paidAt}, data.method=${data.method}, data.paidAt=${data.paidAt}`);
    await logToServer(`[IndexedDBTransactionRepository] 🔍 update - data complet (keys): ${JSON.stringify(Object.keys(data))}`);
    if (data.method !== undefined) {
      await logToServer(`[IndexedDBTransactionRepository] 🔍 update - method sera mis à jour: ${data.method}`);
    }
    if (data.paidAt !== undefined) {
      await logToServer(`[IndexedDBTransactionRepository] 🔍 update - paidAt sera mis à jour: ${data.paidAt} (type: ${typeof data.paidAt})`);
    }

    // ⚙️ NORMALISATION: Convertir les dates en string ISO complète pour IndexedDB
    // IndexedDB doit stocker les dates au format ISO complet "2025-12-22T00:00:00.000Z"
    // Le formulaire peut envoyer "2025-12-22" (format date HTML), il faut le convertir
    const normalizedData = { ...data };
    
    // Normaliser date
    if (normalizedData.date !== null && normalizedData.date !== undefined) {
      if (normalizedData.date instanceof Date) {
        normalizedData.date = normalizedData.date.toISOString() as any;
        await logToServer(`[IndexedDBTransactionRepository] ⚙️ date converti de Date vers ISO string: ${normalizedData.date}`);
      } else if (typeof normalizedData.date === 'string') {
        // Format date HTML: "2025-12-22" (sans heure) → convertir en ISO complet
        if (normalizedData.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
          normalizedData.date = `${normalizedData.date}T00:00:00.000Z` as any;
          await logToServer(`[IndexedDBTransactionRepository] ⚙️ date converti de date simple "${data.date}" vers ISO complet: ${normalizedData.date}`);
        } else if (!normalizedData.date.includes('T')) {
          try {
            const dateObj = new Date(normalizedData.date);
            if (!isNaN(dateObj.getTime())) {
              normalizedData.date = dateObj.toISOString() as any;
              await logToServer(`[IndexedDBTransactionRepository] ⚙️ date converti vers ISO: ${normalizedData.date}`);
            }
          } catch (e) {
            await logToServer(`[IndexedDBTransactionRepository] ⚠️ Erreur conversion date: ${normalizedData.date}`, 'error');
          }
        }
      }
    }
    
    // Normaliser paidAt
    if (normalizedData.paidAt !== null && normalizedData.paidAt !== undefined) {
      if (normalizedData.paidAt instanceof Date) {
        normalizedData.paidAt = normalizedData.paidAt.toISOString() as any;
        await logToServer(`[IndexedDBTransactionRepository] ⚙️ paidAt converti de Date vers ISO string: ${normalizedData.paidAt}`);
      } else if (typeof normalizedData.paidAt === 'string') {
        // Si c'est une string, vérifier le format
        // Format date HTML: "2025-12-22" (sans heure)
        // Format ISO complet: "2025-12-22T00:00:00.000Z" (avec heure et timezone)
        if (normalizedData.paidAt.match(/^\d{4}-\d{2}-\d{2}$/)) {
          // Format date simple "YYYY-MM-DD", convertir en ISO complet
          normalizedData.paidAt = `${normalizedData.paidAt}T00:00:00.000Z` as any;
          await logToServer(`[IndexedDBTransactionRepository] ⚙️ paidAt converti de date simple "${data.paidAt}" vers ISO complet: ${normalizedData.paidAt}`);
        } else if (!normalizedData.paidAt.includes('T')) {
          // Autre format sans 'T', essayer de le parser
          try {
            const dateObj = new Date(normalizedData.paidAt);
            if (!isNaN(dateObj.getTime())) {
              normalizedData.paidAt = dateObj.toISOString() as any;
              await logToServer(`[IndexedDBTransactionRepository] ⚙️ paidAt converti vers ISO: ${normalizedData.paidAt}`);
            }
          } catch (e) {
            await logToServer(`[IndexedDBTransactionRepository] ⚠️ Erreur conversion paidAt: ${normalizedData.paidAt}`, 'error');
          }
        }
        // Si c'est déjà un format ISO avec 'T', le garder tel quel
      }
    }

    // ✅ CRITIQUE: updatedAt est TOUJOURS une string ISO dans IndexedDB
    // Normaliser pour garantir la cohérence avec les autres repositories
    const updated: Transaction = {
      ...existing,
      ...normalizedData,
      updatedAt: new Date().toISOString(), // String ISO (comme dans BaseOfflineRepository)
    };

    // 🔍 DIAGNOSTIC: Vérifier la valeur après merge
    await logToServer(`[IndexedDBTransactionRepository] 🔍 update - updated.method après merge: ${updated.method}, updated.paidAt après merge: ${updated.paidAt} (type: ${typeof updated.paidAt})`);
    
    await transactionTable.put(updated);
    
    // 🔍 DIAGNOSTIC: Vérifier dans IndexedDB après put
    const verify = await transactionTable.get(id);
    await logToServer(`[IndexedDBTransactionRepository] 🔍 update - verify.method dans IndexedDB après put: ${verify?.method}, verify.paidAt: ${verify?.paidAt}`);
    await logToServer(`[IndexedDBTransactionRepository] 🔍 update - verify complet (keys): ${JSON.stringify(Object.keys(verify || {}))}`);
    await logToServer(`[IndexedDBTransactionRepository] 🔍 update - verify.method type: ${typeof verify?.method}, verify.paidAt type: ${typeof verify?.paidAt}`);
    
    // 🔍 DIAGNOSTIC: Vérifier aussi via getAll pour voir si la transaction est bien récupérée
    const allTransactions = await transactionTable.where('organizationId').equals(existing.organizationId).toArray();
    const foundTransaction = allTransactions.find(t => t.id === id);
    if (foundTransaction) {
      await logToServer(`[IndexedDBTransactionRepository] 🔍 update - Transaction trouvée via getAll: id=${foundTransaction.id}, method="${foundTransaction.method}", paidAt="${foundTransaction.paidAt}"`);
    } else {
      await logToServer(`[IndexedDBTransactionRepository] ⚠️ update - Transaction ${id} NON trouvée via getAll après put`);
    }
    
    // ✅ Créer une pendingOp pour la synchronisation
    const organizationId = existing.organizationId || ctx?.organizationId;
    if (!organizationId) {
      console.warn('[IndexedDBTransactionRepository] OrganizationId manquant pour créer la pendingOp, transaction mise à jour localement uniquement');
    } else {
      const now = new Date().toISOString();
      const pendingOp = {
        id: uuidv4(),
        entity: 'transaction',
        entityId: id,
        operation: 'update',
        payload: data, // Envoyer uniquement les champs modifiés
        status: 'pending',
        createdAt: now,
        updatedAt: now,
        retryCount: 0,
        organizationId, // ✅ CRITIQUE: Pour affichage page Sync et filtrage par org
      };
      
      await db.pendingOperations.add(pendingOp);
    }
    
    return updated as Transaction;
  }

  async delete(id: string, ctx?: TransactionContext): Promise<void> {
    const db = await this.getDb();
    const transactionTable = await this.getTransactionTable();
    
    // Récupérer la transaction avant suppression pour obtenir organizationId
    const existing = await transactionTable.get(id);
    if (!existing) {
      return; // Transaction déjà supprimée ou inexistante
    }
    
    const organizationId = existing.organizationId || ctx?.organizationId;
    if (!organizationId) {
      throw new Error('OrganizationId requis pour créer la pendingOp');
    }
    
    // Supprimer de IndexedDB
    await transactionTable.delete(id);
    
    // ✅ Créer une pendingOp pour la synchronisation
    const now = new Date().toISOString();
    const pendingOp = {
      id: uuidv4(),
      entity: 'transaction',
      entityId: id,
      operation: 'delete',
      payload: {},
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      retryCount: 0,
      organizationId, // ✅ CRITIQUE: Pour affichage page Sync et filtrage par org
    };
    
    await db.pendingOperations.add(pendingOp);
  }

  /**
   * Supprime une transaction localement SANS créer de pendingOp
   * ⚠️ Utilisé uniquement pour les commissions auto en app-shell (server-only, suppression en cascade gérée par le serveur)
   */
  async deleteLocalOnly(id: string): Promise<void> {
    const transactionTable = await this.getTransactionTable();
    
    // Vérifier que la transaction existe
    const existing = await transactionTable.get(id);
    if (!existing) {
      return; // Transaction déjà supprimée ou inexistante
    }
    
    // Supprimer uniquement de IndexedDB (pas de pendingOp)
    await transactionTable.delete(id);
  }

  async deleteMany(where: TransactionWhere, ctx?: TransactionContext): Promise<void> {
    const transactionTable = await this.getTransactionTable();
    let query = transactionTable.where('organizationId').equals(where.organizationId!);

    if (where.propertyId) {
      query = query.filter((t: any) => t.propertyId === where.propertyId);
    }
    if (where.leaseId !== undefined) {
      if (where.leaseId === null) {
        query = query.filter((t: any) => t.leaseId === null);
      } else {
        query = query.filter((t: any) => t.leaseId === where.leaseId);
      }
    }
    if (where.categoryId) {
      query = query.filter((t: any) => t.categoryId === where.categoryId);
    }
    if (where.parentTransactionId !== undefined) {
      if (where.parentTransactionId === null) {
        query = query.filter((t: any) => t.parentTransactionId === null);
      } else {
        query = query.filter((t: any) => t.parentTransactionId === where.parentTransactionId);
      }
    }
    if (where.isAuto !== undefined) {
      query = query.filter((t: any) => t.isAuto === where.isAuto);
    }
    if (where.autoSource) {
      query = query.filter((t: any) => t.autoSource === where.autoSource);
    }

    const toDelete = await query.toArray();
    const ids = toDelete.map((t: any) => t.id);
    await transactionTable.bulkDelete(ids);
  }

  async findById(id: string, ctx?: TransactionContext): Promise<Transaction | null> {
    const transactionTable = await this.getTransactionTable();
    const transaction = await transactionTable.get(id);
    return transaction as Transaction | null;
  }

  async findByPropertyId(propertyId: string, ctx?: TransactionContext): Promise<Transaction[]> {
    return this.findMany({ propertyId }, ctx);
  }

  async findMany(where: TransactionWhere, ctx?: TransactionContext): Promise<Transaction[]> {
    const transactionTable = await this.getTransactionTable();
    let query = transactionTable.where('organizationId').equals(where.organizationId!);

    if (where.id) {
      const tx = await transactionTable.get(where.id);
      return tx ? [tx as Transaction] : [];
    }
    if (where.propertyId) {
      query = query.filter((t: any) => t.propertyId === where.propertyId);
    }
    if (where.leaseId !== undefined) {
      if (where.leaseId === null) {
        query = query.filter((t: any) => t.leaseId === null);
      } else {
        query = query.filter((t: any) => t.leaseId === where.leaseId);
      }
    }
    if (where.categoryId) {
      query = query.filter((t: any) => t.categoryId === where.categoryId);
    }
    if (where.nature) {
      if (typeof where.nature === 'string') {
        query = query.filter((t: any) => t.nature === where.nature);
      } else if (where.nature && 'in' in where.nature) {
        query = query.filter((t: any) => where.nature && 'in' in where.nature && where.nature.in.includes(t.nature));
      }
    }
    if (where.parentTransactionId !== undefined) {
      if (where.parentTransactionId === null) {
        query = query.filter((t: any) => t.parentTransactionId === null);
      } else {
        query = query.filter((t: any) => t.parentTransactionId === where.parentTransactionId);
      }
    }
    if (where.isAuto !== undefined) {
      query = query.filter((t: any) => t.isAuto === where.isAuto);
    }
    if (where.autoSource) {
      query = query.filter((t: any) => t.autoSource === where.autoSource);
    }

    const results = await query.toArray();
    return results as Transaction[];
  }

  async findFirst(where: TransactionWhere, ctx?: TransactionContext): Promise<Transaction | null> {
    const results = await this.findMany(where, ctx);
    return results[0] || null;
  }
}


