'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/Card';
import { Building2 } from 'lucide-react';
import type { LoyerNonEncaisse, TransactionNonRapprochee, IndexationATraiter } from '@/types/dashboard';
import { cn } from '@/utils/cn';

export type BienStatus = 'ok' | 'attention' | 'probleme';

function formatEur(n: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

export interface PortfolioHeatmapProps {
  /** Noms des biens du portefeuille (ex. depuis properties) */
  propertyNames: string[];
  /** Optionnel : { id, name } pour lien vers fiche bien */
  propertyList?: Array<{ id: string; name: string }>;
  relances: LoyerNonEncaisse[];
  transactionsNonRapprochees: TransactionNonRapprochee[];
  indexations: IndexationATraiter[];
  className?: string;
}

export function PortfolioHeatmap({
  propertyNames,
  propertyList,
  relances,
  transactionsNonRapprochees,
  indexations,
  className,
}: PortfolioHeatmapProps) {
  const amountByProperty = useMemo(() => {
    const m = new Map<string, number>();
    relances.forEach((r) => {
      const name = r.propertyName;
      m.set(name, (m.get(name) ?? 0) + (r.montant ?? 0));
    });
    return m;
  }, [relances]);

  const propertyStatus = useMemo((): Map<string, { status: BienStatus; reason?: string; amount?: number }> => {
    const map = new Map<string, { status: BienStatus; reason?: string; amount?: number }>();
    const allNames = new Set(propertyNames);
    relances.forEach((r) => {
      const name = r.propertyName;
      allNames.add(name);
      const current = map.get(name);
      if (!current || current.status !== 'probleme') {
        map.set(name, {
          status: 'probleme',
          reason: 'Loyer en retard',
          amount: amountByProperty.get(name),
        });
      }
    });
    transactionsNonRapprochees.forEach((t) => {
      const name = t.propertyName;
      allNames.add(name);
      const current = map.get(name);
      if (!current) {
        map.set(name, { status: 'attention', reason: 'Transaction à rapprocher' });
      } else if (current.status === 'ok') {
        map.set(name, { status: 'attention', reason: 'Transaction à rapprocher' });
      }
    });
    indexations.forEach((i) => {
      const name = i.propertyName;
      allNames.add(name);
      const current = map.get(name);
      if (!current) {
        map.set(name, { status: 'attention', reason: 'Indexation à appliquer' });
      } else if (current.status === 'ok') {
        map.set(name, { status: 'attention', reason: 'Indexation à appliquer' });
      }
    });
    allNames.forEach((name) => {
      if (!map.has(name)) {
        map.set(name, { status: 'ok' });
      }
    });
    return map;
  }, [propertyNames, relances, transactionsNonRapprochees, indexations, amountByProperty]);

  const sortedNames = useMemo(() => {
    const entries = Array.from(propertyStatus.entries());
    entries.sort((a, b) => {
      const order: Record<BienStatus, number> = { probleme: 0, attention: 1, ok: 2 };
      return order[a[1].status] - order[b[1].status];
    });
    return entries;
  }, [propertyStatus]);

  if (sortedNames.length === 0) {
    return (
      <Card className={cn('border-slate-200 bg-white shadow-sm', className)}>
        <CardContent className="py-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-2">État des biens</h3>
          <p className="text-sm text-slate-500">Aucun bien à afficher.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('border-slate-200 bg-white shadow-sm', className)}>
      <CardContent className="py-5">
        <div className="flex items-center gap-2 mb-3">
          <Building2 className="h-4 w-4 text-slate-500" aria-hidden />
          <h3 className="text-sm font-semibold text-slate-800">État des biens</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {sortedNames.map(([name, { status, reason, amount }]) => {
            const tooltipText =
              status === 'probleme' && amount != null && amount > 0
                ? `${reason}\nMontant : ${formatEur(amount)}`
                : reason ?? name;
            const href = propertyList?.find((p) => p.name === name)?.id != null
              ? `/app?view=property&propertyId=${propertyList.find((p) => p.name === name)!.id}`
              : undefined;
            const content = (
              <>
                <span
                  className={cn(
                    'inline-block w-2 h-2 rounded-full flex-shrink-0',
                    status === 'probleme' && 'bg-red-500',
                    status === 'attention' && 'bg-amber-500',
                    status === 'ok' && 'bg-emerald-500'
                  )}
                  aria-hidden
                />
                {name}
                {reason && status !== 'ok' && (
                  <span className="opacity-80">({reason})</span>
                )}
              </>
            );
            const classNames = cn(
              'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors',
              status === 'probleme' && 'border-red-200 bg-red-50 text-red-700',
              status === 'attention' && 'border-amber-200 bg-amber-50 text-amber-700',
              status === 'ok' && 'border-emerald-200 bg-emerald-50 text-emerald-700',
              href && 'hover:opacity-90 cursor-pointer'
            );
            return href ? (
              <Link
                key={name}
                href={href}
                title={tooltipText}
                className={classNames}
              >
                {content}
              </Link>
            ) : (
              <span key={name} title={tooltipText} className={classNames}>
                {content}
              </span>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
