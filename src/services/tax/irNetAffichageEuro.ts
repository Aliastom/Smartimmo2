/**
 * IR net présenté en euros entiers sur l’étape « Calcul de l’impôt » (total impôts / reste à payer quand PS = 0).
 * Le moteur conserve les décimales ; cette règle d’affichage aligne l’UI sur l’usage courant avis / simulateurs publics.
 *
 * Cas de référence produit (validation fiscale 2026.1) :
 * brut pensions 29 180 €, abattement 10 %, cotisations déductibles 1 411 €, 1,5 part, célibataire,
 * PAS 0, sans immo ni PER → base avant quotient 24 851 €, IR net moteur ≈ 293,48 € → affichage 294 €.
 */
export function irNetAffichageEuro(irNet: number): number {
  const x = Math.max(0, irNet);
  if (x < 1e-6) return 0;
  return Math.ceil(x - 1e-9);
}
