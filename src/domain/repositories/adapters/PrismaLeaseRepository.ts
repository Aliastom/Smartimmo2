/**
 * Adapter Prisma pour ILeaseRepository
 */

import { prisma } from '@/lib/prisma';
import type {
  ILeaseRepository,
  Lease,
  CreateLeaseData,
  UpdateLeaseData,
  LeaseWhere,
} from '../interfaces/ILeaseRepository';

export class PrismaLeaseRepository implements ILeaseRepository {
  async create(data: CreateLeaseData): Promise<Lease> {
    const result = await prisma.lease.create({
      data: {
        organizationId: data.organizationId,
        propertyId: data.propertyId,
        tenantId: data.tenantId,
        type: data.type,
        furnishedType: data.furnishedType,
        startDate: data.startDate,
        endDate: data.endDate,
        rentAmount: data.rentAmount,
        deposit: data.deposit,
        paymentDay: data.paymentDay,
        indexationType: data.indexationType,
        notes: data.notes,
        status: data.status,
        signedPdfUrl: data.signedPdfUrl,
        chargesRecupMensuelles: data.chargesRecupMensuelles,
        chargesNonRecupMensuelles: data.chargesNonRecupMensuelles,
      },
    });

    return this.mapPrismaToLease(result);
  }

  async update(id: string, data: UpdateLeaseData): Promise<Lease> {
    const result = await prisma.lease.update({
      where: { id },
      data: {
        propertyId: data.propertyId,
        tenantId: data.tenantId,
        type: data.type,
        furnishedType: data.furnishedType,
        startDate: data.startDate,
        endDate: data.endDate,
        rentAmount: data.rentAmount,
        deposit: data.deposit,
        paymentDay: data.paymentDay,
        indexationType: data.indexationType,
        notes: data.notes,
        status: data.status,
        signedPdfUrl: data.signedPdfUrl,
        chargesRecupMensuelles: data.chargesRecupMensuelles,
        chargesNonRecupMensuelles: data.chargesNonRecupMensuelles,
      },
    });

    return this.mapPrismaToLease(result);
  }

  async delete(id: string): Promise<void> {
    await prisma.lease.delete({
      where: { id },
    });
  }

  async findById(id: string, organizationId: string): Promise<Lease | null> {
    const result = await prisma.lease.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!result) return null;

    return this.mapPrismaToLease(result);
  }

  async findFirst(where: LeaseWhere): Promise<Lease | null> {
    const whereClause: any = {};
    if (where.organizationId) whereClause.organizationId = where.organizationId;
    if (where.id) whereClause.id = where.id;
    if (where.propertyId) whereClause.propertyId = where.propertyId;
    if (where.tenantId) whereClause.tenantId = where.tenantId;
    if (where.status) whereClause.status = where.status;

    const result = await prisma.lease.findFirst({
      where: whereClause,
    });

    if (!result) return null;

    return this.mapPrismaToLease(result);
  }

  async findByPropertyId(propertyId: string, organizationId: string): Promise<Lease[]> {
    return this.findMany({ propertyId, organizationId });
  }

  async findByTenantId(tenantId: string, organizationId: string): Promise<Lease[]> {
    return this.findMany({ tenantId, organizationId });
  }

  async findMany(where: LeaseWhere): Promise<Lease[]> {
    const whereClause: any = {};
    if (where.organizationId) whereClause.organizationId = where.organizationId;
    if (where.id) whereClause.id = where.id;
    if (where.propertyId) whereClause.propertyId = where.propertyId;
    if (where.tenantId) whereClause.tenantId = where.tenantId;
    if (where.status) whereClause.status = where.status;

    const results = await prisma.lease.findMany({
      where: whereClause,
    });

    return results.map(r => this.mapPrismaToLease(r));
  }

  async countTransactions(leaseId: string, organizationId: string): Promise<number> {
    const count = await prisma.transaction.count({
      where: {
        OR: [
          { leaseId, organizationId },
          { bailId: leaseId, organizationId },
        ],
      },
    });

    return count;
  }

  private mapPrismaToLease(result: any): Lease {
    return {
      id: result.id,
      organizationId: result.organizationId,
      propertyId: result.propertyId,
      tenantId: result.tenantId,
      type: result.type,
      furnishedType: result.furnishedType,
      startDate: result.startDate,
      endDate: result.endDate,
      rentAmount: result.rentAmount,
      deposit: result.deposit,
      paymentDay: result.paymentDay,
      indexationType: result.indexationType,
      notes: result.notes,
      status: result.status,
      signedPdfUrl: result.signedPdfUrl,
      chargesRecupMensuelles: result.chargesRecupMensuelles,
      chargesNonRecupMensuelles: result.chargesNonRecupMensuelles,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  }
}
