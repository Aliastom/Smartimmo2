/**
 * Bloc "Pilotage PAS & acomptes" : saisie des 4 champs + pilotage fiscal réaliste (type DGFiP).
 * Affiche situation actuelle, impôt estimé, 3 stratégies et texte explicatif.
 */

'use client';

import React from 'react';
import { Label } from '@/components/ui/Label';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Euro, Percent, Target, Calendar, TrendingUp } from 'lucide-react';
import { WithholdingBreakdownBars } from './WithholdingBreakdownBars';
import { WithholdingScenarioCards } from './WithholdingScenarioCards';
import {
  computeWithholdingOptimization,
  type AdvanceFrequency,
  type WithholdingOptimizerInputs,
} from '@/lib/fiscal/withholdingOptimizer';
import { type WithholdingGoal } from '@/lib/fiscal/withholdingRecommendations';
import type { SimulationResult } from '@/types/fiscal';
import { allocateProRataTwoWeights } from '@/lib/fiscal/immoTaxDisplayAlloc';

const GOAL_LABELS: Record<WithholdingGoal, string> = {
  avoid_catchup: 'Éviter tout rattrapage',
  smooth_cashflow: 'Lisser la trésorerie',
  keep_cash: 'Garder plus de cash et accepter un solde',
};

const GOAL_SUMMARY: Record<WithholdingGoal, { effet: string; risque: string }> = {
  avoid_catchup: {
    effet: 'Couverture maximale de l\'impôt estimé, solde final proche de zéro.',
    risque: 'Aucun : vous évitez tout rattrapage l\'année suivante.',
  },
  smooth_cashflow: {
    effet: 'Répartition équilibrée de l\'effort fiscal sur l\'année (PAS + acomptes).',
    risque: 'Aucun si vous suivez les montants suggérés.',
  },
  keep_cash: {
    effet: 'Prélèvements immédiats limités, trésorerie préservée.',
    risque: 'Solde à régulariser l\'année suivante, selon le niveau d\'acomptes que vous choisissez.',
  },
};

/** Texte additionnel selon objectif, pour la stratégie recommandée */
const GOAL_STRATEGY_CONTEXT: Record<WithholdingGoal, Partial<Record<'pas_only' | 'acomptes_only' | 'combined', string>>> = {
  avoid_catchup: {
    combined: 'Cette stratégie maximise la couverture pour éviter tout rattrapage.',
    acomptes_only: 'Cette stratégie couvre l\'écart par les acomptes tout en gardant votre PAS inchangé.',
  },
  smooth_cashflow: {
    combined: 'Cette stratégie répartit l\'effort entre salaire et acomptes pour lisser votre trésorerie.',
    acomptes_only: 'Cette stratégie compense par les acomptes uniquement.',
  },
  keep_cash: {
    acomptes_only: 'L\'acompte affiché est théorique pour couvrir totalement l\'impôt. Selon votre objectif, vous pouvez payer moins et accepter un solde à régulariser.',
    combined: 'Alternative si vous souhaitez répartir l\'effort : PAS + acomptes.',
  },
};

const FREQUENCY_LABELS: Record<AdvanceFrequency, string> = {
  monthly: 'Mensuel',
  quarterly: 'Trimestriel',
};

export interface PilotagePASBlockProps {
  mode: 'full' | 'summary';
  simulation?: SimulationResult | null;
  currentPersonalizedRate?: number | null;
  currentDgfipAdvanceAmount?: number | null;
  currentAdvanceFrequency?: AdvanceFrequency | null;
  withholdingGoal?: WithholdingGoal | null;
  onCurrentPersonalizedRateChange?: (value: number | null) => void;
  onCurrentDgfipAdvanceAmountChange?: (value: number | null) => void;
  onCurrentAdvanceFrequencyChange?: (value: AdvanceFrequency | null) => void;
  onWithholdingGoalChange?: (value: WithholdingGoal | null) => void;
}

function formatEuro(amount: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatPercent(rate: number) {
  return `${(rate * 100).toFixed(1)} %`;
}

export function PilotagePASBlock({
  mode,
  simulation,
  currentPersonalizedRate,
  currentDgfipAdvanceAmount,
  currentAdvanceFrequency,
  withholdingGoal,
  onCurrentPersonalizedRateChange,
  onCurrentDgfipAdvanceAmountChange,
  onCurrentAdvanceFrequencyChange,
  onWithholdingGoalChange,
}: PilotagePASBlockProps) {
  const optimizerInputs: WithholdingOptimizerInputs = {
    currentPersonalizedRate: currentPersonalizedRate ?? simulation?.inputs?.options?.currentPersonalizedRate ?? null,
    currentDgfipAdvanceAmount: currentDgfipAdvanceAmount ?? simulation?.inputs?.options?.currentDgfipAdvanceAmount ?? null,
    currentAdvanceFrequency: currentAdvanceFrequency ?? simulation?.inputs?.options?.currentAdvanceFrequency ?? 'monthly',
    strategyGoal: withholdingGoal ?? simulation?.inputs?.options?.withholdingGoal ?? undefined,
  };

  const optimization = simulation
    ? computeWithholdingOptimization(simulation, optimizerInputs, new Date())
    : null;

  const showBlock = !!optimization && (mode === 'summary' || !!simulation);

  return (
    <div className="space-y-4">
      {mode === 'full' && (
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Target className="h-4 w-4 text-indigo-600" />
          Pilotage PAS & acomptes
        </h3>
      )}
      {mode === 'full' && (
        <p className="text-[10px] text-gray-500 bg-gray-50 border border-gray-200 rounded px-2 py-1.5">
          <strong className="text-gray-700">À ne pas confondre :</strong> «&nbsp;déjà payé cette année&nbsp;» = total versé sur l’année (bloc au‑dessus) • <strong>acompte actuel</strong> = versement par période (saisie ci‑dessous) • <strong>acompte suggéré</strong> = estimation d’ajustement Smartimmo.
        </p>
      )}

      {mode === 'full' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="pas-rate" className="text-xs text-gray-600">
              Taux personnalisé actuel (%)
            </Label>
            <div className="relative mt-1">
              <Percent className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="pas-rate"
                type="number"
                step={0.1}
                min={0}
                max={100}
                value={currentPersonalizedRate ?? ''}
                onChange={(e) => {
                  const v = e.target.value;
                  onCurrentPersonalizedRateChange?.(v === '' ? null : Number(v));
                }}
                className="pl-10"
                placeholder="ex. 10,6"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="pas-advance" className="text-xs text-gray-600">
              Acompte actuel (€)
            </Label>
            <p className="text-[10px] text-gray-500 mt-0.5 mb-1">Versement par période (mois ou trimestre), distinct des acomptes déjà payés sur l’année</p>
            <div className="relative mt-1">
              <Euro className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="pas-advance"
                type="number"
                min={0}
                value={currentDgfipAdvanceAmount ?? ''}
                onChange={(e) => {
                  const v = e.target.value;
                  onCurrentDgfipAdvanceAmountChange?.(v === '' ? null : Number(v));
                }}
                className="pl-10"
                placeholder="ex. 42"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="pas-frequency" className="text-xs text-gray-600">
              Périodicité des acomptes
            </Label>
            <p className="text-[10px] text-gray-500 mt-0.5 mb-1">Par défaut : mensuel</p>
            <select
              id="pas-frequency"
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              value={currentAdvanceFrequency ?? 'monthly'}
              onChange={(e) => {
                const v = e.target.value;
                onCurrentAdvanceFrequencyChange?.(v === '' ? null : (v as AdvanceFrequency));
              }}
            >
              <option value="monthly">Mensuel</option>
              <option value="quarterly">Trimestriel</option>
            </select>
          </div>
          <div>
            <Label htmlFor="pas-goal" className="text-xs text-gray-600">
              Objectif
            </Label>
            <p className="text-[10px] text-gray-500 mt-0.5 mb-1">Par défaut : lisser la trésorerie</p>
            <select
              id="pas-goal"
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              value={withholdingGoal ?? 'smooth_cashflow'}
              onChange={(e) => {
                const v = e.target.value;
                onWithholdingGoalChange?.(v === '' ? null : (v as WithholdingGoal));
              }}
            >
              {Object.entries(GOAL_LABELS).map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {showBlock && optimization && (() => {
        const goal: WithholdingGoal = withholdingGoal ?? simulation?.inputs?.options?.withholdingGoal ?? 'smooth_cashflow';
        const summary = GOAL_SUMMARY[goal];
        return (
        <div className="space-y-4">
            <p className="text-xs font-semibold text-indigo-900 flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" />
              Suggestion Smartimmo (repère de pilotage)
            </p>

            {/* Objectif sélectionné / Effet recherché / Risque accepté */}
            <div className="rounded-lg border border-indigo-200 bg-indigo-50/30 p-3">
              <p className="text-xs font-semibold text-gray-800 mb-2">Rappel de votre objectif</p>
              <ul className="space-y-1 text-[11px] text-gray-700">
                <li><strong>Objectif sélectionné :</strong> {GOAL_LABELS[goal]}</li>
                <li><strong>Effet recherché :</strong> {summary.effet}</li>
                <li><strong>Risque accepté :</strong> {summary.risque}</li>
              </ul>
            </div>

            {/* Mois restants */}
            <div className="flex flex-col gap-1 text-xs text-gray-600">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-indigo-500 shrink-0" />
              <span>{optimization.moisRestants} mois restants dans l’année pour ajuster vos prélèvements.
              </span>
              </div>
              <p className="text-[11px] pl-6">
                Les montants recommandés ci-dessous sont calculés en répartissant l&apos;impôt restant sur ces {optimization.moisRestants} mois.
              </p>
            </div>

            {/* Situation actuelle */}
            <div className="rounded-lg bg-white/80 border border-indigo-100 p-3">
              <p className="text-xs font-semibold text-gray-700 mb-2">Situation actuelle</p>
              <ul className="space-y-1 text-sm text-gray-700">
                <li>• PAS annuel estimé avec votre taux actuel : <strong>{formatEuro(optimization.paiementsEstimes.pasAnnuelEstime)}</strong></li>
                <li>• Acomptes annuels estimés avec vos paramètres actuels : <strong>{formatEuro(optimization.paiementsEstimes.acompteAnnuelEstime)}</strong></li>
                <li>• Total estimé qui serait payé cette année si rien ne change : <strong>{formatEuro(optimization.paiementsEstimes.total)}</strong></li>
              </ul>
              <p className="text-[11px] text-gray-600 mt-2 pt-2 border-t border-indigo-100">
                Ces montants sont des estimations basées sur vos paramètres actuels de prélèvement.
              </p>
            </div>

            {/* Impôt estimé + écart */}
            <div className="rounded-lg bg-white/80 border border-indigo-100 p-3">
              <p className="text-xs font-semibold text-gray-700 mb-1">Impôt estimé (année en cours)</p>
              <p className="text-lg font-bold text-indigo-700">{formatEuro(optimization.impotEstime)}</p>
              {optimization.ecartAnnuel !== 0 && (
                <p className={`text-xs mt-1 ${optimization.ecartAnnuel > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>
                  {optimization.ecartAnnuel > 0
                    ? `Sous-prélèvement estimé : environ ${formatEuro(optimization.ecartAnnuel)} sur l'année si vos prélèvements actuels restent inchangés.`
                    : `Sur-prélèvement estimé : ${formatEuro(-optimization.ecartAnnuel)}.`}
                </p>
              )}
            </div>

            {/* Origine de l'impôt estimé (bloc pédagogique) */}
            {simulation && (() => {
              const totalTax = (simulation.ir?.impotNet ?? 0) + (simulation.ps?.montant ?? 0);
              const realEstateIncomeTax = simulation.resume?.irSupplementaire ?? 0;
              const realEstateTotalTax = simulation.resume?.impotsSuppTotal ?? 0;
              const realEstateSocialTax = Math.max(0, realEstateTotalTax - realEstateIncomeTax);
              const salaryTax = Math.max(0, totalTax - realEstateTotalTax);
              const fiscaliteImmobilier = realEstateIncomeTax + realEstateSocialTax;
              const baseNu = Math.max(0, simulation.consolidation?.revenusFonciers ?? 0);
              const baseBic = Math.max(0, simulation.consolidation?.revenusBIC ?? 0);
              const resultatFoncierNet = baseNu + baseBic;
              const tauxImpositionImmobilier = resultatFoncierNet > 0 ? fiscaliteImmobilier / resultatFoncierNet : 0;
              const irAllocImmo = allocateProRataTwoWeights(realEstateIncomeTax, baseNu, baseBic);
              const psAllocImmo = allocateProRataTwoWeights(realEstateSocialTax, baseNu, baseBic);
              return (
                <div className="rounded-lg bg-white/80 border border-indigo-100 p-3">
                  <p className="text-xs font-semibold text-gray-700 mb-2">Origine de l&apos;impôt estimé</p>
                  <p className="text-sm font-medium text-gray-800 mb-2">Impôt total estimé : {formatEuro(totalTax)}</p>
                  <p className="text-[11px] text-gray-600 mb-1.5">dont :</p>
                  <ul className="space-y-0.5 text-xs text-gray-700">
                    <li>• IR estimé sur le foyer hors apport immobilier (référence) : {formatEuro(salaryTax)}</li>
                    <li>
                      • IR supplémentaire lié à la <strong>location nue (NU)</strong> (indicatif) :{' '}
                      {formatEuro(irAllocImmo.nu)}
                    </li>
                    <li>
                      • IR supplémentaire lié au <strong>LMNP / BIC</strong> (indicatif) :{' '}
                      {formatEuro(irAllocImmo.bic)}
                    </li>
                    <li>
                      • PS liés à la base <strong>NU</strong> (indicatif) : {formatEuro(psAllocImmo.nu)}
                    </li>
                    <li>
                      • PS liés à la base <strong>LMNP / BIC</strong> (indicatif) : {formatEuro(psAllocImmo.bic)}
                    </li>
                    <li className="text-[10px] text-gray-500 pt-1">
                      Les montants IR/PS « par nature » sont une ventilation au prorata des bases retenues par le moteur
                      (non linéaire pour l&apos;IR).
                    </li>
                    <li className="font-medium text-indigo-800 pt-1 mt-1 border-t border-indigo-100">
                      • Fiscalité totale liée à l&apos;immobilier (IR supp. + PS) : {formatEuro(fiscaliteImmobilier)}
                    </li>
                    {resultatFoncierNet > 0 && (
                      <li className="font-medium text-indigo-800">
                        • Taux réel d&apos;imposition immobilier (sur bases NU + BIC) :{' '}
                        {formatPercent(tauxImpositionImmobilier)}
                      </li>
                    )}
                  </ul>
                  <p className="text-[11px] text-gray-600 mt-2 pt-2 border-t border-indigo-100">
                    Le PAS couvre principalement l&apos;impôt sur les revenus salariés. Les acomptes couvrent souvent la
                    fiscalité liée aux revenus fonciers (2044) et au BIC (2042 C PRO).
                  </p>
                </div>
              );
            })()}

            {/* Répartition des prélèvements estimés (barres) */}
            <div className="rounded-lg bg-white/80 border border-indigo-100 p-3">
              <p className="text-xs font-semibold text-gray-700 mb-3">Répartition des prélèvements estimés</p>
              <WithholdingBreakdownBars
                impotTotal={optimization.impotEstime}
                pasActuel={optimization.paiementsEstimes.pasAnnuelEstime}
                acomptesActuels={optimization.paiementsEstimes.acompteAnnuelEstime}
              />
            </div>

            {/* 3 stratégies */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-700">Stratégies de pilotage</p>
              {optimization.strategies.map((s) => {
                const strategyLabels: Record<string, string> = {
                  pas_only: 'Stratégie 1 — Ajuster uniquement le PAS',
                  acomptes_only: 'Stratégie 2 — Ajuster uniquement les acomptes',
                  combined: 'Stratégie 3 — Combinaison PAS + acomptes',
                };
                const acompteLabel = s.id === 'combined'
                  ? (goal === 'keep_cash' ? 'Acompte mensuel si vous couvrez' : 'Acompte mensuel recommandé dans cette stratégie')
                  : (goal === 'keep_cash' && s.id === 'acomptes_only' ? 'Acompte théorique pour couvrir' : 'Acompte mensuel cible');
                const goalContext = s.recommended ? (GOAL_STRATEGY_CONTEXT[goal][s.id] ?? s.description) : s.description;
                return (
                <div
                  key={s.id}
                  className={`rounded-lg border p-3 text-sm ${
                    s.recommended ? 'border-indigo-400 bg-indigo-50/50' : 'border-gray-200 bg-gray-50/50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-medium text-gray-900">{strategyLabels[s.id]}</span>
                    {s.recommended && (
                      <Badge variant="outline" className="bg-indigo-100 text-indigo-800 border-indigo-300 text-[10px]">
                        Recommandée pour votre objectif
                      </Badge>
                    )}
                  </div>
                  <ul className="text-xs text-gray-700 space-y-0.5">
                    {s.pasCiblePercent != null && (
                      <li>• PAS cible : <strong>{s.pasCiblePercent} %</strong></li>
                    )}
                    {s.acompteMensuelCible != null && (
                      <li>
                        • {acompteLabel} : <strong>{formatEuro(s.acompteMensuelCible)}</strong>
                        {s.acompteTrimestrielCible != null && (
                          <span className="text-gray-600"> (ou {formatEuro(s.acompteTrimestrielCible)} / trimestre)</span>
                        )}
                        {s.id === 'combined' && goal !== 'keep_cash' && (
                          <span className="text-gray-600 block mt-0.5">(calculé sur les {optimization.moisRestants} mois restants de l&apos;année)</span>
                        )}
                      </li>
                    )}
                    {s.ecartRestantEstime !== 0 && (
                      <li>• Écart restant estimé : {formatEuro(s.ecartRestantEstime)}</li>
                    )}
                  </ul>
                  <p className="text-[11px] text-gray-600 mt-1.5">{goalContext}</p>
                </div>
                );
              })}
            </div>

            {/* Deux scénarios clairement distincts */}
            <WithholdingScenarioCards
              pasRecommande={optimization.pasIdealPercent}
              acompteRecommande={optimization.strategies.find((s) => s.id === 'combined')?.acompteMensuelCible ?? null}
              pasConserve={optimization.strategies.find((s) => s.id === 'acomptes_only')?.pasCiblePercent ?? null}
              acompteNecessaire={optimization.acompteIdealMensuel}
              goal={goal}
              ecartAnnuel={optimization.ecartAnnuel}
            />

            <p className="text-xs text-gray-600 leading-snug">{optimization.messageRecap}</p>

            {/* Texte explicatif selon objectif */}
            <p className="text-[11px] text-gray-500 border-t border-indigo-100 pt-3 mt-1">
              Le PAS couvre principalement vos revenus salariés. Les acomptes couvrent les revenus non soumis au PAS (revenus fonciers, BIC, etc.).
              {goal === 'avoid_catchup' && ' Pour éviter tout rattrapage, visez une couverture maximale via la stratégie recommandée.'}
              {goal === 'smooth_cashflow' && " Une combinaison des deux permet de lisser l'effort fiscal sur l'année."}
              {goal === 'keep_cash' && " Avec l'objectif « garder du cash », vous pouvez limiter vos acomptes et accepter un solde à régulariser."}
            </p>
            <p className="text-[10px] text-gray-400 mt-2 italic">
              Les montants PAS affichés sont des estimations de pilotage basées sur votre simulation. Le calcul réel DGFiP peut différer.
            </p>
        </div>
        );
      })()}

      {mode === 'summary' && !simulation && (
        <p className="text-xs text-gray-500">Calculez une simulation pour voir le pilotage PAS & acomptes.</p>
      )}
    </div>
  );
}
