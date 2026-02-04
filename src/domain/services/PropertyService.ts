/**
 * Service métier pour les propriétés
 * Contient TOUTE la logique métier (validation, suppression intelligente, réassignation)
 * Indépendant de Prisma/Dexie grâce à l'injection de dépendances
 */

import type { IPropertyRepository, Property, CreatePropertyData, UpdatePropertyData, PropertyStats } from '../repositories/interfaces/IPropertyRepository';
import type { ILeaseRepository } from '../repositories/interfaces/ILeaseRepository';
import type { ITransactionRepository } from '../repositories/interfaces/ITransactionRepository';
import type { IDocumentRepository } from '../repositories/interfaces/IDocumentRepository';

export interface PropertyServiceDependencies {
  propertyRepo: IPropertyRepository;
  leaseRepo: ILeaseRepository;
  transactionRepo: ITransactionRepository;
  documentRepo: IDocumentRepository;
}

export interface CreatePropertyParams {
  organizationId: string;
  name: string;
  type: string;
  address: string;
  postalCode: string;
  city: string;
  surface: number;
  rooms: number;
  acquisitionDate: Date | string;
  acquisitionPrice: number;
  notaryFees?: number | null;
  currentValue?: number | null;
  status?: string | null;
  occupation?: string | null;
  notes?: string | null;
  managementCompanyId?: string | null;
  fiscalTypeId?: string | null;
  fiscalRegimeId?: string | null;
  rentalMode?: string | null;
  airbnbListingId?: string | null;
}

export interface UpdatePropertyParams {
  name?: string;
  type?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  surface?: number;
  rooms?: number;
  acquisitionDate?: Date | string;
  acquisitionPrice?: number;
  notaryFees?: number | null;
  currentValue?: number | null;
  status?: string | null;
  occupation?: string | null;
  notes?: string | null;
  managementCompanyId?: string | null;
  fiscalTypeId?: string | null;
  fiscalRegimeId?: string | null;
  rentalMode?: string | null;
  airbnbListingId?: string | null;
}

export type DeletePropertyMode = 'archive' | 'reassign' | 'cascade';

export interface DeletePropertyParams {
  mode: DeletePropertyMode;
  targetPropertyId?: string;
}

export interface CreatePropertyResult {
  property: Property;
}

export interface UpdatePropertyResult {
  property: Property;
}

export interface DeletePropertyResult {
  success: boolean;
  mode: DeletePropertyMode;
  stats: PropertyStats;
}

export class PropertyService {
  constructor(private deps: PropertyServiceDependencies) {}

  /**
   * Crée une propriété avec validation et sanitization
   */
  async createProperty(params: CreatePropertyParams): Promise<CreatePropertyResult> {
    // Sanitization : chaînes vides → null pour foreign keys
    const sanitizedData: CreatePropertyData = {
      organizationId: params.organizationId,
      name: params.name,
      type: params.type,
      address: params.address,
      postalCode: params.postalCode,
      city: params.city,
      surface: params.surface,
      rooms: params.rooms,
      acquisitionDate: typeof params.acquisitionDate === 'string' ? new Date(params.acquisitionDate) : params.acquisitionDate,
      acquisitionPrice: params.acquisitionPrice,
      notaryFees: params.notaryFees ?? null,
      currentValue: params.currentValue ?? null,
      status: params.status ?? null,
      occupation: params.occupation ?? null,
      notes: params.notes ?? null,
      managementCompanyId: params.managementCompanyId || null,
      fiscalTypeId: params.fiscalTypeId || null,
      fiscalRegimeId: params.fiscalRegimeId || null,
      rentalMode: params.rentalMode || 'LONG_TERM',
      airbnbListingId: params.airbnbListingId || null,
    };

    const property = await this.deps.propertyRepo.create(sanitizedData);

    return { property };
  }

  /**
   * Met à jour une propriété avec validation et sanitization
   */
  async updateProperty(id: string, organizationId: string, params: UpdatePropertyParams): Promise<UpdatePropertyResult> {
    // Vérifier que la propriété existe et appartient à l'organisation
    const existingProperty = await this.deps.propertyRepo.findById(id, organizationId);
    if (!existingProperty) {
      throw new Error('Propriété non trouvée');
    }

    // Sanitization : chaînes vides → null pour foreign keys
    const updateData: UpdatePropertyData = {};
    if (params.name !== undefined) updateData.name = params.name;
    if (params.type !== undefined) updateData.type = params.type;
    if (params.address !== undefined) updateData.address = params.address;
    if (params.postalCode !== undefined) updateData.postalCode = params.postalCode;
    if (params.city !== undefined) updateData.city = params.city;
    if (params.surface !== undefined) updateData.surface = params.surface;
    if (params.rooms !== undefined) updateData.rooms = params.rooms;
    if (params.acquisitionDate !== undefined) {
      updateData.acquisitionDate = typeof params.acquisitionDate === 'string' ? new Date(params.acquisitionDate) : params.acquisitionDate;
    }
    if (params.acquisitionPrice !== undefined) updateData.acquisitionPrice = params.acquisitionPrice;
    if (params.notaryFees !== undefined) updateData.notaryFees = params.notaryFees;
    if (params.currentValue !== undefined) updateData.currentValue = params.currentValue;
    if (params.status !== undefined) updateData.status = params.status;
    if (params.occupation !== undefined) updateData.occupation = params.occupation;
    if (params.notes !== undefined) updateData.notes = params.notes;
    if (params.managementCompanyId !== undefined) updateData.managementCompanyId = params.managementCompanyId || null;
    if (params.fiscalTypeId !== undefined) updateData.fiscalTypeId = params.fiscalTypeId || null;
    if (params.fiscalRegimeId !== undefined) updateData.fiscalRegimeId = params.fiscalRegimeId || null;
    if (params.rentalMode !== undefined) updateData.rentalMode = params.rentalMode;
    if (params.airbnbListingId !== undefined) updateData.airbnbListingId = params.airbnbListingId || null;

    const property = await this.deps.propertyRepo.update(id, updateData);

    return { property };
  }

  /**
   * Récupère les statistiques d'une propriété
   */
  async getPropertyStats(id: string, organizationId: string): Promise<PropertyStats> {
    return this.deps.propertyRepo.getStats(id, organizationId);
  }

  /**
   * Supprime une propriété avec 3 modes : archive, reassign, cascade
   */
  async deleteProperty(id: string, organizationId: string, params: DeletePropertyParams): Promise<DeletePropertyResult> {
    // Validation du mode
    if (!['archive', 'reassign', 'cascade'].includes(params.mode)) {
      throw new Error('Mode de suppression invalide');
    }

    // Vérifier que la propriété existe
    const property = await this.deps.propertyRepo.findById(id, organizationId);
    if (!property) {
      throw new Error('Propriété non trouvée');
    }

    // Récupérer les stats
    const stats = await this.deps.propertyRepo.getStats(id, organizationId);
    const hasLinkedData = stats.leases > 0 || stats.transactions > 0 || stats.documents > 0 || stats.echeances > 0 || stats.loans > 0;

    switch (params.mode) {
      case 'archive':
        // ✅ Soft delete: archiver via delete() avec mode: 'archive'
        // PropertyRepositoryOffline.delete() gère le soft delete (archive) en mode app-shell
        // PrismaPropertyRepository.delete() gère maintenant aussi le mode 'archive' (soft delete)
        await this.deps.propertyRepo.delete(id, 'archive');
        break;

      case 'reassign':
        if (!params.targetPropertyId) {
          throw new Error('Bien cible requis pour le transfert');
        }

        // Vérifier que le bien cible existe et n'est pas archivé
        const targetProperty = await this.deps.propertyRepo.findById(params.targetPropertyId, organizationId);
        if (!targetProperty) {
          throw new Error('Bien cible non trouvé');
        }
        if (targetProperty.isArchived) {
          throw new Error('Le bien cible est archivé');
        }

        // Réassigner tous les liens
        await this.deps.propertyRepo.reassignLeases(id, params.targetPropertyId, organizationId);
        await this.deps.propertyRepo.reassignTransactions(id, params.targetPropertyId, organizationId);
        await this.deps.propertyRepo.reassignDocuments(id, params.targetPropertyId, organizationId);
        await this.deps.propertyRepo.reassignEcheances(id, params.targetPropertyId, organizationId);
        await this.deps.propertyRepo.reassignLoans(id, params.targetPropertyId, organizationId);
        await this.deps.propertyRepo.reassignPayments(id, params.targetPropertyId, organizationId);
        await this.deps.propertyRepo.reassignPhotos(id, params.targetPropertyId, organizationId);
        await this.deps.propertyRepo.reassignOccupancyHistory(id, params.targetPropertyId, organizationId);

        // Supprimer le bien source (hard delete après réassignation)
        await this.deps.propertyRepo.delete(id, 'cascade');
        break;

      case 'cascade':
        // ✅ Hard delete : supprimer définitivement (même s'il reste des liens)
        await this.deps.propertyRepo.delete(id, 'cascade');
        break;
    }

    return {
      success: true,
      mode: params.mode,
      stats,
    };
  }
}

/**
 * Factory pour créer PropertyService avec dépendances
 */
export function createPropertyService(deps: PropertyServiceDependencies): PropertyService {
  return new PropertyService(deps);
}


