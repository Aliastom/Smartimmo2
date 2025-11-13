import { prisma } from '@/lib/prisma';

export interface TransactionFilters {
  search?: string;
  nature?: string;
  propertyId?: string;
  leaseId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
  sortBy?: 'date' | 'amount' | 'label' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface TransactionWithRelations {
  id: string;
  label: string;
  amount: number;
  date: Date;
  nature?: string;
  paidAt?: Date;
  method?: string;
  notes?: string;
  createdAt: Date;
  Property: {
    id: string;
    name: string;
    address: string;
  };
  Lease_Transaction_leaseIdToLease?: {
    id: string;
    Tenant: {
      firstName: string;
      lastName: string;
    };
  };
  Category?: {
    id: string;
    label: string;
    type: string;
  };
  Document: Array<{
    id: string;
    fileName: string;
    DocumentType: {
      label: string;
    };
  }>;
}

export class TransactionRepo {
  static async findMany(filters: TransactionFilters = {}) {
    const {
      search,
      nature,
      propertyId,
      leaseId,
      dateFrom,
      dateTo,
      page = 1,
      limit = 10,
      sortBy = 'date',
      sortOrder = 'desc'
    } = filters;

    const skip = (page - 1) * limit;

    const where: any = {};
    
    if (search) {
      where.OR = [
        { label: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    if (nature) where.nature = nature;
    if (propertyId) where.propertyId = propertyId;
    if (leaseId) where.leaseId = leaseId;
    
    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = dateFrom;
      if (dateTo) where.date.lte = dateTo;
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          Property: {
            select: {
              id: true,
              name: true,
              address: true
            }
          },
          Lease_Transaction_leaseIdToLease: {
            include: {
              Tenant: {
                select: {
                  firstName: true,
                  lastName: true
                }
              }
            }
          },
          Category: {
            select: {
              id: true,
              label: true,
              type: true
            }
          },
          Document: {
            include: {
              DocumentType: {
                select: {
                  label: true
                }
              }
            },
            take: 5
          }
        }
      }),
      prisma.transaction.count({ where })
    ]);

    return {
      data: transactions as TransactionWithRelations[],
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  static async findById(id: string) {
    return prisma.transaction.findUnique({
      where: { id },
      include: {
        Property: true,
        Lease_Transaction_leaseIdToLease: {
          include: {
            Tenant: true
          }
        },
        Category: true,
        Document: {
          include: {
            DocumentType: true
          }
        }
      }
    });
  }

  static async create(data: {
    propertyId: string;
    leaseId?: string;
    categoryId?: string;
    label: string;
    amount: number;
    date: Date;
    month?: number;
    year?: number;
    accountingMonth?: string;
    isRecurring?: boolean;
    nature?: string;
    paidAt?: Date;
    method?: string;
    notes?: string;
    source?: string;
    idempotencyKey?: string;
    monthsCovered?: string;
  }) {
    return prisma.transaction.create({
      data
    });
  }

  static async update(id: string, data: any) {
    return prisma.transaction.update({
      where: { id },
      data
    });
  }

  static async delete(id: string) {
    return prisma.transaction.delete({
      where: { id }
    });
  }

  static async getStats() {
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);
    
    const nextMonth = new Date(currentMonth);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    const [
      monthlyRevenue,
      monthlyExpenses,
      totalTransactions
    ] = await Promise.all([
      prisma.transaction.aggregate({
        where: {
          nature: 'LOYER',
          date: {
            gte: currentMonth,
            lt: nextMonth
          }
        },
        _sum: {
          amount: true
        }
      }),
      prisma.transaction.aggregate({
        where: {
          nature: 'CHARGES',
          date: {
            gte: currentMonth,
            lt: nextMonth
          }
        },
        _sum: {
          amount: true
        }
      }),
      prisma.transaction.count({
        where: {
          date: {
            gte: currentMonth,
            lt: nextMonth
          }
        }
      })
    ]);

    const revenue = monthlyRevenue._sum.amount || 0;
    const expenses = Math.abs(monthlyExpenses._sum.amount || 0);
    const cashFlow = revenue - expenses;

    return {
      monthlyRevenue: revenue,
      monthlyExpenses: expenses,
      cashFlow,
      totalTransactions
    };
  }
}
