/**
 * Construction pure de la timeline paiements d'un bail (même logique que useLeasePaymentsTimeline).
 * Utilisé pour le pilotage global (actions prioritaires, colonne tableau) sans N hooks async.
 */

import { expandEcheances, type EcheanceRecurrenteInput } from '@/lib/echeances/expandEcheances';
import { normalizeLeaseContractStatus } from './leaseWorkflowStatus';
import type {
  LeasePaymentsTimelineMonth,
  MonthPaymentStatus,
} from '../hooks/useLeasePaymentsTimeline';
import type { EcheanceForHealth, TransactionForHealth } from './leaseHealthCalculator';

const RENT_ECHEANCE_TYPES = new Set(['LOYER_ATTENDU', 'RECETTE_LOYER']);
const RENT_NATURES = new Set(['RECETTE_LOYER', 'LOYER']);
const TOLERANCE = 0.01;
const PARTIAL_TOLERANCE = 5;
const MONTHS_PAST = 12;
const MONTHS_FUTURE = 12;

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

function getMonthLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number);
  const date = new Date(y, m - 1, 1);
  return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
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

export interface LeaseTimelineSnapshotLeaseInput {
  paymentDay?: number;
  startDate: string;
  status: string;
  rentAmount: number;
  chargesRecupMensuelles?: number;
}

export interface LeaseTimelineCockpit {
  loyerMensuel: number;
  totalAttendu12Mois: number;
  totalEncaisse12Mois: number;
  tauxPaiement: number | null;
  montantEnRetard: number;
  statutGlobal: 'ok' | 'partiel' | 'retard';
  prochaineAction: string;
}

export function buildLeaseTimelineSnapshot(
  lease: LeaseTimelineSnapshotLeaseInput,
  echeances: EcheanceForHealth[],
  transactions: TransactionForHealth[],
  now: Date = new Date()
): { months: LeasePaymentsTimelineMonth[]; cockpit: LeaseTimelineCockpit } {
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
  const leaseStartYm = lease.startDate ? lease.startDate.slice(0, 7) : null;
  const filteredRange = leaseStartYm ? range.filter((ym) => ym >= leaseStartYm) : range;
  const fromStr = range[0];
  const toStr = range[range.length - 1];

  const occurrences =
    rentEcheances.length > 0 ? expandEcheances(echeanceInputs, fromStr, toStr) : [];

  const expectedByMonth = new Map<string, { sum: number; dueDate: string; echeanceIds: string[] }>();
  for (const occ of occurrences) {
    const ym = occ.date.slice(0, 7);
    const [y, m] = ym.split('-').map(Number);
    const dueDate = `${y}-${String(m).padStart(2, '0')}-${String(Math.min(paymentDay, 28)).padStart(2, '0')}`;
    const cur = expectedByMonth.get(ym) ?? { sum: 0, dueDate, echeanceIds: [] };
    cur.sum += occ.amount;
    if (!cur.echeanceIds.includes(occ.echeanceId)) cur.echeanceIds.push(occ.echeanceId);
    expectedByMonth.set(ym, cur);
  }

  const realizedByMonth = new Map<string, { sum: number; txIds: string[]; lastDate: string }>();
  for (const tx of transactions) {
    const nature = (tx as any).nature ?? (tx as any).natureCode ?? '';
    if (nature && !RENT_NATURES.has(nature)) continue;
    const ym = getTransactionCoveredMonth(tx);
    const cur = realizedByMonth.get(ym) ?? { sum: 0, txIds: [], lastDate: tx.date };
    cur.sum += tx.amount;
    cur.txIds.push(tx.id);
    if (tx.date > cur.lastDate) cur.lastDate = tx.date;
    realizedByMonth.set(ym, cur);
  }

  const fallbackTotal = fallbackRentAmount + fallbackCharges;
  if (fallbackTotal > 0 && occurrences.length === 0) {
    filteredRange.forEach((yearMonth) => {
      const [y, m] = yearMonth.split('-').map(Number);
      const dueDate = `${y}-${String(m).padStart(2, '0')}-${String(Math.min(paymentDay, 28)).padStart(2, '0')}`;
      expectedByMonth.set(yearMonth, { sum: fallbackTotal, dueDate, echeanceIds: [] });
    });
  }

  const currentYm = getMonthKey(now);
  const isActiveContract = normalizeLeaseContractStatus(lease.status) === 'ACTIF';

  const months: LeasePaymentsTimelineMonth[] = filteredRange.map((yearMonth) => {
    const exp = expectedByMonth.get(yearMonth);
    const real = realizedByMonth.get(yearMonth);
    const expected = exp?.sum ?? 0;
    const realized = real?.sum ?? 0;
    const gap = realized - expected;
    const info = exp ?? { dueDate: `${yearMonth}-${String(paymentDay).padStart(2, '0')}`, echeanceIds: [] };
    const txIds = real?.txIds ?? [];

    let status: MonthPaymentStatus;
    if (!isActiveContract) {
      status = 'à_venir';
    } else if (yearMonth > currentYm) {
      status = 'à_venir';
    } else if (realized > expected + TOLERANCE) {
      status = 'surpayé';
    } else if (realized >= expected - TOLERANCE || (realized > 0 && expected - realized < PARTIAL_TOLERANCE)) {
      status = 'payé';
    } else if (realized > 0) {
      status = 'partiel';
    } else {
      if (yearMonth < currentYm) {
        status = 'en_retard';
      } else {
        const dueDateObj = new Date(info.dueDate);
        status = now > dueDateObj ? 'en_retard' : 'en_attente';
      }
    }

    return {
      yearMonth,
      label: getMonthLabel(yearMonth),
      expected,
      realized,
      gap,
      status,
      dueDate: info.dueDate,
      transactionIds: txIds,
      echeanceIds: info.echeanceIds,
      lastTxDate: real?.lastDate,
    };
  });

  const nextDue = (() => {
    const future = months.filter((m) => m.status === 'en_attente' || m.status === 'à_venir');
    const firstPending = months.find((m) =>
      m.status === 'en_attente' ||
      m.status === 'en_retard' ||
      m.status === 'partiel' ||
      m.status === 'surpayé'
    );
    const m = firstPending ?? future[0];
    if (!m || m.expected <= 0) return null;
    return { month: m, status: 'à_piloter' as const };
  })();

  const alerts: Array<{ type: string; message: string; daysOverdue?: number }> = [];
  const enRetard = months.find((m) => m.status === 'en_retard' && m.expected > 0 && m.realized === 0);
  if (enRetard && enRetard.dueDate) {
    const due = new Date(enRetard.dueDate);
    const daysOverdue = Math.floor((now.getTime() - due.getTime()) / (24 * 60 * 60 * 1000));
    alerts.push({
      type: 'retard',
      message:
        daysOverdue > 0
          ? `Paiement en retard depuis ${daysOverdue} jour${daysOverdue > 1 ? 's' : ''}`
          : `Loyer ${enRetard.label} en retard`,
      daysOverdue,
    });
  }
  const partiel = months.find((m) => m.status === 'partiel');
  if (partiel) {
    const reste = partiel.expected - partiel.realized;
    alerts.push({
      type: 'partiel',
      message: `Paiement partiel sur ${partiel.label} : reste dû ${reste.toFixed(2)} €`,
    });
  }

  const last12Months = months.filter((m) => m.yearMonth <= currentYm && m.expected > 0);
  const totalAttendu12 = last12Months.reduce((s, m) => s + m.expected, 0);
  const totalEncaisse12 = last12Months.reduce((s, m) => s + m.realized, 0);
  const montantEnRetard = months
    .filter((m) => (m.status === 'en_retard' || m.status === 'partiel') && m.yearMonth <= currentYm)
    .reduce((s, m) => s + Math.max(0, m.expected - m.realized), 0);
  const tauxPaiement = totalAttendu12 > 0 ? Math.round((totalEncaisse12 / totalAttendu12) * 100) : null;

  const hasRetard = months.some((m) => m.status === 'en_retard' && m.expected > 0);
  const hasPartiel = months.some((m) => m.status === 'partiel');
  const statutGlobal: 'ok' | 'partiel' | 'retard' = hasRetard ? 'retard' : hasPartiel ? 'partiel' : 'ok';

  const retardAlert = alerts.find((a) => a.type === 'retard');
  const partielFirst = months.find((m) => m.status === 'partiel');
  const prochaineAction = retardAlert
    ? retardAlert.message
    : partielFirst
      ? `Paiement partiel à compléter : ${(partielFirst.expected - partielFirst.realized).toFixed(2)} € restant (${partielFirst.label})`
      : nextDue
        ? `Prochaine échéance : ${paymentDay} ${nextDue.month.label.split(' ')[0]}`
        : 'Aucune action requise';

  const loyerMensuel =
    fallbackRentAmount + fallbackCharges || (months.find((m) => m.expected > 0)?.expected ?? 0);

  const cockpit: LeaseTimelineCockpit = {
    loyerMensuel,
    totalAttendu12Mois: totalAttendu12,
    totalEncaisse12Mois: totalEncaisse12,
    tauxPaiement,
    montantEnRetard,
    statutGlobal,
    prochaineAction,
  };

  return { months, cockpit };
}
