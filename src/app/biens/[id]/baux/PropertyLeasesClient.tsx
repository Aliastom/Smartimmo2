'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { notify2 } from '@/lib/notify2';
import { Plus, FileText, Download, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { BackToPropertyButton } from '@/components/shared/BackToPropertyButton';
import { LeasesKpiBar } from '@/components/leases/LeasesKpiBar';
import { LeasesRentEvolutionChart } from '@/components/leases/LeasesRentEvolutionChart';
import { LeasesByFurnishedChart } from '@/components/leases/LeasesByFurnishedChart';
import { LeasesDepositsRentsChart } from '@/components/leases/LeasesDepositsRentsChart';
import { useLeasesData } from '@/features/leases/hooks/useLeasesData';
import { useLeasesKpis } from '@/hooks/useLeasesKpis';
import { useLeasesCharts } from '@/hooks/useLeasesCharts';
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
  // ✅ DEV-ONLY: Log de mount/unmount pour détecter les remounts
  const mountId = useRef(Math.random().toString(36).substring(7));
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[PropertyLeasesClient] 🟢 MOUNT (id: ${mountId.current}, propertyId: ${propertyId})`);
      return () => {
        console.log(`[PropertyLeasesClient] 🔴 UNMOUNT (id: ${mountId.current}, propertyId: ${propertyId})`);
      };
    }
  }, [propertyId]);

  // ✅ DEV-ONLY: Compteur de renders
  if (process.env.NODE_ENV === 'development') {
    console.count('PropertyLeasesClient render');
  }
  
  // États de sélection multiple
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
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

  // ✅ APP-SHELL: Charger les baux depuis IndexedDB avec filtre propertyId
  const {
    leases: allLeases,
    properties,
    tenants,
    totalCount,
    loading: isLoading,
  } = useLeasesData({
    mode: 'app-shell',
    propertyId, // ✅ Passer propertyId pour filtrer les events
    filters: {
      propertyId, // ✅ Filtrer par bien
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
    },
    activeKpiFilter,
  });

  // ✅ APP-SHELL: Filtrer les baux en mémoire selon les filtres UI
  const filteredLeases = useMemo(() => {
    const perfStart = process.env.NODE_ENV === 'development' ? performance.now() : 0;
    
    let filtered = allLeases.filter(lease => {
      // Filtre de recherche
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch = 
          lease.Property?.name?.toLowerCase().includes(searchLower) ||
          `${lease.Tenant?.firstName} ${lease.Tenant?.lastName}`.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Filtre de locataire
      if (filters.tenantId && lease.tenantId !== filters.tenantId) return false;

      // Filtre de type
      if (filters.type && lease.type !== filters.type) return false;

      // Filtre de meublé
      if (filters.furnishedType && lease.furnishedType !== filters.furnishedType) return false;

      // Filtre de statut
      if (filters.status && lease.status !== filters.status) return false;

      // Filtres de dates
      if (filters.startDateFrom) {
        const leaseStart = new Date(lease.startDate);
        const fromDate = new Date(filters.startDateFrom);
        if (leaseStart < fromDate) return false;
      }
      if (filters.startDateTo) {
        const leaseStart = new Date(lease.startDate);
        const toDate = new Date(filters.startDateTo);
        toDate.setHours(23, 59, 59, 999);
        if (leaseStart > toDate) return false;
      }
      if (filters.endDateFrom) {
        if (!lease.endDate) return false;
        const leaseEnd = new Date(lease.endDate);
        const fromDate = new Date(filters.endDateFrom);
        if (leaseEnd < fromDate) return false;
      }
      if (filters.endDateTo) {
        if (!lease.endDate) return false;
        const leaseEnd = new Date(lease.endDate);
        const toDate = new Date(filters.endDateTo);
        toDate.setHours(23, 59, 59, 999);
        if (leaseEnd > toDate) return false;
      }

      // Filtres de montants
      if (filters.rentMin && lease.rentAmount < parseFloat(filters.rentMin)) return false;
      if (filters.rentMax && lease.rentAmount > parseFloat(filters.rentMax)) return false;
      if (filters.depositMin && lease.deposit < parseFloat(filters.depositMin)) return false;
      if (filters.depositMax && lease.deposit > parseFloat(filters.depositMax)) return false;

      // Filtre d'indexation
      if (filters.indexationType && lease.indexationType !== filters.indexationType) return false;
      if (filters.indexationDateFrom || filters.indexationDateTo) {
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

    if (process.env.NODE_ENV === 'development') {
      const perfEnd = performance.now();
      console.log(`[PropertyLeasesClient] ⏱️ Filtrage baux: ${(perfEnd - perfStart).toFixed(2)}ms (${filtered.length}/${allLeases.length})`);
    }

    return filtered;
  }, [allLeases, filters, activeKpiFilter]);

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
    if (process.env.NODE_ENV === 'development') {
      console.log(`[PropertyLeasesClient] 🔄 Changement de filtre (id: ${mountId.current})`, newFilters);
    }
    // S'assurer que propertyId reste fixé
    setFilters({ ...newFilters, propertyId });
  }, [propertyId]);

  // ✅ APP-SHELL: Gestion du filtre KPI (en mémoire uniquement)
  const handleKpiFilterChange = useCallback((filterKey: string | null) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[PropertyLeasesClient] 🔄 Changement filtre KPI (id: ${mountId.current})`, filterKey);
    }
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

  // ✅ APP-SHELL: Suppression via repository offline (local-first)
  const handleConfirmDelete = useCallback(async () => {
    // TODO: Implémenter la suppression via repository offline
    // Pour l'instant, on émet juste l'événement de refresh
    // La suppression sera gérée par DeleteConfirmModal

      // Réinitialiser les états
      setLeasesToConfirmDelete([]);
      setSelectedIds(new Set());
    
    // ✅ APP-SHELL: Refresh via événement ciblé
    window.dispatchEvent(new CustomEvent('leases:refresh', { 
      detail: { scope: 'property', propertyId, reason: 'crud' } 
    }));

      // Fermer le drawer si ouvert
      if (isDrawerOpen) {
        setIsDrawerOpen(false);
      }
  }, [propertyId, isDrawerOpen]);

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

  const handleSelectAll = useCallback((selected: boolean) => {
    if (selected) {
      setSelectedIds(new Set(filteredLeases.map(l => l.id)));
    } else {
      setSelectedIds(new Set());
    }
  }, [filteredLeases]);

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
  const sortedLeases = React.useMemo(() => {
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

    return sorted;
  }, [filteredLeases, sortField, sortOrder]);

  // ✅ APP-SHELL: Soumission via repository offline (local-first)
  const handleModalSubmit = async (data: any) => {
    try {
      // TODO: Implémenter la création/modification via repository offline
      // Pour l'instant, on émet juste l'événement de refresh
      // La création/modification sera gérée par LeaseFormComplete/LeaseEditModal

      setIsModalOpen(false);
      setIsEditModalOpen(false);
      setSelectedLease(null);
      
      // ✅ APP-SHELL: Refresh via événement ciblé
      window.dispatchEvent(new CustomEvent('leases:refresh', { 
      detail: { scope: 'property', propertyId, reason: 'crud' } 
    }));
      
      const isEdit = !!data.id;
      notify2.success(isEdit ? 'Bail mis à jour avec succès' : 'Bail créé avec succès');
    } catch (error) {
      console.error(`Erreur lors de ${data.id ? 'la mise à jour' : 'la création'} du bail:`, error);
      notify2.error(error instanceof Error ? error.message : `Erreur lors de ${data.id ? 'la mise à jour' : 'la création'} du bail`);
      throw error;
    }
  };

  // ✅ APP-SHELL: Résiliation via repository offline (local-first)
  const handleTerminateMultiple = async (leaseIds: string[]) => {
    try {
      // TODO: Implémenter la résiliation via repository offline
      // Pour l'instant, on émet juste l'événement de refresh
      
      // ✅ APP-SHELL: Refresh via événement ciblé
      window.dispatchEvent(new CustomEvent('leases:refresh', { 
      detail: { scope: 'property', propertyId, reason: 'crud' } 
    }));
      
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
        
        <div className="flex items-center gap-3">
          <Button onClick={handleCreateLease}>
            <Plus className="h-4 w-4 mr-2" />
            Nouveau bail
          </Button>
          <BackToPropertyButton 
            propertyId={propertyId} 
            propertyName={propertyName}
          />
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
          <CardTitle>Liste des Baux ({totalCount})</CardTitle>
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
                    ? 'bg-blue-50 border-blue-300 text-blue-700' 
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
                    ? 'bg-blue-50 border-blue-300 text-blue-700' 
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
                    ? 'bg-blue-50 border-blue-300 text-blue-700' 
                    : 'bg-white border-gray-300 hover:bg-gray-50'
                }`}
                title="Trier par loyer"
              >
                Loyer {sortField === 'rentAmount' ? (sortOrder === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3" />}
              </button>
            </div>
          </div>

          {/* Tableau des baux */}
          <LeasesTableNew
            leases={sortedLeases}
            loading={isLoading}
            onView={handleViewLease}
            onEdit={handleEditLease}
            onDelete={handleDeleteLease}
            onActions={handleActionsLease}
            onSelect={handleSelectLease}
            onSelectAll={handleSelectAll}
            selectedIds={selectedIds}
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

