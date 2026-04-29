/**
 * Core Component pour la page Patrimoine
 * 
 * Une seule source de vérité graphique utilisable en mode "normal" et "app-shell"
 * Toute la logique UI est centralisée ici.
 * 
 * Réplique EXACTEMENT le comportement de dashboard/patrimoine/page.tsx
 */

'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/shared/select';
import { PatrimoineKPIs } from '@/components/dashboard/PatrimoineKPIs';
import { PatrimoineCharts } from '@/components/dashboard/PatrimoineCharts';
import { PatrimoineInsights } from '@/components/dashboard/PatrimoineInsights';
import { PatrimoineSynthèse } from '@/components/dashboard/PatrimoineSynthèse';
import { usePatrimoineData } from './hooks/usePatrimoineData';
import { usePatrimoineSnapshot } from './hooks/usePatrimoineSnapshot';
import { usePatrimoineSettingsState } from './hooks/usePatrimoineSettingsState';
import {
  PatrimoineDecisionCockpit,
  PatrimoineV4Hero,
  PatrimoineV4OverviewMain,
} from './components/PatrimoineDecisionCockpit';
import { PatrimoineAssumptionsPanel } from './components/PatrimoineAssumptionsPanel';
import { PatrimoineGlobalBadges } from './components/PatrimoineGlobalBadges';
import { usePropertiesData } from '@/features/properties/hooks/usePropertiesData';
import { PatrimoineMode, PatrimoineFilters } from '@/types/dashboard';
import { Download, Calendar, Filter, FileSpreadsheet, FileText, ChevronDown, Menu, X } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import { useSidebarOptional } from '@/contexts/SidebarContext';
import { DashboardPerformanceParBien } from '@/features/dashboard/components/DashboardPerformanceParBien';

export interface PatrimoinePageCoreProps {
  mode: 'normal' | 'app-shell';
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- composant React (PascalCase)
export function PatrimoinePageCore({
  mode,
}: PatrimoinePageCoreProps) {
  const { organizationId } = useCurrentOrganization();
  const router = useRouter();
  const searchParamsHook = useSearchParams();
  const sidebarContext = useSidebarOptional();
  
  // Initialiser les états depuis les query params
  const [modeState, setModeState] = useState<PatrimoineMode>(() => {
    if (mode === 'normal') {
      return (searchParamsHook.get('mode') as PatrimoineMode) || 'realise';
    }
    return 'realise';
  });
  const [propertyId, setPropertyId] = useState<string | undefined>(() => {
    if (mode === 'normal') {
      return searchParamsHook.get('propertyId') || undefined;
    }
    return undefined;
  });
  const [type, setType] = useState<'loyer' | 'charges' | undefined>(() => {
    if (mode === 'normal') {
      return (searchParamsHook.get('type') as 'loyer' | 'charges') || undefined;
    }
    return undefined;
  });
  const [leaseStatus, setLeaseStatus] = useState<'ACTIF' | 'RESILIE' | undefined>(() => {
    if (mode === 'normal') {
      return (searchParamsHook.get('leaseStatus') as 'ACTIF' | 'RESILIE') || undefined;
    }
    return undefined;
  });
  
  // Période par défaut : 12 derniers mois pour réalisé, année en cours pour prévisionnel
  const defaultFrom = useMemo(() => {
    const date = new Date();
    if (modeState === 'prevision') {
      return `${date.getFullYear()}-01`;
    }
    date.setMonth(date.getMonth() - 11);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }, [modeState]);

  const defaultTo = useMemo(() => {
    const date = new Date();
    if (modeState === 'prevision') {
      return `${date.getFullYear() + 2}-12`;
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }, [modeState]);

  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);

  // Ajuster les dates quand le mode change
  useEffect(() => {
    setFrom(defaultFrom);
    setTo(defaultTo);
  }, [modeState, defaultFrom, defaultTo]);

  // Synchroniser les filtres avec l'URL (mode normal uniquement)
  useEffect(() => {
    if (mode === 'normal' && router) {
      const params = new URLSearchParams();
      params.set('mode', modeState);
      if (propertyId) params.set('propertyId', propertyId);
      if (type) params.set('type', type);
      if (leaseStatus) params.set('leaseStatus', leaseStatus);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      
      router.replace(`?${params.toString()}`, { scroll: false });
    }
  }, [mode, modeState, propertyId, type, leaseStatus, from, to, router]);

  // Récupérer la liste des biens pour le filtre via le hook unifié
  const { properties } = usePropertiesData({
    mode,
  });

  // Filtres pour l'API
  const filters: PatrimoineFilters = {
    from,
    to,
    mode: modeState,
    propertyId,
    type,
    leaseStatus,
  };

  // Charger les données
  const { data, isLoading, error } = usePatrimoineData({
    mode,
    filters,
  });

  const { settings: patrimoineUserSettings, updateSettings: updatePatrimoineUserSettings } = usePatrimoineSettingsState(organizationId);
  const patrimoineSnapshot = usePatrimoineSnapshot({
    organizationId: organizationId ?? undefined,
    userSettings: patrimoineUserSettings,
  });

  // Fonction d'export
  const [isExporting, setIsExporting] = useState(false);
  
  const handleExport = async (format: 'csv' | 'pdf') => {
    try {
      setIsExporting(true);
      
      const endpoint = format === 'pdf' 
        ? '/api/dashboard/patrimoine/export/pdf'
        : '/api/dashboard/patrimoine/export';
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to,
          mode: modeState,
          format,
        }),
      });

      if (!response.ok) {
        throw new Error('Erreur lors de l\'export');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = format === 'pdf' 
        ? `patrimoine-${from}-${to}.pdf`
        : `patrimoine-${from}-${to}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Erreur lors de l\'export:', error);
      alert('Erreur lors de l\'export des données');
    } finally {
      setIsExporting(false);
    }
  };

  const formatMonthYear = (yyyymm: string, isPrevision: boolean = false) => {
    const [year, month] = yyyymm.split('-');
    if (isPrevision) {
      return year;
    }
    return `${month}-${year}`;
  };

  // Générer les options de mois selon le mode
  const generateMonthOptions = (isPrevision: boolean, isEndDate: boolean = false) => {
    const options: { value: string; label: string }[] = [];
    
    if (isPrevision) {
      const currentYear = new Date().getFullYear();
      for (let year = currentYear - 10; year <= currentYear + 10; year++) {
        const month = isEndDate ? '12' : '01';
        const value = `${year}-${month}`;
        options.push({ value, label: year.toString() });
      }
    } else {
      for (let i = 23; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const value = `${year}-${month}`;
        options.push({ value, label: formatMonthYear(value, false) });
      }
    }
    
    return options;
  };

  const monthOptionsFrom = generateMonthOptions(modeState === 'prevision', false);
  const monthOptionsTo = generateMonthOptions(modeState === 'prevision', true);

  const sectionNavItems = [
    { id: 'section-situation', label: 'Situation' },
    { id: 'section-analyse', label: 'Analyse' },
    { id: 'section-evolution', label: 'Évolution' },
    { id: 'section-performance', label: 'Performance' },
    { id: 'section-repartition', label: 'Répartition' },
  ] as const;

  const [activeSection, setActiveSection] = useState<string>(sectionNavItems[0].id);

  return (
    <div className="space-y-5">
      {/* Header avec Hamburger + Titre + Actions */}
      <div className="mb-4 sm:mb-6 space-y-3">
        {/* Ligne 1 : Hamburger + Titre + Actions */}
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
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 truncate min-w-0">Patrimoine Global</h1>
            <div className="flex-shrink-0">
              {/* Menu d'export */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="outline" 
                    disabled={isExporting || isLoading}
                    size="sm"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">{isExporting ? 'Export en cours...' : 'Exporter'}</span>
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleExport('csv')}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Exporter en Excel (CSV)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('pdf')}>
                    <FileText className="h-4 w-4 mr-2" />
                    Exporter en PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
        
        {/* Ligne 2 : Description + Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-sm sm:text-base text-gray-600">Vue d&apos;ensemble de votre patrimoine immobilier</p>
          <Tabs value={modeState} onValueChange={(value) => setModeState(value as PatrimoineMode)}>
            <TabsList>
              <TabsTrigger value="realise">Réalisé</TabsTrigger>
              <TabsTrigger value="prevision">Prévisionnel</TabsTrigger>
              <TabsTrigger value="lisse">Lissé</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

      </div>

      {/* Cockpit : Hero → badges → overview → analyse compacte */}
      <section
        aria-label="Cockpit décisionnel patrimoine"
        className="max-w-full overflow-x-hidden rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm sm:p-4"
      >
        {patrimoineSnapshot.loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-slate-600">
            <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
            <p className="text-sm">Chargement du snapshot patrimoine…</p>
          </div>
        ) : patrimoineSnapshot.error ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{patrimoineSnapshot.error}</div>
        ) : (
          <div className="space-y-3">
            <PatrimoineV4Hero snapshot={patrimoineSnapshot} />
            <PatrimoineGlobalBadges snapshot={patrimoineSnapshot} />
            <PatrimoineV4OverviewMain
              organizationId={organizationId ?? undefined}
              snapshot={patrimoineSnapshot}
            />
            <PatrimoineDecisionCockpit organizationId={organizationId ?? undefined} snapshot={patrimoineSnapshot} />
          </div>
        )}
      </section>

      {!patrimoineSnapshot.loading && !patrimoineSnapshot.error && organizationId && (
        <PatrimoineAssumptionsPanel
          organizationId={organizationId}
          settings={patrimoineUserSettings}
          onSettingsChange={updatePatrimoineUserSettings}
          snapshot={patrimoineSnapshot}
        />
      )}

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-2.5 p-3 bg-gray-50 rounded-lg border border-gray-200 sm:gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Période:</span>
        </div>
        <Select value={from} onValueChange={setFrom}>
          <SelectTrigger className="w-40">
            <SelectValue>
              {monthOptionsFrom.find(opt => opt.value === from)?.label || from}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {monthOptionsFrom.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-gray-500">→</span>
        <Select value={to} onValueChange={setTo}>
          <SelectTrigger className="w-40">
            <SelectValue>
              {monthOptionsTo.find(opt => opt.value === to)?.label || to}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {monthOptionsTo.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2 ml-4">
          <Filter className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Filtres:</span>
        </div>

        <Select
          value={propertyId || 'tous'}
          onValueChange={(value) => setPropertyId(value === 'tous' ? undefined : value)}
        >
          <SelectTrigger className="w-48">
            <SelectValue>
              {propertyId 
                ? (Array.isArray(properties) ? properties.find((p) => p.id === propertyId)?.name : null) || 'Bien inconnu'
                : 'Tous les biens'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tous">Tous les biens</SelectItem>
            {Array.isArray(properties) && properties.map((prop) => (
              <SelectItem key={prop.id} value={prop.id}>
                {prop.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={type || 'tous'}
          onValueChange={(value) => setType(value === 'tous' ? undefined : value as 'loyer' | 'charges')}
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tous">Tous</SelectItem>
            <SelectItem value="loyer">Loyers</SelectItem>
            <SelectItem value="charges">Charges</SelectItem>
          </SelectContent>
        </Select>

        {modeState === 'prevision' && (
          <Select
            value={leaseStatus || 'ACTIF'}
            onValueChange={(value) => setLeaseStatus(value === 'tous' ? undefined : value as 'ACTIF' | 'RESILIE')}
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Statut bail" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ACTIF">Actif</SelectItem>
              <SelectItem value="RESILIE">Résilié</SelectItem>
              <SelectItem value="tous">Tous</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Erreur */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          Erreur lors du chargement des données : {error.message}
        </div>
      )}

      {/* Navigation interne sticky — style dashboard : actif = bleu + blanc, inactif = gris clair (CSS dédié pour éviter les overrides globaux) */}
      {data && (
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-slate-100 -mx-2 px-2 py-2 sm:-mx-4 sm:px-4">
          <nav
            className="flex flex-wrap gap-1 patrimoine-section-tabs"
            aria-label="Navigation dans la page"
            data-patrimoine-section-tabs
          >
            {sectionNavItems.map(({ id, label }) => {
              const isActive = activeSection === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveSection(id)}
                  className="rounded-lg px-3 py-2 text-sm font-medium border-0 cursor-pointer patrimoine-section-tab"
                  data-active={isActive ? 'true' : 'false'}
                >
                  {label}
                </button>
              );
            })}
          </nav>
        </div>
      )}

      {data && (
        <div className="mt-6">
          {activeSection === 'section-situation' && (
            <>
              <div className="mb-6">
                <PatrimoineSynthèse
                  kpis={data.kpis}
                  repartitionParBienLoyers={data.repartitionParBienLoyers}
                  performanceParBien={data.performanceParBien}
                />
              </div>
              <section aria-labelledby="section-situation" id="section-situation">
                <h2 className="text-xl font-semibold text-gray-900 tracking-tight">Situation patrimoniale</h2>
                <p className="mt-1 text-sm text-gray-500">Vision synthétique de votre portefeuille sur la période</p>
                <div className="mt-4">
                  <PatrimoineKPIs kpis={data.kpis} isLoading={isLoading} />
                </div>
              </section>
            </>
          )}
          {activeSection === 'section-analyse' && (
            <section aria-labelledby="section-analyse" id="section-analyse">
              <h2 className="text-xl font-semibold text-gray-900 tracking-tight">Analyse rapide du portefeuille</h2>
              <p className="mt-1 text-sm text-gray-500">Résumé exécutif : cashflow, rendement et endettement</p>
              <div className="mt-4">
                <PatrimoineInsights
                  kpis={data.kpis}
                  cashflow={data.series.cashflow}
                  agenda={data.agenda}
                  mode={modeState}
                />
              </div>
            </section>
          )}
          {activeSection === 'section-evolution' && (
            <section aria-labelledby="section-evolution" id="section-evolution">
              <h2 className="text-xl font-semibold text-gray-900 tracking-tight">Évolution financière</h2>
              <p className="mt-1 text-sm text-gray-500">Lecture des flux et de la trésorerie</p>
              <div className="mt-4">
                <PatrimoineCharts
                  loyers={data.series.loyers}
                  charges={data.series.charges}
                  cashflow={data.series.cashflow}
                  repartitionParBien={data.repartitionParBien}
                  repartitionParBienLoyers={data.repartitionParBienLoyers}
                  repartitionParBienCharges={data.repartitionParBienCharges}
                  repartitionParBienCashflow={data.repartitionParBienCashflow}
                  isLoading={isLoading}
                  variant="evolution"
                  mode={modeState}
                />
              </div>
            </section>
          )}
          {activeSection === 'section-performance' && (
            <section aria-labelledby="section-performance" id="section-performance">
              <h2 className="text-xl font-semibold text-gray-900 tracking-tight">Performance du portefeuille</h2>
              <p className="mt-1 text-sm text-gray-500">Détail par bien, triable par rendement</p>
              <div className="mt-4">
                <DashboardPerformanceParBien
                  items={data.performanceParBien ?? []}
                  loading={false}
                  mode={mode}
                />
              </div>
            </section>
          )}
          {activeSection === 'section-repartition' && (
            <section aria-labelledby="section-repartition" id="section-repartition">
              <h2 className="text-xl font-semibold text-gray-900 tracking-tight">Répartition du portefeuille</h2>
              <p className="mt-1 text-sm text-gray-500">Répartition des flux par bien</p>
              <div className="mt-4">
                <PatrimoineCharts
                  loyers={data.series.loyers}
                  charges={data.series.charges}
                  cashflow={data.series.cashflow}
                  repartitionParBien={data.repartitionParBien}
                  repartitionParBienLoyers={data.repartitionParBienLoyers}
                  repartitionParBienCharges={data.repartitionParBienCharges}
                  repartitionParBienCashflow={data.repartitionParBienCashflow}
                  isLoading={isLoading}
                  variant="repartition"
                  mode={modeState}
                />
              </div>
            </section>
          )}
        </div>
      )}

      {/* État de chargement initial */}
      {isLoading && !data && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Chargement des données...</p>
          </div>
        </div>
      )}
    </div>
  );
}
