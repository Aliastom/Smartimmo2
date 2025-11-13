import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { entityType, entityIds } = await request.json();

    if (!entityType || !Array.isArray(entityIds)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const results: Record<string, string> = {};

    switch (entityType) {
      case 'PROPERTY':
        const properties = await prisma.property.findMany({
          where: { id: { in: entityIds } },
          select: { id: true, name: true, address: true }
        });
        for (const property of properties) {
          results[property.id] = property.name || property.address || `Propriété ${property.id.slice(-8)}`;
        }
        break;

      case 'LEASE':
        const leases = await prisma.lease.findMany({
          where: { id: { in: entityIds } },
          select: { id: true, Property: { select: { name: true, address: true } } }
        });
        for (const lease of leases) {
          const propertyName = lease.Property.name || lease.Property.address;
          results[lease.id] = propertyName ? `Bail ${propertyName}` : `Bail ${lease.id.slice(-8)}`;
        }
        break;

      case 'TENANT':
        const tenants = await prisma.tenant.findMany({
          where: { id: { in: entityIds } },
          select: { id: true, firstName: true, lastName: true }
        });
        for (const tenant of tenants) {
          const fullName = `${tenant.firstName} ${tenant.lastName}`.trim();
          results[tenant.id] = fullName || `Locataire ${tenant.id.slice(-8)}`;
        }
        break;

      default:
        return NextResponse.json({ error: 'Invalid entity type' }, { status: 400 });
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Error fetching entity names:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
