import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/dashboard/patrimoine/export
 * Export des données du dashboard patrimoine en CSV (Excel)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { from, to, mode, format = 'csv' } = body;

    if (!from || !to) {
      return NextResponse.json(
        { error: 'Les paramètres from et to sont requis' },
        { status: 400 }
      );
    }

    // Pour l'instant, on génère uniquement du CSV (compatible Excel)
    if (format === 'csv') {
      const csvData = await generateCSV(from, to, mode);
      
      return new NextResponse(csvData, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="patrimoine-${from}-${to}.csv"`,
        },
      });
    }

    return NextResponse.json(
      { error: 'Format non supporté' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[API] Error in /api/dashboard/patrimoine/export:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'export' },
      { status: 500 }
    );
  }
}

async function generateCSV(from: string, to: string, mode: string): Promise<string> {
  const [fromYear, fromMonth] = from.split('-').map(Number);
  const [toYear, toMonth] = to.split('-').map(Number);
  const fromDate = new Date(fromYear, fromMonth - 1, 1);
  const toDate = new Date(toYear, toMonth, 0, 23, 59, 59);

  // Récupérer les données
  const transactions = await prisma.transaction.findMany({
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

  // En-têtes CSV
  const headers = [
    'Mois comptable',
    'Date',
    'Nature',
    'Libellé',
    'Bien',
    'Montant (€)',
  ];

  // Lignes de données
  const rows = transactions.map(tx => [
    tx.accounting_month || '',
    new Date(tx.date).toLocaleDateString('fr-FR'),
    tx.nature || '',
    tx.label || '',
    tx.Property?.name || '',
    tx.amount?.toString() || '0',
  ]);

  // Construire le CSV
  const csvLines = [
    headers.join(';'),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(';')),
  ];

  // Ajouter le BOM UTF-8 pour Excel
  return '\uFEFF' + csvLines.join('\n');
}

