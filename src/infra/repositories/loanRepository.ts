import prisma from '../db/client';
import { Loan } from '../../domain/entities/Loan';

export const loanRepository = {
  async findAll(): Promise<Loan[]> {
    return prisma.loan.findMany() as Promise<Loan[]>;
  },

  async findById(id: string): Promise<Loan | null> {
    return prisma.loan.findUnique({ where: { id } }) as Promise<Loan | null>;
  },

  async findByPropertyId(propertyId: string): Promise<Loan[]> {
    return prisma.loan.findMany({ where: { propertyId } }) as Promise<Loan[]>;
  },

  async create(data: Omit<Loan, 'id' | 'createdAt' | 'updatedAt'>): Promise<Loan> {
    return prisma.loan.create({ data }) as Promise<Loan>;
  },

  async update(id: string, data: Partial<Loan>): Promise<Loan> {
    return prisma.loan.update({ where: { id }, data }) as Promise<Loan>;
  },

  async delete(id: string): Promise<Loan> {
    return prisma.loan.delete({ where: { id } }) as Promise<Loan>;
  },
};
