'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { notify2 } from '@/lib/notify2';
import { Plus, FileText, Download, Receipt, Home } from 'lucide-react';
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
import LeaseDrawerNew from '@/components/leases/LeaseDrawerNew';
import LeaseFormComplete from '@/components/forms/LeaseFormComplete';
import LeaseEditModal from '@/components/forms/LeaseEditModal';
import LeaseActionsManager from '@/components/forms/LeaseActionsManager';
import CannotDeleteLeaseModal from '@/components/leases/CannotDeleteLeaseModal';
import DeleteConfirmModal from '@/components/leases/DeleteConfirmModal';
import type { LeaseWithDetails } from '@/lib/services/leasesService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { navigateToView } from '@/utils/appShellNavigation';

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
}

export default function PropertyLeasesClient({ propertyId, propertyName }: PropertyLeasesClientProps) {
  
  const { organizationId } = useCurrentOrganization();
  const { setActions } = usePropertyHeaderActions();
  
  // ✅ [DEV-ONLY] Render count pour debug (isolé derrière flag DEV)
  const renderCountRef = useRef(0);
  if (process.env.NODE_ENV === 'development' && (window as any).__SMARTIMMO_DEBUG_LEASES__) {
    renderCountRef.current += 1;
  }
  
  // États de sélection multiple
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // ✅ Stabiliser selectedIds pour éviter les re-renders inutiles du tableau
  const stableSelectedIds = useMemo(() => selectedIds, [selectedIds.size, Array.from(selectedIds).sort().join(',')]);
  
  // États de tri
  const [sortField, setSortField] = useState<'startDate' | 'endDate' | 'rentAmount'>('startDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // États des modals et drawer
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedLease, setSelectedLease] = useState<LeaseWithDetails | null>(null);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [leasesToConfirmDelete, setLeasesToConfirmDelete] = useState<LeaseWithDetails[]>([]);
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [showCannotDeleteModal, setShowCannotDeleteModal] = useState(false);
  const [protectedLeasesForModal, setProtectedLeasesForModal] = useState<Array<{
    id: string;
    propertyName: string;
    tenantName: string;
    reason: string;
  }>>([]);
  
  // État pour le filtre KPI actif
  const [activeKpiFilter, setActiveKpiFilter] = useState<string | null>(null);

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

  const handleResetFilters = useCallback(() => {
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
  }, []);

  const handleEditLease = useCallback((lease: LeaseWithDetails) => {
    setSelectedLease(lease);
    setIsEditModalOpen(true);
  }, []);

  const handleDeleteLease = useCallback((lease: LeaseWithDetails) => {
    setLeasesToConfirmDelete([lease]);
    setShowDeleteConfirmModal(true);
  }, []);

  // ✅ APP-SHELL: Suppression via LeaseService (local-first)
  const handleConfirmDelete = useCallback(async () => {
    if (!organizationId || leasesToConfirmDelete.length === 0) {
      notify2.error('Données manquantes');
      return;
    }

    try {
      const leaseService = createLeaseServiceWithMode('app-shell');
      
      // Supprimer tous les baux sélectionnés via le service (crée automatiquement des pendingOps)
      await Promise.all(
        leasesToConfirmDelete.map(lease => leaseService.deleteLease(lease.id, organizationId))
      );

      // Réinitialiser les états
      setLeasesToConfirmDelete([]);
      setSelectedIds(new Set());
      
      notify2.success(`${leasesToConfirmDelete.length} bail(x) supprimé(s) avec succès`);
      
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
  }, [propertyId, isDrawerOpen, organizationId, leasesToConfirmDelete]);

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
  const handleSort = useCallback((field: 'startDate' | 'endDate' | 'rentAmount') => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  }, [sortField]);

  // ✅ APP-SHELL: Trier les baux filtrés en mémoire
  const sortedLeases = useMemo(() => {
    if (!filteredLeases || filteredLeases.length === 0) {
      return [];
    }
    
    // ✅ [DEV-ONLY] Log avant tri (isolé derrière flag DEV)
    if (process.env.NODE_ENV === 'development' && (window as any).__SMARTIMMO_DEBUG_LEASES__) {
      console.log('[PropertyLeasesClient] [DEV] Avant tri sortedLeases:', {
        filteredCount: filteredLeases.length,
        filteredStatuses: filteredLeases.map(l => `${l.id.slice(0, 8)}:${l.status}`).join(', ')
      });
    }
    
    const sorted = [...filteredLeases].sort((a, b) => {
      let comparison = 0;

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

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    // ✅ [DEV-ONLY] Log après tri (isolé derrière flag DEV)
    if (process.env.NODE_ENV === 'development' && (window as any).__SMARTIMMO_DEBUG_LEASES__) {
      console.log('[PropertyLeasesClient] [DEV] Après tri sortedLeases:', {
        sortedCount: sorted.length,
        sortedStatuses: sorted.map(l => `${l.id.slice(0, 8)}:${l.status}`).join(', ')
      });
    }

    return sorted;
  }, [filteredLeases, sortField, sortOrder]);

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

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedLease(null);
  };

  // Gestion de la suppression multiple
  const handleDeleteMultiple = useCallback(() => {
    const toDelete = filteredLeases.filter(l => selectedIds.has(l.id));
    setLeasesToConfirmDelete(toDelete);
    setShowDeleteConfirmModal(true);
  }, [filteredLeases, selectedIds]);


  return (
    <div className="space-y-6">
      {/* Header avec bouton retour */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex-1">
          {/* Le titre et le menu contextuel sont déjà dans PropertyHeader via le layout */}
        </div>
      </div>

      {/* Graphiques - TOUS sur la même ligne (AU DESSUS DES CARTES) */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
        {/* Graphique 1 : Évolution des loyers (2 colonnes) */}
        <div className="md:col-span-2">
          <LeasesRentEvolutionChart
            monthlyData={chartsData.rentEvolution.monthly}
            yearlyData={chartsData.rentEvolution.yearly}
            isLoading={chartsLoading}
          />
        </div>
        
        {/* Graphique 2 : Répartition par type de meublé (1 colonne) */}
        <div className="md:col-span-1">
          <LeasesByFurnishedChart
            data={chartsData.byFurnished}
            isLoading={chartsLoading}
          />
        </div>
        
        {/* Graphique 3 : Cautions & Loyers cumulés (1 colonne) */}
        <div className="md:col-span-1">
          <LeasesDepositsRentsChart
            data={chartsData.depositsRents}
            isLoading={chartsLoading}
          />
        </div>
      </div>

      {/* Cartes KPI (APRÈS LES GRAPHIQUES) - Cartes filtrantes actives */}
      <LeasesKpiBar
        kpis={kpis}
        activeFilter={activeKpiFilter}
        onFilterChange={handleKpiFilterChange}
        isLoading={kpisLoading}
      />

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
          {/* Tri rapide */}
          <div className="flex items-center justify-between mb-4 pb-3 border-b">
            <p className="text-sm text-gray-700">
              <span className="font-semibold">{sortedLeases.length}</span> bail{sortedLeases.length > 1 ? 'x' : ''} affiché{sortedLeases.length > 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Tri rapide:</span>
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
              {sortedLeases.length > 0 && (
                <> Premier: {sortedLeases[0].id.slice(0, 8)}... status={sortedLeases[0].status}</>
              )}
            </div>
          )}
          <LeasesTableNew
            leases={sortedLeases}
            loading={isLoading}
            onView={handleViewLease}
            onEdit={handleEditLease}
            onDelete={handleDeleteLease}
            onActions={handleActionsLease}
            onSelect={handleSelectLease}
            onSelectAll={handleSelectAll}
            selectedIds={stableSelectedIds}
            showSelection={true}
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
          mode="app-shell" // ✅ Indiquer le mode app-shell
          propertyId={propertyId} // ✅ CRITIQUE: Passer propertyId pour le refresh ciblé
        />
      )}

      {/* Drawer de détail */}
      {isDrawerOpen && selectedLease && (
        <LeaseDrawerNew
          lease={selectedLease}
          isOpen={isDrawerOpen}
          onClose={handleCloseDrawer}
          onEdit={() => {
            setIsDrawerOpen(false);
            handleEditLease(selectedLease);
          }}
          onDelete={() => handleDeleteLease(selectedLease)}
          onGenerateReceipt={(lease) => {
            setSelectedLease(lease);
            setShowActionsModal(true);
          }}
          onDownloadSignedLease={(lease) => {
            if (lease.signedPdfUrl) {
              window.open(lease.signedPdfUrl, '_blank');
            } else {
              notify2.error('Aucun bail signé disponible');
            }
          }}
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
            // ✅ APP-SHELL: Refresh via événement ciblé
            window.dispatchEvent(new CustomEvent('leases:refresh', { 
              detail: { scope: 'property', propertyId, reason: 'crud' } 
            }));
          }}
          initialAction="generate-receipt"
        />
      )}

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

