'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { 
  Plus, 
  Download,
  Upload,
  RefreshCw
} from 'lucide-react';
import { LeasesKPICards } from '@/components/leases/LeasesKPICards';
import { LeasesFiltersBar, LeaseFilters } from '@/components/leases/LeasesFiltersBar';
import { LeasesTable } from '@/components/leases/LeasesTable';
import { LeasesDetailDrawerV2 as LeasesDetailDrawer } from '@/components/leases/LeasesDetailDrawerV2';
import { LeasesAlertsSection } from '@/components/leases/LeasesAlertsSection';
import { LeaseWithDetails, LeaseKPIs } from '@/lib/services/leasesService';
import LeaseFormComplete from '@/components/forms/LeaseFormComplete';
import LeaseEditModal from '@/components/forms/LeaseEditModal';
import LeaseActionsManager from '@/components/forms/LeaseActionsManager';
import { toast } from 'sonner';

interface LeasesPageClientProps {
  initialData: {
    kpis: LeaseKPIs;
    alerts: {
      expiringLeases: LeaseWithDetails[];
      missingDocumentsLeases: LeaseWithDetails[];
      indexationDueLeases: LeaseWithDetails[];
    };
  };
}

export default function LeasesPageClient({ initialData }: LeasesPageClientProps) {
  // États principaux
  const [leases, setLeases] = useState<LeaseWithDetails[]>([]);
  const [kpis, setKpis] = useState<LeaseKPIs>(initialData.kpis);
  const [alerts, setAlerts] = useState(initialData.alerts);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // États des filtres
  const [filters, setFilters] = useState<LeaseFilters>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // États des modales
  const [selectedLease, setSelectedLease] = useState<LeaseWithDetails | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isActionsModalOpen, setIsActionsModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);


  // Fonction pour charger les baux
  const loadLeases = useCallback(async (newFilters: LeaseFilters = filters) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      
      if (newFilters.search) params.append('search', newFilters.search);
      if (newFilters.status && newFilters.status.length > 0) {
        params.append('status', newFilters.status.join(','));
      }
      if (newFilters.type && newFilters.type.length > 0) {
        params.append('type', newFilters.type.join(','));
      }
      if (newFilters.propertyId) params.append('propertyId', newFilters.propertyId);
      if (newFilters.tenantId) params.append('tenantId', newFilters.tenantId);
      if (newFilters.upcomingExpiration) params.append('upcomingExpiration', 'true');
      if (newFilters.missingDocuments) params.append('missingDocuments', 'true');
      if (newFilters.indexationDue) params.append('indexationDue', 'true');
      if (newFilters.rentMin) params.append('rentMin', newFilters.rentMin.toString());
      if (newFilters.rentMax) params.append('rentMax', newFilters.rentMax.toString());
      if (newFilters.periodStart) params.append('periodStart', newFilters.periodStart);
      if (newFilters.periodEnd) params.append('periodEnd', newFilters.periodEnd);
      
      params.append('limit', '50');
      params.append('offset', '0');

      const response = await fetch(`/api/leases?${params.toString()}`);
      if (!response.ok) throw new Error('Erreur lors du chargement des baux');
      
      const data = await response.json();
      setLeases(data.items || []);
    } catch (error) {
      console.error('Error loading leases:', error);
      toast.error('Erreur lors du chargement des baux');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Fonction pour charger les KPIs
  const loadKPIs = useCallback(async () => {
    try {
      const response = await fetch('/api/leases?kpis=true');
      if (!response.ok) throw new Error('Erreur lors du chargement des KPIs');
      
      const data = await response.json();
      setKpis(data);
    } catch (error) {
      console.error('Error loading KPIs:', error);
    }
  }, []);

  // Fonction pour charger les alertes
  const loadAlerts = useCallback(async () => {
    try {
      const response = await fetch('/api/leases?alerts=true');
      if (!response.ok) throw new Error('Erreur lors du chargement des alertes');
      
      const data = await response.json();
      setAlerts(data);
    } catch (error) {
      console.error('Error loading alerts:', error);
    }
  }, []);

  // Charger les données initiales
  useEffect(() => {
    loadLeases();
  }, []);

  // Fonction de rafraîchissement complet
  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        loadLeases(),
        loadKPIs(),
        loadAlerts()
      ]);
      toast.success('Données mises à jour');
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setRefreshing(false);
    }
  }, [loadLeases, loadKPIs, loadAlerts]);

  // Handlers pour les actions
  const handleFiltersChange = useCallback((newFilters: LeaseFilters) => {
    setFilters(newFilters);
    loadLeases(newFilters);
  }, [loadLeases]);

  const handleResetFilters = useCallback(() => {
    setFilters({});
    loadLeases({});
  }, [loadLeases]);

  const handleKpiClick = useCallback((filterType: string, filterValue: any) => {
    const newFilters = { ...filters };
    
    switch (filterType) {
      case 'status':
        newFilters.status = filterValue;
        break;
      case 'upcomingExpiration':
        newFilters.upcomingExpiration = filterValue;
        break;
      case 'missingDocuments':
        newFilters.missingDocuments = filterValue;
        break;
      case 'indexationDue':
        newFilters.indexationDue = filterValue;
        break;
    }
    
    setFilters(newFilters);
    loadLeases(newFilters);
  }, [filters, loadLeases]);

  const handleViewLease = useCallback((lease: LeaseWithDetails) => {
    setSelectedLease(lease);
    setIsDetailDrawerOpen(true);
  }, []);

  const handleEditLease = useCallback((lease: LeaseWithDetails) => {
    setSelectedLease(lease);
    setIsEditModalOpen(true);
    setIsDetailDrawerOpen(false);
  }, []);

  const handleDeleteLease = useCallback(async (lease: LeaseWithDetails) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce bail ?')) return;

    try {
      const response = await fetch(`/api/leases/${lease.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await refreshAll();
        toast.success('Bail supprimé avec succès');
      } else {
        const errorData = await response.json();
        toast.error(`Erreur: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error deleting lease:', error);
      toast.error('Erreur lors de la suppression du bail');
    }
  }, [refreshAll]);

  const handleLeaseActions = useCallback((lease: LeaseWithDetails) => {
    setSelectedLease(lease);
    setIsActionsModalOpen(true);
    setIsDetailDrawerOpen(false);
  }, []);

  const handleCreateLease = useCallback(() => {
    setSelectedLease(null);
    setIsCreateModalOpen(true);
  }, []);

  const handleSelectionChange = useCallback((newSelectedIds: Set<string>) => {
    setSelectedIds(newSelectedIds);
  }, []);

  const handleSelectAll = useCallback((selected: boolean) => {
    if (selected) {
      setSelectedIds(new Set(leases.map(lease => lease.id)));
    } else {
      setSelectedIds(new Set());
    }
  }, [leases]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Baux</h1>
          <p className="mt-2 text-gray-600">
            Outil de pilotage transversal de tous vos baux
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={refreshAll}
            disabled={refreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <Button
            onClick={handleCreateLease}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Nouveau Bail
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <LeasesKPICards
        kpis={kpis}
        onFilterChange={handleKpiClick}
        loading={loading}
      />

      {/* Filtres */}
      <LeasesFiltersBar
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onReset={handleResetFilters}
        loading={loading}
      />

      {/* Tableau principal */}
      <LeasesTable
        leases={leases}
        loading={loading}
        onView={handleViewLease}
        onEdit={handleEditLease}
        onDelete={handleDeleteLease}
        onActions={handleLeaseActions}
        selectedIds={selectedIds}
        onSelectionChange={handleSelectionChange}
        onSelectAll={handleSelectAll}
        showSelection={true}
        showActions={true}
      />

      {/* Alertes */}
      <LeasesAlertsSection
        expiringLeases={alerts.expiringLeases}
        missingDocumentsLeases={alerts.missingDocumentsLeases}
        indexationDueLeases={alerts.indexationDueLeases}
        onViewLease={handleViewLease}
        onViewAll={(type) => {
          const newFilters = { ...filters };
          switch (type) {
            case 'expiring':
              newFilters.upcomingExpiration = true;
              break;
            case 'missing':
              newFilters.missingDocuments = true;
              break;
            case 'indexation':
              newFilters.indexationDue = true;
              break;
          }
          handleFiltersChange(newFilters);
        }}
        loading={loading}
      />

      {/* Drawer de détail */}
      <LeasesDetailDrawer
        lease={selectedLease}
        isOpen={isDetailDrawerOpen}
        onClose={() => {
          setIsDetailDrawerOpen(false);
          setSelectedLease(null);
        }}
        onEdit={handleEditLease}
        onDelete={handleDeleteLease}
        onActions={handleLeaseActions}
        onViewFull={(lease) => {
          // Rediriger vers la page complète du bail
          window.open(`/biens/${lease.Property.id}/leases`, '_blank');
        }}
        onUploadDocument={(lease) => {
          // Ouvrir la modal d'actions pour upload
          handleLeaseActions(lease);
        }}
        onSendForSignature={(lease) => {
          // Ouvrir la modal d'actions pour envoi
          handleLeaseActions(lease);
        }}
        onTerminate={(lease) => {
          // Ouvrir la modal d'actions pour résiliation
          handleLeaseActions(lease);
        }}
        onLeaseUpdate={refreshAll}
      />

      {/* Modales */}
      <LeaseFormComplete
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={async (data) => {
          try {
            const response = await fetch('/api/leases', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data),
            });

            if (response.ok) {
              await refreshAll();
              setIsCreateModalOpen(false);
              toast.success('Bail créé avec succès');
            } else {
              const errorData = await response.json();
              if (errorData.details && Array.isArray(errorData.details)) {
                const errorMessages = errorData.details.map((d: any) => `${d.field}: ${d.message}`).join('\n');
                toast.error(`Erreur de validation:\n${errorMessages}`);
              } else {
                toast.error(`Erreur: ${errorData.error}`);
              }
            }
          } catch (error) {
            console.error('Error creating lease:', error);
            toast.error('Erreur lors de la création du bail');
          }
        }}
        title="Nouveau Bail"
      />

      {selectedLease && isEditModalOpen && (
        <LeaseEditModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedLease(null);
          }}
          onSubmit={async (data) => {
            try {
              const response = await fetch(`/api/leases/${selectedLease.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
              });

              if (response.ok) {
                await refreshAll();
                setIsEditModalOpen(false);
                setSelectedLease(null);
                toast.success('Bail modifié avec succès');
              } else {
                const errorData = await response.json();
                if (errorData.details && Array.isArray(errorData.details)) {
                  const errorMessages = errorData.details.map((d: any) => `${d.field}: ${d.message}`).join('\n');
                  toast.error(`Erreur de validation:\n${errorMessages}`);
                } else {
                  toast.error(`Erreur: ${errorData.error}`);
                }
              }
            } catch (error) {
              console.error('Error updating lease:', error);
              toast.error('Erreur lors de la modification du bail');
            }
          }}
          lease={selectedLease}
        />
      )}

      {selectedLease && isActionsModalOpen && (
        <LeaseActionsManager
          lease={selectedLease}
          onClose={() => {
            setIsActionsModalOpen(false);
            setSelectedLease(null);
          }}
          onSuccess={async () => {
            await refreshAll();
            setIsActionsModalOpen(false);
            setSelectedLease(null);
          }}
        />
      )}
    </div>
  );
}
