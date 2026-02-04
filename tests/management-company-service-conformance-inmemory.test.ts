/**
 * Tests de conformité ManagementCompanyService (InMemory)
 */

import { describe, it, expect } from 'vitest';
import { ManagementCompanyService } from '@/domain/services/ManagementCompanyService';
import { InMemoryManagementCompanyRepository } from '@/domain/repositories/inMemory/InMemoryManagementCompanyRepository';
import { InMemoryPropertyRepository } from '@/domain/repositories/inMemory/InMemoryPropertyRepository';

const organizationId = 'org_test';

function createService() {
  const managementCompanyRepo = new InMemoryManagementCompanyRepository();
  const propertyRepo = new InMemoryPropertyRepository();
  const service = new ManagementCompanyService({ managementCompanyRepo, propertyRepo });
  return { service, propertyRepo };
}

describe('ManagementCompanyService Conformance (InMemory)', () => {
  it('CREATE: crée une société et affecte les biens', async () => {
    const { service, propertyRepo } = createService();
    const property = await propertyRepo.create({
      organizationId,
      name: 'Bien A',
      type: 'apartment',
      address: '1 rue A',
      postalCode: '75001',
      city: 'Paris',
      surface: 50,
      rooms: 2,
      acquisitionDate: new Date('2020-01-01'),
      acquisitionPrice: 200000,
    });

    const result = await service.createCompany({
      organizationId,
      data: {
        nom: 'Société A',
        modeCalcul: 'LOYERS_UNIQUEMENT' as any,
        taux: 6,
        baseSurEncaissement: true,
        tvaApplicable: false,
      },
      selectedPropertyIds: [property.id],
    });

    expect(result.company.id).toBeDefined();
    expect(result.company.taux).toBeCloseTo(0.06);
    const updatedProperty = await propertyRepo.findById(property.id, organizationId);
    expect(updatedProperty?.managementCompanyId).toBe(result.company.id);
  });

  it('UPDATE: met à jour la société et réaffecte les biens (diff)', async () => {
    const { service, propertyRepo } = createService();
    const propertyA = await propertyRepo.create({
      organizationId,
      name: 'Bien A',
      type: 'apartment',
      address: '1 rue A',
      postalCode: '75001',
      city: 'Paris',
      surface: 50,
      rooms: 2,
      acquisitionDate: new Date('2020-01-01'),
      acquisitionPrice: 200000,
    });
    const propertyB = await propertyRepo.create({
      organizationId,
      name: 'Bien B',
      type: 'apartment',
      address: '2 rue B',
      postalCode: '75002',
      city: 'Paris',
      surface: 60,
      rooms: 3,
      acquisitionDate: new Date('2021-01-01'),
      acquisitionPrice: 250000,
    });

    const created = await service.createCompany({
      organizationId,
      data: {
        nom: 'Société B',
        modeCalcul: 'LOYERS_UNIQUEMENT' as any,
        taux: 5,
        baseSurEncaissement: true,
        tvaApplicable: false,
      },
      selectedPropertyIds: [propertyA.id],
    });

    const updated = await service.updateCompany({
      organizationId,
      id: created.company.id,
      data: {
        nom: 'Société B (modifiée)',
        modeCalcul: 'REVENUS_TOTAUX' as any,
        taux: 7,
        baseSurEncaissement: true,
        tvaApplicable: false,
      },
      selectedPropertyIds: [propertyB.id],
      previousPropertyIds: [propertyA.id],
    });

    expect(updated.company.nom).toBe('Société B (modifiée)');
    expect(updated.company.taux).toBeCloseTo(0.07);

    const propA = await propertyRepo.findById(propertyA.id, organizationId);
    const propB = await propertyRepo.findById(propertyB.id, organizationId);
    expect(propA?.managementCompanyId).toBeNull();
    expect(propB?.managementCompanyId).toBe(updated.company.id);
  });
});
