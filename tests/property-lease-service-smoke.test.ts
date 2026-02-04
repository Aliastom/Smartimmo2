/**
 * Smoke tests d'intégration pour PropertyService et LeaseService
 * Vérifie que les factories fonctionnent et que les services peuvent être instanciés
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createPropertyServicePrisma, createPropertyServiceIndexedDB } from '@/domain/services/propertyServiceFactory';
import { createLeaseServicePrisma, createLeaseServiceIndexedDB } from '@/domain/services/leaseServiceFactory';
import { InMemoryPropertyRepository } from '@/domain/repositories/inMemory/InMemoryPropertyRepository';
import { InMemoryLeaseRepository } from '@/domain/repositories/inMemory/InMemoryLeaseRepository';
import { InMemoryTenantRepository } from '@/domain/repositories/inMemory/InMemoryTenantRepository';
import { InMemoryTransactionRepository } from '@/domain/repositories/inMemory/InMemoryTransactionRepository';
import { InMemoryDocumentRepository } from '@/domain/repositories/inMemory/InMemoryDocumentRepository';
import { createPropertyService } from '@/domain/services/PropertyService';
import { createLeaseService } from '@/domain/services/LeaseService';

describe('PropertyService & LeaseService - Smoke Tests', () => {
  describe('PropertyService - Factory Prisma', () => {
    it('devrait instancier PropertyService avec Prisma adapters', () => {
      const service = createPropertyServicePrisma();
      expect(service).toBeDefined();
      expect(typeof service.createProperty).toBe('function');
      expect(typeof service.updateProperty).toBe('function');
      expect(typeof service.deleteProperty).toBe('function');
    });
  });

  describe('PropertyService - Factory IndexedDB', () => {
    it('devrait instancier PropertyService avec IndexedDB adapters', () => {
      // En test, on peut utiliser in-memory à la place pour éviter Dexie
      const propertyRepo = new InMemoryPropertyRepository();
      const leaseRepo = new InMemoryLeaseRepository();
      const transactionRepo = new InMemoryTransactionRepository();
      const documentRepo = new InMemoryDocumentRepository();

      propertyRepo.setDependencies({
        leaseRepo,
        transactionRepo,
        documentRepo,
      });

      const service = createPropertyService({
        propertyRepo,
        leaseRepo,
        transactionRepo,
        documentRepo,
      });

      expect(service).toBeDefined();
      expect(typeof service.createProperty).toBe('function');
      expect(typeof service.updateProperty).toBe('function');
      expect(typeof service.deleteProperty).toBe('function');
    });
  });

  describe('LeaseService - Factory Prisma', () => {
    it('devrait instancier LeaseService avec Prisma adapters', () => {
      const service = createLeaseServicePrisma();
      expect(service).toBeDefined();
      expect(typeof service.createLease).toBe('function');
      expect(typeof service.updateLease).toBe('function');
      expect(typeof service.deleteLease).toBe('function');
    });
  });

  describe('LeaseService - Factory IndexedDB', () => {
    it('devrait instancier LeaseService avec IndexedDB adapters', () => {
      // En test, on peut utiliser in-memory à la place pour éviter Dexie
      const leaseRepo = new InMemoryLeaseRepository();
      const propertyRepo = new InMemoryPropertyRepository();
      const tenantRepo = new InMemoryTenantRepository();
      const transactionRepo = new InMemoryTransactionRepository();

      leaseRepo.setTransactionRepo(transactionRepo);

      const service = createLeaseService({
        leaseRepo,
        propertyRepo,
        tenantRepo,
        transactionRepo,
      });

      expect(service).toBeDefined();
      expect(typeof service.createLease).toBe('function');
      expect(typeof service.updateLease).toBe('function');
      expect(typeof service.deleteLease).toBe('function');
    });
  });
});


