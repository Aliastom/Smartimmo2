/**
 * Repository offline-first pour les biens (Property)
 * Lecture depuis la DB locale (instantané), écriture locale + sync en arrière-plan
 */

import { getLocalDB } from '../db';
import { getPropertySyncService } from '../sync';
import { LocalProperty, PendingOperation } from '../types';
import { v4 as uuidv4 } from 'uuid';

export interface PropertyFilters {
  search?: string;
  status?: string;
  type?: string;
  city?: string;
  includeArchived?: boolean;
}

export class PropertyRepositoryOffline {
  private _dbPromise: Promise<any> | null = null;
  private syncService = getPropertySyncService();

  private async getDb() {
    if (!this._dbPromise) {
      this._dbPromise = getLocalDB();
    }
    return this._dbPromise;
  }

  /**
   * Récupère tous les biens depuis la DB locale (instantané)
   * Lance une sync en arrière-plan si le réseau est disponible
   */
  async getAll(
    organizationId: string,
    filters: PropertyFilters = {},
    options: { autoSync?: boolean } = {}
  ): Promise<LocalProperty[]> {
    // Lire depuis la DB locale (instantané)
    const db = await this.getDb();
    let query = db.Property
      .where('organizationId')
      .equals(organizationId);

    // Appliquer les filtres
    if (!filters.includeArchived) {
      query = query.filter(p => !p.isArchived);
    }

    if (filters.status === 'occupied') {
      // Pour le statut "occupied", on ne peut pas vraiment filtrer sans relations
      // On retourne tous et on laisse le composant filtrer
    } else if (filters.status === 'vacant') {
      // Même chose pour vacant
    }

    if (filters.type) {
      query = query.filter(p => p.type === filters.type);
    }

    if (filters.city) {
      query = query.filter(p => p.city.toLowerCase().includes(filters.city!.toLowerCase()));
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      query = query.filter(p => 
        p.name.toLowerCase().includes(searchLower) ||
        p.address.toLowerCase().includes(searchLower) ||
        p.city.toLowerCase().includes(searchLower)
      );
    }

    const properties = await query.toArray();

    // DÉSACTIVÉ : Sync automatique supprimée pour respecter le principe offline-first
    // La synchronisation doit être explicite via la page /app?view=sync ou les boutons dédiés
    // if (options.autoSync !== false && typeof navigator !== 'undefined' && navigator.onLine) {
    //   this.syncService.syncFromRemote(organizationId).catch(error => {
    //     console.warn('[PropertyRepo] Erreur lors de la sync en arrière-plan:', error);
    //   });
    // }

    return properties;
  }

  /**
   * Récupère un bien par ID depuis la DB locale
   */
  async getById(id: string, organizationId: string): Promise<LocalProperty | null> {
    const db = await this.getDb();
    const property = await db.Property.get(id);
    
    if (!property || property.organizationId !== organizationId) {
      return null;
    }

    // DÉSACTIVÉ : Sync automatique supprimée pour respecter le principe offline-first
    // La synchronisation doit être explicite via la page /app?view=sync ou les boutons dédiés
    // if (typeof navigator !== 'undefined' && navigator.onLine) {
    //   this.syncService.syncFromRemote(organizationId).catch(console.error);
    // }

    return property;
  }

  /**
   * Crée ou met à jour un bien localement et ajoute une opération en attente
   */
  async upsert(
    property: Partial<LocalProperty> & { organizationId: string },
    organizationId: string
  ): Promise<LocalProperty> {
    const now = new Date().toISOString();
    const isUpdate = !!property.id;
    const propertyId = property.id || uuidv4();

    // Préparer les données locales
    const localProperty: LocalProperty = {
      id: propertyId,
      organizationId,
      name: property.name || '',
      type: property.type || 'apartment',
      address: property.address || '',
      postalCode: property.postalCode || '',
      city: property.city || '',
      surface: property.surface || 0,
      rooms: property.rooms || 0,
      acquisitionDate: property.acquisitionDate || now,
      acquisitionPrice: property.acquisitionPrice || 0,
      notaryFees: property.notaryFees || 0,
      currentValue: property.currentValue || property.acquisitionPrice || 0,
      status: property.status || 'vacant',
      statusMode: property.statusMode || 'AUTO',
      statusManual: property.statusManual || null,
      occupation: property.occupation || 'VACANT',
      evalSource: property.evalSource || null,
      evalDate: property.evalDate || null,
      exitFeesRate: property.exitFeesRate || null,
      notes: property.notes || null,
      managementCompanyId: property.managementCompanyId || null,
      fiscalTypeId: property.fiscalTypeId || null,
      fiscalRegimeId: property.fiscalRegimeId || null,
      rentalMode: property.rentalMode || 'LONG_TERM',
      airbnbListingId: property.airbnbListingId || null,
      isArchived: property.isArchived || false,
      archivedAt: property.archivedAt || null,
      createdAt: property.createdAt || now,
      updatedAt: now,
      _localUpdatedAt: now,
    };

    // Sauvegarder dans la DB locale
    const db = await this.getDb();
    await db.Property.put(localProperty);

    // Créer une opération en attente
    const pendingOp: PendingOperation = {
      id: uuidv4(),
      entity: 'property',
      entityId: propertyId,
      operation: isUpdate ? 'update' : 'create',
      payload: localProperty,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      retryCount: 0,
      organizationId, // ✅ CRITIQUE: Ajouter organizationId à la pendingOp
    };

    await db.pendingOperations.add(pendingOp);

    // DÉSACTIVÉ : Auto-sync immédiate après création
    // La synchronisation se fait uniquement sur clic du bouton
    // if (typeof navigator !== 'undefined' && navigator.onLine) {
    //   this.syncService.syncPendingToRemote(organizationId).catch(error => {
    //     console.warn('[PropertyRepo] Erreur lors de la sync immédiate:', error);
    //   });
    // }

    return localProperty;
  }

  /**
   * Supprime un bien (soft delete via archive) localement et ajoute une opération en attente
   */
  async delete(id: string, organizationId: string, mode: 'archive' | 'cascade' = 'archive'): Promise<void> {
    const db = await this.getDb();
    const property = await db.Property.get(id);
    
    if (!property || property.organizationId !== organizationId) {
      throw new Error('Bien non trouvé');
    }

    const now = new Date().toISOString();

    if (mode === 'archive') {
      // Soft delete: archiver
      await db.Property.update(id, {
        isArchived: true,
        archivedAt: now,
        updatedAt: now,
        _localUpdatedAt: now,
      });

      // Créer une opération en attente avec operation: 'delete' et mode: 'archive'
      // L'API DELETE attend { mode: 'archive' } dans le body
      const pendingOp: PendingOperation = {
        id: uuidv4(),
        entity: 'property',
        entityId: id,
        operation: 'delete',
        payload: { mode: 'archive' },
        status: 'pending',
        createdAt: now,
        updatedAt: now,
        retryCount: 0,
        organizationId, // ✅ CRITIQUE: Ajouter organizationId à la pendingOp
      };

      await db.pendingOperations.add(pendingOp);
    } else {
      // Hard delete: supprimer complètement
      await db.Property.delete(id);

      // Créer une opération en attente avec operation: 'delete' et mode: 'cascade'
      const pendingOp: PendingOperation = {
        id: uuidv4(),
        entity: 'property',
        entityId: id,
        operation: 'delete',
        payload: { mode: 'cascade' },
        status: 'pending',
        createdAt: now,
        updatedAt: now,
        retryCount: 0,
        organizationId, // ✅ CRITIQUE: Ajouter organizationId à la pendingOp
      };

      await db.pendingOperations.add(pendingOp);
    }

    // DÉSACTIVÉ : Auto-sync immédiate après suppression
    // La synchronisation se fait uniquement sur clic du bouton
    // if (typeof navigator !== 'undefined' && navigator.onLine) {
    //   this.syncService.syncPendingToRemote(organizationId).catch(console.error);
    // }
  }

  /**
   * Force une synchronisation complète (utilisé par l'UI)
   */
  async forceSync(organizationId: string): Promise<{ fromRemote: any; toRemote: any }> {
    const [fromRemote, toRemote] = await Promise.all([
      this.syncService.syncFromRemote(organizationId),
      this.syncService.syncPendingToRemote(organizationId),
    ]);

    return { fromRemote, toRemote };
  }
}

// Instance singleton
let repositoryInstance: PropertyRepositoryOffline | null = null;

export function getPropertyRepositoryOffline(): PropertyRepositoryOffline {
  if (typeof window === 'undefined') {
    throw new Error('PropertyRepositoryOffline ne peut être utilisé que côté client');
  }

  if (!repositoryInstance) {
    repositoryInstance = new PropertyRepositoryOffline();
  }

  return repositoryInstance;
}





