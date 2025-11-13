/**
 * Système de score de confiance pour la fusion à consensus
 */

import { TaxPartial, TaxSection, TaxSource } from '../../sources/types';

export type Confidence = 0 | 0.2 | 0.4 | 0.6 | 0.8 | 1.0;

/**
 * Scores de base par source (priorité)
 */
const SOURCE_BASE_SCORES: Record<string, number> = {
  OPENFISCA: 0.6,      // Source primaire programmatique
  BOFIP: 0.5,          // Source officielle stable
  DGFIP: 0.4,          // Source officielle variable
  SERVICE_PUBLIC: 0.3, // Vulgarisation
  LEGIFRANCE: 0.3      // Cross-check juridique
};

/**
 * Calcule le score de confiance pour une section
 */
export function calculateConfidence(section: TaxSection, partials: TaxPartial[]): Confidence {
  if (partials.length === 0) return 0;
  
  // Déterminer si OpenFisca est présent
  const hasOpenfisca = partials.some(p => 
    p.meta.notes?.includes('OpenFisca') || 
    p.meta.url?.includes('OpenFisca')
  );
  
  // Autres sources
  const otherSources = partials.filter(p => 
    !p.meta.notes?.includes('OpenFisca') && 
    !p.meta.url?.includes('OpenFisca')
  );
  
  let score = 0;
  
  // Règle 1: OpenFisca présent
  if (hasOpenfisca) {
    const ofPartial = partials.find(p => p.meta.notes?.includes('OpenFisca'));
    
    // Vérifier si OpenFisca est valide pour 2024/2025
    const validUntilMatch = ofPartial?.meta.notes?.match(/Valide jusqu'au:\s*(\d{4})-(\d{2})-(\d{2})/);
    const isRecentlyValid = validUntilMatch && new Date(validUntilMatch[1]) >= new Date('2024-01-01');
    
    if (isRecentlyValid) {
      // OpenFisca valide pour 2024/2025 = haute confiance de base
      score += 0.8;
      
      // Règle 2: Si au moins 1 autre source concordante = +0.2 (confiance maximale)
      if (otherSources.length > 0) {
        const concordant = checkConcordance(section, partials);
        if (concordant) {
          score += 0.2; // Total = 1.0 (confiance maximale)
        }
      }
      // Sinon OpenFisca seul mais valide = 0.8
    } else {
      // OpenFisca avec données anciennes = confiance modérée
      score += 0.6;
      
      // Règle 2: Si au moins 1 autre source concordante = +0.4
      if (otherSources.length > 0) {
        const concordant = checkConcordance(section, partials);
        if (concordant) {
          score += 0.4; // Total = 1.0 (confiance maximale)
        } else {
          score += 0.2; // Total = 0.8 (confiance élevée mais divergence)
        }
      }
      // Sinon OpenFisca seul ancien = 0.6
    }
  } else {
    // Pas d'OpenFisca, utiliser les sources web
    if (otherSources.length >= 2) {
      // 2+ sources web concordantes
      const concordant = checkConcordance(section, otherSources);
      if (concordant) {
        score = 0.8; // Haute confiance
      } else {
        score = 0.4; // Confiance moyenne (divergence)
      }
    } else if (otherSources.length === 1) {
      // 1 seule source web
      const sourceScore = SOURCE_BASE_SCORES[otherSources[0].meta.source] || 0.3;
      score = sourceScore;
    }
  }
  
  // Arrondir au niveau de confiance
  return roundToConfidence(score);
}

/**
 * Vérifie la concordance entre plusieurs sources
 */
function checkConcordance(section: TaxSection, partials: TaxPartial[]): boolean {
  if (partials.length < 2) return true;
  
  const reference = partials[0].data;
  
  for (let i = 1; i < partials.length; i++) {
    const current = partials[i].data;
    
    if (!areDataConcordant(section, reference, current)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Compare deux données de section pour vérifier la concordance
 */
function areDataConcordant(section: TaxSection, a: any, b: any): boolean {
  switch (section) {
    case 'IR':
      // Comparer le nombre de tranches et les taux
      if (!Array.isArray(a) || !Array.isArray(b)) return false;
      if (a.length !== b.length) return false;
      
      for (let i = 0; i < a.length; i++) {
        if (Math.abs(a[i].rate - b[i].rate) > 0.001) return false; // Tolérance 0.1%
      }
      return true;
      
    case 'IR_DECOTE':
      if (!a || !b) return false;
      // Tolérance de 1€ sur les seuils
      if (Math.abs(a.seuilCelibataire - b.seuilCelibataire) > 1) return false;
      if (Math.abs(a.seuilCouple - b.seuilCouple) > 1) return false;
      return true;
      
    case 'PS':
      if (typeof a !== 'number' || typeof b !== 'number') return false;
      // Tolérance de 0.1% sur le taux
      return Math.abs(a - b) < 0.001;
      
    case 'MICRO':
      if (!a || !b) return false;
      // Comparer les abattements avec tolérance 0.1%
      if (a.foncier && b.foncier) {
        if (Math.abs(a.foncier.abattement - b.foncier.abattement) > 0.001) return false;
      }
      return true;
      
    default:
      // Pour les autres sections, comparaison JSON simple
      return JSON.stringify(a) === JSON.stringify(b);
  }
}

/**
 * Arrondit au niveau de confiance le plus proche
 */
function roundToConfidence(score: number): Confidence {
  if (score >= 0.9) return 1.0;
  if (score >= 0.7) return 0.8;
  if (score >= 0.5) return 0.6;
  if (score >= 0.3) return 0.4;
  if (score >= 0.1) return 0.2;
  return 0;
}

/**
 * Détermine si le score de confiance est suffisant pour une section
 */
export function isConfidenceAcceptable(section: TaxSection, confidence: Confidence): boolean {
  // Seuils par section
  const thresholds: Record<TaxSection, Confidence> = {
    IR: 0.8,          // Critique: OpenFisca + concordance requise
    IR_DECOTE: 0.6,   // Important
    PS: 0.8,          // Critique: OpenFisca + concordance requise
    MICRO: 0.6,       // Important
    DEFICIT: 0.6,     // Important
    PER: 0.6,         // Important
    SCI_IS: 0.6       // Important
  };
  
  return confidence >= thresholds[section];
}

/**
 * Retourne un label lisible pour le score de confiance
 */
export function getConfidenceLabel(confidence: Confidence): string {
  if (confidence === 1.0) return 'Excellente';
  if (confidence === 0.8) return 'Élevée';
  if (confidence === 0.6) return 'Bonne';
  if (confidence === 0.4) return 'Moyenne';
  if (confidence === 0.2) return 'Faible';
  return 'Aucune';
}

/**
 * Retourne une couleur pour affichage UI
 */
export function getConfidenceColor(confidence: Confidence): string {
  if (confidence >= 0.8) return 'green';
  if (confidence >= 0.6) return 'blue';
  if (confidence >= 0.4) return 'yellow';
  return 'red';
}

