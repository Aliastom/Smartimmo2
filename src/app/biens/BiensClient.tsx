'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { InsightBar } from '@/components/ui/InsightBar';
import { InsightChip } from '@/components/ui/InsightChip';
import { InfoChip } from '@/components/ui/InfoChip';
import { InsightPopover } from '@/components/ui/InsightPopover';
import { InsightSkeleton } from '@/components/ui/InsightSkeleton';
import { MiniRadial } from '@/components/ui/MiniRadial';
import { useDashboardInsights } from '@/features/insights/hooks/useDashboardInsights';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Table, TableHeader, TableHeaderCell, TableBody, TableRow, TableCell } from '@/components/ui/Table';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { SearchInput } from '@/components/ui/SearchInput';
import PropertyForm from '@/components/forms/PropertyForm';
import { PropertyWithRelations } from '@/lib/db/PropertyRepo';
import { NetCumulativeChart } from '@/features/analytics/components/NetCumulativeChart';
import { OccupancyDonut } from '@/features/analytics/components/OccupancyDonut';
import { RevenueExpenseCard } from '@/features/analytics/components/RevenueExpenseCard';
import type { Property, Transaction } from '@/features/analytics/types';
import { usePropertyFilters } from '@/features/properties/store/usePropertyFilters';
import { 
  Plus, 
  Edit, 
  Trash2,
  MapPin,
  Building2,
  Euro,
  Users,
  Calendar,
  Home,
  UserCheck,
  UserX,
  TrendingUp,
  AlertCircle,
  Activity,
  Archive,
  Warehouse,
  Store,
  Mountain,
  Loader2
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAlert } from '@/hooks/useAlert';
import { useLoading } from '@/contexts/LoadingContext';
import { ConfirmDeletePropertyDialog, type DeleteMode } from '@/components/properties/ConfirmDeletePropertyDialog';
import type { PropertyStats } from '@/services/deletePropertySmart';
import { getPropertyRepositoryOffline } from '@/lib/offline/repositories/PropertyRepositoryOffline';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import { getLocalDB } from '@/lib/offline/db';

interface BiensClientProps {
  initialData: {
    data: PropertyWithRelations[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
  stats: Array<{
    title: string;
    value: string;
    iconName: string;
    trend: { value: number; label: string; period: string };
    color: 'primary' | 'success' | 'warning' | 'danger' | 'gray';
  }>;
  properties: Property[];
  transactions: Transaction[];
}

export default function BiensClient({ initialData, stats, properties, transactions }: BiensClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { insights, loading: insightsLoading } = useDashboardInsights({ mode: 'normal', scope: 'biens' });
  const { setStatusFilter } = usePropertyFilters();
  const { organizationId } = useCurrentOrganization();
  const { showAlert, showConfirm } = useAlert();
  const { isLoading: checkLoading } = useLoading();
  const [loadingPropertyId, setLoadingPropertyId] = useState<string | null>(null);
  
  // État pour les données offline
  const [offlineData, setOfflineData] = useState<{
    properties: PropertyWithRelations[];
    stats: typeof stats;
  } | null>(null);
  const [isLoadingOffline, setIsLoadingOffline] = useState(false);
  
  // Déclarer includeArchived AVANT le useEffect qui l'utilise
  const [includeArchived, setIncludeArchived] = useState(searchParams.get('includeArchived') === 'true');
  
  // Charger les données depuis IndexedDB si on est hors ligne ou si initialData est vide
  useEffect(() => {
    // Toujours vérifier et charger depuis IndexedDB au montage
    // Cela garantit que les données sont disponibles même si le serveur échoue
    const loadData = async () => {
      const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
      const hasInitialData = initialData && initialData.data && initialData.data.length > 0;
      
      // En mode offline, charger IMMÉDIATEMENT depuis IndexedDB sans attendre
      // Cela permet de contourner les problèmes de rendu serveur de Next.js
      if (!isOnline) {
        console.log('[BiensClient] Mode offline détecté, chargement depuis IndexedDB...');
        setIsLoadingOffline(true);
        
        const loadOfflineData = async () => {
          // Déterminer l'organizationId à utiliser
          let orgId = organizationId || 
                     localStorage.getItem('organizationId') || 
                     localStorage.getItem('currentOrganizationId');
          
          if (!orgId) {
            console.warn('[Offline] Pas d\'organizationId disponible, tentative depuis IndexedDB...');
            // Essayer de trouver l'organizationId depuis IndexedDB
            try {
              const db = await getLocalDB();
              const firstProperty = await db.Property.toCollection().first();
              if (firstProperty?.organizationId) {
                localStorage.setItem('organizationId', firstProperty.organizationId);
                orgId = firstProperty.organizationId;
              }
            } catch (error) {
              console.error('[Offline] Erreur recherche organizationId:', error);
            }
            
            if (!orgId) {
              console.error('[Offline] Impossible de déterminer organizationId');
              setIsLoadingOffline(false);
              return;
            }
          }
          
          try {
            const repo = getPropertyRepositoryOffline();
            
            // Appliquer les filtres depuis l'URL
            const filters: any = {
              includeArchived: includeArchived,
            };
            
            if (searchParams.get('status') === 'occupied') {
              // Pour occupied, on doit vérifier les leases
              // Pour simplifier, on récupère tout et on filtre
            } else if (searchParams.get('status') === 'vacant') {
              // Pour vacant, on doit vérifier l'absence de leases actives
            }
            
            const allProperties = await repo.getAll(orgId, filters);
            
            // Simuler le format PropertyWithRelations pour compatibilité
            const formattedProperties: PropertyWithRelations[] = allProperties.map(prop => ({
              ...prop,
              Lease: [], // Les leases seront chargées séparément si nécessaire
            })) as any;
            
            // Calculer des stats simplifiées
            const offlineStats = [
              {
                title: 'Total Biens',
                value: allProperties.length.toString(),
                iconName: 'Building2',
                trend: { value: 0, label: 'vs mois dernier', period: '30j' },
                color: 'primary' as const
              },
              {
                title: 'Occupés',
                value: '0', // À calculer si nécessaire
                iconName: 'Users',
                trend: { value: 0, label: 'vs mois dernier', period: '30j' },
                color: 'success' as const
              },
              {
                title: 'Vacants',
                value: allProperties.length.toString(),
                iconName: 'Building2',
                trend: { value: 0, label: 'vs mois dernier', period: '30j' },
                color: 'warning' as const
              },
              {
                title: 'Revenus Mensuels',
                value: '€0',
                iconName: 'Euro',
                trend: { value: 0, label: 'vs mois dernier', period: '30j' },
                color: 'success' as const
              }
            ];
            
            setOfflineData({
              properties: formattedProperties,
              stats: offlineStats,
            });
            console.log('[BiensClient] ✓ Données chargées depuis IndexedDB:', allProperties.length, 'biens');
          } catch (error) {
            console.error('[Offline] Erreur chargement données:', error);
          } finally {
            setIsLoadingOffline(false);
          }
        };
        
        loadOfflineData();
        return; // Ne pas continuer si on est offline
      }
      
      // Si on n'a pas de données initiales (erreur serveur), charger depuis IndexedDB
      if (!hasInitialData) {
        setIsLoadingOffline(true);
        
        const loadOfflineData = async () => {
          let orgId = organizationId || 
                     localStorage.getItem('organizationId') || 
                     localStorage.getItem('currentOrganizationId');
          
          if (!orgId) {
            try {
              const db = await getLocalDB();
              const firstProperty = await db.Property.toCollection().first();
              if (firstProperty?.organizationId) {
                localStorage.setItem('organizationId', firstProperty.organizationId);
                orgId = firstProperty.organizationId;
              }
            } catch (error) {
              console.error('[Offline] Erreur recherche organizationId:', error);
            }
            
            if (!orgId) {
              setIsLoadingOffline(false);
              return;
            }
          }
          
          try {
            const repo = getPropertyRepositoryOffline();
            const filters: any = { includeArchived: includeArchived };
            const allProperties = await repo.getAll(orgId, filters);
            
            const formattedProperties: PropertyWithRelations[] = allProperties.map(prop => ({
              ...prop,
              Lease: [],
            })) as any;
            
            const offlineStats = [
              {
                title: 'Total Biens',
                value: allProperties.length.toString(),
                iconName: 'Building2',
                trend: { value: 0, label: 'vs mois dernier', period: '30j' },
                color: 'primary' as const
              },
              {
                title: 'Occupés',
                value: '0',
                iconName: 'Users',
                trend: { value: 0, label: 'vs mois dernier', period: '30j' },
                color: 'success' as const
              },
              {
                title: 'Vacants',
                value: allProperties.length.toString(),
                iconName: 'Building2',
                trend: { value: 0, label: 'vs mois dernier', period: '30j' },
                color: 'warning' as const
              },
              {
                title: 'Revenus Mensuels',
                value: '€0',
                iconName: 'Euro',
                trend: { value: 0, label: 'vs mois dernier', period: '30j' },
                color: 'success' as const
              }
            ];
            
            setOfflineData({
              properties: formattedProperties,
              stats: offlineStats,
            });
          } catch (error) {
            console.error('[Offline] Erreur chargement données:', error);
          } finally {
            setIsLoadingOffline(false);
          }
        };
        
        loadOfflineData();
      }
    };
    
    loadData();
  }, [organizationId, includeArchived, searchParams, initialData]);
  
  // Utiliser les données offline si disponibles et qu'on n'a pas de données initiales
  // OU si on est clairement hors ligne
  const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
  const hasInitialData = initialData && initialData.data && initialData.data.length > 0;
  const shouldUseOfflineData = (!hasInitialData && offlineData) || (!isOnline && offlineData);
  
  const effectiveData = shouldUseOfflineData ? offlineData : null;
  const effectiveProperties = effectiveData?.properties || initialData?.data || [];
  const effectiveStats = effectiveData?.stats || stats;
  
  // Détecter l'état actif des chips basé sur les paramètres URL
  const getActiveChip = () => {
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const search = searchParams.get('search');
    
    if (!status && !type && !search) return 'total';
    if (status === 'occupied') return 'occupied';
    if (status === 'vacant') return 'vacant';
    return null;
  };
  const [propertyFormOpen, setPropertyFormOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<PropertyWithRelations | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingProperty, setDeletingProperty] = useState<PropertyWithRelations | null>(null);
  const [propertyStats, setPropertyStats] = useState<PropertyStats | null>(null);
  const [availableProperties, setAvailableProperties] = useState<Array<{ id: string; name: string }>>([]);

  const handleSearch = (search: string) => {
    const params = new URLSearchParams(searchParams);
    if (search) {
      params.set('search', search);
    } else {
      params.delete('search');
    }
    params.delete('page'); // Reset to first page
    router.push(`/biens?${params.toString()}`);
  };

  // Handler pour le filtrage par carte
  const handleCardFilter = (filterType: string, filterValue: any) => {
    const params = new URLSearchParams(searchParams);
    
    switch (filterType) {
      case 'status':
        if (filterValue === 'occupied') {
          params.set('status', 'occupied');
          setStatusFilter('occupied');
        } else if (filterValue === 'vacant') {
          params.set('status', 'vacant');
          setStatusFilter('vacant');
        }
        break;
      case 'total':
        // Reset all filters
        params.delete('status');
        params.delete('type');
        params.delete('search');
        setStatusFilter('all');
        break;
    }
    
    params.delete('page'); // Reset to first page
    router.push(`/biens?${params.toString()}`);
    
    // Émettre l'événement de changement de filtres
    window.dispatchEvent(new CustomEvent('filters:changed'));
  };

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', page.toString());
    router.push(`/biens?${params.toString()}`);
  };

  const handleToggleArchived = () => {
    const params = new URLSearchParams(searchParams);
    const newValue = !includeArchived;
    
    if (newValue) {
      params.set('includeArchived', 'true');
    } else {
      params.delete('includeArchived');
    }
    params.delete('page'); // Reset to first page
    
    setIncludeArchived(newValue);
    router.push(`/biens?${params.toString()}`);
  };

  const getStatusBadge = (property: PropertyWithRelations) => {
    const hasActiveLease = property.Lease?.some(lease => lease.status === 'ACTIF') || false;
    
    if (hasActiveLease) {
      return <Badge variant="success">Occupé</Badge>;
    } else {
      return <Badge variant="warning">Vacant</Badge>;
    }
  };

  const getNextStep = (property: PropertyWithRelations): { text: string; icon: React.ReactNode } | null => {
    // Si le bien est en mode Airbnb, pas besoin de bail
    if (property.rentalMode === 'SEASONAL_AIRBNB') {
      return null;
    }

    const hasActiveLease = property.Lease?.some(lease => lease.status === 'ACTIF') || false;
    const hasAnyLease = property.Lease && property.Lease.length > 0;
    
    // Si pas de bail du tout
    if (!hasAnyLease) {
      return {
        text: "Créer le bail",
        icon: <Calendar className="h-3 w-3" />
      };
    }
    
    // Si bail existant mais pas actif
    if (hasAnyLease && !hasActiveLease) {
      const inactiveLease = property.Lease[0];
      if (inactiveLease.status === 'BROUILLON' || inactiveLease.status === 'EN_ATTENTE') {
        return {
          text: "Activer le bail",
          icon: <AlertCircle className="h-3 w-3" />
        };
      }
    }
    
    return null;
  };

  const getPropertyType = (type: string) => {
    const typeMap: Record<string, string> = {
      'house': 'Maison',
      'apartment': 'Appartement',
      'garage': 'Garage',
      'commercial': 'Commercial',
      'land': 'Terrain'
    };
    return typeMap[type] || type;
  };

  const getPropertyTypeIcon = (type: string) => {
    switch (type) {
      case 'house':
        return <Home className="h-4 w-4 text-blue-600" />;
      case 'apartment':
        return <Building2 className="h-4 w-4 text-purple-600" />;
      case 'garage':
        return <Warehouse className="h-4 w-4 text-orange-600" />;
      case 'commercial':
        return <Store className="h-4 w-4 text-red-600" />;
      case 'land':
        return <Mountain className="h-4 w-4 text-green-600" />;
      default:
        return <Home className="h-4 w-4 text-gray-600" />;
    }
  };

  const handleDeleteProperty = async (property: PropertyWithRelations) => {
    setDeletingProperty(property);
    
    try {
      // Charger les stats du bien
      const statsResponse = await fetch(`/api/properties/${property.id}/stats`);
      if (statsResponse.ok) {
        const stats = await statsResponse.json();
        setPropertyStats(stats);
      }

      // Charger les autres biens (pour le transfert)
      const otherProperties = effectiveProperties
        .filter(p => p.id !== property.id && !p.isArchived)
        .map(p => ({ id: p.id, name: p.name }));
      setAvailableProperties(otherProperties);

      // Ouvrir la modale
      setDeleteDialogOpen(true);
    } catch (error) {
      console.error('Error loading property data:', error);
      await showAlert({
        type: 'error',
        title: 'Erreur',
        message: 'Impossible de charger les données du bien.',
      });
    }
  };

  const handleConfirmDelete = async (mode: DeleteMode, targetPropertyId?: string) => {
    if (!deletingProperty) return;

    const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
    const orgId = organizationId || 'default';

    try {
      // Si offline ou si l'API échoue, utiliser le repository offline
      if (!isOnline) {
        console.log('[Offline] Suppression locale du bien');
        const repo = getPropertyRepositoryOffline();
        await repo.delete(deletingProperty.id, orgId, mode);
        
        await showAlert({
          type: 'success',
          title: mode === 'archive' ? 'Bien archivé localement' : 'Bien supprimé localement',
          message: 'L\'opération a été enregistrée localement et sera synchronisée avec le serveur dès que la connexion sera rétablie.',
        });

        setDeleteDialogOpen(false);
        setDeletingProperty(null);
        setPropertyStats(null);
        router.refresh();
        return;
      }

      // Mode online : essayer l'API
      try {
        const response = await fetch(`/api/properties/${deletingProperty.id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode, targetPropertyId }),
        });

        if (!response.ok) {
          throw new Error(`Erreur ${response.status}`);
        }

        const result = await response.json();

        await showAlert({
          type: 'success',
          title: mode === 'archive' ? 'Bien archivé' : mode === 'reassign' ? 'Bien transféré' : 'Bien supprimé',
          message: result.message,
        });

        setDeleteDialogOpen(false);
        setDeletingProperty(null);
        setPropertyStats(null);
        router.refresh();
      } catch (apiError: any) {
        // Fallback sur le repository offline
        console.warn('[Online] Erreur API, fallback sur suppression locale:', apiError);
        const repo = getPropertyRepositoryOffline();
        await repo.delete(deletingProperty.id, orgId, mode);
        
        await showAlert({
          type: 'warning',
          title: mode === 'archive' ? 'Bien archivé localement' : 'Bien supprimé localement',
          message: 'L\'API n\'est pas disponible. L\'opération a été enregistrée localement et sera synchronisée avec le serveur dès que la connexion sera rétablie.',
        });

        setDeleteDialogOpen(false);
        setDeletingProperty(null);
        setPropertyStats(null);
        router.refresh();
      }
    } catch (error: any) {
      console.error('Error deleting property:', error);
      await showAlert({
        type: 'error',
        title: 'Erreur',
        message: error.message || 'Une erreur est survenue lors de la suppression du bien.',
      });
      throw error; // Pour que la modale puisse gérer l'état de chargement
    }
  };

  const handlePropertySubmit = async (data: any) => {
    try {
      console.log('Submitting property data:', data);
      
      const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
      const orgId = organizationId || 'default';
      
      // Si on est hors ligne, utiliser directement le repository offline
      if (!isOnline) {
        console.log('[Offline] Sauvegarde locale du bien');
        const repo = getPropertyRepositoryOffline();
        
        if (editingProperty) {
          // Mise à jour locale
          await repo.upsert({
            id: editingProperty.id,
            ...data,
            organizationId: orgId,
          }, orgId);
        } else {
          // Création locale
          const localProperty = await repo.upsert({
            ...data,
            organizationId: orgId,
          }, orgId);
          
          console.log('[Offline] Bien créé localement avec ID:', localProperty.id);
          
          // Rediriger vers la page transactions du nouveau bien (avec l'ID local)
          router.push(`/biens/${localProperty.id}/transactions`);
        }
        
        // Fermer le formulaire
        setPropertyFormOpen(false);
        setEditingProperty(null);
        
        // Afficher un message de succès
        await showAlert({
          type: 'success',
          title: 'Bien enregistré localement',
          message: 'Le bien a été enregistré localement et sera synchronisé avec le serveur dès que la connexion sera rétablie.',
        });
        
        // Rafraîchir pour afficher le nouveau bien dans la liste locale
        router.refresh();
        return;
      }
      
      // Mode online : essayer l'API d'abord
      try {
        if (editingProperty) {
          // Mise à jour
          const response = await fetch(`/api/properties/${editingProperty.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });

          if (!response.ok) {
            throw new Error(`Erreur ${response.status}`);
          }
        } else {
          // Création
          const response = await fetch('/api/properties', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Erreur ${response.status}`);
          }

          const newProperty = await response.json();
          console.log('Created property:', newProperty);
          
          // Rediriger vers la page transactions du nouveau bien
          router.push(`/biens/${newProperty.id}/transactions`);
        }

        // Fermer le formulaire et recharger la page
        setPropertyFormOpen(false);
        setEditingProperty(null);
        router.refresh();
      } catch (apiError: any) {
        // Si l'API échoue, fallback sur le repository offline
        console.warn('[Online] Erreur API, fallback sur sauvegarde locale:', apiError);
        
        const repo = getPropertyRepositoryOffline();
        
        if (editingProperty) {
          await repo.upsert({
            id: editingProperty.id,
            ...data,
            organizationId: orgId,
          }, orgId);
        } else {
          const localProperty = await repo.upsert({
            ...data,
            organizationId: orgId,
          }, orgId);
          
          router.push(`/biens/${localProperty.id}/transactions`);
        }
        
        setPropertyFormOpen(false);
        setEditingProperty(null);
        
        await showAlert({
          type: 'warning',
          title: 'Bien enregistré localement',
          message: 'L\'API n\'est pas disponible. Le bien a été enregistré localement et sera synchronisé avec le serveur dès que la connexion sera rétablie.',
        });
        
        router.refresh();
      }
    } catch (error: any) {
      console.error('Error saving property:', error);
      await showAlert({
        type: 'error',
        title: 'Erreur de sauvegarde',
        message: `Erreur lors de la sauvegarde :\n\n${error.message || 'Une erreur inconnue est survenue'}`,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Biens Immobiliers</h1>
          <p className="text-gray-600 mt-1">Gestion de votre patrimoine immobilier</p>
        </div>
        <Button onClick={() => setPropertyFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nouveau Bien
        </Button>
      </div>

      {/* Rangée 1 - Graphiques dynamiques */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        <div className="md:col-span-2">
          <NetCumulativeChart transactions={transactions} properties={properties} />
        </div>
        <RevenueExpenseCard transactions={transactions} properties={properties} year={2025} />
        <OccupancyDonut properties={properties} />
      </div>

      {/* Rangée 2 - Cartes filtrantes (cliquables) */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 auto-rows-fr">
        <StatCard
          title="Biens totaux"
          value={insights.totalProperties?.toString() || '0'}
          iconName="Home"
          color="indigo"
          trendValue={0}
          trendLabel="% vs mois dernier"
          trendDirection="flat"
          rightIndicator="chevron"
          onClick={() => handleCardFilter('total', null)}
          isActive={getActiveChip() === 'total'}
        />
        
        <StatCard
          title="Occupés"
          value={insights.occupiedProperties?.toString() || '0'}
          iconName="UserCheck"
          color="green"
          trendValue={0}
          trendLabel="% vs mois dernier"
          trendDirection="flat"
          rightIndicator="chevron"
          onClick={() => handleCardFilter('status', 'occupied')}
          isActive={getActiveChip() === 'occupied'}
        />
        
        <StatCard
          title="Vacants"
          value={insights.vacantProperties?.toString() || '0'}
          iconName="UserX"
          color="amber"
          trendValue={0}
          trendLabel="% vs mois dernier"
          trendDirection="flat"
          rightIndicator="chevron"
          onClick={() => handleCardFilter('status', 'vacant')}
          isActive={getActiveChip() === 'vacant'}
        />
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des Biens</CardTitle>
          <CardDescription>Recherchez et gérez vos biens immobiliers</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 space-y-4">
            <SearchInput
              placeholder="Rechercher un bien..."
              defaultValue={searchParams.get('search') || ''}
              onSearch={handleSearch}
            />
            
            {/* Toggle Inclure archivés */}
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

          {/* Table */}
          {(isLoadingOffline || effectiveProperties.length > 0) ? (
            <>
              {isLoadingOffline && (
                <div className="text-center py-8 text-gray-500">
                  Chargement des données depuis le cache local...
                </div>
              )}
              {!isLoadingOffline && (
              <Table hover>
                <TableHeader>
                  <TableRow>
                    <TableHeaderCell>Bien</TableHeaderCell>
                    <TableHeaderCell>Surface</TableHeaderCell>
                    <TableHeaderCell>Loyer</TableHeaderCell>
                    <TableHeaderCell>Locataire</TableHeaderCell>
                    <TableHeaderCell>Statut</TableHeaderCell>
                    <TableHeaderCell>Actions</TableHeaderCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {effectiveProperties.map((property) => (
                    <TableRow 
                      key={property.id}
                      className={`cursor-pointer ${property.isArchived ? 'bg-gray-50 opacity-70 border-l-4 border-l-gray-400' : ''}`}
                      data-property-id={property.id}
                      onClick={() => {
                        const targetPath = `/biens/${property.id}/transactions`;
                        // Activer l'animation de chargement sur la ligne
                        setLoadingPropertyId(property.id);
                        // Le loader sera déclenché par SmartTopLoader via la détection du clic
                        router.push(targetPath);
                      }}
                    >
                      <TableCell>
                        <div>
                          <div className="flex items-center gap-2">
                            {(loadingPropertyId === property.id || checkLoading(`/biens/${property.id}/transactions`)) ? (
                              <Loader2 className="h-4 w-4 animate-spin sidebar-loader-orange" />
                            ) : (
                              getPropertyTypeIcon(property.type)
                            )}
                            <span className={property.isArchived ? 'font-medium text-gray-500 line-through' : 'font-medium text-gray-900'}>
                              {property.name}
                            </span>
                            {property.isArchived && (
                              <Badge variant="warning" size="sm" className="bg-orange-100 text-orange-800 border-orange-300">
                                <Archive className="h-3 w-3 mr-1" />
                                Archivé
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-gray-500 flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {property.address}, {property.postalCode} {property.city}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium text-gray-900">{property.surface} m²</div>
                          <div className="text-gray-500">{property.rooms} pièce{property.rooms > 1 ? 's' : ''}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {(property.Lease?.length || 0) > 0 ? (
                          <div className="font-medium text-gray-900">
                            €{property.Lease[0].rentAmount.toLocaleString('fr-FR')}/mois
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {(property.Lease?.length || 0) > 0 ? (
                          <div className="text-sm text-gray-900">
                            {property.Lease[0].Tenant.firstName} {property.Lease[0].Tenant.lastName}
                          </div>
                        ) : (
                          <span className="text-gray-400">Aucun</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {getStatusBadge(property)}
                          {(() => {
                            const nextStep = getNextStep(property);
                            if (nextStep) {
                              return (
                                <Link 
                                  href={`/app?view=property&propertyId=${property.id}&tab=lease`}
                                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {nextStep.icon}
                                  <span>{nextStep.text}</span>
                                </Link>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingProperty(property);
                              setPropertyFormOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteProperty(property);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              )}

              {/* Pagination */}
              {(!effectiveData && initialData.pagination.pages > 1) && (
                <Pagination
                  currentPage={initialData.pagination.page}
                  totalPages={initialData.pagination.pages}
                  onPageChange={handlePageChange}
                />
              )}
              {effectiveData && (
                <div className="text-center text-sm text-gray-500 py-4">
                  Mode hors ligne : Affichage de {effectiveProperties.length} bien(s) depuis le cache local
                </div>
              )}
            </>
          ) : (
            <EmptyState
              icon={<Building2 className="h-12 w-12 text-gray-400" />}
              title="Aucun bien trouvé"
              description="Aucun bien ne correspond à votre recherche. Essayez de modifier vos critères."
              action={
                <Link href="/biens/new">
                  <Button variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Ajouter un bien
                  </Button>
                </Link>
              }
            />
          )}
        </CardContent>
      </Card>

      {/* Property Form Modal */}
      <PropertyForm
        isOpen={propertyFormOpen}
        onClose={() => {
          setPropertyFormOpen(false);
          setEditingProperty(null);
        }}
        onSubmit={handlePropertySubmit}
        initialData={editingProperty}
        title={editingProperty ? 'Modifier le Bien' : 'Nouveau Bien'}
      />

      {/* Delete Property Dialog */}
      {deletingProperty && propertyStats && (
        <ConfirmDeletePropertyDialog
          isOpen={deleteDialogOpen}
          onClose={() => {
            setDeleteDialogOpen(false);
            setDeletingProperty(null);
            setPropertyStats(null);
          }}
          onConfirm={handleConfirmDelete}
          property={deletingProperty}
          stats={propertyStats}
          availableProperties={availableProperties}
        />
      )}
    </div>
  );
}
