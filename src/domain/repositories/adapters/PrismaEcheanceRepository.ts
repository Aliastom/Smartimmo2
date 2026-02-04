/**
 * Adapter Prisma pour IEcheanceRepository
 * Utilise Prisma pour l'accès aux données (mode normal)
 */

import { prisma } from '@/lib/prisma';
import type {
  IEcheanceRepository,
  Echeance,
  CreateEcheanceData,
  UpdateEcheanceData,
} from '../interfaces/IEcheanceRepository';
// ⚠️ Ne pas importer Decimal depuis @prisma/client/runtime/library (utilise node: modules)
// Prisma convertira automatiquement les nombres en Decimal lors de la création/mise à jour

export class PrismaEcheanceRepository implements IEcheanceRepository {
  async findFirst(params: { id: string; organizationId: string }): Promise<Echeance | null> {
    const echeance = await prisma.echeanceRecurrente.findFirst({
      where: { id: params.id, organizationId: params.organizationId },
    });
    if (!echeance) return null;
    return this.mapToEcheance(echeance);
  }

  async create(data: CreateEcheanceData): Promise<Echeance> {
    // Prisma convertira automatiquement le nombre en Decimal
    const echeance = await prisma.echeanceRecurrente.create({
      data: {
        organizationId: data.organizationId,
        propertyId: data.propertyId,
        leaseId: data.leaseId,
        label: data.label,
        type: data.type as any,
        periodicite: data.periodicite as any,
        montant: data.montant, // Prisma convertira automatiquement en Decimal
        recuperable: data.recuperable,
        sens: data.sens as any,
        startAt: typeof data.startAt === 'string' ? new Date(data.startAt) : data.startAt,
        endAt: data.endAt ? (typeof data.endAt === 'string' ? new Date(data.endAt) : data.endAt) : null,
        isActive: data.isActive,
      },
    });
    return this.mapToEcheance(echeance);
  }

  async update(id: string, data: UpdateEcheanceData, organizationId: string): Promise<Echeance> {
    const updateData: any = {};
    if (data.label !== undefined) updateData.label = data.label;
    if (data.type !== undefined) updateData.type = data.type as any;
    if (data.periodicite !== undefined) updateData.periodicite = data.periodicite as any;
    if (data.montant !== undefined) updateData.montant = data.montant; // Prisma convertira automatiquement en Decimal
    if (data.recuperable !== undefined) updateData.recuperable = data.recuperable;
    if (data.sens !== undefined) updateData.sens = data.sens as any;
    if (data.startAt !== undefined) updateData.startAt = typeof data.startAt === 'string' ? new Date(data.startAt) : data.startAt;
    if (data.endAt !== undefined) updateData.endAt = data.endAt ? (typeof data.endAt === 'string' ? new Date(data.endAt) : data.endAt) : null;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.propertyId !== undefined) updateData.propertyId = data.propertyId;
    if (data.leaseId !== undefined) updateData.leaseId = data.leaseId;

    const echeance = await prisma.echeanceRecurrente.update({
      where: { id, organizationId },
      data: updateData,
    });
    return this.mapToEcheance(echeance);
  }

  async delete(id: string, organizationId: string, mode: 'soft' | 'hard' = 'soft'): Promise<void> {
    if (mode === 'hard') {
      await prisma.echeanceRecurrente.delete({
        where: { id, organizationId },
      });
    } else {
      const now = new Date();
      const existing = await prisma.echeanceRecurrente.findFirst({
        where: { id, organizationId },
      });
      if (!existing) {
        throw new Error(`Échéance ${id} introuvable`);
      }
      await prisma.echeanceRecurrente.update({
        where: { id, organizationId },
        data: {
          isActive: false,
          endAt: existing.endAt || now,
        },
      });
    }
  }

  async getAll(organizationId: string, filters?: { propertyId?: string; leaseId?: string; type?: string; isActive?: boolean }): Promise<Echeance[]> {
    const where: any = { organizationId };
    if (filters?.propertyId) where.propertyId = filters.propertyId;
    if (filters?.leaseId) where.leaseId = filters.leaseId;
    if (filters?.type) where.type = filters.type;
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;

    const echeances = await prisma.echeanceRecurrente.findMany({
      where,
    });
    return echeances.map(e => this.mapToEcheance(e));
  }

  private mapToEcheance(prismaEcheance: any): Echeance {
    return {
      id: prismaEcheance.id,
      organizationId: prismaEcheance.organizationId,
      propertyId: prismaEcheance.propertyId,
      leaseId: prismaEcheance.leaseId,
      label: prismaEcheance.label,
      type: prismaEcheance.type,
      periodicite: prismaEcheance.periodicite,
      montant: typeof prismaEcheance.montant === 'object' && 'toNumber' in prismaEcheance.montant
        ? (prismaEcheance.montant as any).toNumber()
        : parseFloat(prismaEcheance.montant.toString()),
      recuperable: prismaEcheance.recuperable,
      sens: prismaEcheance.sens,
      startAt: prismaEcheance.startAt,
      endAt: prismaEcheance.endAt,
      isActive: prismaEcheance.isActive,
      createdAt: prismaEcheance.createdAt,
      updatedAt: prismaEcheance.updatedAt,
    };
  }
}

