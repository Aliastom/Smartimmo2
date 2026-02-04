/**
 * Repository offline-first pour les échéances récurrentes (EcheanceRecurrente)
 */

import { BaseOfflineRepository } from './BaseOfflineRepository';
import { getLocalDB } from '../db';
import type { LocalEcheanceRecurrente } from '../db';

export interface EcheanceFilters {
  propertyId?: string;
  leaseId?: string;
  type?: string;
  isActive?: boolean;
}

export class EcheanceRepositoryOffline extends BaseOfflineRepository<LocalEcheanceRecurrente> {
  constructor() {
    super({
      entityName: 'echeance',
      tableName: 'EcheanceRecurrente',
      apiRoute: '/api/echeances',
    });
  }

  /**
   * Récupère toutes les échéances d'une organisation avec filtres optionnels
   */
  async getAll(organizationId: string, filters: EcheanceFilters = {}): Promise<LocalEcheanceRecurrente[]> {
    const db = await this.getDb();
    const table = db.EcheanceRecurrente;
    let query = table.where('organizationId').equals(organizationId);

    if (filters.propertyId) {
      query = query.filter(e => e.propertyId === filters.propertyId);
    }

    if (filters.leaseId) {
      query = query.filter(e => e.leaseId === filters.leaseId);
    }

    if (filters.type) {
      query = query.filter(e => e.type === filters.type);
    }

    if (filters.isActive !== undefined) {
      query = query.filter(e => e.isActive === filters.isActive);
    }

    return query.toArray();
  }

  /**
   * Surcharge pour gérer le soft delete des échéances
   * Les échéances utilisent isActive: false et endAt pour le soft delete
   */
  protected async getSoftDeleteData(
    item: LocalEcheanceRecurrente,
    deletedAt: string
  ): Promise<Partial<LocalEcheanceRecurrente>> {
    return {
      isActive: false,
      endAt: item.endAt || deletedAt, // Si endAt n'est pas défini, utiliser deletedAt
    };
  }
}

// Instance singleton
let repositoryInstance: EcheanceRepositoryOffline | null = null;

export function getEcheanceRepositoryOffline(): EcheanceRepositoryOffline {
  if (typeof window === 'undefined') {
    throw new Error('EcheanceRepositoryOffline ne peut être utilisé que côté client');
  }

  if (!repositoryInstance) {
    repositoryInstance = new EcheanceRepositoryOffline();
  }

  return repositoryInstance;
}

