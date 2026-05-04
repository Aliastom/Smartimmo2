'use client';

import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { HelpCircle, Settings } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { MarketInvestmentCard } from '@/features/market/components/MarketInvestmentCard';
import { MarketModuleHelpModal, readMarketHelpDismissed } from '@/features/market/components/MarketModuleHelpModal';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import { useMarketInvestment } from '@/features/market/hooks/useMarketInvestment';

interface MarketPageCoreProps {
  mode: 'normal' | 'app-shell';
}

function formatCurrency(value: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
}

/* eslint-disable-next-line @typescript-eslint/naming-convention -- composant React */
export function MarketPageCore({ mode }: MarketPageCoreProps) {
  const searchParams = useSearchParams();
  const marketTabFromUrl = searchParams.get('marketTab');
  const [openSettingsSignal, setOpenSettingsSignal] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const { organizationId } = useCurrentOrganization();
  const market = useMarketInvestment(organizationId, { source: 'market' });
  const settings = market?.settings ?? null;

  useEffect(() => {
    if (readMarketHelpDismissed()) return;
    setHelpOpen(true);
  }, []);

  return (
    <div className="w-full max-w-full space-y-3">
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardContent className="py-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold leading-7 text-slate-900 sm:text-2xl">Opportunités Marché</h1>
                <Badge size="sm" variant="secondary">local-first</Badge>
              </div>
              <p className="text-sm font-medium leading-5 text-violet-700">Suivi décisionnel local-first des actifs de marché</p>
              <p className="pt-0.5 text-xs leading-5 text-slate-500">
                Espace décisionnel dédié : actif principal, radar marché, simulation, journal d’investissement et bibliothèque.
              </p>
              <p className="text-xs leading-5 text-slate-500">
                Ces paramètres sont déclaratifs, locaux à Smartimmo, et ne déclenchent aucun ordre bancaire.
              </p>
              {mode === 'app-shell' && (
                <p className="text-xs leading-5 text-slate-500">Aucun ordre bancaire n&apos;est exécuté depuis Smartimmo.</p>
              )}
            </div>
            <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:items-end sm:text-right">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs text-slate-500 hover:text-slate-800"
                  onClick={() => setHelpOpen(true)}
                >
                  <HelpCircle className="mr-1 h-3.5 w-3.5" />
                  Aide / Comment ça marche ?
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-fit px-3 text-xs"
                  onClick={() => setOpenSettingsSignal((prev) => prev + 1)}
                >
                  <Settings className="mr-1.5 h-3.5 w-3.5" />
                  Modifier les paramètres
                </Button>
              </div>
              {settings && (
                <>
                  <p className="max-w-full rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-left text-[11px] leading-5 text-amber-800 sm:max-w-sm sm:text-right">
                    Actif principal: {settings.referenceSymbol} · Radar: 3 actifs surveillés · ATH: {settings.athPeriod} · DCA: {formatCurrency(settings.monthlyDcaAmount, settings.currency)} · Seuils: {settings.reinforce10Threshold.toFixed(0)}% / {settings.reinforce20Threshold.toFixed(0)}% · Cash restant: {formatCurrency(settings.availableCash, settings.currency)}
                  </p>
                  <div className="flex sm:justify-end">
                    <span className="inline-flex items-center rounded-md border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700">
                      Période ATH sélectionnée: {settings.athPeriod}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <MarketModuleHelpModal open={helpOpen} onOpenChange={setHelpOpen} />

      {market ? (
        <MarketInvestmentCard
          openSettingsSignal={openSettingsSignal}
          market={market}
          marketTabFromUrl={marketTabFromUrl}
        />
      ) : (
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardContent className="py-3.5">
            <p className="text-sm text-slate-500">Initialisation du module marché...</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

