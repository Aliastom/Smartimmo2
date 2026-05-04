'use client';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import type { usePortfolioTracker } from '@/features/market/hooks/usePortfolioTracker';
import { buildPortfolioAccountAggregates, kindLabel } from '@/features/market/portfolio/portfolioAccountAggregates';
import type { MarketOrderModalMode } from '@/features/market/components/MarketOrderModal';
import { cn } from '@/utils/cn';

type PortfolioHook = ReturnType<typeof usePortfolioTracker>;

function formatCurrency(value: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
}

export interface PortfolioAccountsPanelProps {
  portfolio: PortfolioHook;
  currency: string;
  organizationId: string;
  loading: boolean;
  defaultAccountId: string | null;
  onSetDefaultAccount: (accountId: string) => void;
  onAddOrder: (opts: { accountId: string; mode: MarketOrderModalMode }) => void;
  onCreateAccountRequest: () => void;
  /** id du bloc formulaire création (scrollIntoView). */
  createAccountSectionId?: string;
}

export function PortfolioAccountsPanel({
  portfolio,
  currency,
  organizationId,
  loading,
  defaultAccountId,
  onSetDefaultAccount,
  onAddOrder,
  onCreateAccountRequest,
  createAccountSectionId = 'portfolio-create-account',
}: PortfolioAccountsPanelProps) {
  const rows = buildPortfolioAccountAggregates(portfolio.accounts, portfolio.positions, portfolio.orders);

  if (loading) {
    return (
      <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
        <CardContent className="space-y-3 p-5">
          <div className="h-6 w-64 max-w-full animate-pulse rounded bg-slate-100" />
          <div className="h-3 w-full max-w-md animate-pulse rounded bg-slate-50" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="h-32 animate-pulse rounded-xl bg-slate-50" />
            <div className="h-32 animate-pulse rounded-xl bg-slate-50" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <Card className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 shadow-sm">
        <CardContent className="flex flex-col items-center justify-center px-6 py-12 text-center">
          <p className="text-sm font-semibold text-slate-800">Aucun compte portefeuille</p>
          <p className="mt-2 max-w-md text-xs leading-relaxed text-slate-600">
            Créez un compte (PEA, CTO, assurance-vie…) pour enregistrer des ordres et suivre vos positions.
          </p>
          <Button
            type="button"
            variant="primary"
            className="mt-6"
            disabled={!organizationId}
            onClick={() => {
              onCreateAccountRequest();
              const el = document.getElementById(createAccountSectionId);
              el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          >
            Créer un compte
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border border-slate-200/90 bg-white shadow-md ring-1 ring-slate-100/80">
      <CardContent className="space-y-4 p-5 md:p-6">
        <div className="border-b border-slate-100 pb-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-600">Étape 1 — Comptes</p>
          <h2 className="mt-1 text-lg font-bold tracking-tight text-slate-900 md:text-xl">Comptes portefeuille</h2>
          <p className="mt-2 text-sm leading-snug text-slate-600">
            Parcours : <span className="font-medium text-slate-800">compte</span> → ordre → position → performance. Récap par
            enveloppe (montants alignés sur le tableau des positions plus bas).
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => {
            const isDefault = defaultAccountId === row.accountId;
            const hasNoOrders = row.orderCount === 0;
            return (
              <article
                key={row.accountId}
                className={cn(
                  'flex flex-col rounded-xl border bg-white p-4 shadow-sm transition-colors',
                  isDefault ? 'border-violet-300 ring-1 ring-violet-100' : 'border-slate-200',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{row.accountName}</p>
                    <p className="mt-0.5 text-xs text-slate-600">
                      {kindLabel(row.kind)} · {row.currency}
                    </p>
                  </div>
                  {isDefault ? (
                    <Badge size="sm" variant="primary">
                      Par défaut
                    </Badge>
                  ) : null}
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-x-2 gap-y-2 text-[11px]">
                  <div>
                    <dt className="text-slate-500">Valeur actuelle</dt>
                    <dd className="font-semibold tabular-nums text-slate-900">{formatCurrency(row.marketValueEuro, currency)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Coût restant</dt>
                    <dd className="font-semibold tabular-nums text-slate-900">{formatCurrency(row.remainingCostBasisEuro, currency)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Positions ouvertes</dt>
                    <dd className="tabular-nums text-slate-800">{row.openPositionLines}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Ordres</dt>
                    <dd className="tabular-nums text-slate-800">{row.orderCount}</dd>
                  </div>
                </dl>

                {row.openPositionLines === 0 && hasNoOrders ? (
                  <p className="mt-3 rounded-lg border border-slate-100 bg-slate-50 px-2 py-1.5 text-[11px] text-slate-600">
                    Aucun ordre enregistré sur ce compte
                  </p>
                ) : row.openPositionLines === 0 && !hasNoOrders ? (
                  <p className="mt-3 rounded-lg border border-amber-100 bg-amber-50/80 px-2 py-1.5 text-[11px] text-amber-900">
                    Ordres présents mais aucune ligne de position (imports ou fermetures de lignes).
                  </p>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="primary"
                    className="min-h-[40px] flex-1 min-w-[10rem] whitespace-normal px-2 py-2 text-center text-xs leading-snug sm:text-sm"
                    disabled={!organizationId}
                    onClick={() => onAddOrder({ accountId: row.accountId, mode: 'BUY' })}
                  >
                    Ajouter un ordre sur ce compte
                  </Button>
                  {!isDefault ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="flex-1 min-w-[8rem]"
                      onClick={() => onSetDefaultAccount(row.accountId)}
                    >
                      Définir comme compte par défaut
                    </Button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
