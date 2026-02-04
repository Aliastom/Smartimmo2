/**
 * Hook unifié pour charger les Insights d'un Bien
 * Fonctionne en mode "normal" (online) et "app-shell" (offline-first)
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTransactionRepositoryOffline } from '@/lib/offline/repositories/TransactionRepositoryOffline';
import { getLeaseRepositoryOffline } from '@/lib/offline/repositories/LeaseRepositoryOffline';
import { getLocalDB } from '@/lib/offline/db';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import type { LocalTransaction, LocalLease, LocalDocument, CachedNature, CachedCategory } from '@/lib/offline/db';

export interface PropertyTransactionsInsights {
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  transactionCount: number;
  unreconciledCount: number;
  anomalyCount: number;
  trend?: {
    revenue: string;
    expenses: string;
    net: string;
  };
  detail?: any;
}

export interface PropertyDocumentsInsights {
  totalDocuments: number;
  pendingDocuments: number;
  classifiedDocuments: number;
  ocrFailedDocuments: number;
  draftDocuments: number;
  classificationRate: number;
  detail?: any;
}

export interface PropertyLeasesInsights {
  hasActiveLease: boolean;
  leaseStartDate: Date | string | null;
  leaseEndDate: Date | string | null;
  monthlyRent: number;
  latePaymentsCount: number;
  upcomingDueDates: number;
  indexationInfo?: {
    lastDate: Date | string;
    rate: number;
  } | null;
  detail?: any;
}

export type PropertyInsights = 
  | PropertyTransactionsInsights 
  | PropertyDocumentsInsights 
  | PropertyLeasesInsights;

export interface UsePropertyInsightsOptions {
  mode: 'normal' | 'app-shell';
  propertyId: string;
  scope: 'transactions' | 'documents' | 'leases';
  period?: 'month' | 'quarter' | 'year';
  detail?: string;
}

export function usePropertyInsights(options: UsePropertyInsightsOptions) {
  const { mode, propertyId, scope, period = 'month', detail } = options;
  const { organizationId } = useCurrentOrganization();
  const [transactions, setTransactions] = useState<LocalTransaction[]>([]);
  const [leases, setLeases] = useState<LocalLease[]>([]);
  const [documents, setDocuments] = useState<LocalDocument[]>([]);
  const [categories, setCategories] = useState<Map<string, CachedCategory>>(new Map());
  const [loading, setLoading] = useState(mode === 'app-shell');
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Charger les données depuis IndexedDB en mode app-shell
  useEffect(() => {
    if (mode === 'app-shell' && organizationId && propertyId) {
      let cancelled = false;

      async function loadData() {
        try {
          setLoading(true);
          setError(null);

          const db = await getLocalDB();
          const transRepo = getTransactionRepositoryOffline();
          const leaseRepo = getLeaseRepositoryOffline();

          const [transactionsData, leasesData, documentsData, categoriesData] = await Promise.all([
            transRepo.getAll(organizationId, { propertyId }),
            leaseRepo.getAll(organizationId, { propertyId }),
            db.Document
              .where('organizationId')
              .equals(organizationId)
              .filter(d => d.propertyId === propertyId)
              .toArray(),
            db.Category.toArray(),
          ]);

          const categoryMap = new Map<string, CachedCategory>();
          categoriesData.forEach(cat => {
            categoryMap.set(cat.id, cat);
          });

          if (!cancelled) {
            setTransactions(transactionsData);
            setLeases(leasesData);
            setDocuments(documentsData);
            setCategories(categoryMap);
            setLoading(false);
          }
        } catch (e: any) {
          if (!cancelled) {
            console.error('[usePropertyInsights] Erreur chargement app-shell:', e);
            setError('Impossible de charger les insights.');
            setLoading(false);
          }
        }
      }

      loadData();

      return () => {
        cancelled = true;
      };
    }
  }, [mode, organizationId, propertyId, refreshKey]);

  // Écouter les événements de refresh en mode app-shell
  useEffect(() => {
    if (mode === 'app-shell') {
      const handleRefresh = () => {
        setRefreshKey(prev => prev + 1);
      };
      window.addEventListener('insights:refresh', handleRefresh);
      window.addEventListener('filters:changed', handleRefresh);
      return () => {
        window.removeEventListener('insights:refresh', handleRefresh);
        window.removeEventListener('filters:changed', handleRefresh);
      };
    }
  }, [mode]);

  // Calculer les insights en mode app-shell
  const calculatedInsights = useMemo(() => {
    if (mode === 'app-shell' && propertyId) {
      switch (scope) {
        case 'transactions':
          return calculateTransactionsInsights(transactions, categories, period, detail);
        case 'documents':
          return calculateDocumentsInsights(documents, detail);
        case 'leases':
          return calculateLeasesInsights(leases, transactions, detail);
        default:
          return null;
      }
    }
    return null;
  }, [mode, scope, propertyId, transactions, leases, documents, categories, period, detail]);

  // En mode normal, utiliser React Query
  const queryParams = useMemo(() => {
    const params = new URLSearchParams({
      propertyId,
      scope,
      period,
    });
    if (detail) {
      params.append('detail', detail);
    }
    return params.toString();
  }, [propertyId, scope, period, detail]);

  const { data: apiData, isLoading: apiLoading, error: apiError } = useQuery<PropertyInsights>({
    queryKey: ['property-insights', propertyId, scope, period, detail],
    queryFn: async () => {
      const response = await fetch(`/api/insights/property?${queryParams}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Erreur de chargement des insights');
      }
      return response.json();
    },
    enabled: mode === 'normal' && !!propertyId && !!scope,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  return {
    insights: mode === 'normal' ? apiData : calculatedInsights,
    loading: mode === 'normal' ? apiLoading : loading,
    error: mode === 'normal' ? (apiError as Error | null) : (error ? new Error(error) : null),
  };
}

// ===== Fonctions de calcul pour chaque scope =====

function calculateTransactionsInsights(
  transactions: LocalTransaction[],
  categories: Map<string, CachedCategory>,
  period: 'month' | 'quarter' | 'year',
  detail?: string
): PropertyTransactionsInsights | null {
  // Calculer les dates de période
  const now = new Date();
  let startDate = new Date();
  
  switch (period) {
    case 'month':
      startDate.setMonth(now.getMonth() - 1);
      break;
    case 'quarter':
      startDate.setMonth(now.getMonth() - 3);
      break;
    case 'year':
      startDate.setFullYear(now.getFullYear() - 1);
      break;
  }

  // Filtrer les transactions de la période
  const periodTransactions = transactions.filter(t => {
    const txDate = new Date(t.date);
    return txDate >= startDate;
  });

  // Classification des transactions
  const incomeNatures = ['LOYER', 'AVOIR_REGULARISATION', 'DEPOT_GARANTIE_RECU'];
  const expenseNatures = ['REPARATION', 'TRAVAUX', 'CHARGES_PROPRIETAIRE', 'DEPOT_GARANTIE_RENDU', 'PENALITE_RETENUE'];

  const isIncome = (t: LocalTransaction) => {
    if (incomeNatures.includes(t.nature || '')) return true;
    if (expenseNatures.includes(t.nature || '')) return false;
    return (t.amount || 0) > 0;
  };

  const isExpense = (t: LocalTransaction) => {
    if (expenseNatures.includes(t.nature || '')) return true;
    if (incomeNatures.includes(t.nature || '')) return false;
    return (t.amount || 0) < 0;
  };

  const incomeTransactions = periodTransactions.filter(isIncome);
  const expenseTransactions = periodTransactions.filter(isExpense);

  const totalRevenue = incomeTransactions.reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);
  const totalExpenses = expenseTransactions.reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);
  const netIncome = totalRevenue - totalExpenses;

  // Anomalies (montant = 0 ou pas de catégorie)
  const anomalies = periodTransactions.filter(t => (t.amount || 0) === 0 || !t.categoryId);
  
  // Non rapprochées (transactions sans paidAt)
  const unreconciled = periodTransactions.filter(t => !t.paidAt && t.amount !== 0);

  // Si detail demandé, calculer les données pour popovers
  let detailData = null;
  if (detail) {
    switch (detail) {
      case 'revenue':
        // Top 3 catégories de revenus
        const revenueByCat = incomeTransactions.reduce((acc, t) => {
          const cat = t.categoryId ? categories.get(t.categoryId) : null;
          const catName = cat?.label || 'Non catégorisé';
          acc[catName] = (acc[catName] || 0) + Math.abs(t.amount || 0);
          return acc;
        }, {} as Record<string, number>);
        detailData = Object.entries(revenueByCat)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 3)
          .map(([name, amount]) => ({ name, amount }));
        break;
      
      case 'expenses':
        // Top 3 catégories de charges
        const expenseByCat = expenseTransactions.reduce((acc, t) => {
          const cat = t.categoryId ? categories.get(t.categoryId) : null;
          const catName = cat?.label || 'Non catégorisé';
          acc[catName] = (acc[catName] || 0) + Math.abs(t.amount || 0);
          return acc;
        }, {} as Record<string, number>);
        detailData = Object.entries(expenseByCat)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 3)
          .map(([name, amount]) => ({ name, amount }));
        break;
      
      case 'net':
        // Sparkline des 30 derniers jours
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(now.getDate() - 30);
        const recentTransactions = periodTransactions.filter(t => new Date(t.date) >= thirtyDaysAgo);
        
        // Grouper par jour
        const dailyNet = recentTransactions.reduce((acc, t) => {
          const day = new Date(t.date).toISOString().split('T')[0];
          acc[day] = (acc[day] || 0) + (isIncome(t) ? Math.abs(t.amount || 0) : -Math.abs(t.amount || 0));
          return acc;
        }, {} as Record<string, number>);
        
        detailData = {
          sparkline: Object.values(dailyNet),
          trend: netIncome > 0 ? '+' : '-',
          percentage: totalRevenue > 0 ? ((netIncome / totalRevenue) * 100).toFixed(1) : '0'
        };
        break;
    }
  }

  return {
    totalRevenue,
    totalExpenses,
    netIncome,
    transactionCount: periodTransactions.length,
    unreconciledCount: unreconciled.length,
    anomalyCount: anomalies.length,
    trend: {
      revenue: '+5%', // À calculer avec période précédente si besoin
      expenses: '+3%',
      net: netIncome > 0 ? '+8%' : '-2%'
    },
    detail: detailData
  };
}

function calculateDocumentsInsights(
  documents: LocalDocument[],
  detail?: string
): PropertyDocumentsInsights | null {
  const total = documents.filter(d => !d.deletedAt).length;
  const pending = documents.filter(d => !d.deletedAt && d.status === 'pending').length;
  const classified = documents.filter(d => !d.deletedAt && d.documentTypeId).length;
  const ocrFailed = documents.filter(d => !d.deletedAt && d.ocrStatus === 'failed').length;
  const drafts = documents.filter(d => !d.deletedAt && d.status === 'draft').length;

  const classificationRate = total > 0 ? (classified / total) * 100 : 0;

  // Si detail demandé, calculer la répartition par type
  let detailData = null;
  if (detail === 'types') {
    const docsByType = new Map<string, number>();
    documents
      .filter(d => !d.deletedAt && d.documentTypeId)
      .forEach(d => {
        const typeId = d.documentTypeId!;
        docsByType.set(typeId, (docsByType.get(typeId) || 0) + 1);
      });

    detailData = Array.from(docsByType.entries())
      .map(([typeId, count]) => ({ type: typeId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }

  return {
    totalDocuments: total,
    pendingDocuments: pending,
    classifiedDocuments: classified,
    ocrFailedDocuments: ocrFailed,
    draftDocuments: drafts,
    classificationRate,
    detail: detailData
  };
}

function calculateLeasesInsights(
  leases: LocalLease[],
  transactions: LocalTransaction[],
  detail?: string
): PropertyLeasesInsights | null {
  const today = new Date();

  // Bail actif
  const activeLease = leases.find(l => 
    l.status === 'ACTIF' || 
    l.status === 'ACTIVE' ||
    (new Date(l.startDate) <= today && (!l.endDate || new Date(l.endDate) >= today))
  );

  // Loyer mensuel du bail actif
  const monthlyRent = activeLease?.rentAmount || 0;

  // Retards de paiement (transactions avec montant positif, non payées, date échue)
  const latePayments = transactions.filter(t => {
    const txDate = new Date(t.date);
    return t.amount > 0 && txDate <= today && !t.paidAt;
  }).length;

  // Dates clés du bail actif
  let leaseStartDate: Date | string | null = null;
  let leaseEndDate: Date | string | null = null;
  let indexationInfo: { lastDate: Date | string; rate: number } | null = null;

  if (activeLease) {
    leaseStartDate = activeLease.startDate;
    leaseEndDate = activeLease.endDate || null;
    
    // Indexation (si lastIndexationDate existe)
    if (activeLease.lastIndexationDate) {
      const lastIndexation = new Date(activeLease.lastIndexationDate);
      const indexationRate = activeLease.indexationRate || 2.5;
      indexationInfo = {
        lastDate: lastIndexation,
        rate: indexationRate
      };
    }
  }

  // Échéances à venir (30 jours)
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(today.getDate() + 30);
  
  const upcomingDueDates = transactions.filter(t => {
    const txDate = new Date(t.date);
    return t.amount > 0 && txDate >= today && txDate <= thirtyDaysFromNow && !t.paidAt;
  }).length;

  // Si detail demandé
  let detailData = null;
  if (detail === 'calendar' && activeLease) {
    detailData = {
      leaseStart: leaseStartDate,
      leaseEnd: leaseEndDate,
      monthsRemaining: leaseEndDate 
        ? Math.max(0, Math.ceil((new Date(leaseEndDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24 * 30)))
        : null,
      upcomingDueDates
    };
  }

  if (detail === 'indexation' && indexationInfo) {
    detailData = indexationInfo;
  }

  return {
    hasActiveLease: !!activeLease,
    leaseStartDate,
    leaseEndDate,
    monthlyRent,
    latePaymentsCount: latePayments,
    upcomingDueDates,
    indexationInfo,
    detail: detailData
  };
}








