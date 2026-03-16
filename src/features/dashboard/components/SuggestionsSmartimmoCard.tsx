'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/Card';
import { Lightbulb, ArrowRight } from 'lucide-react';
import type { IndexationATraiter, BailAEcheance, LoyerNonEncaisse } from '@/types/dashboard';
import { cn } from '@/utils/cn';

function formatEur(n: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

export interface SuggestionsSmartimmoCardProps {
  indexations: IndexationATraiter[];
  bauxAEcheance: BailAEcheance[];
  relances: LoyerNonEncaisse[];
  className?: string;
}

export function SuggestionsSmartimmoCard({
  indexations,
  bauxAEcheance,
  relances,
  className,
}: SuggestionsSmartimmoCardProps) {
  const { suggestions, gainAnPossible } = useMemo(() => {
    const out: Array<{ id: string; text: string; sub?: string; type: 'indexation' | 'bail' | 'vacance' }> = [];
    let totalGainAn = 0;
    indexations.forEach((idx) => {
      const delta = idx.loyerPropose != null && idx.loyerActuel > 0
        ? Math.round((idx.loyerPropose - idx.loyerActuel) * 12)
        : 0;
      if (delta > 0) totalGainAn += delta;
    });
    indexations.slice(0, 2).forEach((idx, i) => {
      const delta = idx.loyerPropose != null && idx.loyerActuel > 0
        ? Math.round((idx.loyerPropose - idx.loyerActuel) * 12)
        : 0;
      out.push({
        id: `idx-${i}-${idx.id}`,
        text: `Augmenter loyer ${idx.propertyName}${idx.loyerPropose != null ? ` de ${formatEur(idx.loyerPropose - idx.loyerActuel)}` : ''}`,
        sub: delta > 0 ? `+${formatEur(delta)} / an` : undefined,
        type: 'indexation',
      });
    });
    bauxAEcheance.slice(0, 2).forEach((b, i) => {
      const mois = Math.max(0, Math.ceil(b.joursRestants / 30));
      out.push({
        id: `bail-${i}-${b.id}`,
        text: `Bail ${b.propertyName} expire dans ${mois} mois`,
        sub: 'Préparer renouvellement',
        type: 'bail',
      });
    });
    if (relances.length > 0 && out.length < 4) {
      const byProperty = new Map<string, number>();
      relances.forEach((r) => byProperty.set(r.propertyName, (byProperty.get(r.propertyName) ?? 0) + (r.montant ?? 0)));
      const first = relances[0];
      out.push({
        id: 'relance-1',
        text: `Loyers en retard sur ${first.propertyName}`,
        sub: byProperty.get(first.propertyName) != null ? `Montant : ${formatEur(byProperty.get(first.propertyName)!)}` : undefined,
        type: 'vacance',
      });
    }
    return { suggestions: out.slice(0, 5), gainAnPossible: totalGainAn };
  }, [indexations, bauxAEcheance, relances]);

  return (
    <Card className={cn('border-slate-200 bg-white shadow-sm', className)}>
      <CardContent className="py-4">
        <div className="flex items-center gap-2 mb-2">
          <Lightbulb className="h-4 w-4 text-amber-500" aria-hidden />
          <h3 className="text-sm font-semibold text-slate-800">Suggestions Smartimmo</h3>
        </div>
        {gainAnPossible > 0 && (
          <p className="text-xs font-medium text-emerald-600 mb-2">+{formatEur(gainAnPossible)} / an possible</p>
        )}
        {suggestions.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune suggestion pour le moment.</p>
        ) : (
          <>
            <ul className="space-y-2">
              {suggestions.map((s) => (
                <li key={s.id} className="text-sm text-slate-700 border-l-2 border-amber-200 pl-3 py-0.5">
                  <span>{s.text}</span>
                  {s.sub && <span className="block text-xs text-slate-500 mt-0.5">{s.sub}</span>}
                </li>
              ))}
            </ul>
            <Link
              href="/app?view=alertes"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              Voir toutes les suggestions
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}
