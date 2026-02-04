import { useState, useEffect, useRef } from 'react';
import type { MonthlyRentData, YearlyRentData } from '@/components/leases/LeasesRentEvolutionChart';
import type { FurnishedData } from '@/components/leases/LeasesByFurnishedChart';
import type { DepositsRentsData } from '@/components/leases/LeasesDepositsRentsChart';
import { getLeaseRepositoryOffline } from '@/lib/offline/repositories/LeaseRepositoryOffline';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';

interface UseLeasesChartsParams {
  propertyId?: string;
  refreshKey?: number; // Pour forcer le rafraîchissement
  mode?: 'normal' | 'app-shell';
}

export interface LeasesChartsData {
  rentEvolution: {
    monthly: MonthlyRentData[];
    yearly: YearlyRentData[];
  };
  byFurnished: FurnishedData[];
  depositsRents: DepositsRentsData;
}

// ✅ OFFLINE-FIRST: Données vides par défaut
const EMPTY_CHARTS_DATA: LeasesChartsData = {
  rentEvolution: {
    monthly: [],
    yearly: [],
  },
  byFurnished: [],
  depositsRents: {
    totalDeposits: 0,
    monthlyTotal: 0,
    yearlyTotal: 0,
  },
};

export function useLeasesCharts(params: UseLeasesChartsParams = {}) {
  const { mode = 'normal', propertyId, refreshKey } = params;
  const { organizationId } = useCurrentOrganization();
  
  // ✅ OFFLINE-FIRST: Détecter explicitement offline/app-shell
  // ⚠️ DURCISSEMENT: Utiliser UNIQUEMENT le paramètre mode, pas window.location
  // ✅ OFFLINE-FIRST : Pas d'API en offline/app-shell
  const isAppShell = mode === 'app-shell';
  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
  const shouldUseLocalData = isAppShell || isOffline;
  
  const [data, setData] = useState<LeasesChartsData>(EMPTY_CHARTS_DATA);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  // ✅ Anti-loop pour les events
  const lastRefreshRef = useRef<{ propertyId?: string; timestamp: number } | null>(null);
  
  // ✅ Anti-spam : Guard inFlight pour ignorer les réponses obsolètes
  const requestTokenRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // ✅ Stabilité : Dépendances strictes (propertyId, organizationId, mode, isOffline, refreshKey)
    const calculateCharts = async () => {
      // ✅ Anti-spam : Incrémenter le token pour ignorer les réponses obsolètes
      const currentToken = ++requestTokenRef.current;
      
      setIsLoading(true);
      setError(null);

      // ✅ OFFLINE-FIRST: Utiliser uniquement IndexedDB en offline/app-shell
      if (shouldUseLocalData && organizationId) {
        try {
          // ✅ APP-SHELL/OFFLINE: Calculer depuis IndexedDB uniquement
          const leaseRepo = getLeaseRepositoryOffline();
          const allLeases = await leaseRepo.getAll(organizationId, {});
          
          // ✅ Anti-spam : Vérifier que la requête n'est pas obsolète
          if (currentToken !== requestTokenRef.current) {
            return;
          }
          
          // Filtrer par propertyId si spécifié
          let filteredLeases = allLeases;
          if (propertyId) {
            filteredLeases = allLeases.filter(lease => lease.propertyId === propertyId);
          }
          
          // Filtrer uniquement les baux actifs (comme l'API)
          const activeLeases = filteredLeases.filter(lease => lease.status === 'ACTIF');
          
          // Calculer les graphiques (même logique que l'API)
          const now = new Date();
          const currentYear = now.getFullYear();
          const currentMonth = now.getMonth();
          
          // 1. Évolution des loyers (mensuel et annuel)
          // Pour la vue mensuelle, on génère les 12 derniers mois
          const monthlyData: MonthlyRentData[] = [];
          for (let i = 11; i >= 0; i--) {
            const date = new Date(currentYear, currentMonth - i, 1);
            const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            
            // Calculer le total des loyers des baux actifs à cette date
            const totalRent = activeLeases
              .filter(lease => {
                const start = new Date(lease.startDate);
                const end = lease.endDate ? new Date(lease.endDate) : null;
                return start <= date && (!end || end >= date);
              })
              .reduce((sum, lease) => sum + (lease.rentAmount || 0), 0);
            
            monthlyData.push({ month, totalRent });
          }

          // Pour la vue annuelle, on génère les 3 dernières années
          const yearlyData: YearlyRentData[] = [];
          for (let i = 2; i >= 0; i--) {
            const year = currentYear - i;
            
            // Calculer le total annuel (somme des 12 mois)
            const totalRent = activeLeases
              .filter(lease => {
                const startYear = new Date(lease.startDate).getFullYear();
                const endYear = lease.endDate ? new Date(lease.endDate).getFullYear() : 9999;
                return startYear <= year && endYear >= year;
              })
              .reduce((sum, lease) => sum + (lease.rentAmount || 0) * 12, 0);
            
            yearlyData.push({ year, totalRent });
          }

          // 2. Répartition par type de meublé
          const furnishedMap = new Map<string, number>();
          
          for (const lease of activeLeases) {
            const type = lease.furnishedType || 'VIDE';
            
            // Mapping des valeurs (comme l'API)
            let label = '';
            switch (type) {
              case 'VIDE':
                label = 'Vide';
                break;
              case 'MEUBLE':
                label = 'Meublé';
                break;
              case 'COLOCATION_MEUBLEE':
                label = 'Colocation meublée';
                break;
              case 'COLOCATION_VIDE':
                label = 'Colocation vide';
                break;
              default:
                label = type;
            }
            
            furnishedMap.set(label, (furnishedMap.get(label) || 0) + 1);
          }

          const byFurnished: FurnishedData[] = Array.from(furnishedMap.entries())
            .map(([label, count]) => ({ label, count }))
            .sort((a, b) => b.count - a.count);

          // 3. Cautions & Loyers cumulés
          const totalDeposits = activeLeases.reduce((sum, lease) => sum + (lease.deposit || 0), 0);
          const monthlyTotal = activeLeases.reduce((sum, lease) => sum + (lease.rentAmount || 0), 0);
          const yearlyTotal = monthlyTotal * 12;
          
          // ✅ Anti-spam : Vérifier que la requête n'est pas obsolète avant setState
          if (currentToken !== requestTokenRef.current) {
            return;
          }
          
          setData({
            rentEvolution: {
              monthly: monthlyData,
              yearly: yearlyData,
            },
            byFurnished,
            depositsRents: {
              totalDeposits,
              monthlyTotal,
              yearlyTotal,
            },
          });
        } catch (err) {
          // ✅ OFFLINE-FIRST: En offline/app-shell, pas d'erreur console (comportement attendu)
          // Utiliser console.warn en DEV uniquement pour le debug
          if (process.env.NODE_ENV === 'development') {
            console.warn('[useLeasesCharts] Erreur calcul local (offline/app-shell):', err);
          }
          
          // ✅ Anti-spam : Vérifier que la requête n'est pas obsolète avant setState
          if (currentToken !== requestTokenRef.current) {
            return;
          }
          
          setData(EMPTY_CHARTS_DATA);
        } finally {
          // ✅ Anti-spam : Vérifier que la requête n'est pas obsolète avant setState
          if (currentToken === requestTokenRef.current) {
            setIsLoading(false);
          }
        }
      } else if (!shouldUseLocalData) {
        // ✅ MODE NORMAL: Utiliser l'API uniquement si online et mode normal
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          // Si on passe en offline, utiliser les données locales
          if (currentToken === requestTokenRef.current) {
            setData(EMPTY_CHARTS_DATA);
            setIsLoading(false);
          }
          return;
        }

        // ✅ AbortController : Créer un nouveau controller pour cette requête
        abortControllerRef.current?.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
          const queryParams = new URLSearchParams();
          if (propertyId) queryParams.append('propertyId', propertyId);

          const response = await fetch(`/api/leases/charts?${queryParams.toString()}`, {
            signal: controller.signal,
          });
          
          // ✅ Anti-spam : Vérifier que la requête n'est pas obsolète
          if (currentToken !== requestTokenRef.current) {
            return;
          }
          
          if (!response.ok) {
            throw new Error('Erreur lors du chargement des graphiques des baux');
          }

          const responseData = await response.json();
          
          // ✅ Anti-spam : Vérifier que la requête n'est pas obsolète avant setState
          if (currentToken !== requestTokenRef.current) {
            return;
          }
          
          setData(responseData);
        } catch (err) {
          // ✅ Ne pas logguer si la requête a été abortée (comportement attendu)
          if (err instanceof Error && err.name === 'AbortError') {
            return;
          }
          
          // ✅ Anti-spam : Vérifier que la requête n'est pas obsolète avant setState
          if (currentToken !== requestTokenRef.current) {
            return;
          }
          
          console.error('[useLeasesCharts] Erreur API:', err);
          setError(err as Error);
          setData(EMPTY_CHARTS_DATA);
        } finally {
          // ✅ Anti-spam : Vérifier que la requête n'est pas obsolète avant setState
          if (currentToken === requestTokenRef.current) {
            setIsLoading(false);
          }
        }
      } else {
        // Pas d'organizationId ou conditions non remplies
        if (currentToken === requestTokenRef.current) {
          setData(EMPTY_CHARTS_DATA);
          setIsLoading(false);
        }
      }
    };

    calculateCharts();
    
    // ✅ APP-SHELL: Écouter les events de refresh
    if (shouldUseLocalData) {
      const handleRefresh = (event: Event) => {
        if (!(event instanceof CustomEvent) || !event.detail) return;
        
        const detail = event.detail as { scope?: string; propertyId?: string; reason?: string };
        
        // Filtrer par propertyId si spécifié
        if (propertyId && detail.scope === 'property' && detail.propertyId && detail.propertyId !== propertyId) {
          return;
        }
        
        // Anti-loop : ignorer les refresh identiques < 300ms
        const now = Date.now();
        const lastRefresh = lastRefreshRef.current;
        if (lastRefresh && 
            lastRefresh.propertyId === detail.propertyId &&
            now - lastRefresh.timestamp < 300) {
          return;
        }
        
        lastRefreshRef.current = {
          propertyId: detail.propertyId,
          timestamp: now,
        };
        
        calculateCharts();
      };
      
      window.addEventListener('leases:refresh', handleRefresh);
      return () => {
        window.removeEventListener('leases:refresh', handleRefresh);
        // ✅ Cleanup : Abort les requêtes en cours lors du unmount
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
      };
    }
  }, [
    // ✅ Stabilité : Dépendances strictes uniquement (pas d'objets/func instables)
    propertyId,
    organizationId,
    mode,
    isOffline,
    refreshKey,
    shouldUseLocalData,
  ]);

  return { data, isLoading, error };
}
