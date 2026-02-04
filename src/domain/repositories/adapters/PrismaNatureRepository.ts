/**
 * Adapter Prisma pour INatureRepository
 */

import { prisma } from '@/lib/prisma';
import type { INatureRepository, NatureEntity } from '../interfaces/INatureRepository';

export class PrismaNatureRepository implements INatureRepository {
  async findMany(): Promise<NatureEntity[]> {
    const results = await prisma.natureEntity.findMany({
      select: {
        code: true,
        label: true,
        flow: true,
      },
    });

    return results.map(nature => ({
      code: nature.code,
      label: nature.label,
      flow: nature.flow,
    }));
  }
}
