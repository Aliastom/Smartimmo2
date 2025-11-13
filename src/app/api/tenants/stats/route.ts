import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');

    let where = {};
    
    if (propertyId) {
      // Filtrer les locataires qui ont des baux pour ce bien
      where = {
        Lease: {
          some: {
            propertyId,
          },
        },
      };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [allTenants, tenantsWithActiveLease] = await Promise.all([
      prisma.tenant.findMany({
        where,
        include: {
          Lease: {
            where: { 
              OR: [
                { status: 'ACTIF' },
                { status: 'SIGNÉ', startDate: { lte: today } }
              ]
            },
          },
        },
      }),
      prisma.tenant.count({
        where: {
          ...where,
          Lease: {
            some: {
              OR: [
                { status: 'ACTIF' },
                { status: 'SIGNÉ', startDate: { lte: today } }
              ]
            },
          },
        },
      }),
    ]);

    const totalTenants = allTenants.length;
    const withActiveLease = tenantsWithActiveLease;
    const withoutActiveLease = totalTenants - withActiveLease;

    // TODO: Calculer les paiements en retard
    const overdue = 0;

    return NextResponse.json({
      totalTenants,
      withActiveLease,
      withoutActiveLease,
      overdue,
    });
  } catch (error) {
    console.error('Error fetching tenant stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tenant stats', details: error.message },
      { status: 500 }
    );
  }
}

