import prisma from '../db/client';
import { Photo } from '../../domain/entities/Photo';

export const photoRepository = {
  async findAll(): Promise<Photo[]> {
    return prisma.photo.findMany() as Promise<Photo[]>;
  },

  async findById(id: string): Promise<Photo | null> {
    return prisma.photo.findUnique({ where: { id } }) as Promise<Photo | null>;
  },

  async findByPropertyId(propertyId: string): Promise<Photo[]> {
    return prisma.photo.findMany({ where: { propertyId } }) as Promise<Photo[]>;
  },

  async create(data: Omit<Photo, 'id' | 'createdAt' | 'updatedAt'>): Promise<Photo> {
    return prisma.photo.create({ data }) as Promise<Photo>;
  },

  async update(id: string, data: Partial<Photo>): Promise<Photo> {
    return prisma.photo.update({ where: { id }, data }) as Promise<Photo>;
  },

  async delete(id: string): Promise<Photo> {
    return prisma.photo.delete({ where: { id } }) as Promise<Photo>;
  },
};
