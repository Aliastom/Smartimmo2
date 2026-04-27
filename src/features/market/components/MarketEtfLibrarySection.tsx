'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import {
  ETF_LIBRARY,
  categoryLabel,
  computeEtfQualityScore,
  envelopeLabel,
  isTrackedEtf,
  roleLabel,
  type EtfCategory,
  type EtfEnvelope,
  type EtfLibraryItem,
  type EtfPortfolioRole,
} from '@/features/market/services/etfLibrary';

interface MarketEtfLibrarySectionProps {
  trackedSymbol: string;
  onSetTrackedEtf: (item: EtfLibraryItem) => Promise<void>;
}

const ALL_FILTER = 'ALL';

export function MarketEtfLibrarySection({ trackedSymbol, onSetTrackedEtf }: MarketEtfLibrarySectionProps) {
  const [categoryFilter, setCategoryFilter] = useState<EtfCategory | typeof ALL_FILTER>(ALL_FILTER);
  const [envelopeFilter, setEnvelopeFilter] = useState<EtfEnvelope | typeof ALL_FILTER>(ALL_FILTER);
  const [roleFilter, setRoleFilter] = useState<EtfPortfolioRole | typeof ALL_FILTER>(ALL_FILTER);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [isApplyingTicker, setIsApplyingTicker] = useState<string | null>(null);

  const filteredRows = useMemo(() => {
    return ETF_LIBRARY.filter((item) => {
      if (categoryFilter !== ALL_FILTER && item.category !== categoryFilter) return false;
      if (envelopeFilter !== ALL_FILTER && !item.eligibleEnvelopes.includes(envelopeFilter)) return false;
      if (roleFilter !== ALL_FILTER && item.portfolioRole !== roleFilter) return false;
      return true;
    });
  }, [categoryFilter, envelopeFilter, roleFilter]);

  const comparedRows = useMemo(
    () => ETF_LIBRARY.filter((item) => compareIds.includes(item.id)),
    [compareIds]
  );

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
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Bibliothèque ETF</p>
            <p className="text-sm font-medium text-slate-900">Comparatif interne local-first pour enrichir le suivi marché.</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            ETF suivi actuel : <span className="font-semibold text-slate-900">{trackedSymbol}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
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
              {comparedRows.map((item) => {
                const score = computeEtfQualityScore(item);
                return (
                  <div key={item.id} className="rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm">
                    <p className="font-semibold text-slate-900">{item.name}</p>
                    <p className="text-xs text-slate-600">
                      {item.ticker} • TER {item.totalExpenseRatioPct.toFixed(2)}% • Encours {item.aumBillionEur.toFixed(1)} Md€
                    </p>
                    <p className="text-xs text-slate-600">
                      Volatilité {item.volatilityPct.toFixed(1)}% • Rôle {roleLabel(item.portfolioRole)}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-violet-700">Score qualité : {score.score}/100</p>
                  </div>
                );
              })}
            </div>
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
                const score = computeEtfQualityScore(item);
                const tracked = isTrackedEtf(item, trackedSymbol);
                return (
                  <tr key={item.id} className={tracked ? 'bg-emerald-50/40' : ''}>
                    <td className="px-3 py-2 align-top">
                      <p className="font-medium text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-600">{item.ticker} • ISIN {item.isin}</p>
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
                      <p className="font-semibold text-slate-900">{score.score}/100</p>
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
                          disabled={tracked || isApplyingTicker === item.ticker}
                          onClick={() => handleSetTracked(item)}
                        >
                          {tracked ? 'ETF suivi' : isApplyingTicker === item.ticker ? 'Application...' : 'Définir comme ETF suivi'}
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
