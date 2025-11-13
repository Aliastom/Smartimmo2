'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { InsightBar } from '@/components/ui/InsightBar';
import { InsightChip } from '@/components/ui/InsightChip';
import { InfoChip } from '@/components/ui/InfoChip';
import { InsightSkeleton } from '@/components/ui/InsightSkeleton';
import { MiniDonut } from '@/components/ui/MiniDonut';
import { MiniRadial } from '@/components/ui/MiniRadial';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { useAlert } from '@/hooks/useAlert';
import { Table, TableHeader, TableHeaderCell, TableBody, TableRow, TableCell } from '@/components/ui/Table';
import TransactionFormTabs from '@/components/forms/TransactionFormTabs';
import TransactionEditModal from '@/components/forms/TransactionEditModal';
import LeaseFormComplete from '@/components/forms/LeaseFormComplete';
import LeaseActionsManager from '@/components/forms/LeaseActionsManager';
import LeaseEditModal from '@/components/forms/LeaseEditModal';
import { getLeaseStatusBadge } from '@/utils/leaseStatusBadge';
import { PropertyWithRelations } from '@/lib/db/PropertyRepo';
import { TransactionWithRelations } from '@/lib/db/TransactionRepo';
import { DocumentWithRelations } from '@/lib/db/DocumentRepo';
import PropertyDocumentsClient from './documents/PropertyDocumentsClient';
import { 
  Building2, 
  Edit, 
  Eye, 
  Trash2,
  Plus,
  Upload,
  Calendar,
  Users,
  FileText,
  FileCheck,
  Download,
  MapPin,
  Euro,
  TrendingUp,
  TrendingDown,
  Settings,
  Camera,
  Clock,
  AlertTriangle,
  Activity,
  FileX,
  FileClock,
  CheckCircle2,
  XCircle,
  CheckCircle
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { UploadReviewModal } from '@/components/documents/UploadReviewModal';
import { usePropertyInsights, PropertyTransactionsInsights, PropertyDocumentsInsights, PropertyLeasesInsights } from '@/hooks/usePropertyInsights';
import { BackToPropertyButton } from '@/components/shared/BackToPropertyButton';

interface PropertyDetailClientProps {
  property: any; // Type complet de Property avec relations
  kpis: Array<{
    title: string;
    value: string;
    iconName: string;
    trend: { value: number; label: string; period: string };
    color: 'primary' | 'success' | 'warning' | 'danger' | 'gray';
  }>;
  transactions: TransactionWithRelations[];
  documents: DocumentWithRelations[];
  activeTab: string;
}

const tabs = [
  { id: 'overview', label: 'Vue d\'ensemble', icon: Building2 },
  { id: 'transactions', label: 'Transactions', icon: Euro },
  { id: 'leases', label: 'Baux', icon: FileText },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'photos', label: 'Photos', icon: Camera },
  { id: 'profitability', label: 'Rentabilité', icon: TrendingUp },
  { id: 'settings', label: 'Paramètres', icon: Settings }
];

export default function PropertyDetailClient({ 
  property, 
  kpis, 
  transactions, 
  documents, 
  activeTab 
}: PropertyDetailClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showAlert, showConfirm } = useAlert();
  const [currentTab, setCurrentTab] = useState(activeTab);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionWithRelations | null>(null);
  const [transactionFormOpen, setTransactionFormOpen] = useState(false);
  const [transactionEditOpen, setTransactionEditOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<TransactionWithRelations | null>(null);
  const [leaseFormOpen, setLeaseFormOpen] = useState(false);
  const [leaseActionsOpen, setLeaseActionsOpen] = useState(false);
  const [leaseEditOpen, setLeaseEditOpen] = useState(false);
  const [selectedLease, setSelectedLease] = useState<any>(null);
  const [editingLease, setEditingLease] = useState<any>(null);
  const [properties, setProperties] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  
  // 3) États pour la modale d'upload directe
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Insights property-scoped pour chaque onglet
  const { insights: transactionsInsights, loading: transactionsLoading } = usePropertyInsights(
    property.id,
    'transactions',
    'month'
  ) as { insights: PropertyTransactionsInsights | null; loading: boolean };

  const { insights: documentsInsights, loading: documentsLoading } = usePropertyInsights(
    property.id,
    'documents',
    'month'
  ) as { insights: PropertyDocumentsInsights | null; loading: boolean };

  const { insights: leasesInsights, loading: leasesLoading } = usePropertyInsights(
    property.id,
    'leases',
    'month'
  ) as { insights: PropertyLeasesInsights | null; loading: boolean };

  const handleTabChange = (tabId: string) => {
    // 🎯 Rediriger vers la page dédiée Transactions
    if (tabId === 'transactions') {
      router.push(`/biens/${property.id}/transactions`);
      return;
    }
    
    setCurrentTab(tabId);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tabId);
    router.push(url.pathname + url.search);
  };

  // Helpers InsightBar (onglets property-scoped)
  const replaceQueryShallow = (updater: (p: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString());
    updater(params);
    router.replace(`?${params.toString()}`, { scroll: false });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('filters:changed'));
    }
  };

  // Handler pour le bouton Uploader
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  // Handler pour la sélection de fichiers
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      setUploadFiles(files);
      setUploadModalOpen(true);
    }
    // Reset input
    if (event.target) {
      event.target.value = '';
    }
  };

  // Handler pour le succès de l'upload
  const handleUploadSuccess = () => {
    setUploadModalOpen(false);
    setUploadFiles([]);
    router.refresh(); // Rafraîchir la page pour recharger les documents
  };

  const handleTransactionSubmit = useCallback(async (data: any) => {
    try {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la création');
      }

      setTransactionFormOpen(false);
      router.refresh();
    } catch (error) {
      console.error('Error creating transaction:', error);
      await showAlert({
        type: 'error',
        title: 'Erreur',
        message: 'Erreur lors de la création de la transaction',
      });
    }
  }, [router, showAlert]);

  const handleTransactionEditSubmit = useCallback(async (data: any) => {
    try {
      const response = await fetch(`/api/transactions/${data.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        setTransactionEditOpen(false);
        setEditingTransaction(null);
        router.refresh();
      } else {
        const errorData = await response.json();
        console.error('Erreur lors de la modification:', errorData);
      }
    } catch (error) {
      console.error('Erreur lors de la modification:', error);
    }
  }, [router]);

  const handleTransactionDelete = useCallback(async (id: string) => {
    const confirmed = await showConfirm({
      title: 'Supprimer la transaction',
      message: 'Êtes-vous sûr de vouloir supprimer cette transaction ?\n\nCette action est irréversible.',
      confirmLabel: 'Supprimer',
      cancelLabel: 'Annuler',
      variant: 'danger',
    });

    if (!confirmed) return;

    try {
      const response = await fetch(`/api/transactions/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setTransactionEditOpen(false);
        setEditingTransaction(null);
        await showAlert({
          type: 'success',
          title: 'Transaction supprimée',
          message: 'La transaction a été supprimée avec succès.',
        });
        router.refresh();
      } else {
        const errorData = await response.json();
        console.error('Erreur lors de la suppression:', errorData);
        await showAlert({
          type: 'error',
          title: 'Erreur',
          message: 'Erreur lors de la suppression de la transaction.',
        });
      }
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      await showAlert({
        type: 'error',
        title: 'Erreur',
        message: 'Erreur lors de la suppression de la transaction.',
      });
    }
  }, [router, showAlert, showConfirm]);

  const handleLeaseSubmit = useCallback(async (data: any) => {
    try {
      const response = await fetch('/api/leases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('API Error:', errorData);
        
        // Afficher les détails de validation si disponibles
        if (errorData.details && Array.isArray(errorData.details)) {
          const errorMessages = errorData.details.map((d: any) => `${d.field}: ${d.message}`).join('\n');
          throw new Error(`Erreur de validation:\n${errorMessages}`);
        }
        
        throw new Error(errorData.error || 'Erreur lors de la création du bail');
      }

      setLeaseFormOpen(false);
      router.refresh();
    } catch (error) {
      console.error('Error creating lease:', error);
      
      // Afficher l'erreur dans une modal au lieu d'un simple alert
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      
      // Créer une modal d'erreur personnalisée
      const errorModal = document.createElement('div');
      errorModal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
      errorModal.innerHTML = `
        <div class="bg-white rounded-lg p-6 max-w-md mx-4">
          <div class="flex items-center mb-4">
            <div class="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mr-3">
              <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
              </svg>
            </div>
            <h3 class="text-lg font-semibold text-gray-900">Erreur de création</h3>
          </div>
          <p class="text-gray-700 mb-6">${errorMessage}</p>
          <div class="flex justify-end">
            <button class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500" onclick="this.closest('.fixed').remove()">
              Fermer
            </button>
          </div>
        </div>
      `;
      
      document.body.appendChild(errorModal);
      
      // Fermer la modal en cliquant sur le fond
      errorModal.addEventListener('click', (e) => {
        if (e.target === errorModal) {
          errorModal.remove();
        }
      });
    }
  }, [router]);

  const handleLeaseActions = useCallback((lease: any) => {
    setSelectedLease(lease);
    setLeaseActionsOpen(true);
  }, []);

  const handleEditLease = useCallback((lease: any) => {
    setEditingLease(lease);
    setLeaseEditOpen(true);
  }, []);

  const handleLeaseEditSubmit = useCallback(async (data: any) => {
    try {
      const response = await fetch(`/api/leases/${data.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        throw new Error('Erreur lors de la modification du bail');
      }
      setLeaseEditOpen(false);
      setEditingLease(null);
      router.refresh();
    } catch (error) {
      console.error('Error updating lease:', error);
      await showAlert({
        type: 'error',
        title: 'Erreur',
        message: 'Erreur lors de la modification du bail',
      });
    }
  }, [router, showAlert]);

  const handleDeleteLease = useCallback(async (lease: any) => {
    const confirmed = await showConfirm({
      title: 'Supprimer le bail',
      message: `Êtes-vous sûr de vouloir supprimer définitivement le bail de ${lease.Tenant?.firstName} ${lease.Tenant?.lastName} ?\n\nCette action est irréversible.`,
      confirmLabel: 'Supprimer',
      cancelLabel: 'Annuler',
      variant: 'danger',
    });

    if (!confirmed) return;

    try {
      const response = await fetch(`/api/leases/${lease.id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de la suppression');
      }
      
      await showAlert({
        type: 'success',
        title: 'Bail supprimé',
        message: 'Le bail a été supprimé avec succès !',
      });
      router.refresh();
    } catch (error) {
      console.error('Error deleting lease:', error);
      await showAlert({
        type: 'error',
        title: 'Erreur',
        message: `Erreur lors de la suppression du bail: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
      });
    }
  }, [router, showAlert, showConfirm]);

  // Charger les données pour les modals
  useEffect(() => {
    const loadModalData = async () => {
      try {
        const [propertiesRes, tenantsRes] = await Promise.all([
          fetch('/api/properties'),
          fetch('/api/tenants')
        ]);
        
        if (propertiesRes.ok) {
          const propertiesData = await propertiesRes.json();
          setProperties(propertiesData.data || propertiesData || []);
        }
        
        if (tenantsRes.ok) {
          const tenantsData = await tenantsRes.json();
          setTenants(tenantsData.data || tenantsData || []);
        }
      } catch (error) {
        console.error('Error loading modal data:', error);
      }
    };

    if (leaseFormOpen || leaseEditOpen) {
      loadModalData();
    }
  }, [leaseFormOpen, leaseEditOpen]);

  // Stabiliser les leases pour éviter les re-renders
  const stableLeases = useMemo(() => {
    return property.Lease || [];
  }, [property.Lease]);

  // Utilise la fonction utilitaire commune pour les badges de statut
  const getStatusBadge = getLeaseStatusBadge;

  const getTransactionStatusBadge = (transaction: TransactionWithRelations) => {
    if (transaction.paidAt) {
      return <Badge variant="success">Payé</Badge>;
    } else {
      return <Badge variant="warning">En attente</Badge>;
    }
  };

  const formatAmount = (amount: number) => {
    const formatted = Math.abs(amount).toLocaleString('fr-FR');
    return amount >= 0 ? `+€${formatted}` : `-€${formatted}`;
  };

  const getNatureLabel = (nature?: string) => {
    const natureMap: Record<string, string> = {
      'LOYER': 'Loyer',
      'CHARGES': 'Charges',
      'DEPOT_GARANTIE_RECU': 'Dépôt de garantie reçu',
      'DEPOT_GARANTIE_RENDU': 'Dépôt de garantie rendu',
      'AVOIR_REGULARISATION': 'Avoir/Régularisation',
      'PENALITE_RETENUE': 'Pénalité retenue',
      'AUTRE': 'Autre'
    };
    return natureMap[nature || 'AUTRE'] || nature || 'Autre';
  };

  const renderOverviewTab = () => (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((kpi, index) => (
          <StatCard key={index} {...kpi} />
        ))}
      </div>

      {/* Informations du bien */}
      <Card>
        <CardHeader>
          <CardTitle>Informations du Bien</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Adresse</label>
                <p className="text-gray-900">{property.address}</p>
                <p className="text-gray-600">{property.postalCode} {property.city}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Type</label>
                <p className="text-gray-900">{property.type}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Surface</label>
                <p className="text-gray-900">{property.surface} m² ({property.rooms} pièces)</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Statut</label>
                <div className="mt-1">{getStatusBadge(property.status)}</div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Valeur actuelle</label>
                <p className="text-gray-900">€{property.currentValue?.toLocaleString('fr-FR') || 'Non définie'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Date d'acquisition</label>
                <p className="text-gray-900">{new Date(property.acquisitionDate).toLocaleDateString('fr-FR')}</p>
              </div>
            </div>
          </div>
          {property.notes && (
            <div className="mt-6">
              <label className="text-sm font-medium text-gray-700">Notes</label>
              <p className="text-gray-900 mt-1">{property.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Baux actifs */}
      {property.Lease && property.Lease.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Baux Actifs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {property.Lease.filter((lease: any) => lease.status === 'ACTIF').map((lease: any) => (
                <div key={lease.id} className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-gray-900">
                        {lease.Tenant.firstName} {lease.Tenant.lastName}
                      </p>
                      <p className="text-sm text-gray-600">
                        {new Date(lease.startDate).toLocaleDateString('fr-FR')} - 
                        {lease.endDate ? new Date(lease.endDate).toLocaleDateString('fr-FR') : 'En cours'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">€{lease.rentAmount.toLocaleString('fr-FR')}/mois</p>
                      <Badge variant="success">Actif</Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderTransactionsTab = () => {
    // Lecture des filtres URL (property-scoped)
    const flow = searchParams.get('flow'); // income | expense
    const txStatus = searchParams.get('status'); // unreconciled | anomaly

    // Utilisation des insights API ou fallback sur calcul local
    const incomeNatures = new Set(['LOYER', 'AVOIR_REGULARISATION', 'DEPOT_GARANTIE_RECU']);
    const expenseNatures = new Set(['REPARATION', 'TRAVAUX', 'CHARGES_PROPRIETAIRE', 'DEPOT_GARANTIE_RENDU', 'PENALITE_RETENUE']);
    const isIncome = (t: any) => {
      if (incomeNatures.has(t.nature)) return true;
      if (expenseNatures.has(t.nature)) return false;
      return (t.amount || 0) > 0;
    };
    const isExpense = (t: any) => {
      if (expenseNatures.has(t.nature)) return true;
      if (incomeNatures.has(t.nature)) return false;
      return (t.amount || 0) < 0;
    };

    const totalRevenue = transactionsInsights?.totalRevenue ?? transactions.filter(isIncome)
      .reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);
    const totalExpenses = transactionsInsights?.totalExpenses ?? transactions.filter(isExpense)
      .reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);
    const netIncome = transactionsInsights?.netIncome ?? (totalRevenue - totalExpenses);
    const unreconciledCount = transactionsInsights?.unreconciledCount ?? 0;
    const anomalyCount = transactionsInsights?.anomalyCount ?? transactions.filter(t => (t.amount || 0) === 0 || !t.categoryId).length;

    // Filtrage pour tableau
    const isAnomaly = (t: any) => (t.amount || 0) === 0 || !t.categoryId;
    let scopedTransactions = transactions.slice();
    if (flow === 'income') scopedTransactions = scopedTransactions.filter(isIncome);
    if (flow === 'expense') scopedTransactions = scopedTransactions.filter(isExpense);
    if (txStatus === 'anomaly') scopedTransactions = scopedTransactions.filter(isAnomaly);

    const transactionCount = scopedTransactions.length;
    const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);

    const setFilter = (key: 'flow' | 'status', value: string | null) => {
      replaceQueryShallow((p) => {
        if (value) p.set(key, value); else p.delete(key);
      });
    };

    return (
      <div className="space-y-6">
        {/* Cartes de statistiques - Toutes en StatCard Phase 2 */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 auto-rows-fr">
          <StatCard
            title="Revenus totaux"
            value={fmt(totalRevenue)}
            iconName="TrendingUp"
            color="green"
            trendValue={transactionsInsights?.trend?.revenue ? parseFloat(transactionsInsights.trend.revenue.replace('%', '')) : 0}
            trendLabel="% vs mois dernier"
            trendDirection={transactionsInsights?.trend?.revenue ? (parseFloat(transactionsInsights.trend.revenue.replace('%', '')) > 0 ? 'up' : parseFloat(transactionsInsights.trend.revenue.replace('%', '')) < 0 ? 'down' : 'flat') : 'flat'}
            rightIndicator="chevron"
            onClick={() => setFilter('flow', flow === 'income' ? null : 'income')}
            isActive={flow === 'income'}
          />
          
          <StatCard
            title="Charges totales"
            value={fmt(totalExpenses)}
            iconName="TrendingDown"
            color="red"
            trendValue={transactionsInsights?.trend?.expenses ? parseFloat(transactionsInsights.trend.expenses.replace('%', '')) : 0}
            trendLabel="% vs mois dernier"
            trendDirection={transactionsInsights?.trend?.expenses ? (parseFloat(transactionsInsights.trend.expenses.replace('%', '')) > 0 ? 'up' : parseFloat(transactionsInsights.trend.expenses.replace('%', '')) < 0 ? 'down' : 'flat') : 'flat'}
            rightIndicator="chevron"
            onClick={() => setFilter('flow', flow === 'expense' ? null : 'expense')}
            isActive={flow === 'expense'}
          />
          
          <StatCard
            title="Résultat net"
            value={fmt(netIncome)}
            iconName="Activity"
            color={netIncome >= 0 ? 'emerald' : 'red'}
            trendValue={transactionsInsights?.trend?.net ? parseFloat(transactionsInsights.trend.net.replace('%', '')) : 0}
            trendLabel="% vs mois dernier"
            trendDirection={transactionsInsights?.trend?.net ? (parseFloat(transactionsInsights.trend.net.replace('%', '')) > 0 ? 'up' : parseFloat(transactionsInsights.trend.net.replace('%', '')) < 0 ? 'down' : 'flat') : 'flat'}
            rightIndicator="chevron"
          />
          
          <StatCard
            title="Non rapprochées"
            value={unreconciledCount.toString()}
            iconName="Clock"
            color="amber"
            trendValue={0}
            trendLabel="% vs mois dernier"
            trendDirection="flat"
            rightIndicator="chevron"
            onClick={() => setFilter('status', txStatus === 'unreconciled' ? null : 'unreconciled')}
            isActive={txStatus === 'unreconciled'}
            disabled={unreconciledCount === 0}
          />
          
          <StatCard
            title="Anomalies"
            value={anomalyCount.toString()}
            iconName="AlertTriangle"
            color="rose"
            trendValue={0}
            trendLabel="% vs mois dernier"
            trendDirection="flat"
            rightIndicator="chevron"
            onClick={() => setFilter('status', txStatus === 'anomaly' ? null : 'anomaly')}
            isActive={txStatus === 'anomaly'}
          />
          
          <StatCard
            title="Total transactions"
            value={transactionCount.toString()}
            iconName="FileText"
            color="indigo"
            trendValue={0}
            trendLabel="% vs mois dernier"
            trendDirection="flat"
            rightIndicator="chevron"
          />
        </div>

        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold">Transactions</h3>
            <p className="text-gray-600">Historique des transactions pour ce bien</p>
          </div>
          <div className="flex gap-2">
            <BackToPropertyButton 
              propertyId={property.id} 
              propertyName={property.name}
            />
            <Button onClick={() => setTransactionFormOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle Transaction
            </Button>
          </div>
        </div>

      <Card>
        <CardContent className="p-0">
          <Table hover>
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Type</TableHeaderCell>
                <TableHeaderCell>Locataire</TableHeaderCell>
                <TableHeaderCell>Montant</TableHeaderCell>
                <TableHeaderCell>Statut</TableHeaderCell>
                <TableHeaderCell>Date</TableHeaderCell>
                <TableHeaderCell>Actions</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scopedTransactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium text-gray-900">{getNatureLabel(transaction.nature)}</div>
                      <div className="text-sm text-gray-500">{transaction.label}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {transaction.lease?.Tenant ? (
                      <div className="text-sm">
                        {transaction.lease.Tenant.firstName} {transaction.lease.Tenant.lastName}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={`font-medium ${transaction.amount >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                      {formatAmount(transaction.amount)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {getTransactionStatusBadge(transaction)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span>{new Date(transaction.date).toLocaleDateString('fr-FR')}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedTransaction(transaction);
                          setModalOpen(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                          setEditingTransaction(transaction);
                          setTransactionEditOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleTransactionDelete(transaction.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
  };

  const renderLeasesTab = () => {
    const leaseFilter = searchParams.get('lease'); // active
    const lateStatus = searchParams.get('status'); // late
    const setLeaseFilter = (key: 'lease' | 'status', value: string | null) => {
      replaceQueryShallow((p) => {
        if (value) p.set(key, value); else p.delete(key);
      });
    };
    
    // Utilisation des insights API ou fallback sur calcul local
    const hasActiveLease = leasesInsights?.hasActiveLease ?? property.Lease?.some((l: any) => l.status === 'ACTIF' || l.status === 'ACTIVE') ?? false;
    const monthlyRent = leasesInsights?.monthlyRent ?? property.Lease
      ?.filter((l: any) => l.status === 'ACTIF' || l.status === 'ACTIVE')
      .reduce((sum: number, l: any) => sum + (l.rentAmount || 0), 0) ?? 0;
    const latePaymentsCount = leasesInsights?.latePaymentsCount ?? 0;
    const leaseStartDate = leasesInsights?.leaseStartDate;
    const leaseEndDate = leasesInsights?.leaseEndDate;
    const indexationInfo = leasesInsights?.indexationInfo;
    const upcomingDueDates = leasesInsights?.upcomingDueDates ?? 0;

    const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);

    return (
      <div className="space-y-6">
        {/* Cartes de statistiques - Toutes en StatCard Phase 2 */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 auto-rows-fr">
          <StatCard
            title="Bail actif"
            value={hasActiveLease ? 'Oui' : 'Non'}
            iconName="CheckCircle"
            color={hasActiveLease ? 'emerald' : 'slate'}
            trendValue={0}
            trendLabel="% vs mois dernier"
            trendDirection="flat"
            rightIndicator="badge"
            badgeContent={hasActiveLease ? '✓' : '✗'}
          />
          
          <StatCard
            title="Début / Fin"
            value={
              leaseStartDate && leaseEndDate 
                ? `${new Date(leaseStartDate).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })} - ${new Date(leaseEndDate).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })}`
                : leaseStartDate
                  ? new Date(leaseStartDate).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
                  : 'N/A'
            }
            iconName="Calendar"
            color="indigo"
            trendValue={0}
            trendLabel="% vs mois dernier"
            trendDirection="flat"
            rightIndicator="chevron"
          />
          
          <StatCard
            title="Loyer mensuel"
            value={fmt(monthlyRent)}
            iconName="Euro"
            color="green"
            trendValue={0}
            trendLabel="% vs mois dernier"
            trendDirection="flat"
            rightIndicator="badge"
            badgeContent="€"
          />
          
          <StatCard
            title="Retards de paiement"
            value={latePaymentsCount.toString()}
            iconName="Clock"
            color="amber"
            trendValue={0}
            trendLabel="% vs mois dernier"
            trendDirection="flat"
            rightIndicator="chevron"
            onClick={() => setLeaseFilter('status', lateStatus === 'late' ? null : 'late')}
            isActive={lateStatus === 'late'}
          />
        </div>

        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold">Baux</h3>
            <p className="text-gray-600">Gestion des baux pour ce bien</p>
          </div>
          <div className="flex gap-2">
            <BackToPropertyButton 
              propertyId={property.id} 
              propertyName={property.name}
            />
            <Button onClick={() => setLeaseFormOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nouveau Bail
            </Button>
          </div>
        </div>

      <Card>
        <CardContent className="p-0">
          <Table hover>
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Locataire</TableHeaderCell>
                <TableHeaderCell>Période</TableHeaderCell>
                <TableHeaderCell>Loyer</TableHeaderCell>
                <TableHeaderCell>Statut</TableHeaderCell>
                <TableHeaderCell>Actions</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {property.Lease
                ?.filter((l: any) => !leaseFilter || (leaseFilter === 'active' && (l.status === 'ACTIF' || l.status === 'ACTIVE')))
                .map((lease: any) => (
                <TableRow key={lease.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-gray-400" />
                      <span>{lease.Tenant.firstName} {lease.Tenant.lastName}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{new Date(lease.startDate).toLocaleDateString('fr-FR')}</div>
                      <div className="text-gray-500">
                        {lease.endDate ? new Date(lease.endDate).toLocaleDateString('fr-FR') : 'En cours'}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">€{lease.rentAmount.toLocaleString('fr-FR')}/mois</div>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(lease.status)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleLeaseActions(lease)}
                        title="Actions du bail"
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleEditLease(lease)}
                        title="Modifier le bail"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleDeleteLease(lease)}
                        title={`Supprimer le bail (statut: ${lease.status})`}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
  };

  const renderDocumentsTab = () => {
    return (
      <PropertyDocumentsClient 
        propertyId={property.id} 
        propertyName={property.name} 
      />
    );
  };

  const renderTabContent = () => {
    switch (currentTab) {
      case 'overview':
        return renderOverviewTab();
      case 'transactions':
        return renderTransactionsTab();
      case 'leases':
        return renderLeasesTab();
      case 'documents':
        return renderDocumentsTab();
      case 'photos':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold">Photos</h3>
                <p className="text-gray-600">Galerie photos du bien</p>
              </div>
              <BackToPropertyButton 
                propertyId={property.id} 
                propertyName={property.name}
              />
            </div>
            <div className="text-center py-12 text-gray-500">
              <Camera className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>Gestion des photos à implémenter</p>
            </div>
          </div>
        );
      case 'profitability':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold">Rentabilité</h3>
                <p className="text-gray-600">Analyses financières et projections</p>
              </div>
              <BackToPropertyButton 
                propertyId={property.id} 
                propertyName={property.name}
              />
            </div>
            <div className="text-center py-12 text-gray-500">
              <TrendingUp className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>Analyse de rentabilité à implémenter</p>
            </div>
          </div>
        );
      case 'settings':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold">Paramètres</h3>
                <p className="text-gray-600">Configuration du bien</p>
              </div>
              <BackToPropertyButton 
                propertyId={property.id} 
                propertyName={property.name}
              />
            </div>
            <div className="text-center py-12 text-gray-500">
              <Settings className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>Paramètres du bien à implémenter</p>
            </div>
          </div>
        );
      default:
        return renderOverviewTab();
    }
  };

  // Si on a un activeTab, afficher JUSTE le contenu de cet onglet sans header ni navigation
  return (
    <div className="space-y-6">
      {renderTabContent()}

      {/* Transaction Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selectedTransaction ? getNatureLabel(selectedTransaction.nature) : ''}
        size="lg"
        footer={
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Fermer
            </Button>
            <Button onClick={() => setModalOpen(false)}>
              <Edit className="h-4 w-4 mr-2" />
              Modifier
            </Button>
          </div>
        }
      >
        {selectedTransaction && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Type</label>
                <p className="text-gray-900">{getNatureLabel(selectedTransaction.nature)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Montant</label>
                <p className={`font-medium ${selectedTransaction.amount >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                  {formatAmount(selectedTransaction.amount)}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Bien</label>
                <p className="text-gray-900">{selectedTransaction.Property.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Date</label>
                <p className="text-gray-900">{new Date(selectedTransaction.date).toLocaleDateString('fr-FR')}</p>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Description</label>
              <p className="text-gray-900 mt-1">{selectedTransaction.label}</p>
            </div>
          </div>
        )}
      </Modal>

      {/* Transaction Form Modal */}
      {transactionFormOpen && (
        <TransactionFormTabs
          isOpen={transactionFormOpen}
          onClose={() => setTransactionFormOpen(false)}
          onSubmit={handleTransactionSubmit}
          title="Nouvelle Transaction"
          propertyId={property.id}
          defaultPropertyId={property.id}
          properties={[property]}
          tenants={tenants}
          leases={stableLeases}
        />
      )}

      {/* Transaction Edit Modal */}
      {editingTransaction && (
        <TransactionEditModal
          isOpen={transactionEditOpen}
          onClose={() => {
            setTransactionEditOpen(false);
            setEditingTransaction(null);
          }}
          onSubmit={handleTransactionEditSubmit}
          transaction={editingTransaction}
          properties={[property]}
          tenants={tenants}
          leases={stableLeases}
        />
      )}

      {/* Lease Form Modal */}
      {leaseFormOpen && (
        <LeaseFormComplete
          isOpen={leaseFormOpen}
          onClose={() => setLeaseFormOpen(false)}
          onSubmit={handleLeaseSubmit}
          title="Nouveau Bail"
          defaultPropertyId={property.id}
        />
      )}

      {/* Lease Actions Modal */}
      {selectedLease && (
        <LeaseActionsManager
          lease={selectedLease}
          onClose={() => {
            setLeaseActionsOpen(false);
            setSelectedLease(null);
          }}
          onSuccess={() => {
            router.refresh();
          }}
        />
      )}

      {/* Lease Edit Modal */}
      {editingLease && (
        <LeaseEditModal
          isOpen={leaseEditOpen}
          onClose={() => {
            setLeaseEditOpen(false);
            setEditingLease(null);
          }}
          onSubmit={handleLeaseEditSubmit}
          lease={editingLease}
          properties={properties}
          tenants={tenants}
        />
      )}

      {/* 3) Modale d'upload/revue pour le bien */}
      <UploadReviewModal
        isOpen={uploadModalOpen}
        onClose={() => {
          setUploadModalOpen(false);
          setUploadFiles([]);
        }}
        files={uploadFiles}
        scope="property"
        propertyId={property.id}
        onSuccess={handleUploadSuccess}
      />
    </div>
  );
}
