/**
 * Factory pour créer DocumentService avec différents backends
 */

import { createDocumentService, type DocumentServiceDependencies } from './DocumentService';
import { PrismaDocumentRepository } from '../repositories/adapters/PrismaDocumentRepository';
import { PrismaDocumentLinkRepository } from '../repositories/adapters/PrismaDocumentLinkRepository';
import { IndexedDBDocumentRepository } from '../repositories/adapters/IndexedDBDocumentRepository';
import { IndexedDBDocumentLinkRepository } from '../repositories/adapters/IndexedDBDocumentLinkRepository';
import type { DocumentService } from './DocumentService';

/**
 * Crée DocumentService avec les repositories Prisma (mode normal)
 */
export function createDocumentServicePrisma(): DocumentService {
  const deps: DocumentServiceDependencies = {
    documentRepo: new PrismaDocumentRepository(),
    documentLinkRepo: new PrismaDocumentLinkRepository(),
  };

  return createDocumentService(deps);
}

/**
 * Crée DocumentService avec les repositories IndexedDB (mode app-shell)
 */
export function createDocumentServiceIndexedDB(): DocumentService {
  const deps: DocumentServiceDependencies = {
    documentRepo: new IndexedDBDocumentRepository(),
    documentLinkRepo: new IndexedDBDocumentLinkRepository(),
  };

  return createDocumentService(deps);
}

/**
 * Factory unifiée pour créer DocumentService selon le mode
 */
export function createDocumentServiceWithMode(mode: 'normal' | 'app-shell'): DocumentService {
  if (mode === 'app-shell') {
    return createDocumentServiceIndexedDB();
  } else {
    return createDocumentServicePrisma();
  }
}


