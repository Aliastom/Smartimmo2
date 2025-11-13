import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

/**
 * GET /api/occupancy-history?propertyId=X
 * Retourne l'historique des occupations pour une propriété
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');

    if (!propertyId) {
      return NextResponse.json(
        { error: 'Paramètre propertyId manquant' },
        { status: 400 }
      );
    }

    const history = await prisma.occupancyHistory.findMany({
      where: { propertyId },
      include: {
        Tenant: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          }
        }
      },
      orderBy: [
        { startDate: 'desc' },
        { endDate: 'desc' }
      ]
    });

    // Grouper par locataire
    const grouped = history.reduce((acc: any, item: any) => {
      const tenantId = item.tenantId;
      if (!acc[tenantId]) {
        acc[tenantId] = {
          Tenant: item.Tenant,
          periods: []
        };
      }
      acc[tenantId].periods.push({
        id: item.id,
        startDate: item.startDate,
        endDate: item.endDate,
        monthlyRent: item.monthlyRent,
        leaseId: item.leaseId,
      });
      return acc;
    }, {});

    return NextResponse.json({ history: Object.values(grouped) });
  } catch (error) {
    console.error('[GET /api/occupancy-history] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur lors de la récupération de l\'historique' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/occupancy-history
 * Crée ou met à jour un enregistrement d'historique
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const { propertyId, tenantId, leaseId, startDate, endDate, monthlyRent } = body;
    
    if (!propertyId || !tenantId || !startDate) {
      return NextResponse.json(
        { error: 'Paramètres manquants (propertyId, tenantId, startDate requis)' },
        { status: 400 }
      );
    }

    // Vérifier s'il existe déjà un enregistrement pour ce bail
    if (leaseId) {
      const existing = await prisma.occupancyHistory.findFirst({
        where: { leaseId }
      });

      if (existing) {
        // Mettre à jour
        const updated = await prisma.occupancyHistory.update({
          where: { id: existing.id },
          data: {
            endDate: endDate ? new Date(endDate) : null,
            monthlyRent: monthlyRent || 0,
          }
        });
        return NextResponse.json(updated);
      }
    }

    // Créer un nouvel enregistrement
    const history = await prisma.occupancyHistory.create({
      data: {
        propertyId,
        tenantId,
        leaseId: leaseId || null,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        monthlyRent: monthlyRent || 0,
      }
    });

    return NextResponse.json(history, { status: 201 });
  } catch (error) {
    console.error('[POST /api/occupancy-history] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur lors de la création de l\'historique' },
      { status: 500 }
    );
  }
}

