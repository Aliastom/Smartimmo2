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
      status: 'ACTIF', // On ne compte que les baux actifs
      organizationId, // Filtrer par organisation
    };

    // Filtre par propriété
    if (propertyId) {
      where.propertyId = propertyId;
    }

    // Récupérer tous les baux actifs
    const activeLeases = await prisma.lease.findMany({
      where,
      select: {
        id: true,
        rentAmount: true,
        deposit: true,
        furnishedType: true,
        startDate: true,
        endDate: true,
        chargesRecupMensuelles: true,
      },
    });

    // 1. Évolution des loyers (mensuel et annuel)
    // Pour la vue mensuelle, on génère les 12 derniers mois
    const monthlyData = [];
    const now = new Date();
    
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      // Calculer le total des loyers des baux actifs à cette date
      const totalRent = activeLeases
        .filter(lease => {
          const start = new Date(lease.startDate);
          const end = lease.endDate ? new Date(lease.endDate) : null;
          return start <= date && (!end || end >= date);
        })
        .reduce((sum, lease) => sum + (lease.rentAmount || 0), 0);
      
      monthlyData.push({ month, totalRent });
    }

    // Pour la vue annuelle, on génère les 3 dernières années
    const yearlyData = [];
    const currentYear = now.getFullYear();
    
    for (let i = 2; i >= 0; i--) {
      const year = currentYear - i;
      
      // Calculer le total annuel (somme des 12 mois)
      const totalRent = activeLeases
        .filter(lease => {
          const startYear = new Date(lease.startDate).getFullYear();
          const endYear = lease.endDate ? new Date(lease.endDate).getFullYear() : 9999;
          return startYear <= year && endYear >= year;
        })
        .reduce((sum, lease) => sum + (lease.rentAmount || 0) * 12, 0);
      
      yearlyData.push({ year, totalRent });
    }

    // 2. Répartition par type de meublé
    const furnishedMap = new Map<string, number>();
    
    for (const lease of activeLeases) {
      const type = lease.furnishedType || 'VIDE';
      
      // Mapping des valeurs
      let label = '';
      switch (type) {
        case 'VIDE':
          label = 'Vide';
          break;
        case 'MEUBLE':
          label = 'Meublé';
          break;
        case 'COLOCATION_MEUBLEE':
          label = 'Colocation meublée';
          break;
        case 'COLOCATION_VIDE':
          label = 'Colocation vide';
          break;
        default:
          label = type;
      }
      
      furnishedMap.set(label, (furnishedMap.get(label) || 0) + 1);
    }

    const byFurnished = Array.from(furnishedMap.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);

    // 3. Cautions & Loyers cumulés
    const totalDeposits = activeLeases.reduce((sum, lease) => sum + (lease.deposit || 0), 0);
    const monthlyTotal = activeLeases.reduce((sum, lease) => sum + (lease.rentAmount || 0), 0);
    const yearlyTotal = monthlyTotal * 12;

    return NextResponse.json({
      rentEvolution: {
        monthly: monthlyData,
        yearly: yearlyData,
      },
      byFurnished,
      depositsRents: {
        totalDeposits,
        monthlyTotal,
        yearlyTotal,
      },
    });
  } catch (error) {
    console.error('Erreur lors du calcul des graphiques des baux:', error);
    return NextResponse.json(
      { error: 'Erreur lors du calcul des graphiques des baux' },
      { status: 500 }
    );
  }
}

