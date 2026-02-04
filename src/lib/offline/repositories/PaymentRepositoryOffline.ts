/**
 * Repository offline-first pour les paiements (Payment)
 */

import { BaseOfflineRepository } from './BaseOfflineRepository';
import { getLocalDB } from '../db';
import type { LocalPayment } from '../db';

export interface PaymentFilters {
  propertyId?: string;
  leaseId?: string;
  periodYear?: number;
  periodMonth?: number;
}

export class PaymentRepositoryOffline extends BaseOfflineRepository<LocalPayment> {
  constructor() {
    super({
      entityName: 'payment',
      tableName: 'Payment',
      apiRoute: '/api/payments',
    });
  }

  /**
   * Récupère tous les paiements d'une organisation avec filtres optionnels
   */
  async getAll(organizationId: string, filters: PaymentFilters = {}): Promise<LocalPayment[]> {
    const db = await this.getDb();
    const table = db.Payment;
    let query = table.where('organizationId').equals(organizationId);

    if (filters.propertyId) {
      query = query.filter(p => p.propertyId === filters.propertyId);
    }

    if (filters.leaseId) {
      query = query.filter(p => p.leaseId === filters.leaseId);
    }

    if (filters.periodYear !== undefined) {
      query = query.filter(p => p.periodYear === filters.periodYear);
      if (filters.periodMonth !== undefined) {
        query = query.filter(p => p.periodMonth === filters.periodMonth);
      }
    }

    const payments = await query.toArray();

    // DÉSACTIVÉ : Sync automatique supprimée pour respecter le principe offline-first
    // La synchronisation doit être explicite via la page /app?view=sync ou les boutons dédiés
    // if (typeof navigator !== 'undefined' && navigator.onLine) {
    //   const { getGlobalSyncService } = await import('../syncGlobal');
    //   getGlobalSyncService().syncAllFromRemote(organizationId).catch(console.error);
    // }

    return payments;
  }
}

// Instance singleton
let repositoryInstance: PaymentRepositoryOffline | null = null;

export function getPaymentRepositoryOffline(): PaymentRepositoryOffline {
  if (typeof window === 'undefined') {
    throw new Error('PaymentRepositoryOffline ne peut être utilisé que côté client');
  }

  if (!repositoryInstance) {
    repositoryInstance = new PaymentRepositoryOffline();
  }

  return repositoryInstance;
}




