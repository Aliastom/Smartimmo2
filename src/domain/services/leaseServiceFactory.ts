/**
 * Factory pour créer LeaseService avec différents backends
 */

import { createLeaseService, type LeaseServiceDependencies } from './LeaseService';
import { PrismaLeaseRepository } from '../repositories/adapters/PrismaLeaseRepository';
import { PrismaPropertyRepository } from '../repositories/adapters/PrismaPropertyRepository';
import { PrismaTenantRepository } from '../repositories/adapters/PrismaTenantRepository';
import { PrismaTransactionRepository } from '../repositories/adapters/PrismaTransactionRepository';
import { IndexedDBLeaseRepository } from '../repositories/adapters/IndexedDBLeaseRepository';
import { IndexedDBPropertyRepository } from '../repositories/adapters/IndexedDBPropertyRepository';
import { IndexedDBTenantRepository } from '../repositories/adapters/IndexedDBTenantRepository';
import { IndexedDBTransactionRepository } from '../repositories/adapters/IndexedDBTransactionRepository';
import type { LeaseService } from './LeaseService';

/**
 * Crée LeaseService avec les repositories Prisma (mode normal)
 */
export function createLeaseServicePrisma(): LeaseService {
  const deps: LeaseServiceDependencies = {
    leaseRepo: new PrismaLeaseRepository(),
    propertyRepo: new PrismaPropertyRepository(),
    tenantRepo: new PrismaTenantRepository(),
    transactionRepo: new PrismaTransactionRepository(),
  };

  return createLeaseService(deps);
}

/**
 * Crée LeaseService avec les repositories IndexedDB (mode app-shell)
 */
export function createLeaseServiceIndexedDB(): LeaseService {
  const deps: LeaseServiceDependencies = {
    leaseRepo: new IndexedDBLeaseRepository(),
    propertyRepo: new IndexedDBPropertyRepository(),
    tenantRepo: new IndexedDBTenantRepository(),
    transactionRepo: new IndexedDBTransactionRepository(),
  };

  return createLeaseService(deps);
}

/**
 * Factory unifiée pour créer LeaseService selon le mode
 */
export function createLeaseServiceWithMode(mode: 'normal' | 'app-shell'): LeaseService {
  if (mode === 'normal') {
    return createLeaseServicePrisma();
  } else {
    return createLeaseServiceIndexedDB();
  }
}


