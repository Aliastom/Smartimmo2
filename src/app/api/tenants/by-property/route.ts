import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { getLeaseRuntimeStatus } from '../../../../domain/leases/status';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    const activeOnly = searchParams.get('activeOnly') === 'true';

    if (!propertyId) {
      return NextResponse.json(
        { error: 'Paramètre propertyId manquant' },
        { status: 400 }
      );
    }

    // Récupérer tous les locataires ayant au moins un bail sur cette propriété
    const allTenants = await prisma.tenant.findMany({
      where: {
        Lease: {
          some: { propertyId }
        }
      },
      include: {
        Lease: {
          where: { propertyId },
          orderBy: { startDate: 'desc' },
          include: {
            Property: {
              select: {
                id: true,
                name: true,
                address: true,
              }
            }
          }
        }
      },
      orderBy: { lastName: 'asc' }
    });

    // Si activeOnly, filtrer côté app pour n'avoir que les locataires avec baux ACTIFS
    let tenants = allTenants;
    if (activeOnly) {
      tenants = allTenants.filter(tenant => 
        tenant.Lease.some(lease => getLeaseRuntimeStatus(lease) === 'active')
      );
    }

    return NextResponse.json({ tenants });
  } catch (error) {
    console.error('[GET /api/tenants/by-property] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur lors de la récupération des locataires' },
      { status: 500 }
    );
  }
}

