'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type {
  Fiscal2044PropertySummary,
  Fiscal2044UiHintLine,
  Fiscal2044UiLineUsageTrace,
  RentalPropertyResult,
} from '@/types/fiscal';
import { useTransactionDocuments } from '@/hooks/offline/useTransactionDocuments';

const LIGNES_2044_REVENUS = ['211', '212', '213', '215'] as const;
const LIGNES_2044_CHARGES_DETAIL = ['221', '222', '223', '224', '225', '226', '227', '230'] as const;

const DETAILED_2044_LABELS: Record<string, string> = {
  '211': 'Loyers',
  '212': 'Recettes diverses',
  '213': 'Subventions / indemnites',
  '215': 'Autres recettes imposables',
  '221': 'Frais de gestion',
  '222': 'Forfait fiscal 20€/local',
  '223': 'Primes d assurance',
  '224': 'Travaux entretien/reparation',
  '225': 'Charges recuperables non recuperees',
  '226': 'Indemnites / relogement',
  '227': 'Taxes foncieres',
  '229': 'Total frais et charges',
  '230': 'Regularisations / divers',
  '420': 'Resultat foncier',
};

const MISSING_DECLARATIVE_LABELS: Record<string, string> = {
  bail: 'Bail / locataire',
  dateAcquisition: "Date d'acquisition",
  lots: 'Lots ou pièces',
};

const LINE_BUSINESS_LABELS: Record<Fiscal2044UiHintLine, string> = {
  '211': 'loyer',
  '221': 'frais de gestion',
  '222': 'forfait fiscal 20€/local',
  '223': "prime d’assurance",
  '224': 'travaux / entretien',
  '225': 'charges récupérables non récupérées',
  '227': 'taxe foncière',
  '230': 'régularisations / divers',
};

const TRACEABLE_LINES = new Set<Fiscal2044UiHintLine>(['211', '221', '222', '223', '224', '225', '227', '230']);

function isRealTransactionItem(item: { id: string; isSynthetic?: boolean }): boolean {
  if (item.isSynthetic) return false;
  if (String(item.id).startsWith('FORFAIT_')) return false;
  return true;
}

function firstRealTransactionId(trace: Fiscal2044UiLineUsageTrace | undefined): string | null {
  if (!trace || trace.isSynthetic) return null;
  const fromItem = trace.transactionItems?.find(
    (x) => !x.isSynthetic && !String(x.id).startsWith('FORFAIT_')
  )?.id;
  if (fromItem) return fromItem;
  const fromIds = trace.transactionIds?.find((id) => !String(id).startsWith('FORFAIT_'));
  return fromIds ?? null;
}

/** Icônes téléchargement PJ (même source que le drawer transaction : IndexedDB + /api/documents/…/file). */
function TransactionDocumentsDownloadIcons({
  transactionId,
  enabled,
  size = 'default',
}: {
  transactionId: string;
  enabled: boolean;
  size?: 'default' | 'inline';
}) {
  const { documents, loading } = useTransactionDocuments(transactionId, enabled);

  if (!enabled) return null;

  const iconClass = size === 'inline' ? 'h-3 w-3 shrink-0' : 'h-3.5 w-3.5 shrink-0';
  const btnClass =
    size === 'inline'
      ? 'inline-flex rounded p-0.5 text-emerald-700 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40'
      : 'inline-flex rounded p-1 text-emerald-700 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40';

  if (loading && documents.length === 0) {
    return (
      <span className="inline-flex items-center text-emerald-700/60" aria-hidden>
        <Loader2 className={iconClass + ' animate-spin'} />
      </span>
    );
  }

  if (documents.length === 0) return null;

  return (
    <span className="inline-flex flex-wrap items-center gap-0.5" aria-label="Pièces jointes">
      {documents.map((doc) => (
        <button
          key={doc.id}
          type="button"
          className={btnClass}
          title={`Télécharger : ${doc.filenameOriginal}`}
          aria-label={`Télécharger ${doc.filenameOriginal}`}
          onClick={() => {
            window.open(`/api/documents/${doc.id}/file`, '_blank', 'noopener,noreferrer');
          }}
        >
          <FileDown className={iconClass} />
        </button>
      ))}
    </span>
  );
}

export interface Declaration2044BienDetailPanelProps {
  bien: RentalPropertyResult;
  declaration: Fiscal2044PropertySummary;
  formatEuro: (amount: number) => string;
}

/**
 * Détail 2044 par bien (location nue) — même contenu que l’ancien bloc bas de page.
 */
export function Declaration2044BienDetailPanel({
  bien,
  declaration,
  formatEuro,
}: Declaration2044BienDetailPanelProps) {
  const [activeLine, setActiveLine] = useState<Fiscal2044UiHintLine | null>(null);
  const activeTrace = useMemo(
    () => (activeLine ? declaration?.uiLineUsageTrace?.[activeLine] : undefined),
    [activeLine, declaration],
  );

  const renderDelegatedSubline = (line: string) => {
    const lineKey = line as Fiscal2044UiHintLine;
    const info = declaration?.uiDelegatedHints?.byFiscalLine?.[lineKey];
    if (!info || info.count <= 0) return null;

    if (lineKey === '222') {
      const n = info.count;
      return (
        <div className="mt-0.5 space-y-1">
          <p className="text-[11px] text-gray-500">
            {n <= 1
              ? 'Forfait fiscal automatique : 20 € pour 1 lot loué'
              : `Forfait fiscal automatique : 20 € × ${n} lots loués`}
          </p>
          <p className="text-[10px] leading-snug text-gray-400">
            Forfait admis en revenus fonciers réels pour les frais de gestion non détaillés par ailleurs.
          </p>
        </div>
      );
    }

    if (info.count === 1) {
      const label = info.labels[0] || 'Transaction';
      const trace = declaration?.uiLineUsageTrace?.[lineKey];
      const txId = firstRealTransactionId(trace);

      return (
        <p className="mt-0.5 text-[11px] text-gray-500">
          1 transaction :{' '}
          <span className="inline-flex flex-wrap items-center gap-x-1 align-middle">
            <span className="break-words">{label}</span>
            {txId ? (
              <TransactionDocumentsDownloadIcons transactionId={txId} enabled size="inline" />
            ) : null}
          </span>
        </p>
      );
    }

    const fiscalLabel = LINE_BUSINESS_LABELS[lineKey] || (DETAILED_2044_LABELS[line] || `ligne ${line}`).toLowerCase();
    return <p className="mt-0.5 text-[11px] text-gray-500">{info.count} transactions de type {fiscalLabel}</p>;
  };

  return (
    <Card className="border border-emerald-200">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="font-semibold text-gray-900">{bien.nom}</p>
            <p className="text-xs text-gray-500">Lignes 2044 ventilées automatiquement</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1">
            {(() => {
              const amb = declaration?.quality?.ambiguousTransactions?.length ?? 0;
              const unmapped = declaration?.quality?.unmappedCount ?? 0;
              const dep = amb + unmapped;
              if (dep > 0) {
                return (
                  <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                    ⚠️ {dep} dépense{dep > 1 ? 's' : ''} à corriger (catégorisation)
                  </Badge>
                );
              }
              return (
                <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-300">
                  Ventilation cohérente
                </Badge>
              );
            })()}
            {(declaration?.quality?.missingHintCount ?? 0) > 0 && (
              <Badge variant="outline" className="bg-orange-50 text-orange-900 border-orange-200">
                ⚠️ Catégories fiscales incomplètes
              </Badge>
            )}
            {(declaration?.informationsBien?.missingDeclarative?.length || 0) > 0 && (
              <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300">
                Informations bien à compléter
              </Badge>
            )}
            {(declaration?.interetsEmpruntAnnee?.ambiguities?.length || 0) > 0 && (
              <Badge variant="outline" className="bg-orange-50 text-orange-900 border-orange-200">
                ⚠️ Prêts / intérêts — correction recommandée
              </Badge>
            )}
          </div>
        </div>

        {declaration?.informationsBien && (
          <div className="mb-4 rounded-md border border-slate-200 bg-slate-50/80 p-3 text-xs text-gray-800">
            <p className="font-semibold text-gray-900 mb-2">Informations du bien</p>
            <div className="grid gap-1 sm:grid-cols-2">
              <p>
                <span className="text-gray-500">Adresse :</span>{' '}
                {declaration.informationsBien.adresseFormatee || '—'}
              </p>
              <p>
                <span className="text-gray-500">Locataire(s) :</span>{' '}
                {declaration.informationsBien.locatairesNoms.length > 0
                  ? declaration.informationsBien.locatairesNoms.join(', ')
                  : '—'}
              </p>
              <p>
                <span className="text-gray-500">Date d&apos;acquisition :</span>{' '}
                {declaration.informationsBien.dateAcquisition || '—'}
              </p>
              <p>
                <span className="text-gray-500">Pièces (indicatif) :</span>{' '}
                {declaration.informationsBien.nombrePiecesOuLotsIndicatif ?? '—'}
              </p>
            </div>
            <p className="text-[11px] text-gray-500 mt-2">
              Baux pris en compte sur l&apos;année : {declaration.informationsBien.nombreBauxSurAnnee} — à titre
              d&apos;affichage uniquement (sans impact sur les calculs fiscaux).
            </p>
            {(declaration.informationsBien.missingDeclarative?.length || 0) > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {declaration.informationsBien.missingDeclarative.map((k) => (
                  <Badge
                    key={k}
                    variant="outline"
                    className="text-[10px] border-slate-300 bg-white text-slate-600"
                  >
                    {MISSING_DECLARATIVE_LABELS[k] || k}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {declaration?.interetsEmpruntAnnee && (
          <div className="mb-4 rounded-md border border-emerald-100 bg-emerald-50/40 p-3 text-xs text-gray-800">
            <p className="font-semibold text-gray-900 mb-2">
              Intérêts d&apos;emprunt (année {declaration.interetsEmpruntAnnee.annee})
            </p>
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
              <span className="text-gray-600">Total intérêts (hors capital, hors assurance)</span>
              <span className="text-base font-bold text-emerald-700">
                {formatEuro(declaration.interetsEmpruntAnnee.totalInteretsEmprunt)}
              </span>
            </div>
            <p className="text-[11px] text-gray-500 mb-2">
              Source : échéancier d&apos;amortissement (mensualité constante, taux fixe). Les intérêts sont ventilés en
              case 230 avec les autres charges « divers ».
            </p>
            {declaration.interetsEmpruntAnnee.totalAssuranceEmprunteur > 0 && (
              <p className="text-[11px] text-gray-600 mb-2">
                Assurance emprunteur (indicatif, non ajoutée au total intérêts ci-dessus) :{' '}
                {formatEuro(declaration.interetsEmpruntAnnee.totalAssuranceEmprunteur)}
              </p>
            )}
            {declaration.interetsEmpruntAnnee.byLoan.length > 0 && (
              <ul className="mt-1 space-y-1 border-t border-emerald-100 pt-2">
                {declaration.interetsEmpruntAnnee.byLoan.map((row) => (
                  <li key={row.loanId} className="flex justify-between gap-2">
                    <span className="text-gray-700">{row.label}</span>
                    <span className="font-medium text-gray-900">
                      {formatEuro(row.interetsPayesAnnee)}
                      <span className="text-gray-400 font-normal">
                        {' '}
                        ({row.nombreEcheancesDansAnnee} échéance(s))
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {declaration.interetsEmpruntAnnee.ambiguities.length > 0 && (
              <ul className="mt-2 space-y-1 border-t border-amber-100 pt-2 text-amber-900">
                {declaration.interetsEmpruntAnnee.ambiguities.map((a, i) => (
                  <li key={`${a.loanId}-${i}`}>
                    <span className="font-medium">{a.loanLabel}</span> — {a.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <p className="text-[11px] text-gray-500 mb-2">
          Pour copier un montant vers impots.gouv, utilisez la checklist en haut de page (bouton Copier par ligne).
        </p>
        <div className="space-y-4 text-xs">
          <div>
            <p className="font-semibold text-gray-900 mb-2 border-b border-emerald-100 pb-1">Revenus (2044)</p>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2">Case</th>
                    <th className="text-left py-2">Libellé</th>
                    <th className="text-right py-2">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {LIGNES_2044_REVENUS.map((line) => (
                    <tr key={`${bien.id}-${line}`} className="border-b border-gray-100">
                      <td className="py-2 font-mono">{line}</td>
                      <td className="py-2">
                        <div>
                          <button
                            type="button"
                            className="text-left text-gray-900 hover:underline"
                            onClick={() => {
                              const traceLine = line as Fiscal2044UiHintLine;
                              if (TRACEABLE_LINES.has(traceLine)) setActiveLine(traceLine);
                            }}
                          >
                            {DETAILED_2044_LABELS[line]}
                          </button>
                          {renderDelegatedSubline(line)}
                        </div>
                      </td>
                      <td className="py-2 text-right font-semibold">
                        {formatEuro(declaration?.lines?.[line] || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <p className="font-semibold text-gray-900 mb-2 border-b border-emerald-100 pb-1">
              Charges détaillées (hors total)
            </p>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2">Case</th>
                    <th className="text-left py-2">Libellé</th>
                    <th className="text-right py-2">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {LIGNES_2044_CHARGES_DETAIL.map((line) => (
                    <tr key={`${bien.id}-${line}`} className="border-b border-gray-100">
                      <td className="py-2 font-mono">{line}</td>
                      <td className="py-2">
                        <div>
                          <button
                            type="button"
                            className="text-left text-gray-900 hover:underline"
                            onClick={() => {
                              const traceLine = line as Fiscal2044UiHintLine;
                              if (TRACEABLE_LINES.has(traceLine)) setActiveLine(traceLine);
                            }}
                          >
                            {DETAILED_2044_LABELS[line]}
                          </button>
                          {renderDelegatedSubline(line)}
                        </div>
                      </td>
                      <td className="py-2 text-right font-semibold">
                        {formatEuro(declaration?.lines?.[line] || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <p className="font-semibold text-gray-900 mb-2 border-b border-emerald-100 pb-1">Totaux et résultat</p>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2">Case</th>
                    <th className="text-left py-2">Libellé</th>
                    <th className="text-right py-2">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {(['229', '420'] as const).map((line) => (
                    <tr key={`${bien.id}-${line}`} className="border-b border-gray-100">
                      <td className="py-2 font-mono">{line}</td>
                      <td className="py-2">{DETAILED_2044_LABELS[line]}</td>
                      <td className="py-2 text-right font-semibold">
                        {formatEuro(declaration?.lines?.[line] || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </CardContent>
      <Sheet open={Boolean(activeLine)} onOpenChange={(open) => !open && setActiveLine(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>
              {activeLine ? `Ligne ${activeLine} - ${DETAILED_2044_LABELS[activeLine] || 'Détail'}` : 'Détail'}
            </SheetTitle>
            <SheetDescription>
              {activeLine === '222'
                ? 'Calcul automatique pour la ligne 222 (aucune transaction source).'
                : 'Détail des montants retenus pour cette ligne 2044.'}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            {activeLine && activeTrace?.transactionItems && activeTrace.transactionItems.length > 0 ? (
              <>
                {activeTrace.transactionItems.map((item) => (
                  <div key={item.id} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm text-slate-900">{item.label}</p>
                      <p className="text-sm font-semibold text-slate-900">{formatEuro(item.amount)}</p>
                    </div>
                    {item.isSynthetic && activeLine === '222' ? (
                      <div className="mt-2 space-y-2 border-t border-slate-100 pt-2 text-xs text-slate-600">
                        <p className="font-medium text-slate-800">Calcul fiscal automatique</p>
                        <p>Aucune transaction source.</p>
                        <p>
                          {(() => {
                            const n =
                              declaration?.uiDelegatedHints?.byFiscalLine?.['222']?.count ??
                              activeTrace?.syntheticUnits ??
                              1;
                            const suffix = n === 1 ? '1 lot retenu' : `${n} lots retenus`;
                            return (
                              <>
                                Montant calculé : 20&nbsp;€ × {suffix}
                              </>
                            );
                          })()}
                        </p>
                        <p className="text-[11px] leading-snug text-slate-500">
                          Forfait admis en revenus fonciers réels pour les frais de gestion non détaillés par ailleurs.
                        </p>
                      </div>
                    ) : item.isSynthetic ? (
                      <p className="mt-2 text-xs text-slate-500">Élément calculé fiscalement (sans transaction source).</p>
                    ) : (
                      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Link
                          href={`/app?view=transactions&propertyId=${encodeURIComponent(bien.id)}&highlight=${encodeURIComponent(item.id)}`}
                          className="text-xs text-emerald-700 hover:underline"
                        >
                          Ouvrir la transaction
                        </Link>
                        <TransactionDocumentsDownloadIcons
                          transactionId={item.id}
                          enabled={Boolean(activeLine) && isRealTransactionItem(item)}
                        />
                      </div>
                    )}
                  </div>
                ))}
                <div className="rounded-md border border-slate-200 p-3 text-xs text-slate-600">
                  Total ligne: {formatEuro(activeTrace.amountFromTransactions)}
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500">Aucune transaction retenue pour cette ligne.</p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </Card>
  );
}
