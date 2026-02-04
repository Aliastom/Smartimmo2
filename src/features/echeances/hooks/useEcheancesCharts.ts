/**
 * Hook unifié pour charger les graphiques des échéances récurrentes
 * Fonctionne en mode "normal" (online) et "app-shell" (offline-first)
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getLocalDB } from '@/lib/offline/db';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import { expandEcheances } from '@/lib/echeances/expandEcheances';
import type { CumulativeData } from '@/components/echeances/EcheancesCumulativeChart';
import type { TypeData } from '@/components/echeances/EcheancesByTypeChart';
import type { RecuperablesData } from '@/components/echeances/EcheancesRecuperablesChart';
import type { LocalEcheanceRecurrente } from '@/lib/offline/db';

export interface EcheancesChartsData {
  cumulative: CumulativeData[];
  byType: TypeData[];
  recuperables: RecuperablesData;
}

export interface UseEcheancesChartsOptions {
  mode: 'normal' | 'app-shell';
  periodStart: string; // YYYY-MM
  periodEnd: string; // YYYY-MM
  viewMode: 'monthly' | 'yearly';
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

/**
 * Génère les périodes mensuelles entre deux dates
 */
function generateMonthPeriods(fromYear: number, fromMonth: number, toYear: number, toMonth: number): string[] {
  const periods: string[] = [];
  let year = fromYear;
  let month = fromMonth;

  while (year < toYear || (year === toYear && month <= toMonth)) {
    periods.push(`${year}-${String(month).padStart(2, '0')}`);
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }

  return periods;
}

/**
 * Génère les périodes annuelles entre deux années
 */
function generateYearPeriods(fromYear: number, toYear: number): string[] {
  const periods: string[] = [];
  for (let year = fromYear; year <= toYear; year++) {
    periods.push(year.toString());
  }
  return periods;
}

export function useEcheancesCharts(options: UseEcheancesChartsOptions) {
  const { mode, periodStart, periodEnd, viewMode, propertyId, scope = propertyId ? 'property' : 'global' } = options;
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
            .equals(organizationId)
            .and(e => e.isActive === true);

          if (propertyId) {
            query = query.filter(e => e.propertyId === propertyId);
          }

          // Parser les dates pour filtrer
          const fromParts = periodStart.split('-');
          const fromYear = parseInt(fromParts[0]);
          const fromMonth = fromParts[1] ? parseInt(fromParts[1]) : 1;
          const fromDate = new Date(fromYear, fromMonth - 1, 1);

          const toParts = periodEnd.split('-');
          const toYear = parseInt(toParts[0]);
          const toMonth = toParts[1] ? parseInt(toParts[1]) : 12;
          const toDate = new Date(toYear, toMonth, 0, 23, 59, 59);

          const allEcheances = await query.toArray();

          // Filtrer par dates
          const filteredEcheances = allEcheances.filter(e => {
            const startAt = new Date(e.startAt);
            const endAt = e.endAt ? new Date(e.endAt) : null;
            return startAt <= toDate && (!endAt || endAt >= fromDate);
          });

          if (!cancelled) {
            setEcheances(filteredEcheances);
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
  }, [mode, organizationId, periodStart, periodEnd, propertyId, refreshKey]);

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

  // Calculer les graphiques en mode app-shell
  const calculatedCharts = useMemo(() => {
    if (mode === 'app-shell' && echeances.length >= 0) {
      // Parser les dates
      const fromParts = periodStart.split('-');
      const fromYear = parseInt(fromParts[0]);
      const fromMonth = fromParts[1] ? parseInt(fromParts[1]) : 1;

      const toParts = periodEnd.split('-');
      const toYear = parseInt(toParts[0]);
      const toMonth = toParts[1] ? parseInt(toParts[1]) : 12;

      // Générer les périodes selon le mode
      const periods = viewMode === 'yearly'
        ? generateYearPeriods(fromYear, toYear)
        : generateMonthPeriods(fromYear, fromMonth, toYear, toMonth);

      // Convertir les échéances pour expandEcheances
      const echeancesInput = echeances.map((e) => ({
        id: e.id,
        propertyId: e.propertyId || null,
        leaseId: e.leaseId || null,
        label: e.label,
        type: e.type as any,
        periodicite: e.periodicite as any,
        montant: Number(e.montant),
        recuperable: e.recuperable,
        sens: e.sens as any,
        startAt: new Date(e.startAt),
        endAt: e.endAt ? new Date(e.endAt) : null,
        isActive: e.isActive,
      }));

      // Calculer les données cumulées
      const cumulativeData: CumulativeData[] = periods.map((period) => {
        let credits = 0;
        let debits = 0;

        if (viewMode === 'yearly') {
          // Mode annuel : calculer le total annuel des échéances actives cette année
          const year = parseInt(period);
          const periodStart = new Date(year, 0, 1);
          const periodEnd = new Date(year, 11, 31, 23, 59, 59);

          echeancesInput.forEach((e) => {
            const isActive = new Date(e.startAt) <= periodEnd &&
                            (!e.endAt || new Date(e.endAt) >= periodStart);

            if (isActive) {
              const montantAnnuel = toAnnual(e.montant, e.periodicite);

              if (e.sens === 'CREDIT') {
                credits += montantAnnuel;
              } else {
                debits += Math.abs(montantAnnuel);
              }
            }
          });
        } else {
          // Mode mensuel : utiliser expandEcheances
          const occurrences = expandEcheances(echeancesInput, period, period);

          occurrences.forEach((occ) => {
            if (occ.sens === 'CREDIT') {
              credits += occ.amount;
            } else {
              debits += Math.abs(occ.amount);
            }
          });
        }

        return {
          period,
          credits,
          debits: -debits, // Négatif pour l'affichage
          solde: credits - debits,
        };
      });

      // Répartition par type (montants annuels)
      const byTypeMap = new Map<string, { montant: number; count: number }>();

      echeancesInput.forEach((e) => {
        const montantAnnuel = toAnnual(e.montant, e.periodicite);
        const current = byTypeMap.get(e.type) || { montant: 0, count: 0 };
        byTypeMap.set(e.type, {
          montant: current.montant + montantAnnuel,
          count: current.count + 1,
        });
      });

      const byType: TypeData[] = Array.from(byTypeMap.entries()).map(([type, data]) => ({
        type,
        montant: data.montant,
        count: data.count,
      }));

      // Charges récupérables vs non récupérables (montants annuels)
      let recuperables = 0;
      let nonRecuperables = 0;

      echeancesInput.forEach((e) => {
        if (e.sens === 'DEBIT') {
          const montantAnnuel = toAnnual(e.montant, e.periodicite);
          if (e.recuperable) {
            recuperables += montantAnnuel;
          } else {
            nonRecuperables += montantAnnuel;
          }
        }
      });

      return {
        cumulative: cumulativeData,
        byType,
        recuperables: { recuperables, nonRecuperables },
      };
    }
    return null;
  }, [mode, echeances, periodStart, periodEnd, viewMode]);

  // En mode normal, utiliser React Query
  const { data: apiData, isLoading: apiLoading, error: apiError } = useQuery<EcheancesChartsData>({
    queryKey: ['echeances-charts', periodStart, periodEnd, viewMode, propertyId],
    queryFn: async () => {
      const params = new URLSearchParams({
        from: periodStart,
        to: periodEnd,
        viewMode,
      });

      if (propertyId) {
        params.append('propertyId', propertyId);
      }

      const response = await fetch(`/api/echeances/charts?${params.toString()}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Erreur lors du chargement des graphiques');
      }
      return response.json();
    },
    enabled: mode === 'normal',
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  return {
    data: mode === 'normal' ? apiData : calculatedCharts,
    isLoading: mode === 'normal' ? apiLoading : loading,
    error: mode === 'normal' ? (apiError as Error | null) : (error ? new Error(error) : null),
  };
}
