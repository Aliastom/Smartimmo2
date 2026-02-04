/**
 * Adapter Prisma pour ICategoryRepository
 */

import { prisma } from '@/lib/prisma';
import type { ICategoryRepository, Category } from '../interfaces/ICategoryRepository';

export class PrismaCategoryRepository implements ICategoryRepository {
  async findUnique(where: { id: string }): Promise<Category | null> {
    const result = await prisma.category.findUnique({
      where: { id: where.id },
      select: {
        id: true,
        slug: true,
        label: true,
        type: true,
        actif: true,
      },
    });

    if (!result) return null;

    return {
      id: result.id,
      slug: result.slug,
      label: result.label,
      type: result.type,
      actif: result.actif,
    };
  }

  async findFirst(where: { slug: string; actif: boolean }): Promise<Category | null> {
    const result = await prisma.category.findFirst({
      where: {
        slug: where.slug,
        actif: where.actif,
      },
      select: {
        id: true,
        slug: true,
        label: true,
        type: true,
        actif: true,
      },
    });

    if (!result) return null;

    return {
      id: result.id,
      slug: result.slug,
      label: result.label,
      type: result.type,
      actif: result.actif,
    };
  }
}
