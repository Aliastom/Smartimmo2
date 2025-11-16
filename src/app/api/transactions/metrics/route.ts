import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/getCurrentUser';

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    
    // Calcul des métriques
    const [
      total,
      recettes,
      depenses,
      nonRapprochees,
      anomalies,
      echeances
    ] = await Promise.all([
      // Total des transactions
      prisma.transaction.count({
        where: { organizationId },
      }),
      
      // Recettes (Nature contient LOYER, CHARGES, DEPOT, FRAIS)
      prisma.transaction.count({
        where: {
          organizationId, // Filtrer par organisation
          OR: [
            { nature: { contains: 'LOYER' } },
            { nature: { contains: 'CHARGES' } },
            { nature: { contains: 'DEPOT' } },
            { nature: { contains: 'FRAIS' } }
          ]
        }
      }),
      
      // Dépenses (Nature contient TRAVAUX, ENTRETIEN, ASSURANCE, TAXES)
      prisma.transaction.count({
        where: {
          organizationId, // Filtrer par organisation
          OR: [
            { nature: { contains: 'TRAVAUX' } },
            { nature: { contains: 'ENTRETIEN' } },
            { nature: { contains: 'ASSURANCE' } },
            { nature: { contains: 'TAXES' } }
          ]
        }
      }),
      
      // Non rapprochées (hasDocument = false)
      prisma.transaction.count({
        where: {
          organizationId, // Filtrer par organisation
          documents: {
            none: {}
          }
        }
      }),
      
      // Anomalies (catégorie manquante, montant nul)
      prisma.transaction.count({
        where: {
          organizationId, // Filtrer par organisation
          OR: [
            { categoryId: null },
            { amount: 0 }
          ]
        }
      }),
      
      // Échéances (transactions à venir dans les 30 jours)
      prisma.transaction.count({
        where: {
          organizationId, // Filtrer par organisation
          date: {
            gte: new Date(),
            lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 jours
          }
        }
      })
    ]);

    return NextResponse.json({
      total,
      recettes,
      depenses,
      nonRapprochees,
      anomalies,
      echeances
    });

  } catch (error) {
    console.error('Erreur lors du calcul des métriques:', error);
    return NextResponse.json(
      { error: 'Erreur lors du calcul des métriques' },
      { status: 500 }
    );
  }
}
