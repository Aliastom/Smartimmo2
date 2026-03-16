'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/Card';
import { Drawer } from '@/components/ui/Drawer';
import type { PerformanceParBienItem } from '@/types/dashboard';
import { ChevronDown, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

export interface DashboardPerformanceParBienProps {
  items: PerformanceParBienItem[];
  loading?: boolean;
  /** Pour le lien "Voir le bien" (app-shell vs normal) */
  mode?: 'normal' | 'app-shell';
}

const INITIAL_ROWS = 8;
const WORST_RENDEMENT_COUNT = 3;

type SortKey = 'rendementBrutPct' | 'cashflowMensuel' | 'loyerMensuel';

const fmt = (v: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(v);

export function DashboardPerformanceParBien({ items, loading = false, mode = 'normal' }: DashboardPerformanceParBienProps) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>('rendementBrutPct');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showAll, setShowAll] = useState(false);
  const [drawerBien, setDrawerBien] = useState<PerformanceParBienItem | null>(null);

  const sorted = useMemo(() => {
    const list = [...(items ?? [])];
    list.sort((a, b) => {
      let va: number, vb: number;
      if (sortKey === 'rendementBrutPct') {
        va = a.rendementBrutPct ?? -1;
        vb = b.rendementBrutPct ?? -1;
      } else if (sortKey === 'cashflowMensuel') {
        va = a.cashflowMensuel;
        vb = b.cashflowMensuel;
      } else {
        va = a.loyerMensuel;
        vb = b.loyerMensuel;
      }
      if (va === vb) return 0;
      const d = sortDir === 'asc' ? 1 : -1;
      return va > vb ? d : -d;
    });
    return list;
  }, [items, sortKey, sortDir]);

  const list = sorted ?? [];
  const visibleList = showAll ? list : list.slice(0, INITIAL_ROWS);
  const hasMore = list.length > INITIAL_ROWS && !showAll;

  const { bestRendementIdx, worstRendementIndices } = useMemo(() => {
    const withRendement = list
      .map((row, idx) => ({ idx, v: row.rendementBrutPct ?? null }))
      .filter((x) => x.v !== null) as { idx: number; v: number }[];
    if (withRendement.length === 0) {
      return { bestRendementIdx: -1, worstRendementIndices: [] as number[] };
    }
    const sortedByRendement = [...withRendement].sort((a, b) => b.v - a.v);
    const bestRendementIdx = sortedByRendement[0]?.idx ?? -1;
    const worstRendementIndices = sortedByRendement
      .slice(-WORST_RENDEMENT_COUNT)
      .map((x) => x.idx)
      .filter((idx) => idx !== bestRendementIdx || list.length > 1);
    return { bestRendementIdx, worstRendementIndices };
  }, [list]);

  const summary = useMemo(() => {
    const totalCashflow = list.reduce((acc, r) => acc + r.cashflowMensuel, 0);
    const best = list[bestRendementIdx];
    return {
      bestNom: best?.nom ?? '—',
      bestPct: best?.rendementBrutPct ?? null,
      totalCashflow,
      count: list.length,
    };
  }, [list, bestRendementIdx]);

  const getPropertyUrl = (propertyId: string) => {
    if (mode === 'app-shell') return `/app?view=property&propertyId=${propertyId}`;
    return `/biens/${propertyId}`;
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'rendementBrutPct' ? 'desc' : 'desc');
    }
  };

  const Th = ({ label, keyName }: { label: string; keyName: SortKey }) => (
    <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap">
      <button
        type="button"
        onClick={() => toggleSort(keyName)}
        className="hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded"
      >
        {label} {sortKey === keyName ? (sortDir === 'asc' ? '↑' : '↓') : ''}
      </button>
    </th>
  );

  const getRendementCellClass = (idx: number, rendement: number | null) => {
    if (rendement == null) return '';
    if (rendement > 7) return 'text-emerald-700 font-medium bg-emerald-50/70';
    if (rendement < 4) return 'text-red-700/90 font-medium bg-red-50/50';
    return 'text-slate-700';
  };

  const isTopRendement = (idx: number) => idx === bestRendementIdx;
  const isRendementFaible = (idx: number) => worstRendementIndices.includes(idx);

  if (loading) {
    return (
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardContent className="py-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">Performance par bien</h3>
          <div className="h-48 flex items-center justify-center text-slate-500 text-sm">Chargement…</div>
        </CardContent>
      </Card>
    );
  }

  if (list.length === 0) {
    return (
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardContent className="py-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">Performance par bien</h3>
          <p className="text-sm text-slate-500">Aucun bien à afficher.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardContent className="py-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">Performance par bien</h3>

          {/* Résumé au-dessus du tableau */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-4 p-3 bg-slate-50 rounded-lg border border-slate-100 text-sm">
            <span className="text-slate-600">
              <span className="font-medium text-slate-700">Meilleur rendement :</span>{' '}
              {summary.bestNom}
              {summary.bestPct != null && (
                <span className="text-emerald-700 font-medium ml-1">({summary.bestPct.toFixed(1)} %)</span>
              )}
            </span>
            <span className="text-slate-600">
              <span className="font-medium text-slate-700">Cashflow mensuel total :</span>{' '}
              <span className="tabular-nums font-medium">{fmt(summary.totalCashflow)}</span>
            </span>
            <span className="text-slate-600">
              <span className="font-medium text-slate-700">Nombre de biens :</span> {summary.count}
            </span>
          </div>

          <div className="overflow-x-auto -mx-1">
            <div className="max-h-[380px] overflow-y-auto overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 z-10 bg-white border-b border-slate-200 shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
                  <tr>
                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap">
                      Bien
                    </th>
                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap">
                      Valeur du bien
                    </th>
                    <Th label="Loyer mensuel" keyName="loyerMensuel" />
                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap">
                      Charges mensuelles
                    </th>
                    <Th label="Cashflow mensuel" keyName="cashflowMensuel" />
                    <Th label="Rendement brut" keyName="rendementBrutPct" />
                  </tr>
                </thead>
                <tbody>
                  {visibleList.map((row, visibleIdx) => {
                    const originalIdx = list.indexOf(row);
                    return (
                      <tr
                        key={row.propertyId}
                        onClick={() => setDrawerBien(row)}
                        className="border-b border-slate-100 hover:bg-slate-50/80 cursor-pointer transition-all duration-150"
                      >
                        <td className="py-2.5 px-3 font-medium text-slate-900">
                          <span className="flex items-center gap-1.5 flex-wrap">
                            {row.nom}
                            {isTopRendement(originalIdx) && (
                              <Badge variant="success" size="sm" className="shrink-0 text-[10px] px-1.5 py-0">Top rendement</Badge>
                            )}
                            {isRendementFaible(originalIdx) && (
                              <Badge variant="danger" size="sm" className="shrink-0 text-[10px] px-1.5 py-0">Rendement faible</Badge>
                            )}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 tabular-nums text-slate-700">
                          {row.valeurBien != null ? fmt(row.valeurBien) : '—'}
                        </td>
                        <td className="py-2.5 px-3 tabular-nums text-slate-700">{fmt(row.loyerMensuel)}</td>
                        <td className="py-2.5 px-3 tabular-nums text-slate-700">{fmt(row.chargesMensuelles)}</td>
                        <td className="py-2.5 px-3 tabular-nums text-slate-700">{fmt(row.cashflowMensuel)}</td>
                        <td className={`py-2.5 px-3 tabular-nums rounded ${getRendementCellClass(originalIdx, row.rendementBrutPct)}`}>
                          {row.rendementBrutPct != null ? (
                            `${row.rendementBrutPct.toFixed(1)} %`
                          ) : (
                            'Rendement non calculé'
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {hasMore && (
              <div className="mt-3 flex justify-center">
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded"
                >
                  Voir plus ({list.length - INITIAL_ROWS} autres)
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Drawer détail bien */}
      <Drawer
        isOpen={!!drawerBien}
        onClose={() => setDrawerBien(null)}
        title={drawerBien?.nom ?? 'Détail du bien'}
        side="right"
        size="md"
        footer={
          drawerBien && (
            <div className="flex flex-col sm:flex-row gap-2 w-full">
              <a
                href={getPropertyUrl(drawerBien.propertyId)}
                onClick={(e) => {
                  e.preventDefault();
                  router.push(getPropertyUrl(drawerBien.propertyId));
                  setDrawerBien(null);
                }}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium transition-colors duration-200"
              >
                Voir la fiche du bien
                <ExternalLink className="h-4 w-4" />
              </a>
              <a
                href={getPropertyUrl(drawerBien.propertyId)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 text-sm font-medium transition-colors duration-200"
              >
                Ouvrir la fiche complète
              </a>
            </div>
          )
        }
      >
        {drawerBien && (
          <div className="space-y-5">
            {/* Mini synthèse */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-5 space-y-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bien : {drawerBien.nom}</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500">Rendement</p>
                  <p className={`font-semibold ${drawerBien.rendementBrutPct != null && drawerBien.rendementBrutPct > 7 ? 'text-emerald-600' : drawerBien.rendementBrutPct != null && drawerBien.rendementBrutPct < 4 ? 'text-red-600' : 'text-slate-700'}`}>
                    {drawerBien.rendementBrutPct != null ? `${drawerBien.rendementBrutPct.toFixed(1)} %` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Cashflow</p>
                  <p className={`font-semibold ${drawerBien.cashflowMensuel >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {fmt(drawerBien.cashflowMensuel)}
                  </p>
                </div>
              </div>
              {drawerBien.rendementBrutPct != null && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-500">Performance rendement (0–10 %)</p>
                  <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500 ease-out min-w-[4px]"
                      style={{
                        width: `${Math.min(100, Math.max(0, drawerBien.rendementBrutPct * 10))}%`,
                        backgroundColor: drawerBien.rendementBrutPct >= 7 ? '#10b981' : drawerBien.rendementBrutPct >= 4 ? '#f59e0b' : '#ef4444',
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
            <dl className="grid grid-cols-1 gap-4 text-sm">
              <div>
                <dt className="text-slate-500 font-medium">Valeur du bien</dt>
                <dd className="text-slate-900 tabular-nums mt-0.5">
                  {drawerBien.valeurBien != null ? fmt(drawerBien.valeurBien) : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 font-medium">Loyer mensuel</dt>
                <dd className="text-slate-900 tabular-nums mt-0.5">{fmt(drawerBien.loyerMensuel)}</dd>
              </div>
              <div>
                <dt className="text-slate-500 font-medium">Charges mensuelles</dt>
                <dd className="text-slate-900 tabular-nums mt-0.5">{fmt(drawerBien.chargesMensuelles)}</dd>
              </div>
              <div>
                <dt className="text-slate-500 font-medium">Cashflow mensuel</dt>
                <dd className={`tabular-nums mt-0.5 ${drawerBien.cashflowMensuel >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {fmt(drawerBien.cashflowMensuel)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 font-medium">Rendement brut</dt>
                <dd className="text-slate-900 tabular-nums mt-0.5">
                  {drawerBien.rendementBrutPct != null ? `${drawerBien.rendementBrutPct.toFixed(1)} %` : '—'}
                </dd>
              </div>
            </dl>
          </div>
        )}
      </Drawer>
    </>
  );
}
