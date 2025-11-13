import { prisma } from '@/lib/prisma';

export interface DocumentFilters {
  search?: string;
  documentTypeId?: string;
  propertyId?: string;
  leaseId?: string;
  tenantId?: string;
  page?: number;
  limit?: number;
  sortBy?: 'fileName' | 'createdAt' | 'size';
  sortOrder?: 'asc' | 'desc';
}

export interface DocumentWithRelations {
  id: string;
  fileName: string;
  mime: string;
  size: number;
  url: string;
  tagsJson?: string;
  metadata?: string;
  createdAt: Date;
  DocumentType: {
    id: string;
    code: string;
    label: string;
    icon?: string;
    isSensitive: boolean;
  };
  property?: {
    id: string;
    name: string;
    address: string;
  };
  lease?: {
    id: string;
    Property: {
      name: string;
    };
    Tenant: {
      firstName: string;
      lastName: string;
    };
  };
  tenant?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  transaction?: {
    id: string;
    label: string;
    amount: number;
    date: Date;
  };
}

export class DocumentRepo {
  static async findMany(filters: DocumentFilters = {}) {
    const {
      search,
      documentTypeId,
      propertyId,
      leaseId,
      tenantId,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = filters;

    const skip = (page - 1) * limit;

    const where: any = {};
    
    if (search) {
      where.OR = [
        { fileName: { contains: search, mode: 'insensitive' } },
        { DocumentType: { label: { contains: search, mode: 'insensitive' } } }
      ];
    }
    
    if (documentTypeId) where.documentTypeId = documentTypeId;
    if (propertyId) where.propertyId = propertyId;
    if (leaseId) where.leaseId = leaseId;
    if (tenantId) where.tenantId = tenantId;

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          DocumentType: {
            select: {
              id: true,
              code: true,
              label: true,
              icon: true,
              isSensitive: true
            }
          },
          Property: {
            select: {
              id: true,
              name: true,
              address: true
            }
          },
          Lease: {
            include: {
              Property: {
                select: {
                  name: true
                }
              },
              Tenant: {
                select: {
                  firstName: true,
                  lastName: true
                }
              }
            }
          },
          Tenant: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          },
          Transaction: {
            select: {
              id: true,
              label: true,
              amount: true,
              date: true
            }
          }
        }
      }),
      prisma.document.count({ where })
    ]);

    return {
      data: documents as DocumentWithRelations[],
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  static async findById(id: string) {
    return prisma.document.findUnique({
      where: { id },
      include: {
        DocumentType: true,
        Property: true,
        Lease: {
          include: {
            Property: true,
            Tenant: true
          }
        },
        Tenant: true,
        Transaction: true
      }
    });
  }

  static async create(data: {
    fileName: string;
    mime: string;
    size: number;
    url: string;
    fileSha256?: string;
    tagsJson?: string;
    metadata?: string;
    documentTypeId: string;
    propertyId?: string;
    leaseId?: string;
    loanId?: string;
    tenantId?: string;
    transactionId?: string;
  }) {
    return prisma.document.create({
      data
    });
  }

  static async update(id: string, data: any) {
    return prisma.document.update({
      where: { id },
      data
    });
  }

  static async delete(id: string) {
    return prisma.document.delete({
      where: { id }
    });
  }

  static async getStats() {
    const [
      total,
      activeLeases,
      receiptsThisMonth,
      storageUsed
    ] = await Promise.all([
      prisma.document.count(),
      prisma.lease.count({
        where: {
          status: 'ACTIF'
        }
      }),
      prisma.document.count({
        where: {
          DocumentType: {
            code: 'RENT_RECEIPT'
          },
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      }),
      prisma.document.aggregate({
        _sum: {
          size: true
        }
      })
    ]);

    // Convertir les bytes en GB
    const storageGB = ((storageUsed._sum.size || 0) / (1024 * 1024 * 1024)).toFixed(1);

    return {
      total,
      activeLeases,
      receiptsThisMonth,
      storageUsed: `${storageGB} GB`
    };
  }

  static async suggestType(data: {
    fileName: string;
    mime?: string;
    ocrText?: string;
    context?: string;
  }) {
    // Logique de suggestion basÃ©e sur les rÃ¨gles configurÃ©es
    // Pour l'instant, implÃ©mentation simple basÃ©e sur l'extension
    const extension = data.fileName.split('.').pop()?.toLowerCase();
    
    if (data.fileName.toLowerCase().includes('bail')) {
      return { typeCode: 'LEASE', confidence: 0.9 };
    }
    
    if (data.fileName.toLowerCase().includes('quittance') || data.fileName.toLowerCase().includes('receipt')) {
      return { typeCode: 'RENT_RECEIPT', confidence: 0.9 };
    }
    
    if (extension === 'pdf' && data.fileName.toLowerCase().includes('assurance')) {
      return { typeCode: 'INSURANCE', confidence: 0.8 };
    }
    
    return { typeCode: 'OTHER', confidence: 0.5 };
  }
}
