/**
 * Hook unifié pour charger les données des échéances récurrentes
 * Fonctionne en mode "normal" (online avec fallback offline) et "app-shell" (offline-first)
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getLocalDB } from '@/lib/offline/db';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import type { LocalEcheanceRecurrente, LocalProperty, LocalLease } from '@/lib/offline/db';
import type { EcheanceRecurrente } from '@/types/echeance';

export interface EcheancesFilters {
  search: string;
  type: string;
  sens: string;
  periodicite: string;
  propertyId: string;
  leaseId: string;
  recuperable: string;
  isActive: string; // ✅ Ajouter le filtre actif/inactif
}

export interface UseEcheancesDataOptions {
  mode: 'normal' | 'app-shell';
  filters?: EcheancesFilters;
  activeKpiFilter?: string | null;
  page?: number;
  pageSize?: number;
  propertyId?: string; // ✅ Optionnel : pour filtrer les events par propertyId (scope 'property')
  scope?: 'global' | 'property'; // ✅ Scope pour différencier page globale vs tab property
}

export function useEcheancesData(options: UseEcheancesDataOptions) {
  const { mode, filters: filtersProp, activeKpiFilter, page = 1, pageSize = 50, propertyId, scope = propertyId ? 'property' : 'global' } = options;
  const { organizationId } = useCurrentOrganization();
  const router = mode === 'normal' ? useRouter() : null;
  const searchParams = mode === 'normal' ? useSearchParams() : null;

  const [echeances, setEcheances] = useState<LocalEcheanceRecurrente[]>([]);
  const [properties, setProperties] = useState<LocalProperty[]>([]);
  const [leases, setLeases] = useState<LocalLease[]>([]);
  const [loading, setLoading] = useState(mode === 'app-shell');
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [pagination, setPagination] = useState({
    page,
    limit: pageSize,
    total: 0,
    pages: 0,
  });

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
          const propRepo = await import('@/lib/offline/repositories/PropertyRepositoryOffline').then(m => m.getPropertyRepositoryOffline());
          const leaseRepo = await import('@/lib/offline/repositories/LeaseRepositoryOffline').then(m => m.getLeaseRepositoryOffline());

          // Charger toutes les données en parallèle
          // ✅ Filtrer par propertyId si spécifié (pour PropertyEcheancesClient)
          let echeancesQuery = db.EcheanceRecurrente.where('organizationId').equals(organizationId);
          const filters = filtersProp || {};
          if (filters.propertyId) {
            // Les échéances sont liées aux propriétés via propertyId
            echeancesQuery = echeancesQuery.filter(e => e.propertyId === filters.propertyId);
          }
          
          const [echeancesData, propertiesData, leasesData] = await Promise.all([
            echeancesQuery.toArray(),
            propRepo.getAll(organizationId, {}),
            leaseRepo.getAll(organizationId, {}),
          ]);

          if (!cancelled) {
            setEcheances(echeancesData);
            setProperties(propertiesData);
            setLeases(leasesData);
            setLoading(false);
          }
        } catch (e: any) {
          if (!cancelled) {
            // Erreur silencieuse
            setError('Impossible de charger les échéances.');
            setLoading(false);
          }
        }
      } else {
        // Mode normal : charger depuis l'API
        try {
          setLoading(true);
          setError(null);

          const params = new URLSearchParams();
          const filters = filtersProp || {};
          
          Object.entries(filters).forEach(([key, value]) => {
            if (value) params.append(key, value);
          });

          // Appliquer le filtre KPI actif
          if (activeKpiFilter === 'revenus') {
            params.append('sens', 'CREDIT');
          } else if (activeKpiFilter === 'charges') {
            params.append('sens', 'DEBIT');
          } else if (activeKpiFilter === 'actives') {
            params.append('active', '1');
          }

          // Filtrer par actif par défaut
          if (!params.has('active') && activeKpiFilter !== 'total') {
            params.append('active', '1');
          }

          // Ajouter la pagination
          params.append('page', page.toString());
          params.append('pageSize', pageSize.toString());

          const [echeancesResponse, propertiesResponse, leasesResponse] = await Promise.all([
            fetch(`/api/echeances/list?${params.toString()}`),
            fetch('/api/properties'),
            fetch('/api/leases'),
          ]);

          if (!echeancesResponse.ok) {
            throw new Error('Erreur lors du chargement des échéances');
          }

          const echeancesData = await echeancesResponse.json();
          const propertiesData = await propertiesResponse.json();
          const leasesData = await leasesResponse.json();

          if (!cancelled) {
            setEcheances(echeancesData.items || []);
            setProperties(Array.isArray(propertiesData) ? propertiesData : (propertiesData.data || []));
            setLeases(Array.isArray(leasesData) ? leasesData : (leasesData.items || leasesData.data || []));
            setPagination({
              page: echeancesData.page || page,
              limit: echeancesData.pageSize || pageSize,
              total: echeancesData.total || 0,
              pages: echeancesData.totalPages || 1,
            });
            setLoading(false);
          }
        } catch (e: any) {
          if (!cancelled) {
            // Erreur silencieuse
            // En cas d'erreur, essayer de charger depuis IndexedDB
            if (organizationId) {
              try {
                const db = await getLocalDB();
                const propRepo = await import('@/lib/offline/repositories/PropertyRepositoryOffline').then(m => m.getPropertyRepositoryOffline());
                const leaseRepo = await import('@/lib/offline/repositories/LeaseRepositoryOffline').then(m => m.getLeaseRepositoryOffline());
                
                const [echeancesData, propertiesData, leasesData] = await Promise.all([
                  db.EcheanceRecurrente.where('organizationId').equals(organizationId).toArray(),
                  propRepo.getAll(organizationId, {}),
                  leaseRepo.getAll(organizationId, {}),
                ]);

                if (!cancelled) {
                  setEcheances(echeancesData);
                  setProperties(propertiesData);
                  setLeases(leasesData);
                  setPagination({
                    page,
                    limit: pageSize,
                    total: echeancesData.length,
                    pages: Math.ceil(echeancesData.length / pageSize),
                  });
                  setLoading(false);
                }
              } catch (offlineError) {
                if (!cancelled) {
                  setError('Impossible de charger les échéances.');
                  setLoading(false);
                }
              }
            } else {
              setError('Impossible de charger les échéances.');
              setLoading(false);
            }
          }
        }
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [mode, organizationId, filtersProp, activeKpiFilter, page, pageSize, refreshKey]);

  // Écouter les événements de refresh en mode app-shell
  // ✅ Filtrer les events par scope (global vs property)
  useEffect(() => {
    if (mode === 'app-shell') {
      const lastRefreshRef = { timestamp: 0, reason: '' };
      const handleRefresh = (event: Event) => {
        if (!(event instanceof CustomEvent && event.detail)) {
          return;
        }
        
        const detail = event.detail as { scope?: string; propertyId?: string; reason?: string };
        const now = Date.now();
        
        // Anti-loop : ignorer les événements identiques dans une fenêtre de 300ms
        if (now - lastRefreshRef.timestamp < 300 && detail.reason === lastRefreshRef.reason) {
          return;
        }
        
        // Filtrer par scope
        if (scope === 'global') {
          // Scope global : écouter uniquement les événements scope 'global'
          if (detail.scope !== 'global') {
            return;
          }
        } else if (scope === 'property') {
          // Scope property : écouter uniquement les événements scope 'property' avec le bon propertyId
          if (detail.scope !== 'property') {
            return;
          }
          if (propertyId && detail.propertyId && detail.propertyId !== propertyId) {
            return;
          }
        }
        
        lastRefreshRef.timestamp = now;
        lastRefreshRef.reason = detail.reason || '';
        setRefreshKey(prev => prev + 1);
      };
      
      window.addEventListener('deadlines:refresh', handleRefresh);
      return () => {
        window.removeEventListener('deadlines:refresh', handleRefresh);
      };
    }
  }, [mode, scope, propertyId]);

  // Convertir LocalEcheanceRecurrente vers EcheanceRecurrente pour compatibilité
  const convertedEcheances: EcheanceRecurrente[] = useMemo(() => {
    if (mode === 'app-shell') {
      // En mode app-shell, construire EcheanceRecurrente depuis les données locales
      return echeances.map(echeance => {
        const property = echeance.propertyId ? properties.find(p => p.id === echeance.propertyId) : null;
        const lease = echeance.leaseId ? leases.find(l => l.id === echeance.leaseId) : null;

        return {
          id: echeance.id,
          propertyId: echeance.propertyId || null,
          leaseId: echeance.leaseId || null,
          label: echeance.label,
          type: echeance.type,
          periodicite: echeance.periodicite,
          montant: echeance.montant,
          recuperable: echeance.recuperable,
          sens: echeance.sens as 'CREDIT' | 'DEBIT',
          startAt: new Date(echeance.startAt),
          endAt: echeance.endAt ? new Date(echeance.endAt) : null,
          isActive: echeance.isActive,
          createdAt: new Date(echeance.createdAt),
          updatedAt: new Date(echeance.updatedAt),
          Property: property ? {
            id: property.id,
            name: property.name,
          } : null,
          Lease: lease ? {
            id: lease.id,
            type: lease.type || '',
            status: lease.status || '',
            Property: property ? {
              id: property.id,
              name: property.name,
            } : null,
          } : null,
        } as EcheanceRecurrente;
      });
    }
    // En mode normal, utiliser directement les données de l'API
    return echeances as any;
  }, [mode, echeances, properties, leases]);

  // Filtrer les échéances selon les filtres (en mode app-shell)
  const filteredEcheances = useMemo(() => {
    if (mode === 'normal') {
      // En mode normal, les données sont déjà filtrées par le serveur
      return convertedEcheances;
    }
    
    // Mode app-shell : filtrer côté client
    let filtered = [...convertedEcheances];

    const filters = filtersProp || {};

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(e => 
        e.label.toLowerCase().includes(searchLower)
      );
    }

    if (filters.type) {
      filtered = filtered.filter(e => e.type === filters.type);
    }

    if (filters.sens) {
      filtered = filtered.filter(e => e.sens === filters.sens);
    }

    if (filters.periodicite) {
      filtered = filtered.filter(e => e.periodicite === filters.periodicite);
    }

    if (filters.propertyId) {
      filtered = filtered.filter(e => e.Property?.id === filters.propertyId);
    }

    if (filters.leaseId) {
      filtered = filtered.filter(e => e.Lease?.id === filters.leaseId);
    }

    if (filters.recuperable === 'true') {
      filtered = filtered.filter(e => e.recuperable);
    } else if (filters.recuperable === 'false') {
      filtered = filtered.filter(e => !e.recuperable);
    }

    // Appliquer le filtre KPI actif
    if (activeKpiFilter === 'revenus') {
      filtered = filtered.filter(e => e.sens === 'CREDIT');
    } else if (activeKpiFilter === 'charges') {
      filtered = filtered.filter(e => e.sens === 'DEBIT');
    } else if (activeKpiFilter === 'actives') {
      filtered = filtered.filter(e => e.isActive);
    }

    // Filtrer par actif par défaut (sauf si total)
    if (activeKpiFilter !== 'total') {
      filtered = filtered.filter(e => e.isActive);
    }

    // Paginer
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return filtered.slice(start, end);
  }, [mode, convertedEcheances, filtersProp, activeKpiFilter, page, pageSize]);

  // Calculer le total filtré en mode app-shell
  const totalCount = useMemo(() => {
    if (mode === 'normal') {
      return pagination.total;
    }
    // En mode app-shell, compter toutes les échéances filtrées
    let filtered = [...convertedEcheances];
    const filters = filtersProp || {};

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(e => 
        e.label.toLowerCase().includes(searchLower)
      );
    }

    if (filters.type) {
      filtered = filtered.filter(e => e.type === filters.type);
    }

    if (filters.sens) {
      filtered = filtered.filter(e => e.sens === filters.sens);
    }

    if (filters.periodicite) {
      filtered = filtered.filter(e => e.periodicite === filters.periodicite);
    }

    if (filters.propertyId) {
      filtered = filtered.filter(e => e.Property?.id === filters.propertyId);
    }

    if (filters.leaseId) {
      filtered = filtered.filter(e => e.Lease?.id === filters.leaseId);
    }

    if (filters.recuperable === 'true') {
      filtered = filtered.filter(e => e.recuperable);
    } else if (filters.recuperable === 'false') {
      filtered = filtered.filter(e => !e.recuperable);
    }

    if (activeKpiFilter === 'revenus') {
      filtered = filtered.filter(e => e.sens === 'CREDIT');
    } else if (activeKpiFilter === 'charges') {
      filtered = filtered.filter(e => e.sens === 'DEBIT');
    } else if (activeKpiFilter === 'actives') {
      filtered = filtered.filter(e => e.isActive);
    }

    if (activeKpiFilter !== 'total') {
      filtered = filtered.filter(e => e.isActive);
    }

    return filtered.length;
  }, [mode, convertedEcheances, filtersProp, activeKpiFilter, pagination.total]);

  return {
    echeances: filteredEcheances, // Échéances filtrées et paginées (pour compatibilité)
    allEcheances: mode === 'app-shell' ? convertedEcheances : filteredEcheances, // ✅ Toutes les échéances non filtrées (pour filtrage en mémoire dans le composant)
    properties: properties as any[],
    leases: leases as any[],
    totalCount,
    pagination: {
      ...pagination,
      total: totalCount,
      pages: Math.ceil(totalCount / pageSize),
    },
    loading,
    error,
    // Utilitaires pour le mode normal
    router: router || null,
    searchParams: searchParams || null,
  };
}
