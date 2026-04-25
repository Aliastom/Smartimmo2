import { describe, it, expect } from 'vitest';
import {
  buildCleanEcritureLib,
  buildFecSimplifiedRowsForTransaction,
  formatBalanceComptableCsv,
  formatFecSimplifiedCsv,
  lmnpBucketToPcgAccount,
  pieceRefFromLinkedDocuments,
  readableTransactionLabelForExport,
  resolvePieceDate,
} from '@/services/lmnp/LmnpAccountingExport';

function buildCsvRow(cells: Array<string | number | null | undefined>): string {
  return cells
    .map((v) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    })
    .join(';');
}

describe('LmnpAccountingExport', () => {
  it('lmnpBucketToPcgAccount : clés connues', () => {
    expect(lmnpBucketToPcgAccount('RECETTES_LOCATIVES').compte).toBe('706');
    expect(lmnpBucketToPcgAccount('CHARGES_FISCALES').compte).toBe('635');
    expect(lmnpBucketToPcgAccount('CHARGES_FINANCIERES').compte).toBe('661');
  });

  it('lmnpBucketToPcgAccount : préfixes LMNP', () => {
    expect(lmnpBucketToPcgAccount('LOYER').compte).toBe('706');
    expect(lmnpBucketToPcgAccount('CHARGES_ASSURANCE_PNO').compte).toBe('616');
  });

  it('débit / crédit selon le signe du montant', () => {
    const pos = buildFecSimplifiedRowsForTransaction(
      {
        label: 'Loyer',
        accounting_month: '2024-03',
        date: new Date('2024-03-15'),
        amount: 500,
        Category: null,
      },
      'RECETTES_LOCATIVES',
      'quittance.pdf',
      'LMNP-2024-0001',
    );
    expect(pos).toHaveLength(2);
    expect(pos[0].debit).toBe(0);
    expect(pos[0].credit).toBe(500);
    expect(pos[1].compteNum).toBe('512');
    expect(pos[1].debit).toBe(500);
    expect(pos[1].credit).toBe(0);

    const neg = buildFecSimplifiedRowsForTransaction(
      {
        label: 'Taxe foncière',
        accounting_month: '2024-06',
        date: new Date('2024-06-10'),
        amount: -1200,
        Category: null,
      },
      'CHARGES_FISCALES',
      '',
      'LMNP-2024-0002',
    );
    expect(neg[0].debit).toBe(1200);
    expect(neg[0].credit).toBe(0);
    expect(neg[1].compteNum).toBe('512');
    expect(neg[1].debit).toBe(0);
    expect(neg[1].credit).toBe(1200);

    // Chaque écriture (2 lignes) est équilibrée.
    const sum = (rows: typeof neg) => rows.reduce((s, r) => s + r.debit - r.credit, 0);
    expect(sum(pos)).toBe(0);
    expect(sum(neg)).toBe(0);
  });

  it('resolvePieceDate respecte la priorité document > paid_at > transaction > mois', () => {
    const base = {
      label: 'x',
      accounting_month: '2025-04',
      date: new Date('2025-04-10T00:00:00Z'),
      amount: 1,
      Category: null,
    };
    expect(
      resolvePieceDate({
        ...base,
        pieceDate: new Date('2025-04-02T00:00:00Z'),
        paidAt: new Date('2025-04-03T00:00:00Z'),
      }),
    ).toBe('2025-04-02');
    expect(
      resolvePieceDate({
        ...base,
        pieceDate: null,
        paidAt: new Date('2025-04-03T00:00:00Z'),
      }),
    ).toBe('2025-04-03');
  });

  it('buildCleanEcritureLib simplifie les libellés longs', () => {
    const lib = buildCleanEcritureLib(
      {
        label: 'Frais ménage conciergerie - HMWNEEMTNP - 01/2025',
        accounting_month: '2025-01',
        date: new Date('2025-01-10'),
        amount: -10,
        Category: null,
      },
      'CHARGES_EXPLOITATION',
    );
    expect(lib).toBe('Frais gestion locative - 01/2025');
    expect(lib.length).toBeLessThanOrEqual(60);
  });

  it('readableTransactionLabelForExport évite un libellé type cuid', () => {
    const cuid = 'cmj639eb5000jn8gcy3q6c43q';
    const t = readableTransactionLabelForExport({
      label: cuid,
      accounting_month: '2024-01',
      date: new Date(),
      amount: 0,
      Category: { slug: 'charges-locatives', label: 'Charges locatives' },
    });
    expect(t).not.toContain(cuid);
    expect(t).toContain('Charges locatives');
  });

  it('pieceRefFromLinkedDocuments : nom de fichier uniquement', () => {
    const m = new Map([
      ['d1', { filenameOriginal: 'facture.pdf', fileName: 'x' }],
    ]);
    expect(pieceRefFromLinkedDocuments(['d1'], m)).toBe('facture.pdf');
    expect(pieceRefFromLinkedDocuments([], m)).toBe('');
  });

  it('formatBalanceComptableCsv agrège par compte', () => {
    const rows = [
      ...buildFecSimplifiedRowsForTransaction(
        { label: 'A', accounting_month: '2024-01', date: new Date('2024-01-01'), amount: 100, Category: null },
        'RECETTES_LOCATIVES',
        '',
        'LMNP-2024-0001',
      ),
      ...buildFecSimplifiedRowsForTransaction(
        { label: 'B', accounting_month: '2024-02', date: new Date('2024-02-01'), amount: 200, Category: null },
        'RECETTES_LOCATIVES',
        '',
        'LMNP-2024-0002',
      ),
      ...buildFecSimplifiedRowsForTransaction(
        { label: 'C', accounting_month: '2024-01', date: new Date('2024-01-05'), amount: -50, Category: null },
        'CHARGES_FISCALES',
        '',
        'LMNP-2024-0003',
      ),
    ];
    const csv = formatBalanceComptableCsv(rows, buildCsvRow);
    expect(csv).toContain('706');
    expect(csv).toContain('512');
    expect(csv).toContain('635');
    expect(csv).toContain('300');
    expect(csv).toContain('TotalDebit');
    expect(csv).toContain('Solde');
    expect(csv).toContain('TOTAL');
    const lines = csv.split('\n');
    const line706 = lines.find((l) => l.startsWith('706;'));
    expect(line706).toBeDefined();
    expect(line706).toContain('300');
    const total = lines.find((l) => l.startsWith('TOTAL;'));
    expect(total).toBeDefined();
    const cells = (total || '').split(';');
    expect(cells[2]).toBe(cells[3]); // total débit == total crédit (équilibrage)
  });

  it('formatFecSimplifiedCsv contient JournalCode LMNP', () => {
    const rows = [
      ...buildFecSimplifiedRowsForTransaction(
        { label: 'Loyer T1', accounting_month: '2024-01', date: new Date('2024-01-10'), amount: 400, Category: null },
        'RECETTES_LOCATIVES',
        'quittance.pdf',
        'LMNP-2024-0001',
      ),
    ];
    const csv = formatFecSimplifiedCsv(rows, buildCsvRow);
    expect(csv.split('\n')[0]).toContain('JournalCode');
    expect(csv.split('\n')[0]).toContain('EcritureLib');
    expect(csv).toContain('LMNP');
    expect(csv).toContain('Locations meublées');
    expect(csv).toContain('706');
    expect(csv).toContain('Loyer meublé - 01/2024');
    expect(csv).toContain('EUR');
  });
});
