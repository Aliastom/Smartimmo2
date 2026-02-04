/**
 * Implémentation in-memory du repository de baux
 */

import type {
  ILeaseRepository,
  Lease,
  CreateLeaseData,
  UpdateLeaseData,
  LeaseWhere,
} from '../interfaces/ILeaseRepository';
import type { ITransactionRepository } from '../repositories/interfaces/ITransactionRepository';

export class InMemoryLeaseRepository implements ILeaseRepository {
  private leases: Map<string, Lease> = new Map();
  private nextId = 1;

  // Dépendance pour countTransactions
  private transactionRepo?: ITransactionRepository;

  setTransactionRepo(repo: ITransactionRepository) {
    this.transactionRepo = repo;
  }

  private generateId(): string {
    return `lease_${this.nextId++}_${Date.now()}`;
  }

  async create(data: CreateLeaseData): Promise<Lease> {
    const lease: Lease = {
      id: this.generateId(),
      organizationId: data.organizationId,
      propertyId: data.propertyId,
      tenantId: data.tenantId,
      type: data.type,
      furnishedType: data.furnishedType ?? null,
      startDate: data.startDate,
      endDate: data.endDate ?? null,
      rentAmount: data.rentAmount,
      deposit: data.deposit ?? null,
      paymentDay: data.paymentDay ?? null,
      indexationType: data.indexationType ?? null,
      notes: data.notes ?? null,
      status: data.status ?? null,
      signedPdfUrl: data.signedPdfUrl ?? null,
      chargesRecupMensuelles: data.chargesRecupMensuelles ?? null,
      chargesNonRecupMensuelles: data.chargesNonRecupMensuelles ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.leases.set(lease.id, lease);
    return lease;
  }

  async update(id: string, data: UpdateLeaseData): Promise<Lease> {
    const existing = this.leases.get(id);
    if (!existing) {
      throw new Error(`Lease ${id} not found`);
    }

    const updated: Lease = {
      ...existing,
      ...data,
      updatedAt: new Date(),
    };

    this.leases.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    if (!this.leases.has(id)) {
      throw new Error(`Lease ${id} not found`);
    }
    this.leases.delete(id);
  }

  async findById(id: string, organizationId: string): Promise<Lease | null> {
    const lease = this.leases.get(id);
    if (!lease || lease.organizationId !== organizationId) {
      return null;
    }
    return lease;
  }

  async findFirst(where: LeaseWhere): Promise<Lease | null> {
    let results = Array.from(this.leases.values());

    if (where.organizationId) {
      results = results.filter(lease => lease.organizationId === where.organizationId);
    }
    if (where.id) {
      results = results.filter(lease => lease.id === where.id);
    }
    if (where.propertyId) {
      results = results.filter(lease => lease.propertyId === where.propertyId);
    }
    if (where.tenantId) {
      results = results.filter(lease => lease.tenantId === where.tenantId);
    }
    if (where.status) {
      results = results.filter(lease => lease.status === where.status);
    }

    return results[0] || null;
  }

  async findByPropertyId(propertyId: string, organizationId: string): Promise<Lease[]> {
    return this.findMany({ propertyId, organizationId });
  }

  async findByTenantId(tenantId: string, organizationId: string): Promise<Lease[]> {
    return this.findMany({ tenantId, organizationId });
  }

  async findMany(where: LeaseWhere): Promise<Lease[]> {
    let results = Array.from(this.leases.values());

    if (where.organizationId) {
      results = results.filter(lease => lease.organizationId === where.organizationId);
    }
    if (where.id) {
      results = results.filter(lease => lease.id === where.id);
    }
    if (where.propertyId) {
      results = results.filter(lease => lease.propertyId === where.propertyId);
    }
    if (where.tenantId) {
      results = results.filter(lease => lease.tenantId === where.tenantId);
    }
    if (where.status) {
      results = results.filter(lease => lease.status === where.status);
    }

    return results;
  }

  async countTransactions(leaseId: string, organizationId: string): Promise<number> {
    if (!this.transactionRepo) return 0;
    const transactions = await this.transactionRepo.findMany({
      leaseId,
      organizationId,
    });
    return transactions.length;
  }

  // Méthodes utilitaires pour les tests
  clear(): void {
    this.leases.clear();
    this.nextId = 1;
  }

  seed(leases: Lease[]): void {
    for (const lease of leases) {
      this.leases.set(lease.id, lease);
    }
  }

  getAll(): Lease[] {
    return Array.from(this.leases.values());
  }

  snapshot(): { leases: Lease[] } {
    return {
      leases: Array.from(this.leases.values()),
    };
  }
}

