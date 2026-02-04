/**
 * Hook unifié pour charger les Insights du Dashboard
 * Fonctionne en mode "normal" (online) et "app-shell" (offline-first)
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTransactionRepositoryOffline } from '@/lib/offline/repositories/TransactionRepositoryOffline';
import { getPropertyRepositoryOffline } from '@/lib/offline/repositories/PropertyRepositoryOffline';
import { getLeaseRepositoryOffline } from '@/lib/offline/repositories/LeaseRepositoryOffline';
import { getTenantRepositoryOffline } from '@/lib/offline/repositories/TenantRepositoryOffline';
import { getLocalDB } from '@/lib/offline/db';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import type { LocalTransaction, LocalProperty, LocalLease, LocalTenant, LocalDocument, CachedNature } from '@/lib/offline/db';

export interface DashboardInsights {
  // Biens
  totalProperties: number;
  occupiedProperties: number;
  vacantProperties: number;
  monthlyRevenue: number;
  occupationRate: number;
  
  // Locataires
  totalTenants: number;
  tenantsWithActiveLeases: number;
  tenantsWithoutLeases: number;
  overduePayments: number;
  
  // Transactions
  totalTransactions: number;
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  unreconciledTransactions: number;
  anomalies: number;
  upcomingDueDates: number;
  
  // Documents
  totalDocuments: number;
  pendingDocuments: number;
  classifiedDocuments: number;
  ocrFailedDocuments: number;
  draftDocuments: number;
  classificationRate: number;
}

export interface UseDashboardInsightsOptions {
  mode: 'normal' | 'app-shell';
  scope: 'biens' | 'locataires' | 'transactions' | 'documents';
}

export function useDashboardInsights(options: UseDashboardInsightsOptions) {
  const { mode, scope } = options;
  const { organizationId } = useCurrentOrganization();
  const [properties, setProperties] = useState<LocalProperty[]>([]);
  const [leases, setLeases] = useState<LocalLease[]>([]);
  const [tenants, setTenants] = useState<LocalTenant[]>([]);
  const [transactions, setTransactions] = useState<LocalTransaction[]>([]);
  const [documents, setDocuments] = useState<LocalDocument[]>([]);
  const [natures, setNatures] = useState<Map<string, CachedNature>>(new Map());
  const [loading, setLoading] = useState(mode === 'app-shell');
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Charger les données depuis IndexedDB en mode app-shell
  useEffect(() => {
    if (mode === 'app-shell' && organizationId) {
      let cancelled = false;

      async function loadData() {
        try {
          setLoading(true);
          setError(null);

          const db = await getLocalDB();
          const propRepo = getPropertyRepositoryOffline();
          const leaseRepo = getLeaseRepositoryOffline();
          const tenantRepo = getTenantRepositoryOffline();
          const transRepo = getTransactionRepositoryOffline();

          const [propertiesData, leasesData, tenantsData, transactionsData, documentsData, naturesData] = await Promise.all([
            propRepo.getAll(organizationId, {}),
            leaseRepo.getAll(organizationId, {}),
            tenantRepo.getAll(organizationId, {}),
            transRepo.getAll(organizationId, {}),
            db.Document.where('organizationId').equals(organizationId).toArray(),
            db.NatureEntity.toArray(),
          ]);

          const natureMap = new Map<string, CachedNature>();
          naturesData.forEach(nature => {
            natureMap.set(nature.key, nature);
          });

          if (!cancelled) {
            setProperties(propertiesData);
            setLeases(leasesData);
            setTenants(tenantsData);
            setTransactions(transactionsData);
            setDocuments(documentsData);
            setNatures(natureMap);
            setLoading(false);
          }
        } catch (e: any) {
          if (!cancelled) {
            console.error('[useDashboardInsights] Erreur chargement app-shell:', e);
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
  }, [mode, organizationId, refreshKey]);

  // Écouter les événements de refresh en mode app-shell
  // ⚠️ CRITIQUE: Écouter sync:refresh pour se rafraîchir après une sync silencieuse
  useEffect(() => {
    if (mode === 'app-shell') {
      const handleRefresh = () => {
        setRefreshKey(prev => prev + 1);
      };
      window.addEventListener('sync:refresh', handleRefresh);
      window.addEventListener('insights:refresh', handleRefresh);
      window.addEventListener('filters:changed', handleRefresh);
      return () => {
        window.removeEventListener('sync:refresh', handleRefresh);
        window.removeEventListener('insights:refresh', handleRefresh);
        window.removeEventListener('filters:changed', handleRefresh);
      };
    }
  }, [mode]);

  // Calculer les insights en mode app-shell
  const calculatedInsights = useMemo(() => {
    if (mode === 'app-shell') {
      switch (scope) {
        case 'biens':
          return calculateBiensInsights(properties, leases);
        case 'locataires':
          return calculateLocatairesInsights(tenants, leases);
        case 'transactions':
          return calculateTransactionsInsights(transactions, natures, documents);
        case 'documents':
          return calculateDocumentsInsights(documents);
        default:
          return {};
      }
    }
    return null;
  }, [mode, scope, properties, leases, tenants, transactions, documents, natures]);

  // En mode normal, utiliser React Query
  const { data: apiData, isLoading: apiLoading, error: apiError } = useQuery<Partial<DashboardInsights>>({
    queryKey: ['dashboard-insights', scope],
    queryFn: async () => {
      const response = await fetch(`/api/insights?scope=${scope}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Erreur de chargement des insights');
      }
      return response.json();
    },
    enabled: mode === 'normal',
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

function calculateBiensInsights(
  properties: LocalProperty[],
  leases: LocalLease[]
): Partial<DashboardInsights> {
  const totalProperties = properties.length;
  const activeLeases = leases.filter(l => l.status === 'ACTIF');
  const propertiesWithLeases = new Set(activeLeases.map(l => l.propertyId));
  const occupiedProperties = propertiesWithLeases.size;
  const vacantProperties = totalProperties - occupiedProperties;
  const occupationRate = totalProperties > 0 ? occupiedProperties / totalProperties : 0;

  const monthlyRevenue = activeLeases.reduce((sum, lease) => {
    return sum + (lease.rentAmount || 0);
  }, 0);

  return {
    totalProperties,
    occupiedProperties,
    vacantProperties,
    monthlyRevenue,
    occupationRate,
  };
}

function calculateLocatairesInsights(
  tenants: LocalTenant[],
  leases: LocalLease[]
): Partial<DashboardInsights> {
  const totalTenants = tenants.length;
  const activeLeases = leases.filter(l => l.status === 'ACTIF');
  const tenantsWithLeases = new Set(activeLeases.map(l => l.tenantId));
  const tenantsWithActiveLeases = tenantsWithLeases.size;
  const tenantsWithoutLeases = totalTenants - tenantsWithActiveLeases;

  // Pour l'instant, on met 0 pour les retards de paiement
  // Cette logique devra être implémentée selon vos besoins métier
  const overduePayments = 0;

  return {
    totalTenants,
    tenantsWithActiveLeases,
    tenantsWithoutLeases,
    overduePayments,
  };
}

function calculateTransactionsInsights(
  transactions: LocalTransaction[],
  natures: Map<string, CachedNature>,
  documents: LocalDocument[]
): Partial<DashboardInsights> {
  const totalTransactions = transactions.length;

  // Créer un Set des transactions avec documents
  const transactionIdsWithDocuments = new Set(
    documents
      .filter(d => d.linkedTo === 'transaction' && d.linkedId)
      .map(d => d.linkedId!)
  );

  // Identifier les natures de type RECETTE et DEPENSE
  const recetteCodes = Array.from(natures.values())
    .filter(n => n.flow === 'INCOME' || n.flow === 'RECETTE')
    .map(n => n.key);

  const depenseCodes = Array.from(natures.values())
    .filter(n => n.flow === 'EXPENSE' || n.flow === 'DEPENSE')
    .map(n => n.key);

  // Calculer les totaux
  let totalIncome = 0;
  let totalExpenses = 0;
  let anomalies = 0;

  transactions.forEach(tx => {
    const amount = Math.abs(tx.amount || 0);
    const nature = tx.nature ? natures.get(tx.nature) : null;
    const flow = nature?.flow?.toUpperCase();

    if (flow === 'INCOME' || flow === 'RECETTE' || (recetteCodes.includes(tx.nature || ''))) {
      totalIncome += amount;
    } else if (flow === 'EXPENSE' || flow === 'DEPENSE' || (depenseCodes.includes(tx.nature || ''))) {
      totalExpenses += amount;
    }

    // Anomalies : montant = 0 ou pas de catégorie
    if (amount === 0 || !tx.categoryId) {
      anomalies++;
    }
  });

  const netBalance = totalIncome - totalExpenses;

  // Transactions non rapprochées (sans document lié)
  const unreconciledTransactions = transactions.filter(t => 
    !transactionIdsWithDocuments.has(t.id) && t.amount !== 0
  ).length;

  // Échéances à venir (30 jours)
  const today = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(today.getDate() + 30);

  const upcomingDueDates = transactions.filter(t => {
    const txDate = new Date(t.date);
    return txDate >= today && txDate <= thirtyDaysFromNow;
  }).length;

  return {
    totalTransactions,
    totalIncome,
    totalExpenses,
    netBalance,
    unreconciledTransactions,
    anomalies,
    upcomingDueDates,
  };
}

function calculateDocumentsInsights(
  documents: LocalDocument[]
): Partial<DashboardInsights> {
  const totalDocuments = documents.filter(d => !d.deletedAt).length;
  const pendingDocuments = documents.filter(d => !d.deletedAt && d.status === 'pending').length;
  const classifiedDocuments = documents.filter(d => !d.deletedAt && d.documentTypeId).length;
  const ocrFailedDocuments = documents.filter(d => !d.deletedAt && d.ocrStatus === 'failed').length;
  const draftDocuments = documents.filter(d => !d.deletedAt && d.status === 'draft').length;

  const classificationRate = totalDocuments > 0 ? (classifiedDocuments / totalDocuments) * 100 : 0;

  return {
    totalDocuments,
    pendingDocuments,
    classifiedDocuments,
    ocrFailedDocuments,
    draftDocuments,
    classificationRate,
  };
}


