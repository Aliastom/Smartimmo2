/**
 * Core Component pour la page Transactions
 * 
 * Une seule source de vérité graphique utilisable en mode "normal" et "app-shell"
 * Toute la logique UI est centralisée ici.
 * 
 * RÉPLIQUE EXACTEMENT le comportement de TransactionsClient.tsx
 */

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { notify2 } from '@/lib/notify2';
import { Plus, Loader2, Home } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Pagination } from '@/components/ui/Pagination';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import TransactionFilters from '@/components/transactions/TransactionFilters';
import TransactionsTable from '@/components/transactions/TransactionsTable';
import TransactionDrawer from '@/components/transactions/TransactionDrawer';
import { TransactionsKpiBar } from '@/components/transactions/TransactionsKpiBar';
import { TransactionsCumulativeChart } from '@/components/transactions/TransactionsCumulativeChart';
import { TransactionsIncomeExpenseChart } from '@/components/transactions/TransactionsIncomeExpenseChart';
import { useTransactionsKpis } from '@/hooks/useTransactionsKpis';
import { useTransactionsCharts } from '@/hooks/useTransactionsCharts';
import { useTransactionsData, type Transaction, type TransactionsFilters } from './hooks/useTransactionsData';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import { useAlert } from '@/hooks/useAlert';
import { usePropertyHeaderActions } from '@/app/biens/[id]/PropertyHeaderActionsContext';
import { useGestionDelegueStatus } from '@/hooks/useGestionDelegueStatus';
import { useGestionCodes } from '@/hooks/useGestionCodes';
import { useSidebarOptional } from '@/contexts/SidebarContext';
import { Menu, X } from 'lucide-react';
import { createTransactionServiceWithMode } from '@/domain/services/transactionServiceFactory';
import { getGlobalSyncService } from '@/lib/offline/syncGlobal';
import { getTransactionRepositoryOffline } from '@/lib/offline/repositories/TransactionRepositoryOffline';
import { getPropertyRepositoryOffline } from '@/lib/offline/repositories/PropertyRepositoryOffline';
import { getEcheanceRepositoryOffline } from '@/lib/offline/repositories/EcheanceRepositoryOffline';
import { getLocalDB } from '@/lib/offline/db';
import type { LocalTransaction } from '@/lib/offline/db';
import { calcCommission } from '@/lib/gestion/calcCommission';
import { txHotPathDebugLog, txPerfMeasureZone } from '@/lib/utils/logger';
import { navigateToView } from '@/utils/appShellNavigation';
import { dispatchTransactionsLocalRefresh } from './txLocalRefresh';

// ✅ IMPORT STATIQUE pour garantir le fonctionnement offline (évite ChunkLoadError en app-shell)
import { TransactionModal } from '@/components/transactions/TransactionModalV2';
import { ConfirmDeleteTransactionModal } from '@/components/transactions/ConfirmDeleteTransactionModal';
import { ConfirmDeleteMultipleTransactionsModal } from '@/components/transactions/ConfirmDeleteMultipleTransactionsModal';
import { DuplicateDetectedModal } from '@/components/documents/DuplicateDetectedModal';
import { TransactionsTableQuickFiltersBar } from '@/features/transactions/components/TransactionsTableQuickFiltersBar';
import { useTransactionsPortfolioPilotage } from '@/features/transactions/hooks/useTransactionsPortfolioPilotage';
import {
  GlobalPilotageDetailAccordion,
  GlobalPilotageAlertsSection,
  GLOBAL_ROW_DETAIL_LINK_CLASS,
} from '@/components/global-pilotage';
import { AirbnbImportButton } from '@/components/airbnb/AirbnbImportButton';

export interface TransactionsPageCoreProps {
  mode: 'normal' | 'app-shell';
  initialPropertyId?: string; // Pour initialiser le filtre propertyId depuis l'URL en mode app-shell
  /** Filtre transactions sur un bail (param URL `leaseId`, ex. lien « Transactions du bail »). */
  initialLeaseId?: string;
  hideTitle?: boolean; // Pour masquer le SectionTitle quand utilisé dans PropertyDetailView
  // Props pour le mode app-shell (quand les données sont déjà chargées)
  propertyId?: string;
  property?: any; // LocalProperty
  transactions?: any[]; // LocalTransaction[]
  loading?: boolean;
}

export function TransactionsPageCore({
  mode,
  initialPropertyId,
  initialLeaseId,
  hideTitle = false,
  // Props pour mode app-shell
  propertyId: propPropertyId,
  property: propProperty,
  transactions: propTransactions,
  loading: propLoading,
}: TransactionsPageCoreProps) {
  // ⚠️ DIAGNOSTIC: Logger mount/unmount
  useEffect(() => {
    // MOUNT - log supprimé
    return () => {
      // UNMOUNT - log supprimé
    };
  }, [mode, propPropertyId, initialPropertyId, initialLeaseId, propTransactions]);
  
  const { organizationId } = useCurrentOrganization();
  const router = useRouter();
  const searchParamsHook = useSearchParams();
  const { showAlert } = useAlert();
  
  // Récupérer les paramètres de gestion déléguée
  const { isEnabled: gestionEnabled } = useGestionDelegueStatus();
  const { codes: gestionCodes } = useGestionCodes();
  
  // Récupérer setActions du contexte PropertyHeaderActionsContext si disponible (pour mode app-shell avec hideTitle)
  let setHeaderActions: ((actions: React.ReactNode) => void) | null = null;
  try {
    const headerActionsContext = usePropertyHeaderActions();
    setHeaderActions = headerActionsContext.setActions;
  } catch {
    // Le contexte n'est pas disponible (mode normal ou pas dans PropertyHeaderActionsProvider)
    // C'est normal, on ignore
  }

  // Récupérer le contexte sidebar pour le hamburger mobile
  const sidebarContext = useSidebarOptional();

  // Contexte bien (App Shell) : onglet Transactions — filtre bien figé, comme BAUX / ÉCHÉANCES
  const isPropertyScoped = mode === 'app-shell' && hideTitle === true;
  const lockedPropertyId = useMemo(() => {
    if (!isPropertyScoped) return '';
    return (propPropertyId || initialPropertyId || '').trim();
  }, [isPropertyScoped, propPropertyId, initialPropertyId]);

  // États pour la période (format YYYY-MM)
  // ⚠️ CORRECTION: Initialiser à "Tous" par défaut (période très large) pour afficher toutes les transactions
  const now = new Date();
  const [periodStart, setPeriodStart] = useState(`2020-01`);
  const [periodEnd, setPeriodEnd] = useState(`${now.getFullYear() + 1}-12`);

  const showPortfolioPilotage = mode === 'app-shell' && !hideTitle;

  const [transactionsDetailOpen, setTransactionsDetailOpen] = useState(false);

  // État pour le filtre KPI actif (par défaut: 'solde' = vue globale)
  const [activeKpiFilter, setActiveKpiFilter] = useState<string | null>('solde');

  // États des filtres
  // ⚠️ CRITIQUE: Initialiser propertyId depuis propPropertyId (priorité) ou initialPropertyId en mode app-shell
  const [filters, setFilters] = useState<TransactionsFilters>(() => {
    const baseFilters: TransactionsFilters = {
    search: '',
    propertyId: '',
    leaseId: '',
    tenantId: '',
    natureId: '',
    categoryId: '',
    amountMin: '',
    amountMax: '',
    dateFrom: '',
    dateTo: '',
    paidAtFrom: '',
    paidAtTo: '',
    status: '',
    hasDocument: '',
    includeManagementFees: true,
    groupByParent: true,
    includeArchived: false
    };
    
    // En mode app-shell, initialiser depuis propPropertyId (priorité) ou initialPropertyId
    if (mode === 'app-shell') {
      if (propPropertyId) {
        baseFilters.propertyId = propPropertyId;
      } else if (initialPropertyId) {
        baseFilters.propertyId = initialPropertyId;
      }
      if (initialLeaseId) {
        baseFilters.leaseId = initialLeaseId;
      }
    }
    
    // En mode normal, initialiser depuis searchParams
    if (mode === 'normal') {
      baseFilters.propertyId = searchParamsHook.get('propertyId') || '';
      baseFilters.leaseId = searchParamsHook.get('leaseId') || '';
      baseFilters.tenantId = searchParamsHook.get('tenantId') || '';
    }
    
    return baseFilters;
  });

  useEffect(() => {
    if (!lockedPropertyId) return;
    setFilters((prev) =>
      prev.propertyId === lockedPropertyId ? prev : { ...prev, propertyId: lockedPropertyId }
    );
  }, [lockedPropertyId]);

  useEffect(() => {
    if (!isPropertyScoped) return;
    const lid = (initialLeaseId ?? '').trim();
    setFilters((prev) => (prev.leaseId === lid ? prev : { ...prev, leaseId: lid }));
  }, [isPropertyScoped, initialLeaseId]);

  const portfolioPilotageStats = useTransactionsPortfolioPilotage({
    enabled: showPortfolioPilotage && !!organizationId,
    organizationId,
    periodStart,
    periodEnd,
    propertyId: filters.propertyId || undefined,
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 30, // ⚠️ CORRECTION: Réduit de 50 à 30 pour améliorer les performances
    total: 0,
    pages: 0
  });

  const [transactionIdsWithEcheanceLink, setTransactionIdsWithEcheanceLink] = useState<string[]>([]);

  useEffect(() => {
    if (mode !== 'app-shell' || !organizationId) return;
    const pid = filters.propertyId || propPropertyId || initialPropertyId;
    if (!pid) {
      setTransactionIdsWithEcheanceLink([]);
      return;
    }
    (async () => {
      try {
        const echRepo = getEcheanceRepositoryOffline();
        const echeances = await echRepo.getAll(organizationId, { propertyId: pid });
        const echeanceIds = new Set(echeances.map((e) => e.id));
        const db = await getLocalDB();
        if (!db) {
          setTransactionIdsWithEcheanceLink([]);
          return;
        }
        const allLinks = await db.EcheanceTransactionLink.where('organizationId').equals(organizationId).toArray();
        const txIds = allLinks
          .filter((l: { echeanceId: string }) => echeanceIds.has(l.echeanceId))
          .map((l: { transactionId: string }) => l.transactionId);
        setTransactionIdsWithEcheanceLink([...new Set(txIds)]);
      } catch (e) {
        console.error(e);
        setTransactionIdsWithEcheanceLink([]);
      }
    })();
  }, [mode, organizationId, filters.propertyId, propPropertyId, initialPropertyId]);

  useEffect(() => {
    const onRefresh = () => {
      if (mode !== 'app-shell' || !organizationId) return;
      const pid = filters.propertyId || propPropertyId || initialPropertyId;
      if (!pid) return;
      getEcheanceRepositoryOffline()
        .getAll(organizationId, { propertyId: pid })
        .then((echeances) => {
          const echeanceIds = new Set(echeances.map((e) => e.id));
          return getLocalDB().then((db) => {
            if (!db) return [];
            return db.EcheanceTransactionLink.where('organizationId').equals(organizationId).toArray();
          }).then((allLinks: { echeanceId: string; transactionId: string }[]) =>
            allLinks.filter((l) => echeanceIds.has(l.echeanceId)).map((l) => l.transactionId)
          );
        })
        .then((txIds) => setTransactionIdsWithEcheanceLink([...new Set(txIds)]))
        .catch(() => {});
    };
    window.addEventListener('echeanceLinks:refresh', onRefresh);
    return () => window.removeEventListener('echeanceLinks:refresh', onRefresh);
  }, [mode, organizationId, filters.propertyId, propPropertyId, initialPropertyId]);

  // Tri côté serveur (mode normal) : appliqué AVANT limit/offset pour cohérence pagination
  const [sortBy, setSortBy] = useState<'accounting_month' | 'accountingMonth' | 'date' | 'amount' | 'nature'>('accountingMonth');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // États des modals et drawer
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [showDeleteTransactionModal, setShowDeleteTransactionModal] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
  const [transactionHasDocuments, setTransactionHasDocuments] = useState(false);
  const [isLoadingDeleteTransaction, setIsLoadingDeleteTransaction] = useState(false);
  const [loadingTransactionId, setLoadingTransactionId] = useState<string | null>(null);
  
  // États pour la sélection multiple
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<string[]>([]);
  const [showDeleteMultipleModal, setShowDeleteMultipleModal] = useState(false);
  const [transactionsToDelete, setTransactionsToDelete] = useState<Transaction[]>([]);
  const [isLoadingDeleteModal, setIsLoadingDeleteModal] = useState(false);
  const [deletingProgress, setDeletingProgress] = useState<{ current: number; total: number } | null>(null);
  
  // États pour la modal de doublon
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateData, setDuplicateData] = useState<any>(null);

  // Filtre rapide Tous / Recettes / Dépenses (client-side sur la page courante)
  const [flowFilter, setFlowFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [scrollToDocuments, setScrollToDocuments] = useState(false);
  const [scrollToRapprochement, setScrollToRapprochement] = useState(false);
  
  // ⚠️ SUPPRIMÉ: refreshKey n'est plus utilisé pour éviter les remounts
  // Les KPI et graphiques se recalculent automatiquement via leurs dépendances (periodStart, periodEnd, propertyId)
  // Les refreshes après CRUD sont gérés via événements transactions:refresh
  
  // ⚠️ OPTION B - UX: State pour tracker les transactions qui attendent une commission (placeholder)
  // Set des IDs de transactions pour lesquelles une commission est en cours de création côté serveur
  const [pendingCommissionTransactionIds, setPendingCommissionTransactionIds] = useState<Set<string>>(new Set());

  // ✅ CORRECTION: En mode app-shell avec props, NE PAS appeler useTransactionsData du tout
  const isAppShellWithProps = mode === 'app-shell' && propTransactions !== undefined;
  
  // ✅ Nettoyage: Désactiver complètement le hook si on a des props (évite double chargement)
  const shouldUseHook = !isAppShellWithProps;
  
  // État pour les compteurs de documents (calculés via documentLinks)
  const [documentCounts, setDocumentCounts] = useState<Map<string, number>>(new Map());
  
  // Charger les compteurs de documents en mode app-shell avec props
  useEffect(() => {
    if (isAppShellWithProps && organizationId && propTransactions && propTransactions.length > 0) {
      const loadDocumentCounts = async () => {
        try {
          const { getDocumentCountsForTransactions } = await import('@/lib/offline/services/documentLinksService');
          const transactionIds = propTransactions.map((t: any) => t.id);
          const counts = await getDocumentCountsForTransactions(transactionIds, organizationId);
          setDocumentCounts(counts);
        } catch (error) {
          // Error loading document counts - log supprimé
        }
      };
      loadDocumentCounts();
    }
  }, [isAppShellWithProps, organizationId, propTransactions?.map((t: any) => t.id).join(',')]);
  
  // Écouter les événements de refresh
  useEffect(() => {
    if (isAppShellWithProps && organizationId && propTransactions && propTransactions.length > 0) {
      const handleRefresh = async () => {
        try {
          const { getDocumentCountsForTransactions } = await import('@/lib/offline/services/documentLinksService');
          const transactionIds = propTransactions.map((t: any) => t.id);
          const counts = await getDocumentCountsForTransactions(transactionIds, organizationId);
          setDocumentCounts(counts);
        } catch (error) {
          // Error refreshing document counts - log supprimé
        }
      };
      
      window.addEventListener('sync:refresh', handleRefresh);
      window.addEventListener('documents:refresh', handleRefresh);
      window.addEventListener('transactions:refresh', handleRefresh);
      
      return () => {
        window.removeEventListener('sync:refresh', handleRefresh);
        window.removeEventListener('documents:refresh', handleRefresh);
        window.removeEventListener('transactions:refresh', handleRefresh);
      };
    }
  }, [isAppShellWithProps, organizationId, propTransactions?.map((t: any) => t.id).join(',')]);
  
  // 🔍 DIAGNOSTIC: Log des filtres avant d'appeler le hook
  useEffect(() => {
    if (mode === 'app-shell' && process.env.NODE_ENV === 'development') {
      console.log('[TransactionsPageCore] 🔍 Filtres pour useTransactionsData:', {
        shouldUseHook,
        mode,
        filters: filters.propertyId ? { ...filters, propertyId: filters.propertyId } : filters,
        initialPropertyId,
        propPropertyId,
      });
    }
  }, [mode, shouldUseHook, filters.propertyId, initialPropertyId, propPropertyId]);

  const {
    transactions: hookTransactions,
    properties: hookProperties,
    leases: hookLeases,
    tenants: hookTenants,
    categories: hookCategories,
    natures: hookNatures,
    totalCount: hookTotalCount,
    amountsSummary: hookAmountsSummary,
    loading: hookLoading,
    error: hookError,
  } = useTransactionsData({
    mode: shouldUseHook ? mode : 'normal',
    filters: shouldUseHook && mode === 'app-shell' ? filters : undefined,
    activeKpiFilter: shouldUseHook ? activeKpiFilter : undefined,
    periodStart: shouldUseHook ? periodStart : undefined,
    periodEnd: shouldUseHook ? periodEnd : undefined,
    enabled: shouldUseHook, // ✅ CORRECTION: Désactiver complètement le hook si on a des props
    sortBy: shouldUseHook && mode === 'normal' ? sortBy : undefined,
    sortOrder: shouldUseHook && mode === 'normal' ? sortOrder : undefined,
    page: shouldUseHook && mode === 'normal' ? pagination.page : undefined,
    limit: shouldUseHook && mode === 'normal' ? pagination.limit : undefined,
  });

  // Enrichir les transactions passées en props avec les informations de documents
  const enrichedPropTransactions = useMemo(() => {
    if (!isAppShellWithProps || !propTransactions || propTransactions.length === 0) {
      return propTransactions || [];
    }
    
    // Enrichir chaque transaction avec hasDocument et documentsCount depuis documentLinks
    return propTransactions.map((trans: any) => {
      const documentsCount = documentCounts.get(trans.id) || 0;
      return {
        ...trans,
        hasDocument: documentsCount > 0,
        documentsCount,
      };
    });
  }, [isAppShellWithProps, propTransactions, documentCounts]);

  // Utiliser les props enrichies si disponibles, sinon les données du hook
  const allTransactions = isAppShellWithProps ? enrichedPropTransactions : hookTransactions;
  const properties = isAppShellWithProps ? (propProperty ? [propProperty] : []) : hookProperties;
  const leases = isAppShellWithProps ? [] : hookLeases; // TODO: charger les leases si nécessaire
  const tenants = isAppShellWithProps ? [] : hookTenants; // TODO: charger les tenants si nécessaire

  const leaseUrlFilterLabel = useMemo(() => {
    if (!filters.leaseId || !leases.length) return null;
    const lease = leases.find((l: { id: string }) => l.id === filters.leaseId) as
      | { tenantId?: string }
      | undefined;
    if (!lease?.tenantId) return null;
    const tenant = tenants.find((t: { id: string }) => t.id === lease.tenantId) as
      | { firstName?: string; lastName?: string }
      | undefined;
    if (!tenant) return null;
    const name = `${tenant.firstName ?? ''} ${tenant.lastName ?? ''}`.trim();
    return name || null;
  }, [filters.leaseId, leases, tenants]);
  const categories = isAppShellWithProps ? [] : hookCategories; // TODO: charger les categories si nécessaire
  const natures = isAppShellWithProps ? new Map() : hookNatures; // TODO: charger les natures si nécessaire
  const totalCount = isAppShellWithProps ? allTransactions.length : hookTotalCount;
  const amountsSummary = isAppShellWithProps ? { positiveSum: 0, negativeSum: 0 } : hookAmountsSummary; // TODO: calculer
  const loading = isAppShellWithProps ? (propLoading ?? false) : hookLoading;
  const error = isAppShellWithProps ? null : hookError;

  /** App Shell — détail bien : rentalMode / nom depuis IDB + refresh après édition bien / sync */
  const [airbnbScopedProperty, setAirbnbScopedProperty] = useState<{ rentalMode: string; name: string } | null>(null);

  useEffect(() => {
    if (!hideTitle || !lockedPropertyId || !organizationId) {
      setAirbnbScopedProperty(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const p = await getPropertyRepositoryOffline().getById(lockedPropertyId, organizationId);
        if (!cancelled && p) {
          setAirbnbScopedProperty({ rentalMode: p.rentalMode, name: p.name });
        }
      } catch {
        if (!cancelled) setAirbnbScopedProperty(null);
      }
    };
    void load();
    const onRefresh = () => {
      void load();
    };
    window.addEventListener('sync:refresh', onRefresh);
    window.addEventListener('properties:refresh', onRefresh);
    return () => {
      cancelled = true;
      window.removeEventListener('sync:refresh', onRefresh);
      window.removeEventListener('properties:refresh', onRefresh);
    };
  }, [hideTitle, lockedPropertyId, organizationId]);

  const showAirbnbImport = useMemo(() => {
    if (!lockedPropertyId) return false;
    const fromList = properties.find((x: { id: string; rentalMode?: string }) => x.id === lockedPropertyId);
    if (fromList && (fromList as { rentalMode?: string }).rentalMode === 'SEASONAL_AIRBNB') return true;
    return airbnbScopedProperty?.rentalMode === 'SEASONAL_AIRBNB';
  }, [lockedPropertyId, properties, airbnbScopedProperty]);

  const airbnbPropertyName = useMemo(() => {
    if (!lockedPropertyId) return '';
    const fromList = properties.find((x: { id: string; name?: string }) => x.id === lockedPropertyId);
    return (fromList as { name?: string } | undefined)?.name || airbnbScopedProperty?.name || '';
  }, [lockedPropertyId, properties, airbnbScopedProperty]);

  // En app-shell : tri sur l'ensemble du dataset AVANT la slice (cohérence pagination)
  const sortedAllTransactions = useMemo(() => {
    if (mode === 'normal' && !isAppShellWithProps) {
      return allTransactions;
    }
    const list = [...allTransactions];
    const field = sortBy === 'accountingMonth' ? 'accountingMonth' : sortBy;
    const order = sortOrder === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      let comparison = 0;
      const monthA = (a as any).accountingMonth || (a as any).accounting_month || '0000-00';
      const monthB = (b as any).accountingMonth || (b as any).accounting_month || '0000-00';
      switch (field) {
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'amount':
          comparison = Math.abs(a.amount) - Math.abs(b.amount);
          break;
        case 'nature':
          comparison = (a.nature?.type || '').localeCompare(b.nature?.type || '');
          break;
        case 'accountingMonth':
          comparison = monthA.localeCompare(monthB);
          break;
        default:
          comparison = monthA.localeCompare(monthB);
      }
      return order * comparison;
    });
    return list;
  }, [mode, isAppShellWithProps, allTransactions, sortBy, sortOrder]);

  // Mode normal : pagination côté serveur (hook retourne déjà la page courante).
  // Mode app-shell : pagination côté client sur le dataset trié.
  const paginatedTransactions = useMemo(() => {
    if (mode === 'normal' && !isAppShellWithProps) {
      return allTransactions;
    }
    const startIndex = (pagination.page - 1) * pagination.limit;
    const endIndex = startIndex + pagination.limit;
    return sortedAllTransactions.slice(startIndex, endIndex);
  }, [mode, isAppShellWithProps, allTransactions, sortedAllTransactions, pagination.page, pagination.limit]);

  // Mettre à jour le nombre de pages basé sur le totalCount
  useEffect(() => {
    const totalPages = Math.ceil(totalCount / pagination.limit);
    setPagination(prev => ({
      ...prev,
      pages: totalPages > 0 ? totalPages : 1,
      total: totalCount,
    }));
  }, [totalCount, pagination.limit]);

  const transactions = paginatedTransactions;

  // Charger les KPI avec les hooks (utiliser le mode du composant, pas isAppShellWithProps)
  // ⚠️ CRITIQUE: refreshKey retiré - les KPI se recalculent automatiquement via les dépendances (periodStart, periodEnd, propertyId)
  // refreshKey est uniquement utilisé pour forcer un recalcul après CRUD (géré via événements transactions:refresh)
  const { kpis, isLoading: kpisLoading } = useTransactionsKpis({
    periodStart,
    periodEnd,
    propertyId: isAppShellWithProps ? propPropertyId : filters.propertyId || undefined,
    mode: mode, // ✅ CORRECTION: Utiliser le mode du composant directement
    transactions: isAppShellWithProps ? (propTransactions || []) : undefined,
  });

  // Charger les graphiques avec les hooks (utiliser le mode du composant, pas isAppShellWithProps)
  // ⚠️ CRITIQUE: refreshKey retiré - les graphiques se recalculent automatiquement via les dépendances (periodStart, periodEnd, propertyId)
  // refreshKey est uniquement utilisé pour forcer un recalcul après CRUD (géré via événements transactions:refresh)
  const { data: chartsData, isLoading: chartsLoading } = useTransactionsCharts({
    periodStart,
    periodEnd,
    propertyId: isAppShellWithProps ? propPropertyId : filters.propertyId || undefined,
    mode: mode, // ✅ CORRECTION: Utiliser le mode du composant directement
    transactions: isAppShellWithProps ? (propTransactions || []) : undefined,
  });

  // Nettoyer l'URL au montage (mode normal uniquement)
  useEffect(() => {
    if (mode === 'normal' && searchParamsHook && router) {
      const hasFilters = searchParamsHook.toString().length > 0;
      if (hasFilters) {
        router.replace('/transactions', { scroll: false });
      }
    }
  }, [mode, searchParamsHook, router]);

  // Synchronisation des filtres avec l'URL (mode normal uniquement)
  const updateURL = useCallback((newFilters: TransactionsFilters) => {
    if (mode === 'normal' && router) {
      const params = new URLSearchParams();
      
      Object.entries(newFilters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });

      const newURL = params.toString() ? `?${params.toString()}` : '';
      router.replace(`/transactions${newURL}`, { scroll: false });
    }
  }, [mode, router]);

  // Gestion des filtres
  const handleFiltersChange = useCallback(
    (newFilters: TransactionsFilters) => {
      const merged =
        lockedPropertyId !== '' ? { ...newFilters, propertyId: lockedPropertyId } : newFilters;
      setFilters(merged);
      setPagination((prev) => ({ ...prev, page: 1 }));
      updateURL(merged);
    },
    [updateURL, lockedPropertyId]
  );

  // Gestion du filtre KPI (cartes filtrantes)
  const handleKpiFilterChange = useCallback((filterKey: string | null) => {
    if (filterKey === activeKpiFilter) {
      // Si on clique sur la carte déjà active (sauf "solde"), on revient à "solde"
      if (filterKey !== 'solde') {
        setActiveKpiFilter('solde');
      }
      // Si on clique sur "solde" déjà actif, on ne fait rien
    } else {
      // On active la nouvelle carte
      setActiveKpiFilter(filterKey);
    }
    setPagination(prev => ({ ...prev, page: 1 }));
    // ⚠️ CRITIQUE: Ne pas incrémenter refreshKey lors des changements de cartes KPI
    // Les hooks KPI/Charts se recalculeront automatiquement via leurs dépendances (activeKpiFilter est passé via useTransactionsData)
  }, [activeKpiFilter]);

  const clearPortfolioPilotageFocus = useCallback(() => {
    setActiveKpiFilter('solde');
    setFilters((prev) => {
      const next: TransactionsFilters = {
        ...prev,
        hasDocument: '',
        ...(lockedPropertyId !== '' ? { propertyId: lockedPropertyId } : {}),
      };
      setPagination((p) => ({ ...p, page: 1 }));
      updateURL(next);
      return next;
    });
  }, [lockedPropertyId, updateURL]);

  const handleTogglePilotageSansDocument = useCallback(() => {
    setFilters((prev) => {
      const nextHas = prev.hasDocument === 'false' ? '' : 'false';
      const merged: TransactionsFilters =
        lockedPropertyId !== ''
          ? { ...prev, hasDocument: nextHas, propertyId: lockedPropertyId }
          : { ...prev, hasDocument: nextHas };
      setPagination((p) => ({ ...p, page: 1 }));
      updateURL(merged);
      return merged;
    });
  }, [lockedPropertyId, updateURL]);

  const handleTogglePilotageNonRapprochees = useCallback(() => {
    handleKpiFilterChange('nonRapprochees');
  }, [handleKpiFilterChange]);

  const handleResetFilters = useCallback(() => {
    const resetFilters: TransactionsFilters = {
      search: '',
      propertyId: lockedPropertyId || '',
      leaseId: '',
      tenantId: '',
      natureId: '',
      categoryId: '',
      amountMin: '',
      amountMax: '',
      dateFrom: '',
      dateTo: '',
      paidAtFrom: '',
      paidAtTo: '',
      status: '',
      hasDocument: '',
      includeManagementFees: true,
      groupByParent: true,
      includeArchived: false,
    };

    setFilters(resetFilters);
    setPagination((prev) => ({ ...prev, page: 1 }));
    updateURL(resetFilters);
    if (mode === 'app-shell' && isPropertyScoped && typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.has('leaseId')) {
        params.delete('leaseId');
        router.replace(`/app?${params.toString()}`, { scroll: false });
      }
    }
  }, [updateURL, lockedPropertyId, mode, isPropertyScoped, router]);

  const handleClearLeaseUrlFilter = useCallback(() => {
    setFilters((prev) => ({ ...prev, leaseId: '' }));
    setPagination((prev) => ({ ...prev, page: 1 }));
    if (!isPropertyScoped || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has('leaseId')) return;
    params.delete('leaseId');
    router.replace(`/app?${params.toString()}`, { scroll: false });
  }, [isPropertyScoped, router]);

  // Gestion du filtre de période
  const handlePeriodChange = useCallback((start: string, end: string) => {
    setPeriodStart(start);
    setPeriodEnd(end);
    // ⚠️ CRITIQUE: Ne pas incrémenter refreshKey lors des changements de période
    // Les hooks KPI/Charts se recalculeront automatiquement via leurs dépendances (periodStart, periodEnd)
  }, []);

  // Gestion de la pagination
  const handlePageChange = useCallback((page: number) => {
    setPagination(prev => ({ ...prev, page }));
  }, []);

  // Gestion des actions sur les transactions
  const handleCreateTransaction = useCallback(() => {
    setModalMode('create');
    setSelectedTransaction(null);
    setIsModalOpen(true);
  }, []);

  const handleAirbnbImportSuccess = useCallback(async () => {
    window.dispatchEvent(new CustomEvent('transactions:refresh'));
    if (mode === 'app-shell' && organizationId) {
      try {
        await getGlobalSyncService().syncEntityFromRemoteByName('transaction', organizationId);
        window.dispatchEvent(new CustomEvent('sync:refresh'));
      } catch (e) {
        console.error('[TransactionsPageCore] Sync transactions après import Airbnb:', e);
      }
    }
  }, [mode, organizationId]);

  // Définir les actions dans PropertyHeaderActionsContext si hideTitle est true et que le contexte est disponible
  useEffect(() => {
    if (hideTitle && setHeaderActions) {
      const actionButtons = (
        <div className="flex items-center gap-2">
          {showAirbnbImport && lockedPropertyId ? (
            <AirbnbImportButton
              propertyId={lockedPropertyId}
              propertyName={airbnbPropertyName || 'Bien'}
              onImportSuccess={handleAirbnbImportSuccess}
            />
          ) : null}
          <button
            onClick={handleCreateTransaction}
            className="inline-flex items-center justify-center h-8 w-8 text-orange-600 border border-orange-200 rounded-lg bg-white hover:bg-gradient-to-r hover:from-orange-500 hover:to-red-500 hover:text-white transition-all duration-300 ease-out focus:outline-none"
            aria-label="Nouvelle Transaction"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              // ✅ Utiliser navigateToView pour nettoyer les params property-scoped
              navigateToView('biens');
            }}
            className="inline-flex items-center justify-center h-8 w-8 text-orange-600 border border-orange-200 rounded-lg bg-white hover:bg-gradient-to-r hover:from-orange-500 hover:to-red-500 hover:text-white transition-all duration-300 ease-out focus:outline-none"
            aria-label="Liste des biens"
          >
            <Home className="h-4 w-4" />
          </button>
        </div>
      );
      setHeaderActions(actionButtons);
      
      return () => {
        setHeaderActions(null);
      };
    }
  }, [
    hideTitle,
    setHeaderActions,
    handleCreateTransaction,
    handleAirbnbImportSuccess,
    showAirbnbImport,
    lockedPropertyId,
    airbnbPropertyName,
  ]);

  const handleEditTransaction = useCallback((transaction: Transaction) => {
    setModalMode('edit');
    setSelectedTransaction(transaction);
    setIsModalOpen(true);
  }, []);

  const handleDeleteTransaction = useCallback(async (transaction: Transaction) => {
    // ⚠️ UX: Ouvrir la modal immédiatement avec un loader (comme pour la suppression multiple)
    setTransactionToDelete(transaction);
    setShowDeleteTransactionModal(true);
    setIsLoadingDeleteTransaction(true);
    setTransactionHasDocuments(false); // Sera mis à jour après vérification
    
    try {
      if (mode === 'app-shell' || !navigator.onLine) {
        // ⚠️ PROBLÈME 2: En mode app-shell, vérifier les documents depuis IndexedDB
        let hasDocuments = false;
        if (mode === 'app-shell' && organizationId) {
          try {
            const { getLocalDB } = await import('@/lib/offline/db');
            const db = await getLocalDB();
            // Récupérer les liens de documents pour cette transaction
            const allLinks = await db.DocumentLink.toArray();
            const links = allLinks.filter(link => 
              link.linkedType.toLowerCase() === 'transaction' && link.linkedId === transaction.id
            );
            hasDocuments = links.length > 0;
          } catch (error) {
            // En cas d'erreur, on suppose qu'il n'y a pas de documents
            hasDocuments = false;
          }
        }
        
        setTransactionHasDocuments(hasDocuments);
        setIsLoadingDeleteTransaction(false);
        return;
      }

      const response = await fetch(`/api/transactions/${transaction.id}`);
      const data = await response.json();
      const hasDocuments = data.documents && data.documents.length > 0;
      
      setTransactionHasDocuments(hasDocuments);
      setIsLoadingDeleteTransaction(false);
    } catch (error) {
      // Erreur silencieuse - on suppose qu'il n'y a pas de documents
      setTransactionHasDocuments(false);
      setIsLoadingDeleteTransaction(false);
    }
  }, [mode, organizationId]);

  const handleDeleteTransactionConfirmed = useCallback(async (deleteMode: 'delete_docs' | 'keep_docs_globalize' | 'unlink_only') => {
    if (!transactionToDelete) return;
    
    try {
      if (mode === 'app-shell' || !navigator.onLine) {
        // Mode app-shell ou offline : utiliser TransactionService
        const transactionService = createTransactionServiceWithMode('app-shell');
        
        const result = await transactionService.deleteTransaction(transactionToDelete.id, {
          mode: deleteMode,
        });
        
        const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
        
        // ⚠️ CRITIQUE: Si online, pousser immédiatement les pendingOps vers Supabase
        if (isOnline) {
          try {
            const syncService = getGlobalSyncService();
            await syncService.syncAllPendingToRemote(organizationId);
            
            let message = 'La transaction a été supprimée localement et sur le serveur.';
            if (deleteMode === 'delete_docs' && result.documentsAffected > 0) {
              message += `\n${result.documentsAffected} document${result.documentsAffected > 1 ? 's' : ''} supprimé${result.documentsAffected > 1 ? 's' : ''}.`;
            }
            
            await showAlert({
              type: 'success',
              title: 'Transaction supprimée',
              message,
            });
          } catch (syncError) {
            // Error syncing delete transaction operation - log supprimé
            let message = 'La transaction a été supprimée localement.\nLa suppression sera synchronisée avec le serveur lors de la prochaine synchronisation.';
            if (deleteMode === 'delete_docs' && result.documentsAffected > 0) {
              message += `\n${result.documentsAffected} document${result.documentsAffected > 1 ? 's' : ''} supprimé${result.documentsAffected > 1 ? 's' : ''} localement.`;
            }
            
            await showAlert({
              type: 'success',
              title: 'Transaction supprimée localement',
              message,
            });
          }
        } else {
          let message = 'La transaction a été supprimée localement.\nLa suppression sera automatiquement synchronisée avec le serveur dès que la connexion sera rétablie.';
          if (deleteMode === 'delete_docs' && result.documentsAffected > 0) {
            message += `\n${result.documentsAffected} document${result.documentsAffected > 1 ? 's' : ''} supprimé${result.documentsAffected > 1 ? 's' : ''} localement.`;
          }
          
          await showAlert({
            type: 'success',
            title: 'Transaction supprimée (mode hors-ligne)',
            message,
          });
        }

        if (mode === 'app-shell') {
          dispatchTransactionsLocalRefresh({
            scope: 'property',
            propertyId: propPropertyId || initialPropertyId || filters.propertyId,
            reason: 'crud-delete-one',
            patch: { action: 'delete', ids: [transactionToDelete.id] },
          });
          if (deleteMode === 'delete_docs' || deleteMode === 'unlink_only') {
            window.dispatchEvent(new CustomEvent('documents:refresh'));
          }
        }
      } else {
        // Mode normal online : utiliser l'API
        const url = `/api/transactions/${transactionToDelete.id}?mode=${deleteMode}`;
        const response = await fetch(url, {
          method: 'DELETE'
        });

        if (!response.ok) {
          throw new Error('Erreur lors de la suppression');
        }

        if (deleteMode === 'delete_docs') {
          notify2.success('Transaction et documents supprimés');
        } else if (deleteMode === 'unlink_only') {
          notify2.success('Transaction supprimée ; liaisons avec les documents retirées');
        } else {
          notify2.success('Transaction supprimée, documents conservés');
        }
        
        if (mode === 'normal' && router) {
          router.refresh();
        }
      }
      
      setTransactionToDelete(null);
      setShowDeleteTransactionModal(false);
      setIsLoadingDeleteTransaction(false);
    } catch (error) {
      // Erreur lors de la suppression - log supprimé
      notify2.error('Erreur lors de la suppression de la transaction');
    }
  }, [mode, transactionToDelete, organizationId, showAlert, router]);

  // Fonction pour récupérer toutes les IDs des transactions correspondant aux filtres
  const loadAllTransactionIds = useCallback(async (): Promise<string[]> => {
    try {
      if (mode === 'app-shell') {
        // En mode app-shell, retourner les IDs des transactions filtrées
        return transactions.map(t => t.id);
      }

      const params = new URLSearchParams();
      
      // Ajouter les filtres (sauf status qui sera géré par activeKpiFilter)
      Object.entries(filters).forEach(([key, value]) => {
        if (value && key !== 'status') params.append(key, value);
      });

      // Appliquer le filtre KPI actif
      if (activeKpiFilter === 'recettes') {
        params.append('flow', 'INCOME');
      } else if (activeKpiFilter === 'depenses') {
        params.append('flow', 'EXPENSE');
      } else if (activeKpiFilter === 'nonRapprochees') {
        params.append('status', 'non_rapprochee');
      }

      // Ajouter la période au format comptable
      params.append('accountingMonthStart', periodStart);
      params.append('accountingMonthEnd', periodEnd);

      // Récupérer toutes les transactions (limite très élevée)
      params.append('page', '1');
      params.append('limit', '10000');

      const response = await fetch(`/api/transactions?${params.toString()}`);
      const data = await response.json();

      // Appliquer le filtre includeManagementFees comme dans l'affichage
      let allTransactions = data.data || [];
      if (!filters.includeManagementFees) {
        allTransactions = allTransactions.filter((t: Transaction) => t.autoSource !== 'gestion');
      }

      return allTransactions.map((t: Transaction) => t.id);
    } catch (error) {
      // Erreur silencieuse
      // En cas d'erreur, retourner les IDs des transactions visibles
      return transactions.map(t => t.id);
    }
  }, [mode, filters, periodStart, periodEnd, activeKpiFilter, transactions]);

  // Gestion de la sélection
  const handleSelectTransaction = useCallback((id: string) => {
    // ⚠️ PROBLÈME 1: Empêcher la sélection des commissions auto (supprimées en cascade)
    const transaction = transactions.find(t => t.id === id);
    const isAutoCommission = (t: Transaction): boolean => {
      return (
        t.isAuto === true &&
        t.autoSource === 'gestion' &&
        t.parentTransactionId !== null &&
        t.parentTransactionId !== undefined
      );
    };
    
    if (transaction && isAutoCommission(transaction)) {
      // Ne pas sélectionner les commissions auto
      return;
    }
    
    setSelectedTransactionIds(prev => 
      prev.includes(id) 
        ? prev.filter(transId => transId !== id)
        : [...prev, id]
    );
  }, [transactions]);

  const handleSelectAll = useCallback(async (selected: boolean) => {
    if (selected) {
      // ⚠️ PROBLÈME 1: Exclure les commissions auto de la sélection
      // Helper pour identifier les commissions auto
      const isAutoCommission = (t: Transaction): boolean => {
        return (
          t.isAuto === true &&
          t.autoSource === 'gestion' &&
          t.parentTransactionId !== null &&
          t.parentTransactionId !== undefined
        );
      };
      
      // Récupérer toutes les IDs des transactions correspondant aux filtres
      const allIds = await loadAllTransactionIds();
      
      // Filtrer les commissions auto
      const selectableIds = allIds.filter(id => {
        const transaction = transactions.find(t => t.id === id);
        return !transaction || !isAutoCommission(transaction);
      });
      
      setSelectedTransactionIds(selectableIds);
    } else {
      setSelectedTransactionIds([]);
    }
  }, [loadAllTransactionIds, transactions]);

  const handleDeleteMultipleTransactions = useCallback(async () => {
    // ⚠️ PROBLÈME 1: Filtrer automatiquement les commissions auto (supprimées en cascade)
    // Helper pour identifier les commissions auto
    const isAutoCommission = (t: Transaction): boolean => {
      return (
        t.isAuto === true &&
        t.autoSource === 'gestion' &&
        t.parentTransactionId !== null &&
        t.parentTransactionId !== undefined
      );
    };
    
    // Filtrer les commissions auto de la sélection
    const selectableTransactionIds = selectedTransactionIds.filter(id => {
      const transaction = transactions.find(t => t.id === id);
      return !transaction || !isAutoCommission(transaction);
    });
    
    // Afficher un avertissement si des commissions auto ont été filtrées
    const filteredCount = selectedTransactionIds.length - selectableTransactionIds.length;
    if (filteredCount > 0) {
      notify2.info(`${filteredCount} commission${filteredCount > 1 ? 's' : ''} auto exclue${filteredCount > 1 ? 's' : ''} de la sélection (supprimée${filteredCount > 1 ? 's' : ''} automatiquement avec le parent)`);
    }
    
    // Récupérer toutes les transactions sélectionnées (même celles non visibles)
    setIsLoadingDeleteModal(true);
    try {
      if (mode === 'app-shell' || !navigator.onLine) {
        // En mode app-shell, utiliser directement les transactions sélectionnées (après filtrage)
        const validTransactions = transactions.filter(t => selectableTransactionIds.includes(t.id));
        setTransactionsToDelete(validTransactions);
        setShowDeleteMultipleModal(true);
      } else {
        // Charger les détails des transactions sélectionnées pour la confirmation (après filtrage)
        const transactionDetails = await Promise.all(
          selectableTransactionIds.map(async (id) => {
            try {
              const response = await fetch(`/api/transactions/${id}`);
              if (response.ok) {
                return await response.json();
              }
              return null;
            } catch (error) {
              // Erreur silencieuse
              return null;
            }
          })
        );
        
        // Filtrer les transactions valides (celles qui existent encore)
        const validTransactions = transactionDetails.filter(t => t !== null) as Transaction[];
        setTransactionsToDelete(validTransactions);
        setShowDeleteMultipleModal(true);
      }
    } catch (error) {
      // Erreur silencieuse
      notify2.error('Erreur lors de la préparation de la suppression');
    } finally {
      setIsLoadingDeleteModal(false);
    }
  }, [selectedTransactionIds, mode, transactions]);

  const handleDeleteMultipleConfirmed = useCallback(async (modeDelete: 'delete_docs' | 'keep_docs_globalize' | 'unlink_only') => {
    // ⚠️ PROBLÈME 1: Filtrer automatiquement les commissions auto AVANT suppression
    // (protection supplémentaire, même si elles ne devraient plus être dans transactionsToDelete)
    const isAutoCommission = (t: Transaction): boolean => {
      return (
        t.isAuto === true &&
        t.autoSource === 'gestion' &&
        t.parentTransactionId !== null &&
        t.parentTransactionId !== undefined
      );
    };
    
    const transactionsToDeleteFiltered = transactionsToDelete.filter(t => !isAutoCommission(t));
    const filteredCount = transactionsToDelete.length - transactionsToDeleteFiltered.length;
    
    if (filteredCount > 0) {
      // Commissions auto exclues - log supprimé
    }
    
    const total = transactionsToDeleteFiltered.length;
    // Début suppression multiple - log supprimé
    setDeletingProgress({ current: 0, total });
    
    try {
      if (mode === 'app-shell' || !navigator.onLine) {
        // Mode app-shell ou offline : utiliser TransactionService
        const transactionService = createTransactionServiceWithMode('app-shell');
        
        // Supprimer chaque transaction via le service (gère cascade, documents, etc.)
        // Traitement séquentiel pour mettre à jour le progrès et gérer les erreurs individuellement
        let deletedCount = 0;
        let errorCount = 0;
        const deletedIds: string[] = [];
        
        for (let i = 0; i < transactionsToDeleteFiltered.length; i++) {
          try {
            // Suppression transaction - log supprimé
            await transactionService.deleteTransaction(transactionsToDeleteFiltered[i].id, { mode: modeDelete });
            deletedCount++;
            deletedIds.push(transactionsToDeleteFiltered[i].id);
            // Transaction supprimée avec succès - log supprimé
          } catch (error) {
            // Erreur lors de la suppression de la transaction - log supprimé
            errorCount++;
          }
          
          // Mettre à jour le progrès
          setDeletingProgress({ current: i + 1, total });
        }
        
        // Suppressions terminées - log supprimé

        const closeDeleteMultipleModal = () => {
          setTransactionsToDelete([]);
          setSelectedTransactionIds([]);
          setDeletingProgress(null);
          setShowDeleteMultipleModal(false);
        };

        if (mode === 'app-shell' && deletedIds.length > 0) {
          dispatchTransactionsLocalRefresh({
            scope: 'property',
            propertyId: propPropertyId || initialPropertyId || filters.propertyId,
            reason: 'crud-delete-multiple',
            patch: { action: 'delete', ids: deletedIds },
          });
        }

        const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
        
        // ⚠️ CRITIQUE: Si online, pousser immédiatement les pendingOps vers Supabase
        if (isOnline && deletedCount > 0) {
          try {
            const syncService = getGlobalSyncService();
            await syncService.syncAllPendingToRemote(organizationId);
            
            // ⚠️ PROBLÈME 1: Ne pas afficher d'erreur si toutes les suppressions locales ont réussi
            // Les 404 lors de la sync sont traités comme succès (entité déjà supprimée)
            let message = `${deletedCount} transaction${deletedCount > 1 ? 's' : ''} supprimée${deletedCount > 1 ? 's' : ''} localement et sur le serveur.`;
            // ⚠️ On n'affiche une erreur que si la suppression locale a échoué
            if (errorCount > 0) {
              message += `\n${errorCount} erreur${errorCount > 1 ? 's' : ''} lors de la suppression locale.`;
            }
            
            closeDeleteMultipleModal();
            // Afficher l'alerte de manière non bloquante
            showAlert({
              type: 'success',
              title: 'Transactions supprimées',
              message,
            }).catch(console.error);
          } catch (syncError) {
            // Error syncing delete operations - log supprimé
            let message = `${deletedCount} transaction${deletedCount > 1 ? 's' : ''} supprimée${deletedCount > 1 ? 's' : ''} localement.\nLa suppression sera synchronisée avec le serveur lors de la prochaine synchronisation.`;
            if (errorCount > 0) {
              message += `\n${errorCount} erreur${errorCount > 1 ? 's' : ''} lors de la suppression.`;
            }

            closeDeleteMultipleModal();
            showAlert({
              type: 'success',
              title: 'Transactions supprimées localement',
              message,
            }).catch(console.error);
          }
        } else {
          let message = `${deletedCount} transaction${deletedCount > 1 ? 's' : ''} supprimée${deletedCount > 1 ? 's' : ''} localement.\nElles seront automatiquement synchronisées avec le serveur dès que la connexion sera rétablie.`;
          if (errorCount > 0) {
            message += `\n${errorCount} erreur${errorCount > 1 ? 's' : ''} lors de la suppression.`;
          }

          closeDeleteMultipleModal();
          showAlert({
            type: 'success',
            title: 'Transactions supprimées (mode hors-ligne)',
            message,
          }).catch(console.error);
        }
      } else {
        // Mode normal online : utiliser l'API
        let deletedCount = 0;
        let skippedCount = 0;
        
        for (let i = 0; i < transactionsToDelete.length; i++) {
          const transaction = transactionsToDelete[i];
          try {
            const response = await fetch(`/api/transactions/${transaction.id}?mode=${modeDelete}`, {
              method: 'DELETE',
            });
            
            if (response.ok) {
              deletedCount++;
            } else if (response.status === 404 || response.status === 500) {
              // Log supprimé
              skippedCount++;
            } else {
              throw new Error(`Erreur ${response.status} lors de la suppression de la transaction ${transaction.id}`);
            }
          } catch (fetchError) {
            // Erreur silencieuse
            skippedCount++;
          }
          
          // Mettre à jour le progrès
          setDeletingProgress({ current: i + 1, total });
        }
        
        // ✅ FERMER LA MODALE IMMÉDIATEMENT après les suppressions (avant les notifications qui peuvent bloquer)
        // Nettoyage des états et fermeture de la modale (mode normal) - log supprimé
        setTransactionsToDelete([]);
        setSelectedTransactionIds([]);
        setDeletingProgress(null);
        setShowDeleteMultipleModal(false);
        
        const totalSelected = transactionsToDelete.length;
        if (deletedCount > 0 || skippedCount > 0) {
          notify2.success(`${totalSelected} transaction${totalSelected > 1 ? 's' : ''} supprimée${totalSelected > 1 ? 's' : ''}`);
        }
        if (skippedCount > 0) {
          // Log supprimé
        }
        
        if (router) {
          router.refresh();
        }
      }
    } catch (error) {
      // Erreur lors de la suppression des transactions - log supprimé
      notify2.error('Erreur lors de la suppression des transactions');
      // ✅ IMPORTANT : Nettoyer les états même en cas d'erreur pour fermer la modale
      // Nettoyage des états en cas d'erreur - log supprimé
      setDeletingProgress(null);
      setTransactionsToDelete([]);
      setSelectedTransactionIds([]);
      setShowDeleteMultipleModal(false);
      // Fin (erreur) - log supprimé
    }
  }, [transactionsToDelete, mode, organizationId, showAlert, router]);

  const handleViewDocument = useCallback((documentId: string, documentName: string) => {
    window.open(`/api/documents/${documentId}/file`, '_blank');
  }, []);

  const handleRowClick = useCallback(async (transaction: Transaction) => {
    // Activer l'animation de chargement sur la ligne
    setLoadingTransactionId(transaction.id);
    
    if (mode === 'app-shell' || !navigator.onLine) {
      // En mode app-shell, utiliser directement les données du tableau
      setSelectedTransaction(transaction);
      setIsDrawerOpen(true);
      setTimeout(() => {
        setLoadingTransactionId(null);
      }, 300);
      return;
    }

    // Charger les détails de la transaction avec les documents
    try {
      const response = await fetch(`/api/transactions/${transaction.id}`);
      const data = await response.json();
      setSelectedTransaction(data);
      setIsDrawerOpen(true);
    } catch (error) {
      // Erreur silencieuse
      // En cas d'erreur, utiliser les données du tableau
      setSelectedTransaction(transaction);
      setIsDrawerOpen(true);
    } finally {
      // Désactiver l'animation de chargement après un court délai pour que l'animation soit visible
      setTimeout(() => {
        setLoadingTransactionId(null);
      }, 300);
    }
  }, [mode]);

  const openTransactionForRapprochement = useCallback(
    (id: string) => {
      const tx =
        sortedAllTransactions.find((t) => t.id === id) ?? allTransactions.find((t) => t.id === id);
      if (tx) {
        setScrollToDocuments(false);
        setScrollToRapprochement(true);
        void handleRowClick(tx);
        return;
      }
      notify2.warning(
        'Transaction introuvable',
        'Élargissez la période ou ouvrez le détail depuis le tableau.'
      );
    },
    [sortedAllTransactions, allTransactions, handleRowClick]
  );

  const scrollToTransactionsTable = useCallback(() => {
    setTransactionsDetailOpen(true);
    setTimeout(() => {
      document.getElementById('transactions-global-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
  }, []);

  // ⚠️ OPTION B - UX: Helper pour vérifier si une transaction est éligible à une commission
  const checkTransactionEligibleForCommission = useCallback(async (
    transaction: any,
    params: {
      propertyId: string;
      organizationId: string;
      gestionEnabled?: boolean;
      gestionCodes?: { rentNature?: string; mgmtCategory?: string };
      montantLoyer?: number;
      chargesRecup?: number;
      factures?: Array<{ montant: number }>;
    }
  ): Promise<boolean> => {
    // Vérifier si gestion déléguée est activée
    if (params.gestionEnabled === false) return false;
    
    // Vérifier que c'est un loyer
    const codes = params.gestionCodes || {};
    const isRentNature =
      transaction.nature === codes.rentNature ||
      transaction.nature?.includes('LOYER') ||
      transaction.nature?.includes('RECETTE_LOYER');
    
    if (!isRentNature || !params.montantLoyer || params.montantLoyer <= 0) {
      return false;
    }
    
    // Vérifier que le bien a une société de gestion active
    try {
      const propertyRepo = getPropertyRepositoryOffline();
      const propertyWithCompany = await propertyRepo.findFirstWithManagementCompany({
        id: params.propertyId,
        organizationId: params.organizationId,
      });
      
      if (!propertyWithCompany?.ManagementCompany || !propertyWithCompany.ManagementCompany.actif) {
        return false;
      }
      
      const company = propertyWithCompany.ManagementCompany;
      
      // Calculer la commission pour vérifier qu'elle serait > 0
      const { commissionTTC: commissionBase } = calcCommission({
        montantLoyer: params.montantLoyer,
        chargesRecup: params.chargesRecup || 0,
        modeCalcul: (company.modeCalcul || 'LOYERS_UNIQUEMENT') as any,
        taux: company.taux || 0,
        fraisMin: company.fraisMin ?? undefined,
        tvaApplicable: company.tvaApplicable || false,
        tauxTva: company.tauxTva ?? undefined,
      });
      
      const montantFactures = params.factures?.reduce((sum, f) => sum + f.montant, 0) || 0;
      const commissionTTC = commissionBase + montantFactures;
      
      return commissionTTC > 0;
    } catch (error) {
      // En cas d'erreur, ne pas bloquer, retourner false
      return false;
    }
  }, []);

  const handleModalSubmit = useCallback(async (data: any) => {
    const endModal = txPerfMeasureZone('tx:handleModalSubmit');
    try {
      await txHotPathDebugLog(`[TransactionsPageCore] 📎 handleModalSubmit appelé avec stagedLinkItemIds: ${data.stagedLinkItemIds?.length || 0} - IDs: ${data.stagedLinkItemIds?.join(', ') || 'aucun'}`);
    // ⚠️ PROBLÈME 3: Cette fonction est appelée depuis TransactionModal
    // TransactionModal gère déjà son état isSubmitting et affiche "Enregistrement..."
    // On garde la modal ouverte pendant push+pull pour que l'utilisateur voie le chargement
      if (mode === 'app-shell' || !navigator.onLine) {
        // Mode app-shell ou offline : utiliser TransactionService
        // ✅ IMPORT STATIQUE : Ne pas utiliser dynamic import en offline (ChunkLoadError)
        const transactionService = createTransactionServiceWithMode('app-shell');
        const orgId = organizationId;
        
        if (!orgId) {
          throw new Error('OrganizationId requis');
        }
        
        if (modalMode === 'edit' && selectedTransaction) {
          // Mode édition : utiliser updateTransaction
          // ⚠️ CORRECTION: Normaliser paymentDate/paymentMethod en paidAt/method pour l'API
          // (le formulaire utilise paymentDate/paymentMethod, mais l'API attend paidAt/method)
          // Le formulaire normalise déjà paymentDate -> paidAt et paymentMethod -> method dans submitFormDirectly
          // donc on peut utiliser directement data.paidAt et data.method s'ils existent, sinon data.paymentDate et data.paymentMethod
          // ⚠️ CRITIQUE: Utiliser !== undefined pour détecter la présence du champ, même si la valeur est vide
          const normalizedPaidAt = (data as any).paidAt !== undefined ? (data as any).paidAt : ((data as any).paymentDate !== undefined ? ((data as any).paymentDate || null) : undefined);
          // ⚠️ CRITIQUE POUR METHOD: Si paymentMethod est présent (même vide ""), le convertir en null ou la valeur
          // Si method est déjà présent, l'utiliser (normalisé par le formulaire)
          // Sinon, si paymentMethod est présent, l'utiliser (chaîne vide "" devient null)
          const normalizedMethod = (data as any).method !== undefined 
            ? (data as any).method 
            : ((data as any).paymentMethod !== undefined 
              ? ((data as any).paymentMethod || null) // "" devient null
              : undefined);
          
          await txHotPathDebugLog(`[TransactionsPageCore] 🔍 DEBUG payment fields: data.paidAt=${(data as any).paidAt}, data.paymentDate=${(data as any).paymentDate}, normalizedPaidAt=${normalizedPaidAt}`);
          await txHotPathDebugLog(`[TransactionsPageCore] 🔍 DEBUG method: data.method=${(data as any).method}, data.paymentMethod=${(data as any).paymentMethod}, normalizedMethod=${normalizedMethod}`);
          
          const updateParams: any = {};
          
          // ⚠️ CRITIQUE: Inclure TOUS les champs modifiés, même s'ils sont null (pour permettre la suppression)
          // Utiliser !== undefined pour distinguer "champ présent mais vide" de "champ absent"
          if (data.propertyId !== undefined) updateParams.propertyId = data.propertyId;
          if (data.leaseId !== undefined) updateParams.leaseId = data.leaseId || null;
          if (data.bailId !== undefined) updateParams.bailId = data.bailId || null;
          else if (data.leaseId !== undefined) updateParams.bailId = data.leaseId || null;
          if (data.categoryId !== undefined) updateParams.categoryId = data.categoryId;
          if (data.nature !== undefined) {
            updateParams.nature = data.nature;
            updateParams.natureId = data.nature;
          }
          if (data.label !== undefined) updateParams.label = data.label || 'Transaction';
          if (data.amount !== undefined) updateParams.amount = data.amount;
          if (data.date !== undefined) updateParams.date = data.date;
          if (data.reference !== undefined) updateParams.reference = data.reference || null;
          if (data.notes !== undefined) updateParams.notes = data.notes || null;
          if (normalizedPaidAt !== undefined) {
            updateParams.paidAt = normalizedPaidAt;
            await txHotPathDebugLog(`[TransactionsPageCore] ✅ paidAt inclus dans updateParams: ${normalizedPaidAt}`);
          }
          if (normalizedMethod !== undefined) {
            updateParams.method = normalizedMethod;
            await txHotPathDebugLog(`[TransactionsPageCore] ✅ method inclus dans updateParams: ${normalizedMethod}`);
          }
          if (data.accountingMonth !== undefined) updateParams.accountingMonth = data.accountingMonth || null;
          if (data.monthsCovered !== undefined) updateParams.monthsCovered = data.monthsCovered;
          if (data.rapprochementStatus !== undefined) updateParams.rapprochementStatus = data.rapprochementStatus;
          if (data.bankRef !== undefined) updateParams.bankRef = data.bankRef || null;
          if (data.montantLoyer !== undefined) updateParams.montantLoyer = data.montantLoyer || null;
          if (data.chargesRecup !== undefined) updateParams.chargesRecup = data.chargesRecup !== null && data.chargesRecup !== '' ? Number(data.chargesRecup) : null;
          if (data.chargesNonRecup !== undefined) updateParams.chargesNonRecup = data.chargesNonRecup !== null && data.chargesNonRecup !== '' ? Number(data.chargesNonRecup) : null;
          if (data.isAutoAmount !== undefined) updateParams.isAutoAmount = data.isAutoAmount;
          if (data.stagedDocumentIds !== undefined) updateParams.stagedDocumentIds = data.stagedDocumentIds || [];
          if (data.stagedLinkItemIds !== undefined) updateParams.stagedLinkItemIds = data.stagedLinkItemIds || [];
          
          // Paramètres pour la gestion déléguée
          updateParams.gestionEnabled = gestionEnabled;
          updateParams.gestionCodes = gestionCodes ? {
              rentNature: gestionCodes.rentNature,
              mgmtNature: gestionCodes.mgmtNature,
              mgmtCategory: gestionCodes.mgmtCategory,
            } : {
              rentNature: 'RECETTE_LOYER',
              mgmtNature: 'DEPENSE_GESTION',
              mgmtCategory: 'frais-gestion',
          };
            // ⚠️ OPTION B: En mode app-shell, ne pas créer les commissions auto localement
            // Le serveur créera la commission lors de la sync (server-only creation)
          updateParams.skipAutoCommissions = mode === 'app-shell';
          
          const updateResult = await transactionService.updateTransaction(selectedTransaction.id, updateParams);
          
          // ⚠️ APP-SHELL OFFLINE-FIRST : Pas de refresh, les données sont déjà dans IndexedDB
          const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
          
          // Push des pendingOps en arrière-plan si online (non bloquant)
          if (isOnline) {
            try {
              const syncService = getGlobalSyncService();
              syncService.syncAllPendingToRemote(organizationId).catch(() => {
                // Erreur non bloquante, la pendingOp sera sync plus tard
              });
            } catch (syncError) {
              // Ignorer les erreurs de sync, non bloquant
            }
          }
          
          // Fermer la modal et afficher le toast
          setIsModalOpen(false);
          notify2.success('Transaction modifiée');
          
          const scopePid = propPropertyId || initialPropertyId || filters.propertyId;
          dispatchTransactionsLocalRefresh({
            scope: 'property',
            propertyId: scopePid,
            reason: 'crud-update',
            patch: { action: 'upsert', rows: [updateResult.transaction as unknown as LocalTransaction] },
          });
          return;
        } else {
          // Mode création : utiliser createTransaction
          const params = {
            organizationId: orgId,
            propertyId: data.propertyId,
            leaseId: data.leaseId || null,
            bailId: data.bailId || data.leaseId || null,
            categoryId: data.categoryId,
            nature: data.nature,
            natureId: data.nature,
            label: data.label || 'Transaction',
            amount: data.amount,
            date: data.date,
            reference: data.reference || null,
            notes: data.notes || null,
            paidAt: data.paidAt || null,
            method: data.method || null,
            accountingMonth: data.accountingMonth || null,
            periodStart: data.periodStart || null,
            periodMonth: data.periodMonth ? parseInt(data.periodMonth) : null,
            periodYear: data.periodYear || null,
            monthsCovered: data.monthsCovered || 1,
            rapprochementStatus: data.rapprochementStatus || 'non_rapprochee',
            bankRef: data.bankRef || null,
            montantLoyer: data.montantLoyer ?? null,
            chargesRecup: data.chargesRecup !== undefined && data.chargesRecup !== null ? Number(data.chargesRecup) : null,
            chargesNonRecup: data.chargesNonRecup !== undefined && data.chargesNonRecup !== null ? Number(data.chargesNonRecup) : null,
            isAutoAmount: data.isAutoAmount ?? null,
            stagedDocumentIds: data.stagedDocumentIds || [],
            stagedLinkItemIds: data.stagedLinkItemIds || [],
            factures: data.factures || undefined,
            gestionEnabled: gestionEnabled,
            gestionCodes: gestionCodes ? {
              rentNature: gestionCodes.rentNature,
              mgmtNature: gestionCodes.mgmtNature,
              mgmtCategory: gestionCodes.mgmtCategory,
            } : {
              // Valeurs par défaut si gestionCodes n'est pas chargé (offline sans cache)
              rentNature: 'RECETTE_LOYER',
              mgmtNature: 'DEPENSE_GESTION',
              mgmtCategory: 'frais-gestion',
            },
            // ⚠️ OPTION B: En mode app-shell, ne pas créer les commissions auto localement
            // Le serveur créera la commission lors de la sync (server-only creation)
            skipAutoCommissions: mode === 'app-shell',
          };
          
          await txHotPathDebugLog(`[TransactionsPageCore] 📎 createTransaction params.stagedLinkItemIds: ${params.stagedLinkItemIds?.length || 0} - IDs: ${params.stagedLinkItemIds?.join(', ') || 'aucun'}`);
          
          const result = await transactionService.createTransaction(params);
          
          // Gérer le résultat (peut contenir plusieurs transactions si multi-mois)
          const totalCreated = result.totalCreated || 1;
          const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
          
          // ⚠️ OPTION B - UX: Vérifier si les transactions créées sont éligibles à une commission
          // Si oui, ajouter leurs IDs au state pour afficher un placeholder
          if (mode === 'app-shell' && result.transaction) {
            const createdTransactions = result.allTransactions || [result.transaction];
            const eligibleIds: string[] = [];
            
            for (const tx of createdTransactions) {
              const isEligible = await checkTransactionEligibleForCommission(tx, {
                propertyId: params.propertyId,
                organizationId: orgId,
                gestionEnabled: gestionEnabled,
                gestionCodes: gestionCodes,
                montantLoyer: params.montantLoyer || undefined,
                chargesRecup: params.chargesRecup || undefined,
                factures: params.factures,
              });
              
              if (isEligible) {
                eligibleIds.push(tx.id);
              }
            }
            
            // Ajouter les IDs éligibles au state (placeholder sera affiché)
            if (eligibleIds.length > 0) {
              setPendingCommissionTransactionIds(prev => {
                const newSet = new Set(prev);
                eligibleIds.forEach(id => newSet.add(id));
                return newSet;
              });
            }
          }
          
          // ⚠️ OPTION B: En app-shell online, faire un round-trip pour récupérer la commission créée côté serveur
          if (mode === 'app-shell' && isOnline) {
            try {
              const syncService = getGlobalSyncService();
              
              await txHotPathDebugLog('[TransactionsPageCore] 🔄 Début round-trip : push pendingOps → pull transactions (commissions) → refresh UI');
              
              // 1. Push des pendingOps vers Supabase (transaction mère uniquement, commissions server-only)
              await syncService.syncAllPendingToRemote(organizationId);
              
              // 2. Pull immédiat des transactions pour récupérer les commissions créées côté serveur
              await syncService.syncEntityFromRemoteByName('transaction', organizationId);
              
              const transactionRepo = getTransactionRepositoryOffline();
              const createdTransactionIds = (result.allTransactions?.map((t: any) => t.id) || [result.transaction?.id]).filter(Boolean);
              const scoped = await transactionRepo.getAll(organizationId, { propertyId: params.propertyId });
              const pulledCommissions = scoped.filter(
                (t: any) =>
                  t.isAuto === true &&
                  t.autoSource === 'gestion' &&
                  createdTransactionIds.includes(t.parentTransactionId)
              );

              const freshMain: LocalTransaction[] = [];
              for (const cid of createdTransactionIds) {
                const row = await transactionRepo.getById(cid, organizationId);
                if (row) freshMain.push(row);
              }
              const mergedById = new Map<string, LocalTransaction>();
              for (const r of [...freshMain, ...pulledCommissions]) {
                mergedById.set(r.id, r as LocalTransaction);
              }
              const mergedRows = Array.from(mergedById.values());

              await txHotPathDebugLog(`[TransactionsPageCore] ✅ Round-trip terminé - Commissions récupérées: ${pulledCommissions.length}`);
              
              // ⚠️ OPTION B - UX: Retirer les IDs des transactions créées du state (commissions récupérées)
              if (createdTransactionIds.length > 0) {
                setPendingCommissionTransactionIds(prev => {
                  const newSet = new Set(prev);
                  createdTransactionIds.forEach(id => newSet.delete(id));
                  return newSet;
                });
              }
              
              // 4. Pull aussi les documentLinks si nécessaire
              try {
                await syncService.syncEntityFromRemoteByName('documentLink', organizationId);
              } catch (docSyncError) {
                // Ignorer les erreurs de sync docs, non bloquant
              }
              
              const scopePidRt = propPropertyId || initialPropertyId || filters.propertyId;
              dispatchTransactionsLocalRefresh({
                scope: 'property',
                propertyId: scopePidRt,
                reason: 'create-roundtrip',
                patch: { action: 'upsert', rows: mergedRows },
              });
              window.dispatchEvent(new CustomEvent('documents:refresh', {
                detail: { scope: 'property', propertyId: scopePidRt }
              }));
              
              // Fermer la modal après le round-trip
              setIsModalOpen(false);
              
              // Toast de succès
              let message = `Transaction créée`;
              if (totalCreated > 1) {
                message = `${totalCreated} transactions créées (période multi-mois)`;
              }
              if (pulledCommissions.length > 0) {
                message += `\n${pulledCommissions.length} commission${pulledCommissions.length > 1 ? 's' : ''} récupérée${pulledCommissions.length > 1 ? 's' : ''}`;
              }
              notify2.success(message);
              return;
            } catch (syncError) {
              await txHotPathDebugLog(`[TransactionsPageCore] ⚠️ Erreur lors du round-trip: ${syncError}`, 'warn');
              setIsModalOpen(false);
              notify2.success('Transaction créée localement, commission sera créée lors de la prochaine sync');
              dispatchTransactionsLocalRefresh({
                scope: 'property',
                propertyId: propPropertyId || initialPropertyId || filters.propertyId,
                reason: 'create-roundtrip-fallback',
              });
              return;
            }
          }
          
          // Mode offline ou normal : fermer la modal et afficher le toast
          setIsModalOpen(false);
          
          // Push des pendingOps en arrière-plan si online (non bloquant pour mode normal)
          if (isOnline && mode !== 'app-shell') {
            try {
              const syncService = getGlobalSyncService();
              syncService.syncAllPendingToRemote(organizationId).catch(() => {
                // Erreur non bloquante
              });
            } catch (syncError) {
              // Ignorer
            }
          }
          
          // Toast de succès
          let message = `Transaction créée`;
          if (totalCreated > 1) {
            message = `${totalCreated} transactions créées (période multi-mois)`;
          }
          if (mode === 'app-shell' && !isOnline) {
            message += '\nLa commission sera créée lors de la synchronisation.';
          }
          notify2.success(message);
          
          if (mode === 'app-shell') {
            const scopePidCr = propPropertyId || initialPropertyId || filters.propertyId;
            const createdRows = (result.allTransactions || [result.transaction]) as unknown as LocalTransaction[];
            dispatchTransactionsLocalRefresh({
              scope: 'property',
              propertyId: scopePidCr,
              reason: 'crud-create',
              patch: { action: 'upsert', rows: createdRows },
            });
            window.dispatchEvent(new CustomEvent('documents:refresh', {
              detail: { scope: 'property', propertyId: scopePidCr }
            }));
          }
          return;
        }
      }

      // Mode normal online : utiliser l'API
      const url = modalMode === 'create' 
        ? '/api/transactions' 
        : `/api/transactions/${selectedTransaction?.id}`;
      
      const method = modalMode === 'create' ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        // Gérer spécifiquement les erreurs 409 (doublon détecté)
        if (response.status === 409) {
          const errorData = await response.json();
          // Log supprimé
          
          // Construire les données pour la modal de doublon
          if (errorData.duplicate) {
            setDuplicateData({
              code: 'DUPLICATE_FILE',
              policy: 'block',
              existing: {
                id: errorData.duplicate.id,
                fileName: errorData.duplicate.fileName || 'Document inconnu',
                typeLabel: errorData.duplicate.DocumentType?.label || 'Type inconnu',
                links: errorData.duplicate.links || []
              }
            });
            setShowDuplicateModal(true);
            return; // Arrêter ici, ne pas fermer la modal de transaction
          }
        }
        
        const errorText = await response.text();
        let errorMessage = 'Erreur lors de la sauvegarde';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      
      notify2.success(
        modalMode === 'create' 
          ? 'Transaction créée avec succès' 
          : 'Transaction modifiée avec succès'
      );
      
      setIsModalOpen(false);
      
      if (mode === 'normal' && router) {
        router.refresh();
      }
      
      if (modalMode === 'edit' && isDrawerOpen && result) {
        const updatedTransaction = transactions.find(t => t.id === result.id) || result;
        setSelectedTransaction(updatedTransaction);
      }
    } catch (error) {
      // Erreur silencieuse
      throw error;
    } finally {
      endModal();
    }
  }, [modalMode, selectedTransaction, mode, organizationId, showAlert, router, isDrawerOpen, transactions, gestionEnabled, gestionCodes]);

  // États de chargement et erreur
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
        <span className="ml-3 text-gray-600">Chargement des transactions...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6">
          <div className="text-center text-red-600">
            <p className="font-medium">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const transactionsDetailSection = (
    <>
      {/* Graphiques : Évolution cumulée + Recettes vs Dépenses (Répartition par catégorie supprimée) */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <div className="min-w-0">
          <TransactionsCumulativeChart
            data={chartsData.timeline}
            isLoading={chartsLoading}
          />
        </div>
        <div className="min-w-0">
          <TransactionsIncomeExpenseChart
            data={chartsData.incomeExpense}
            isLoading={chartsLoading}
          />
        </div>
      </div>

      <TransactionsKpiBar
        kpis={kpis}
        activeFilter={activeKpiFilter}
        onFilterChange={handleKpiFilterChange}
        isLoading={kpisLoading}
      />

      {isPropertyScoped && filters.leaseId ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/90 px-3 py-2.5">
          <p className="text-sm text-slate-700 min-w-0">
            <span className="inline-flex items-center rounded-md bg-slate-200/80 text-slate-800 text-xs font-semibold px-2 py-0.5 mr-2 align-middle">
              Bail
            </span>
            Filtré sur :{' '}
            <span className="font-medium text-slate-900">{leaseUrlFilterLabel ?? 'ce bail'}</span>
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 shrink-0 text-slate-700 border-slate-300"
            onClick={handleClearLeaseUrlFilter}
          >
            Voir tout
          </Button>
        </div>
      ) : null}

      <TransactionFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onResetFilters={handleResetFilters}
        properties={properties}
        leases={leases}
        tenants={tenants}
        categories={categories}
        natures={natures}
        periodStart={periodStart}
        periodEnd={periodEnd}
        onPeriodChange={handlePeriodChange}
        hidePropertyFilter={!!lockedPropertyId}
      />

      {selectedTransactionIds.length > 0 && (
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-900">
                {selectedTransactionIds.length} transaction{selectedTransactionIds.length > 1 ? 's' : ''} sélectionnée
                {selectedTransactionIds.length > 1 ? 's' : ''}
              </span>
              <div className="flex-1" />
              <Button
                variant="outline"
                size="sm"
                onClick={handleDeleteMultipleTransactions}
                disabled={isLoadingDeleteModal}
              >
                {isLoadingDeleteModal ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin sidebar-loader-orange" />
                    Chargement...
                  </>
                ) : (
                  'Supprimer'
                )}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedTransactionIds([])}>
                Annuler
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card id="transactions-global-table" className="scroll-mt-24">
        <CardHeader className="space-y-2">
          <div>
            <CardTitle>Transactions</CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              {totalCount > 0
                ? `Affichage de ${((pagination.page - 1) * pagination.limit) + 1} à ${Math.min(pagination.page * pagination.limit, totalCount)} sur ${totalCount}`
                : 'Aucune transaction'}
            </p>
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:gap-x-5 lg:gap-x-6">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <span className="text-xs font-medium text-muted-foreground shrink-0 pr-0.5">Affichage</span>
              <button
                type="button"
                onClick={() => setFlowFilter('all')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  flowFilter === 'all'
                    ? 'bg-orange-100 text-orange-700 border border-orange-300'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Tous
              </button>
              <button
                type="button"
                onClick={() => setFlowFilter('income')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  flowFilter === 'income'
                    ? 'bg-green-100 text-green-700 border border-green-300'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Recettes
              </button>
              <button
                type="button"
                onClick={() => setFlowFilter('expense')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  flowFilter === 'expense'
                    ? 'bg-red-100 text-red-700 border border-red-300'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Dépenses
              </button>
            </div>

            {showPortfolioPilotage && (
              <div className="flex flex-wrap items-center gap-2 min-w-0 md:border-l md:border-gray-200/70 md:pl-5 lg:pl-6">
                <span className="text-xs font-medium text-muted-foreground shrink-0 pr-0.5">Tableau</span>
                <TransactionsTableQuickFiltersBar
                  nonRapprochees={portfolioPilotageStats.nonRapprochees}
                  sansDocument={portfolioPilotageStats.sansDocument}
                  isLoading={portfolioPilotageStats.loading}
                  kpiNonRapprocheesActive={activeKpiFilter === 'nonRapprochees'}
                  sansDocumentFilterActive={filters.hasDocument === 'false'}
                  onToggleNonRapprochees={handleTogglePilotageNonRapprochees}
                  onToggleSansDocument={handleTogglePilotageSansDocument}
                />
                {(activeKpiFilter === 'nonRapprochees' || filters.hasDocument === 'false') && (
                  <button
                    type="button"
                    onClick={clearPortfolioPilotageFocus}
                    className="text-xs font-medium text-muted-foreground hover:text-foreground underline-offset-2 hover:underline shrink-0 p-0 m-0 bg-transparent border-0 cursor-pointer shadow-none md:ml-1"
                  >
                    Tout afficher
                  </button>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <TransactionsTable
            transactions={(() => {
              let list = filters.includeManagementFees
                ? transactions
                : transactions.filter((t) => t.autoSource !== 'gestion');
              if (flowFilter === 'income') list = list.filter((t) => t.nature?.type === 'RECETTE');
              if (flowFilter === 'expense') list = list.filter((t) => t.nature?.type === 'DEPENSE');
              return list;
            })()}
            onEdit={handleEditTransaction}
            onDelete={handleDeleteTransaction}
            onDeleteMultiple={handleDeleteMultipleTransactions}
            onRowClick={handleRowClick}
            isLoading={loading}
            totalCount={totalCount}
            groupByParent={filters.groupByParent}
            selectedTransactionIds={selectedTransactionIds}
            onSelectTransaction={handleSelectTransaction}
            onSelectAll={handleSelectAll}
            loadingTransactionId={loadingTransactionId}
            amountsSummary={amountsSummary}
            pendingCommissionTransactionIds={mode === 'app-shell' ? Array.from(pendingCommissionTransactionIds) : []}
            sortField={sortBy}
            sortOrder={sortOrder}
            onSortChange={(field, order) => {
              setSortBy(field);
              setSortOrder(order);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            onOpenDrawerForDocuments={(t) => {
              setScrollToDocuments(true);
              handleRowClick(t);
            }}
            groupByMonth={true}
            transactionIdsWithEcheanceLink={mode === 'app-shell' ? transactionIdsWithEcheanceLink : undefined}
            hidePropertyColumn={!!lockedPropertyId}
          />
        </CardContent>
      </Card>

      {totalCount > pagination.limit && (
        <div className="flex justify-center">
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.pages}
            onPageChange={handlePageChange}
          />
        </div>
      )}
    </>
  );

  // Rendu principal
  return (
    <div className={`w-full max-w-full ${showPortfolioPilotage ? 'min-h-screen bg-gray-50' : ''}`}>
      {/* Header - masqué si hideTitle est true (utilisé dans PropertyDetailView) */}
      {!hideTitle && (
        <div className="mb-4 sm:mb-6 space-y-3">
          {/* Ligne 1 : Hamburger + Titre + Bouton "+" */}
          <div className="flex items-center justify-between w-full gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              {/* Bouton hamburger mobile - Discret, aligné à gauche du titre */}
              {sidebarContext && (
                <button
                  onClick={sidebarContext.toggleSidebar}
                  className="lg:hidden flex items-center justify-center w-10 h-10 min-w-[40px] min-h-[40px] flex-shrink-0 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                  aria-label={sidebarContext.sidebarOpen ? "Fermer le menu" : "Ouvrir le menu"}
                >
                  {sidebarContext.sidebarOpen ? (
                    <X className="h-5 w-5" />
                  ) : (
                    <Menu className="h-5 w-5" />
                  )}
                </button>
              )}
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 truncate min-w-0">Transactions</h1>
              <div className="flex-shrink-0">
                <button
                  onClick={handleCreateTransaction}
                  className="inline-flex items-center justify-center h-8 w-8 text-orange-600 border border-orange-200 rounded-lg bg-white hover:bg-gradient-to-r hover:from-orange-500 hover:to-red-500 hover:text-white transition-all duration-300 ease-out focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                  aria-label="Nouvelle Transaction"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
          
          {/* Ligne 2 : Description */}
          <p className="text-sm sm:text-base text-gray-600">Suivi de vos revenus et dépenses immobilières</p>
        </div>
      )}

      {showPortfolioPilotage ? (
        <div className="p-6 space-y-6">
          <div className="rounded-xl border border-red-200 bg-red-50/90 p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
              <h2 className="text-base font-semibold text-gray-900 tracking-tight">Actions à traiter</h2>
              <span className="inline-flex items-center rounded-full border border-red-200/80 bg-white/90 px-2.5 py-1 text-xs font-semibold text-red-900 tabular-nums shadow-sm">
                {portfolioPilotageStats.loading
                  ? '…'
                  : `${portfolioPilotageStats.nonRapprochees} non rapprochée${portfolioPilotageStats.nonRapprochees > 1 ? 's' : ''}`}
              </span>
            </div>
            <p className="text-sm text-gray-600 mb-4 leading-snug">
              Transactions à rapprocher pour fiabiliser votre suivi.
            </p>
            {portfolioPilotageStats.loading ? (
              <p className="text-sm text-gray-500">Chargement…</p>
            ) : portfolioPilotageStats.previewNonRapprochees.length === 0 ? (
              <p className="text-sm text-gray-600">
                {portfolioPilotageStats.nonRapprochees === 0
                  ? 'Aucune transaction à rapprocher sur la période affichée.'
                  : 'Ouvrez le détail ci-dessous et filtrez sur les non rapprochées pour les traiter.'}
              </p>
            ) : (
              <ul className="space-y-2">
                {portfolioPilotageStats.previewNonRapprochees.map((row) => {
                  const dateLabel = row.date
                    ? new Date(`${row.date}T12:00:00`).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '—';
                  const amountLabel = new Intl.NumberFormat('fr-FR', {
                    style: 'currency',
                    currency: 'EUR',
                  }).format(row.amount);
                  return (
                    <li
                      key={row.id}
                      className="rounded-lg border border-gray-200/90 bg-white p-3 shadow-sm transition-colors hover:bg-gray-50/90"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:justify-between sm:gap-4">
                        <div className="min-w-0 flex-1 space-y-2">
                          <div>
                            <p className="text-sm font-semibold text-gray-900 leading-snug">{row.label}</p>
                            <p className="text-xs text-gray-600 mt-1 leading-snug">{row.propertyLine}</p>
                            {row.periodLabel ? (
                              <p className="text-xs text-gray-500 mt-1">Période : {row.periodLabel}</p>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-600">
                            <span className="tabular-nums">{dateLabel}</span>
                            <span className="text-gray-300" aria-hidden>
                              ·
                            </span>
                            <span className="font-medium tabular-nums text-gray-900">{amountLabel}</span>
                            <span className="text-gray-300" aria-hidden>
                              ·
                            </span>
                            <Badge
                              variant="warning"
                              size="sm"
                              className="border-amber-200 bg-amber-50 text-amber-950 text-[10px] font-semibold px-2 py-0 h-5"
                            >
                              Non rapproché
                            </Badge>
                          </div>
                        </div>
                        <div className="flex flex-col items-stretch gap-1.5 sm:w-[7.75rem] sm:shrink-0 sm:justify-start">
                          <Button
                            type="button"
                            size="sm"
                            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold shadow-sm"
                            onClick={() => openTransactionForRapprochement(row.id)}
                          >
                            Rapprocher
                          </Button>
                          <button
                            type="button"
                            className={`${GLOBAL_ROW_DETAIL_LINK_CLASS} !mt-0 !pt-0`}
                            onClick={scrollToTransactionsTable}
                          >
                            Voir dans le tableau
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <GlobalPilotageAlertsSection>
            {portfolioPilotageStats.sansDocument > 0 ? (
              <p className="text-sm text-gray-700">
                <span className="font-semibold text-amber-950">{portfolioPilotageStats.sansDocument}</span>{' '}
                transaction(s) sans pièce jointe sur la période — traçabilité à renforcer.
              </p>
            ) : (
              <p className="text-sm text-gray-700">Aucune alerte globale sur les pièces jointes.</p>
            )}
            <p className="text-xs text-gray-600 mt-2">
              Utilisez le détail ci-dessous pour filtrer « sans document ».
            </p>
          </GlobalPilotageAlertsSection>

          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900 mb-3">Synthèse</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-sm">
              <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
                <p className="text-xs text-gray-500">Recettes</p>
                <p className="font-semibold text-gray-900 tabular-nums">
                  {kpisLoading
                    ? '…'
                    : new Intl.NumberFormat('fr-FR', {
                        style: 'currency',
                        currency: 'EUR',
                        maximumFractionDigits: 0,
                      }).format(kpis.recettesTotales)}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
                <p className="text-xs text-gray-500">Dépenses</p>
                <p className="font-semibold text-gray-900 tabular-nums">
                  {kpisLoading
                    ? '…'
                    : new Intl.NumberFormat('fr-FR', {
                        style: 'currency',
                        currency: 'EUR',
                        maximumFractionDigits: 0,
                      }).format(kpis.depensesTotales)}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
                <p className="text-xs text-gray-500">Solde net</p>
                <p className="font-semibold text-gray-900 tabular-nums">
                  {kpisLoading
                    ? '…'
                    : new Intl.NumberFormat('fr-FR', {
                        style: 'currency',
                        currency: 'EUR',
                        maximumFractionDigits: 0,
                      }).format(kpis.soldeNet)}
                </p>
              </div>
              <div className="rounded-lg bg-orange-50 border border-orange-100 p-3">
                <p className="text-xs text-orange-800">Non rapprochées</p>
                <p className="font-semibold text-orange-950 tabular-nums">
                  {portfolioPilotageStats.loading ? '…' : portfolioPilotageStats.nonRapprochees}
                </p>
              </div>
              <div className="rounded-lg bg-amber-50 border border-amber-100 p-3">
                <p className="text-xs text-amber-900">Sans document</p>
                <p className="font-semibold text-amber-950 tabular-nums">
                  {portfolioPilotageStats.loading ? '…' : portfolioPilotageStats.sansDocument}
                </p>
              </div>
            </div>
          </div>

          <GlobalPilotageDetailAccordion
            open={transactionsDetailOpen}
            onToggle={() => setTransactionsDetailOpen((v) => !v)}
            title="Détail complet (graphiques, filtres et tableau)"
          >
            {transactionsDetailSection}
          </GlobalPilotageDetailAccordion>
        </div>
      ) : (
        <div className="space-y-6">{transactionsDetailSection}</div>
      )}

      {/* Modal */}
      <TransactionModal
        key={selectedTransaction?.id || 'new'}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleModalSubmit}
        context={{
          type:
            lockedPropertyId ||
            propPropertyId ||
            initialPropertyId ||
            filters.propertyId
              ? 'property'
              : 'global',
          propertyId:
            lockedPropertyId ||
            propPropertyId ||
            initialPropertyId ||
            filters.propertyId ||
            undefined,
        }}
        mode={modalMode}
        transactionId={selectedTransaction?.id}
        title={modalMode === 'create' ? 'Nouvelle transaction' : 'Modifier la transaction'}
      />

      {/* Modal de doublon détecté */}
      <DuplicateDetectedModal
        isOpen={showDuplicateModal}
        onClose={() => {
          setShowDuplicateModal(false);
          setDuplicateData(null);
        }}
        onLinkExisting={() => {
          notify2.info('Veuillez d\'abord annuler la création de la transaction, lier le document existant, puis recréer la transaction.');
          setShowDuplicateModal(false);
          setDuplicateData(null);
        }}
        onCancel={() => {
          setShowDuplicateModal(false);
          setDuplicateData(null);
        }}
        duplicateData={duplicateData}
      />

      {/* Drawer */}
      <TransactionDrawer
        transaction={selectedTransaction}
        isOpen={isDrawerOpen}
        onClose={() => {
          setScrollToDocuments(false);
          setScrollToRapprochement(false);
          setIsDrawerOpen(false);
        }}
        onEdit={handleEditTransaction}
        onDelete={handleDeleteTransaction}
        mode={mode}
        onRefresh={() => {
          if (mode === 'app-shell') {
            // ⚠️ CRITIQUE: Émettre uniquement l'événement ciblé
            window.dispatchEvent(new CustomEvent('transactions:refresh', {
              detail: { scope: 'property', propertyId: propPropertyId || initialPropertyId || filters.propertyId }
            }));
          }
        }}
        onViewDocument={handleViewDocument}
        initialScrollToDocuments={scrollToDocuments}
        onScrollToDocumentsDone={() => setScrollToDocuments(false)}
        initialScrollToRapprochement={scrollToRapprochement}
        onScrollToRapprochementDone={() => setScrollToRapprochement(false)}
      />

      {/* Modal de confirmation de suppression de transaction */}
      {transactionToDelete && (
        <ConfirmDeleteTransactionModal
          isOpen={showDeleteTransactionModal}
          onClose={() => {
            setShowDeleteTransactionModal(false);
            setTransactionToDelete(null);
            setIsLoadingDeleteTransaction(false);
          }}
          onConfirm={handleDeleteTransactionConfirmed}
          transactionId={transactionToDelete.id}
          transactionLabel={transactionToDelete.label}
          hasDocuments={transactionHasDocuments}
          isLoading={isLoadingDeleteTransaction}
        />
      )}

      {/* Modal de confirmation de suppression multiple */}
      <ConfirmDeleteMultipleTransactionsModal
        isOpen={showDeleteMultipleModal}
        onClose={() => {
          setShowDeleteMultipleModal(false);
          setTransactionsToDelete([]);
          setDeletingProgress(null);
        }}
        onConfirm={handleDeleteMultipleConfirmed}
        transactions={transactionsToDelete}
        deletingProgress={deletingProgress}
      />
    </div>
  );
}
