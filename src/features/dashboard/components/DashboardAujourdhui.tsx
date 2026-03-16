'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/Card';

export interface DashboardAujourdhuiProps {
  /** Base URL pour les liens (ex: /app en app-shell, ou /alertes en normal) */
  baseUrl?: string;
  nLoyersRetard: number;
  nTransactions: number;
  nIndexations: number;
  nEcheances: number;
}

/**
 * Bloc "Aujourd'hui" : actions du jour (loyers en retard, transactions à rapprocher, indexations, échéances).
 * Chaque élément est cliquable et redirige vers la page Alertes avec le filtre correspondant.
 */
export function DashboardAujourdhui({
  baseUrl = '/app',
  nLoyersRetard,
  nTransactions,
  nIndexations,
  nEcheances,
}: DashboardAujourdhuiProps) {
  const viewAlertes = (type: string) =>
    baseUrl === '/app' ? `${baseUrl}?view=alertes&type=${type}` : `${baseUrl}?type=${type}`;
  const items: { label: string; count: number; type: string }[] = [
    { label: 'loyers en retard', count: nLoyersRetard, type: 'loyers_retard' },
    { label: 'transactions à rapprocher', count: nTransactions, type: 'transactions' },
    { label: 'indexations à faire', count: nIndexations, type: 'indexations' },
    { label: 'échéances du jour', count: nEcheances, type: 'echeances' },
  ].filter((i) => i.count > 0);

  return (
    <Card className="mt-6 border-slate-200 bg-white shadow-sm">
      <CardContent className="py-5">
        <h3 className="text-sm font-semibold text-slate-800 mb-4">Aujourd&apos;hui</h3>
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune action à réaliser aujourd&apos;hui.</p>
        ) : (
          <ul className="space-y-2">
            {items.map(({ label, count, type }) => (
              <li key={type}>
                <Link
                  href={viewAlertes(type)}
                  className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700 hover:underline"
                >
                  <span className="tabular-nums">{count}</span>
                  <span>{label}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
