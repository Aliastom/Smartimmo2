/**
 * Service métier pour la gestion déléguée (ManagementCompany)
 * Toute logique CRUD et d'affectation de biens doit passer ici.
 */

import type { ManagementCompany, CreateManagementCompanyDto } from '@/lib/gestion/types';
import type { IPropertyRepository } from '@/domain/repositories/interfaces/IPropertyRepository';
import type {
  IManagementCompanyRepository,
  CreateManagementCompanyData,
  UpdateManagementCompanyData,
} from '@/domain/repositories/interfaces/IManagementCompanyRepository';

export interface ManagementCompanyServiceDependencies {
  managementCompanyRepo: IManagementCompanyRepository;
  propertyRepo?: IPropertyRepository;
}

export interface CreateManagementCompanyParams {
  organizationId: string;
  data: CreateManagementCompanyDto;
  selectedPropertyIds?: string[];
}

export interface UpdateManagementCompanyParams {
  organizationId: string;
  id: string;
  data: CreateManagementCompanyDto;
  selectedPropertyIds?: string[];
  previousPropertyIds?: string[];
}

export interface ToggleManagementCompanyParams {
  organizationId: string;
  id: string;
  actif: boolean;
}

export interface ManagementCompanyAssignmentsResult {
  assignedIds: string[];
  unassignedIds: string[];
}

export class ManagementCompanyService {
  constructor(private deps: ManagementCompanyServiceDependencies) {}

  async createCompany(params: CreateManagementCompanyParams): Promise<{
    company: ManagementCompany;
    assignments: ManagementCompanyAssignmentsResult;
  }> {
    const payload = this.normalizeCreateData(params.organizationId, params.data);
    const company = await this.deps.managementCompanyRepo.create(payload);

    const assignments = await this.applyPropertyAssignments({
      companyId: company.id,
      organizationId: params.organizationId,
      selectedPropertyIds: params.selectedPropertyIds || [],
      previousPropertyIds: [],
    });

    return { company, assignments };
  }

  async updateCompany(params: UpdateManagementCompanyParams): Promise<{
    company: ManagementCompany;
    assignments: ManagementCompanyAssignmentsResult;
  }> {
    const payload = this.normalizeUpdateData(params.data);
    const company = await this.deps.managementCompanyRepo.update(params.id, payload);

    const assignments = await this.applyPropertyAssignments({
      companyId: params.id,
      organizationId: params.organizationId,
      selectedPropertyIds: params.selectedPropertyIds || [],
      previousPropertyIds: params.previousPropertyIds || [],
    });

    return { company, assignments };
  }

  async toggleActive(params: ToggleManagementCompanyParams): Promise<ManagementCompany> {
    return this.deps.managementCompanyRepo.update(params.id, {
      actif: !params.actif,
    });
  }

  private normalizeCreateData(
    organizationId: string,
    data: CreateManagementCompanyDto
  ): CreateManagementCompanyData {
    return {
      organizationId,
      nom: data.nom,
      contact: data.contact ?? null,
      email: data.email ?? null,
      telephone: data.telephone ?? null,
      modeCalcul: data.modeCalcul || 'LOYERS_UNIQUEMENT',
      taux: data.taux / 100,
      fraisMin: data.fraisMin ?? null,
      baseSurEncaissement: data.baseSurEncaissement ?? true,
      tvaApplicable: data.tvaApplicable ?? false,
      tauxTva: data.tauxTva ?? null,
      actif: data.actif ?? true,
    };
  }

  private normalizeUpdateData(data: CreateManagementCompanyDto): UpdateManagementCompanyData {
    return {
      nom: data.nom,
      contact: data.contact ?? null,
      email: data.email ?? null,
      telephone: data.telephone ?? null,
      modeCalcul: data.modeCalcul || 'LOYERS_UNIQUEMENT',
      taux: data.taux / 100,
      fraisMin: data.fraisMin ?? null,
      baseSurEncaissement: data.baseSurEncaissement ?? true,
      tvaApplicable: data.tvaApplicable ?? false,
      tauxTva: data.tauxTva ?? null,
      actif: data.actif ?? true,
    };
  }

  private async applyPropertyAssignments(params: {
    companyId: string;
    organizationId: string;
    selectedPropertyIds: string[];
    previousPropertyIds: string[];
  }): Promise<ManagementCompanyAssignmentsResult> {
    const selected = new Set(params.selectedPropertyIds);
    const previous = new Set(params.previousPropertyIds);

    const assignedIds = params.selectedPropertyIds.filter(id => !previous.has(id));
    const unassignedIds = params.previousPropertyIds.filter(id => !selected.has(id));

    // Stratégie 1: utiliser propertyRepo (app-shell)
    if (this.deps.propertyRepo) {
      for (const propertyId of assignedIds) {
        await this.deps.propertyRepo.update(propertyId, {
          managementCompanyId: params.companyId,
        });
      }

      for (const propertyId of unassignedIds) {
        await this.deps.propertyRepo.update(propertyId, {
          managementCompanyId: null,
        });
      }

      return { assignedIds, unassignedIds };
    }

    // Stratégie 2: utiliser endpoint dédié (mode normal)
    if (this.deps.managementCompanyRepo.assignProperties) {
      await this.deps.managementCompanyRepo.assignProperties(params.companyId, params.selectedPropertyIds);
      return { assignedIds, unassignedIds };
    }

    return { assignedIds, unassignedIds };
  }
}
