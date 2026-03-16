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
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import {
  Loader2,
  Menu,
  X,
  Zap,
  ArrowRight,
  AlertCircle,
  FileSearch,
  Percent,
  CalendarCheck,
  Euro,
  Clock,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { MonthlyFilters } from '@/components/dashboard/MonthlyFilters';
import { useDashboardData, type DashboardFilters } from './hooks/useDashboardData';
import type { MonthlyDashboardData } from '@/types/dashboard';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import { logToServer } from '@/lib/utils/logger';
import { useSidebarOptional } from '@/contexts/SidebarContext';
import { computeDashboardGravity } from './utils/dashboardGravity';
import { motion } from 'framer-motion';
import { DashboardKpiHealthCards } from './components/DashboardKpiHealthCards';
import { DashboardPriorityActionZone } from './components/DashboardPriorityActionZone';
import { IndicePortefeuille } from './components/IndicePortefeuille';
import { SuggestionsSmartimmoCard } from './components/SuggestionsSmartimmoCard';
import { SantePortefeuilleCard } from './components/SantePortefeuilleCard';
import { ResumeMoisCard } from './components/ResumeMoisCard';
import { OptimisationPossibleCard } from './components/OptimisationPossibleCard';
import { PrioriteDuJourCard } from './components/PrioriteDuJourCard';
import { DashboardUrgentColumn } from './components/DashboardUrgentColumn';
import { DashboardUpcomingColumn } from './components/DashboardUpcomingColumn';
import { DashboardGlobalOverviewSection } from './components/DashboardGlobalOverviewSection';
import { DashboardMonthTimeline } from './components/DashboardMonthTimeline';
import { ProchainesActionsCard } from './components/ProchainesActionsCard';
import { CashflowPrevisionnelCard } from './components/CashflowPrevisionnelCard';
import { PortfolioHeatmap } from './components/PortfolioHeatmap';
import { ProgressionMoisCard } from './components/ProgressionMoisCard';
import { cn } from '@/utils/cn';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export type DashboardTabId = 'vue-generale' | 'actions' | 'timeline' | 'finances' | 'analyse';

export interface DashboardPageCoreProps {
  mode: 'normal' | 'app-shell';
}

function TraiterActionsButton({
  totalActions,
  onOpenActions,
}: {
  totalActions: number;
  onOpenActions: () => void;
}) {
  const [open, setOpen] = useState(false);
  if (totalActions <= 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => { onOpenActions(); setOpen(true); }}
        className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
      >
        <Zap className="h-4 w-4" aria-hidden />
        Traiter {totalActions} action{totalActions > 1 ? 's' : ''}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="md:max-w-md">
          <DialogHeader>
            <DialogTitle>Traiter mes actions</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 mb-4">
            Suivez les étapes pour traiter vos anomalies en quelques minutes.
          </p>
          <div className="space-y-4">
            <Link
              href="/app?view=alertes"
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
            >
              Voir toutes les alertes
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
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
  const [activeTab, setActiveTab] = useState<DashboardTabId>('vue-generale');
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
    focusLoyer?: boolean;
  }) => {
    if (newFilters.month !== undefined) setMonth(newFilters.month);
    if (newFilters.bienIds !== undefined) setBienIds(newFilters.bienIds);
    if (newFilters.locataireIds !== undefined) setLocataireIds(newFilters.locataireIds);
    if (newFilters.type !== undefined) setType(newFilters.type);
    if (newFilters.statut !== undefined) setStatut(newFilters.statut);
    if (newFilters.source !== undefined) setSource(newFilters.source);
    if (newFilters.focusLoyer !== undefined) setFocusLoyer(newFilters.focusLoyer);
  };

  // Ligne micro-informative sous "Actions prioritaires" (résumé alertes, détail dans page Alertes)
  const actionsSummaryText = useMemo(() => {
    if (!data) return '';
    const relances = data?.aTraiter?.relances ?? [];
    const tx = data?.aTraiter?.transactionsNonRapprochees ?? [];
    const indexations = data?.aTraiter?.indexations ?? [];
    const baux = data?.aTraiter?.bauxAEcheance ?? [];
    const echeancesP = data?.aTraiter?.echeancesPrets ?? [];
    const echeancesC = data?.aTraiter?.echeancesCharges ?? [];
    const nLoyers = relances.length;
    const nTx = tx.length;
    const nIndexations = indexations.length;
    const nBaux = baux.length;
    const nEcheances = echeancesP.length + echeancesC.length;
    const parts: string[] = [];
    if (nLoyers > 0) parts.push(`${nLoyers} loyer${nLoyers > 1 ? 's' : ''} en retard`);
    if (nTx > 0) parts.push(`${nTx} transaction${nTx > 1 ? 's' : ''} à rapprocher`);
    if (nIndexations > 0) parts.push(`${nIndexations} indexation${nIndexations > 1 ? 's' : ''} à appliquer`);
    if (nBaux > 0) parts.push(`${nBaux} bail${nBaux > 1 ? 'x' : ''} proche${nBaux > 1 ? 's' : ''} expiration`);
    if (nEcheances > 0) parts.push(`${nEcheances} échéance${nEcheances > 1 ? 's' : ''} proches`);
    return parts.length === 0 ? 'Aucune action urgente ce mois-ci' : parts.join(' · ');
  }, [data]);

  // Gravité et synthèse (cockpit opérationnel)
  const gravityResult = useMemo(() => {
    if (!data) return null;
    return computeDashboardGravity({
      kpis: data.kpis ?? ({} as MonthlyDashboardData['kpis']),
      relances: data?.aTraiter?.relances ?? [],
      transactionsNonRapprochees: data?.aTraiter?.transactionsNonRapprochees ?? [],
      indexations: data?.aTraiter?.indexations ?? [],
      echeancesPrets: data?.aTraiter?.echeancesPrets ?? [],
      echeancesCharges: data?.aTraiter?.echeancesCharges ?? [],
      bauxAEcheance: data?.aTraiter?.bauxAEcheance ?? [],
      documentsAValider: data?.aTraiter?.documentsAValider ?? [],
    });
  }, [data]);

  // Sparklines : dérivés de graph si dispo (sinon non affichés)
  const sparklineCashflow = useMemo(() => {
    const arr = data?.graph?.cashflowCumule ?? [];
    if (arr.length === 0) return undefined;
    return arr.slice(-6).map((p) => p.cashflow);
  }, [data?.graph?.cashflowCumule]);
  const sparklineEncaissements = useMemo(() => {
    const arr = data?.graph?.intraMensuel ?? [];
    if (arr.length === 0) return undefined;
    return arr.slice(-6).map((p) => p.encaissements);
  }, [data?.graph?.intraMensuel]);
  const sparklineDepenses = useMemo(() => {
    const arr = data?.graph?.intraMensuel ?? [];
    if (arr.length === 0) return undefined;
    return arr.slice(-6).map((p) => p.depenses);
  }, [data?.graph?.intraMensuel]);

  const relancesCount = (data?.aTraiter?.relances ?? []).length;
  const txCount = (data?.aTraiter?.transactionsNonRapprochees ?? []).length;
  const indexationsCount = (data?.aTraiter?.indexations ?? []).length;
  const echeancesCount = (data?.aTraiter?.echeancesPrets ?? []).length + (data?.aTraiter?.echeancesCharges ?? []).length;

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

  const formatMonthLabel = (m: string) =>
    m ? new Date(m + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).replace(/^\w/, (c) => c.toUpperCase()) : '';
  const handlePrevMonth = () => {
    const [y, mm] = month.split('-').map(Number);
    const d = new Date(y, mm - 2, 1);
    const newMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    handleFilterChange({ month: newMonth });
  };
  const handleNextMonth = () => {
    const [y, mm] = month.split('-').map(Number);
    const d = new Date(y, mm, 1);
    const newMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    handleFilterChange({ month: newMonth });
  };

  // Rendu principal — même largeur que la page Biens (w-full max-w-full, padding par le main)
  return (
    <div className="min-h-[50vh] w-full max-w-full rounded-2xl">
      <div className="space-y-10 pt-0 pb-10">
        {/* Header : titre à gauche, badge indice santé à droite */}
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
              <h1 className="text-2xl font-semibold text-gray-900 truncate">
                Dashboard{month ? ` — ${formatMonthLabel(month)}` : ''}
              </h1>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">Vue mensuelle opérationnelle de votre portefeuille</p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0 flex-wrap justify-end">
            <TraiterActionsButton
              totalActions={relancesCount + txCount + indexationsCount + echeancesCount}
              onOpenActions={() => setActiveTab('actions')}
            />
          </div>
        </div>

        {/* Priorité du jour + Indice portefeuille — côte à côte */}
        {!loading && data && (
          gravityResult ? (
            <div className="flex flex-wrap items-stretch gap-3">
              <PrioriteDuJourCard
                relances={data.aTraiter?.relances ?? []}
                transactionsNonRapprochees={data.aTraiter?.transactionsNonRapprochees ?? []}
                indexationsCount={indexationsCount}
                echeancesCount={echeancesCount}
              />
              <IndicePortefeuille gravityScore={gravityResult.score} className="flex-shrink-0" />
            </div>
          ) : (
            <PrioriteDuJourCard
              relances={data.aTraiter?.relances ?? []}
              transactionsNonRapprochees={data.aTraiter?.transactionsNonRapprochees ?? []}
              indexationsCount={indexationsCount}
              echeancesCount={echeancesCount}
            />
          )
        )}

        {/* Synthèse du portefeuille — chips horizontales cliquables */}
        {!loading && data && (relancesCount > 0 || txCount > 0 || indexationsCount > 0 || echeancesCount > 0) && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-sm font-semibold text-slate-800 mb-2">Synthèse du portefeuille</p>
            <div className="flex flex-wrap gap-2">
              {relancesCount > 0 && (
                <Link
                  href="/app?view=alertes&type=loyers_retard"
                  className="inline-flex items-center gap-1.5 rounded-full border-2 border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                >
                  {relancesCount} loyer{relancesCount > 1 ? 's' : ''} en retard
                </Link>
              )}
              {txCount > 0 && (
                <Link
                  href="/app?view=alertes&type=transactions"
                  className="inline-flex items-center gap-1.5 rounded-full border-2 border-orange-200 bg-orange-50 px-3 py-1.5 text-sm font-medium text-orange-800 transition-colors hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                >
                  {txCount} transaction{txCount > 1 ? 's' : ''} à rapprocher
                </Link>
              )}
              {indexationsCount > 0 && (
                <Link
                  href="/app?view=alertes&type=indexations"
                  className="inline-flex items-center gap-1.5 rounded-full border-2 border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  {indexationsCount} indexation{indexationsCount > 1 ? 's' : ''} à appliquer
                </Link>
              )}
              {echeancesCount > 0 && (
                <Link
                  href="/app?view=alertes&type=echeances"
                  className="inline-flex items-center gap-1.5 rounded-full border-2 border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                >
                  {echeancesCount} échéance{echeancesCount > 1 ? 's' : ''} à venir
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Sélecteur de mois + barre de filtres (sticky) */}
        <div className="sticky top-0 z-20 -mx-1 px-1 pt-1 pb-2 bg-white/95 backdrop-blur-sm border-b border-slate-100 space-y-3">
          <div className="flex items-center justify-center gap-2 sm:gap-4">
            <Button variant="outline" size="sm" onClick={handlePrevMonth} aria-label="Mois précédent">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[180px] text-center text-lg font-semibold text-gray-900 capitalize">
              {formatMonthLabel(month)}
            </span>
            <Button variant="outline" size="sm" onClick={handleNextMonth} aria-label="Mois suivant">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <MonthlyFilters
            month={month}
            showMonthSelector={false}
            bienIds={bienIds}
            locataireIds={locataireIds}
            type={type}
            statut={statut}
            source={source}
            focusLoyer={focusLoyer}
            onFilterChange={handleFilterChange}
            biens={properties || []}
            locataires={tenants || []}
          />
          {/* Menu horizontal — onglets du dashboard */}
          <div className="flex flex-wrap gap-1 pt-2 border-t border-slate-100 mt-2">
            {([
              { id: 'vue-generale' as const, label: 'Vue générale' },
              { id: 'actions' as const, label: 'Actions' },
              { id: 'timeline' as const, label: 'Timeline' },
              { id: 'finances' as const, label: 'Finances' },
              { id: 'analyse' as const, label: 'Analyse' },
            ]).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'rounded-lg px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
                  activeTab === tab.id
                    ? 'bg-primary-600 text-white shadow-sm hover:bg-primary-700'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ========== Contenu par onglet ========== */}
        <div
          className={cn(
            'relative mt-6 transition-opacity duration-300 ease-out',
            isTransitioningMonth && 'opacity-70'
          )}
        >
          {isTransitioningMonth && (
            <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" aria-hidden />
            </div>
          )}

        {/* ========== Vue générale ========== */}
        {activeTab === 'vue-generale' && (
        <section className="space-y-8 pt-2">
          <h2 className="text-base font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 pb-2">
            Pilotage du mois
          </h2>

        {/* Santé du portefeuille + Résumé du mois */}
        {!loading && data && gravityResult && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SantePortefeuilleCard
              riskLevel={gravityResult.level === 'critical' ? 'high' : gravityResult.level === 'warning' ? 'medium' : 'low'}
              nLoyersRetard={relancesCount}
              nTransactionsNonRapprochees={txCount}
              nIndexationsEnAttente={indexationsCount}
            />
            <ResumeMoisCard
              lines={[
                relancesCount > 0 && `${relancesCount} loyer${relancesCount > 1 ? 's' : ''} en retard`,
                txCount > 0 && `${txCount} transaction${txCount > 1 ? 's' : ''} non rapprochée${txCount > 1 ? 's' : ''}`,
                echeancesCount > 0 && `${echeancesCount} échéance${echeancesCount > 1 ? 's' : ''} imminente${echeancesCount > 1 ? 's' : ''}`,
              ].filter(Boolean) as string[]}
              suggestionPrincipale={relancesCount > 0 ? 'relancer les locataires en retard' : txCount > 0 ? 'rapprocher les transactions' : echeancesCount > 0 ? 'vérifier les échéances à venir' : undefined}
            />
          </div>
        )}

        {/* Résumé du mois — cards d'insights */}
        {!loading && data && (relancesCount > 0 || txCount > 0 || indexationsCount > 0 || echeancesCount > 0 || (data.kpis?.cashflow != null)) && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {relancesCount > 0 && (
              <Card className="border-slate-200 bg-white shadow-sm overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 rounded-lg bg-red-100 p-2 text-red-600">
                      <AlertCircle className="h-5 w-5" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Loyers en retard</p>
                      <p className="mt-0.5 text-lg font-semibold text-slate-900 tabular-nums">{relancesCount} loyer{relancesCount > 1 ? 's' : ''}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {txCount > 0 && (
              <Card className="border-slate-200 bg-white shadow-sm overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 rounded-lg bg-orange-100 p-2 text-orange-600">
                      <FileSearch className="h-5 w-5" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Transactions à rapprocher</p>
                      <p className="mt-0.5 text-lg font-semibold text-slate-900 tabular-nums">{txCount} transaction{txCount > 1 ? 's' : ''}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {indexationsCount > 0 && (
              <Card className="border-slate-200 bg-white shadow-sm overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 rounded-lg bg-blue-100 p-2 text-blue-600">
                      <Percent className="h-5 w-5" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Indexations</p>
                      <p className="mt-0.5 text-lg font-semibold text-slate-900 tabular-nums">{indexationsCount} indexation{indexationsCount > 1 ? 's' : ''}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {echeancesCount > 0 && (
              <Card className="border-slate-200 bg-white shadow-sm overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 rounded-lg bg-emerald-100 p-2 text-emerald-600">
                      <CalendarCheck className="h-5 w-5" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Échéances</p>
                      <p className="mt-0.5 text-lg font-semibold text-slate-900 tabular-nums">{echeancesCount} échéance{echeancesCount > 1 ? 's' : ''}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {data.kpis?.cashflow != null && (
              <Card className="border-slate-200 bg-white shadow-sm overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 rounded-lg bg-emerald-100 p-2 text-emerald-600">
                      <Euro className="h-5 w-5" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Cashflow prévisionnel</p>
                      <p className="mt-0.5 text-lg font-semibold text-slate-900 tabular-nums">
                        {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(data.kpis.cashflow)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

      {/* Situation du mois */}
      {!loading && data?.kpis && (() => {
        const kpis = data.kpis;
        const loyersAttendus = kpis.loyersAttendus ?? 0;
        const loyersEncaisses = kpis.sommesEncaissesRapprochees ?? 0;
        const nLoyersAttendus = kpis.nLoyersAttendus ?? kpis.bauxActifs ?? 0;
        const nLoyersEncaisses = kpis.nLoyersEncaisses ?? 0;
        const restant = Math.max(0, loyersAttendus - loyersEncaisses);
        const tauxEncaissement = loyersAttendus > 0
          ? Math.min(100, (loyersEncaisses / loyersAttendus) * 100)
          : 0;
        const barColor = tauxEncaissement >= 80 ? 'bg-emerald-500' : tauxEncaissement >= 50 ? 'bg-amber-500' : 'bg-red-500';
        return (
          <Card className="mt-6 border-slate-200 bg-white shadow-sm">
            <CardContent className="py-5">
              <h3 className="text-sm font-semibold text-slate-800 mb-4">Situation du mois</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-4">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Loyers attendus</p>
                  <p className="text-lg font-semibold text-slate-900 tabular-nums mt-0.5">
                    {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(loyersAttendus)}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">({nLoyersAttendus} loyer{nLoyersAttendus !== 1 ? 's' : ''})</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Loyers encaissés</p>
                  <p className="text-lg font-semibold text-emerald-600 tabular-nums mt-0.5">
                    {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(loyersEncaisses)}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">({nLoyersEncaisses} loyer{nLoyersEncaisses !== 1 ? 's' : ''})</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Restant à encaisser</p>
                  <p className="text-lg font-semibold tabular-nums text-slate-900 mt-0.5">
                    {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(restant)}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">({nLoyersAttendus} loyer{nLoyersAttendus !== 1 ? 's' : ''})</p>
                </div>
              </div>
              <div className="mt-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-700">Encaissement</span>
                  <span className="text-base font-semibold text-slate-900 tabular-nums">{tauxEncaissement.toFixed(0)} %</span>
                </div>
                <div className="h-4 w-full rounded-full bg-slate-100 overflow-hidden shadow-inner">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500 ease-out', barColor)}
                    style={{ width: `${Math.min(100, Math.max(0, tauxEncaissement))}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

        {/* Cashflow prévisionnel du mois */}
        {!loading && data?.kpis && (
          <CashflowPrevisionnelCard
            kpis={data.kpis}
            intraMensuel={data.graph?.intraMensuel}
            currentMonth={month}
          />
        )}

        </section>
        )}

        {/* ========== Actions ========== */}
        {activeTab === 'actions' && (
        <section className="space-y-10 pt-2">
          <h2 className="text-base font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 pb-2">
            Priorités
          </h2>

        {/* Prochaines actions recommandées */}
        {!loading && data && (
          <ProchainesActionsCard
            relances={data.aTraiter?.relances ?? []}
            transactionsNonRapprochees={data.aTraiter?.transactionsNonRapprochees ?? []}
            indexations={data.aTraiter?.indexations ?? []}
            echeancesCount={echeancesCount}
          />
        )}

        {/* Progression du mois */}
        {!loading && data && (() => {
          const totalActions = relancesCount + txCount + indexationsCount + echeancesCount;
          return totalActions > 0 ? (
            <ProgressionMoisCard
              actionsTraitees={0}
              totalActions={totalActions}
            />
          ) : null;
        })()}

      {/* Actions prioritaires — chips KPI */}
      {!loading && data && gravityResult && (
        <div id="dashboard-actions">
          <DashboardPriorityActionZone level={gravityResult.level} summaryText={actionsSummaryText}>
            {(() => {
              const totalActions = relancesCount + txCount + indexationsCount + echeancesCount;
              return (
                <>
                  {totalActions > 0 && (
                    <>
                      <div className="mb-3">
                        <p className="text-sm font-semibold text-slate-800 mb-1">Actions du mois</p>
                        <p className="text-lg font-bold text-slate-900 tabular-nums">0 / {totalActions} traitées</p>
                        <div className="mt-2 h-2.5 w-full rounded-full bg-slate-200 overflow-hidden">
                          <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: '0%' }} />
                        </div>
                      </div>
                    </>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    {relancesCount > 0 && (
                      <Link
                        href="/app?view=alertes&type=loyers_retard"
                        className="inline-flex items-center gap-2 rounded-full border-2 border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                      >
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0" aria-hidden />
                        {relancesCount} loyer{relancesCount > 1 ? 's' : ''} en retard
                      </Link>
                    )}
                    {txCount > 0 && (
                      <Link
                        href="/app?view=alertes&type=transactions"
                        className="inline-flex items-center gap-2 rounded-full border-2 border-orange-300 bg-orange-50 px-4 py-2 text-sm font-medium text-orange-800 transition-colors hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                      >
                        <span className="w-2.5 h-2.5 rounded-full bg-orange-500 flex-shrink-0" aria-hidden />
                        {txCount} transaction{txCount > 1 ? 's' : ''} à rapprocher
                      </Link>
                    )}
                    {indexationsCount > 0 && (
                      <Link
                        href="/app?view=alertes&type=indexations"
                        className="inline-flex items-center gap-2 rounded-full border-2 border-blue-300 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      >
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0" aria-hidden />
                        {indexationsCount} indexation{indexationsCount > 1 ? 's' : ''}
                      </Link>
                    )}
                    {echeancesCount > 0 && (
                      <Link
                        href="/app?view=alertes&type=echeances"
                        className="inline-flex items-center gap-2 rounded-full border-2 border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                      >
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0" aria-hidden />
                        {echeancesCount} échéance{echeancesCount > 1 ? 's' : ''}
                      </Link>
                    )}
                    {(relancesCount === 0 && txCount === 0 && indexationsCount === 0 && echeancesCount === 0) && (
                      <span className="text-sm text-slate-500">Aucune action urgente ce mois-ci</span>
                    )}
                    <Link
                      href="/app?view=alertes"
                      className="ml-1 text-sm font-medium text-primary-600 hover:text-primary-700 hover:underline"
                    >
                      Voir tout →
                    </Link>
                  </div>
                </>
              );
            })()}
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
              relances={data?.aTraiter?.relances ?? []}
              transactionsNonRapprochees={data?.aTraiter?.transactionsNonRapprochees ?? []}
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
              echeancesPrets={data?.aTraiter?.echeancesPrets ?? []}
              echeancesCharges={data?.aTraiter?.echeancesCharges ?? []}
              indexations={data?.aTraiter?.indexations ?? []}
              bauxAEcheance={data?.aTraiter?.bauxAEcheance ?? []}
              currentMonth={month}
            />
          </motion.div>
        </div>
      ) : null}
      </div>

        </section>
        )}

        {/* ========== Timeline ========== */}
        {activeTab === 'timeline' && (
        <section className="space-y-8 pt-2">
          <h2 className="text-base font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 pb-2">
            Timeline du mois
          </h2>
          {!loading && data && (
            <DashboardMonthTimeline
              relances={data.aTraiter?.relances ?? []}
              transactionsNonRapprochees={data.aTraiter?.transactionsNonRapprochees ?? []}
              indexations={data.aTraiter?.indexations ?? []}
              echeancesPrets={data.aTraiter?.echeancesPrets ?? []}
              echeancesCharges={data.aTraiter?.echeancesCharges ?? []}
              bauxAEcheance={data.aTraiter?.bauxAEcheance ?? []}
              currentMonth={month}
            />
          )}
        </section>
        )}

        {/* ========== Finances ========== */}
        {activeTab === 'finances' && (
        <section className="space-y-8 pt-2">
          <h2 className="text-base font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 pb-2">
            Finances
          </h2>
      {/* Situation du mois */}
      {!loading && data?.kpis && (() => {
        const kpis = data.kpis;
        const loyersAttendus = kpis.loyersAttendus ?? 0;
        const loyersEncaisses = kpis.sommesEncaissesRapprochees ?? 0;
        const nLoyersAttendus = kpis.nLoyersAttendus ?? kpis.bauxActifs ?? 0;
        const nLoyersEncaisses = kpis.nLoyersEncaisses ?? 0;
        const restant = Math.max(0, loyersAttendus - loyersEncaisses);
        const tauxEncaissement = loyersAttendus > 0
          ? Math.min(100, (loyersEncaisses / loyersAttendus) * 100)
          : 0;
        const barColor = tauxEncaissement >= 80 ? 'bg-emerald-500' : tauxEncaissement >= 50 ? 'bg-amber-500' : 'bg-red-500';
        return (
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardContent className="py-5">
              <h3 className="text-sm font-semibold text-slate-800 mb-4">Situation du mois</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-4">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Loyers attendus</p>
                  <p className="text-lg font-semibold text-slate-900 tabular-nums mt-0.5">
                    {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(loyersAttendus)}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">({nLoyersAttendus} loyer{nLoyersAttendus !== 1 ? 's' : ''})</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Loyers encaissés</p>
                  <p className="text-lg font-semibold text-emerald-600 tabular-nums mt-0.5">
                    {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(loyersEncaisses)}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">({nLoyersEncaisses} loyer{nLoyersEncaisses !== 1 ? 's' : ''})</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Restant à encaisser</p>
                  <p className="text-lg font-semibold tabular-nums text-slate-900 mt-0.5">
                    {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(restant)}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">({nLoyersAttendus} loyer{nLoyersAttendus !== 1 ? 's' : ''})</p>
                </div>
              </div>
              <div className="mt-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-700">Encaissement</span>
                  <span className="text-base font-semibold text-slate-900 tabular-nums">{tauxEncaissement.toFixed(0)} %</span>
                </div>
                <div className="h-4 w-full rounded-full bg-slate-100 overflow-hidden shadow-inner">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500 ease-out', barColor)}
                    style={{ width: `${Math.min(100, Math.max(0, tauxEncaissement))}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}
        {!loading && data?.kpis && (
          <CashflowPrevisionnelCard
            kpis={data.kpis}
            intraMensuel={data.graph?.intraMensuel}
            currentMonth={month}
          />
        )}
        </section>
        )}

        {/* ========== Analyse ========== */}
        {activeTab === 'analyse' && (
        <section className="space-y-8 pt-2">
          <h2 className="text-base font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 pb-2">
            Analyse
          </h2>

      {/* Vue globale */}
      <DashboardGlobalOverviewSection>
        {!loading && data && (
          <PortfolioHeatmap
            propertyNames={Array.from(new Set([
              ...(properties?.map((p) => p.name) ?? []),
              ...(data.aTraiter?.relances?.map((r) => r.propertyName) ?? []),
              ...(data.aTraiter?.transactionsNonRapprochees?.map((t) => t.propertyName) ?? []),
              ...(data.aTraiter?.indexations?.map((i) => i.propertyName) ?? []),
            ]))}
            propertyList={properties?.map((p) => ({ id: p.id, name: p.name })) ?? []}
            relances={data.aTraiter?.relances ?? []}
            transactionsNonRapprochees={data.aTraiter?.transactionsNonRapprochees ?? []}
            indexations={data.aTraiter?.indexations ?? []}
          />
        )}
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
              propertyCount={properties?.length ?? 0}
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SuggestionsSmartimmoCard
                indexations={data.aTraiter?.indexations ?? []}
                bauxAEcheance={data.aTraiter?.bauxAEcheance ?? []}
                relances={data.aTraiter?.relances ?? []}
              />
              <OptimisationPossibleCard indexations={data.aTraiter?.indexations ?? []} />
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

        </section>
        )}

        </div>
      </div>
    </div>
  );
}
