/**
 * Adapter Prisma pour IPropertyRepository
 */

import { prisma } from '@/lib/prisma';
import type {
  IPropertyRepository,
  Property,
  PropertyWithCompany,
  ManagementCompany,
  CreatePropertyData,
  UpdatePropertyData,
  PropertyStats,
} from '../interfaces/IPropertyRepository';

export class PrismaPropertyRepository implements IPropertyRepository {
  async create(data: CreatePropertyData): Promise<Property> {
    const result = await prisma.property.create({
      data: {
        organizationId: data.organizationId,
        name: data.name,
        type: data.type,
        address: data.address,
        postalCode: data.postalCode,
        city: data.city,
        surface: data.surface,
        rooms: data.rooms,
        acquisitionDate: data.acquisitionDate,
        acquisitionPrice: data.acquisitionPrice,
        notaryFees: data.notaryFees,
        currentValue: data.currentValue,
        status: data.status,
        occupation: data.occupation,
        notes: data.notes,
        managementCompanyId: data.managementCompanyId,
        fiscalTypeId: data.fiscalTypeId,
        fiscalRegimeId: data.fiscalRegimeId,
        rentalMode: data.rentalMode,
        airbnbListingId: data.airbnbListingId,
        lmnpActivityId: data.lmnpActivityId,
      },
    });

    return this.mapPrismaToProperty(result);
  }

  async update(id: string, data: UpdatePropertyData): Promise<Property> {
    const result = await prisma.property.update({
      where: { id },
      data: {
        name: data.name,
        type: data.type,
        address: data.address,
        postalCode: data.postalCode,
        city: data.city,
        surface: data.surface,
        rooms: data.rooms,
        acquisitionDate: data.acquisitionDate,
        acquisitionPrice: data.acquisitionPrice,
        notaryFees: data.notaryFees,
        currentValue: data.currentValue,
        status: data.status,
        occupation: data.occupation,
        notes: data.notes,
        managementCompanyId: data.managementCompanyId,
        fiscalTypeId: data.fiscalTypeId,
        fiscalRegimeId: data.fiscalRegimeId,
        rentalMode: data.rentalMode,
        airbnbListingId: data.airbnbListingId,
        lmnpActivityId: data.lmnpActivityId,
        isArchived: data.isArchived,
        archivedAt: data.archivedAt,
      },
    });

    return this.mapPrismaToProperty(result);
  }

  async delete(id: string, mode?: 'archive' | 'cascade'): Promise<void> {
    // ✅ Gérer le mode 'archive' (soft delete) vs 'cascade' (hard delete)
    if (mode === 'archive') {
      // Soft delete: archiver via update
      await prisma.property.update({
        where: { id },
        data: {
          isArchived: true,
          archivedAt: new Date(),
        },
      });
    } else {
      // Hard delete: supprimer définitivement avec nettoyage des dépendances
      await prisma.$transaction(async (tx) => {
        const [leases, transactions, loans] = await Promise.all([
          tx.lease.findMany({ where: { propertyId: id }, select: { id: true } }),
          tx.transaction.findMany({ where: { propertyId: id }, select: { id: true } }),
          tx.loan.findMany({ where: { propertyId: id }, select: { id: true } }),
        ]);
        
        const leaseIds = leases.map(l => l.id);
        const transactionIds = transactions.map(t => t.id);
        const loanIds = loans.map(l => l.id);

        if (leaseIds.length > 0 || transactionIds.length > 0 || loanIds.length > 0) {
          await tx.documentLink.deleteMany({
            where: {
              OR: [
                leaseIds.length > 0 ? { linkedType: 'lease', linkedId: { in: leaseIds } } : undefined,
                transactionIds.length > 0 ? { linkedType: 'transaction', linkedId: { in: transactionIds } } : undefined,
                loanIds.length > 0 ? { linkedType: 'loan', linkedId: { in: loanIds } } : undefined,
              ].filter(Boolean) as any,
            },
          });
        }

        await tx.documentLink.deleteMany({
          where: { linkedType: 'property', linkedId: id },
        });

        await tx.document.deleteMany({
          where: {
            OR: [
              { propertyId: id },
              leaseIds.length > 0 ? { leaseId: { in: leaseIds } } : undefined,
              transactionIds.length > 0 ? { transactionId: { in: transactionIds } } : undefined,
              loanIds.length > 0 ? { loanId: { in: loanIds } } : undefined,
            ].filter(Boolean) as any,
          },
        });

        await tx.echeanceRecurrente.deleteMany({ where: { propertyId: id } });
        await tx.payment.deleteMany({ where: { propertyId: id } });
        await tx.occupancyHistory.deleteMany({ where: { propertyId: id } });
        await tx.photo.deleteMany({ where: { propertyId: id } });

        if (loanIds.length > 0) {
          await tx.loanBorrower.deleteMany({ where: { loanId: { in: loanIds } } });
        }

        await tx.loan.deleteMany({ where: { propertyId: id } });
        await tx.transaction.deleteMany({ where: { propertyId: id } });
        await tx.lease.deleteMany({ where: { propertyId: id } });

        await tx.property.delete({ where: { id } });
      });
    }
  }

  async findById(id: string, organizationId: string): Promise<Property | null> {
    return this.findFirst({ id, organizationId });
  }

  async findFirst(where: { id: string; organizationId: string }): Promise<Property | null> {
    const result = await prisma.property.findFirst({
      where: {
        id: where.id,
        organizationId: where.organizationId,
      },
    });

    if (!result) return null;

    return this.mapPrismaToProperty(result);
  }

  async findFirstWithManagementCompany(where: { id: string; organizationId: string }): Promise<PropertyWithCompany | null> {
    const result = await prisma.property.findFirst({
      where: {
        id: where.id,
        organizationId: where.organizationId,
      },
      include: {
        ManagementCompany: true,
      },
    });

    if (!result) return null;

    let managementCompany: ManagementCompany | null = null;
    if (result.ManagementCompany) {
      managementCompany = {
        id: result.ManagementCompany.id,
        organizationId: result.ManagementCompany.organizationId,
        nom: result.ManagementCompany.nom,
        modeCalcul: result.ManagementCompany.modeCalcul,
        taux: result.ManagementCompany.taux,
        fraisMin: result.ManagementCompany.fraisMin,
        tvaApplicable: result.ManagementCompany.tvaApplicable,
        tauxTva: result.ManagementCompany.tauxTva,
        actif: result.ManagementCompany.actif,
      };
    }

    return {
      ...this.mapPrismaToProperty(result),
      ManagementCompany: managementCompany,
    };
  }

  async getStats(propertyId: string, organizationId: string): Promise<PropertyStats> {
    const [leases, transactions, documents, echeances, loans] = await Promise.all([
      prisma.lease.count({ where: { propertyId, organizationId } }),
      prisma.transaction.count({ where: { propertyId, organizationId } }),
      prisma.document.count({ where: { propertyId, organizationId } }),
      prisma.echeanceRecurrente.count({ where: { propertyId, organizationId } }),
      prisma.loan.count({ where: { propertyId, organizationId } }),
    ]);

    return { leases, transactions, documents, echeances, loans };
  }

  async reassignLeases(sourcePropertyId: string, targetPropertyId: string, organizationId: string): Promise<void> {
    await prisma.lease.updateMany({
      where: { propertyId: sourcePropertyId, organizationId },
      data: { propertyId: targetPropertyId },
    });
  }

  async reassignTransactions(sourcePropertyId: string, targetPropertyId: string, organizationId: string): Promise<void> {
    await prisma.transaction.updateMany({
      where: { propertyId: sourcePropertyId, organizationId },
      data: { propertyId: targetPropertyId },
    });
  }

  async reassignDocuments(sourcePropertyId: string, targetPropertyId: string, organizationId: string): Promise<void> {
    await prisma.document.updateMany({
      where: { propertyId: sourcePropertyId, organizationId },
      data: { propertyId: targetPropertyId },
    });
  }

  async reassignEcheances(sourcePropertyId: string, targetPropertyId: string, organizationId: string): Promise<void> {
    await prisma.echeanceRecurrente.updateMany({
      where: { propertyId: sourcePropertyId, organizationId },
      data: { propertyId: targetPropertyId },
    });
  }

  async reassignLoans(sourcePropertyId: string, targetPropertyId: string, organizationId: string): Promise<void> {
    await prisma.loan.updateMany({
      where: { propertyId: sourcePropertyId, organizationId },
      data: { propertyId: targetPropertyId },
    });
  }

  async reassignPayments(sourcePropertyId: string, targetPropertyId: string, organizationId: string): Promise<void> {
    await prisma.payment.updateMany({
      where: { propertyId: sourcePropertyId, organizationId },
      data: { propertyId: targetPropertyId },
    });
  }

  async reassignPhotos(sourcePropertyId: string, targetPropertyId: string, organizationId: string): Promise<void> {
    await prisma.photo.updateMany({
      where: { propertyId: sourcePropertyId, organizationId },
      data: { propertyId: targetPropertyId },
    });
  }

  async reassignOccupancyHistory(sourcePropertyId: string, targetPropertyId: string, organizationId: string): Promise<void> {
    await prisma.occupancyHistory.updateMany({
      where: { propertyId: sourcePropertyId },
      data: { propertyId: targetPropertyId },
    });
  }

  private mapPrismaToProperty(result: any): Property {
    return {
      id: result.id,
      organizationId: result.organizationId,
      name: result.name,
      type: result.type,
      address: result.address,
      postalCode: result.postalCode,
      city: result.city,
      surface: result.surface,
      rooms: result.rooms,
      acquisitionDate: result.acquisitionDate,
      acquisitionPrice: result.acquisitionPrice,
      notaryFees: result.notaryFees,
      currentValue: result.currentValue,
      status: result.status,
      occupation: result.occupation,
      notes: result.notes,
      managementCompanyId: result.managementCompanyId,
      fiscalTypeId: result.fiscalTypeId,
      fiscalRegimeId: result.fiscalRegimeId,
      rentalMode: result.rentalMode,
      airbnbListingId: result.airbnbListingId,
      lmnpActivityId: result.lmnpActivityId ?? null,
      isArchived: result.isArchived ?? false,
      archivedAt: result.archivedAt,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  }
}
