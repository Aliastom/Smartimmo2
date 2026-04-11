/**
 * Décote IR — formule DGFiP (plafond − taux × impôt brut si impôt brut < seuil ; bornée [0, impôt brut]).
 * Paramètres : JSON `FiscalParams.jsonData` ; à défaut `IR_DECOTE_DEFAULTS` (version publiée courante).
 */

import type { IRDecote } from '@/types/fiscal';

export type IrDecoteStored = {
  seuilCelibataire?: number;
  seuilCouple?: number;
  plafondCelibataire?: number;
  plafondCouple?: number;
  taux?: number;
  /** Legacy admin : souvent copié sur seuil célibataire */
  threshold?: number;
  /** Ancienne formule (0,75) — ignorée pour le calcul DGFiP */
  facteur?: number;
};

/**
 * Repli si le JSON BDD ne fournit pas `irDecote` (doit correspondre à la version publiée courante, ex. 2026.1).
 */
export const IR_DECOTE_DEFAULTS = {
  seuilCelibataire: 1983,
  seuilCouple: 3278,
  plafondCelibataire: 897,
  plafondCouple: 1483,
  taux: 0.4525,
} as const;

export function computeIrDecoteDGFiP(
  impotBrut: number,
  isCouple: boolean,
  stored: IrDecoteStored | null | undefined
): number {
  if (impotBrut <= 0) return 0;

  const s = stored ?? {};
  const seuilCelib =
    s.seuilCelibataire ?? s.threshold ?? IR_DECOTE_DEFAULTS.seuilCelibataire;
  const seuilCouple = s.seuilCouple ?? IR_DECOTE_DEFAULTS.seuilCouple;
  const plafondCelib =
    s.plafondCelibataire ?? IR_DECOTE_DEFAULTS.plafondCelibataire;
  const plafondCouple = s.plafondCouple ?? IR_DECOTE_DEFAULTS.plafondCouple;
  const taux = s.taux ?? IR_DECOTE_DEFAULTS.taux;

  const seuil = isCouple ? seuilCouple : seuilCelib;
  const plafond = isCouple ? plafondCouple : plafondCelib;

  if (impotBrut >= seuil) return 0;

  const brut = plafond - taux * impotBrut;
  return Math.min(Math.max(brut, 0), impotBrut);
}

/** Construit l’objet `IRDecote` pour TaxParams à partir du JSON BDD / admin (champs partiels OK). */
export function buildIrDecoteFromStored(json: unknown): IRDecote {
  const j = (json && typeof json === 'object' ? json : {}) as IrDecoteStored;
  const seuilCelib =
    j.seuilCelibataire ?? j.threshold ?? IR_DECOTE_DEFAULTS.seuilCelibataire;
  const seuilCouple = j.seuilCouple ?? IR_DECOTE_DEFAULTS.seuilCouple;
  return {
    threshold: seuilCelib,
    seuilCelibataire: seuilCelib,
    seuilCouple,
    plafondCelibataire:
      j.plafondCelibataire ?? IR_DECOTE_DEFAULTS.plafondCelibataire,
    plafondCouple: j.plafondCouple ?? IR_DECOTE_DEFAULTS.plafondCouple,
    taux: j.taux ?? IR_DECOTE_DEFAULTS.taux,
  };
}
