/**
 * Fonction de calcul de commission pour la gestion déléguée
 * Cette fonction est partagée entre le front et le back pour garantir la cohérence
 */

export type ModeCalcul = 'LOYERS_UNIQUEMENT' | 'REVENUS_TOTAUX';

export interface CalcCommissionParams {
  montantLoyer: number;
  chargesRecup?: number;
  modeCalcul: ModeCalcul;
  taux: number; // ex: 0.06 pour 6%
  fraisMin?: number;
  tvaApplicable?: boolean;
  tauxTva?: number; // en pourcentage, ex: 20 pour 20%
}

export interface CalcCommissionResult {
  base: number;
  commissionHT: number;
  commissionTTC: number;
}

/**
 * Calcule la commission de gestion selon les règles définies
 * 
 * Règles de calcul:
 * - Loyer = montant hors charges
 * - Le locataire paie = loyer + charges récupérables
 * - Charges non récupérables: jamais incluses dans la base de calcul
 * 
 * Base de calcul:
 * - LOYERS_UNIQUEMENT → montantLoyer
 * - REVENUS_TOTAUX → montantLoyer + chargesRecup
 * 
 * Commission = max(base * taux, fraisMin)
 * Si TVA activée: commissionTTC = commission * (1 + tauxTva/100)
 * 
 * @param params - Paramètres de calcul
 * @returns Résultat du calcul avec base, commission HT et TTC
 */
export function calcCommission({
  montantLoyer,
  chargesRecup = 0,
  modeCalcul,
  taux,
  fraisMin,
  tvaApplicable = false,
  tauxTva = 20,
}: CalcCommissionParams): CalcCommissionResult {
  // Calcul de la base selon le mode
  const base =
    modeCalcul === 'REVENUS_TOTAUX'
      ? (montantLoyer || 0) + (chargesRecup || 0)
      : (montantLoyer || 0);

  // Calcul de la commission HT
  let commission = +(base * taux).toFixed(2);
  
  // Application du minimum si défini
  if (typeof fraisMin === 'number') {
    commission = Math.max(commission, +fraisMin.toFixed(2));
  }

  const commissionHT = commission;
  
  // Calcul de la commission TTC si TVA applicable
  const commissionTTC = tvaApplicable 
    ? +(commissionHT * (1 + tauxTva / 100)).toFixed(2) 
    : commissionHT;

  return {
    base: +base.toFixed(2),
    commissionHT,
    commissionTTC,
  };
}

/**
 * Valide que le mode de calcul est valide
 */
export function isValidModeCalcul(mode: string): mode is ModeCalcul {
  return mode === 'LOYERS_UNIQUEMENT' || mode === 'REVENUS_TOTAUX';
}

