import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { addYears } from 'date-fns';
import { requireAuth } from '@/lib/auth/getCurrentUser';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth();
    const propertyId = params.id;
    const today = new Date();
    const dateFrom = addYears(today, -1);

    // Récupérer la propriété pour les valeurs de base
    const property = await prisma.property.findFirst({
      where: { id: propertyId, organizationId: user.organizationId },
      select: {
        id: true,
        name: true,
        address: true,
        acquisitionPrice: true,
        currentValue: true,
        notaryFees: true,
      },
    });

    if (!property) {
      return NextResponse.json({ error: 'Propriété non trouvée' }, { status: 404 });
    }

    // Calculer les revenus locatifs (12 mois rolling)
    const sumRevenue = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        propertyId,
        organizationId: user.organizationId,
        date: { gte: dateFrom, lte: today },
        accountingCategory: { type: 'REVENU' },
      },
    });

    // Calculer les dépenses (12 mois rolling)
    const sumExpense = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        propertyId,
        organizationId: user.organizationId,
        date: { gte: dateFrom, lte: today },
        accountingCategory: { type: 'DEPENSE' },
      },
    });

    // Calculer les mensualités de prêts (12 mois rolling)
    const sumLoans = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        propertyId,
        organizationId: user.organizationId,
        date: { gte: dateFrom, lte: today },
        nature: 'REMBOURSEMENT_EMPRUNT',
      },
    });

    // Valeur de base pour le calcul du rendement
    const baseValue = property.currentValue || property.acquisitionPrice || 0;

    // Calculs
    const annualRentsCents = Math.round((sumRevenue._sum.amount || 0) * 100);
    const annualExpensesCents = Math.round((sumExpense._sum.amount || 0) * 100);
    const annualLoansCents = Math.round((sumLoans._sum.amount || 0) * 100);
    const annualCashflowCents = annualRentsCents - annualExpensesCents - annualLoansCents;
    const grossYieldPct = baseValue > 0 ? (annualRentsCents / (baseValue * 100)) * 100 : 0;

    return NextResponse.json({
      Property: {
        id: property.id,
        name: property.name,
        address: property.address,
        acquisitionPrice: property.acquisitionPrice,
        currentValue: property.currentValue,
        notaryFees: property.notaryFees,
      },
      summary: {
        annualRentsCents,
        annualCashflowCents,
        grossYieldPct: Math.round(grossYieldPct * 100) / 100, // 2 décimales
        annualExpensesCents,
        annualLoansCents,
        baseValue,
      },
    });
  } catch (error) {
    console.error('Error fetching property summary:', error);
    return NextResponse.json(
      { error: 'Erreur lors du chargement du résumé' },
      { status: 500 }
    );
  }
}
