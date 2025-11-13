import { PrismaClient } from '@prisma/client';
import { getLeaseRuntimeStatus, getDaysUntilExpiration, getDaysUntilIndexation, getNextAction } from '@/utils/leaseStatus';
import { prisma } from '@/lib/prisma';



export interface LeaseFilters {
  search?: string;
  status?: string[];
  type?: string[];
  propertyId?: string;
  tenantId?: string;
  upcomingExpiration?: boolean;
  missingDocuments?: boolean;
  indexationDue?: boolean;
  limit?: number;
  offset?: number;
}

export interface LeaseWithDetails {
  id: string;
  status: string;
  runtimeStatus: string;
  type: string;
  furnishedType: string;
  startDate: string;
  endDate?: string;
  rentAmount: number;
  charges?: number; // CalculÃ© pour rÃ©trocompatibilitÃ© (chargesRecupMensuelles + chargesNonRecupMensuelles)
  chargesRecupMensuelles?: number;
  chargesNonRecupMensuelles?: number;
  deposit: number;
  paymentDay?: number;
  indexationType: string;
  notes?: string;
  signedPdfUrl?: string;
  Property: {
    id: string;
    name: string;
    address: string;
    city: string;
    postalCode: string;
  };
  Tenant: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
  nextAction?: string;
  hasSignedLease: boolean;
  daysUntilExpiration?: number;
  daysUntilIndexation?: number;
  createdAt: string;
  updatedAt: string;
}

export interface LeaseKPIs {
  total: number;
  active: number;
  toSign: number; // ENVOYÃ‰
  expiringIn90Days: number;
  terminated: number;
  draft: number;
  signed: number;
  missingDocuments: number;
  indexationDue: number;
}

export class LeasesService {
  /**
   * RÃ©cupÃ©rer les KPIs des baux
   */
  static async getKPIs(): Promise<LeaseKPIs> {
    const now = new Date();
    const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    const [
      total,
      active,
      toSign,
      expiringIn90Days,
      terminated,
      draft,
      signed,
      missingDocuments,
      indexationDue
    ] = await Promise.all([
      // Total
      prisma.lease.count(),
      
      // Actifs (calculÃ© dynamiquement)
      prisma.lease.count({
        where: {
          OR: [
            { status: 'ACTIF' },
            {
              AND: [
                { status: 'SIGNÃ‰' },
                { startDate: { lte: now } },
                {
                  OR: [
                    { endDate: null },
                    { endDate: { gte: now } }
                  ]
                }
              ]
            }
          ]
        }
      }),
      
      // Ã€ signer (ENVOYÃ‰)
      prisma.lease.count({
        where: { status: 'ENVOYÃ‰' }
      }),
      
      // Expirant sous 90 jours
      prisma.lease.count({
        where: {
          endDate: {
            gte: now,
            lte: in90Days
          },
          status: { in: ['ACTIF', 'SIGNÃ‰'] }
        }
      }),
      
      // RÃ©siliÃ©s
      prisma.lease.count({
        where: { status: 'RÃ‰SILIÃ‰' }
      }),
      
      // Brouillons
      prisma.lease.count({
        where: { status: 'BROUILLON' }
      }),
      
      // SignÃ©s
      prisma.lease.count({
        where: { status: 'SIGNÃ‰' }
      }),
      
      // Sans bail signÃ© (vÃ©rifier aussi les documents liÃ©s)
      (async () => {
        const leasesWithoutSignedPdf = await prisma.lease.findMany({
          where: {
            signedPdfUrl: null,
            status: { in: ['ACTIF', 'SIGNÃ‰'] }
          },
          select: { id: true }
        });

        let count = 0;
        for (const lease of leasesWithoutSignedPdf) {
          const hasBailSigneDocument = await prisma.documentLink.count({
            where: {
              linkedType: 'lease',
              linkedId: lease.id,
              document: {
                DocumentType: {
                  code: 'BAIL_SIGNE'
                }
              }
            }
          }) > 0;
          
          if (!hasBailSigneDocument) {
            count++;
          }
        }
        
        return count;
      })(),
      
      // Indexation due (approximation basÃ©e sur l'anniversaire)
      prisma.lease.count({
        where: {
          indexationType: { not: 'none' },
          status: { in: ['ACTIF', 'SIGNÃ‰'] }
        }
      })
    ]);

    return {
      total,
      active,
      toSign,
      expiringIn90Days,
      terminated,
      draft,
      signed,
      missingDocuments,
      indexationDue
    };
  }

  /**
   * Rechercher les baux avec filtres
   */
  static async search(filters: LeaseFilters = {}): Promise<{
    items: LeaseWithDetails[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      search,
      status = [],
      type = [],
      propertyId,
      tenantId,
      upcomingExpiration = false,
      missingDocuments = false,
      indexationDue = false,
      limit = 50,
      offset = 0
    } = filters;

    // Construire la clause WHERE
    const where: any = {};

    // Recherche textuelle
    if (search) {
      where.OR = [
        {
          Property: {
            OR: [
              { name: { contains: search } },
              { address: { contains: search } },
              { city: { contains: search } }
            ]
          }
        },
        {
          Tenant: {
            OR: [
              { firstName: { contains: search } },
              { lastName: { contains: search } },
              { email: { contains: search } }
            ]
          }
        }
      ];
    }

    // Filtres par statut
    if (status.length > 0) {
      where.status = { in: status };
    }

    // Filtres par type
    if (type.length > 0) {
      where.type = { in: type };
    }

    // Filtre par bien
    if (propertyId) {
      where.propertyId = propertyId;
    }

    // Filtre par locataire
    if (tenantId) {
      where.OR = [
        { tenantId },
        { secondaryTenants: { some: { id: tenantId } } }
      ];
    }

    // Baux expirant bientÃ´t
    if (upcomingExpiration) {
      const in90Days = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
      where.endDate = {
        gte: new Date(),
        lte: in90Days
      };
      where.status = { in: ['ACTIF', 'SIGNÃ‰'] };
    }

    // Baux sans documents signÃ©s
    if (missingDocuments) {
      where.signedPdfUrl = null;
      where.status = { in: ['ACTIF', 'SIGNÃ‰'] };
    }

    // Indexation due
    if (indexationDue) {
      where.indexationType = { not: 'none' };
      where.status = { in: ['ACTIF', 'SIGNÃ‰'] };
    }

    // Compter le total
    const total = await prisma.lease.count({ where });

    // RÃ©cupÃ©rer les baux avec relations
    const leases = await prisma.lease.findMany({
      where,
      include: {
        Property: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            postalCode: true
          }
        },
        Tenant: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true
          }
        }
      },
      orderBy: [
        { status: 'asc' },
        { startDate: 'desc' }
      ],
      skip: offset,
      take: limit
    });

    // Enrichir avec les donnÃ©es calculÃ©es
    const enrichedLeases: LeaseWithDetails[] = await Promise.all(leases.map(async (lease) => {
      const runtimeStatus = getLeaseRuntimeStatus(lease);
      const nextAction = getNextAction(lease);
      const daysUntilExpiration = getDaysUntilExpiration(lease);
      const daysUntilIndexation = getDaysUntilIndexation(lease);

      // VÃ©rifier si le bail a un document BAIL_SIGNE liÃ©
      const hasBailSigneDocument = await prisma.documentLink.count({
        where: {
          linkedType: 'lease',
          linkedId: lease.id,
          Document: {
            DocumentType: {
              code: 'BAIL_SIGNE'
            }
          }
        }
      }) > 0;

      return {
        id: lease.id,
        status: lease.status,
        runtimeStatus,
        type: lease.type,
        furnishedType: lease.furnishedType,
        startDate: lease.startDate.toISOString(),
        endDate: lease.endDate?.toISOString(),
        rentAmount: lease.rentAmount,
        charges: (lease.chargesRecupMensuelles || 0) + (lease.chargesNonRecupMensuelles || 0), // Total pour rÃ©trocompatibilitÃ©
        chargesRecupMensuelles: lease.chargesRecupMensuelles,
        chargesNonRecupMensuelles: lease.chargesNonRecupMensuelles,
        deposit: lease.deposit,
        paymentDay: lease.paymentDay,
        indexationType: lease.indexationType,
        notes: lease.notes,
        signedPdfUrl: lease.signedPdfUrl,
        Property: lease.Property,
        Tenant: lease.Tenant,
        nextAction,
        hasSignedLease: !!lease.signedPdfUrl || hasBailSigneDocument,
        daysUntilExpiration,
        daysUntilIndexation,
        createdAt: lease.createdAt.toISOString(),
        updatedAt: lease.updatedAt.toISOString()
      };
    }));

    return {
      items: enrichedLeases,
      total,
      page: Math.floor(offset / limit) + 1,
      limit
    };
  }

  /**
   * RÃ©cupÃ©rer les baux en alerte (expirant, sans documents, indexation due)
   */
  static async getAlerts(): Promise<{
    expiringLeases: LeaseWithDetails[];
    missingDocumentsLeases: LeaseWithDetails[];
    indexationDueLeases: LeaseWithDetails[];
  }> {
    const [expiringResult, missingDocsResult, indexationResult] = await Promise.all([
      this.search({ upcomingExpiration: true, limit: 10 }),
      this.search({ missingDocuments: true, limit: 10 }),
      this.search({ indexationDue: true, limit: 10 })
    ]);

    return {
      expiringLeases: expiringResult.items,
      missingDocumentsLeases: missingDocsResult.items,
      indexationDueLeases: indexationResult.items
    };
  }
}
