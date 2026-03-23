/**
 * Core Component pour la page Échéances récurrentes
 * 
 * Une seule source de vérité graphique utilisable en mode "normal" et "app-shell"
 * Toute la logique UI est centralisée ici.
 * 
 * RÉPLIQUE EXACTEMENT le comportement de echeances/page.tsx
 */

'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { notify2 } from '@/lib/notify2';
import { Plus, Edit, Trash2, CheckCircle, Eye, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Switch } from '@/components/ui/Switch';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Pagination } from '@/components/ui/Pagination';
import { PaginationV2 } from '@/components/ui2/PaginationV2';
import { TableV2, TableHeaderV2, TableHeaderCellV2, TableBodyV2, TableRowV2, TableCellV2 } from '@/components/ui2/TableV2';
import { useUI2 } from '@/hooks/useUI2';
import { EcheancesKpiBar } from '@/components/echeances/EcheancesKpiBar';
import { EcheancesCumulativeChart } from '@/components/echeances/EcheancesCumulativeChart';
import { EcheancesByTypeChart } from '@/components/echeances/EcheancesByTypeChart';
import { EcheancesRecuperablesChart } from '@/components/echeances/EcheancesRecuperablesChart';
import EcheancesFilters from '@/components/echeances/EcheancesFilters';
import { EcheanceModal } from '@/components/echeances/EcheanceModal';
import { EcheanceDrawer } from '@/components/echeances/EcheanceDrawer';
import { ConfirmDeleteEcheanceModal } from '@/components/echeances/ConfirmDeleteEcheanceModal';
import { ConfirmDeleteMultipleEcheancesModal } from '@/components/echeances/ConfirmDeleteMultipleEcheancesModal';
import { useEcheancesKpis } from './hooks/useEcheancesKpis';
import { useEcheancesCharts } from './hooks/useEcheancesCharts';
import {
  EcheanceRecurrente,
  PERIODICITE_LABELS,
  SENS_LABELS,
  getNatureBadgeClass,
  getCategoryLabelForEcheance,
} from '@/types/echeance';
import { getNatureLabelForEcheance } from '@/lib/echeances/echeanceDisplayHelpers';
import { useEcheanceReferential } from '@/features/echeances/hooks/useEcheanceReferential';
import { EcheanceFormSchema } from '@/lib/validations/echeance';
import Link from 'next/link';
import { useEcheancesData, type EcheancesFilters } from './hooks/useEcheancesData';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import { createEcheanceServiceWithMode } from '@/domain/services/echeanceServiceFactory';
import { createTransactionServiceWithMode } from '@/domain/services/transactionServiceFactory';
import { useSidebarOptional } from '@/contexts/SidebarContext';
import { TransactionModal } from '@/components/transactions/TransactionModalV2';
import type { TransactionFormData } from '@/lib/validations/transaction';
import { buildTransactionFromEcheance } from '@/lib/echeances/echeanceTransactionPrefill';
import {
  getNextUncoveredOccurrenceDate,
  buildCoveredOccurrenceDates,
  listTheoreticalOccurrenceDates,
} from '@/lib/echeances/echeanceOccurrences';
import { resolveNatureCodeForEcheance } from '@/lib/echeances/echeanceTypeMigration';
import {
  getLinksByEcheanceIds,
  addEcheanceTransactionLink,
} from '@/lib/echeances/echeanceTransactionLinkClient';
import { getTransactionRepositoryOffline } from '@/lib/offline/repositories/TransactionRepositoryOffline';

export interface EcheancesPageCoreProps {
  mode: 'normal' | 'app-shell';
}

export function EcheancesPageCore({
  mode,
}: EcheancesPageCoreProps) {
  const { organizationId } = useCurrentOrganization();
  const { natures, categories, getDefaultCategoryId } = useEcheanceReferential(mode);
  const router = mode === 'normal' ? useRouter() : null;
  const queryClient = useQueryClient();
  const isUI2Active = useUI2();
  const sidebarContext = useSidebarOptional();

  // États pour la période (format YYYY) - Par défaut : 5 années à venir
  const now = new Date();
  const currentYear = now.getFullYear();
  const [periodStart, setPeriodStart] = useState(currentYear.toString());
  const [periodEnd, setPeriodEnd] = useState((currentYear + 4).toString());
  const [viewMode, setViewMode] = useState<'monthly' | 'yearly'>('yearly');

  // État pour le filtre KPI actif
  const [activeKpiFilter, setActiveKpiFilter] = useState<string | null>(null);

  // États des filtres
  const [filters, setFilters] = useState<EcheancesFilters>({
    search: '',
    type: '',
    natureCode: '',
    sens: '',
    periodicite: '',
    propertyId: '',
    leaseId: '',
    recuperable: '',
    isActive: '', // ✅ Ajouter le filtre actif/inactif
  });

  // États des modals et drawer
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedEcheance, setSelectedEcheance] = useState<EcheanceRecurrente | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'duplicate'>('create');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [echeanceToDelete, setEcheanceToDelete] = useState<EcheanceRecurrente | null>(null);

  // États pour la sélection multiple
  const [selectedEcheanceIds, setSelectedEcheanceIds] = useState<string[]>([]);
  const [showDeleteMultipleModal, setShowDeleteMultipleModal] = useState(false);

  // États pour la modal transaction (création depuis échéance)
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [echeanceForTx, setEcheanceForTx] = useState<EcheanceRecurrente | null>(null);
  const [txModalPrefill, setTxModalPrefill] = useState<Awaited<ReturnType<typeof buildTransactionFromEcheance>> | null>(null);
  const [coveredOccurrenceByEcheanceId, setCoveredOccurrenceByEcheanceId] = useState<Map<string, Set<string>>>(new Map());
  const pendingOccurrenceYmdRef = useRef<string | null>(null);

  // État pour forcer le rafraîchissement
  const [refreshKey, setRefreshKey] = useState(0);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 30, // ✅ Desktop: 30 items par page (comme Transactions et Documents)
    total: 0,
    pages: 0,
  });

  // État pour la limite mobile (cards)
  const [mobileLimit, setMobileLimit] = useState(3);

  // ✅ État local optimiste pour les Switch (évite les boucles infinies)
  const [optimisticActiveStates, setOptimisticActiveStates] = useState<Map<string, boolean>>(new Map());
  
  // ✅ Ref pour suivre les échéances en cours de mise à jour (évite les nettoyages prématurés)
  const updatingEcheancesRef = useRef<Set<string>>(new Set());

  // Charger les occurrences couvertes pour l'échéance affichée dans le drawer
  useEffect(() => {
    if (!organizationId || !selectedEcheance || !isDrawerOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const links = await getLinksByEcheanceIds(organizationId, [selectedEcheance.id]);
        const linkRows = links.get(selectedEcheance.id) || [];
        if (linkRows.length === 0) {
          if (!cancelled) setCoveredOccurrenceByEcheanceId((m) => new Map(m).set(selectedEcheance.id, new Set()));
          return;
        }
        const txRepo = getTransactionRepositoryOffline();
        const txIds = [...new Set(linkRows.map((r) => r.transactionId))];
        const txDateById = new Map<string, string>();
        for (const id of txIds) {
          const tx = await txRepo.getById(id, organizationId);
          if (tx?.date) txDateById.set(id, typeof tx.date === 'string' ? tx.date : (tx.date as Date).toISOString().slice(0, 10));
        }
        const theoretical = listTheoreticalOccurrenceDates(selectedEcheance, new Date());
        const covered = buildCoveredOccurrenceDates(
          theoretical,
          linkRows.map((r) => ({ transactionId: r.transactionId, occurrenceDate: r.occurrenceDate })),
          txDateById,
          7
        );
        if (!cancelled) setCoveredOccurrenceByEcheanceId((m) => new Map(m).set(selectedEcheance.id, covered));
      } catch {
        if (!cancelled) setCoveredOccurrenceByEcheanceId((m) => new Map(m).set(selectedEcheance.id, new Set()));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [organizationId, selectedEcheance?.id, isDrawerOpen]);

  // ✅ APP-SHELL: Charger les locataires pour afficher le contexte dans les cards mobile (page globale uniquement)
  const [tenantsMap, setTenantsMap] = useState<Map<string, { firstName: string; lastName: string }>>(new Map());
  useEffect(() => {
    if (mode === 'app-shell' && organizationId) {
      const loadTenants = async () => {
        try {
          const { getTenantRepositoryOffline } = await import('@/lib/offline/repositories/TenantRepositoryOffline');
          const tenantRepo = getTenantRepositoryOffline();
          const allTenants = await tenantRepo.getAll(organizationId, {});
          
          const map = new Map<string, { firstName: string; lastName: string }>();
          allTenants.forEach(tenant => {
            map.set(tenant.id, { firstName: tenant.firstName, lastName: tenant.lastName });
          });
          
          setTenantsMap(map);
        } catch (error) {
          console.error('Erreur lors du chargement des locataires:', error);
        }
      };
      
      loadTenants();
    }
  }, [mode, organizationId]);

  // Utiliser le hook unifié pour les données
  const {
    echeances,
    allEcheances, // ✅ Toutes les échéances non filtrées (pour filtrage en mémoire en app-shell)
    properties,
    leases,
    totalCount,
    pagination: dataPagination,
    loading,
    error,
  } = useEcheancesData({
    mode,
    scope: mode === 'app-shell' ? 'global' : undefined, // ✅ Scope global pour la page globale
    filters: mode === 'app-shell' ? filters : undefined,
    activeKpiFilter: mode === 'app-shell' ? null : activeKpiFilter, // ✅ Ne pas appliquer le filtre KPI ici en app-shell, on le fait en mémoire
    page: mode === 'app-shell' ? 1 : pagination.page, // ✅ Pas de pagination côté hook en app-shell, on fait tout en mémoire
    pageSize: mode === 'app-shell' ? 10000 : pagination.limit, // ✅ Charger toutes les échéances en app-shell
  });

  // Synchroniser la pagination (uniquement en mode normal, pas en app-shell)
  useEffect(() => {
    if (mode === 'normal' && dataPagination) {
      setPagination(prev => {
        // ✅ Ne mettre à jour que si les valeurs ont vraiment changé
        if (prev.total === dataPagination.total && prev.pages === dataPagination.pages) {
          return prev;
        }
        return {
          ...prev,
          total: dataPagination.total,
          pages: dataPagination.pages,
        };
      });
    }
  }, [mode, dataPagination?.total, dataPagination?.pages]);

  // Charger les KPIs
  const { data: kpisData, isLoading: kpisLoading } = useEcheancesKpis({ 
    mode,
    scope: mode === 'app-shell' ? 'global' : undefined, // ✅ Scope global pour la page globale
  });

  // Charger les graphiques
  const { data: chartsData, isLoading: chartsLoading } = useEcheancesCharts({
    mode,
    scope: mode === 'app-shell' ? 'global' : undefined, // ✅ Scope global pour la page globale
    periodStart,
    periodEnd,
    viewMode,
    propertyId: filters.propertyId || undefined,
  });

  // ✅ APP-SHELL: Filtrer les échéances en mémoire selon les filtres UI
  const filteredEcheances = useMemo(() => {
    if (mode === 'normal') {
      // En mode normal, les données sont déjà filtrées par le serveur
      return echeances;
    }
    
    // Mode app-shell : filtrer côté client
    if (!allEcheances || allEcheances.length === 0) {
      return [];
    }
    
    let filtered = allEcheances.filter(echeance => {
      // Filtre de recherche
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        if (!echeance.label.toLowerCase().includes(searchLower)) return false;
      }

      // Filtre par nature (référentiel métier)
      if (filters.natureCode) {
        const effectiveNature = resolveNatureCodeForEcheance(echeance);
        if (effectiveNature !== filters.natureCode) return false;
      }
      // Filtre de type (legacy, fallback si natureCode non utilisé)
      if (filters.type && !filters.natureCode && echeance.type !== filters.type) return false;

      // Filtre de sens
      if (filters.sens && echeance.sens !== filters.sens) return false;

      // Filtre de périodicité
      if (filters.periodicite && echeance.periodicite !== filters.periodicite) return false;

      // Filtre de bien
      if (filters.propertyId && echeance.Property?.id !== filters.propertyId) return false;

      // Filtre de bail
      if (filters.leaseId && echeance.Lease?.id !== filters.leaseId) return false;

      // Filtre récupérable
      if (filters.recuperable === 'true' && !echeance.recuperable) return false;
      if (filters.recuperable === 'false' && echeance.recuperable) return false;

      // ✅ Filtre actif/inactif (explicite uniquement)
      // Par défaut, on affiche TOUTES les échéances (actives ET inactives)
      if (filters.isActive === 'active' && !echeance.isActive) return false;
      if (filters.isActive === 'inactive' && echeance.isActive) return false;

      return true;
    });

    // Appliquer le filtre KPI actif
    if (activeKpiFilter === 'revenus') {
      filtered = filtered.filter(e => e.sens === 'CREDIT');
    } else if (activeKpiFilter === 'charges') {
      filtered = filtered.filter(e => e.sens === 'DEBIT');
    } else if (activeKpiFilter === 'actives') {
      filtered = filtered.filter(e => e.isActive);
    }

    // Paginer
    const start = (pagination.page - 1) * pagination.limit;
    const end = start + pagination.limit;
    return filtered.slice(start, end);
  }, [mode, allEcheances, echeances, filters, activeKpiFilter, pagination.page, pagination.limit]);

  // Gestion des filtres
  const handleFiltersChange = useCallback((newFilters: EcheancesFilters) => {
    setFilters(newFilters);
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  // Gestion du filtre KPI
  const handleKpiFilterChange = useCallback((filterKey: string | null) => {
    if (filterKey === activeKpiFilter) {
      setActiveKpiFilter(null);
    } else {
      setActiveKpiFilter(filterKey);
    }
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [activeKpiFilter]);

  const handleResetFilters = useCallback(() => {
    setFilters({
      search: '',
      type: '',
      natureCode: '',
      sens: '',
      periodicite: '',
      propertyId: '',
      leaseId: '',
      recuperable: '',
      isActive: '', // ✅ Ajouter le filtre actif/inactif
    });
    setActiveKpiFilter(null);
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  const openCreateTxFromEcheance = useCallback(
    async (e: EcheanceRecurrente) => {
      if (!organizationId) return;
      const covered = coveredOccurrenceByEcheanceId.get(e.id) ?? new Set<string>();
      const ymd =
        getNextUncoveredOccurrenceDate(e, covered, new Date()) ||
        new Date().toISOString().slice(0, 10);
      pendingOccurrenceYmdRef.current = ymd;
      const prefill = await buildTransactionFromEcheance(e, ymd);
      setEcheanceForTx(e);
      setTxModalPrefill(prefill);
      setTxModalOpen(true);
    },
    [organizationId, coveredOccurrenceByEcheanceId]
  );

  const handleTxModalSubmit = useCallback(
    async (data: TransactionFormData & Record<string, unknown>) => {
      if (!organizationId || !echeanceForTx) throw new Error('Données manquantes');
      const svc = createTransactionServiceWithMode(mode);
      const paidAt = (data.paidAt as string) || (data.paymentDate as string);
      if (!paidAt?.trim()) throw new Error('La date de paiement est obligatoire.');
      const d = new Date(data.date as string);
      const accountingMonth =
        (data.accountingMonth as string) ||
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const pm = data.periodMonth != null ? String(data.periodMonth).padStart(2, '0') : String(d.getMonth() + 1).padStart(2, '0');
      const py = (data.periodYear as number) || d.getFullYear();
      const result = await svc.createTransaction({
        organizationId,
        propertyId: data.propertyId,
        leaseId: (data.leaseId as string) || null,
        categoryId: data.categoryId as string,
        nature: (data.nature as string) || undefined,
        label: (data.label as string) || echeanceForTx.label,
        amount: Number(data.amount),
        date: data.date as string,
        paidAt,
        accountingMonth,
        periodMonth: parseInt(pm, 10),
        periodYear: py,
        monthsCovered: (data.monthsCovered as number) || 1,
        skipAutoCommissions: true,
        method: (data.method as string) || (data.paymentMethod as string) || 'virement',
      });
      const occ =
        pendingOccurrenceYmdRef.current ||
        (typeof data.date === 'string' ? data.date.slice(0, 10) : null);
      pendingOccurrenceYmdRef.current = null;
      await addEcheanceTransactionLink({
        organizationId,
        echeanceId: echeanceForTx.id,
        transactionId: result.transaction.id,
        occurrenceDate: occ,
      });
      window.dispatchEvent(new CustomEvent('echeanceLinks:refresh', { detail: { scope: 'global', reason: 'tx-link' } }));
      window.dispatchEvent(new CustomEvent('deadlines:refresh', { detail: { scope: 'global', reason: 'tx-link' } }));
      setTxModalOpen(false);
      setEcheanceForTx(null);
      setTxModalPrefill(null);
      setRefreshKey((k) => k + 1);
      notify2.success('Transaction créée et liée à l\'échéance');
      return { totalCreated: result.totalCreated, successMessage: 'Transaction créée et liée à l\'échéance' };
    },
    [organizationId, echeanceForTx, mode]
  );

  // Handlers de période
  const handlePeriodChange = (start: string, end: string) => {
    setPeriodStart(start);
    setPeriodEnd(end);
  };

  // Handler pour le changement de mode de vue
  const handleViewModeChange = (mode: 'monthly' | 'yearly') => {
    setViewMode(mode);
  };

  // CRUD Handlers
  const handleCreate = () => {
    setSelectedEcheance(null);
    setModalMode('create');
    setIsModalOpen(true);
  };

  const handleEdit = (echeance: EcheanceRecurrente) => {
    setSelectedEcheance(echeance);
    setModalMode('edit');
    setIsModalOpen(true);
    setIsDrawerOpen(false);
  };

  const handleDuplicate = (echeance: EcheanceRecurrente) => {
    setSelectedEcheance(echeance);
    setModalMode('duplicate');
    setIsModalOpen(true);
    setIsDrawerOpen(false);
  };

  const handleDelete = (echeance: EcheanceRecurrente) => {
    setEcheanceToDelete(echeance);
    setShowDeleteModal(true);
    setIsDrawerOpen(false);
  };

  const handleRowClick = (echeance: EcheanceRecurrente) => {
    setSelectedEcheance(echeance);
    setIsDrawerOpen(true);
  };

  const handleFormSubmit = async (data: EcheanceFormSchema) => {
    try {
      if (mode === 'app-shell') {
        // ✅ APP-SHELL: Utiliser EcheanceService (local-first)
        if (!organizationId) {
          notify2.error('OrganizationId manquant');
          return;
        }

        const echeanceService = createEcheanceServiceWithMode('app-shell');
        
        const common = {
          label: data.label,
          natureCode: data.natureCode,
          defaultCategoryId: data.categoryId || null,
          periodicite: data.periodicite,
          montant: data.montant,
          sens: data.sens,
          recuperable: data.recuperable,
          propertyId: data.propertyId || null,
          leaseId: data.leaseId || null,
          startAt: new Date(data.startAt),
          endAt: data.endAt ? new Date(data.endAt) : null,
          isActive: data.isActive,
        };
        if (modalMode === 'edit' && selectedEcheance?.id) {
          await echeanceService.updateEcheance(selectedEcheance.id, organizationId, common);
        } else {
          await echeanceService.createEcheance({ organizationId, ...common });
        }
        
        // ✅ Émettre UNIQUEMENT un événement ciblé (pas de sync immédiate, pas de fetch bloquant)
        window.dispatchEvent(new CustomEvent('deadlines:refresh', { 
          detail: { scope: 'global', reason: 'crud' } 
        }));
        
        setIsModalOpen(false);
        notify2.success(modalMode === 'edit' ? 'Échéance modifiée avec succès' : 'Échéance créée avec succès');
        return;
      }

      // Mode normal online : utiliser l'API
      const payload = {
        ...data,
        defaultCategoryId: data.categoryId,
        startAt: new Date(data.startAt).toISOString(),
        endAt: data.endAt ? new Date(data.endAt).toISOString() : null,
      };
      if (modalMode === 'edit' && selectedEcheance) {

        const response = await fetch(`/api/echeances/${selectedEcheance.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Erreur lors de la modification');
        }

        notify2.success('Échéance modifiée avec succès');
      } else {
        const response = await fetch('/api/echeances', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Erreur lors de la création');
        }

        notify2.success('Échéance créée avec succès');
      }

      // Invalider les queries React Query
      queryClient.invalidateQueries({ queryKey: ['echeances-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['echeances-charts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-patrimoine'] });
      queryClient.invalidateQueries({ queryKey: ['patrimoine'] });
      
      setIsModalOpen(false);
      setRefreshKey((k) => k + 1);
    } catch (error: any) {
      notify2.error('Erreur', error.message);
    }
  };

  const handleConfirmDelete = async () => {
    if (mode === 'app-shell') {
      // ✅ APP-SHELL: Supprimer via EcheanceService (local-first)
      if (!organizationId || !echeanceToDelete) {
        notify2.error('Données manquantes pour l\'opération');
        return;
      }

      try {
        const echeanceService = createEcheanceServiceWithMode('app-shell');
        
        // ✅ APP-SHELL: Supprimer via service (soft delete, écrit en IndexedDB + crée pendingOp)
        await echeanceService.deleteEcheance(echeanceToDelete.id, organizationId, 'soft');
        
        // ✅ Émettre UNIQUEMENT un événement ciblé (pas de sync immédiate, pas de fetch bloquant)
        window.dispatchEvent(new CustomEvent('deadlines:refresh', { 
          detail: { scope: 'global', reason: 'delete' } 
        }));
        
        setShowDeleteModal(false);
        setEcheanceToDelete(null);
        notify2.success('Échéance supprimée avec succès');
      } catch (error: any) {
        console.error('Erreur lors de l\'opération:', error);
        notify2.error('Erreur', error.message || 'Erreur lors de l\'opération');
      }
      return;
    } else {
      // Mode normal online : utiliser l'API
      if (echeanceToDelete) {
        const response = await fetch(`/api/echeances/${echeanceToDelete.id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Erreur lors de la suppression');
        }

        notify2.success('Échéance supprimée avec succès');
        
        // Invalider les queries React Query
      queryClient.invalidateQueries({ queryKey: ['echeances-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['echeances-charts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-patrimoine'] });
      queryClient.invalidateQueries({ queryKey: ['patrimoine'] });
      setRefreshKey((k) => k + 1);
        setShowDeleteModal(false);
        setEcheanceToDelete(null);
      }
    }
  };

  const handleConfirmDeleteMultiple = async () => {
    if (mode === 'app-shell') {
      // ✅ APP-SHELL: Supprimer via EcheanceService (local-first)
      if (!organizationId || selectedEcheanceIds.length === 0) {
        notify2.error('Aucune échéance sélectionnée');
        return;
      }

      const count = selectedEcheanceIds.length;

      try {
        const echeanceService = createEcheanceServiceWithMode('app-shell');
        
        // ✅ APP-SHELL: Supprimer définitivement toutes les échéances sélectionnées (hard delete)
        // La sync serveur est découplée et se fera plus tard (auto ou manuel)
        await Promise.all(
          selectedEcheanceIds.map(id => 
            echeanceService.deleteEcheance(id, organizationId, 'hard')
          )
        );
        
        // ✅ Émettre UNIQUEMENT un événement ciblé (pas de sync immédiate, pas de fetch bloquant)
        window.dispatchEvent(new CustomEvent('deadlines:refresh', { 
          detail: { scope: 'global', reason: 'delete_multiple' } 
        }));
        
        setShowDeleteMultipleModal(false);
        setSelectedEcheanceIds([]);
        notify2.success(`${count} échéance(s) supprimée(s) avec succès`);
      } catch (error: any) {
        console.error('Erreur lors de l\'opération multiple:', error);
        notify2.error('Erreur', error.message || 'Erreur lors de l\'opération');
      }
      return;
    } else {
      // Mode normal online : utiliser l'API
      if (selectedEcheanceIds.length > 0) {
        await Promise.all(
          selectedEcheanceIds.map(id => 
            fetch(`/api/echeances/${id}`, { method: 'DELETE' })
          )
        );
        
        notify2.success(`${selectedEcheanceIds.length} échéance(s) supprimée(s) avec succès`);
        
        // Invalider les queries React Query
      queryClient.invalidateQueries({ queryKey: ['echeances-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['echeances-charts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-patrimoine'] });
      queryClient.invalidateQueries({ queryKey: ['patrimoine'] });
      setSelectedEcheanceIds([]);
      setRefreshKey((k) => k + 1);
        setShowDeleteMultipleModal(false);
      }
    }
  };

  const handleDeleteMultiple = () => {
    if (selectedEcheanceIds.length === 0) {
      notify2.warning('Aucune échéance sélectionnée');
      return;
    }
    setShowDeleteMultipleModal(true);
  };

  // Sélection
  const handleSelectEcheance = (id: string) => {
    setSelectedEcheanceIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (checked: boolean) => {
    const echeancesToSelect = mode === 'app-shell' ? filteredEcheances : echeances;
    setSelectedEcheanceIds(checked ? echeancesToSelect.map((e) => e.id) : []);
  };

  // Formatage
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return '—';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const kpis = kpisData || { revenusAnnuels: 0, chargesAnnuelles: 0, totalEcheances: 0, echeancesActives: 0 };
  const charts = chartsData || { cumulative: [], byType: [], recuperables: { recuperables: 0, nonRecuperables: 0 } };

  // États de chargement et erreur
  if (loading && echeances.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des échéances...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
        Erreur lors du chargement des données : {error}
      </div>
    );
  }

  // Rendu principal
  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-full">
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
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 truncate min-w-0">Échéances totales</h1>
            <div className="flex-shrink-0">
              <button
                onClick={handleCreate}
                className="inline-flex items-center justify-center h-8 w-8 text-orange-600 border border-orange-200 rounded-lg bg-white hover:bg-gradient-to-r hover:from-orange-500 hover:to-red-500 hover:text-white transition-all duration-300 ease-out focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                aria-label="Nouvelle échéance"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Ligne 2 : Description */}
        <p className="text-sm sm:text-base text-gray-600">Récurrences totales</p>
      </div>

      <div className="p-6 space-y-6">
        {/* Graphiques - Ligne 1 : 2+1+1 colonnes */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="min-w-0 lg:col-span-2">
            <EcheancesCumulativeChart
              data={charts.cumulative}
              isLoading={chartsLoading}
              viewMode={viewMode}
              onViewModeChange={handleViewModeChange}
            />
          </div>
          <div className="min-w-0">
            <EcheancesByTypeChart
              data={charts.byType}
              isLoading={chartsLoading}
            />
          </div>
          <div className="min-w-0">
            <EcheancesRecuperablesChart
              data={charts.recuperables}
              isLoading={chartsLoading}
            />
          </div>
        </div>

        {/* KPIs - Cartes filtrantes */}
        <EcheancesKpiBar
          kpis={kpis}
          activeFilter={activeKpiFilter}
          onFilterChange={handleKpiFilterChange}
          isLoading={kpisLoading}
        />

        {/* Filtres - Tout dans le même panel */}
        <EcheancesFilters
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onResetFilters={handleResetFilters}
          properties={properties}
          leases={leases}
          periodStart={periodStart}
          periodEnd={periodEnd}
          onPeriodChange={handlePeriodChange}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
        />

        {/* Tableau */}
        <div className="bg-white rounded-xl border border-gray-200">
          {/* Header du tableau */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Échéances totales</h3>
              <div className="text-sm text-gray-600">
                {totalCount} échéance{totalCount > 1 ? 's' : ''} au total
              </div>
            </div>

            {/* Sélection multiple */}
            {selectedEcheanceIds.length > 0 && (
              <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <CheckCircle className="h-5 w-5 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">
                  {selectedEcheanceIds.length} échéance(s) sélectionnée(s)
                </span>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteMultiple}
                  className="ml-auto"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Archiver la sélection
                </Button>
              </div>
            )}
          </div>

          {/* Vue mobile : Cards */}
          <div className="lg:hidden space-y-3 p-4">
            {loading ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="bg-white border rounded-lg p-4 shadow-sm">
                  <div className="h-12 bg-gray-100 rounded animate-pulse"></div>
                </div>
              ))
            ) : (mode === 'app-shell' ? filteredEcheances : echeances).length === 0 ? (
              <div className="text-center text-gray-500 py-12">
                Aucune échéance trouvée
              </div>
            ) : (
              <>
                {(mode === 'app-shell' ? filteredEcheances : echeances).slice(0, mobileLimit).map((echeance) => {
                  // ✅ Page globale : récupérer le contexte bien/locataire
                  const property = mode === 'app-shell' && echeance.propertyId 
                    ? properties.find(p => p.id === echeance.propertyId)
                    : echeance.Property;
                  const lease = mode === 'app-shell' && echeance.leaseId
                    ? leases.find(l => l.id === echeance.leaseId)
                    : echeance.Lease;
                  const tenant = lease && mode === 'app-shell' ? (() => {
                    // Trouver le locataire via le bail
                    const foundLease = leases.find(l => l.id === lease.id);
                    if (foundLease && 'tenantId' in foundLease) {
                      const tenantData = tenantsMap.get((foundLease as any).tenantId);
                      return tenantData ? `${tenantData.firstName} ${tenantData.lastName}`.trim() : null;
                    }
                    return null;
                  })() : null;
                  
                  return (
                    <div
                      key={echeance.id}
                      onClick={() => handleRowClick(echeance)}
                      className="bg-white border rounded-lg p-4 shadow-sm transition-all hover:shadow-md cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <input
                              type="checkbox"
                              checked={selectedEcheanceIds.includes(echeance.id)}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleSelectEcheance(echeance.id);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="rounded border-gray-300 flex-shrink-0"
                            />
                            <h4 className="text-sm font-semibold text-gray-900 truncate">{echeance.label}</h4>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <Badge className={getNatureBadgeClass(resolveNatureCodeForEcheance(echeance))}>
                              {getNatureLabelForEcheance(echeance, natures)}
                            </Badge>
                            <Badge
                              className={
                                echeance.sens === 'DEBIT'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-green-100 text-green-800'
                              }
                            >
                              {SENS_LABELS[echeance.sens]}
                            </Badge>
                            <span className="text-xs text-gray-500">
                              {PERIODICITE_LABELS[echeance.periodicite]}
                            </span>
                          </div>
                          <div className="text-sm font-medium text-gray-900 mb-1">
                            {formatCurrency(echeance.montant)}
                          </div>
                          {/* ✅ Page globale : afficher contexte bien/locataire */}
                          {mode === 'app-shell' && property && (
                            <div className="text-xs text-gray-600 mb-1">
                              {property.name}
                              {'address' in property && property.address && ` - ${property.address}`}
                              {'postalCode' in property && property.postalCode && 'city' in property && property.city && `, ${property.postalCode} ${property.city}`}
                            </div>
                          )}
                          {mode === 'app-shell' && tenant && (
                            <div className="text-xs text-gray-600 mb-1">
                              Locataire: {tenant}
                            </div>
                          )}
                          <div className="text-xs text-gray-600">
                            {formatDate(echeance.startAt)}
                            {echeance.endAt && ` → ${formatDate(echeance.endAt)}`}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                          <Switch
                            checked={optimisticActiveStates.has(echeance.id) ? optimisticActiveStates.get(echeance.id)! : echeance.isActive}
                            onCheckedChange={async (checked) => {
                              // ✅ Éviter les doubles clics
                              if (updatingEcheancesRef.current.has(echeance.id)) {
                                return;
                              }
                              
                              // ✅ Mise à jour optimiste immédiate
                              updatingEcheancesRef.current.add(echeance.id);
                              setOptimisticActiveStates(prev => new Map(prev).set(echeance.id, checked));
                              
                              try {
                                if (mode === 'app-shell') {
                                  if (!organizationId) {
                                    notify2.error('OrganizationId manquant');
                                    setOptimisticActiveStates(prev => {
                                      const newMap = new Map(prev);
                                      newMap.delete(echeance.id);
                                      return newMap;
                                    });
                                    updatingEcheancesRef.current.delete(echeance.id);
                                    return;
                                  }

                                  const echeanceService = createEcheanceServiceWithMode('app-shell');
                                  
                                  await echeanceService.updateEcheance(echeance.id, organizationId, {
                                    isActive: checked,
                                  });
                                  
                                  // ✅ Émettre l'événement après la mise à jour réussie
                                  window.dispatchEvent(new CustomEvent('deadlines:refresh', { 
                                    detail: { scope: 'global', reason: 'update' } 
                                  }));
                                  
                                  // ✅ Nettoyer l'état optimiste après un délai plus long pour laisser le temps au refresh
                                  setTimeout(() => {
                                    updatingEcheancesRef.current.delete(echeance.id);
                                    setOptimisticActiveStates(prev => {
                                      const newMap = new Map(prev);
                                      newMap.delete(echeance.id);
                                      return newMap;
                                    });
                                  }, 1000);
                                  
                                  notify2.success(checked ? 'Échéance activée' : 'Échéance désactivée');
                                } else {
                                  const response = await fetch(`/api/echeances/${echeance.id}`, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ isActive: checked }),
                                  });
                                  if (response.ok) {
                                    queryClient.invalidateQueries({ queryKey: ['echeances-kpis'] });
                                    queryClient.invalidateQueries({ queryKey: ['echeances-charts'] });
                                    queryClient.invalidateQueries({ queryKey: ['dashboard-patrimoine'] });
                                    queryClient.invalidateQueries({ queryKey: ['patrimoine'] });
                                    setRefreshKey((k) => k + 1);
                                    updatingEcheancesRef.current.delete(echeance.id);
                                    setOptimisticActiveStates(prev => {
                                      const newMap = new Map(prev);
                                      newMap.delete(echeance.id);
                                      return newMap;
                                    });
                                  } else {
                                    // Revert en cas d'erreur
                                    updatingEcheancesRef.current.delete(echeance.id);
                                    setOptimisticActiveStates(prev => {
                                      const newMap = new Map(prev);
                                      newMap.delete(echeance.id);
                                      return newMap;
                                    });
                                    notify2.error('Erreur lors de la mise à jour');
                                  }
                                }
                              } catch (error) {
                                // Revert en cas d'erreur
                                updatingEcheancesRef.current.delete(echeance.id);
                                setOptimisticActiveStates(prev => {
                                  const newMap = new Map(prev);
                                  newMap.delete(echeance.id);
                                  return newMap;
                                });
                                notify2.error('Erreur lors de la mise à jour');
                              }
                            }}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(echeance);
                            }}
                            title="Éditer"
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(echeance);
                            }}
                            title="Supprimer"
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {(mode === 'app-shell' ? filteredEcheances : echeances).length > mobileLimit && (
                  <button
                    onClick={() => setMobileLimit(prev => prev + 10)}
                    className="w-full py-2 text-sm font-medium text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded-lg border border-orange-200 transition-colors"
                  >
                    Voir plus ({(mode === 'app-shell' ? filteredEcheances : echeances).length - mobileLimit} restantes)
                  </button>
                )}
              </>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            {isUI2Active ? (
              // Version UI2 avec TableV2
              <TableV2>
                <TableHeaderV2>
                  <tr>
                    <TableHeaderCellV2>
                      <input
                        type="checkbox"
                        checked={selectedEcheanceIds.length === (mode === 'app-shell' ? filteredEcheances.length : echeances.length) && (mode === 'app-shell' ? filteredEcheances.length : echeances.length) > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                    </TableHeaderCellV2>
                    <TableHeaderCellV2>Libellé</TableHeaderCellV2>
                    <TableHeaderCellV2>Nature</TableHeaderCellV2>
                    <TableHeaderCellV2>Catégorie</TableHeaderCellV2>
                    <TableHeaderCellV2>Périodicité</TableHeaderCellV2>
                    <TableHeaderCellV2 className="text-right">Montant</TableHeaderCellV2>
                    <TableHeaderCellV2>Sens</TableHeaderCellV2>
                    <TableHeaderCellV2>Dates</TableHeaderCellV2>
                    <TableHeaderCellV2 className="text-center">Actif</TableHeaderCellV2>
                    <TableHeaderCellV2 className="text-center">Actions</TableHeaderCellV2>
                  </tr>
                </TableHeaderV2>
                <TableBodyV2>
                  {loading ? (
                    [...Array(5)].map((_, i) => (
                      <tr key={i}>
                        <td colSpan={11} className="px-4 py-3">
                          <div className="h-12 bg-gray-100 rounded animate-pulse"></div>
                        </td>
                      </tr>
                    ))
                  ) : echeances.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-4 py-12 text-center text-gray-500">
                        Aucune échéance trouvée
                      </td>
                    </tr>
                  ) : (
                    (mode === 'app-shell' ? filteredEcheances : echeances).map((echeance) => (
                      <TableRowV2
                        key={echeance.id}
                        onClick={() => handleRowClick(echeance)}
                      >
                        <TableCellV2 onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedEcheanceIds.includes(echeance.id)}
                            onChange={() => handleSelectEcheance(echeance.id)}
                            className="rounded border-gray-300"
                          />
                        </TableCellV2>
                        <TableCellV2>
                          <div className="font-medium text-gray-900">{echeance.label}</div>
                        </TableCellV2>
                        <TableCellV2>
                          <div className="ui2-table-cell-content opacity-100 group-hover:opacity-20 transition-opacity duration-150 ease-in-out">
                            <Badge className={getNatureBadgeClass(resolveNatureCodeForEcheance(echeance))}>
                              {getNatureLabelForEcheance(echeance, natures)}
                            </Badge>
                          </div>
                        </TableCellV2>
                        <TableCellV2>
                          <div className="ui2-table-cell-content opacity-100 group-hover:opacity-20 transition-opacity duration-150 ease-in-out text-sm text-gray-700">
                            {getCategoryLabelForEcheance(echeance, categories, resolveNatureCodeForEcheance, getDefaultCategoryId)}
                          </div>
                        </TableCellV2>
                        <TableCellV2>
                          <div className="ui2-table-cell-content opacity-100 group-hover:opacity-20 transition-opacity duration-150 ease-in-out text-sm text-gray-600">
                            {PERIODICITE_LABELS[echeance.periodicite]}
                          </div>
                        </TableCellV2>
                        <TableCellV2 className="text-right">
                          <div className="ui2-table-cell-content opacity-100 group-hover:opacity-20 transition-opacity duration-150 ease-in-out font-medium text-gray-900">
                            {formatCurrency(echeance.montant)}
                          </div>
                        </TableCellV2>
                        <TableCellV2>
                          <div className="ui2-table-cell-content opacity-100 group-hover:opacity-20 transition-opacity duration-150 ease-in-out">
                            <Badge
                              className={
                                echeance.sens === 'DEBIT'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-green-100 text-green-800'
                              }
                            >
                              {SENS_LABELS[echeance.sens]}
                            </Badge>
                          </div>
                        </TableCellV2>
                        <TableCellV2>
                          <div className="ui2-table-cell-content opacity-100 group-hover:opacity-20 transition-opacity duration-150 ease-in-out text-sm text-gray-600">
                            {formatDate(echeance.startAt)}
                            {echeance.endAt && ` → ${formatDate(echeance.endAt)}`}
                          </div>
                        </TableCellV2>
                        <TableCellV2 className="text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="ui2-table-cell-content opacity-100 group-hover:opacity-20 transition-opacity duration-150 ease-in-out">
                        <Switch
                          checked={optimisticActiveStates.has(echeance.id) ? optimisticActiveStates.get(echeance.id)! : echeance.isActive}
                          onCheckedChange={async (checked) => {
                            // ✅ Éviter les doubles clics
                            if (updatingEcheancesRef.current.has(echeance.id)) {
                              return;
                            }
                            
                            // ✅ Mise à jour optimiste immédiate
                            updatingEcheancesRef.current.add(echeance.id);
                            setOptimisticActiveStates(prev => new Map(prev).set(echeance.id, checked));
                            
                            try {
                              if (mode === 'app-shell') {
                                if (!organizationId) {
                                  notify2.error('OrganizationId manquant');
                                  setOptimisticActiveStates(prev => {
                                    const newMap = new Map(prev);
                                    newMap.delete(echeance.id);
                                    return newMap;
                                  });
                                  updatingEcheancesRef.current.delete(echeance.id);
                                  return;
                                }

                                const echeanceService = createEcheanceServiceWithMode('app-shell');
                                
                                await echeanceService.updateEcheance(echeance.id, organizationId, {
                                  isActive: checked,
                                });
                                
                                // ✅ Émettre l'événement après la mise à jour réussie
                                window.dispatchEvent(new CustomEvent('deadlines:refresh', { 
                                  detail: { scope: 'global', reason: 'update' } 
                                }));
                                
                                // ✅ Nettoyer l'état optimiste après un délai plus long pour laisser le temps au refresh
                                setTimeout(() => {
                                  updatingEcheancesRef.current.delete(echeance.id);
                                  setOptimisticActiveStates(prev => {
                                    const newMap = new Map(prev);
                                    newMap.delete(echeance.id);
                                    return newMap;
                                  });
                                }, 1000);
                                
                                notify2.success(checked ? 'Échéance activée' : 'Échéance désactivée');
                              } else {
                                const response = await fetch(`/api/echeances/${echeance.id}`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ isActive: checked }),
                                });
                                if (response.ok) {
                                  queryClient.invalidateQueries({ queryKey: ['echeances-kpis'] });
                                  queryClient.invalidateQueries({ queryKey: ['echeances-charts'] });
                                  queryClient.invalidateQueries({ queryKey: ['dashboard-patrimoine'] });
                                  queryClient.invalidateQueries({ queryKey: ['patrimoine'] });
                                  setRefreshKey((k) => k + 1);
                                  updatingEcheancesRef.current.delete(echeance.id);
                                  setOptimisticActiveStates(prev => {
                                    const newMap = new Map(prev);
                                    newMap.delete(echeance.id);
                                    return newMap;
                                  });
                                } else {
                                  // Revert en cas d'erreur
                                  updatingEcheancesRef.current.delete(echeance.id);
                                  setOptimisticActiveStates(prev => {
                                    const newMap = new Map(prev);
                                    newMap.delete(echeance.id);
                                    return newMap;
                                  });
                                  notify2.error('Erreur lors de la mise à jour');
                                }
                              }
                            } catch (error) {
                              // Revert en cas d'erreur
                              updatingEcheancesRef.current.delete(echeance.id);
                              setOptimisticActiveStates(prev => {
                                const newMap = new Map(prev);
                                newMap.delete(echeance.id);
                                return newMap;
                              });
                              notify2.error('Erreur lors de la mise à jour');
                            }
                          }}
                        />
                          </div>
                        </TableCellV2>
                        <TableCellV2 className="text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(echeance);
                              }}
                              className="h-8 w-8 p-0"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(echeance);
                              }}
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCellV2>
                      </TableRowV2>
                    ))
                  )}
                </TableBodyV2>
              </TableV2>
            ) : (
              // Version normale avec table HTML
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedEcheanceIds.length === (mode === 'app-shell' ? filteredEcheances.length : echeances.length) && (mode === 'app-shell' ? filteredEcheances.length : echeances.length) > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Libellé</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nature</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Catégorie</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Périodicité</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Montant</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sens</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dates</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actif</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i}>
                      <td colSpan={10} className="px-4 py-3">
                        <div className="h-12 bg-gray-100 rounded animate-pulse"></div>
                      </td>
                    </tr>
                  ))
                ) : echeances.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center text-gray-500">
                      Aucune échéance trouvée
                    </td>
                  </tr>
                ) : (
                  (mode === 'app-shell' ? filteredEcheances : echeances).map((echeance) => (
                    <tr
                      key={echeance.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleRowClick(echeance)}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedEcheanceIds.includes(echeance.id)}
                          onChange={() => handleSelectEcheance(echeance.id)}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{echeance.label}</td>
                      <td className="px-4 py-3 text-sm">
                        <Badge className={getNatureBadgeClass(resolveNatureCodeForEcheance(echeance))}>
                          {getNatureLabelForEcheance(echeance, natures)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {getCategoryLabelForEcheance(echeance, categories, resolveNatureCodeForEcheance, getDefaultCategoryId)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {PERIODICITE_LABELS[echeance.periodicite]}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                        {formatCurrency(echeance.montant)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Badge
                          className={
                            echeance.sens === 'DEBIT'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-green-100 text-green-800'
                          }
                        >
                          {SENS_LABELS[echeance.sens]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatDate(echeance.startAt)}
                        {echeance.endAt && ` → ${formatDate(echeance.endAt)}`}
                      </td>
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <Switch
                          checked={optimisticActiveStates.has(echeance.id) ? optimisticActiveStates.get(echeance.id)! : echeance.isActive}
                          onCheckedChange={async (checked) => {
                            // ✅ Éviter les doubles clics
                            if (updatingEcheancesRef.current.has(echeance.id)) {
                              return;
                            }
                            
                            // ✅ Mise à jour optimiste immédiate
                            updatingEcheancesRef.current.add(echeance.id);
                            setOptimisticActiveStates(prev => new Map(prev).set(echeance.id, checked));
                            
                            try {
                              if (mode === 'app-shell') {
                                if (!organizationId) {
                                  notify2.error('OrganizationId manquant');
                                  setOptimisticActiveStates(prev => {
                                    const newMap = new Map(prev);
                                    newMap.delete(echeance.id);
                                    return newMap;
                                  });
                                  updatingEcheancesRef.current.delete(echeance.id);
                                  return;
                                }

                                const echeanceService = createEcheanceServiceWithMode('app-shell');
                                
                                await echeanceService.updateEcheance(echeance.id, organizationId, {
                                  isActive: checked,
                                });
                                
                                // ✅ Émettre l'événement après la mise à jour réussie
                                window.dispatchEvent(new CustomEvent('deadlines:refresh', { 
                                  detail: { scope: 'global', reason: 'update' } 
                                }));
                                
                                // ✅ Nettoyer l'état optimiste après un délai plus long pour laisser le temps au refresh
                                setTimeout(() => {
                                  updatingEcheancesRef.current.delete(echeance.id);
                                  setOptimisticActiveStates(prev => {
                                    const newMap = new Map(prev);
                                    newMap.delete(echeance.id);
                                    return newMap;
                                  });
                                }, 1000);
                                
                                notify2.success(checked ? 'Échéance activée' : 'Échéance désactivée');
                              } else {
                                const response = await fetch(`/api/echeances/${echeance.id}`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ isActive: checked }),
                                });
                                if (response.ok) {
                                  queryClient.invalidateQueries({ queryKey: ['echeances-kpis'] });
                                  queryClient.invalidateQueries({ queryKey: ['echeances-charts'] });
                                  queryClient.invalidateQueries({ queryKey: ['dashboard-patrimoine'] });
                                  queryClient.invalidateQueries({ queryKey: ['patrimoine'] });
                                  setRefreshKey((k) => k + 1);
                                  setOptimisticActiveStates(prev => {
                                    const newMap = new Map(prev);
                                    newMap.delete(echeance.id);
                                    return newMap;
                                  });
                                } else {
                                  // Revert en cas d'erreur
                                  setOptimisticActiveStates(prev => {
                                    const newMap = new Map(prev);
                                    newMap.delete(echeance.id);
                                    return newMap;
                                  });
                                  notify2.error('Erreur lors de la mise à jour');
                                }
                              }
                            } catch (error) {
                              // Revert en cas d'erreur
                              setOptimisticActiveStates(prev => {
                                const newMap = new Map(prev);
                                newMap.delete(echeance.id);
                                return newMap;
                              });
                              notify2.error('Erreur lors de la mise à jour');
                            }
                          }}
                        />
                      </td>
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(echeance);
                            }}
                            title="Éditer"
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(echeance);
                            }}
                            title="Supprimer"
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            )}
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="p-4 border-t border-gray-200">
              {isUI2Active ? (
                <PaginationV2
                  currentPage={pagination.page}
                  totalPages={pagination.pages}
                  onPageChange={(page) => setPagination((prev) => ({ ...prev, page }))}
                />
              ) : (
              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.pages}
                onPageChange={(page) => setPagination((prev) => ({ ...prev, page }))}
              />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal de formulaire */}
      <EcheanceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleFormSubmit}
        echeance={selectedEcheance}
        properties={properties}
        leases={leases}
        mode={modalMode}
        defaultPropertyId={null}
        dataMode={mode}
      />

      {/* Drawer lecture seule */}
      <EcheanceDrawer
        echeance={selectedEcheance}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onEdit={handleEdit}
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
        propertyId={selectedEcheance?.propertyId || undefined}
        onCreateTransaction={openCreateTxFromEcheance}
        coveredOccurrenceDates={
          selectedEcheance ? coveredOccurrenceByEcheanceId.get(selectedEcheance.id) : undefined
        }
        dataMode={mode}
      />

      <TransactionModal
        key={echeanceForTx?.id || 'tx-echeance'}
        isOpen={txModalOpen}
        onClose={() => {
          pendingOccurrenceYmdRef.current = null;
          setTxModalOpen(false);
          setEcheanceForTx(null);
          setTxModalPrefill(null);
        }}
        onSubmit={handleTxModalSubmit as (data: TransactionFormData) => Promise<unknown>}
        context={{ type: 'global' }}
        mode="create"
        title="Nouvelle transaction (échéance)"
        prefill={txModalPrefill || undefined}
      />

      {/* Modal suppression simple */}
      <ConfirmDeleteEcheanceModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleConfirmDelete}
        echeanceId={echeanceToDelete?.id || ''}
        echeanceLabel={echeanceToDelete?.label}
      />

      {/* Modal suppression multiple */}
      <ConfirmDeleteMultipleEcheancesModal
        isOpen={showDeleteMultipleModal}
        onClose={() => setShowDeleteMultipleModal(false)}
        onConfirm={handleConfirmDeleteMultiple}
        echeanceIds={selectedEcheanceIds}
      />
    </div>
  );
}
