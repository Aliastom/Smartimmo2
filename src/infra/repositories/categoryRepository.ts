import prisma from '../db/client';
import { Category } from '../../domain/entities/Category';

export const categoryRepository = {
  async findAll(): Promise<Category[]> {
    return prisma.category.findMany() as Promise<Category[]>;
  },

  async findById(id: string): Promise<Category | null> {
    return prisma.category.findUnique({ where: { id } }) as Promise<Category | null>;
  },

  async create(data: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>): Promise<Category> {
    return prisma.category.create({ data }) as Promise<Category>;
  },

  async update(id: string, data: Partial<Category>): Promise<Category> {
    return prisma.category.update({ where: { id }, data }) as Promise<Category>;
  },

  async delete(id: string): Promise<Category> {
    return prisma.category.delete({ where: { id } }) as Promise<Category>;
  },
};
