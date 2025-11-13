'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { notify2 } from '@/lib/notify2';
import { Plus, Edit, Trash2, Eye, Copy, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Switch } from '@/components/ui/Switch';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { LoansKpiBar } from '@/components/loans/LoansKpiBar';
import { LoansCRDTimelineChart } from '@/components/loans/LoansCRDTimelineChart';
import { LoansByPropertyChart } from '@/components/loans/LoansByPropertyChart';
import { LoansTopCostlyChart } from '@/components/loans/LoansTopCostlyChart';
import { LoansFilters } from '@/components/loans/LoansFilters';
import { LoanForm } from '@/components/loans/LoanForm';
import { LoanDrawer } from '@/components/loans/LoanDrawer';
import { ConfirmDeleteLoanModal } from '@/components/loans/ConfirmDeleteLoanModal';
import { ConfirmDeleteMultipleLoansModal } from '@/components/loans/ConfirmDeleteMultipleLoansModal';
import { useLoansCharts } from '@/hooks/useLoansCharts';
import Link from 'next/link';

export interface Loan {
  id: string;
  propertyId: string;
  propertyName: string;
  label: string;
  principal: number;
  annualRatePct: number;
  durationMonths: number;
  defermentMonths: number;
  insurancePct: number | null;
  startDate: string;
  isActive: boolean;
}

interface Filters {
  search: string;
  propertyId: string;
  active: string;
}

export default function LoansClient() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // États principaux
  const [loans, setLoans] = useState<Loan[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // États des modals et drawer
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'duplicate'>('create');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [loanToDelete, setLoanToDelete] = useState<Loan | null>(null);

  // États pour la sélection multiple
  const [selectedLoanIds, setSelectedLoanIds] = useState<string[]>([]);
  const [showDeleteMultipleModal, setShowDeleteMultipleModal] = useState(false);

  // États pour la période
  const now = new Date();
  const [periodStart, setPeriodStart] = useState(`${now.getFullYear()}-01`);
  const [periodEnd, setPeriodEnd] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);

  // État pour le filtre KPI actif
  const [activeKpiFilter, setActiveKpiFilter] = useState<string | null>(null);

  // États des filtres
  const [filters, setFilters] = useState<Filters>({
    search: '',
    propertyId: '',
    active: '1',
  });

  // État pour forcer le rafraîchissement
  const [refreshKey, setRefreshKey] = useState(0);

  // Charger les graphiques et KPIs
  const { data: chartsData, isLoading: chartsLoading } = useLoansCharts({
    from: periodStart,
    to: periodEnd,
    propertyId: filters.propertyId || undefined,
  });

  // Calculer les KPIs depuis l'API
  const [kpis, setKpis] = useState({ totalPrincipal: 0, totalCRD: 0, monthlyPaymentAvg: 0, activeLoansCount: 0 });
  const [kpisLoading, setKpisLoading] = useState(true);

  useEffect(() => {
    const loadKpis = async () => {
      setKpisLoading(true);
      try {
        const params = new URLSearchParams();
        params.append('from', periodStart);
        params.append('to', periodEnd);
        if (filters.propertyId) params.append('propertyId', filters.propertyId);
        params.append('pageSize', '1');

        const response = await fetch(`/api/loans?${params.toString()}`);
        const data = await response.json();
        setKpis(data.kpis || { totalPrincipal: 0, totalCRD: 0, monthlyPaymentAvg: 0, activeLoansCount: 0 });
      } catch (error) {
        console.error('Erreur:', error);
      } finally {
        setKpisLoading(false);
      }
    };
    loadKpis();
  }, [periodStart, periodEnd, filters.propertyId, refreshKey]);

  // Charger les données de référence
  useEffect(() => {
    const loadReferenceData = async () => {
      try {
        const response = await fetch('/api/properties?limit=1000');
        const data = await response.json();
        setProperties(data.data || []);
      } catch (error) {
        console.error('Erreur lors du chargement des propriétés:', error);
      }
    };
    loadReferenceData();
  }, []);

  // Chargement des prêts
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();

      // Ajouter les filtres
      if (filters.search) params.append('q', filters.search);
      if (filters.propertyId) params.append('propertyId', filters.propertyId);
      if (filters.active) params.append('active', filters.active);

      // Appliquer le filtre KPI actif
      if (activeKpiFilter === 'actifs') {
        params.set('active', '1');
      }

      params.append('pageSize', '100');

      const response = await fetch(`/api/loans?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors du chargement');
      }

      setLoans(data.items || []);
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
      notify2.error('Erreur lors du chargement des données');
    } finally {
      setIsLoading(false);
    }
  }, [filters, activeKpiFilter]);

  useEffect(() => {
    loadData();
  }, [loadData, refreshKey]);

  // Gestion des filtres
  const handleFiltersChange = useCallback((newFilters: Filters) => {
    setFilters(newFilters);
  }, []);

  const handleKpiFilterChange = useCallback((filterKey: string | null) => {
    if (filterKey === activeKpiFilter) {
      setActiveKpiFilter(null);
    } else {
      setActiveKpiFilter(filterKey);
    }
  }, [activeKpiFilter]);

  const handleResetFilters = useCallback(() => {
    setFilters({
      search: '',
      propertyId: '',
      active: '1',
    });
    setActiveKpiFilter(null);
  }, []);

  const handlePeriodChange = (start: string, end: string) => {
    setPeriodStart(start);
    setPeriodEnd(end);
  };

  // CRUD Handlers
  const handleCreate = () => {
    setSelectedLoan(null);
    setModalMode('create');
    setIsModalOpen(true);
  };

  const handleEdit = (loan: Loan) => {
    setSelectedLoan(loan);
    setModalMode('edit');
    setIsModalOpen(true);
    setIsDrawerOpen(false);
  };

  const handleDuplicate = (loan: Loan) => {
    setSelectedLoan({ ...loan, id: undefined as any, label: `${loan.label} (copie)` });
    setModalMode('create');
    setIsModalOpen(true);
    setIsDrawerOpen(false);
  };

  const handleDelete = (loan: Loan) => {
    setLoanToDelete(loan);
    setShowDeleteModal(true);
    setIsDrawerOpen(false);
  };

  const handleRowClick = (loan: Loan) => {
    setSelectedLoan(loan);
    setIsDrawerOpen(true);
  };

  const handleFormSubmit = async (data: any) => {
    try {
      const url = data.id ? `/api/loans/${data.id}` : '/api/loans';
      const method = data.id ? 'PATCH' : 'POST';

      const payload = {
        propertyId: data.propertyId,
        label: data.label,
        principal: data.principal,
        annualRatePct: data.annualRatePct,
        durationMonths: data.durationMonths,
        defermentMonths: data.defermentMonths,
        insurancePct: data.insurancePct,
        feesUpfront: data.feesUpfront,
        startDate: new Date(data.startDate).toISOString(),
        isActive: data.isActive,
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors de l\'enregistrement');
      }

      notify2.success(data.id ? 'Prêt modifié avec succès' : 'Prêt créé avec succès');

      // Invalider les queries React Query
      queryClient.invalidateQueries({ queryKey: ['loans-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['loans-charts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-patrimoine'] });

      setIsModalOpen(false);
      setRefreshKey((k) => k + 1);
    } catch (error: any) {
      notify2.error('Erreur', error.message);
    }
  };

  const handleConfirmDelete = async () => {
    queryClient.invalidateQueries({ queryKey: ['loans-kpis'] });
    queryClient.invalidateQueries({ queryKey: ['loans-charts'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-patrimoine'] });
    setRefreshKey((k) => k + 1);
  };

  const handleConfirmDeleteMultiple = async () => {
    queryClient.invalidateQueries({ queryKey: ['loans-kpis'] });
    queryClient.invalidateQueries({ queryKey: ['loans-charts'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-patrimoine'] });
    setSelectedLoanIds([]);
    setRefreshKey((k) => k + 1);
  };

  const handleDeleteMultiple = () => {
    if (selectedLoanIds.length === 0) {
      notify2.warning('Aucun prêt sélectionné');
      return;
    }
    setShowDeleteMultipleModal(true);
  };

  // Sélection
  const handleSelectLoan = (id: string) => {
    setSelectedLoanIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedLoanIds(checked ? loans.map((l) => l.id) : []);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const charts = chartsData || { crdTimeline: [], crdByProperty: [], topCostlyLoans: [] };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Pas de marge */}
      <SectionTitle
        title="Prêts Immobiliers"
        description="Gérez vos prêts et suivez leur amortissement"
        actions={
          <Button onClick={handleCreate} size="lg">
            <Plus className="h-5 w-5 mr-2" />
            Nouveau prêt
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {/* Graphiques - Ligne 1 : 2+1+1 colonnes */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <LoansCRDTimelineChart
            data={charts.crdTimeline}
            isLoading={chartsLoading}
          />
          <LoansByPropertyChart
            data={charts.crdByProperty}
            isLoading={chartsLoading}
          />
          <LoansTopCostlyChart
            data={charts.topCostlyLoans}
            isLoading={chartsLoading}
          />
        </div>

        {/* KPIs - Cartes filtrantes */}
        <LoansKpiBar
          kpis={kpis}
          activeFilter={activeKpiFilter}
          onFilterChange={handleKpiFilterChange}
          isLoading={kpisLoading}
        />

        {/* Filtres */}
        <LoansFilters
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onResetFilters={handleResetFilters}
          properties={properties}
          periodStart={periodStart}
          periodEnd={periodEnd}
          onPeriodChange={handlePeriodChange}
        />

        {/* Tableau */}
        <div className="bg-white rounded-xl border border-gray-200">
          {/* Header du tableau */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Prêts immobiliers</h3>
              <div className="text-sm text-gray-600">
                {loans.length} prêt{loans.length > 1 ? 's' : ''} au total
              </div>
            </div>

            {/* Sélection multiple */}
            {selectedLoanIds.length > 0 && (
              <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <CheckCircle className="h-5 w-5 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">
                  {selectedLoanIds.length} prêt(s) sélectionné(s)
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
                      checked={selectedLoanIds.length === loans.length && loans.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Libellé</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bien</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Capital Initial</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Mensualité</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Taux</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Durée</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date de fin</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assurance</th>
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
                ) : loans.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-gray-500">
                      Aucun prêt trouvé
                    </td>
                  </tr>
                ) : (
                  loans.map((loan) => (
                    <tr
                      key={loan.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleRowClick(loan)}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedLoanIds.includes(loan.id)}
                          onChange={() => handleSelectLoan(loan.id)}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{loan.label}</td>
                      <td className="px-4 py-3 text-sm">
                        <Link
                          href={`/biens/${loan.propertyId}/loans`}
                          className="text-primary-600 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {loan.propertyName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                        {formatCurrency(loan.principal)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-cyan-600">
                        {loan.monthlyPayment ? formatCurrency(loan.monthlyPayment) : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600">{loan.annualRatePct}%</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600">{loan.durationMonths} mois</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{loan.endDate ? formatDate(loan.endDate) : '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {loan.insurancePct ? `${loan.insurancePct}%/an` : '—'}
                      </td>
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <Switch
                          checked={loan.isActive}
                          onCheckedChange={async (checked) => {
                            try {
                              const response = await fetch(`/api/loans/${loan.id}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ isActive: checked }),
                              });
                              if (response.ok) {
                                queryClient.invalidateQueries({ queryKey: ['loans-kpis'] });
                                queryClient.invalidateQueries({ queryKey: ['loans-charts'] });
                                queryClient.invalidateQueries({ queryKey: ['dashboard-patrimoine'] });
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
                              handleEdit(loan);
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
                              handleDelete(loan);
                            }}
                            title="Archiver"
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
        </div>
      </div>

      {/* Modal de formulaire */}
      <LoanForm
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        properties={properties}
        initialData={selectedLoan || undefined}
        onSubmit={handleFormSubmit}
        mode={modalMode === 'duplicate' ? 'create' : modalMode}
      />

      {/* Drawer lecture seule */}
      <LoanDrawer
        loan={selectedLoan}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onEdit={handleEdit}
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
      />

      {/* Modal suppression simple */}
      <ConfirmDeleteLoanModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleConfirmDelete}
        loanId={loanToDelete?.id || ''}
        loanLabel={loanToDelete?.label}
      />

      {/* Modal suppression multiple */}
      <ConfirmDeleteMultipleLoansModal
        isOpen={showDeleteMultipleModal}
        onClose={() => setShowDeleteMultipleModal(false)}
        onConfirm={handleConfirmDeleteMultiple}
        loanIds={selectedLoanIds}
      />
    </div>
  );
}
