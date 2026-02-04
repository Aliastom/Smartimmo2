/**
 * Adapter Prisma pour ITenantRepository
 */

import { prisma } from '@/lib/prisma';
import type { ITenantRepository, Tenant, TenantWhere } from '../interfaces/ITenantRepository';

export class PrismaTenantRepository implements ITenantRepository {
  async findFirst(where: TenantWhere): Promise<Tenant | null> {
    const whereClause: any = {};
    if (where.organizationId) whereClause.organizationId = where.organizationId;
    if (where.id) whereClause.id = where.id;

    const result = await prisma.tenant.findFirst({
      where: whereClause,
      select: {
        id: true,
        organizationId: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    });

    if (!result) return null;

    return {
      id: result.id,
      organizationId: result.organizationId,
      firstName: result.firstName,
      lastName: result.lastName,
      email: result.email,
    };
  }
}


