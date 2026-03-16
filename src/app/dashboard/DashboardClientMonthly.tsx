'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import {
  Building2,
  Users,
  FileText,
  CreditCard,
  Plus,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { MonthlyFilters } from '@/components/dashboard/MonthlyFilters';
import { MonthlyKpiBar } from '@/components/dashboard/MonthlyKpiBar';
import { TasksPanel } from '@/components/dashboard/TasksPanel';
import type { MonthlyDashboardData } from '@/types/dashboard';

export default function DashboardClientMonthly() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Vérifier l'authentification côté client (fallback si le middleware ne fonctionne pas)
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Tester une route API protégée pour vérifier l'auth
        const response = await fetch('/api/dashboard/monthly?limit=1');
        if (response.status === 401 || response.status === 403) {
          // Non authentifié, rediriger vers login
          const redirectPath = window.location.pathname + window.location.search;
          router.push(`/login?redirect=${encodeURIComponent(redirectPath)}`);
        }
      } catch (error) {
        // En cas d'erreur réseau, on laisse le middleware gérer
        console.warn('[Dashboard] Erreur vérification auth:', error);
      }
    };
    
    checkAuth();
  }, [router]);
  
  // États pour les filtres
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return searchParams.get('month') || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [bienIds, setBienIds] = useState<string[]>([]);
  const [locataireIds, setLocataireIds] = useState<string[]>([]);
  const [type, setType] = useState<'INCOME' | 'EXPENSE' | 'ALL'>('ALL');
  const [statut, setStatut] = useState<'paye' | 'en_retard' | 'a_venir' | 'ALL'>('ALL');
  const [source, setSource] = useState<'loyer' | 'hors_loyer' | 'ALL'>('ALL');
  const [focusLoyer, setFocusLoyer] = useState<boolean>(() => {
    return searchParams.get('focusLoyer') === 'true';
  });

  // Mémoriser les paramètres de requête pour éviter les re-renders
  const queryParams = useMemo(() => {
    const params = new URLSearchParams({
      month,
      ...(bienIds.length > 0 && { bienIds: bienIds.join(',') }),
      ...(locataireIds.length > 0 && { locataireIds: locataireIds.join(',') }),
      ...(type !== 'ALL' && { type }),
      ...(statut !== 'ALL' && { statut }),
      ...(source !== 'ALL' && { source }),
      ...(focusLoyer && { focusLoyer: 'true' }),
    });
    return params.toString();
  }, [month, bienIds, locataireIds, type, statut, source, focusLoyer]);

  // Helper pour gérer les erreurs d'auth
  const handleAuthError = (response: Response) => {
    if (response.status === 401 || response.status === 403) {
      const redirectPath = window.location.pathname + window.location.search;
      router.push(`/login?redirect=${encodeURIComponent(redirectPath)}`);
      return true;
    }
    return false;
  };

  // Récupérer les biens et locataires pour les filtres
  const { data: propertiesData } = useQuery({
    queryKey: ['properties-for-filter'],
    queryFn: async () => {
      const response = await fetch('/api/properties?limit=1000');
      if (!response.ok) {
        if (handleAuthError(response)) {
          throw new Error('Authentification requise');
        }
        return { data: [] };
      }
      const data = await response.json();
      return { data: data.data || [] };
    },
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, error: any) => {
      if (error?.message === 'Authentification requise') return false;
      return failureCount < 2;
    },
  });

  const { data: tenantsData } = useQuery({
    queryKey: ['tenants-for-filter'],
    queryFn: async () => {
      const response = await fetch('/api/tenants?limit=1000');
      if (!response.ok) {
        if (handleAuthError(response)) {
          throw new Error('Authentification requise');
        }
        return { data: [] };
      }
      const data = await response.json();
      return { data: data.data || [] };
    },
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, error: any) => {
      if (error?.message === 'Authentification requise') return false;
      return failureCount < 2;
    },
  });

  // Utiliser React Query pour le cache et la gestion d'état
  const { data, isLoading, error } = useQuery<MonthlyDashboardData>({
    queryKey: ['dashboard-monthly', queryParams],
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/monthly?${queryParams}`);
      if (!response.ok) {
        // Si erreur d'authentification, rediriger vers login
        if (response.status === 401 || response.status === 403) {
          const redirectPath = window.location.pathname + window.location.search;
          router.push(`/login?redirect=${encodeURIComponent(redirectPath)}`);
          throw new Error('Authentification requise');
        }
        throw new Error('Erreur lors du chargement des données');
      }
      return response.json();
    },
    staleTime: 2 * 60 * 1000, // 2 minutes pour le dashboard
    retry: (failureCount, error: any) => {
      // Ne pas retry si c'est une erreur d'auth
      if (error?.message === 'Authentification requise') {
        return false;
      }
      return failureCount < 3;
    },
  });
  
  // Mettre à jour l'URL avec les filtres (une seule fois au changement)
  useEffect(() => {
    const params = new URLSearchParams();
    if (month) params.set('month', month);
    if (bienIds.length > 0) params.set('bienIds', bienIds.join(','));
    if (locataireIds.length > 0) params.set('locataireIds', locataireIds.join(','));
    if (type !== 'ALL') params.set('type', type);
    if (statut !== 'ALL') params.set('statut', statut);
    if (source !== 'ALL') params.set('source', source);
    if (focusLoyer) params.set('focusLoyer', 'true');
    
    router.replace(`/dashboard?${params.toString()}`, { scroll: false });
  }, [month, bienIds, locataireIds, type, statut, source, focusLoyer, router]);
  
  const handleFilterChange = (filters: {
    month?: string;
    bienIds?: string[];
    locataireIds?: string[];
    type?: 'INCOME' | 'EXPENSE' | 'ALL';
    statut?: 'paye' | 'en_retard' | 'a_venir' | 'ALL';
    source?: 'loyer' | 'hors_loyer' | 'ALL';
  }) => {
    if (filters.month !== undefined) setMonth(filters.month);
    if (filters.bienIds !== undefined) setBienIds(filters.bienIds);
    if (filters.locataireIds !== undefined) setLocataireIds(filters.locataireIds);
    if (filters.type !== undefined) setType(filters.type);
    if (filters.statut !== undefined) setStatut(filters.statut);
    if (filters.source !== undefined) setSource(filters.source);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">
            Vue mensuelle opérationnelle de votre portefeuille
          </p>
        </div>
      </div>

      {/* Toggle Focus Loyer - Très visible */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 bg-blue-500 rounded-lg">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Focus loyer</h3>
              <p className="text-sm text-gray-600">
                Afficher uniquement les transactions de gestion déléguée (loyers et frais de gestion)
              </p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={focusLoyer}
              onChange={(e) => setFocusLoyer(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
            <span className="ml-3 text-sm font-medium text-gray-700">
              {focusLoyer ? 'Activé' : 'Désactivé'}
            </span>
          </label>
        </div>
      </div>

      {/* Filtres */}
      <MonthlyFilters
        month={month}
        bienIds={bienIds}
        locataireIds={locataireIds}
        type={type}
        statut={statut}
        source={source}
        onFilterChange={handleFilterChange}
        biens={propertiesData?.data || []}
        locataires={tenantsData?.data || []}
      />

      {/* Erreur */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-red-600">
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-sm font-medium">
                {error instanceof Error ? error.message : 'Une erreur est survenue'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      {isLoading ? (
        <MonthlyKpiBar
          kpis={{
            sommesEncaisses: 0,
            sommesEncaissesRapprochees: 0,
            loyersAttendus: 0,
            depensesRealisees: 0,
            depensesRealiseesRapprochees: 0,
            cashflow: 0,
            tauxEncaissement: 0,
            bauxActifs: 0,
            documentsEnvoyes: 0,
            deltaSommesEncaisses: 0,
            deltaDepensesRealisees: 0,
            deltaCashflow: 0,
            deltaTauxEncaissement: 0,
          }}
          isLoading={true}
        />
      ) : data ? (
        <MonthlyKpiBar kpis={data.kpis} focusLoyer={focusLoyer} />
      ) : null}

      {/* Placeholder IA Insights (futur) */}
      {data?.insights && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <svg
                  className="h-5 w-5 text-blue-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-blue-900 mb-1">
                  Synthèse IA
                </h4>
                <p className="text-sm text-blue-700">{data.insights}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Panneaux de tâches côte à côte */}
      <div>
        {isLoading ? (
          <Card>
            <CardContent className="py-12">
              <div className="flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            </CardContent>
          </Card>
        ) : data ? (
          <TasksPanel
            loyersNonEncaisses={data.aTraiter.loyersNonEncaisses}
            relances={data.aTraiter.relances}
            transactionsNonRapprochees={data.aTraiter.transactionsNonRapprochees}
            indexations={data.aTraiter.indexations}
            echeancesPrets={data.aTraiter.echeancesPrets}
            echeancesCharges={data.aTraiter.echeancesCharges}
            bauxAEcheance={data.aTraiter.bauxAEcheance}
            documentsAValider={data.aTraiter.documentsAValider}
            layout="horizontal"
            currentMonth={month}
          />
        ) : null}
      </div>

    </div>
  );
}

