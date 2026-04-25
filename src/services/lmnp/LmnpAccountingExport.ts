/**
 * Export comptable simplifié (type FEC) pour le ZIP LMNP — lecture seule sur les données déjà classées.
 */

export type LmnpAccountingTxInput = {
  label: string | null;
  transaction_label?: string | null;
  accounting_month: string | null;
  date: Date;
  paidAt?: Date | null;
  pieceDate?: Date | null;
  amount: number | null;
  lmnpBucket?: string | null;
  Category?: { slug: string; label: string } | null;
};

function looksLikeOpaqueTechnicalId(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(t)) return true;
  if (t.length >= 20 && /^c[a-z0-9]{20,}$/i.test(t)) return true;
  return false;
}

/** Libellé export : jamais d’id technique comme libellé principal. */
/** Pièce : préfère le nom de fichier justificatif, jamais un id technique. */
export function pieceRefFromLinkedDocuments(
  docIds: readonly string[],
  docById: Map<string, { filenameOriginal: string | null; fileName: string | null }>,
): string {
  for (const docId of docIds) {
    const d = docById.get(docId);
    const name = (d?.filenameOriginal || d?.fileName || '').trim();
    if (name && !looksLikeOpaqueTechnicalId(name)) return name.slice(0, 200);
  }
  return '';
}

export function readableTransactionLabelForExport(tx: LmnpAccountingTxInput): string {
  const rawPrimary = (tx.label || '').trim();
  if (rawPrimary && !looksLikeOpaqueTechnicalId(rawPrimary)) return rawPrimary.slice(0, 240);
  const rawSecondary = (tx.transaction_label || '').trim();
  if (rawSecondary && !looksLikeOpaqueTechnicalId(rawSecondary)) return rawSecondary.slice(0, 240);
  const cat = (tx.Category?.label || tx.Category?.slug || '').trim();
  const month = (tx.accounting_month || '').trim();
  if (cat && month) return `${cat} · ${month}`.slice(0, 240);
  if (cat) return cat.slice(0, 240);
  if (rawPrimary) return rawPrimary.slice(0, 240);
  if (rawSecondary) return rawSecondary.slice(0, 240);
  return 'Transaction';
}

/** PCG simplifié : correspondance bucket LMNP (règles métier existantes) → compte. */
const LMNP_TO_ACCOUNT: Record<string, { compte: string; libelle: string }> = {
  RECETTES_LOCATIVES: { compte: '706', libelle: 'Loyers meublés' },
  RECETTES_LOCAIRES: { compte: '706', libelle: 'Loyers meublés' },
  CHARGES_EXPLOITATION: { compte: '622', libelle: 'Frais de gestion' },
  CHARGES_ENTRETIEN_REPARATION: { compte: '615', libelle: 'Entretien et réparations' },
  CHARGES_ASSURANCE: { compte: '616', libelle: "Primes d'assurance" },
  CHARGES_FINANCIERES: { compte: '661', libelle: "Charges d'intérêts" },
  CHARGES_FISCALES: { compte: '635', libelle: 'Impôts et taxes' },
  CHARGES_DIVERSES: { compte: '628', libelle: 'Divers' },
  CHARGES_COPROPRIETE: { compte: '628', libelle: 'Divers' },
  BANQUE: { compte: '512', libelle: 'Banque' },
};

export function lmnpBucketToPcgAccount(bucket: string): { compte: string; libelle: string } {
  const b = (bucket || '').toUpperCase().trim();
  const direct = LMNP_TO_ACCOUNT[b];
  if (direct) return direct;

  if (b === 'LOYER' || b.includes('RECETTE') || b.includes('LOCATIF')) {
    return LMNP_TO_ACCOUNT.RECETTES_LOCATIVES;
  }
  if (b.includes('ASSURANCE')) return LMNP_TO_ACCOUNT.CHARGES_ASSURANCE;
  if (b.includes('FINANCIER') || b.includes('INTERET')) return LMNP_TO_ACCOUNT.CHARGES_FINANCIERES;
  if (b.includes('FISCAL') || b.includes('TAXE')) return LMNP_TO_ACCOUNT.CHARGES_FISCALES;
  if (b.includes('ENTRETIEN') || b.includes('REPARATION') || b.includes('TRAVAUX')) {
    return LMNP_TO_ACCOUNT.CHARGES_ENTRETIEN_REPARATION;
  }
  if (b.includes('COPRO')) return LMNP_TO_ACCOUNT.CHARGES_DIVERSES;
  if (b.includes('EXPLOITATION') || b.includes('GESTION')) {
    return LMNP_TO_ACCOUNT.CHARGES_EXPLOITATION;
  }
  if (b.includes('DIVERSE')) return LMNP_TO_ACCOUNT.CHARGES_DIVERSES;

  return { compte: '658', libelle: 'Charges diverses' };
}

export function accountingEcritureDate(tx: LmnpAccountingTxInput): string {
  const m = (tx.accounting_month || '').trim();
  const mm = m.match(/^(\d{4})-(\d{2})/);
  if (mm) return `${mm[1]}-${mm[2]}-01`;
  try {
    return tx.date.toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

export type LmnpFecSimplifiedRow = {
  ecritureNum: string;
  ecritureDate: string;
  compteNum: string;
  compteLib: string;
  pieceRef: string;
  pieceDate: string;
  libelle: string;
  debit: number;
  credit: number;
  montant: number;
};

function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

function monthYearFromAccountingMonth(m: string | null | undefined): { mmYyyy: string; yyyy: string } {
  const raw = (m || '').trim();
  const x = raw.match(/^(\d{4})-(\d{2})$/);
  if (!x) return { mmYyyy: '', yyyy: '' };
  return { mmYyyy: `${x[2]}/${x[1]}`, yyyy: x[1] };
}

function sanitizeFreeText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b[A-Z0-9]{8,}\b/g, ' ')
    .replace(/[^a-zA-Z0-9' -]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildCleanEcritureLib(tx: LmnpAccountingTxInput, lmnpBucket: string): string {
  const bucket = (lmnpBucket || tx.lmnpBucket || '').toUpperCase().trim();
  const source = readableTransactionLabelForExport(tx);
  const cleaned = sanitizeFreeText(source);
  const low = cleaned.toLowerCase();
  const { mmYyyy, yyyy } = monthYearFromAccountingMonth(tx.accounting_month);

  if (bucket.includes('RECETTES_LOCAT')) return `Loyer meublé${mmYyyy ? ` - ${mmYyyy}` : ''}`.slice(0, 60);
  if (
    bucket.includes('CHARGES_EXPLOITATION') &&
    /(frais|commission|menage|conciergerie|gestion)/.test(low)
  ) {
    return `Frais gestion locative${mmYyyy ? ` - ${mmYyyy}` : ''}`.slice(0, 60);
  }
  if (bucket.includes('CHARGES_FISCALES') && /(foncier|fonciere)/.test(low)) {
    return `Taxe foncière${yyyy ? ` - ${yyyy}` : ''}`.slice(0, 60);
  }
  if (bucket.includes('CHARGES_FISCALES') && /habitation/.test(low)) {
    return `Taxe habitation${yyyy ? ` - ${yyyy}` : ''}`.slice(0, 60);
  }
  if (bucket.includes('CHARGES_ASSURANCE')) return `Assurance propriétaire${yyyy ? ` - ${yyyy}` : ''}`.slice(0, 60);
  if (bucket.includes('CHARGES_FINANCIERES')) return `Intérêts emprunt${yyyy ? ` - ${yyyy}` : ''}`.slice(0, 60);

  const noPlatform = cleaned
    .replace(/\b(airbnb|booking|abritel|vrbo|expedia)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return (noPlatform || cleaned).slice(0, 60) || 'Écriture LMNP';
}

export function resolvePieceDate(tx: LmnpAccountingTxInput): string {
  const fromDoc = tx.pieceDate instanceof Date ? tx.pieceDate : null;
  const fromPaidAt = tx.paidAt instanceof Date ? tx.paidAt : null;
  const fromTx = tx.date instanceof Date ? tx.date : null;
  if (fromDoc) return fromDoc.toISOString().slice(0, 10);
  if (fromPaidAt) return fromPaidAt.toISOString().slice(0, 10);
  if (fromTx) return fromTx.toISOString().slice(0, 10);
  return accountingEcritureDate(tx);
}

export function buildFecSimplifiedRowsForTransaction(
  tx: LmnpAccountingTxInput,
  lmnpBucket: string,
  pieceRef: string,
  ecritureNum: string,
): LmnpFecSimplifiedRow[] {
  const amount = Number(tx.amount) || 0;
  const { compte, libelle } = lmnpBucketToPcgAccount(lmnpBucket);
  const montantAbs = round2(Math.abs(amount));
  const signedMontant = round2(amount);
  const safePieceRef = pieceRef.slice(0, 200);

  // Écriture double : compte métier + contrepartie banque 512
  const accountLine: LmnpFecSimplifiedRow = {
    ecritureNum,
    ecritureDate: accountingEcritureDate(tx),
    compteNum: compte,
    compteLib: libelle,
    pieceRef: safePieceRef,
    pieceDate: resolvePieceDate(tx),
    libelle: buildCleanEcritureLib(tx, lmnpBucket),
    debit: amount < 0 ? montantAbs : 0,
    credit: amount > 0 ? montantAbs : 0,
    montant: signedMontant,
  };

  const bankLine: LmnpFecSimplifiedRow = {
    ecritureNum,
    ecritureDate: accountingEcritureDate(tx),
    compteNum: LMNP_TO_ACCOUNT.BANQUE.compte,
    compteLib: LMNP_TO_ACCOUNT.BANQUE.libelle,
    pieceRef: safePieceRef,
    pieceDate: resolvePieceDate(tx),
    libelle: buildCleanEcritureLib(tx, lmnpBucket),
    debit: amount > 0 ? montantAbs : 0,
    credit: amount < 0 ? montantAbs : 0,
    montant: signedMontant,
  };

  return [accountLine, bankLine];
}

const FEC_HEADER = [
  'JournalCode',
  'JournalLib',
  'EcritureNum',
  'EcritureDate',
  'CompteNum',
  'CompteLib',
  'CompAuxNum',
  'CompAuxLib',
  'PieceRef',
  'PieceDate',
  'EcritureLib',
  'Debit',
  'Credit',
  'Montant',
  'Devise',
] as const;

export function formatFecSimplifiedCsv(
  rows: LmnpFecSimplifiedRow[],
  buildCsvRow: (cells: Array<string | number | null | undefined>) => string,
): string {
  const lines: string[] = [];
  lines.push(buildCsvRow([...FEC_HEADER]));
  for (const r of rows) {
    lines.push(
      buildCsvRow([
        'LMNP',
        'Locations meublées',
        r.ecritureNum,
        r.ecritureDate,
        r.compteNum,
        r.compteLib,
        '',
        '',
        r.pieceRef,
        r.pieceDate,
        r.libelle,
        r.debit,
        r.credit,
        r.montant,
        'EUR',
      ]),
    );
  }
  return lines.join('\n');
}

export function formatBalanceComptableCsv(
  rows: LmnpFecSimplifiedRow[],
  buildCsvRow: (cells: Array<string | number | null | undefined>) => string,
): string {
  const byAccount = new Map<string, { libelle: string; debit: number; credit: number }>();
  for (const r of rows) {
    const prev = byAccount.get(r.compteNum);
    if (prev) {
      prev.debit = round2(prev.debit + r.debit);
      prev.credit = round2(prev.credit + r.credit);
    } else {
      byAccount.set(r.compteNum, { libelle: r.compteLib, debit: round2(r.debit), credit: round2(r.credit) });
    }
  }

  let totalDebit = round2(rows.reduce((s, r) => s + r.debit, 0));
  let totalCredit = round2(rows.reduce((s, r) => s + r.credit, 0));
  const delta = round2(totalDebit - totalCredit);
  if (delta !== 0) {
    if (delta > 0) {
      byAccount.set('120', { libelle: 'Résultat LMNP (simulation)', debit: 0, credit: delta });
    } else {
      byAccount.set('120', { libelle: 'Résultat LMNP (simulation)', debit: Math.abs(delta), credit: 0 });
    }
    totalDebit = round2(totalDebit + (delta < 0 ? Math.abs(delta) : 0));
    totalCredit = round2(totalCredit + (delta > 0 ? delta : 0));
  }

  const sortKey = (compte: string): [number, string] => {
    if (compte === '512') return [0, compte];
    if (compte.startsWith('6')) return [1, compte];
    if (compte.startsWith('7')) return [2, compte];
    if (compte === '120') return [3, compte];
    return [4, compte];
  };
  const sorted = [...byAccount.entries()].sort(([a], [b]) => {
    const ka = sortKey(a);
    const kb = sortKey(b);
    if (ka[0] !== kb[0]) return ka[0] - kb[0];
    return ka[1].localeCompare(kb[1], 'fr');
  });
  const lines: string[] = [];
  lines.push(buildCsvRow(['CompteNum', 'CompteLib', 'TotalDebit', 'TotalCredit', 'Solde']));
  for (const [compteNum, v] of sorted) {
    const solde = round2(v.debit - v.credit);
    lines.push(buildCsvRow([compteNum, v.libelle, round2(v.debit), round2(v.credit), solde]));
  }
  lines.push(buildCsvRow(['TOTAL', '', totalDebit, totalCredit, round2(totalDebit - totalCredit)]));
  return lines.join('\n');
}
