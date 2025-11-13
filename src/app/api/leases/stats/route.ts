import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { getActiveLeaseWhere } from '../../../../lib/leases';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');

    const today = new Date();
    
    // Construire les conditions WHERE selon le contexte
    let whereActive: any = {};
    let whereAll: any = {};
    
    if (propertyId) {
      // Stats pour un bien spécifique
      whereActive = getActiveLeaseWhere({ propertyId, today });
      whereAll = { propertyId };
    } else {
      // Stats globales - tous les baux
      whereActive = getActiveLeaseWhere({ today });
      whereAll = {};
    }

    // Calculer les stats avec une seule source de vérité
    const [totalCount, activeCount, rentSum, expiringCount] = await prisma.$transaction([
      prisma.lease.count({ where: whereAll }),
      prisma.lease.count({ where: whereActive }),
      prisma.lease.aggregate({
        _sum: { rentAmount: true },
        where: whereActive,
      }),
      prisma.lease.count({
        where: {
          ...whereActive,
          endDate: {
            lte: new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000), // +60 jours
            gte: today,
          },
        },
      }),
    ]);

    const monthlyRentTotalCents = Math.round((rentSum._sum.rentAmount ?? 0) * 100);

    return NextResponse.json({
      totalLeases: totalCount,
      activeLeases: activeCount,
      expiringIn60Days: expiringCount,
      totalMonthlyRent: monthlyRentTotalCents / 100, // Convertir en euros
    });
  } catch (error) {
    console.error('Error fetching lease stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch lease stats', details: error.message },
      { status: 500 }
    );
  }
}

