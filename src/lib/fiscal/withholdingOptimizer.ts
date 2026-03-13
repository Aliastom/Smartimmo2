/**
 * Moteur de pilotage fiscal réaliste (type DGFiP).
 * Calcule un PAS idéal et/ou un acompte idéal pour éviter un rattrapage l'année suivante.
 * Prend en compte le mois courant et l'effet combiné PAS + acomptes.
 */

export type AdvanceFrequency = 'monthly' | 'quarterly';

/** Objectif utilisateur : influence la stratégie recommandée (pas les calculs) */
export type WithholdingGoal = 'avoid_catchup' | 'smooth_cashflow' | 'keep_cash';

export interface WithholdingOptimizerInputs {
  currentPersonalizedRate?: number | null;
  currentDgfipAdvanceAmount?: number | null;
  currentAdvanceFrequency?: AdvanceFrequency | null;
  /** Objectif : évite rattrapage / lisse trésorerie / garde cash */
  strategyGoal?: WithholdingGoal | null;
  /** Alias (simulation.inputs.options.withholdingGoal) */
  withholdingGoal?: WithholdingGoal | null;
}

export interface WithholdingStrategy {
  id: 'pas_only' | 'acomptes_only' | 'combined';
  label: string;
  recommended: boolean;
  /** Taux PAS cible (%) */
  pasCiblePercent: number | null;
  /** Acompte mensuel cible (€) pour le reste de l'année */
  acompteMensuelCible: number | null;
  /** Acompte trimestriel cible (€) si périodicité trimestrielle */
  acompteTrimestrielCible: number | null;
  /** Écart restant estimé si on applique cette stratégie (€) */
  ecartRestantEstime: number;
  /** Courte description */
  description: string;
}

export interface WithholdingOptimizationResult {
  /** Impôt estimé année N (IR + PS) (€) */
  impotEstime: number;
  /** Revenu imposable total (€) */
  revenuImposableTotal: number;
  /** Salaire net imposable (base du PAS) (€) */
  salaireImposable: number;
  /** Mois courant (1-12) */
  moisCourant: number;
  /** Nombre de mois restants dans l'année (inclut le mois courant) */
  moisRestants: number;
  /** Paiements estimés si rien ne change (€) */
  paiementsEstimes: {
    pasAnnuelEstime: number;
    acompteAnnuelEstime: number;
    total: number;
  };
  /** Écart annuel (€) : positif = sous-prélèvement, négatif = sur-prélèvement */
  ecartAnnuel: number;
  /** Taux moyen d'imposition (ratio 0-1) */
  tauxMoyen: number;
  /** PAS idéal (%) - taux moyen × 0,9 (les PS ne sont pas dans le PAS) */
  pasIdealPercent: number;
  /** Acompte mensuel idéal pour combler l'écart sur les mois restants (€) */
  acompteIdealMensuel: number;
  /** Acompte trimestriel idéal (€) */
  acompteIdealTrimestriel: number;
  /** Les 3 stratégies de pilotage */
  strategies: WithholdingStrategy[];
  /** Message récapitulatif */
  messageRecap: string;
}

/** Simulation result shape used by the optimizer */
export type SimulationResultForOptimizer = {
  ir: { revenuImposable: number; impotNet: number };
  ps: { montant: number };
  resume?: { totalImpots?: number };
  inputs?: {
    foyer?: { salaire?: number };
    options?: WithholdingOptimizerInputs;
  };
};

const ROUND_RATE = 0.5;
const ROUND_EURO = 5;

function roundRate(x: number): number {
  return Math.round(x / ROUND_RATE) * ROUND_RATE;
}
function roundEuro(x: number): number {
  return Math.round(x / ROUND_EURO) * ROUND_EURO;
}

/**
 * Calcule l'optimisation de pilotage PAS & acomptes pour l'année en cours.
 * Utilise la date fournie pour le nombre de mois restants.
 */
export function computeWithholdingOptimization(
  simulationResult: SimulationResultForOptimizer,
  withholdingInputs?: WithholdingOptimizerInputs | null,
  currentDate: Date = new Date()
): WithholdingOptimizationResult | null {
  const ir = simulationResult.ir;
  const ps = simulationResult.ps;
  const totalImpots = simulationResult.resume?.totalImpots ?? ir.impotNet + (ps?.montant ?? 0);
  const revenuImposableTotal = ir.revenuImposable;
  const salaireImposable = simulationResult.inputs?.foyer?.salaire ?? revenuImposableTotal;

  if (revenuImposableTotal <= 0) return null;

  const opts = withholdingInputs ?? simulationResult.inputs?.options ?? {};
  const currentRate = opts.currentPersonalizedRate ?? null;
  const currentAdvance = opts.currentDgfipAdvanceAmount ?? null;
  const frequency: AdvanceFrequency = opts.currentAdvanceFrequency ?? 'monthly';
  const goal: WithholdingGoal = opts.strategyGoal ?? opts.withholdingGoal ?? 'smooth_cashflow';

  // Étape 1 : impôt estimé année N
  const impotEstime = totalImpots;

  // Étape 2 : ce qui sera payé cette année si rien ne change
  const pasAnnuelEstime =
    currentRate != null && salaireImposable > 0
      ? salaireImposable * (currentRate / 100)
      : 0;
  const periodicite = frequency === 'quarterly' ? 4 : 12;
  const acompteAnnuelEstime =
    currentAdvance != null ? currentAdvance * periodicite : 0;

  // Étape 3 : total payé en année N
  const totalPaiementsEstimes = pasAnnuelEstime + acompteAnnuelEstime;

  // Étape 4 : écart
  const ecartAnnuel = impotEstime - totalPaiementsEstimes;

  // Mois courants
  const moisCourant = currentDate.getMonth() + 1; // 1-12
  const moisRestants = Math.max(1, 12 - moisCourant + 1);

  // Taux moyen et PAS idéal (les prélèvements sociaux ne sont pas dans le PAS)
  const tauxMoyen = impotEstime / revenuImposableTotal;
  const pasIdealPercent = roundRate(Math.min(100, Math.max(0, tauxMoyen * 0.9 * 100)));

  // Acompte idéal : répartir l'écart sur les mois restants
  const acompteIdealMensuel =
    ecartAnnuel > 0 && moisRestants > 0
      ? roundEuro(ecartAnnuel / moisRestants)
      : 0;
  const acompteIdealTrimestriel = roundEuro(acompteIdealMensuel * 3);

  // Stratégie 1 : augmenter uniquement le PAS (acompte inchangé)
  let pasCible1: number | null = null;
  if (salaireImposable > 0) {
    const pasAnnuelNeeded = Math.max(0, impotEstime - acompteAnnuelEstime);
    if (pasAnnuelNeeded > 0) {
      pasCible1 = roundRate(Math.min(100, (pasAnnuelNeeded / salaireImposable) * 100));
    }
  }
  const strategy1: WithholdingStrategy = {
    id: 'pas_only',
    label: 'Ajuster uniquement le PAS',
    recommended: false,
    pasCiblePercent: pasCible1,
    acompteMensuelCible: currentAdvance != null ? currentAdvance : null,
    acompteTrimestrielCible: currentAdvance != null && frequency === 'quarterly' ? currentAdvance : null,
    ecartRestantEstime: pasCible1 != null ? 0 : ecartAnnuel,
    description:
      pasCible1 != null
        ? `Taux PAS à ${pasCible1} % pour aligner les prélèvements sur l'impôt estimé.`
        : 'Augmenter le taux personnalisé sur impots.gouv.',
  };
  if (strategy1.acompteMensuelCible === null && currentAdvance != null)
    strategy1.acompteMensuelCible = frequency === 'monthly' ? currentAdvance : roundEuro(currentAdvance / 3);

  // Stratégie 2 : augmenter uniquement les acomptes (PAS inchangé) — acompte pour couvrir (impôt - PAS) sur les mois restants
  const acompteAnnuelNeeded2 = Math.max(0, impotEstime - pasAnnuelEstime);
  const acompteMensuel2 =
    moisRestants > 0 && acompteAnnuelNeeded2 > 0
      ? roundEuro(acompteAnnuelNeeded2 / moisRestants)
      : 0;
  const strategy2: WithholdingStrategy = {
    id: 'acomptes_only',
    label: 'Ajuster uniquement les acomptes',
    recommended: false,
    pasCiblePercent: currentRate ?? null,
    acompteMensuelCible: acompteMensuel2 > 0 ? acompteMensuel2 : null,
    acompteTrimestrielCible: acompteMensuel2 > 0 ? roundEuro(acompteMensuel2 * 3) : null,
    ecartRestantEstime: 0,
    description:
      acompteMensuel2 > 0
        ? `Acompte mensuel d'environ ${acompteMensuel2} € sur les ${moisRestants} mois restants.`
        : 'Ajuster vos acomptes pour couvrir l\'écart.',
  };

  // Stratégie 3 : combinaison PAS + acomptes
  const pasAnnuelAvecIdeal = salaireImposable * (pasIdealPercent / 100);
  const restantACombler = Math.max(0, impotEstime - pasAnnuelAvecIdeal);
  const acompteMensuel3 =
    moisRestants > 0 ? roundEuro(restantACombler / moisRestants) : 0;
  const strategy3: WithholdingStrategy = {
    id: 'combined',
    label: 'Combinaison PAS + acomptes',
    recommended: false,
    pasCiblePercent: pasIdealPercent,
    acompteMensuelCible: acompteMensuel3 > 0 ? acompteMensuel3 : null,
    acompteTrimestrielCible: acompteMensuel3 > 0 ? roundEuro(acompteMensuel3 * 3) : null,
    ecartRestantEstime: 0,
    description: `PAS à ${pasIdealPercent} % et acompte mensuel d'environ ${acompteMensuel3} € (repère de pilotage).`,
  };

  // Choisir la stratégie recommandée selon l'objectif (aucun calcul modifié)
  const recommendedId: 'pas_only' | 'acomptes_only' | 'combined' =
    goal === 'keep_cash'
      ? 'acomptes_only'
      : 'combined';
  for (const s of [strategy1, strategy2, strategy3]) {
    s.recommended = s.id === recommendedId;
  }

  const strategies: WithholdingStrategy[] = [strategy1, strategy2, strategy3];

  let messageRecap: string;
  if (ecartAnnuel > 50) {
    messageRecap = `Sous-prélèvement estimé : environ ${Math.round(ecartAnnuel)} € sur l'année si vos prélèvements actuels restent inchangés. ${moisRestants} mois restants pour ajuster.`;
  } else if (ecartAnnuel < -50) {
    messageRecap = `Sur-prélèvement estimé : environ ${Math.round(-ecartAnnuel)} €. Vous pouvez réduire votre taux ou vos acomptes.`;
  } else {
    messageRecap = 'Vos prélèvements actuels sont proches de l\'impôt estimé. Aucun ajustement majeur nécessaire.';
  }

  return {
    impotEstime,
    revenuImposableTotal,
    salaireImposable,
    moisCourant,
    moisRestants,
    paiementsEstimes: {
      pasAnnuelEstime,
      acompteAnnuelEstime,
      total: totalPaiementsEstimes,
    },
    ecartAnnuel,
    tauxMoyen,
    pasIdealPercent,
    acompteIdealMensuel,
    acompteIdealTrimestriel,
    strategies,
    messageRecap,
  };
}
