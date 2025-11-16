import { Lease } from '../../domain/entities/Lease';
import { prisma } from '../../lib/prisma';

interface LeaseFilters {
  propertyId?: string;
  type?: string;
  status?: string;
  year?: number;
  month?: number;
}

interface LeaseSearchParams {
  filters?: LeaseFilters;
  search?: string;
  page?: number;
  limit?: number;
}

export const leaseRepository = {
  async findAll(organizationId: string): Promise<Lease[]> {
    const leases = await prisma.lease.findMany({
      where: { organizationId },
      include: {
        Property: {
          select: { id: true, name: true, address: true }
        },
        Tenant: {
          select: { id: true, firstName: true, lastName: true, email: true }
        }
      },
      orderBy: { startDate: 'desc' }
    });
    return leases as Promise<Lease[]>;
  },

  async findById(id: string, organizationId: string): Promise<Lease | null> {
    const lease = await prisma.lease.findUnique({
      where: { id, organizationId },
      include: {
        Property: {
          select: { 
            id: true, 
            name: true, 
            address: true, 
            postalCode: true, 
            city: true, 
            surface: true, 
            rooms: true 
          }
        },
        Tenant: {
          select: { 
            id: true, 
            firstName: true, 
            lastName: true, 
            email: true, 
            phone: true, 
            birthDate: true 
          }
        }
      }
    });
    return lease as Lease | null;
  },

  async findByPropertyId(propertyId: string, organizationId: string): Promise<Lease[]> {
    const leases = await prisma.lease.findMany({ 
      where: { propertyId, organizationId },
      include: {
        Property: {
          select: { id: true, name: true, address: true }
        },
        Tenant: {
          select: { id: true, firstName: true, lastName: true, email: true }
        }
      },
      orderBy: { startDate: 'desc' }
    });
    return leases as Promise<Lease[]>;
  },

  async findByTenantId(tenantId: string, organizationId: string): Promise<Lease[]> {
    const leases = await prisma.lease.findMany({ 
      where: { tenantId, organizationId },
      include: {
        Property: {
          select: { id: true, name: true, address: true }
        },
        Tenant: {
          select: { id: true, firstName: true, lastName: true, email: true }
        }
      },
      orderBy: { startDate: 'desc' }
    });
    return leases as Promise<Lease[]>;
  },

  async findWithFilters(params: LeaseSearchParams & { organizationId: string }): Promise<{ leases: Lease[]; total: number; pages: number }> {
    const { filters = {}, search = '', page = 1, limit = 10, organizationId } = params;
    
    // Construire la clause where
    const where: any = { organizationId };
    
    if (filters.propertyId) where.propertyId = filters.propertyId;
    if (filters.type) where.type = filters.type;
    if (filters.status) where.status = filters.status;
    
    if (filters.year || filters.month) {
      where.startDate = {};
      if (filters.year) {
        where.startDate.gte = new Date(filters.year, 0, 1);
        where.startDate.lt = new Date(filters.year + 1, 0, 1);
      }
      if (filters.month) {
        where.startDate.gte = new Date(filters.year || new Date().getFullYear(), filters.month - 1, 1);
        where.startDate.lt = new Date(filters.year || new Date().getFullYear(), filters.month, 1);
      }
    }
    
    if (search) {
      where.OR = [
        { Property: { name: { contains: search, mode: 'insensitive' } } },
        { Property: { address: { contains: search, mode: 'insensitive' } } },
        { Tenant: { firstName: { contains: search, mode: 'insensitive' } } },
        { Tenant: { lastName: { contains: search, mode: 'insensitive' } } },
        { notes: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    // Compter le total
    const total = await prisma.lease.count({ where });
    const pages = Math.ceil(total / limit);
    
    // Récupérer les données paginées
    const leases = await prisma.lease.findMany({
      where,
      include: {
        Property: {
          select: { id: true, name: true, address: true }
        },
        Tenant: {
          select: { id: true, firstName: true, lastName: true, email: true }
        }
      },
      orderBy: { startDate: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    });
    
    // Normaliser pour compatibilité
    const normalizedLeases = leases as Lease[];
    
    return { leases: normalizedLeases, total, pages };
  },

  async create(data: Record<string, unknown> & { organizationId: string }): Promise<Lease> {
    // Exclure l'ID si présent
    const { id, ...dataWithoutId } = data as any;
    const lease = await prisma.lease.create({ 
      data: dataWithoutId,
      include: {
        Property: {
          select: { id: true, name: true, address: true }
        },
        Tenant: {
          select: { id: true, firstName: true, lastName: true, email: true }
        }
      }
    });
    // Normaliser pour compatibilité
    return lease as Lease;
  },

  async update(id: string, organizationId: string, data: Record<string, unknown>): Promise<Lease> {
    const lease = await prisma.lease.update({ 
      where: { id, organizationId }, 
      data,
      include: {
        Property: {
          select: { id: true, name: true, address: true }
        },
        Tenant: {
          select: { id: true, firstName: true, lastName: true, email: true }
        }
      }
    });
    // Normaliser pour compatibilité
    return lease as Lease;
  },

  async delete(id: string, organizationId: string): Promise<Lease> {
    return prisma.lease.delete({ where: { id, organizationId } }) as Promise<Lease>;
  },
};
