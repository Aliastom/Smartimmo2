'use client';

/* eslint-disable @typescript-eslint/naming-convention -- composants React locaux (PascalCase) */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PatrimoineApplyDcaButton } from '@/features/patrimoine/components/PatrimoineApplyDcaButton';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { formatCurrencyEUR } from '@/utils/format';
import { cn } from '@/utils/cn';
import type { PatrimoineSnapshotResult } from '@/features/patrimoine/hooks/usePatrimoineSnapshot';
import {
  readPatrimoineFollowUpFlag,
  writePatrimoineFollowUpFlag,
} from '@/features/patrimoine/store/patrimoineSettings';
import { buildPatrimoineRecommendationTrace } from '@/features/patrimoine/services/patrimoineRecommendationTrace';
import { CalendarClock, ChevronDown, HelpCircle, Sparkles } from 'lucide-react';

const COLORS = {
  immo: '#059669',
  etf: '#7c3aed',
  cash: '#d97706',
};

export interface PatrimoineV4OverviewProps {
  snapshot: PatrimoineSnapshotResult;
  organizationId: string | undefined;
  className?: string;
}

function trendLabel(
  trend: PatrimoineSnapshotResult['projectionTrend'],
  delta: number
): { label: string; className: string } {
  const safeDelta = Number.isFinite(delta) && Math.abs(delta) < 1e9 ? delta : 0;
  const pct = (safeDelta * 100).toFixed(1);
  if (trend === 'croissance') {
    return { label: `+${pct} % (5 ans)`, className: 'bg-emerald-100/90 text-emerald-900 ring-1 ring-emerald-200/60' };
  }
  if (trend === 'degradation') {
    return { label: `${pct} % (5 ans)`, className: 'bg-orange-100/90 text-orange-950 ring-1 ring-orange-200/60' };
  }
  return { label: `≈ ${pct} % (5 ans)`, className: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200/80' };
}

export interface PatrimoineV4HeroProps {
  snapshot: PatrimoineSnapshotResult;
  className?: string;
}

/** Bandeau Hero : patrimoine net + phrase synthèse + capacité locative. */
export function PatrimoineV4Hero({ snapshot, className }: PatrimoineV4HeroProps) {
  const reco = snapshot.patrimoineReco;
  const trend = trendLabel(snapshot.projectionTrend, snapshot.projectionPatrimoineDeltaRatio);
  return (
    <div
      className={cn(
        'rounded-xl border border-slate-200/90 bg-white px-3 py-2 shadow-sm sm:px-3 sm:py-2.5',
        className
      )}
    >
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between lg:gap-4">
        <div className="min-w-0 flex-1 overflow-hidden">
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500 sm:text-[11px]">
            Patrimoine net global
          </p>
          <p className="mt-0.5 text-lg font-semibold tracking-tight text-slate-900 sm:text-xl lg:text-2xl">
            {Number.isFinite(snapshot.patrimoineNetGlobal)
              ? formatCurrencyEUR(snapshot.patrimoineNetGlobal)
              : '—'}
          </p>
          <p
            className="mt-1 text-xs leading-snug text-slate-600 line-clamp-2 lg:line-clamp-1 lg:text-sm"
            title={reco.message}
          >
            {reco.message}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 text-right lg:pt-0.5">
          <span
            className={cn(
              'inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-[10px] font-semibold sm:text-[11px]',
              trend.className
            )}
          >
            {trend.label}
          </span>
          <div>
            <p className="text-[10px] text-slate-500 sm:text-xs">Capacité locative / mois</p>
            <p className="text-xs font-semibold tabular-nums text-slate-800 sm:text-sm">
              {snapshot.hasFiscalSimulation ? formatCurrencyEUR(snapshot.monthlyCapacity) : '—'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** KPI + répartition + reco + 3 actions (sans Hero ni badges). */
export function PatrimoineV4OverviewMain({
  snapshot,
  organizationId,
  className,
}: PatrimoineV4OverviewProps) {
  const reco = snapshot.patrimoineReco;
  const rawDca = Number.isFinite(reco.dcaAmount) ? reco.dcaAmount : snapshot.dcaRecommended;
  const dcaAmountEuros = Math.max(0, Number.isFinite(rawDca) ? rawDca : 0);
  const hasMarketProfile = snapshot.selectedMarketInvestmentId != null;
  const incomeYieldPct =
    snapshot.patrimoineNetGlobal > 0
      ? (snapshot.revenuGlobalEstime / snapshot.patrimoineNetGlobal) * 100
      : 0;
  const incomeYieldSafe = Number.isFinite(incomeYieldPct) ? incomeYieldPct : 0;

  const donutData = useMemo(() => {
    const immo = Math.max(0, snapshot.immobilierNet);
    const etf = Math.max(0, snapshot.peaEtfValue);
    const cash = Math.max(0, snapshot.cashDisponible);
    const total = immo + etf + cash;
    if (total <= 0) return [] as { name: string; value: number; raw: number }[];
    return [
      { name: 'Immobilier net', value: immo, raw: immo },
      { name: 'ETF / PEA', value: etf, raw: etf },
      { name: 'Cash', value: cash, raw: cash },
    ];
  }, [snapshot.immobilierNet, snapshot.peaEtfValue, snapshot.cashDisponible]);

  const topActions = snapshot.priorityActions.slice(0, 3);

  const donutLegend = useMemo(() => {
    const immo = Math.max(0, snapshot.immobilierNet);
    const etf = Math.max(0, snapshot.peaEtfValue);
    const cash = Math.max(0, snapshot.cashDisponible);
    const total = immo + etf + cash;
    if (total <= 0) return [] as { key: string; short: string; pct: number; color: string }[];
    return [
      { key: 'immo', short: 'Immo', pct: Math.round((immo / total) * 1000) / 10, color: COLORS.immo },
      { key: 'etf', short: 'ETF', pct: Math.round((etf / total) * 1000) / 10, color: COLORS.etf },
      { key: 'cash', short: 'Cash', pct: Math.round((cash / total) * 1000) / 10, color: COLORS.cash },
    ];
  }, [snapshot.immobilierNet, snapshot.peaEtfValue, snapshot.cashDisponible]);

  return (
    <div className={cn('space-y-3', className)}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          label="Immobilier net"
          value={snapshot.immobilierNet}
          sub="Brut − dette"
          tone="slate"
        />
        <KpiTile
          label="ETF / PEA"
          value={snapshot.peaEtfValue}
          sub={`~${(snapshot.rendementEtfAnnuel * 100).toFixed(0)} % / an`}
          tone="violet"
        />
        <KpiTile
          label="Cash disponible"
          value={snapshot.cashDisponible}
          sub={`Excédent : ${formatCurrencyEUR(snapshot.cashExcess)}`}
          tone="amber"
        />
        <KpiTile
          label="Revenus nets annuels"
          value={snapshot.revenuGlobalEstime}
          sub={`~${incomeYieldSafe.toFixed(1)} % / an`}
          tone="emerald"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:items-stretch lg:gap-3">
        <section className="flex min-h-0 max-w-full flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white p-2.5 shadow-sm sm:p-3">
          <h2 className="text-xs font-semibold text-slate-900 sm:text-sm">Répartition</h2>
          <div className="mt-1 h-32 min-h-0 w-full max-w-full sm:h-36 lg:h-40">
            {donutData.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-lg bg-slate-50 text-[11px] text-slate-500">
                Données insuffisantes
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
                  <Pie
                    data={donutData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={28}
                    outerRadius={44}
                    paddingAngle={2}
                  >
                    {donutData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={
                          entry.name.includes('Immobilier') ? COLORS.immo : entry.name.includes('ETF') ? COLORS.etf : COLORS.cash
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, _n: string, item: { payload?: { raw?: number; name?: string } }) => [
                      formatCurrencyEUR(item?.payload?.raw ?? value),
                      item?.payload?.name ?? '',
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          {donutLegend.length > 0 && (
            <p className="mt-1.5 flex flex-wrap items-center justify-center gap-x-1 text-[10px] tabular-nums text-slate-600 sm:justify-start sm:gap-x-2 sm:text-[11px]">
              {donutLegend.map((item, i) => (
                <span key={item.key} className="inline-flex max-w-full items-center gap-1 whitespace-nowrap">
                  {i > 0 && <span className="text-slate-300" aria-hidden>
                    ·
                  </span>}
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full sm:h-2 sm:w-2" style={{ backgroundColor: item.color }} aria-hidden />
                  <span>{item.short}</span>
                  <span className="font-medium text-slate-800">{item.pct}%</span>
                </span>
              ))}
            </p>
          )}
        </section>

        <section className="flex min-h-0 max-w-full flex-col rounded-xl border border-slate-200/90 bg-white p-2.5 shadow-sm sm:p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-indigo-600 sm:h-4 sm:w-4" aria-hidden />
              <h2 className="text-xs font-semibold text-slate-900 sm:text-sm">Recommandation</h2>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                  reco.level === 'OPPORTUNITY' && 'bg-emerald-100 text-emerald-900',
                  reco.level === 'INFO' && 'bg-indigo-100 text-indigo-900',
                  reco.level === 'WARNING' && 'bg-orange-100 text-orange-950'
                )}
              >
                {reco.primaryAction}
              </span>
            </div>
            <div className="flex w-full shrink-0 sm:w-auto sm:justify-end">
              <PatrimoineApplyDcaButton
                organizationId={organizationId}
                amountEuros={dcaAmountEuros}
                compact
                showLastActionHint={false}
                hasMarketProfile={hasMarketProfile}
                className="w-full min-w-0 sm:w-auto"
              />
            </div>
          </div>
          <p className="mt-1.5 text-xs font-medium text-slate-800 line-clamp-2 sm:line-clamp-3 sm:text-sm" title={reco.message}>
            {reco.message}
          </p>
          <ol className="mt-2 flex min-h-[5.5rem] flex-col justify-start gap-1.5 sm:min-h-[6rem]">
            {topActions.map((a) => (
              <li
                key={`${a.type}-${a.priority}`}
                className="flex min-h-0 items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-2 py-1.5 text-xs sm:text-sm"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
                  {a.priority}
                </span>
                <span className="min-w-0 flex-1 truncate text-slate-800">{a.label}</span>
                <span className="w-[4.5rem] shrink-0 text-right text-[11px] font-semibold tabular-nums text-slate-700 sm:w-[5rem] sm:text-xs">
                  {a.amount != null && a.amount > 0 ? formatCurrencyEUR(a.amount) : '—'}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}

export interface PatrimoineDecisionCockpitProps {
  organizationId: string | undefined;
  snapshot: PatrimoineSnapshotResult;
  className?: string;
}

function formatIsoShort(iso: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return '—';
  }
}

export function PatrimoineDecisionCockpit({
  organizationId,
  snapshot,
  className,
}: PatrimoineDecisionCockpitProps) {
  const [followUp, setFollowUp] = useState(false);

  useEffect(() => {
    setFollowUp(readPatrimoineFollowUpFlag(organizationId));
  }, [organizationId]);

  const reco = snapshot.patrimoineReco;
  const rawDcaMain = Number.isFinite(reco.dcaAmount) ? reco.dcaAmount : snapshot.dcaRecommended;
  const dcaAmountEuros = Math.max(0, Number.isFinite(rawDcaMain) ? rawDcaMain : 0);
  const hasMarketProfile = snapshot.selectedMarketInvestmentId != null;

  const recommendationTrace = useMemo(() => buildPatrimoineRecommendationTrace(snapshot), [snapshot]);

  const toggleFollowUp = useCallback(() => {
    if (!organizationId) return;
    const next = !followUp;
    setFollowUp(next);
    writePatrimoineFollowUpFlag(organizationId, next);
  }, [organizationId, followUp]);

  return (
    <div className={cn('space-y-3', className)}>
      {/* Timeline compacte */}
      <section className="rounded-xl border border-slate-200/90 bg-white p-2.5 shadow-sm sm:p-3">
        <div className="mb-1.5 flex items-center gap-2">
          <CalendarClock className="h-3.5 w-3.5 text-indigo-600 sm:h-4 sm:w-4" aria-hidden />
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 sm:text-xs">Échéances</h3>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[11px] sm:gap-2 sm:text-xs">
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 ring-1 ring-slate-200/80">
            <span className="text-slate-500">DCA</span>
            <span className="font-semibold text-slate-900">{formatIsoShort(snapshot.nextEvents.nextDcaDate)}</span>
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 ring-1 ring-slate-200/80">
            <span className="text-slate-500">Impôt</span>
            <span className="font-semibold text-slate-900">{formatIsoShort(snapshot.nextEvents.nextTaxPayment)}</span>
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 ring-1 ring-slate-200/80">
            <span className="text-slate-500">Prêt</span>
            <span className="font-semibold text-slate-900">{formatIsoShort(snapshot.nextEvents.nextLoanPayment)}</span>
          </span>
        </div>
      </section>

      {/* Traçabilité reco */}
      <details className="group rounded-xl border border-slate-200/90 bg-slate-50/40 shadow-sm">
        <summary
          className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 sm:px-3.5"
          aria-label="Afficher les sources de la recommandation : cash investissable, marché, fiscalité, allocation ETF"
        >
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-500 transition group-open:rotate-180" aria-hidden />
          <HelpCircle className="h-3.5 w-3.5 shrink-0 text-indigo-600 sm:h-4 sm:w-4" aria-hidden />
          <span className="text-xs font-semibold text-slate-900 sm:text-sm">Pourquoi cette recommandation ?</span>
        </summary>
        <div className="border-t border-slate-100 px-3 pb-2.5 pt-1.5 sm:px-3.5">
          <ul className="space-y-1.5">
            {recommendationTrace.slice(0, 4).map((row) => (
              <li key={row.label} className="rounded-lg bg-white/90 px-2.5 py-1.5 ring-1 ring-slate-100">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-xs font-medium text-slate-800 sm:text-sm">{row.label}</span>
                  <span className="text-xs font-semibold tabular-nums text-slate-900 sm:text-sm">{row.value}</span>
                </div>
                <p className="mt-0.5 text-[10px] text-slate-500">{row.source}</p>
              </li>
            ))}
          </ul>
        </div>
      </details>

      {/* Suivi local */}
      <details className="group rounded-xl border border-slate-200/90 bg-slate-50/50 shadow-sm">
        <summary
          className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-900 sm:px-3.5 sm:text-sm"
          aria-label="Suivi local : préférence enregistrée sur cet appareil"
        >
          <ChevronDown className="h-4 w-4 shrink-0 transition group-open:rotate-180" aria-hidden />
          Suivi local
        </summary>
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200/80 px-3 pb-2.5 pt-2 sm:gap-3 sm:px-3.5 sm:pb-3">
          <button
            type="button"
            role="switch"
            aria-checked={followUp}
            aria-label={followUp ? 'Désactiver le suivi local patrimoine' : 'Activer le suivi local patrimoine'}
            title={followUp ? 'Suivi local actif' : 'Suivi local inactif'}
            onClick={() => toggleFollowUp()}
            className={cn(
              'relative inline-flex h-8 w-12 shrink-0 rounded-full border transition-colors',
              followUp ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300 bg-slate-200'
            )}
          >
            <span
              className={cn(
                'pointer-events-none inline-block h-6 w-6 mt-0.5 ml-0.5 rounded-full bg-white shadow transition-transform',
                followUp ? 'translate-x-4' : 'translate-x-0'
              )}
            />
          </button>
          <span className="text-[11px] font-medium text-slate-700 sm:text-xs">Suivi actif</span>
          <div className="ml-auto flex w-full min-w-0 flex-col items-stretch gap-0.5 sm:w-auto sm:items-end">
            <PatrimoineApplyDcaButton
              organizationId={organizationId}
              amountEuros={dcaAmountEuros}
              compact
              showLastActionHint={false}
              hasMarketProfile={hasMarketProfile}
              className="w-full sm:w-auto"
            />
            <p className="text-[10px] text-slate-500 sm:text-right">Hypothèses : voir le bloc repliable ci-dessous.</p>
          </div>
        </div>
      </details>
    </div>
  );
}

function KpiTile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: number;
  sub: string;
  tone: 'slate' | 'violet' | 'amber' | 'emerald';
}) {
  const ring =
    tone === 'emerald'
      ? 'border-emerald-200/70 bg-emerald-50/40'
      : tone === 'violet'
        ? 'border-violet-200/70 bg-violet-50/40'
        : tone === 'amber'
          ? 'border-amber-200/70 bg-amber-50/40'
          : 'border-slate-200/90 bg-white';
  return (
    <div className={cn('rounded-lg border px-2 py-2 shadow-sm sm:px-2.5', ring)}>
      <p className="truncate text-[10px] font-medium text-slate-600 sm:text-[11px]" title={label}>
        {label}
      </p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums tracking-tight text-slate-900 sm:text-base lg:text-lg">
        {Number.isFinite(value) ? formatCurrencyEUR(value) : '—'}
      </p>
      <p className="mt-0.5 truncate text-[9px] text-slate-500 sm:text-[10px]" title={sub}>
        {sub}
      </p>
    </div>
  );
}
