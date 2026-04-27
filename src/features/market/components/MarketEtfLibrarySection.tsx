'use client';

import { useEffect, useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { marketInvestmentStorage } from '@/features/market/services/marketInvestmentStorage';
import {
  ETF_LIBRARY,
  assetClassLabel,
  categoryLabel,
  computeEtfQualityScore,
  envelopeLabel,
  isTrackableMarketAsset,
  isTrackedEtf,
  roleLabel,
  type EtfQualityScoreResult,
  type MarketAssetClass,
  type EtfCategory,
  type EtfEnvelope,
  type EtfLibraryItem,
  type EtfPortfolioRole,
} from '@/features/market/services/etfLibrary';
import type { AthPeriod, MarketSnapshot } from '@/features/market/types';
import type { MarketHistoryPoint } from '@/features/market/services/marketDataService';
import { writeMarketCompareSymbols } from '@/features/market/marketRefreshSymbols';
import { normalizeMarketStorageSymbol } from '@/features/market/marketSymbolAliases';

interface MarketEtfLibrarySectionProps {
  trackedSymbol: string;
  onSetTrackedEtf: (item: EtfLibraryItem) => Promise<void>;
  organizationId?: string;
  athPeriod: AthPeriod;
  currency: string;
}

const ALL_FILTER = 'ALL';

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
}

function formatPriceCurrent(value: number, currency: string): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value);
}

const MIN_HISTORY_POINTS_FOR_CHART = 2;

function computeHistoryStats(history: MarketHistoryPoint[]) {
  if (history.length < 2) return null;
  const points = history
    .map((row) => ({ date: row.date, close: Number(row.close) }))
    .filter((row) => Boolean(row.date) && Number.isFinite(row.close) && row.close > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (points.length < 2) return null;
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return null;
  const min = points.reduce((acc, row) => Math.min(acc, row.close), Number.POSITIVE_INFINITY);
  const max = points.reduce((acc, row) => Math.max(acc, row.close), Number.NEGATIVE_INFINITY);
  let rollingHigh = first.close;
  let maxDrawdown = 0;
  for (const row of points) {
    if (row.close > rollingHigh) rollingHigh = row.close;
    const drawdown = rollingHigh > 0 ? ((row.close - rollingHigh) / rollingHigh) * 100 : 0;
    if (drawdown < maxDrawdown) maxDrawdown = drawdown;
  }
  return {
    performancePct: ((last.close - first.close) / first.close) * 100,
    min,
    max,
    maxDrawdownPct: maxDrawdown,
    firstDate: first.date,
    lastDate: last.date,
    firstClose: first.close,
    normalizedSeries: points.map((row) => ({
      date: row.date,
      normalized: (row.close / first.close) * 100,
      close: row.close,
    })),
  };
}

function computeCompareChartData(left: MarketHistoryPoint[], right: MarketHistoryPoint[]) {
  const leftStats = computeHistoryStats(left);
  const rightStats = computeHistoryStats(right);
  if (!leftStats && !rightStats) return [];
  const dateSet = new Set<string>();
  leftStats?.normalizedSeries.forEach((row) => dateSet.add(row.date));
  rightStats?.normalizedSeries.forEach((row) => dateSet.add(row.date));
  const orderedDates = [...dateSet].sort((a, b) => a.localeCompare(b));
  const leftMap = new Map(leftStats?.normalizedSeries.map((row) => [row.date, row.normalized]) ?? []);
  const rightMap = new Map(rightStats?.normalizedSeries.map((row) => [row.date, row.normalized]) ?? []);
  return orderedDates.map((date) => ({
    date,
    left: leftMap.get(date) ?? null,
    right: rightMap.get(date) ?? null,
  }));
}

function searchableText(item: EtfLibraryItem): string {
  return [
    item.name,
    item.ticker,
    item.isin,
    item.issuer,
    categoryLabel(item.category),
    roleLabel(item.portfolioRole),
    assetClassLabel(item.assetClass),
  ]
    .join(' ')
    .toLowerCase();
}

function scoreVariant(score: number): 'success' | 'warning' | 'danger' | 'secondary' {
  if (score >= 75) return 'success';
  if (score >= 55) return 'warning';
  if (score >= 35) return 'secondary';
  return 'danger';
}

export function MarketEtfLibrarySection({
  trackedSymbol,
  onSetTrackedEtf,
  organizationId,
  athPeriod,
  currency,
}: MarketEtfLibrarySectionProps) {
  const [assetClassFilter, setAssetClassFilter] = useState<MarketAssetClass | typeof ALL_FILTER>(ALL_FILTER);
  const [categoryFilter, setCategoryFilter] = useState<EtfCategory | typeof ALL_FILTER>(ALL_FILTER);
  const [envelopeFilter, setEnvelopeFilter] = useState<EtfEnvelope | typeof ALL_FILTER>(ALL_FILTER);
  const [roleFilter, setRoleFilter] = useState<EtfPortfolioRole | typeof ALL_FILTER>(ALL_FILTER);
  const [searchTerm, setSearchTerm] = useState('');
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [isApplyingTicker, setIsApplyingTicker] = useState<string | null>(null);
  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredRows = useMemo(() => {
    return ETF_LIBRARY.filter((item) => {
      if (assetClassFilter !== ALL_FILTER && item.assetClass !== assetClassFilter) return false;
      if (categoryFilter !== ALL_FILTER && item.category !== categoryFilter) return false;
      if (envelopeFilter !== ALL_FILTER && !item.eligibleEnvelopes.includes(envelopeFilter)) return false;
      if (roleFilter !== ALL_FILTER && item.portfolioRole !== roleFilter) return false;
      if (normalizedSearch && !searchableText(item).includes(normalizedSearch)) return false;
      return true;
    });
  }, [assetClassFilter, categoryFilter, envelopeFilter, roleFilter, normalizedSearch]);

  const comparedRows = useMemo(
    () => ETF_LIBRARY.filter((item) => compareIds.includes(item.id)),
    [compareIds]
  );
  const comparedWithStats = useMemo(() => {
    return comparedRows.map((item) => {
      const history =
        organizationId
          ? marketInvestmentStorage.getPriceHistory(organizationId, item.ticker, athPeriod)
          : [];
      return {
        item,
        quality: computeEtfQualityScore(item),
        history,
        stats: computeHistoryStats(history),
      };
    });
  }, [athPeriod, comparedRows, organizationId]);
  const compareChartData = useMemo(() => {
    if (comparedWithStats.length !== 2) return [];
    const leftH = comparedWithStats[0]?.history ?? [];
    const rightH = comparedWithStats[1]?.history ?? [];
    if (leftH.length < MIN_HISTORY_POINTS_FOR_CHART || rightH.length < MIN_HISTORY_POINTS_FOR_CHART) {
      return [];
    }
    return computeCompareChartData(leftH, rightH);
  }, [comparedWithStats]);

  const tickersScopeKey = useMemo(() => {
    const s = new Set<string>();
    if (trackedSymbol.trim()) s.add(normalizeMarketStorageSymbol(trackedSymbol));
    comparedRows.forEach((r) => s.add(normalizeMarketStorageSymbol(r.ticker)));
    filteredRows.slice(0, 120).forEach((r) => s.add(normalizeMarketStorageSymbol(r.ticker)));
    return [...s].sort().join('\0');
  }, [trackedSymbol, comparedRows, filteredRows]);

  const [snapshotsByNormTicker, setSnapshotsByNormTicker] = useState<Record<string, MarketSnapshot | null>>({});

  useEffect(() => {
    if (!organizationId) {
      setSnapshotsByNormTicker({});
      return undefined;
    }
    let cancelled = false;
    const symbols = tickersScopeKey.split('\0').filter(Boolean);
    (async () => {
      const next: Record<string, MarketSnapshot | null> = {};
      await Promise.all(
        symbols.map(async (norm) => {
          const snap = await marketInvestmentStorage.getSnapshot(organizationId, norm, athPeriod);
          if (!cancelled) next[norm] = snap;
        })
      );
      if (!cancelled) setSnapshotsByNormTicker(next);
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [organizationId, athPeriod, tickersScopeKey]);

  useEffect(() => {
    if (!organizationId) return;
    const tickers = comparedRows.map((item) => item.ticker);
    writeMarketCompareSymbols(organizationId, tickers);
  }, [organizationId, comparedRows]);

  const toggleCompare = (id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((it) => it !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  const handleSetTracked = async (item: EtfLibraryItem) => {
    setIsApplyingTicker(item.ticker);
    try {
      await onSetTrackedEtf(item);
    } finally {
      setIsApplyingTicker(null);
    }
  };

  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardContent className="space-y-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Bibliothèque d’actifs</p>
            <p className="text-sm font-medium text-slate-900">Catalogue interne d’actifs comparables (métadonnées statiques locales).</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Actif suivi actuel : <span className="font-semibold text-slate-900">{trackedSymbol}</span>
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-600">
          Métadonnées bibliothèque (frais, encours, rôle, catégorie, classe) = statiques. Prix / ATH / historique = cache
          local (Dexie + historique) après « Actualiser les données marché » ou « Actualiser la bibliothèque », relu au
          changement d’onglet ou au rechargement de la page — aucun appel réseau dans cet écran.
        </div>

        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Rechercher nom, ticker, ISIN, émetteur, catégorie, rôle ou classe d’actif"
        />
        <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
          <select
            className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700"
            value={assetClassFilter}
            onChange={(e) => setAssetClassFilter(e.target.value as MarketAssetClass | typeof ALL_FILTER)}
          >
            <option value={ALL_FILTER}>Toutes classes</option>
            {(['ETF_ACTION', 'ETF_OBLIGATAIRE', 'ETC_OR', 'ETN_CRYPTO', 'SCPI', 'PRIVATE_EQUITY', 'FONDS_DATE'] as const).map((value) => (
              <option key={value} value={value}>
                {assetClassLabel(value)}
              </option>
            ))}
          </select>
          <select
            className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as EtfCategory | typeof ALL_FILTER)}
          >
            <option value={ALL_FILTER}>Toutes catégories</option>
            {(['WORLD', 'SP500', 'NASDAQ', 'EUROPE', 'EMERGENTS', 'OBLIGATIONS', 'OR', 'CRYPTO', 'SECTORIEL'] as const).map((value) => (
              <option key={value} value={value}>
                {categoryLabel(value)}
              </option>
            ))}
          </select>
          <select
            className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700"
            value={envelopeFilter}
            onChange={(e) => setEnvelopeFilter(e.target.value as EtfEnvelope | typeof ALL_FILTER)}
          >
            <option value={ALL_FILTER}>Toutes enveloppes</option>
            {(['PEA', 'CTO', 'ASSURANCE_VIE', 'AUTRE'] as const).map((value) => (
              <option key={value} value={value}>
                {envelopeLabel(value)}
              </option>
            ))}
          </select>
          <select
            className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as EtfPortfolioRole | typeof ALL_FILTER)}
          >
            <option value={ALL_FILTER}>Tous rôles</option>
            {(['PILIER', 'DIVERSIFICATION', 'SATELLITE', 'SPECULATIF'] as const).map((value) => (
              <option key={value} value={value}>
                {roleLabel(value)}
              </option>
            ))}
          </select>
        </div>

        {comparedRows.length > 0 && (
          <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">Comparaison rapide</p>
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
              {comparedWithStats.map(({ item, quality, stats }) => {
                const snap = snapshotsByNormTicker[normalizeMarketStorageSymbol(item.ticker)] ?? null;
                return (
                  <div key={item.id} className="rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm">
                    <p className="font-semibold text-slate-900">{item.name}</p>
                    <p className="text-xs text-slate-600">
                      {item.ticker} • TER {item.totalExpenseRatioPct.toFixed(2)}% • Encours {item.aumBillionEur.toFixed(1)} Md€
                    </p>
                    <p className="text-xs text-slate-600">
                      Volatilité {item.volatilityPct.toFixed(1)}% • Rôle {roleLabel(item.portfolioRole)}
                    </p>
                    {snap ? (
                      <p className="mt-1.5 text-base font-semibold tabular-nums text-slate-900">
                        Prix actuel : {formatPriceCurrent(snap.currentPrice, currency)}
                      </p>
                    ) : (
                      <p className="mt-1.5 text-xs font-medium text-amber-800/90">
                        Snapshot local absent pour {item.ticker} — actualisez les données marché.
                      </p>
                    )}
                    <p className="mt-1 text-sm font-semibold text-violet-700">Score qualité : {quality.score}/100</p>
                    {stats ? (
                      <p className="text-xs text-slate-600">
                        Perf {stats.performancePct >= 0 ? '+' : ''}{stats.performancePct.toFixed(1)}% • Plus haut {formatCurrency(stats.max, currency)} • Plus bas {formatCurrency(stats.min, currency)} • Drawdown max {stats.maxDrawdownPct.toFixed(1)}%
                      </p>
                    ) : (
                      <p className="text-xs font-medium text-amber-800/90">
                        Historique local absent pour {item.ticker} (période {athPeriod}).
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            {comparedWithStats.length === 2 && (() => {
              const left = comparedWithStats[0];
              const right = comparedWithStats[1];
              if (!left || !right) return null;
              const leftHistOk = (left.history?.length ?? 0) >= MIN_HISTORY_POINTS_FOR_CHART;
              const rightHistOk = (right.history?.length ?? 0) >= MIN_HISTORY_POINTS_FOR_CHART;
              const bothCurvesOk = leftHistOk && rightHistOk && compareChartData.length > 1;
              return (
                <div className="mt-3 rounded-lg border border-violet-200 bg-white p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Performance normalisée (base 100)</p>
                  {bothCurvesOk ? (
                    <div className="h-44">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={compareChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} width={36} />
                          <Tooltip />
                          <Line type="monotone" dataKey="left" name={left.item.ticker} dot={false} stroke="#4f46e5" strokeWidth={2} isAnimationActive={false} />
                          <Line type="monotone" dataKey="right" name={right.item.ticker} dot={false} stroke="#0ea5e9" strokeWidth={2} isAnimationActive={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <ul className="list-inside list-disc space-y-1 text-xs font-medium text-amber-900/90">
                      {!leftHistOk && (
                        <li>Historique local absent pour {left.item.ticker} (période {athPeriod}).</li>
                      )}
                      {!rightHistOk && (
                        <li>Historique local absent pour {right.item.ticker} (période {athPeriod}).</li>
                      )}
                      {leftHistOk && rightHistOk && compareChartData.length <= 1 && (
                        <li>Données de comparaison insuffisantes pour tracer les deux courbes sur la période commune.</li>
                      )}
                    </ul>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-[980px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">ETF</th>
                <th className="px-3 py-2">Catégorie</th>
                <th className="px-3 py-2">Enveloppes</th>
                <th className="px-3 py-2">Rôle</th>
                <th className="px-3 py-2">Score</th>
                <th className="px-3 py-2">Métriques</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.map((item) => {
                const score: EtfQualityScoreResult = computeEtfQualityScore(item);
                const tracked = isTrackedEtf(item, trackedSymbol);
                const trackable = isTrackableMarketAsset(item.assetClass);
                const rowSnap = organizationId ? snapshotsByNormTicker[normalizeMarketStorageSymbol(item.ticker)] ?? null : null;
                return (
                  <tr key={item.id} className={tracked ? 'bg-emerald-50/40' : ''}>
                    <td className="px-3 py-2 align-top">
                      <p className="font-medium text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-600">{item.ticker} • ISIN {item.isin}</p>
                      {rowSnap ? (
                        <p className="mt-1 text-sm font-semibold tabular-nums text-emerald-800">
                          Prix actuel : {formatPriceCurrent(rowSnap.currentPrice, currency)}
                        </p>
                      ) : trackable ? (
                        <p className="mt-1 text-[11px] text-slate-500">Pas de snapshot local — actualiser les données marché.</p>
                      ) : null}
                      <p className="text-xs text-slate-600">{assetClassLabel(item.assetClass)}</p>
                      <p className="text-xs text-slate-500">{item.issuer}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.shortComment}</p>
                    </td>
                    <td className="px-3 py-2 align-top text-slate-700">{categoryLabel(item.category)}</td>
                    <td className="px-3 py-2 align-top text-slate-700">{item.eligibleEnvelopes.map(envelopeLabel).join(', ')}</td>
                    <td className="px-3 py-2 align-top">
                      <Badge size="sm" variant={item.portfolioRole === 'PILIER' ? 'success' : item.portfolioRole === 'SPECULATIF' ? 'danger' : 'secondary'}>
                        {roleLabel(item.portfolioRole)}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <Badge size="sm" variant={scoreVariant(score.score)}>{score.score}/100</Badge>
                      <p className="text-xs text-slate-500">Frais {score.breakdown.fees} • Encours {score.breakdown.aum}</p>
                    </td>
                    <td className="px-3 py-2 align-top text-xs text-slate-600">
                      TER {item.totalExpenseRatioPct.toFixed(2)}%<br />
                      Encours {item.aumBillionEur.toFixed(1)} Md€<br />
                      Volatilité {item.volatilityPct.toFixed(1)}%<br />
                      Ancienneté {Math.max(0, new Date().getFullYear() - item.inceptionYear)} ans
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="flex flex-col gap-1.5">
                        <Button size="sm" variant={compareIds.includes(item.id) ? 'primary' : 'outline'} onClick={() => toggleCompare(item.id)}>
                          Comparer
                        </Button>
                        <Button
                          size="sm"
                          variant={tracked ? 'soft' : 'outline'}
                          disabled={tracked || !trackable || isApplyingTicker === item.ticker}
                          onClick={() => handleSetTracked(item)}
                        >
                          {tracked
                            ? 'Actif suivi'
                            : !trackable
                              ? 'Non suivi dans moteur marché'
                              : isApplyingTicker === item.ticker
                                ? 'Application...'
                                : 'Définir comme actif principal'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredRows.length === 0 && (
                <tr>
                  <td className="px-3 py-6 text-center text-sm text-slate-500" colSpan={7}>
                    Aucun ETF ne correspond aux filtres sélectionnés.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
