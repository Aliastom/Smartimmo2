/**
 * Hook unifié pour charger les données des prêts
 * Fonctionne en mode "normal" (online avec fallback offline) et "app-shell" (offline-first)
 */

'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getLoanRepositoryOffline } from '@/lib/offline/repositories/LoanRepositoryOffline';
import { getPropertyRepositoryOffline } from '@/lib/offline/repositories/PropertyRepositoryOffline';
import { getLocalDB } from '@/lib/offline/db';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import type { LocalLoan, LocalProperty } from '@/lib/offline/db';

export interface Loan {
  id: string;
  propertyId: string;
  propertyName: string;
  label: string;
  principal: number;
  annualRatePct: number;
  durationMonths: number;
  defermentMonths: number;
  insurancePct: number | null;
  feesUpfront?: number | null;
  startDate: string;
  endDate?: string | null;
  paymentDay?: number | null;
  rateType?: string;
  loanType?: string | null;
  repaymentType?: string | null;
  amortizationProfile?: string | null;
  notes?: string | null;
  isActive: boolean;
  monthlyPayment?: number;
}

export interface LoansFilters {
  search: string;
  propertyId: string;
  active: string;
}

export interface UseLoansDataOptions {
  mode: 'normal' | 'app-shell';
  filters?: LoansFilters;
  activeKpiFilter?: string | null;
  periodStart?: string; // Format: 'YYYY-MM'
  periodEnd?: string; // Format: 'YYYY-MM'
  propertyId?: string; // ✅ Optionnel : pour filtrer les events par propertyId (scope 'property')
  scope?: 'global' | 'property'; // ✅ Scope : 'global' pour page globale, 'property' pour tab property
}

export function useLoansData(options: UseLoansDataOptions) {
  const { mode, filters: filtersProp, activeKpiFilter, periodStart, periodEnd, propertyId, scope: scopeProp } = options;
  const { organizationId } = useCurrentOrganization();
  const router = mode === 'normal' ? useRouter() : null;
  const searchParams = mode === 'normal' ? useSearchParams() : null;

  // ✅ Déterminer le scope : 'property' si propertyId est défini, sinon 'global'
  const scope = scopeProp || (propertyId ? 'property' : 'global');

  const [loans, setLoans] = useState<LocalLoan[]>([]);
  const [properties, setProperties] = useState<LocalProperty[]>([]);
  const [loading, setLoading] = useState(mode === 'app-shell');
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [kpis, setKpis] = useState({ totalPrincipal: 0, totalCRD: 0, monthlyPaymentAvg: 0, activeLoansCount: 0 });
  const [kpisLoading, setKpisLoading] = useState(true);

  // Charger les données selon le mode
  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      if (mode === 'app-shell') {
        // Mode app-shell : charger UNIQUEMENT depuis IndexedDB
        if (!organizationId) {
          setError('OrganizationId requis');
          setLoading(false);
          setKpisLoading(false);
          return;
        }

        try {
          setLoading(true);
          setKpisLoading(true);
          setError(null);

          const loanRepo = getLoanRepositoryOffline();
          const propRepo = getPropertyRepositoryOffline();

          // Charger toutes les données en parallèle
          const [loansData, propertiesData] = await Promise.all([
            loanRepo.getAll(organizationId, {}),
            propRepo.getAll(organizationId, {}),
          ]);

          if (!cancelled) {
            setLoans(loansData);
            setProperties(propertiesData);
            
            // ✅ Filtrer les prêts selon les filtres pour le calcul des KPIs
            let loansForKpis = loansData;
            const filters = filtersProp || {};
            
            // Filtrer par propertyId si présent
            if (filters.propertyId) {
              loansForKpis = loansForKpis.filter(l => l.propertyId === filters.propertyId);
            }
            
            // Calculer les KPIs depuis les données filtrées
            const activeLoans = loansForKpis.filter(l => l.isActive);
            const totalPrincipal = activeLoans.reduce((sum, l) => sum + (l.principal || 0), 0);
            const totalCRD = activeLoans.reduce((sum, l) => {
              // Calcul simplifié du CRD (Capital Restant Dû)
              // TODO: Implémenter le calcul réel du CRD
              return sum + (l.principal || 0);
            }, 0);
            const monthlyPaymentAvg = activeLoans.length > 0
              ? activeLoans.reduce((sum, l) => sum + (l.monthlyPayment || 0), 0) / activeLoans.length
              : 0;
            
            setKpis({
              totalPrincipal,
              totalCRD,
              monthlyPaymentAvg,
              activeLoansCount: activeLoans.length,
            });
            
            setLoading(false);
            setKpisLoading(false);
          }
        } catch (e: any) {
          if (!cancelled) {
            console.error('[useLoansData] Erreur chargement app-shell:', e);
            setError('Impossible de charger les prêts.');
            setLoading(false);
            setKpisLoading(false);
          }
        }
      } else {
        // Mode normal : charger depuis l'API
        try {
          setLoading(true);
          setKpisLoading(true);
          setError(null);

          const params = new URLSearchParams();
          
          const filters = filtersProp || {};
          
          if (filters.search) params.append('q', filters.search);
          if (filters.propertyId) params.append('propertyId', filters.propertyId);
          if (filters.active) params.append('active', filters.active);

          // Appliquer le filtre KPI actif
          if (activeKpiFilter === 'actifs') {
            params.set('active', '1');
          }

          if (periodStart) params.append('from', periodStart);
          if (periodEnd) params.append('to', periodEnd);

          params.append('pageSize', '100');

          // Charger les prêts et propriétés depuis l'API
          const [loansResponse, propertiesResponse, kpisResponse] = await Promise.all([
            fetch(`/api/loans?${params.toString()}`),
            fetch('/api/properties?limit=1000'),
            fetch(`/api/loans?${params.toString()}&pageSize=1`),
          ]);

          if (!loansResponse.ok) {
            throw new Error('Erreur lors du chargement des prêts');
          }

          const loansData = await loansResponse.json();
          const propertiesData = await propertiesResponse.json();
          const kpisData = await kpisResponse.json();

          if (!cancelled) {
            setLoans(loansData.items || []);
            setProperties(Array.isArray(propertiesData) ? propertiesData : (propertiesData.data || []));
            setKpis(kpisData.kpis || { totalPrincipal: 0, totalCRD: 0, monthlyPaymentAvg: 0, activeLoansCount: 0 });
            setLoading(false);
            setKpisLoading(false);
          }
        } catch (e: any) {
          if (!cancelled) {
            console.error('[useLoansData] Erreur chargement normal:', e);
            // En cas d'erreur, essayer de charger depuis IndexedDB
            if (organizationId) {
              try {
                const loanRepo = getLoanRepositoryOffline();
                const propRepo = getPropertyRepositoryOffline();
                
                const [loansData, propertiesData] = await Promise.all([
                  loanRepo.getAll(organizationId, {}),
                  propRepo.getAll(organizationId, {}),
                ]);

                if (!cancelled) {
                  setLoans(loansData);
                  setProperties(propertiesData);
                  
                  // Calculer les KPIs depuis les données locales
                  const activeLoans = loansData.filter(l => l.isActive);
                  const totalPrincipal = activeLoans.reduce((sum, l) => sum + (l.principal || 0), 0);
                  const totalCRD = activeLoans.reduce((sum, l) => sum + (l.principal || 0), 0);
                  const monthlyPaymentAvg = activeLoans.length > 0
                    ? activeLoans.reduce((sum, l) => sum + (l.monthlyPayment || 0), 0) / activeLoans.length
                    : 0;
                  
                  setKpis({
                    totalPrincipal,
                    totalCRD,
                    monthlyPaymentAvg,
                    activeLoansCount: activeLoans.length,
                  });
                  
                  setLoading(false);
                  setKpisLoading(false);
                }
              } catch (offlineError) {
                if (!cancelled) {
                  setError('Impossible de charger les prêts.');
                  setLoading(false);
                  setKpisLoading(false);
                }
              }
            } else {
              setError('Impossible de charger les prêts.');
              setLoading(false);
              setKpisLoading(false);
            }
          }
        }
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [mode, organizationId, filtersProp, activeKpiFilter, periodStart, periodEnd, refreshKey]);

  // Écouter les événements de refresh en mode app-shell
  // ✅ UNIQUEMENT loans:refresh (pas sync:refresh)
  // ✅ Filtrer les events par scope (global vs property) avec filtrage strict
  // ✅ Anti-loop : ignorer les refresh identiques trop rapprochés
  const lastRefreshRef = useRef<{ propertyId?: string; reason?: string; timestamp: number } | null>(null);
  
  useEffect(() => {
    if (mode === 'app-shell') {
      const handleRefresh = (event: Event) => {
        if (!(event instanceof CustomEvent) || !event.detail) return;
        
        const detail = event.detail as { scope?: string; propertyId?: string; reason?: string };
        
        // ✅ FILTRE STRICT : Filtrer par scope
        if (scope === 'global') {
          // Scope 'global' : écouter uniquement les événements avec scope === 'global'
          if (detail.scope !== 'global') {
            if (process.env.NODE_ENV === 'development') {
              console.log('[useLoansData] ⚠️ Event ignoré (filtre strict global):', {
                scope: detail.scope,
                eventPropertyId: detail.propertyId
              });
            }
            return; // Ignorer les events scope 'property'
          }
        } else if (scope === 'property') {
          // Scope 'property' : écouter uniquement les événements avec scope === 'property' ET propertyId correspondant
          if (detail.scope !== 'property') {
            if (process.env.NODE_ENV === 'development') {
              console.log('[useLoansData] ⚠️ Event ignoré (filtre strict property - scope différent):', {
                scope: detail.scope,
                eventPropertyId: detail.propertyId,
                hookPropertyId: propertyId
              });
            }
            return; // Ignorer les events scope 'global'
          }
          if (propertyId && detail.propertyId && detail.propertyId !== propertyId) {
            if (process.env.NODE_ENV === 'development') {
              console.log('[useLoansData] ⚠️ Event ignoré (filtre strict property - propertyId différent):', {
                scope: detail.scope,
                eventPropertyId: detail.propertyId,
                hookPropertyId: propertyId
              });
            }
            return; // Ignorer les events avec propertyId différent
          }
        }
        
        // Anti-loop : ignorer les refresh identiques < 300ms
        const now = Date.now();
        const lastRefresh = lastRefreshRef.current;
        if (lastRefresh && 
            lastRefresh.propertyId === detail.propertyId && 
            lastRefresh.reason === detail.reason &&
            now - lastRefresh.timestamp < 300) {
          return;
        }
        
        lastRefreshRef.current = {
          propertyId: detail.propertyId,
          reason: detail.reason,
          timestamp: now,
        };
        
        setRefreshKey(prev => prev + 1);
      };
      
      window.addEventListener('loans:refresh', handleRefresh);
      return () => {
        window.removeEventListener('loans:refresh', handleRefresh);
      };
    }
  }, [mode, scope, propertyId]);

  // Convertir LocalLoan vers Loan pour compatibilité
  const convertedLoans: Loan[] = useMemo(() => {
    if (mode === 'app-shell') {
      // En mode app-shell, construire Loan depuis les données locales
      return loans.map(loan => {
        const property = properties.find(p => p.id === loan.propertyId);
        
        return {
          id: loan.id,
          propertyId: loan.propertyId,
          propertyName: property?.name || 'Bien inconnu',
          label: loan.label || '',
          principal: loan.principal || 0,
          annualRatePct: loan.annualRatePct || 0,
          durationMonths: loan.durationMonths || 0,
          defermentMonths: loan.defermentMonths || 0,
          insurancePct: loan.insurancePct || null,
          feesUpfront: loan.feesUpfront || null,
          startDate: loan.startDate,
          endDate: loan.endDate || null,
          paymentDay: loan.paymentDay || null,
          rateType: loan.rateType,
          loanType: loan.loanType || null,
          repaymentType: loan.repaymentType || null,
          amortizationProfile: loan.amortizationProfile || null,
          notes: loan.notes || null,
          isActive: loan.isActive || false,
          monthlyPayment: loan.monthlyPayment || undefined,
        };
      });
    }
    // En mode normal, utiliser directement les données de l'API
    return loans as any;
  }, [mode, loans, properties]);

  // Filtrer les prêts selon les filtres (en mode app-shell)
  const filteredLoans = useMemo(() => {
    if (mode === 'normal') {
      // En mode normal, les données sont déjà filtrées par le serveur
      return convertedLoans;
    }
    
    // Mode app-shell : filtrer côté client
    let filtered = [...convertedLoans];

    const filters = filtersProp || {};

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(loan => 
        loan.label.toLowerCase().includes(searchLower) ||
        loan.propertyName.toLowerCase().includes(searchLower)
      );
    }

    if (filters.propertyId) {
      filtered = filtered.filter(loan => loan.propertyId === filters.propertyId);
    }

    if (filters.active) {
      const isActive = filters.active === '1';
      filtered = filtered.filter(loan => loan.isActive === isActive);
    }

    // Appliquer le filtre KPI actif
    if (activeKpiFilter === 'actifs') {
      filtered = filtered.filter(loan => loan.isActive);
    }

    return filtered;
  }, [mode, convertedLoans, filtersProp, activeKpiFilter]);

  return {
    loans: filteredLoans,
    properties: properties as any[],
    kpis,
    kpisLoading,
    totalCount: filteredLoans.length,
    loading,
    error,
    // Utilitaires pour le mode normal
    router: router || null,
    searchParams: searchParams || null,
  };
}
