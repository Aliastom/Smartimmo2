'use client';

import { showSmartimmoFiscalDebug } from '@/lib/debug/showFiscalDebug';
import type { RentalPropertyInput } from '@/types/fiscal';
import type { Transaction } from '@/features/transactions/hooks/useTransactionsData';
import { gestionFlowLabel } from '@/features/transactions/lib/propertyGestionMetrics';

function fmtEuro(n: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export function PropertyFiscalAuditDebugSection({
  bien,
  sortedTransactions,
  gestionPeriodTransactions,
  naturesMap,
}: {
  bien: RentalPropertyInput | null;
  /** Toutes les transactions du bien (recherche par id pour l’audit). */
  sortedTransactions: Transaction[];
  /** Filtrées mois comptable = même périmètre que les KPI gestion. */
  gestionPeriodTransactions: Transaction[];
  naturesMap: Map<string, { flow?: string }>;
}) {
  const perimetreDiagnostic = bien?.breakdown?.lmnpDebug?.perimetreDiagnostic;

  if (!showSmartimmoFiscalDebug() || !perimetreDiagnostic?.auditParTransaction?.length) {
    return null;
  }

  const audit = perimetreDiagnostic.auditParTransaction;
  const exclusions = perimetreDiagnostic.exclusionsDetaillees || [];

  const exclusionById = new Map(exclusions.map((e) => [e.id, e]));

  const fiscalRecetteIds = new Set(
    audit.filter((a) => a.statut === 'recette_fiscale_encaissement').map((a) => a.transactionId)
  );

  const incomeTx = gestionPeriodTransactions.filter((t) => {
    const lbl = gestionFlowLabel(t, naturesMap);
    return lbl === 'Recette';
  });

  const totalIncomeGestion = incomeTx.reduce((s, t) => s + Math.abs(Number(t.amount || 0)), 0);

  const excludedIncome = incomeTx.filter((t) => !fiscalRecetteIds.has(t.id));

  const txById = new Map(sortedTransactions.map((t) => [t.id, t]));

  return (
    <div className="mt-4 space-y-5 rounded-lg border-2 border-dashed border-violet-400/70 bg-violet-50/40 px-3 py-3 text-[11px] text-slate-900">
      <p className="font-bold uppercase tracking-wide text-violet-950">DEBUG fiscal — Recettes gestion vs fiscal</p>
      <div className="rounded border border-violet-200 bg-white/90 p-2 space-y-1">
        <p>
          Recettes gestion (période filtre mois comptable) :{' '}
          <span className="font-semibold">{incomeTx.length}</span> lignes · total{' '}
          <span className="font-semibold">{fmtEuro(totalIncomeGestion)}</span>
        </p>
        <p>
          Recettes fiscales retenues (agrégat) :{' '}
          <span className="font-semibold">{perimetreDiagnostic.nombreRecettesSynthese ?? '—'}</span> lignes · total{' '}
          <span className="font-semibold">{fmtEuro(perimetreDiagnostic.totalRecettesRetenues ?? 0)}</span>
        </p>
        <p>
          Écart (recettes gestion non retenues comme recette fiscale à ce titre) :{' '}
          <span className="font-semibold">{excludedIncome.length}</span> lignes
        </p>
      </div>

      {excludedIncome.length > 0 && (
        <div className="overflow-x-auto">
          <p className="mb-1 font-semibold text-violet-950">Recettes gestion sans ligne « recette fiscale » correspondante</p>
          <table className="w-full min-w-[640px] text-[10px]">
            <thead>
              <tr className="border-b border-violet-200 text-left text-slate-600">
                <th className="py-1 pr-2">Id</th>
                <th className="py-1 pr-2">Libellé</th>
                <th className="py-1 pr-2">Montant</th>
                <th className="py-1">Raison (exclusion fiscale ou autre)</th>
              </tr>
            </thead>
            <tbody>
              {excludedIncome.map((t) => {
                const ex = exclusionById.get(t.id);
                const au = audit.find((a) => a.transactionId === t.id);
                const raison =
                  ex?.reason ||
                  au?.detail ||
                  'Non retenue comme recette fiscale encaissement (période ou règle agrégateur).';
                return (
                  <tr key={t.id} className="border-b border-violet-100 align-top">
                    <td className="py-1 pr-2 font-mono">{String(t.id).slice(0, 8)}</td>
                    <td className="py-1 pr-2">{(t.label || '').slice(0, 80)}</td>
                    <td className="py-1 pr-2">{fmtEuro(Math.abs(Number(t.amount || 0)))}</td>
                    <td className="py-1">{raison}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div>
        <p className="font-bold uppercase tracking-wide text-violet-950 mb-2">
          DEBUG — Statut fiscal des transactions (audit agrégateur)
        </p>
        <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
          <table className="w-full min-w-[900px] text-[10px]">
            <thead className="sticky top-0 bg-violet-100/95">
              <tr className="border-b border-violet-200 text-left">
                <th className="py-1 pr-2">Date</th>
                <th className="py-1 pr-2">Mois compt.</th>
                <th className="py-1 pr-2">Libellé</th>
                <th className="py-1 pr-2">Montant</th>
                <th className="py-1 pr-2">Catégorie</th>
                <th className="py-1 pr-2">Statut gestion</th>
                <th className="py-1 pr-2">Statut fiscal</th>
                <th className="py-1">Raison fiscale</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((row) => {
                const t = txById.get(row.transactionId);
                const acc =
                  (t as { accounting_month?: string; accountingMonth?: string } | undefined)?.accounting_month ??
                  (t as { accountingMonth?: string } | undefined)?.accountingMonth ??
                  '—';
                const cat =
                  (t as { category?: { label?: string } })?.category?.label ??
                  (t as { Category?: { label?: string } })?.Category?.label ??
                  '—';
                return (
                  <tr key={row.transactionId} className="border-b border-violet-100 align-top">
                    <td className="py-1 pr-2">{t?.date ? String(t.date).slice(0, 10) : '—'}</td>
                    <td className="py-1 pr-2">{acc}</td>
                    <td className="py-1 pr-2">{(row.label || '').slice(0, 60)}</td>
                    <td className="py-1 pr-2">
                      {t?.amount != null ? fmtEuro(Math.abs(Number(t.amount))) : '—'}
                    </td>
                    <td className="py-1 pr-2">{cat}</td>
                    <td className="py-1 pr-2">{t ? gestionFlowLabel(t, naturesMap) : '—'}</td>
                    <td className="py-1 pr-2 font-mono text-[9px]">{row.statut}</td>
                    <td className="py-1">{row.detail}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {!bien && <p className="text-slate-600">Aucune donnée bien pour contexte.</p>}
    </div>
  );
}
