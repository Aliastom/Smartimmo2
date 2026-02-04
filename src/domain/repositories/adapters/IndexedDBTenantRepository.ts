/**
 * Adapter IndexedDB pour ITenantRepository
 * Utilise TenantRepositoryOffline pour l'accès aux données
 */

import { getTenantRepositoryOffline } from '@/lib/offline/repositories/TenantRepositoryOffline';
import type { ITenantRepository, Tenant, TenantWhere } from '../interfaces/ITenantRepository';
import { getLocalDB } from '@/lib/offline/db';

export class IndexedDBTenantRepository implements ITenantRepository {
  private _dbPromise: Promise<any> | null = null;

  private async getDb() {
    if (!this._dbPromise) {
      this._dbPromise = getLocalDB();
    }
    return this._dbPromise;
  }

  async findFirst(where: TenantWhere): Promise<Tenant | null> {
    const db = await this.getDb();
    if (where.id) {
      const tenant = await db.Tenant.get(where.id);
      if (tenant && tenant.organizationId === where.organizationId) {
        return {
          id: tenant.id,
          organizationId: tenant.organizationId,
          firstName: tenant.firstName,
          lastName: tenant.lastName,
          email: tenant.email,
        };
      }
      return null;
    }

    // Si seulement organizationId, retourner le premier
    if (where.organizationId) {
      const tenant = await db.Tenant.where('organizationId').equals(where.organizationId).first();
      if (tenant) {
        return {
          id: tenant.id,
          organizationId: tenant.organizationId,
          firstName: tenant.firstName,
          lastName: tenant.lastName,
          email: tenant.email,
        };
      }
    }

    return null;
  }
}


