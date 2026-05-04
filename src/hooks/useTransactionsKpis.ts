/**
 * Hook unifié pour calculer les KPIs des transactions
 * Fonctionne en mode "normal" (API) et "app-shell" (calcul local depuis IndexedDB)
 */

'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getLocalDB } from '@/lib/offline/db';
import { useAppShellContextOptional } from '@/contexts/AppShellContextResolver';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import type { LocalTransaction, CachedNature } from '@/lib/offline/db';
import {
  computeTransactionKpiTotals,
  debugTransactionAggregation,
  filterTransactionsForScope,
  getEffectiveAccountingMonth,
  isTransactionAggregationDebugEnabled,
  resolveTransactionKind,
  type NatureFlowMap,
  type TransactionLike,
} from '@/features/transactions/lib/transactionAggregation';

export interface TransactionKpis {
  recettesTotales: number;
  depensesTotales: number;
  soldeNet: number;
  nonRapprochees: number;
  /** Cashflow mensuel moyen = total des soldes mensuels / nombre de mois avec transactions */
  cashflowMensuelMoyen?: number;
  /** Nombre de mois utilisés pour le calcul (pour afficher "calculé sur X mois") */
  cashflowMoisCount?: number;
}

export interface UseTransactionsKpisOptions {
  periodStart?: string; // Format: 'YYYY-MM'
  periodEnd?: string; // Format: 'YYYY-MM'
  refreshKey?: number;
  propertyId?: string;
  mode: 'normal' | 'app-shell';
  transactions?: LocalTransaction[]; // Pour mode app-shell avec props
}

export function useTransactionsKpis(options: UseTransactionsKpisOptions) {
  const { periodStart, periodEnd, refreshKey = 0, propertyId, mode, transactions: propTransactions } = options;
  
  // Utiliser AppShellContextResolver en mode app-shell, useCurrentOrganization en mode normal ou comme fallback
  const appShellContext = useAppShellContextOptional();
  const normalOrg = useCurrentOrganization();
  
  // En mode app-shell, utiliser le contexte si disponible et prêt, sinon fallback sur normalOrg
  // En mode normal, utiliser normalOrg
  const organizationId = mode === 'app-shell' && appShellContext?.status === 'ready'
    ? appShellContext.organizationId
    : normalOrg?.organizationId;
  
  const [kpis, setKpis] = useState<TransactionKpis>({
    recettesTotales: 0,
    depensesTotales: 0,
    soldeNet: 0,
    nonRapprochees: 0,
    cashflowMensuelMoyen: 0,
    cashflowMoisCount: 0,
  });
  const [isLoading, setIsLoading] = useState(mode === 'app-shell');
  const [error, setError] = useState<string | null>(null);

  // Mode normal : utiliser l'API
  // ⚠️ CRITIQUE: refreshKey retiré de la queryKey pour éviter les refetch lors des filtres/tri/cartes
  // refreshKey est uniquement utilisé pour forcer un recalcul après CRUD (géré via événements transactions:refresh)
  const { data: apiKpis, isLoading: apiLoading, error: apiError } = useQuery<TransactionKpis>({
    queryKey: ['transactions-kpis', periodStart, periodEnd, propertyId, organizationId],
    queryFn: async () => {
      if (!organizationId) throw new Error('OrganizationId requis');
      
      const params = new URLSearchParams();
      if (periodStart) params.append('periodStart', periodStart);
      if (periodEnd) params.append('periodEnd', periodEnd);
      if (propertyId) params.append('propertyId', propertyId);
      
      const response = await fetch(`/api/transactions/kpis?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Erreur lors du calcul des KPI');
      }
      return response.json();
    },
    enabled: mode === 'normal' && !!organizationId,
    staleTime: 30000, // 30 secondes
  });

  // Mode app-shell : calculer localement
  useEffect(() => {
    if (mode !== 'app-shell') {
      return;
    }

    // Si le contexte app-shell existe mais n'est pas encore prêt, attendre
    // MAIS si normalOrg a déjà un organizationId, on peut l'utiliser comme fallback
    if (appShellContext && appShellContext.status === 'resolving' && !normalOrg?.organizationId) {
      setIsLoading(true);
      return;
    }
    
    // Si le contexte est en erreur MAIS qu'on a un fallback, on continue quand même
    if (appShellContext?.status === 'error' && !normalOrg?.organizationId) {
      console.warn('[useTransactionsKpis] ❌ Contexte en erreur et pas de fallback:', appShellContext.error);
      setIsLoading(false);
      setError(appShellContext.error || 'Erreur de contexte');
      return;
    }

    // Vérifier que organizationId est disponible (depuis contexte ou fallback normalOrg)
    if (!organizationId) {
      console.warn('[useTransactionsKpis] ⚠️ organizationId non disponible:', {
        hasContext: !!appShellContext,
        contextStatus: appShellContext?.status,
        contextOrgId: appShellContext?.organizationId,
        normalOrgId: normalOrg?.organizationId,
        normalOrgLoading: normalOrg?.isLoading
      });
      // Si normalOrg est encore en cours de chargement, on attend
      if (normalOrg?.isLoading) {
        setIsLoading(true);
        return;
      }
      setIsLoading(false);
      setError('OrganizationId requis pour calculer les KPIs');
      return;
    }

    const orgId = organizationId;

    let cancelled = false;

    async function calculateKpis() {
      try {
        setIsLoading(true);
        setError(null);

        if (isTransactionAggregationDebugEnabled()) {
          console.log('[useTransactionsKpis] 🔄 Début calcul KPIs app-shell:', {
            orgId,
            propertyId,
            periodStart,
            periodEnd,
            hasPropTransactions: !!propTransactions?.length,
          });
        }

        const db = await getLocalDB();
        
        // Charger les transactions (depuis props ou IndexedDB)
        let transactions: LocalTransaction[] = [];
        
        if (propTransactions && propTransactions.length > 0) {
          transactions = propTransactions;
        } else {
          const transRepo = await import('@/lib/offline/repositories/TransactionRepositoryOffline').then(m => m.getTransactionRepositoryOffline());
          transactions = await transRepo.getAll(orgId, {
            ...(propertyId && { propertyId }),
          });
        }

        const naturesData = await db.NatureEntity.toArray();
        const natureMap = new Map<string, CachedNature>();
        naturesData.forEach((nature: CachedNature) => {
          natureMap.set(nature.key, nature);
        });
        const natureMapAgg = natureMap as unknown as NatureFlowMap;

        const rowsForKpi: TransactionLike[] = transactions.map((t) => ({
          id: t.id,
          amount: t.amount,
          nature: t.nature,
          accounting_month: (t as any).accounting_month,
          accountingMonth: (t as any).accountingMonth,
          date: t.date,
          propertyId: t.propertyId,
          rapprochementStatus: t.rapprochementStatus,
        }));

        const scope = {
          ...(periodStart && periodEnd ? { periodStart, periodEnd } : {}),
          ...(propertyId && { propertyId }),
        };

        const filteredForKpi = filterTransactionsForScope(rowsForKpi, scope, natureMapAgg);
        debugTransactionAggregation('useTransactionsKpis(app-shell)', filteredForKpi, natureMapAgg);

        const { recettesTotales, depensesTotales, soldeNet, nonRapprochees } = computeTransactionKpiTotals(
          filteredForKpi,
          natureMapAgg
        );

        const CASHFLOW_PERIOD_MONTHS = 12;
        const monthlyTotals: Record<string, number> = {};
        for (const t of filteredForKpi) {
          const month = getEffectiveAccountingMonth(t);
          if (!month) continue;
          const amount = Number(t.amount) || 0;
          const kind = resolveTransactionKind(t, natureMapAgg);
          const abs = Math.abs(amount);
          const signed = kind === 'expense' ? -abs : abs;
          monthlyTotals[month] = (monthlyTotals[month] ?? 0) + signed;
        }
        const now = new Date();
        const last12MonthKeys: string[] = [];
        for (let i = CASHFLOW_PERIOD_MONTHS - 1; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          last12MonthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        }
        const cashflowTotal = last12MonthKeys.reduce((sum, m) => sum + (monthlyTotals[m] ?? 0), 0);
        const cashflowMensuelMoyen = cashflowTotal / CASHFLOW_PERIOD_MONTHS;
        const cashflowMoisCount = CASHFLOW_PERIOD_MONTHS;

        if (isTransactionAggregationDebugEnabled()) {
          console.log('[useTransactionsKpis] ✅ KPIs calculés:', {
            recettesTotales,
            depensesTotales,
            soldeNet,
            nonRapprochees,
            cashflowMensuelMoyen,
            cashflowMoisCount,
            transactionsCountScoped: filteredForKpi.length,
            totalTransactionsLoaded: transactions.length,
          });
        }

        if (!cancelled) {
          setKpis({
            recettesTotales,
            depensesTotales,
            soldeNet,
            nonRapprochees,
            cashflowMensuelMoyen,
            cashflowMoisCount,
          });
          setIsLoading(false);
        }
      } catch (e: any) {
        if (!cancelled) {
          console.error('[useTransactionsKpis] ❌ Erreur calcul app-shell:', e);
          setError('Impossible de calculer les KPI.');
          setIsLoading(false);
        }
      }
    }

    calculateKpis();

    return () => {
      cancelled = true;
    };
  }, [mode, organizationId, periodStart, periodEnd, propertyId, propTransactions, appShellContext?.status, appShellContext?.organizationId, normalOrg?.organizationId, normalOrg?.isLoading]);
  // ⚠️ CRITIQUE: refreshKey retiré des dépendances pour éviter les rechargements complets lors des filtres/tri/cartes
  // refreshKey est uniquement utilisé pour forcer un recalcul après CRUD (géré via événements transactions:refresh)

  // Écouter les événements de refresh en mode app-shell
  // ⚠️ CRITIQUE: Recalculer les KPIs depuis IndexedDB lors des événements transactions:refresh
  // Ne pas utiliser refreshKey (qui déclencherait un remount complet)
  // ✅ FILTRE STRICT : Filtrer les events par propertyId si spécifié
  // ✅ Anti-loop : ignorer les refresh identiques trop rapprochés
  const lastRefreshRef = useRef<{ propertyId?: string; reason?: string; timestamp: number } | null>(null);
  
  useEffect(() => {
    if (mode !== 'app-shell' || !organizationId) return;

    let cancelled = false;

    const handleRefresh = async (event?: Event) => {
      // Filtre ciblé bien : ignorer seulement un scope 'property' explicitement incompatible.
      // (Les events sans `scope` ne doivent pas bloquer le recalcul — ex. refresh legacy / patch.)
      if (event instanceof CustomEvent && event.detail) {
        const detail = event.detail as { scope?: string; propertyId?: string; reason?: string };

        if (propertyId && detail.scope === 'property' && detail.propertyId && detail.propertyId !== propertyId) {
          return;
        }

        const now = Date.now();
        const lastRefresh = lastRefreshRef.current;
        if (
          lastRefresh &&
          detail.propertyId &&
          lastRefresh.propertyId === detail.propertyId &&
          lastRefresh.reason === detail.reason &&
          now - lastRefresh.timestamp < 120
        ) {
          return;
        }

        if (detail.propertyId) {
          lastRefreshRef.current = {
            propertyId: detail.propertyId,
            reason: detail.reason,
            timestamp: now,
          };
        }
      }
      
      try {
        const db = await getLocalDB();
        const transRepo = await import('@/lib/offline/repositories/TransactionRepositoryOffline').then(m => m.getTransactionRepositoryOffline());

        let transactions: LocalTransaction[] = [];
        if (propTransactions && propTransactions.length > 0) {
          transactions = propTransactions;
        } else {
          transactions = await transRepo.getAll(organizationId, {
            ...(propertyId && { propertyId }),
          });
        }

        const naturesData = await db.NatureEntity.toArray();
        const natureMap = new Map<string, CachedNature>();
        naturesData.forEach((nature: CachedNature) => {
          natureMap.set(nature.key, nature);
        });
        const natureMapAgg = natureMap as unknown as NatureFlowMap;

        const rowsForKpi: TransactionLike[] = transactions.map((t) => ({
          id: t.id,
          amount: t.amount,
          nature: t.nature,
          accounting_month: (t as any).accounting_month,
          accountingMonth: (t as any).accountingMonth,
          date: t.date,
          propertyId: t.propertyId,
          rapprochementStatus: t.rapprochementStatus,
        }));

        const scope = {
          ...(periodStart && periodEnd ? { periodStart, periodEnd } : {}),
          ...(propertyId && { propertyId }),
        };

        const filteredForKpi = filterTransactionsForScope(rowsForKpi, scope, natureMapAgg);
        debugTransactionAggregation('useTransactionsKpis(refresh)', filteredForKpi, natureMapAgg);

        const { recettesTotales, depensesTotales, soldeNet, nonRapprochees } = computeTransactionKpiTotals(
          filteredForKpi,
          natureMapAgg
        );

        const CASHFLOW_PERIOD_MONTHS = 12;
        const monthlyTotals: Record<string, number> = {};
        for (const t of filteredForKpi) {
          const month = getEffectiveAccountingMonth(t);
          if (!month) continue;
          const amount = Number(t.amount) || 0;
          const kind = resolveTransactionKind(t, natureMapAgg);
          const abs = Math.abs(amount);
          const signed = kind === 'expense' ? -abs : abs;
          monthlyTotals[month] = (monthlyTotals[month] ?? 0) + signed;
        }
        const now = new Date();
        const last12MonthKeys: string[] = [];
        for (let i = CASHFLOW_PERIOD_MONTHS - 1; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          last12MonthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        }
        const cashflowTotal = last12MonthKeys.reduce((sum, m) => sum + (monthlyTotals[m] ?? 0), 0);
        const cashflowMensuelMoyen = cashflowTotal / CASHFLOW_PERIOD_MONTHS;

        if (!cancelled) {
          setKpis({
            recettesTotales,
            depensesTotales,
            soldeNet,
            nonRapprochees,
            cashflowMensuelMoyen,
            cashflowMoisCount: CASHFLOW_PERIOD_MONTHS,
          });
        }
      } catch (error) {
        console.error('[useTransactionsKpis] Erreur lors du refresh:', error);
      }
    };

    window.addEventListener('transactions:refresh', handleRefresh);
    // ⚠️ CRITIQUE: Ne pas écouter sync:refresh (événement global qui déclencherait des recalculs inutiles)

    return () => {
      cancelled = true;
      window.removeEventListener('transactions:refresh', handleRefresh);
    };
  }, [mode, organizationId, periodStart, periodEnd, propertyId, propTransactions, appShellContext?.organizationId, normalOrg?.organizationId]);

  // Retourner les données selon le mode
  if (mode === 'normal') {
    return {
      kpis: apiKpis || {
        recettesTotales: 0,
        depensesTotales: 0,
        soldeNet: 0,
        nonRapprochees: 0,
        cashflowMensuelMoyen: 0,
        cashflowMoisCount: 0,
      },
      isLoading: apiLoading,
      error: apiError ? (apiError as Error).message : null,
    };
  }

  // Mode app-shell
  return {
    kpis,
    isLoading,
    error,
  };
}
