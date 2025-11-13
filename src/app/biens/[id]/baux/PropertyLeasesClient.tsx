'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { notify2 } from '@/lib/notify2';
import { Plus, FileText, Download, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { BackToPropertyButton } from '@/components/shared/BackToPropertyButton';
import { PropertySubNav } from '@/components/bien/PropertySubNav';
import { LeasesKpiBar } from '@/components/leases/LeasesKpiBar';
import { LeasesRentEvolutionChart } from '@/components/leases/LeasesRentEvolutionChart';
import { LeasesByFurnishedChart } from '@/components/leases/LeasesByFurnishedChart';
import { LeasesDepositsRentsChart } from '@/components/leases/LeasesDepositsRentsChart';
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
  const router = useRouter();
  const searchParams = useSearchParams();

  // États principaux
  const [leases, setLeases] = useState<LeaseWithDetails[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  
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

  // États des données de référence
  const [properties, setProperties] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  
  // État pour forcer le rafraîchissement des KPI et graphiques
  const [refreshKey, setRefreshKey] = useState(0);

  // Charger les KPI avec le hook (scopé par propertyId)
  const { kpis, isLoading: kpisLoading } = useLeasesKpis({
    refreshKey,
    propertyId, // FILTRE PAR BIEN
  });

  // Charger les graphiques avec le hook (scopé par propertyId)
  const { data: chartsData, isLoading: chartsLoading } = useLeasesCharts({
    refreshKey,
    propertyId, // FILTRE PAR BIEN
  });

  // Nettoyer l'URL au montage
  useEffect(() => {
    const hasFilters = searchParams.toString().length > 0;
    if (hasFilters) {
      router.replace(`/biens/${propertyId}/baux`, { scroll: false });
    }
  }, [propertyId]);

  // Chargement des données de référence
  useEffect(() => {
    const loadReferenceData = async () => {
      try {
        const [propertiesRes, tenantsRes] = await Promise.all([
          fetch('/api/properties'),
          fetch('/api/tenants')
        ]);

        const [propertiesData, tenantsData] = await Promise.all([
          propertiesRes.json(),
          tenantsRes.json()
        ]);

        setProperties(propertiesData);
        setTenants(tenantsData);
      } catch (error) {
        console.error('Erreur lors du chargement des données de référence:', error);
      }
    };

    loadReferenceData();
  }, []);

  // Chargement des baux (TOUJOURS FILTRÉ PAR propertyId)
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      
      // TOUJOURS filtrer par propertyId
      params.append('propertyId', propertyId);
      
      // Ajouter les autres filtres
      if (filters.search) params.append('search', filters.search);
      if (filters.tenantId) params.append('tenantId', filters.tenantId);
      if (filters.type) params.append('type', filters.type);
      if (filters.furnishedType) params.append('furnishedType', filters.furnishedType);
      if (filters.indexationType) params.append('indexationType', filters.indexationType);
      if (filters.rentMin) params.append('rentMin', filters.rentMin);
      if (filters.rentMax) params.append('rentMax', filters.rentMax);
      if (filters.depositMin) params.append('depositMin', filters.depositMin);
      if (filters.depositMax) params.append('depositMax', filters.depositMax);
      if (filters.startDateFrom) params.append('startDateFrom', filters.startDateFrom);
      if (filters.startDateTo) params.append('startDateTo', filters.startDateTo);
      if (filters.endDateFrom) params.append('endDateFrom', filters.endDateFrom);
      if (filters.endDateTo) params.append('endDateTo', filters.endDateTo);
      if (filters.indexationDateFrom) params.append('indexationDateFrom', filters.indexationDateFrom);
      if (filters.indexationDateTo) params.append('indexationDateTo', filters.indexationDateTo);

      // Appliquer le filtre KPI actif
      if (activeKpiFilter === 'active') {
        params.append('status', 'ACTIF');
      } else if (activeKpiFilter === 'expiring') {
        params.append('upcomingExpiration', 'true');
      } else if (activeKpiFilter === 'indexation') {
        params.append('indexationDue', 'true');
      } else if (activeKpiFilter === 'all') {
        // Tous les baux (pas de filtre de statut supplémentaire)
      } else if (filters.status) {
        params.append('status', filters.status);
      }

      const response = await fetch(`/api/leases?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Erreur lors du chargement des baux');
      }

      const data = await response.json();

      // Adapter selon le format de réponse de l'API
      if (Array.isArray(data)) {
        setLeases(data);
        setTotalCount(data.length);
      } else if (data.items) {
        setLeases(data.items);
        setTotalCount(data.total || data.items.length);
      } else if (data.data) {
        setLeases(data.data);
        setTotalCount(data.total || data.data.length);
      } else {
        setLeases([]);
        setTotalCount(0);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
      notify2.error('Erreur lors du chargement des données');
      setLeases([]);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [propertyId, filters, activeKpiFilter]);

  // Chargement des données quand les filtres changent ou refreshKey
  useEffect(() => {
    loadData();
  }, [loadData, refreshKey]);

  // Synchronisation des filtres avec l'URL
  const updateURL = useCallback((newFilters: Filters) => {
    const params = new URLSearchParams();
    
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value && key !== 'propertyId') params.append(key, value);
    });

    const newURL = params.toString() ? `?${params.toString()}` : '';
    router.replace(`/biens/${propertyId}/baux${newURL}`, { scroll: false });
  }, [router, propertyId]);

  // Gestion des filtres
  const handleFiltersChange = useCallback((newFilters: Filters) => {
    // S'assurer que propertyId reste fixé
    setFilters({ ...newFilters, propertyId });
    updateURL({ ...newFilters, propertyId });
  }, [updateURL, propertyId]);

  // Gestion du filtre KPI (cartes filtrantes)
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
    updateURL(resetFilters);
  }, [updateURL, propertyId]);

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

  // Fonction pour effectuer la suppression après confirmation
  const handleConfirmDelete = useCallback(async () => {
    const leasesToProcess = [...leasesToConfirmDelete];
    
    try {
      // ÉTAPE 1 : Vérifier d'abord quels baux sont protégés
      const checkResults = await Promise.allSettled(
        leasesToProcess.map(async lease => {
          const checkResponse = await fetch(`/api/leases/${lease.id}/check-deletable`);
          if (checkResponse.ok) {
            const data = await checkResponse.json();
            return { 
              lease, 
              deletable: data.deletable,
              reason: data.reason 
            };
          }
          return { lease, deletable: true, reason: null };
        })
      );

      const checksSuccessful = checkResults.filter(r => r.status === 'fulfilled');
      const protectedLeases = checksSuccessful
        .filter((r: any) => !r.value.deletable)
        .map((r: any) => r.value);
      const deletableLeases = checksSuccessful
        .filter((r: any) => r.value.deletable)
        .map((r: any) => r.value.lease);

      // ÉTAPE 2 : Si des baux sont protégés, afficher la modal SANS supprimer
      if (protectedLeases.length > 0) {
        const protectedLeasesData = protectedLeases.map((item: any) => ({
          id: item.lease.id,
          propertyName: item.lease.Property.name,
          tenantName: `${item.lease.Tenant.firstName} ${item.lease.Tenant.lastName}`,
          reason: item.reason || 'Ce bail contient des transactions'
        }));
        
        setProtectedLeasesForModal(protectedLeasesData);
        setShowCannotDeleteModal(true);
        return;
      }

      // ÉTAPE 3 : Si aucun bail protégé, supprimer tous les baux
      const deleteResults = await Promise.allSettled(
        deletableLeases.map(lease =>
          fetch(`/api/leases/${lease.id}`, { method: 'DELETE' })
        )
      );

      const deleted = deleteResults.filter(r => r.status === 'fulfilled').length;

      // Réinitialiser les états
      setLeasesToConfirmDelete([]);
      setSelectedIds(new Set());
      setRefreshKey(prev => prev + 1);

      if (deleted > 0) {
        notify2.success(`${deleted} bail${deleted > 1 ? 'x' : ''} supprimé${deleted > 1 ? 's' : ''} avec succès`);
      }

      // Fermer le drawer si ouvert
      if (isDrawerOpen) {
        setIsDrawerOpen(false);
      }
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      notify2.error('Erreur lors de la suppression des baux');
    }
  }, [leasesToConfirmDelete, isDrawerOpen]);

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
      setSelectedIds(new Set(leases.map(l => l.id)));
    } else {
      setSelectedIds(new Set());
    }
  }, [leases]);

  // Gestion du tri
  const handleSort = useCallback((field: 'startDate' | 'endDate' | 'rentAmount') => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  }, [sortField]);

  // Trier les baux
  const sortedLeases = React.useMemo(() => {
    const sorted = [...leases].sort((a, b) => {
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
  }, [leases, sortField, sortOrder]);

  // Gestion des modales
  const handleModalSubmit = async (data: any) => {
    try {
      console.log('[PropertyLeasesClient] Soumission du bail:', data);
      
      const isEdit = !!data.id;
      const method = isEdit ? 'PUT' : 'POST';
      const url = isEdit ? `/api/leases/${data.id}` : '/api/leases';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Erreur API:', errorData);
        
        if (errorData.details && Array.isArray(errorData.details)) {
          const errorMessages = errorData.details.map((d: any) => `${d.field}: ${d.message}`).join('\n');
          throw new Error(`Erreur de validation:\n${errorMessages}`);
        }
        
        throw new Error(errorData.error || (isEdit ? 'Erreur lors de la mise à jour du bail' : 'Erreur lors de la création du bail'));
      }

      setIsModalOpen(false);
      setIsEditModalOpen(false);
      setSelectedLease(null);
      
      setRefreshKey(prev => prev + 1);
      
      notify2.success(isEdit ? 'Bail mis à jour avec succès' : 'Bail créé avec succès');
    } catch (error) {
      console.error(`Erreur lors de ${data.id ? 'la mise à jour' : 'la création'} du bail:`, error);
      notify2.error(error instanceof Error ? error.message : `Erreur lors de ${data.id ? 'la mise à jour' : 'la création'} du bail`);
      throw error;
    }
  };

  // Fonction pour résilier plusieurs baux
  const handleTerminateMultiple = async (leaseIds: string[]) => {
    try {
      const results = await Promise.allSettled(
        leaseIds.map(leaseId =>
          fetch(`/api/leases/${leaseId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'RÉSILIÉ' }),
          }).then(async response => {
            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || 'Erreur de résiliation');
            }
            return response.json();
          })
        )
      );

      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      if (succeeded > 0) {
        notify2.success(`${succeeded} bail${succeeded > 1 ? 'x' : ''} résilié${succeeded > 1 ? 's' : ''} avec succès. Vous pouvez maintenant les supprimer.`);
      }
      if (failed > 0) {
        notify2.error(`${failed} bail${failed > 1 ? 'x' : ''} n'ont pas pu être résilié${failed > 1 ? 's' : ''}`);
      }

      setRefreshKey(prev => prev + 1);
      loadData();
      
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
    const toDelete = leases.filter(l => selectedIds.has(l.id));
    setLeasesToConfirmDelete(toDelete);
    setShowDeleteConfirmModal(true);
  }, [leases, selectedIds]);


  return (
    <div className="space-y-6">
      {/* Header avec bouton retour */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Baux</h1>
          <p className="text-gray-600 mt-1">Baux du bien {propertyName}</p>
        </div>
        
        <PropertySubNav
          propertyId={propertyId}
          counts={{
            baux: totalCount,
          }}
        />
        
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
            {totalCount > 0
              ? `Affichage de 1 à ${sortedLeases.length} sur ${totalCount}`
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
            setRefreshKey(prev => prev + 1);
            loadData();
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

