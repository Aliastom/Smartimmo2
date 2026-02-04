/**
 * Hook unifié pour charger les données des baux
 * Fonctionne en mode "normal" (online avec fallback offline) et "app-shell" (offline-first)
 */

'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getLeaseRepositoryOffline } from '@/lib/offline/repositories/LeaseRepositoryOffline';
import { getPropertyRepositoryOffline } from '@/lib/offline/repositories/PropertyRepositoryOffline';
import { getTenantRepositoryOffline } from '@/lib/offline/repositories/TenantRepositoryOffline';
import { getLocalDB } from '@/lib/offline/db';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import type { LeaseWithDetails } from '@/lib/services/leasesService';
import type { LocalLease, LocalProperty, LocalTenant } from '@/lib/offline/db';
// ✅ OFFLINE-FIRST: Retiré ensureDbAvailable et handleDbUnavailableError
// Les repositories gèrent eux-mêmes les erreurs DB_UNAVAILABLE
// Ne pas déclencher l'écran de fallback ici (comme useTransactionsData)

export interface LeasesPageData {
  leases: LeaseWithDetails[];
  properties: any[];
  tenants: any[];
  totalCount: number;
  loading: boolean;
  error: string | null;
}

export interface LeasesFilters {
  search: string;
  propertyId: string;
  tenantId: string;
  type: string;
  furnishedType: string;
  status: string;
  startDateFrom: string;
  startDateTo: string;
  endDateFrom: string;
  endDateTo: string;
  indexationType: string;
  indexationDateFrom: string;
  indexationDateTo: string;
  rentMin: string;
  rentMax: string;
  depositMin: string;
  depositMax: string;
}

export interface UseLeasesDataOptions {
  mode: 'normal' | 'app-shell';
  filters?: LeasesFilters;
  activeKpiFilter?: string | null;
  propertyId?: string; // ✅ Optionnel : pour filtrer les events par propertyId
  // Filtres pour le mode app-shell (gérés par le Core Component)
}

export function useLeasesData(options: UseLeasesDataOptions) {
  const { mode, filters: filtersProp, activeKpiFilter, propertyId } = options;
  const { organizationId } = useCurrentOrganization();
  const router = mode === 'normal' ? useRouter() : null;
  const searchParams = mode === 'normal' ? useSearchParams() : null;

  const [leases, setLeases] = useState<LocalLease[]>([]);
  const [properties, setProperties] = useState<LocalProperty[]>([]);
  const [tenants, setTenants] = useState<LocalTenant[]>([]);
  const [loading, setLoading] = useState(mode === 'app-shell');
  const [error, setError] = useState<string | null>(null);

  // ⚙️ Utiliser une ref pour accéder aux valeurs actuelles des filtres dans l'event listener
  // sans créer de dépendances qui causent des remounts
  const filtersRef = useRef(filtersProp);
  filtersRef.current = filtersProp;
  const propertyIdRef = useRef(propertyId);
  propertyIdRef.current = propertyId;

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

          // ✅ OFFLINE-FIRST: Ne pas appeler ensureDbAvailable (comme useTransactionsData)
          // Les repositories gèrent eux-mêmes les erreurs DB_UNAVAILABLE
          const leaseRepo = getLeaseRepositoryOffline();
          const propRepo = getPropertyRepositoryOffline();
          const tenantRepo = getTenantRepositoryOffline();

          // ✅ Filtrer par propertyId si fourni dans les filtres
          const filters = filtersProp || {};
          const leaseFilters: any = {};
          if (filters.propertyId) {
            leaseFilters.propertyId = filters.propertyId;
          }

          // ✅ [LOG B2] Début loadData (useEffect initial)
          if (process.env.NODE_ENV === 'development') {
            console.log('[useLeasesData] [LOG B2] 🔄 Début loadData (useEffect initial):', {
              organizationId,
              leaseFilters,
              propertyId
            });
          }

          // Charger toutes les données en parallèle
          const [leasesData, propertiesData, tenantsData] = await Promise.all([
            leaseRepo.getAll(organizationId, leaseFilters),
            propRepo.getAll(organizationId, {}),
            tenantRepo.getAll(organizationId, {}),
          ]);

          // ✅ [LOG B3] Avant setLeases (useEffect initial)
          if (process.env.NODE_ENV === 'development') {
            console.log('[useLeasesData] [LOG B3] ✅ Avant setLeases (useEffect initial):', {
              count: leasesData.length,
              premierId: leasesData[0]?.id,
              premierStatus: leasesData[0]?.status,
              isNewArray: true // Toujours une nouvelle référence depuis Dexie
            });
          }

          if (!cancelled) {
            setLeases(leasesData);
            setProperties(propertiesData);
            setTenants(tenantsData);
            setLoading(false);
          }
        } catch (e: any) {
          if (!cancelled) {
            // ✅ OFFLINE-FIRST: Ne pas déclencher l'écran de fallback ici
            // Les erreurs DB_UNAVAILABLE sont gérées par les repositories
            console.error('[useLeasesData] Erreur chargement app-shell:', e);
            setError('Impossible de charger les baux.');
            setLoading(false);
          }
        }
      } else {
        // Mode normal : charger depuis l'API
        try {
          setLoading(true);
          setError(null);

          const params = new URLSearchParams();
          
          // Construire les paramètres depuis searchParams ou filtersProp
          const filters = filtersProp || {};
          
          if (filters.search) params.append('search', filters.search);
          if (filters.propertyId) params.append('propertyId', filters.propertyId);
          if (filters.tenantId) params.append('tenantId', filters.tenantId);
          if (filters.type) params.append('type', filters.type);
          if (filters.furnishedType) params.append('furnishedType', filters.furnishedType);
          if (filters.indexationType) params.append('indexationType', filters.indexationType);
          if (filters.rentMin) params.append('rentMin', filters.rentMin);
          if (filters.rentMax) params.append('rentMax', filters.rentMax);
          if (filters.depositMin) params.append('depositMin', filters.depositMin);
          if (filters.depositMax) params.append('depositMax', filters.depositMax);
          if (filters.startDateFrom) params.append('startDateFrom', filters.startDateFrom);
          if (filters.startDateTo) params.append('startDateTo', filters.startDateTo);
          if (filters.endDateFrom) params.append('endDateFrom', filters.endDateFrom);
          if (filters.endDateTo) params.append('endDateTo', filters.endDateTo);
          if (filters.indexationDateFrom) params.append('indexationDateFrom', filters.indexationDateFrom);
          if (filters.indexationDateTo) params.append('indexationDateTo', filters.indexationDateTo);

          // Appliquer le filtre KPI actif
          if (activeKpiFilter === 'active') {
            params.append('status', 'ACTIF');
          } else if (activeKpiFilter === 'expiring') {
            params.append('upcomingExpiration', 'true');
          } else if (activeKpiFilter === 'indexation') {
            params.append('indexationDue', 'true');
          } else if (filters.status) {
            params.append('status', filters.status);
          }

          // Charger les baux depuis l'API
          const [leasesResponse, propertiesResponse, tenantsResponse] = await Promise.all([
            fetch(`/api/leases?${params.toString()}`),
            fetch('/api/properties'),
            fetch('/api/tenants'),
          ]);

          if (!leasesResponse.ok) {
            throw new Error('Erreur lors du chargement des baux');
          }

          const leasesData = await leasesResponse.json();
          const propertiesData = await propertiesResponse.json();
          const tenantsData = await tenantsResponse.json();

          // Adapter selon le format de réponse de l'API
          let leasesArray: any[] = [];
          if (Array.isArray(leasesData)) {
            leasesArray = leasesData;
          } else if (leasesData.items) {
            leasesArray = leasesData.items;
          } else if (leasesData.data) {
            leasesArray = leasesData.data;
          }

          if (!cancelled) {
            setLeases(leasesArray as any);
            setProperties(Array.isArray(propertiesData) ? propertiesData : (propertiesData.data || []));
            setTenants(Array.isArray(tenantsData) ? tenantsData : (tenantsData.data || []));
            setLoading(false);
          }
        } catch (e: any) {
          if (!cancelled) {
            console.error('[useLeasesData] Erreur chargement normal:', e);
            // En cas d'erreur, essayer de charger depuis IndexedDB
            if (organizationId) {
              try {
                const leaseRepo = getLeaseRepositoryOffline();
                const propRepo = getPropertyRepositoryOffline();
                const tenantRepo = getTenantRepositoryOffline();
                
                const [leasesData, propertiesData, tenantsData] = await Promise.all([
                  leaseRepo.getAll(organizationId, {}),
                  propRepo.getAll(organizationId, {}),
                  tenantRepo.getAll(organizationId, {}),
                ]);

                if (!cancelled) {
                  setLeases(leasesData);
                  setProperties(propertiesData);
                  setTenants(tenantsData);
                  setLoading(false);
                }
              } catch (offlineError) {
                if (!cancelled) {
                  setError('Impossible de charger les baux.');
                  setLoading(false);
                }
              }
            } else {
              setError('Impossible de charger les baux.');
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
    // ⚙️ OPTIMISATION: refreshKey retiré des dépendances pour éviter les rechargements complets
    // Les refreshes sont gérés par l'event listener séparé ci-dessous qui met à jour directement les données
  }, [mode, organizationId, filtersProp?.propertyId, activeKpiFilter]);

  // Écouter les événements de refresh en mode app-shell
  // ✅ UNIQUEMENT leases:refresh (pas sync:refresh)
  // ✅ Filtrer les events par propertyId si spécifié
  // ✅ Anti-loop : ignorer les refresh identiques trop rapprochés
  // ⚙️ OPTIMISATION: Au lieu d'utiliser refreshKey (qui déclenche un rechargement complet),
  // mettre à jour directement les données depuis IndexedDB pour éviter un remount complet
  const lastRefreshRef = useRef<{ propertyId?: string; reason?: string; timestamp: number } | null>(null);
  
  useEffect(() => {
    if (mode === 'app-shell' && organizationId) {
      const handleRefresh = async (event?: Event) => {
        // ⚙️ OPTIMISATION: Recharger uniquement les leases depuis IndexedDB
        // sans déclencher un remount complet via refreshKey
        
        // ✅ FILTRE STRICT : Si propertyId est défini dans les filtres, accepter UNIQUEMENT les events avec scope='property' ET propertyId correspondant
        const currentFilters = filtersRef.current;
        const currentPropertyId = propertyIdRef.current;
        
        // ✅ [LOG B1] Event reçu
        if (process.env.NODE_ENV === 'development' && event instanceof CustomEvent && event.detail) {
          const detail = event.detail as { scope?: string; propertyId?: string; reason?: string };
          console.log('[useLeasesData] [LOG B1] Event leases:refresh reçu:', {
            detail,
            propertyIdHook: currentPropertyId,
            filters: currentFilters
          });
        }
        
        if (event instanceof CustomEvent && event.detail) {
          const detail = event.detail as { scope?: string; propertyId?: string; reason?: string };
          
          // ✅ Filtrer par scope : si propertyId est défini, on est en scope 'property', sinon scope 'global'
          if (currentPropertyId) {
            // Scope 'property' : écouter uniquement les événements scope 'property' avec le bon propertyId
            if (detail.scope !== 'property' || !detail.propertyId || detail.propertyId !== currentPropertyId) {
              if (process.env.NODE_ENV === 'development') {
                console.log('[useLeasesData] [LOG B1] ⚠️ Event ignoré (filtre strict property):', {
                  scope: detail.scope,
                  eventPropertyId: detail.propertyId,
                  hookPropertyId: currentPropertyId
                });
              }
              return; // Ignorer les events scope 'global' ou scope 'property' avec propertyId différent
            }
          } else {
            // Scope 'global' : écouter uniquement les événements scope 'global'
            if (detail.scope !== 'global') {
              if (process.env.NODE_ENV === 'development') {
                console.log('[useLeasesData] [LOG B1] ⚠️ Event ignoré (filtre strict global):', {
                  scope: detail.scope,
                  eventPropertyId: detail.propertyId
                });
              }
              return; // Ignorer les events scope 'property'
            }
          }
          
          // Anti-loop : ignorer les refresh identiques < 300ms
          const now = Date.now();
          const lastRefresh = lastRefreshRef.current;
          if (lastRefresh && 
              lastRefresh.propertyId === detail.propertyId && 
              lastRefresh.reason === detail.reason &&
              now - lastRefresh.timestamp < 300) {
            if (process.env.NODE_ENV === 'development') {
              console.log('[useLeasesData] [LOG B1] ⚠️ Event ignoré (anti-loop < 300ms)');
            }
            return;
          }
          
          lastRefreshRef.current = {
            propertyId: detail.propertyId,
            reason: detail.reason,
            timestamp: now,
          };
        }
        
        // ⚙️ OPTIMISATION: Recharger directement depuis IndexedDB au lieu d'utiliser refreshKey
        try {
          const leaseRepo = getLeaseRepositoryOffline();
          
          // Utiliser les filtres actuels depuis la ref (pas depuis les dépendances)
          const leaseFilters: any = {};
          if (currentFilters?.propertyId) {
            leaseFilters.propertyId = currentFilters.propertyId;
          }
          
          // ✅ [LOG B2] Début loadData
          if (process.env.NODE_ENV === 'development') {
            console.log('[useLeasesData] [LOG B2] 🔄 Début loadData (handleRefresh):', {
              organizationId,
              leaseFilters,
              propertyId: currentPropertyId
            });
          }
          
          const leasesData = await leaseRepo.getAll(organizationId, leaseFilters);
          
          // ✅ [LOG B3] Avant setLeases
          if (process.env.NODE_ENV === 'development') {
            const eventDetail = event instanceof CustomEvent && event.detail ? (event.detail as any) : null;
            const concernedLeaseId = eventDetail?.leaseId || null;
            const concernedLease = concernedLeaseId ? leasesData.find(l => l.id === concernedLeaseId) : null;
            console.log('[useLeasesData] [LOG B3] ✅ Avant setLeases:', {
              count: leasesData.length,
              premierId: leasesData[0]?.id,
              premierStatus: leasesData[0]?.status,
              concernedLeaseId: concernedLease?.id || concernedLeaseId,
              concernedLeaseStatus: concernedLease?.status,
              isNewArray: true, // Toujours une nouvelle référence depuis Dexie
              leasesDataRef: leasesData // Référence de l'array
            });
          }
          
          // Mettre à jour l'état directement sans recharger tout
          // ✅ CRITIQUE: leasesData est une nouvelle référence d'array depuis Dexie
          setLeases(leasesData);
          
          // ✅ [LOG B4] Après setLeases (dans un setTimeout pour voir l'état après le render)
          if (process.env.NODE_ENV === 'development') {
            setTimeout(() => {
              console.log('[useLeasesData] [LOG B4] ✅ Après setLeases (état mis à jour)');
            }, 0);
          }
        } catch (error) {
          console.error('[useLeasesData] Erreur lors du refresh:', error);
          // En cas d'erreur critique, ne rien faire (les données restent telles quelles)
          // On ne veut pas déclencher un remount complet avec refreshKey
        }
      };
      
      // ⚠️ CRITIQUE: Ne pas écouter sync:refresh (événement global qui déclencherait des recalculs inutiles)
      // Utiliser uniquement leases:refresh avec filtrage par propertyId
      window.addEventListener('leases:refresh', handleRefresh);
      return () => {
        window.removeEventListener('leases:refresh', handleRefresh);
      };
    }
    // ⚙️ OPTIMISATION: Ne pas inclure filtersProp ni propertyId dans les dépendances pour éviter de recréer le listener
    // On utilise des refs pour accéder aux valeurs actuelles
  }, [mode, organizationId]);

  // ✅ Stabiliser properties et tenants pour éviter les recalculs inutiles
  const stableProperties = useMemo(() => properties, [properties.length, properties.map(p => p.id).join(',')]);
  const stableTenants = useMemo(() => tenants, [tenants.length, tenants.map(t => t.id).join(',')]);

  // Convertir LocalLease vers LeaseWithDetails pour compatibilité
  const convertedLeases: LeaseWithDetails[] = useMemo(() => {
    if (mode === 'app-shell') {
      // En mode app-shell, construire LeaseWithDetails depuis les données locales
      if (leases.length === 0) return [];
      
      // ✅ [LOG B5] Conversion des leases
      if (process.env.NODE_ENV === 'development') {
        console.log('[useLeasesData] [LOG B5] 🔄 Conversion leases → LeaseWithDetails:', {
          inputCount: leases.length,
          inputStatuses: leases.map(l => `${l.id.slice(0, 8)}:${l.status}`).join(', ')
        });
      }
      
      const converted = leases.map(lease => {
        const property = stableProperties.find(p => p.id === lease.propertyId);
        const tenant = stableTenants.find(t => t.id === lease.tenantId);
        
        return {
          id: lease.id,
          propertyId: lease.propertyId, // ✅ CRITIQUE: Inclure propertyId
          tenantId: lease.tenantId, // ✅ CRITIQUE: Inclure tenantId
          status: lease.status || 'BROUILLON',
          runtimeStatus: lease.status || 'BROUILLON',
          type: lease.type || '',
          furnishedType: lease.furnishedType || '',
          startDate: lease.startDate,
          endDate: lease.endDate || undefined,
          rentAmount: lease.rentAmount || 0,
          charges: (lease.chargesRecupMensuelles || 0) + (lease.chargesNonRecupMensuelles || 0),
          chargesRecupMensuelles: lease.chargesRecupMensuelles || 0,
          chargesNonRecupMensuelles: lease.chargesNonRecupMensuelles || 0,
          deposit: lease.deposit || 0,
          paymentDay: lease.paymentDay || undefined,
          indexationType: lease.indexationType || '',
          notes: lease.notes || undefined,
          signedPdfUrl: lease.signedPdfUrl || undefined,
          Property: property ? {
            id: property.id,
            name: property.name,
            address: property.address || '',
            city: property.city || '',
            postalCode: property.postalCode || '',
          } : {
            id: lease.propertyId,
            name: 'Bien inconnu',
            address: '',
            city: '',
            postalCode: '',
          },
          Tenant: tenant ? {
            id: tenant.id,
            firstName: tenant.firstName,
            lastName: tenant.lastName,
            email: tenant.email,
            phone: tenant.phone || undefined,
          } : {
            id: lease.tenantId,
            firstName: 'Locataire',
            lastName: 'inconnu',
            email: '',
            phone: undefined,
          },
          hasSignedLease: !!lease.signedPdfUrl,
          createdAt: lease.createdAt || new Date().toISOString(),
          // ✅ CRITIQUE: updatedAt est TOUJOURS une string ISO dans IndexedDB
          // Normaliser pour garantir la cohérence (string ISO ou Date → string ISO)
          updatedAt: typeof lease.updatedAt === 'string' 
            ? lease.updatedAt 
            : (lease.updatedAt instanceof Date 
              ? lease.updatedAt.toISOString() 
              : (lease.updatedAt ? new Date(lease.updatedAt).toISOString() : new Date().toISOString())),
        };
      });
      
      // ✅ [LOG B5] Après conversion
      if (process.env.NODE_ENV === 'development') {
        console.log('[useLeasesData] [LOG B5] ✅ Conversion terminée:', {
          outputCount: converted.length,
          outputStatuses: converted.map(l => `${l.id.slice(0, 8)}:${l.status}`).join(', ')
        });
      }
      
      return converted;
    }
    // En mode normal, utiliser directement les données de l'API
    return leases as any;
  }, [mode, leases, stableProperties, stableTenants]);

  // Filtrer les baux selon les filtres (en mode app-shell)
  const filteredLeases = useMemo(() => {
    if (mode === 'normal') {
      // En mode normal, les données sont déjà filtrées par le serveur
      return convertedLeases;
    }
    
    // Mode app-shell : filtrer côté client
    let filtered = [...convertedLeases];

    const filters = filtersProp || {};

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(lease => 
        lease.Property.name.toLowerCase().includes(searchLower) ||
        `${lease.Tenant.firstName} ${lease.Tenant.lastName}`.toLowerCase().includes(searchLower)
      );
    }

    // ✅ Note: propertyId est déjà filtré au niveau IndexedDB, donc pas besoin de refiltrer ici
    // Mais on garde le filtre pour la compatibilité avec le mode normal
    if (filters.propertyId && mode === 'normal') {
      filtered = filtered.filter(lease => lease.propertyId === filters.propertyId);
    }

    if (filters.tenantId) {
      filtered = filtered.filter(lease => lease.tenantId === filters.tenantId);
    }

    if (filters.type) {
      filtered = filtered.filter(lease => lease.type === filters.type);
    }

    if (filters.furnishedType) {
      filtered = filtered.filter(lease => lease.furnishedType === filters.furnishedType);
    }

    if (filters.status) {
      filtered = filtered.filter(lease => lease.status === filters.status);
    }

    if (filters.rentMin) {
      const min = parseFloat(filters.rentMin);
      filtered = filtered.filter(lease => lease.rentAmount >= min);
    }

    if (filters.rentMax) {
      const max = parseFloat(filters.rentMax);
      filtered = filtered.filter(lease => lease.rentAmount <= max);
    }

    if (filters.depositMin) {
      const min = parseFloat(filters.depositMin);
      filtered = filtered.filter(lease => (lease.deposit || 0) >= min);
    }

    if (filters.depositMax) {
      const max = parseFloat(filters.depositMax);
      filtered = filtered.filter(lease => (lease.deposit || 0) <= max);
    }

    if (filters.startDateFrom) {
      const from = new Date(filters.startDateFrom);
      filtered = filtered.filter(lease => new Date(lease.startDate) >= from);
    }

    if (filters.startDateTo) {
      const to = new Date(filters.startDateTo);
      filtered = filtered.filter(lease => new Date(lease.startDate) <= to);
    }

    if (filters.endDateFrom) {
      const from = new Date(filters.endDateFrom);
      filtered = filtered.filter(lease => lease.endDate && new Date(lease.endDate) >= from);
    }

    if (filters.endDateTo) {
      const to = new Date(filters.endDateTo);
      filtered = filtered.filter(lease => lease.endDate && new Date(lease.endDate) <= to);
    }

    // Appliquer le filtre KPI actif
    if (activeKpiFilter === 'active') {
      filtered = filtered.filter(lease => lease.status === 'ACTIF');
    } else if (activeKpiFilter === 'expiring') {
      // Baux expirant dans les 90 jours
      const now = new Date();
      const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(lease => {
        if (!lease.endDate) return false;
        const endDate = new Date(lease.endDate);
        return endDate >= now && endDate <= in90Days;
      });
    } else if (activeKpiFilter === 'indexation') {
      // Indexations à prévoir - logique simplifiée
      // TODO: Implémenter la logique complète d'indexation
      filtered = filtered.filter(lease => lease.status === 'ACTIF');
    }

    return filtered;
  }, [mode, convertedLeases, filtersProp, activeKpiFilter]);

  return {
    leases: filteredLeases, // ✅ Données filtrées (pour compatibilité)
    allLeases: convertedLeases, // ✅ Toutes les données non filtrées (pour filtrage en mémoire dans PropertyLeasesClient)
    properties: properties as any[],
    tenants: tenants as any[],
    totalCount: filteredLeases.length,
    loading,
    error,
    // Utilitaires pour le mode normal
    router: router || null,
    searchParams: searchParams || null,
  };
}
