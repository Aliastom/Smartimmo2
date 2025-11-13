import { Transaction } from '../../domain/entities/Transaction';
import { prisma } from '../../lib/prisma';

export const transactionRepository = {
  async findAll(): Promise<Transaction[]> {
    return prisma.transaction.findMany() as Promise<Transaction[]>;
  },

  async findById(id: string): Promise<Transaction | null> {
    return prisma.transaction.findUnique({ where: { id } }) as Promise<Transaction | null>;
  },

  async findByPropertyId(propertyId: string): Promise<Transaction[]> {
    return prisma.transaction.findMany({ where: { propertyId } }) as Promise<Transaction[]>;
  },

  async create(data: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>): Promise<Transaction> {
    return prisma.transaction.create({ data }) as Promise<Transaction>;
  },

  async update(id: string, data: Partial<Transaction>): Promise<Transaction> {
    return prisma.transaction.update({ where: { id }, data }) as Promise<Transaction>;
  },

  async delete(id: string): Promise<Transaction> {
    return prisma.transaction.delete({ where: { id } }) as Promise<Transaction>;
  },
};
