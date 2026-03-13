/**
 * API Route : Export PDF de la simulation fiscale
 * POST /api/fiscal/export-pdf
 * Inclut en annexe la liste des transactions prises en compte (année + biens de la simulation).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { generateSimulationPDF } from '@/services/pdf/generateSimulationPDF';
import type { SimulationResult, OptimizationSuggestion } from '@/types/fiscal';
import type { SimulationPDFTransactionRow } from '@/components/pdf/SimulationPDF';

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const body = await request.json();
    const simulation: SimulationResult = body.simulation;
    const suggestions: OptimizationSuggestion[] = body.suggestions || [];

    if (!simulation) {
      return NextResponse.json(
        { error: 'Simulation manquante' },
        { status: 400 }
      );
    }

    const year = simulation.inputs.year;
    const propertyIds = simulation.biens?.map((b) => b.id) ?? [];
    const baseCalcul = simulation.inputs.options?.baseCalcul ?? 'encaisse';

    let transactionsForPdf: SimulationPDFTransactionRow[] = [];
    if (propertyIds.length > 0) {
      // Règle fiscale DGFiP : les loyers sont rattachés à l'année d'encaissement.
      // Filtrer par date de paiement (paidAt, fallback date, fallback createdAt).
      const jan1 = new Date(`${year}-01-01T00:00:00.000Z`);
      const dec31 = new Date(`${year}-12-31T23:59:59.999Z`);
      const where: any = {
        propertyId: { in: propertyIds },
        organizationId,
        OR: [
          { paidAt: { gte: jan1, lte: dec31 } },
          { paidAt: { equals: null }, date: { gte: jan1, lte: dec31 } },
        ],
      };
      if (baseCalcul === 'encaisse') {
        where.rapprochementStatus = 'rapprochee';
      }
      const rows = await prisma.transaction.findMany({
        where,
        include: { Category: true, Property: true },
        orderBy: [{ propertyId: 'asc' }, { date: 'asc' }],
      });
      transactionsForPdf = rows.map((tx) => ({
        propertyName: tx.Property?.name ?? '–',
        label: tx.label ?? '–',
        date: tx.date ? new Date(tx.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '–',
        amount: tx.amount ?? 0,
        categoryLabel: tx.Category?.label ?? '–',
      }));
    }

    const pdfBuffer = await generateSimulationPDF(simulation, suggestions, transactionsForPdf);

    // Nom du fichier
    const filename = `simulation-fiscale-${simulation.inputs.year}-${new Date().toISOString().split('T')[0]}.pdf`;

    // Retourner le PDF
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('[API Export PDF] Erreur:', error);
    return NextResponse.json(
      { 
        error: 'Erreur lors de la génération du PDF',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
