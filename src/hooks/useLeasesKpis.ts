import { useState, useEffect, useRef } from 'react';
import type { LeasesKpis } from '@/components/leases/LeasesKpiBar';
import { getLeaseRepositoryOffline } from '@/lib/offline/repositories/LeaseRepositoryOffline';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';

interface UseLeasesKpisParams {
  propertyId?: string;
  refreshKey?: number; // Pour forcer le rafraîchissement
  mode?: 'normal' | 'app-shell';
}

// ✅ OFFLINE-FIRST: Données vides par défaut
const EMPTY_KPIS: LeasesKpis = {
  totalLeases: 0,
  activeLeases: 0,
  expiringSoon: 0,
  indexationDue: 0,
};

export function useLeasesKpis(params: UseLeasesKpisParams = {}) {
  const { mode = 'normal', propertyId, refreshKey } = params;
  const { organizationId } = useCurrentOrganization();
  
  // ✅ OFFLINE-FIRST: Détecter explicitement offline/app-shell
  // ⚠️ DURCISSEMENT: Utiliser UNIQUEMENT le paramètre mode, pas window.location
  // ✅ OFFLINE-FIRST : Pas d'API en offline/app-shell
  const isAppShell = mode === 'app-shell';
  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
  const shouldUseLocalData = isAppShell || isOffline;
  
  const [kpis, setKpis] = useState<LeasesKpis>(EMPTY_KPIS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  // ✅ Anti-loop pour les events
  const lastRefreshRef = useRef<{ propertyId?: string; timestamp: number } | null>(null);
  
  // ✅ Anti-spam : Guard inFlight pour ignorer les réponses obsolètes
  const requestTokenRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // ✅ Stabilité : Dépendances strictes (propertyId, organizationId, mode, isOffline, refreshKey)
    const calculateKpis = async () => {
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
          
          // Calculer les KPI (même logique que l'API)
          const now = new Date();
          const today = new Date(now);
          today.setHours(0, 0, 0, 0);
          
          const in90Days = new Date(today);
          in90Days.setDate(in90Days.getDate() + 90);
          
          const in30Days = new Date(today);
          in30Days.setDate(in30Days.getDate() + 30);
          
          const totalLeases = filteredLeases.length;
          
          // Baux actifs : statut = ACTIF
          const activeLeases = filteredLeases.filter(lease => lease.status === 'ACTIF').length;
          
          // Baux expirant < 90 jours (statut ACTIF ou SIGNE et date de fin <= aujourd'hui + 90j)
          const expiringSoon = filteredLeases.filter(lease => {
            if (!lease.endDate) return false;
            const endDate = new Date(lease.endDate);
            endDate.setHours(0, 0, 0, 0);
            
            return (lease.status === 'ACTIF' || lease.status === 'SIGNE') && endDate <= in90Days && endDate >= today;
          }).length;
          
          // Indexations à prévoir (J-30)
          const indexationDue = filteredLeases.filter(lease => {
            if (lease.status !== 'ACTIF') return false;
            if (!lease.indexationType || lease.indexationType === 'AUCUNE') return false;
            
            // Calculer la prochaine date d'indexation
            const startDate = new Date(lease.startDate);
            const oneYearLater = new Date(startDate);
            oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
            oneYearLater.setHours(0, 0, 0, 0);
            
            // Si la date est dans les 30 prochains jours
            return oneYearLater <= in30Days && oneYearLater >= today;
          }).length;
          
          // ✅ Anti-spam : Vérifier que la requête n'est pas obsolète avant setState
          if (currentToken !== requestTokenRef.current) {
            return;
          }
          
          setKpis({
            totalLeases,
            activeLeases,
            expiringSoon,
            indexationDue,
          });
        } catch (err) {
          // ✅ OFFLINE-FIRST: En offline/app-shell, pas d'erreur console (comportement attendu)
          // Utiliser console.warn en DEV uniquement pour le debug
          if (process.env.NODE_ENV === 'development') {
            console.warn('[useLeasesKpis] Erreur calcul local (offline/app-shell):', err);
          }
          
          // ✅ Anti-spam : Vérifier que la requête n'est pas obsolète avant setState
          if (currentToken !== requestTokenRef.current) {
            return;
          }
          
          setKpis(EMPTY_KPIS);
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
            setKpis(EMPTY_KPIS);
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

          const response = await fetch(`/api/leases/kpis?${queryParams.toString()}`, {
            signal: controller.signal,
          });
          
          // ✅ Anti-spam : Vérifier que la requête n'est pas obsolète
          if (currentToken !== requestTokenRef.current) {
            return;
          }
          
          if (!response.ok) {
            throw new Error('Erreur lors du chargement des KPI des baux');
          }

          const data = await response.json();
          
          // ✅ Anti-spam : Vérifier que la requête n'est pas obsolète avant setState
          if (currentToken !== requestTokenRef.current) {
            return;
          }
          
          setKpis(data);
        } catch (err) {
          // ✅ Ne pas logguer si la requête a été abortée (comportement attendu)
          if (err instanceof Error && err.name === 'AbortError') {
            return;
          }
          
          // ✅ Anti-spam : Vérifier que la requête n'est pas obsolète avant setState
          if (currentToken !== requestTokenRef.current) {
            return;
          }
          
          console.error('[useLeasesKpis] Erreur API:', err);
          setError(err as Error);
          setKpis(EMPTY_KPIS);
        } finally {
          // ✅ Anti-spam : Vérifier que la requête n'est pas obsolète avant setState
          if (currentToken === requestTokenRef.current) {
            setIsLoading(false);
          }
        }
      } else {
        // Pas d'organizationId ou conditions non remplies
        if (currentToken === requestTokenRef.current) {
          setKpis(EMPTY_KPIS);
          setIsLoading(false);
        }
      }
    };

    calculateKpis();
    
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
        
        calculateKpis();
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

  return { kpis, isLoading, error };
}
