import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import PatrimoinePdf from '@/pdf/PatrimoinePdf';
import { buildSchedule } from '@/lib/finance/amortization';

/**
 * POST /api/dashboard/patrimoine/export/pdf
 * Export du dashboard patrimoine en PDF avec mise en page professionnelle
 */

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { from, to, mode } = body;

    if (!from || !to) {
      return NextResponse.json(
        { error: 'Les paramètres from et to sont requis' },
        { status: 400 }
      );
    }

    // Récupérer les données
    const [fromYear, fromMonth] = from.split('-').map(Number);
    const [toYear, toMonth] = to.split('-').map(Number);
    const fromDate = new Date(fromYear, fromMonth - 1, 1);
    const toDate = new Date(toYear, toMonth, 0, 23, 59, 59);

    // Récupérer les propriétés
    const properties = await prisma.property.findMany({
      select: {
        id: true,
        name: true,
        currentValue: true,
        acquisitionPrice: true,
      },
    });

    const valeurParc = properties.reduce((sum, p) => {
      return sum + Number(p.currentValue || p.acquisitionPrice || 0);
    }, 0);

    // Récupérer les prêts actifs
    const loans = await prisma.loan.findMany({
      where: { isActive: true },
      select: {
        id: true,
        principal: true,
        annualRatePct: true,
        durationMonths: true,
        defermentMonths: true,
        insurancePct: true,
        startDate: true,
      },
    });

    let encoursDette = 0;
    for (const loan of loans) {
      encoursDette += Number(loan.principal);
    }

    // Récupérer les transactions
    const transactionsData = await prisma.transaction.findMany({
      where: {
        paidAt: { not: null },
        accounting_month: { 
          gte: from, 
          lte: to 
        },
      },
      select: {
        date: true,
        accounting_month: true,
        nature: true,
        amount: true,
        label: true,
        Property: {
          select: { name: true },
        },
      },
      orderBy: {
        accounting_month: 'asc',
      },
    });

    // Calculer les KPIs
    const totalLoyers = transactionsData
      .filter((tx) => Number(tx.amount) > 0)
      .reduce((sum, tx) => sum + Number(tx.amount), 0);
    
    const totalCharges = transactionsData
      .filter((tx) => Number(tx.amount) < 0)
      .reduce((sum, tx) => sum + Math.abs(Number(tx.amount)), 0);
    
    const cashflowTotal = totalLoyers - totalCharges;
    const nbMois = Math.max(1, transactionsData.length > 0 ? 
      new Set(transactionsData.map(tx => tx.accounting_month)).size : 1);
    
    const cashflowAnnuelMoyen = cashflowTotal / nbMois;
    const cashflowMois = transactionsData.length > 0 ? cashflowTotal / nbMois : 0;

    // Rendement net simplifié
    let rendementNet = null;
    if (valeurParc > 0 && totalLoyers > 0) {
      const annualRent = (totalLoyers / nbMois) * 12;
      const chargesNonRecup = annualRent * 0.1;
      rendementNet = ((annualRent - chargesNonRecup) / valeurParc) * 100;
    }

    const kpis = {
      valeurParc,
      encoursDette,
      cashflowMois,
      cashflowAnnuelMoyen,
      rendementNet,
      vacancePct: 0, // Simplification pour l'export
    };

    // Générer les insights
    const insights = generateInsights(kpis, mode);

    // Calculer les séries mensuelles pour les graphiques
    const months: string[] = [];
    let currentYear = fromYear;
    let currentMonth = fromMonth;
    while (currentYear < toYear || (currentYear === toYear && currentMonth <= toMonth)) {
      months.push(`${currentYear}-${String(currentMonth).padStart(2, '0')}`);
      currentMonth++;
      if (currentMonth > 12) {
        currentMonth = 1;
        currentYear++;
      }
    }

    // Agréger par mois
    const loyersMap = new Map<string, number>();
    const chargesMap = new Map<string, number>();
    const cashflowMap = new Map<string, number>();

    months.forEach(month => {
      loyersMap.set(month, 0);
      chargesMap.set(month, 0);
      cashflowMap.set(month, 0);
    });

    transactionsData.forEach(tx => {
      const month = tx.accounting_month || '';
      if (!months.includes(month)) return;

      const amount = Number(tx.amount);
      if (amount > 0) {
        loyersMap.set(month, (loyersMap.get(month) || 0) + amount);
        cashflowMap.set(month, (cashflowMap.get(month) || 0) + amount);
      } else {
        const chargeAmount = Math.abs(amount);
        chargesMap.set(month, (chargesMap.get(month) || 0) + chargeAmount);
        cashflowMap.set(month, (cashflowMap.get(month) || 0) - chargeAmount);
      }
    });

    // Récupérer l'agenda (échéances)
    const echeances = await prisma.echeanceRecurrente.findMany({
      where: {
        isActive: true,
        startAt: { lte: toDate },
        OR: [
          { endAt: null },
          { endAt: { gte: fromDate } },
        ],
      },
      select: {
        label: true,
        type: true,
        montant: true,
        startAt: true,
        periodicite: true,
      },
      take: 50,
    });

    // Préparer les données pour le PDF
    const pdfData = {
      from,
      to,
      mode,
      kpis,
      insights,
      transactions: transactionsData.map(tx => ({
        date: tx.date.toISOString(),
        accounting_month: tx.accounting_month,
        nature: tx.nature,
        label: tx.label,
        amount: Number(tx.amount),
        propertyName: tx.Property?.name || null,
      })),
      properties: properties.map(p => ({
        name: p.name,
        value: Number(p.currentValue || p.acquisitionPrice || 0),
      })),
      chartData: {
        loyers: months.map(month => ({
          month,
          value: loyersMap.get(month) || 0,
        })),
        charges: months.map(month => ({
          month,
          value: chargesMap.get(month) || 0,
        })),
        cashflow: months.map(month => ({
          month,
          value: cashflowMap.get(month) || 0,
        })),
      },
      agenda: echeances.map(e => ({
        date: e.startAt.toISOString(),
        type: e.type || 'autre',
        label: e.label || 'Échéance',
        amount: Number(e.montant),
      })),
    };

    // Générer le PDF avec @react-pdf/renderer
    const pdfBuffer = await renderToBuffer(React.createElement(PatrimoinePdf, pdfData));

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="patrimoine-${from}-${to}.pdf"`,
      },
    });
  } catch (error) {
    console.error('[API] Error in /api/dashboard/patrimoine/export/pdf:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'export PDF', details: error instanceof Error ? error.message : 'Erreur inconnue' },
      { status: 500 }
    );
  }
}

/**
 * Générer les insights pour le PDF
 */
function generateInsights(kpis: any, mode: string) {
  const items: Array<{ message: string; type: 'positive' | 'negative' | 'warning'; recommendation?: string }> = [];

  // Analyse du cashflow annuel
  if (kpis.cashflowAnnuelMoyen !== null) {
    const annualCashflow = kpis.cashflowAnnuelMoyen * 12;
    if (annualCashflow > 0) {
      items.push({
        message: `Votre cashflow annuel ${mode === 'prevision' ? 'projeté' : 'réalisé'} est positif (+${Math.round(annualCashflow).toLocaleString('fr-FR')} €)`,
        type: 'positive',
      });
    } else if (annualCashflow < 0) {
      items.push({
        message: `Votre cashflow annuel ${mode === 'prevision' ? 'projeté' : 'réalisé'} est négatif (${Math.round(annualCashflow).toLocaleString('fr-FR')} €)`,
        type: 'negative',
        recommendation: 'Pensez à réduire vos charges non récupérables ou renégocier vos prêts.',
      });
    }
  }

  // Analyse du rendement
  if (kpis.rendementNet !== null) {
    if (kpis.rendementNet >= 5) {
      items.push({
        message: `Votre rendement net de ${kpis.rendementNet.toFixed(1)}% est excellent`,
        type: 'positive',
      });
    } else if (kpis.rendementNet >= 3) {
      items.push({
        message: `Votre rendement net de ${kpis.rendementNet.toFixed(1)}% est correct mais peut être amélioré`,
        type: 'warning',
      });
    } else {
      items.push({
        message: `Votre rendement net de ${kpis.rendementNet.toFixed(1)}% est en dessous des standards du marché`,
        type: 'negative',
        recommendation: 'Votre rentabilité est faible, envisagez une indexation de loyer ou une optimisation des charges.',
      });
    }
  }

  return items;
}

