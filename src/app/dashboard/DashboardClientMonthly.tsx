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
import { MonthlyGraphs } from '@/components/dashboard/MonthlyGraphs';
import type { MonthlyDashboardData } from '@/types/dashboard';

export default function DashboardClientMonthly() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
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

  // Mémoriser les paramètres de requête pour éviter les re-renders
  const queryParams = useMemo(() => {
    const params = new URLSearchParams({
      month,
      ...(bienIds.length > 0 && { bienIds: bienIds.join(',') }),
      ...(locataireIds.length > 0 && { locataireIds: locataireIds.join(',') }),
      ...(type !== 'ALL' && { type }),
      ...(statut !== 'ALL' && { statut }),
      ...(source !== 'ALL' && { source }),
    });
    return params.toString();
  }, [month, bienIds, locataireIds, type, statut, source]);

  // Récupérer les biens et locataires pour les filtres
  const { data: propertiesData } = useQuery({
    queryKey: ['properties-for-filter'],
    queryFn: async () => {
      const response = await fetch('/api/properties?limit=1000');
      if (!response.ok) return { data: [] };
      const data = await response.json();
      return { data: data.data || [] };
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: tenantsData } = useQuery({
    queryKey: ['tenants-for-filter'],
    queryFn: async () => {
      const response = await fetch('/api/tenants?limit=1000');
      if (!response.ok) return { data: [] };
      const data = await response.json();
      return { data: data.data || [] };
    },
    staleTime: 5 * 60 * 1000,
  });

  // Utiliser React Query pour le cache et la gestion d'état
  const { data, isLoading, error } = useQuery<MonthlyDashboardData>({
    queryKey: ['dashboard-monthly', queryParams],
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/monthly?${queryParams}`);
      if (!response.ok) {
        throw new Error('Erreur lors du chargement des données');
      }
      return response.json();
    },
    staleTime: 2 * 60 * 1000, // 2 minutes pour le dashboard
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
    
    router.replace(`/dashboard?${params.toString()}`, { scroll: false });
  }, [month, bienIds, locataireIds, type, statut, source, router]);
  
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
            loyersEncaisses: 0,
            loyersAttendus: 0,
            chargesPayees: 0,
            cashflow: 0,
            tauxEncaissement: 0,
            bauxActifs: 0,
            documentsEnvoyes: 0,
            deltaLoyersEncaisses: 0,
            deltaChargesPayees: 0,
            deltaCashflow: 0,
            deltaTauxEncaissement: 0,
          }}
          isLoading={true}
        />
      ) : data ? (
        <MonthlyKpiBar kpis={data.kpis} />
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

      {/* Graphiques en pleine largeur */}
      <div>
        {isLoading ? (
          <MonthlyGraphs
            intraMensuel={[]}
            cashflowCumule={[]}
            isLoading={true}
          />
        ) : data ? (
          <MonthlyGraphs
            intraMensuel={data.graph.intraMensuel}
            cashflowCumule={data.graph.cashflowCumule}
          />
        ) : null}
      </div>

      {/* Actions rapides */}
      <Card>
        <CardContent className="py-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Actions rapides
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link href="/biens" className="block">
              <Button
                variant="outline"
                className="h-24 w-full flex flex-col items-center justify-center gap-2 hover:scale-105 transition-transform"
              >
                <Building2 className="h-6 w-6" />
                <span className="text-sm font-medium">Nouveau Bien</span>
              </Button>
            </Link>
            
            <Link href="/locataires" className="block">
              <Button
                variant="outline"
                className="h-24 w-full flex flex-col items-center justify-center gap-2 hover:scale-105 transition-transform"
              >
                <Users className="h-6 w-6" />
                <span className="text-sm font-medium">Nouveau Locataire</span>
              </Button>
            </Link>
            
            <Link href="/documents" className="block">
              <Button
                variant="outline"
                className="h-24 w-full flex flex-col items-center justify-center gap-2 hover:scale-105 transition-transform"
              >
                <FileText className="h-6 w-6" />
                <span className="text-sm font-medium">Nouveau Document</span>
              </Button>
            </Link>
            
            <Link href="/transactions" className="block">
              <Button
                variant="outline"
                className="h-24 w-full flex flex-col items-center justify-center gap-2 hover:scale-105 transition-transform"
              >
                <CreditCard className="h-6 w-6" />
                <span className="text-sm font-medium">Nouvelle Transaction</span>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

