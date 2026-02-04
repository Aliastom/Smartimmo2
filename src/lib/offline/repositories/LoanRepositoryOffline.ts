/**
 * Repository offline-first pour les prêts (Loan)
 */

import { BaseOfflineRepository } from './BaseOfflineRepository';
import { getLocalDB } from '../db';
import type { LocalLoan } from '../db';

export interface LoanFilters {
  propertyId?: string;
  isActive?: boolean;
}

export class LoanRepositoryOffline extends BaseOfflineRepository<LocalLoan> {
  constructor() {
    super({
      entityName: 'loan',
      tableName: 'Loan',
      apiRoute: '/api/loans',
    });
  }

  /**
   * Récupère tous les prêts d'une organisation avec filtres optionnels
   */
  async getAll(organizationId: string, filters: LoanFilters = {}): Promise<LocalLoan[]> {
    const db = await this.getDb();
    const table = db.Loan;
    let query = table.where('organizationId').equals(organizationId);

    if (filters.propertyId) {
      query = query.filter(l => l.propertyId === filters.propertyId);
    }

    if (filters.isActive !== undefined) {
      query = query.filter(l => l.isActive === filters.isActive);
    }

    const loans = await query.toArray();

    // DÉSACTIVÉ : Sync automatique supprimée pour respecter le principe offline-first
    // La synchronisation doit être explicite via la page /app?view=sync ou les boutons dédiés
    // if (typeof navigator !== 'undefined' && navigator.onLine) {
    //   const { getGlobalSyncService } = await import('../syncGlobal');
    //   getGlobalSyncService().syncAllFromRemote(organizationId).catch(console.error);
    // }

    return loans;
  }

  /**
   * Récupère les prêts actifs d'une propriété
   */
  async getActiveByProperty(propertyId: string, organizationId: string): Promise<LocalLoan[]> {
    return this.getAll(organizationId, { propertyId, isActive: true });
  }
}

// Instance singleton
let repositoryInstance: LoanRepositoryOffline | null = null;

export function getLoanRepositoryOffline(): LoanRepositoryOffline {
  if (typeof window === 'undefined') {
    throw new Error('LoanRepositoryOffline ne peut être utilisé que côté client');
  }

  if (!repositoryInstance) {
    repositoryInstance = new LoanRepositoryOffline();
  }

  return repositoryInstance;
}




