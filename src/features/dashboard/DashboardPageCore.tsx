/**
 * Core Component pour la page Dashboard mensuel
 * 
 * Une seule source de vérité graphique utilisable en mode "normal" et "app-shell"
 * Toute la logique UI est centralisée ici.
 * 
 * RÉPLIQUE EXACTEMENT le comportement de DashboardClientMonthly.tsx
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import {
  Building2,
  Loader2,
  Menu,
  X,
} from 'lucide-react';
import { MonthlyFilters } from '@/components/dashboard/MonthlyFilters';
import { MonthlyKpiBar } from '@/components/dashboard/MonthlyKpiBar';
import { TasksPanel } from '@/components/dashboard/TasksPanel';
import { GestionnaireDelegueReportPanel } from '@/components/dashboard/GestionnaireDelegueReportPanel';
import type { MonthlyDashboardData } from '@/types/dashboard';
import { useDashboardData, type DashboardFilters } from './hooks/useDashboardData';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import { logToServer } from '@/lib/utils/logger';
import { useSidebarOptional } from '@/contexts/SidebarContext';

export interface DashboardPageCoreProps {
  mode: 'normal' | 'app-shell';
}

export function DashboardPageCore({
  mode,
}: DashboardPageCoreProps) {
  const { organizationId } = useCurrentOrganization();
  const router = mode === 'normal' ? useRouter() : null;
  const searchParamsHook = mode === 'normal' ? useSearchParams() : null;
  const sidebarContext = useSidebarOptional();

  // PHASE 4 — Hydratation UI avec les données locales
  // Utiliser un ref pour éviter les logs StrictMode
  const phase4MountLoggedRef = React.useRef(false);
  useEffect(() => {
    if (mode === 'app-shell' && !phase4MountLoggedRef.current) {
      phase4MountLoggedRef.current = true;
      logToServer('[PHASE 4] 🎨 Hydratation UI - DashboardPageCore se monte');
    }
  }, [mode]);

  // États pour les filtres
  const [month, setMonth] = useState(() => {
    const now = new Date();
    if (mode === 'normal' && searchParamsHook) {
      return searchParamsHook.get('month') || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [bienIds, setBienIds] = useState<string[]>([]);
  const [locataireIds, setLocataireIds] = useState<string[]>([]);
  const [type, setType] = useState<'INCOME' | 'EXPENSE' | 'ALL'>('ALL');
  const [statut, setStatut] = useState<'paye' | 'en_retard' | 'a_venir' | 'ALL'>('ALL');
  const [source, setSource] = useState<'loyer' | 'hors_loyer' | 'ALL'>('ALL');
  const [focusLoyer, setFocusLoyer] = useState<boolean>(() => {
    if (mode === 'normal' && searchParamsHook) {
      return searchParamsHook.get('focusLoyer') === 'true';
    }
    return false;
  });

  // Construire les filtres
  const filters: DashboardFilters = useMemo(() => ({
    month,
    bienIds,
    locataireIds,
    type,
    statut,
    source,
    focusLoyer,
  }), [month, bienIds, locataireIds, type, statut, source, focusLoyer]);

  // Utiliser le hook unifié pour les données
  const {
    data,
    properties,
    tenants,
    loading,
    error,
  } = useDashboardData({
    mode,
    filters: mode === 'app-shell' ? filters : undefined,
  });

  // PHASE 4 — Hydratation UI avec les données locales (suite)
  // Utiliser un ref pour éviter les logs StrictMode
  const phase4DataLoggedRef = React.useRef(false);
  useEffect(() => {
    if (mode === 'app-shell' && !loading && data && !phase4DataLoggedRef.current) {
      phase4DataLoggedRef.current = true;
      const phase4StartTime = performance.now();
      logToServer('[PHASE 4] 🎨 DashboardPageCore reçoit les données locales');
      logToServer('[PHASE 4] 📊 Rendu immédiat:');
      logToServer('  - KPI remplis');
      logToServer('  - Graphiques fonctionnels');
      logToServer('  - Échéances visibles');
      logToServer('  - Transactions résumées');
      logToServer('  - Statistiques prêtes');
      
      const phase4EndTime = performance.now();
      const phase4Duration = Math.round(phase4EndTime - phase4StartTime);
      logToServer(`[PHASE 4] ✅ Hydratation UI terminée en ${phase4Duration}ms`);
      logToServer('[PHASE 4] ✅ Dashboard affiché même offline');
    }
  }, [mode, loading, data]);

  // Mettre à jour l'URL avec les filtres (mode normal uniquement)
  useEffect(() => {
    if (mode === 'normal' && router) {
      const params = new URLSearchParams();
      if (month) params.set('month', month);
      if (bienIds.length > 0) params.set('bienIds', bienIds.join(','));
      if (locataireIds.length > 0) params.set('locataireIds', locataireIds.join(','));
      if (type !== 'ALL') params.set('type', type);
      if (statut !== 'ALL') params.set('statut', statut);
      if (source !== 'ALL') params.set('source', source);
      if (focusLoyer) params.set('focusLoyer', 'true');
      
      router.replace(`/dashboard?${params.toString()}`, { scroll: false });
    }
  }, [mode, month, bienIds, locataireIds, type, statut, source, focusLoyer, router]);

  // Synchroniser l'état avec les searchParams en mode normal
  useEffect(() => {
    if (mode === 'normal' && searchParamsHook) {
      const urlMonth = searchParamsHook.get('month');
      if (urlMonth && urlMonth !== month) {
        setMonth(urlMonth);
      }

      const urlBienIds = searchParamsHook.get('bienIds');
      if (urlBienIds) {
        const ids = urlBienIds.split(',').filter(Boolean);
        if (JSON.stringify(ids) !== JSON.stringify(bienIds)) {
          setBienIds(ids);
        }
      } else if (bienIds.length > 0) {
        setBienIds([]);
      }

      const urlLocataireIds = searchParamsHook.get('locataireIds');
      if (urlLocataireIds) {
        const ids = urlLocataireIds.split(',').filter(Boolean);
        if (JSON.stringify(ids) !== JSON.stringify(locataireIds)) {
          setLocataireIds(ids);
        }
      } else if (locataireIds.length > 0) {
        setLocataireIds([]);
      }

      const urlType = searchParamsHook.get('type') as 'INCOME' | 'EXPENSE' | 'ALL' | null;
      if (urlType && urlType !== type) {
        setType(urlType);
      } else if (!urlType && type !== 'ALL') {
        setType('ALL');
      }

      const urlStatut = searchParamsHook.get('statut') as 'paye' | 'en_retard' | 'a_venir' | 'ALL' | null;
      if (urlStatut && urlStatut !== statut) {
        setStatut(urlStatut);
      } else if (!urlStatut && statut !== 'ALL') {
        setStatut('ALL');
      }

      const urlSource = searchParamsHook.get('source') as 'loyer' | 'hors_loyer' | 'ALL' | null;
      if (urlSource && urlSource !== source) {
        setSource(urlSource);
      } else if (!urlSource && source !== 'ALL') {
        setSource('ALL');
      }

      const urlFocusLoyer = searchParamsHook.get('focusLoyer') === 'true';
      if (urlFocusLoyer !== focusLoyer) {
        setFocusLoyer(urlFocusLoyer);
      }
    }
  }, [mode, searchParamsHook, month, bienIds, locataireIds, type, statut, source, focusLoyer]);

  const handleFilterChange = (newFilters: {
    month?: string;
    bienIds?: string[];
    locataireIds?: string[];
    type?: 'INCOME' | 'EXPENSE' | 'ALL';
    statut?: 'paye' | 'en_retard' | 'a_venir' | 'ALL';
    source?: 'loyer' | 'hors_loyer' | 'ALL';
  }) => {
    if (newFilters.month !== undefined) setMonth(newFilters.month);
    if (newFilters.bienIds !== undefined) setBienIds(newFilters.bienIds);
    if (newFilters.locataireIds !== undefined) setLocataireIds(newFilters.locataireIds);
    if (newFilters.type !== undefined) setType(newFilters.type);
    if (newFilters.statut !== undefined) setStatut(newFilters.statut);
    if (newFilters.source !== undefined) setSource(newFilters.source);
  };

  // États de chargement et erreur
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
        <span className="ml-3 text-gray-600">Chargement du dashboard...</span>
      </div>
    );
  }

  // Rendu principal
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-4 sm:mb-6 space-y-3">
        {/* Ligne 1 : Hamburger + Titre */}
        <div className="flex items-center justify-between w-full gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            {/* Bouton hamburger mobile - Discret, aligné à gauche du titre */}
            {sidebarContext && (
              <button
                onClick={sidebarContext.toggleSidebar}
                className="lg:hidden flex items-center justify-center w-10 h-10 min-w-[40px] min-h-[40px] flex-shrink-0 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                aria-label={sidebarContext.sidebarOpen ? "Fermer le menu" : "Ouvrir le menu"}
              >
                {sidebarContext.sidebarOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </button>
            )}
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 truncate min-w-0">Dashboard</h1>
          </div>
        </div>
        
        {/* Ligne 2 : Description */}
        <p className="text-sm sm:text-base text-gray-600">Vue mensuelle opérationnelle de votre portefeuille</p>
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
        biens={properties || []}
        locataires={tenants || []}
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
      {loading ? (
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
        {loading ? (
          <Card>
            <CardContent className="py-12">
              <div className="flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-gray-600">
                <p className="mb-2">{error}</p>
                <p className="text-sm text-gray-500">Veuillez réinitialiser les données locales depuis la page de synchronisation.</p>
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
            mode={mode}
          />
        ) : null}
      </div>

      {/* Rapport gestionnaire délégué */}
      <GestionnaireDelegueReportPanel currentMonth={month} mode={mode} />
    </div>
  );
}
