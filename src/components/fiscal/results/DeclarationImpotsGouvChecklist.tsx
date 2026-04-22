'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BlockCard } from './BlockCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip';
import type { Fiscal2044PropertySummary, RentalPropertyResult, SimulationResult } from '@/types/fiscal';
import {
  buildDeclarationChecklistStorageKey,
  loadChecklistState,
  setStepStatus,
  clearStepStatus,
  type ChecklistPersistedPayload,
  type ChecklistPersistedStatus,
} from '@/lib/fiscal/declarationImpotsGouvChecklistStorage';
import { Copy, CheckCircle2, ExternalLink, AlertTriangle, Info, Undo2 } from 'lucide-react';

const LIGNES_2044_CHECKLIST = [
  '211',
  '221',
  '222',
  '223',
  '224',
  '225',
  '226',
  '227',
  '229',
  '230',
  '420',
] as const;

const LABELS_2044: Record<string, string> = {
  '211': 'Loyers',
  '221': 'Frais de gestion',
  '222': 'Forfait fiscal 20€/local',
  '223': "Primes d'assurance",
  '224': 'Travaux entretien / réparation',
  '225': 'Charges récup. non récupérées',
  '226': 'Indemnités / relogement',
  '227': 'Taxes foncières',
  '229': 'Total frais et charges',
  '230': 'Régularisations / divers (dont intérêts d’emprunt)',
  '420': 'Résultat foncier',
};

export type ChecklistDisplayStatus = 'a_faire' | 'copie' | 'termine' | 'a_verifier';

interface FiscalCaseLite {
  code: string;
  libelle: string;
  montant: number;
  formulaire: '2042' | '2044';
  explication: string;
  source?: string;
  provenance: string;
}

export interface DeclarationChecklistRow {
  id: string;
  ordre: number;
  formulaire: '2042' | '2044';
  caseCode: string;
  libelle: string;
  montant: number;
  propertyId?: string;
  propertyName?: string;
  mappingAmbiguityOn230: boolean;
  loanAmbiguityOn230: boolean;
  missingDeclarativeContext: boolean;
  fiscalCase2042?: FiscalCaseLite;
}

const STATUS_UI: Record<
  ChecklistDisplayStatus,
  { label: string; className: string }
> = {
  a_faire: { label: '⚪ À faire', className: 'bg-slate-100 text-slate-800 border-slate-300' },
  copie: { label: '🔵 Copié', className: 'bg-sky-100 text-sky-900 border-sky-300' },
  termine: { label: '🟢 Terminé', className: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
  a_verifier: {
    label: '🟠 Catégorisation incertaine',
    className: 'bg-orange-100 text-orange-900 border-orange-300',
  },
};

function needsVerifierAttention(row: DeclarationChecklistRow): boolean {
  return row.mappingAmbiguityOn230 || row.loanAmbiguityOn230 || row.missingDeclarativeContext;
}

function deriveDisplayStatus(
  persisted: ChecklistPersistedStatus | undefined,
  row: DeclarationChecklistRow
): ChecklistDisplayStatus {
  if (persisted === 'termine') return 'termine';
  if (persisted === 'copie') {
    if (needsVerifierAttention(row)) return 'a_verifier';
    return 'copie';
  }
  if (needsVerifierAttention(row)) return 'a_verifier';
  return 'a_faire';
}

function buildRows(
  declarationByProperty: Array<{ bien: RentalPropertyResult; declaration: Fiscal2044PropertySummary }>,
  cases2042: FiscalCaseLite[]
): DeclarationChecklistRow[] {
  const rows: DeclarationChecklistRow[] = [];
  let ordre = 0;

  const push2042 = (c: FiscalCaseLite) => {
    if (Math.abs(c.montant) < 0.005) return;
    ordre += 1;
    rows.push({
      id: `2042-${c.code}`,
      ordre,
      formulaire: '2042',
      caseCode: c.code,
      libelle: c.libelle,
      montant: c.montant,
      mappingAmbiguityOn230: false,
      loanAmbiguityOn230: false,
      missingDeclarativeContext: false,
      fiscalCase2042: c,
    });
  };

  for (const code of ['1AJ', '4BA', '6NS'] as const) {
    const c = cases2042.find((x) => x.code === code);
    if (c) push2042(c);
  }

  for (const { bien, declaration } of declarationByProperty) {
    const ambTx = (declaration.quality?.ambiguousTransactions?.length ?? 0) > 0;
    const unmapped = (declaration.quality?.unmappedCount ?? 0) > 0;
    const mappingAmbiguityOn230 = ambTx || unmapped;
    const loanAmb = (declaration.interetsEmpruntAnnee?.ambiguities?.length ?? 0) > 0;
    const missingCtx = (declaration.informationsBien?.missingDeclarative?.length ?? 0) > 0;

    for (const line of LIGNES_2044_CHECKLIST) {
      const rawAmount = declaration.lines?.[line as keyof typeof declaration.lines] ?? 0;
      const interets = declaration.interetsEmpruntAnnee?.totalInteretsEmprunt ?? 0;
      const include230ForInterest = line === '230' && Math.abs(rawAmount) < 0.005 && interets > 0.005;
      if (Math.abs(rawAmount) < 0.005 && !include230ForInterest) continue;

      const montant =
        line === '230' && Math.abs(rawAmount) < 0.005 && interets > 0.005 ? interets : rawAmount;

      ordre += 1;
      const loanAmbiguityOn230 = line === '230' && loanAmb;

      rows.push({
        id: `2044-${bien.id}-${line}`,
        ordre,
        formulaire: '2044',
        caseCode: line,
        libelle: LABELS_2044[line] || line,
        montant,
        propertyId: bien.id,
        propertyName: bien.nom,
        mappingAmbiguityOn230: line === '230' && mappingAmbiguityOn230,
        loanAmbiguityOn230,
        missingDeclarativeContext: missingCtx,
      });
    }
  }

  return rows;
}

type DeclarationChecklistGroup = {
  key: string;
  title: string;
  subtitle?: string;
  /** Présent pour les blocs 2044 par bien : lien « Voir le détail du bien » unique en en-tête. */
  propertyId?: string;
  rows: DeclarationChecklistRow[];
};

function buildRowGroups(rows: DeclarationChecklistRow[]): DeclarationChecklistGroup[] {
  const groups: DeclarationChecklistGroup[] = [];
  const r2042 = rows.filter((r) => r.formulaire === '2042');
  if (r2042.length) {
    groups.push({
      key: '2042',
      title: '2042',
      subtitle: 'Déclaration de revenus — cases à reporter',
      rows: r2042,
    });
  }
  const byProp = new Map<string, DeclarationChecklistRow[]>();
  for (const r of rows.filter((r) => r.formulaire === '2044')) {
    const pid = r.propertyId!;
    if (!byProp.has(pid)) byProp.set(pid, []);
    byProp.get(pid)!.push(r);
  }
  for (const [, list] of byProp) {
    const name = list[0]?.propertyName || 'Bien';
    const pid = list[0]?.propertyId;
    groups.push({
      key: pid || name,
      title: name,
      subtitle: '2044 — revenus fonciers (ce bien)',
      propertyId: pid,
      rows: list,
    });
  }
  return groups;
}

export interface DeclarationImpotsGouvChecklistProps {
  simulation: SimulationResult;
  declarationByProperty: Array<{ bien: RentalPropertyResult; declaration: Fiscal2044PropertySummary }>;
  cases2042: FiscalCaseLite[];
  formatEuro: (n: number) => string;
  copyMontantPourImpots: (code: string, montant: number) => Promise<void>;
  /** Ouvre le détail 2044 du bien (modal) au lieu d’une ancre en bas de page. */
  onOpenDeclarationBienDetail?: (propertyId: string) => void;
  onOpenDetail2042?: (c: FiscalCaseLite) => void;
  onOpenCategorizationAssistant?: () => void;
}

export function DeclarationImpotsGouvChecklist({
  simulation,
  declarationByProperty,
  cases2042,
  formatEuro,
  copyMontantPourImpots,
  onOpenDeclarationBienDetail,
  onOpenDetail2042,
  onOpenCategorizationAssistant,
}: DeclarationImpotsGouvChecklistProps) {
  const storageKey = useMemo(() => buildDeclarationChecklistStorageKey(simulation), [simulation]);

  const rows = useMemo(
    () => buildRows(declarationByProperty, cases2042),
    [declarationByProperty, cases2042]
  );

  const groups = useMemo(() => buildRowGroups(rows), [rows]);

  const [persisted, setPersisted] = useState<ChecklistPersistedPayload>({ steps: {} });

  useEffect(() => {
    setPersisted(loadChecklistState(storageKey));
  }, [storageKey]);

  const persistCopy = useCallback(
    (stepId: string) => {
      setPersisted(setStepStatus(storageKey, stepId, 'copie'));
    },
    [storageKey]
  );

  const persistTermine = useCallback(
    (stepId: string) => {
      setPersisted(setStepStatus(storageKey, stepId, 'termine'));
    },
    [storageKey]
  );

  const persistClear = useCallback(
    (stepId: string) => {
      setPersisted(clearStepStatus(storageKey, stepId));
    },
    [storageKey]
  );

  const handleCopy = useCallback(
    async (row: DeclarationChecklistRow) => {
      const clipCode = row.propertyId ? `2044-${row.caseCode}-${row.propertyId}` : row.caseCode;
      await copyMontantPourImpots(clipCode, row.montant);
      persistCopy(row.id);
    },
    [copyMontantPourImpots, persistCopy]
  );

  const handleToggleDone = useCallback(
    (row: DeclarationChecklistRow) => {
      const p = persisted.steps[row.id]?.status;
      if (p === 'termine') persistClear(row.id);
      else persistTermine(row.id);
    },
    [persisted.steps, persistClear, persistTermine]
  );

  const handleAnnuler = useCallback(
    (row: DeclarationChecklistRow) => {
      persistClear(row.id);
    },
    [persistClear]
  );

  if (rows.length === 0) {
    return null;
  }

  const total = rows.length;

  const case4baTooltip =
    'La déclaration 2044 calcule votre résultat foncier. Ce résultat est ensuite automatiquement reporté dans la case 4BA de la 2042 par impots.gouv.';

  return (
    <TooltipProvider delayDuration={200}>
    <BlockCard
      title="✅ Étapes de saisie impots.gouv"
      icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden />}
      badge={
        <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-200 text-xs">
          {total} montant{total > 1 ? 's' : ''} à reporter
        </Badge>
      }
    >
      <Card className="border border-emerald-200 bg-white shadow-sm">
        <CardContent className="p-4 space-y-4 text-sm">
          <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-sm text-emerald-950">
            <span className="font-semibold">🎯 Parcours conseillé</span>
            <span className="text-emerald-900">
              {' '}
              — Commencez par compléter la déclaration <strong>2044</strong> sur impots.gouv, puis vérifiez les
              montants repris dans la <strong>2042</strong> (la case <strong>4BA</strong> est en principe pré-remplie
              après la 2044). Copiez les montants ci-dessous pour contrôle ou saisie ponctuelle, puis marquez chaque
              ligne terminée lorsque c&apos;est fait sur le site.
            </span>
          </div>

          <p className="text-xs text-gray-600">
            Les statuts <strong>Copié</strong>, <strong>Terminé</strong> et vos annulations sont mémorisés sur cet
            appareil (année {simulation.inputs.year}, composition actuelle des biens).
          </p>

          <div className="space-y-6">
            {groups.map((g) => (
              <section key={g.key} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <h3 className="font-semibold text-gray-900">{g.title}</h3>
                    {g.propertyId &&
                      (onOpenDeclarationBienDetail ? (
                        <button
                          type="button"
                          onClick={() => onOpenDeclarationBienDetail(g.propertyId!)}
                          className="inline-flex items-center gap-0.5 text-[11px] font-medium text-emerald-700 hover:underline"
                        >
                          Voir le détail du bien
                          <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                        </button>
                      ) : (
                        <a
                          href={`#declaration-bien-${g.propertyId}`}
                          className="inline-flex items-center gap-0.5 text-[11px] font-medium text-emerald-700 hover:underline"
                        >
                          Voir le détail du bien
                          <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                        </a>
                      ))}
                  </div>
                  {g.subtitle && <p className="text-[11px] text-gray-500 mt-0.5">{g.subtitle}</p>}
                </div>
                <ul className="divide-y divide-gray-100">
                  {g.rows.map((row) => {
                    const p = persisted.steps[row.id]?.status;
                    const display = deriveDisplayStatus(p, row);
                    const badge = STATUS_UI[display];
                    const hasPersisted = p === 'copie' || p === 'termine';

                    return (
                      <li key={row.id} className="p-3 sm:p-4 hover:bg-emerald-50/20">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              {row.formulaire === '2042' && row.caseCode === '4BA' ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex cursor-help rounded-md focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-400">
                                      <Badge
                                        variant="outline"
                                        className="font-mono text-xs bg-emerald-50 text-emerald-900 border-emerald-200"
                                      >
                                        {row.caseCode}
                                      </Badge>
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-xs text-left text-xs leading-relaxed">
                                    {case4baTooltip}
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="font-mono text-xs bg-emerald-50 text-emerald-900 border-emerald-200"
                                >
                                  {row.caseCode}
                                </Badge>
                              )}
                              <Badge variant="outline" className={`text-[11px] ${badge.className}`}>
                                {badge.label}
                              </Badge>
                            </div>
                            <p className="text-sm font-medium text-gray-900">{row.libelle}</p>
                            {row.formulaire === '2042' && row.caseCode === '4BA' && (
                              <div className="flex items-start gap-1.5 rounded-md border border-sky-200 bg-sky-50/90 px-2 py-1.5 text-sky-950">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span
                                      className="shrink-0 cursor-help text-xs leading-none pt-0.5"
                                      aria-label="Information case 4BA"
                                    >
                                      ℹ️
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-xs text-left text-xs leading-relaxed">
                                    {case4baTooltip}
                                  </TooltipContent>
                                </Tooltip>
                                <p className="text-[11px] leading-snug text-sky-900">
                                  <span className="hidden sm:inline">
                                    Ce montant est automatiquement reporté dans la 2042 après validation de la
                                    déclaration 2044 sur impots.gouv.
                                  </span>
                                  <span className="sm:hidden">Rempli automatiquement depuis la 2044</span>
                                </p>
                              </div>
                            )}
                            {row.missingDeclarativeContext && row.propertyId && (
                              <p className="text-xs text-orange-900 flex items-start gap-1.5">
                                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                <span>Informations du bien incomplètes — complétez-les pour éviter les erreurs.</span>
                              </p>
                            )}
                            {row.mappingAmbiguityOn230 && (
                              <p className="text-xs text-orange-900 flex items-start gap-1.5">
                                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                <span>
                                  Catégorisation incertaine : la répartition automatique sur cette ligne doit être
                                  contrôlée.{' '}
                                  {onOpenCategorizationAssistant ? (
                                    <button
                                      type="button"
                                      className="font-semibold underline underline-offset-2 hover:text-orange-700"
                                      onClick={onOpenCategorizationAssistant}
                                    >
                                      Voir l&apos;assistant de catégorisation
                                    </button>
                                  ) : (
                                    <span className="font-semibold">Voir l&apos;assistant de catégorisation</span>
                                  )}
                                </span>
                              </p>
                            )}
                            {row.loanAmbiguityOn230 && (
                              <p className="text-xs text-orange-900 flex items-start gap-1.5">
                                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                <span>
                                  Correction recommandée sur les prêts ou les intérêts — ouvrez le détail du bien via
                                  le lien à côté du nom du bien en tête de section.
                                </span>
                              </p>
                            )}
                          </div>

                          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:flex-wrap lg:justify-end">
                            <p className="text-right text-lg font-bold text-gray-900 tabular-nums whitespace-nowrap sm:min-w-[7rem]">
                              {formatEuro(Math.abs(row.montant))}
                            </p>
                            <div className="flex flex-wrap gap-2 justify-end">
                              <Button
                                type="button"
                                size="sm"
                                className="bg-emerald-600 text-white hover:bg-emerald-700"
                                onClick={() => handleCopy(row)}
                              >
                                <Copy className="h-3.5 w-3.5 mr-1.5" />
                                Copier
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="border-emerald-300 text-emerald-900"
                                onClick={() => handleToggleDone(row)}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                                {p === 'termine' ? 'Remettre à faire' : 'Marquer comme fait'}
                              </Button>
                              {hasPersisted && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="text-gray-600"
                                  onClick={() => handleAnnuler(row)}
                                >
                                  <Undo2 className="h-3.5 w-3.5 mr-1" />
                                  Annuler
                                </Button>
                              )}
                              {row.fiscalCase2042 && onOpenDetail2042 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onOpenDetail2042(row.fiscalCase2042!)}
                                >
                                  <Info className="h-3.5 w-3.5 mr-1" />
                                  Aide
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </CardContent>
      </Card>
    </BlockCard>
    </TooltipProvider>
  );
}
