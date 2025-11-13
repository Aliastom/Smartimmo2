'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, useRouter } from 'next/navigation';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/shared/select';
import { PatrimoineKPIs } from '@/components/dashboard/PatrimoineKPIs';
import { PatrimoineCharts } from '@/components/dashboard/PatrimoineCharts';
import { GlobalAgenda } from '@/components/dashboard/GlobalAgenda';
import { PatrimoineInsights } from '@/components/dashboard/PatrimoineInsights';
import { fetchPatrimoineData } from '@/services/dashboard';
import { PatrimoineMode, PatrimoineFilters } from '@/types/dashboard';
import { Download, Calendar, Filter, FileSpreadsheet, FileText, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';

/**
 * Page Dashboard Patrimoine Global
 * 
 * Affiche les KPIs, graphiques et échéancier pour le patrimoine immobilier
 * avec 3 modes : Réalisé, Prévisionnel, Lissé
 */
export default function PatrimoinePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Initialiser les états depuis les query params
  const [mode, setMode] = useState<PatrimoineMode>((searchParams.get('mode') as PatrimoineMode) || 'realise');
  const [propertyId, setPropertyId] = useState<string | undefined>(searchParams.get('propertyId') || undefined);
  const [type, setType] = useState<'loyer' | 'charges' | undefined>(
    (searchParams.get('type') as 'loyer' | 'charges') || undefined
  );
  const [leaseStatus, setLeaseStatus] = useState<'ACTIF' | 'RESILIE' | undefined>(
    (searchParams.get('leaseStatus') as 'ACTIF' | 'RESILIE') || undefined
  );
  
  // Période par défaut : 12 derniers mois pour réalisé, année en cours pour prévisionnel
  const defaultFrom = useMemo(() => {
    const date = new Date();
    if (mode === 'prevision') {
      // Mode prévisionnel : année en cours (janvier)
      return `${date.getFullYear()}-01`;
    }
    // Mode réalisé : 12 derniers mois
    date.setMonth(date.getMonth() - 11);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }, [mode]);

  const defaultTo = useMemo(() => {
    const date = new Date();
    if (mode === 'prevision') {
      // Mode prévisionnel : +2 ans (décembre)
      return `${date.getFullYear() + 2}-12`;
    }
    // Mode réalisé : mois actuel
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }, [mode]);

  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);

  // Ajuster les dates quand le mode change
  useEffect(() => {
    setFrom(defaultFrom);
    setTo(defaultTo);
  }, [mode, defaultFrom, defaultTo]);

  // Synchroniser les filtres avec l'URL
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('mode', mode);
    if (propertyId) params.set('propertyId', propertyId);
    if (type) params.set('type', type);
    if (leaseStatus) params.set('leaseStatus', leaseStatus);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [mode, propertyId, type, leaseStatus, from, to, router]);

  // Récupérer la liste des biens pour le filtre
  const { data: properties } = useQuery({
    queryKey: ['properties-for-filter'],
    queryFn: async () => {
      const response = await fetch('/api/properties');
      if (!response.ok) return [];
      const data = await response.json();
      return data.data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Filtres pour l'API
  const filters: PatrimoineFilters = {
    from,
    to,
    mode,
    propertyId,
    type,
    leaseStatus,
  };

  // Charger les données
  const { data, isLoading, error } = useQuery({
    queryKey: ['patrimoine', filters],
    queryFn: () => fetchPatrimoineData(filters),
    staleTime: 2 * 60 * 1000, // 2 minutes
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
          mode,
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
    // Mode prévisionnel : afficher l'année uniquement
    if (isPrevision) {
      return year;
    }
    // Mode réalisé/lissé : afficher MM-AAAA
    return `${month}-${year}`;
  };

  // Générer les options de mois selon le mode
  const generateMonthOptions = (isPrevision: boolean, isEndDate: boolean = false) => {
    const options: { value: string; label: string }[] = [];
    
    if (isPrevision) {
      // Mode prévisionnel : afficher par année de 10 ans dans le passé à +10 ans dans le futur
      const currentYear = new Date().getFullYear();
      for (let year = currentYear - 10; year <= currentYear + 10; year++) {
        // Pour la date de début : janvier (01), pour la date de fin : décembre (12)
        const month = isEndDate ? '12' : '01';
        const value = `${year}-${month}`;
        options.push({ value, label: year.toString() });
      }
    } else {
      // Mode réalisé/lissé : seulement les 24 derniers mois au format MM-AAAA
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

  const monthOptionsFrom = generateMonthOptions(mode === 'prevision', false);
  const monthOptionsTo = generateMonthOptions(mode === 'prevision', true);

  return (
    <div className="space-y-6">
      {/* Header avec Tabs et filtres */}
      <SectionTitle
        title="Patrimoine Global"
        description="Vue d'ensemble de votre patrimoine immobilier"
        actions={
          <div className="flex items-center gap-3">
            {/* Menu d'export */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  disabled={isExporting || isLoading}
                >
                  <Download className="h-4 w-4 mr-2" />
                  {isExporting ? 'Export en cours...' : 'Exporter'}
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
        }
        centerContent={
          <Tabs value={mode} onValueChange={(value) => setMode(value as PatrimoineMode)}>
            <TabsList>
              <TabsTrigger value="realise">Réalisé</TabsTrigger>
              <TabsTrigger value="prevision">Prévisionnel</TabsTrigger>
              <TabsTrigger value="lisse">Lissé</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

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
                ? properties?.find((p: any) => p.id === propertyId)?.name || 'Bien inconnu'
                : 'Tous les biens'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tous">Tous les biens</SelectItem>
            {properties?.map((prop: any) => (
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

        {mode === 'prevision' && (
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
            mode={mode}
          />

          {/* Graphiques */}
          <PatrimoineCharts
            loyers={data.series.loyers}
            charges={data.series.charges}
            cashflow={data.series.cashflow}
            repartitionParBien={data.repartitionParBien}
            isLoading={isLoading}
          />

          {/* Échéancier / Agenda */}
          <GlobalAgenda agenda={data.agenda} isLoading={isLoading} />
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

