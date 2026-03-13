/**
 * Moteur de recommandation pour le pilotage du prélèvement à la source et des acomptes DGFiP.
 * Ne confond jamais TMI (taux marginal) et taux personnalisé PAS.
 */

export type WithholdingGoal = 'avoid_catchup' | 'smooth_cashflow' | 'keep_cash';
export type AdvanceFrequency = 'monthly' | 'quarterly';

export interface WithholdingInputs {
  /** Revenu imposable total (€) */
  revenuImposableTotal: number;
  /** Impôt total estimé (IR + PS) (€) */
  impotTotalEstime: number;
  /** PAS déjà payé (prélèvement à la source) (€) */
  pasDejaPaye: number;
  /** Acomptes déjà payés (€) */
  acomptesDejaPayes: number;
  /** Taux personnalisé actuel (%) - ex: 10.6 */
  currentPersonalizedRate?: number | null;
  /** Acompte DGFiP actuel (€) par période */
  currentDgfipAdvanceAmount?: number | null;
  /** Périodicité des acomptes */
  currentAdvanceFrequency?: AdvanceFrequency | null;
  /** Objectif utilisateur */
  withholdingGoal?: WithholdingGoal | null;
  /** Résultat foncier net (pour suggestion acomptes) */
  resultatFoncierEstime?: number;
}

export type RecommendationMode = 'rate' | 'advance' | 'mixed' | 'none';

export interface WithholdingRecommendation {
  /** Taux moyen estimé (impôt / revenu) en ratio 0-1 */
  estimatedAverageRate: number;
  /** Taux personnalisé conseillé (%) */
  recommendedPersonalizedRate: number | null;
  /** Acompte mensuel conseillé (€) */
  recommendedMonthlyAdvance: number | null;
  /** Acompte trimestriel conseillé (€) */
  recommendedQuarterlyAdvance: number | null;
  /** Écart / rattrapage estimé si rien ne change (€) */
  estimatedCatchupIfNoChange: number;
  /** Mode de recommandation principal */
  recommendationMode: RecommendationMode;
  /** Message de synthèse */
  summaryMessage: string;
  /** Lignes de détail pour affichage */
  detailLines: string[];
}

const ROUND_RATE_STEP = 0.5; // arrondir le taux à 0,5 % près

/**
 * Construit les recommandations de pilotage PAS & acomptes à partir du résultat de simulation et des saisies utilisateur.
 */
export function buildWithholdingRecommendations(
  simulationResult: {
    ir: { revenuImposable: number; impotNet: number; trancheMarginate: number };
    ps: { montant: number };
    resume?: { totalImpots?: number };
    consolidation?: { revenusFonciers?: number };
    inputs?: {
      options?: {
        prelevementSourceDejaPaye?: number;
        acomptesDejaPayes?: number;
        currentPersonalizedRate?: number | null;
        currentDgfipAdvanceAmount?: number | null;
        currentAdvanceFrequency?: AdvanceFrequency | null;
        withholdingGoal?: WithholdingGoal | null;
      };
    };
  },
  withholdingInputs?: Partial<WithholdingInputs> | null
): WithholdingRecommendation | null {
  const totalImpots = simulationResult.resume?.totalImpots ?? simulationResult.ir.impotNet + (simulationResult.ps?.montant ?? 0);
  const revenuImposable = simulationResult.ir.revenuImposable;
  const prelevementSourceDejaPaye = simulationResult.inputs?.options?.prelevementSourceDejaPaye ?? withholdingInputs?.pasDejaPaye ?? 0;
  const acomptesDejaPayes = simulationResult.inputs?.options?.acomptesDejaPayes ?? withholdingInputs?.acomptesDejaPayes ?? 0;
  const dejaPayeEstime = prelevementSourceDejaPaye + acomptesDejaPayes;
  const currentRate = withholdingInputs?.currentPersonalizedRate ?? simulationResult.inputs?.options?.currentPersonalizedRate ?? null;
  const currentAdvance = withholdingInputs?.currentDgfipAdvanceAmount ?? simulationResult.inputs?.options?.currentDgfipAdvanceAmount ?? null;
  // Défauts : périodicité mensuelle, objectif lisser la trésorerie
  const frequency: AdvanceFrequency = withholdingInputs?.currentAdvanceFrequency ?? simulationResult.inputs?.options?.currentAdvanceFrequency ?? 'monthly';
  const goal: WithholdingGoal = withholdingInputs?.withholdingGoal ?? simulationResult.inputs?.options?.withholdingGoal ?? 'smooth_cashflow';
  const resultatFoncier = withholdingInputs?.resultatFoncierEstime ?? simulationResult.consolidation?.revenusFonciers ?? 0;

  if (revenuImposable <= 0) {
    return null;
  }

  // A) Taux moyen estimé (jamais égal au TMI par définition)
  const tauxMoyenEstime = totalImpots / revenuImposable;
  const tauxMoyenPct = tauxMoyenEstime * 100;

  // B) Besoin annuel complémentaire et mensuel
  const besoinAnnuel = Math.max(0, totalImpots - dejaPayeEstime);
  const besoinMensuel = besoinAnnuel / 12;

  // C) Écart si rien ne change
  const estimatedCatchupIfNoChange = besoinAnnuel;

  // D) Acomptes annuels projetés avec la config actuelle (avec défaut mensuel)
  let acomptesAnnuelsActuels = 0;
  if (currentAdvance != null && currentAdvance >= 0) {
    acomptesAnnuelsActuels = frequency === 'monthly' ? currentAdvance * 12 : currentAdvance * 4;
  }
  const pasAnnuelEstime = currentRate != null && currentRate >= 0 ? (revenuImposable * (currentRate / 100)) : 0;
  const totalPrelevementsActuels = pasAnnuelEstime + acomptesAnnuelsActuels;

  const rateRounded = Math.round(tauxMoyenPct / ROUND_RATE_STEP) * ROUND_RATE_STEP;
  // 0 est une valeur valide (taux ou acompte à zéro), pas un champ vide : on utilise != null
  const hasMinInputs = currentRate != null && currentAdvance != null;

  // Recommandations selon objectif (toujours produire une suggestion, au moins un repère)
  let recommendedPersonalizedRate: number | null = rateRounded;
  let recommendedMonthlyAdvance: number | null = null;
  let recommendedQuarterlyAdvance: number | null = null;
  let recommendationMode: RecommendationMode = 'none';
  let summaryMessage: string;
  const detailLines: string[] = [];

  if (!hasMinInputs) {
    // Pas de taux ni acompte actuel renseignés : on donne un repère de pilotage basé sur la simulation uniquement
    recommendedMonthlyAdvance = besoinMensuel > 0 ? Math.ceil(besoinMensuel / 5) * 5 : null;
    if (recommendedMonthlyAdvance != null) recommendedQuarterlyAdvance = recommendedMonthlyAdvance * 3;
    recommendationMode = recommendedMonthlyAdvance != null ? 'mixed' : 'rate';
    summaryMessage = estimatedCatchupIfNoChange > 0
      ? `À titre de repère, le taux moyen estimé sur votre situation est d’environ ${tauxMoyenPct.toFixed(1)} %. Si vous ne changez rien, un écart d’environ ${formatEuro(estimatedCatchupIfNoChange)} est possible. Pour une suggestion plus ciblée, renseignez votre taux personnalisé actuel et votre acompte actuel (par période).`
      : `Taux moyen estimé : ${tauxMoyenPct.toFixed(1)} % (différent du TMI). Pour affiner la suggestion Smartimmo, renseignez votre taux et votre acompte actuels.`;
    detailLines.push(`Taux moyen estimé : ${tauxMoyenPct.toFixed(1)} % (à ne pas confondre avec le TMI).`);
    if (estimatedCatchupIfNoChange > 0) detailLines.push(`Écart estimé si inchangé : ${formatEuro(estimatedCatchupIfNoChange)}.`);
  } else if (goal === 'avoid_catchup') {
    recommendedPersonalizedRate = rateRounded;
    const besoinRestantApresTaux = Math.max(0, totalImpots - (revenuImposable * (rateRounded / 100)) - acomptesAnnuelsActuels);
    if (besoinRestantApresTaux > 10) {
      recommendedMonthlyAdvance = Math.ceil(besoinRestantApresTaux / 12 / 5) * 5;
      recommendedQuarterlyAdvance = recommendedMonthlyAdvance * 3;
      recommendationMode = 'mixed';
    } else {
      recommendationMode = 'rate';
    }
    if (estimatedCatchupIfNoChange > 50) {
      summaryMessage = `Votre taux personnalisé actuel${currentRate != null ? ` (${currentRate} %)` : ''} semble inférieur à votre niveau d'imposition estimé. Si vous ne changez rien, un rattrapage d'environ ${formatEuro(estimatedCatchupIfNoChange)} est possible. Suggestion Smartimmo : un taux autour de ${rateRounded} %${recommendedMonthlyAdvance != null ? ` et/ou un acompte mensuel de l’ordre de ${formatEuro(recommendedMonthlyAdvance)} (estimation d’ajustement)` : ''}.`;
    } else {
      summaryMessage = 'Vos prélèvements actuels semblent globalement cohérents avec votre fiscalité estimée. Aucun ajustement majeur n’est nécessaire.';
      recommendationMode = 'none';
    }
  } else if (goal === 'smooth_cashflow') {
    recommendedPersonalizedRate = Math.max(0, rateRounded - 1);
    recommendedMonthlyAdvance = Math.ceil(besoinMensuel / 5) * 5;
    recommendedQuarterlyAdvance = recommendedMonthlyAdvance * 3;
    recommendationMode = 'mixed';
    summaryMessage = 'Pour lisser votre effort fiscal sur l’année, vous pouvez augmenter progressivement vos acomptes mensuels plutôt que de tout absorber via le taux personnalisé. Suggestion Smartimmo : taux autour de ' + recommendedPersonalizedRate + ' % et acompte mensuel de l’ordre de ' + formatEuro(recommendedMonthlyAdvance) + ' (repère de pilotage).';
    detailLines.push(`Taux suggéré (repère) : ${recommendedPersonalizedRate} %. Acompte mensuel suggéré : ${formatEuro(recommendedMonthlyAdvance)}.`);
  } else if (goal === 'keep_cash') {
    recommendedPersonalizedRate = Math.max(0, rateRounded - 2);
    recommendedMonthlyAdvance = null;
    recommendedQuarterlyAdvance = null;
    recommendationMode = recommendedPersonalizedRate > 0 ? 'rate' : 'none';
    summaryMessage = estimatedCatchupIfNoChange > 0
      ? `Votre stratégie privilégie la trésorerie immédiate. Vous pouvez conserver un taux personnalisé plus bas ; anticipez un solde à payer estimé à environ ${formatEuro(estimatedCatchupIfNoChange)}.`
      : 'Vos prélèvements actuels couvrent déjà l’impôt estimé. Vous pouvez conserver votre configuration.';
  } else {
    recommendedPersonalizedRate = rateRounded;
    recommendationMode = 'rate';
    if (estimatedCatchupIfNoChange > 50) {
      summaryMessage = `Taux moyen estimé : ${tauxMoyenPct.toFixed(1)} %. Si vous ne changez rien, écart estimé : ${formatEuro(estimatedCatchupIfNoChange)}. Suggestion Smartimmo : rapprocher votre taux personnalisé de ${rateRounded} % (repère de pilotage) pour limiter le rattrapage.`;
    } else {
      summaryMessage = 'Vos prélèvements actuels semblent globalement cohérents avec votre fiscalité estimée. Aucun ajustement majeur n’est nécessaire.';
      recommendationMode = 'none';
    }
  }

  if (hasMinInputs) {
    detailLines.unshift(`Taux moyen estimé : ${tauxMoyenPct.toFixed(1)} % (différent du TMI).`);
    if (estimatedCatchupIfNoChange > 0) {
      detailLines.push(`Écart estimé si inchangé : ${formatEuro(estimatedCatchupIfNoChange)}.`);
    }
  }

  return {
    estimatedAverageRate: tauxMoyenEstime,
    recommendedPersonalizedRate,
    recommendedMonthlyAdvance,
    recommendedQuarterlyAdvance,
    estimatedCatchupIfNoChange,
    recommendationMode,
    summaryMessage,
    detailLines,
  };
}

function formatEuro(amount: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount);
}
