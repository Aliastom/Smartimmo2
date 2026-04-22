/**
 * DeclarationTab - Onglet Déclaration fiscale (Thème VERT)
 * 
 * Guide complet pour remplir les formulaires 2042 et 2044
 */

'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { BlockCard } from '../BlockCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { useExpertModeStore } from '@/store/expertModeStore';
import { ExpertDeclarationBlocks } from '../../expert/ExpertDeclarationBlocks';
import { DeclarationImpotsGouvChecklist } from '../DeclarationImpotsGouvChecklist';
import { Declaration2044BienDetailPanel } from '../Declaration2044BienDetailPanel';
import {
  Declaration2044CategorizationAssistant,
  type EnrichedFiscal2044Ambiguity,
} from '../Declaration2044CategorizationAssistant';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import type { Fiscal2044LoanInterestAmbiguity, SimulationResult } from '@/types/fiscal';
import { generateCerfaPDF } from '@/lib/pdf/generateCerfaPDF';
import { computeWithholdingOptimization } from '@/lib/fiscal/withholdingOptimizer';
import { simulatePAS } from '@/services/tax/PASSimulator';
import { scrollToAnchorById } from '@/lib/ui/scrollToAnchorById';
import {
  isLocationMeubleeOuBicHors2044Foncier,
  isRevenuFoncierDeclaration2044,
  isSciISHors2044Foncier,
  libelleRegimeFiscalPourAffichage,
  libelleTypeFiscalPourAffichage,
} from '@/lib/fiscal/declaration2044UiFilters';
import { toast } from 'sonner';
import { 
  FileText, 
  Home, 
  CheckCircle2,
  Info,
  Download,
  Mail,
  ExternalLink,
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  X,
  Calculator,
} from 'lucide-react';

declare global {
  interface Window {
    __FISCAL_DEBUG__?: boolean;
  }
}

interface DeclarationTabProps {
  simulation: SimulationResult;
  onExportPDF?: () => void;
}

// Type pour une case fiscale
interface FiscalCase {
  code: string;
  libelle: string;
  montant: number;
  provenance: string;
  formulaire: '2042' | '2044';
  explication: string;
  source?: string;
}

const DETAILED_2044_ORDER = ['211', '212', '213', '215', '221', '222', '223', '224', '225', '226', '227', '229', '230', '420'] as const;

/** Regroupement pour l’assistant de saisie impots.gouv (sous-totaux indicatifs). */
export function DeclarationTab({ simulation, onExportPDF }: DeclarationTabProps) {
  const { isExpertMode } = useExpertModeStore();
  const [showModal, setShowModal] = useState(false);
  const [declarationBienDetailId, setDeclarationBienDetailId] = useState<string | null>(null);
  const [selectedCase, setSelectedCase] = useState<FiscalCase | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [baremeOuvert, setBaremeOuvert] = useState(false);
  const [conseilsOuverts, setConseilsOuverts] = useState(false);
  const [assistantHighlightActive, setAssistantHighlightActive] = useState(false);
  const assistantHighlightTimeoutRef = useRef<number | null>(null);
  
  const formatEuro = (amount: number) =>
    new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  const formatPercent = (rate: number) => `${(rate * 100).toFixed(1)} %`;

  const copyMontantPourImpots = useCallback(async (code: string, montant: number) => {
    const arrondi = Math.round(Math.abs(montant));
    const text = String(arrondi);
    try {
      await navigator.clipboard.writeText(text);
      if (code === '4BA') {
        toast('⚠️ Sur impots.gouv, cette case est normalement pré-remplie après la 2044.');
        setCopyFeedback(
          `Montant 4BA copié (${text} €) — comparez à la 2042 : cette case est en général remplie automatiquement après la 2044.`,
        );
      } else {
        setCopyFeedback(`Montant copié (${text} €) — collez-le dans le champ correspondant sur impots.gouv`);
      }
      window.setTimeout(() => setCopyFeedback(null), 3200);
    } catch {
      setCopyFeedback('Copie impossible (navigateur)');
      window.setTimeout(() => setCopyFeedback(null), 3200);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (assistantHighlightTimeoutRef.current != null) {
        window.clearTimeout(assistantHighlightTimeoutRef.current);
      }
    };
  }, []);

  const openCategorizationAssistant = useCallback(() => {
    const target = scrollToAnchorById('assistant-categorisation-2044', {
      behavior: 'smooth',
      block: 'start',
      expandAncestors: true,
    });

    if (!target) {
      toast.error('Assistant de catégorisation introuvable sur cette vue.');
      return;
    }

    setAssistantHighlightActive(true);
    if (assistantHighlightTimeoutRef.current != null) {
      window.clearTimeout(assistantHighlightTimeoutRef.current);
    }
    assistantHighlightTimeoutRef.current = window.setTimeout(() => {
      setAssistantHighlightActive(false);
      assistantHighlightTimeoutRef.current = null;
    }, 1300);
  }, []);

  /** 2044 « foncier » : uniquement les biens dont le type fiscal est la location nue (`NU`), aligné sur le simulateur. */
  const declarationFoncierOnly = useMemo(
    () =>
      simulation.biens
        .filter((b) => isRevenuFoncierDeclaration2044(b))
        .map((bien) => ({ bien, declaration: bien.declaration2044 }))
        .filter((item): item is { bien: (typeof simulation.biens)[number]; declaration: NonNullable<(typeof simulation.biens)[number]['declaration2044']> } => !!item.declaration),
    [simulation.biens]
  );

  /** MEUBLE / LMNP / LMP : routés vers le BIC dans `Simulator` — exclus de la 2044 foncière à l’affichage. */
  const biensBicHors2044Foncier = useMemo(
    () => simulation.biens.filter((b) => isLocationMeubleeOuBicHors2044Foncier(b)),
    [simulation.biens]
  );

  const biensSciIsHors2044 = useMemo(
    () => simulation.biens.filter((b) => isSciISHors2044Foncier(b)),
    [simulation.biens]
  );

  const bicRecettesTotales = useMemo(
    () => biensBicHors2044Foncier.reduce((s, b) => s + (b.recettesBrutes || 0), 0),
    [biensBicHors2044Foncier]
  );

  /** BIC / meublé avec régime réel (comptabilité + liasse) — pour encart UX uniquement. */
  const biensBicRegimeReel = useMemo(
    () =>
      biensBicHors2044Foncier.filter((b) => {
        const r = b.regimeUtilise || b.regime;
        return r === 'reel';
      }),
    [biensBicHors2044Foncier]
  );

  const biensFoncierNueSeuls = useMemo(
    () => simulation.biens.filter((b) => isRevenuFoncierDeclaration2044(b)),
    [simulation.biens]
  );

  const detailedTotals = useMemo(
    () =>
      DETAILED_2044_ORDER.reduce<Record<string, number>>((acc, line) => {
        acc[line] = declarationFoncierOnly.reduce(
          (sum, item) => sum + (item.declaration?.lines?.[line] || 0),
          0
        );
        return acc;
      }, {}),
    [declarationFoncierOnly]
  );

  const qualityTotals = useMemo(
    () =>
      declarationFoncierOnly.reduce(
        (acc, item) => {
          acc.missingHintCount += item.declaration?.quality?.missingHintCount || 0;
          acc.unmappedCount += item.declaration?.quality?.unmappedCount || 0;
          for (const a of item.declaration?.quality?.ambiguousTransactions || []) {
            acc.ambiguousTransactions.push(a);
          }
          acc.loanAmbiguities.push(...(item.declaration?.interetsEmpruntAnnee?.ambiguities || []));
          return acc;
        },
        {
          missingHintCount: 0,
          unmappedCount: 0,
          ambiguousTransactions: [] as Array<{
            transactionId: string;
            label: string;
            amount: number;
            reason: string;
            categoryLabel?: string;
            categorySlug?: string;
            fiscalLineHint?: string | null;
          }>,
          loanAmbiguities: [] as Fiscal2044LoanInterestAmbiguity[],
        }
      ),
    [declarationFoncierOnly]
  );

  const categorizationSignaledCount =
    qualityTotals.unmappedCount + qualityTotals.ambiguousTransactions.length;

  const enrichedFiscal2044Ambiguities = useMemo((): EnrichedFiscal2044Ambiguity[] => {
    const out: EnrichedFiscal2044Ambiguity[] = [];
    const seen = new Set<string>();
    for (const { bien, declaration } of declarationFoncierOnly) {
      for (const a of declaration?.quality?.ambiguousTransactions ?? []) {
        if (seen.has(a.transactionId)) continue;
        seen.add(a.transactionId);
        out.push({
          ...a,
          propertyId: bien.id,
          propertyName: bien.nom,
        });
      }
    }
    return out;
  }, [declarationFoncierOnly]);

  const revenuFoncier2044Resume = useMemo(() => {
    return simulation.consolidation.revenusFonciers4BA ?? simulation.consolidation.revenusFonciers;
  }, [simulation.consolidation.revenusFonciers4BA, simulation.consolidation.revenusFonciers]);

  const syntheseIntelligente = useMemo(() => {
    const detailsParBien = simulation.consolidation.detailsParBien || [];
    const revenusBruts = biensFoncierNueSeuls.reduce((s, b) => s + (b.recettesBrutes || 0), 0);
    const chargesDeductibles = biensFoncierNueSeuls.reduce((s, b) => s + (b.chargesDeductibles || 0), 0);
    const resultatFoncierTotal = revenuFoncier2044Resume;
    const biensBeneficiaires = detailsParBien.filter((b) => b.resultatFiscal > 0).length;
    const biensDeficitaires = detailsParBien.filter((b) => b.resultatFiscal < 0).length;
    const deficitTotalImputable = detailsParBien
      .filter((b) => b.resultatFiscal < 0)
      .reduce((s, b) => s + Math.abs(b.resultatFiscal), 0);
    const sumResultatsBiens = detailsParBien.reduce((s, b) => s + b.resultatFiscal, 0);
    const delta4BA = Math.abs(sumResultatsBiens - resultatFoncierTotal);
    return {
      revenusBruts,
      chargesDeductibles,
      resultatFoncierTotal,
      biensBeneficiaires,
      biensDeficitaires,
      deficitTotalImputable,
      sumResultatsBiens,
      delta4BA,
      detailsParBien,
    };
  }, [simulation.consolidation.detailsParBien, biensFoncierNueSeuls, revenuFoncier2044Resume]);

  const debugFiscalEnabled = typeof window !== 'undefined' && window.__FISCAL_DEBUG__ === true;

  const cases = useMemo((): FiscalCase[] => {
    const list: FiscalCase[] = [];

    list.push({
      code: '1AJ',
      libelle: 'Salaires nets imposables',
      montant: simulation.inputs.foyer.salaire,
      provenance: 'Salaire',
      formulaire: '2042',
      explication: 'Votre salaire net imposable après abattement de 10% pour frais professionnels.',
      source: 'https://www.impots.gouv.fr/particulier/questions/comment-declarer-mes-salaires',
    });

    if (revenuFoncier2044Resume !== 0) {
      list.push({
        code: '4BA',
        libelle: 'Revenus fonciers nets',
        montant: revenuFoncier2044Resume,
        provenance: 'Immobilier',
        formulaire: '2042',
        explication:
          'Résultat net de vos revenus fonciers (loyers - charges). Ce montant sera ajouté à votre base imposable.',
        source: 'https://www.impots.gouv.fr/particulier/questions/comment-declarer-mes-revenus-fonciers',
      });
    }

    if (simulation.per && simulation.per.deductionUtilisee > 0) {
      list.push({
        code: '6NS',
        libelle: 'Cotisations PER déductibles',
        montant: simulation.per.deductionUtilisee,
        provenance: 'PER',
        formulaire: '2042',
        explication:
          "Montant des versements PER déductibles de votre revenu imposable. Attention : ce n'est pas un crédit d'impôt.",
        source: 'https://www.impots.gouv.fr/particulier/questions/quest-ce-que-le-plan-depargne-retraite-per',
      });
    }

    const totalLoyers =
      declarationFoncierOnly.length > 0
        ? detailedTotals['211']
        : biensFoncierNueSeuls.reduce((sum, b) => sum + (b.recettesBrutes || 0), 0);
    const totalCharges =
      declarationFoncierOnly.length > 0
        ? detailedTotals['229']
        : biensFoncierNueSeuls.reduce((sum, b) => sum + (b.chargesDeductibles || 0), 0);

    list.push({
      code: '211',
      libelle: 'Loyers encaissés',
      montant: totalLoyers,
      provenance: 'Immobilier',
      formulaire: '2044',
      explication: `Total des loyers perçus sur l'année ${simulation.inputs.year} (biens en location nue / 2044 uniquement).`,
    });

    list.push({
      code: '229',
      libelle: 'Charges déductibles totales',
      montant: totalCharges,
      provenance: 'Immobilier',
      formulaire: '2044',
      explication: 'Somme de toutes vos charges déductibles : taxes, intérêts, assurances, frais de gestion, etc.',
    });

    list.push({
      code: '420',
      libelle: 'Résultat foncier',
      montant: revenuFoncier2044Resume,
      provenance: 'Immobilier',
      formulaire: '2044',
      explication: 'Résultat net de votre activité foncière (loyers - charges). Ce montant sera reporté sur la 2042.',
    });

    return list;
  }, [
    simulation,
    revenuFoncier2044Resume,
    declarationFoncierOnly.length,
    detailedTotals,
    biensFoncierNueSeuls,
  ]);
  const cases2042 = cases.filter((c) => c.formulaire === '2042');

  const openModal = (caseItem: FiscalCase) => {
    setSelectedCase(caseItem);
    setShowModal(true);
  };

  const declarationBienDetailSelection = useMemo(() => {
    if (!declarationBienDetailId) return null;
    return declarationFoncierOnly.find((x) => x.bien.id === declarationBienDetailId) ?? null;
  }, [declarationBienDetailId, declarationFoncierOnly]);

  return (
    <div className="space-y-6 p-6">
      {/* Titre et sous-titre */}
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-emerald-600 mb-2 flex items-center justify-center gap-2">
          🟢 Déclaration fiscale
        </h2>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Commencez par compléter la déclaration <strong>2044</strong> sur impots.gouv, puis vérifiez les montants
          reportés dans la <strong>2042</strong> (la case <strong>4BA</strong> est en principe pré-remplie après la 2044).
          Utilisez la checklist pour contrôler ou copier les montants, et le détail 2044 par bien (« Voir le détail du
          bien »).
        </p>
      </div>

      <DeclarationImpotsGouvChecklist
        simulation={simulation}
        declarationByProperty={declarationFoncierOnly}
        cases2042={cases2042}
        formatEuro={formatEuro}
        copyMontantPourImpots={copyMontantPourImpots}
        onOpenDeclarationBienDetail={(propertyId) => setDeclarationBienDetailId(propertyId)}
        onOpenCategorizationAssistant={openCategorizationAssistant}
        onOpenDetail2042={(c) =>
          openModal({
            code: c.code,
            libelle: c.libelle,
            montant: c.montant,
            provenance: c.provenance,
            formulaire: c.formulaire,
            explication: c.explication,
            source: c.source,
          })
        }
      />

      <BlockCard
        title="📊 Synthèse fiscale"
        icon={<Calculator className="h-5 w-5 text-emerald-600" />}
      >
        <Card className="border border-emerald-200 bg-emerald-50/30 shadow-sm">
          <CardContent className="p-4 space-y-3 text-sm text-gray-900">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-lg border border-emerald-200 bg-white p-3">
                <p className="text-xs text-gray-600">Revenus bruts (loyers)</p>
                <p className="font-bold text-emerald-700">{formatEuro(syntheseIntelligente.revenusBruts)}</p>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-white p-3">
                <p className="text-xs text-gray-600">Charges déductibles</p>
                <p className="font-bold text-emerald-700">{formatEuro(syntheseIntelligente.chargesDeductibles)}</p>
              </div>
              <div className="rounded-lg border border-emerald-300 bg-white p-3">
                <p className="text-xs text-gray-600">Résultat foncier total (4BA)</p>
                <p className="font-bold text-emerald-800">{formatEuro(syntheseIntelligente.resultatFoncierTotal)}</p>
              </div>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-white p-3 text-xs text-gray-700 space-y-1">
              <p>🧾 Détail :</p>
              <p>- {syntheseIntelligente.biensBeneficiaires} biens bénéficiaires</p>
              <p>- {syntheseIntelligente.biensDeficitaires} biens déficitaires</p>
              <p>- Déficit total imputable : {formatEuro(syntheseIntelligente.deficitTotalImputable)}</p>
            </div>
            <div className="rounded-lg border border-sky-200 bg-sky-50/80 p-3 text-xs text-sky-900">
              Ce montant correspond à la somme des résultats fiscaux de vos biens en location nue (formulaire 2044),
              automatiquement reportée en case 4BA.
            </div>
            {(simulation.consolidation.deltaArrondi4BA || 0) > 0.001 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-900">
                ⚠️ Un écart d’arrondi de {formatEuro(simulation.consolidation.deltaArrondi4BA || 0)} a été corrigé
                automatiquement.
              </div>
            )}
            {debugFiscalEnabled && (
              <pre className="overflow-auto rounded bg-slate-900 p-3 text-[11px] text-slate-100">
{JSON.stringify(
  {
    sumCentimes: Math.round(syntheseIntelligente.sumResultatsBiens * 100),
    sommeAffichee: syntheseIntelligente.resultatFoncierTotal,
    delta: Number(syntheseIntelligente.delta4BA.toFixed(4)),
    detailsParBien: syntheseIntelligente.detailsParBien,
  },
  null,
  2,
)}
              </pre>
            )}
          </CardContent>
        </Card>
      </BlockCard>

      <BlockCard
        title="Résumé déclaration"
        icon={<span className="text-lg leading-none" aria-hidden>📊</span>}
        badge={
          <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-200 text-xs">
            2042 + 2044 synthétique
          </Badge>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card className="border border-emerald-200 bg-emerald-50/40 shadow-sm">
            <CardContent className="p-3">
              <p className="text-[10px] font-medium text-gray-600 mb-1">REVENU IMPOSABLE (2042)</p>
              <p className="text-lg font-bold text-emerald-700">{formatEuro(simulation.ir.revenuImposable)}</p>
            </CardContent>
          </Card>
          <Card className="border border-emerald-200 bg-emerald-50/40 shadow-sm">
            <CardContent className="p-3">
              <p className="text-[10px] font-medium text-gray-600 mb-1">RÉSULTAT FONCIER AFFICHÉ 4BA</p>
              <p className="text-lg font-bold text-emerald-700">{formatEuro(revenuFoncier2044Resume)}</p>
              <p className="text-[10px] text-gray-500 mt-1">Montant moteur 2044 (somme des résultats fiscaux fonciers).</p>
              <div className="mt-2 border-t border-sky-200/70 pt-2 flex items-start gap-1 text-sky-900">
                <span className="shrink-0" aria-hidden>
                  ℹ️
                </span>
                <p className="text-[10px] leading-snug hidden sm:block">
                  Ce montant est automatiquement reporté dans la 2042 après validation de la déclaration 2044 sur
                  impots.gouv.
                </p>
                <p className="text-[10px] leading-snug sm:hidden">Rempli automatiquement depuis la 2044</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border border-emerald-200 bg-emerald-50/40 shadow-sm">
            <CardContent className="p-3">
              <p className="text-[10px] font-medium text-gray-600 mb-1">2044 — LOCATION NUE (NU)</p>
              <p className="text-lg font-bold text-emerald-700">{formatEuro(revenuFoncier2044Resume)}</p>
              <p className="text-[10px] text-gray-500 mt-1">
                Somme des lignes 420 pour les seuls biens en location nue (type fiscal NU), hors meublé / BIC.
              </p>
            </CardContent>
          </Card>
        </div>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-700">
          <p>
            <span className="font-semibold text-gray-900">1AJ</span> — Salaires nets :{' '}
            <span className="font-mono">{formatEuro(simulation.inputs.foyer.salaire)}</span>
          </p>
          {simulation.per && simulation.per.deductionUtilisee > 0 && (
            <p>
              <span className="font-semibold text-gray-900">6NS</span> — PER :{' '}
              <span className="font-mono">{formatEuro(simulation.per.deductionUtilisee)}</span>
            </p>
          )}
        </div>
      </BlockCard>

      {biensBicHors2044Foncier.length > 0 && (
        <BlockCard
          title="Location meublée (LMNP / LMP) — déclaration BIC"
          icon={<span className="text-lg leading-none" aria-hidden>🪑</span>}
          badge={
            <Badge variant="outline" className="bg-amber-50 text-amber-900 border-amber-200 text-xs">
              {biensBicHors2044Foncier.length} bien{biensBicHors2044Foncier.length > 1 ? 's' : ''}
            </Badge>
          }
        >
          <Card className="border border-amber-200 bg-amber-50/40 shadow-sm">
            <CardContent className="p-4 space-y-3 text-sm text-gray-900">
              <p className="text-base font-semibold">
                Total revenus (recettes brutes, vue simulation) :{' '}
                <span className="text-amber-900">{formatEuro(bicRecettesTotales)}</span>
              </p>
              <p className="text-sm leading-relaxed">
                Ces biens sont en <strong>location meublée (LMNP / LMP)</strong> ou au <strong>régime BIC</strong> (type
                fiscal meublé). Ils ne relèvent <strong>pas</strong> de la déclaration <strong>2044</strong> (revenus
                fonciers). En <strong>micro-BIC</strong>, la déclaration se fait dans votre déclaration de revenus aux
                cases adaptées ; en <strong>régime réel</strong>, les obligations sont différentes (voir l&apos;encart
                ci-dessous si un bien est au réel).
              </p>

              {biensBicRegimeReel.length > 0 && (
                <div
                  role="status"
                  className="rounded-lg border border-orange-200 bg-orange-50/90 px-3 py-3 text-sm text-orange-950 shadow-sm"
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 shrink-0 text-orange-700 mt-0.5" aria-hidden />
                    <div className="min-w-0 space-y-2">
                      <p className="font-semibold text-orange-950">Régime réel BIC détecté</p>
                      <p className="text-sm leading-relaxed text-orange-950/95">
                        Vous êtes au régime réel en location meublée (LMNP/LMP).
                        <br />
                        Vous devez tenir une comptabilité et produire une liasse fiscale (formulaires 2031 et 2033).
                        <br />
                        Le montant affiché ici ne peut pas être déclaré directement sur impots.gouv.
                      </p>
                      <p className="text-[11px] text-orange-900/90">
                        Biens concernés :{' '}
                        {biensBicRegimeReel.map((b) => b.nom).join(', ')}
                      </p>
                      <div className="pt-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-orange-300 bg-white text-orange-950 hover:bg-orange-50"
                          onClick={() =>
                            window.open(
                              'https://www.impots.gouv.fr/particuliers/vosdroits/F2342',
                              '_blank',
                              'noopener,noreferrer'
                            )
                          }
                        >
                          <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                          Comprendre ma déclaration LMNP
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <ul className="text-xs text-gray-700 space-y-2 list-none pl-0">
                {biensBicHors2044Foncier.map((b) => (
                  <li key={b.id} className="border-b border-amber-100/80 pb-2 last:border-0 last:pb-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-gray-900">{b.nom}</span>
                      {(b.regimeUtilise || b.regime) === 'reel' && (
                        <Badge variant="outline" className="text-[10px] border-orange-300 bg-orange-50 text-orange-900">
                          Régime réel BIC
                        </Badge>
                      )}
                    </div>
                    <div className="text-gray-600 mt-0.5">
                      {libelleTypeFiscalPourAffichage(b.type)} — {libelleRegimeFiscalPourAffichage(b)}
                    </div>
                    <div className="text-amber-900 font-semibold mt-0.5">
                      Recettes brutes : {formatEuro(b.recettesBrutes || 0)}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </BlockCard>
      )}

      {biensSciIsHors2044.length > 0 && (
        <BlockCard
          title="SCI à l’impôt sur les sociétés (hors 2044)"
          icon={<FileText className="h-5 w-5 text-slate-600" />}
          badge={
            <Badge variant="outline" className="bg-slate-100 text-slate-800 border-slate-200 text-xs">
              {biensSciIsHors2044.length} bien{biensSciIsHors2044.length > 1 ? 's' : ''}
            </Badge>
          }
        >
          <Card className="border border-slate-200 bg-slate-50/60 shadow-sm">
            <CardContent className="p-4 text-sm text-gray-800 space-y-2">
              <p>
                Ces biens sont en <strong>SCI à l’IS</strong> : ils ne sont pas concernés par la 2044 revenus fonciers
                personnels affichée ici.
              </p>
              <ul className="text-xs list-disc list-inside space-y-1">
                {biensSciIsHors2044.map((b) => (
                  <li key={b.id}>
                    <span className="font-medium">{b.nom}</span> — {libelleRegimeFiscalPourAffichage(b)}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </BlockCard>
      )}

      {declarationFoncierOnly.length > 0 && (
        <BlockCard
          title="Détail par bien (2044)"
          icon={<span className="text-lg leading-none" aria-hidden>🏠</span>}
          badge={
            <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-300">
              {declarationFoncierOnly.length} bien(s) en location nue (2044)
            </Badge>
          }
        >
          <div className="space-y-4">
            {(qualityTotals.missingHintCount > 0 ||
              qualityTotals.unmappedCount > 0 ||
              qualityTotals.ambiguousTransactions.length > 0 ||
              qualityTotals.loanAmbiguities.length > 0) && (
              <Card className="border-amber-300 bg-amber-50/60">
                <CardContent className="p-4 text-sm text-amber-900 space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span className="font-semibold">À contrôler avant d&apos;envoyer votre déclaration</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {qualityTotals.missingHintCount > 0 && (
                      <li>
                        Indicateurs fiscaux (ligne 2044) incomplets sur certaines catégories — complétez-les dans{' '}
                        <strong>Admin / natures &amp; catégories</strong>.
                      </li>
                    )}
                    {categorizationSignaledCount > 0 && (
                      <li>
                        <strong>Catégorisation incertaine</strong> sur certaines charges —{' '}
                        <strong>
                          {categorizationSignaledCount} dépense{categorizationSignaledCount > 1 ? 's' : ''} à corriger
                        </strong>{' '}
                        <button
                          type="button"
                          className="font-semibold underline underline-offset-2 hover:text-amber-700"
                          onClick={openCategorizationAssistant}
                        >
                          Voir l&apos;assistant de catégorisation
                        </button>
                        .
                      </li>
                    )}
                    {qualityTotals.loanAmbiguities.length > 0 && (
                      <li>
                        <strong>Correction recommandée</strong> sur la répartition automatique des prêts ou des
                        intérêts d&apos;emprunt.
                      </li>
                    )}
                  </ul>
                  <div className="pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-amber-400 text-amber-900 hover:bg-amber-100"
                      onClick={() => {
                        window.location.href = '/admin/natures-categories';
                      }}
                    >
                      Ouvrir natures &amp; catégories (admin)
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {categorizationSignaledCount > 0 && (
              <Declaration2044CategorizationAssistant
                year={simulation.inputs.year}
                items={enrichedFiscal2044Ambiguities}
                totalSignaledForContext={categorizationSignaledCount}
                formatEuro={formatEuro}
                anchorId="assistant-categorisation-2044"
                highlightActive={assistantHighlightActive}
              />
            )}

            <Card className="border border-dashed border-emerald-200 bg-emerald-50/30">
              <CardContent className="p-4 text-sm text-gray-700">
                <p>
                  Le détail 2044 par bien (tableaux, badges, intérêts d&apos;emprunt) s&apos;ouvre dans une fenêtre
                  depuis la checklist : cliquez sur <strong className="text-emerald-900">Voir le détail du bien</strong>{' '}
                  à côté du nom du bien concerné.
                </p>
              </CardContent>
            </Card>

          </div>
        </BlockCard>
      )}

      <Card className="border border-slate-200 bg-white shadow-sm">
        <CardContent className="p-0">
          <button
            type="button"
            onClick={() => setBaremeOuvert((v) => !v)}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Calculator className="h-5 w-5 text-slate-600 shrink-0" />
              <span className="font-medium text-gray-900 truncate">⚙️ Barème fiscal utilisé</span>
              <Badge variant="outline" className="font-mono text-[10px] shrink-0 bg-slate-50">
                {simulation.taxParams.version}
              </Badge>
            </div>
            {baremeOuvert ? (
              <ChevronUp className="h-5 w-5 text-gray-500 shrink-0" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-500 shrink-0" />
            )}
          </button>
          {baremeOuvert && (
            <div className="border-t border-slate-200 px-4 py-3 text-sm text-gray-800 bg-slate-50/40">
              <ul className="text-xs space-y-1.5 list-disc list-inside text-gray-700">
                <li>
                  Année des revenus : <span className="font-medium">{simulation.inputs.year}</span>
                </li>
                <li>
                  Version barème : <span className="font-mono">{simulation.taxParams.version}</span>
                </li>
                <li>Prélèvements sociaux (taux patrimoine) : {formatPercent(simulation.taxParams.psRate)}</li>
                <li>
                  Micro-foncier (référence) : abattement {formatPercent(simulation.taxParams.micro.foncierAbattement)},
                  plafond {formatEuro(simulation.taxParams.micro.foncierPlafond)}
                </li>
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* BLOC 6 : EXPORTS */}
      <BlockCard
        title="📥 Exporter votre déclaration"
        icon={<Download className="h-5 w-5 text-emerald-600" />}
      >
        <Card className="border-2 border-emerald-300 bg-white shadow-sm">
          <CardContent className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Button
                variant="outline"
                className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                onClick={() => generateCerfaPDF(simulation)}
              >
                <Download className="h-4 w-4 mr-2" />
                Export PDF CERFA
              </Button>

              <Button
                variant="outline"
                className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                onClick={() => {
                  // Export CSV avec format date
                  const now = new Date();
                  const dateStr = now.toLocaleDateString('fr-FR').replace(/\//g, '_');
                  const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(/:/g, '_');
                  const filename = `Declaration_en_ligne_des_revenus_${simulation.inputs.year}_le_${dateStr}_a_${timeStr}_.csv`;
                  
                  const csvData = cases.map(c => 
                    `${c.formulaire};${c.code};${c.libelle};${c.montant}`
                  ).join('\n');
                  const blob = new Blob([`Formulaire;Case;Libellé;Montant\n${csvData}`], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = filename;
                  a.click();
                }}
              >
                <FileText className="h-4 w-4 mr-2" />
                Export CSV
              </Button>

              <Button
                variant="outline"
                className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                disabled
              >
                <Mail className="h-4 w-4 mr-2" />
                Envoyer par mail
              </Button>
            </div>
          </CardContent>
        </Card>
      </BlockCard>

      <BlockCard
        title="Alertes et rappels"
        icon={<AlertCircle className="h-5 w-5 text-amber-600" />}
      >
        <div className="space-y-3">
          {simulation.per && (
            <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg">
              <p className="text-sm text-blue-900 font-medium mb-1">
                ℹ️ Les PS ne sont pas modifiés par le PER
              </p>
              <p className="text-xs text-blue-700">
                Le PER réduit l&apos;impôt sur le revenu, mais pas les prélèvements sociaux sur les revenus immobiliers.
              </p>
            </div>
          )}

          {(() => {
            const trancheActuelle = simulation.ir.detailsTranches?.find(
              (d) => d.tranche.rate === simulation.ir.trancheMarginate
            );
            const revenuParPart = simulation.ir.revenuImposable / (simulation.inputs.foyer?.parts || 1);
            const distancePlafond = trancheActuelle?.tranche.upper
              ? trancheActuelle.tranche.upper - revenuParPart
              : null;

            return (
              <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-lg">
                <p className="text-sm text-amber-900 font-medium mb-2">
                  ⚠️ Votre TMI actuel : {formatPercent(simulation.ir.trancheMarginate)}
                </p>
                {trancheActuelle && (
                  <div className="space-y-1 text-xs text-amber-700 mb-2">
                    <p>
                      • Seuil de votre tranche : {formatEuro(trancheActuelle.tranche.lower)} -{' '}
                      {trancheActuelle.tranche.upper ? formatEuro(trancheActuelle.tranche.upper) : '∞'}
                    </p>
                    <p>
                      • Votre revenu par part : <span className="font-semibold">{formatEuro(revenuParPart)}</span>
                    </p>
                    {distancePlafond && distancePlafond > 0 && (
                      <p>
                        • Marge avant tranche supérieure :{' '}
                        <span className="font-semibold text-amber-800">{formatEuro(distancePlafond)}</span>
                      </p>
                    )}
                  </div>
                )}
                <p className="text-xs text-amber-700">
                  Attention aux variations de revenus qui pourraient vous faire changer de tranche.
                </p>
              </div>
            );
          })()}

          {simulation.consolidation.deficitImputableRevenuGlobal > 0 && (
            <div className="bg-purple-50 border-l-4 border-purple-400 p-4 rounded-r-lg">
              <p className="text-sm text-purple-900 font-medium mb-1">📊 Déficit foncier imputé automatiquement</p>
              <p className="text-xs text-purple-700">
                Votre déficit de {formatEuro(simulation.consolidation.deficitImputableRevenuGlobal)} est automatiquement
                imputé sur le revenu global dans la limite des règles légales (10 700 €/an hors intérêts).
              </p>
            </div>
          )}
        </div>
      </BlockCard>

      {(() => {
        const pasSim = simulatePAS(simulation);
        const opts = simulation.inputs?.options;
        const opt = computeWithholdingOptimization(simulation, opts ?? undefined, new Date());
        if (!opt || !pasSim) return null;
        const title = "Conseils pour impots.gouv";
        return (
          <BlockCard
            title={title}
            icon={<span className="text-lg leading-none" aria-hidden>💡</span>}
          >
            <Card className="border-2 border-indigo-200 bg-indigo-50/30 shadow-sm">
              <CardContent className="p-4 space-y-3">
                <div className="rounded-lg bg-white/80 border border-indigo-200 p-3">
                  <p className="text-xs font-semibold text-indigo-900 mb-2">À retenir</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-800">
                    <p>
                      Taux PAS estimé : <strong>{pasSim.pas_rate} %</strong>
                    </p>
                    <p>
                      Total mensuel estimé : <strong>{formatEuro(pasSim.total_mensuel)} / mois</strong>
                    </p>
                    <p className="text-[11px] text-gray-600 sm:col-span-2">
                      (détail : acompte IR foncier {formatEuro(pasSim.acompte_ir_foncier)} / mois, PS{' '}
                      {formatEuro(pasSim.acompte_ps)} / mois)
                    </p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-indigo-200 text-indigo-900"
                    onClick={() => setConseilsOuverts((v) => !v)}
                  >
                    {conseilsOuverts ? 'Masquer les explications' : 'Voir les explications'}
                  </Button>
                </div>

                {conseilsOuverts && (
                  <div className="space-y-3">
                    <div className="p-3 rounded-lg bg-sky-50 border border-sky-200">
                      <p className="text-xs font-semibold text-sky-900 mb-2 flex items-center gap-1">
                        <Info className="h-3.5 w-3.5" />
                        Reproduire sur impots.gouv
                      </p>
                      <p className="text-[11px] text-sky-800 mb-3">
                        Dans « Actualiser mon prélèvement à la source → Revenus estimés », utilisez :
                      </p>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-sky-800">1AJ — Salaires nets imposables</span>
                          <span className="font-semibold text-sky-900">{formatEuro(simulation.inputs.foyer.salaire)}</span>
                        </div>
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-sky-800">4BA — Revenus fonciers nets</span>
                          <span className="font-semibold text-sky-900">
                            {formatEuro(revenuFoncier2044Resume)}
                          </span>
                        </div>
                        <p className="text-[10px] text-sky-800 mt-2 flex items-start gap-1">
                          <span aria-hidden>ℹ️</span>
                          <span>
                            En principe pré-rempli sur impots.gouv après la 2044 — comparez sans refaire une saisie
                            manuelle si le montant est déjà présent.
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                      <p className="text-xs font-semibold text-blue-900 mb-2">
                        Pourquoi ce taux peut différer de la recommandation Smartimmo ?
                      </p>
                      <p className="text-[11px] text-blue-900 mb-2">
                        impots.gouv sépare le prélèvement en deux mécanismes : le PAS sur les salaires, et des acomptes
                        mensuels pour les revenus immobiliers. Smartimmo peut proposer un taux « optimisé » pour lisser
                        votre trésorerie ({opt.pasIdealPercent} %).
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </BlockCard>
        );
      })()}

      {/* MODE EXPERT : Blocs supplémentaires */}
      {isExpertMode && <ExpertDeclarationBlocks simulation={simulation} />}

      {/* MODALE : DÉTAILS D'UNE CASE */}
      {showModal && selectedCase && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-emerald-50">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center">
                  <span className="text-white font-bold text-lg">{selectedCase.code}</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{selectedCase.libelle}</h3>
                  <p className="text-sm text-gray-600">Formulaire {selectedCase.formulaire}</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-emerald-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-600" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Montant */}
              <div className="bg-emerald-50 border-2 border-emerald-300 rounded-lg p-5 text-center">
                <p className="text-sm text-gray-600 mb-2">
                  {selectedCase.code === '4BA' ? 'Montant de référence (comparaison)' : 'Montant à reporter'}
                </p>
                <p className="text-4xl font-bold text-emerald-600">
                  {formatEuro(Math.abs(selectedCase.montant))}
                </p>
              </div>
              {selectedCase.code === '4BA' && (
                <p className="text-xs text-sky-900 bg-sky-50 border border-sky-200 rounded-lg px-3 py-2">
                  Sur impots.gouv, la case <strong>4BA</strong> de la 2042 est en général remplie automatiquement après
                  validation de la <strong>2044</strong>. Utilisez ce montant pour vérifier la cohérence, sans le saisir
                  une seconde fois si le site l&apos;a déjà reporté.
                </p>
              )}

              {/* À quoi sert cette case */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Info className="h-4 w-4 text-emerald-600" />
                  À quoi sert cette case ?
                </h4>
                <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded">
                  {selectedCase.explication}
                </p>
              </div>

              {/* Comment SmartImmo l'a calculé */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-emerald-600" />
                  Comment SmartImmo l'a calculé ?
                </h4>
                <p className="text-sm text-gray-700 bg-emerald-50 p-3 rounded border border-emerald-200">
                  Ce montant provient de : <strong>{selectedCase.provenance}</strong>
                </p>
              </div>

              {/* Lien officiel */}
              {selectedCase.source && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <ExternalLink className="h-4 w-4 text-emerald-600" />
                    Documentation officielle
                  </h4>
                  <a
                    href={selectedCase.source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-emerald-600 hover:text-emerald-700 underline flex items-center gap-1"
                  >
                    Voir la documentation sur impots.gouv.fr
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowModal(false)}>
                Fermer
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog
        open={declarationBienDetailId != null}
        onOpenChange={(open) => {
          if (!open) setDeclarationBienDetailId(null);
        }}
      >
        <DialogContent className="md:max-w-3xl w-[calc(100vw-16px)] max-h-[92vh] overflow-y-auto gap-3 p-4 md:p-6">
          <DialogHeader className="sr-only">
            <DialogTitle>
              {declarationBienDetailSelection
                ? `Détail 2044 — ${declarationBienDetailSelection.bien.nom}`
                : 'Détail bien'}
            </DialogTitle>
          </DialogHeader>
          {declarationBienDetailSelection && (
            <Declaration2044BienDetailPanel
              bien={declarationBienDetailSelection.bien}
              declaration={declarationBienDetailSelection.declaration}
              formatEuro={formatEuro}
            />
          )}
        </DialogContent>
      </Dialog>

      {copyFeedback && (
        <div
          role="status"
          className="fixed bottom-4 left-1/2 z-[60] max-w-md -translate-x-1/2 rounded-lg border border-emerald-200 bg-emerald-900 px-4 py-2 text-center text-sm text-white shadow-lg"
        >
          {copyFeedback}
        </div>
      )}
    </div>
  );
}

