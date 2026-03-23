/**
 * Service métier pour les échéances récurrentes
 * Contient TOUTE la logique métier (validation, ownership, soft delete)
 * Indépendant de Prisma/Dexie grâce à l'injection de dépendances
 */

import type { IEcheanceRepository, Echeance, CreateEcheanceData, UpdateEcheanceData } from '../repositories/interfaces/IEcheanceRepository';
import { getLegacyTypeFromNatureCode } from '@/lib/echeances/echeanceNatureMapping';
import type { IPropertyRepository } from '../repositories/interfaces/IPropertyRepository';
import type { ILeaseRepository } from '../repositories/interfaces/ILeaseRepository';

export interface EcheanceServiceDependencies {
  echeanceRepo: IEcheanceRepository;
  propertyRepo: IPropertyRepository;
  leaseRepo: ILeaseRepository;
}

export interface CreateEcheanceParams {
  organizationId: string;
  propertyId?: string | null;
  leaseId?: string | null;
  label: string;
  /** Type legacy (dérivé de natureCode si non fourni) */
  type?: string;
  natureCode: string;
  defaultCategoryId?: string | null;
  periodicite: string;
  montant: number;
  recuperable?: boolean;
  sens: string;
  startAt: Date | string;
  endAt?: Date | string | null;
  isActive?: boolean;
}

export interface UpdateEcheanceParams {
  propertyId?: string | null;
  leaseId?: string | null;
  label?: string;
  type?: string;
  natureCode?: string;
  defaultCategoryId?: string | null;
  periodicite?: string;
  montant?: number;
  recuperable?: boolean;
  sens?: string;
  startAt?: Date | string;
  endAt?: Date | string | null;
  isActive?: boolean;
}

export interface CreateEcheanceResult {
  echeance: Echeance;
}

export interface UpdateEcheanceResult {
  echeance: Echeance;
}

export interface DeleteEcheanceResult {
  success: boolean;
}

export class EcheanceService {
  constructor(private deps: EcheanceServiceDependencies) {}

  /**
   * Crée une échéance avec validation et vérification ownership
   */
  async createEcheance(params: CreateEcheanceParams): Promise<CreateEcheanceResult> {
    // Validation : montant positif
    if (params.montant <= 0) {
      throw new Error('Le montant doit être positif');
    }

    // Validation : dates
    const startAt = typeof params.startAt === 'string' ? new Date(params.startAt) : params.startAt;
    let endAt: Date | null = null;
    if (params.endAt) {
      if (typeof params.endAt === 'string' && params.endAt.trim() !== '') {
        endAt = new Date(params.endAt);
      } else if (params.endAt instanceof Date) {
        endAt = params.endAt;
      }
    }

    if (endAt && endAt < startAt) {
      throw new Error('La date de fin doit être supérieure ou égale à la date de début');
    }

    // Vérifier que la propriété existe et appartient à l'organisation
    if (params.propertyId) {
      const property = await this.deps.propertyRepo.findFirst({
        id: params.propertyId,
        organizationId: params.organizationId,
      });
      if (!property) {
        throw new Error('Propriété introuvable');
      }
    }

    // Vérifier que le bail existe, appartient à l'organisation, et est lié au propertyId si fourni
    if (params.leaseId) {
      const lease = await this.deps.leaseRepo.findFirst({
        id: params.leaseId,
        organizationId: params.organizationId,
      });
      if (!lease) {
        throw new Error('Bail introuvable');
      }
      if (params.propertyId && lease.propertyId !== params.propertyId) {
        throw new Error('Le bail n\'est pas lié à cette propriété');
      }
    }

    const sens = params.sens as 'DEBIT' | 'CREDIT';
    const type = params.type || getLegacyTypeFromNatureCode(params.natureCode, sens);

    const createData: CreateEcheanceData = {
      organizationId: params.organizationId,
      propertyId: params.propertyId || null,
      leaseId: params.leaseId || null,
      label: params.label,
      type,
      natureCode: params.natureCode,
      defaultCategoryId: params.defaultCategoryId || null,
      periodicite: params.periodicite,
      montant: params.montant,
      recuperable: params.recuperable ?? false,
      sens: params.sens,
      startAt: startAt,
      endAt: endAt,
      isActive: params.isActive ?? true,
    };

    // Créer l'échéance
    const echeance = await this.deps.echeanceRepo.create(createData);

    return { echeance };
  }

  /**
   * Met à jour une échéance avec validation et vérification ownership
   */
  async updateEcheance(
    id: string,
    organizationId: string,
    params: UpdateEcheanceParams
  ): Promise<UpdateEcheanceResult> {
    // Vérifier que l'échéance existe
    const existing = await this.deps.echeanceRepo.findFirst({ id, organizationId });
    if (!existing) {
      throw new Error('Échéance introuvable');
    }

    // Validation : montant positif si fourni
    if (params.montant !== undefined && params.montant <= 0) {
      throw new Error('Le montant doit être positif');
    }

    // Validation : dates
    const startAt = params.startAt
      ? (typeof params.startAt === 'string' ? new Date(params.startAt) : params.startAt)
      : (typeof existing.startAt === 'string' ? new Date(existing.startAt) : existing.startAt);
    
    let endAt: Date | null = null;
    if (params.endAt !== undefined) {
      if (params.endAt === null) {
        endAt = null;
      } else if (typeof params.endAt === 'string' && params.endAt.trim() !== '') {
        endAt = new Date(params.endAt);
      } else if (params.endAt instanceof Date) {
        endAt = params.endAt;
      }
    } else {
      endAt = existing.endAt ? (typeof existing.endAt === 'string' ? new Date(existing.endAt) : existing.endAt) : null;
    }

    if (endAt && endAt < startAt) {
      throw new Error('La date de fin doit être supérieure ou égale à la date de début');
    }

    // Vérifier que la propriété existe et appartient à l'organisation
    const propertyId = params.propertyId !== undefined ? params.propertyId : existing.propertyId;
    if (propertyId) {
      const property = await this.deps.propertyRepo.findFirst({
        id: propertyId,
        organizationId,
      });
      if (!property) {
        throw new Error('Propriété introuvable');
      }
    }

    // Vérifier que le bail existe, appartient à l'organisation, et est lié au propertyId si fourni
    const leaseId = params.leaseId !== undefined ? params.leaseId : existing.leaseId;
    if (leaseId) {
      const lease = await this.deps.leaseRepo.findFirst({
        id: leaseId,
        organizationId,
      });
      if (!lease) {
        throw new Error('Bail introuvable');
      }
      if (propertyId && lease.propertyId !== propertyId) {
        throw new Error('Le bail n\'est pas lié à cette propriété');
      }
    }

    // Préparer les données de mise à jour
    const updateData: UpdateEcheanceData = {};
    if (params.label !== undefined) updateData.label = params.label;
    if (params.type !== undefined) updateData.type = params.type;
    else if (params.natureCode !== undefined) {
      const sens = (params.sens ?? existing.sens) as 'DEBIT' | 'CREDIT';
      updateData.type = getLegacyTypeFromNatureCode(params.natureCode, sens);
    }
    if (params.natureCode !== undefined) updateData.natureCode = params.natureCode;
    if (params.defaultCategoryId !== undefined) updateData.defaultCategoryId = params.defaultCategoryId;
    if (params.periodicite !== undefined) updateData.periodicite = params.periodicite;
    if (params.montant !== undefined) updateData.montant = params.montant;
    if (params.recuperable !== undefined) updateData.recuperable = params.recuperable;
    if (params.sens !== undefined) updateData.sens = params.sens;
    if (params.startAt !== undefined) updateData.startAt = startAt;
    if (params.endAt !== undefined) updateData.endAt = endAt;
    if (params.isActive !== undefined) updateData.isActive = params.isActive;
    if (params.propertyId !== undefined) updateData.propertyId = params.propertyId;
    if (params.leaseId !== undefined) updateData.leaseId = params.leaseId;

    // ⚠️ CORRECTION: Ne plus fixer endAt automatiquement lors de la désactivation
    // Le toggle "Actif" sert à désactiver/activer une échéance, pas à la supprimer
    // Le soft delete (suppression) est géré par deleteEcheance() qui fixe endAt
    // Si on veut désactiver sans supprimer, on garde endAt tel quel (peut être null ou futur)
    // if (params.isActive === false && endAt === null) {
    //   updateData.endAt = new Date();
    // }

    // Mettre à jour l'échéance
    const echeance = await this.deps.echeanceRepo.update(id, updateData, organizationId);

    return { echeance };
  }

  /**
   * Supprime une échéance (soft delete par défaut)
   */
  async deleteEcheance(
    id: string,
    organizationId: string,
    mode: 'soft' | 'hard' = 'soft'
  ): Promise<DeleteEcheanceResult> {
    // Vérifier que l'échéance existe
    const existing = await this.deps.echeanceRepo.findFirst({ id, organizationId });
    if (!existing) {
      throw new Error('Échéance introuvable');
    }

    // Supprimer
    await this.deps.echeanceRepo.delete(id, organizationId, mode);

    return { success: true };
  }
}

