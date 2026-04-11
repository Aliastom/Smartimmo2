/**
 * Adapter IndexedDB pour ILeaseRepository
 * Utilise LeaseRepositoryOffline pour l'accès aux données
 * 
 * ⚠️ RÈGLE CRITIQUE OFFLINE-FIRST (ARCHITECTURE SMARTIMMO APP-SHELL) ⚠️
 * 
 * Toute méthode update / upsert DOIT suivre strictement ce pattern :
 * 
 * 1. READ EXISTING : Lire l'enregistrement existant depuis IndexedDB
 * 2. MERGE : Fusionner {...existing, ...data} pour préserver tous les champs
 * 3. PUT : Faire un put() complet avec l'objet fusionné
 * 
 * ❌ INTERDIT : Faire un put() avec un objet partiel (perte de données)
 * ✅ OBLIGATOIRE : Toujours fusionner avec l'existant avant put()
 * 
 * INVARIANTS SÉCURISÉS :
 * - id et organizationId ne peuvent JAMAIS être écrasés par data
 * - Si existing est undefined → throw explicite avec log clair
 * - updatedAt est toujours mis à jour automatiquement
 */

import { getLeaseRepositoryOffline } from '@/lib/offline/repositories/LeaseRepositoryOffline';
import type {
  ILeaseRepository,
  Lease,
  CreateLeaseData,
  UpdateLeaseData,
  LeaseWhere,
} from '../interfaces/ILeaseRepository';
import { getLocalDB } from '@/lib/offline/db';

export class IndexedDBLeaseRepository implements ILeaseRepository {
  private _dbPromise: Promise<any> | null = null;

  private async getDb() {
    if (!this._dbPromise) {
      this._dbPromise = getLocalDB();
    }
    return this._dbPromise;
  }
  private leaseRepo = getLeaseRepositoryOffline();

  async create(data: CreateLeaseData): Promise<Lease> {
    // ✅ CRITIQUE: Utiliser leaseRepo.upsert() pour créer automatiquement la pendingOp
    const now = new Date().toISOString();
    const leaseData: any = {
      id: crypto.randomUUID(),
      organizationId: data.organizationId,
      propertyId: data.propertyId,
      tenantId: data.tenantId,
      type: data.type,
      furnishedType: data.furnishedType ?? null,
      startDate: typeof data.startDate === 'string' ? data.startDate : data.startDate.toISOString(),
      endDate: data.endDate ? (typeof data.endDate === 'string' ? data.endDate : data.endDate.toISOString()) : null,
      rentAmount: data.rentAmount,
      deposit: data.deposit ?? null,
      paymentDay: data.paymentDay ?? null,
      indexationType: data.indexationType ?? null,
      notes: data.notes ?? null,
      status: data.status ?? null,
      signedPdfUrl: data.signedPdfUrl ?? null,
      chargesRecupMensuelles: data.chargesRecupMensuelles ?? null,
      chargesNonRecupMensuelles: data.chargesNonRecupMensuelles ?? null,
      pilotageIgnored: false,
      createdAt: now,
      updatedAt: now,
    };

    // ✅ Utiliser upsert() qui crée automatiquement la pendingOp via BaseOfflineRepository
    await this.leaseRepo.upsert(leaseData, data.organizationId);
    
    // Récupérer le bail créé pour le retourner
    const db = await this.getDb();
    const created = await db.Lease.get(leaseData.id);
    if (!created) {
      throw new Error('Erreur lors de la création du bail');
    }
    
    // ✅ CRITIQUE: updatedAt est TOUJOURS une string ISO dans IndexedDB
    // Ne pas convertir en Date pour rester cohérent avec le stockage
    return {
      id: created.id,
      organizationId: created.organizationId,
      propertyId: created.propertyId,
      tenantId: created.tenantId,
      type: created.type,
      furnishedType: created.furnishedType ?? null,
      startDate: created.startDate,
      endDate: created.endDate ?? null,
      rentAmount: created.rentAmount,
      deposit: created.deposit ?? null,
      paymentDay: created.paymentDay ?? null,
      indexationType: created.indexationType ?? null,
      notes: created.notes ?? null,
      status: created.status ?? null,
      signedPdfUrl: created.signedPdfUrl ?? null,
      chargesRecupMensuelles: created.chargesRecupMensuelles ?? null,
      chargesNonRecupMensuelles: created.chargesNonRecupMensuelles ?? null,
      pilotageIgnored: created.pilotageIgnored ?? false,
      createdAt: created.createdAt instanceof Date ? created.createdAt : new Date(created.createdAt),
      // ✅ updatedAt reste string ISO (comme dans IndexedDB) pour cohérence
      updatedAt: typeof created.updatedAt === 'string' ? created.updatedAt : (created.updatedAt instanceof Date ? created.updatedAt.toISOString() : new Date(created.updatedAt).toISOString()),
    };
  }

  async update(id: string, data: UpdateLeaseData): Promise<Lease> {
    const db = await this.getDb();
    const existing = await db.Lease.get(id);
    if (!existing) {
      throw new Error(`Lease ${id} not found`);
    }

    // ✅ CRITIQUE: Fusionner avec l'existant pour éviter de perdre des champs
    // upsert() fait un put() complet qui remplace l'enregistrement, donc on doit inclure tous les champs
    const updateData: any = {
      ...existing, // D'abord copier l'existant
      id,
      organizationId: existing.organizationId,
      ...data, // Puis appliquer les modifications
      updatedAt: new Date().toISOString(),
    };
    
    // ✅ CRITIQUE: Forcer explicitement le status si présent dans data
    // Le spread peut ne pas écraser correctement le status
    if ('status' in data && data.status !== undefined) {
      updateData.status = data.status;
      if (process.env.NODE_ENV === 'development') {
        console.log(`[IndexedDBLeaseRepository] ✅ Status forcé dans updateData:`, {
          id,
          dataStatus: data.status,
          updateDataStatus: updateData.status,
          existingStatus: existing.status,
        });
      }
    }

    // Convertir les dates si nécessaire
    if (data.startDate !== undefined) {
      updateData.startDate = typeof data.startDate === 'string' ? data.startDate : data.startDate.toISOString();
    }
    if (data.endDate !== undefined) {
      updateData.endDate = data.endDate ? (typeof data.endDate === 'string' ? data.endDate : data.endDate.toISOString()) : null;
    }

    // ✅ ÉTAPE 3 : PUT complet avec l'objet fusionné
    // ⚠️ CRITIQUE : leaseRepo.upsert() crée automatiquement la pendingOp via BaseOfflineRepository
    // Pas besoin de créer une pendingOp manuellement ici (évite les doublons)
    // BaseOfflineRepository.upsert() détecte isUpdate=true et crée une pendingOp 'update' avec payload minimal
    await this.leaseRepo.upsert(updateData, existing.organizationId);
    
    // Récupérer le bail mis à jour
    const updated = await db.Lease.get(id);
    if (!updated) {
      throw new Error(`Lease ${id} not found after update`);
    }
    
    // ✅ CRITIQUE: updatedAt est TOUJOURS une string ISO dans IndexedDB
    // Ne pas convertir en Date pour rester cohérent avec le stockage
    return {
      id: updated.id,
      organizationId: updated.organizationId,
      propertyId: updated.propertyId,
      tenantId: updated.tenantId,
      type: updated.type,
      furnishedType: updated.furnishedType ?? null,
      startDate: updated.startDate,
      endDate: updated.endDate ?? null,
      rentAmount: updated.rentAmount,
      deposit: updated.deposit ?? null,
      paymentDay: updated.paymentDay ?? null,
      indexationType: updated.indexationType ?? null,
      notes: updated.notes ?? null,
      status: updated.status ?? null,
      signedPdfUrl: updated.signedPdfUrl ?? null,
      chargesRecupMensuelles: updated.chargesRecupMensuelles ?? null,
      chargesNonRecupMensuelles: updated.chargesNonRecupMensuelles ?? null,
      pilotageIgnored: updated.pilotageIgnored ?? false,
      createdAt: updated.createdAt instanceof Date ? updated.createdAt : new Date(updated.createdAt),
      // ✅ updatedAt reste string ISO (comme dans IndexedDB) pour cohérence
      updatedAt: typeof updated.updatedAt === 'string' ? updated.updatedAt : (updated.updatedAt instanceof Date ? updated.updatedAt.toISOString() : new Date(updated.updatedAt).toISOString()),
    };
  }

  async delete(id: string): Promise<void> {
    const db = await this.getDb();
    const existing = await db.Lease.get(id);
    if (!existing) {
      throw new Error(`Lease ${id} not found`);
    }

    // ✅ CRITIQUE: Utiliser leaseRepo.delete() pour créer automatiquement la pendingOp
    await this.leaseRepo.delete(id, existing.organizationId, 'hard');
  }

  async findById(id: string, organizationId: string): Promise<Lease | null> {
    const db = await this.getDb();
    const lease = await db.Lease.get(id);
    if (!lease || lease.organizationId !== organizationId) {
      return null;
    }
    return lease as Lease;
  }

  async findFirst(where: LeaseWhere): Promise<Lease | null> {
    const db = await this.getDb();
    let query = db.Lease.where('organizationId').equals(where.organizationId!);
    
    if (where.id) {
      const lease = await db.Lease.get(where.id);
      if (lease && lease.organizationId === where.organizationId) {
        return lease as Lease;
      }
      return null;
    }

    if (where.propertyId) {
      query = query.filter(l => l.propertyId === where.propertyId);
    }
    if (where.tenantId) {
      query = query.filter(l => l.tenantId === where.tenantId);
    }
    if (where.status) {
      query = query.filter(l => l.status === where.status);
    }

    const results = await query.first();
    return results ? (results as Lease) : null;
  }

  async findByPropertyId(propertyId: string, organizationId: string): Promise<Lease[]> {
    return this.findMany({ propertyId, organizationId });
  }

  async findByTenantId(tenantId: string, organizationId: string): Promise<Lease[]> {
    return this.findMany({ tenantId, organizationId });
  }

  async findMany(where: LeaseWhere): Promise<Lease[]> {
    const db = await this.getDb();
    let query = db.Lease.where('organizationId').equals(where.organizationId!);

    if (where.propertyId) {
      query = query.filter(l => l.propertyId === where.propertyId);
    }
    if (where.tenantId) {
      query = query.filter(l => l.tenantId === where.tenantId);
    }
    if (where.status) {
      query = query.filter(l => l.status === where.status);
    }

    const results = await query.toArray();
    return results as Lease[];
  }

  async countTransactions(leaseId: string, organizationId: string): Promise<number> {
    const db = await this.getDb();
    
    // ⚠️ GESTION SPÉCIALE : db.Transaction peut être une fonction au lieu d'un objet Table
    // Utiliser db.tables.find() pour obtenir la vraie table
    let transactionTable: any;
    const tableFromTables = db.tables.find((t: any) => t.name === 'Transaction');
    if (tableFromTables && typeof tableFromTables.where === 'function') {
      transactionTable = tableFromTables;
    } else {
      // Fallback : essayer db.Transaction directement
      const dbTransaction = (db as any).Transaction;
      if (dbTransaction && typeof dbTransaction.where === 'function') {
        transactionTable = dbTransaction;
      } else {
        throw new Error('Table Transaction non accessible dans IndexedDB');
      }
    }
    
    const transactions = await transactionTable
      .where('organizationId')
      .equals(organizationId)
      .filter((tx: any) => tx.leaseId === leaseId || tx.bailId === leaseId)
      .toArray();
    
    return transactions.length;
  }
}


