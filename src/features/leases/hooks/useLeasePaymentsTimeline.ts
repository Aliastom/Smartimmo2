'use client';

import { useState, useEffect, useCallback } from 'react';
import { getEcheanceRepositoryOffline } from '@/lib/offline/repositories/EcheanceRepositoryOffline';
import { getTransactionRepositoryOffline } from '@/lib/offline/repositories/TransactionRepositoryOffline';
import { expandEcheances, type EcheanceRecurrenteInput } from '@/lib/echeances/expandEcheances';
import { normalizeLeaseContractStatus } from '../utils/leaseWorkflowStatus';

export type MonthPaymentStatus = 'payé' | 'surpayé' | 'partiel' | 'en_attente' | 'en_retard' | 'à_venir';

export interface LeasePaymentsTimelineMonth {
  yearMonth: string;
  label: string;
  expected: number;
  realized: number;
  gap: number;
  status: MonthPaymentStatus;
  dueDate?: string;
  transactionIds: string[];
  echeanceIds: string[];
  lastTxDate?: string;
}

export interface LeasePaymentsTimelineResult {
  months: LeasePaymentsTimelineMonth[];
  loading: boolean;
  nextDue: {
    month: LeasePaymentsTimelineMonth;
    status: 'à_piloter' | 'payée' | 'surpayée' | 'partiel' | 'en_retard';
  } | null;
  /** KPIs pour le cockpit */
  cockpit: {
    loyerMensuel: number;
    totalAttendu12Mois: number;
    totalEncaisse12Mois: number;
    tauxPaiement: number | null;
    montantEnRetard: number;
    statutGlobal: 'ok' | 'partiel' | 'retard';
    prochaineAction: string;
  };
  lastPayment: {
    month: LeasePaymentsTimelineMonth;
    date: string;
    amount: number;
  } | null;
  alerts: Array<{
    type: string;
    message: string;
    actionHref?: string;
  }>;
}

const RENT_ECHEANCE_TYPES = new Set(['LOYER_ATTENDU', 'RECETTE_LOYER']);
const RENT_NATURES = new Set(['RECETTE_LOYER', 'LOYER']);
const TOLERANCE = 0.01;
/** Tolérance métier : reste < 5€ considéré comme payé */
const PARTIAL_TOLERANCE = 5;
const MONTHS_PAST = 12;
const MONTHS_FUTURE = 12;

/** Détermine le mois couvert par une transaction (YYYY-MM). Priorité: accounting_month > year+month > date */
function getTransactionCoveredMonth(tx: { date: string; accounting_month?: string | null; accountingMonth?: string | null; year?: number | null; month?: number | null }): string {
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

export function useLeasePaymentsTimeline(
  leaseId: string | null,
  propertyId: string | null,
  organizationId: string | null,
  paymentDay: number = 5,
  fallbackRentAmount?: number,
  fallbackCharges?: number,
  leaseStartDate?: string | null,
  leaseStatus?: string | null
): LeasePaymentsTimelineResult {
  const [months, setMonths] = useState<LeasePaymentsTimelineMonth[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!leaseId || !organizationId) {
      setMonths([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const echRepo = getEcheanceRepositoryOffline();
      const txRepo = getTransactionRepositoryOffline();

      const [echeances, transactions] = await Promise.all([
        echRepo.getAll(organizationId, { leaseId, isActive: true }),
        txRepo.getAll(organizationId, { leaseId }),
      ]);

      const rentEcheances = echeances.filter(
        (e) => RENT_ECHEANCE_TYPES.has(e.type) || e.natureCode === 'RECETTE_LOYER'
      );

      const echeanceInputs: EcheanceRecurrenteInput[] = rentEcheances.map((e) => ({
        id: e.id,
        propertyId: e.propertyId ?? null,
        leaseId: e.leaseId ?? null,
        label: e.label,
        type: e.type as any,
        periodicite: e.periodicite as any,
        montant: e.montant,
        recuperable: e.recuperable,
        sens: e.sens as any,
        startAt: e.startAt,
        endAt: e.endAt ?? null,
        isActive: e.isActive,
      }));

      const range = buildMonthRange();
      const leaseStartYm = leaseStartDate ? leaseStartDate.slice(0, 7) : null;
      const filteredRange = leaseStartYm ? range.filter((ym) => ym >= leaseStartYm) : range;
      const fromStr = range[0];
      const toStr = range[range.length - 1];

      const occurrences = rentEcheances.length > 0
        ? expandEcheances(echeanceInputs, fromStr, toStr)
        : [];

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

      const fallbackTotal = (fallbackRentAmount ?? 0) + (fallbackCharges ?? 0);
      if (fallbackTotal > 0 && occurrences.length === 0) {
        filteredRange.forEach((yearMonth) => {
          const [y, m] = yearMonth.split('-').map(Number);
          const dueDate = `${y}-${String(m).padStart(2, '0')}-${String(Math.min(paymentDay, 28)).padStart(2, '0')}`;
          expectedByMonth.set(yearMonth, { sum: fallbackTotal, dueDate, echeanceIds: [] });
        });
      }

      const now = new Date();
      const currentYm = getMonthKey(now);
      const isActiveContract = normalizeLeaseContractStatus(leaseStatus) === 'ACTIF';

      const result: LeasePaymentsTimelineMonth[] = filteredRange.map((yearMonth) => {
        const exp = expectedByMonth.get(yearMonth);
        const real = realizedByMonth.get(yearMonth);
        const expected = exp?.sum ?? 0;
        const realized = real?.sum ?? 0;
        const gap = realized - expected;
        const info = exp ?? { dueDate: `${yearMonth}-${String(paymentDay).padStart(2, '0')}`, echeanceIds: [] };
        const txIds = real?.txIds ?? [];
        const lastDate = real?.lastDate ?? '';

        let status: MonthPaymentStatus;
        if (!isActiveContract) {
          // Bail non actif: pas de retard métier dans la timeline.
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

      setMonths(result);
    } catch (err) {
      console.error('[useLeasePaymentsTimeline]', err);
      setMonths([]);
    } finally {
      setLoading(false);
    }
  }, [leaseId, organizationId, paymentDay, fallbackRentAmount, fallbackCharges, leaseStartDate, leaseStatus]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ✅ Rafraîchir quand une transaction est créée/modifiée (ex: "Payer le reste")
  useEffect(() => {
    const handleRefresh = (event: Event) => {
      if (!(event instanceof CustomEvent) || !event.detail || !leaseId) return;
      const d = event.detail as { scope?: string; propertyId?: string; leaseId?: string };
      const shouldRefetch =
        d.leaseId === leaseId ||
        d.scope === 'global' ||
        (d.scope === 'property' && propertyId && d.propertyId === propertyId);
      if (shouldRefetch) fetchData();
    };
    window.addEventListener('transactions:refresh', handleRefresh);
    window.addEventListener('leases:refresh', handleRefresh);
    return () => {
      window.removeEventListener('transactions:refresh', handleRefresh);
      window.removeEventListener('leases:refresh', handleRefresh);
    };
  }, [leaseId, propertyId, fetchData]);

  const nextDue = (() => {
    const future = months.filter((m) => m.status === 'en_attente' || m.status === 'à_venir');
    const firstPending = months.find((m) =>
      m.status === 'en_attente' || m.status === 'en_retard' || m.status === 'partiel' || m.status === 'surpayé'
    );
    const m = firstPending ?? future[0];
    if (!m || m.expected <= 0) return null;
    let status: 'à_piloter' | 'payée' | 'surpayée' | 'partiel' | 'en_retard' = 'à_piloter';
    if (m.status === 'payé') status = 'payée';
    else if (m.status === 'surpayé') status = 'surpayée';
    else if (m.status === 'partiel') status = 'partiel';
    else if (m.status === 'en_retard') status = 'en_retard';
    return { month: m, status };
  })();

  const lastPayment = (() => {
    const paid = months.filter((m) => (m.status === 'payé' || m.status === 'surpayé') && m.realized > 0).reverse();
    const m = paid[0];
    if (!m) return null;
    return {
      month: m,
      date: m.lastTxDate ?? m.yearMonth + '-01',
      amount: m.realized,
    };
  })();

  const alerts: Array<{ type: string; message: string; daysOverdue?: number }> = [];
  const enRetard = months.find((m) => m.status === 'en_retard' && m.expected > 0 && m.realized === 0);
  if (enRetard && enRetard.dueDate) {
    const due = new Date(enRetard.dueDate);
    const now = new Date();
    const daysOverdue = Math.floor((now.getTime() - due.getTime()) / (24 * 60 * 60 * 1000));
    alerts.push({
      type: 'retard',
      message: daysOverdue > 0 ? `Paiement en retard depuis ${daysOverdue} jour${daysOverdue > 1 ? 's' : ''}` : `Loyer ${enRetard.label} en retard`,
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

  const currentYm = getMonthKey(new Date());
  const last12Months = months.filter((m) => m.yearMonth <= currentYm && m.expected > 0);
  const totalAttendu12 = last12Months.reduce((s, m) => s + m.expected, 0);
  const totalEncaisse12 = last12Months.reduce((s, m) => s + m.realized, 0);
  const montantEnRetard = months
    .filter((m) => (m.status === 'en_retard' || m.status === 'partiel') && m.yearMonth <= currentYm)
    .reduce((s, m) => s + Math.max(0, m.expected - m.realized), 0);
  const tauxPaiement =
    totalAttendu12 > 0 ? Math.round((totalEncaisse12 / totalAttendu12) * 100) : null;

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

  const loyerMensuel = (fallbackRentAmount ?? 0) + (fallbackCharges ?? 0) || (months.find((m) => m.expected > 0)?.expected ?? 0);

  const cockpit = {
    loyerMensuel,
    totalAttendu12Mois: totalAttendu12,
    totalEncaisse12Mois: totalEncaisse12,
    tauxPaiement,
    montantEnRetard,
    statutGlobal,
    prochaineAction,
  };

  return {
    months,
    loading,
    nextDue,
    lastPayment,
    alerts,
    cockpit,
  };
}
