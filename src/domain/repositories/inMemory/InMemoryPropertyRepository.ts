/**
 * Implémentation in-memory du repository de propriétés
 */

import type {
  IPropertyRepository,
  Property,
  PropertyWithCompany,
  ManagementCompany,
  CreatePropertyData,
  UpdatePropertyData,
  PropertyStats,
} from '../interfaces/IPropertyRepository';
import type { ILeaseRepository } from '../repositories/interfaces/ILeaseRepository';
import type { ITransactionRepository } from '../repositories/interfaces/ITransactionRepository';
import type { IDocumentRepository } from '../repositories/interfaces/IDocumentRepository';

export class InMemoryPropertyRepository implements IPropertyRepository {
  private properties: Map<string, Property> = new Map();
  private managementCompanies: Map<string, ManagementCompany> = new Map();
  private nextId = 1;

  // Dépendances pour stats et réassignation (injectées depuis l'extérieur)
  private leaseRepo?: ILeaseRepository;
  private transactionRepo?: ITransactionRepository;
  private documentRepo?: IDocumentRepository;
  private echeanceRepo?: any; // TODO: créer interface
  private loanRepo?: any; // TODO: créer interface
  private paymentRepo?: any; // TODO: créer interface
  private photoRepo?: any; // TODO: créer interface
  private occupancyHistoryRepo?: any; // TODO: créer interface

  setDependencies(deps: {
    leaseRepo?: ILeaseRepository;
    transactionRepo?: ITransactionRepository;
    documentRepo?: IDocumentRepository;
    echeanceRepo?: any;
    loanRepo?: any;
    paymentRepo?: any;
    photoRepo?: any;
    occupancyHistoryRepo?: any;
  }) {
    this.leaseRepo = deps.leaseRepo;
    this.transactionRepo = deps.transactionRepo;
    this.documentRepo = deps.documentRepo;
    this.echeanceRepo = deps.echeanceRepo;
    this.loanRepo = deps.loanRepo;
    this.paymentRepo = deps.paymentRepo;
    this.photoRepo = deps.photoRepo;
    this.occupancyHistoryRepo = deps.occupancyHistoryRepo;
  }

  private generateId(): string {
    return `prop_${this.nextId++}_${Date.now()}`;
  }

  async create(data: CreatePropertyData): Promise<Property> {
    const property: Property = {
      id: this.generateId(),
      organizationId: data.organizationId,
      name: data.name,
      type: data.type,
      address: data.address,
      postalCode: data.postalCode,
      city: data.city,
      surface: data.surface,
      rooms: data.rooms,
      acquisitionDate: data.acquisitionDate,
      acquisitionPrice: data.acquisitionPrice,
      notaryFees: data.notaryFees ?? null,
      currentValue: data.currentValue ?? null,
      status: data.status ?? null,
      occupation: data.occupation ?? null,
      notes: data.notes ?? null,
      managementCompanyId: data.managementCompanyId ?? null,
      fiscalTypeId: data.fiscalTypeId ?? null,
      fiscalRegimeId: data.fiscalRegimeId ?? null,
      lmnpActivityId: data.lmnpActivityId ?? null,
      rentalMode: data.rentalMode ?? null,
      airbnbListingId: data.airbnbListingId ?? null,
      isArchived: false,
      archivedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.properties.set(property.id, property);
    return property;
  }

  async update(id: string, data: UpdatePropertyData): Promise<Property> {
    const existing = this.properties.get(id);
    if (!existing) {
      throw new Error(`Property ${id} not found`);
    }

    const updated: Property = {
      ...existing,
      ...data,
      updatedAt: new Date(),
    };

    this.properties.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    if (!this.properties.has(id)) {
      throw new Error(`Property ${id} not found`);
    }
    this.properties.delete(id);
  }

  async findById(id: string, organizationId: string): Promise<Property | null> {
    return this.findFirst({ id, organizationId });
  }

  async findFirst(where: { id: string; organizationId: string }): Promise<Property | null> {
    const property = this.properties.get(where.id);
    if (!property || property.organizationId !== where.organizationId) {
      return null;
    }
    return property;
  }

  async findFirstWithManagementCompany(where: { id: string; organizationId: string }): Promise<PropertyWithCompany | null> {
    const property = this.properties.get(where.id);
    if (!property || property.organizationId !== where.organizationId) {
      return null;
    }

    let managementCompany: ManagementCompany | null = null;
    if (property.managementCompanyId) {
      managementCompany = this.managementCompanies.get(property.managementCompanyId) || null;
    }

    return {
      ...property,
      ManagementCompany: managementCompany,
    };
  }

  async getStats(propertyId: string, organizationId: string): Promise<PropertyStats> {
    // Compter via les repositories injectés
    const leases = this.leaseRepo
      ? (await this.leaseRepo.findMany({ propertyId, organizationId })).length
      : 0;
    const transactions = this.transactionRepo
      ? (await this.transactionRepo.findMany({ propertyId, organizationId })).length
      : 0;
    const documents = this.documentRepo
      ? (await this.documentRepo.findMany({ propertyId, organizationId })).length
      : 0;
    const echeances = 0; // TODO: implémenter quand interface créée
    const loans = 0; // TODO: implémenter quand interface créée

    return { leases, transactions, documents, echeances, loans };
  }

  async reassignLeases(sourcePropertyId: string, targetPropertyId: string, organizationId: string): Promise<void> {
    if (!this.leaseRepo) return;
    const leases = await this.leaseRepo.findMany({ propertyId: sourcePropertyId, organizationId });
    for (const lease of leases) {
      await this.leaseRepo.update(lease.id, { propertyId: targetPropertyId });
    }
  }

  async reassignTransactions(sourcePropertyId: string, targetPropertyId: string, organizationId: string): Promise<void> {
    if (!this.transactionRepo) return;
    const transactions = await this.transactionRepo.findMany({ propertyId: sourcePropertyId, organizationId });
    for (const tx of transactions) {
      await this.transactionRepo.update(tx.id, { propertyId: targetPropertyId });
    }
  }

  async reassignDocuments(sourcePropertyId: string, targetPropertyId: string, organizationId: string): Promise<void> {
    // TODO: DocumentRepository n'a pas de filtre propertyId dans l'interface actuelle
    // Pour les tests in-memory, cette méthode est appelée mais ne fait rien
    // L'implémentation réelle sera dans l'adapter Prisma
  }

  async reassignEcheances(sourcePropertyId: string, targetPropertyId: string, organizationId: string): Promise<void> {
    // TODO: implémenter quand interface créée
  }

  async reassignLoans(sourcePropertyId: string, targetPropertyId: string, organizationId: string): Promise<void> {
    // TODO: implémenter quand interface créée
  }

  async reassignPayments(sourcePropertyId: string, targetPropertyId: string, organizationId: string): Promise<void> {
    // TODO: implémenter quand interface créée
  }

  async reassignPhotos(sourcePropertyId: string, targetPropertyId: string, organizationId: string): Promise<void> {
    // TODO: implémenter quand interface créée
  }

  async reassignOccupancyHistory(sourcePropertyId: string, targetPropertyId: string, organizationId: string): Promise<void> {
    // TODO: implémenter quand interface créée
  }

  // Méthodes utilitaires pour les tests
  clear(): void {
    this.properties.clear();
    this.managementCompanies.clear();
    this.nextId = 1;
  }

  seedProperty(property: Property): void {
    this.properties.set(property.id, property);
  }

  seedManagementCompany(company: ManagementCompany): void {
    this.managementCompanies.set(company.id, company);
  }

  getAll(): Property[] {
    return Array.from(this.properties.values());
  }

  snapshot(): { properties: Property[]; managementCompanies: ManagementCompany[] } {
    return {
      properties: Array.from(this.properties.values()),
      managementCompanies: Array.from(this.managementCompanies.values()),
    };
  }
}

