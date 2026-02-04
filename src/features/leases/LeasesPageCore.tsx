/**
 * Core Component pour la page Baux/Leases
 * 
 * Une seule source de vérité graphique utilisable en mode "normal" et "app-shell"
 * Toute la logique UI est centralisée ici.
 * 
 * Réplique EXACTEMENT le comportement de LeasesClient.tsx
 */

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { notify2 } from '@/lib/notify2';
import { Plus, ArrowUpDown, ArrowUp, ArrowDown, Loader2, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
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
import { useLeasesData, type LeasesFilters } from './hooks/useLeasesData';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
// Import supprimé : plus besoin du repository offline directement, on utilise les services via factories
import { useAlert } from '@/hooks/useAlert';
import { useSidebarOptional } from '@/contexts/SidebarContext';

export interface LeasesPageCoreProps {
  mode: 'normal' | 'app-shell';
}

export function LeasesPageCore({
  mode,
}: LeasesPageCoreProps) {
  const { organizationId } = useCurrentOrganization();
  const sidebarContext = useSidebarOptional();
  const router = mode === 'normal' ? useRouter() : null;
  const searchParamsHook = mode === 'normal' ? useSearchParams() : null;
  const { showAlert } = useAlert();

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

  // États des filtres
  const [filters, setFilters] = useState<LeasesFilters>({
    search: '',
    propertyId: '',
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
  
  // État pour forcer le rafraîchissement des KPI et graphiques
  const [refreshKey, setRefreshKey] = useState(0);

  // Utiliser le hook unifié pour les données
  const {
    leases,
    properties,
    tenants,
    totalCount,
    loading,
    error,
  } = useLeasesData({
    mode,
    filters: mode === 'app-shell' ? filters : undefined,
    activeKpiFilter,
  });

  // Charger les KPI avec le hook
  const { kpis, isLoading: kpisLoading } = useLeasesKpis({
    mode,
    refreshKey,
  });

  // Charger les graphiques avec le hook
  const { data: chartsData, isLoading: chartsLoading } = useLeasesCharts({
    mode,
    refreshKey,
  });

  // Nettoyer l'URL au montage (mode normal uniquement)
  useEffect(() => {
    if (mode === 'normal' && router && searchParamsHook) {
      const hasFilters = searchParamsHook.toString().length > 0;
      if (hasFilters) {
        router.replace('/baux', { scroll: false });
      }
    }
  }, [mode, router, searchParamsHook]);

  // Gestion des filtres
  const handleFiltersChange = useCallback((newFilters: LeasesFilters) => {
    setFilters(newFilters);
    if (mode === 'normal' && router) {
      const params = new URLSearchParams();
      Object.entries(newFilters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      const newURL = params.toString() ? `?${params.toString()}` : '';
      router.replace(`/baux${newURL}`, { scroll: false });
    }
  }, [mode, router]);

  // Gestion du filtre KPI (cartes filtrantes)
  const handleKpiFilterChange = useCallback((filterKey: string | null) => {
    if (filterKey === activeKpiFilter) {
      setActiveKpiFilter(null);
    } else {
      setActiveKpiFilter(filterKey);
    }
  }, [activeKpiFilter]);

  const handleResetFilters = useCallback(() => {
    const resetFilters: LeasesFilters = {
      search: '',
      propertyId: '',
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
    if (mode === 'normal' && router) {
      router.replace('/baux', { scroll: false });
    }
  }, [mode, router]);

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
    const orgId = organizationId || 'default';
    const isOnline = typeof navigator !== 'undefined' && navigator.onLine;

    try {
      // Utiliser le service via factory selon le mode
      const { createLeaseServiceWithMode } = await import('@/domain/services/leaseServiceFactory');
      const leaseService = createLeaseServiceWithMode(mode === 'app-shell' ? 'app-shell' : 'normal');

      // Supprimer chaque bail via le service (le service gère les protections)
      const results = await Promise.allSettled(
        leasesToProcess.map(lease => leaseService.deleteLease(lease.id, orgId))
      );

      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      // Gérer les erreurs de protection (baux actifs ou avec transactions)
      const protectedLeases: any[] = [];
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          const error = result.reason as Error;
          if (error.message.includes('actif') || error.message.includes('transactions')) {
            protectedLeases.push({
              id: leasesToProcess[index].id,
              propertyName: leasesToProcess[index].Property.name,
              tenantName: `${leasesToProcess[index].Tenant.firstName} ${leasesToProcess[index].Tenant.lastName}`,
              reason: error.message,
            });
          }
        }
      });

      // Si des baux sont protégés, afficher la modal
      if (protectedLeases.length > 0) {
        setProtectedLeasesForModal(protectedLeases);
        setShowCannotDeleteModal(true);
        // Ne pas supprimer les baux qui ont réussi, on les garde dans la liste pour réessayer
        return;
      }

      // Afficher le message selon le statut online/offline
      if (mode === 'app-shell' && isOnline) {
        // Si online, déclencher une sync immédiate
        try {
          const { getGlobalSyncService } = await import('@/lib/offline/syncGlobal');
          const syncService = getGlobalSyncService();
          await syncService.syncAllPendingToRemote(orgId);

          await showAlert({
            type: 'success',
            title: 'Baux supprimés',
            message: `${succeeded} bail${succeeded > 1 ? 'x' : ''} supprimé${succeeded > 1 ? 's' : ''} localement et sur le serveur.`,
          });
        } catch (syncError) {
          console.error('Error syncing delete leases operation:', syncError);
          await showAlert({
            type: 'success',
            title: 'Baux supprimés localement',
            message: `${succeeded} bail${succeeded > 1 ? 'x' : ''} supprimé${succeeded > 1 ? 's' : ''} localement.\nLa suppression sera synchronisée avec le serveur lors de la prochaine synchronisation.`,
          });
        }
      } else if (mode === 'app-shell') {
        await showAlert({
          type: 'success',
          title: 'Baux supprimés (mode hors-ligne)',
          message: `${succeeded} bail${succeeded > 1 ? 'x' : ''} supprimé${succeeded > 1 ? 's' : ''} localement.\nLa suppression sera automatiquement synchronisée avec le serveur dès que la connexion sera rétablie.`,
        });
      } else {
        if (succeeded > 0) {
          notify2.success(`${succeeded} bail${succeeded > 1 ? 'x' : ''} supprimé${succeeded > 1 ? 's' : ''} avec succès`);
        }
        if (failed > 0) {
          notify2.error(`${failed} bail${failed > 1 ? 'x' : ''} n'ont pas pu être supprimé${failed > 1 ? 's' : ''}`);
        }
      }

      // Rafraîchir l'UI
      if (mode === 'normal' && router) {
        router.refresh();
      } else {
        // ✅ APP-SHELL: Émettre événement avec scope 'global' pour la page globale
        window.dispatchEvent(new CustomEvent('leases:refresh', { 
          detail: { scope: 'global', reason: 'delete_multiple' } 
        }));
      }
      setRefreshKey(prev => prev + 1);
      setShowDeleteConfirmModal(false);
      setLeasesToConfirmDelete([]);
      setSelectedIds(new Set());
      
      if (isDrawerOpen) {
        setIsDrawerOpen(false);
      }
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      notify2.error('Erreur lors de la suppression des baux');
    }
  }, [leasesToConfirmDelete, isDrawerOpen, mode, organizationId, router, showAlert]);

  const handleActionsLease = useCallback((lease: LeaseWithDetails) => {
    console.log('Actions pour le bail:', lease.id);
  }, []);

  // Fonction pour rafraîchir un bail spécifique
  const handleLeaseUpdate = useCallback(async () => {
    setRefreshKey(prev => prev + 1);
    
    if (selectedLease && mode === 'normal') {
      try {
        const response = await fetch(`/api/leases/${selectedLease.id}`);
        if (response.ok) {
          const updatedLease = await response.json();
          setSelectedLease(updatedLease.data || updatedLease);
        }
      } catch (error) {
        console.error('Erreur lors du rechargement du bail:', error);
      }
    }
  }, [selectedLease, mode]);

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
  const sortedLeases = useMemo(() => {
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
      const orgId = organizationId || 'default';
      const isOnline = typeof navigator !== 'undefined' && navigator.onLine;

      // Utiliser le service via factory selon le mode
      const { createLeaseServiceWithMode } = await import('@/domain/services/leaseServiceFactory');
      const leaseService = createLeaseServiceWithMode(mode === 'app-shell' ? 'app-shell' : 'normal');

      if (data.id) {
        // Mise à jour
        await leaseService.updateLease(data.id, orgId, {
          propertyId: data.propertyId,
          tenantId: data.tenantId,
          type: data.type,
          furnishedType: data.furnishedType,
          startDate: data.startDate,
          endDate: data.endDate,
          rentAmount: data.rentAmount,
          deposit: data.deposit,
          paymentDay: data.paymentDay,
          indexationType: data.indexationType,
          notes: data.notes,
          status: data.status,
          signedPdfUrl: data.signedPdfUrl,
          chargesRecupMensuelles: data.chargesRecupMensuelles,
          chargesNonRecupMensuelles: data.chargesNonRecupMensuelles,
        });

        // En mode app-shell, déclencher sync si online
        if (mode === 'app-shell' && isOnline) {
          try {
            const { getGlobalSyncService } = await import('@/lib/offline/syncGlobal');
            const syncService = getGlobalSyncService();
            await syncService.syncAllPendingToRemote(orgId);
            
            await showAlert({
              type: 'success',
              title: 'Bail mis à jour',
              message: 'Le bail a été mis à jour localement et sur le serveur.',
            });
          } catch (syncError) {
            console.error('Error syncing lease operation:', syncError);
            await showAlert({
              type: 'success',
              title: 'Bail mis à jour localement',
              message: 'Le bail a été mis à jour localement.\nLa synchronisation sera effectuée lors de la prochaine synchronisation.',
            });
          }
        } else if (mode === 'app-shell') {
          await showAlert({
            type: 'success',
            title: 'Bail mis à jour (mode hors-ligne)',
            message: 'Le bail a été mis à jour localement.\nIl sera automatiquement synchronisé avec le serveur dès que la connexion sera rétablie.',
          });
        } else {
          notify2.success('Bail mis à jour avec succès');
        }
      } else {
        // Création
        await leaseService.createLease({
          organizationId: orgId,
          propertyId: data.propertyId,
          tenantId: data.tenantId,
          type: data.type,
          furnishedType: data.furnishedType,
          startDate: data.startDate,
          endDate: data.endDate,
          rentAmount: data.rentAmount,
          deposit: data.deposit,
          paymentDay: data.paymentDay,
          indexationType: data.indexationType,
          notes: data.notes,
          status: data.status,
          chargesRecupMensuelles: data.chargesRecupMensuelles,
          chargesNonRecupMensuelles: data.chargesNonRecupMensuelles,
        });

        // En mode app-shell, déclencher sync si online
        if (mode === 'app-shell' && isOnline) {
          try {
            const { getGlobalSyncService } = await import('@/lib/offline/syncGlobal');
            const syncService = getGlobalSyncService();
            await syncService.syncAllPendingToRemote(orgId);
            
            await showAlert({
              type: 'success',
              title: 'Bail créé',
              message: 'Le bail a été créé localement et sur le serveur.',
            });
          } catch (syncError) {
            console.error('Error syncing lease operation:', syncError);
            await showAlert({
              type: 'success',
              title: 'Bail créé localement',
              message: 'Le bail a été créé localement.\nLa synchronisation sera effectuée lors de la prochaine synchronisation.',
            });
          }
        } else if (mode === 'app-shell') {
          await showAlert({
            type: 'success',
            title: 'Bail créé (mode hors-ligne)',
            message: 'Le bail a été créé localement.\nIl sera automatiquement synchronisé avec le serveur dès que la connexion sera rétablie.',
          });
        } else {
          notify2.success('Bail créé avec succès');
        }
      }

      setIsModalOpen(false);
      setIsEditModalOpen(false);
      setSelectedLease(null);
      
      // Rafraîchir l'UI
      if (mode === 'normal' && router) {
        router.refresh();
      } else {
        // ✅ APP-SHELL: Émettre événement avec scope 'global' pour la page globale
        window.dispatchEvent(new CustomEvent('leases:refresh', { 
          detail: { scope: 'global', reason: data.id ? 'update' : 'crud' } 
        }));
      }
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error(`Erreur lors de ${data.id ? 'la mise à jour' : 'la création'} du bail:`, error);
      notify2.error(error instanceof Error ? error.message : `Erreur lors de ${data.id ? 'la mise à jour' : 'la création'} du bail`);
      throw error;
    }
  };

  // Fonction pour résilier plusieurs baux
  const handleTerminateMultiple = async (leaseIds: string[]) => {
    try {
      const orgId = organizationId || 'default';
      const isOnline = typeof navigator !== 'undefined' && navigator.onLine;

      // Utiliser le service via factory selon le mode
      const { createLeaseServiceWithMode } = await import('@/domain/services/leaseServiceFactory');
      const leaseService = createLeaseServiceWithMode(mode === 'app-shell' ? 'app-shell' : 'normal');

      // Résilier chaque bail via le service (mise à jour du statut)
      const results = await Promise.allSettled(
        leaseIds.map(leaseId => leaseService.updateLease(leaseId, orgId, { status: 'RÉSILIÉ' }))
      );

      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      // Afficher le message selon le statut online/offline
      if (mode === 'app-shell' && isOnline) {
        // Si online, déclencher une sync immédiate
        try {
          const { getGlobalSyncService } = await import('@/lib/offline/syncGlobal');
          const syncService = getGlobalSyncService();
          await syncService.syncAllPendingToRemote(orgId);

          await showAlert({
            type: 'success',
            title: 'Baux résiliés',
            message: `${succeeded} bail${succeeded > 1 ? 'x' : ''} résilié${succeeded > 1 ? 's' : ''} localement et sur le serveur. Vous pouvez maintenant les supprimer.`,
          });
        } catch (syncError) {
          console.error('Error syncing terminate leases operation:', syncError);
          await showAlert({
            type: 'success',
            title: 'Baux résiliés localement',
            message: `${succeeded} bail${succeeded > 1 ? 'x' : ''} résilié${succeeded > 1 ? 's' : ''} localement. La synchronisation sera effectuée lors de la prochaine synchronisation.`,
          });
        }
      } else if (mode === 'app-shell') {
        await showAlert({
          type: 'success',
          title: 'Baux résiliés (mode hors-ligne)',
          message: `${succeeded} bail${succeeded > 1 ? 'x' : ''} résilié${succeeded > 1 ? 's' : ''} localement. La synchronisation sera automatique dès que la connexion sera rétablie.`,
        });
      } else {
        if (succeeded > 0) {
          notify2.success(`${succeeded} bail${succeeded > 1 ? 'x' : ''} résilié${succeeded > 1 ? 's' : ''} avec succès. Vous pouvez maintenant les supprimer.`);
        }
        if (failed > 0) {
          notify2.error(`${failed} bail${failed > 1 ? 'x' : ''} n'ont pas pu être résilié${failed > 1 ? 's' : ''}`);
        }
      }

      // Rafraîchir l'UI
      if (mode === 'normal' && router) {
        router.refresh();
      } else {
        // ✅ APP-SHELL: Émettre événement avec scope 'global' pour la page globale
        window.dispatchEvent(new CustomEvent('leases:refresh', { 
          detail: { scope: 'global', reason: 'update_multiple' } 
        }));
      }
      setRefreshKey(prev => prev + 1);
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

  // États de chargement et erreur
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
        <span className="ml-3 text-gray-600">Chargement des baux...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6">
          <div className="text-center text-red-600">
            <p className="font-medium">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Rendu principal
  return (
    <div className="space-y-6 w-full max-w-full">
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
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 truncate min-w-0">Baux</h1>
            <div className="flex-shrink-0">
              <button
                onClick={handleCreateLease}
                className="inline-flex items-center justify-center h-8 w-8 text-orange-600 border border-orange-200 rounded-lg bg-white hover:bg-gradient-to-r hover:from-orange-500 hover:to-red-500 hover:text-white transition-all duration-300 ease-out focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                aria-label="Nouveau bail"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Ligne 2 : Description */}
        <p className="text-sm sm:text-base text-gray-600">Suivi global des baux et de leurs conditions financières</p>
      </div>

      {/* Graphiques - TOUS sur la même ligne (AU DESSUS DES CARTES) */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
        {/* Graphique 1 : Évolution des loyers (2 colonnes) */}
        <div className="md:col-span-2">
          <LeasesRentEvolutionChart
            monthlyData={chartsData?.rentEvolution?.monthly || []}
            yearlyData={chartsData?.rentEvolution?.yearly || []}
            isLoading={chartsLoading}
          />
        </div>
        
        {/* Graphique 2 : Répartition par type de meublé (1 colonne) */}
        <div className="md:col-span-1">
          <LeasesByFurnishedChart
            data={chartsData?.byFurnished || []}
            isLoading={chartsLoading}
          />
        </div>
        
        {/* Graphique 3 : Cautions & Loyers cumulés (1 colonne) */}
        <div className="md:col-span-1">
          <LeasesDepositsRentsChart
            data={chartsData?.depositsRents || {
              totalDeposits: 0,
              monthlyTotal: 0,
              yearlyTotal: 0,
            }}
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

      {/* Filtres avancés */}
      <LeasesFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onResetFilters={handleResetFilters}
        properties={properties}
        tenants={tenants}
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
              : 'Aucun bail'}
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
          <LeasesTableNew
            leases={sortedLeases}
            loading={loading}
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

      {/* Modale de création */}
      {isModalOpen && (
        <LeaseFormComplete
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onSubmit={handleModalSubmit}
          title="Nouveau bail"
          defaultPropertyId={undefined} // ✅ Page globale : pas de defaultPropertyId, l'utilisateur doit choisir
          properties={properties} // ✅ Passer properties depuis IndexedDB
          tenants={tenants} // ✅ Passer tenants depuis IndexedDB
          mode={mode} // ✅ Passer le mode
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
          mode={mode} // ✅ Passer le mode
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
