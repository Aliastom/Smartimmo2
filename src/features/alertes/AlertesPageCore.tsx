/**
 * Page Alertes : gestion des anomalies (loyers en retard, transactions non rapprochées,
 * indexations à appliquer, baux proches expiration).
 * Utilisée dans l'App Shell (view=alertes). Données depuis useDashboardData (IDB en app-shell).
 */

'use client';

import React, { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import { useDashboardData, type DashboardFilters } from '@/features/dashboard/hooks/useDashboardData';
import { TasksPanel } from '@/components/dashboard/TasksPanel';
import { useSelectedPeriod } from '@/contexts/SelectedPeriodContext';

export interface AlertesPageCoreProps {
  mode: 'normal' | 'app-shell';
}

const TYPE_TO_ANCHOR: Record<string, string> = {
  loyers_retard: 'loyers-retard',
  transactions: 'transactions-a-rapprocher',
  indexations: 'indexations',
  echeances: 'echeances',
};

export function AlertesPageCore({ mode }: AlertesPageCoreProps) {
  const { organizationId, isLoading: orgLoading } = useCurrentOrganization();
  const searchParams = useSearchParams();
  const selectedPeriod = useSelectedPeriod();
  // Aligner sur la même temporalité que le Dashboard : mois sélectionné ou temps réel
  const month = mode === 'app-shell' ? selectedPeriod.effectiveMonth : (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  })();

  const filters: DashboardFilters = useMemo(
    () => ({
      month,
      bienIds: [],
      locataireIds: [],
      type: 'ALL',
      statut: 'ALL',
      source: 'ALL',
      focusLoyer: false,
    }),
    [month]
  );

  const { data, loading, error } = useDashboardData({
    mode,
    filters: mode === 'app-shell' ? filters : undefined,
  });

  // Scroll vers l'ancre au chargement (hash ou param type=) — doit être appelé avant tout return
  useEffect(() => {
    if (!data) return;
    const hash = typeof window !== 'undefined' ? window.location.hash.slice(1) : '';
    const typeParam = searchParams?.get('type');
    const anchor = hash || (typeParam ? TYPE_TO_ANCHOR[typeParam] : '');
    if (anchor) {
      const el = document.getElementById(anchor);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [data, searchParams]);

  if (orgLoading || (mode === 'app-shell' && !organizationId)) {
    return (
      <Card className="w-full">
        <CardContent className="py-12">
          <div className="flex items-center justify-center gap-2 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Chargement des alertes...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (mode === 'app-shell' && !organizationId) {
    return (
      <Card className="w-full">
        <CardContent className="py-8">
          <p className="text-center text-slate-600">
            Veuillez sélectionner une organisation pour afficher les alertes.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full border-red-200 bg-red-50">
        <CardContent className="py-6">
          <p className="text-center text-red-600">
            {error instanceof Error ? error.message : 'Une erreur est survenue.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="py-12">
          <div className="flex items-center justify-center gap-2 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Chargement des alertes...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="w-full">
        <CardContent className="py-8">
          <p className="text-center text-slate-600">Aucune donnée disponible.</p>
        </CardContent>
      </Card>
    );
  }

  const nLoyers = data.aTraiter.relances.length;
  const nTransactions = data.aTraiter.transactionsNonRapprochees.length;
  const nIndexations = data.aTraiter.indexations.length;
  const nEcheances = data.aTraiter.echeancesPrets.length + data.aTraiter.echeancesCharges.length;
  const alertesTotales = nLoyers + nTransactions + nIndexations + nEcheances;
  const totalLoyersRetard = data.aTraiter.relances.reduce((s, r) => s + r.montant, 0);
  const totalTransactions = data.aTraiter.transactionsNonRapprochees.reduce((s, t) => s + t.montant, 0);
  const formatEur = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

  const periodLabel = selectedPeriod.formatMonthLabel(month);

  return (
    <div className="w-full space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold text-gray-900">Alertes</h1>
          {mode === 'app-shell' && (
            <>
              <Badge variant="secondary" className="text-xs font-medium">
                Alertes du mois : {periodLabel}
              </Badge>
              <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
                <button
                  type="button"
                  onClick={() => selectedPeriod.setUseRealtime(false)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${!selectedPeriod.useRealtime ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  Mois sélectionné
                </button>
                <button
                  type="button"
                  onClick={() => selectedPeriod.setUseRealtime(true)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${selectedPeriod.useRealtime ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  Temps réel
                </button>
              </div>
            </>
          )}
        </div>
        <p className="text-sm text-slate-500 mt-0.5">
          Loyers en retard, transactions à rapprocher, indexations à appliquer, baux proches expiration.
        </p>
      </div>

      {/* Indicateur de progression */}
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardContent className="py-4">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Progression</h3>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="text-slate-600">Alertes totales : <strong className="tabular-nums">{alertesTotales}</strong></span>
            <span className="text-slate-400">·</span>
            <span className="text-emerald-600">Alertes traitées : <strong className="tabular-nums">0</strong></span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-600">Alertes restantes : <strong className="tabular-nums">{alertesTotales}</strong></span>
          </div>
          <div className="mt-2 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-300"
              style={{ width: alertesTotales === 0 ? '0%' : '0%' }}
              role="progressbar"
              aria-valuenow={0}
              aria-valuemin={0}
              aria-valuemax={alertesTotales}
            />
          </div>
          <p className="text-xs text-slate-500 mt-1">La barre se remplit au fur et à mesure que vous traitez les alertes.</p>
        </CardContent>
      </Card>

      {/* Résumé global (éléments cliquables + montants) */}
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardContent className="py-4">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Résumé</h3>
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-sm">
            <li>
              <Link href="#loyers-retard" className="flex flex-col rounded-lg border border-red-100 bg-red-50/50 px-3 py-2 font-medium text-red-800 transition-colors hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2">
                <span>{nLoyers} loyer{nLoyers !== 1 ? 's' : ''} en retard</span>
                {nLoyers > 0 && <span className="text-xs font-semibold mt-0.5 tabular-nums">{formatEur(totalLoyersRetard)}</span>}
              </Link>
            </li>
            <li>
              <Link href="#transactions-a-rapprocher" className="flex flex-col rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-2 font-medium text-amber-800 transition-colors hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2">
                <span>{nTransactions} transaction{nTransactions !== 1 ? 's' : ''} à rapprocher</span>
                {nTransactions > 0 && <span className="text-xs font-semibold mt-0.5 tabular-nums">{formatEur(totalTransactions)}</span>}
              </Link>
            </li>
            <li>
              <Link href="#indexations" className="flex items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50/50 px-3 py-2 font-medium text-indigo-800 transition-colors hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
                {nIndexations} indexation{nIndexations !== 1 ? 's' : ''} à traiter
              </Link>
            </li>
            <li>
              <Link href="#echeances" className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-700 transition-colors hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2">
                {nEcheances} échéance{nEcheances !== 1 ? 's' : ''} ce mois
              </Link>
            </li>
          </ul>
        </CardContent>
      </Card>

      <TasksPanel
        loyersNonEncaisses={data.aTraiter.loyersNonEncaisses}
        relances={data.aTraiter.relances}
        transactionsNonRapprochees={data.aTraiter.transactionsNonRapprochees}
        indexations={data.aTraiter.indexations}
        echeancesPrets={data.aTraiter.echeancesPrets}
        echeancesCharges={data.aTraiter.echeancesCharges}
        bauxAEcheance={data.aTraiter.bauxAEcheance}
        documentsAValider={data.aTraiter.documentsAValider}
        layout="vertical"
        currentMonth={month}
        mode={mode}
      />
    </div>
  );
}
