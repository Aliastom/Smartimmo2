'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { notify2 } from '@/lib/notify2';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Pagination } from '@/components/ui/Pagination';
import { TransactionModal } from '@/components/transactions/TransactionModalV2';
import TransactionFilters from '@/components/transactions/TransactionFilters';
import TransactionsTable from '@/components/transactions/TransactionsTable';
import TransactionDrawer from '@/components/transactions/TransactionDrawer';
import { ConfirmDeleteTransactionModal } from '@/components/transactions/ConfirmDeleteTransactionModal';
import { ConfirmDeleteMultipleTransactionsModal } from '@/components/transactions/ConfirmDeleteMultipleTransactionsModal';
import { TransactionsKpiBar } from '@/components/transactions/TransactionsKpiBar';
import { TransactionsCumulativeChart } from '@/components/transactions/TransactionsCumulativeChart';
import { TransactionsByCategoryChart } from '@/components/transactions/TransactionsByCategoryChart';
import { TransactionsIncomeExpenseChart } from '@/components/transactions/TransactionsIncomeExpenseChart';
import { useTransactionsKpis } from '@/hooks/useTransactionsKpis';
import { useTransactionsCharts } from '@/hooks/useTransactionsCharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

interface Transaction {
  id: string;
  date: string;
  label: string;
  Property: {
    id: string;
    name: string;
    address: string;
  };
  lease?: {
    id: string;
    status: string;
  };
  tenant?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  nature: {
    id: string;
    label: string;
    type: 'RECETTE' | 'DEPENSE';
  };
  Category: {
    id: string;
    label: string;
  };
  amount: number;
  reference?: string;
  paymentDate?: string;
  paymentMethod?: string;
  paidAt?: string;
  method?: string;
  notes?: string;
  accountingMonth?: string;
  monthsCovered?: number;
  autoDistribution?: boolean;
  hasDocument: boolean;
  documentsCount: number;
  status: 'rapprochee' | 'nonRapprochee';
  rapprochementStatus?: string;
  dateRapprochement?: string | null;
  bankRef?: string | null;
  createdAt?: string;
  updatedAt?: string;
  documents?: Array<{
    id: string;
    name: string;
    type: string;
    createdAt: string;
  }>;
  // Champs de série pour afficher le badge
  parentTransactionId?: string;
  moisIndex?: number;
  moisTotal?: number;
  // Gestion déléguée
  autoSource?: string | null;
  isAuto?: boolean;
  managementCompanyId?: string | null;
}

interface Filters {
  search: string;
  propertyId: string;
  leaseId: string;
  tenantId: string;
  natureId: string;
  categoryId: string;
  amountMin: string;
  amountMax: string;
  dateFrom: string;
  dateTo: string;
  status: string;
  hasDocument: string;
  includeManagementFees: boolean;
  groupByParent: boolean;
  includeArchived: boolean;  // Inclure les biens archivés
}

export default function TransactionsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // États principaux
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  // États des modals et drawer
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [showDeleteTransactionModal, setShowDeleteTransactionModal] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
  const [transactionHasDocuments, setTransactionHasDocuments] = useState(false);
  
  // États pour la sélection multiple
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<string[]>([]);
  const [showDeleteMultipleModal, setShowDeleteMultipleModal] = useState(false);
  const [transactionsToDelete, setTransactionsToDelete] = useState<Transaction[]>([]);

  // États pour la période (format YYYY-MM)
  const now = new Date();
  const [periodStart, setPeriodStart] = useState(`${now.getFullYear()}-01`);
  const [periodEnd, setPeriodEnd] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);

  // État pour le filtre KPI actif (par défaut: 'solde' = vue globale)
  const [activeKpiFilter, setActiveKpiFilter] = useState<string | null>('solde');

  // États des filtres
  const [filters, setFilters] = useState<Filters>({
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
    status: '',
    hasDocument: '',
    includeManagementFees: true,
    groupByParent: true, // ⚙️ GESTION DÉLÉGUÉE: Activer le groupement parent/enfant par défaut
    includeArchived: false // Ne pas inclure les biens archivés par défaut
  });

  // États des données de référence (données complètes)
  const [allProperties, setAllProperties] = useState<any[]>([]);
  const [allLeases, setAllLeases] = useState<any[]>([]);
  const [allTenants, setAllTenants] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  
  // État pour forcer le rafraîchissement des KPI et graphiques
  const [refreshKey, setRefreshKey] = useState(0);

  // Filtrer les données de référence en fonction des sélections (interdépendance)
  const properties = React.useMemo(() => {
    if (!filters.tenantId && !filters.leaseId) return allProperties;
    
    // Si un locataire est sélectionné, filtrer les biens qui ont ce locataire
    if (filters.tenantId) {
      const relatedLeases = allLeases.filter(l => l.tenantId === filters.tenantId);
      const propertyIds = relatedLeases.map(l => l.propertyId);
      return allProperties.filter(p => propertyIds.includes(p.id));
    }
    
    // Si un bail est sélectionné, filtrer les biens liés
    if (filters.leaseId) {
      const lease = allLeases.find(l => l.id === filters.leaseId);
      if (lease) {
        return allProperties.filter(p => p.id === lease.propertyId);
      }
    }
    
    return allProperties;
  }, [allProperties, allLeases, filters.tenantId, filters.leaseId]);

  const leases = React.useMemo(() => {
    if (!filters.propertyId && !filters.tenantId) return allLeases;
    
    let filtered = allLeases;
    
    // Si un bien est sélectionné, filtrer les baux de ce bien
    if (filters.propertyId) {
      filtered = filtered.filter(l => l.propertyId === filters.propertyId);
    }
    
    // Si un locataire est sélectionné, filtrer les baux de ce locataire
    if (filters.tenantId) {
      filtered = filtered.filter(l => l.tenantId === filters.tenantId);
    }
    
    return filtered;
  }, [allLeases, filters.propertyId, filters.tenantId]);

  const tenants = React.useMemo(() => {
    if (!filters.propertyId && !filters.leaseId) return allTenants;
    
    // Si un bien est sélectionné, filtrer les locataires qui ont un bail sur ce bien
    if (filters.propertyId) {
      const relatedLeases = allLeases.filter(l => l.propertyId === filters.propertyId);
      const tenantIds = relatedLeases.map(l => l.tenantId);
      return allTenants.filter(t => tenantIds.includes(t.id));
    }
    
    // Si un bail est sélectionné, filtrer le locataire de ce bail
    if (filters.leaseId) {
      const lease = allLeases.find(l => l.id === filters.leaseId);
      if (lease) {
        return allTenants.filter(t => t.id === lease.tenantId);
      }
    }
    
    return allTenants;
  }, [allTenants, allLeases, filters.propertyId, filters.leaseId]);

  // Charger les KPI avec les hooks (seulement période et refreshKey, pas les autres filtres)
  const { kpis, isLoading: kpisLoading } = useTransactionsKpis({
    periodStart,
    periodEnd,
    refreshKey, // Seul le refreshKey force un rechargement
  });

  // Charger les graphiques avec les hooks (seulement période et refreshKey)
  const { data: chartsData, isLoading: chartsLoading } = useTransactionsCharts({
    periodStart,
    periodEnd,
    refreshKey, // Seul le refreshKey force un rechargement
  });

  // Nettoyer l'URL au montage (sans toucher aux filtres)
  useEffect(() => {
    // Nettoyer l'URL si elle contient des filtres parasites
    const hasFilters = searchParams.toString().length > 0;
    if (hasFilters) {
      router.replace('/transactions', { scroll: false });
    }
  }, []); // Exécuter une seule fois au montage

  // Chargement des données de référence
  useEffect(() => {
    const loadReferenceData = async () => {
      try {
        // Construire les paramètres pour les properties en fonction du filtre includeArchived
        const propertiesParams = new URLSearchParams();
        if (filters.includeArchived) {
          propertiesParams.append('includeArchived', 'true');
        }
        
        const [propertiesRes, leasesRes, tenantsRes, categoriesRes] = await Promise.all([
          fetch(`/api/properties?${propertiesParams.toString()}`),
          fetch('/api/leases'),
          fetch('/api/tenants'),
          fetch('/api/accounting/categories')
        ]);

        const [propertiesData, leasesData, tenantsData, categoriesData] = await Promise.all([
          propertiesRes.json(),
          leasesRes.json(),
          tenantsRes.json(),
          categoriesRes.json()
        ]);

        // Extraire les données si elles sont paginées et les stocker dans les états "all"
        setAllProperties(Array.isArray(propertiesData) ? propertiesData : propertiesData.data || []);
        // Pour les leases, l'API retourne { items: [], total, page, limit }
        setAllLeases(Array.isArray(leasesData) ? leasesData : leasesData.items || leasesData.data || []);
        setAllTenants(Array.isArray(tenantsData) ? tenantsData : tenantsData.data || []);
        setCategories(categoriesData);
      } catch (error) {
        console.error('Erreur lors du chargement des données de référence:', error);
      }
    };

    loadReferenceData();
  }, [filters.includeArchived]);

  // Chargement des transactions
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
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
      // Si activeKpiFilter === 'solde', pas de filtre flow/status (vue globale)

      // Ajouter la période au format comptable
      params.append('accountingMonthStart', periodStart);
      params.append('accountingMonthEnd', periodEnd);

      // Ajouter la pagination
      params.append('page', '1');
      params.append('limit', '50');

      const response = await fetch(`/api/transactions?${params.toString()}`);
      const data = await response.json();

      setTransactions(data.data || []);
      setPagination(data.pagination || { page: 1, limit: 50, total: 0, pages: 0 });
      setTotalCount(data.pagination?.total || 0);
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
      notify2.error('Erreur lors du chargement des données');
    } finally {
      setIsLoading(false);
    }
  }, [filters, periodStart, periodEnd, activeKpiFilter]);

  // Chargement des données quand les filtres changent ou refreshKey
  useEffect(() => {
    loadData();
  }, [loadData, refreshKey]);

  // Synchronisation des filtres avec l'URL
  const updateURL = useCallback((newFilters: Filters) => {
    const params = new URLSearchParams();
    
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value) params.append(key, value);
    });

    const newURL = params.toString() ? `?${params.toString()}` : '';
    router.replace(`/transactions${newURL}`, { scroll: false });
  }, [router]);

  // Gestion des filtres
  const handleFiltersChange = useCallback((newFilters: Filters) => {
    setFilters(newFilters);
    setPagination(prev => ({ ...prev, page: 1 }));
    updateURL(newFilters);
  }, [updateURL]);

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
  }, [activeKpiFilter]);

  const handleResetFilters = useCallback(() => {
    const resetFilters: Filters = {
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
      status: '',
      hasDocument: ''
    };

    setFilters(resetFilters);
    // setActiveKpiFilter(null); // Désactivé temporairement
    setPagination(prev => ({ ...prev, page: 1 }));
    updateURL(resetFilters);
  }, [updateURL]);

  // Gestion du filtre de période
  const handlePeriodChange = useCallback((start: string, end: string) => {
    setPeriodStart(start);
    setPeriodEnd(end);
  }, []);

  // Gestion des filtres KPI (désactivé temporairement)
  const handleKPIFilterChange = useCallback((filterId: string | null) => {
    // Filtres KPI désactivés pour l'instant
    console.log('Filtre KPI cliqué (désactivé):', filterId);
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

  const handleEditTransaction = useCallback((transaction: Transaction) => {
    setModalMode('edit');
    setSelectedTransaction(transaction);
    setIsModalOpen(true);
  }, []);

  const handleDeleteTransaction = useCallback(async (transaction: Transaction) => {
    try {
      const response = await fetch(`/api/transactions/${transaction.id}`);
      const data = await response.json();
      const hasDocuments = data.documents && data.documents.length > 0;
      
      setTransactionToDelete(transaction);
      setTransactionHasDocuments(hasDocuments);
      setShowDeleteTransactionModal(true);
    } catch (error) {
      console.error('Erreur lors de la vérification des documents:', error);
      setTransactionToDelete(transaction);
      setTransactionHasDocuments(false);
      setShowDeleteTransactionModal(true);
    }
  }, []);

  const handleDeleteTransactionConfirmed = useCallback(() => {
    loadData();
    setTransactionToDelete(null);
    // Forcer le rafraîchissement des KPI et graphiques
    setRefreshKey(prev => prev + 1);
  }, [loadData]);

  // Gestion de la sélection
  const handleSelectTransaction = useCallback((id: string) => {
    setSelectedTransactionIds(prev => 
      prev.includes(id) 
        ? prev.filter(transId => transId !== id)
        : [...prev, id]
    );
  }, []);

  const handleSelectAll = useCallback((selected: boolean) => {
    if (selected) {
      const currentTransactionIds = transactions.map(t => t.id);
      setSelectedTransactionIds(currentTransactionIds);
    } else {
      setSelectedTransactionIds([]);
    }
  }, [transactions]);

  const handleDeleteMultipleTransactions = useCallback(() => {
    const selected = transactions.filter(t => selectedTransactionIds.includes(t.id));
    setTransactionsToDelete(selected);
    setShowDeleteMultipleModal(true);
  }, [transactions, selectedTransactionIds]);

  const handleDeleteMultipleConfirmed = useCallback(async (mode: 'delete_docs' | 'keep_docs_globalize') => {
    try {
      let deletedCount = 0;
      let skippedCount = 0;
      
      for (const transaction of transactionsToDelete) {
        try {
          const response = await fetch(`/api/transactions/${transaction.id}?mode=${mode}`, {
            method: 'DELETE',
          });
          
          if (response.ok) {
            deletedCount++;
          } else if (response.status === 404 || response.status === 500) {
            // ⚙️ GESTION DÉLÉGUÉE: La transaction a peut-être déjà été supprimée 
            // (cas d'une commission enfant supprimée automatiquement avec son parent)
            console.log(`[Delete Multiple] Transaction ${transaction.id} déjà supprimée ou introuvable, ignorée`);
            skippedCount++;
          } else {
            throw new Error(`Erreur ${response.status} lors de la suppression de la transaction ${transaction.id}`);
          }
        } catch (fetchError) {
          console.error(`Erreur lors de la suppression de ${transaction.id}:`, fetchError);
          // Si une transaction individuelle échoue, on continue avec les autres
          skippedCount++;
        }
      }
      
      // ⚙️ GESTION DÉLÉGUÉE: Afficher le nombre total de transactions sélectionnées
      // car certaines peuvent être supprimées automatiquement (cascade)
      const totalSelected = transactionsToDelete.length;
      if (deletedCount > 0 || skippedCount > 0) {
        notify2.success(`${totalSelected} transaction${totalSelected > 1 ? 's' : ''} supprimée${totalSelected > 1 ? 's' : ''}`);
      }
      if (skippedCount > 0) {
        console.log(`[Delete Multiple] ${skippedCount} transaction(s) ignorée(s) (déjà supprimée(s) automatiquement)`);
      }
      
      loadData();
      setTransactionsToDelete([]);
      setSelectedTransactionIds([]);
      // Forcer le rafraîchissement des KPI et graphiques
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('Erreur lors de la suppression multiple:', error);
      notify2.error('Erreur lors de la suppression des transactions');
    }
  }, [transactionsToDelete, loadData]);

  const handleViewDocument = useCallback((documentId: string, documentName: string) => {
    window.open(`/api/documents/${documentId}/file`, '_blank');
  }, []);

  const handleRowClick = useCallback(async (transaction: Transaction) => {
    // Charger les détails de la transaction avec les documents
    try {
      const response = await fetch(`/api/transactions/${transaction.id}`);
      const data = await response.json();
      setSelectedTransaction(data);
      setIsDrawerOpen(true);
    } catch (error) {
      console.error('Erreur lors du chargement des détails:', error);
      // En cas d'erreur, utiliser les données du tableau
      setSelectedTransaction(transaction);
      setIsDrawerOpen(true);
    }
  }, []);

  const handleModalSubmit = useCallback(async (data: any) => {
    try {
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
        throw new Error('Erreur lors de la sauvegarde');
      }

      const result = await response.json();
      
      notify2.success(
        modalMode === 'create' 
          ? 'Transaction créée avec succès' 
          : 'Transaction modifiée avec succès'
      );
      
      setIsModalOpen(false);
      await loadData();
      
      // Forcer le rafraîchissement des KPI et graphiques
      setRefreshKey(prev => prev + 1);
      
      if (modalMode === 'edit' && isDrawerOpen && result) {
        const updatedTransaction = transactions.find(t => t.id === result.id) || result;
        setSelectedTransaction(updatedTransaction);
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      throw error;
    }
  }, [modalMode, selectedTransaction, loadData, isDrawerOpen, transactions]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <SectionTitle
        title="Transactions"
        description="Suivi de vos revenus et dépenses immobilières"
        actions={
          <Button onClick={handleCreateTransaction}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle Transaction
          </Button>
        }
      />

      {/* Graphiques - TOUS sur la même ligne (AU DESSUS DES CARTES) */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
        {/* Graphique 1 : Évolution cumulée (2 colonnes) */}
        <div className="md:col-span-2">
          <TransactionsCumulativeChart
            data={chartsData.timeline}
            isLoading={chartsLoading}
          />
        </div>
        
        {/* Graphique 2 : Répartition par catégorie (1 colonne) */}
        <div className="md:col-span-1">
          <TransactionsByCategoryChart
            data={chartsData.byCategory}
            isLoading={chartsLoading}
          />
        </div>
        
        {/* Graphique 3 : Recettes vs Dépenses (1 colonne) */}
        <div className="md:col-span-1">
          <TransactionsIncomeExpenseChart
            data={chartsData.incomeExpense}
            isLoading={chartsLoading}
          />
        </div>
      </div>

      {/* Cartes KPI (APRÈS LES GRAPHIQUES) - Cartes filtrantes actives */}
      <TransactionsKpiBar
        kpis={kpis}
        activeFilter={activeKpiFilter}
        onFilterChange={handleKpiFilterChange}
        isLoading={kpisLoading}
      />

      {/* Filtres avancés (avec période intégrée) */}
      <TransactionFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onResetFilters={handleResetFilters}
        properties={properties}
        leases={leases}
        tenants={tenants}
        categories={categories}
        periodStart={periodStart}
        periodEnd={periodEnd}
        onPeriodChange={handlePeriodChange}
      />

      {/* Actions groupées */}
      {selectedTransactionIds.length > 0 && (
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-900">
                {selectedTransactionIds.length} transaction{selectedTransactionIds.length > 1 ? 's' : ''} sélectionnée{selectedTransactionIds.length > 1 ? 's' : ''}
              </span>
              <div className="flex-1" />
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleDeleteMultipleTransactions}
              >
                Supprimer
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setSelectedTransactionIds([])}
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
          <CardTitle>Transactions</CardTitle>
          <p className="text-sm text-gray-600">
            {totalCount > 0
              ? `Affichage de 1 à ${Math.min(pagination.limit, totalCount)} sur ${totalCount}`
              : 'Aucune transaction'}
          </p>
        </CardHeader>
        <CardContent>
          <TransactionsTable
        transactions={
          filters.includeManagementFees 
            ? transactions 
            : transactions.filter(t => t.autoSource !== 'gestion')
        }
        onEdit={handleEditTransaction}
        onDelete={handleDeleteTransaction}
        onDeleteMultiple={handleDeleteMultipleTransactions}
        onRowClick={handleRowClick}
        isLoading={isLoading}
        totalCount={totalCount}
        groupByParent={filters.groupByParent}
        selectedTransactionIds={selectedTransactionIds}
        onSelectTransaction={handleSelectTransaction}
        onSelectAll={handleSelectAll}
      />
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex justify-center">
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.pages}
            onPageChange={handlePageChange}
          />
        </div>
      )}

      {/* Modal */}
      <TransactionModal
        key={selectedTransaction?.id || 'new'}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleModalSubmit}
        context={{ type: 'global' }}
        mode={modalMode}
        transactionId={selectedTransaction?.id}
        title={modalMode === 'create' ? 'Nouvelle transaction' : 'Modifier la transaction'}
      />

      {/* Drawer */}
      <TransactionDrawer
        transaction={selectedTransaction}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onEdit={handleEditTransaction}
        onDelete={handleDeleteTransaction}
        onRefresh={() => setRefreshKey(prev => prev + 1)}
        onViewDocument={handleViewDocument}
      />

      {/* Modal de confirmation de suppression de transaction */}
      {transactionToDelete && (
        <ConfirmDeleteTransactionModal
          isOpen={showDeleteTransactionModal}
          onClose={() => {
            setShowDeleteTransactionModal(false);
            setTransactionToDelete(null);
          }}
          onConfirm={handleDeleteTransactionConfirmed}
          transactionId={transactionToDelete.id}
          transactionLabel={transactionToDelete.label}
          hasDocuments={transactionHasDocuments}
        />
      )}

      {/* Modal de confirmation de suppression multiple */}
      <ConfirmDeleteMultipleTransactionsModal
        isOpen={showDeleteMultipleModal}
        onClose={() => {
          setShowDeleteMultipleModal(false);
          setTransactionsToDelete([]);
        }}
        onConfirm={handleDeleteMultipleConfirmed}
        transactions={transactionsToDelete}
      />
    </div>
  );
}
