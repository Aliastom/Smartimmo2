/**
 * Hook unifié pour charger les données des locataires
 * Fonctionne en mode "normal" (online avec fallback offline) et "app-shell" (offline-first)
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getTenantRepositoryOffline } from '@/lib/offline/repositories/TenantRepositoryOffline';
import { getLocalDB } from '@/lib/offline/db';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import type { TenantWithRelations } from '@/lib/db/TenantRepo';
import type { LocalTenant, LocalLease } from '@/lib/offline/db';

export interface TenantsPageData {
  tenants: TenantWithRelations[];
  stats: {
    total: number;
    withActiveLeases: number;
    withoutLeases: number;
  };
  loading: boolean;
  error: string | null;
}

export interface UseTenantsDataOptions {
  mode: 'normal' | 'app-shell';
  initialData?: {
    data: TenantWithRelations[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
  initialStats?: Array<{
    title: string;
    value: string;
    iconName: string;
    trend: { value: number; label: string; period: string };
    color: 'primary' | 'success' | 'warning' | 'danger' | 'gray';
  }>;
  // Filtres pour le mode app-shell (gérés par le Core Component)
  search?: string;
  status?: 'all' | 'withActiveLeases' | 'withoutLeases' | 'overduePayments';
}

export function useTenantsData(options: UseTenantsDataOptions) {
  const { mode, initialData, initialStats, search: searchFilter, status: statusFilter } = options;
  const { organizationId } = useCurrentOrganization();
  const router = mode === 'normal' ? useRouter() : null;
  const searchParams = mode === 'normal' ? useSearchParams() : null;

  const [tenants, setTenants] = useState<LocalTenant[]>([]);
  const [leases, setLeases] = useState<LocalLease[]>([]);
  const [loading, setLoading] = useState(mode === 'app-shell');
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Extraire les filtres selon le mode
  const search = mode === 'normal' 
    ? (searchParams?.get('search') || '')
    : (searchFilter || '');
  const status = mode === 'normal'
    ? (searchParams?.get('status') as 'all' | 'withActiveLeases' | 'withoutLeases' | 'overduePayments' || 'all')
    : (statusFilter || 'all');

  // Charger les données selon le mode
  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      if (mode === 'app-shell') {
        // Mode app-shell : charger UNIQUEMENT depuis IndexedDB
        if (!organizationId) {
          setError('OrganizationId requis');
          setLoading(false);
          return;
        }

        try {
          setLoading(true);
          setError(null);

          const db = await getLocalDB();
          const tenantRepo = getTenantRepositoryOffline();

          const filters: any = {};
          if (search) filters.search = search;
          if (status && status !== 'all') {
            filters.status = status;
          }

          const [tenantsData, leasesData] = await Promise.all([
            tenantRepo.getAll(organizationId, filters),
            db.Lease.where('organizationId').equals(organizationId).toArray(),
          ]);

          if (!cancelled) {
            setTenants(tenantsData);
            setLeases(leasesData);
            setLoading(false);
          }
        } catch (e: any) {
          if (!cancelled) {
            console.error('[useTenantsData] Erreur chargement app-shell:', e);
            setError('Impossible de charger les locataires.');
            setLoading(false);
          }
        }
      } else {
        // Mode normal : utiliser initialData d'abord, fallback IndexedDB si offline ou données vides
        const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
        const hasInitialData = initialData && initialData.data && initialData.data.length > 0;

        if (!isOnline || !hasInitialData) {
          // Charger depuis IndexedDB
          if (!organizationId) {
            const orgId = localStorage.getItem('organizationId') || localStorage.getItem('currentOrganizationId');
            if (!orgId) {
              try {
                const db = await getLocalDB();
                const firstTenant = await db.Tenant.toCollection().first();
                if (firstTenant?.organizationId) {
                  localStorage.setItem('organizationId', firstTenant.organizationId);
                  await loadFromIndexedDB(firstTenant.organizationId);
                }
              } catch (error) {
                console.error('[useTenantsData] Erreur recherche organizationId:', error);
              }
            } else {
              await loadFromIndexedDB(orgId);
            }
          } else {
            await loadFromIndexedDB(organizationId);
          }
        } else {
          setLoading(false);
        }
      }
    }

    async function loadFromIndexedDB(orgId: string) {
      try {
        setLoading(true);
        const db = await getLocalDB();
        
        // ⚠️ CRITIQUE: Si DB indisponible, throw pour remonter l'état
        const { ensureDbAvailable } = await import('@/lib/offline/dbErrorHandler');
        await ensureDbAvailable(db);
        
        const tenantRepo = getTenantRepositoryOffline();
        
        const filters: any = {};
        if (search) filters.search = search;
        if (status && status !== 'all') {
          filters.status = status;
        }
        
        // Charger locataires et baux en parallèle
        const [tenantsData, leasesData] = await Promise.all([
          tenantRepo.getAll(orgId, filters),
          db.Lease.where('organizationId').equals(orgId).toArray(),
        ]);
        
        setTenants(tenantsData);
        setLeases(leasesData);
        setLoading(false);
      } catch (error: any) {
        // ⚠️ CRITIQUE: Si DB_UNAVAILABLE, émettre un événement pour que l'app affiche l'écran de recovery
        const { isDbUnavailableError } = await import('@/lib/offline/dbErrors');
        const { handleDbUnavailableError } = await import('@/lib/offline/dbErrorHandler');
        if (isDbUnavailableError(error)) {
          handleDbUnavailableError(error, 'useTenantsData');
          setError('La base de données locale n\'est pas accessible.');
        } else {
          console.error('[useTenantsData] Erreur chargement IndexedDB:', error);
          setError('Impossible de charger les données.');
        }
        setLoading(false);
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [mode, organizationId, search, status, initialData, refreshKey, searchFilter, statusFilter]);

  // Écouter les événements de refresh en mode app-shell
  // ⚠️ CRITIQUE: Écouter sync:refresh pour se rafraîchir après une sync silencieuse
  useEffect(() => {
    if (mode === 'app-shell') {
      const handleRefresh = () => {
        setRefreshKey(prev => prev + 1);
      };
      window.addEventListener('sync:refresh', handleRefresh);
      window.addEventListener('tenants:refresh', handleRefresh);
      return () => {
        window.removeEventListener('sync:refresh', handleRefresh);
        window.removeEventListener('tenants:refresh', handleRefresh);
      };
    }
  }, [mode]);

  // Convertir LocalTenant vers TenantWithRelations pour compatibilité
  const convertedTenants: TenantWithRelations[] = useMemo(() => {
    // En mode app-shell, toujours utiliser tenants depuis IndexedDB
    if (mode === 'app-shell') {
      return tenants.map(tenant => {
        // Trouver les baux associés à ce locataire
        const tenantLeases = leases.filter(l => l.tenantId === tenant.id);
        const activeLeases = tenantLeases.filter(l => l.status === 'ACTIF');
        
        // Pour chaque bail, récupérer les infos du bien
        const leasesWithProperty = tenantLeases.map(lease => {
          // En mode app-shell, on n'a pas les relations complètes, donc on construit un objet minimal
          return {
            id: lease.id,
            Property: {
              name: lease.propertyId || 'Bien inconnu', // En app-shell, on n'a pas le nom du bien directement
              address: '',
            },
            status: lease.status,
            rentAmount: lease.rentAmount || 0,
            startDate: new Date(lease.startDate),
            endDate: lease.endDate ? new Date(lease.endDate) : undefined,
          };
        });

        return {
          ...tenant,
          _count: {
            Lease: tenantLeases.length,
            Document: 0, // En app-shell, on n'a pas cette info
          },
          Lease: leasesWithProperty,
        } as TenantWithRelations;
      });
    }
    // En mode normal, utiliser tenants depuis IndexedDB seulement si pas de initialData
    if (mode === 'normal' && tenants.length > 0) {
      const hasInitialData = initialData && initialData.data && initialData.data.length > 0;
      const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
      // Utiliser tenants seulement si offline ou pas de données initiales
      if (!isOnline || !hasInitialData) {
        return tenants.map(tenant => {
          const tenantLeases = leases.filter(l => l.tenantId === tenant.id);
          const leasesWithProperty = tenantLeases.map(lease => ({
            id: lease.id,
            Property: {
              name: lease.propertyId || 'Bien inconnu',
              address: '',
            },
            status: lease.status,
            rentAmount: lease.rentAmount || 0,
            startDate: new Date(lease.startDate),
            endDate: lease.endDate ? new Date(lease.endDate) : undefined,
          }));

          return {
            ...tenant,
            _count: {
              Lease: tenantLeases.length,
              Document: 0,
            },
            Lease: leasesWithProperty,
          } as TenantWithRelations;
        });
      }
    }
    return initialData?.data || [];
  }, [mode, tenants, leases, initialData]);

  // Calculer les stats
  const stats = useMemo(() => {
    if (mode === 'app-shell') {
      const total = tenants.length;
      const withActiveLeases = tenants.filter(t => {
        const tenantLeases = leases.filter(l => l.tenantId === t.id);
        return tenantLeases.some(l => l.status === 'ACTIF');
      }).length;
      const withoutLeases = total - withActiveLeases;
      return { total, withActiveLeases, withoutLeases };
    } else {
      // Mode normal : utiliser initialStats ou calculer depuis initialData
      if (initialStats) {
        const total = parseInt(initialStats[0]?.value || '0');
        const withActiveLeases = parseInt(initialStats[1]?.value || '0');
        const withoutLeases = parseInt(initialStats[2]?.value || '0');
        return { total, withActiveLeases, withoutLeases };
      }
      const data = initialData?.data || [];
      const total = data.length;
      const withActiveLeases = data.filter((t: TenantWithRelations) => 
        t.Lease?.some(l => l.status === 'ACTIF')
      ).length;
      const withoutLeases = total - withActiveLeases;
      return { total, withActiveLeases, withoutLeases };
    }
  }, [mode, tenants, leases, initialStats, initialData]);

  return {
    tenants: convertedTenants,
    stats,
    loading,
    error,
    // Utilitaires pour le mode normal
    router: router || null,
    searchParams: searchParams || null,
  };
}
