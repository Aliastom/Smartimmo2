/**
 * PASSimulator - Simulation du prélèvement à la source type impots.gouv
 *
 * Reproduit le comportement estimé du calcul DGFiP pour affichage informatif uniquement.
 * Utilise le calcul différentiel exact (IR avec foncier - IR sans foncier) pour l'IR imputable au foncier.
 * Ne modifie pas le moteur de simulation fiscal ni les recommandations Smartimmo.
 */

import type { SimulationResult } from '@/types/fiscal';

export interface PASSimulationResult {
  /** Taux PAS appliqué au salaire (%) */
  pas_rate: number;
  /** Acompte IR revenus fonciers (€ / mois) */
  acompte_ir_foncier: number;
  /** Acompte prélèvements sociaux (€ / mois) */
  acompte_ps: number;
  /** Total prélèvements mensuels estimés (€ / mois) */
  total_mensuel: number;
}

/**
 * Simule le prélèvement à la source comme calculé par impots.gouv.
 * Utilise le calcul différentiel exact : IR_foncier = IR(revenu_total) - IR(revenu_hors_foncier).
 */
export function simulatePAS(simulation: SimulationResult): PASSimulationResult | null {
  const revenuSalaire = simulation.inputs?.foyer?.salaire ?? 0;

  if (revenuSalaire <= 0) return null;

  const irTotal = simulation.ir?.impotNet ?? 0;
  const psMontant = simulation.ps?.montant ?? 0;

  // IR_foncier_exact = IR(revenu_total_imposable) - IR(revenu_hors_foncier)
  // Le moteur fiscal calcule déjà cette différence (irSupplementaire)
  const irFoncierExact = Math.max(0, simulation.resume?.irSupplementaire ?? 0);

  // IR_salaire_exact = IR_total - IR_foncier_exact
  const irSalaireExact = Math.max(0, irTotal - irFoncierExact);

  // PAS_rate = IR_salaire / revenu_salaire (en %)
  const pasRatePercent =
    revenuSalaire > 0 ? Math.min(100, Math.max(0, (irSalaireExact / revenuSalaire) * 100)) : 0;

  // Acomptes mensuels (IR foncier et PS séparés)
  const acompteIrFoncier = irFoncierExact / 12;
  const acomptePs = psMontant / 12;

  // Total mensuel = PAS sur salaire + acompte IR foncier + acompte PS
  const pasMensuel = (revenuSalaire * (pasRatePercent / 100)) / 12;
  const totalMensuel = pasMensuel + acompteIrFoncier + acomptePs;

  return {
    pas_rate: Math.round(pasRatePercent * 10) / 10,
    acompte_ir_foncier: Math.round(acompteIrFoncier),
    acompte_ps: Math.round(acomptePs),
    total_mensuel: Math.round(totalMensuel),
  };
}
