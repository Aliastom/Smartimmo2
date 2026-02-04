/**
 * Implémentation in-memory du repository de transactions
 * Pour les tests de conformité sans dépendre de Dexie/Prisma
 */

import type {
  ITransactionRepository,
  Transaction,
  CreateTransactionData,
  UpdateTransactionData,
  TransactionWhere,
  TransactionContext,
} from '../interfaces/ITransactionRepository';

export class InMemoryTransactionRepository implements ITransactionRepository {
  private transactions: Map<string, Transaction> = new Map();
  private nextId = 1;

  private generateId(): string {
    return `tx_${this.nextId++}_${Date.now()}`;
  }

  async create(data: CreateTransactionData, ctx?: TransactionContext): Promise<Transaction> {
    const transaction: Transaction = {
      id: this.generateId(),
      organizationId: data.organizationId,
      propertyId: data.propertyId,
      leaseId: data.leaseId ?? null,
      bailId: data.bailId ?? null,
      categoryId: data.categoryId ?? null,
      label: data.label,
      amount: data.amount,
      date: data.date,
      reference: data.reference ?? null,
      notes: data.notes ?? null,
      paidAt: data.paidAt ?? null,
      method: data.method ?? null,
      accounting_month: data.accounting_month ?? null,
      monthsCovered: data.monthsCovered ?? null,
      moisIndex: data.moisIndex ?? null,
      moisTotal: data.moisTotal ?? null,
      rapprochementStatus: data.rapprochementStatus ?? 'non_rapprochee',
      dateRapprochement: data.dateRapprochement ?? null,
      bankRef: data.bankRef ?? null,
      montantLoyer: data.montantLoyer ?? null,
      chargesRecup: data.chargesRecup ?? null,
      chargesNonRecup: data.chargesNonRecup ?? null,
      isAutoAmount: data.isAutoAmount ?? null,
      nature: data.nature ?? null,
      parentTransactionId: data.parentTransactionId ?? null,
      managementCompanyId: data.managementCompanyId ?? null,
      isAuto: data.isAuto ?? false,
      autoSource: data.autoSource ?? null,
      source: data.source ?? 'MANUAL',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.transactions.set(transaction.id, transaction);
    return transaction;
  }

  async update(id: string, data: UpdateTransactionData, ctx?: TransactionContext): Promise<Transaction> {
    const existing = this.transactions.get(id);
    if (!existing) {
      throw new Error(`Transaction ${id} not found`);
    }

    const updated: Transaction = {
      ...existing,
      ...data,
      updatedAt: new Date(),
    };

    this.transactions.set(id, updated);
    return updated;
  }

  async delete(id: string, ctx?: TransactionContext): Promise<void> {
    if (!this.transactions.has(id)) {
      throw new Error(`Transaction ${id} not found`);
    }
    this.transactions.delete(id);
  }

  async deleteMany(where: TransactionWhere, ctx?: TransactionContext): Promise<void> {
    // Si where.id contient { in: string[] }, utiliser directement
    if (where.id && typeof where.id === 'object' && 'in' in where.id) {
      for (const id of where.id.in) {
        this.transactions.delete(id);
      }
    } else {
      // Sinon, chercher puis supprimer
      const toDelete = await this.findMany(where, ctx);
      for (const tx of toDelete) {
        this.transactions.delete(tx.id);
      }
    }
  }

  async findById(id: string, ctx?: TransactionContext): Promise<Transaction | null> {
    return this.transactions.get(id) || null;
  }

  async findByPropertyId(propertyId: string, ctx?: TransactionContext): Promise<Transaction[]> {
    return Array.from(this.transactions.values()).filter(
      tx => tx.propertyId === propertyId
    );
  }

  async findMany(where: TransactionWhere, ctx?: TransactionContext): Promise<Transaction[]> {
    let results = Array.from(this.transactions.values());

    if (where.organizationId) {
      results = results.filter(tx => tx.organizationId === where.organizationId);
    }
    if (where.id) {
      results = results.filter(tx => tx.id === where.id);
    }
    if (where.propertyId) {
      results = results.filter(tx => tx.propertyId === where.propertyId);
    }
    if (where.leaseId !== undefined) {
      if (where.leaseId === null) {
        results = results.filter(tx => tx.leaseId === null);
      } else {
        results = results.filter(tx => tx.leaseId === where.leaseId);
      }
    }
    if (where.categoryId) {
      results = results.filter(tx => tx.categoryId === where.categoryId);
    }
    if (where.nature) {
      if (typeof where.nature === 'string') {
        results = results.filter(tx => tx.nature === where.nature);
      } else if (where.nature && 'in' in where.nature) {
        results = results.filter(tx => tx.nature && where.nature && 'in' in where.nature && where.nature.in.includes(tx.nature));
      }
    }
    if (where.parentTransactionId !== undefined) {
      if (where.parentTransactionId === null) {
        results = results.filter(tx => tx.parentTransactionId === null);
      } else {
        results = results.filter(tx => tx.parentTransactionId === where.parentTransactionId);
      }
    }
    if (where.isAuto !== undefined) {
      results = results.filter(tx => tx.isAuto === where.isAuto);
    }
    if (where.autoSource) {
      results = results.filter(tx => tx.autoSource === where.autoSource);
    }
    if (where.amount) {
      if (where.amount.gte !== undefined) {
        results = results.filter(tx => tx.amount >= where.amount!.gte!);
      }
      if (where.amount.lte !== undefined) {
        results = results.filter(tx => tx.amount <= where.amount!.lte!);
      }
    }
    if (where.date) {
      if (where.date.gte) {
        results = results.filter(tx => tx.date >= where.date!.gte!);
      }
      if (where.date.lte) {
        results = results.filter(tx => tx.date <= where.date!.lte!);
      }
    }
    if (where.accounting_month) {
      if (where.accounting_month.gte) {
        results = results.filter(tx => tx.accounting_month && tx.accounting_month >= where.accounting_month!.gte!);
      }
      if (where.accounting_month.lte) {
        results = results.filter(tx => tx.accounting_month && tx.accounting_month <= where.accounting_month!.lte!);
      }
    }

    return results;
  }

  async findFirst(where: TransactionWhere, ctx?: TransactionContext): Promise<Transaction | null> {
    const results = await this.findMany(where, ctx);
    return results[0] || null;
  }

  // Méthodes utilitaires pour les tests
  clear(): void {
    this.transactions.clear();
    this.nextId = 1;
  }

  getAll(): Transaction[] {
    return Array.from(this.transactions.values());
  }

  seed(transactions: Transaction[]): void {
    for (const tx of transactions) {
      this.transactions.set(tx.id, tx);
    }
  }
}

