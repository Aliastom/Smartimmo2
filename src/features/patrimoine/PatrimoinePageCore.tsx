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
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/shared/select';
import { PatrimoineKPIs } from '@/components/dashboard/PatrimoineKPIs';
import { PatrimoineCharts } from '@/components/dashboard/PatrimoineCharts';
import { GlobalAgenda } from '@/components/dashboard/GlobalAgenda';
import { PatrimoineInsights } from '@/components/dashboard/PatrimoineInsights';
import { usePatrimoineData } from './hooks/usePatrimoineData';
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

export interface PatrimoinePageCoreProps {
  mode: 'normal' | 'app-shell';
}

export function PatrimoinePageCore({
  mode,
}: PatrimoinePageCoreProps) {
  const { organizationId } = useCurrentOrganization();
  const router = mode === 'normal' ? useRouter() : null;
  const searchParamsHook = mode === 'normal' ? useSearchParams() : null;
  const sidebarContext = useSidebarOptional();
  
  // Initialiser les états depuis les query params
  const [modeState, setModeState] = useState<PatrimoineMode>(() => {
    if (mode === 'normal' && searchParamsHook) {
      return (searchParamsHook.get('mode') as PatrimoineMode) || 'realise';
    }
    return 'realise';
  });
  const [propertyId, setPropertyId] = useState<string | undefined>(() => {
    if (mode === 'normal' && searchParamsHook) {
      return searchParamsHook.get('propertyId') || undefined;
    }
    return undefined;
  });
  const [type, setType] = useState<'loyer' | 'charges' | undefined>(() => {
    if (mode === 'normal' && searchParamsHook) {
      return (searchParamsHook.get('type') as 'loyer' | 'charges') || undefined;
    }
    return undefined;
  });
  const [leaseStatus, setLeaseStatus] = useState<'ACTIF' | 'RESILIE' | undefined>(() => {
    if (mode === 'normal' && searchParamsHook) {
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

  return (
    <div className="space-y-6">
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
          <p className="text-sm sm:text-base text-gray-600">Vue d'ensemble de votre patrimoine immobilier</p>
          <Tabs value={modeState} onValueChange={(value) => setModeState(value as PatrimoineMode)}>
            <TabsList>
              <TabsTrigger value="realise">Réalisé</TabsTrigger>
              <TabsTrigger value="prevision">Prévisionnel</TabsTrigger>
              <TabsTrigger value="lisse">Lissé</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
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
                ? (Array.isArray(properties) ? properties.find((p: any) => p.id === propertyId)?.name : null) || 'Bien inconnu'
                : 'Tous les biens'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tous">Tous les biens</SelectItem>
            {Array.isArray(properties) && properties.map((prop: any) => (
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

      {/* KPIs */}
      {data && (
        <>
          <PatrimoineKPIs kpis={data.kpis} isLoading={isLoading} />

          {/* Insights IA */}
          <PatrimoineInsights 
            kpis={data.kpis} 
            cashflow={data.series.cashflow}
            agenda={data.agenda}
            mode={modeState}
          />

          {/* Graphiques */}
          <PatrimoineCharts
            loyers={data.series.loyers}
            charges={data.series.charges}
            cashflow={data.series.cashflow}
            repartitionParBien={data.repartitionParBien}
            repartitionParBienLoyers={data.repartitionParBienLoyers}
            repartitionParBienCharges={data.repartitionParBienCharges}
            repartitionParBienCashflow={data.repartitionParBienCashflow}
            isLoading={isLoading}
          />

          {/* Échéancier / Agenda */}
          <GlobalAgenda agenda={data.agenda} isLoading={isLoading} mode={mode} />
        </>
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
