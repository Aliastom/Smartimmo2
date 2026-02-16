'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { MonthlyKPIs } from '@/types/dashboard';
import type { LoyerNonEncaisse, TransactionNonRapprochee } from '@/types/dashboard';
import { cn } from '@/utils/cn';
import { getAlertSeverity, type AlertSeverity } from '../utils/alertSeverity';
import { ALERT_SEVERITY_DISPLAY } from '../utils/alertSeverity';

function formatEur(n: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

const SEVERITY_STYLES: Record<AlertSeverity, { border: string; badge: string; icon: string; Icon: React.ComponentType<{ className?: string }> }> = {
  ok: {
    border: 'border-slate-200',
    badge: 'rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700',
    icon: 'text-emerald-500',
    Icon: CheckCircle2,
  },
  warning: {
    border: 'border-l-4 border-l-amber-500 border-slate-200',
    badge: 'rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700',
    icon: 'text-amber-500',
    Icon: AlertTriangle,
  },
  critical: {
    border: 'border-l-4 border-l-red-500 border-slate-200',
    badge: 'rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-red-700',
    icon: 'text-red-500',
    Icon: AlertCircle,
  },
};

export interface DashboardUrgentColumnProps {
  kpis: MonthlyKPIs;
  relances: LoyerNonEncaisse[];
  transactionsNonRapprochees: TransactionNonRapprochee[];
  currentMonth: string;
  className?: string;
}

function UrgentCard({
  title,
  mainValue,
  mainBadge,
  subValue,
  subBadge,
  severity,
  index,
}: {
  title: string;
  mainValue: string;
  mainBadge: string;
  subValue: string;
  subBadge: string;
  severity: AlertSeverity;
  index: number;
}) {
  const display = ALERT_SEVERITY_DISPLAY[severity];
  const styles = SEVERITY_STYLES[severity];
  const IconComponent = styles.Icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut', delay: index * 0.05 }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.995 }}
      className={cn(
        'relative rounded-xl border bg-white p-6 shadow-sm transition-all duration-200 ease-out',
        'hover:shadow-lg hover:border-slate-300',
        styles.border
      )}
    >
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <motion.span
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
          className={styles.badge}
        >
          {display.badgeLabel}
        </motion.span>
        <IconComponent className={cn('h-[18px] w-[18px] opacity-80', styles.icon)} aria-hidden />
      </div>
      <p className="text-sm font-medium text-slate-600 pr-28">{title}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{mainValue}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
        {severity === 'ok' ? (
          <span>{display.message}</span>
        ) : (
          <>
            <span>{mainBadge}</span>
            <span className="text-slate-300">•</span>
            <span>{subValue}</span>
            <span className="text-slate-300">•</span>
            <span>{subBadge}</span>
          </>
        )}
      </div>
    </motion.div>
  );
}

export function DashboardUrgentColumn({
  kpis,
  relances,
  transactionsNonRapprochees,
  currentMonth,
  className,
}: DashboardUrgentColumnProps) {
  const manqueMoisCourant = Math.max(
    0,
    (kpis.loyersAttendus ?? 0) - (kpis.sommesEncaissesRapprochees ?? 0)
  );
  const manqueCumul = relances.reduce((s, r) => s + (r.montant ?? 0), 0);
  // Sévérité basée sur la valeur affichée (mois en cours) — 0 € affiché = vert
  const severityManque = getAlertSeverity(manqueMoisCourant, { warningThreshold: 0 });

  const relancesMoisCourant = relances.filter(
    (r) => r.accountingMonth === currentMonth
  );
  const loyersImpayesMoisCount = relancesMoisCourant.length;
  const loyersImpayesMoisAmount = relancesMoisCourant.reduce(
    (s, r) => s + r.montant,
    0
  );
  const loyersImpayesCumul = relances.reduce((s, r) => s + r.montant, 0);
  // Sévérité basée sur la valeur affichée (mois en cours) — 0 loyer affiché = vert
  const severityLoyersImpayes = getAlertSeverity(loyersImpayesMoisCount);

  const txMoisCourant = transactionsNonRapprochees.filter(
    (t) => t.accountingMonth === currentMonth
  );
  const txMoisCount = txMoisCourant.length;
  const txMoisAmount = txMoisCourant.reduce((s, t) => s + t.montant, 0);
  const txCumulCount = transactionsNonRapprochees.length;
  const txCumulAmount = transactionsNonRapprochees.reduce(
    (s, t) => s + t.montant,
    0
  );
  const severityTx = getAlertSeverity(txCumulCount);

  return (
    <div className={cn('relative space-y-6', className)}>
      <div className="lg:sticky lg:top-20 lg:z-10 lg:bg-transparent lg:py-2 lg:-mx-1 lg:px-1 lg:border-b lg:border-slate-100">
        <h2 className="text-lg font-semibold text-slate-900">Hors norme / À traiter</h2>
        <div className="h-1 w-10 bg-red-500 rounded-full mt-2" />
      </div>
      <div className="space-y-6">
        <UrgentCard
          index={0}
          title="Manque perçu"
          mainValue={formatEur(manqueMoisCourant)}
          mainBadge="Mois en cours"
          subValue={formatEur(manqueCumul)}
          subBadge="Cumul"
          severity={severityManque}
        />
        <UrgentCard
          index={1}
          title="Loyers impayés"
          mainValue={
            severityLoyersImpayes === 'ok'
              ? '0'
              : `${loyersImpayesMoisCount} loyer${loyersImpayesMoisCount > 1 ? 's' : ''} · ${formatEur(loyersImpayesMoisAmount)}`
          }
          mainBadge="Mois en cours"
          subValue={formatEur(loyersImpayesCumul)}
          subBadge="Cumul"
          severity={severityLoyersImpayes}
        />
        <UrgentCard
          index={2}
          title="Transactions non rapprochées"
          mainValue={
            severityTx === 'ok'
              ? '0'
              : `${txMoisCount} transaction${txMoisCount > 1 ? 's' : ''} · ${formatEur(txMoisAmount)}`
          }
          mainBadge="Mois en cours"
          subValue={`${txCumulCount} au total · ${formatEur(txCumulAmount)}`}
          subBadge="Cumul"
          severity={severityTx}
        />
      </div>
    </div>
  );
}
