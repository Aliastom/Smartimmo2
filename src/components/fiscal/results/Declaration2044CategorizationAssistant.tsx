'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AlertCircle, CheckCircle2, ChevronDown, Copy, ExternalLink, Pencil, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip';
import type { Fiscal2044Ambiguity } from '@/types/fiscal';
import {
  AMBIGUITY_GROUP_ORDER,
  groupKeyForAmbiguity,
  groupTitleForAmbiguity,
  suggest2044LineFromAmbiguity,
} from '@/lib/fiscal/suggest2044LineFromAmbiguity';

export type EnrichedFiscal2044Ambiguity = Fiscal2044Ambiguity & {
  propertyId: string;
  propertyName: string;
};

function storageKeyTemporaryTreated(year: number) {
  return `smartimmo:declaration-2044-temporary-treated-${year}`;
}

function loadTemporaryTreatedIds(year: number): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(storageKeyTemporaryTreated(year));
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function persistTemporaryTreatedId(year: number, transactionId: string) {
  const set = loadTemporaryTreatedIds(year);
  set.add(transactionId);
  window.localStorage.setItem(storageKeyTemporaryTreated(year), JSON.stringify([...set]));
}

function buildGroups(items: EnrichedFiscal2044Ambiguity[]) {
  const map = new Map<string, EnrichedFiscal2044Ambiguity[]>();
  for (const it of items) {
    const k = groupKeyForAmbiguity(it);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(it);
  }
  const ordered: Array<{ key: string; title: string; rows: EnrichedFiscal2044Ambiguity[] }> = [];
  for (const k of AMBIGUITY_GROUP_ORDER) {
    const rows = map.get(k);
    if (rows?.length) ordered.push({ key: k, title: groupTitleForAmbiguity(k), rows });
  }
  for (const [k, rows] of map) {
    if (!AMBIGUITY_GROUP_ORDER.includes(k) && rows.length) {
      ordered.push({ key: k, title: groupTitleForAmbiguity(k), rows });
    }
  }
  return ordered;
}

const PEDAGOGIC_TOOLTIP =
  'Chaque catégorie correspond à une ligne spécifique de la déclaration 2044. Une mauvaise classification peut modifier votre impôt.';

interface Declaration2044CategorizationAssistantProps {
  year: number;
  items: EnrichedFiscal2044Ambiguity[];
  /** Compteur agrégé affiché dans l’alerte ambre (peut différer du nombre de lignes listées) */
  totalSignaledForContext?: number;
  formatEuro: (n: number) => string;
  anchorId?: string;
  highlightActive?: boolean;
}

export function Declaration2044CategorizationAssistant({
  year,
  items,
  totalSignaledForContext,
  formatEuro,
  anchorId = 'assistant-categorisation-2044',
  highlightActive = false,
}: Declaration2044CategorizationAssistantProps) {
  const router = useRouter();
  const [showDrilldown, setShowDrilldown] = useState(false);
  const [temporaryTreatedIds, setTemporaryTreatedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setTemporaryTreatedIds(loadTemporaryTreatedIds(year));
  }, [year]);

  const deduped = useMemo(() => {
    const byId = new Map<string, EnrichedFiscal2044Ambiguity>();
    for (const it of items) {
      if (!byId.has(it.transactionId)) byId.set(it.transactionId, it);
    }
    return [...byId.values()];
  }, [items]);

  const groups = useMemo(() => buildGroups(deduped), [deduped]);
  const categoryCount = groups.length;
  const listedCount = deduped.length;

  const markTemporaryTreated = useCallback(
    (transactionId: string) => {
      persistTemporaryTreatedId(year, transactionId);
      setTemporaryTreatedIds(loadTemporaryTreatedIds(year));
      toast.success('Marqué comme traité temporairement (local uniquement).');
    },
    [year],
  );

  const openTransactions = useCallback(
    (propertyId: string) => {
      router.push(`/transactions?propertyId=${encodeURIComponent(propertyId)}`);
    },
    [router],
  );

  const openCorrection = useCallback(
    (row: EnrichedFiscal2044Ambiguity) => {
      openTransactions(row.propertyId);
      toast('Ouverture des transactions : corrigez la catégorie de cette dépense puis revenez vérifier la 2044.', {
        duration: 5500,
      });
    },
    [openTransactions],
  );

  const prepareCorrection = useCallback(
    async (row: EnrichedFiscal2044Ambiguity) => {
      const sug = suggest2044LineFromAmbiguity(row);
      if (sug) {
        try {
          await navigator.clipboard.writeText(sug.fiscalLineHint);
        } catch {
          /* ignore */
        }
      }
      toast(
        sug
          ? `Préparation faite : ${sug.fiscalLineHint} copié. Ouvrez la transaction pour choisir une catégorie liée à ${sug.label}.`
          : 'Ouvrez la transaction pour ajuster la catégorie (ligne 2044 plus fiable après correction).',
        { duration: 5500 },
      );
    },
    [],
  );

  const bulkPrepareGroup = useCallback(
    async (rows: EnrichedFiscal2044Ambiguity[]) => {
      const hints = [...new Set(rows.map((r) => suggest2044LineFromAmbiguity(r)?.fiscalLineHint).filter(Boolean))];
      if (hints.length === 1) {
        try {
          await navigator.clipboard.writeText(hints[0]!);
        } catch {
          /* ignore */
        }
      }
      const byProp = [...new Set(rows.map((r) => r.propertyId))];
      toast(
        `Préparation groupe : ${rows.length} dépense(s). Indices possibles : ${hints.join(', ') || 'voir détail ligne par ligne'}.`,
        { duration: 6000 },
      );
      if (byProp.length === 1) openTransactions(byProp[0]!);
      else router.push('/transactions');
    },
    [openTransactions, router],
  );

  if (deduped.length === 0 && (totalSignaledForContext ?? 0) === 0) {
    return null;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Card
        id={anchorId}
        className={`border border-sky-200 bg-sky-50/50 shadow-sm transition-all duration-300 ${
          highlightActive ? 'ring-2 ring-blue-400 ring-offset-2 bg-blue-50/80 animate-pulse' : ''
        }`}
      >
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-2 min-w-0">
              <Sparkles className="h-5 w-5 text-sky-700 shrink-0 mt-0.5" aria-hidden />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-sky-950">Assistant catégorisation 2044</h3>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="text-xs text-sky-800 underline decoration-dotted underline-offset-2 shrink-0"
                        aria-label="Pourquoi la catégorie compte"
                      >
                        ℹ️ Pourquoi c&apos;est important
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-sm text-xs leading-relaxed text-left">
                      {PEDAGOGIC_TOOLTIP}
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className="text-sm text-sky-950 mt-1">
                  {deduped.length > 0 ? (
                    <>
                      <strong>{listedCount}</strong> dépense{listedCount > 1 ? 's' : ''} à corriger
                      {categoryCount > 0 ? (
                        <>
                          {' '}
                          dans <strong>{categoryCount}</strong> catégorie{categoryCount > 1 ? 's' : ''}
                        </>
                      ) : null}
                      {totalSignaledForContext != null && totalSignaledForContext > listedCount ? (
                        <span className="text-amber-900">
                          {' '}
                          — total signalé : <strong>{totalSignaledForContext}</strong> (certaines entrées sont
                          regroupées).
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <strong>{totalSignaledForContext ?? 0}</strong> point{(totalSignaledForContext ?? 0) > 1 ? 's' : ''}{' '}
                      à traiter côté catégories — ouvrez les transactions par bien pour corriger.
                    </>
                  )}
                </p>
              </div>
            </div>
            {deduped.length > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-sky-400 text-sky-950 hover:bg-sky-100 shrink-0"
                onClick={() => setShowDrilldown((v) => !v)}
              >
                {showDrilldown ? 'Masquer les dépenses' : 'Voir les dépenses concernées'}
                <ChevronDown
                  className={`ml-1 h-4 w-4 transition-transform inline ${showDrilldown ? 'rotate-180' : ''}`}
                  aria-hidden
                />
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                className="bg-sky-700 text-white hover:bg-sky-800 shrink-0"
                onClick={() => router.push('/transactions')}
              >
                Ouvrir les transactions
              </Button>
            )}
          </div>

          {showDrilldown && deduped.length > 0 && (
            <div className="space-y-3 pt-1 border-t border-sky-200/80">
              {groups.map((g) => (
                <details key={g.key} className="rounded-lg border border-sky-200 bg-white/90 open:shadow-sm group">
                  <summary className="cursor-pointer list-none flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium text-gray-900 [&::-webkit-details-marker]:hidden">
                    <span className="inline-flex items-center gap-2">
                      <ChevronDown className="h-4 w-4 text-sky-700 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
                      <span>{g.title}</span>
                      <Badge variant="outline" className="text-[10px] bg-sky-50 text-sky-900 border-sky-200">
                        {g.rows.length} dépense{g.rows.length > 1 ? 's' : ''} — correction recommandée
                      </Badge>
                    </span>
                  </summary>
                  <div className="px-3 pb-3 space-y-2 border-t border-sky-100">
                    <div className="pt-2 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className="bg-sky-700 text-white hover:bg-sky-800"
                        onClick={() => bulkPrepareGroup(g.rows)}
                      >
                        Préparer les corrections du groupe
                      </Button>
                    </div>
                    <ul className="space-y-2">
                      {g.rows.map((row) => {
                        const sug = suggest2044LineFromAmbiguity(row);
                        const isTemporaryTreated = temporaryTreatedIds.has(row.transactionId);
                        const cat = row.categoryLabel || row.categorySlug || 'Non renseignée';
                        const missingFiscalCategory =
                          !row.fiscalLineHint ||
                          row.reason.toLowerCase().includes('sans fiscallinehint') ||
                          row.reason.toLowerCase().includes('229/420');
                        const fallbackUsed = row.reason.toLowerCase().includes('fallback vers');
                        const lineUncertain = true;

                        return (
                          <li
                            key={row.transactionId}
                            className={`rounded-md border p-3 text-xs space-y-2 ${
                              isTemporaryTreated
                                ? 'border-emerald-300 bg-emerald-50/80'
                                : 'border-gray-200 bg-gray-50/60'
                            }`}
                          >
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                              <div className="space-y-2">
                                <p className="text-[11px] text-gray-500 uppercase tracking-wide">Transaction</p>
                                <p className="font-semibold text-gray-900 text-sm">{row.label}</p>
                              </div>
                              <div className="space-y-2">
                                <p className="text-[11px] text-gray-500 uppercase tracking-wide">Bien</p>
                                <p className="text-sm text-gray-900">{row.propertyName}</p>
                              </div>
                              <div className="space-y-2">
                                <p className="text-[11px] text-gray-500 uppercase tracking-wide">Catégorie actuelle</p>
                                <p className="text-sm text-gray-900">{cat}</p>
                              </div>
                              <div className="space-y-2">
                                <p className="text-[11px] text-gray-500 uppercase tracking-wide">Montant</p>
                                <p className="text-base font-bold text-gray-900 tabular-nums">{formatEuro(row.amount)}</p>
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <p className="text-[11px] text-gray-500 uppercase tracking-wide">Problème détecté</p>
                              <p className="text-[12px] text-gray-900">{row.reason}</p>
                              <div className="flex flex-wrap gap-1.5">
                                {missingFiscalCategory && (
                                  <Badge variant="outline" className="bg-orange-50 text-orange-900 border-orange-300">
                                    Catégorie fiscale incomplète
                                  </Badge>
                                )}
                                {lineUncertain && (
                                  <Badge variant="outline" className="bg-amber-50 text-amber-900 border-amber-300">
                                    Ligne 2044 incertaine
                                  </Badge>
                                )}
                                {fallbackUsed && (
                                  <Badge variant="outline" className="bg-slate-100 text-slate-800 border-slate-300">
                                    Fallback automatique utilisé
                                  </Badge>
                                )}
                                {isTemporaryTreated && (
                                  <Badge variant="outline" className="bg-emerald-100 text-emerald-900 border-emerald-300">
                                    Correction locale seulement
                                  </Badge>
                                )}
                                {!isTemporaryTreated && (
                                  <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-300">
                                    Correction persistée : à confirmer
                                  </Badge>
                                )}
                              </div>
                            </div>

                            {sug && (
                              <div className="rounded border border-indigo-200 bg-indigo-50/70 px-2 py-2 space-y-1.5">
                                <p className="text-[11px] text-gray-500 uppercase tracking-wide">Ligne fiscale recommandée</p>
                                <p className="text-[12px] text-indigo-950">
                                  <strong>{sug.label}</strong>{' '}
                                  <span className="text-indigo-800">
                                    (indice <code className="text-[10px]">{sug.fiscalLineHint}</code>, source :{' '}
                                    {sug.source === 'category'
                                      ? 'catégorie métier'
                                      : sug.source === 'transaction-label'
                                        ? 'libellé transaction'
                                        : sug.source === 'fiscal-hint'
                                          ? 'indicateur fiscal existant'
                                          : 'fallback moteur'}
                                    )
                                  </span>
                                </p>
                              </div>
                            )}

                            <div className="rounded-md border border-sky-100 bg-sky-50/70 px-2.5 py-2 space-y-2">
                              <p className="text-[11px] text-gray-500 uppercase tracking-wide">Action à réaliser</p>
                              <p className="text-[12px] text-sky-950">
                                {sug ? (
                                  <>
                                    Action recommandée : ouvrir cette transaction et choisir une catégorie liée à la
                                    ligne <strong>{sug.line}</strong> — <strong>{sug.label}</strong>.
                                    {missingFiscalCategory && (
                                      <>
                                        {' '}
                                        Si besoin, compléter aussi l&apos;indicateur fiscal dans{' '}
                                        <strong>Admin &gt; Natures &amp; catégories</strong>.
                                      </>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    Action recommandée : ouvrir cette transaction, préciser la catégorie fiscale, puis
                                    vérifier la ligne 2044 obtenue.
                                  </>
                                )}
                              </p>
                              {!isTemporaryTreated && (
                                <div className="flex flex-wrap gap-2 pt-0.5">
                                  <Button
                                    type="button"
                                    size="sm"
                                    className="bg-emerald-600 text-white hover:bg-emerald-700"
                                    onClick={() => openCorrection(row)}
                                  >
                                    <Pencil className="h-3.5 w-3.5 mr-1.5" />
                                    Corriger dans les transactions
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="border-gray-300"
                                    onClick={() => prepareCorrection(row)}
                                  >
                                    <Copy className="h-3.5 w-3.5 mr-1.5" />
                                    Préparer la correction
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="text-emerald-800"
                                    onClick={() => markTemporaryTreated(row.transactionId)}
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                                    Marquer traité temporairement
                                  </Button>
                                </div>
                              )}
                              {isTemporaryTreated && (
                                <div className="inline-flex items-center gap-1.5 rounded bg-emerald-100 px-2 py-1 text-[11px] text-emerald-900">
                                  <AlertCircle className="h-3.5 w-3.5" />
                                  Statut local seulement (aucune persistance serveur confirmée).
                                </div>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </details>
              ))}
            </div>
          )}

          <p className="text-[11px] text-sky-900/90 flex items-start gap-1">
            <ExternalLink className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              Les corrections effectives se font dans <strong>Transactions</strong> (catégorie sur chaque dépense) et,
              si nécessaire, dans <strong>Admin / natures &amp; catégories</strong> (indicateur fiscal de la catégorie).
            </span>
          </p>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
