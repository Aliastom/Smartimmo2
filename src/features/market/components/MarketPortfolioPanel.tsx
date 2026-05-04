'use client';

import { useEffect, useMemo, useState } from 'react';
import { Accordion } from '@/components/ui/Accordion';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import type { usePortfolioTracker } from '@/features/market/hooks/usePortfolioTracker';
import type { PortfolioAccountKind, PortfolioPriceStatus } from '@/features/market/portfolio/portfolioTypes';
import { MarketOrderModal, type MarketOrderModalMode } from '@/features/market/components/MarketOrderModal';
import { MarketPortfolioSnapshotChart } from '@/features/market/components/MarketPortfolioSnapshotChart';
import { PortfolioAccountsPanel } from '@/features/market/components/PortfolioAccountsPanel';
import { PortfolioActionsBar } from '@/features/market/components/PortfolioActionsBar';
import { PortfolioEmptyState } from '@/features/market/components/PortfolioEmptyState';
import { PortfolioHero } from '@/features/market/components/PortfolioHero';
import { PortfolioKpiStrip } from '@/features/market/components/PortfolioKpiStrip';
import { usePortfolioDefaultAccount } from '@/features/market/hooks/usePortfolioDefaultAccount';
import { PORTFOLIO_PRICE_FRESH_MAX_MS } from '@/features/market/portfolio/portfolioLedgerEngine';
import { cn } from '@/utils/cn';

type PortfolioHook = ReturnType<typeof usePortfolioTracker>;

function formatCurrency(value: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
}

function formatPct(value: number): string {
  return `${value.toFixed(2)} %`;
}

function priceStatusLabel(s: PortfolioPriceStatus): string {
  if (s === 'fresh') return 'Frais';
  if (s === 'stale') return 'Ancien';
  return 'Manquant';
}

function formatPriceDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

interface MarketPortfolioPanelProps {
  portfolio: PortfolioHook;
  defaultCurrency: string;
  organizationId: string;
  /** Ex. navigation vers import CSV — sinon le bouton « Importer » reste désactivé */
  onImportData?: () => void;
}

export function MarketPortfolioPanel({
  portfolio,
  defaultCurrency,
  organizationId,
  onImportData,
}: MarketPortfolioPanelProps) {
  const [filterType, setFilterType] = useState<string>('all');
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountKind, setNewAccountKind] = useState<PortfolioAccountKind>('PEA');
  const [saving, setSaving] = useState(false);
  const [orderModal, setOrderModal] = useState<{
    open: boolean;
    mode: MarketOrderModalMode;
    initialAccountId?: string;
  }>({
    open: false,
    mode: 'BUY',
  });

  const accountIds = useMemo(() => portfolio.accounts.map((a) => a.id), [portfolio.accounts]);
  const { defaultAccountId, setDefaultAccountId } = usePortfolioDefaultAccount(organizationId, accountIds);

  const openPositionLineCount = useMemo(
    () => portfolio.positions.filter((p) => p.quantity > 1e-9).length,
    [portfolio.positions]
  );

  const filteredOrders = useMemo(() => {
    if (filterType === 'all') return portfolio.orders;
    return portfolio.orders.filter((o) => o.type === filterType);
  }, [filterType, portfolio.orders]);

  useEffect(() => {
    if (!organizationId || portfolio.loading) return;
    void portfolio.maybeCaptureDailySnapshot();
  }, [organizationId, portfolio.loading, portfolio.maybeCaptureDailySnapshot]);

  const createAccount = async () => {
    if (!organizationId) return;
    const name = newAccountName.trim() || 'Mon compte';
    setSaving(true);
    try {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      await portfolio.saveAccount({
        id,
        organizationId,
        name,
        kind: newAccountKind,
        currency: defaultCurrency,
        createdAt: now,
        updatedAt: now,
      });
      setNewAccountName('');
      await portfolio.reload();
    } finally {
      setSaving(false);
    }
  };

  const alerts =
    portfolio.globalWarnings.length +
    portfolio.positions.reduce((n, p) => n + p.warnings.length, 0);

  const bruteCheck = useMemo(() => {
    const t = portfolio.totals;
    const sumParts = t.totalUnrealizedPnL + t.totalRealizedPnL + t.totalDividendsNet;
    const delta = Math.abs(sumParts - t.grossPerformanceEuro);
    return { sumParts, delta, ok: delta < 0.02 };
  }, [portfolio.totals]);

  const vc = portfolio.totals.valuationCoverage;

  const sortedPositions = useMemo(() => {
    return [...portfolio.positions].sort((a, b) => {
      const va = a.marketValue ?? 0;
      const vb = b.marketValue ?? 0;
      return vb - va;
    });
  }, [portfolio.positions]);

  const pnlToneEuro = (v: number | null | undefined) =>
    v == null ? 'text-slate-500' : v > 0 ? 'text-emerald-700' : v < 0 ? 'text-rose-700' : 'text-slate-600';
  const pnlTonePct = (v: number | null | undefined) =>
    v == null ? 'text-slate-500' : v > 0 ? 'text-emerald-700' : v < 0 ? 'text-rose-700' : 'text-slate-600';

  return (
    <div className="space-y-6 md:space-y-8">
      {portfolio.globalWarnings.length > 0 && (
        <Card className="rounded-2xl border-amber-300 bg-amber-50 shadow-sm">
          <CardContent className="py-2.5 text-[11px] text-amber-950">
            <p className="font-semibold">Alertes portefeuille (moteur)</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              {portfolio.globalWarnings.map((w, i) => (
                <li key={i}>{w.message}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <PortfolioActionsBar
        onAddOrder={() => setOrderModal({ open: true, mode: 'BUY' })}
        onCaptureSnapshot={() => void portfolio.captureSnapshot()}
        snapshotting={portfolio.snapshotting}
        lastSnapshotCapturedAt={portfolio.lastSnapshotCapturedAt}
        disabled={!organizationId}
      />

      <PortfolioHero
        totals={portfolio.totals}
        currency={defaultCurrency}
        loading={portfolio.loading}
        accountCount={portfolio.accounts.length}
        openPositionLineCount={openPositionLineCount}
      />

      <PortfolioAccountsPanel
        portfolio={portfolio}
        currency={defaultCurrency}
        organizationId={organizationId}
        loading={portfolio.loading}
        defaultAccountId={defaultAccountId}
        onSetDefaultAccount={setDefaultAccountId}
        onAddOrder={({ accountId, mode }) =>
          setOrderModal({ open: true, mode, initialAccountId: accountId })
        }
        onCreateAccountRequest={() => undefined}
      />

      <PortfolioKpiStrip
        totals={portfolio.totals}
        fiscalEstimateEuro={portfolio.fiscalEstimate.totalTaxEstimateEuro}
        surplusInflationEuro={portfolio.surplusInflationEuro}
        currency={defaultCurrency}
        loading={portfolio.loading}
      />

      {portfolio.positions.length === 0 && !portfolio.loading ? (
        <PortfolioEmptyState
          onAddFirstOrder={() => setOrderModal({ open: true, mode: 'BUY' })}
          onImportData={onImportData}
          disabled={!organizationId}
        />
      ) : null}

      <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
        <CardContent className="space-y-4 p-5 md:p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Évolution (instantanés)</p>
            <p className="mt-1 text-[11px] text-slate-500">
              Historique figé au moment T — {portfolio.snapshots.length} point{portfolio.snapshots.length !== 1 ? 's' : ''}
            </p>
          </div>
          {portfolio.snapshots.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-12 text-center">
              <p className="text-sm font-medium text-slate-700">Commencez à suivre votre performance</p>
              <p className="mt-1 max-w-sm text-xs text-slate-500">
                Un instantané enregistre la valorisation et les indicateurs du moment (même logique que le tableau ci-dessus).
              </p>
              <Button
                type="button"
                variant="primary"
                className="mt-6"
                disabled={portfolio.snapshotting || !organizationId}
                onClick={() => void portfolio.captureSnapshot()}
              >
                {portfolio.snapshotting ? 'Enregistrement…' : 'Capturer le premier instantané'}
              </Button>
            </div>
          ) : (
            <MarketPortfolioSnapshotChart snapshots={portfolio.snapshots} currency={defaultCurrency} />
          )}
        </CardContent>
      </Card>

      <Accordion title="Comprendre les calculs" defaultOpen={false} className="rounded-2xl shadow-sm">
        <div className="space-y-5 px-4 py-4 text-[11px] leading-relaxed text-slate-700">
          <section>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Hypothèses (estimations)</p>
              {alerts > 0 ? (
                <Badge variant="warning" size="sm">
                  {alerts} alerte(s) portefeuille
                </Badge>
              ) : (
                <Badge variant="secondary" size="sm">
                  aucune alerte
                </Badge>
              )}
            </div>
            <ul className="list-inside list-disc space-y-1">
              <li>
                <span className="font-medium">Fiscalité</span> : estimations uniquement — PFU type CTO{' '}
                <span className="tabular-nums">{(portfolio.fiscalAssumptions.pfuRateOnIncome * 100).toFixed(0)} %</span> sur
                réalisé + dividendes (hypothèse moteur, non officielle) ; PEA : prélèvements sociaux estimés sur gains{' '}
                <span className="tabular-nums">
                  {(portfolio.fiscalAssumptions.peaSocialContributionsOnGainsRate * 100).toFixed(1)} %
                </span>{' '}
                (modèle simplifié — Paramètres investissement).
              </li>
              <li>
                <span className="font-medium">Inflation</span> : taux annuel de référence{' '}
                <span className="tabular-nums">{(portfolio.inflationAnnual * 100).toFixed(1)} %</span> pour le surplus vs capital
                actualisé (non officiel).
              </li>
              <li>
                <span className="font-medium">Enveloppe</span> : barème par type de compte (voir lignes détaillées sous les KPI si
                plusieurs enveloppes).
              </li>
            </ul>
            <p className="mt-2 leading-snug text-slate-500">{portfolio.fiscalEstimate.disclaimer}</p>
          </section>

          <section className="border-t border-slate-100 pt-4 text-amber-950">
            <p className="mb-2 font-semibold text-amber-950">Règle de valorisation</p>
            <p>
              La ligne <span className="font-medium">Valeur actuelle (estimation)</span> additionne uniquement les positions pour
              lesquelles un cours est connu (qté × cours). Les titres sans cours ne sont pas inclus dans ce total : la colonne
              « Valeur » reste vide ; le <span className="font-medium">coût restant (PRU)</span> sert de référence (indicatif) et
              reste dans le total <span className="font-medium">Coût restant</span>. Si le cours date de plus de{' '}
              {PORTFOLIO_PRICE_FRESH_MAX_MS / 3_600_000} h par rapport à maintenant : statut « Ancien » (toujours inclus dans
              la valeur affichée ; signal d’alerte seulement).
            </p>
            <p className="mt-2 border-t border-amber-200/80 pt-2">
              <span className="font-medium">Même ETF sur plusieurs enveloppes</span> : une ligne par couple compte × titre ; les
              totaux ci-dessous additionnent bien chaque enveloppe (pas de fusion automatique du symbole).
            </p>
            <p className="mt-2 border-t border-amber-200/80 pt-2">
              <span className="font-medium">Impact cours sur les KPI</span> : sur{' '}
              <span className="tabular-nums">{vc.openLines}</span> ligne(s) ouverte(s),{' '}
              <span className="tabular-nums">{vc.linesWithMarketPrice}</span> avec cours (
              <span className="tabular-nums">{vc.linesStalePrice}</span> cours « ancien » mais{' '}
              <span className="font-medium">comptés</span> dans valeur et PV latente),{' '}
              <span className="tabular-nums">{vc.linesMissingPrice}</span> sans cours : ces lignes sont exclues de la valeur
              marché et de la PV latente (le coût PRU reste dans « Coût restant ») — total coût des lignes sans cours :{' '}
              {formatCurrency(vc.costBasisOpenWithoutPriceEuro, defaultCurrency)}.
            </p>
          </section>

          <section className="border-t border-slate-100 pt-4 text-slate-800">
            <p className="mb-2 font-semibold text-slate-900">Cohérence des agrégats</p>
            <p>
              <span className="font-medium">Coût restant</span> = somme des PRU résiduels des lignes ouvertes.{' '}
              <span className="font-medium">Valeur actuelle</span> = somme des qté × cours là où un cours existe.{' '}
              <span className="font-medium">PV latente totale</span> = somme des (valeur − coût) sur ces mêmes lignes.{' '}
              <span className="font-medium">PV réalisées</span> et <span className="font-medium">dividendes nets</span> viennent
              de l’historique d’ordres. Contrôle : PV latente + PV réalisées + dividendes nets = performance brute
              {bruteCheck.ok ? (
                <>
                  {' '}
                  (<span className="tabular-nums">{formatCurrency(bruteCheck.sumParts, defaultCurrency)}</span>, écart négligeable
                  d’arrondi).
                </>
              ) : (
                <>
                  {' '}
                  — écart détecté ({formatCurrency(bruteCheck.delta, defaultCurrency)}), signalez un bug.
                </>
              )}
            </p>
          </section>

          <section className="border-t border-slate-100 pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Compléments (KPI étendus)</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-right">
                <p className="text-[10px] font-semibold uppercase text-slate-500">Valeur actuelle (estimation)</p>
                <p className="mt-1 text-xs text-slate-400">cours connus seulement</p>
                <p className="mt-1 text-base font-semibold tabular-nums text-slate-900">
                  {formatCurrency(portfolio.totals.totalMarketValue, defaultCurrency)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-right">
                <p className="text-[10px] font-semibold uppercase text-slate-500">Performance nette fiscale (estimation)</p>
                <p className="mt-1 text-base font-semibold tabular-nums text-slate-900">
                  {formatCurrency(portfolio.performanceNetFiscalEuro, defaultCurrency)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-right sm:col-span-2 lg:col-span-1">
                <p className="text-[10px] font-semibold uppercase text-slate-500">Surplus vs inflation (réf.)</p>
                <p className="mt-1 text-xs text-slate-500">{(portfolio.inflationAnnual * 100).toFixed(1)} % / an</p>
                <p className="mt-1 text-base font-semibold tabular-nums text-slate-900">
                  {formatCurrency(portfolio.surplusInflationEuro, defaultCurrency)}
                </p>
              </div>
            </div>
          </section>
        </div>
      </Accordion>

      <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
        <CardContent className="py-3 space-y-2">
          <p className="text-xs font-semibold text-slate-700">Indicateurs agrégés</p>
          <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2 lg:grid-cols-4">
            <p>Performance brute (hors impôt) : {formatCurrency(portfolio.totals.grossPerformanceEuro, defaultCurrency)}</p>
            <p>Dividendes nets : {formatCurrency(portfolio.totals.totalDividendsNet, defaultCurrency)}</p>
            <p>
              Frais cumulés (informatif, achats déjà dans le PRU) :{' '}
              {formatCurrency(portfolio.totals.totalFees, defaultCurrency)}
            </p>
            <p>Taxes / impôts saisis : {formatCurrency(portfolio.totals.totalTaxes, defaultCurrency)}</p>
            <p>Impôt total estimé : {formatCurrency(portfolio.fiscalEstimate.totalTaxEstimateEuro, defaultCurrency)}</p>
            <p>PV réalisées : {formatCurrency(portfolio.totals.totalRealizedPnL, defaultCurrency)}</p>
          </div>
        </CardContent>
      </Card>

      {portfolio.positions.length > 0 ? (
        <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
          <CardContent className="p-5 md:p-6">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Positions ouvertes</p>
            <p className="mb-4 text-[11px] text-slate-500">
              Tri par valeur estimée (décroissant). Cours / +/- : estimations radar (non clôture officielle).
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] uppercase text-slate-500">
                    <th className="py-2 pr-2">Actif</th>
                    <th className="py-2 pr-2">Enveloppe</th>
                    <th className="py-2 pr-2 text-right">Qté</th>
                    <th className="py-2 pr-2 text-right">PRU</th>
                    <th className="py-2 pr-2 text-right">Cours</th>
                    <th className="py-2 pr-2">Date cours</th>
                    <th className="py-2 pr-2">Statut cours</th>
                    <th className="py-2 pr-2 text-right">Valeur (estim.)</th>
                    <th className="py-2 pr-2 text-right">+/- €</th>
                    <th className="py-2 text-right">+/- %</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPositions.map((row) => (
                    <tr key={`${row.accountId}-${row.assetSymbol}`} className="border-b border-slate-100">
                      <td className="py-2 pr-2 font-medium text-slate-900">
                        {row.assetSymbol}
                        {row.warnings.some((w) => w.code === 'MISSING_PRICE_FOR_VALUATION') && (
                          <Badge className="ml-1" variant="warning" size="sm">
                            prix
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 pr-2 text-slate-700">{row.accountName}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">{row.quantity.toFixed(4)}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">{formatCurrency(row.averageCostPerUnit, defaultCurrency)}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">
                        {row.lastPrice != null ? formatCurrency(row.lastPrice, defaultCurrency) : '—'}
                      </td>
                      <td className="py-2 pr-2 text-[11px] text-slate-600 tabular-nums">
                        {formatPriceDate(row.lastPriceFetchedAt)}
                      </td>
                      <td className="py-2 pr-2">
                        <span className="text-[11px] font-medium text-slate-800">{priceStatusLabel(row.priceStatus)}</span>
                        {row.priceStatus === 'missing' && row.quantity > 0 && (
                          <Badge className="ml-1" variant="secondary" size="sm">
                            excl. valeur
                          </Badge>
                        )}
                        {row.priceStatus === 'stale' && (
                          <Badge className="ml-1" variant="warning" size="sm">
                            TTL
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 pr-2 text-right tabular-nums font-medium">
                        {row.marketValue != null ? formatCurrency(row.marketValue, defaultCurrency) : '—'}
                      </td>
                      <td
                        className={cn(
                          'py-2 pr-2 text-right tabular-nums font-medium',
                          pnlToneEuro(row.unrealizedPnLEuro),
                        )}
                      >
                        {row.unrealizedPnLEuro != null ? formatCurrency(row.unrealizedPnLEuro, defaultCurrency) : '—'}
                      </td>
                      <td className={cn('py-2 text-right tabular-nums font-medium', pnlTonePct(row.unrealizedPnLPct))}>
                        {row.unrealizedPnLPct != null ? formatPct(row.unrealizedPnLPct) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card id="portfolio-create-account" className="rounded-2xl border-slate-200 bg-white shadow-sm scroll-mt-24">
          <CardContent className="space-y-3 p-4 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Créer un compte</p>
            <Input placeholder="Nom du compte" value={newAccountName} onChange={(e) => setNewAccountName(e.target.value)} />
            <select
              className="h-10 w-full min-w-0 rounded-xl border border-violet-200 bg-violet-50 px-3 text-sm font-medium text-violet-800"
              value={newAccountKind}
              onChange={(e) => setNewAccountKind(e.target.value as PortfolioAccountKind)}
            >
              <option value="PEA">PEA</option>
              <option value="CTO">Compte-titres</option>
              <option value="ASSURANCE_VIE">Assurance-vie</option>
              <option value="CRYPTO">Crypto</option>
              <option value="AUTRE">Autre</option>
            </select>
            <Button type="button" size="sm" variant="primary" disabled={saving || !organizationId} onClick={() => void createAccount()}>
              Ajouter le compte
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
          <CardContent className="space-y-3 p-4 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ajouter un ordre</p>
            <p className="text-[11px] leading-snug text-slate-600">
              Le montant brut des achats et ventes est calculé automatiquement (quantité × cours). Les autres types
              (taxe, transfert…) restent à saisir via l’historique ou une évolution ultérieure de l’interface.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="primary"
                disabled={!organizationId}
                onClick={() => setOrderModal({ open: true, mode: 'BUY' })}
              >
                Achat
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!organizationId}
                onClick={() => setOrderModal({ open: true, mode: 'SELL' })}
              >
                Vente
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!organizationId}
                onClick={() => setOrderModal({ open: true, mode: 'DIVIDEND' })}
              >
                Dividende
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!organizationId}
                onClick={() => setOrderModal({ open: true, mode: 'FEE' })}
              >
                Frais
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <MarketOrderModal
        open={orderModal.open}
        onOpenChange={(open) => setOrderModal((s) => ({ ...s, open, ...(open ? {} : { initialAccountId: undefined }) }))}
        mode={orderModal.mode}
        portfolio={portfolio}
        organizationId={organizationId}
        defaultCurrency={defaultCurrency}
        initialAccountId={orderModal.initialAccountId}
        preferredDefaultAccountId={defaultAccountId}
      />

      <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
        <CardContent className="space-y-2 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Historique des ordres</p>
            <select
              className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="all">Tous types</option>
              <option value="BUY">Achat</option>
              <option value="SELL">Vente</option>
              <option value="DIVIDEND">Dividende</option>
              <option value="FEE">Frais</option>
              <option value="TAX">Taxe</option>
              <option value="TRANSFER_IN">Transfert in</option>
              <option value="TRANSFER_OUT">Transfert out</option>
            </select>
          </div>
          <div className="max-h-72 overflow-y-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-1.5 pr-2">Date</th>
                  <th className="py-1.5 pr-2">Type</th>
                  <th className="py-1.5 pr-2">Symbole</th>
                  <th className="py-1.5 pr-2 text-right">Qté</th>
                  <th className="py-1.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((o) => (
                  <tr key={o.id} className="border-b border-slate-100">
                    <td className="py-1.5 pr-2 tabular-nums text-slate-700">{o.date.slice(0, 10)}</td>
                    <td className="py-1.5 pr-2">{o.type}</td>
                    <td className="py-1.5 pr-2 font-medium">{o.assetSymbol}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{o.quantity}</td>
                    <td className="py-1.5 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={saving}
                        onClick={() => void portfolio.deleteOrder(o.organizationId, o.id).then(() => portfolio.reload())}
                      >
                        Supprimer
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
