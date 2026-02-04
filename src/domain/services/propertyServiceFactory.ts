/**
 * Factory pour créer PropertyService avec différents backends
 */

import { createPropertyService, type PropertyServiceDependencies } from './PropertyService';
import { PrismaPropertyRepository } from '../repositories/adapters/PrismaPropertyRepository';
import { PrismaLeaseRepository } from '../repositories/adapters/PrismaLeaseRepository';
import { PrismaTransactionRepository } from '../repositories/adapters/PrismaTransactionRepository';
import { PrismaDocumentRepository } from '../repositories/adapters/PrismaDocumentRepository';
import { IndexedDBPropertyRepository } from '../repositories/adapters/IndexedDBPropertyRepository';
import { IndexedDBLeaseRepository } from '../repositories/adapters/IndexedDBLeaseRepository';
import { IndexedDBTransactionRepository } from '../repositories/adapters/IndexedDBTransactionRepository';
import { IndexedDBDocumentRepository } from '../repositories/adapters/IndexedDBDocumentRepository';
import type { PropertyService } from './PropertyService';

/**
 * Crée PropertyService avec les repositories Prisma (mode normal)
 */
export function createPropertyServicePrisma(): PropertyService {
  const deps: PropertyServiceDependencies = {
    propertyRepo: new PrismaPropertyRepository(),
    leaseRepo: new PrismaLeaseRepository(),
    transactionRepo: new PrismaTransactionRepository(),
    documentRepo: new PrismaDocumentRepository(),
  };

  return createPropertyService(deps);
}

/**
 * Crée PropertyService avec les repositories IndexedDB (mode app-shell)
 */
export function createPropertyServiceIndexedDB(): PropertyService {
  const deps: PropertyServiceDependencies = {
    propertyRepo: new IndexedDBPropertyRepository(),
    leaseRepo: new IndexedDBLeaseRepository(),
    transactionRepo: new IndexedDBTransactionRepository(),
    documentRepo: new IndexedDBDocumentRepository(),
  };

  return createPropertyService(deps);
}

/**
 * Factory unifiée pour créer PropertyService selon le mode
 */
export function createPropertyServiceWithMode(mode: 'normal' | 'app-shell'): PropertyService {
  if (mode === 'normal') {
    return createPropertyServicePrisma();
  } else {
    return createPropertyServiceIndexedDB();
  }
}


