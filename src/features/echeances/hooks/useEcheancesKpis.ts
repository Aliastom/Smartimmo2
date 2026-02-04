/**
 * Hook unifié pour charger les KPIs des échéances récurrentes
 * Fonctionne en mode "normal" (online) et "app-shell" (offline-first)
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getLocalDB } from '@/lib/offline/db';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import type { LocalEcheanceRecurrente } from '@/lib/offline/db';

export interface EcheanceKpis {
  revenusAnnuels: number;
  chargesAnnuelles: number;
  totalEcheances: number;
  echeancesActives: number;
}

export interface UseEcheancesKpisOptions {
  mode: 'normal' | 'app-shell';
  propertyId?: string; // ✅ Optionnel : pour filtrer par bien (scope 'property')
  scope?: 'global' | 'property'; // ✅ Scope pour différencier page globale vs tab property
}

/**
 * Convertit un montant en montant annuel selon la périodicité
 */
function toAnnual(montant: number, periodicite: string): number {
  switch (periodicite) {
    case 'MONTHLY':
      return montant * 12;
    case 'QUARTERLY':
      return montant * 4;
    case 'YEARLY':
      return montant;
    case 'ONCE':
      return montant;
    default:
      return montant;
  }
}

export function useEcheancesKpis(options?: UseEcheancesKpisOptions) {
  const mode = options?.mode || 'normal';
  const propertyId = options?.propertyId;
  const scope = options?.scope || (propertyId ? 'property' : 'global');
  const { organizationId } = useCurrentOrganization();
  const [echeances, setEcheances] = useState<LocalEcheanceRecurrente[]>([]);
  const [loading, setLoading] = useState(mode === 'app-shell');
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Charger les échéances depuis IndexedDB en mode app-shell
  useEffect(() => {
    if (mode === 'app-shell' && organizationId) {
      let cancelled = false;

      async function loadData() {
        try {
          setLoading(true);
          setError(null);

          const db = await getLocalDB();
          let query = db.EcheanceRecurrente
            .where('organizationId')
            .equals(organizationId);
          
          // ✅ Filtrer par propertyId si spécifié
          if (propertyId) {
            query = query.filter(e => e.propertyId === propertyId);
          }
          
          const echeancesData = await query.toArray();

          if (!cancelled) {
            setEcheances(echeancesData);
            setLoading(false);
          }
        } catch (e: any) {
          if (!cancelled) {
            // Erreur silencieuse
            setError('Impossible de charger les échéances.');
            setLoading(false);
          }
        }
      }

      loadData();

      return () => {
        cancelled = true;
      };
    }
  }, [mode, organizationId, propertyId, refreshKey]);

  // Écouter les événements de refresh en mode app-shell
  // ✅ Filtrer les events par scope (global vs property)
  useEffect(() => {
    if (mode === 'app-shell') {
      const lastRefreshRef = { timestamp: 0, reason: '' };
      const handleRefreshEvent = (event: Event) => {
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
      
      window.addEventListener('deadlines:refresh', handleRefreshEvent);
      return () => {
        window.removeEventListener('deadlines:refresh', handleRefreshEvent);
      };
    }
  }, [mode, scope, propertyId]);

  // Calculer les KPIs en mode app-shell
  const calculatedKpis = useMemo(() => {
    if (mode === 'app-shell') {
      let revenusAnnuels = 0;
      let chargesAnnuelles = 0;

      echeances.forEach((echeance) => {
        const montantAnnuel = toAnnual(Number(echeance.montant), echeance.periodicite);

        if (echeance.sens === 'CREDIT') {
          revenusAnnuels += montantAnnuel;
        } else {
          chargesAnnuelles += Math.abs(montantAnnuel);
        }
      });

      return {
        revenusAnnuels,
        chargesAnnuelles,
        totalEcheances: echeances.length,
        echeancesActives: echeances.filter(e => e.isActive).length,
      };
    }
    return null;
  }, [mode, echeances]);

  // En mode normal, utiliser React Query
  const { data: apiData, isLoading: apiLoading, error: apiError } = useQuery<EcheanceKpis>({
    queryKey: ['echeances-kpis'],
    queryFn: async () => {
      const response = await fetch('/api/echeances/kpis', {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Erreur lors du chargement des KPIs');
      }
      return response.json();
    },
    enabled: mode === 'normal',
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  return {
    data: mode === 'normal' ? apiData : calculatedKpis,
    isLoading: mode === 'normal' ? apiLoading : loading,
    error: mode === 'normal' ? (apiError as Error | null) : (error ? new Error(error) : null),
  };
}
