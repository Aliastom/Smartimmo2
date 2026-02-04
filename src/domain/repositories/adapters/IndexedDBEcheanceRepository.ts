/**
 * Adapter IndexedDB pour IEcheanceRepository
 * Utilise EcheanceRepositoryOffline pour l'accès aux données
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

import { getEcheanceRepositoryOffline } from '@/lib/offline/repositories/EcheanceRepositoryOffline';
import type {
  IEcheanceRepository,
  Echeance,
  CreateEcheanceData,
  UpdateEcheanceData,
} from '../interfaces/IEcheanceRepository';
import { getLocalDB } from '@/lib/offline/db';

export class IndexedDBEcheanceRepository implements IEcheanceRepository {
  private echeanceRepo = getEcheanceRepositoryOffline();

  async findFirst(params: { id: string; organizationId: string }): Promise<Echeance | null> {
    const db = await getLocalDB();
    const echeance = await db.EcheanceRecurrente.get(params.id);
    if (!echeance || echeance.organizationId !== params.organizationId) {
      return null;
    }
    return this.mapToEcheance(echeance);
  }

  async create(data: CreateEcheanceData): Promise<Echeance> {
    const now = new Date().toISOString();
    const echeanceData: any = {
      id: crypto.randomUUID(),
      organizationId: data.organizationId,
      propertyId: data.propertyId || null,
      leaseId: data.leaseId || null,
      label: data.label,
      type: data.type,
      periodicite: data.periodicite,
      montant: data.montant,
      recuperable: data.recuperable,
      sens: data.sens,
      startAt: typeof data.startAt === 'string' ? data.startAt : data.startAt.toISOString(),
      endAt: data.endAt ? (typeof data.endAt === 'string' ? data.endAt : data.endAt.toISOString()) : null,
      isActive: data.isActive,
      createdAt: now,
      updatedAt: now,
    };

    await this.echeanceRepo.upsert(echeanceData, data.organizationId);
    return this.mapToEcheance(echeanceData);
  }

  async update(id: string, data: UpdateEcheanceData, organizationId: string): Promise<Echeance> {
    // ✅ ÉTAPE 1 : READ EXISTING
    const db = await getLocalDB();
    const existingLocal = await db.EcheanceRecurrente.get(id);
    if (!existingLocal || existingLocal.organizationId !== organizationId) {
      const errorMsg = `[IndexedDBEcheanceRepository] Échéance ${id} introuvable dans IndexedDB pour org ${organizationId}`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    // ✅ ÉTAPE 2 : MERGE {...existing, ...data}
    // ⚠️ CRITIQUE : Fusionner avec l'existant pour éviter de perdre des champs
    // upsert() fait un put() complet qui remplace l'enregistrement, donc on doit inclure tous les champs
    const updateData: any = {
      ...existingLocal, // D'abord copier l'existant (préserve tous les champs)
      // ✅ INVARIANT : id et organizationId ne peuvent JAMAIS être écrasés
      id, // Garantir que l'ID ne change pas
      organizationId, // Garantir que l'organizationId ne change pas
      ...data, // Puis appliquer les modifications (peut écraser des champs de existing, mais pas id/orgId)
      updatedAt: new Date().toISOString(), // Toujours mettre à jour updatedAt
    };

    // Convertir les dates si fournies
    if (data.startAt !== undefined) {
      updateData.startAt = typeof data.startAt === 'string' ? data.startAt : data.startAt.toISOString();
    }
    if (data.endAt !== undefined) {
      updateData.endAt = data.endAt ? (typeof data.endAt === 'string' ? data.endAt : data.endAt.toISOString()) : null;
    }

    // ✅ ÉTAPE 3 : PUT complet avec l'objet fusionné
    await this.echeanceRepo.upsert(updateData, organizationId);
    const updated = await this.findFirst({ id, organizationId });
    if (!updated) {
      throw new Error(`Échéance ${id} introuvable après mise à jour`);
    }
    return updated;
  }

  async delete(id: string, organizationId: string, mode: 'soft' | 'hard' = 'soft'): Promise<void> {
    // ✅ CRITIQUE: Toujours passer par echeanceRepo.delete() pour créer la pendingOp
    // echeanceRepo est EcheanceRepositoryOffline qui hérite de BaseOfflineRepository
    // et crée automatiquement la pendingOp lors du delete
    await this.echeanceRepo.delete(id, organizationId, mode);
  }

  async getAll(organizationId: string, filters?: { propertyId?: string; leaseId?: string; type?: string; isActive?: boolean }): Promise<Echeance[]> {
    const echeances = await this.echeanceRepo.getAll(organizationId, filters || {});
    return echeances.map(e => this.mapToEcheance(e));
  }

  private mapToEcheance(local: any): Echeance {
    // ⚠️ CORRECTION: Gérer le cas où montant peut être undefined/null
    let montant = 0;
    if (local.montant !== undefined && local.montant !== null) {
      if (typeof local.montant === 'number') {
        montant = local.montant;
      } else if (typeof local.montant === 'string') {
        montant = parseFloat(local.montant) || 0;
      } else {
        // Cas où montant est un objet (ex: Decimal de Prisma)
        montant = parseFloat(String(local.montant)) || 0;
      }
    }
    
    return {
      id: local.id,
      organizationId: local.organizationId,
      propertyId: local.propertyId || null,
      leaseId: local.leaseId || null,
      label: local.label,
      type: local.type,
      periodicite: local.periodicite,
      montant,
      recuperable: local.recuperable,
      sens: local.sens,
      startAt: local.startAt,
      endAt: local.endAt || null,
      isActive: local.isActive,
      createdAt: local.createdAt ? new Date(local.createdAt) : undefined,
      // ✅ CRITIQUE: updatedAt est TOUJOURS une string ISO dans IndexedDB
      // Ne pas convertir en Date pour rester cohérent avec le stockage
      updatedAt: typeof local.updatedAt === 'string' 
        ? local.updatedAt 
        : (local.updatedAt instanceof Date 
          ? local.updatedAt.toISOString() 
          : (local.updatedAt ? new Date(local.updatedAt).toISOString() : undefined)),
    };
  }
}

