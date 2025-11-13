import { Property } from '../../domain/entities/Property';
import { prisma } from '../../lib/prisma';

export const propertyRepository = {
  async findAll(): Promise<Property[]> {
    return prisma.property.findMany() as Promise<Property[]>;
  },

  async findById(id: string): Promise<Property | null> {
    return prisma.property.findUnique({ where: { id } }) as Promise<Property | null>;
  },

  async create(data: Omit<Property, 'id' | 'createdAt' | 'updatedAt'>): Promise<Property> {
    return prisma.property.create({ data }) as Promise<Property>;
  },

  async update(id: string, data: Partial<Property>): Promise<Property> {
    return prisma.property.update({ where: { id }, data }) as Promise<Property>;
  },

  async delete(id: string): Promise<Property> {
    return prisma.property.delete({ where: { id } }) as Promise<Property>;
  },
};
