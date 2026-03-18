/**
 * Core Component pour la page Biens/Properties
 * 
 * Une seule source de vérité graphique utilisable en mode "normal" et "app-shell"
 * Toute la logique UI est centralisée ici.
 */

'use client';

import React, { useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { SearchInput } from '@/components/ui/SearchInput';
import { Table, TableHeader, TableHeaderCell, TableBody, TableRow, TableCell } from '@/components/ui/Table';
import { TableV2, TableHeaderV2, TableHeaderCellV2, TableBodyV2, TableRowV2, TableCellV2 } from '@/components/ui2/TableV2';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { PaginationV2 } from '@/components/ui2/PaginationV2';
import { Loader2, Plus, Edit, Trash2, MapPin, Building2, Archive, UserCheck, UserX, Eye, Download, CheckCircle, Menu, X, LayoutGrid, List } from 'lucide-react';
import { NetCumulativeChart } from '@/features/analytics/components/NetCumulativeChart';
import PropertyForm from '@/components/forms/PropertyForm';
import type { PropertyWithRelations } from '@/lib/db/PropertyRepo';
import type { Property, Transaction } from '@/features/analytics/types';
import { usePropertiesData, type PropertiesPageData } from './hooks/usePropertiesData';
import type { UsePropertiesDataOptions } from './hooks/usePropertiesData';
import { useAlert } from '@/hooks/useAlert';
import { useLoading } from '@/contexts/LoadingContext';
import { ConfirmDeletePropertyDialog, type DeleteMode } from '@/components/properties/ConfirmDeletePropertyDialog';
import type { PropertyStats } from '@/services/deletePropertySmart';
// Imports supprimés : plus besoin des repositories offline directement, on utilise les services via factories
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import Link from 'next/link';
import { cn } from '@/utils/cn';
import { useSidebarOptional } from '@/contexts/SidebarContext';
// ⚠️ OFFLINE-FIRST: Import statique pour éviter ChunkLoadError en mode offline
import { createPropertyServiceWithMode } from '@/domain/services/propertyServiceFactory';
import { getGlobalSyncService } from '@/lib/offline/syncGlobal';
import { getPropertyRepositoryOffline } from '@/lib/offline/repositories/PropertyRepositoryOffline';
import { getTransactionRepositoryOffline } from '@/lib/offline/repositories/TransactionRepositoryOffline';
import {
  computePropertiesDashboard,
  getCashflowIndicator,
  getRendementIndicator,
  getScoreLabelText,
  getScoreDotColor,
  groupAlertsByType,
  getHealthHeatmap,
  getPropertySortPriority,
  CASHFLOW_LABEL,
} from './utils/propertyDashboard';

export interface PropertiesPageCoreProps {
  mode: 'normal' | 'app-shell';
  initialData?: UsePropertiesDataOptions['initialData'];
  initialStats?: UsePropertiesDataOptions['initialStats'];
  initialPropertiesForCharts?: UsePropertiesDataOptions['initialPropertiesForCharts'];
  initialTransactionsForCharts?: UsePropertiesDataOptions['initialTransactionsForCharts'];
}

export function PropertiesPageCore({
  mode,
  initialData,
  initialStats,
  initialPropertiesForCharts,
  initialTransactionsForCharts,
}: PropertiesPageCoreProps) {
  const { organizationId } = useCurrentOrganization();
  const router = mode === 'normal' ? useRouter() : null;
  const { showAlert, showConfirm } = useAlert();
  const { isLoading: checkLoading } = useLoading();
  const sidebarContext = useSidebarOptional();
  
  // État pour les filtres - initialiser depuis searchParams si en mode normal
  const searchParamsHook = mode === 'normal' ? useSearchParams() : null;
  
  // UI2 est maintenant activé par défaut
  // Le flag ui2=false permet de désactiver UI2 si nécessaire
  const useUI2 = mode === 'normal' 
    ? (searchParamsHook?.get('ui2') !== 'false')
    : (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('ui2') !== 'false');
  
  const getInitialStatusFilter = () => {
    if (mode === 'normal' && searchParamsHook) {
      const status = searchParamsHook.get('status');
      if (status === 'occupied') return 'occupied';
      if (status === 'vacant') return 'vacant';
    }
    return 'total';
  };

  const [statusFilter, setStatusFilter] = useState<'total' | 'occupied' | 'vacant'>(getInitialStatusFilter());
  const [search, setSearch] = useState(mode === 'normal' ? (searchParamsHook?.get('search') || '') : '');
  const [includeArchived, setIncludeArchived] = useState(mode === 'normal' ? (searchParamsHook?.get('includeArchived') === 'true') : false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // États locaux
  const [propertyFormOpen, setPropertyFormOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<PropertyWithRelations | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingProperty, setDeletingProperty] = useState<PropertyWithRelations | null>(null);
  const [propertyStats, setPropertyStats] = useState<PropertyStats | null>(null);
  const [availableProperties, setAvailableProperties] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingPropertyId, setLoadingPropertyId] = useState<string | null>(null);

  // Utiliser le hook unifié pour les données avec les filtres actuels
  // En mode app-shell, passer les filtres pour déclencher le rechargement
  const {
    properties,
    stats,
    propertiesForCharts,
    transactionsForCharts,
    loading,
    error,
  } = usePropertiesData({
    mode,
    initialData,
    initialStats,
    initialPropertiesForCharts,
    initialTransactionsForCharts,
    search: mode === 'app-shell' ? search : undefined,
    includeArchived: mode === 'app-shell' ? includeArchived : undefined,
  });

  // Récupérer les transactions complètes avec label pour le hover
  const [transactionsWithLabel, setTransactionsWithLabel] = useState<Array<{ id: string; propertyId: string; date: string; amount: number; label: string }>>([]);
  
  React.useEffect(() => {
    const loadTransactions = async () => {
      if (!organizationId) return;
      
      try {
        if (mode === 'app-shell') {
          const transRepo = getTransactionRepositoryOffline();
          const allTransactions = await transRepo.getAll(organizationId);
          setTransactionsWithLabel(
            allTransactions
              .filter(t => t.label && String(t.label).trim() !== '') // Filtrer les transactions sans label
              .map(t => ({
                id: t.id,
                propertyId: String(t.propertyId || ''), // S'assurer que c'est une string
                date: typeof t.date === 'string' ? t.date : (t.date as any)?.toISOString?.() || String(t.date || ''),
                amount: Number(t.amount || 0),
                label: String(t.label || '').trim()
              }))
          );
        } else {
          // Mode normal : récupérer depuis l'API
          try {
            const response = await fetch(`/api/transactions?limit=1000`);
            if (response.ok) {
              const data = await response.json();
              setTransactionsWithLabel(
                (data.data || [])
                  .filter((t: any) => t.label && String(t.label).trim() !== '') // Filtrer les transactions sans label
                  .map((t: any) => ({
                    id: t.id,
                    propertyId: String(t.propertyId || ''), // S'assurer que c'est une string
                    date: typeof t.date === 'string' ? t.date : (t.date ? new Date(t.date).toISOString() : ''),
                    amount: Number(t.amount || 0),
                    label: String(t.label || '').trim()
                  }))
              );
            }
          } catch (apiError) {
            console.error('Erreur API transactions:', apiError);
          }
        }
      } catch (error) {
        console.error('Erreur lors du chargement des transactions:', error);
      }
    };
    loadTransactions();
  }, [mode, organizationId]);

  // En mode app-shell, réinitialiser la page quand les filtres changent
  React.useEffect(() => {
    if (mode === 'app-shell') {
      setCurrentPage(1);
    }
  }, [mode, search, includeArchived, statusFilter]);

  // Filtrer les propriétés selon le statut
  // En mode normal, on utilise directement les données du serveur (déjà paginées)
  // En mode app-shell, on filtre et pagine côté client
  const filteredProperties = useMemo(() => {
    if (mode === 'normal') {
      // En mode normal, utiliser directement les propriétés (déjà filtrées et paginées par le serveur)
      return properties;
    }
    
    // Mode app-shell : filtrer côté client
    let filtered = [...properties];

    if (statusFilter === 'occupied') {
      filtered = filtered.filter(p => {
        const prop = p as any;
        return (prop.occupation === 'OCCUPIED' || (prop.Lease?.length || 0) > 0) && !prop.isArchived;
      });
    } else if (statusFilter === 'vacant') {
      filtered = filtered.filter(p => {
        const prop = p as any;
        return (prop.occupation === 'VACANT' || prop.isArchived) && (prop.Lease?.length || 0) === 0;
      });
    }

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(searchLower) ||
        (p as any).address?.toLowerCase().includes(searchLower) ||
        (p as any).city?.toLowerCase().includes(searchLower)
      );
    }

    if (!includeArchived) {
      filtered = filtered.filter(p => !(p as any).isArchived);
    }

    return filtered;
  }, [mode, properties, statusFilter, search, includeArchived]);

  // Dashboard pilotage : alertes, KPIs, métriques par bien (calcul côté frontend)
  const dashboard = useMemo(
    () => computePropertiesDashboard(properties, transactionsForCharts),
    [properties, transactionsForCharts]
  );
  const { alerts: parcelAlerts, kpis: dashboardKpis, metricsByProperty } = dashboard;

  // Tri intelligent (app-shell) : alertes → cashflow négatif → vacance → autres
  const sortedFilteredProperties = useMemo(() => {
    if (mode === 'normal') return filteredProperties;
    return [...filteredProperties].sort((a, b) => {
      const propA = a as any;
      const propB = b as any;
      const occA = (propA.Lease?.length ?? 0) > 0 || propA.occupation === 'OCCUPIED';
      const occB = (propB.Lease?.length ?? 0) > 0 || propB.occupation === 'OCCUPIED';
      const prioA = getPropertySortPriority(a.id, metricsByProperty.get(a.id), occA);
      const prioB = getPropertySortPriority(b.id, metricsByProperty.get(b.id), occB);
      return prioA - prioB;
    });
  }, [mode, filteredProperties, metricsByProperty]);

  const totalPages = mode === 'normal' && initialData?.pagination
    ? initialData.pagination.pages
    : Math.ceil(sortedFilteredProperties.length / itemsPerPage);

  const paginatedProperties = useMemo(() => {
    if (mode === 'normal') return filteredProperties;
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return sortedFilteredProperties.slice(start, end);
  }, [mode, filteredProperties, sortedFilteredProperties, currentPage, itemsPerPage, initialData]);

  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [showAlertsDetail, setShowAlertsDetail] = useState(false);

  // Handlers de recherche et filtres
  const handleSearch = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
    if (mode === 'normal' && router && searchParamsHook) {
      const params = new URLSearchParams(searchParamsHook.toString());
      if (value) {
        params.set('search', value);
      } else {
        params.delete('search');
      }
      params.delete('page');
      router.push(`/biens?${params.toString()}`);
    }
  };

  const handleStatusFilter = (filter: 'total' | 'occupied' | 'vacant') => {
    setStatusFilter(filter);
    setCurrentPage(1);
    if (mode === 'normal' && router && searchParamsHook) {
      const params = new URLSearchParams(searchParamsHook.toString());
      if (filter === 'total') {
        params.delete('status');
      } else {
        params.set('status', filter);
      }
      params.delete('page');
      router.push(`/biens?${params.toString()}`);
    }
  };

  const handleToggleArchived = () => {
    const newValue = !includeArchived;
    setIncludeArchived(newValue);
    setCurrentPage(1);
    if (mode === 'normal' && router && searchParamsHook) {
      const params = new URLSearchParams(searchParamsHook.toString());
      if (newValue) {
        params.set('includeArchived', 'true');
      } else {
        params.delete('includeArchived');
      }
      params.delete('page');
      router.push(`/biens?${params.toString()}`);
    }
  };

  const handlePageChange = (page: number) => {
    if (mode === 'normal' && router && searchParamsHook) {
      // En mode normal, mettre à jour l'URL pour déclencher un rechargement serveur
      const params = new URLSearchParams(searchParamsHook.toString());
      params.set('page', page.toString());
      router.push(`/biens?${params.toString()}`);
    } else {
      // En mode app-shell, mettre à jour l'état local
      setCurrentPage(page);
    }
  };

  // Handlers de propriétés
  const handlePropertySubmit = async (data: any) => {
    try {
      const orgId = organizationId || 'default';
      const isOnline = typeof navigator !== 'undefined' && navigator.onLine;

      // Utiliser le service via factory selon le mode
      const propertyService = createPropertyServiceWithMode(mode === 'app-shell' ? 'app-shell' : 'normal');

      if (editingProperty) {
        // Mise à jour
        const result = await propertyService.updateProperty(editingProperty.id, orgId, {
          name: data.name,
          type: data.type,
          address: data.address,
          postalCode: data.postalCode,
          city: data.city,
          surface: data.surface,
          rooms: data.rooms,
          acquisitionDate: data.acquisitionDate,
          acquisitionPrice: data.acquisitionPrice,
          notaryFees: data.notaryFees,
          currentValue: data.currentValue,
          status: data.status,
          occupation: data.occupation,
          notes: data.notes,
          managementCompanyId: data.managementCompanyId,
          fiscalTypeId: data.fiscalTypeId,
          fiscalRegimeId: data.fiscalRegimeId,
          rentalMode: data.rentalMode,
          airbnbListingId: data.airbnbListingId,
        });

        // En mode app-shell, déclencher sync si online
        if (mode === 'app-shell' && isOnline) {
          try {
            const syncService = getGlobalSyncService();
            await syncService.syncAllPendingToRemote(orgId);
            
            await showAlert({
              type: 'success',
              title: 'Bien mis à jour',
              message: 'Le bien a été mis à jour localement et sur le serveur.',
            });
          } catch (syncError) {
            console.error('Error syncing property operation:', syncError);
            await showAlert({
              type: 'success',
              title: 'Bien mis à jour localement',
              message: 'Le bien a été mis à jour localement.\nLa synchronisation sera effectuée lors de la prochaine synchronisation.',
            });
          }
        } else if (mode === 'app-shell') {
          await showAlert({
            type: 'success',
            title: 'Bien mis à jour (mode hors-ligne)',
            message: 'Le bien a été mis à jour localement.\nIl sera automatiquement synchronisé avec le serveur dès que la connexion sera rétablie.',
          });
        } else {
          await showAlert({
            type: 'success',
            title: 'Bien mis à jour',
            message: 'Le bien a été mis à jour avec succès.',
          });
        }
      } else {
        // Création
        const result = await propertyService.createProperty({
          organizationId: orgId,
          name: data.name,
          type: data.type,
          address: data.address,
          postalCode: data.postalCode,
          city: data.city,
          surface: data.surface,
          rooms: data.rooms,
          acquisitionDate: data.acquisitionDate,
          acquisitionPrice: data.acquisitionPrice,
          notaryFees: data.notaryFees,
          currentValue: data.currentValue,
          status: data.status || 'vacant',
          occupation: data.occupation || 'VACANT',
          notes: data.notes,
          managementCompanyId: data.managementCompanyId,
          fiscalTypeId: data.fiscalTypeId,
          fiscalRegimeId: data.fiscalRegimeId,
          rentalMode: data.rentalMode,
          airbnbListingId: data.airbnbListingId,
        });

        // En mode app-shell, déclencher sync si online
        if (mode === 'app-shell' && isOnline) {
          try {
            const syncService = getGlobalSyncService();
            await syncService.syncAllPendingToRemote(orgId);
            
            await showAlert({
              type: 'success',
              title: 'Bien créé',
              message: 'Le bien a été créé localement et sur le serveur.',
            });
          } catch (syncError) {
            console.error('Error syncing property operation:', syncError);
            await showAlert({
              type: 'success',
              title: 'Bien créé localement',
              message: 'Le bien a été créé localement.\nLa synchronisation sera effectuée lors de la prochaine synchronisation.',
            });
          }
        } else if (mode === 'app-shell') {
          await showAlert({
            type: 'success',
            title: 'Bien créé (mode hors-ligne)',
            message: 'Le bien a été créé localement.\nIl sera automatiquement synchronisé avec le serveur dès que la connexion sera rétablie.',
          });
        } else {
          await showAlert({
            type: 'success',
            title: 'Bien créé',
            message: 'Le bien a été créé avec succès.',
          });
        }

        // Navigation après création (mode normal uniquement)
        if (mode === 'normal' && router) {
          router.push(`/biens/${result.property.id}/transactions`);
        }
      }

      setPropertyFormOpen(false);
      setEditingProperty(null);
      
      // Rafraîchir l'UI
      if (mode === 'normal' && router) {
        router.refresh();
      } else {
        // ✅ APP-SHELL: Event avec payload standard
        window.dispatchEvent(new CustomEvent('properties:refresh', { 
          detail: { scope: 'global', reason: 'crud' } 
        }));
      }
    } catch (error: any) {
      console.error('Error saving property:', error);
      await showAlert({
        type: 'error',
        title: 'Erreur de sauvegarde',
        message: error.message || 'Une erreur est survenue lors de la sauvegarde.',
      });
    }
  };

  const handleDeleteProperty = async (property: PropertyWithRelations) => {
    if (!organizationId) return;

    try {
      // Utiliser le service pour récupérer les stats
      const propertyService = createPropertyServiceWithMode(mode === 'app-shell' ? 'app-shell' : 'normal');
      
      // Récupérer les stats via le service
      const stats = await propertyService.getPropertyStats(property.id, organizationId);

      // Récupérer les autres biens disponibles pour le transfert
      let availableProperties: Array<{ id: string; name: string }> = [];
      
      if (mode === 'app-shell') {
        const allProperties = await getPropertyRepositoryOffline().getAll(organizationId, { includeArchived: false });
        availableProperties = allProperties
          .filter(p => p.id !== property.id)
          .map(p => ({ id: p.id, name: p.name }));
      } else {
        // Mode normal : charger depuis l'API (lecture seule, pas de logique métier)
        const propertiesResponse = await fetch(`/api/properties?limit=10000`);
        if (propertiesResponse.ok) {
          const propertiesData = await propertiesResponse.json();
          availableProperties = (propertiesData.data || [])
            .filter((p: any) => p.id !== property.id)
            .map((p: any) => ({ id: p.id, name: p.name }));
        }
      }

      setDeletingProperty(property);
      setPropertyStats(stats);
      setAvailableProperties(availableProperties);
      setDeleteDialogOpen(true);
    } catch (error: any) {
      console.error('Error loading property stats:', error);
      await showAlert({
        type: 'error',
        title: 'Erreur',
        message: 'Impossible de charger les statistiques du bien.',
      });
    }
  };

  const handleDeleteConfirmed = async (deleteMode: DeleteMode, targetPropertyId?: string) => {
    if (!deletingProperty || !organizationId) return;

    try {
      const isOnline = typeof navigator !== 'undefined' && navigator.onLine;

      // Utiliser le service via factory selon le mode
      const propertyService = createPropertyServiceWithMode(mode === 'app-shell' ? 'app-shell' : 'normal');

      // Appeler le service (toute la logique métier est dans PropertyService)
      await propertyService.deleteProperty(deletingProperty.id, organizationId, {
        mode: deleteMode,
        targetPropertyId,
      });

      // Afficher le message selon le statut online/offline
      if (mode === 'app-shell' && isOnline) {
        // Si online, déclencher une sync immédiate pour supprimer sur le serveur
        try {
          const syncService = getGlobalSyncService();
          // Synchroniser uniquement les pendingOps (pas de full sync)
          await syncService.syncAllPendingToRemote(organizationId);
          
          await showAlert({
            type: 'success',
            title: 'Bien supprimé',
            message: 'Le bien a été supprimé localement et sur le serveur.\nToutes les données associées ont été mises à jour.',
          });
        } catch (syncError) {
          // Si la sync échoue, on affiche quand même le message de succès local
          console.error('Error syncing delete operation:', syncError);
          await showAlert({
            type: 'success',
            title: 'Bien supprimé',
            message: 'Le bien a été supprimé localement.\nLa suppression sera synchronisée avec le serveur lors de la prochaine synchronisation.',
          });
        }
      } else if (mode === 'app-shell') {
        await showAlert({
          type: 'success',
          title: 'Bien supprimé (mode hors-ligne)',
          message: 'Le bien a été supprimé localement.\nLa suppression sera automatiquement synchronisée avec le serveur dès que la connexion sera rétablie.',
        });
      } else {
        await showAlert({
          type: 'success',
          title: 'Bien supprimé',
          message: 'Le bien a été supprimé avec succès.',
        });
      }

      // Rafraîchir l'UI
      if (mode === 'normal' && router) {
        router.refresh();
      } else {
        // ✅ APP-SHELL: Event avec payload standard
        window.dispatchEvent(new CustomEvent('properties:refresh', { 
          detail: { scope: 'global', reason: 'delete' } 
        }));
      }

      setDeleteDialogOpen(false);
      setDeletingProperty(null);
      setPropertyStats(null);
    } catch (error: any) {
      console.error('Error deleting property:', error);
      await showAlert({
        type: 'error',
        title: 'Erreur de suppression',
        message: error.message || 'Une erreur est survenue lors de la suppression.',
      });
    }
  };

  const handlePropertyCreated = () => {
    setPropertyFormOpen(false);
    // Pour app-shell : déclencher un rechargement des données via un événement
    // Le hook écoutera cet événement et déclenchera un refresh
    if (mode === 'app-shell') {
      // ✅ APP-SHELL: Event avec payload standard
      window.dispatchEvent(new CustomEvent('properties:refresh', { 
        detail: { scope: 'global', reason: 'crud' } 
      }));
    } else if (mode === 'normal' && router) {
      router.refresh();
    }
  };

  // En mode app-shell, écouter les changements de searchParams depuis l'URL pour synchroniser l'état
  React.useEffect(() => {
    if (mode === 'normal' && searchParamsHook) {
      const status = searchParamsHook.get('status');
      if (status === 'occupied' && statusFilter !== 'occupied') {
        setStatusFilter('occupied');
      } else if (status === 'vacant' && statusFilter !== 'vacant') {
        setStatusFilter('vacant');
      } else if (!status && statusFilter !== 'total') {
        setStatusFilter('total');
      }

      const urlSearch = searchParamsHook.get('search') || '';
      if (urlSearch !== search) {
        setSearch(urlSearch);
      }

      const urlIncludeArchived = searchParamsHook.get('includeArchived') === 'true';
      if (urlIncludeArchived !== includeArchived) {
        setIncludeArchived(urlIncludeArchived);
      }

      const urlPage = searchParamsHook.get('page');
      if (urlPage) {
        const page = parseInt(urlPage);
        if (page !== currentPage) {
          setCurrentPage(page);
        }
      }
    }
  }, [mode, searchParamsHook, statusFilter, search, includeArchived, currentPage]);


  // Helpers UI — icône type de bien (emoji pour lisibilité)
  const getPropertyTypeEmoji = (type: string): string => {
    switch (type) {
      case 'house': return '🏠';
      case 'apartment': return '🏢';
      case 'garage': return '🚗';
      case 'commercial': return '🏬';
      case 'land': return '🌳';
      default: return '🏠';
    }
  };

  const getPropertyShortAddress = (prop: any): string => {
    const parts = [prop.address, prop.postalCode, prop.city].filter(Boolean);
    return parts.length ? parts.join(', ') : '—';
  };

  const getStatusBadge = (property: PropertyWithRelations) => {
    const prop = property as any;
    if (prop.isArchived) {
      return (
        <Badge variant="warning" size="sm" className="bg-gray-100 text-gray-800 border-gray-300">
          <Archive className="h-3 w-3 mr-1" />
          Archivé
        </Badge>
      );
    }
    
    if (prop.occupation === 'OCCUPIED' || (prop.Lease?.length || 0) > 0) {
      return <Badge variant="success">Occupé</Badge>;
    } else {
      return <Badge variant="warning">Vacant</Badge>;
    }
  };

  const handlePropertyClick = (propertyId: string) => {
    if (mode === 'normal' && router) {
      setLoadingPropertyId(propertyId);
      router.push(`/biens/${propertyId}/transactions`);
    } else {
      // ✅ CORRECTION: Navigation atomique en app-shell - une seule opération URL
      setLoadingPropertyId(propertyId);
      const newUrl = `/app?view=property&propertyId=${propertyId}&tab=transactions`;
      
      console.log('[PropertiesPageCore] 🖱️ Clic bien → navigation atomique:', newUrl);
      
      // ✅ Navigation atomique: une seule écriture URL, useSearchParams() réagira automatiquement
      window.history.pushState({ view: 'property', propertyId, tab: 'transactions' }, '', newUrl);
      
      // ❌ SUPPRIMÉ: Pas besoin de dispatchEvent artificiel, useSearchParams() est réactif
      // window.dispatchEvent(new PopStateEvent('popstate', ...));
      
      // Réinitialiser le loader après un court délai
      setTimeout(() => {
        setLoadingPropertyId(null);
      }, 300);
    }
  };

  // Helper pour générer le sous-texte hover (adresse/date) - format simple pour sous-texte
  const getHoverInfo = (property: PropertyWithRelations) => {
    const prop = property as any;
    
    // Construire l'adresse complète
    const fullAddress = `${prop.address || ''}${prop.address && prop.postalCode ? ', ' : ''}${prop.postalCode || ''} ${prop.city || ''}`.trim();
    
    // Trouver la dernière transaction pour ce bien
    // Note: transactionsForCharts n'a pas de label, donc on ne peut pas l'afficher ici
    // Le label est affiché directement dans la cellule "Bien" au hover
    const lastTransaction = null; // Pas utilisé dans getHoverInfo pour l'instant
    
    const parts = [];
    if (fullAddress) {
      parts.push(fullAddress);
    }
    if (prop.acquisitionDate) {
      parts.push(`Acquis le ${new Date(prop.acquisitionDate).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })}`);
    }
    
    if (parts.length === 0 && !lastTransaction) return null;
    
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {fullAddress && (
            <>
              <MapPin className="h-3 w-3" />
              <span>{fullAddress}</span>
            </>
          )}
          {prop.acquisitionDate && fullAddress && <span>•</span>}
          {prop.acquisitionDate && (
            <span>Acquis le {new Date(prop.acquisitionDate).toLocaleDateString('fr-FR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric'
            })}</span>
          )}
        </div>
        {lastTransaction && (
          <div className="flex items-center gap-2 text-xs text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity duration-150 ease-in-out">
            <CheckCircle className="h-3 w-3 text-green-600 flex-shrink-0" />
            <span className="font-medium">{lastTransaction.amount > 0 ? '+' : ''}€{Math.abs(lastTransaction.amount).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <span>•</span>
            <span>{lastTransaction.label}</span>
          </div>
        )}
      </div>
    );
  };

  // Helper pour générer les actions hover
  const getHoverActions = (property: PropertyWithRelations) => {
    return (
      <div className="flex items-center gap-4">
        <button
          onClick={(e) => {
            e.stopPropagation();
            handlePropertyClick(property.id);
          }}
          className="flex items-center gap-1 text-[#ff6b35] hover:text-[#e55a2b] transition-colors underline text-sm font-medium"
        >
          <Eye className="h-4 w-4" />
          <span>CONSULTER</span>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setEditingProperty(property);
            setPropertyFormOpen(true);
          }}
          className="flex items-center gap-1 text-[#ff6b35] hover:text-[#e55a2b] transition-colors underline text-sm font-medium"
        >
          <Edit className="h-4 w-4" />
          <span>MODIFIER</span>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDeleteProperty(property);
          }}
          className="flex items-center gap-1 text-red-600 hover:text-red-700 transition-colors underline text-sm font-medium"
        >
          <Trash2 className="h-4 w-4" />
          <span>SUPPRIMER</span>
        </button>
      </div>
    );
  };

  // États de chargement et erreur
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
        <span className="ml-3 text-gray-600">Chargement des biens...</span>
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
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 truncate min-w-0">Biens Immobiliers</h1>
            <div className="flex-shrink-0">
              <button
                onClick={() => setPropertyFormOpen(true)}
                className="inline-flex items-center justify-center h-8 w-8 text-orange-600 border border-orange-200 rounded-lg bg-white hover:bg-gradient-to-r hover:from-orange-500 hover:to-red-500 hover:text-white transition-all duration-300 ease-out focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                aria-label="Nouveau Bien"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Ligne 2 : Description */}
        <p className="text-sm sm:text-base text-gray-600">Pilotage de votre parc immobilier</p>
      </div>

      {/* 1️⃣ Alertes du parc — résumé groupé + détail au clic */}
      {parcelAlerts.length > 0 && (
        <Card className="border-gray-200 bg-gray-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-gray-900">
              <span className="text-amber-600" aria-hidden>⚠️</span>
              Actions à traiter
            </CardTitle>
            <CardDescription>Résumé des alertes sur le parc</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!showAlertsDetail ? (
              <>
                <ul className="space-y-1.5 text-sm text-gray-700">
                  {groupAlertsByType(parcelAlerts).map((g) => (
                    <li key={g.type}>
                      {g.label} ({g.count})
                    </li>
                  ))}
                </ul>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAlertsDetail(true)}
                  className="mt-2"
                >
                  Voir les biens concernés
                </Button>
              </>
            ) : (
              <>
                <ul className="space-y-2">
                  {parcelAlerts.map((alert) => (
                    <li
                      key={`${alert.propertyId}-${alert.type}-${alert.label}`}
                      className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg bg-white border border-gray-100 text-sm"
                    >
                      <span className="text-gray-900">
                        {alert.propertyName} — {alert.label}
                        {alert.detail && <span className="text-gray-500"> ({alert.detail})</span>}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePropertyClick(alert.propertyId)}
                        className="shrink-0 text-gray-600"
                      >
                        Voir le bien
                      </Button>
                    </li>
                  ))}
                </ul>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAlertsDetail(false)}
                  className="mt-2 text-gray-600"
                >
                  Replier le détail
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* 2️⃣ KPIs du parc (4 cartes très compactes — ~20 % padding en moins, icônes et titres réduits) */}
      <div className="grid gap-1.5 grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Biens totaux"
          value={dashboardKpis.biensTotaux.toString()}
          iconName="Home"
          color="indigo"
          trendValue={0}
          trendLabel=""
          trendDirection="flat"
          rightIndicator="chevron"
          onClick={() => handleStatusFilter('total')}
          isActive={statusFilter === 'total'}
          className="!p-2.5 !gap-1.5 [&_.flex-1_p:first-child]:!text-[0.65rem] [&_.flex-1_p:last-child]:!text-base"
        />
        <StatCard
          title="Rentabilité moyenne"
          value={`${dashboardKpis.rentabiliteMoyennePct.toFixed(1)} %`}
          iconName="TrendingUp"
          color="green"
          trendValue={0}
          trendLabel=""
          trendDirection="flat"
          rightIndicator="none"
          className="!p-2.5 !gap-1.5 [&_.flex-1_p:first-child]:!text-[0.65rem] [&_.flex-1_p:last-child]:!text-base"
        />
        <StatCard
          title={CASHFLOW_LABEL}
          value={
            dashboardKpis.cashflowMensuelTotal >= 0
              ? `+${dashboardKpis.cashflowMensuelTotal.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €`
              : `${dashboardKpis.cashflowMensuelTotal.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €`
          }
          iconName="Euro"
          color={dashboardKpis.cashflowMensuelTotal >= 0 ? 'green' : 'danger'}
          trendValue={0}
          trendLabel=""
          trendDirection="flat"
          rightIndicator="none"
          className="!p-2.5 !gap-1.5 [&_.flex-1_p:first-child]:!text-[0.65rem] [&_.flex-1_p:last-child]:!text-base"
        />
        <StatCard
          title="Taux de vacance"
          value={`${dashboardKpis.tauxVacancePct.toFixed(1)} %`}
          iconName="UserX"
          color="amber"
          trendValue={0}
          trendLabel=""
          trendDirection="flat"
          rightIndicator="chevron"
          onClick={() => handleStatusFilter('vacant')}
          isActive={statusFilter === 'vacant'}
          className="!p-2.5 !gap-1.5 [&_.flex-1_p:first-child]:!text-[0.65rem] [&_.flex-1_p:last-child]:!text-base"
        />
      </div>

      {/* 3️⃣ Graphique bénéfice net cumulé (seul graphique conservé) */}
      {(transactionsForCharts.length > 0 || propertiesForCharts.length > 0) && (
        <div className="w-full">
          <NetCumulativeChart
            transactions={transactionsForCharts}
            properties={propertiesForCharts}
          />
        </div>
      )}

      {/* 4️⃣ Liste des biens */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Liste des Biens</CardTitle>
              <CardDescription>Recherchez et gérez vos biens immobiliers</CardDescription>
            </div>
            <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  viewMode === 'table' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                )}
              >
                <List className="h-4 w-4" />
                Vue tableau
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  viewMode === 'cards' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                )}
              >
                <LayoutGrid className="h-4 w-4" />
                Vue cartes
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-6 space-y-4">
            <SearchInput
              placeholder="Rechercher un bien..."
              defaultValue={search}
              onSearch={handleSearch}
            />
            
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeArchived}
                  onChange={handleToggleArchived}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                />
                <span className="text-sm font-medium text-gray-700">
                  Inclure les biens archivés
                </span>
              </label>
              {includeArchived && (
                <Badge variant="info" size="sm">
                  Actif
                </Badge>
              )}
            </div>
          </div>

          {/* Vue cartes ou tableau */}
          {paginatedProperties.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="Aucun bien trouvé"
              description={search || statusFilter !== 'total' 
                ? "Essayez de modifier vos critères de recherche ou vos filtres."
                : "Commencez par ajouter votre premier bien immobilier."}
            />
          ) : viewMode === 'cards' ? (
            <>
            {/* 7️⃣ Vue cartes des biens */}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {paginatedProperties.map((property) => {
                const prop = property as any;
                const metrics = metricsByProperty.get(property.id);
                const loyer = (prop.Lease?.length || 0) > 0 ? prop.Lease[0].rentAmount : null;
                const cashflow = metrics?.cashflowMensuel ?? 0;
                const rendement = metrics?.rendementPct ?? 0;
                const score = metrics?.score ?? 0;
                const tenant = (prop.Lease?.length || 0) > 0 ? prop.Lease[0].Tenant : null;
                const city = [prop.address, prop.postalCode, prop.city].filter(Boolean).join(', ') || '—';
                return (
                  <Card
                    key={property.id}
                    className="cursor-pointer hover:shadow-md transition-shadow border-gray-200"
                    onClick={() => handlePropertyClick(property.id)}
                  >
                    <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-lg leading-none" aria-hidden>{getPropertyTypeEmoji(prop.type || 'apartment')}</span>
                          <CardTitle className="text-base truncate">{property.name}</CardTitle>
                        </div>
                        <div className="shrink-0 flex flex-col items-end">
                          <span className={cn('text-sm font-medium', getScoreDotColor(score))}>● {score}</span>
                          <span className="text-xs text-gray-500">{getScoreLabelText(metrics?.scoreLabel ?? 'faible')}</span>
                        </div>
                      </div>
                      <CardDescription className="flex items-center gap-1 text-xs">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{city}</span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-gray-500">Loyer</span>
                          <p className="font-medium">{loyer != null ? `${loyer.toLocaleString('fr-FR')} €` : '—'}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">{CASHFLOW_LABEL}</span>
                          <p className={cn('font-medium', cashflow >= 0 ? 'text-green-600' : 'text-red-600')}>
                            {cashflow >= 0 ? '+' : ''}{cashflow.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-500">Rendement</span>
                          <p className="font-medium">{rendement.toFixed(1)} %</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Score</span>
                          <p className="font-medium">{getScoreLabelText(metrics?.scoreLabel ?? 'faible')}</p>
                        </div>
                      </div>
                      {tenant && (
                        <p className="text-xs text-gray-600">
                          👤 Locataire : {tenant.firstName} {tenant.lastName}
                        </p>
                      )}
                      <div className="flex items-center gap-2 pt-1">
                        {getStatusBadge(property)}
                        {(metrics?.alerts?.length ?? 0) > 0 && (
                          <span
                            className="text-amber-600 text-xs font-medium"
                            title={metrics!.alerts.map((a) => a.label).join('\n')}
                          >
                            ⚠ {metrics!.alerts.length} alerte{metrics!.alerts.length > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2 pt-2 border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
                        <Button variant="outline" size="sm" onClick={() => handlePropertyClick(property.id)}>
                          Voir
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingProperty(property);
                            setPropertyFormOpen(true);
                          }}
                        >
                          Modifier
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            {/* Pagination pour la vue cartes */}
            {mode === 'normal' && initialData?.pagination && initialData.pagination.pages > 1 && (
              <div className="mt-6">
                <PaginationV2
                  currentPage={initialData.pagination.page}
                  totalPages={initialData.pagination.pages}
                  onPageChange={handlePageChange}
                />
              </div>
            )}
            {mode === 'app-shell' && totalPages > 1 && (
              <div className="mt-6">
                <PaginationV2
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                />
              </div>
            )}
            </>
          ) : useUI2 ? (
            // Version V2 du tableau — colonnes: Bien, Loyer, Cashflow, Rendement, Score, Statut, Alerte, Actions
            <>
              <TableV2>
                <TableHeaderV2>
                  <tr>
                    <TableHeaderCellV2>Bien</TableHeaderCellV2>
                    <TableHeaderCellV2>Loyer</TableHeaderCellV2>
                    <TableHeaderCellV2>Cashflow</TableHeaderCellV2>
                    <TableHeaderCellV2>Rendement</TableHeaderCellV2>
                    <TableHeaderCellV2>Score</TableHeaderCellV2>
                    <TableHeaderCellV2>Statut</TableHeaderCellV2>
                    <TableHeaderCellV2>Alerte</TableHeaderCellV2>
                    <TableHeaderCellV2 className="text-center">Actions</TableHeaderCellV2>
                  </tr>
                </TableHeaderV2>
                <TableBodyV2>
                  {paginatedProperties.map((property) => {
                    const prop = property as any;
                    const metrics = metricsByProperty.get(property.id);
                    const loyer = (prop.Lease?.length || 0) > 0 ? prop.Lease[0].rentAmount : null;
                    const cashflow = metrics?.cashflowMensuel ?? 0;
                    const rendement = metrics?.rendementPct ?? 0;
                    const score = metrics?.score ?? 0;
                    return (
                      <TableRowV2
                        key={property.id}
                        className={cn(prop.isArchived && 'bg-gray-50 opacity-70')}
                        onClick={() => handlePropertyClick(property.id)}
                        onHoverInfo={getHoverInfo(property)}
                      >
                        <TableCellV2>
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              {loadingPropertyId === property.id ? (
                                <Loader2 className="h-4 w-4 animate-spin sidebar-loader-orange" />
                              ) : (
                                <span className="text-base leading-none" aria-hidden>{getPropertyTypeEmoji(prop.type || 'apartment')}</span>
                              )}
                              <span className={cn(prop.isArchived ? 'font-medium text-gray-500 line-through' : 'font-medium text-gray-900')}>
                                {property.name}
                              </span>
                              {prop.isArchived && (
                                <Badge variant="warning" size="sm" className="bg-orange-100 text-orange-800 border-orange-300">
                                  <Archive className="h-3 w-3 mr-1" />
                                  Archivé
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 flex items-center gap-1">
                              <span aria-hidden>📍</span>
                              <span className="truncate max-w-[180px]">{getPropertyShortAddress(prop)}</span>
                            </div>
                          </div>
                        </TableCellV2>
                        <TableCellV2>
                          <div className="ui2-table-cell-content">
                            {loyer != null ? `€${loyer.toLocaleString('fr-FR')}` : '—'}
                          </div>
                        </TableCellV2>
                        <TableCellV2 className="ui2-table-cell-content">
                          <span className="text-gray-900">
                            {cashflow >= 0 ? '+' : ''}{cashflow.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
                          </span>
                          <span className="ml-1" aria-hidden>{getCashflowIndicator(cashflow)}</span>
                        </TableCellV2>
                        <TableCellV2 className="ui2-table-cell-content">
                          {rendement > 0 ? (
                            <>
                              <span className="text-gray-900">{rendement.toFixed(1)} %</span>
                              <span className="ml-1" aria-hidden>{getRendementIndicator(rendement)}</span>
                            </>
                          ) : (
                            '—'
                          )}
                        </TableCellV2>
                        <TableCellV2 className="ui2-table-cell-content">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5">
                              <span className={cn('text-sm font-medium', getScoreDotColor(score))}>● {score}</span>
                              <span className="text-xs text-gray-500">{getScoreLabelText(metrics?.scoreLabel ?? 'faible')}</span>
                            </div>
                            <div className="flex gap-0.5" title="Rentabilité · Cashflow · Occupation · Alertes">
                              {getHealthHeatmap(metrics, !!(prop.Lease?.length || 0) || prop.occupation === 'OCCUPIED').map((level, i) => (
                                <span
                                  key={i}
                                  className={cn(
                                    'w-2 h-2 rounded-sm flex-shrink-0',
                                    level === 'green' && 'bg-emerald-500',
                                    level === 'orange' && 'bg-amber-500',
                                    level === 'red' && 'bg-red-500'
                                  )}
                                  aria-hidden
                                />
                              ))}
                            </div>
                          </div>
                        </TableCellV2>
                        <TableCellV2>{getStatusBadge(property)}</TableCellV2>
                        <TableCellV2 className="ui2-table-cell-content">
                          {(metrics?.alerts?.length ?? 0) > 0 ? (
                            <span
                              className="text-amber-600 text-xs font-medium"
                              title={metrics!.alerts.map((a) => a.label).join('\n')}
                            >
                              ⚠ {metrics!.alerts.length} alerte{metrics!.alerts.length > 1 ? 's' : ''}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </TableCellV2>
                        <TableCellV2 className="text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingProperty(property);
                                setPropertyFormOpen(true);
                              }}
                              className="h-8 w-8 p-0"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteProperty(property);
                              }}
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCellV2>
                      </TableRowV2>
                    );
                  })}
                </TableBodyV2>
              </TableV2>

              {/* Pagination V2 */}
              {mode === 'normal' && initialData?.pagination && initialData.pagination.pages > 1 && (
                <div className="mt-6">
                  <PaginationV2
                    currentPage={initialData.pagination.page}
                    totalPages={initialData.pagination.pages}
                    onPageChange={handlePageChange}
                  />
                </div>
              )}
              {mode === 'app-shell' && totalPages > 1 && (
                <div className="mt-6">
                  <PaginationV2
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                  />
                </div>
              )}
            </>
          ) : (
            // Version normale du tableau — colonnes: Bien, Loyer, Cashflow, Rendement, Score, Statut, Alerte, Actions
            <>
              <Table hover>
                <TableHeader>
                  <TableRow>
                    <TableHeaderCell>Bien</TableHeaderCell>
                    <TableHeaderCell>Loyer</TableHeaderCell>
                    <TableHeaderCell>Cashflow</TableHeaderCell>
                    <TableHeaderCell>Rendement</TableHeaderCell>
                    <TableHeaderCell>Score</TableHeaderCell>
                    <TableHeaderCell>Statut</TableHeaderCell>
                    <TableHeaderCell>Alerte</TableHeaderCell>
                    <TableHeaderCell>Actions</TableHeaderCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedProperties.map((property) => {
                    const prop = property as any;
                    const metrics = metricsByProperty.get(property.id);
                    const loyer = (prop.Lease?.length || 0) > 0 ? prop.Lease[0].rentAmount : null;
                    const cashflow = metrics?.cashflowMensuel ?? 0;
                    const rendement = metrics?.rendementPct ?? 0;
                    const score = metrics?.score ?? 0;
                    return (
                      <TableRow
                        key={property.id}
                        className={cn('cursor-pointer', prop.isArchived && 'bg-gray-50 opacity-70 border-l-4 border-l-gray-400')}
                        onClick={() => handlePropertyClick(property.id)}
                      >
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                              {loadingPropertyId === property.id ? (
                                <Loader2 className="h-4 w-4 animate-spin sidebar-loader-orange" />
                              ) : (
                                <span className="text-base leading-none" aria-hidden>{getPropertyTypeEmoji(prop.type || 'apartment')}</span>
                              )}
                              <span className={cn(prop.isArchived ? 'font-medium text-gray-500 line-through' : 'font-medium text-gray-900')}>
                                {property.name}
                              </span>
                              {prop.isArchived && (
                                <Badge variant="warning" size="sm" className="bg-orange-100 text-orange-800 border-orange-300">
                                  Archivé
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 flex items-center gap-1">
                              <span aria-hidden>📍</span>
                              <span className="truncate max-w-[180px]">{getPropertyShortAddress(prop)}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {loyer != null ? `€${loyer.toLocaleString('fr-FR')}` : '—'}
                        </TableCell>
                        <TableCell>
                          <span className="text-gray-900">
                            {cashflow >= 0 ? '+' : ''}{cashflow.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
                          </span>
                          <span className="ml-1" aria-hidden>{getCashflowIndicator(cashflow)}</span>
                        </TableCell>
                        <TableCell>
                          {rendement > 0 ? (
                            <>
                              <span className="text-gray-900">{rendement.toFixed(1)} %</span>
                              <span className="ml-1" aria-hidden>{getRendementIndicator(rendement)}</span>
                            </>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5">
                              <span className={cn('text-sm font-medium', getScoreDotColor(score))}>● {score}</span>
                              <span className="text-xs text-gray-500">{getScoreLabelText(metrics?.scoreLabel ?? 'faible')}</span>
                            </div>
                            <div className="flex gap-0.5" title="Rentabilité · Cashflow · Occupation · Alertes">
                              {getHealthHeatmap(metrics, !!(prop.Lease?.length || 0) || prop.occupation === 'OCCUPIED').map((level, i) => (
                                <span
                                  key={i}
                                  className={cn(
                                    'w-2 h-2 rounded-sm flex-shrink-0',
                                    level === 'green' && 'bg-emerald-500',
                                    level === 'orange' && 'bg-amber-500',
                                    level === 'red' && 'bg-red-500'
                                  )}
                                  aria-hidden
                                />
                              ))}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(property)}</TableCell>
                        <TableCell>
                          {(metrics?.alerts?.length ?? 0) > 0 ? (
                            <span
                              className="text-amber-600 text-xs font-medium"
                              title={metrics!.alerts.map((a) => a.label).join('\n')}
                            >
                              ⚠ {metrics!.alerts.length} alerte{metrics!.alerts.length > 1 ? 's' : ''}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setEditingProperty(property); setPropertyFormOpen(true); }}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDeleteProperty(property); }}>
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Pagination */}
              {mode === 'normal' && initialData?.pagination && initialData.pagination.pages > 1 && (
                <div className="mt-6">
                  <Pagination
                    currentPage={initialData.pagination.page}
                    totalPages={initialData.pagination.pages}
                    onPageChange={handlePageChange}
                  />
                </div>
              )}
              {mode === 'app-shell' && totalPages > 1 && (
                <div className="mt-6">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal de création/édition */}
      <PropertyForm
        isOpen={propertyFormOpen}
        onClose={() => {
          setPropertyFormOpen(false);
          setEditingProperty(null);
        }}
        onSubmit={handlePropertySubmit}
        initialData={editingProperty || undefined}
        summaryMetrics={editingProperty ? metricsByProperty.get(editingProperty.id) : undefined}
        title={editingProperty ? 'Modifier le Bien' : 'Nouveau Bien'}
      />

      {/* Delete Dialog */}
      {deletingProperty && propertyStats && (
        <ConfirmDeletePropertyDialog
          isOpen={deleteDialogOpen}
          onClose={() => {
            setDeleteDialogOpen(false);
            setDeletingProperty(null);
            setPropertyStats(null);
          }}
          onConfirm={handleDeleteConfirmed}
          property={deletingProperty}
          stats={propertyStats}
          availableProperties={availableProperties}
        />
      )}
    </div>
  );
}
