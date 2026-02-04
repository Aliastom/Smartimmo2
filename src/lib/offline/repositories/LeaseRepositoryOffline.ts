/**
 * Repository offline-first pour les baux (Lease)
 */

import { BaseOfflineRepository, BaseEntity } from './BaseOfflineRepository';
import { getLocalDB } from '../db';
import type { LocalLease } from '../db';

export interface LeaseFilters {
  propertyId?: string;
  tenantId?: string;
  status?: string;
}

export class LeaseRepositoryOffline extends BaseOfflineRepository<LocalLease> {
  constructor() {
    super({
      entityName: 'lease',
      tableName: 'Lease',
      apiRoute: '/api/leases',
    });
  }

  /**
   * Récupère tous les baux d'une organisation avec filtres optionnels
   */
  async getAll(organizationId: string, filters: LeaseFilters = {}): Promise<LocalLease[]> {
    const db = await this.getDb();
    const table = db.Lease;
    let query = table.where('organizationId').equals(organizationId);

    if (filters.propertyId) {
      query = query.filter(l => l.propertyId === filters.propertyId);
    }

    if (filters.tenantId) {
      query = query.filter(l => l.tenantId === filters.tenantId);
    }

    if (filters.status) {
      query = query.filter(l => l.status === filters.status);
    }

    const leases = await query.toArray();

    // DÉSACTIVÉ : Sync automatique supprimée pour respecter le principe offline-first
    // La synchronisation doit être explicite via la page /app?view=sync ou les boutons dédiés
    // if (typeof navigator !== 'undefined' && navigator.onLine) {
    //   const { getGlobalSyncService } = await import('../syncGlobal');
    //   getGlobalSyncService().syncAllFromRemote(organizationId).catch(console.error);
    // }

    return leases;
  }

  /**
   * Récupère les baux actifs d'une propriété
   */
  async getActiveByProperty(propertyId: string, organizationId: string): Promise<LocalLease[]> {
    return this.getAll(organizationId, { propertyId, status: 'ACTIF' });
  }
}

// Instance singleton
let repositoryInstance: LeaseRepositoryOffline | null = null;

export function getLeaseRepositoryOffline(): LeaseRepositoryOffline {
  if (typeof window === 'undefined') {
    throw new Error('LeaseRepositoryOffline ne peut être utilisé que côté client');
  }

  if (!repositoryInstance) {
    repositoryInstance = new LeaseRepositoryOffline();
  }

  return repositoryInstance;
}




