import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/getCurrentUser';

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    
    const searchParams = request.nextUrl.searchParams;
    
    // Récupérer les paramètres de filtre
    const propertyId = searchParams.get('propertyId');

    // Construire les filtres Prisma
    const where: any = {
      organizationId, // Filtrer par organisation
    };

    // Filtre par propriété
    if (propertyId) {
      where.propertyId = propertyId;
    }

    // Récupérer tous les baux
    const allLeases = await prisma.lease.findMany({
      where,
      select: {
        id: true,
        status: true,
        endDate: true,
        indexationType: true,
        startDate: true,
        overridesJson: true,
      },
    });

    // Date actuelle
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Date dans 90 jours
    const in90Days = new Date();
    in90Days.setDate(in90Days.getDate() + 90);

    // Date dans 30 jours
    const in30Days = new Date();
    in30Days.setDate(in30Days.getDate() + 30);

    // Calculer les KPI
    const totalLeases = allLeases.length;
    
    // Baux actifs : statut = ACTIF
    const activeLeases = allLeases.filter(lease => lease.status === 'ACTIF').length;
    
    // Baux expirant < 90 jours (statut ACTIF ou SIGNE et date de fin <= aujourd'hui + 90j)
    const expiringSoon = allLeases.filter(lease => {
      if (!lease.endDate) return false;
      const endDate = new Date(lease.endDate);
      endDate.setHours(0, 0, 0, 0);
      
      return (lease.status === 'ACTIF' || lease.status === 'SIGNE') && endDate <= in90Days && endDate >= today;
    }).length;
    
    // Indexations à prévoir (J-30)
    // Calculer la prochaine date d'indexation pour chaque bail actif
    const indexationDue = allLeases.filter(lease => {
      if (lease.status !== 'ACTIF') return false;
      if (!lease.indexationType || lease.indexationType === 'AUCUNE') return false;
      
      // Calculer la prochaine date d'indexation
      const startDate = new Date(lease.startDate);
      const oneYearLater = new Date(startDate);
      oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
      
      // Si la date est dans les 30 prochains jours
      return oneYearLater <= in30Days && oneYearLater >= today;
    }).length;

    return NextResponse.json({
      totalLeases,
      activeLeases,
      expiringSoon,
      indexationDue,
    });
  } catch (error) {
    console.error('Erreur lors du calcul des KPI des baux:', error);
    return NextResponse.json(
      { error: 'Erreur lors du calcul des KPI des baux' },
      { status: 500 }
    );
  }
}

