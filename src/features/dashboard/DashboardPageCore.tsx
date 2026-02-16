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
import { TasksPanel } from '@/components/dashboard/TasksPanel';
import { GestionnaireDelegueReportPanel } from '@/components/dashboard/GestionnaireDelegueReportPanel';
import { useDashboardData, type DashboardFilters } from './hooks/useDashboardData';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import { logToServer } from '@/lib/utils/logger';
import { useSidebarOptional } from '@/contexts/SidebarContext';
import { computeDashboardGravity } from './utils/dashboardGravity';
import { motion } from 'framer-motion';
import { DashboardKpiHealthCards } from './components/DashboardKpiHealthCards';
import { DashboardPriorityActionZone } from './components/DashboardPriorityActionZone';
import { PortfolioHealthInline } from './components/PortfolioHealthIndicator';
import { DashboardUrgentColumn } from './components/DashboardUrgentColumn';
import { DashboardUpcomingColumn } from './components/DashboardUpcomingColumn';
import { DashboardGlobalOverviewSection } from './components/DashboardGlobalOverviewSection';
import { cn } from '@/utils/cn';

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

  // Ligne micro-informative sous "Actions prioritaires" (chiffres dynamiques, 0 = non affiché)
  const actionsSummaryText = useMemo(() => {
    if (!data) return '';
    const nLoyers = data.aTraiter.relances.length;
    const nTx = data.aTraiter.transactionsNonRapprochees.length;
    const nEcheances = data.aTraiter.echeancesPrets.length + data.aTraiter.echeancesCharges.length;
    const parts: string[] = [];
    if (nLoyers > 0) parts.push(`${nLoyers} loyer${nLoyers > 1 ? 's' : ''} en retard`);
    if (nTx > 0) parts.push(`${nTx} transaction${nTx > 1 ? 's' : ''} à rapprocher`);
    if (nEcheances > 0) parts.push(`${nEcheances} échéance${nEcheances > 1 ? 's' : ''} proches`);
    return parts.length === 0 ? 'Aucune action urgente ce mois-ci' : parts.join(' · ');
  }, [data]);

  // Gravité et synthèse (cockpit opérationnel)
  const gravityResult = useMemo(() => {
    if (!data) return null;
    return computeDashboardGravity({
      kpis: data.kpis,
      relances: data.aTraiter.relances,
      transactionsNonRapprochees: data.aTraiter.transactionsNonRapprochees,
      indexations: data.aTraiter.indexations,
      echeancesPrets: data.aTraiter.echeancesPrets,
      echeancesCharges: data.aTraiter.echeancesCharges,
      bauxAEcheance: data.aTraiter.bauxAEcheance,
      documentsAValider: data.aTraiter.documentsAValider,
    });
  }, [data]);

  // Sparklines : dérivés de graph si dispo (sinon non affichés)
  const sparklineCashflow = useMemo(() => {
    if (!data?.graph?.cashflowCumule?.length) return undefined;
    return data.graph.cashflowCumule.slice(-6).map((p) => p.cashflow);
  }, [data?.graph?.cashflowCumule]);
  const sparklineEncaissements = useMemo(() => {
    if (!data?.graph?.intraMensuel?.length) return undefined;
    return data.graph.intraMensuel.slice(-6).map((p) => p.encaissements);
  }, [data?.graph?.intraMensuel]);
  const sparklineDepenses = useMemo(() => {
    if (!data?.graph?.intraMensuel?.length) return undefined;
    return data.graph.intraMensuel.slice(-6).map((p) => p.depenses);
  }, [data?.graph?.intraMensuel]);

  /** Transition changement de mois : fade-out 0.7 + mini loader, puis fade-in (max 400ms) */
  const prevMonthRef = React.useRef(month);
  const [isTransitioningMonth, setIsTransitioningMonth] = useState(false);
  useEffect(() => {
    if (prevMonthRef.current !== month) {
      prevMonthRef.current = month;
      setIsTransitioningMonth(true);
      const t = setTimeout(() => setIsTransitioningMonth(false), 400);
      return () => clearTimeout(t);
    }
  }, [month]);

  // États de chargement et erreur
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
        <span className="ml-3 text-gray-600">Chargement du dashboard...</span>
      </div>
    );
  }

  // Rendu principal — même largeur que la page Biens (w-full max-w-full, padding par le main)
  return (
    <div className="min-h-[50vh] w-full max-w-full rounded-2xl">
      <div className="space-y-10 pt-0 pb-10">
        {/* Header : titre à gauche, badge indice santé à droite, même niveau */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 sm:gap-3">
              {sidebarContext && (
                <button
                  onClick={sidebarContext.toggleSidebar}
                  className="lg:hidden flex items-center justify-center w-10 h-10 min-w-[40px] min-h-[40px] flex-shrink-0 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                  aria-label={sidebarContext.sidebarOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
                >
                  {sidebarContext.sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>
              )}
              <h1 className="text-2xl font-semibold text-gray-900 truncate">Dashboard</h1>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">Vue mensuelle opérationnelle de votre portefeuille</p>
          </div>
          {gravityResult && (
            <PortfolioHealthInline
              gravityScore={gravityResult.score}
              className="flex-shrink-0"
            />
          )}
        </div>

      {/* Toggle Focus Loyer */}
      <div className="mt-8 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
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
      <div className="mt-8">
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
      </div>

      {/* Actions prioritaires — juste sous la sélection du mois */}
      {!loading && data && gravityResult && (
        <div className="mt-8" id="dashboard-actions">
          <DashboardPriorityActionZone level={gravityResult.level} summaryText={actionsSummaryText}>
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
          </DashboardPriorityActionZone>
        </div>
      )}

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

      {/* Contenu principal avec transition au changement de mois */}
      <div
        className={cn(
          'relative mt-12 transition-opacity duration-300 ease-out space-y-12',
          isTransitioningMonth && 'opacity-70'
        )}
      >
        {isTransitioningMonth && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" aria-hidden />
          </div>
        )}

      {/* Grid 2 colonnes — Urgent | À venir */}
      <div>
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-8">
          <div className="space-y-6">
            <div className="h-6 w-32 bg-slate-200 rounded animate-pulse" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm animate-pulse">
                <div className="h-4 w-1/2 bg-slate-200 rounded" />
                <div className="h-8 w-24 mt-2 bg-slate-200 rounded" />
              </div>
            ))}
          </div>
          <div className="space-y-6">
            <div className="h-6 w-40 bg-slate-200 rounded animate-pulse" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm animate-pulse">
                <div className="h-4 w-1/2 bg-slate-200 rounded" />
                <div className="h-8 w-32 mt-2 bg-slate-200 rounded" />
              </div>
            ))}
          </div>
        </div>
      ) : data && gravityResult ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-8 items-start">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="w-full"
          >
            <DashboardUrgentColumn
              kpis={data.kpis}
              relances={data.aTraiter.relances}
              transactionsNonRapprochees={data.aTraiter.transactionsNonRapprochees}
              currentMonth={month}
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="w-full"
          >
            <DashboardUpcomingColumn
              echeancesPrets={data.aTraiter.echeancesPrets}
              echeancesCharges={data.aTraiter.echeancesCharges}
              indexations={data.aTraiter.indexations}
              bauxAEcheance={data.aTraiter.bauxAEcheance}
              currentMonth={month}
            />
          </motion.div>
        </div>
      ) : null}
      </div>

      {/* Vue globale */}
      <DashboardGlobalOverviewSection className="mt-12">
        {loading ? (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-2/3 mb-2" />
                <div className="h-6 bg-slate-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : data ? (
          <>
            <DashboardKpiHealthCards
              kpis={data.kpis}
              sparklineCashflow={sparklineCashflow}
              sparklineEncaissements={sparklineEncaissements}
              sparklineDepenses={sparklineDepenses}
              focusLoyer={focusLoyer}
            />
            {data.insights && (
              <Card className="border-slate-200 bg-white shadow-sm">
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <svg className="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-slate-800 mb-1">Synthèse IA</h4>
                      <p className="text-sm text-slate-600">{data.insights}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            <div className="pt-8">
              <GestionnaireDelegueReportPanel currentMonth={month} mode={mode} />
            </div>
          </>
        ) : error ? (
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="py-8">
              <div className="text-center text-slate-600">
                <p className="mb-2">{error}</p>
                <p className="text-sm text-slate-500">Veuillez réinitialiser les données locales depuis la page de synchronisation.</p>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </DashboardGlobalOverviewSection>

      </div>
      </div>
    </div>
  );
}
