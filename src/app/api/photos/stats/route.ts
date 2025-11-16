import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { requireAuth } from '@/lib/auth/getCurrentUser';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    const month = searchParams.get('month');
    const year = searchParams.get('year');

    let where: any = {
      docType: 'photo',
      organizationId,
    };

    if (propertyId) {
      where.propertyId = propertyId;
    }

    // Filtrer par période pour "ajoutées récemment"
    let recentWhere: any = { ...where };
    if (month && year) {
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endDate = new Date(parseInt(year), parseInt(month), 0);
      recentWhere.createdAt = {
        gte: startDate,
        lte: endDate,
      };
    } else {
      // Par défaut : 30 derniers jours
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      recentWhere.createdAt = {
        gte: thirtyDaysAgo,
      };
    }

    const [totalPhotos, linkedToProperty, untagged, recentlyAdded] = await Promise.all([
      prisma.document.count({ where }),
      prisma.document.count({
        where: {
          ...where,
          propertyId: { not: null },
        },
      }),
      prisma.document.count({
        where: {
          ...where,
          propertyId: null,
        },
      }),
      prisma.document.count({ where: recentWhere }),
    ]);

    return NextResponse.json({
      totalPhotos,
      linkedToProperty,
      untagged,
      recentlyAdded,
    });
  } catch (error) {
    console.error('Error fetching photo stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch photo stats', details: error.message },
      { status: 500 }
    );
  }
}

