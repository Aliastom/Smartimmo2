import prisma from '../db/client';
import { Document } from '../../domain/entities/Document';

export const documentRepository = {
  async findAll(): Promise<Document[]> {
    return prisma.document.findMany() as Promise<Document[]>;
  },

  async findById(id: string): Promise<Document | null> {
    return prisma.document.findUnique({ where: { id } }) as Promise<Document | null>;
  },

  async findByPropertyId(propertyId: string): Promise<Document[]> {
    return prisma.document.findMany({ where: { propertyId } }) as Promise<Document[]>;
  },

  async findByTransactionId(transactionId: string): Promise<Document[]> {
    return prisma.document.findMany({ where: { transactionId } }) as Promise<Document[]>;
  },

  async findByLeaseId(leaseId: string): Promise<Document[]> {
    return prisma.document.findMany({ where: { leaseId } }) as Promise<Document[]>;
  },

  async findByLoanId(loanId: string): Promise<Document[]> {
    return prisma.document.findMany({ where: { loanId } }) as Promise<Document[]>;
  },

  async findByFilters(filters: {
    docType?: string;
    propertyId?: string;
    transactionId?: string;
    q?: string;
  }): Promise<Document[]> {
    const where: any = {};
    
    if (filters.docType) {
      where.docType = filters.docType;
    }
    if (filters.propertyId) {
      where.propertyId = filters.propertyId;
    }
    if (filters.transactionId) {
      where.transactionId = filters.transactionId;
    }
    if (filters.q) {
      where.OR = [
        { fileName: { contains: filters.q } },
        { tagsJson: { contains: filters.q } },
      ];
    }

    return prisma.document.findMany({ where }) as Promise<Document[]>;
  },

  async create(data: Omit<Document, 'id' | 'createdAt' | 'updatedAt'>): Promise<Document> {
    return prisma.document.create({ data }) as Promise<Document>;
  },

  async update(id: string, data: Partial<Document>): Promise<Document> {
    return prisma.document.update({ where: { id }, data }) as Promise<Document>;
  },

  async delete(id: string): Promise<Document> {
    return prisma.document.delete({ where: { id } }) as Promise<Document>;
  },
};
