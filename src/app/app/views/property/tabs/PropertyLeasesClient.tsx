'use client';

import React, { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
import { notify2 } from '@/lib/notify2';
import { Plus, FileText, Download, Receipt, Home, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { BackToPropertyButton } from '@/components/shared/BackToPropertyButton';
import { usePropertyHeaderActions } from '@/app/biens/[id]/PropertyHeaderActionsContext';
import { LeasesKpiBar } from '@/components/leases/LeasesKpiBar';
import { LeasesRentEvolutionChart } from '@/components/leases/LeasesRentEvolutionChart';
import { LeasesByFurnishedChart } from '@/components/leases/LeasesByFurnishedChart';
import { LeasesDepositsRentsChart } from '@/components/leases/LeasesDepositsRentsChart';
import { useLeasesData } from '@/features/leases/hooks/useLeasesData';
import { useLeasesKpis } from '@/hooks/useLeasesKpis';
import { useLeasesCharts } from '@/hooks/useLeasesCharts';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import { createLeaseServiceWithMode } from '@/domain/services/leaseServiceFactory';
import LeasesFilters from '@/components/leases/LeasesFilters';
import { LeasesTableNew } from '@/components/leases/LeasesTableNew';
import type { ActionFilterKey } from '@/features/leases/components/LeasesActionBanner';
import { LeasesPriorityActionsBlock } from '@/features/leases/components/LeasesPriorityActionsBlock';
import { LeasesTableFilterStrip } from '@/features/leases/components/LeasesTableFilterStrip';
import { LeaseIndexationModal } from '@/features/leases/components/LeaseIndexationModal';
import { LeaseTerminationModal } from '@/features/leases/components/LeaseTerminationModal';
import { useLeasesActionCounts, type LeasePriorityAction } from '@/features/leases/hooks/useLeasesActionCounts';
import {
  toLeasePriorityAction,
  type LeasePilotageRowMeta,
} from '@/features/leases/utils/buildLeasePriorityActions';
import { scrollToLeaseTableRow } from '@/features/leases/utils/scrollToLeaseTableRow';
import LeaseDetailView from '@/features/leases/components/LeaseDetailView';
import LeaseFormComplete from '@/components/forms/LeaseFormComplete';
import LeaseEditModal from '@/components/forms/LeaseEditModal';
import LeaseActionsManager from '@/components/forms/LeaseActionsManager';
import { TransactionModal } from '@/components/transactions/TransactionModalV2';
import { createTransactionServiceWithMode } from '@/domain/services/transactionServiceFactory';
import type { LeasePaymentsTimelineMonth } from '@/features/leases/hooks/useLeasePaymentsTimeline';
import type { TransactionFormData } from '@/lib/validations/transaction';
import CannotDeleteLeaseModal from '@/components/leases/CannotDeleteLeaseModal';
import type { CannotDeleteLeaseItem } from '@/components/leases/cannotDeleteLeaseTypes';
import DeleteConfirmModal from '@/components/leases/DeleteConfirmModal';
import type { LeaseWithDetails } from '@/lib/services/leasesService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { navigateToView } from '@/utils/appShellNavigation';
import { classifySmartimmoId } from '@/lib/offline/leaseSignatureWorkflowDiag';
import { getLeaseRepositoryOffline } from '@/lib/offline/repositories/LeaseRepositoryOffline';
import { getLocalDB } from '@/lib/offline/db';
import { normalizeLeaseContractStatus } from '@/features/leases/utils/leaseWorkflowStatus';
import { buildLeaseRenewalInitialData } from '@/features/leases/utils/buildLeaseRenewalInitialData';

interface Filters {
  search: string;
  propertyId: string;
  tenantId: string;
  type: string;
  furnishedType: string;
  status: string;
  startDateFrom: string;
  startDateTo: string;
  endDateFrom: string;
  endDateTo: string;
  indexationType: string;
  indexationDateFrom: string;
  indexationDateTo: string;
  rentMin: string;
  rentMax: string;
  depositMin: string;
  depositMax: string;
}

interface PropertyLeasesClientProps {
  propertyId: string;
  propertyName: string;
  initialLeaseId?: string;
  /** Remonte la ligne de synthèse vers PropertyHeader (une seule fois, hors scroll) */
  onLeaseSummaryLineChange?: (line: string) => void;
}

export default function PropertyLeasesClient({ propertyId, propertyName, initialLeaseId, onLeaseSummaryLineChange }: PropertyLeasesClientProps) {
  const { organizationId } = useCurrentOrganization();
  const { setActions } = usePropertyHeaderActions();
  const triggerSilentSyncIfOnline = useCallback(async (
    reason: string,
    options?: { pullLease?: boolean; pullDocument?: boolean; pullDocumentLink?: boolean }
  ) => {
    if (!organizationId) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    try {
      const { getGlobalSyncService } = await import('@/lib/offline/syncGlobal');
      const syncService = getGlobalSyncService();
      await syncService.syncAllPendingToRemote(organizationId);
      if (options?.pullLease) {
        await syncService.syncEntityFromRemoteByName('lease', organizationId);
      }
      if (options?.pullDocument) {
        await syncService.syncEntityFromRemoteByName('document', organizationId);
      }
      if (options?.pullDocumentLink) {
        await syncService.syncEntityFromRemoteByName('documentLink', organizationId);
      }
    } catch (error) {
      console.warn(`[PropertyLeasesClient] Sync silencieuse échouée (${reason})`, error);
    }
  }, [organizationId]);
  const findPendingCreateLeaseError = useCallback(async (lease: LeaseWithDetails) => {
    if (!organizationId) return null;
    const db = await getLocalDB();
    const errorOps = await db.pendingOperations
      .where('[organizationId+status]')
      .equals([organizationId, 'error'])
      .toArray();
    const blockedOps = await db.pendingOperations
      .where('[organizationId+status]')
      .equals([organizationId, 'blocked_permanent'])
      .toArray();
    const ops = [...errorOps, ...blockedOps];

    const match = ops.find((op: any) => {
      if (op.entity !== 'lease' || op.operation !== 'create') return false;
      const p = op.payload || {};
      return (
        op.entityId === lease.id ||
        (p.propertyId === lease.propertyId &&
          p.tenantId === lease.tenantId &&
          String(p.startDate || '').slice(0, 10) === String(lease.startDate || '').slice(0, 10))
      );
    });
    return match?.errorMessage || null;
  }, [organizationId]);
  
  // ✅ [DEV-ONLY] Render count pour debug (isolé derrière flag DEV)
  const renderCountRef = useRef(0);
  if (process.env.NODE_ENV === 'development' && (window as any).__SMARTIMMO_DEBUG_LEASES__) {
    renderCountRef.current += 1;
  }
  
  // États de sélection multiple
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // ✅ Stabiliser selectedIds pour éviter les re-renders inutiles du tableau
  const stableSelectedIds = useMemo(() => selectedIds, [selectedIds.size, Array.from(selectedIds).sort().join(',')]);
  
  // États de tri (tri métier par défaut : retards > partiels > expirations > ok)
  const [sortField, setSortField] = useState<'business' | 'startDate' | 'endDate' | 'rentAmount'>('business');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // États des modals et drawer
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedLease, setSelectedLease] = useState<LeaseWithDetails | null>(null);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [leasesToConfirmDelete, setLeasesToConfirmDelete] = useState<LeaseWithDetails[]>([]);
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [showCannotDeleteModal, setShowCannotDeleteModal] = useState(false);
  const [protectedLeasesForModal, setProtectedLeasesForModal] = useState<CannotDeleteLeaseItem[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentPrefill, setPaymentPrefill] = useState<{
    propertyId: string;
    leaseId: string;
    nature: string;
    amount: number;
    date: string;
    periodMonth: string;
    periodYear: number;
    label: string;
    montantLoyer?: number;
    chargesRecup?: number;
    paymentDate?: string;
  } | null>(null);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [renewBaseLease, setRenewBaseLease] = useState<LeaseWithDetails | null>(null);

  // État pour le filtre KPI actif
  const [activeKpiFilter, setActiveKpiFilter] = useState<string | null>(null);
  // État pour le bandeau "À traiter" (filtre le tableau)
  const [actionFilter, setActionFilter] = useState<ActionFilterKey>(null);
  // Analytics repliables
  const [chartsExpanded, setChartsExpanded] = useState(true);
  const [showAllPriorityActions, setShowAllPriorityActions] = useState(false);
  const [showIndexationModal, setShowIndexationModal] = useState(false);
  const [showTerminateModal, setShowTerminateModal] = useState(false);

  // États des filtres (propertyId est toujours fixé)
  const [filters, setFilters] = useState<Filters>({
    search: '',
    propertyId: propertyId, // SCOPÉ PAR LE BIEN
    tenantId: '',
    type: '',
    furnishedType: '',
    status: '',
    startDateFrom: '',
    startDateTo: '',
    endDateFrom: '',
    endDateTo: '',
    indexationType: '',
    indexationDateFrom: '',
    indexationDateTo: '',
    rentMin: '',
    rentMax: '',
    depositMin: '',
    depositMax: '',
  });
  
  // ✅ Stabiliser filters pour éviter les re-renders inutiles
  const stableFilters = useMemo(() => filters, [
    filters.search,
    filters.propertyId,
    filters.tenantId,
    filters.type,
    filters.furnishedType,
    filters.status,
    filters.startDateFrom,
    filters.startDateTo,
    filters.endDateFrom,
    filters.endDateTo,
    filters.indexationType,
    filters.indexationDateFrom,
    filters.indexationDateTo,
    filters.rentMin,
    filters.rentMax,
    filters.depositMin,
    filters.depositMax,
  ]);

  // ✅ Stabiliser les filtres passés au hook pour éviter les re-renders
  const hookFilters = useMemo(() => ({
    propertyId, // ✅ Filtrer par bien au niveau IndexedDB
    search: '',
    tenantId: '',
    type: '',
    furnishedType: '',
    status: '',
    startDateFrom: '',
    startDateTo: '',
    endDateFrom: '',
    endDateTo: '',
    indexationType: '',
    indexationDateFrom: '',
    indexationDateTo: '',
    rentMin: '',
    rentMax: '',
    depositMin: '',
    depositMax: '',
  }), [propertyId]);

  // ✅ APP-SHELL: Charger les baux depuis IndexedDB avec filtre propertyId
  const {
    allLeases: rawAllLeases, // ✅ Toutes les données non filtrées (pour filtrage en mémoire)
    properties,
    tenants,
    totalCount,
    loading: isLoading,
  } = useLeasesData({
    mode: 'app-shell',
    propertyId, // ✅ Passer propertyId pour filtrer les events
    filters: hookFilters,
    activeKpiFilter: null, // ✅ Ne pas appliquer le filtre KPI ici, on le fait en mémoire
  });
  
  // ✅ CRITIQUE: Ne PAS stabiliser allLeases avec useMemo
  // Le useMemo empêche la détection des changements de status car il compare une chaîne
  // qui peut être identique même si les objets ont changé de référence
  // On utilise directement rawAllLeases pour que les changements soient détectés immédiatement
  const allLeases = rawAllLeases || [];

  // ✅ APP-SHELL: Filtrer les baux en mémoire selon les filtres UI
  const filteredLeases = useMemo(() => {
    // ✅ Note: allLeases est déjà filtré par propertyId au niveau IndexedDB
    if (!allLeases || allLeases.length === 0) {
      return [];
    }
    
    let filtered = allLeases.filter(lease => {
      // Filtre de recherche
      if (stableFilters.search) {
        const searchLower = stableFilters.search.toLowerCase();
        const matchesSearch = 
          lease.Property?.name?.toLowerCase().includes(searchLower) ||
          `${lease.Tenant?.firstName} ${lease.Tenant?.lastName}`.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Filtre de locataire
      if (stableFilters.tenantId && lease.tenantId !== stableFilters.tenantId) return false;

      // Filtre de type
      if (stableFilters.type && lease.type !== stableFilters.type) return false;

      // Filtre de meublé
      if (stableFilters.furnishedType && lease.furnishedType !== stableFilters.furnishedType) return false;

      // Filtre de statut
      if (stableFilters.status && lease.status !== stableFilters.status) return false;

      // Filtres de dates
      if (stableFilters.startDateFrom) {
        const leaseStart = new Date(lease.startDate);
        const fromDate = new Date(stableFilters.startDateFrom);
        if (leaseStart < fromDate) return false;
      }
      if (stableFilters.startDateTo) {
        const leaseStart = new Date(lease.startDate);
        const toDate = new Date(stableFilters.startDateTo);
        toDate.setHours(23, 59, 59, 999);
        if (leaseStart > toDate) return false;
      }
      if (stableFilters.endDateFrom) {
        if (!lease.endDate) return false;
        const leaseEnd = new Date(lease.endDate);
        const fromDate = new Date(stableFilters.endDateFrom);
        if (leaseEnd < fromDate) return false;
      }
      if (stableFilters.endDateTo) {
        if (!lease.endDate) return false;
        const leaseEnd = new Date(lease.endDate);
        const toDate = new Date(stableFilters.endDateTo);
        toDate.setHours(23, 59, 59, 999);
        if (leaseEnd > toDate) return false;
      }

      // Filtres de montants
      if (stableFilters.rentMin && lease.rentAmount < parseFloat(stableFilters.rentMin)) return false;
      if (stableFilters.rentMax && lease.rentAmount > parseFloat(stableFilters.rentMax)) return false;
      if (stableFilters.depositMin && lease.deposit < parseFloat(stableFilters.depositMin)) return false;
      if (stableFilters.depositMax && lease.deposit > parseFloat(stableFilters.depositMax)) return false;

      // Filtre d'indexation
      if (stableFilters.indexationType && lease.indexationType !== stableFilters.indexationType) return false;
      if (stableFilters.indexationDateFrom || stableFilters.indexationDateTo) {
        // TODO: Implémenter le filtre de date d'indexation si nécessaire
      }

      return true;
    });

    // Appliquer le filtre KPI actif
    if (activeKpiFilter === 'active') {
      filtered = filtered.filter(l => l.status === 'ACTIF');
    } else if (activeKpiFilter === 'expiring') {
      // TODO: Filtrer les baux expirant bientôt
    } else if (activeKpiFilter === 'indexation') {
      // TODO: Filtrer les baux avec indexation due
    }

    return filtered;
  }, [allLeases, stableFilters, activeKpiFilter]);

  // ✅ APP-SHELL: Charger les KPI en mode app-shell (filtrés par propertyId)
  const { kpis, isLoading: kpisLoading } = useLeasesKpis({
    propertyId, // FILTRE PAR BIEN
    mode: 'app-shell',
  });

  // ✅ APP-SHELL: Charger les graphiques en mode app-shell (filtrés par propertyId)
  const { data: chartsData, isLoading: chartsLoading } = useLeasesCharts({
    propertyId, // FILTRE PAR BIEN
    mode: 'app-shell',
  });

  const {
    counts: actionCounts,
    priorityActions,
    leasePilotageById,
    leasePaymentPilotageById,
    loading: actionCountsLoading,
  } = useLeasesActionCounts(organizationId ?? null, allLeases, 'app-shell');

  useEffect(() => {
    if (priorityActions.length <= 3) setShowAllPriorityActions(false);
  }, [priorityActions.length]);

  // Gestion des filtres (en mémoire uniquement, pas de fetch)
  const handleFiltersChange = useCallback((newFilters: Filters) => {
    // S'assurer que propertyId reste fixé
    setFilters({ ...newFilters, propertyId });
  }, [propertyId]);

  // ✅ APP-SHELL: Gestion du filtre KPI (en mémoire uniquement)
  const handleKpiFilterChange = useCallback((filterKey: string | null) => {
    if (filterKey === activeKpiFilter) {
      setActiveKpiFilter(null);
    } else {
      setActiveKpiFilter(filterKey);
    }
  }, [activeKpiFilter]);

  const handleActionFilterChange = useCallback((filter: ActionFilterKey) => {
    setActionFilter(filter);
  }, []);

  const handleResetFilters = useCallback(() => {
    setActionFilter(null);
    const resetFilters: Filters = {
      search: '',
      propertyId: propertyId, // GARDER le bien
      tenantId: '',
      type: '',
      furnishedType: '',
      status: '',
      startDateFrom: '',
      startDateTo: '',
      endDateFrom: '',
      endDateTo: '',
      indexationType: '',
      indexationDateFrom: '',
      indexationDateTo: '',
      rentMin: '',
      rentMax: '',
      depositMin: '',
      depositMax: '',
    };

    setFilters(resetFilters);
    setActiveKpiFilter(null);
  }, [propertyId]);

  // Gestion des actions sur les baux
  const handleCreateLease = useCallback(() => {
    setSelectedLease(null);
    setIsModalOpen(true);
  }, []);

  // ✅ Utiliser useRef pour stabiliser setActions et éviter les boucles infinies
  const setActionsRef = React.useRef(setActions);
  setActionsRef.current = setActions;
  
  const headerActions = useMemo(() => (
    <div className="flex items-center gap-2">
      <button
        onClick={handleCreateLease}
        className="inline-flex items-center justify-center h-8 w-8 text-orange-600 border border-orange-200 rounded-lg bg-white hover:bg-gradient-to-r hover:from-orange-500 hover:to-red-500 hover:text-white transition-all duration-300 ease-out focus:outline-none"
        aria-label="Nouveau bail"
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
  ), [handleCreateLease]);

  // Définir les actions dans le header
  // ✅ Utiliser setActionsRef pour éviter les re-renders causés par setActions qui change
  React.useEffect(() => {
    setActionsRef.current(headerActions);
    
    return () => {
      setActionsRef.current(null);
    };
  }, [headerActions]);

  const handleViewLease = useCallback((lease: LeaseWithDetails) => {
    setSelectedLease(lease);
    setIsDrawerOpen(true);
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    params.set('view', 'property');
    params.set('propertyId', propertyId);
    params.set('tab', 'lease');
    params.set('leaseId', lease.id);
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
    }
  }, [propertyId]);

  const handleOpenRenewLease = useCallback((lease: LeaseWithDetails) => {
    const contract = normalizeLeaseContractStatus(lease.status);
    if (contract !== 'ACTIF') {
      notify2.warning('Action indisponible', 'Seul un bail actif peut être renouvelé.');
      return;
    }
    if (!lease.endDate) {
      notify2.warning('Action indisponible', 'Le bail doit avoir une date de fin pour être renouvelé.');
      return;
    }
    setRenewBaseLease(lease);
    setShowRenewModal(true);
  }, []);

  const handleIndexLease = useCallback((lease: LeaseWithDetails) => {
    const contract = normalizeLeaseContractStatus(lease.status);
    if (contract !== 'ACTIF') {
      notify2.warning('Action indisponible', "L'indexation est disponible uniquement pour un bail actif.");
      return;
    }
    setSelectedLease(lease);
    setShowIndexationModal(true);
  }, []);

  const openPaymentFromPriorityItem = useCallback(
    (lease: LeaseWithDetails, item: LeasePriorityAction) => {
      const ym = item.targetYearMonth;
      if (!ym) {
        handleViewLease(lease);
        return;
      }
      const parts = ym.split('-');
      const yStr = parts[0] ?? '';
      const mStr = parts[1] ?? '01';
      const y = parseInt(yStr, 10);
      const mNum = parseInt(mStr, 10);
      const label = new Date(y, mNum - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      const fullExpected = lease.rentAmount + (lease.chargesRecupMensuelles ?? 0);
      const amount =
        item.nextActionType === 'PAY_REMAINING' && item.amountValue > 0 ? item.amountValue : fullExpected;
      const paymentDay = lease.paymentDay ?? 5;
      const dueDate = `${yStr}-${mStr}-${String(Math.min(paymentDay, 28)).padStart(2, '0')}`;
      setPaymentPrefill({
        propertyId: lease.propertyId,
        leaseId: lease.id,
        nature: 'RECETTE_LOYER',
        amount,
        date: `${yStr}-${mStr}-01`,
        periodMonth: mStr,
        periodYear: y,
        label: `Loyer ${label}`,
        montantLoyer: lease.rentAmount,
        chargesRecup: lease.chargesRecupMensuelles ?? 0,
        paymentDate: dueDate,
      });
      setShowPaymentModal(true);
    },
    [handleViewLease]
  );

  const handlePriorityActionCta = useCallback(
    (item: LeasePriorityAction) => {
      const lease = allLeases.find((l) => l.id === item.leaseId);
      if (!lease) return;
      if (item.ctaKind === 'encaisser' || item.ctaKind === 'completer') {
        openPaymentFromPriorityItem(lease, item);
        return;
      }
      if (item.ctaKind === 'renouveler') {
        handleOpenRenewLease(lease);
        return;
      }
      if (item.ctaKind === 'indexer') {
        handleIndexLease(lease);
      }
    },
    [allLeases, openPaymentFromPriorityItem, handleOpenRenewLease, handleIndexLease]
  );

  const handlePilotageTablePrimaryCta = useCallback(
    (lease: LeaseWithDetails, meta: LeasePilotageRowMeta) => {
      handlePriorityActionCta(toLeasePriorityAction(lease, meta));
    },
    [handlePriorityActionCta]
  );

  const transactionsHrefForLeaseTab = useCallback(
    (lease: { id: string; propertyId: string }) =>
      `/app?view=property&propertyId=${encodeURIComponent(lease.propertyId)}&tab=transactions&leaseId=${encodeURIComponent(lease.id)}`,
    []
  );

  const handleEditLease = useCallback((lease: LeaseWithDetails) => {
    setSelectedLease(lease);
    setIsEditModalOpen(true);
  }, []);

  const handleDeleteLease = useCallback((lease: LeaseWithDetails) => {
    const openDeleteFlow = async () => {
      if (!organizationId) {
        setLeasesToConfirmDelete([lease]);
        setShowDeleteConfirmModal(true);
        return;
      }

      // Pré-check local pour éviter la double modal
      const protectedItems: CannotDeleteLeaseItem[] = [];
      const deletableItems: LeaseWithDetails[] = [];

      const contractStatus = normalizeLeaseContractStatus(lease.status);
      if (contractStatus === 'ACTIF') {
        protectedItems.push({
          id: lease.id,
          propertyName: lease.Property?.name || 'Bien',
          tenantName: `${lease.Tenant?.firstName || ''} ${lease.Tenant?.lastName || ''}`.trim(),
          reason: "Ce bail est actif et ne peut pas être supprimé directement. Résiliez-le d'abord.",
          offerTerminate: true,
        });
      } else {
        try {
          const db = await getLocalDB();
          const txTable = db.tables.find((t: any) => t.name === 'Transaction');
          const transactionCount = txTable
            ? await txTable
                .where('organizationId')
                .equals(organizationId)
                .filter((tx: any) => tx.leaseId === lease.id || tx.bailId === lease.id)
                .count()
            : 0;

          if (transactionCount > 0) {
            protectedItems.push({
              id: lease.id,
              propertyName: lease.Property?.name || 'Bien',
              tenantName: `${lease.Tenant?.firstName || ''} ${lease.Tenant?.lastName || ''}`.trim(),
              reason: 'Ce bail contient des transactions et ne peut pas être supprimé.',
              offerTerminate: false,
            });
          } else {
            deletableItems.push(lease);
          }
        } catch {
          // Fallback safe: garder la protection côté service si le pré-check local échoue.
          deletableItems.push(lease);
        }
      }

      if (protectedItems.length > 0 && deletableItems.length === 0) {
        setProtectedLeasesForModal(protectedItems);
        setShowCannotDeleteModal(true);
        return;
      }

      setLeasesToConfirmDelete(deletableItems);
      setShowDeleteConfirmModal(true);
    };

    void openDeleteFlow();
  }, [organizationId]);

  // ✅ APP-SHELL: Suppression via LeaseService (local-first)
  const handleConfirmDelete = useCallback(async () => {
    if (!organizationId || leasesToConfirmDelete.length === 0) {
      notify2.error('Données manquantes');
      return;
    }

    try {
      const leaseService = createLeaseServiceWithMode('app-shell');
      const results = await Promise.allSettled(
        leasesToConfirmDelete.map(lease => leaseService.deleteLease(lease.id, organizationId))
      );
      const succeeded = results.filter(r => r.status === 'fulfilled').length;

      const protectedLeases: CannotDeleteLeaseItem[] = [];
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          const error = result.reason as Error;
          if (error.message.includes('actif') || error.message.includes('transactions')) {
            const lease = leasesToConfirmDelete[index];
            if (!lease) return;
            protectedLeases.push({
              id: lease.id,
              propertyName: lease.Property?.name || 'Bien',
              tenantName: `${lease.Tenant?.firstName || ''} ${lease.Tenant?.lastName || ''}`.trim(),
              reason: error.message,
              offerTerminate: normalizeLeaseContractStatus(lease.status) === 'ACTIF',
            });
          }
        }
      });

      if (protectedLeases.length > 0) {
        setProtectedLeasesForModal(protectedLeases);
        setShowCannotDeleteModal(true);
      }

      // Réinitialiser les états
      setLeasesToConfirmDelete([]);
      setSelectedIds(new Set());
      
      if (succeeded > 0) {
        notify2.success(`${succeeded} bail(x) supprimé(s) avec succès`);
        await triggerSilentSyncIfOnline('delete_lease', { pullLease: true });
      }
      
      // ✅ APP-SHELL: Refresh via événement ciblé
      window.dispatchEvent(new CustomEvent('leases:refresh', { 
        detail: { scope: 'property', propertyId, reason: 'delete' } 
      }));

      // Fermer le drawer si ouvert
      if (isDrawerOpen) {
        setIsDrawerOpen(false);
      }
    } catch (error: any) {
      console.error('Erreur lors de la suppression des baux:', error);
      notify2.error('Erreur', error.message || 'Erreur lors de la suppression');
    }
  }, [propertyId, isDrawerOpen, organizationId, leasesToConfirmDelete, triggerSilentSyncIfOnline]);

  const handleActionsLease = useCallback((lease: LeaseWithDetails) => {
    console.log('Actions pour le bail:', lease.id);
  }, []);

  // Gestion de la sélection
  const handleSelectLease = useCallback((leaseId: string, selected: boolean) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(leaseId);
      } else {
        newSet.delete(leaseId);
      }
      return newSet;
    });
  }, []);

  // ✅ Ouvrir automatiquement le bail si leaseId est dans l'URL (?leaseId=xxx)
  useEffect(() => {
    if (!initialLeaseId || filteredLeases.length === 0) return;
    const lease = filteredLeases.find((l) => l.id === initialLeaseId);
    if (lease) {
      setSelectedLease(lease);
      setIsDrawerOpen(true);
    }
  }, [initialLeaseId, filteredLeases]);

  // ✅ Mémoriser les IDs des leases filtrés pour handleSelectAll
  const filteredLeaseIds = useMemo(() => filteredLeases.map(l => l.id), [filteredLeases.length, filteredLeases.map(l => l.id).join(',')]);
  
  const handleSelectAll = useCallback((selected: boolean) => {
    setSelectedIds(prev => {
      if (selected) {
        return new Set(filteredLeaseIds);
      } else {
        return new Set();
      }
    });
  }, [filteredLeaseIds]);

  // Gestion du tri
  const handleSort = useCallback((field: 'business' | 'startDate' | 'endDate' | 'rentAmount') => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder(field === 'business' ? 'asc' : 'desc');
    }
  }, [sortField]);

  // Map leaseId -> santé pour surlignage et action rapide
  const leaseHealthMap = useMemo(() => {
    const map: Record<string, 'ok' | 'partiel' | 'retard'> = {};
    for (const lease of filteredLeases) {
      if (actionCounts.leaseIdsRetards.has(lease.id)) map[lease.id] = 'retard';
      else if (actionCounts.leaseIdsPartiels.has(lease.id)) map[lease.id] = 'partiel';
      else map[lease.id] = 'ok';
    }
    return map;
  }, [filteredLeases, actionCounts]);

  // ✅ APP-SHELL: Filtrer par actionFilter puis trier les baux
  const sortedLeases = useMemo(() => {
    if (!filteredLeases || filteredLeases.length === 0) {
      return [];
    }

    // 1. Appliquer le filtre "À traiter" si actif
    let toSort = [...filteredLeases];
    if (actionFilter) {
      const set =
        actionFilter === 'partiels' ? actionCounts.leaseIdsPartiels :
        actionFilter === 'retards' ? actionCounts.leaseIdsRetards :
        actionFilter === 'expirant90' ? actionCounts.leaseIdsExpirant90 :
        actionFilter === 'indexations' ? actionCounts.leaseIdsIndexations : null;
      if (set && set.size > 0) {
        toSort = toSort.filter((l) => set.has(l.id));
      }
    }

    // 2. Trier
    const getBusinessPriority = (lease: LeaseWithDetails): number => {
      if (actionCounts.leaseIdsRetards.has(lease.id)) return 0;
      if (actionCounts.leaseIdsPartiels.has(lease.id)) return 1;
      if (actionCounts.leaseIdsExpirant90.has(lease.id)) return 2;
      return 3;
    };

    return toSort.sort((a, b) => {
      let comparison = 0;

      if (sortField === 'business') {
        const pa = getBusinessPriority(a);
        const pb = getBusinessPriority(b);
        comparison = pa - pb;
        if (comparison === 0 && (pa === 2 || pb === 2)) {
          const endA = a.endDate ? new Date(a.endDate).getTime() : Infinity;
          const endB = b.endDate ? new Date(b.endDate).getTime() : Infinity;
          comparison = endA - endB;
        }
      } else {
        switch (sortField) {
          case 'startDate':
            comparison = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
            break;
          case 'endDate':
            const endA = a.endDate ? new Date(a.endDate).getTime() : 0;
            const endB = b.endDate ? new Date(b.endDate).getTime() : 0;
            comparison = endA - endB;
            break;
          case 'rentAmount':
            comparison = a.rentAmount - b.rentAmount;
            break;
        }
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [filteredLeases, sortField, sortOrder, actionFilter, actionCounts]);

  // ✅ APP-SHELL: Soumission via LeaseService (local-first)
  const handleModalSubmit = async (data: any) => {
    if (!organizationId) {
      notify2.error('Organisation requise');
      return;
    }

    try {
      const leaseService = createLeaseServiceWithMode('app-shell');
      const isEdit = !!data.id;

      if (isEdit) {
        // Mise à jour via le service
        await leaseService.updateLease(data.id, organizationId, {
          propertyId: data.propertyId || propertyId,
          tenantId: data.tenantId,
          type: data.type,
          furnishedType: data.furnishedType || null,
          startDate: data.startDate,
          endDate: data.endDate || null,
          rentAmount: data.rentAmount,
          deposit: data.deposit || null,
          paymentDay: data.paymentDay || null,
          indexationType: data.indexationType || null,
          notes: data.notes || null,
          status: data.status || null,
          signedPdfUrl: data.signedPdfUrl || null,
          chargesRecupMensuelles: data.chargesRecupMensuelles || null,
          chargesNonRecupMensuelles: data.chargesNonRecupMensuelles || null,
        });
      } else {
        // Création via le service
        await leaseService.createLease({
          organizationId,
          propertyId: data.propertyId || propertyId,
          tenantId: data.tenantId,
          type: data.type,
          furnishedType: data.furnishedType || null,
          startDate: data.startDate,
          endDate: data.endDate || null,
          rentAmount: data.rentAmount,
          deposit: data.deposit || null,
          paymentDay: data.paymentDay || null,
          indexationType: data.indexationType || null,
          notes: data.notes || null,
          status: data.status || null,
          chargesRecupMensuelles: data.chargesRecupMensuelles || null,
          chargesNonRecupMensuelles: data.chargesNonRecupMensuelles || null,
        });

        // UX attendue: créer puis envoyer dans la foulée sans friction.
        // Si online, pousser immédiatement la file locale vers le serveur.
        if (typeof navigator !== 'undefined' && navigator.onLine) {
          await triggerSilentSyncIfOnline('create_lease', { pullLease: true });
        }
      }

      setIsModalOpen(false);
      setIsEditModalOpen(false);
      setSelectedLease(null);
      
      notify2.success(isEdit ? 'Bail mis à jour avec succès' : 'Bail créé avec succès');
      
      // ✅ APP-SHELL: Refresh via événement ciblé
      window.dispatchEvent(new CustomEvent('leases:refresh', { 
        detail: { scope: 'property', propertyId, reason: 'crud' } 
      }));
    } catch (error: any) {
      console.error(`Erreur lors de ${data.id ? 'la mise à jour' : 'la création'} du bail:`, error);
      notify2.error(error instanceof Error ? error.message : `Erreur lors de ${data.id ? 'la mise à jour' : 'la création'} du bail`);
      throw error;
    }
  };

  const handleRenewalSubmit = useCallback(
    async (data: any) => {
      await handleModalSubmit({
        ...data,
        id: undefined,
        status: 'BROUILLON',
        notes: `Renouvellement du bail ${renewBaseLease?.id ?? ''}${data.notes ? `\n\n${data.notes}` : ''}`.trim(),
      });
      setShowRenewModal(false);
      setRenewBaseLease(null);
    },
    [handleModalSubmit, renewBaseLease?.id]
  );

  const handleRequestAmendmentFromEditModal = useCallback(() => {
    if (!selectedLease) return;
    const contract = normalizeLeaseContractStatus(selectedLease.status);
    if (contract !== 'ACTIF') {
      notify2.warning('Action indisponible', 'Seul un bail actif peut être renouvelé.');
      return;
    }
    if (!selectedLease.endDate) {
      notify2.warning('Action indisponible', 'Le bail doit avoir une date de fin pour être renouvelé.');
      return;
    }
    setIsEditModalOpen(false);
    setRenewBaseLease(selectedLease);
    setShowRenewModal(true);
  }, [selectedLease]);

  const handleOpenTerminateLease = useCallback((lease: LeaseWithDetails) => {
    const contract = normalizeLeaseContractStatus(lease.status);
    if (contract !== 'ACTIF') return;
    setSelectedLease(lease);
    setShowTerminateModal(true);
  }, []);

  const handleConfirmTerminateLease = useCallback(
    async ({ effectiveEndDate, reason }: { effectiveEndDate: string; reason?: string }) => {
      if (!selectedLease || !organizationId) return;
      const leaseService = createLeaseServiceWithMode('app-shell');
      const existingNotes = selectedLease.notes ? `${selectedLease.notes}\n\n` : '';
      const reasonLine = reason ? `Motif de résiliation: ${reason}` : 'Motif de résiliation: —';
      await leaseService.updateLease(selectedLease.id, organizationId, {
        status: 'RÉSILIÉ',
        endDate: effectiveEndDate,
        notes: `${existingNotes}${reasonLine}`.trim(),
      });
      await triggerSilentSyncIfOnline('terminate_from_modal', { pullLease: true });
      notify2.success('Bail résilié', 'La résiliation a été enregistrée.');
      window.dispatchEvent(
        new CustomEvent('leases:refresh', {
          detail: { scope: 'property', propertyId, reason: 'terminate', leaseId: selectedLease.id },
        })
      );
      setShowTerminateModal(false);
    },
    [selectedLease, organizationId, propertyId, triggerSilentSyncIfOnline]
  );

  // ✅ APP-SHELL: Résiliation via LeaseService (local-first)
  const handleTerminateMultiple = async (leaseIds: string[]) => {
    if (!organizationId || leaseIds.length === 0) {
      notify2.error('Données manquantes');
      return;
    }

    try {
      const leaseService = createLeaseServiceWithMode('app-shell');
      
      // Résilier tous les baux sélectionnés via le service (mise à jour du statut)
      await Promise.all(
        leaseIds.map(leaseId => 
          leaseService.updateLease(leaseId, organizationId, { status: 'RÉSILIÉ' })
        )
      );

      setShowCannotDeleteModal(false);
      setProtectedLeasesForModal([]);
      setLeasesToConfirmDelete([]);
      setSelectedIds(new Set());
      
      notify2.success(`${leaseIds.length} bail(x) résilié(s) avec succès`);
      await triggerSilentSyncIfOnline('terminate_multiple', { pullLease: true });
      
      // ✅ APP-SHELL: Refresh via événement ciblé
      window.dispatchEvent(new CustomEvent('leases:refresh', { 
        detail: { scope: 'property', propertyId, reason: 'crud' } 
      }));
    } catch (error: any) {
      console.error('Erreur lors de la résiliation:', error);
      notify2.error('Erreur', error.message || 'Erreur lors de la résiliation des baux');
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setIsEditModalOpen(false);
    setSelectedLease(null);
  };

  const handleCloseDrawer = useCallback(() => {
    setIsDrawerOpen(false);
    setSelectedLease(null);
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    params.delete('leaseId');
    if (typeof window !== 'undefined' && params.toString()) {
      window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
    }
  }, []);

  const handleEnregistrerPaiement = useCallback((lease: LeaseWithDetails, month: LeasePaymentsTimelineMonth) => {
    const contract = normalizeLeaseContractStatus(lease.status);
    if (contract === 'RESILIE' || contract === 'ARCHIVE') {
      notify2.warning('Paiement bloqué', "Ce bail est résilié : aucun nouveau paiement futur n'est autorisé.");
      return;
    }
    const [y = '', m = '01'] = month.yearMonth.split('-');
    const dueDate = month.dueDate || `${y}-${m}-15`;
    setPaymentPrefill({
      propertyId: lease.propertyId,
      leaseId: lease.id,
      nature: 'RECETTE_LOYER',
      amount: month.expected,
      date: `${y}-${m}-01`,
      periodMonth: m,
      periodYear: parseInt(y, 10) || new Date().getFullYear(),
      label: `Loyer ${month.label}`,
      montantLoyer: lease.rentAmount,
      chargesRecup: lease.chargesRecupMensuelles ?? 0,
      paymentDate: dueDate,
    });
    setShowPaymentModal(true);
  }, []);

  const handlePaymentModalSubmit = useCallback(async (data: TransactionFormData) => {
    if (!organizationId) throw new Error('Organisation requise');
    const lease = allLeases.find((l) => l.id === data.leaseId);
    if (lease) {
      const contract = normalizeLeaseContractStatus(lease.status);
      if (contract === 'RESILIE' || contract === 'ARCHIVE') {
        const target = new Date(data.date);
        const now = new Date();
        const isFutureOrCurrent =
          target.getFullYear() > now.getFullYear() ||
          (target.getFullYear() === now.getFullYear() && target.getMonth() >= now.getMonth());
        if (isFutureOrCurrent) {
          throw new Error("Bail résilié : impossible d'enregistrer un paiement futur.");
        }
      }
    }
    const svc = createTransactionServiceWithMode('app-shell');
    const d = new Date(data.date);
    const accountingMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    await svc.createTransaction({
      organizationId,
      propertyId: data.propertyId,
      leaseId: data.leaseId || null,
      categoryId: data.categoryId,
      nature: data.nature,
      label: data.label || 'Loyer',
      amount: Number(data.amount),
      date: data.date,
      paidAt: (data as any).paidAt || (data as any).paymentDate || data.date,
      method: (data as any).method || (data as any).paymentMethod || null,
      accountingMonth,
      periodMonth: data.periodMonth ? parseInt(data.periodMonth, 10) : d.getMonth() + 1,
      periodYear: data.periodYear ?? d.getFullYear(),
      monthsCovered: 1,
      skipAutoCommissions: true,
    });
    await triggerSilentSyncIfOnline('lease_payment_create', { pullLease: true });
    setShowPaymentModal(false);
    setPaymentPrefill(null);
    notify2.success('Paiement enregistré');
    const leaseId = data.leaseId || null;
    window.dispatchEvent(new CustomEvent('leases:refresh', { detail: { scope: 'property', propertyId, leaseId, reason: 'tx' } }));
    window.dispatchEvent(new CustomEvent('transactions:refresh', { detail: { scope: 'property', propertyId, leaseId } }));
  }, [organizationId, propertyId, allLeases]);

  const refreshAfterWorkflow = useCallback((leaseId: string, reason: string) => {
    window.dispatchEvent(
      new CustomEvent('leases:refresh', {
        detail: { scope: 'property', propertyId, reason, leaseId },
      })
    );
  }, [propertyId]);


  useEffect(() => {
    if (!selectedLease) return;
    const fresh = filteredLeases.find((l) => l.id === selectedLease.id);
    if (!fresh) return;
    if (fresh.status !== selectedLease.status || fresh.updatedAt !== selectedLease.updatedAt) {
      setSelectedLease(fresh);
    }
  }, [filteredLeases, selectedLease]);

  const handleSendForSignatureFromDrawer = useCallback(async (lease: LeaseWithDetails) => {
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        notify2.error('Action indisponible', "L'envoi pour signature nécessite une connexion internet.");
        return;
      }
      let leaseIdForSend = lease.id;
      if (classifySmartimmoId(lease.id) === 'uuid_local') {
        const { getGlobalSyncService } = await import('@/lib/offline/syncGlobal');
        const syncService = getGlobalSyncService();
        await syncService.syncAllPendingToRemote(organizationId || '');

        const pendingCreateError = await findPendingCreateLeaseError(lease);
        if (pendingCreateError) {
          notify2.error('Impossible de synchroniser le bail', pendingCreateError);
          return;
        }

        const leaseRepo = getLeaseRepositoryOffline();
        let allLeases = await leaseRepo.getAll(organizationId || '', { propertyId: lease.propertyId });
        let syncedMatch = allLeases.find((l: any) =>
          l.propertyId === lease.propertyId &&
          l.tenantId === lease.tenantId &&
          String(l.startDate).slice(0, 10) === String(lease.startDate).slice(0, 10) &&
          classifySmartimmoId(l.id) === 'cuid_remote'
        );
        if (!syncedMatch) {
          // Sans refresh page: pull ciblé des baux puis nouveau matching local->remote.
          await syncService.syncEntityFromRemoteByName('lease', organizationId || '');
          allLeases = await leaseRepo.getAll(organizationId || '', { propertyId: lease.propertyId });
          syncedMatch = allLeases.find((l: any) =>
            l.propertyId === lease.propertyId &&
            l.tenantId === lease.tenantId &&
            String(l.startDate).slice(0, 10) === String(lease.startDate).slice(0, 10) &&
            classifySmartimmoId(l.id) === 'cuid_remote'
          );
        }
        if (syncedMatch?.id) {
          leaseIdForSend = syncedMatch.id;
        } else {
          notify2.error(
            'Bail non encore synchronisé',
            "Le bail vient d'être créé localement. Vérifie la page Sync si le problème persiste."
          );
          return;
        }
      }

      const response = await fetch(`/api/leases/${leaseIdForSend}/send-for-signature`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: lease.Tenant?.email || undefined }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Impossible d'envoyer le bail pour signature");
      }
      const result = await response.json().catch(() => ({} as any));
      const emlUrl: string | undefined = result?.files?.eml || result?.downloadUrl;
      if (emlUrl) {
        try {
          const emlResponse = await fetch(emlUrl);
          if (emlResponse.ok) {
            const blob = await emlResponse.blob();
            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = `bail-signature-${leaseIdForSend}.eml`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(blobUrl);
          }
        } catch (downloadError) {
          console.warn('[PropertyLeasesClient] Téléchargement EML impossible:', downloadError);
        }
      }
      if (!organizationId) throw new Error('Organisation requise');
      const leaseService = createLeaseServiceWithMode('app-shell');
      await leaseService.updateLease(lease.id, organizationId, { status: 'ENVOYÉ' });
      await triggerSilentSyncIfOnline('send_for_signature_local_status', {
        pullLease: true,
        pullDocument: true,
        pullDocumentLink: true,
      });
      setSelectedLease((prev) => (prev && prev.id === lease.id ? { ...prev, status: 'ENVOYÉ' } : prev));
      notify2.success('Bail envoye pour signature');
      refreshAfterWorkflow(lease.id, 'send_for_signature');
    } catch (error) {
      notify2.error(error instanceof Error ? error.message : "Erreur d'envoi pour signature");
    }
  }, [findPendingCreateLeaseError, organizationId, refreshAfterWorkflow, triggerSilentSyncIfOnline]);

  const handleCancelSendFromDrawer = useCallback(async (lease: LeaseWithDetails) => {
    try {
      if (!organizationId) throw new Error('Organisation requise');
      const leaseService = createLeaseServiceWithMode('app-shell');
      await leaseService.updateLease(lease.id, organizationId, { status: 'BROUILLON' });
      await triggerSilentSyncIfOnline('cancel_send', { pullLease: true });
      setSelectedLease((prev) => (prev && prev.id === lease.id ? { ...prev, status: 'BROUILLON' } : prev));
      notify2.success('Envoi annule');
      refreshAfterWorkflow(lease.id, 'cancel_send');
    } catch (error) {
      notify2.error(error instanceof Error ? error.message : "Erreur lors de l'annulation");
    }
  }, [organizationId, refreshAfterWorkflow, triggerSilentSyncIfOnline]);

  const handleUploadSignedFromDrawer = useCallback(async (lease: LeaseWithDetails, file: File) => {
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        notify2.error('Action indisponible', "L'upload du bail signe nécessite une connexion internet.");
        return;
      }
      const formData = new FormData();
      formData.append('signedPdf', file);
      const response = await fetch(`/api/leases/${lease.id}/upload-signed`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Impossible d'uploader le bail signe");
      }
      const payload = await response.json().catch(() => ({}));
      if (!organizationId) throw new Error('Organisation requise');
      const leaseService = createLeaseServiceWithMode('app-shell');
      await leaseService.updateLease(lease.id, organizationId, {
        status: payload?.lease?.status || 'SIGNÉ',
        signedPdfUrl: payload?.lease?.signedPdfUrl || lease.signedPdfUrl || null,
      });
      await triggerSilentSyncIfOnline('upload_signed', {
        pullLease: true,
        pullDocument: true,
        pullDocumentLink: true,
      });
      setSelectedLease((prev) =>
        prev && prev.id === lease.id
          ? {
              ...prev,
              status: payload?.lease?.status || 'SIGNÉ',
              signedPdfUrl: payload?.lease?.signedPdfUrl || prev.signedPdfUrl,
            }
          : prev
      );
      notify2.success('Bail signe uploade');
      refreshAfterWorkflow(lease.id, 'upload_signed');
      window.dispatchEvent(new CustomEvent('documents:refresh', { detail: { scope: 'property', propertyId, reason: 'create' } }));
    } catch (error) {
      notify2.error(error instanceof Error ? error.message : "Erreur lors de l'upload du bail signe");
    }
  }, [organizationId, propertyId, refreshAfterWorkflow, triggerSilentSyncIfOnline]);

  const handleActivateFromDrawer = useCallback(async (lease: LeaseWithDetails) => {
    try {
      if (!organizationId) throw new Error('Organisation requise');
      const leaseService = createLeaseServiceWithMode('app-shell');
      await leaseService.updateLease(lease.id, organizationId, { status: 'ACTIF' });
      await triggerSilentSyncIfOnline('activate', { pullLease: true });
      setSelectedLease((prev) => (prev && prev.id === lease.id ? { ...prev, status: 'ACTIF' } : prev));
      notify2.success('Bail active');
      refreshAfterWorkflow(lease.id, 'mark_active');
    } catch (error) {
      notify2.error(error instanceof Error ? error.message : "Erreur d'activation du bail");
    }
  }, [organizationId, refreshAfterWorkflow, triggerSilentSyncIfOnline]);

  // Gestion de la suppression multiple
  const handleDeleteMultiple = useCallback(() => {
    const openDeleteFlow = async () => {
      if (!organizationId) {
        const toDelete = filteredLeases.filter(l => selectedIds.has(l.id));
        setLeasesToConfirmDelete(toDelete);
        setShowDeleteConfirmModal(true);
        return;
      }

      const toProcess = filteredLeases.filter(l => selectedIds.has(l.id));
      const protectedItems: CannotDeleteLeaseItem[] = [];
      const deletableItems: LeaseWithDetails[] = [];

      let txTable: any = null;
      try {
        const db = await getLocalDB();
        txTable = db.tables.find((t: any) => t.name === 'Transaction');
      } catch {
        txTable = null;
      }

      for (const lease of toProcess) {
        const contractStatus = normalizeLeaseContractStatus(lease.status);
        if (contractStatus === 'ACTIF') {
          protectedItems.push({
            id: lease.id,
            propertyName: lease.Property?.name || 'Bien',
            tenantName: `${lease.Tenant?.firstName || ''} ${lease.Tenant?.lastName || ''}`.trim(),
            reason: "Ce bail est actif et ne peut pas être supprimé directement. Résiliez-le d'abord.",
            offerTerminate: true,
          });
          continue;
        }

        if (txTable) {
          const transactionCount = await txTable
            .where('organizationId')
            .equals(organizationId)
            .filter((tx: any) => tx.leaseId === lease.id || tx.bailId === lease.id)
            .count();
          if (transactionCount > 0) {
            protectedItems.push({
              id: lease.id,
              propertyName: lease.Property?.name || 'Bien',
              tenantName: `${lease.Tenant?.firstName || ''} ${lease.Tenant?.lastName || ''}`.trim(),
              reason: 'Ce bail contient des transactions et ne peut pas être supprimé.',
              offerTerminate: false,
            });
            continue;
          }
        }

        deletableItems.push(lease);
      }

      if (protectedItems.length > 0) {
        setProtectedLeasesForModal(protectedItems);
        setShowCannotDeleteModal(true);
      }

      if (deletableItems.length > 0) {
        if (protectedItems.length > 0) {
          notify2.warning(`${protectedItems.length} bail(x) non supprimable(s) exclu(s) de la sélection.`);
        }
        setLeasesToConfirmDelete(deletableItems);
        setShowDeleteConfirmModal(true);
      } else if (protectedItems.length === 0) {
        notify2.info('Aucun bail sélectionné');
      }
    };

    void openDeleteFlow();
  }, [filteredLeases, organizationId, selectedIds]);

  const propertyLeaseSummaryLine = useMemo(() => {
    if (actionCountsLoading) {
      return 'Synthèse en cours de calcul…';
    }
    const actifs = allLeases.filter((l) => normalizeLeaseContractStatus(l.status) === 'ACTIF');
    const n = actifs.length;
    const monthly = actifs.reduce(
      (s, l) => s + l.rentAmount + (l.chargesRecupMensuelles ?? 0),
      0
    );
    const fmtEuro = (v: number) =>
      new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

    const bailPart =
      n === 0 ? 'Aucun bail actif' : n === 1 ? '1 bail actif' : `${n} baux actifs`;
    const euroPart = n === 0 ? '—' : `${fmtEuro(monthly)}/mois`;

    let payPart = '—';
    if (n > 0) {
      let hasRetard = false;
      let hasPartiel = false;
      for (const l of actifs) {
        const meta = leasePilotageById[l.id];
        if (meta?.paymentGlobale === 'retard') hasRetard = true;
        if (meta?.paymentGlobale === 'partiel') hasPartiel = true;
      }
      if (hasRetard) payPart = 'Retard';
      else if (hasPartiel) payPart = 'Partiel';
      else payPart = 'Aucun retard';
    }

    return `${bailPart} • ${euroPart} • ${payPart}`;
  }, [actionCountsLoading, allLeases, leasePilotageById]);

  useLayoutEffect(() => {
    if (!onLeaseSummaryLineChange) return;
    onLeaseSummaryLineChange(propertyLeaseSummaryLine);
  }, [propertyLeaseSummaryLine, onLeaseSummaryLineChange]);

  return (
    <div className="space-y-6">
      <LeasesPriorityActionsBlock
        actions={priorityActions}
        isLoading={actionCountsLoading}
        showAll={showAllPriorityActions}
        onToggleShowAll={() => setShowAllPriorityActions((v) => !v)}
        onPrimaryCta={handlePriorityActionCta}
        onNavigateToLeaseRow={scrollToLeaseTableRow}
        pilotageAvailable
        noActionsMessage="Aucune action requise pour le moment"
        presentation="property"
      />

      {/* Analytics repliables */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <button
          type="button"
          onClick={() => setChartsExpanded((e) => !e)}
          className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <span>Synthèse et graphiques</span>
          {chartsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {chartsExpanded && (
          <>
            <div className="grid gap-4 grid-cols-1 md:grid-cols-4 p-4 pt-0 border-t border-gray-100">
              {/* Graphique 1 : Évolution des loyers (2 colonnes) */}
              <div className="md:col-span-2">
                <LeasesRentEvolutionChart
                  monthlyData={chartsData?.rentEvolution?.monthly ?? []}
                  yearlyData={chartsData?.rentEvolution?.yearly ?? []}
                  isLoading={chartsLoading}
                />
              </div>
              {/* Graphique 2 : Répartition par type de meublé (1 colonne) */}
              <div className="md:col-span-1">
                <LeasesByFurnishedChart
                  data={chartsData?.byFurnished ?? []}
                  isLoading={chartsLoading}
                />
              </div>
              {/* Graphique 3 : Cautions & Loyers cumulés (1 colonne) */}
              <div className="md:col-span-1">
                <LeasesDepositsRentsChart
                  data={chartsData?.depositsRents ?? { totalDeposits: 0, monthlyTotal: 0, yearlyTotal: 0 }}
                  isLoading={chartsLoading}
                />
              </div>
            </div>
            <div className="px-4 pb-3 pt-2 border-t border-gray-100">
              <LeasesKpiBar
                kpis={kpis}
                activeFilter={activeKpiFilter}
                onFilterChange={handleKpiFilterChange}
                isLoading={kpisLoading}
                variant="subtle"
              />
            </div>
          </>
        )}
      </div>

      {/* Filtres avancés (sans le filtre "Bien" qui est fixé) */}
      <LeasesFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onResetFilters={handleResetFilters}
        properties={properties}
        tenants={tenants}
        hidePropertyFilter={true} // MASQUER le filtre bien
      />

      {/* Actions groupées */}
      {selectedIds.size > 0 && (
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-900">
                {selectedIds.size} bail{selectedIds.size > 1 ? 'x' : ''} sélectionné{selectedIds.size > 1 ? 's' : ''}
              </span>
              <div className="flex-1" />
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleDeleteMultiple}
              >
                Supprimer
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setSelectedIds(new Set())}
              >
                Annuler
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tableau */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des Baux ({filteredLeases.length})</CardTitle>
          <p className="text-sm text-gray-600">
            {filteredLeases.length > 0
              ? `Affichage de 1 à ${filteredLeases.length} sur ${filteredLeases.length}`
              : 'Aucun bail pour ce bien'}
          </p>
        </CardHeader>
        <CardContent>
          <LeasesTableFilterStrip
            counts={actionCounts}
            activeFilter={actionFilter}
            onFilterChange={handleActionFilterChange}
            disabled={actionCountsLoading}
          />
          {/* Tri rapide */}
          <div className="flex items-center justify-between mb-4 pb-3 border-b">
            <p className="text-sm text-gray-700">
              <span className="font-semibold">{sortedLeases.length}</span> bail{sortedLeases.length > 1 ? 'x' : ''} affiché{sortedLeases.length > 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-500">Tri rapide:</span>
              <button
                onClick={() => handleSort('business')}
                className={`flex items-center gap-1 px-2 py-1 text-xs border rounded transition-colors ${
                  sortField === 'business'
                    ? 'bg-orange-50 border-orange-300 text-orange-700'
                    : 'bg-white border-gray-300 hover:bg-gray-50'
                }`}
                title="Tri métier (retards, partiels, expirations, OK)"
              >
                Priorité {sortField === 'business' ? (sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3" />}
              </button>
              <button
                onClick={() => handleSort('startDate')}
                className={`flex items-center gap-1 px-2 py-1 text-xs border rounded transition-colors ${
                  sortField === 'startDate' 
                    ? 'bg-orange-50 border-orange-300 text-orange-700' 
                    : 'bg-white border-gray-300 hover:bg-gray-50'
                }`}
                title="Trier par date de début"
              >
                Date début {sortField === 'startDate' ? (sortOrder === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3" />}
              </button>
              <button
                onClick={() => handleSort('endDate')}
                className={`flex items-center gap-1 px-2 py-1 text-xs border rounded transition-colors ${
                  sortField === 'endDate' 
                    ? 'bg-orange-50 border-orange-300 text-orange-700' 
                    : 'bg-white border-gray-300 hover:bg-gray-50'
                }`}
                title="Trier par date de fin"
              >
                Date fin {sortField === 'endDate' ? (sortOrder === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3" />}
              </button>
              <button
                onClick={() => handleSort('rentAmount')}
                className={`flex items-center gap-1 px-2 py-1 text-xs border rounded transition-colors ${
                  sortField === 'rentAmount' 
                    ? 'bg-orange-50 border-orange-300 text-orange-700' 
                    : 'bg-white border-gray-300 hover:bg-gray-50'
                }`}
                title="Trier par loyer"
              >
                Loyer {sortField === 'rentAmount' ? (sortOrder === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3" />}
              </button>
            </div>
          </div>

          {/* Tableau des baux */}
          {/* ✅ [DEV-ONLY] Debug info (isolé derrière flag DEV) */}
          {process.env.NODE_ENV === 'development' && (window as any).__SMARTIMMO_DEBUG_LEASES__ && (
            <div className="text-xs text-gray-400 mb-2">
              [DEV] Render #{renderCountRef.current} | Leases affichées: {sortedLeases.length} | 
              {sortedLeases.length > 0 && (() => {
                const first = sortedLeases[0];
                return first ? <> Premier: {first.id.slice(0, 8)}... status={first.status}</> : null;
              })()}
            </div>
          )}
          <LeasesTableNew
            leases={sortedLeases}
            organizationId={organizationId}
            loading={isLoading}
            onView={handleViewLease}
            onEdit={handleEditLease}
            onDelete={handleDeleteLease}
            onActions={handleActionsLease}
            onSelect={handleSelectLease}
            onSelectAll={handleSelectAll}
            selectedIds={stableSelectedIds}
            showSelection={true}
            leaseHealthMap={leaseHealthMap}
            onQuickPay={handleViewLease}
            leasePilotageById={leasePilotageById}
            leasePaymentPilotageById={leasePaymentPilotageById}
            pageMode="app-shell"
            transactionsHrefForLease={transactionsHrefForLeaseTab}
            onPilotagePrimaryCta={handlePilotageTablePrimaryCta}
          />
        </CardContent>
      </Card>


      {/* Modale de création (avec propertyId pré-rempli et verrouillé) */}
      {isModalOpen && (
        <LeaseFormComplete
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onSubmit={handleModalSubmit}
          title="Nouveau bail"
          defaultPropertyId={propertyId} // PRÉ-REMPLI
          properties={properties} // ✅ Passer properties depuis IndexedDB
          tenants={tenants} // ✅ Passer tenants depuis IndexedDB
          mode="app-shell" // ✅ Indiquer le mode app-shell
        />
      )}

      {/* Modale d'édition */}
      {isEditModalOpen && selectedLease && (
        <LeaseEditModal
          isOpen={isEditModalOpen}
          onClose={handleCloseModal}
          lease={selectedLease}
          onSubmit={handleModalSubmit}
          properties={properties}
          tenants={tenants}
          mode="app-shell"
          propertyId={propertyId}
          onRequestAmendment={handleRequestAmendmentFromEditModal}
        />
      )}

      {showRenewModal && renewBaseLease && (
        <LeaseFormComplete
          isOpen={showRenewModal}
          onClose={() => {
            setShowRenewModal(false);
            setRenewBaseLease(null);
          }}
          onSubmit={handleRenewalSubmit}
          title="Créer un avenant / renouvellement"
          initialData={buildLeaseRenewalInitialData(renewBaseLease)}
          defaultPropertyId={propertyId}
          properties={properties}
          tenants={tenants}
          mode="app-shell"
        />
      )}

      {/* Drawer de détail */}
      {isDrawerOpen && selectedLease && (
        <LeaseDetailView
          lease={selectedLease}
          isOpen={isDrawerOpen}
          onClose={handleCloseDrawer}
          onEdit={(lease) => {
            setIsDrawerOpen(false);
            handleEditLease(lease);
          }}
          onDelete={(lease) => handleDeleteLease(lease)}
          onTerminateLease={handleOpenTerminateLease}
          onRenewLease={handleOpenRenewLease}
          onGenerateReceipt={(lease) => {
            setSelectedLease(lease);
            setShowActionsModal(true);
          }}
          onIndexLease={handleIndexLease}
          onEnregistrerPaiement={handleEnregistrerPaiement}
          onSendForSignature={handleSendForSignatureFromDrawer}
          onCancelSend={handleCancelSendFromDrawer}
          onUploadSignedLease={handleUploadSignedFromDrawer}
          onActivateLease={handleActivateFromDrawer}
        />
      )}

      {/* Modale de génération de quittance */}
      {showActionsModal && selectedLease && (
        <LeaseActionsManager
          lease={{
            id: selectedLease.id,
            propertyId: selectedLease.propertyId,
            tenantId: selectedLease.tenantId,
            type: selectedLease.type,
            furnishedType: selectedLease.furnishedType,
            startDate: selectedLease.startDate,
            endDate: selectedLease.endDate || undefined,
            rentAmount: selectedLease.rentAmount,
            charges: selectedLease.charges ?? 0,
            deposit: selectedLease.deposit ?? 0,
            paymentDay: selectedLease.paymentDay ?? 5,
            status: selectedLease.status,
            notes: selectedLease.notes || undefined,
            Property: selectedLease.Property,
            Tenant: selectedLease.Tenant,
            signedPdfUrl: selectedLease.signedPdfUrl,
          }}
          onClose={() => {
            setShowActionsModal(false);
            setSelectedLease(null);
          }}
          onSuccess={() => {
            // ✅ APP-SHELL: Refresh via événement ciblé
            window.dispatchEvent(new CustomEvent('leases:refresh', { 
              detail: { scope: 'property', propertyId, reason: 'crud' } 
            }));
          }}
          initialAction="generate-receipt"
        />
      )}

      {/* Modale d'enregistrement de paiement */}
      <TransactionModal
        isOpen={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          setPaymentPrefill(null);
        }}
        onSubmit={handlePaymentModalSubmit}
        context={{ type: 'property', propertyId }}
        mode="create"
        title="Enregistrer un paiement"
        prefill={paymentPrefill ?? undefined}
      />

      <LeaseIndexationModal
        isOpen={showIndexationModal}
        lease={selectedLease}
        onClose={() => setShowIndexationModal(false)}
        onApplied={() => {
          window.dispatchEvent(
            new CustomEvent('leases:refresh', {
              detail: { scope: 'property', propertyId, reason: 'indexation' },
            })
          );
        }}
      />

      <LeaseTerminationModal
        isOpen={showTerminateModal}
        lease={selectedLease}
        onClose={() => setShowTerminateModal(false)}
        onConfirm={handleConfirmTerminateLease}
      />

      {/* Modale de confirmation de suppression */}
      <DeleteConfirmModal
        isOpen={showDeleteConfirmModal}
        onClose={() => {
          setShowDeleteConfirmModal(false);
          setLeasesToConfirmDelete([]);
        }}
        onConfirm={handleConfirmDelete}
        leases={leasesToConfirmDelete.map(lease => ({
          id: lease.id,
          propertyName: lease.Property.name,
          tenantName: `${lease.Tenant.firstName} ${lease.Tenant.lastName}`
        }))}
      />

      {/* Modale d'impossibilité de suppression */}
      <CannotDeleteLeaseModal
        isOpen={showCannotDeleteModal}
        onClose={() => setShowCannotDeleteModal(false)}
        protectedLeases={protectedLeasesForModal}
        onTerminateLeases={handleTerminateMultiple}
      />
    </div>
  );
}

