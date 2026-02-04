/**
 * Adapter IndexedDB pour IDocumentLinkRepository
 */

import { getLocalDB } from '@/lib/offline/db';
import { v4 as uuidv4 } from 'uuid';
import type {
  IDocumentLinkRepository,
  DocumentLink,
  CreateDocumentLinkData,
  DocumentLinkWhere,
} from '../interfaces/IDocumentLinkRepository';

export class IndexedDBDocumentLinkRepository implements IDocumentLinkRepository {
  private _dbPromise: Promise<any> | null = null;

  private async getDb() {
    if (!this._dbPromise) {
      this._dbPromise = getLocalDB();
    }
    return this._dbPromise;
  }

  /**
   * Récupère l'organizationId depuis le document associé
   */
  private async getOrganizationIdFromDocument(documentId: string): Promise<string | null> {
    const db = await this.getDb();
    const document = await db.Document.get(documentId);
    return document?.organizationId || null;
  }

  /**
   * Construit un entityId composite pour DocumentLink (clé composite)
   */
  private buildEntityId(link: { documentId: string; linkedType: string; linkedId: string }): string {
    return `${link.documentId}:${link.linkedType}:${link.linkedId}`;
  }

  async findMany(where: DocumentLinkWhere): Promise<DocumentLink[]> {
    const db = await this.getDb();
    let query = db.DocumentLink.toCollection();

    if (where.documentId) {
      query = query.filter((link: any) => link.documentId === where.documentId);
    }
    if (where.linkedType) {
      query = query.filter((link: any) => link.linkedType === where.linkedType);
    }
    if (where.linkedId) {
      query = query.filter((link: any) => link.linkedId === where.linkedId);
    }
    if (where.linkedType_linkedId) {
      query = query.filter((link: any) => 
        link.linkedType === where.linkedType_linkedId.linkedType &&
        link.linkedId === where.linkedType_linkedId.linkedId
      );
    }

    const results = await query.toArray();
    return results.map((link: any) => ({
      documentId: link.documentId,
      linkedType: link.linkedType,
      linkedId: link.linkedId,
      entityName: link.entityName,
    }));
  }

  async create(data: CreateDocumentLinkData): Promise<DocumentLink> {
    const db = await this.getDb();
    
    // Vérifier si le lien existe déjà (clé composite)
    const existing = await db.DocumentLink
      .where('[documentId+linkedType+linkedId]')
      .equals([data.documentId, data.linkedType, data.linkedId])
      .first();

    if (existing) {
      return {
        documentId: existing.documentId,
        linkedType: existing.linkedType,
        linkedId: existing.linkedId,
        entityName: existing.entityName,
      };
    }

    const link: DocumentLink = {
      documentId: data.documentId,
      linkedType: data.linkedType,
      linkedId: data.linkedId,
      entityName: data.entityName ?? null,
    };

    await db.DocumentLink.add(link);

    // ✅ Créer une pendingOp pour la synchronisation
    const organizationId = await this.getOrganizationIdFromDocument(data.documentId);
    if (!organizationId) {
      console.warn('[IndexedDBDocumentLinkRepository] OrganizationId manquant pour créer la pendingOp, lien créé localement uniquement');
    } else {
      const now = new Date().toISOString();
      const entityId = this.buildEntityId(link);
      const pendingOp = {
        id: uuidv4(),
        entity: 'documentLink',
        entityId,
        operation: 'create',
        payload: link, // Envoyer le lien complet comme payload
        status: 'pending',
        createdAt: now,
        updatedAt: now,
        retryCount: 0,
      };
      
      await db.pendingOperations.add(pendingOp);
    }

    return link;
  }

  async deleteMany(where: DocumentLinkWhere): Promise<void> {
    const db = await this.getDb();
    const toDelete = await this.findMany(where);
    
    // ⚠️ Créer les pendingOps AVANT suppression
    const now = new Date().toISOString();
    for (const link of toDelete) {
      const organizationId = await this.getOrganizationIdFromDocument(link.documentId);
      if (!organizationId) {
        console.warn(`[IndexedDBDocumentLinkRepository] OrganizationId manquant pour créer la pendingOp pour le lien ${link.documentId}:${link.linkedType}:${link.linkedId}, lien supprimé localement uniquement`);
      } else {
        const entityId = this.buildEntityId(link);
        const pendingOp = {
          id: uuidv4(),
          entity: 'documentLink',
          entityId,
          operation: 'delete',
          payload: link, // Inclure le lien complet dans le payload pour la suppression
          status: 'pending',
          createdAt: now,
          updatedAt: now,
          retryCount: 0,
        };
        
        await db.pendingOperations.add(pendingOp);
      }
    }
    
    // Supprimer par clé composite
    for (const link of toDelete) {
      await db.DocumentLink
        .where('[documentId+linkedType+linkedId]')
        .equals([link.documentId, link.linkedType, link.linkedId])
        .delete();
    }
  }
}
