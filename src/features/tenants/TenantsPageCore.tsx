/**
 * Core Component pour la page Locataires/Tenants
 * 
 * Une seule source de vérité graphique utilisable en mode "normal" et "app-shell"
 * Toute la logique UI est centralisée ici.
 */

'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { SearchInput } from '@/components/ui/SearchInput';
import { Table, TableHeader, TableHeaderCell, TableBody, TableRow, TableCell } from '@/components/ui/Table';
import { TableV2, TableHeaderV2, TableHeaderCellV2, TableBodyV2, TableRowV2, TableCellV2 } from '@/components/ui2/TableV2';
import { useUI2 } from '@/hooks/useUI2';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { Modal } from '@/components/ui/Modal';
import { ErrorModal } from '@/components/ui/ErrorModal';
import { TenantEditModalV2 } from '@/components/forms/TenantEditModalV2';
import { TenantDrawer } from '@/components/tenants/TenantDrawer';
import { useDashboardInsights } from '@/features/insights/hooks/useDashboardInsights';
import { useTenantsData, type TenantsPageData, type UseTenantsDataOptions } from './hooks/useTenantsData';
import { TenantWithRelations } from '@/lib/db/TenantRepo';
import { 
  Plus, 
  Edit, 
  Trash2,
  Mail,
  Phone,
  FileText,
  Building2,
  Users,
  UserCheck,
  UserX,
  Clock,
  Loader2,
  Menu,
  X
} from 'lucide-react';
import Link from 'next/link';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import { getTenantRepositoryOffline } from '@/lib/offline/repositories/TenantRepositoryOffline';
import { useAlert } from '@/hooks/useAlert';
import { cn } from '@/utils/cn';
import { PaginationV2 } from '@/components/ui2/PaginationV2';
import { useSidebarOptional } from '@/contexts/SidebarContext';

export interface TenantsPageCoreProps {
  mode: 'normal' | 'app-shell';
  initialData?: UseTenantsDataOptions['initialData'];
  initialStats?: UseTenantsDataOptions['initialStats'];
}

export function TenantsPageCore({
  mode,
  initialData,
  initialStats,
}: TenantsPageCoreProps) {
  const { organizationId } = useCurrentOrganization();
  const router = mode === 'normal' ? useRouter() : null;
  const searchParamsHook = mode === 'normal' ? useSearchParams() : null;
  const { showAlert } = useAlert();
  const sidebarContext = useSidebarOptional();
  
  // États locaux
  const [search, setSearch] = useState(mode === 'normal' ? (searchParamsHook?.get('search') || '') : '');
  const [statusFilter, setStatusFilter] = useState<'all' | 'withActiveLeases' | 'withoutLeases' | 'overduePayments'>(
    mode === 'normal' ? (searchParamsHook?.get('status') as any || 'all') : 'all'
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [showAllMobileCards, setShowAllMobileCards] = useState(false);
  
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<TenantWithRelations | null>(null);
  const [tenantFormOpen, setTenantFormOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<TenantWithRelations | null>(null);
  const [errorModal, setErrorModal] = useState<{
    isOpen: boolean;
    title?: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
  }>({
    isOpen: false,
    message: ''
  });

  // Utiliser le hook unifié pour les données
  const {
    tenants,
    stats,
    loading,
    error,
  } = useTenantsData({
    mode,
    initialData,
    initialStats,
    search: mode === 'app-shell' ? search : undefined,
    status: mode === 'app-shell' ? statusFilter : undefined,
  });

  // Utiliser useDashboardInsights en mode normal uniquement
  const { insights: apiInsights, loading: insightsLoading } = useDashboardInsights({ mode, scope: 'locataires' });
  
  // Calculer les insights en mode app-shell depuis les données locales
  const insights = useMemo(() => {
    if (mode === 'app-shell') {
      return {
        totalTenants: stats.total,
        tenantsWithActiveLeases: stats.withActiveLeases,
        tenantsWithoutLeases: stats.withoutLeases,
        overduePayments: 0, // TODO: Calculer depuis les transactions
      };
    }
    return apiInsights;
  }, [mode, stats, apiInsights]);

  // Filtrer les locataires selon le statut (en mode app-shell)
  const filteredTenants = useMemo(() => {
    if (mode === 'normal') {
      // En mode normal, utiliser directement les données (déjà filtrées par le serveur)
      return tenants;
    }
    
    // Mode app-shell : filtrer côté client
    let filtered = [...tenants];

    if (statusFilter === 'withActiveLeases') {
      filtered = filtered.filter(t => t.Lease?.some(l => l.status === 'ACTIF'));
    } else if (statusFilter === 'withoutLeases') {
      filtered = filtered.filter(t => !t.Lease?.some(l => l.status === 'ACTIF'));
    } else if (statusFilter === 'overduePayments') {
      // TODO: Implémenter la logique de retards de paiement
      filtered = filtered.filter(t => t.Lease?.some(l => l.status === 'ACTIF'));
    }

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(t => 
        t.firstName.toLowerCase().includes(searchLower) ||
        t.lastName.toLowerCase().includes(searchLower) ||
        t.email.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [mode, tenants, statusFilter, search]);

  // Pagination
  const totalPages = mode === 'normal' && initialData?.pagination
    ? initialData.pagination.pages
    : Math.ceil(filteredTenants.length / itemsPerPage);
  
  const paginatedTenants = useMemo(() => {
    if (mode === 'normal') {
      // En mode normal, les données sont déjà paginées par le serveur
      return filteredTenants;
    }
    // Mode app-shell : paginer côté client
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return filteredTenants.slice(start, end);
  }, [mode, filteredTenants, currentPage, itemsPerPage, initialData]);

  // En mode app-shell, réinitialiser la page quand les filtres changent
  useEffect(() => {
    if (mode === 'app-shell') {
      setCurrentPage(1);
    }
  }, [mode, search, statusFilter]);

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
      router.push(`/locataires?${params.toString()}`);
    }
  };

  const handleCardFilter = (filterType: string, filterValue: any) => {
    if (filterType === 'status') {
      setStatusFilter(filterValue);
    } else if (filterType === 'total') {
      setStatusFilter('all');
      setSearch('');
    }
    setCurrentPage(1);
    
    if (mode === 'normal' && router && searchParamsHook) {
      const params = new URLSearchParams(searchParamsHook.toString());
      if (filterType === 'status' && filterValue) {
        params.set('status', filterValue);
      } else {
        params.delete('status');
        params.delete('search');
      }
      params.delete('page');
      router.push(`/locataires?${params.toString()}`);
      window.dispatchEvent(new CustomEvent('filters:changed'));
    }
  };

  const handlePageChange = (page: number) => {
    if (mode === 'normal' && router && searchParamsHook) {
      const params = new URLSearchParams(searchParamsHook.toString());
      params.set('page', page.toString());
      router.push(`/locataires?${params.toString()}`);
    } else {
      setCurrentPage(page);
    }
  };

  // Détecter l'état actif des chips basé sur les paramètres URL ou l'état local
  const getActiveChip = () => {
    if (mode === 'normal' && searchParamsHook) {
      const status = searchParamsHook.get('status');
      const search = searchParamsHook.get('search');
      
      if (!status && !search) return 'total';
      if (status === 'withActiveLeases') return 'withActiveLeases';
      if (status === 'withoutLeases') return 'withoutLeases';
      if (status === 'overduePayments') return 'overduePayments';
      return null;
    }
    // Mode app-shell
    if (!statusFilter || statusFilter === 'all') return 'total';
    return statusFilter;
  };

  const getStatusBadge = (tenant: TenantWithRelations) => {
    const tenantStatus = tenant.status || 'ACTIVE';
    
    switch (tenantStatus.toUpperCase()) {
      case 'ACTIVE':
        return <Badge variant="success">Actif</Badge>;
      case 'INACTIVE':
        return <Badge variant="gray">Inactif</Badge>;
      case 'BLOCKED':
        return <Badge variant="danger">Bloqué</Badge>;
      default:
        return <Badge variant="gray">Inactif</Badge>;
    }
  };

  // Helper pour générer le contenu hover (info importante)
  const getHoverInfo = (tenant: TenantWithRelations) => {
    const memberSince = new Date(tenant.createdAt).toLocaleDateString('fr-FR');
    return (
      <div className="flex flex-col gap-1">
        <div className="text-xs text-gray-500 opacity-0 group-hover:opacity-0 transition-opacity duration-150 ease-in-out">
          Membre depuis {memberSince}
        </div>
      </div>
    );
  };

  // Helper pour générer les actions hover
  const getHoverActions = (tenant: TenantWithRelations) => {
    const hasActiveLeases = tenant.Lease.some(lease => lease.status === 'ACTIF');
    return (
      <div className="flex items-center gap-4">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setEditingTenant(tenant);
            setTenantFormOpen(true);
          }}
          className="flex items-center gap-1 text-[#ff6b35] hover:text-[#e55a2b] transition-colors underline text-sm font-medium"
        >
          <Edit className="h-4 w-4" />
          <span>MODIFIER</span>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!hasActiveLeases) {
              handleDeleteTenant(tenant);
            }
          }}
          disabled={hasActiveLeases}
          className={cn(
            "flex items-center gap-1 transition-colors underline text-sm font-medium",
            hasActiveLeases
              ? "text-gray-400 cursor-not-allowed opacity-50"
              : "text-red-600 hover:text-red-700"
          )}
          title={hasActiveLeases 
            ? 'Impossible de supprimer : bail(s) actif(s)' 
            : 'Supprimer le locataire'
          }
        >
          <Trash2 className="h-4 w-4" />
          <span>SUPPRIMER</span>
        </button>
      </div>
    );
  };

  const handleViewTenant = (tenant: TenantWithRelations) => {
    setSelectedTenant(tenant);
    setDrawerOpen(true);
  };

  const handleViewLeases = (tenant: TenantWithRelations) => {
    // Navigation vers la page baux avec filtre sur ce locataire
    if (mode === 'app-shell') {
      window.location.href = `/app?view=baux&tenantId=${tenant.id}`;
    } else {
      window.location.href = `/baux?tenantId=${tenant.id}`;
    }
  };

  const handleDeleteTenant = async (tenant: TenantWithRelations) => {
    // Vérification côté client pour une meilleure UX
    const activeLeases = tenant.Lease.filter(lease => lease.status === 'ACTIF');
    
    if (activeLeases.length > 0) {
      setErrorModal({
        isOpen: true,
        title: 'Impossible de supprimer ce locataire',
        message: `Le locataire "${tenant.firstName} ${tenant.lastName}" a ${activeLeases.length} bail(s) actif(s).`,
        details: [
          {
            field: 'Baux actifs',
            message: `Vous devez d'abord résilier ou supprimer le(s) bail(s) actif(s) : ${activeLeases.map(lease => lease.Property.name).join(', ')}`
          }
        ]
      });
      return;
    }

    const confirmed = await showAlert({
      type: 'confirm',
      title: 'Supprimer le locataire',
      message: `Êtes-vous sûr de vouloir supprimer le locataire "${tenant.firstName} ${tenant.lastName}" ?`,
    });

    if (!confirmed) return;

    try {
      if (mode === 'app-shell' || !navigator.onLine) {
        // Mode app-shell ou offline : utiliser le repository offline
        const repo = getTenantRepositoryOffline();
        const orgId = organizationId || 'default';
        const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
        
        await repo.delete(tenant.id, orgId);
        
        // ⚠️ CRITIQUE: Si online, pousser immédiatement les pendingOps vers Supabase
        if (isOnline) {
          try {
            const { getGlobalSyncService } = await import('@/lib/offline/syncGlobal');
            const syncService = getGlobalSyncService();
            await syncService.syncAllPendingToRemote(organizationId);
            
            await showAlert({
              type: 'success',
              title: 'Locataire supprimé',
              message: 'Le locataire a été supprimé localement et sur le serveur.',
            });
          } catch (syncError) {
            console.error('Error syncing delete tenant operation:', syncError);
        await showAlert({
          type: 'success',
          title: 'Locataire supprimé localement',
              message: 'Le locataire a été supprimé localement.\nLa suppression sera synchronisée avec le serveur lors de la prochaine synchronisation.',
            });
          }
        } else {
          await showAlert({
            type: 'success',
            title: 'Locataire supprimé (mode hors-ligne)',
            message: 'Le locataire a été supprimé localement.\nLa suppression sera automatiquement synchronisée avec le serveur dès que la connexion sera rétablie.',
        });
        }

        if (mode === 'app-shell') {
          window.dispatchEvent(new CustomEvent('tenants:refresh'));
        } else if (mode === 'normal' && router) {
          router.refresh();
        }
        return;
      }

      // Mode normal online : utiliser l'API
      const response = await fetch(`/api/tenants/${tenant.id}`, {
        method: 'DELETE'
      });

      if (response.status === 409) {
        const errorData = await response.json();
        setErrorModal({
          isOpen: true,
          title: 'Impossible de supprimer ce locataire',
          message: 'Ce locataire est référencé par des données existantes.',
          details: [
            {
              field: 'Dépendances',
              message: errorData.message || 'Le locataire a des baux ou documents associés'
            }
          ]
        });
        return;
      }

      if (response.ok) {
        if (router) {
          router.refresh();
        }
      } else {
        setErrorModal({
          isOpen: true,
          title: 'Erreur de suppression',
          message: 'Une erreur est survenue lors de la suppression du locataire.',
          details: []
        });
      }
    } catch (error) {
      console.error('Error deleting tenant:', error);
      setErrorModal({
        isOpen: true,
        title: 'Erreur de connexion',
        message: 'Impossible de se connecter au serveur. Vérifiez votre connexion internet.',
        details: []
      });
    }
  };

  const handleTenantSubmit = async (data: any) => {
    try {
      if (mode === 'app-shell' || !navigator.onLine) {
        // Mode app-shell ou offline : utiliser le repository offline
        const repo = getTenantRepositoryOffline();
        const orgId = organizationId || 'default';
        
        if (editingTenant) {
          await repo.upsert({
            id: editingTenant.id,
            ...data,
            organizationId: orgId,
          }, orgId);
        } else {
          await repo.upsert({
            ...data,
            organizationId: orgId,
          }, orgId);
        }

        setTenantFormOpen(false);
        setEditingTenant(null);
        
        // ⚠️ CRITIQUE: Si online, pousser immédiatement les pendingOps vers Supabase
        // (conforme au modèle : Situation 5 et 7 - actions online doivent être synchronisées immédiatement)
        const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
        if (isOnline) {
          try {
            const { getGlobalSyncService } = await import('@/lib/offline/syncGlobal');
            const syncService = getGlobalSyncService();
            await syncService.syncAllPendingToRemote(organizationId);
            
            await showAlert({
              type: 'success',
              title: 'Locataire enregistré',
              message: 'Le locataire a été enregistré localement et sur le serveur.',
            });
          } catch (syncError) {
            console.error('Error syncing tenant operation:', syncError);
        await showAlert({
          type: 'success',
          title: 'Locataire enregistré localement',
              message: 'Le locataire a été enregistré localement.\nLa synchronisation sera effectuée lors de la prochaine synchronisation.',
            });
          }
        } else {
          await showAlert({
            type: 'success',
            title: 'Locataire enregistré (mode hors-ligne)',
            message: 'Le locataire a été enregistré localement.\nIl sera automatiquement synchronisé avec le serveur dès que la connexion sera rétablie.',
        });
        }

        if (mode === 'app-shell') {
          window.dispatchEvent(new CustomEvent('tenants:refresh'));
        } else if (mode === 'normal' && router) {
          router.refresh();
        }
        return;
      }

      // Mode normal online : utiliser l'API
      let response;
      
      if (editingTenant) {
        response = await fetch(`/api/tenants/${editingTenant.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      } else {
        response = await fetch('/api/tenants', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        
        if (errorData.details && Array.isArray(errorData.details)) {
          setErrorModal({
            isOpen: true,
            title: 'Erreur de validation',
            message: 'Veuillez corriger les erreurs suivantes :',
            details: errorData.details.map((d: any) => ({
              field: d.path ? d.path.join('.') : d.field || 'Champ inconnu',
              message: d.message
            }))
          });
        } else {
          setErrorModal({
            isOpen: true,
            title: 'Erreur',
            message: errorData.error || 'Une erreur est survenue lors de la sauvegarde',
            details: []
          });
        }
        return;
      }

      setTenantFormOpen(false);
      setEditingTenant(null);
      if (router) {
        router.refresh();
      }
    } catch (error) {
      console.error('Error saving tenant:', error);
      setErrorModal({
        isOpen: true,
        title: 'Erreur de connexion',
        message: 'Impossible de se connecter au serveur. Vérifiez votre connexion internet.',
        details: []
      });
    }
  };

  // Synchroniser l'état avec les searchParams en mode normal
  useEffect(() => {
    if (mode === 'normal' && searchParamsHook) {
      const urlSearch = searchParamsHook.get('search') || '';
      if (urlSearch !== search) {
        setSearch(urlSearch);
      }

      const urlStatus = searchParamsHook.get('status') as any || 'all';
      if (urlStatus !== statusFilter) {
        setStatusFilter(urlStatus);
      }

      const urlPage = searchParamsHook.get('page');
      if (urlPage) {
        const page = parseInt(urlPage);
        if (page !== currentPage) {
          setCurrentPage(page);
        }
      }
    }
  }, [mode, searchParamsHook, search, statusFilter, currentPage]);

  // États de chargement et erreur
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
        <span className="ml-3 text-gray-600">Chargement des locataires...</span>
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
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 truncate min-w-0">Locataires</h1>
            <div className="flex-shrink-0">
              <button
                onClick={() => setTenantFormOpen(true)}
                className="inline-flex items-center justify-center h-8 w-8 text-orange-600 border border-orange-200 rounded-lg bg-white hover:bg-gradient-to-r hover:from-orange-500 hover:to-red-500 hover:text-white transition-all duration-300 ease-out focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                aria-label="Nouveau Locataire"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Ligne 2 : Description */}
        <p className="text-sm sm:text-base text-gray-600">Gestion de vos locataires et de leurs baux</p>
      </div>

      {/* Cartes de statistiques */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 auto-rows-fr">
        <StatCard
          title="Total locataires"
          value={insights.totalTenants?.toString() || '0'}
          iconName="Users"
          color="indigo"
          trendValue={0}
          trendLabel="% vs mois dernier"
          trendDirection="flat"
          rightIndicator="chevron"
          onClick={() => handleCardFilter('total', null)}
          isActive={getActiveChip() === 'total'}
        />
        
        <StatCard
          title="Avec bail actif"
          value={insights.tenantsWithActiveLeases?.toString() || '0'}
          iconName="UserCheck"
          color="green"
          trendValue={0}
          trendLabel="% vs mois dernier"
          trendDirection="flat"
          rightIndicator="chevron"
          onClick={() => handleCardFilter('status', 'withActiveLeases')}
          isActive={getActiveChip() === 'withActiveLeases'}
        />
        
        <StatCard
          title="Sans bail"
          value={insights.tenantsWithoutLeases?.toString() || '0'}
          iconName="UserX"
          color="amber"
          trendValue={0}
          trendLabel="% vs mois dernier"
          trendDirection="flat"
          rightIndicator="chevron"
          onClick={() => handleCardFilter('status', 'withoutLeases')}
          isActive={getActiveChip() === 'withoutLeases'}
        />
        
        <StatCard
          title="% actifs"
          value={`${Math.round((insights.totalTenants && insights.totalTenants > 0) ? ((insights.tenantsWithActiveLeases || 0) / insights.totalTenants) * 100 : 0)}%`}
          iconName="Users"
          color={(insights.totalTenants && insights.totalTenants > 0 && ((insights.tenantsWithActiveLeases || 0) / insights.totalTenants) > 0.8) ? 'green' : 'amber'}
          trendValue={0}
          trendLabel="% vs mois dernier"
          trendDirection="flat"
          rightIndicator="progress"
          progressValue={(insights.totalTenants && insights.totalTenants > 0) ? ((insights.tenantsWithActiveLeases || 0) / insights.totalTenants) * 100 : 0}
        />
        
        {(insights.overduePayments ?? 0) > 0 && (
          <StatCard
            title="Retards de paiement"
            value={insights.overduePayments.toString()}
            iconName="Clock"
            color="red"
            trendValue={0}
            trendLabel="% vs mois dernier"
            trendDirection="flat"
            rightIndicator="chevron"
            onClick={() => handleCardFilter('status', 'overduePayments')}
            isActive={getActiveChip() === 'overduePayments'}
          />
        )}
      </div>

      {/* Liste des locataires */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des Locataires</CardTitle>
          <CardDescription>
            Recherchez et gérez vos locataires
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <SearchInput
              placeholder="Rechercher un locataire..."
              onSearch={handleSearch}
              className="max-w-md"
              defaultValue={search}
            />
          </div>

          {/* Table - Desktop / Cards - Mobile */}
          {paginatedTenants.length > 0 ? (
            <>
              {/* Mobile: Cards view - Limité à 3 par défaut, extensible */}
              <div className="lg:hidden space-y-4">
                {(showAllMobileCards ? paginatedTenants : paginatedTenants.slice(0, 3)).map((tenant) => {
                  const activeLeasesCount = tenant.Lease?.filter(lease => lease.status === 'ACTIF').length || 0;
                  const hasActiveLeases = activeLeasesCount > 0;
                  
                  return (
                    <div
                      key={tenant.id}
                      onClick={() => handleViewTenant(tenant)}
                      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 text-base mb-1">
                            {tenant.firstName} {tenant.lastName}
                          </h3>
                          <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                            <Mail className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{tenant.email}</span>
                          </div>
                          {tenant.phone && (
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Phone className="h-3 w-3 flex-shrink-0" />
                              <span>{tenant.phone}</span>
                            </div>
                          )}
                        </div>
                        <div className="ml-2 flex-shrink-0">
                          {getStatusBadge(tenant)}
                        </div>
                      </div>
                      
                      <div className="space-y-2 pt-3 border-t border-gray-100">
                        {hasActiveLeases && tenant.Lease && (
                          <div className="flex items-center gap-2 text-sm">
                            <Building2 className="h-4 w-4 text-gray-400 flex-shrink-0" />
                            <span className="text-gray-700 truncate">
                              {tenant.Lease
                                .filter(lease => lease.status === 'ACTIF')
                                .map(lease => lease.Property?.name || 'Bien inconnu')
                                .join(', ')}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 text-gray-600">
                            <FileText className="h-4 w-4 text-gray-400" />
                            <span>
                              {activeLeasesCount} bail{activeLeasesCount > 1 ? 'x' : ''} actif{activeLeasesCount > 1 ? 's' : ''}
                            </span>
                          </div>
                          {tenant.Lease && tenant.Lease.length > 0 && (
                            <span className="text-xs text-gray-500">
                              Dernier: {new Date(tenant.Lease[0].startDate).toLocaleDateString('fr-FR')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {paginatedTenants.length > 3 && !showAllMobileCards && (
                  <div className="flex justify-center pt-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowAllMobileCards(true)}
                      className="w-full"
                    >
                      Voir tous les locataires ({paginatedTenants.length})
                    </Button>
                  </div>
                )}
                {showAllMobileCards && paginatedTenants.length > 3 && (
                  <div className="flex justify-center pt-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowAllMobileCards(false)}
                      className="w-full"
                    >
                      Réduire
                    </Button>
                  </div>
                )}
              </div>

              {/* Desktop: Table view */}
              <div className="hidden lg:block">
                {useUI2 ? (
                  // Version V2 du tableau
                  <>
                    <TableV2>
                    <TableHeaderV2>
                      <tr>
                        <TableHeaderCellV2>Locataire</TableHeaderCellV2>
                        <TableHeaderCellV2>Contact</TableHeaderCellV2>
                        <TableHeaderCellV2>Bien</TableHeaderCellV2>
                        <TableHeaderCellV2>Baux Actifs</TableHeaderCellV2>
                        <TableHeaderCellV2>Statut</TableHeaderCellV2>
                        <TableHeaderCellV2>Dernier Bail</TableHeaderCellV2>
                        <TableHeaderCellV2 className="text-center">Actions</TableHeaderCellV2>
                      </tr>
                    </TableHeaderV2>
                    <TableBodyV2>
                      {paginatedTenants.map((tenant) => (
                        <TableRowV2
                          key={tenant.id}
                          onClick={() => handleViewTenant(tenant)}
                          onHoverInfo={getHoverInfo(tenant)}
                        >
                          <TableCellV2>
                            <div>
                              <span className="font-medium text-gray-900">
                                {tenant.firstName} {tenant.lastName}
                              </span>
                            </div>
                          </TableCellV2>
                          <TableCellV2>
                            <div className="ui2-table-cell-content opacity-100 group-hover:opacity-20 transition-opacity duration-150 ease-in-out">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 text-sm">
                                  <Mail className="h-4 w-4 text-gray-400" />
                                  <span>{tenant.email}</span>
                                </div>
                                {tenant.phone && (
                                  <div className="flex items-center gap-2 text-sm">
                                    <Phone className="h-4 w-4 text-gray-400" />
                                    <span>{tenant.phone}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCellV2>
                          <TableCellV2>
                            <div className="ui2-table-cell-content opacity-100 group-hover:opacity-20 transition-opacity duration-150 ease-in-out">
                              {(tenant.Lease?.length || 0) > 0 ? (
                                <div className="space-y-1">
                                  {tenant.Lease
                                    .filter(lease => lease.status === 'ACTIF')
                                    .map((lease, index) => (
                                      <div key={index} className="flex items-center gap-2">
                                        <Building2 className="h-4 w-4 text-gray-400" />
                                        <div>
                                          <div className="text-sm font-medium text-gray-900">
                                            {lease.Property.name}
                                          </div>
                                          {lease.Property.address && (
                                            <div className="text-xs text-gray-500">
                                              {lease.Property.address}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ))
                                  }
                                  {tenant.Lease.filter(lease => lease.status === 'ACTIF').length === 0 && (
                                    <span className="text-gray-400 text-sm">Aucun bien actif</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-400 text-sm">Aucun bail</span>
                              )}
                            </div>
                          </TableCellV2>
                          <TableCellV2>
                            <div className="ui2-table-cell-content opacity-100 group-hover:opacity-20 transition-opacity duration-150 ease-in-out">
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-gray-400" />
                                <span>
                                  {(() => {
                                    const activeLeasesCount = tenant.Lease.filter(lease => lease.status === 'ACTIF').length;
                                    return `${activeLeasesCount} bail${activeLeasesCount > 1 ? 'x' : ''} actif${activeLeasesCount > 1 ? 's' : ''}`;
                                  })()}
                                </span>
                              </div>
                            </div>
                          </TableCellV2>
                          <TableCellV2>
                            <div className="ui2-table-cell-content opacity-100 group-hover:opacity-20 transition-opacity duration-150 ease-in-out">
                              {getStatusBadge(tenant)}
                            </div>
                          </TableCellV2>
                          <TableCellV2>
                            <div className="ui2-table-cell-content opacity-100 group-hover:opacity-20 transition-opacity duration-150 ease-in-out">
                              {(tenant.Lease?.length || 0) > 0 ? (
                                <div className="text-sm text-gray-600">
                                  {new Date(tenant.Lease[0].startDate).toLocaleDateString('fr-FR')}
                                </div>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </div>
                          </TableCellV2>
                          <TableCellV2 className="text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingTenant(tenant);
                                  setTenantFormOpen(true);
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
                                  handleDeleteTenant(tenant);
                                }}
                                disabled={tenant.Lease.some(lease => lease.status === 'ACTIF')}
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCellV2>
                        </TableRowV2>
                      ))}
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
                // Version normale du tableau
            <>
              <Table hover compact>
                <TableHeader>
                  <TableRow>
                    <TableHeaderCell>Locataire</TableHeaderCell>
                    <TableHeaderCell>Contact</TableHeaderCell>
                    <TableHeaderCell>Bien</TableHeaderCell>
                    <TableHeaderCell>Baux Actifs</TableHeaderCell>
                    <TableHeaderCell>Statut</TableHeaderCell>
                    <TableHeaderCell>Dernier Bail</TableHeaderCell>
                    <TableHeaderCell>Actions</TableHeaderCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedTenants.map((tenant) => (
                    <TableRow key={tenant.id}>
                      <TableCell>
                        <div>
                          {mode === 'normal' ? (
                            <Link 
                              href={`/locataires/${tenant.id}`}
                              className="font-medium text-gray-900 hover:text-primary-600"
                            >
                              {tenant.firstName} {tenant.lastName}
                            </Link>
                          ) : (
                            <span className="font-medium text-gray-900">
                              {tenant.firstName} {tenant.lastName}
                            </span>
                          )}
                          <div className="text-sm text-gray-500">
                            Membre depuis {new Date(tenant.createdAt).toLocaleDateString('fr-FR')}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="h-4 w-4 text-gray-400" />
                            <span>{tenant.email}</span>
                          </div>
                          {tenant.phone && (
                            <div className="flex items-center gap-2 text-sm">
                              <Phone className="h-4 w-4 text-gray-400" />
                              <span>{tenant.phone}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {(tenant.Lease?.length || 0) > 0 ? (
                          <div className="space-y-1">
                            {tenant.Lease
                              .filter(lease => lease.status === 'ACTIF')
                              .map((lease, index) => (
                                <div key={index} className="flex items-center gap-2">
                                  <Building2 className="h-4 w-4 text-gray-400" />
                                  <div>
                                    <div className="text-sm font-medium text-gray-900">
                                      {lease.Property.name}
                                    </div>
                                    {lease.Property.address && (
                                      <div className="text-xs text-gray-500">
                                        {lease.Property.address}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))
                            }
                            {tenant.Lease.filter(lease => lease.status === 'ACTIF').length === 0 && (
                              <span className="text-gray-400 text-sm">Aucun bien actif</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">Aucun bail</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-gray-400" />
                          <span>
                            {(() => {
                              const activeLeasesCount = tenant.Lease.filter(lease => lease.status === 'ACTIF').length;
                              return `${activeLeasesCount} bail${activeLeasesCount > 1 ? 'x' : ''} actif${activeLeasesCount > 1 ? 's' : ''}`;
                            })()}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(tenant)}
                      </TableCell>
                      <TableCell>
                        {(tenant.Lease?.length || 0) > 0 ? (
                          <div className="text-sm text-gray-600">
                            {new Date(tenant.Lease[0].startDate).toLocaleDateString('fr-FR')}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingTenant(tenant);
                              setTenantFormOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTenant(tenant);
                            }}
                            disabled={tenant.Lease.some(lease => lease.status === 'ACTIF')}
                            title={tenant.Lease.some(lease => lease.status === 'ACTIF') 
                              ? 'Impossible de supprimer : bail(s) actif(s)' 
                              : 'Supprimer le locataire'
                            }
                            className={tenant.Lease.some(lease => lease.status === 'ACTIF') 
                              ? 'opacity-50 cursor-not-allowed' 
                              : 'text-red-600 hover:text-red-700'
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
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
              </div>
            </>
          ) : (
            <EmptyState
              icon="Users"
              title="Aucun locataire trouvé"
              description={search || statusFilter !== 'all'
                ? "Aucun locataire ne correspond à votre recherche. Essayez de modifier vos critères."
                : "Commencez par ajouter votre premier locataire."}
              action={
                <Button variant="outline" onClick={() => setTenantFormOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter un locataire
                </Button>
              }
            />
          )}
        </CardContent>
      </Card>

      {/* Drawer de visualisation */}
      <TenantDrawer
        tenant={selectedTenant}
        isOpen={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedTenant(null);
        }}
        onEdit={(tenant) => {
          setEditingTenant(tenant);
          setTenantFormOpen(true);
        }}
        onDelete={handleDeleteTenant}
        onViewLeases={handleViewLeases}
      />

      {/* Tenant Form Modal */}
      <TenantEditModalV2
        isOpen={tenantFormOpen}
        onClose={() => {
          setTenantFormOpen(false);
          setEditingTenant(null);
        }}
        onSubmit={handleTenantSubmit}
        initialData={editingTenant}
        title={editingTenant ? 'Modifier le Locataire' : 'Nouveau Locataire'}
      />

      {/* Error Modal */}
      <ErrorModal
        isOpen={errorModal.isOpen}
        onClose={() => setErrorModal({ isOpen: false, message: '' })}
        title={errorModal.title}
        message={errorModal.message}
        details={errorModal.details}
      />
    </div>
  );
}
