/**
 * Service métier pour les documents
 * Contient TOUTE la logique métier (validation, suppression, liaison)
 * Indépendant de Prisma/Dexie grâce à l'injection de dépendances
 */

import type { IDocumentRepository } from '../repositories/interfaces/IDocumentRepository';
import type { IDocumentLinkRepository } from '../repositories/interfaces/IDocumentLinkRepository';

export interface DocumentServiceDependencies {
  documentRepo: IDocumentRepository;
  documentLinkRepo: IDocumentLinkRepository;
}

export interface UpdateDocumentParams {
  filenameOriginal?: string;
  documentTypeId?: string | null;
  tags?: string | null;
  // Autres champs metadata si nécessaire
}

export interface DeleteDocumentResult {
  success: boolean;
  linksDeleted: number;
}

export interface UpdateDocumentResult {
  success: boolean;
}

export interface LinkDocumentParams {
  documentId: string;
  linkedType: 'property' | 'lease' | 'transaction' | 'tenant' | 'loan' | 'global';
  linkedId?: string | null; // null pour 'global'
  entityName?: string | null;
}

export interface LinkDocumentResult {
  success: boolean;
  link: any; // DocumentLink
}

export interface UnlinkDocumentParams {
  documentId: string;
  linkId?: string; // Optionnel : supprimer un lien spécifique
  linkedType?: string; // Optionnel : supprimer tous les liens d'un type
  linkedId?: string; // Optionnel : supprimer tous les liens vers une entité
}

export interface UnlinkDocumentResult {
  success: boolean;
  linksDeleted: number;
}

export interface PreviewPurgeDraftsResult {
  success: boolean;
  data: {
    totalDrafts: number;
    activeDrafts: number;
    orphanedDrafts: number;
    expiredSessions: number;
    activeSessions: number;
    totalSessions: number;
  };
}

export interface PurgeDraftsParams {
  force?: boolean; // Si true, purger TOUS les brouillons (y compris avec session active)
}

export interface PurgeDraftsResult {
  success: boolean;
  message: string;
  results: {
    deleted: number;
    errors: number;
    details: Array<{
      id: string;
      filename: string;
      status: 'success' | 'error';
      error?: string;
    }>;
  };
}

export interface PreviewPurgeOrphansResult {
  success: boolean;
  type: string;
  dryRun: boolean;
  count: number;
  documents?: Array<{
    id: string;
    filenameOriginal: string;
    status: string;
    createdAt: string;
    bucketKey?: string | null;
  }>;
}

export interface PurgeOrphansResult {
  success: boolean;
  message: string;
  results: {
    deleted: number;
    errors: number;
    details: Array<{
      id: string;
      filename: string;
      status: 'success' | 'error';
      error?: string;
    }>;
  };
}

/**
 * Service métier pour les documents
 * 
 * Règles métier :
 * - Les documents ne créent pas d'entités (pas de cascade de création)
 * - La suppression d'un document supprime automatiquement ses liens (cascade SQL)
 * - Les fichiers binaires ne sont PAS stockés en local (seulement métadonnées)
 */
export class DocumentService {
  constructor(private deps: DocumentServiceDependencies) {}

  /**
   * Met à jour les métadonnées d'un document (nom, type, tags)
   */
  async updateDocument(
    id: string,
    organizationId: string,
    params: UpdateDocumentParams
  ): Promise<UpdateDocumentResult> {
    // Vérifier que le document existe
    const existing = await this.deps.documentRepo.findMany({
      id,
      organizationId,
    });

    if (existing.length === 0) {
      throw new Error('Document non trouvé');
    }

    // Construire les données à mettre à jour
    // ⚠️ IMPORTANT: Seuls les champs fournis dans params sont mis à jour (pas de merge complet)
    const updateData: Partial<any> = {};
    if (params.filenameOriginal !== undefined) {
      updateData.filenameOriginal = params.filenameOriginal;
    }
    if (params.documentTypeId !== undefined) {
      updateData.documentTypeId = params.documentTypeId;
    }
    if (params.tags !== undefined) {
      updateData.tags = params.tags;
    }
    
    // Vérifier qu'au moins un champ est fourni
    if (Object.keys(updateData).length === 0) {
      throw new Error('Aucun champ à mettre à jour');
    }

    // Mettre à jour via le repository
    await this.deps.documentRepo.updateMany(
      { id, organizationId },
      updateData
    );

    return { success: true };
  }

  /**
   * Supprime un document
   * Note: La suppression des liens associés est gérée par cascade SQL côté serveur
   */
  async deleteDocument(
    id: string,
    organizationId: string
  ): Promise<DeleteDocumentResult> {
    // Vérifier que le document existe
    const existing = await this.deps.documentRepo.findMany({
      id,
      organizationId,
    });

    if (existing.length === 0) {
      throw new Error('Document non trouvé');
    }

    // Compter les liens avant suppression (pour info)
    const links = await this.deps.documentLinkRepo.findMany({
      documentId: id,
    });

    // Supprimer le document via le repository (qui créera la pendingOp en mode app-shell)
    await this.deps.documentRepo.delete(id, organizationId);

    return {
      success: true,
      linksDeleted: links.length,
    };
  }

  /**
   * Lie un document à une entité
   */
  async linkDocument(
    params: LinkDocumentParams,
    organizationId: string
  ): Promise<LinkDocumentResult> {
    // Vérifier que le document existe
    const existing = await this.deps.documentRepo.findMany({
      id: params.documentId,
      organizationId,
    });

    if (existing.length === 0) {
      throw new Error('Document non trouvé');
    }

    // Vérifier que le lien n'existe pas déjà
    const existingLinks = await this.deps.documentLinkRepo.findMany({
      documentId: params.documentId,
      linkedType: params.linkedType,
      linkedId: params.linkedId || 'global',
    });

    if (existingLinks.length > 0) {
      // Le lien existe déjà, retourner le lien existant
      return {
        success: true,
        link: existingLinks[0],
      };
    }

    // Créer le lien
    const link = await this.deps.documentLinkRepo.create({
      documentId: params.documentId,
      linkedType: params.linkedType.toUpperCase(),
      linkedId: params.linkedId || 'global',
      entityName: params.entityName || null,
    });

    return {
      success: true,
      link,
    };
  }

  /**
   * Supprime une ou plusieurs liaisons d'un document
   */
  async unlinkDocument(
    params: UnlinkDocumentParams,
    organizationId: string
  ): Promise<UnlinkDocumentResult> {
    // Vérifier que le document existe
    const existing = await this.deps.documentRepo.findMany({
      id: params.documentId,
      organizationId,
    });

    if (existing.length === 0) {
      throw new Error('Document non trouvé');
    }

    // Construire le where clause
    const where: any = {
      documentId: params.documentId,
    };

    // Si linkId est fourni, on ne peut pas l'utiliser directement car DocumentLink
    // n'a pas d'ID unique (clé composite). On utilise linkedType + linkedId à la place.
    // Pour simplifier, on suppose que le client fournit linkedType + linkedId
    if (params.linkedType) {
      where.linkedType = params.linkedType;
    }
    if (params.linkedId !== undefined) {
      where.linkedId = params.linkedId;
    }

    // Compter les liens avant suppression
    const linksToDelete = await this.deps.documentLinkRepo.findMany(where);

    // Supprimer les liens
    await this.deps.documentLinkRepo.deleteMany(where);

    return {
      success: true,
      linksDeleted: linksToDelete.length,
    };
  }

  /**
   * Prévisualise les statistiques des documents brouillons (action server-only)
   * ⚠️ ONLINE ONLY - Appelle directement l'API serveur
   */
  async previewPurgeDrafts(): Promise<PreviewPurgeDraftsResult> {
    const response = await fetch('/api/documents/purge-drafts');
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Erreur HTTP: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Erreur lors de la récupération des statistiques');
    }

    return data;
  }

  /**
   * Purge les documents brouillons (action server-only)
   * ⚠️ ONLINE ONLY - Appelle directement l'API serveur (pas de pendingOp)
   * ⚠️ Ne modifie pas IndexedDB directement - nécessite un pull après succès
   */
  async purgeDrafts(params: PurgeDraftsParams = {}): Promise<PurgeDraftsResult> {
    const response = await fetch('/api/documents/purge-drafts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ force: params.force === true }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Erreur HTTP: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Erreur lors de la purge des documents brouillons');
    }

    return data;
  }

  /**
   * Prévisualise les documents orphelins à purger (action server-only)
   * ⚠️ ONLINE ONLY - Appelle directement l'API serveur
   */
  async previewPurgeOrphans(): Promise<PreviewPurgeOrphansResult> {
    const response = await fetch('/api/documents/cleanup?type=orphan&dryRun=true');

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Erreur HTTP: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Erreur lors de la récupération des documents orphelins');
    }

    return data;
  }

  /**
   * Purge les documents orphelins (action server-only)
   * ⚠️ ONLINE ONLY - Appelle directement l'API serveur (pas de pendingOp)
   * ⚠️ Ne modifie pas IndexedDB directement - nécessite un pull après succès
   */
  async purgeOrphans(): Promise<PurgeOrphansResult> {
    const response = await fetch('/api/documents/cleanup?type=orphan', {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Erreur HTTP: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Erreur lors de la purge des documents orphelins');
    }

    return data;
  }
}

/**
 * Factory pour créer DocumentService avec dépendances
 */
export function createDocumentService(deps: DocumentServiceDependencies): DocumentService {
  return new DocumentService(deps);
}


