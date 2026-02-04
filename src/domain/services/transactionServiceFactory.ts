/**
 * Factory pour créer TransactionService avec différents backends
 */

import { createTransactionService, type TransactionServiceDependencies } from './TransactionService';
import { PrismaTransactionRepository } from '../repositories/adapters/PrismaTransactionRepository';
import { PrismaPropertyRepository } from '../repositories/adapters/PrismaPropertyRepository';
import { PrismaLeaseRepository } from '../repositories/adapters/PrismaLeaseRepository';
import { PrismaCategoryRepository } from '../repositories/adapters/PrismaCategoryRepository';
import { PrismaDocumentRepository } from '../repositories/adapters/PrismaDocumentRepository';
import { PrismaDocumentLinkRepository } from '../repositories/adapters/PrismaDocumentLinkRepository';
import { PrismaNatureRepository } from '../repositories/adapters/PrismaNatureRepository';
import { IndexedDBTransactionRepository } from '../repositories/adapters/IndexedDBTransactionRepository';
import { IndexedDBPropertyRepository } from '../repositories/adapters/IndexedDBPropertyRepository';
import { IndexedDBLeaseRepository } from '../repositories/adapters/IndexedDBLeaseRepository';
import { IndexedDBCategoryRepository } from '../repositories/adapters/IndexedDBCategoryRepository';
import { IndexedDBDocumentRepository } from '../repositories/adapters/IndexedDBDocumentRepository';
import { IndexedDBDocumentLinkRepository } from '../repositories/adapters/IndexedDBDocumentLinkRepository';
import { IndexedDBNatureRepository } from '../repositories/adapters/IndexedDBNatureRepository';
import type { TransactionService } from './TransactionService';

/**
 * Crée TransactionService avec les repositories Prisma (mode normal)
 */
export function createTransactionServicePrisma(): TransactionService {
  const deps: TransactionServiceDependencies = {
    transactionRepo: new PrismaTransactionRepository(),
    propertyRepo: new PrismaPropertyRepository(),
    leaseRepo: new PrismaLeaseRepository(),
    categoryRepo: new PrismaCategoryRepository(),
    documentRepo: new PrismaDocumentRepository(),
    documentLinkRepo: new PrismaDocumentLinkRepository(),
    natureRepo: new PrismaNatureRepository(),
  };

  return createTransactionService(deps);
}

/**
 * Crée TransactionService avec les repositories IndexedDB (mode app-shell)
 */
export function createTransactionServiceIndexedDB(): TransactionService {
  const deps: TransactionServiceDependencies = {
    transactionRepo: new IndexedDBTransactionRepository(),
    propertyRepo: new IndexedDBPropertyRepository(),
    leaseRepo: new IndexedDBLeaseRepository(),
    categoryRepo: new IndexedDBCategoryRepository(),
    documentRepo: new IndexedDBDocumentRepository(),
    documentLinkRepo: new IndexedDBDocumentLinkRepository(),
    natureRepo: new IndexedDBNatureRepository(),
  };

  return createTransactionService(deps);
}

/**
 * Factory unifiée pour créer TransactionService selon le mode
 */
export function createTransactionServiceWithMode(mode: 'normal' | 'app-shell'): TransactionService {
  if (mode === 'app-shell') {
    return createTransactionServiceIndexedDB();
  } else {
    return createTransactionServicePrisma();
  }
}
