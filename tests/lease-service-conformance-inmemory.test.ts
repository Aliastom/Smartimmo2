/**
 * Tests de conformité LeaseService (Normal vs AppShell)
 * Utilise des repositories in-memory pour prouver que la logique métier est identique
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createLeaseService, type LeaseServiceDependencies } from '@/domain/services/LeaseService';
import { InMemoryLeaseRepository } from '@/domain/repositories/inMemory/InMemoryLeaseRepository';
import { InMemoryPropertyRepository } from '@/domain/repositories/inMemory/InMemoryPropertyRepository';
import { InMemoryTenantRepository } from '@/domain/repositories/inMemory/InMemoryTenantRepository';
import { InMemoryTransactionRepository } from '@/domain/repositories/inMemory/InMemoryTransactionRepository';

const organizationId = 'org_test';

function createRepositories() {
  const leaseRepo = new InMemoryLeaseRepository();
  const propertyRepo = new InMemoryPropertyRepository();
  const tenantRepo = new InMemoryTenantRepository();
  const transactionRepo = new InMemoryTransactionRepository();

  // Injecter transactionRepo dans leaseRepo pour countTransactions
  leaseRepo.setTransactionRepo(transactionRepo);

  return {
    leaseRepo,
    propertyRepo,
    tenantRepo,
    transactionRepo,
  };
}

function createLeaseServiceWithRepos(repos: ReturnType<typeof createRepositories>) {
  const deps: LeaseServiceDependencies = {
    leaseRepo: repos.leaseRepo,
    propertyRepo: repos.propertyRepo,
    tenantRepo: repos.tenantRepo,
    transactionRepo: repos.transactionRepo,
  };
  return createLeaseService(deps);
}

describe('LeaseService Conformance (Normal vs AppShell)', () => {
  beforeEach(() => {
    // Chaque test commence avec un état propre
  });

  it('CREATE: même input => même output', async () => {
    const reposNormal = createRepositories();
    const reposAppShell = createRepositories();

    // Créer property et tenant
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

    const tenantNormal = { id: 'tenant1', organizationId, firstName: 'John', lastName: 'Doe' };
    reposNormal.tenantRepo.seed([tenantNormal]);

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

    const tenantAppShell = { id: 'tenant1', organizationId, firstName: 'John', lastName: 'Doe' };
    reposAppShell.tenantRepo.seed([tenantAppShell]);

    const serviceNormal = createLeaseServiceWithRepos(reposNormal);
    const serviceAppShell = createLeaseServiceWithRepos(reposAppShell);

    const input = {
      organizationId,
      propertyId: propertyNormal.id,
      tenantId: 'tenant1',
      type: 'residential',
      furnishedType: 'vide' as const,
      startDate: new Date('2021-01-01'),
      endDate: new Date('2024-01-01'),
      rentAmount: 1000,
      deposit: 1000,
      paymentDay: 5,
      indexationType: 'none' as const,
      notes: 'Test',
      status: 'BROUILLON' as const,
    };

    const resultNormal = await serviceNormal.createLease(input);
    const resultAppShell = await serviceAppShell.createLease({
      ...input,
      propertyId: propertyAppShell.id,
    });

    // Comparer les résultats
    expect(resultNormal.lease.id).toBeDefined();
    expect(resultAppShell.lease.id).toBeDefined();
    expect(resultNormal.lease.propertyId).toBe(propertyNormal.id);
    expect(resultAppShell.lease.propertyId).toBe(propertyAppShell.id);
    expect(resultNormal.lease.tenantId).toBe(resultAppShell.lease.tenantId);
    expect(resultNormal.lease.type).toBe(resultAppShell.lease.type);
    expect(resultNormal.lease.rentAmount).toBe(resultAppShell.lease.rentAmount);
    expect(resultNormal.lease.status).toBe(resultAppShell.lease.status);
  });

  it('CREATE: calcul automatique endDate (meublé=1an, vide=3ans)', async () => {
    const reposNormal = createRepositories();
    const reposAppShell = createRepositories();

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

    const tenantNormal = { id: 'tenant1', organizationId, firstName: 'John', lastName: 'Doe' };
    reposNormal.tenantRepo.seed([tenantNormal]);

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

    const tenantAppShell = { id: 'tenant1', organizationId, firstName: 'John', lastName: 'Doe' };
    reposAppShell.tenantRepo.seed([tenantAppShell]);

    const serviceNormal = createLeaseServiceWithRepos(reposNormal);
    const serviceAppShell = createLeaseServiceWithRepos(reposAppShell);

    const startDate = new Date('2021-01-01');

    // Test meublé (1 an)
    const inputMeuble = {
      organizationId,
      propertyId: propertyNormal.id,
      tenantId: 'tenant1',
      type: 'residential',
      furnishedType: 'meuble' as const,
      startDate,
      rentAmount: 1000,
      status: 'SIGNÉ' as const,
    };

    const resultNormalMeuble = await serviceNormal.createLease(inputMeuble);
    const resultAppShellMeuble = await serviceAppShell.createLease({
      ...inputMeuble,
      propertyId: propertyAppShell.id,
    });

    expect(resultNormalMeuble.lease.endDate).toBeDefined();
    expect(resultAppShellMeuble.lease.endDate).toBeDefined();
    if (resultNormalMeuble.lease.endDate && resultAppShellMeuble.lease.endDate) {
      const normalEnd = resultNormalMeuble.lease.endDate instanceof Date
        ? resultNormalMeuble.lease.endDate
        : new Date(resultNormalMeuble.lease.endDate);
      const appShellEnd = resultAppShellMeuble.lease.endDate instanceof Date
        ? resultAppShellMeuble.lease.endDate
        : new Date(resultAppShellMeuble.lease.endDate);

      // Vérifier que c'est 1 an après
      expect(normalEnd.getFullYear()).toBe(startDate.getFullYear() + 1);
      expect(appShellEnd.getFullYear()).toBe(startDate.getFullYear() + 1);
    }
  });

  it('CREATE: validation chevauchement baux actifs', async () => {
    const reposNormal = createRepositories();
    const reposAppShell = createRepositories();

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

    const tenantNormal = { id: 'tenant1', organizationId, firstName: 'John', lastName: 'Doe' };
    reposNormal.tenantRepo.seed([tenantNormal]);

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

    const tenantAppShell = { id: 'tenant1', organizationId, firstName: 'John', lastName: 'Doe' };
    reposAppShell.tenantRepo.seed([tenantAppShell]);

    // Créer un bail actif existant
    await reposNormal.leaseRepo.create({
      organizationId,
      propertyId: propertyNormal.id,
      tenantId: 'tenant1',
      type: 'residential',
      furnishedType: 'vide',
      startDate: new Date('2021-01-01'),
      endDate: new Date('2024-01-01'),
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
      endDate: new Date('2024-01-01'),
      rentAmount: 1000,
      status: 'ACTIF',
    });

    const serviceNormal = createLeaseServiceWithRepos(reposNormal);
    const serviceAppShell = createLeaseServiceWithRepos(reposAppShell);

    // Tenter de créer un bail qui chevauche
    const overlappingInput = {
      organizationId,
      propertyId: propertyNormal.id,
      tenantId: 'tenant1',
      type: 'residential',
      furnishedType: 'vide' as const,
      startDate: new Date('2022-06-01'), // Chevauche avec le bail existant
      endDate: new Date('2025-06-01'),
      rentAmount: 1200,
      status: 'BROUILLON' as const,
    };

    // Les deux doivent lever la même erreur
    await expect(
      serviceNormal.createLease(overlappingInput)
    ).rejects.toThrow('Un autre bail actif existe sur cette période pour ce bien');

    await expect(
      serviceAppShell.createLease({
        ...overlappingInput,
        propertyId: propertyAppShell.id,
      })
    ).rejects.toThrow('Un autre bail actif existe sur cette période pour ce bien');
  });

  it('CREATE: validation dépôt selon type (meublé=2x, vide=1x)', async () => {
    const reposNormal = createRepositories();
    const reposAppShell = createRepositories();

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

    const tenantNormal = { id: 'tenant1', organizationId, firstName: 'John', lastName: 'Doe' };
    reposNormal.tenantRepo.seed([tenantNormal]);

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

    const tenantAppShell = { id: 'tenant1', organizationId, firstName: 'John', lastName: 'Doe' };
    reposAppShell.tenantRepo.seed([tenantAppShell]);

    const serviceNormal = createLeaseServiceWithRepos(reposNormal);
    const serviceAppShell = createLeaseServiceWithRepos(reposAppShell);

    // Test dépôt trop élevé pour meublé (max = 2x loyer = 2000)
    const invalidInput = {
      organizationId,
      propertyId: propertyNormal.id,
      tenantId: 'tenant1',
      type: 'residential',
      furnishedType: 'meuble' as const,
      startDate: new Date('2021-01-01'),
      endDate: new Date('2022-01-01'),
      rentAmount: 1000,
      deposit: 2500, // Trop élevé (> 2000)
      status: 'BROUILLON' as const,
    };

    // Les deux doivent lever la même erreur
    await expect(
      serviceNormal.createLease(invalidInput)
    ).rejects.toThrow('Dépôt de garantie supérieur au plafond légal');

    await expect(
      serviceAppShell.createLease({
        ...invalidInput,
        propertyId: propertyAppShell.id,
      })
    ).rejects.toThrow('Dépôt de garantie supérieur au plafond légal');
  });

  it('UPDATE: même input => même output', async () => {
    const reposNormal = createRepositories();
    const reposAppShell = createRepositories();

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

    const tenantNormal = { id: 'tenant1', organizationId, firstName: 'John', lastName: 'Doe' };
    reposNormal.tenantRepo.seed([tenantNormal]);

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

    const tenantAppShell = { id: 'tenant1', organizationId, firstName: 'John', lastName: 'Doe' };
    reposAppShell.tenantRepo.seed([tenantAppShell]);

    // Créer un bail de base
    const leaseNormal = await reposNormal.leaseRepo.create({
      organizationId,
      propertyId: propertyNormal.id,
      tenantId: 'tenant1',
      type: 'residential',
      furnishedType: 'vide',
      startDate: new Date('2021-01-01'),
      endDate: new Date('2024-01-01'),
      rentAmount: 1000,
      deposit: 1000,
      status: 'BROUILLON',
    });

    const leaseAppShell = await reposAppShell.leaseRepo.create({
      organizationId,
      propertyId: propertyAppShell.id,
      tenantId: 'tenant1',
      type: 'residential',
      furnishedType: 'vide',
      startDate: new Date('2021-01-01'),
      endDate: new Date('2024-01-01'),
      rentAmount: 1000,
      deposit: 1000,
      status: 'BROUILLON',
    });

    const serviceNormal = createLeaseServiceWithRepos(reposNormal);
    const serviceAppShell = createLeaseServiceWithRepos(reposAppShell);

    const updateInput = {
      rentAmount: 1200,
      notes: 'Mis à jour',
      status: 'SIGNÉ' as const,
    };

    const resultNormal = await serviceNormal.updateLease(leaseNormal.id, organizationId, updateInput);
    const resultAppShell = await serviceAppShell.updateLease(leaseAppShell.id, organizationId, updateInput);

    // Comparer les résultats
    expect(resultNormal.lease.rentAmount).toBe(resultAppShell.lease.rentAmount);
    expect(resultNormal.lease.notes).toBe(resultAppShell.lease.notes);
    expect(resultNormal.lease.status).toBe(resultAppShell.lease.status);
  });

  it('DELETE: protection baux actifs', async () => {
    const reposNormal = createRepositories();
    const reposAppShell = createRepositories();

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

    const tenantNormal = { id: 'tenant1', organizationId, firstName: 'John', lastName: 'Doe' };
    reposNormal.tenantRepo.seed([tenantNormal]);

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

    const tenantAppShell = { id: 'tenant1', organizationId, firstName: 'John', lastName: 'Doe' };
    reposAppShell.tenantRepo.seed([tenantAppShell]);

    // Créer un bail actif
    const leaseNormal = await reposNormal.leaseRepo.create({
      organizationId,
      propertyId: propertyNormal.id,
      tenantId: 'tenant1',
      type: 'residential',
      furnishedType: 'vide',
      startDate: new Date('2021-01-01'),
      endDate: new Date('2024-01-01'),
      rentAmount: 1000,
      status: 'ACTIF',
    });

    const leaseAppShell = await reposAppShell.leaseRepo.create({
      organizationId,
      propertyId: propertyAppShell.id,
      tenantId: 'tenant1',
      type: 'residential',
      furnishedType: 'vide',
      startDate: new Date('2021-01-01'),
      endDate: new Date('2024-01-01'),
      rentAmount: 1000,
      status: 'ACTIF',
    });

    const serviceNormal = createLeaseServiceWithRepos(reposNormal);
    const serviceAppShell = createLeaseServiceWithRepos(reposAppShell);

    // Les deux doivent lever la même erreur
    await expect(
      serviceNormal.deleteLease(leaseNormal.id, organizationId)
    ).rejects.toThrow('Ce bail est actif et ne peut pas être supprimé directement');

    await expect(
      serviceAppShell.deleteLease(leaseAppShell.id, organizationId)
    ).rejects.toThrow('Ce bail est actif et ne peut pas être supprimé directement');
  });

  it('DELETE: protection transactions (sauf si RÉSILIÉ)', async () => {
    const reposNormal = createRepositories();
    const reposAppShell = createRepositories();

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

    const tenantNormal = { id: 'tenant1', organizationId, firstName: 'John', lastName: 'Doe' };
    reposNormal.tenantRepo.seed([tenantNormal]);

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

    const tenantAppShell = { id: 'tenant1', organizationId, firstName: 'John', lastName: 'Doe' };
    reposAppShell.tenantRepo.seed([tenantAppShell]);

    // Créer un bail avec transactions
    const leaseNormal = await reposNormal.leaseRepo.create({
      organizationId,
      propertyId: propertyNormal.id,
      tenantId: 'tenant1',
      type: 'residential',
      furnishedType: 'vide',
      startDate: new Date('2021-01-01'),
      endDate: new Date('2024-01-01'),
      rentAmount: 1000,
      status: 'BROUILLON',
    });

    const leaseAppShell = await reposAppShell.leaseRepo.create({
      organizationId,
      propertyId: propertyAppShell.id,
      tenantId: 'tenant1',
      type: 'residential',
      furnishedType: 'vide',
      startDate: new Date('2021-01-01'),
      endDate: new Date('2024-01-01'),
      rentAmount: 1000,
      status: 'BROUILLON',
    });

    // Créer une transaction liée
    await reposNormal.transactionRepo.create({
      organizationId,
      propertyId: propertyNormal.id,
      leaseId: leaseNormal.id,
      categoryId: 'cat1',
      label: 'Loyer',
      amount: 1000,
      date: new Date('2021-01-01'),
    });

    await reposAppShell.transactionRepo.create({
      organizationId,
      propertyId: propertyAppShell.id,
      leaseId: leaseAppShell.id,
      categoryId: 'cat1',
      label: 'Loyer',
      amount: 1000,
      date: new Date('2021-01-01'),
    });

    const serviceNormal = createLeaseServiceWithRepos(reposNormal);
    const serviceAppShell = createLeaseServiceWithRepos(reposAppShell);

    // Les deux doivent lever la même erreur
    await expect(
      serviceNormal.deleteLease(leaseNormal.id, organizationId)
    ).rejects.toThrow('Ce bail ne peut pas être supprimé car il contient des transactions');

    await expect(
      serviceAppShell.deleteLease(leaseAppShell.id, organizationId)
    ).rejects.toThrow('Ce bail ne peut pas être supprimé car il contient des transactions');
  });
});


