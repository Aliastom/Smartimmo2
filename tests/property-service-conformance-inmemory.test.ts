/**
 * Tests de conformité PropertyService (Normal vs AppShell)
 * Utilise des repositories in-memory pour prouver que la logique métier est identique
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createPropertyService, type PropertyServiceDependencies } from '@/domain/services/PropertyService';
import { InMemoryPropertyRepository } from '@/domain/repositories/inMemory/InMemoryPropertyRepository';
import { InMemoryLeaseRepository } from '@/domain/repositories/inMemory/InMemoryLeaseRepository';
import { InMemoryTransactionRepository } from '@/domain/repositories/inMemory/InMemoryTransactionRepository';
import { InMemoryDocumentRepository } from '@/domain/repositories/inMemory/InMemoryDocumentRepository';

const organizationId = 'org_test';

function createRepositories() {
  const propertyRepo = new InMemoryPropertyRepository();
  const leaseRepo = new InMemoryLeaseRepository();
  const transactionRepo = new InMemoryTransactionRepository();
  const documentRepo = new InMemoryDocumentRepository();

  // Injecter les dépendances pour stats et réassignation
  propertyRepo.setDependencies({
    leaseRepo,
    transactionRepo,
    documentRepo,
  });

  return {
    propertyRepo,
    leaseRepo,
    transactionRepo,
    documentRepo,
  };
}

function createPropertyServiceWithRepos(repos: ReturnType<typeof createRepositories>) {
  const deps: PropertyServiceDependencies = {
    propertyRepo: repos.propertyRepo,
    leaseRepo: repos.leaseRepo,
    transactionRepo: repos.transactionRepo,
    documentRepo: repos.documentRepo,
  };
  return createPropertyService(deps);
}

describe('PropertyService Conformance (Normal vs AppShell)', () => {
  beforeEach(() => {
    // Chaque test commence avec un état propre
  });

  it('CREATE: même input => même output', async () => {
    const reposNormal = createRepositories();
    const reposAppShell = createRepositories();

    const serviceNormal = createPropertyServiceWithRepos(reposNormal);
    const serviceAppShell = createPropertyServiceWithRepos(reposAppShell);

    const input = {
      organizationId,
      name: 'Appartement Test',
      type: 'apartment',
      address: '123 Rue Test',
      postalCode: '75001',
      city: 'Paris',
      surface: 50,
      rooms: 2,
      acquisitionDate: new Date('2020-01-15'),
      acquisitionPrice: 200000,
      notaryFees: 10000,
      currentValue: 250000,
      managementCompanyId: null,
      fiscalTypeId: null,
      fiscalRegimeId: null,
      rentalMode: 'LONG_TERM' as const,
      airbnbListingId: null,
    };

    const resultNormal = await serviceNormal.createProperty(input);
    const resultAppShell = await serviceAppShell.createProperty(input);

    // Comparer les résultats
    expect(resultNormal.property.id).toBeDefined();
    expect(resultAppShell.property.id).toBeDefined();
    expect(resultNormal.property.name).toBe(resultAppShell.property.name);
    expect(resultNormal.property.type).toBe(resultAppShell.property.type);
    expect(resultNormal.property.address).toBe(resultAppShell.property.address);
    expect(resultNormal.property.surface).toBe(resultAppShell.property.surface);
    expect(resultNormal.property.organizationId).toBe(resultAppShell.property.organizationId);
  });

  it('UPDATE: même input => même output', async () => {
    const reposNormal = createRepositories();
    const reposAppShell = createRepositories();

    // Créer une propriété de base
    const propertyNormal = await reposNormal.propertyRepo.create({
      organizationId,
      name: 'Appartement Test',
      type: 'apartment',
      address: '123 Rue Test',
      postalCode: '75001',
      city: 'Paris',
      surface: 50,
      rooms: 2,
      acquisitionDate: new Date('2020-01-15'),
      acquisitionPrice: 200000,
    });

    const propertyAppShell = await reposAppShell.propertyRepo.create({
      organizationId,
      name: 'Appartement Test',
      type: 'apartment',
      address: '123 Rue Test',
      postalCode: '75001',
      city: 'Paris',
      surface: 50,
      rooms: 2,
      acquisitionDate: new Date('2020-01-15'),
      acquisitionPrice: 200000,
    });

    const serviceNormal = createPropertyServiceWithRepos(reposNormal);
    const serviceAppShell = createPropertyServiceWithRepos(reposAppShell);

    const updateInput = {
      name: 'Appartement Modifié',
      surface: 60,
      currentValue: 300000,
    };

    const resultNormal = await serviceNormal.updateProperty(propertyNormal.id, organizationId, updateInput);
    const resultAppShell = await serviceAppShell.updateProperty(propertyAppShell.id, organizationId, updateInput);

    // Comparer les résultats
    expect(resultNormal.property.name).toBe(resultAppShell.property.name);
    expect(resultNormal.property.surface).toBe(resultAppShell.property.surface);
    expect(resultNormal.property.currentValue).toBe(resultAppShell.property.currentValue);
  });

  it('DELETE archive: même input => même effets', async () => {
    const reposNormal = createRepositories();
    const reposAppShell = createRepositories();

    // Créer une propriété de base
    const propertyNormal = await reposNormal.propertyRepo.create({
      organizationId,
      name: 'Appartement Test',
      type: 'apartment',
      address: '123 Rue Test',
      postalCode: '75001',
      city: 'Paris',
      surface: 50,
      rooms: 2,
      acquisitionDate: new Date('2020-01-15'),
      acquisitionPrice: 200000,
    });

    const propertyAppShell = await reposAppShell.propertyRepo.create({
      organizationId,
      name: 'Appartement Test',
      type: 'apartment',
      address: '123 Rue Test',
      postalCode: '75001',
      city: 'Paris',
      surface: 50,
      rooms: 2,
      acquisitionDate: new Date('2020-01-15'),
      acquisitionPrice: 200000,
    });

    const serviceNormal = createPropertyServiceWithRepos(reposNormal);
    const serviceAppShell = createPropertyServiceWithRepos(reposAppShell);

    const deleteInput = {
      mode: 'archive' as const,
    };

    const resultNormal = await serviceNormal.deleteProperty(propertyNormal.id, organizationId, deleteInput);
    const resultAppShell = await serviceAppShell.deleteProperty(propertyAppShell.id, organizationId, deleteInput);

    // Comparer les résultats
    expect(resultNormal.success).toBe(resultAppShell.success);
    expect(resultNormal.mode).toBe(resultAppShell.mode);

    // Vérifier que la propriété est archivée (pas supprimée)
    const archivedNormal = await reposNormal.propertyRepo.findById(propertyNormal.id, organizationId);
    const archivedAppShell = await reposAppShell.propertyRepo.findById(propertyAppShell.id, organizationId);

    expect(archivedNormal?.isArchived).toBe(true);
    expect(archivedAppShell?.isArchived).toBe(true);
    expect(archivedNormal).toBeDefined();
    expect(archivedAppShell).toBeDefined();
  });

  it('DELETE cascade: même input => même effets (si aucune donnée liée)', async () => {
    const reposNormal = createRepositories();
    const reposAppShell = createRepositories();

    // Créer une propriété de base
    const propertyNormal = await reposNormal.propertyRepo.create({
      organizationId,
      name: 'Appartement Test',
      type: 'apartment',
      address: '123 Rue Test',
      postalCode: '75001',
      city: 'Paris',
      surface: 50,
      rooms: 2,
      acquisitionDate: new Date('2020-01-15'),
      acquisitionPrice: 200000,
    });

    const propertyAppShell = await reposAppShell.propertyRepo.create({
      organizationId,
      name: 'Appartement Test',
      type: 'apartment',
      address: '123 Rue Test',
      postalCode: '75001',
      city: 'Paris',
      surface: 50,
      rooms: 2,
      acquisitionDate: new Date('2020-01-15'),
      acquisitionPrice: 200000,
    });

    const serviceNormal = createPropertyServiceWithRepos(reposNormal);
    const serviceAppShell = createPropertyServiceWithRepos(reposAppShell);

    const deleteInput = {
      mode: 'cascade' as const,
    };

    const resultNormal = await serviceNormal.deleteProperty(propertyNormal.id, organizationId, deleteInput);
    const resultAppShell = await serviceAppShell.deleteProperty(propertyAppShell.id, organizationId, deleteInput);

    // Comparer les résultats
    expect(resultNormal.success).toBe(resultAppShell.success);
    expect(resultNormal.mode).toBe(resultAppShell.mode);

    // Vérifier que la propriété est supprimée
    const deletedNormal = await reposNormal.propertyRepo.findById(propertyNormal.id, organizationId);
    const deletedAppShell = await reposAppShell.propertyRepo.findById(propertyAppShell.id, organizationId);

    expect(deletedNormal).toBeNull();
    expect(deletedAppShell).toBeNull();
  });

  it('DELETE cascade: erreur si données liées', async () => {
    const reposNormal = createRepositories();
    const reposAppShell = createRepositories();

    // Créer une propriété avec des données liées
    const propertyNormal = await reposNormal.propertyRepo.create({
      organizationId,
      name: 'Appartement Test',
      type: 'apartment',
      address: '123 Rue Test',
      postalCode: '75001',
      city: 'Paris',
      surface: 50,
      rooms: 2,
      acquisitionDate: new Date('2020-01-15'),
      acquisitionPrice: 200000,
    });

    const propertyAppShell = await reposAppShell.propertyRepo.create({
      organizationId,
      name: 'Appartement Test',
      type: 'apartment',
      address: '123 Rue Test',
      postalCode: '75001',
      city: 'Paris',
      surface: 50,
      rooms: 2,
      acquisitionDate: new Date('2020-01-15'),
      acquisitionPrice: 200000,
    });

    // Créer un bail lié
    await reposNormal.leaseRepo.create({
      organizationId,
      propertyId: propertyNormal.id,
      tenantId: 'tenant1',
      type: 'residential',
      furnishedType: 'vide',
      startDate: new Date('2021-01-01'),
      rentAmount: 1000,
      status: 'ACTIF',
    });

    await reposAppShell.leaseRepo.create({
      organizationId,
      propertyId: propertyAppShell.id,
      tenantId: 'tenant1',
      type: 'residential',
      furnishedType: 'vide',
      startDate: new Date('2021-01-01'),
      rentAmount: 1000,
      status: 'ACTIF',
    });

    const serviceNormal = createPropertyServiceWithRepos(reposNormal);
    const serviceAppShell = createPropertyServiceWithRepos(reposAppShell);

    const deleteInput = {
      mode: 'cascade' as const,
    };

    // Les deux doivent lever la même erreur
    await expect(
      serviceNormal.deleteProperty(propertyNormal.id, organizationId, deleteInput)
    ).rejects.toThrow('Impossible de supprimer : des éléments sont liés à ce bien');

    await expect(
      serviceAppShell.deleteProperty(propertyAppShell.id, organizationId, deleteInput)
    ).rejects.toThrow('Impossible de supprimer : des éléments sont liés à ce bien');
  });

  it('DELETE reassign: même input => même effets', async () => {
    const reposNormal = createRepositories();
    const reposAppShell = createRepositories();

    // Créer deux propriétés
    const sourceNormal = await reposNormal.propertyRepo.create({
      organizationId,
      name: 'Source',
      type: 'apartment',
      address: '123 Rue Test',
      postalCode: '75001',
      city: 'Paris',
      surface: 50,
      rooms: 2,
      acquisitionDate: new Date('2020-01-15'),
      acquisitionPrice: 200000,
    });

    const targetNormal = await reposNormal.propertyRepo.create({
      organizationId,
      name: 'Target',
      type: 'apartment',
      address: '456 Rue Test',
      postalCode: '75001',
      city: 'Paris',
      surface: 60,
      rooms: 3,
      acquisitionDate: new Date('2020-01-15'),
      acquisitionPrice: 250000,
    });

    const sourceAppShell = await reposAppShell.propertyRepo.create({
      organizationId,
      name: 'Source',
      type: 'apartment',
      address: '123 Rue Test',
      postalCode: '75001',
      city: 'Paris',
      surface: 50,
      rooms: 2,
      acquisitionDate: new Date('2020-01-15'),
      acquisitionPrice: 200000,
    });

    const targetAppShell = await reposAppShell.propertyRepo.create({
      organizationId,
      name: 'Target',
      type: 'apartment',
      address: '456 Rue Test',
      postalCode: '75001',
      city: 'Paris',
      surface: 60,
      rooms: 3,
      acquisitionDate: new Date('2020-01-15'),
      acquisitionPrice: 250000,
    });

    // Créer un bail lié à la source
    const leaseNormal = await reposNormal.leaseRepo.create({
      organizationId,
      propertyId: sourceNormal.id,
      tenantId: 'tenant1',
      type: 'residential',
      furnishedType: 'vide',
      startDate: new Date('2021-01-01'),
      rentAmount: 1000,
      status: 'ACTIF',
    });

    const leaseAppShell = await reposAppShell.leaseRepo.create({
      organizationId,
      propertyId: sourceAppShell.id,
      tenantId: 'tenant1',
      type: 'residential',
      furnishedType: 'vide',
      startDate: new Date('2021-01-01'),
      rentAmount: 1000,
      status: 'ACTIF',
    });

    const serviceNormal = createPropertyServiceWithRepos(reposNormal);
    const serviceAppShell = createPropertyServiceWithRepos(reposAppShell);

    const deleteInput = {
      mode: 'reassign' as const,
      targetPropertyId: targetNormal.id,
    };

    const deleteInputAppShell = {
      mode: 'reassign' as const,
      targetPropertyId: targetAppShell.id,
    };

    const resultNormal = await serviceNormal.deleteProperty(sourceNormal.id, organizationId, deleteInput);
    const resultAppShell = await serviceAppShell.deleteProperty(sourceAppShell.id, organizationId, deleteInputAppShell);

    // Comparer les résultats
    expect(resultNormal.success).toBe(resultAppShell.success);
    expect(resultNormal.mode).toBe(resultAppShell.mode);

    // Vérifier que la source est supprimée
    const deletedNormal = await reposNormal.propertyRepo.findById(sourceNormal.id, organizationId);
    const deletedAppShell = await reposAppShell.propertyRepo.findById(sourceAppShell.id, organizationId);
    expect(deletedNormal).toBeNull();
    expect(deletedAppShell).toBeNull();

    // Vérifier que le bail a été réassigné
    const reassignedLeaseNormal = await reposNormal.leaseRepo.findById(leaseNormal.id, organizationId);
    const reassignedLeaseAppShell = await reposAppShell.leaseRepo.findById(leaseAppShell.id, organizationId);
    expect(reassignedLeaseNormal?.propertyId).toBe(targetNormal.id);
    expect(reassignedLeaseAppShell?.propertyId).toBe(targetAppShell.id);
  });
});


