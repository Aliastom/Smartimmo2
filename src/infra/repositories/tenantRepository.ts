import { Tenant } from '../../domain/entities/Tenant';
import { prisma } from '../../lib/prisma';
import { computeTenantStatus, TenantStatusInfo } from '../../utils/tenantStatus';

export const tenantRepository = {
  async findAll(): Promise<(Tenant & TenantStatusInfo)[]> {
    const tenants = await prisma.tenant.findMany({
      orderBy: { lastName: 'asc' },
      include: {
        Lease: {
          select: {
            id: true,
            status: true,
            startDate: true,
            endDate: true,
          }
        }
      }
    });

    // Calculer le statut pour chaque locataire
    return tenants.map(tenant => {
      const statusInfo = computeTenantStatus(tenant.Lease);
      return {
        ...tenant,
        ...statusInfo,
        Lease: undefined // Ne pas exposer les baux complets
      };
    }) as any;
  },

  async findById(id: string): Promise<Tenant | null> {
    return prisma.tenant.findUnique({ 
      where: { id }
    }) as Promise<Tenant | null>;
  },

  async create(data: Record<string, unknown>): Promise<Tenant> {
    // Exclure l'ID si présent
    const { id, ...dataWithoutId } = data as any;
    return prisma.tenant.create({ 
      data: dataWithoutId
    }) as Promise<Tenant>;
  },

  async update(id: string, data: Record<string, unknown>): Promise<Tenant> {
    return prisma.tenant.update({ 
      where: { id }, 
      data
    }) as Promise<Tenant>;
  },

  async delete(id: string): Promise<Tenant> {
    return prisma.tenant.delete({ where: { id } }) as Promise<Tenant>;
  },

  async findByPropertyId(propertyId: string): Promise<Tenant[]> {
    // Renvoie les locataires qui ont (au moins) un bail lié au bien
    const tenants = await prisma.tenant.findMany({
      where: {
        Lease: { some: { propertyId } }
      },
      include: {
        Lease: {
          where: { propertyId },
          select: { id: true, status: true, startDate: true, endDate: true, propertyId: true }
        }
      }
    });

    return tenants as any;
  },
};

export default tenantRepository;
