/**
 * Hook unifié pour calculer les données des graphiques des transactions
 * Fonctionne en mode "normal" (API) et "app-shell" (calcul local depuis IndexedDB)
 */

'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getLocalDB } from '@/lib/offline/db';
import { useAppShellContextOptional } from '@/contexts/AppShellContextResolver';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import type { LocalTransaction, CachedNature, CachedCategory } from '@/lib/offline/db';
import type { MonthlyData } from '@/components/transactions/TransactionsCumulativeChart';
import type { CategoryData } from '@/components/transactions/TransactionsByCategoryChart';
import type { IncomeExpenseData } from '@/components/transactions/TransactionsIncomeExpenseChart';
import {
  computeTransactionKpiTotals,
  filterTransactionsForScope,
  resolveTransactionKind,
  type NatureFlowMap,
  type TransactionLike,
} from '@/features/transactions/lib/transactionAggregation';

export interface TransactionsChartsData {
  timeline: MonthlyData[];
  byCategory: CategoryData[];
  incomeExpense: IncomeExpenseData;
}

export interface UseTransactionsChartsOptions {
  periodStart?: string; // Format: 'YYYY-MM'
  periodEnd?: string; // Format: 'YYYY-MM'
  refreshKey?: number;
  propertyId?: string;
  mode: 'normal' | 'app-shell';
  transactions?: LocalTransaction[]; // Pour mode app-shell avec props
}

export function useTransactionsCharts(options: UseTransactionsChartsOptions) {
  const { periodStart, periodEnd, refreshKey = 0, propertyId, mode, transactions: propTransactions } = options;
  
  // Utiliser AppShellContextResolver en mode app-shell, useCurrentOrganization en mode normal ou comme fallback
  const appShellContext = useAppShellContextOptional();
  const normalOrg = useCurrentOrganization();
  
  // En mode app-shell, utiliser le contexte si disponible et prêt, sinon fallback sur normalOrg
  // En mode normal, utiliser normalOrg
  const organizationId = mode === 'app-shell' && appShellContext?.status === 'ready'
    ? appShellContext.organizationId
    : normalOrg?.organizationId;
  
  const [data, setData] = useState<TransactionsChartsData>({
    timeline: [],
    byCategory: [],
    incomeExpense: { income: 0, expense: 0 },
  });
  const [isLoading, setIsLoading] = useState(mode === 'app-shell');
  const [error, setError] = useState<string | null>(null);

  // Mode normal : utiliser l'API
  // ⚠️ CRITIQUE: refreshKey retiré de la queryKey pour éviter les refetch lors des filtres/tri/cartes
  // refreshKey est uniquement utilisé pour forcer un recalcul après CRUD (géré via événements transactions:refresh)
  const { data: apiData, isLoading: apiLoading, error: apiError } = useQuery<TransactionsChartsData>({
    queryKey: ['transactions-charts', periodStart, periodEnd, propertyId, organizationId],
    queryFn: async () => {
      if (!organizationId) throw new Error('OrganizationId requis');
      
      const params = new URLSearchParams();
      if (periodStart) params.append('periodStart', periodStart);
      if (periodEnd) params.append('periodEnd', periodEnd);
      if (propertyId) params.append('propertyId', propertyId);
      
      const response = await fetch(`/api/transactions/charts?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Erreur lors du calcul des graphiques');
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
      setIsLoading(false);
      setError(appShellContext.error || 'Erreur de contexte');
      return;
    }

    // Vérifier que organizationId est disponible (depuis contexte ou fallback normalOrg)
    if (!organizationId) {
      // Si normalOrg est encore en cours de chargement, on attend
      if (normalOrg?.isLoading) {
        setIsLoading(true);
        return;
      }
      setIsLoading(false);
      setError('OrganizationId requis pour calculer les graphiques');
      return;
    }

    let cancelled = false;

    async function calculateCharts() {
      try {
        setIsLoading(true);
        setError(null);

        const orgId = organizationId;

        const db = await getLocalDB();
        
        // Charger les transactions (depuis props ou IndexedDB)
        let transactions: LocalTransaction[] = [];
        
        if (propTransactions && propTransactions.length > 0) {
          // Utiliser les transactions passées en props
          transactions = propTransactions;
        } else {
          // Charger depuis IndexedDB
          const transRepo = await import('@/lib/offline/repositories/TransactionRepositoryOffline').then(m => m.getTransactionRepositoryOffline());
          transactions = await transRepo.getAll(orgId, {
            ...(propertyId && { propertyId }),
          });
        }

        // Charger les natures et catégories depuis IndexedDB
        const [naturesData, categoriesData] = await Promise.all([
          db.NatureEntity.toArray(),
          db.Category.toArray(),
        ]);
        
        const natureMap = new Map<string, CachedNature>();
        naturesData.forEach((nature) => {
          natureMap.set(nature.key, nature);
        });
        const natureMapAgg = natureMap as unknown as NatureFlowMap;

        const categoryMap = new Map<string, CachedCategory>();
        categoriesData.forEach(cat => {
          categoryMap.set(cat.id, cat);
        });

        const scope = {
          ...(periodStart && periodEnd ? { periodStart, periodEnd } : {}),
          ...(propertyId && { propertyId }),
        };

        const filteredTransactions = filterTransactionsForScope(
          transactions as unknown as TransactionLike[],
          scope,
          natureMapAgg
        );

        // 1. Calculer l'évolution mensuelle cumulée (timeline)
        const monthlyMap = new Map<string, { income: number; expense: number; net: number }>();

        // Générer tous les mois dans la période
        const months: string[] = [];
        if (periodStart && periodEnd) {
          const startParts = periodStart.split('-');
          const endParts = periodEnd.split('-');
          const startYear = parseInt(startParts[0] || '2025');
          const startMonth = parseInt(startParts[1] || '1');
          const endYear = parseInt(endParts[0] || '2025');
          const endMonth = parseInt(endParts[1] || '12');
          
          let currentDate = new Date(startYear, startMonth - 1, 1);
          const endDate = new Date(endYear, endMonth - 1, 1);

          while (currentDate <= endDate) {
            const month = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
            months.push(month);
            monthlyMap.set(month, { income: 0, expense: 0, net: 0 });
            currentDate.setMonth(currentDate.getMonth() + 1);
          }
        }

        // Remplir les données mensuelles
        for (const transaction of filteredTransactions) {
          let month = (transaction as any).accounting_month || (transaction as any).accountingMonth;
          if (!month && transaction.date) {
            const d = new Date(transaction.date);
            month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          }
          if (!month) continue;

          const data = monthlyMap.get(month) || { income: 0, expense: 0, net: 0 };
          const amount = transaction.amount || 0;
          if (amount === 0) continue;

          const kind = resolveTransactionKind(
            {
              id: transaction.id,
              amount,
              nature: transaction.nature,
            },
            natureMapAgg
          );
          const abs = Math.abs(amount);
          if (kind === 'income') {
            data.income += abs;
            data.net += abs;
          } else {
            data.expense += abs;
            data.net -= abs;
          }

          monthlyMap.set(month, data);
        }

        // Calculer le cumulé
        let cumulated = 0;
        const timeline: MonthlyData[] = months.map((month) => {
          const data = monthlyMap.get(month) || { income: 0, expense: 0, net: 0 };
          cumulated += data.net;
          
          return {
            month,
            income: data.income,
            expense: -data.expense, // Négatif pour l'affichage
            net: data.net,
            cumulated,
          };
        });

        // 2. Calculer la répartition par catégorie
        const categoryAmountMap = new Map<string, number>();
        
        for (const transaction of filteredTransactions) {
          const categoryId = transaction.categoryId || '';
          const category = categoryId ? categoryMap.get(categoryId) : null;
          const categoryLabel = category?.label || 'Non classé';
          const amount = Math.abs(transaction.amount || 0);
          
          categoryAmountMap.set(categoryLabel, (categoryAmountMap.get(categoryLabel) || 0) + amount);
        }

        const byCategory: CategoryData[] = Array.from(categoryAmountMap.entries())
          .map(([category, amount]) => ({ category, amount }))
          .sort((a, b) => b.amount - a.amount);

        const ieTotals = computeTransactionKpiTotals(filteredTransactions as TransactionLike[], natureMapAgg);

        if (!cancelled) {
          setData({
            timeline,
            byCategory,
            incomeExpense: {
              income: ieTotals.recettesTotales,
              expense: -ieTotals.depensesTotales,
            },
          });
          setIsLoading(false);
        }
      } catch (e: any) {
        if (!cancelled) {
          console.error('[useTransactionsCharts] Erreur calcul app-shell:', e);
          setError('Impossible de calculer les graphiques.');
          setIsLoading(false);
        }
      }
    }

    calculateCharts();

    return () => {
      cancelled = true;
    };
  }, [mode, organizationId, periodStart, periodEnd, propertyId, propTransactions, appShellContext?.status, appShellContext?.organizationId, normalOrg?.organizationId, normalOrg?.isLoading]);
  // ⚠️ CRITIQUE: refreshKey retiré des dépendances pour éviter les rechargements complets lors des filtres/tri/cartes
  // refreshKey est uniquement utilisé pour forcer un recalcul après CRUD (géré via événements transactions:refresh)

  // Écouter les événements de refresh en mode app-shell
  // ⚠️ CRITIQUE: Recalculer les graphiques depuis IndexedDB lors des événements transactions:refresh
  // Ne pas utiliser refreshKey (qui déclencherait un remount complet)
  // ✅ FILTRE STRICT : Filtrer les events par propertyId si spécifié
  // ✅ Anti-loop : ignorer les refresh identiques trop rapprochés
  const lastRefreshRef = useRef<{ propertyId?: string; reason?: string; timestamp: number } | null>(null);
  
  useEffect(() => {
    if (mode !== 'app-shell') return;

    const handleRefresh = (event?: Event) => {
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
      
      // Le useEffect principal se déclenchera automatiquement via les dépendances
      // On force juste un re-render pour déclencher le recalcul
      setData(prev => ({ ...prev }));
    };

    window.addEventListener('transactions:refresh', handleRefresh);
    // ⚠️ CRITIQUE: Ne pas écouter sync:refresh (événement global qui déclencherait des recalculs inutiles)

    return () => {
      window.removeEventListener('transactions:refresh', handleRefresh);
    };
  }, [mode, propertyId]);

  // Retourner les données selon le mode
  if (mode === 'normal') {
    return {
      data: apiData || {
        timeline: [],
        byCategory: [],
        incomeExpense: { income: 0, expense: 0 },
      },
      isLoading: apiLoading,
      error: apiError ? (apiError as Error).message : null,
    };
  }

  // Mode app-shell
  return {
    data,
    isLoading,
    error,
  };
}
