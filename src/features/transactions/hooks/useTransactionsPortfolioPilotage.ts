'use client';

import { useState, useEffect } from 'react';
import { getTransactionRepositoryOffline } from '@/lib/offline/repositories/TransactionRepositoryOffline';
import { getPropertyRepositoryOffline } from '@/lib/offline/repositories/PropertyRepositoryOffline';

export interface TransactionPilotagePreviewRow {
  id: string;
  label: string;
  amount: number;
  date: string;
  /** Ex. « G8 – 14 rue de Grasse, 06000 Nice » */
  propertyLine: string;
  /** Mois comptable ou couverture multi-mois, si disponible */
  periodLabel: string | null;
}

export interface TransactionsPortfolioPilotageStats {
  nonRapprochees: number;
  sansDocument: number;
  loading: boolean;
  /** Jusqu’à 5 transactions non rapprochées (tri date décroissante) pour le bandeau « Actions à traiter ». */
  previewNonRapprochees: TransactionPilotagePreviewRow[];
}

function inAccountingPeriod(
  t: { date?: string; accounting_month?: string; accountingMonth?: string },
  periodStart: string,
  periodEnd: string
): boolean {
  const accountingMonth = t.accounting_month || t.accountingMonth;
  if (accountingMonth) {
    return accountingMonth >= periodStart && accountingMonth <= periodEnd;
  }
  if (t.date) {
    const d = new Date(t.date);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return month >= periodStart && month <= periodEnd;
  }
  return false;
}

function txDateYmd(t: { date?: string | Date }): string {
  if (!t.date) return '';
  if (typeof t.date === 'string') return t.date.slice(0, 10);
  return (t.date as Date).toISOString().slice(0, 10);
}

function buildPropertyLine(
  p: { name?: string; address?: string; postalCode?: string; city?: string } | null | undefined,
  fallback: string
): string {
  if (!p) return fallback;
  const name = (p.name || '').trim() || fallback;
  const addr = (p.address || '').trim();
  const cityLine = [p.postalCode, p.city].filter(Boolean).join(' ').trim();
  if (addr && cityLine) return `${name} – ${addr}, ${cityLine}`;
  if (addr) return `${name} – ${addr}`;
  if (cityLine) return `${name} – ${cityLine}`;
  return name;
}

function periodLabelFromTransaction(t: {
  accounting_month?: string;
  accountingMonth?: string;
  monthsCovered?: number;
}): string | null {
  const raw = t.accounting_month || t.accountingMonth;
  if (raw && typeof raw === 'string' && /^\d{4}-\d{2}$/.test(raw)) {
    const [y, m] = raw.split('-');
    const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
    const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }
  const mc = t.monthsCovered;
  if (typeof mc === 'number' && mc > 1) return `${mc} mois couverts`;
  return null;
}

export function useTransactionsPortfolioPilotage(options: {
  enabled: boolean;
  organizationId: string | undefined;
  periodStart: string;
  periodEnd: string;
  /** Si défini, même périmètre que useTransactionsKpis (cartes KPI) pour ce bien */
  propertyId?: string;
}): TransactionsPortfolioPilotageStats {
  const { enabled, organizationId, periodStart, periodEnd, propertyId } = options;
  const [stats, setStats] = useState<TransactionsPortfolioPilotageStats>({
    nonRapprochees: 0,
    sansDocument: 0,
    loading: true,
    previewNonRapprochees: [],
  });

  useEffect(() => {
    if (!enabled || !organizationId) {
      setStats({
        nonRapprochees: 0,
        sansDocument: 0,
        loading: false,
        previewNonRapprochees: [],
      });
      return;
    }

    let cancelled = false;

    const run = async () => {
      setStats((s) => ({ ...s, loading: true }));
      try {
        const transRepo = getTransactionRepositoryOffline();
        const txs = await transRepo.getAll(organizationId, {
          ...(propertyId && { propertyId }),
          ...(periodStart && { dateFrom: `${periodStart}-01` }),
          ...(periodEnd && { dateTo: `${periodEnd}-31` }),
        });

        const filtered =
          periodStart && periodEnd
            ? txs.filter((t) => inAccountingPeriod(t as any, periodStart, periodEnd))
            : txs;

        const ids = filtered.map((t) => t.id);
        const { getDocumentCountsForTransactions } = await import(
          '@/lib/offline/services/documentLinksService'
        );
        const counts = await getDocumentCountsForTransactions(ids, organizationId);

        let nonRapprochees = 0;
        let sansDocument = 0;
        const nonRapproList: typeof filtered = [];
        for (const t of filtered) {
          if (t.rapprochementStatus === 'non_rapprochee') {
            nonRapprochees++;
            nonRapproList.push(t);
          }
          if ((counts.get(t.id) ?? 0) === 0) {
            sansDocument++;
          }
        }

        nonRapproList.sort((a, b) => txDateYmd(b).localeCompare(txDateYmd(a)));
        const top5 = nonRapproList.slice(0, 5);
        const propRepo = getPropertyRepositoryOffline();
        const propertyById = new Map<string, Awaited<ReturnType<typeof propRepo.getById>>>();
        for (const t of top5) {
          const pid = t.propertyId;
          if (!pid || propertyById.has(pid)) continue;
          try {
            const p = await propRepo.getById(pid, organizationId);
            propertyById.set(pid, p ?? null);
          } catch {
            propertyById.set(pid, null);
          }
        }

        const previewNonRapprochees: TransactionPilotagePreviewRow[] = top5.map((t) => {
          const pid = t.propertyId;
          const prop = pid ? propertyById.get(pid) : null;
          const propertyLine = pid
            ? buildPropertyLine(prop ?? undefined, 'Bien')
            : 'Sans bien';

          return {
            id: t.id,
            label: (t.label || 'Transaction').trim() || 'Transaction',
            amount: Number(t.amount || 0),
            date: txDateYmd(t),
            propertyLine,
            periodLabel: periodLabelFromTransaction(t as any),
          };
        });

        if (!cancelled) {
          setStats({ nonRapprochees, sansDocument, loading: false, previewNonRapprochees });
        }
      } catch {
        if (!cancelled) {
          setStats({
            nonRapprochees: 0,
            sansDocument: 0,
            loading: false,
            previewNonRapprochees: [],
          });
        }
      }
    };

    void run();

    const onRefresh = () => {
      void run();
    };

    window.addEventListener('transactions:refresh', onRefresh);
    window.addEventListener('sync:refresh', onRefresh);
    window.addEventListener('documents:refresh', onRefresh);

    return () => {
      cancelled = true;
      window.removeEventListener('transactions:refresh', onRefresh);
      window.removeEventListener('sync:refresh', onRefresh);
      window.removeEventListener('documents:refresh', onRefresh);
    };
  }, [enabled, organizationId, periodStart, periodEnd, propertyId]);

  return stats;
}
