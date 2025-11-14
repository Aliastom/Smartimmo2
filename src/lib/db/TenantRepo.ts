import { prisma } from '@/lib/prisma';

// Fonction pour mettre Ã  jour automatiquement le statut des baux
async function updateLeaseStatusBasedOnDates(lease: any, now: Date): Promise<string | null> {
  const startDate = new Date(lease.startDate);
  const endDate = lease.endDate ? new Date(lease.endDate) : null;
  
  if (lease.status === 'SIGNÃ‰' && now >= startDate) {
    return 'ACTIF';
  }
  
  if (lease.status === 'ACTIF' && endDate && now > endDate) {
    return 'RÃ‰SILIÃ‰';
  }
  
  if (lease.status === 'ACTIF' && !endDate) {
    return null;
  }
  
  return null;
}

export interface TenantFilters {
  search?: string;
  status?: 'active' | 'inactive' | 'all';
  page?: number;
  limit?: number;
  sortBy?: 'firstName' | 'lastName' | 'email' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface TenantWithRelations {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  birthDate?: Date;
  nationality?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  occupation?: string;
  employer?: string;
  monthlyIncome?: number;
  emergencyContact?: string;
  emergencyPhone?: string;
  status?: string;
  tags?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    Lease: number;
    Document: number;
  };
  Lease: Array<{
    id: string;
    Property: {
      name: string;
      address: string;
    };
    status: string;
    rentAmount: number;
    startDate: Date;
    endDate?: Date;
  }>;
}

export class TenantRepo {
  static async findMany(filters: TenantFilters = {}, organizationId: string) {
    const {
      search,
      status = 'all',
      page = 1,
      limit = 10,
      sortBy = 'lastName',
      sortOrder = 'asc'
    } = filters;

    const skip = (page - 1) * limit;

    const where: any = { organizationId };
    
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Filtrer par statut basÃ© sur les baux actifs
    if (status === 'withActiveLeases') {
      where.Lease = {
        some: { status: 'ACTIF' }
      };
    } else if (status === 'withoutLeases') {
      where.Lease = {
        none: { status: 'ACTIF' }
      };
    } else if (status === 'overduePayments') {
      // Pour les retards de paiement, on pourrait ajouter une logique plus complexe
      // Pour l'instant, on filtre les locataires avec des baux actifs
      where.Lease = {
        some: { status: 'ACTIF' }
      };
    }

    const [tenants, total] = await Promise.all([
      prisma.tenant.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          _count: {
            select: {
              Lease: true,
              Document: true
            }
          },
          Lease: {
            include: {
              Property: {
                select: {
                  name: true,
                  address: true
                }
              }
            },
            orderBy: { startDate: 'desc' }
          }
        }
      }),
      prisma.tenant.count({ where })
    ]);

    // Mettre Ã  jour automatiquement les statuts des baux
    const now = new Date();
    for (const tenant of tenants) {
      for (const lease of tenant.Lease) {
        const shouldUpdate = await updateLeaseStatusBasedOnDates(lease, now);
        if (shouldUpdate) {
          await prisma.lease.update({
            where: { id: lease.id },
            data: { status: shouldUpdate }
          });
          lease.status = shouldUpdate;
        }
      }
    }

    return {
      data: tenants as TenantWithRelations[],
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  static async findById(id: string, organizationId: string) {
    return prisma.tenant.findFirst({
      where: { id, organizationId },
      include: {
        Lease: {
          include: {
            Property: true
          }
        },
        Document: {
          include: {
            DocumentType: true
          }
        }
      }
    });
  }

  static async create(organizationId: string, data: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    birthDate?: Date;
    nationality?: string;
    address?: string;
    postalCode?: string;
    city?: string;
    country?: string;
    occupation?: string;
    employer?: string;
    monthlyIncome?: number;
    emergencyContact?: string;
    emergencyPhone?: string;
    status?: string;
    tags?: string;
    notes?: string;
  }) {
    return prisma.tenant.create({
      data: {
        ...data,
        organizationId,
        id: undefined // Prisma générera l'ID si @default est défini dans le schéma
      }
    });
  }

  static async update(id: string, organizationId: string, data: any) {
    const existing = await prisma.tenant.findFirst({ where: { id, organizationId }, select: { id: true } });
    if (!existing) {
      throw new Error('Tenant not found');
    }
    return prisma.tenant.update({
      where: { id },
      data
    });
  }

  static async delete(id: string, organizationId: string) {
    const existing = await prisma.tenant.findFirst({ where: { id, organizationId }, select: { id: true } });
    if (!existing) {
      throw new Error('Tenant not found');
    }
    // VÃ©rifier les dÃ©pendances avant suppression
    const [leases, documents] = await Promise.all([
      prisma.lease.count({ where: { tenantId: id } }),
      prisma.document.count({ where: { tenantId: id } })
    ]);

    if (leases > 0 || documents > 0) {
      throw new Error('Cannot delete tenant with existing leases or documents');
    }

    return prisma.tenant.delete({
      where: { id }
    });
  }

  static async getStats(organizationId: string) {
    const [
      total,
      withActiveLeases,
      withoutLeases,
      overduePayments
    ] = await Promise.all([
      prisma.tenant.count({ where: { organizationId } }),
      prisma.tenant.count({
        where: {
          organizationId,
          Lease: {
            some: {
              status: 'ACTIF'
            }
          }
        }
      }),
      prisma.tenant.count({
        where: {
          organizationId,
          Lease: {
            none: {}
          }
        }
      }),
      prisma.transaction.count({
        where: {
          organizationId,
          nature: 'LOYER',
          paidAt: null,
          date: {
            lt: new Date()
          }
        }
      })
    ]);

    return {
      total,
      withActiveLeases,
      withoutLeases,
      overduePayments
    };
  }
}
