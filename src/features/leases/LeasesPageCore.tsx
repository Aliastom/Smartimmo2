/**
 * Core Component pour la page Baux/Leases
 * 
 * Une seule source de vérité graphique utilisable en mode "normal" et "app-shell"
 * Toute la logique UI est centralisée ici.
 * 
 * Réplique EXACTEMENT le comportement de LeasesClient.tsx
 */

'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { notify2 } from '@/lib/notify2';
import { Plus, ArrowUpDown, ArrowUp, ArrowDown, Loader2, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { LeasesKpiBar } from '@/components/leases/LeasesKpiBar';
import { LeasesRentEvolutionChart } from '@/components/leases/LeasesRentEvolutionChart';
import { LeasesByFurnishedChart } from '@/components/leases/LeasesByFurnishedChart';
import { LeasesDepositsRentsChart } from '@/components/leases/LeasesDepositsRentsChart';
import { useLeasesKpis } from '@/hooks/useLeasesKpis';
import { useLeasesCharts } from '@/hooks/useLeasesCharts';
import LeasesFilters from '@/components/leases/LeasesFilters';
import { LeasesTableNew } from '@/components/leases/LeasesTableNew';
import type { ActionFilterKey } from '@/features/leases/components/LeasesActionBanner';
import { LeasesPriorityActionsBlock } from '@/features/leases/components/LeasesPriorityActionsBlock';
import { LeasesGlobalActionsBar } from '@/features/leases/components/LeasesGlobalActionsBar';
import {
  LeasesToolbar,
  type PilotageBucketFilterKey,
} from '@/features/leases/components/LeasesToolbar';
import {
  groupLeasesByPilotageBucket,
  partitionSortedLeasesByPilotageBucket,
  classifyLeasePilotageBucket,
  type LeasePilotageBucket,
} from '@/features/leases/utils/leasePilotageSection';
import { scrollToLeaseTableRow } from '@/features/leases/utils/scrollToLeaseTableRow';
import { useLeasesActionCounts } from '@/features/leases/hooks/useLeasesActionCounts';
import {
  toLeasePriorityAction,
  type LeasePriorityAction,
  type LeasePilotageRowMeta,
} from '@/features/leases/utils/buildLeasePriorityActions';
import LeaseDetailView from '@/features/leases/components/LeaseDetailView';
import { LeaseIndexationModal } from '@/features/leases/components/LeaseIndexationModal';
import LeaseFormComplete from '@/components/forms/LeaseFormComplete';
import LeaseEditModal from '@/components/forms/LeaseEditModal';
import LeaseActionsManager from '@/components/forms/LeaseActionsManager';
import CannotDeleteLeaseModal from '@/components/leases/CannotDeleteLeaseModal';
import type { CannotDeleteLeaseItem } from '@/components/leases/cannotDeleteLeaseTypes';
import DeleteConfirmModal from '@/components/leases/DeleteConfirmModal';
import { TransactionModal } from '@/components/transactions/TransactionModalV2';
import { createTransactionServiceWithMode } from '@/domain/services/transactionServiceFactory';
import { LeaseTerminationModal } from '@/features/leases/components/LeaseTerminationModal';
import type { LeasePaymentsTimelineMonth } from './hooks/useLeasePaymentsTimeline';
import type { TransactionFormData } from '@/lib/validations/transaction';
import type { LeaseWithDetails } from '@/lib/services/leasesService';
import { useLeasesData, type LeasesFilters } from './hooks/useLeasesData';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
// Import supprimé : plus besoin du repository offline directement, on utilise les services via factories
import { useAlert } from '@/hooks/useAlert';
import { useSidebarOptional } from '@/contexts/SidebarContext';
import { normalizeLeaseContractStatus } from './utils/leaseWorkflowStatus';
import { buildLeaseRenewalInitialData } from './utils/buildLeaseRenewalInitialData';
import { classifySmartimmoId } from '@/lib/offline/leaseSignatureWorkflowDiag';
import { getLocalDB } from '@/lib/offline/db';
import {
  GlobalPilotageDetailAccordion,
  GlobalPilotageAlertsSection,
} from '@/components/global-pilotage';

export interface LeasesPageCoreProps {
  mode: 'normal' | 'app-shell';
}

export function LeasesPageCore({
  mode,
}: LeasesPageCoreProps) {
  const { organizationId } = useCurrentOrganization();
  const sidebarContext = useSidebarOptional();
  const router = mode === 'normal' ? useRouter() : null;
  const searchParamsHook = mode === 'normal' ? useSearchParams() : null;
  const { showAlert } = useAlert();
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

  // États de sélection multiple
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // États de tri (tri métier par défaut : retards > partiels > expirations > ok)
  const [sortField, setSortField] = useState<'business' | 'startDate' | 'endDate' | 'rentAmount'>('business');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc'); // asc = problèmes en premier

  // États des modals et drawer
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedLease, setSelectedLease] = useState<LeaseWithDetails | null>(null);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [leasesToConfirmDelete, setLeasesToConfirmDelete] = useState<LeaseWithDetails[]>([]);
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [showCannotDeleteModal, setShowCannotDeleteModal] = useState(false);
  const [protectedLeasesForModal, setProtectedLeasesForModal] = useState<CannotDeleteLeaseItem[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showTerminateModal, setShowTerminateModal] = useState(false);
  const [renewBaseLease, setRenewBaseLease] = useState<LeaseWithDetails | null>(null);
  const [showIndexationModal, setShowIndexationModal] = useState(false);
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
  
  // État pour le filtre KPI actif
  const [activeKpiFilter, setActiveKpiFilter] = useState<string | null>(null);
  // État pour le bandeau "À traiter" (filtre le tableau)
  const [actionFilter, setActionFilter] = useState<ActionFilterKey>(null);
  // Détail graphiques / filtres / tableau — fermé par défaut (aligné Échéances)
  const [leasesDetailOpen, setLeasesDetailOpen] = useState(false);
  const [showAllPriorityActions, setShowAllPriorityActions] = useState(false);
  const [pilotageBucketFilter, setPilotageBucketFilter] = useState<PilotageBucketFilterKey>(null);
  const [leasePilotageLayout, setLeasePilotageLayout] = useState<'grouped' | 'compact'>('grouped');
  const batchPayRemainderRef = useRef<LeasePriorityAction[]>([]);
  const openPaymentFromPriorityItemRef = useRef<(lease: LeaseWithDetails, item: LeasePriorityAction) => void>(() => {});

  // États des filtres
  const [filters, setFilters] = useState<LeasesFilters>({
    search: '',
    propertyId: '',
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
  
  // État pour forcer le rafraîchissement des KPI et graphiques
  const [refreshKey, setRefreshKey] = useState(0);

  // Utiliser le hook unifié pour les données
  const {
    leases,
    properties,
    tenants,
    totalCount,
    loading,
    error,
  } = useLeasesData({
    mode,
    filters: mode === 'app-shell' ? filters : undefined,
    activeKpiFilter,
  });

  // Charger les KPI avec le hook
  const { kpis, isLoading: kpisLoading } = useLeasesKpis({
    mode,
    refreshKey,
  });

  // Charger les graphiques avec le hook
  const { data: chartsData, isLoading: chartsLoading } = useLeasesCharts({
    mode,
    refreshKey,
  });

  // Compteurs "À traiter" (partiels, retards, expirant, indexations)
  const {
    counts: actionCounts,
    priorityActions,
    leasePilotageById,
    leasePaymentPilotageById,
    loading: actionCountsLoading,
  } = useLeasesActionCounts(organizationId ?? null, leases, mode);

  const pilotageBucketCounts = useMemo(() => {
    const g = groupLeasesByPilotageBucket(leases, leasePilotageById, actionCounts);
    return {
      critique: g.critique.length,
      surveiller: g.surveiller.length,
      ok: g.ok.length,
      ignored: g.ignored.length,
    } as Record<'critique' | 'surveiller' | 'ok' | 'ignored', number>;
  }, [leases, leasePilotageById, actionCounts]);

  const leasePilotageBucketById = useMemo(() => {
    const m: Record<string, LeasePilotageBucket> = {};
    for (const l of leases) {
      m[l.id] = classifyLeasePilotageBucket(l, leasePilotageById[l.id], actionCounts);
    }
    return m;
  }, [leases, leasePilotageById, actionCounts]);

  useEffect(() => {
    if (priorityActions.length <= 5) setShowAllPriorityActions(false);
  }, [priorityActions.length]);

  useEffect(() => {
    if (!selectedLease) return;
    const fresh = leases.find((l) => l.id === selectedLease.id);
    if (!fresh) return;
    if (fresh.status !== selectedLease.status || fresh.updatedAt !== selectedLease.updatedAt) {
      setSelectedLease(fresh);
    }
  }, [leases, selectedLease]);

  // Nettoyer l'URL au montage (mode normal uniquement)
  useEffect(() => {
    if (mode === 'normal' && router && searchParamsHook) {
      const hasFilters = searchParamsHook.toString().length > 0;
      if (hasFilters) {
        router.replace('/baux', { scroll: false });
      }
    }
  }, [mode, router, searchParamsHook]);

  // Gestion des filtres
  const handleFiltersChange = useCallback((newFilters: LeasesFilters) => {
    setFilters(newFilters);
    if (mode === 'normal' && router) {
      const params = new URLSearchParams();
      Object.entries(newFilters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      const newURL = params.toString() ? `?${params.toString()}` : '';
      router.replace(`/baux${newURL}`, { scroll: false });
    }
  }, [mode, router]);

  // Gestion du filtre KPI (cartes filtrantes)
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
    const resetFilters: LeasesFilters = {
      search: '',
      propertyId: '',
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
    if (mode === 'normal' && router) {
      router.replace('/baux', { scroll: false });
    }
  }, [mode, router]);

  // Gestion des actions sur les baux
  const handleCreateLease = useCallback(() => {
    setSelectedLease(null);
    setIsModalOpen(true);
  }, []);

  const handleViewLease = useCallback((lease: LeaseWithDetails) => {
    setSelectedLease(lease);
    setIsDrawerOpen(true);
  }, []);

  const handleViewLeaseById = useCallback(
    (leaseId: string) => {
      const lease = leases.find((l) => l.id === leaseId);
      if (lease) handleViewLease(lease);
    },
    [leases, handleViewLease]
  );

  const handleEditLease = useCallback((lease: LeaseWithDetails) => {
    const contract = normalizeLeaseContractStatus(lease.status);
    if (contract === 'RESILIE' || contract === 'ARCHIVE') {
      notify2.warning('Bail en lecture seule', "Un bail résilié/archivé ne peut plus être modifié.");
      return;
    }
    setSelectedLease(lease);
    setIsEditModalOpen(true);
  }, []);

  const assessLeaseDeletion = useCallback(async (lease: LeaseWithDetails) => {
    const tenantName = `${lease.Tenant?.firstName || ''} ${lease.Tenant?.lastName || ''}`.trim();
    const base = {
      id: lease.id,
      propertyName: lease.Property?.name || 'Bien',
      tenantName,
    };

    // Pré-check local app-shell pour éviter la double modal.
    if (mode === 'app-shell' && organizationId) {
      const contract = normalizeLeaseContractStatus(lease.status);
      if (contract === 'ACTIF') {
        return {
          deletable: false,
          protected: {
            ...base,
            reason: "Ce bail est actif et ne peut pas être supprimé directement. Résiliez-le d'abord.",
            offerTerminate: true,
          },
        };
      }
      try {
        const db = await getLocalDB();
        const txTable = db.tables.find((t: any) => t.name === 'Transaction');
        const txCount = txTable
          ? await txTable
              .where('organizationId')
              .equals(organizationId)
              .filter((tx: any) => tx.leaseId === lease.id || tx.bailId === lease.id)
              .count()
          : 0;

        if (txCount > 0) {
          return {
            deletable: false,
            protected: {
              ...base,
              reason: 'Ce bail contient des transactions et ne peut pas être supprimé.',
              offerTerminate: false,
            },
          };
        }
      } catch {
        // fallback: laisser la protection service faire foi
      }
      return { deletable: true };
    }

    // En mode normal, utiliser le check API dédié.
    if (mode === 'normal') {
      try {
        const response = await fetch(`/api/leases/${lease.id}/check-deletable`);
        if (response.ok) {
          const result = await response.json();
          if (!result?.deletable) {
            const contract = normalizeLeaseContractStatus(lease.status);
            return {
              deletable: false,
              protected: {
                ...base,
                reason: result?.reason || 'Ce bail ne peut pas être supprimé.',
                offerTerminate: contract === 'ACTIF',
              },
            };
          }
        }
      } catch {
        // fallback: on garde la protection service
      }
    }
    return { deletable: true };
  }, [mode, organizationId]);

  const handleDeleteLease = useCallback((lease: LeaseWithDetails) => {
    const openDeleteFlow = async () => {
      const verdict = await assessLeaseDeletion(lease);
      if (!verdict.deletable && verdict.protected) {
        setProtectedLeasesForModal([verdict.protected]);
        setShowCannotDeleteModal(true);
        return;
      }
      setLeasesToConfirmDelete([lease]);
      setShowDeleteConfirmModal(true);
    };
    void openDeleteFlow();
  }, [assessLeaseDeletion]);

  // Fonction pour effectuer la suppression après confirmation
  const handleConfirmDelete = useCallback(async () => {
    const leasesToProcess = [...leasesToConfirmDelete];
    const orgId = organizationId || 'default';
    const isOnline = typeof navigator !== 'undefined' && navigator.onLine;

    try {
      // Utiliser le service via factory selon le mode
      const { createLeaseServiceWithMode } = await import('@/domain/services/leaseServiceFactory');
      const leaseService = createLeaseServiceWithMode(mode === 'app-shell' ? 'app-shell' : 'normal');

      // Supprimer chaque bail via le service (le service gère les protections)
      const results = await Promise.allSettled(
        leasesToProcess.map(lease => leaseService.deleteLease(lease.id, orgId))
      );

      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      // Gérer les erreurs de protection (baux actifs ou avec transactions)
      const protectedLeases: CannotDeleteLeaseItem[] = [];
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          const error = result.reason as Error;
          if (error.message.includes('actif') || error.message.includes('transactions')) {
            const leaseRow = leasesToProcess[index];
            if (!leaseRow) return;
            protectedLeases.push({
              id: leaseRow.id,
              propertyName: leaseRow.Property.name,
              tenantName: `${leaseRow.Tenant.firstName} ${leaseRow.Tenant.lastName}`,
              reason: error.message,
              offerTerminate: normalizeLeaseContractStatus(leaseRow.status) === 'ACTIF',
            });
          }
        }
      });

      // Si des baux sont protégés, afficher la modal
      if (protectedLeases.length > 0) {
        setProtectedLeasesForModal(protectedLeases);
        setShowCannotDeleteModal(true);
        // Ne pas supprimer les baux qui ont réussi, on les garde dans la liste pour réessayer
        return;
      }

      // Afficher le message selon le statut online/offline
      if (mode === 'app-shell' && isOnline) {
        // Si online, déclencher une sync immédiate
        try {
          const { getGlobalSyncService } = await import('@/lib/offline/syncGlobal');
          const syncService = getGlobalSyncService();
          await syncService.syncAllPendingToRemote(orgId);

          await showAlert({
            type: 'success',
            title: 'Baux supprimés',
            message: `${succeeded} bail${succeeded > 1 ? 'x' : ''} supprimé${succeeded > 1 ? 's' : ''} localement et sur le serveur.`,
          });
        } catch (syncError) {
          console.error('Error syncing delete leases operation:', syncError);
          await showAlert({
            type: 'success',
            title: 'Baux supprimés localement',
            message: `${succeeded} bail${succeeded > 1 ? 'x' : ''} supprimé${succeeded > 1 ? 's' : ''} localement.\nLa suppression sera synchronisée avec le serveur lors de la prochaine synchronisation.`,
          });
        }
      } else if (mode === 'app-shell') {
        await showAlert({
          type: 'success',
          title: 'Baux supprimés (mode hors-ligne)',
          message: `${succeeded} bail${succeeded > 1 ? 'x' : ''} supprimé${succeeded > 1 ? 's' : ''} localement.\nLa suppression sera automatiquement synchronisée avec le serveur dès que la connexion sera rétablie.`,
        });
      } else {
        if (succeeded > 0) {
          notify2.success(`${succeeded} bail${succeeded > 1 ? 'x' : ''} supprimé${succeeded > 1 ? 's' : ''} avec succès`);
        }
        if (failed > 0) {
          notify2.error(`${failed} bail${failed > 1 ? 'x' : ''} n'ont pas pu être supprimé${failed > 1 ? 's' : ''}`);
        }
      }

      // Rafraîchir l'UI
      if (mode === 'normal' && router) {
        router.refresh();
      } else {
        // ✅ APP-SHELL: Émettre événement avec scope 'global' pour la page globale
        window.dispatchEvent(new CustomEvent('leases:refresh', { 
          detail: { scope: 'global', reason: 'delete_multiple' } 
        }));
      }
      setRefreshKey(prev => prev + 1);
      setShowDeleteConfirmModal(false);
      setLeasesToConfirmDelete([]);
      setSelectedIds(new Set());
      
      if (isDrawerOpen) {
        setIsDrawerOpen(false);
      }
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      notify2.error('Erreur lors de la suppression des baux');
    }
  }, [leasesToConfirmDelete, isDrawerOpen, mode, organizationId, router, showAlert]);

  const handleActionsLease = useCallback((lease: LeaseWithDetails) => {
    console.log('Actions pour le bail:', lease.id);
  }, []);

  const refreshLeaseAfterWorkflow = useCallback(async (leaseId: string, reason: string) => {
    setRefreshKey(prev => prev + 1);
    if (mode === 'normal') {
      try {
        const response = await fetch(`/api/leases/${leaseId}`);
        if (response.ok) {
          const updatedLease = await response.json();
          setSelectedLease(updatedLease.data || updatedLease);
        }
      } catch (error) {
        console.error('Erreur lors du rechargement du bail:', error);
      }
    } else {
      window.dispatchEvent(new CustomEvent('leases:refresh', { detail: { scope: 'global', reason, leaseId } }));
    }
  }, [mode]);

  const runLeaseRoundTrip = useCallback(async (
    reason: string,
    options?: { pullLease?: boolean; pullDocument?: boolean; pullDocumentLink?: boolean }
  ) => {
    if (mode !== 'app-shell') return;
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
      console.warn(`[LeasesPageCore] round-trip échoué (${reason})`, error);
    }
  }, [mode, organizationId]);

  const handleSendForSignatureFromDrawer = useCallback(async (lease: LeaseWithDetails) => {
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        notify2.error('Action indisponible', "L'envoi pour signature nécessite une connexion internet.");
        return;
      }
      let leaseIdForSend = lease.id;
      if (mode === 'app-shell' && classifySmartimmoId(lease.id) === 'uuid_local') {
        const { getGlobalSyncService } = await import('@/lib/offline/syncGlobal');
        const syncService = getGlobalSyncService();
        await syncService.syncAllPendingToRemote(organizationId || '');

        const pendingCreateError = await findPendingCreateLeaseError(lease);
        if (pendingCreateError) {
          notify2.error('Impossible de synchroniser le bail', pendingCreateError);
          return;
        }

        const { getLeaseRepositoryOffline } = await import('@/lib/offline/repositories/LeaseRepositoryOffline');
        const leaseRepo = getLeaseRepositoryOffline();
        let allLeases = await leaseRepo.getAll(organizationId || '', { propertyId: lease.propertyId });
        let syncedMatch = allLeases.find((l: any) =>
          l.propertyId === lease.propertyId &&
          l.tenantId === lease.tenantId &&
          String(l.startDate).slice(0, 10) === String(lease.startDate).slice(0, 10) &&
          classifySmartimmoId(l.id) === 'cuid_remote'
        );
        if (!syncedMatch) {
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
          console.warn('[LeasesPageCore] Téléchargement EML impossible:', downloadError);
        }
      }
      if (mode === 'app-shell') {
        if (!organizationId) throw new Error('Organisation requise');
        const { createLeaseServiceWithMode } = await import('@/domain/services/leaseServiceFactory');
        const leaseService = createLeaseServiceWithMode('app-shell');
        await leaseService.updateLease(lease.id, organizationId, { status: 'ENVOYÉ' });
        await runLeaseRoundTrip('send_for_signature_local_status', {
          pullLease: true,
          pullDocument: true,
          pullDocumentLink: true,
        });
      }
      setSelectedLease((prev) => (prev && prev.id === lease.id ? { ...prev, status: 'ENVOYÉ' } : prev));
      notify2.success('Bail envoye pour signature');
      await refreshLeaseAfterWorkflow(lease.id, 'send_for_signature');
    } catch (error) {
      notify2.error(error instanceof Error ? error.message : "Erreur d'envoi pour signature");
    }
  }, [findPendingCreateLeaseError, mode, organizationId, refreshLeaseAfterWorkflow, runLeaseRoundTrip]);

  const handleCancelSendFromDrawer = useCallback(async (lease: LeaseWithDetails) => {
    try {
      if (!organizationId) throw new Error('Organisation requise');
      const { createLeaseServiceWithMode } = await import('@/domain/services/leaseServiceFactory');
      const leaseService = createLeaseServiceWithMode(mode === 'app-shell' ? 'app-shell' : 'normal');
      await leaseService.updateLease(lease.id, organizationId, { status: 'BROUILLON' });
      await runLeaseRoundTrip('cancel_send', { pullLease: true });
      setSelectedLease((prev) => (prev && prev.id === lease.id ? { ...prev, status: 'BROUILLON' } : prev));
      notify2.success('Envoi annule');
      await refreshLeaseAfterWorkflow(lease.id, 'cancel_send');
    } catch (error) {
      notify2.error(error instanceof Error ? error.message : "Erreur lors de l'annulation");
    }
  }, [organizationId, mode, refreshLeaseAfterWorkflow, runLeaseRoundTrip]);

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
      if (mode === 'app-shell') {
        if (!organizationId) throw new Error('Organisation requise');
        const { createLeaseServiceWithMode } = await import('@/domain/services/leaseServiceFactory');
        const leaseService = createLeaseServiceWithMode('app-shell');
        await leaseService.updateLease(lease.id, organizationId, {
          status: payload?.lease?.status || 'SIGNÉ',
          signedPdfUrl: payload?.lease?.signedPdfUrl || lease.signedPdfUrl || null,
        });
        await runLeaseRoundTrip('upload_signed', {
          pullLease: true,
          pullDocument: true,
          pullDocumentLink: true,
        });
      }
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
      await refreshLeaseAfterWorkflow(lease.id, 'upload_signed');
      window.dispatchEvent(new CustomEvent('documents:refresh', { detail: { scope: 'global', reason: 'create' } }));
    } catch (error) {
      notify2.error(error instanceof Error ? error.message : "Erreur lors de l'upload du bail signe");
    }
  }, [mode, organizationId, refreshLeaseAfterWorkflow, runLeaseRoundTrip]);

  const handleActivateFromDrawer = useCallback(async (lease: LeaseWithDetails) => {
    try {
      if (!organizationId) throw new Error('Organisation requise');
      const { createLeaseServiceWithMode } = await import('@/domain/services/leaseServiceFactory');
      const leaseService = createLeaseServiceWithMode(mode === 'app-shell' ? 'app-shell' : 'normal');
      await leaseService.updateLease(lease.id, organizationId, { status: 'ACTIF' });
      await runLeaseRoundTrip('activate', { pullLease: true });
      setSelectedLease((prev) => (prev && prev.id === lease.id ? { ...prev, status: 'ACTIF' } : prev));
      notify2.success('Bail active');
      await refreshLeaseAfterWorkflow(lease.id, 'mark_active');
    } catch (error) {
      notify2.error(error instanceof Error ? error.message : "Erreur d'activation du bail");
    }
  }, [organizationId, mode, refreshLeaseAfterWorkflow, runLeaseRoundTrip]);

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

  const handleSelectAll = useCallback((selected: boolean) => {
    if (selected) {
      setSelectedIds(new Set(leases.map(l => l.id)));
    } else {
      setSelectedIds(new Set());
    }
  }, [leases]);

  // Gestion du tri
  const handleSort = useCallback((field: 'business' | 'startDate' | 'endDate' | 'rentAmount') => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder(field === 'business' ? 'asc' : 'desc');
    }
  }, [sortField]);

  // Filtrer par actionFilter puis trier les baux
  const sortedLeases = useMemo(() => {
    // 1. Appliquer le filtre "À traiter" si actif
    let toSort = [...leases];
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

    if (mode === 'app-shell' && pilotageBucketFilter) {
      toSort = toSort.filter(
        (l) =>
          classifyLeasePilotageBucket(l, leasePilotageById[l.id], actionCounts) === pilotageBucketFilter
      );
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
        // Sous-tri : expirant bientôt en premier (endDate croissant)
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
  }, [leases, sortField, sortOrder, actionFilter, actionCounts, mode, pilotageBucketFilter, leasePilotageById]);

  const pilotageGroupsSorted = useMemo(() => {
    if (mode !== 'app-shell' || leasePilotageLayout !== 'grouped') return null;
    return partitionSortedLeasesByPilotageBucket(sortedLeases, leasePilotageById, actionCounts);
  }, [mode, leasePilotageLayout, sortedLeases, leasePilotageById, actionCounts]);

  // Map leaseId -> santé pour surlignage et action rapide
  const leaseHealthMap = useMemo(() => {
    const map: Record<string, 'ok' | 'partiel' | 'retard'> = {};
    for (const lease of leases) {
      if (actionCounts.leaseIdsRetards.has(lease.id)) map[lease.id] = 'retard';
      else if (actionCounts.leaseIdsPartiels.has(lease.id)) map[lease.id] = 'partiel';
      else map[lease.id] = 'ok';
    }
    return map;
  }, [leases, actionCounts]);

  // Gestion des modales
  const handleModalSubmit = async (data: any) => {
    try {
      const orgId = organizationId || 'default';
      const isOnline = typeof navigator !== 'undefined' && navigator.onLine;

      // Utiliser le service via factory selon le mode
      const { createLeaseServiceWithMode } = await import('@/domain/services/leaseServiceFactory');
      const leaseService = createLeaseServiceWithMode(mode === 'app-shell' ? 'app-shell' : 'normal');

      if (data.id) {
        // Mise à jour
        await leaseService.updateLease(data.id, orgId, {
          propertyId: data.propertyId,
          tenantId: data.tenantId,
          type: data.type,
          furnishedType: data.furnishedType,
          startDate: data.startDate,
          endDate: data.endDate,
          rentAmount: data.rentAmount,
          deposit: data.deposit,
          paymentDay: data.paymentDay,
          indexationType: data.indexationType,
          notes: data.notes,
          status: data.status,
          signedPdfUrl: data.signedPdfUrl,
          chargesRecupMensuelles: data.chargesRecupMensuelles,
          chargesNonRecupMensuelles: data.chargesNonRecupMensuelles,
        });

        // En mode app-shell, déclencher sync si online
        if (mode === 'app-shell' && isOnline) {
          try {
            const { getGlobalSyncService } = await import('@/lib/offline/syncGlobal');
            const syncService = getGlobalSyncService();
            await syncService.syncAllPendingToRemote(orgId);
            
            await showAlert({
              type: 'success',
              title: 'Bail mis à jour',
              message: 'Le bail a été mis à jour localement et sur le serveur.',
            });
          } catch (syncError) {
            console.error('Error syncing lease operation:', syncError);
            await showAlert({
              type: 'success',
              title: 'Bail mis à jour localement',
              message: 'Le bail a été mis à jour localement.\nLa synchronisation sera effectuée lors de la prochaine synchronisation.',
            });
          }
        } else if (mode === 'app-shell') {
          await showAlert({
            type: 'success',
            title: 'Bail mis à jour (mode hors-ligne)',
            message: 'Le bail a été mis à jour localement.\nIl sera automatiquement synchronisé avec le serveur dès que la connexion sera rétablie.',
          });
        } else {
          notify2.success('Bail mis à jour avec succès');
        }
      } else {
        // Création
        await leaseService.createLease({
          organizationId: orgId,
          propertyId: data.propertyId,
          tenantId: data.tenantId,
          type: data.type,
          furnishedType: data.furnishedType,
          startDate: data.startDate,
          endDate: data.endDate,
          rentAmount: data.rentAmount,
          deposit: data.deposit,
          paymentDay: data.paymentDay,
          indexationType: data.indexationType,
          notes: data.notes,
          status: data.status,
          chargesRecupMensuelles: data.chargesRecupMensuelles,
          chargesNonRecupMensuelles: data.chargesNonRecupMensuelles,
        });

        // En mode app-shell, déclencher sync si online
        if (mode === 'app-shell' && isOnline) {
          try {
            const { getGlobalSyncService } = await import('@/lib/offline/syncGlobal');
            const syncService = getGlobalSyncService();
            await syncService.syncAllPendingToRemote(orgId);
            
            await showAlert({
              type: 'success',
              title: 'Bail créé',
              message: 'Le bail a été créé localement et sur le serveur.',
            });
          } catch (syncError) {
            console.error('Error syncing lease operation:', syncError);
            await showAlert({
              type: 'success',
              title: 'Bail créé localement',
              message: 'Le bail a été créé localement.\nLa synchronisation sera effectuée lors de la prochaine synchronisation.',
            });
          }
        } else if (mode === 'app-shell') {
          await showAlert({
            type: 'success',
            title: 'Bail créé (mode hors-ligne)',
            message: 'Le bail a été créé localement.\nIl sera automatiquement synchronisé avec le serveur dès que la connexion sera rétablie.',
          });
        } else {
          notify2.success('Bail créé avec succès');
        }
      }

      setIsModalOpen(false);
      setIsEditModalOpen(false);
      setSelectedLease(null);
      
      // Rafraîchir l'UI
      if (mode === 'normal' && router) {
        router.refresh();
      } else {
        // ✅ APP-SHELL: Émettre événement avec scope 'global' pour la page globale
        window.dispatchEvent(new CustomEvent('leases:refresh', { 
          detail: { scope: 'global', reason: data.id ? 'update' : 'crud' } 
        }));
      }
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error(`Erreur lors de ${data.id ? 'la mise à jour' : 'la création'} du bail:`, error);
      notify2.error(error instanceof Error ? error.message : `Erreur lors de ${data.id ? 'la mise à jour' : 'la création'} du bail`);
      throw error;
    }
  };

  // Fonction pour résilier plusieurs baux
  const handleTerminateMultiple = async (leaseIds: string[]) => {
    try {
      const orgId = organizationId || 'default';
      const isOnline = typeof navigator !== 'undefined' && navigator.onLine;

      // Utiliser le service via factory selon le mode
      const { createLeaseServiceWithMode } = await import('@/domain/services/leaseServiceFactory');
      const leaseService = createLeaseServiceWithMode(mode === 'app-shell' ? 'app-shell' : 'normal');

      // Résilier chaque bail via le service (mise à jour du statut)
      const results = await Promise.allSettled(
        leaseIds.map(leaseId => leaseService.updateLease(leaseId, orgId, { status: 'RÉSILIÉ' }))
      );

      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      // Afficher le message selon le statut online/offline
      if (mode === 'app-shell' && isOnline) {
        // Si online, déclencher une sync immédiate
        try {
          const { getGlobalSyncService } = await import('@/lib/offline/syncGlobal');
          const syncService = getGlobalSyncService();
          await syncService.syncAllPendingToRemote(orgId);

          await showAlert({
            type: 'success',
            title: 'Baux résiliés',
            message: `${succeeded} bail${succeeded > 1 ? 'x' : ''} résilié${succeeded > 1 ? 's' : ''} localement et sur le serveur. Vous pouvez maintenant les supprimer.`,
          });
        } catch (syncError) {
          console.error('Error syncing terminate leases operation:', syncError);
          await showAlert({
            type: 'success',
            title: 'Baux résiliés localement',
            message: `${succeeded} bail${succeeded > 1 ? 'x' : ''} résilié${succeeded > 1 ? 's' : ''} localement. La synchronisation sera effectuée lors de la prochaine synchronisation.`,
          });
        }
      } else if (mode === 'app-shell') {
        await showAlert({
          type: 'success',
          title: 'Baux résiliés (mode hors-ligne)',
          message: `${succeeded} bail${succeeded > 1 ? 'x' : ''} résilié${succeeded > 1 ? 's' : ''} localement. La synchronisation sera automatique dès que la connexion sera rétablie.`,
        });
      } else {
        if (succeeded > 0) {
          notify2.success(`${succeeded} bail${succeeded > 1 ? 'x' : ''} résilié${succeeded > 1 ? 's' : ''} avec succès. Vous pouvez maintenant les supprimer.`);
        }
        if (failed > 0) {
          notify2.error(`${failed} bail${failed > 1 ? 'x' : ''} n'ont pas pu être résilié${failed > 1 ? 's' : ''}`);
        }
      }

      // Rafraîchir l'UI
      if (mode === 'normal' && router) {
        router.refresh();
      } else {
        // ✅ APP-SHELL: Émettre événement avec scope 'global' pour la page globale
        window.dispatchEvent(new CustomEvent('leases:refresh', { 
          detail: { scope: 'global', reason: 'update_multiple' } 
        }));
      }
      setRefreshKey(prev => prev + 1);
      setShowCannotDeleteModal(false);
      setProtectedLeasesForModal([]);
      setLeasesToConfirmDelete([]);
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Erreur lors de la résiliation:', error);
      notify2.error('Erreur lors de la résiliation des baux');
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setIsEditModalOpen(false);
    setSelectedLease(null);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedLease(null);
  };

  const handleEnregistrerPaiement = useCallback((lease: LeaseWithDetails, month: LeasePaymentsTimelineMonth) => {
    const contract = normalizeLeaseContractStatus(lease.status);
    if (contract === 'RESILIE' || contract === 'ARCHIVE') {
      notify2.warning('Paiement bloqué', "Ce bail est résilié : aucun nouveau paiement futur n'est autorisé.");
      return;
    }
    const [y, m] = month.yearMonth.split('-');
    const dueDate = month.dueDate || `${y}-${m}-15`;
    setPaymentPrefill({
      propertyId: lease.propertyId,
      leaseId: lease.id,
      nature: 'RECETTE_LOYER',
      amount: month.expected,
      date: `${y}-${m}-01`,
      periodMonth: m,
      periodYear: parseInt(y, 10),
      label: `Loyer ${month.label}`,
      montantLoyer: lease.rentAmount,
      chargesRecup: lease.chargesRecupMensuelles ?? 0,
      paymentDate: dueDate,
    });
    setShowPaymentModal(true);
  }, []);

  const handlePaymentModalSubmit = useCallback(async (data: TransactionFormData) => {
    if (!organizationId) throw new Error('Organisation requise');
    const lease = leases.find((l) => l.id === data.leaseId);
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
    const svc = createTransactionServiceWithMode(mode === 'app-shell' ? 'app-shell' : 'normal');
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
    await runLeaseRoundTrip('lease_payment_create', { pullLease: true });
    const leaseId = data.leaseId || null;
    window.dispatchEvent(new CustomEvent('leases:refresh', { detail: { scope: 'global', leaseId, reason: 'tx' } }));
    window.dispatchEvent(new CustomEvent('transactions:refresh', { detail: { scope: 'global', leaseId } }));

    const rest = batchPayRemainderRef.current;
    if (rest.length > 0) {
      const [first, ...more] = rest;
      batchPayRemainderRef.current = more;
      const nextLease = leases.find((l) => l.id === first.leaseId);
      if (nextLease) {
        openPaymentFromPriorityItemRef.current(nextLease, first);
        notify2.success('Paiement enregistré');
        setRefreshKey((prev) => prev + 1);
        return;
      }
    }
    batchPayRemainderRef.current = [];
    setShowPaymentModal(false);
    setPaymentPrefill(null);
    notify2.success('Paiement enregistré');
    setRefreshKey((prev) => prev + 1);
  }, [organizationId, leases, mode, runLeaseRoundTrip]);

  // Gestion de la suppression multiple
  const handleDeleteMultiple = useCallback(() => {
    const openDeleteFlow = async () => {
      const toProcess = leases.filter(l => selectedIds.has(l.id));
      const deletable: LeaseWithDetails[] = [];
      const protectedLeases: CannotDeleteLeaseItem[] = [];

      for (const lease of toProcess) {
        const verdict = await assessLeaseDeletion(lease);
        if (verdict.deletable) deletable.push(lease);
        else if (verdict.protected) protectedLeases.push(verdict.protected);
      }

      if (protectedLeases.length > 0) {
        setProtectedLeasesForModal(protectedLeases);
        setShowCannotDeleteModal(true);
      }

      if (deletable.length > 0) {
        if (protectedLeases.length > 0) {
          notify2.warning(`${protectedLeases.length} bail(x) non supprimable(s) exclu(s) de la sélection.`);
        }
        setLeasesToConfirmDelete(deletable);
        setShowDeleteConfirmModal(true);
      } else if (protectedLeases.length === 0) {
        notify2.info('Aucun bail sélectionné');
      }
    };
    void openDeleteFlow();
  }, [assessLeaseDeletion, leases, selectedIds]);

  const handleIndexLease = useCallback((lease: LeaseWithDetails) => {
    const contract = normalizeLeaseContractStatus(lease.status);
    if (contract !== 'ACTIF') {
      notify2.warning('Action indisponible', "L'indexation est disponible uniquement pour un bail actif.");
      return;
    }
    setSelectedLease(lease);
    setShowIndexationModal(true);
  }, []);

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

  const openPaymentFromPriorityItem = useCallback((lease: LeaseWithDetails, item: LeasePriorityAction) => {
    const ym = item.targetYearMonth;
    if (!ym) {
      handleViewLease(lease);
      return;
    }
    const [yStr, mStr] = ym.split('-');
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
  }, [handleViewLease]);

  openPaymentFromPriorityItemRef.current = openPaymentFromPriorityItem;

  const startBatchPriorityPayments = useCallback(
    (items: LeasePriorityAction[]) => {
      if (items.length === 0) return;
      const [first, ...rest] = items;
      batchPayRemainderRef.current = rest;
      const lease = leases.find((l) => l.id === first.leaseId);
      if (lease) openPaymentFromPriorityItem(lease, first);
    },
    [leases, openPaymentFromPriorityItem]
  );

  const startBatchCritiques = useCallback(
    (items: LeasePriorityAction[]) => {
      if (items.length === 0) return;
      const payLike = items.filter(
        (i) => i.nextActionType === 'PAY_FULL' || i.nextActionType === 'PAY_REMAINING'
      );
      const rest = items.filter(
        (i) => i.nextActionType !== 'PAY_FULL' && i.nextActionType !== 'PAY_REMAINING'
      );
      if (payLike.length > 0) startBatchPriorityPayments(payLike);
      if (rest.length > 0 && payLike.length === 0) {
        notify2.info(
          'Aucun encaissement groupé pour cette sélection. Utilisez Indexer ou Renouveler sur chaque bail concerné.'
        );
      } else if (rest.length > 0) {
        notify2.info(
          `${rest.length} bail(x) avec indexation ou renouvellement : à traiter depuis le bandeau ou le tableau après les encaissements.`
        );
      }
    },
    [startBatchPriorityPayments]
  );

  const transactionsHrefForLease = useCallback(
    (lease: { id: string; propertyId: string }) =>
      mode === 'app-shell'
        ? `/app?view=property&propertyId=${encodeURIComponent(lease.propertyId)}&tab=transactions&leaseId=${encodeURIComponent(lease.id)}`
        : `/transactions?propertyId=${encodeURIComponent(lease.propertyId)}&leaseId=${encodeURIComponent(lease.id)}`,
    [mode]
  );

  const handleTogglePilotageIgnore = useCallback(
    async (lease: LeaseWithDetails, ignored: boolean) => {
      if (!organizationId) return;
      try {
        const { createLeaseServiceWithMode } = await import('@/domain/services/leaseServiceFactory');
        const leaseService = createLeaseServiceWithMode(mode === 'app-shell' ? 'app-shell' : 'normal');
        await leaseService.updateLease(lease.id, organizationId, { pilotageIgnored: ignored });
        if (mode === 'app-shell' && typeof navigator !== 'undefined' && navigator.onLine) {
          try {
            const { getGlobalSyncService } = await import('@/lib/offline/syncGlobal');
            await getGlobalSyncService().syncAllPendingToRemote(organizationId);
          } catch {
            /* sync best-effort */
          }
        }
        notify2.success(ignored ? 'Bail ignoré' : 'Bail réactivé dans le pilotage');
        window.dispatchEvent(
          new CustomEvent('leases:refresh', { detail: { scope: 'global', reason: 'pilotage_ignore' } })
        );
        setRefreshKey((prev) => prev + 1);
        if (mode === 'normal' && router) router.refresh();
      } catch (e) {
        notify2.error(e instanceof Error ? e.message : 'Impossible de mettre à jour le bail');
      }
    },
    [organizationId, mode, router]
  );

  const handlePriorityActionCta = useCallback(
    (item: LeasePriorityAction) => {
      const lease = leases.find((l) => l.id === item.leaseId);
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
    [leases, openPaymentFromPriorityItem, handleOpenRenewLease, handleIndexLease]
  );

  const handlePilotageTablePrimaryCta = useCallback(
    (lease: LeaseWithDetails, meta: LeasePilotageRowMeta) => {
      handlePriorityActionCta(toLeasePriorityAction(lease, meta));
    },
    [handlePriorityActionCta]
  );

  const handleRenewalSubmit = useCallback(async (data: any) => {
    await handleModalSubmit({
      ...data,
      id: undefined,
      status: 'BROUILLON',
      notes: `Renouvellement du bail ${renewBaseLease?.id ?? ''}${data.notes ? `\n\n${data.notes}` : ''}`.trim(),
    });
    setShowRenewModal(false);
    setRenewBaseLease(null);
  }, [handleModalSubmit, renewBaseLease?.id]);

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
      const { createLeaseServiceWithMode } = await import('@/domain/services/leaseServiceFactory');
      const leaseService = createLeaseServiceWithMode(mode === 'app-shell' ? 'app-shell' : 'normal');
      const existingNotes = selectedLease.notes ? `${selectedLease.notes}\n\n` : '';
      const reasonLine = reason ? `Motif de résiliation: ${reason}` : 'Motif de résiliation: —';
      await leaseService.updateLease(selectedLease.id, organizationId, {
        status: 'RÉSILIÉ',
        endDate: effectiveEndDate,
        notes: `${existingNotes}${reasonLine}`.trim(),
      });
      await runLeaseRoundTrip('terminate_from_modal', { pullLease: true });
      notify2.success('Bail résilié', 'La résiliation a été enregistrée.');
      window.dispatchEvent(
        new CustomEvent('leases:refresh', { detail: { scope: 'global', reason: 'terminate', leaseId: selectedLease.id } })
      );
      setRefreshKey((prev) => prev + 1);
      setShowTerminateModal(false);
    },
    [selectedLease, organizationId, mode, runLeaseRoundTrip]
  );

  // États de chargement et erreur
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
        <span className="ml-3 text-gray-600">Chargement des baux...</span>
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

  // Rendu principal
  return (
    <div className="space-y-6 w-full max-w-full">
      {/* Header */}
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
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 truncate min-w-0">Baux</h1>
            <div className="flex-shrink-0">
              <button
                onClick={handleCreateLease}
                className="inline-flex items-center justify-center h-8 w-8 text-orange-600 border border-orange-200 rounded-lg bg-white hover:bg-gradient-to-r hover:from-orange-500 hover:to-red-500 hover:text-white transition-all duration-300 ease-out focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                aria-label="Nouveau bail"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Ligne 2 : Description */}
        <p className="text-sm sm:text-base text-gray-600">Suivi global des baux et de leurs conditions financières</p>
      </div>

      {/* Actions prioritaires (pilotage App Shell, aligné Échéances) */}
      <LeasesPriorityActionsBlock
        actions={priorityActions}
        isLoading={actionCountsLoading}
        showAll={showAllPriorityActions}
        onToggleShowAll={() => setShowAllPriorityActions((v) => !v)}
        onPrimaryCta={handlePriorityActionCta}
        onNavigateToLeaseRow={mode === 'app-shell' ? scrollToLeaseTableRow : undefined}
        onViewLease={mode === 'app-shell' ? handleViewLeaseById : undefined}
        leasePaymentPilotageById={leasePaymentPilotageById}
        leasePilotageById={leasePilotageById}
        pilotageAvailable={mode === 'app-shell'}
      />

      <LeasesGlobalActionsBar
        priorityActions={priorityActions}
        isLoading={actionCountsLoading}
        pilotageAvailable={mode === 'app-shell'}
        onBatchEncaisserRetards={startBatchPriorityPayments}
        onBatchCompleterPartiels={startBatchPriorityPayments}
        onTraiterCritiques={startBatchCritiques}
      />

      <GlobalPilotageAlertsSection>
        {mode === 'app-shell' && !actionCountsLoading ? (
          <div className="space-y-2 text-sm text-gray-700">
            {actionCounts.leaseIdsRetards.size > 0 && (
              <p>
                <span className="font-semibold text-amber-950">{actionCounts.leaseIdsRetards.size}</span>{' '}
                bail(aux) avec loyer en retard — prioriser l&apos;encaissement.
              </p>
            )}
            {actionCounts.leaseIdsPartiels.size > 0 && (
              <p>
                <span className="font-semibold text-amber-950">{actionCounts.leaseIdsPartiels.size}</span>{' '}
                paiement(s) partiel(s) détecté(s) — compléter les montants attendus.
              </p>
            )}
            {actionCounts.leaseIdsRetards.size === 0 && actionCounts.leaseIdsPartiels.size === 0 && (
              <p>Aucune anomalie de paiement globale détectée sur le périmètre chargé.</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-700">
            Les alertes de paiement sont calculées à partir des données locales (App Shell).
          </p>
        )}
      </GlobalPilotageAlertsSection>

      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <h3 className="text-base font-semibold text-gray-900 mb-3">Synthèse</h3>
        <LeasesKpiBar
          kpis={kpis}
          activeFilter={activeKpiFilter}
          onFilterChange={handleKpiFilterChange}
          isLoading={kpisLoading}
        />
      </div>

      <GlobalPilotageDetailAccordion
        open={leasesDetailOpen}
        onToggle={() => setLeasesDetailOpen((v) => !v)}
        title="Détail complet (graphiques, filtres et tableau)"
      >
        <div className="grid gap-4 grid-cols-1 md:grid-cols-4 bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="md:col-span-2">
            <LeasesRentEvolutionChart
              monthlyData={chartsData?.rentEvolution?.monthly || []}
              yearlyData={chartsData?.rentEvolution?.yearly || []}
              isLoading={chartsLoading}
            />
          </div>
          <div className="md:col-span-1">
            <LeasesByFurnishedChart
              data={chartsData?.byFurnished || []}
              isLoading={chartsLoading}
            />
          </div>
          <div className="md:col-span-1">
            <LeasesDepositsRentsChart
              data={chartsData?.depositsRents || {
                totalDeposits: 0,
                monthlyTotal: 0,
                yearlyTotal: 0,
              }}
              isLoading={chartsLoading}
            />
          </div>
        </div>

      {/* Filtres avancés */}
      <LeasesFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onResetFilters={handleResetFilters}
        properties={properties}
        tenants={tenants}
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
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <div>
              <CardTitle>Liste des Baux ({totalCount})</CardTitle>
              <p className="text-sm text-gray-600">
                {totalCount > 0
                  ? `Affichage de 1 à ${sortedLeases.length} sur ${totalCount}`
                  : 'Aucun bail'}
              </p>
            </div>
            {mode === 'app-shell' && (
              <button
                type="button"
                onClick={() => setLeasePilotageLayout((v) => (v === 'grouped' ? 'compact' : 'grouped'))}
                className="text-xs font-semibold text-orange-700 hover:text-orange-800 whitespace-nowrap"
              >
                {leasePilotageLayout === 'grouped' ? 'Vue tableau compact' : 'Vue pilotage par blocs'}
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <LeasesToolbar
            showPilotage={mode === 'app-shell'}
            pilotageCounts={pilotageBucketCounts}
            pilotageActive={pilotageBucketFilter}
            onPilotageChange={setPilotageBucketFilter}
            actionCounts={actionCounts}
            actionActive={actionFilter}
            onActionFilterChange={handleActionFilterChange}
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
          {mode === 'app-shell' && leasePilotageLayout === 'grouped' && pilotageGroupsSorted ? (
            <div className="space-y-8">
              {[
                { key: 'critique' as const, title: 'À traiter', emoji: '🔴', tone: 'text-red-800' },
                { key: 'surveiller' as const, title: 'À surveiller', emoji: '🟠', tone: 'text-amber-900' },
                { key: 'ok' as const, title: 'OK', emoji: '🟢', tone: 'text-emerald-900' },
                { key: 'ignored' as const, title: 'Ignorés (pilotage)', emoji: '⏸', tone: 'text-gray-700' },
              ].map((section) => {
                const subset = pilotageGroupsSorted[section.key];
                if (subset.length === 0) return null;
                return (
                  <section key={section.key} className="space-y-2">
                    <h3 className={`text-sm font-bold flex flex-wrap items-center gap-2 ${section.tone}`}>
                      <span>{section.emoji}</span>
                      {section.title}
                      <span className="text-gray-500 font-normal">({subset.length})</span>
                    </h3>
                    <LeasesTableNew
                      leases={subset}
                      organizationId={organizationId}
                      loading={loading}
                      onView={handleViewLease}
                      onEdit={handleEditLease}
                      onDelete={handleDeleteLease}
                      onActions={handleActionsLease}
                      onSelect={handleSelectLease}
                      onSelectAll={(sel) => {
                        setSelectedIds((prev) => {
                          const n = new Set(prev);
                          if (sel) subset.forEach((l) => n.add(l.id));
                          else subset.forEach((l) => n.delete(l.id));
                          return n;
                        });
                      }}
                      selectedIds={selectedIds}
                      showSelection={true}
                      leaseHealthMap={leaseHealthMap}
                      onQuickPay={handleViewLease}
                      leasePilotageById={leasePilotageById}
                      leasePaymentPilotageById={leasePaymentPilotageById}
                      leasePilotageBucketById={leasePilotageBucketById}
                      pageMode={mode}
                      transactionsHrefForLease={transactionsHrefForLease}
                      onPilotageIgnoreToggle={handleTogglePilotageIgnore}
                      onPilotagePrimaryCta={mode === 'app-shell' ? handlePilotageTablePrimaryCta : undefined}
                    />
                  </section>
                );
              })}
            </div>
          ) : (
            <LeasesTableNew
              leases={sortedLeases}
              organizationId={organizationId}
              loading={loading}
              onView={handleViewLease}
              onEdit={handleEditLease}
              onDelete={handleDeleteLease}
              onActions={handleActionsLease}
              onSelect={handleSelectLease}
              onSelectAll={handleSelectAll}
              selectedIds={selectedIds}
              showSelection={true}
              leaseHealthMap={leaseHealthMap}
              onQuickPay={handleViewLease}
              leasePilotageById={leasePilotageById}
              leasePaymentPilotageById={mode === 'app-shell' ? leasePaymentPilotageById : undefined}
              leasePilotageBucketById={leasePilotageBucketById}
              pageMode={mode}
              transactionsHrefForLease={mode === 'app-shell' ? transactionsHrefForLease : undefined}
              onPilotageIgnoreToggle={handleTogglePilotageIgnore}
              onPilotagePrimaryCta={mode === 'app-shell' ? handlePilotageTablePrimaryCta : undefined}
            />
          )}
        </CardContent>
      </Card>
      </GlobalPilotageDetailAccordion>

      {/* Modale de création */}
      {isModalOpen && (
        <LeaseFormComplete
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onSubmit={handleModalSubmit}
          title="Nouveau bail"
          defaultPropertyId={undefined} // ✅ Page globale : pas de defaultPropertyId, l'utilisateur doit choisir
          properties={properties} // ✅ Passer properties depuis IndexedDB
          tenants={tenants} // ✅ Passer tenants depuis IndexedDB
          mode={mode} // ✅ Passer le mode
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
          mode={mode}
          onRequestAmendment={handleRequestAmendmentFromEditModal}
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
          properties={properties}
          tenants={tenants}
          mode={mode}
        />
      )}

      {/* Modale d'enregistrement de paiement */}
      <TransactionModal
        isOpen={showPaymentModal}
        onClose={() => {
          batchPayRemainderRef.current = [];
          setShowPaymentModal(false);
          setPaymentPrefill(null);
        }}
        onSubmit={handlePaymentModalSubmit}
        context={{ type: 'global' }}
        mode="create"
        title="Enregistrer un paiement"
        prefill={paymentPrefill ?? undefined}
      />

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
            charges: selectedLease.charges,
            deposit: selectedLease.deposit,
            paymentDay: selectedLease.paymentDay,
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
            setRefreshKey(prev => prev + 1);
          }}
          initialAction="generate-receipt"
        />
      )}

      <LeaseIndexationModal
        isOpen={showIndexationModal}
        lease={selectedLease}
        onClose={() => setShowIndexationModal(false)}
        onApplied={() => {
          setRefreshKey((prev) => prev + 1);
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
