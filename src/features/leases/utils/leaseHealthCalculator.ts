/**
 * Calcul du statut de santé d'un bail à partir des échéances et transactions.
 * Logique extraite de useLeasePaymentsTimeline pour utilisation en batch.
 */

import { expandEcheances, type EcheanceRecurrenteInput } from '@/lib/echeances/expandEcheances';

const RENT_ECHEANCE_TYPES = new Set(['LOYER_ATTENDU', 'RECETTE_LOYER']);
const RENT_NATURES = new Set(['RECETTE_LOYER', 'LOYER']);
const TOLERANCE = 0.01;
const PARTIAL_TOLERANCE = 5;
const MONTHS_PAST = 12;
const MONTHS_FUTURE = 12;

type MonthPaymentStatus = 'payé' | 'surpayé' | 'partiel' | 'en_attente' | 'en_retard' | 'à_venir';

function getTransactionCoveredMonth(tx: {
  date: string;
  accounting_month?: string | null;
  accountingMonth?: string | null;
  year?: number | null;
  month?: number | null;
}): string {
  const acc = (tx as any).accounting_month ?? (tx as any).accountingMonth;
  if (acc && /^\d{4}-\d{2}$/.test(String(acc))) return String(acc);
  const y = tx.year;
  const m = tx.month;
  if (y != null && m != null && m >= 1 && m <= 12) {
    return `${y}-${String(m).padStart(2, '0')}`;
  }
  const d = new Date(tx.date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function buildMonthRange(): string[] {
  const now = new Date();
  const result: string[] = [];
  for (let i = -MONTHS_PAST; i <= MONTHS_FUTURE; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    result.push(getMonthKey(d));
  }
  return result;
}

export interface LeaseHealthInput {
  leaseId: string;
  paymentDay?: number;
  rentAmount?: number;
  chargesRecupMensuelles?: number;
}

export interface EcheanceForHealth {
  id: string;
  propertyId?: string | null;
  leaseId?: string | null;
  type?: string;
  natureCode?: string;
  label?: string;
  periodicite?: string;
  montant?: number | string;
  recuperable?: boolean;
  sens?: string;
  startAt: string;
  endAt?: string | null;
  isActive?: boolean;
}

export interface TransactionForHealth {
  id: string;
  date: string;
  amount: number;
  nature?: string;
  natureCode?: string;
  accounting_month?: string | null;
  accountingMonth?: string | null;
  year?: number | null;
  month?: number | null;
}

export type LeaseHealthStatut = 'ok' | 'partiel' | 'retard';

/**
 * Calcule le statut de santé d'un bail à partir des échéances et transactions filtrées.
 */
export function computeLeaseHealthStatut(
  lease: LeaseHealthInput,
  echeances: EcheanceForHealth[],
  transactions: TransactionForHealth[]
): LeaseHealthStatut {
  const paymentDay = lease.paymentDay ?? 5;
  const fallbackRentAmount = lease.rentAmount ?? 0;
  const fallbackCharges = lease.chargesRecupMensuelles ?? 0;

  const rentEcheances = echeances.filter(
    (e) => RENT_ECHEANCE_TYPES.has(e.type || '') || e.natureCode === 'RECETTE_LOYER'
  );

  const echeanceInputs: EcheanceRecurrenteInput[] = rentEcheances.map((e) => ({
    id: e.id,
    propertyId: e.propertyId ?? null,
    leaseId: e.leaseId ?? null,
    label: e.label || '',
    type: (e.type || 'LOYER_ATTENDU') as any,
    periodicite: (e.periodicite || 'MONTHLY') as any,
    montant: e.montant ?? 0,
    recuperable: e.recuperable ?? false,
    sens: (e.sens || 'CREDIT') as any,
    startAt: e.startAt,
    endAt: e.endAt ?? null,
    isActive: e.isActive !== false,
  }));

  const range = buildMonthRange();
  const fromStr = range[0];
  const toStr = range[range.length - 1];

  const occurrences =
    rentEcheances.length > 0 ? expandEcheances(echeanceInputs, fromStr, toStr) : [];

  const expectedByMonth = new Map<string, { sum: number; dueDate: string }>();
  for (const occ of occurrences) {
    const ym = occ.date.slice(0, 7);
    const [y, m] = ym.split('-').map(Number);
    const dueDate = `${y}-${String(m).padStart(2, '0')}-${String(Math.min(paymentDay, 28)).padStart(2, '0')}`;
    const cur = expectedByMonth.get(ym) ?? { sum: 0, dueDate };
    cur.sum += occ.amount;
    expectedByMonth.set(ym, cur);
  }

  const realizedByMonth = new Map<string, number>();
  for (const tx of transactions) {
    const nature = (tx as any).nature ?? (tx as any).natureCode ?? '';
    if (nature && !RENT_NATURES.has(nature)) continue;
    const ym = getTransactionCoveredMonth(tx);
    const cur = realizedByMonth.get(ym) ?? 0;
    realizedByMonth.set(ym, cur + tx.amount);
  }

  const fallbackTotal = fallbackRentAmount + fallbackCharges;
  if (fallbackTotal > 0 && occurrences.length === 0) {
    range.forEach((yearMonth) => {
      const [y, m] = yearMonth.split('-').map(Number);
      const dueDate = `${y}-${String(m).padStart(2, '0')}-${String(Math.min(paymentDay, 28)).padStart(2, '0')}`;
      expectedByMonth.set(yearMonth, { sum: fallbackTotal, dueDate });
    });
  }

  const now = new Date();
  const currentYm = getMonthKey(now);

  let hasRetard = false;
  let hasPartiel = false;

  for (const yearMonth of range) {
    if (yearMonth > currentYm) continue;

    const exp = expectedByMonth.get(yearMonth);
    const expected = exp?.sum ?? 0;
    if (expected <= 0) continue;

    const realized = realizedByMonth.get(yearMonth) ?? 0;
    const info = exp ?? {
      sum: 0,
      dueDate: `${yearMonth}-${String(paymentDay).padStart(2, '0')}`,
    };

    let status: MonthPaymentStatus;
    if (realized > expected + TOLERANCE) {
      status = 'surpayé';
    } else if (
      realized >= expected - TOLERANCE ||
      (realized > 0 && expected - realized < PARTIAL_TOLERANCE)
    ) {
      status = 'payé';
    } else if (realized > 0) {
      status = 'partiel';
      hasPartiel = true;
    } else {
      if (yearMonth < currentYm) {
        status = 'en_retard';
        hasRetard = true;
      } else {
        const dueDateObj = new Date(info.dueDate);
        status = now > dueDateObj ? 'en_retard' : 'en_attente';
        if (status === 'en_retard') hasRetard = true;
      }
    }

    if (hasRetard && hasPartiel) break;
  }

  return hasRetard ? 'retard' : hasPartiel ? 'partiel' : 'ok';
}
