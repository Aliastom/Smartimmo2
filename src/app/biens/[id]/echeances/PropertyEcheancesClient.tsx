'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { notify2 } from '@/lib/notify2';
import { Plus, Edit, Trash2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Switch } from '@/components/ui/Switch';
import { Pagination } from '@/components/ui/Pagination';
import { BackToPropertyButton } from '@/components/shared/BackToPropertyButton';
import { PropertySubNav } from '@/components/bien/PropertySubNav';
import { EcheancesKpiBar } from '@/components/echeances/EcheancesKpiBar';
import { EcheancesCumulativeChart } from '@/components/echeances/EcheancesCumulativeChart';
import { EcheancesByTypeChart } from '@/components/echeances/EcheancesByTypeChart';
import { EcheancesRecuperablesChart } from '@/components/echeances/EcheancesRecuperablesChart';
import EcheancesFilters from '@/components/echeances/EcheancesFilters';
import { EcheanceModal } from '@/components/echeances/EcheanceModal';
import { EcheanceDrawer } from '@/components/echeances/EcheanceDrawer';
import { ConfirmDeleteEcheanceModal } from '@/components/echeances/ConfirmDeleteEcheanceModal';
import { ConfirmDeleteMultipleEcheancesModal } from '@/components/echeances/ConfirmDeleteMultipleEcheancesModal';
import { useEcheancesKpis } from '@/hooks/useEcheancesKpis';
import { useEcheancesCharts } from '@/hooks/useEcheancesCharts';
import {
  EcheanceRecurrente,
  ECHEANCE_TYPE_LABELS,
  PERIODICITE_LABELS,
  SENS_LABELS,
  TYPE_COLORS,
} from '@/types/echeance';
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
  const router = useRouter();
  const queryClient = useQueryClient();

  // États principaux
  const [echeances, setEcheances] = useState<EcheanceRecurrente[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

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

  // État pour forcer le rafraîchissement
  const [refreshKey, setRefreshKey] = useState(0);

  // Données de référence (baux pour ce bien uniquement)
  const [leases, setLeases] = useState<any[]>([]);

  // Charger les KPIs (tous les biens)
  const { data: kpisData, isLoading: kpisLoading } = useEcheancesKpis();

  // Charger les graphiques (filtrés par ce bien)
  const { data: chartsData, isLoading: chartsLoading } = useEcheancesCharts({
    periodStart,
    periodEnd,
    viewMode,
    propertyId, // Filtré par bien
  });

  // Charger les baux de ce bien
  useEffect(() => {
    const loadLeases = async () => {
      try {
        const response = await fetch(`/api/leases?propertyId=${propertyId}`);
        const data = await response.json();
        const leasesArray = data.items || data.data || [];
        setLeases(
          leasesArray.map((lease: any) => ({
            ...lease,
            propertyId: lease.propertyId || propertyId,
          }))
        );
      } catch (error) {
        console.error('Erreur lors du chargement des baux:', error);
      }
    };

    loadLeases();
  }, [propertyId]);

  // Chargement des échéances (toujours filtrées par propertyId)
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        propertyId, // Toujours filtré par ce bien
      });

      // Ajouter les autres filtres
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });

      // Appliquer le filtre KPI actif
      if (activeKpiFilter === 'revenus') {
        params.append('sens', 'CREDIT');
      } else if (activeKpiFilter === 'charges') {
        params.append('sens', 'DEBIT');
      } else if (activeKpiFilter === 'actives') {
        params.append('active', '1');
      }

      // Ajouter la pagination
      params.append('page', pagination.page.toString());
      params.append('pageSize', pagination.limit.toString());

      // Filtrer par actif par défaut
      if (!params.has('active') && activeKpiFilter !== 'total') {
        params.append('active', '1');
      }

      const response = await fetch(`/api/echeances/list?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors du chargement');
      }

      setEcheances(data.items || []);
      setPagination({
        page: data.page || 1,
        limit: data.pageSize || 50,
        total: data.total || 0,
        pages: data.totalPages || 1,
      });
      setTotalCount(data.total || 0);
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
      notify2.error('Erreur lors du chargement des données');
    } finally {
      setIsLoading(false);
    }
  }, [propertyId, filters, pagination.page, pagination.limit, activeKpiFilter]);

  // Chargement des données quand les filtres changent
  useEffect(() => {
    loadData();
  }, [loadData, refreshKey]);

  // Gestion des filtres
  const handleFiltersChange = useCallback((newFilters: Filters) => {
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
      // Forcer le propertyId à celui du bien actuel
      const payload = {
        ...data,
        propertyId,
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
    queryClient.invalidateQueries({ queryKey: ['echeances-kpis'] });
    queryClient.invalidateQueries({ queryKey: ['echeances-charts'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-patrimoine'] });
    queryClient.invalidateQueries({ queryKey: ['patrimoine'] });
    setRefreshKey((k) => k + 1);
  };

  const handleConfirmDeleteMultiple = async () => {
    queryClient.invalidateQueries({ queryKey: ['echeances-kpis'] });
    queryClient.invalidateQueries({ queryKey: ['echeances-charts'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-patrimoine'] });
    queryClient.invalidateQueries({ queryKey: ['patrimoine'] });
    setSelectedEcheanceIds([]);
    setRefreshKey((k) => k + 1);
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
    setSelectedEcheanceIds(checked ? echeances.map((e) => e.id) : []);
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

  return (
    <div className="space-y-6">
      {/* Header avec menu intégré - Layout grid 3 colonnes comme Transactions */}
      <div className="grid grid-cols-3 items-center mb-6 gap-6">
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900 border-b-4 pb-2 inline-block" style={{ borderColor: '#86efac' }}>
            Échéances - {propertyName}
          </h1>
          <p className="text-gray-600 mt-2">Charges et revenus récurrents pour ce bien</p>
        </div>
        
        <div className="flex justify-center">
          <PropertySubNav
            propertyId={propertyId}
            counts={{
              echeances: totalCount,
            }}
          />
        </div>
        
        <div className="flex items-center gap-3 justify-end">
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle échéance
          </Button>
          <BackToPropertyButton propertyId={propertyId} />
        </div>
      </div>

      <div className="space-y-6">
        {/* Graphiques - Ligne 1 : 2+1+1 colonnes */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
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
                {totalCount} échéance{totalCount > 1 ? 's' : ''}
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
                      checked={selectedEcheanceIds.length === echeances.length && echeances.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Libellé</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
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
                      <td colSpan={10} className="px-4 py-3">
                        <div className="h-12 bg-gray-100 rounded animate-pulse"></div>
                      </td>
                    </tr>
                  ))
                ) : echeances.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-gray-500">
                      Aucune échéance pour ce bien
                    </td>
                  </tr>
                ) : (
                  echeances.map((echeance) => (
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
                        <Badge className={TYPE_COLORS[echeance.type]}>
                          {ECHEANCE_TYPE_LABELS[echeance.type]}
                        </Badge>
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
                              }
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

