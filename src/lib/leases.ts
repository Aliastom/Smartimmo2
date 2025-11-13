import { Prisma } from '@prisma/client';

export type ActiveLeaseWhere = {
  propertyId?: string;
  today?: Date;
};

export const getActiveLeaseWhere = ({ propertyId, today = new Date() }: ActiveLeaseWhere): Prisma.LeaseWhereInput => {
  const baseWhere: Prisma.LeaseWhereInput = {
    status: { in: ['SIGNÉ', 'ACTIF'] },
    startDate: { lte: today },
    OR: [{ endDate: null }, { endDate: { gte: today } }],
  };

  // Ajouter propertyId seulement si fourni
  if (propertyId) {
    baseWhere.propertyId = propertyId;
  }

  return baseWhere;
};

export const isLeaseActive = (lease: any, today: Date = new Date()): boolean => {
  if (!['SIGNÉ', 'ACTIF'].includes(lease.status)) return false;
  if (new Date(lease.startDate) > today) return false;
  if (lease.endDate && new Date(lease.endDate) < today) return false;
  return true;
};
