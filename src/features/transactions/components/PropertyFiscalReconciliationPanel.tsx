'use client';

import { useMemo, useState, type ReactNode } from 'react';
import type { RentalPropertyInput } from '@/types/fiscal';
import type { PropertyGestionMetrics } from '@/features/transactions/lib/propertyGestionMetrics';

function fmtEuro(n: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtDiffEuro(a: number | null, b: number | null): string {
  if (a === null || b === null) return '—';
  return fmtEuro(a - b);
}

/** Partition indicative des exclusions agrégateur (motifs dans `reason`). */
function partitionExclusions(exclusions: Array<{ amountAbs: number; reason: string }>) {
  let horsAnneeFiscale = 0;
  let capitalisable = 0;
  let flowIndetermine = 0;
  let autres = 0;
  for (const e of exclusions) {
    const r = String(e.reason || '').toLowerCase();
    if (r.includes('hors année') || r.includes('hors annee')) {
      horsAnneeFiscale += e.amountAbs;
    } else if (r.includes('capitalisable')) {
      capitalisable += e.amountAbs;
    } else if (r.includes('indéterminé') || r.includes('indetermine')) {
      flowIndetermine += e.amountAbs;
    } else {
      autres += e.amountAbs;
    }
  }
  return { horsAnneeFiscale, capitalisable, flowIndetermine, autres };
}

function EcartDetailBox({
  title,
  lines,
  footerNote,
}: {
  title: string;
  lines: { label: string; amount: number }[];
  footerNote?: string;
}) {
  const shown = lines.filter((l) => l.amount > 0.5);
  if (shown.length === 0 && !footerNote) return null;
  return (
    <div className="mt-2 rounded-md border border-indigo-100/90 bg-white/80 px-2.5 py-2 text-[10px] leading-snug text-slate-700">
      <p className="font-semibold text-indigo-950">{title}</p>
      {shown.length > 0 && (
        <>
          <p className="mt-1 font-medium text-slate-800">Dont :</p>
          <ul className="mt-0.5 list-disc space-y-0.5 pl-4">
            {shown.map((l) => (
              <li key={l.label}>
                {l.label} : <span className="tabular-nums font-medium">{fmtEuro(l.amount)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {footerNote ? <p className="mt-1.5 text-slate-600 italic">{footerNote}</p> : null}
    </div>
  );
}

interface ReconciliationRow {
  id: string;
  simple: boolean;
  label: string;
  /** Libellé court en mode simplifié */
  labelSimple?: string;
  gestion: ReactNode;
  fiscal: ReactNode;
  ecart: ReactNode;
  explication: string;
}

export interface PropertyFiscalReconciliationPanelProps {
  gestion: PropertyGestionMetrics;
  bienFiscal: RentalPropertyInput | null;
  fiscalPedagogy: { resultatAvantAmortissements: number } | null;
  fiscalYear: number;
  /** Période mois comptable (filtre gestion actif), ex. 2025-01 → 2025-12 */
  periodStart: string;
  periodEnd: string;
  loading?: boolean;
  notLmnpEligible?: boolean;
  /** Si true : mode expert, détails d’écart techniques (réservé au debug fiscal). */
  debugMode?: boolean;
}

export function PropertyFiscalReconciliationPanel({
  gestion,
  bienFiscal,
  fiscalPedagogy,
  fiscalYear,
  periodStart,
  periodEnd,
  loading,
  notLmnpEligible,
  debugMode = false,
}: PropertyFiscalReconciliationPanelProps) {
  const [expertMode, setExpertMode] = useState(false);

  const p = bienFiscal?.breakdown?.lmnpDebug?.perimetreDiagnostic;
  const exclusions = p?.exclusionsDetaillees ?? [];

  const partExcl = useMemo(() => partitionExclusions(exclusions), [exclusions]);

  const fiscalTxCount = p?.transactionsApresDedup ?? null;
  const fiscalRecettesCount = p?.nombreRecettesSynthese ?? null;
  const fiscalTotalRecettes = p?.totalRecettesRetenues ?? null;
  const fiscalDepensesSynthCount = p?.nombreDepensesSynthese ?? null;
  const fiscalChargesTx = p ? p.chargesFromTransactionsCents / 100 : null;
  const fiscalChargesHorsTx = p ? p.chargesOutsideTransactionsCents / 100 : null;
  const fiscalChargesTotales = p ? p.chargesTotalSimulatorCents / 100 : null;
  const fiscalAmort = p?.montantAmortissementsComptablesHorsTransactions ?? null;
  const resultatAvantAmort = fiscalPedagogy?.resultatAvantAmortissements ?? null;

  const rows = useMemo((): ReconciliationRow[] => {
    return [
      {
        id: 'tx_count',
        simple: false,
        label: 'Nombre total de transactions',
        gestion: gestion.transactionCount,
        fiscal: fiscalTxCount ?? '—',
        ecart: fiscalTxCount != null ? `${gestion.transactionCount - fiscalTxCount}` : '—',
        explication:
          'La gestion filtre par mois comptable ; le fiscal dédoublonne et filtre par année d’encaissement et règles d’éligibilité.',
      },
      {
        id: 'rec_lines',
        simple: false,
        label: 'Nombre de recettes (lignes)',
        gestion: gestion.recettesCount,
        fiscal: fiscalRecettesCount ?? '—',
        ecart:
          fiscalRecettesCount != null ? `${gestion.recettesCount - fiscalRecettesCount}` : '—',
        explication:
          'Des encaissements peuvent tomber hors année fiscale affichée ou être exclus (autre bien, doublon, flux non reconnu).',
      },
      {
        id: 'rec_tot',
        simple: true,
        labelSimple: 'Recettes',
        label: 'Recettes fiscales retenues (année fiscale sélectionnée)',
        gestion: fmtEuro(gestion.totalRecettes),
        fiscal: fiscalTotalRecettes != null ? fmtEuro(fiscalTotalRecettes) : '—',
        ecart:
          fiscalTotalRecettes != null ? fmtDiffEuro(gestion.totalRecettes, fiscalTotalRecettes) : '—',
        explication:
          'Les recettes fiscales suivent la date d’encaissement et les natures éligibles ; la gestion suit le mois comptable.',
      },
      {
        id: 'dep_lines',
        simple: false,
        label: 'Nombre dépenses / charges (lignes)',
        gestion: gestion.depensesCount,
        fiscal: fiscalDepensesSynthCount ?? '—',
        ecart:
          fiscalDepensesSynthCount != null
            ? `${gestion.depensesCount - fiscalDepensesSynthCount}`
            : '—',
        explication:
          'Le fiscal distingue charges déductibles LMNP, travaux capitalisés et lignes hors synthèse immédiate.',
      },
      {
        id: 'charges_lmnp',
        simple: true,
        labelSimple: 'Dépenses / charges déductibles LMNP',
        label: 'Charges déductibles LMNP (issues des transactions)',
        gestion: fmtEuro(gestion.totalDepensesAbs),
        fiscal: fiscalChargesTx != null ? fmtEuro(fiscalChargesTx) : '—',
        ecart: fiscalChargesTx != null ? fmtDiffEuro(gestion.totalDepensesAbs, fiscalChargesTx) : '—',
        explication:
          'Les totaux gestion comptabilisent les dépenses sur le mois comptable ; le fiscal ne retient que les charges déductibles selon les catégories LMNP et l’année d’encaissement.',
      },
      {
        id: 'hors_tx',
        simple: true,
        labelSimple: 'Charges hors transactions',
        label: 'Charges hors transactions',
        gestion: '—',
        fiscal: fiscalChargesHorsTx != null ? fmtEuro(fiscalChargesHorsTx) : '—',
        ecart: '—',
        explication:
          'Intérêts d’emprunt, assurance emprunteur, forfaits ou montants calculés hors mouvements du bien.',
      },
      {
        id: 'charges_tot',
        simple: false,
        label: 'Charges déductibles totales (simulateur)',
        gestion: '—',
        fiscal: fiscalChargesTotales != null ? fmtEuro(fiscalChargesTotales) : '—',
        ecart: '—',
        explication: 'Somme des charges « bien » et composantes emprunt retenues par le moteur fiscal.',
      },
      {
        id: 'amort',
        simple: false,
        label: 'Amortissements comptabilisés',
        gestion: '—',
        fiscal: fiscalAmort != null ? fmtEuro(fiscalAmort) : '—',
        ecart: '—',
        explication: 'Pas d’équivalent direct en vue gestion sur cette période.',
      },
      {
        id: 'result',
        simple: true,
        labelSimple: 'Résultat',
        label: 'Résultat (avant amortissements fiscaux)',
        gestion: fmtEuro(gestion.soldeNet),
        fiscal: resultatAvantAmort != null ? fmtEuro(resultatAvantAmort) : '—',
        ecart: resultatAvantAmort != null ? fmtDiffEuro(gestion.soldeNet, resultatAvantAmort) : '—',
        explication:
          'Le solde gestion est recettes − dépenses sur la période filtrée ; le résultat fiscal avant amort. suit la base LMNP agrégée sur l’année d’encaissement.',
      },
    ];
  }, [
    gestion,
    fiscalTxCount,
    fiscalRecettesCount,
    fiscalTotalRecettes,
    fiscalDepensesSynthCount,
    fiscalChargesTx,
    fiscalChargesHorsTx,
    fiscalChargesTotales,
    fiscalAmort,
    resultatAvantAmort,
  ]);

  const visibleRows = useMemo(() => {
    if (!debugMode) return rows.filter((r) => r.simple);
    if (expertMode) return rows;
    return rows.filter((r) => r.simple);
  }, [rows, debugMode, expertMode]);

  function ecartDetailForRow(rowId: string): {
    title: string;
    lines: { label: string; amount: number }[];
    footer?: string;
  } | null {
    if (!debugMode) return null;
    if (rowId === 'rec_tot' && fiscalTotalRecettes != null) {
      const absDiff = Math.abs(gestion.totalRecettes - fiscalTotalRecettes);
      if (absDiff < 0.5) return null;
      return {
        title: `Écart recettes : ${fmtEuro(absDiff)}`,
        lines: [
          {
            label: 'Montants associés à des exclusions « hors année fiscale » (tous flux, indicateur de décalage d’encaissement)',
            amount: partExcl.horsAnneeFiscale,
          },
          {
            label: 'Exclues ou traitées à part (ex. charge capitalisable, flux indéterminé)',
            amount: partExcl.capitalisable + partExcl.flowIndetermine,
          },
          { label: 'Autres motifs d’exclusion listés par le moteur', amount: partExcl.autres },
        ],
        footer:
          'L’écart recettes intègre aussi le décalage entre mois comptable et date d’encaissement ; les montants ci-dessus proviennent des exclusions enregistrées côté agrégateur.',
      };
    }

    if (rowId === 'charges_lmnp' && fiscalChargesTx != null) {
      const absDiff = Math.abs(gestion.totalDepensesAbs - fiscalChargesTx);
      if (absDiff < 0.5) return null;
      return {
        title: `Écart dépenses / charges déductibles LMNP : ${fmtEuro(absDiff)}`,
        lines: [
          {
            label: 'Dont exclusions « charge capitalisable » (hors charges déductibles courantes)',
            amount: partExcl.capitalisable,
          },
          {
            label: 'Dont exclusions « hors année fiscale » (décalage d’encaissement)',
            amount: partExcl.horsAnneeFiscale,
          },
          {
            label: 'Autres motifs (non déductible LMNP, mapping catégorie, etc.)',
            amount: Math.max(0, partExcl.autres + partExcl.flowIndetermine),
          },
        ],
        footer:
          'Une même transaction peut être en dépense gestion mais non retenue comme charge déductible LMNP, ou inversement selon la catégorie et l’année d’encaissement.',
      };
    }

    if (rowId === 'result' && resultatAvantAmort != null) {
      const absDiff = Math.abs(gestion.soldeNet - resultatAvantAmort);
      if (absDiff < 0.5) return null;
      return {
        title: `Écart sur le résultat : ${fmtEuro(absDiff)}`,
        lines: [],
        footer:
          'Cet écart cumule les différences recettes et charges ci-dessus (périodes et règles distinctes), ainsi que les charges hors transactions présentes uniquement en fiscal.',
      };
    }

    return null;
  }

  return (
    <div className="rounded-lg border border-indigo-200/80 bg-indigo-50/40 px-3 py-3 text-[11px] text-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="font-semibold text-indigo-950">
          Rapprochement gestion vs fiscal · année fiscale {fiscalYear}
        </p>
        {debugMode ? (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] uppercase tracking-wide text-slate-500">Affichage</span>
            <div className="inline-flex rounded-lg border border-indigo-200/80 bg-white p-0.5 shadow-sm">
              <button
                type="button"
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  !expertMode ? 'bg-indigo-600 text-white shadow' : 'text-slate-600 hover:bg-slate-100'
                }`}
                onClick={() => setExpertMode(false)}
              >
                Simplifié
              </button>
              <button
                type="button"
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  expertMode ? 'bg-indigo-600 text-white shadow' : 'text-slate-600 hover:bg-slate-100'
                }`}
                onClick={() => setExpertMode(true)}
              >
                Expert
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-3 rounded-md border border-indigo-100 bg-white/70 px-3 py-2.5 text-[11px] text-slate-800">
        <p className="font-semibold text-indigo-950">Périmètres comparés</p>
        <ul className="mt-1.5 list-disc space-y-1 pl-4 leading-snug text-slate-700">
          <li>
            <strong>Gestion</strong> → basé sur le <strong>mois comptable</strong> (filtre actif :{' '}
            <span className="tabular-nums font-medium">
              {periodStart} → {periodEnd}
            </span>
            ).
          </li>
          <li>
            <strong>Fiscal</strong> → basé sur la <strong>date d’encaissement</strong> (année fiscale sélectionnée :{' '}
            <span className="tabular-nums font-medium">{fiscalYear}</span>).
          </li>
        </ul>
      </div>

      {loading && <p className="mt-2 text-slate-600">Chargement du périmètre fiscal…</p>}
      {notLmnpEligible && !loading && (
        <p className="mt-2 text-slate-700">
          La ventilation LMNP détaillée s’applique aux biens en régime BIC meublé / LMNP au réel. Les montants
          ci-dessous restent indicatifs si le bien n’est pas dans ce périmètre.
        </p>
      )}
      {!loading && bienFiscal && !p && (
        <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-amber-900">
          Données fiscales LMNP indisponibles pour ce bien ou cette année (aucun bloc diagnostic dans l’agrégat).
        </p>
      )}

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr className="border-b border-indigo-200 text-[10px] uppercase tracking-wide text-slate-600">
              <th className="py-2 pr-2 font-semibold">Indicateur</th>
              <th className="py-2 pr-2 font-semibold">Vue gestion</th>
              <th className="py-2 pr-2 font-semibold">Vue fiscale</th>
              <th className="py-2 pr-2 font-semibold">Écart</th>
              <th className="py-2 font-semibold">Explication</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((r) => {
              const detail = ecartDetailForRow(r.id);
              return (
                <tr key={r.id} className="border-b border-indigo-100/80 align-top">
                  <td className="py-2 pr-2 text-slate-800">
                    {debugMode && expertMode ? r.label : (r.labelSimple ?? r.label)}
                  </td>
                  <td className="py-2 pr-2 tabular-nums">{r.gestion}</td>
                  <td className="py-2 pr-2 tabular-nums">{r.fiscal}</td>
                  <td className="py-2 pr-2 tabular-nums text-slate-700">
                    <div>{r.ecart}</div>
                    {detail ? (
                      <EcartDetailBox
                        title={detail.title}
                        lines={detail.lines}
                        footerNote={detail.footer}
                      />
                    ) : null}
                  </td>
                  <td className="py-2 text-slate-600 leading-snug">{r.explication}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {debugMode ? (
        <p className="mt-3 rounded-md border border-slate-200 bg-slate-50/90 px-3 py-2 text-[11px] leading-snug text-slate-700">
          Les montants fiscaux peuvent différer des montants de gestion car ils appliquent des règles différentes :
          période d’encaissement, éligibilité fiscale, exclusion de certaines opérations et ajout de charges hors
          transactions (intérêts, assurance, amortissements).
        </p>
      ) : (
        <p className="mt-2 text-[10px] text-slate-600">
          Les écarts sont normaux : mois comptable (gestion) et encaissement / règles LMNP (fiscal).
        </p>
      )}
    </div>
  );
}
