import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');

    if (propertyId) {
      // Stats pour un bien spécifique
      const property = await prisma.property.findUnique({
        where: { id: propertyId },
      include: {
        Lease: {
          where: { status: 'ACTIF' },
        },
        Document: true,
      },
      });

      if (!property) {
        return NextResponse.json({ error: 'Property not found' }, { status: 404 });
      }

      const activeLeases = property.Lease.length;
      const totalMonthlyRent = property.Lease.reduce(
        (sum, lease) => sum + (lease.rentAmount || 0) + (lease.chargesRecupMensuelles || 0),
        0
      );

      // Échéances < 60 jours
      const sixtyDaysFromNow = new Date();
      sixtyDaysFromNow.setDate(sixtyDaysFromNow.getDate() + 60);
      const expiringIn60Days = property.Lease.filter(
        lease => lease.endDate && new Date(lease.endDate) <= sixtyDaysFromNow
      ).length;

      return NextResponse.json({
        totalProperties: 1,
        occupied: property.status === 'rented' ? 1 : 0,
        vacant: property.status === 'vacant' ? 1 : 0,
        totalMonthlyRent,
        activeLeases,
        expiringIn60Days,
        totalDocuments: property.Document.length,
      });
    }

    // Stats globales
    const properties = await prisma.property.findMany({
      include: {
        Lease: {
          where: { status: 'ACTIF' },
        },
      },
    });

    const totalProperties = properties.length;
    const occupied = properties.filter(p => p.status === 'rented').length;
    const vacant = properties.filter(p => p.status === 'vacant').length;
    const totalMonthlyRent = properties.reduce((sum, property) => {
      const propertyRent = property.Lease.reduce(
        (leaseSum, lease) => leaseSum + (lease.rentAmount || 0) + (lease.chargesRecupMensuelles || 0),
        0
      );
      return sum + propertyRent;
    }, 0);

    return NextResponse.json({
      totalProperties,
      occupied,
      vacant,
      totalMonthlyRent,
    });
  } catch (error) {
    console.error('Error fetching property stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch property stats', details: error.message },
      { status: 500 }
    );
  }
}

