'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { CheckCircle, Clock, AlertCircle, Calendar, ChevronDown, ChevronUp, Bug, AlertTriangle, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useLeasePaymentsTimeline, type LeasePaymentsTimelineMonth, type MonthPaymentStatus } from '../hooks/useLeasePaymentsTimeline';
import { getTransactionRepositoryOffline } from '@/lib/offline/repositories/TransactionRepositoryOffline';
import { normalizeLeaseContractStatus } from '../utils/leaseWorkflowStatus';

/** Natures utilisées pour le calcul du statut "payé" d'un mois (encaissements loyer uniquement) */
const RENT_NATURES_FOR_STATUS = new Set(['RECETTE_LOYER', 'LOYER']);

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);

const STATUS_CONFIG: Record<
  MonthPaymentStatus,
  { variant: 'success' | 'warning' | 'danger' | 'secondary' | 'default'; label: string; icon: React.ElementType }
> = {
  payé: { variant: 'success', label: 'Payé', icon: CheckCircle },
  surpayé: { variant: 'secondary', label: 'Surpayé', icon: TrendingUp },
  partiel: { variant: 'warning', label: 'Partiel', icon: AlertTriangle },
  en_attente: { variant: 'warning', label: 'En attente', icon: Clock },
  en_retard: { variant: 'danger', label: 'En retard', icon: AlertCircle },
  'à_venir': { variant: 'secondary', label: 'À venir', icon: Calendar },
};

function StatusBadge({
  status,
  resteAPayer,
  surplus,
}: {
  status: MonthPaymentStatus;
  resteAPayer?: number;
  surplus?: number;
}) {
  const c = STATUS_CONFIG[status];
  const Icon = c.icon;
  let label = c.label;
  if (status === 'partiel' && resteAPayer != null && resteAPayer > 0) {
    label = `Partiel (${formatCurrency(-resteAPayer)})`;
  } else if (status === 'surpayé' && surplus != null && surplus > 0) {
    label = `Surpayé (+${formatCurrency(surplus)})`;
  }
  return (
    <Badge
      variant={c.variant}
      className={`inline-flex items-center gap-1 ${status === 'surpayé' ? 'bg-blue-100 text-blue-800 border-blue-200' : ''}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Badge>
  );
}

interface LeaseDetailPaymentsSectionProps {
  leaseId: string;
  propertyId: string;
  organizationId: string;
  leaseStatus: string;
  leaseStartDate: string;
  tenantName?: string;
  paymentDay?: number;
  rentAmount: number;
  chargesRecup?: number;
  onEnregistrer?: (month: LeasePaymentsTimelineMonth) => void;
  onVoir?: (month: LeasePaymentsTimelineMonth) => void;
}

export function LeaseDetailPaymentsSection({
  leaseId,
  propertyId,
  organizationId,
  leaseStatus,
  leaseStartDate,
  tenantName,
  paymentDay = 5,
  rentAmount,
  chargesRecup = 0,
  onEnregistrer,
  onVoir,
}: LeaseDetailPaymentsSectionProps) {
  const [showDiagnostic, setShowDiagnostic] = useState(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('diagnostic') === '1';
  });
  useEffect(() => {
    const check = () => {
      if (typeof window === 'undefined') return;
      const v = new URLSearchParams(window.location.search).get('diagnostic') === '1';
      setShowDiagnostic((prev) => (prev !== v ? v : prev));
    };
    const interval = setInterval(check, 300);
    return () => clearInterval(interval);
  }, []);

  const [idbDiagnostic, setIdbDiagnostic] = useState<{
    txCount: number;
    txForStatus: Array<{ id: string; amount: number; accounting_month?: string | null; date: string; nature?: string | null }>;
    txOther: Array<{ id: string; amount: number; accounting_month?: string | null; date: string; nature?: string | null }>;
    sept2025ForStatus: Array<{ id: string; amount: number; accounting_month?: string | null; date: string; nature?: string | null }>;
    sept2025Other: Array<{ id: string; amount: number; accounting_month?: string | null; date: string; nature?: string | null }>;
    totalSeptForStatus: number;
    totalSeptOther: number;
    error?: string;
  } | null>(null);

  const runIdbDiagnostic = useCallback(async () => {
    try {
      const repo = getTransactionRepositoryOffline();
      const all = await repo.getAll(organizationId, { leaseId });
      const txForStatus = all.filter((t) => RENT_NATURES_FOR_STATUS.has((t as any).nature ?? (t as any).natureCode ?? ''));
      const txOther = all.filter((t) => !RENT_NATURES_FOR_STATUS.has((t as any).nature ?? (t as any).natureCode ?? ''));
      const toYm = (t: any) => {
        const acc = t.accounting_month ?? t.accountingMonth;
        if (acc && /^\d{4}-\d{2}$/.test(String(acc))) return String(acc);
        const d = new Date(t.date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      };
      const sept2025ForStatus = txForStatus.filter((t) => toYm(t) === '2025-09');
      const sept2025Other = txOther.filter((t) => toYm(t) === '2025-09');
      const totalSeptForStatus = sept2025ForStatus.reduce((s, t) => s + t.amount, 0);
      const totalSeptOther = sept2025Other.reduce((s, t) => s + t.amount, 0);
      const mapTx = (t: any) => ({
        id: t.id,
        amount: t.amount,
        accounting_month: t.accounting_month ?? t.accountingMonth,
        date: t.date,
        nature: t.nature ?? t.natureCode,
      });
      setIdbDiagnostic({
        txCount: all.length,
        txForStatus: txForStatus.map(mapTx),
        txOther: txOther.map(mapTx),
        sept2025ForStatus: sept2025ForStatus.map(mapTx),
        sept2025Other: sept2025Other.map(mapTx),
        totalSeptForStatus,
        totalSeptOther,
      });
    } catch (e) {
      setIdbDiagnostic({
        txCount: 0,
        txForStatus: [],
        txOther: [],
        sept2025ForStatus: [],
        sept2025Other: [],
        totalSeptForStatus: 0,
        totalSeptOther: 0,
        error: (e as Error).message,
      });
    }
  }, [organizationId, leaseId]);

  useEffect(() => {
    if (showDiagnostic && organizationId && leaseId) {
      runIdbDiagnostic();
    } else {
      setIdbDiagnostic(null);
    }
  }, [showDiagnostic, organizationId, leaseId, runIdbDiagnostic]);

  useEffect(() => {
    if (showDiagnostic && typeof window !== 'undefined') {
      (window as any).__checkLeaseIdb = (lid: string) => {
        if (lid === leaseId) runIdbDiagnostic();
        else console.warn('leaseId différent. Utilisez', leaseId);
      };
      return () => {
        delete (window as any).__checkLeaseIdb;
      };
    }
  }, [showDiagnostic, leaseId, runIdbDiagnostic]);

  const { months, loading } = useLeasePaymentsTimeline(
    leaseId,
    propertyId,
    organizationId,
    paymentDay,
    rentAmount,
    chargesRecup,
    leaseStartDate,
    leaseStatus
  );
  const contractStatus = normalizeLeaseContractStatus(leaseStatus);
  const leaseStart = new Date(leaseStartDate);
  const now = new Date();
  const hasNotStarted = leaseStart > now;
  const isNonActive = contractStatus !== 'ACTIF';

  const [showAllMonths, setShowAllMonths] = useState(false);
  const [visibleCount, setVisibleCount] = useState(6);
  const [filterStatut, setFilterStatut] = useState<'all' | 'payé' | 'partiel' | 'en_retard'>('all');
  const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const DEFAULT_VISIBLE = 6;
  const INCREMENT = 6;

  const allMonths = useMemo(() => {
    if (months.length > 0) return months;
    const fallback: LeasePaymentsTimelineMonth[] = [];
    const total = rentAmount + chargesRecup;
    for (let i = -6; i <= 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const [y, m] = ym.split('-').map(Number);
      const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      const isPast = ym < currentYm;
      const isCurrent = ym === currentYm;
      const status: MonthPaymentStatus = isPast ? 'en_retard' : isCurrent ? 'en_attente' : 'à_venir';
      fallback.push({
        yearMonth: ym,
        label,
        expected: total,
        realized: 0,
        gap: -total,
        status,
        dueDate: `${y}-${String(m).padStart(2, '0')}-${String(Math.min(paymentDay, 28)).padStart(2, '0')}`,
        transactionIds: [],
        echeanceIds: [],
      });
    }
    return fallback;
  }, [months, rentAmount, chargesRecup, paymentDay, currentYm]);

  const filteredMonths = useMemo(() => {
    if (filterStatut === 'all') return allMonths;
    return allMonths.filter((m) => m.status === filterStatut);
  }, [allMonths, filterStatut]);

  const sortedByRelevance = useMemo(() => {
    const past = filteredMonths.filter((m) => m.yearMonth < currentYm).reverse();
    const currentAndFuture = filteredMonths.filter((m) => m.yearMonth >= currentYm);
    return [...past, ...currentAndFuture];
  }, [filteredMonths, currentYm]);

  const monthsToShow = useMemo(() => {
    if (showAllMonths) return sortedByRelevance;
    return sortedByRelevance.slice(0, visibleCount);
  }, [sortedByRelevance, showAllMonths, visibleCount]);

  const hasMore = !showAllMonths && visibleCount < sortedByRelevance.length;
  const totalFiltered = sortedByRelevance.length;

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Paiements</h3>
        <div className="flex items-center justify-center py-16 text-gray-500">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-orange-500 border-t-transparent" />
        </div>
      </div>
    );
  }

  if (isNonActive || hasNotStarted) {
    return (
      <div className="rounded-2xl border border-gray-200 overflow-hidden">
        <h3 className="text-lg font-semibold text-gray-900 p-6 border-b border-gray-100">Paiements</h3>
        <div className="p-6">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
            Le bail n&apos;a pas encore commencé.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <div className="p-6 pb-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4">
        <h3 className="text-lg font-semibold text-gray-900">Paiements</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Filtrer :</span>
          {(['all', 'payé', 'partiel', 'en_retard'] as const).map((f) => (
            <Button
              key={f}
              variant={filterStatut === f ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilterStatut(f)}
              className={filterStatut === f ? '' : 'text-gray-500'}
            >
              {f === 'all' ? 'Tous' : f === 'payé' ? 'Payé' : f === 'partiel' ? 'Partiel' : 'En retard'}
            </Button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left py-4 px-6 font-medium text-gray-500">Mois</th>
              <th className="text-right py-4 px-6 font-medium text-gray-500">Encaissé</th>
              <th className="text-right py-4 px-6 font-medium text-gray-500">Reste à payer</th>
              <th className="text-center py-4 px-6 font-medium text-gray-500">Statut</th>
              <th className="text-right py-4 px-6 font-medium text-gray-500">Action</th>
            </tr>
          </thead>
          <tbody>
            {monthsToShow.map((month) => {
              const resteAPayer = Math.max(0, month.expected - month.realized);
              const surplus = Math.max(0, month.realized - month.expected);
              const pct = month.expected > 0 ? Math.min(100, Math.round((month.realized / month.expected) * 100)) : 0;
              const rowBg =
                month.status === 'partiel'
                  ? 'bg-amber-50/50'
                  : month.status === 'en_retard'
                  ? 'bg-red-50/50'
                  : '';
              return (
                <tr
                  key={month.yearMonth}
                  className={`border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors ${rowBg}`}
                >
                  <td className="py-4 px-6 font-medium text-gray-900">{month.label}</td>
                  <td className="py-4 px-6 text-right text-gray-700">
                    {month.realized > 0 ? formatCurrency(month.realized) : '—'}
                  </td>
                  <td className="py-4 px-6 text-right text-gray-700">
                    {resteAPayer > 0 ? formatCurrency(resteAPayer) : surplus > 0 ? '—' : '—'}
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex flex-col items-center gap-1">
                      <StatusBadge
                        status={month.status}
                        resteAPayer={month.expected - month.realized}
                        surplus={month.realized - month.expected}
                      />
                      {month.expected > 0 && month.status !== 'à_venir' && (
                        <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              pct >= 100 ? 'bg-green-500' : pct > 0 ? 'bg-amber-500' : 'bg-red-400'
                            }`}
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-6 text-right">
                    {(month.status === 'payé' || month.status === 'surpayé') && month.transactionIds.length > 0 && onVoir && (
                      <Button variant="ghost" size="sm" onClick={() => onVoir(month)}>
                        Voir
                      </Button>
                    )}
                    {(month.status === 'en_attente' || month.status === 'en_retard' || month.status === 'partiel') && onEnregistrer && (
                      month.status === 'partiel' && resteAPayer > 0 ? (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => onEnregistrer({ ...month, expected: resteAPayer })}
                        >
                          Payer le reste
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => onEnregistrer(month)}>
                          Enregistrer
                        </Button>
                      )
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {showDiagnostic && (
        <div className="border-t border-amber-200 bg-amber-50 p-4 text-sm space-y-3">
          <h4 className="font-semibold text-amber-900 flex items-center gap-2">
            <Bug className="h-4 w-4" />
            Diagnostic IndexedDB
          </h4>
          <p className="text-amber-800 text-xs">
            Bail affiché : <strong>{tenantName ?? '—'}</strong> | leaseId: <code className="bg-amber-100 px-1 rounded">{leaseId}</code>
          </p>
          {!idbDiagnostic ? (
            <p className="text-amber-700">Chargement… (org: {organizationId ? 'ok' : 'manquant'})</p>
          ) : idbDiagnostic.error ? (
            <p className="text-red-600">{idbDiagnostic.error}</p>
          ) : (
            <>
              <p>Transactions pour ce bail en IDB : <strong>{idbDiagnostic.txCount}</strong></p>
              <div className="space-y-2 text-amber-800">
                <div>
                  <p className="font-medium">Utilisées pour le statut du mois (RECETTE_LOYER, LOYER uniquement) :</p>
                  <p><strong>{idbDiagnostic.txForStatus.length}</strong> tx | Sept 2025 : <strong>{idbDiagnostic.sept2025ForStatus.length}</strong> tx, total <strong>{idbDiagnostic.totalSeptForStatus.toFixed(2)}€</strong></p>
                  {idbDiagnostic.sept2025ForStatus.length > 0 && (
                    <ul className="mt-1 text-xs">
                      {idbDiagnostic.sept2025ForStatus.map((t) => (
                        <li key={t.id}>• {t.amount}€ | acc: {t.accounting_month ?? '—'} | date: {t.date.slice(0, 10)} | nature: {t.nature ?? '—'}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <p className="font-medium">Autres transactions du bail (hors loyer) :</p>
                  <p><strong>{idbDiagnostic.txOther.length}</strong> tx | Sept 2025 : <strong>{idbDiagnostic.sept2025Other.length}</strong> tx, total <strong>{idbDiagnostic.totalSeptOther.toFixed(2)}€</strong></p>
                  {idbDiagnostic.sept2025Other.length > 0 && (
                    <ul className="mt-1 text-xs">
                      {idbDiagnostic.sept2025Other.map((t) => (
                        <li key={t.id}>• {t.amount}€ | acc: {t.accounting_month ?? '—'} | date: {t.date.slice(0, 10)} | nature: {t.nature ?? '—'}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <p className="text-amber-600 text-xs">useLeasePaymentsTimeline filtre par leaseId et ne compte que RECETTE_LOYER/LOYER pour le statut.</p>
              <Button variant="ghost" size="sm" onClick={runIdbDiagnostic} className="mt-2 text-amber-700">
                Rafraîchir
              </Button>
            </>
          )}
        </div>
      )}

      {hasMore && (
        <div className="border-t border-gray-100 p-4 flex flex-wrap justify-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setVisibleCount((v) => v + INCREMENT)}
            className="text-orange-600 hover:text-orange-700"
          >
            <ChevronDown className="h-4 w-4 mr-1 inline" />
            Voir +{INCREMENT} mois
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAllMonths(true)}
            className="text-orange-600 hover:text-orange-700"
          >
            Tout afficher ({totalFiltered} mois)
          </Button>
        </div>
      )}
      {showAllMonths && totalFiltered > DEFAULT_VISIBLE && (
        <div className="border-t border-gray-100 p-4 text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setShowAllMonths(false); setVisibleCount(DEFAULT_VISIBLE); }}
            className="text-gray-600 hover:text-gray-700"
          >
            <ChevronUp className="h-4 w-4 mr-1 inline" />
            Réduire
          </Button>
        </div>
      )}
    </div>
  );
}
