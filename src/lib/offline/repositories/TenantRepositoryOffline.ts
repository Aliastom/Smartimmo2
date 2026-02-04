/**
 * Repository offline-first pour les locataires (Tenant)
 */

import { BaseOfflineRepository } from './BaseOfflineRepository';
import { getLocalDB } from '../db';
import type { LocalTenant } from '../db';

export interface TenantFilters {
  status?: string;
  search?: string;
}

export class TenantRepositoryOffline extends BaseOfflineRepository<LocalTenant> {
  constructor() {
    super({
      entityName: 'tenant',
      tableName: 'Tenant',
      apiRoute: '/api/tenants',
    });
  }

  /**
   * Récupère tous les locataires d'une organisation avec filtres optionnels
   */
  async getAll(organizationId: string, filters: TenantFilters = {}): Promise<LocalTenant[]> {
    const db = await this.getDb();
    const table = db.Tenant;
    let query = table.where('organizationId').equals(organizationId);

    if (filters.status) {
      query = query.filter(t => t.status === filters.status);
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      query = query.filter(t =>
        t.firstName.toLowerCase().includes(searchLower) ||
        t.lastName.toLowerCase().includes(searchLower) ||
        t.email.toLowerCase().includes(searchLower)
      );
    }

    const tenants = await query.toArray();

    // DÉSACTIVÉ : Sync automatique supprimée pour respecter le principe offline-first
    // La synchronisation doit être explicite via la page /app?view=sync ou les boutons dédiés
    // if (typeof navigator !== 'undefined' && navigator.onLine) {
    //   const { getGlobalSyncService } = await import('../syncGlobal');
    //   getGlobalSyncService().syncAllFromRemote(organizationId).catch(console.error);
    // }

    return tenants;
  }

  /**
   * Récupère un locataire par email
   */
  async getByEmail(email: string, organizationId: string): Promise<LocalTenant | null> {
    const tenants = await this.getAll(organizationId);
    return tenants.find(t => t.email.toLowerCase() === email.toLowerCase()) || null;
  }
}

// Instance singleton
let repositoryInstance: TenantRepositoryOffline | null = null;

export function getTenantRepositoryOffline(): TenantRepositoryOffline {
  if (typeof window === 'undefined') {
    throw new Error('TenantRepositoryOffline ne peut être utilisé que côté client');
  }

  if (!repositoryInstance) {
    repositoryInstance = new TenantRepositoryOffline();
  }

  return repositoryInstance;
}




