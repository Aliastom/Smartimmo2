/**
 * Adapter IndexedDB pour IDocumentRepository
 * Utilise directement la DB locale via Dexie
 */

import { getLocalDB } from '@/lib/offline/db';
import { v4 as uuidv4 } from 'uuid';
import type {
  IDocumentRepository,
  Document,
  DocumentWhere,
  DuplicateCheckResult,
} from '../interfaces/IDocumentRepository';

export class IndexedDBDocumentRepository implements IDocumentRepository {
  private _dbPromise: Promise<any> | null = null;

  private async getDb() {
    if (!this._dbPromise) {
      this._dbPromise = getLocalDB();
    }
    return this._dbPromise;
  }

  async findMany(where: DocumentWhere): Promise<Document[]> {
    const db = await this.getDb();
    
    // 🔍 DIAGNOSTIC: Log la requête findMany
    try {
      const { logToServer } = await import('@/lib/utils/logger');
      await logToServer(`[IndexedDBDocumentRepository] 🔍 findMany appelé - where: ${JSON.stringify({ id: where.id, organizationId: where.organizationId, status: where.status })}`);
    } catch (e) {
      // Ignorer si logToServer n'est pas disponible
    }
    
    let query = db.Document.where('organizationId').equals(where.organizationId!);

    if (where.id) {
      if (typeof where.id === 'string') {
        const doc = await db.Document.get(where.id);
        // Vérifier que le document appartient à la bonne organisation
        if (doc && where.organizationId && doc.organizationId !== where.organizationId) {
          return [];
        }
        const result = doc ? [doc as Document] : [];
        
        // 🔍 DIAGNOSTIC: Log le résultat
        try {
          const { logToServer } = await import('@/lib/utils/logger');
          if (where.status && result.length > 0) {
            const filtered = result.filter(d => d.status === where.status);
            await logToServer(`[IndexedDBDocumentRepository] 🔍 findMany (id string) - trouvé: ${result.length}, après filtre status='${where.status}': ${filtered.length}`);
            return filtered;
          }
        } catch (e) {
          // Ignorer
        }
        
        return result;
      } else if ('in' in where.id) {
        const docs = await db.Document.bulkGet(where.id.in);
        // Filtrer par organizationId et supprimer les undefined
        let filtered = docs.filter((doc): doc is Document => {
          if (!doc) return false;
          if (where.organizationId && doc.organizationId !== where.organizationId) {
            return false;
          }
          return true;
        });
        
        // 🔍 DIAGNOSTIC: Log AVANT filtre status
        try {
          const { logToServer } = await import('@/lib/utils/logger');
          await logToServer(`[IndexedDBDocumentRepository] 🔍 findMany (id in) - trouvés après orgId: ${filtered.length}, status demandé: ${where.status || 'aucun'}`);
          for (const doc of filtered) {
            await logToServer(`[IndexedDBDocumentRepository] 🔍 findMany - docId=${doc.id}, status=${doc.status}, documentTypeId=${doc.documentTypeId}`);
          }
        } catch (e) {
          // Ignorer
        }
        
        // ⚠️ CRITIQUE: Appliquer le filtre status APRÈS bulkGet (car bulkGet ne supporte pas les filtres)
        if (where.status) {
          filtered = filtered.filter(doc => doc.status === where.status);
          
          // 🔍 DIAGNOSTIC: Log APRÈS filtre status
          try {
            const { logToServer } = await import('@/lib/utils/logger');
            await logToServer(`[IndexedDBDocumentRepository] 🔍 findMany (id in) - APRÈS filtre status='${where.status}': ${filtered.length}`);
            for (const doc of filtered) {
              await logToServer(`[IndexedDBDocumentRepository] 🔍 findMany - docId=${doc.id}, status=${doc.status}, documentTypeId=${doc.documentTypeId}`);
            }
          } catch (e) {
            // Ignorer
          }
        }
        
        return filtered;
      }
    }
    if (where.status) {
      query = query.filter((d: any) => d.status === where.status);
    }
    if (where.fileSha256) {
      if (typeof where.fileSha256 === 'string') {
        query = query.filter((d: any) => d.fileSha256 === where.fileSha256);
      } else if ('in' in where.fileSha256) {
        query = query.filter((d: any) => where.fileSha256 && 'in' in where.fileSha256 && where.fileSha256.in.includes(d.fileSha256));
      }
    }

    const results = await query.toArray();
    
    // 🔍 DIAGNOSTIC: Log le résultat final
    try {
      const { logToServer } = await import('@/lib/utils/logger');
      await logToServer(`[IndexedDBDocumentRepository] 🔍 findMany - résultats finaux: ${results.length}`);
    } catch (e) {
      // Ignorer
    }
    
    return results as Document[];
  }

  async updateMany(where: DocumentWhere, data: Partial<Document>): Promise<void> {
    const db = await this.getDb();
    const toUpdate = await this.findMany(where);
    
    const now = new Date().toISOString();
    
    for (const doc of toUpdate) {
      // 🔍 DIAGNOSTIC: Log AVANT updateMany avec tous les détails (dans le terminal)
      const { logToServer } = await import('@/lib/utils/logger');
      await logToServer(`[IndexedDBDocumentRepository] 🔍 AVANT updateMany - docId=${doc.id}, status=${doc.status}, documentTypeId=${doc.documentTypeId}, fileName=${doc.fileName}, updatedAt=${doc.updatedAt}`);
      await logToServer(`[IndexedDBDocumentRepository] 🔍 AVANT updateMany - données à appliquer: ${JSON.stringify(data)}`);
      
      // ⚠️ CRITIQUE: Utiliser put() avec merge complet (pas update()) pour garantir l'intégrité des données
      // Dexie.update() peut avoir des problèmes avec les mises à jour partielles complexes
      const updatedDoc = {
        ...doc,
        ...data,
        updatedAt: now,
      };
      
      await logToServer(`[IndexedDBDocumentRepository] 🔍 AVANT put() - docId=${doc.id}, updatedDoc.status=${updatedDoc.status}, updatedDoc.documentTypeId=${updatedDoc.documentTypeId}`);
      
      await db.Document.put(updatedDoc);
      
      await logToServer(`[IndexedDBDocumentRepository] 🔍 put() exécuté - docId=${doc.id}`);
      
      // 🔍 DIAGNOSTIC: Log APRÈS updateMany (put) avec vérification dans IndexedDB (dans le terminal)
      const verifyDoc = await db.Document.get(doc.id);
      await logToServer(`[IndexedDBDocumentRepository] 🔍 APRÈS updateMany (put) - docId=${doc.id}, status=${verifyDoc?.status || 'NOT_FOUND'}, documentTypeId=${verifyDoc?.documentTypeId || 'null'}, fileName=${verifyDoc?.fileName || 'N/A'}, updatedAt=${verifyDoc?.updatedAt || 'N/A'}`);
      
      // ⚠️ VÉRIFICATION CRITIQUE: S'assurer que le status est bien 'active'
      if (data.status === 'active' && verifyDoc?.status !== 'active') {
        await logToServer(`[IndexedDBDocumentRepository] ❌ ERREUR: Le document ${doc.id} devrait être 'active' mais est '${verifyDoc?.status}'`, 'error');
      } else if (data.status === 'active') {
        await logToServer(`[IndexedDBDocumentRepository] ✅ CONFIRMATION: Le document ${doc.id} est bien passé en 'active'`);
      }
      
      // ✅ Créer une pendingOp pour la synchronisation (comme IndexedDBTransactionRepository)
      const docOrganizationId = doc.organizationId || where.organizationId;
      if (!docOrganizationId) {
        console.warn('[IndexedDBDocumentRepository] OrganizationId manquant pour créer la pendingOp, document mis à jour localement uniquement');
      } else {
        const pendingOp = {
          id: uuidv4(),
          entity: 'document',
          entityId: doc.id,
          operation: 'update',
          payload: data, // Envoyer uniquement les champs modifiés (ex: { isFavorite: true })
          status: 'pending',
          createdAt: now,
          updatedAt: now,
          retryCount: 0,
          organizationId: docOrganizationId, // ✅ CRITIQUE: pour affichage page Sync et filtrage sync
        };
        
        await db.pendingOperations.add(pendingOp);
      }
    }
  }

  async delete(id: string, organizationId?: string): Promise<void> {
    const db = await this.getDb();
    
    // ⚠️ Récupérer le document avant suppression pour obtenir organizationId et créer pendingOp
    const existing = await db.Document.get(id);
    if (!existing) {
      return; // Document déjà supprimé ou inexistante
    }
    
    // ✅ Supprimer toutes les liaisons (DocumentLink) avant le document pour éviter que le document reste visible
    const linksToDelete = await db.DocumentLink.where('documentId').equals(id).toArray();
    for (const link of linksToDelete) {
      await db.DocumentLink.delete([link.documentId, link.linkedType, link.linkedId]);
    }
    
    const docOrganizationId = existing.organizationId || organizationId;
    if (!docOrganizationId) {
      console.warn('[IndexedDBDocumentRepository] OrganizationId manquant pour créer la pendingOp, document supprimé localement uniquement');
    } else {
      // ✅ Créer une pendingOp pour la synchronisation (comme IndexedDBTransactionRepository)
      const now = new Date().toISOString();
      const pendingOp = {
        id: uuidv4(),
        entity: 'document',
        entityId: id,
        operation: 'delete',
        payload: {},
        status: 'pending',
        createdAt: now,
        updatedAt: now,
        retryCount: 0,
        organizationId: docOrganizationId, // ✅ CRITIQUE: pour affichage page Sync et filtrage sync
      };
      
      await db.pendingOperations.add(pendingOp);
    }
    
    // Supprimer de IndexedDB
    await db.Document.delete(id);
  }

  async checkDuplicates(params: { fileSha256?: string; textSha256?: string; organizationId: string }): Promise<DuplicateCheckResult> {
    if (!params.fileSha256) {
      return { hasExactDuplicate: false, exactDuplicate: null };
    }

    const db = await this.getDb();
    const duplicates = await db.Document.where('organizationId')
      .equals(params.organizationId)
      .filter((d: any) => d.fileSha256 === params.fileSha256 && d.status === 'active')
      .toArray();

    if (duplicates.length > 0) {
      return {
        hasExactDuplicate: true,
        exactDuplicate: duplicates[0] as Document,
      };
    }

    return {
      hasExactDuplicate: false,
      exactDuplicate: null,
    };
  }
}


