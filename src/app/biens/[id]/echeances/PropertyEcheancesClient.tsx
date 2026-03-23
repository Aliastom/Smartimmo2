'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { notify2 } from '@/lib/notify2';
import { Plus, Edit, Trash2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Switch } from '@/components/ui/Switch';
import { Pagination } from '@/components/ui/Pagination';
import { BackToPropertyButton } from '@/components/shared/BackToPropertyButton';
import { usePropertyHeaderActions } from '@/app/biens/[id]/PropertyHeaderActionsContext';
import { EcheancesKpiBar } from '@/components/echeances/EcheancesKpiBar';
import { EcheancesCumulativeChart } from '@/components/echeances/EcheancesCumulativeChart';
import { EcheancesByTypeChart } from '@/components/echeances/EcheancesByTypeChart';
import { EcheancesRecuperablesChart } from '@/components/echeances/EcheancesRecuperablesChart';
import EcheancesFilters from '@/components/echeances/EcheancesFilters';
import { EcheanceModal } from '@/components/echeances/EcheanceModal';
import { EcheanceDrawer } from '@/components/echeances/EcheanceDrawer';
import { ConfirmDeleteEcheanceModal } from '@/components/echeances/ConfirmDeleteEcheanceModal';
import { ConfirmDeleteMultipleEcheancesModal } from '@/components/echeances/ConfirmDeleteMultipleEcheancesModal';
import { useEcheancesData } from '@/features/echeances/hooks/useEcheancesData';
import { useEcheancesKpis } from '@/features/echeances/hooks/useEcheancesKpis';
import { useEcheancesCharts } from '@/features/echeances/hooks/useEcheancesCharts';
import { getLeaseRepositoryOffline } from '@/lib/offline/repositories/LeaseRepositoryOffline';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import {
  EcheanceRecurrente,
  PERIODICITE_LABELS,
  SENS_LABELS,
  getNatureBadgeClass,
  getCategoryLabelForEcheance,
} from '@/types/echeance';
import { getNatureLabelForEcheance } from '@/lib/echeances/echeanceDisplayHelpers';
import { useEcheanceReferential } from '@/features/echeances/hooks/useEcheanceReferential';
import { resolveNatureCodeForEcheance } from '@/lib/echeances/echeanceTypeMigration';
import { EcheanceFormSchema } from '@/lib/validations/echeance';
import Link from 'next/link';

interface PropertyEcheancesClientProps {
  propertyId: string;
  propertyName: string;
}

interface Filters {
  search: string;
  type: string;
  sens: string;
  periodicite: string;
  leaseId: string;
  recuperable: string;
}

export default function PropertyEcheancesClient({ propertyId, propertyName }: PropertyEcheancesClientProps) {
  // ✅ DEV-ONLY: Log de mount/unmount pour détecter les remounts
  const mountId = useRef(Math.random().toString(36).substring(7));
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[PropertyEcheancesClient] 🟢 MOUNT (id: ${mountId.current}, propertyId: ${propertyId})`);
      return () => {
        console.log(`[PropertyEcheancesClient] 🔴 UNMOUNT (id: ${mountId.current}, propertyId: ${propertyId})`);
      };
    }
  }, [propertyId]);

  // ✅ DEV-ONLY: Compteur de renders
  if (process.env.NODE_ENV === 'development') {
    console.count('PropertyEcheancesClient render');
  }

  const { organizationId } = useCurrentOrganization();
  const { natures, categories, getDefaultCategoryId } = useEcheanceReferential('normal');

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

  // États pour la période (format YYYY) - Par défaut : 5 années à venir
  const now = new Date();
  const currentYear = now.getFullYear();
  const [periodStart, setPeriodStart] = useState(currentYear.toString());
  const [periodEnd, setPeriodEnd] = useState((currentYear + 4).toString());
  const [viewMode, setViewMode] = useState<'monthly' | 'yearly'>('yearly');

  // État pour le filtre KPI actif
  const [activeKpiFilter, setActiveKpiFilter] = useState<string | null>(null);

  // États des filtres (sans propertyId car fixe)
  const [filters, setFilters] = useState<Filters>({
    search: '',
    type: '',
    sens: '',
    periodicite: '',
    leaseId: '',
    recuperable: '',
  });

  // État pour la pagination
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
  });

  // ✅ APP-SHELL: Charger les échéances depuis IndexedDB avec filtre propertyId
  const {
    echeances: allEcheances,
    properties,
    leases: allLeases,
    totalCount,
    pagination: dataPagination,
    loading: isLoading,
  } = useEcheancesData({
    mode: 'app-shell',
    propertyId, // ✅ Passer propertyId pour filtrer les events
    filters: {
      propertyId, // ✅ Filtrer par bien
      search: '',
      type: '',
      sens: '',
      periodicite: '',
      leaseId: '',
      recuperable: '',
    },
    activeKpiFilter,
    page: pagination.page,
    pageSize: pagination.limit,
  });

  // ✅ APP-SHELL: Filtrer les échéances en mémoire selon les filtres UI
  const filteredEcheances = useMemo(() => {
    const perfStart = process.env.NODE_ENV === 'development' ? performance.now() : 0;
    
    let filtered = allEcheances.filter(echeance => {
      // Filtre de recherche
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        if (!echeance.label.toLowerCase().includes(searchLower)) return false;
      }

      // Filtre de type
      if (filters.type && echeance.type !== filters.type) return false;

      // Filtre de sens
      if (filters.sens && echeance.sens !== filters.sens) return false;

      // Filtre de périodicité
      if (filters.periodicite && echeance.periodicite !== filters.periodicite) return false;

      // Filtre de bail
      if (filters.leaseId && echeance.Lease?.id !== filters.leaseId) return false;

      // Filtre récupérable
      if (filters.recuperable === 'true' && !echeance.recuperable) return false;
      if (filters.recuperable === 'false' && echeance.recuperable) return false;

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

    if (process.env.NODE_ENV === 'development') {
      const perfEnd = performance.now();
      console.log(`[PropertyEcheancesClient] ⏱️ Filtrage échéances: ${(perfEnd - perfStart).toFixed(2)}ms (${filtered.length}/${allEcheances.length})`);
    }

    return filtered;
  }, [allEcheances, filters, activeKpiFilter]);

  // ✅ APP-SHELL: Charger les baux depuis IndexedDB (une seule fois, données de référence)
  const [leases, setLeases] = useState<any[]>([]);
  useEffect(() => {
    if (!organizationId) return;
    
    const loadLeases = async () => {
      try {
        const leaseRepo = getLeaseRepositoryOffline();
        const allLeasesData = await leaseRepo.getAll(organizationId, {});
        // Filtrer par propertyId
        const propertyLeases = allLeasesData.filter(lease => lease.propertyId === propertyId);
        setLeases(propertyLeases);
      } catch (error) {
        console.error('Erreur lors du chargement des baux:', error);
      }
    };

    loadLeases();
  }, [organizationId, propertyId]); // ✅ Chargé une seule fois, pas rechargé à chaque filtre

  // ✅ APP-SHELL: Charger les KPIs en mode app-shell (filtrés par propertyId)
  const { data: kpisData, isLoading: kpisLoading } = useEcheancesKpis({ 
    mode: 'app-shell',
    propertyId, // Filtré par bien
      });

  // ✅ APP-SHELL: Charger les graphiques en mode app-shell (filtrés par propertyId)
  const { data: chartsData, isLoading: chartsLoading } = useEcheancesCharts({
    mode: 'app-shell',
    periodStart,
    periodEnd,
    viewMode,
    propertyId, // Filtré par bien
  });

  const kpis = kpisData || { revenusAnnuels: 0, chargesAnnuelles: 0, totalEcheances: 0, echeancesActives: 0 };
  const charts = chartsData || { cumulative: [], byType: [], recuperables: { recuperables: 0, nonRecuperables: 0 } };

  // Synchroniser la pagination
  useEffect(() => {
    if (dataPagination) {
      setPagination(prev => ({
        ...prev,
        total: dataPagination.total || filteredEcheances.length,
        pages: dataPagination.pages || Math.ceil(filteredEcheances.length / prev.limit),
      }));
    }
  }, [dataPagination, filteredEcheances.length]);

  // ✅ APP-SHELL: Gestion des filtres (en mémoire uniquement, pas de fetch)
  const handleFiltersChange = useCallback((newFilters: Filters) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[PropertyEcheancesClient] 🔄 Changement de filtre (id: ${mountId.current})`, newFilters);
    }
    setFilters(newFilters);
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  // ✅ APP-SHELL: Gestion du filtre KPI (en mémoire uniquement)
  const handleKpiFilterChange = useCallback((filterKey: string | null) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[PropertyEcheancesClient] 🔄 Changement filtre KPI (id: ${mountId.current})`, filterKey);
    }
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
      sens: '',
      periodicite: '',
      leaseId: '',
      recuperable: '',
    });
    setActiveKpiFilter(null);
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  // Handlers de période
  const handlePeriodChange = (start: string, end: string) => {
    setPeriodStart(start);
    setPeriodEnd(end);
  };

  // CRUD Handlers
  const handleCreate = useCallback(() => {
    setSelectedEcheance(null);
    setModalMode('create');
    setIsModalOpen(true);
  }, []);

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

  // ✅ APP-SHELL: Soumission via repository offline (local-first)
  const handleFormSubmit = async (data: EcheanceFormSchema) => {
    try {
      // TODO: Implémenter la création/modification via repository offline
      // Pour l'instant, on émet juste l'événement de refresh
      // La création/modification sera gérée par EcheanceModal
      
      // ✅ Émettre un événement ciblé avec payload scope + propertyId
      window.dispatchEvent(new CustomEvent('deadlines:refresh', { 
        detail: { scope: 'property', propertyId, reason: 'crud' } 
      }));
      
      setIsModalOpen(false);
      notify2.success(modalMode === 'edit' ? 'Échéance modifiée avec succès' : 'Échéance créée avec succès');
    } catch (error: any) {
      notify2.error('Erreur', error.message);
    }
  };

  // ✅ APP-SHELL: Refresh via événement ciblé avec payload
  const handleConfirmDelete = async () => {
    window.dispatchEvent(new CustomEvent('deadlines:refresh', { 
      detail: { scope: 'property', propertyId, reason: 'delete' } 
    }));
  };

  const handleConfirmDeleteMultiple = async () => {
    window.dispatchEvent(new CustomEvent('deadlines:refresh', { 
      detail: { scope: 'property', propertyId, reason: 'delete_multiple' } 
    }));
    setSelectedEcheanceIds([]);
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
    setSelectedEcheanceIds(checked ? filteredEcheances.map((e) => e.id) : []);
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

  const { setActions } = usePropertyHeaderActions();

  // Mémoriser les actions pour éviter les re-renders inutiles
  const headerActions = useMemo(() => (
    <>
      <Button onClick={handleCreate}>
        <Plus className="h-4 w-4 mr-2" />
        Nouvelle échéance
      </Button>
      <BackToPropertyButton propertyId={propertyId} />
    </>
  ), [propertyId, handleCreate]);

  // Définir les actions dans le header
  React.useEffect(() => {
    setActions(headerActions);
    
    return () => {
      setActions(null);
    };
  }, [setActions, headerActions]);

  return (
    <div className="space-y-6">

      <div className="space-y-6">
        {/* Graphiques - Ligne 1 : 2+1+1 colonnes */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <EcheancesCumulativeChart
            data={charts.cumulative}
            isLoading={chartsLoading}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />
          <EcheancesByTypeChart
            data={charts.byType}
            isLoading={chartsLoading}
          />
          <EcheancesRecuperablesChart
            data={charts.recuperables}
            isLoading={chartsLoading}
          />
        </div>

        {/* KPIs - Cartes filtrantes */}
        <EcheancesKpiBar
          kpis={kpis}
          activeFilter={activeKpiFilter}
          onFilterChange={handleKpiFilterChange}
          isLoading={kpisLoading}
        />

        {/* Filtres - Tout dans le même panel (sans filtre Bien car déjà fixé) */}
        <EcheancesFilters
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onResetFilters={handleResetFilters}
          properties={[]}
          leases={leases}
          periodStart={periodStart}
          periodEnd={periodEnd}
          onPeriodChange={handlePeriodChange}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          hidePropertyFilter={true} // Masquer le filtre Bien
        />

        {/* Tableau */}
        <div className="bg-white rounded-xl border border-gray-200">
          {/* Header du tableau */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Échéances de ce bien</h3>
              <div className="text-sm text-gray-600">
                {filteredEcheances.length} échéance{filteredEcheances.length > 1 ? 's' : ''}
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

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedEcheanceIds.length === filteredEcheances.length && filteredEcheances.length > 0}
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bail</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dates</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actif</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i}>
                      <td colSpan={11} className="px-4 py-3">
                        <div className="h-12 bg-gray-100 rounded animate-pulse"></div>
                      </td>
                    </tr>
                  ))
                ) : filteredEcheances.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center text-gray-500">
                      Aucune échéance pour ce bien
                    </td>
                  </tr>
                ) : (
                  filteredEcheances.map((echeance) => (
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
                        {echeance.Lease ? `${echeance.Lease.type} - ${echeance.Lease.status}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatDate(echeance.startAt)}
                        {echeance.endAt && ` → ${formatDate(echeance.endAt)}`}
                      </td>
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <Switch
                          checked={echeance.isActive}
                          onCheckedChange={async (checked) => {
                            try {
                              // TODO: Implémenter la mise à jour via repository offline
                              // Pour l'instant, on émet juste l'événement de refresh
                              window.dispatchEvent(new CustomEvent('deadlines:refresh', { 
                                detail: { scope: 'property', propertyId, reason: 'update' } 
                              }));
                            } catch (error) {
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
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="p-4 border-t border-gray-200">
              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.pages}
                onPageChange={(page) => setPagination((prev) => ({ ...prev, page }))}
              />
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
        properties={[{ id: propertyId, name: propertyName }]} // Un seul bien
        leases={leases}
        mode={modalMode}
        defaultPropertyId={propertyId}
      />

      {/* Drawer lecture seule */}
      <EcheanceDrawer
        echeance={selectedEcheance}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onEdit={handleEdit}
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
        propertyId={propertyId}
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

