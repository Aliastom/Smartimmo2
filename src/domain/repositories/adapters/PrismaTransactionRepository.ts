/**
 * Adapter Prisma pour ITransactionRepository
 * Implémente l'interface en utilisant Prisma comme backend
 */

import { prisma } from '@/lib/prisma';
import type {
  ITransactionRepository,
  Transaction,
  CreateTransactionData,
  UpdateTransactionData,
  TransactionWhere,
  TransactionContext,
} from '../interfaces/ITransactionRepository';

export class PrismaTransactionRepository implements ITransactionRepository {
  private prismaClient: typeof prisma;

  constructor(prismaClient?: typeof prisma) {
    this.prismaClient = prismaClient || prisma;
  }

  private getClient(ctx?: TransactionContext): typeof prisma {
    // Si un contexte de transaction est fourni, utiliser le client de transaction
    return (ctx as any)?.prisma || this.prismaClient;
  }

  async create(data: CreateTransactionData, ctx?: TransactionContext): Promise<Transaction> {
    const client = this.getClient(ctx);
    const result = await client.transaction.create({
      data: {
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
      },
    });

    return this.mapPrismaToTransaction(result);
  }

  async update(id: string, data: UpdateTransactionData, ctx?: TransactionContext): Promise<Transaction> {
    const client = this.getClient(ctx);
    const result = await client.transaction.update({
      where: { id },
      data: {
        ...(data.propertyId !== undefined && { propertyId: data.propertyId }),
        ...(data.leaseId !== undefined && { leaseId: data.leaseId }),
        ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
        ...(data.label !== undefined && { label: data.label }),
        ...(data.amount !== undefined && { amount: data.amount }),
        ...(data.date !== undefined && { date: data.date }),
        ...(data.reference !== undefined && { reference: data.reference }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.paidAt !== undefined && { paidAt: data.paidAt }),
        ...(data.method !== undefined && { method: data.method }),
        ...(data.accounting_month !== undefined && { accounting_month: data.accounting_month }),
        ...(data.monthsCovered !== undefined && { monthsCovered: data.monthsCovered }),
        ...(data.rapprochementStatus !== undefined && { rapprochementStatus: data.rapprochementStatus }),
        ...(data.dateRapprochement !== undefined && { dateRapprochement: data.dateRapprochement }),
        ...(data.bankRef !== undefined && { bankRef: data.bankRef }),
        ...(data.montantLoyer !== undefined && { montantLoyer: data.montantLoyer }),
        ...(data.chargesRecup !== undefined && { chargesRecup: data.chargesRecup }),
        ...(data.chargesNonRecup !== undefined && { chargesNonRecup: data.chargesNonRecup }),
        ...(data.isAutoAmount !== undefined && { isAutoAmount: data.isAutoAmount }),
        ...(data.nature !== undefined && { nature: data.nature }),
      },
    });

    return this.mapPrismaToTransaction(result);
  }

  async delete(id: string, ctx?: TransactionContext): Promise<void> {
    const client = this.getClient(ctx);
    await client.transaction.delete({
      where: { id },
    });
  }

  async deleteMany(where: TransactionWhere, ctx?: TransactionContext): Promise<void> {
    const client = this.getClient(ctx);
    const prismaWhere = this.mapWhereToPrisma(where);
    
    if (where.id && typeof where.id === 'object' && 'in' in where.id) {
      await client.transaction.deleteMany({
        where: { id: { in: where.id.in } },
      });
    } else {
      await client.transaction.deleteMany({
        where: prismaWhere,
      });
    }
  }

  async findById(id: string, ctx?: TransactionContext): Promise<Transaction | null> {
    const client = this.getClient(ctx);
    const result = await client.transaction.findUnique({
      where: { id },
    });

    return result ? this.mapPrismaToTransaction(result) : null;
  }

  async findByPropertyId(propertyId: string, ctx?: TransactionContext): Promise<Transaction[]> {
    const client = this.getClient(ctx);
    const results = await client.transaction.findMany({
      where: { propertyId },
    });

    return results.map(r => this.mapPrismaToTransaction(r));
  }

  async findMany(where: TransactionWhere, ctx?: TransactionContext): Promise<Transaction[]> {
    const client = this.getClient(ctx);
    const prismaWhere = this.mapWhereToPrisma(where);
    const results = await client.transaction.findMany({
      where: prismaWhere,
    });

    return results.map(r => this.mapPrismaToTransaction(r));
  }

  async findFirst(where: TransactionWhere, ctx?: TransactionContext): Promise<Transaction | null> {
    const client = this.getClient(ctx);
    const prismaWhere = this.mapWhereToPrisma(where);
    const result = await client.transaction.findFirst({
      where: prismaWhere,
    });

    return result ? this.mapPrismaToTransaction(result) : null;
  }

  // Support transaction Prisma
  async beginTransaction(): Promise<TransactionContext> {
    // Prisma gère les transactions via $transaction, on retourne un contexte vide
    // qui sera utilisé pour passer le client de transaction
    return {} as TransactionContext;
  }

  async commit(ctx: TransactionContext): Promise<void> {
    // Prisma gère le commit automatiquement dans $transaction
  }

  async rollback(ctx: TransactionContext): Promise<void> {
    // Prisma gère le rollback automatiquement dans $transaction
  }

  private mapPrismaToTransaction(prismaTx: any): Transaction {
    return {
      id: prismaTx.id,
      organizationId: prismaTx.organizationId,
      propertyId: prismaTx.propertyId,
      leaseId: prismaTx.leaseId,
      bailId: prismaTx.bailId,
      categoryId: prismaTx.categoryId,
      label: prismaTx.label,
      amount: prismaTx.amount,
      date: prismaTx.date,
      reference: prismaTx.reference,
      month: prismaTx.month,
      year: prismaTx.year,
      accounting_month: prismaTx.accounting_month,
      isRecurring: prismaTx.isRecurring,
      nature: prismaTx.nature,
      paidAt: prismaTx.paidAt,
      method: prismaTx.method,
      notes: prismaTx.notes,
      source: prismaTx.source,
      idempotencyKey: prismaTx.idempotencyKey,
      externalId: prismaTx.externalId,
      externalType: prismaTx.externalType,
      monthsCovered: prismaTx.monthsCovered,
      parentTransactionId: prismaTx.parentTransactionId,
      moisIndex: prismaTx.moisIndex,
      moisTotal: prismaTx.moisTotal,
      rapprochementStatus: prismaTx.rapprochementStatus,
      dateRapprochement: prismaTx.dateRapprochement,
      bankRef: prismaTx.bankRef,
      montantLoyer: prismaTx.montantLoyer,
      chargesRecup: prismaTx.chargesRecup,
      chargesNonRecup: prismaTx.chargesNonRecup,
      isAutoAmount: prismaTx.isAutoAmount,
      managementCompanyId: prismaTx.managementCompanyId,
      isAuto: prismaTx.isAuto,
      autoSource: prismaTx.autoSource,
      createdAt: prismaTx.createdAt,
      updatedAt: prismaTx.updatedAt,
    };
  }

  private mapWhereToPrisma(where: TransactionWhere): any {
    const prismaWhere: any = {};

    if (where.organizationId) {
      prismaWhere.organizationId = where.organizationId;
    }
    if (where.id) {
      if (typeof where.id === 'string') {
        prismaWhere.id = where.id;
      } else if (typeof where.id === 'object' && 'in' in where.id) {
        prismaWhere.id = { in: where.id.in };
      }
    }
    if (where.propertyId) {
      prismaWhere.propertyId = where.propertyId;
    }
    if (where.leaseId !== undefined) {
      prismaWhere.leaseId = where.leaseId;
    }
    if (where.categoryId) {
      prismaWhere.categoryId = where.categoryId;
    }
    if (where.nature) {
      if (typeof where.nature === 'string') {
        prismaWhere.nature = where.nature;
      } else if (typeof where.nature === 'object' && 'in' in where.nature) {
        prismaWhere.nature = { in: where.nature.in };
      }
    }
    if (where.parentTransactionId !== undefined) {
      prismaWhere.parentTransactionId = where.parentTransactionId;
    }
    if (where.isAuto !== undefined) {
      prismaWhere.isAuto = where.isAuto;
    }
    if (where.autoSource) {
      prismaWhere.autoSource = where.autoSource;
    }
    if (where.amount) {
      prismaWhere.amount = {};
      if (where.amount.gte !== undefined) prismaWhere.amount.gte = where.amount.gte;
      if (where.amount.lte !== undefined) prismaWhere.amount.lte = where.amount.lte;
    }
    if (where.date) {
      prismaWhere.date = {};
      if (where.date.gte) prismaWhere.date.gte = where.date.gte;
      if (where.date.lte) prismaWhere.date.lte = where.date.lte;
    }
    if (where.accounting_month) {
      prismaWhere.accounting_month = {};
      if (where.accounting_month.gte) prismaWhere.accounting_month.gte = where.accounting_month.gte;
      if (where.accounting_month.lte) prismaWhere.accounting_month.lte = where.accounting_month.lte;
    }
    if (where.Property) {
      prismaWhere.Property = {};
      if (where.Property.isArchived !== undefined) {
        prismaWhere.Property.isArchived = where.Property.isArchived;
      }
    }
    if (where.Lease) {
      prismaWhere.Lease_Transaction_leaseIdToLease = {};
      if (where.Lease.tenantId) {
        prismaWhere.Lease_Transaction_leaseIdToLease.tenantId = where.Lease.tenantId;
      }
    }

    return prismaWhere;
  }
}
