import { prisma } from '@/lib/prisma';

export interface PropertyFilters {
  search?: string;
  status?: string;
  type?: string;
  city?: string;
  includeArchived?: boolean;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'address' | 'surface' | 'currentValue' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface PropertyWithRelations {
  id: string;
  name: string;
  type: string;
  address: string;
  postalCode: string;
  city: string;
  surface: number;
  rooms: number;
  status: string;
  currentValue: number;
  isArchived: boolean;
  archivedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    Lease: number;
    Transaction: number;
    Document: number;
  };
  Lease: Array<{
    id: string;
    Tenant: {
      firstName: string;
      lastName: string;
    };
    status: string;
    rentAmount: number;
  }>;
  ManagementCompany?: {
    id: string;
    nom: string;
    modeCalcul: string;
    taux: number;
    fraisMin?: number;
    tvaApplicable: boolean;
    tauxTva?: number;
    actif: boolean;
  } | null;
}

export class PropertyRepo {
  static async findMany(filters: PropertyFilters = {}) {
    const {
      search,
      status,
      type,
      city,
      includeArchived = false,
      page = 1,
      limit = 10,
      sortBy = 'name',
      sortOrder = 'asc'
    } = filters;

    const skip = (page - 1) * limit;

    const where: any = {};
    
    // Filtre archivés : par défaut, exclure les biens archivés
    if (!includeArchived) {
      where.isArchived = false;
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    if (status === 'occupied') {
      where.Lease = {
        some: {
          status: 'ACTIF'
        }
      };
    } else if (status === 'vacant') {
      where.Lease = {
        none: {
          status: 'ACTIF'
        }
      };
    }
    if (type) where.type = type;
    if (city) where.city = city;

    const [properties, total] = await Promise.all([
      prisma.property.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          _count: {
            select: {
              Lease: true,
              Transaction: true,
              Document: true
            }
          },
          Lease: {
            where: { status: 'ACTIF' },
            include: {
              Tenant: {
                select: {
                  firstName: true,
                  lastName: true
                }
              }
            },
            take: 1
          },
          // ⚙️ GESTION DÉLÉGUÉE: Inclure la société de gestion pour afficher la commission estimée
          ManagementCompany: {
            select: {
              id: true,
              nom: true,
              modeCalcul: true,
              taux: true,
              fraisMin: true,
              tvaApplicable: true,
              tauxTva: true,
              actif: true
            }
          }
        }
      }),
      prisma.property.count({ where })
    ]);

    return {
      data: properties as PropertyWithRelations[],
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  static async findById(id: string) {
    return prisma.property.findUnique({
      where: { id },
      include: {
        Lease: {
          include: {
            Tenant: true
          }
        },
        Transaction: {
          orderBy: { date: 'desc' },
          take: 10
        },
        Document: {
          include: {
            DocumentType: true
          }
        },
        Loan: true,
        Photo: true
      }
    });
  }

  static async create(data: {
    name: string;
    type: string;
    address: string;
    postalCode: string;
    city: string;
    surface: number;
    rooms: number;
    acquisitionDate: Date;
    acquisitionPrice: number;
    notaryFees?: number;
    currentValue?: number;
    status?: string;
    occupation?: string;
    notes?: string;
    managementCompanyId?: string;
  }) {
    return prisma.property.create({
      data: {
        ...data,
        currentValue: data.currentValue || data.acquisitionPrice,
        status: data.status || 'vacant',
        occupation: data.occupation || 'VACANT'
      }
    });
  }

  static async update(id: string, data: any) {
    return prisma.property.update({
      where: { id },
      data
    });
  }

  static async delete(id: string) {
    // Vérifier les dépendances avant suppression
    const [leases, transactions, documents] = await Promise.all([
      prisma.lease.count({ where: { propertyId: id } }),
      prisma.transaction.count({ where: { propertyId: id } }),
      prisma.document.count({ where: { propertyId: id } })
    ]);

    if (leases > 0 || transactions > 0 || documents > 0) {
      throw new Error('Cannot delete property with existing leases, transactions, or documents');
    }

    return prisma.property.delete({
      where: { id }
    });
  }

  static async getStats() {
    const [
      total,
      occupied,
      vacant,
      monthlyRevenue
    ] = await Promise.all([
      prisma.property.count(),
      prisma.property.count({
        where: {
          Lease: {
            some: {
              status: 'ACTIF'
            }
          }
        }
      }),
      prisma.property.count({
        where: {
          Lease: {
            none: {
              status: 'ACTIF'
            }
          }
        }
      }),
      prisma.transaction.aggregate({
        where: {
          nature: 'LOYER',
          date: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        },
        _sum: {
          amount: true
        }
      })
    ]);

    return {
      total,
      occupied,
      vacant,
      monthlyRevenue: monthlyRevenue._sum.amount || 0
    };
  }
}
