'use client';

import { Card, CardContent } from '@/components/ui/Card';
import Link from 'next/link';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import { useMarketInvestment } from '@/features/market/hooks/useMarketInvestment';

export function MarketOpportunityWidget() {
  const { organizationId } = useCurrentOrganization();
  const { loading, radarEntries, radarLastRefreshedAt } = useMarketInvestment(organizationId, { source: 'dashboard' });
  if (loading) return null;
  if (radarEntries.length === 0) return null;
  const opportunityCount = radarEntries.filter(
    (entry) => entry.recommendation && (entry.recommendation.status === 'OPPORTUNITE' || entry.recommendation.status === 'FORTE_OPPORTUNITE')
  ).length;
  const hasStrongOpportunity = radarEntries.some((entry) => entry.recommendation?.status === 'FORTE_OPPORTUNITE');
  const globalStatus = hasStrongOpportunity
    ? 'FORTE OPPORTUNITÉ'
    : opportunityCount > 0
      ? 'OPPORTUNITÉ'
      : 'NORMAL';
  const tileClassName =
    globalStatus === 'FORTE OPPORTUNITÉ'
      ? 'border-red-200 bg-red-50/60'
      : globalStatus === 'OPPORTUNITÉ'
        ? 'border-amber-200 bg-amber-50/60'
        : 'border-slate-200 bg-white';

  return (
    <Card className={`shadow-sm ${tileClassName}`}>
      <CardContent className="flex h-full min-h-[136px] flex-col justify-between px-3 py-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-900">Radar ETF</p>
          <p className="text-xs font-medium text-slate-700">{globalStatus}</p>
          <p className="text-xs text-slate-600">3 ETF suivis</p>
          <p className="text-xs text-slate-500">
            MAJ : {radarLastRefreshedAt ? new Date(radarLastRefreshedAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
          </p>
          <p className="text-xs text-slate-700">
            {opportunityCount > 0 ? `${opportunityCount} opportunité${opportunityCount > 1 ? 's' : ''} détectée${opportunityCount > 1 ? 's' : ''}` : 'Aucune opportunité'}
          </p>
        </div>
        <div className="mt-2">
          <Link href="/app?view=market" className="text-xs font-medium text-primary-700 hover:text-primary-800 hover:underline">
            Voir
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

