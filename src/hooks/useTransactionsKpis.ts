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
  
  // Log de diagnostic en mode app-shell
  if (mode === 'app-shell') {
    console.log('[useTransactionsKpis] 🔍 État contexte:', {
      hasContext: !!appShellContext,
      contextStatus: appShellContext?.status,
      contextOrgId: appShellContext?.organizationId,
      normalOrgId: normalOrg?.organizationId,
      finalOrgId: organizationId
    });
  }
  
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
    console.log('[useTransactionsKpis] 🎯 useEffect déclenché:', { mode, organizationId, hasContext: !!appShellContext });
    
    if (mode !== 'app-shell') {
      return;
    }

    // Si le contexte app-shell existe mais n'est pas encore prêt, attendre
    // MAIS si normalOrg a déjà un organizationId, on peut l'utiliser comme fallback
    if (appShellContext && appShellContext.status === 'resolving' && !normalOrg?.organizationId) {
      setIsLoading(true);
      console.log('[useTransactionsKpis] ⏳ Contexte en cours de résolution, attente...');
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

        console.log('[useTransactionsKpis] 🔄 Début calcul KPIs app-shell:', {
          orgId,
          propertyId,
          periodStart,
          periodEnd,
          hasPropTransactions: !!propTransactions?.length
        });

        const db = await getLocalDB();
        
        // Charger les transactions (depuis props ou IndexedDB)
        let transactions: LocalTransaction[] = [];
        
        if (propTransactions && propTransactions.length > 0) {
          // Utiliser les transactions passées en props
          transactions = propTransactions;
          console.log('[useTransactionsKpis] 📦 Utilisation transactions props:', transactions.length);
        } else {
          // Charger depuis IndexedDB
          const transRepo = await import('@/lib/offline/repositories/TransactionRepositoryOffline').then(m => m.getTransactionRepositoryOffline());
          transactions = await transRepo.getAll(orgId, {
            ...(propertyId && { propertyId }),
            ...(periodStart && { dateFrom: `${periodStart}-01` }),
            ...(periodEnd && { dateTo: `${periodEnd}-31` }),
          });
          console.log('[useTransactionsKpis] 📦 Transactions chargées depuis IndexedDB:', transactions.length);
        }

        // Charger les natures depuis IndexedDB
        const naturesData = await db.NatureEntity.toArray();
        const natureMap = new Map<string, CachedNature>();
        naturesData.forEach((nature: CachedNature) => {
          natureMap.set(nature.key, nature);
        });

        // Filtrer par période comptable si nécessaire
        let filteredTransactions = transactions;
        if (periodStart && periodEnd) {
          filteredTransactions = transactions.filter(t => {
            // Utiliser accounting_month (nom dans IndexedDB) ou accountingMonth (compatibilité)
            const accountingMonth = (t as any).accounting_month || (t as any).accountingMonth;
            if (!accountingMonth) {
              // Si pas de mois comptable, calculer depuis la date
              if (t.date) {
                const d = new Date(t.date);
                const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                return month >= periodStart && month <= periodEnd;
              }
              return false;
            }
            return accountingMonth >= periodStart && accountingMonth <= periodEnd;
          });
        }

        // Calculer les KPIs
        let recettesTotales = 0;
        let depensesTotales = 0;
        let nonRapprochees = 0;

        for (const transaction of filteredTransactions) {
          const amount = transaction.amount || 0;
          const natureKey = transaction.nature || '';
          const natureData = natureKey ? natureMap.get(natureKey) : null;

          // Déterminer si c'est une recette ou une dépense selon le flow de la nature
          let flow = natureData?.flow?.toUpperCase();
          
          // Fallback si la nature n'est pas trouvée ou n'a pas de flow
          if (!flow) {
            flow = amount > 0 ? 'INCOME' : 'EXPENSE';
          }

          if (flow === 'INCOME') {
            recettesTotales += Math.abs(amount);
          } else if (flow === 'EXPENSE') {
            depensesTotales += -Math.abs(amount); // Négatif pour les dépenses
          }

          // Compter les transactions non rapprochées
          if (transaction.rapprochementStatus === 'non_rapprochee') {
            nonRapprochees++;
          }
        }

        const soldeNet = recettesTotales + depensesTotales; // depensesTotales est déjà négatif

        // Cashflow mensuel moyen = même règle que sidebar/page Biens : 12 derniers mois à partir d'aujourd'hui (une seule source de vérité)
        const CASHFLOW_PERIOD_MONTHS = 12;
        const monthlyTotals: Record<string, number> = {};
        for (const t of filteredTransactions) {
          const acc = (t as any).accounting_month ?? (t as any).accountingMonth;
          const month = acc ?? (t.date ? `${new Date(t.date).getFullYear()}-${String(new Date(t.date).getMonth() + 1).padStart(2, '0')}` : null);
          if (!month) continue;
          const amount = t.amount || 0;
          const natureKey = t.nature || '';
          const natureData = natureKey ? natureMap.get(natureKey) : null;
          const flow = natureData?.flow?.toUpperCase() || (amount > 0 ? 'INCOME' : 'EXPENSE');
          const signed = flow === 'EXPENSE' ? -Math.abs(amount) : Math.abs(amount);
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

        console.log('[useTransactionsKpis] ✅ KPIs calculés:', {
          recettesTotales,
          depensesTotales,
          soldeNet,
          nonRapprochees,
          cashflowMensuelMoyen,
          cashflowMoisCount,
          transactionsCount: filteredTransactions.length,
          totalTransactions: transactions.length
        });

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
  }, [mode, organizationId, periodStart, periodEnd, propertyId, propTransactions, appShellContext?.status, appShellContext?.error, appShellContext?.organizationId, normalOrg?.organizationId, normalOrg?.isLoading]);
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
      // ✅ FILTRE STRICT : Si propertyId est défini, accepter UNIQUEMENT les events avec scope='property' ET propertyId correspondant
      if (event instanceof CustomEvent && event.detail) {
        const detail = event.detail as { scope?: string; propertyId?: string; reason?: string };
        
        if (propertyId) {
          if (detail.scope !== 'property' || !detail.propertyId || detail.propertyId !== propertyId) {
            return; // Ignorer les events sans scope, scope différent, ou propertyId différent/absent
          }
        }
        
        // Anti-loop : ignorer les refresh identiques < 300ms
        const now = Date.now();
        const lastRefresh = lastRefreshRef.current;
        if (lastRefresh && 
            lastRefresh.propertyId === detail.propertyId && 
            lastRefresh.reason === detail.reason &&
            now - lastRefresh.timestamp < 300) {
          return;
        }
        
        lastRefreshRef.current = {
          propertyId: detail.propertyId,
          reason: detail.reason,
          timestamp: now,
        };
      }
      
      try {
        const db = await getLocalDB();
        const transRepo = await import('@/lib/offline/repositories/TransactionRepositoryOffline').then(m => m.getTransactionRepositoryOffline());
        
        // Recharger les transactions avec les mêmes filtres
        const transactions = await transRepo.getAll(organizationId, {
          ...(propertyId && { propertyId }),
          ...(periodStart && { dateFrom: `${periodStart}-01` }),
          ...(periodEnd && { dateTo: `${periodEnd}-31` }),
        });

        // Recalculer les KPIs (même logique que dans calculateKpis)
        const naturesData = await db.NatureEntity.toArray();
        const natureMap = new Map<string, CachedNature>();
        naturesData.forEach((nature: CachedNature) => {
          natureMap.set(nature.key, nature);
        });

        let filteredTransactions = transactions;
        if (periodStart && periodEnd) {
          filteredTransactions = transactions.filter(t => {
            const accountingMonth = (t as any).accounting_month || (t as any).accountingMonth;
            if (!accountingMonth) {
              if (t.date) {
                const d = new Date(t.date);
                const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                return month >= periodStart && month <= periodEnd;
              }
              return false;
            }
            return accountingMonth >= periodStart && accountingMonth <= periodEnd;
          });
        }

        let recettesTotales = 0;
        let depensesTotales = 0;
        let nonRapprochees = 0;

        for (const transaction of filteredTransactions) {
          const amount = transaction.amount || 0;
          const natureKey = transaction.nature || '';
          const natureData = natureKey ? natureMap.get(natureKey) : null;
          let flow = natureData?.flow?.toUpperCase();
          if (!flow) {
            flow = amount > 0 ? 'INCOME' : 'EXPENSE';
          }

          if (flow === 'INCOME') {
            recettesTotales += Math.abs(amount);
          } else if (flow === 'EXPENSE') {
            depensesTotales += -Math.abs(amount);
          }

          if (transaction.rapprochementStatus === 'non_rapprochee') {
            nonRapprochees++;
          }
        }

        const soldeNet = recettesTotales + depensesTotales;

        const CASHFLOW_PERIOD_MONTHS = 12;
        const monthlyTotals: Record<string, number> = {};
        for (const t of filteredTransactions) {
          const acc = (t as any).accounting_month ?? (t as any).accountingMonth;
          const month = acc ?? (t.date ? `${new Date(t.date).getFullYear()}-${String(new Date(t.date).getMonth() + 1).padStart(2, '0')}` : null);
          if (!month) continue;
          const amount = t.amount || 0;
          const natureKey = t.nature || '';
          const natureData = natureKey ? natureMap.get(natureKey) : null;
          const flow = natureData?.flow?.toUpperCase() || (amount > 0 ? 'INCOME' : 'EXPENSE');
          const signed = flow === 'EXPENSE' ? -Math.abs(amount) : Math.abs(amount);
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
  }, [mode, organizationId, periodStart, periodEnd, propertyId]);

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
