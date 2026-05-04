/**
 * Panneau debug temporaire LMNP (charges détaillées) — partagé Synthèse / Simulation.
 */

'use client';

import { useMemo } from 'react';
import type { SimulationResult, TypeBien } from '@/types/fiscal';
import {
  aggregateBicPedagogyFromBiens,
  computeLmnpReelPedagogyDisplay,
  isMicroBicRegime,
} from '@/lib/fiscal/immoTaxDisplayAlloc';

function isRevenuBicImmobilierType(type: TypeBien): boolean {
  return type === 'MEUBLE' || type === 'LMNP' || type === 'LMP';
}

export function LmnpDebugPanel({ simulation }: { simulation: SimulationResult }) {
  const formatEuro = (amount: number) =>
    new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  const biensBic = useMemo(
    () => simulation.biens.filter((b) => isRevenuBicImmobilierType(b.type)),
    [simulation.biens],
  );
  const biensBicReel = useMemo(
    () => biensBic.filter((b) => !isMicroBicRegime(b)),
    [biensBic],
  );
  const lmnpReelUx = useMemo(() => computeLmnpReelPedagogyDisplay(biensBicReel), [biensBicReel]);
  const bicPedagogy = useMemo(() => aggregateBicPedagogyFromBiens(biensBic), [biensBic]);

  const perimetreDiagnostic = useMemo(() => {
    const bien = biensBicReel.find((b) => b.breakdown?.lmnpDebug?.perimetreDiagnostic);
    return bien?.breakdown?.lmnpDebug?.perimetreDiagnostic ?? null;
  }, [biensBicReel]);

  const lmnpDebugCharges = useMemo(() => {
    const lines = biensBicReel.flatMap((bien) => bien.breakdown?.lmnpDebug?.chargesLines || []);
    const totalsByCategory: Record<string, number> = {};
    const totalsByBien: Record<string, number> = {};
    let totalRapprochees = 0;
    let totalNonRapprochees = 0;
    for (const line of lines) {
      if (line.bucketFiscal === 'amortissement') {
        continue;
      }
      if (line.bucketFiscal !== 'charge_directe') continue;
      totalsByCategory[line.categorie] = (totalsByCategory[line.categorie] || 0) + line.montant;
      totalsByBien[line.bienId] = (totalsByBien[line.bienId] || 0) + line.montant;
      if (line.rapprochement === 'rapprochee') totalRapprochees += line.montant;
      if (line.rapprochement === 'non_rapprochee') totalNonRapprochees += line.montant;
    }

    return {
      lines: [...lines].sort((a, b) => (a.date || '').localeCompare(b.date || '')),
      totalsByCategory: Object.entries(totalsByCategory).sort((a, b) => b[1] - a[1]),
      totalsByBien: Object.entries(totalsByBien).sort((a, b) => b[1] - a[1]),
      totalRapprochees,
      totalNonRapprochees,
    };
  }, [biensBicReel]);

  if (biensBicReel.length === 0) {
    return null;
  }

  const hasDebugLines = lmnpDebugCharges.lines.length > 0;

  return (
    <div className="mt-4 rounded-lg border-2 border-dashed border-amber-400/80 bg-amber-50/40 px-3 py-3">
      <p className="text-xs font-bold uppercase tracking-wide text-amber-950">
        TEMP DEBUG LMNP — Charges détaillées
      </p>
      <p className="mt-1 text-[11px] text-amber-950/80">
        Périmètre BIC au réel (agrégat pédagogique) · recettes {formatEuro(bicPedagogy.recettes)} · charges déductibles
        affichées {formatEuro(lmnpReelUx.chargesDeductibles)} · amortissements comptabilisés{' '}
        {formatEuro(lmnpReelUx.amortissementsComptabilises)}
      </p>

      {perimetreDiagnostic && (
        <div className="mt-3 rounded-lg border border-amber-300 bg-white/95 p-3 text-[11px] text-slate-800">
          <p className="font-semibold text-amber-950">Rapprochement périmètres (agrégat fiscal)</p>
          <p className="mt-1 text-[11px] text-slate-600">
            Année fiscale {perimetreDiagnostic.anneeFiscale} · transactions après dédoublonnage :{' '}
            {perimetreDiagnostic.transactionsApresDedup}
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <ul className="space-y-0.5">
              <li>Lignes recettes (synthèse) : {perimetreDiagnostic.nombreRecettesSynthese}</li>
              <li>Lignes dépenses/charges (synthèse hors forfait) : {perimetreDiagnostic.nombreDepensesSynthese}</li>
              <li>Lignes debug LMNP charge directe : {perimetreDiagnostic.nombreLignesChargesDirectesLmnp}</li>
              <li>Lignes debug LMNP amortissement : {perimetreDiagnostic.nombreLignesAmortissementLmnp}</li>
              <li>Exclusions agrégat : {perimetreDiagnostic.nombreExclusions}</li>
            </ul>
            <ul className="space-y-0.5">
              <li>Total recettes retenues : {formatEuro(perimetreDiagnostic.totalRecettesRetenues)}</li>
              <li>Charges issues transactions (déductibles) : {formatEuro(perimetreDiagnostic.totalChargesDepensesTransactions)}</li>
              <li>Forfait hors transactions : {formatEuro(perimetreDiagnostic.totalForfaitHorsTransactions)}</li>
              <li>Intérêts emprunt (fusion moteur) : {formatEuro(perimetreDiagnostic.montantInteretsEmpruntHorsTransactions)}</li>
              <li>Amortissements comptables : {formatEuro(perimetreDiagnostic.montantAmortissementsComptablesHorsTransactions)}</li>
            </ul>
          </div>
          {perimetreDiagnostic.outsideTransactionsBreakdown && (
            <div className="mt-3 rounded border border-slate-200 bg-slate-50/90 p-2 text-[11px] text-slate-800">
              <p className="font-semibold text-slate-900">Écart transactions → ligne « charges déductibles » simulateur</p>
              <ul className="mt-1 space-y-0.5">
                <li>
                  Total base simulateur (charges bien + prêt) :{' '}
                  {formatEuro((perimetreDiagnostic.chargesTotalSimulatorCents ?? 0) / 100)}
                </li>
                <li>
                  − Charges issues transactions seules :{' '}
                  {formatEuro((perimetreDiagnostic.chargesFromTransactionsCents ?? 0) / 100)}
                </li>
                <li className="font-medium">
                  = Hors transactions : {formatEuro((perimetreDiagnostic.chargesOutsideTransactionsCents ?? 0) / 100)}
                </li>
              </ul>
              <p className="mt-2 font-semibold text-slate-800">Détail hors transactions</p>
              <ul className="mt-0.5 space-y-0.5">
                <li>
                  Intérêts (échéancier) :{' '}
                  {formatEuro((perimetreDiagnostic.outsideTransactionsBreakdown.loanInterestsCents ?? 0) / 100)}
                </li>
                <li>
                  Assurance emprunteur :{' '}
                  {formatEuro((perimetreDiagnostic.outsideTransactionsBreakdown.loanInsuranceCents ?? 0) / 100)}
                </li>
                <li>
                  Forfait / calculé :{' '}
                  {formatEuro((perimetreDiagnostic.outsideTransactionsBreakdown.forfaitOrCalculatedChargesCents ?? 0) / 100)}
                </li>
                {Math.abs(perimetreDiagnostic.outsideTransactionsBreakdown.otherCents ?? 0) > 0 && (
                  <li>
                    Résidu (arrondis / écart moteur vs échéancier) :{' '}
                    {formatEuro((perimetreDiagnostic.outsideTransactionsBreakdown.otherCents ?? 0) / 100)}
                  </li>
                )}
              </ul>
            </div>
          )}
          {perimetreDiagnostic.exclusionsDetaillees.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <p className="mb-1 font-semibold text-slate-700">Transactions exclues (raison)</p>
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    <th className="py-1 pr-2">Id</th>
                    <th className="py-1 pr-2">Libellé</th>
                    <th className="py-1 pr-2">Montant</th>
                    <th className="py-1">Raison</th>
                  </tr>
                </thead>
                <tbody>
                  {perimetreDiagnostic.exclusionsDetaillees.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100 align-top">
                      <td className="py-1 pr-2 font-mono">{row.id.slice(0, 8)}</td>
                      <td className="py-1 pr-2">{row.label}</td>
                      <td className="py-1 pr-2">{formatEuro(row.amountAbs)}</td>
                      <td className="py-1">{row.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {perimetreDiagnostic.auditParTransaction.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <p className="mb-1 font-semibold text-slate-700">
                Audit transaction → statut fiscal ({perimetreDiagnostic.auditParTransaction.length} lignes)
              </p>
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    <th className="py-1 pr-2">Tx</th>
                    <th className="py-1 pr-2">Libellé</th>
                    <th className="py-1 pr-2">Statut</th>
                    <th className="py-1">Détail</th>
                  </tr>
                </thead>
                <tbody>
                  {perimetreDiagnostic.auditParTransaction.slice(0, 120).map((row) => (
                    <tr key={row.transactionId} className="border-b border-slate-100 align-top">
                      <td className="py-1 pr-2 font-mono">{row.transactionId.slice(0, 8)}</td>
                      <td className="py-1 pr-2">{row.label}</td>
                      <td className="py-1 pr-2">{row.statut}</td>
                      <td className="py-1">{row.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {perimetreDiagnostic.auditParTransaction.length > 120 && (
                <p className="mt-1 text-slate-500">… {perimetreDiagnostic.auditParTransaction.length - 120} lignes supplémentaires</p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-2 grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-2">
        <div className="rounded border border-amber-200/80 bg-white/90 p-2">
          <p className="font-semibold text-amber-950">Totaux de contrôle</p>
          <div className="mt-1 space-y-0.5">
            <div className="flex justify-between">
              <span>Charges directes (bloc réel)</span>
              <span className="font-medium">-{formatEuro(lmnpReelUx.chargesDeductibles)}</span>
            </div>
            <div className="flex justify-between">
              <span>Amortissements (bloc séparé)</span>
              <span className="font-medium">-{formatEuro(lmnpReelUx.amortissementsComptabilises)}</span>
            </div>
          </div>
        </div>
        {!hasDebugLines && (
          <div className="rounded border border-slate-200 bg-white p-2 text-slate-700">
            <p className="text-[11px] leading-snug">
              Debug LMNP indisponible dans cette sauvegarde — relancez un recalcul manuel pour générer le debug.
            </p>
          </div>
        )}
      </div>

      {hasDebugLines && (
        <>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-600">
                  <th className="py-1 pr-2">Tx</th>
                  <th className="py-1 pr-2">Bien</th>
                  <th className="py-1 pr-2">Date</th>
                  <th className="py-1 pr-2">Mois comptable</th>
                  <th className="py-1 pr-2">Libellé</th>
                  <th className="py-1 pr-2">Catégorie</th>
                  <th className="py-1 pr-2">Nature</th>
                  <th className="py-1 pr-2">Rapproch.</th>
                  <th className="py-1 pr-2">Mapping LMNP</th>
                  <th className="py-1 pr-2">Bucket fiscal</th>
                  <th className="py-1 text-right">Montant</th>
                </tr>
              </thead>
              <tbody>
                {lmnpDebugCharges.lines.map((line) => (
                  <tr key={`${line.transactionId}-${line.bucketFiscal}`} className="border-b border-slate-100 align-top">
                    <td className="py-1 pr-2 font-mono text-[10px]">{line.transactionId.slice(0, 8)}</td>
                    <td className="py-1 pr-2 font-mono text-[10px]">{line.bienId.slice(0, 8)}</td>
                    <td className="py-1 pr-2">{line.date || '-'}</td>
                    <td className="py-1 pr-2">{line.moisComptable || '-'}</td>
                    <td className="py-1 pr-2">{line.libelle}</td>
                    <td className="py-1 pr-2">{line.categorie}</td>
                    <td className="py-1 pr-2">{line.nature}</td>
                    <td className="py-1 pr-2">{line.rapprochement}</td>
                    <td className="py-1 pr-2">{line.sourceMappingLmnp}</td>
                    <td className="py-1 pr-2">{line.bucketFiscal}</td>
                    <td className="py-1 text-right font-medium">
                      {line.bucketFiscal === 'charge_directe' ? '-' : ''}
                      {formatEuro(line.montant)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded border border-slate-200 bg-slate-50 p-2">
              <p className="text-[11px] font-semibold text-slate-700">Total par catégorie (charges directes)</p>
              <div className="mt-1 space-y-0.5 text-[11px]">
                {lmnpDebugCharges.totalsByCategory.map(([label, amount]) => (
                  <div key={label} className="flex justify-between">
                    <span>{label}</span>
                    <span className="font-medium">-{formatEuro(amount)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded border border-slate-200 bg-slate-50 p-2">
              <p className="text-[11px] font-semibold text-slate-700">Totaux rapprochement / par bien</p>
              <div className="mt-1 space-y-0.5 text-[11px]">
                {lmnpDebugCharges.totalsByBien.map(([bienId, amount]) => (
                  <div key={bienId} className="flex justify-between">
                    <span>Bien {bienId.slice(0, 8)}</span>
                    <span className="font-medium">-{formatEuro(amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between border-t border-slate-200 pt-1">
                  <span>Rapprochées</span>
                  <span className="font-medium">-{formatEuro(lmnpDebugCharges.totalRapprochees)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Non rapprochées</span>
                  <span className="font-medium">-{formatEuro(lmnpDebugCharges.totalNonRapprochees)}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
