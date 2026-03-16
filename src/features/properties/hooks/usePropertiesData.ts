/**
 * Hook unifié pour charger les données des propriétés
 * Fonctionne en mode "normal" (online avec fallback offline) et "app-shell" (offline-first)
 */

'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getPropertyRepositoryOffline } from '@/lib/offline/repositories/PropertyRepositoryOffline';
import { getTransactionRepositoryOffline } from '@/lib/offline/repositories/TransactionRepositoryOffline';
import { getLeaseRepositoryOffline } from '@/lib/offline/repositories/LeaseRepositoryOffline';
import { getTenantRepositoryOffline } from '@/lib/offline/repositories/TenantRepositoryOffline';
import { getLocalDB } from '@/lib/offline/db';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import type { PropertyWithRelations } from '@/lib/db/PropertyRepo';
import type { LocalProperty, LocalTransaction, LocalLease, LocalTenant, CachedNature } from '@/lib/offline/db';
import type { Property, Transaction } from '@/features/analytics/types';
import {
  computePropertyStats,
  convertPropertyForChart,
  convertTransactionForChart,
  type PropertyStats,
} from '../utils/propertiesCalculations';

export interface PropertiesPageData {
  properties: PropertyWithRelations[];
  stats: {
    total: number;
    occupied: number;
    vacant: number;
  };
  propertiesForCharts: Property[];
  transactionsForCharts: Transaction[];
  loading: boolean;
  error: string | null;
}

export interface UsePropertiesDataOptions {
  mode: 'normal' | 'app-shell';
  initialData?: {
    data: PropertyWithRelations[];
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
  initialPropertiesForCharts?: Property[];
  initialTransactionsForCharts?: Transaction[];
  // Filtres pour le mode app-shell (gérés par le Core Component)
  search?: string;
  includeArchived?: boolean;
}

export function usePropertiesData(options: UsePropertiesDataOptions) {
  const { mode, initialData, initialStats, initialPropertiesForCharts, initialTransactionsForCharts, search: searchFilter, includeArchived: includeArchivedFilter } = options;
  const { organizationId } = useCurrentOrganization();
  const router = mode === 'normal' ? useRouter() : null;
  const searchParams = mode === 'normal' ? useSearchParams() : null;

  const [properties, setProperties] = useState<LocalProperty[]>([]);
  const [leases, setLeases] = useState<LocalLease[]>([]);
  const [tenants, setTenants] = useState<LocalTenant[]>([]);
  const [transactions, setTransactions] = useState<LocalTransaction[]>([]);
  const [natures, setNatures] = useState<Map<string, CachedNature>>(new Map());
  const [loading, setLoading] = useState(mode === 'app-shell');
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Extraire les filtres selon le mode
  const search = mode === 'normal' 
    ? (searchParams?.get('search') || '')
    : (searchFilter || '');
  const includeArchived = mode === 'normal'
    ? (searchParams?.get('includeArchived') === 'true')
    : (includeArchivedFilter || false);

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
          const propRepo = getPropertyRepositoryOffline();
          const leaseRepo = getLeaseRepositoryOffline();
          const tenantRepo = getTenantRepositoryOffline();
          const transRepo = getTransactionRepositoryOffline();

          // ✅ TOUJOURS charger TOUS les biens (includeArchived: true), puis filtrer dans useMemo
          // Cela permet de voir les biens archivés si le filtre change, et de les exclure si nécessaire
          const [propertiesData, leasesData, tenantsData, transactionsData, naturesData] = await Promise.all([
            propRepo.getAll(organizationId, { includeArchived: true, search: search || undefined }),
            leaseRepo.getAll(organizationId),
            tenantRepo.getAll(organizationId),
            transRepo.getAll(organizationId),
            db.NatureEntity.toArray(),
          ]);

          const natureMap = new Map<string, CachedNature>();
          naturesData.forEach(nature => {
            natureMap.set(nature.key, nature);
          });

          if (!cancelled) {
            setProperties(propertiesData);
            setLeases(leasesData);
            setTenants(tenantsData);
            setTransactions(transactionsData);
            setNatures(natureMap);
            setLoading(false);
          }
        } catch (e: any) {
          if (!cancelled) {
            console.error('[usePropertiesData] Erreur chargement app-shell:', e);
            setError('Impossible de charger les biens.');
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
                const firstProperty = await db.Property.toCollection().first();
                if (firstProperty?.organizationId) {
                  localStorage.setItem('organizationId', firstProperty.organizationId);
                  await loadFromIndexedDB(firstProperty.organizationId);
                }
              } catch (error) {
                console.error('[usePropertiesData] Erreur recherche organizationId:', error);
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
        
        const propRepo = getPropertyRepositoryOffline();
        const leaseRepo = getLeaseRepositoryOffline();
        const tenantRepo = getTenantRepositoryOffline();
        const transRepo = getTransactionRepositoryOffline();
        
        const filters: any = { includeArchived: true }; // ⚠️ CRITIQUE: includeArchived: true pour avoir TOUS les biens (comme mode normal)
        if (search) filters.search = search;
        
        // Charger propriétés, baux, locataires, transactions et natures en parallèle
        const [allProperties, leasesData, tenantsData, transactionsData, naturesData] = await Promise.all([
          propRepo.getAll(orgId, filters),
          leaseRepo.getAll(orgId),
          tenantRepo.getAll(orgId),
          transRepo.getAll(orgId),
          db.NatureEntity.toArray(),
        ]);
        
        const natureMap = new Map<string, CachedNature>();
        naturesData.forEach(nature => {
          natureMap.set(nature.key, nature);
        });
        
        setProperties(allProperties);
        setLeases(leasesData);
        setTenants(tenantsData);
        setTransactions(transactionsData);
        setNatures(natureMap);
        setLoading(false);
      } catch (error: any) {
        // ⚠️ CRITIQUE: Si DB_UNAVAILABLE, émettre un événement pour que l'app affiche l'écran de recovery
        const { isDbUnavailableError } = await import('@/lib/offline/dbErrors');
        const { handleDbUnavailableError } = await import('@/lib/offline/dbErrorHandler');
        if (isDbUnavailableError(error)) {
          handleDbUnavailableError(error, 'usePropertiesData');
          setError('La base de données locale n\'est pas accessible.');
        } else {
          console.error('[usePropertiesData] Erreur chargement IndexedDB:', error);
          setError('Impossible de charger les données.');
        }
        setLoading(false);
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [mode, organizationId, includeArchived, search, initialData, refreshKey, searchFilter, includeArchivedFilter]);

  // ✅ APP-SHELL: Écouter UNIQUEMENT properties:refresh (pas sync:refresh global)
  // ✅ Filtrer strictement + anti-loop
  const lastRefreshRef = useRef<{ reason?: string; timestamp: number } | null>(null);
  
  useEffect(() => {
    if (mode === 'app-shell') {
      const handleRefresh = (event: Event) => {
        if (!(event instanceof CustomEvent) || !event.detail) return;
        
        const detail = event.detail as { scope?: string; reason?: string };
        
        // Anti-loop : ignorer les refresh identiques < 300ms
        const now = Date.now();
        const lastRefresh = lastRefreshRef.current;
        if (lastRefresh && 
            lastRefresh.reason === detail.reason &&
            now - lastRefresh.timestamp < 300) {
          return;
        }
        
        lastRefreshRef.current = {
          reason: detail.reason,
          timestamp: now,
        };
        
        // ✅ Forcer le rechargement des données depuis IndexedDB
        setRefreshKey(prev => prev + 1);
      };
      
      window.addEventListener('properties:refresh', handleRefresh);
      return () => {
        window.removeEventListener('properties:refresh', handleRefresh);
      };
    }
  }, [mode]);

  // Convertir LocalProperty vers PropertyWithRelations pour compatibilité
  const convertedProperties: PropertyWithRelations[] = useMemo(() => {
    // En mode app-shell, toujours utiliser properties depuis IndexedDB
    if (mode === 'app-shell') {
      // Filtrer selon includeArchived
      const filteredProperties = includeArchived ? properties : properties.filter(p => !p.isArchived);
      
      // ⚠️ CRITIQUE: Enrichir les propriétés avec les baux et locataires pour afficher les loyers et le statut
      return filteredProperties.map(prop => {
        // Trouver les baux ACTIF pour ce bien
        const activeLeases = leases.filter(l => 
          l.propertyId === prop.id && l.status === 'ACTIF'
        );
        
        // Convertir les baux en format PropertyWithRelations.Lease avec les données des locataires
        const leasesForProperty = activeLeases.map(lease => {
          // Trouver le locataire associé au bail
          const tenant = tenants.find(t => t.id === lease.tenantId);
          
          return {
            id: lease.id,
            status: lease.status,
            rentAmount: lease.rentAmount,
            startDate: lease.startDate,
            endDate: lease.endDate ?? undefined,
            Tenant: {
              firstName: tenant?.firstName || '',
              lastName: tenant?.lastName || '',
            },
          };
        });
        
        return {
          ...prop,
          Lease: leasesForProperty,
        } as any;
      });
    }
    // En mode normal, utiliser properties depuis IndexedDB seulement si pas de initialData
    if (mode === 'normal' && properties.length > 0) {
      const hasInitialData = initialData && initialData.data && initialData.data.length > 0;
      const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
      // Utiliser properties seulement si offline ou pas de données initiales
      if (!isOnline || !hasInitialData) {
        return properties.map(prop => ({
          ...prop,
          Lease: [],
        })) as any;
      }
    }
    return initialData?.data || [];
  }, [mode, properties, leases, tenants, includeArchived, initialData]);

  // Convertir LocalProperty vers Property pour les graphiques
  const propertiesForCharts: Property[] = useMemo(() => {
    if (mode === 'app-shell') {
      // ⚠️ CRITIQUE: Utiliser les baux pour déterminer l'occupation (comme mode normal)
      // Filtrer selon includeArchived
      const filteredProperties = includeArchived ? properties : properties.filter(p => !p.isArchived);
      return filteredProperties.map(p => convertPropertyForChart(p, leases));
    }
    return initialPropertiesForCharts || [];
  }, [mode, properties, leases, includeArchived, initialPropertiesForCharts]);

  // Convertir LocalTransaction vers Transaction pour les graphiques
  const transactionsForCharts: Transaction[] = useMemo(() => {
    if (mode === 'app-shell') {
      return transactions.map(t => convertTransactionForChart(t, natures));
    }
    return initialTransactionsForCharts || [];
  }, [mode, transactions, natures, initialTransactionsForCharts]);

  // Calculer les stats
  const stats = useMemo(() => {
    if (mode === 'app-shell') {
      // ⚠️ CRITIQUE: Utiliser computePropertyStats pour avoir les mêmes calculs que le mode normal
      const computedStats = computePropertyStats(properties, leases, transactions, natures);
      return {
        total: computedStats.total,
        occupied: computedStats.occupied,
        vacant: computedStats.vacant,
      };
    } else {
      // Mode normal : utiliser initialStats ou calculer depuis initialData
      if (initialStats) {
        const total = parseInt(initialStats[0]?.value || '0');
        const occupied = parseInt(initialStats[1]?.value || '0');
        const vacant = parseInt(initialStats[2]?.value || '0');
        return { total, occupied, vacant };
      }
      const data = initialData?.data || [];
      const nonArchived = data.filter((p: any) => !p.isArchived);
      const total = nonArchived.length;
      // Approximatif, devrait venir de stats réelles
      return { total, occupied: 0, vacant: total };
    }
  }, [mode, properties, leases, transactions, natures, initialStats, initialData]);

  return {
    properties: convertedProperties,
    stats,
    propertiesForCharts,
    transactionsForCharts,
    loading,
    error,
    // Utilitaires pour le mode normal
    router: router || null,
    searchParams: searchParams || null,
    natures, // Pour les conversions de transactions en app-shell
  };
}
