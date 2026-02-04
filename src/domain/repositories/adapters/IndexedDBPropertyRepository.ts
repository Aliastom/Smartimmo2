/**
 * Adapter IndexedDB pour IPropertyRepository
 * Utilise PropertyRepositoryOffline pour l'accès aux données et la création de pendingOps
 */

import { getLeaseRepositoryOffline } from '@/lib/offline/repositories/LeaseRepositoryOffline';
import { getPropertyRepositoryOffline } from '@/lib/offline/repositories/PropertyRepositoryOffline';
import type {
  IPropertyRepository,
  Property,
  PropertyWithCompany,
  ManagementCompany,
  CreatePropertyData,
  UpdatePropertyData,
  PropertyStats,
} from '../interfaces/IPropertyRepository';
import { getLocalDB } from '@/lib/offline/db';

export class IndexedDBPropertyRepository implements IPropertyRepository {
  private _dbPromise: Promise<any> | null = null;
  private propertyRepo = getPropertyRepositoryOffline();

  private async getDb() {
    if (!this._dbPromise) {
      this._dbPromise = getLocalDB();
    }
    return this._dbPromise;
  }

  async create(data: CreatePropertyData): Promise<Property> {
    // ✅ Utiliser PropertyRepositoryOffline.upsert() pour créer automatiquement les pendingOps
    const result = await this.propertyRepo.upsert({
      id: crypto.randomUUID(),
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
      rentalMode: data.rentalMode ?? null,
      airbnbListingId: data.airbnbListingId ?? null,
    }, data.organizationId);
    return result as Property;
  }

  async update(id: string, data: UpdatePropertyData): Promise<Property> {
    const db = await this.getDb();
    const existing = await db.Property.get(id);
    if (!existing) {
      throw new Error(`Property ${id} not found`);
    }

    // ✅ Utiliser PropertyRepositoryOffline.upsert() pour créer automatiquement les pendingOps
    const result = await this.propertyRepo.upsert({
      id,
      ...data,
      organizationId: existing.organizationId,
    }, existing.organizationId);
    return result as Property;
  }

  async delete(id: string, mode: 'archive' | 'cascade' = 'archive'): Promise<void> {
    const db = await this.getDb();
    const existing = await db.Property.get(id);
    if (!existing) {
      throw new Error(`Property ${id} not found`);
    }

    // ✅ Utiliser PropertyRepositoryOffline.delete() pour créer automatiquement les pendingOps
    // ✅ Passer le mode pour différencier archive (soft delete) et cascade (hard delete)
    await this.propertyRepo.delete(id, existing.organizationId, mode);
  }

  async findById(id: string, organizationId: string): Promise<Property | null> {
    return this.findFirst({ id, organizationId });
  }

  async findFirst(where: { id: string; organizationId: string }): Promise<Property | null> {
    const db = await this.getDb();
    const property = await db.Property.get(where.id);
    if (!property || property.organizationId !== where.organizationId) {
      return null;
    }
    return property as Property;
  }

  async findFirstWithManagementCompany(where: { id: string; organizationId: string }): Promise<PropertyWithCompany | null> {
    const property = await this.findFirst(where);
    if (!property) return null;

    let managementCompany: ManagementCompany | null = null;
    if (property.managementCompanyId) {
      const db = await this.getDb();
      const company = await db.ManagementCompany.get(property.managementCompanyId);
      if (company) {
        managementCompany = {
          id: company.id,
          organizationId: company.organizationId,
          nom: company.nom,
          modeCalcul: company.modeCalcul,
          taux: company.taux,
          fraisMin: company.fraisMin,
          tvaApplicable: company.tvaApplicable,
          tauxTva: company.tauxTva,
          actif: company.actif,
        };
      }
    }

    return {
      ...property,
      ManagementCompany: managementCompany,
    };
  }

  async getStats(propertyId: string, organizationId: string): Promise<PropertyStats> {
    const leaseRepo = getLeaseRepositoryOffline();
    const db = await this.getDb();

    // ✅ Charger les leases
    const leases = await leaseRepo.getAll(organizationId, { propertyId });

    // ✅ Charger les transactions (gestion spéciale pour la table Transaction)
    let transactions: any[] = [];
    try {
      let transactionTable: any;
      const transactionTableFromTables = db.tables?.find((t: any) => t.name === 'Transaction');
      if (transactionTableFromTables && typeof transactionTableFromTables.where === 'function') {
        transactionTable = transactionTableFromTables;
      } else {
        transactionTable = (db as any).Transaction;
      }
      
      if (transactionTable && typeof transactionTable.where === 'function') {
        transactions = await transactionTable
          .where('organizationId')
          .equals(organizationId)
          .filter((t: any) => t.propertyId === propertyId)
          .toArray();
      }
    } catch (error) {
      console.warn('[IndexedDBPropertyRepository] Erreur chargement transactions pour stats:', error);
    }

    // ✅ Charger les documents
    let documents: any[] = [];
    try {
      if (db.Document && typeof db.Document.where === 'function') {
        documents = await db.Document
          .where('organizationId')
          .equals(organizationId)
          .filter((d: any) => d.propertyId === propertyId)
          .toArray();
      }
    } catch (error) {
      console.warn('[IndexedDBPropertyRepository] Erreur chargement documents pour stats:', error);
    }

    // ✅ Charger les échéances
    let echeances = 0;
    try {
      if (db.EcheanceRecurrente && typeof db.EcheanceRecurrente.where === 'function') {
        const allEcheances = await db.EcheanceRecurrente
          .where('organizationId')
          .equals(organizationId)
          .filter((e: any) => e.propertyId === propertyId)
          .toArray();
        echeances = allEcheances.length;
      }
    } catch (error) {
      console.warn('[IndexedDBPropertyRepository] Erreur chargement échéances pour stats:', error);
    }

    // ✅ Charger les prêts
    let loans = 0;
    try {
      if (db.Loan && typeof db.Loan.where === 'function') {
        const allLoans = await db.Loan
          .where('organizationId')
          .equals(organizationId)
          .filter((l: any) => l.propertyId === propertyId)
          .toArray();
        loans = allLoans.length;
      }
    } catch (error) {
      console.warn('[IndexedDBPropertyRepository] Erreur chargement prêts pour stats:', error);
    }

    return {
      leases: leases.length,
      transactions: transactions.length,
      documents: documents.length,
      echeances,
      loans,
    };
  }

  async reassignLeases(sourcePropertyId: string, targetPropertyId: string, organizationId: string): Promise<void> {
    const leaseRepo = getLeaseRepositoryOffline();
    const db = await this.getDb();
    const leases = await leaseRepo.getAll(organizationId, { propertyId: sourcePropertyId });
    for (const lease of leases) {
      const updated = { ...lease, propertyId: targetPropertyId };
      await db.Lease.put(updated);
    }
  }

  async reassignTransactions(sourcePropertyId: string, targetPropertyId: string, organizationId: string): Promise<void> {
    const db = await this.getDb();
    const transactions = await db.Transaction.where('organizationId').equals(organizationId).filter((t: any) => t.propertyId === sourcePropertyId).toArray();
    for (const tx of transactions) {
      const updated = { ...tx, propertyId: targetPropertyId };
      await db.Transaction.put(updated);
    }
  }

  async reassignDocuments(sourcePropertyId: string, targetPropertyId: string, organizationId: string): Promise<void> {
    const db = await this.getDb();
    const documents = await db.Document.where('organizationId').equals(organizationId).filter((d: any) => d.propertyId === sourcePropertyId).toArray();
    for (const doc of documents) {
      const updated = { ...doc, propertyId: targetPropertyId };
      await db.Document.put(updated);
    }
  }

  async reassignEcheances(sourcePropertyId: string, targetPropertyId: string, organizationId: string): Promise<void> {
    // TODO: implémenter quand repository existe
  }

  async reassignLoans(sourcePropertyId: string, targetPropertyId: string, organizationId: string): Promise<void> {
    // TODO: implémenter quand repository existe
  }

  async reassignPayments(sourcePropertyId: string, targetPropertyId: string, organizationId: string): Promise<void> {
    // TODO: implémenter quand repository existe
  }

  async reassignPhotos(sourcePropertyId: string, targetPropertyId: string, organizationId: string): Promise<void> {
    // TODO: implémenter quand repository existe
  }

  async reassignOccupancyHistory(sourcePropertyId: string, targetPropertyId: string, organizationId: string): Promise<void> {
    // TODO: implémenter quand repository existe
  }
}


