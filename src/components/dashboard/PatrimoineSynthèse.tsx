'use client';

import React, { useMemo } from 'react';
import type { PatrimoineKPIs, PerformanceParBienItem, RepartitionParBienItem } from '@/types/dashboard';
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react';

type InsightKind = 'positive' | 'warning' | 'neutral';

interface SynthèseItem {
  kind: InsightKind;
  title: string;
  value?: string; // ex: "(+25 272 €)" ou "(0.9 %)"
}

interface PatrimoineSynthèseProps {
  kpis: PatrimoineKPIs;
  repartitionParBienLoyers?: RepartitionParBienItem[];
  performanceParBien?: PerformanceParBienItem[];
}

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

export function PatrimoineSynthèse({
  kpis,
  repartitionParBienLoyers,
  performanceParBien = [],
}: PatrimoineSynthèseProps) {
  const insights = useMemo(() => {
    const items: SynthèseItem[] = [];

    // 1. Cashflow annuel
    if (kpis.cashflowAnnuelMoyen !== null) {
      const annuel = kpis.cashflowAnnuelMoyen * 12;
      if (annuel > 0) {
        items.push({ kind: 'positive', title: 'Cashflow annuel positif', value: `+${fmt(annuel)}` });
      } else if (annuel < 0) {
        items.push({ kind: 'warning', title: 'Cashflow annuel négatif', value: fmt(annuel) });
      } else {
        items.push({ kind: 'neutral', title: 'Cashflow annuel à l\'équilibre' });
      }
    }

    // 2. Niveau de rendement
    if (kpis.rendementNet !== null) {
      if (kpis.rendementNet >= 5) {
        items.push({ kind: 'positive', title: 'Rendement net solide', value: `${kpis.rendementNet.toFixed(1)} %` });
      } else if (kpis.rendementNet >= 3) {
        items.push({ kind: 'neutral', title: 'Rendement net correct', value: `${kpis.rendementNet.toFixed(1)} %` });
      } else {
        items.push({ kind: 'warning', title: 'Rendement net faible', value: `${kpis.rendementNet.toFixed(1)} %` });
      }
    }

    // 3. Niveau d'endettement
    if (kpis.ltv !== null && kpis.ltv > 0) {
      if (kpis.ltv <= 50) {
        items.push({ kind: 'positive', title: 'Endettement maîtrisé', value: `${kpis.ltv.toFixed(0)} % LTV` });
      } else if (kpis.ltv <= 80) {
        items.push({ kind: 'warning', title: 'Endettement modéré', value: `${kpis.ltv.toFixed(0)} % LTV` });
      } else {
        items.push({ kind: 'warning', title: 'Endettement élevé', value: `${kpis.ltv.toFixed(0)} % LTV` });
      }
    }

    // 4. Concentration des loyers
    if (repartitionParBienLoyers && repartitionParBienLoyers.length > 0) {
      const total = repartitionParBienLoyers.reduce((s, x) => s + x.value, 0);
      const max = Math.max(...repartitionParBienLoyers.map((x) => x.value));
      const sharePct = total > 0 ? (max / total) * 100 : 0;
      if (sharePct > 50) {
        items.push({
          kind: 'warning',
          title: 'Concentration des loyers',
          value: `un bien = ${sharePct.toFixed(0)} %`,
        });
      } else {
        items.push({ kind: 'positive', title: 'Loyers bien répartis entre les biens' });
      }
    }

    // 5. Biens sous-performants
    const underperformers = performanceParBien.filter(
      (p) => p.rendementBrutPct != null && p.rendementBrutPct < 3
    );
    if (underperformers.length > 0) {
      items.push({
        kind: 'warning',
        title: `${underperformers.length} bien(s) sous-performants`,
        value: 'rendement < 3 %',
      });
    } else if (performanceParBien.length > 0) {
      items.push({ kind: 'positive', title: 'Tous les biens ≥ 3 % de rendement brut' });
    }

    return items.slice(0, 5);
  }, [kpis, repartitionParBienLoyers, performanceParBien]);

  if (insights.length === 0) return null;

  const Icon = ({ kind }: { kind: InsightKind }) => {
    switch (kind) {
      case 'positive':
        return <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" aria-hidden />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" aria-hidden />;
      case 'neutral':
        return <Info className="h-5 w-5 text-slate-500 shrink-0" aria-hidden />;
    }
  };

  return (
    <div
      className="rounded-lg border border-gray-200 bg-white shadow-sm px-4 py-3"
      role="region"
      aria-labelledby="synthèse-title"
    >
      <h2 id="synthèse-title" className="text-sm font-semibold text-gray-800 mb-3">
        Synthèse du portefeuille
      </h2>
      <ul className="space-y-2.5">
        {insights.map((item, i) => (
          <li key={i} className="flex items-start gap-3">
            <Icon kind={item.kind} />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-gray-900 text-sm">{item.title}</p>
              {item.value && <p className="text-base font-bold text-gray-800 tabular-nums mt-1 tracking-tight">{item.value}</p>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
