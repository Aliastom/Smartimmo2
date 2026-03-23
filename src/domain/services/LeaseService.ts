/**
 * Service métier pour les baux
 * Contient TOUTE la logique métier (validation, chevauchement, calcul dates, transitions statut)
 * Indépendant de Prisma/Dexie grâce à l'injection de dépendances
 */

import type { ILeaseRepository, Lease, CreateLeaseData, UpdateLeaseData } from '../repositories/interfaces/ILeaseRepository';
import type { IPropertyRepository } from '../repositories/interfaces/IPropertyRepository';
import type { ITenantRepository } from '../repositories/interfaces/ITenantRepository';
import type { ITransactionRepository } from '../repositories/interfaces/ITransactionRepository';

export interface LeaseServiceDependencies {
  leaseRepo: ILeaseRepository;
  propertyRepo: IPropertyRepository;
  tenantRepo: ITenantRepository;
  transactionRepo: ITransactionRepository;
}

export interface CreateLeaseParams {
  organizationId: string;
  propertyId: string;
  tenantId: string;
  type: string;
  furnishedType?: string | null;
  startDate: Date | string;
  endDate?: Date | string | null;
  rentAmount: number;
  deposit?: number | null;
  paymentDay?: number | null;
  indexationType?: string | null;
  notes?: string | null;
  status?: string | null;
  chargesRecupMensuelles?: number | null;
  chargesNonRecupMensuelles?: number | null;
}

export interface UpdateLeaseParams {
  propertyId?: string;
  tenantId?: string;
  type?: string;
  furnishedType?: string | null;
  startDate?: Date | string;
  endDate?: Date | string | null;
  rentAmount?: number;
  deposit?: number | null;
  paymentDay?: number | null;
  indexationType?: string | null;
  notes?: string | null;
  status?: string | null;
  signedPdfUrl?: string | null;
  chargesRecupMensuelles?: number | null;
  chargesNonRecupMensuelles?: number | null;
}

export interface CreateLeaseResult {
  lease: Lease;
}

export interface UpdateLeaseResult {
  lease: Lease;
}

export interface DeleteLeaseResult {
  success: boolean;
}

export class LeaseService {
  constructor(private deps: LeaseServiceDependencies) {}

  /**
   * Vérifie le chevauchement de dates entre baux actifs
   */
  private checkOverlap(
    newStartDate: Date,
    newEndDate: Date | null,
    existingStartDate: Date,
    existingEndDate: Date | null
  ): boolean {
    if (newEndDate && existingEndDate) {
      // Les deux ont une date de fin
      return newStartDate < existingEndDate && newEndDate > existingStartDate;
    } else if (newEndDate && !existingEndDate) {
      // Le nouveau bail a une fin, l'existant n'en a pas
      return newEndDate > existingStartDate;
    } else if (!newEndDate && existingEndDate) {
      // Le nouveau bail n'a pas de fin, l'existant en a une
      return newStartDate < existingEndDate;
    } else {
      // Aucun n'a de date de fin
      return true;
    }
  }

  /**
   * Calcule la date de fin automatique selon le type de bail
   */
  private calculateEndDate(startDate: Date, furnishedType: string | null | undefined): Date {
    const duration = (furnishedType === 'meuble' || furnishedType === 'MEUBLE') ? 1 : 3;
    const endDate = new Date(startDate);
    endDate.setFullYear(endDate.getFullYear() + duration);
    return endDate;
  }

  /**
   * Crée un bail avec validation, vérification chevauchement, calcul dates
   */
  async createLease(params: CreateLeaseParams): Promise<CreateLeaseResult> {
    // Vérifier que la propriété existe
    const property = await this.deps.propertyRepo.findFirst({
      id: params.propertyId,
      organizationId: params.organizationId,
    });
    if (!property) {
      throw new Error('Propriété introuvable');
    }

    // Vérifier que le locataire existe
    const tenant = await this.deps.tenantRepo.findFirst({
      id: params.tenantId,
      organizationId: params.organizationId,
    });
    if (!tenant) {
      throw new Error('Locataire introuvable');
    }

    // Convertir les dates
    const startDate = typeof params.startDate === 'string' ? new Date(params.startDate) : params.startDate;
    let endDate: Date | null = null;
    if (params.endDate) {
      if (typeof params.endDate === 'string' && params.endDate.trim() !== '') {
        endDate = new Date(params.endDate);
      } else if (params.endDate instanceof Date) {
        endDate = params.endDate;
      }
    }

    // Validation : endDate > startDate
    if (endDate && endDate <= startDate) {
      throw new Error('La date de fin doit être postérieure à la date de début');
    }

    // Validation : dépôt selon type
    const furnishedType = params.furnishedType || 'vide';
    if (params.deposit && params.deposit > 0) {
      const maxDeposit = furnishedType === 'meuble' || furnishedType === 'MEUBLE' ? params.rentAmount * 2 : params.rentAmount;
      if (params.deposit > maxDeposit) {
        throw new Error('Dépôt de garantie supérieur au plafond légal pour le type de bail');
      }
    }

    // Vérifier chevauchement avec baux actifs existants
    const existingLeases = await this.deps.leaseRepo.findByPropertyId(params.propertyId, params.organizationId);
    const newStartDate = startDate;
    const newEndDate = endDate;

    const overlappingLeases = existingLeases.filter(lease => {
      if (lease.status !== 'ACTIF') return false;
      if (!lease.startDate) return false;

      const existingStartDate = lease.startDate instanceof Date ? lease.startDate : new Date(lease.startDate);
      const existingEndDate = lease.endDate
        ? lease.endDate instanceof Date ? lease.endDate : new Date(lease.endDate)
        : null;

      return this.checkOverlap(newStartDate, newEndDate, existingStartDate, existingEndDate);
    });

    if (overlappingLeases.length > 0) {
      throw new Error('Un autre bail actif existe sur cette période pour ce bien');
    }

    // Déterminer le statut initial
    const now = new Date();
    let status = params.status || 'BROUILLON';
    if (status === 'SIGNÉ' && startDate <= now) {
      status = 'ACTIF';
    }

    // Calculer endDate automatiquement si nécessaire (cohérence UI/édition)
    if (!endDate) {
      endDate = this.calculateEndDate(startDate, furnishedType);
    }

    // Créer le bail
    const leaseData: CreateLeaseData = {
      organizationId: params.organizationId,
      propertyId: params.propertyId,
      tenantId: params.tenantId,
      type: params.type,
      furnishedType: furnishedType,
      startDate,
      endDate,
      rentAmount: params.rentAmount,
      deposit: params.deposit || 0,
      paymentDay: params.paymentDay || null,
      indexationType: params.indexationType || 'none',
      notes: params.notes || '',
      status,
      chargesRecupMensuelles: params.chargesRecupMensuelles || null,
      chargesNonRecupMensuelles: params.chargesNonRecupMensuelles || null,
    };

    const lease = await this.deps.leaseRepo.create(leaseData);

    return { lease };
  }

  /**
   * Met à jour un bail avec validation, calcul dates, transitions statut
   */
  async updateLease(id: string, organizationId: string, params: UpdateLeaseParams): Promise<UpdateLeaseResult> {
    // Vérifier que le bail existe
    const existingLease = await this.deps.leaseRepo.findById(id, organizationId);
    if (!existingLease) {
      throw new Error('Bail non trouvé');
    }

    // Préparer les données de mise à jour
    const updateData: UpdateLeaseData = {};

    if (params.propertyId !== undefined) updateData.propertyId = params.propertyId;
    if (params.tenantId !== undefined) updateData.tenantId = params.tenantId;
    if (params.type !== undefined) updateData.type = params.type;
    if (params.furnishedType !== undefined) updateData.furnishedType = params.furnishedType;
    if (params.rentAmount !== undefined) updateData.rentAmount = params.rentAmount;
    if (params.deposit !== undefined) updateData.deposit = params.deposit;
    if (params.paymentDay !== undefined) updateData.paymentDay = params.paymentDay;
    if (params.indexationType !== undefined) updateData.indexationType = params.indexationType;
    if (params.notes !== undefined) updateData.notes = params.notes;
    if (params.signedPdfUrl !== undefined) updateData.signedPdfUrl = params.signedPdfUrl;
    if (params.chargesRecupMensuelles !== undefined) updateData.chargesRecupMensuelles = params.chargesRecupMensuelles;
    if (params.chargesNonRecupMensuelles !== undefined) updateData.chargesNonRecupMensuelles = params.chargesNonRecupMensuelles;

    // Gérer les dates
    if (params.startDate !== undefined) {
      updateData.startDate = typeof params.startDate === 'string' ? new Date(params.startDate) : params.startDate;
    }

    if (params.endDate !== undefined) {
      if (params.endDate === '' || params.endDate === null) {
        updateData.endDate = null;
      } else {
        updateData.endDate = typeof params.endDate === 'string' ? new Date(params.endDate) : params.endDate;
      }
    }

    // Gérer le statut et calculer endDate si nécessaire
    if (params.status !== undefined) {
      updateData.status = params.status;

      // Si le statut passe à SIGNÉ ou ACTIF (depuis BROUILLON ou ENVOYÉ)
      const isBecomingSignedOrActive =
        (params.status === 'SIGNÉ' || params.status === 'ACTIF') &&
        (existingLease.status === 'BROUILLON' || existingLease.status === 'ENVOYÉ');

      if (isBecomingSignedOrActive && !updateData.endDate && updateData.endDate !== false) {
        const startDate = updateData.startDate || existingLease.startDate;
        if (startDate) {
          const start = startDate instanceof Date ? startDate : new Date(startDate);
          const furnishedType = params.furnishedType || existingLease.furnishedType;
          updateData.endDate = this.calculateEndDate(start, furnishedType);
        }
      }
    }

    const lease = await this.deps.leaseRepo.update(id, updateData);

    return { lease };
  }

  /**
   * Supprime un bail avec protection baux actifs et transactions
   */
  async deleteLease(id: string, organizationId: string): Promise<DeleteLeaseResult> {
    // Vérifier que le bail existe
    const existingLease = await this.deps.leaseRepo.findById(id, organizationId);
    if (!existingLease) {
      throw new Error('Bail non trouvé');
    }

    // Protection : baux actifs ne peuvent pas être supprimés
    if (existingLease.status === 'ACTIF') {
      throw new Error('Ce bail est actif et ne peut pas être supprimé directement. Résiliez-le d\'abord.');
    }

    // Vérifier les transactions liées
    const transactionCount = await this.deps.leaseRepo.countTransactions(id, organizationId);
    if (transactionCount > 0 && existingLease.status !== 'RÉSILIÉ') {
      throw new Error('Ce bail ne peut pas être supprimé car il contient des transactions. Résiliez-le d\'abord.');
    }

    // Supprimer le bail
    await this.deps.leaseRepo.delete(id);

    return { success: true };
  }
}

/**
 * Factory pour créer LeaseService avec dépendances
 */
export function createLeaseService(deps: LeaseServiceDependencies): LeaseService {
  return new LeaseService(deps);
}


