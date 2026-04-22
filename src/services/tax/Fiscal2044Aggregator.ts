import type {
  Fiscal2044Ambiguity,
  Fiscal2044Lines,
  Fiscal2044PropertySummary,
  Fiscal2044UiHintLine,
  Fiscal2044UiLineUsageTrace,
} from '@/types/fiscal';

type CategoryLike = {
  slug?: string | null;
  label?: string | null;
  type?: string | null;
  deductible?: boolean | null;
  capitalizable?: boolean | null;
  fiscalLineHint?: string | null;
};

type TransactionLike = {
  id: string;
  label?: string | null;
  amount: number;
  nature?: string | null;
  chargesNonRecup?: number | null;
  Category?: CategoryLike | null;
};

interface Aggregate2044Input {
  propertyId: string;
  year: number;
  transactions: TransactionLike[];
  interetsEmprunt?: number;
  rentedLotCount?: number;
  applyForfait222?: boolean;
}

const HINT_TO_LINE: Record<string, keyof Fiscal2044Lines> = {
  '2044_211': '211',
  '2044_212': '212',
  '2044_213': '213',
  '2044_215': '215',
  '2044_221': '221',
  '2044_222': '222',
  '2044_223': '223',
  '2044_224': '224',
  '2044_225': '225',
  '2044_226': '226',
  '2044_227': '227',
  '2044_229': '229',
  '2044_230': '230',
  '2044_420': '420',
};

const CHARGE_LINES: Array<keyof Fiscal2044Lines> = ['221', '222', '223', '224', '225', '226', '227', '230'];
const UI_TRACE_LINES: Fiscal2044UiHintLine[] = ['211', '221', '222', '223', '224', '225', '227', '230'];

function toCents(amount: number): number {
  return Math.round((Number(amount) + Number.EPSILON) * 100);
}

function fromCents(cents: number): number {
  return cents / 100;
}

function emptyLines(): Fiscal2044Lines {
  return {
    '211': 0,
    '212': 0,
    '213': 0,
    '215': 0,
    '221': 0,
    '222': 0,
    '223': 0,
    '224': 0,
    '225': 0,
    '226': 0,
    '227': 0,
    '229': 0,
    '230': 0,
    '420': 0,
  };
}

function normalizeHint(value?: string | null): keyof Fiscal2044Lines | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  return HINT_TO_LINE[normalized] ?? null;
}

function isRevenueNature(nature?: string | null): boolean {
  const code = String(nature || '').toUpperCase();
  return code.startsWith('RECETTE') || code === 'LOYER' || code.includes('LOUER');
}

function isExpenseNature(nature?: string | null): boolean {
  const code = String(nature || '').toUpperCase();
  return code.startsWith('DEPENSE') || code === 'CHARGES';
}

function isGestionOrHonoraires(category: CategoryLike | null | undefined): boolean {
  const label = String(category?.label || '').toLowerCase();
  const slug = String(category?.slug || '').toLowerCase();
  const type = String(category?.type || '').toLowerCase();
  return (
    slug.includes('frais-gestion') ||
    slug.includes('honoraire') ||
    slug.includes('gestion') ||
    type.includes('gestion') ||
    label.includes('gestion') ||
    label.includes('commission') ||
    label.includes('honoraire')
  );
}

function fallbackLineFromCategory(category: CategoryLike | null | undefined): keyof Fiscal2044Lines {
  const label = String(category?.label || '').toLowerCase();
  const slug = String(category?.slug || '').toLowerCase();
  const type = String(category?.type || '').toLowerCase();
  const isDeductible = category?.deductible === true;
  const isCapitalizable = category?.capitalizable === true;

  if (isDeductible && isGestionOrHonoraires(category)) {
    return '221';
  }

  if (slug.includes('assurance') || label.includes('assurance')) {
    return '223';
  }

  if (slug.includes('taxe-fonciere') || label.includes('taxe fonci') || type.includes('taxe_fonciere')) {
    return '227';
  }

  const looksLikeTravaux =
    slug.includes('travaux') || slug.includes('entretien') || label.includes('travaux') || label.includes('entretien');
  if (looksLikeTravaux && !isCapitalizable) {
    return '224';
  }

  if (isDeductible) {
    return '230';
  }

  return '230';
}

function createAmbiguity(tx: TransactionLike, reason: string): Fiscal2044Ambiguity {
  return {
    transactionId: tx.id,
    label: tx.label || 'Transaction',
    amount: Math.abs(Number(tx.amount || 0)),
    reason,
    categoryLabel: tx.Category?.label || undefined,
    categorySlug: tx.Category?.slug || undefined,
    fiscalLineHint: tx.Category?.fiscalLineHint ?? null,
  };
}

class Fiscal2044AggregatorClass {
  aggregate(input: Aggregate2044Input): Fiscal2044PropertySummary {
    const lines = emptyLines();
    const linesCents = emptyLines();
    (Object.keys(linesCents) as Array<keyof Fiscal2044Lines>).forEach((k) => {
      linesCents[k] = 0;
    });
    const ambiguities: Fiscal2044Ambiguity[] = [];
    let missingHintCount = 0;
    let unmappedCount = 0;
    const usageTrace: Record<Fiscal2044UiHintLine, Fiscal2044UiLineUsageTrace> = {
      '211': { transactionIds: [], labels: [], duplicateIds: [], amountFromTransactions: 0 },
      '221': { transactionIds: [], labels: [], duplicateIds: [], amountFromTransactions: 0 },
      '222': { transactionIds: [], labels: [], duplicateIds: [], amountFromTransactions: 0 },
      '223': { transactionIds: [], labels: [], duplicateIds: [], amountFromTransactions: 0 },
      '224': { transactionIds: [], labels: [], duplicateIds: [], amountFromTransactions: 0 },
      '225': { transactionIds: [], labels: [], duplicateIds: [], amountFromTransactions: 0 },
      '227': { transactionIds: [], labels: [], duplicateIds: [], amountFromTransactions: 0 },
      '230': { transactionIds: [], labels: [], duplicateIds: [], amountFromTransactions: 0 },
    };

    const usageSeenByLine: Record<Fiscal2044UiHintLine, Set<string>> = {
      '211': new Set(),
      '221': new Set(),
      '222': new Set(),
      '223': new Set(),
      '224': new Set(),
      '225': new Set(),
      '227': new Set(),
      '230': new Set(),
    };

    const usageAmountByLineAndTxId: Record<Fiscal2044UiHintLine, Map<string, number>> = {
      '211': new Map(),
      '221': new Map(),
      '222': new Map(),
      '223': new Map(),
      '224': new Map(),
      '225': new Map(),
      '227': new Map(),
      '230': new Map(),
    };

    const pushUsage = (line: keyof Fiscal2044Lines, tx: TransactionLike, amountUsed: number) => {
      const traceLine = line as Fiscal2044UiHintLine;
      if (!UI_TRACE_LINES.includes(traceLine)) return;
      if (amountUsed <= 0) return;

      const trace = usageTrace[traceLine];
      const seen = usageSeenByLine[traceLine];
      const amountByTxId = usageAmountByLineAndTxId[traceLine];
      if (seen.has(tx.id)) {
        trace.duplicateIds.push(tx.id);
      } else {
        seen.add(tx.id);
        trace.transactionIds.push(tx.id);
        trace.labels.push(tx.label || 'Transaction');
      }
      amountByTxId.set(tx.id, (amountByTxId.get(tx.id) || 0) + amountUsed);
      trace.amountFromTransactions += amountUsed;
    };

    for (const tx of input.transactions) {
      const absoluteAmountCents = Math.abs(toCents(Number(tx.amount || 0)));
      const nonRecupCents = Math.abs(toCents(Number(tx.chargesNonRecup || 0)));
      const hasMainAmount = absoluteAmountCents > 0;
      const hasNonRecupOnly = !hasMainAmount && nonRecupCents > 0;

      if (!hasMainAmount && !hasNonRecupOnly) continue;

      const hintedLine = normalizeHint(tx.Category?.fiscalLineHint);
      const revenueNature = isRevenueNature(tx.nature);
      const expenseNature = isExpenseNature(tx.nature);

      if (!tx.Category?.fiscalLineHint) {
        missingHintCount += 1;
      }

      if (hintedLine && hintedLine !== '229' && hintedLine !== '420') {
        if (hasMainAmount) {
          if (expenseNature && tx.Category?.capitalizable === true) {
            unmappedCount += 1;
            ambiguities.push(
              createAmbiguity(tx, 'depense capitalisable: montant exclu de la ventilation 2044 (traitement immobilisation a prevoir)')
            );
          } else {
            linesCents[hintedLine] += absoluteAmountCents;
            pushUsage(hintedLine, tx, fromCents(absoluteAmountCents));
          }
        }
        if (revenueNature && nonRecupCents > 0) {
          linesCents['225'] += nonRecupCents;
          pushUsage('225', tx, fromCents(nonRecupCents));
        }
        continue;
      }

      if (hintedLine === '229' || hintedLine === '420') {
        unmappedCount += 1;
        ambiguities.push(createAmbiguity(tx, 'fiscalLineHint pointe vers une ligne calculee automatiquement (229/420)'));
        if (revenueNature && nonRecupCents > 0) {
          linesCents['225'] += nonRecupCents;
        }
        continue;
      }

      if (revenueNature) {
        if (nonRecupCents > 0) {
          linesCents['225'] += nonRecupCents;
          pushUsage('225', tx, fromCents(nonRecupCents));
        }
        if (!hasMainAmount) {
          continue;
        }
        const categorySlug = String(tx.Category?.slug || '').toLowerCase();
        const categoryType = String(tx.Category?.type || '').toLowerCase();
        if (categorySlug.includes('loyer')) {
          linesCents['211'] += absoluteAmountCents;
          pushUsage('211', tx, fromCents(absoluteAmountCents));
        } else if (categoryType.includes('revenu')) {
          linesCents['213'] += absoluteAmountCents;
        } else {
          linesCents['212'] += absoluteAmountCents;
          ambiguities.push(createAmbiguity(tx, 'recette sans fiscalLineHint: ventilee en 212 (a confirmer)'));
        }
        continue;
      }

      if (expenseNature) {
        if (tx.Category?.capitalizable === true) {
          unmappedCount += 1;
          ambiguities.push(
            createAmbiguity(tx, 'depense capitalisable: montant exclu de la ventilation 2044 (traitement immobilisation a prevoir)')
          );
          continue;
        }
        if (!hasMainAmount) {
          continue;
        }
        const fallbackLine = fallbackLineFromCategory(tx.Category);
        linesCents[fallbackLine] += absoluteAmountCents;
        pushUsage(fallbackLine, tx, fromCents(absoluteAmountCents));

        if (!tx.Category?.fiscalLineHint) {
          ambiguities.push(createAmbiguity(tx, `charge sans fiscalLineHint: fallback vers ${fallbackLine}`));
        }

        if (fallbackLine === '230') {
          unmappedCount += 1;
        }
        continue;
      }

      if (hasMainAmount) {
        unmappedCount += 1;
        ambiguities.push(
          createAmbiguity(tx, 'nature non reconnue comme recette ou depense: montant non ventile (verifier la nature)')
        );
      }
    }

    if ((input.interetsEmprunt || 0) > 0) {
      // Interets d'emprunt integres dans la ventilation charge generique si non detaille.
      linesCents['230'] += toCents(Number(input.interetsEmprunt || 0));
    }

    if (input.applyForfait222 && (input.rentedLotCount || 0) > 0) {
      const lotCount = Math.max(0, Math.floor(Number(input.rentedLotCount || 0)));
      const montant222Cents = lotCount * 2000;
      if (montant222Cents > 0) {
        linesCents['222'] += montant222Cents;
        const syntheticId = `FORFAIT_222_${input.propertyId}`;
        const syntheticLabel = `Forfait fiscal 20€ × ${lotCount} lot(s)`;
        const trace = usageTrace['222'];
        trace.transactionIds = [syntheticId];
        trace.labels = [syntheticLabel];
        trace.duplicateIds = [];
        trace.amountFromTransactions = fromCents(montant222Cents);
        trace.isSynthetic = true;
        trace.syntheticUnits = lotCount;
        trace.transactionItems = [
          {
            id: syntheticId,
            label: syntheticLabel,
            amount: fromCents(montant222Cents),
            isSynthetic: true,
          },
        ];
      }
    }

    linesCents['229'] = CHARGE_LINES.reduce((sum, key) => sum + linesCents[key], 0);
    const revenusCents = linesCents['211'] + linesCents['212'] + linesCents['213'] + linesCents['215'];
    linesCents['420'] = revenusCents - linesCents['229'];

    (Object.keys(lines) as Array<keyof Fiscal2044Lines>).forEach((key) => {
      lines[key] = fromCents(linesCents[key]);
    });

    for (const line of UI_TRACE_LINES) {
      const trace = usageTrace[line];
      if (trace.isSynthetic) continue;
      const amountByTxId = usageAmountByLineAndTxId[line];
      trace.transactionItems = trace.transactionIds.map((id, idx) => ({
        id,
        label: trace.labels[idx] || 'Transaction',
        amount: amountByTxId.get(id) || 0,
      }));
    }

    return {
      propertyId: input.propertyId,
      year: input.year,
      lines,
      uiLineUsageTrace: usageTrace,
      quality: {
        missingHintCount,
        unmappedCount,
        ambiguousTransactions: ambiguities,
      },
    };
  }
}

export const Fiscal2044Aggregator = new Fiscal2044AggregatorClass();

