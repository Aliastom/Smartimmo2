import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
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
      prisma.transaction.count(),
      
      // Recettes (Nature contient LOYER, CHARGES, DEPOT, FRAIS)
      prisma.transaction.count({
        where: {
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
          documents: {
            none: {}
          }
        }
      }),
      
      // Anomalies (catégorie manquante, montant nul)
      prisma.transaction.count({
        where: {
          OR: [
            { categoryId: null },
            { amount: 0 }
          ]
        }
      }),
      
      // Échéances (transactions à venir dans les 30 jours)
      prisma.transaction.count({
        where: {
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
