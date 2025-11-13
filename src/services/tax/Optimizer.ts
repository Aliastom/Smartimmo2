/**
 * Optimizer - Service d'optimisation fiscale
 * 
 * Ce service propose des stratégies d'optimisation fiscale :
 * - Optimisation des travaux (Phase 1 : ramener à 0€, Phase 2 : déficit reportable)
 * - Comparaison PER vs Travaux vs Stratégie combinée
 * - Suggestions d'optimisations diverses (régimes, timing, structure)
 * 
 * ⚠️ SEUILS D'OPTIMISATION (constantes métier, pas de paramètres fiscaux) :
 * - SEUIL_RATIO_EXCELLENT = 0.30 (30%)
 * - SEUIL_RATIO_BON = 0.35 (35%)
 * - TMI_ELEVE_SCI = 0.41 (41%) - seuil pour suggérer SCI IS
 * - REVENUS_MIN_SCI = 20 000 € - revenus minimum pour suggérer SCI
 * - REVENUS_MIN_TRAVAUX = 5 000 € - revenus minimum pour suggérer timing travaux
 * - ESTIMATION_GAIN_LMNP = 0.20 (20%) - estimation gain passage LMNP
 */

import type {
  FiscalInputs,
  SimulationResult,
  OptimizationResult,
  WorksStrategy,
  OptimizationComparison,
  TaxParams,
} from '@/types/fiscal';
import { Simulator } from './Simulator';

// ============================================================================
// CONSTANTES MÉTIER (Seuils d'optimisation)
// ============================================================================

const OPTIMIZATION_THRESHOLDS = {
  RATIO_EXCELLENT: 0.30,     // 30% - Ratio excellent pour recommander Phase 1
  RATIO_BON: 0.35,           // 35% - Ratio bon pour recommander Phase 2 ou stratégies
  TMI_ELEVE_SCI: 0.41,       // 41% - TMI élevée pour suggérer SCI IS
  REVENUS_MIN_SCI: 20000,    // 20 000 € - Revenus minimum pour suggérer SCI
  REVENUS_MIN_TRAVAUX: 5000, // 5 000 € - Revenus minimum pour timing travaux
  ESTIMATION_GAIN_LMNP: 0.20 // 20% - Estimation gain passage LMNP
} as const;

// ============================================================================
// SERVICE PRINCIPAL
// ============================================================================

class OptimizerClass {
  /**
   * Optimise la fiscalité et propose des stratégies
   */
  async optimize(
    inputs: FiscalInputs,
    taxParams: TaxParams
  ): Promise<OptimizationResult> {
    console.log(`🎯 Optimisation fiscale ${inputs.year}...`);
    
    // 1. Simulation de base
    const simulation = await Simulator.simulate(inputs, taxParams);
    
    // 2. Optimisation travaux (Phase 1 & 2)
    const works = this.optimizeWorks(simulation, taxParams);
    
    // 3. Comparaison PER vs Travaux
    const comparison = this.comparePERvsWorks(simulation, inputs, taxParams);
    
    // 4. Suggestions diverses
    const suggestions = this.generateSuggestions(simulation, inputs, taxParams);
    
    console.log(`✅ Optimisation terminée`);
    
    return {
      simulation,
      works,
      comparison,
      suggestions,
    };
  }
  
  // ============================================================================
  // OPTIMISATION TRAVAUX (PHASE 1 & 2)
  // ============================================================================
  
  /**
   * Calcule la stratégie optimale de travaux en 2 phases
   * 
   * Phase 1 : Ramener les revenus imposables à 0€ (économie IR + PS)
   * Phase 2 : Créer du déficit foncier reportable (économie IR uniquement)
   */
  private optimizeWorks(
    simulation: SimulationResult,
    taxParams: TaxParams
  ): WorksStrategy {
    const { consolidation, ir, ps } = simulation;
    
    // ============================================================================
    // PHASE 1 : Ramener revenus imposables à 0€
    // ============================================================================
    
    const revenusFonciersPositifs = Math.max(0, consolidation.revenusFonciers);
    const revenusBICPositifs = Math.max(0, consolidation.revenusBIC);
    const revenusImmobiliersTotal = revenusFonciersPositifs + revenusBICPositifs;
    
    // Montant de travaux nécessaire pour annuler les revenus
    const montantCiblePhase1 = revenusImmobiliersTotal;
    
    // Économie IR : part des revenus immobiliers dans l'impôt total
    const partRevenusImmobiliers = simulation.ir.revenuImposable > 0
      ? revenusImmobiliersTotal / simulation.ir.revenuImposable
      : 0;
    
    const economieIRPhase1 = simulation.ir.impotNet * partRevenusImmobiliers;
    
    // Économie PS : sur l'intégralité de la base immobilière
    const economiePS_Phase1 = simulation.ps.montant;
    
    const economieTotal_Phase1 = economieIRPhase1 + economiePS_Phase1;
    const ratioPhase1 = montantCiblePhase1 > 0 
      ? economieTotal_Phase1 / montantCiblePhase1 
      : 0;
    
    // ============================================================================
    // PHASE 2 : Créer du déficit foncier reportable
    // ============================================================================
    
    // Déficit foncier imputable sur revenu global (max 10 700€)
    const plafondDeficit = taxParams.deficitFoncier.plafondImputationRevenuGlobal;
    
    // Montant de travaux pour créer ce déficit
    const montantCiblePhase2 = plafondDeficit;
    
    // Économie IR : sur le déficit imputable
    const economieIRPhase2 = plafondDeficit * ir.trancheMarginate;
    
    // Pas d'économie PS en Phase 2 (déficit non imputable sur base PS)
    const economiePS_Phase2 = 0;
    
    const economieTotal_Phase2 = economieIRPhase2 + economiePS_Phase2;
    const ratioPhase2 = montantCiblePhase2 > 0 
      ? economieTotal_Phase2 / montantCiblePhase2 
      : 0;
    
    // ============================================================================
    // RECOMMANDATION
    // ============================================================================
    
    let recommandation = '';
    
    if (ratioPhase1 > OPTIMIZATION_THRESHOLDS.RATIO_EXCELLENT) {
      recommandation = `🎯 Phase 1 prioritaire : Excellent ratio (${(ratioPhase1 * 100).toFixed(0)}%). `;
      recommandation += `Investir ${this.formatEuro(montantCiblePhase1)} en travaux pour économiser ${this.formatEuro(economieTotal_Phase1)}.`;
    } else if (ratioPhase2 > OPTIMIZATION_THRESHOLDS.RATIO_BON) {
      recommandation += `🎯 Phase 2 intéressante : Ratio ${(ratioPhase2 * 100).toFixed(0)}%. `;
      recommandation += `Créer ${this.formatEuro(plafondDeficit)} de déficit foncier pour économiser ${this.formatEuro(economieTotal_Phase2)}.`;
    } else {
      recommandation = `⚠️ Ratios modestes. Privilégier d'autres stratégies (PER, optimisation régimes).`;
    }
    
    const totalInvestissement = montantCiblePhase1 + montantCiblePhase2;
    const totalEconomie = economieTotal_Phase1 + economieTotal_Phase2;
    
    return {
      phase1: {
        objectif: 'Ramener revenus imposables à 0€',
        montantCible: montantCiblePhase1,
        economieIR: economieIRPhase1,
        economiePS: economiePS_Phase1,
        economieTotal: economieTotal_Phase1,
        ratioEconomieSurInvest: ratioPhase1,
      },
      phase2: {
        objectif: 'Créer du déficit foncier reportable',
        montantCible: montantCiblePhase2,
        deficitCree: plafondDeficit,
        economieIR: economieIRPhase2,
        economieTotal: economieTotal_Phase2,
        ratioEconomieSurInvest: ratioPhase2,
        avertissement: '⚠️ PS non impactés en Phase 2 (déficit reportable uniquement)',
      },
      recommandation,
      totalEconomie,
      totalInvestissement,
    };
  }
  
  // ============================================================================
  // COMPARAISON PER vs TRAVAUX
  // ============================================================================
  
  /**
   * Compare les stratégies PER, Travaux, et Combinée
   */
  private comparePERvsWorks(
    simulation: SimulationResult,
    inputs: FiscalInputs,
    taxParams: TaxParams
  ): OptimizationComparison {
    // ============================================================================
    // STRATÉGIE PER
    // ============================================================================
    
    const plafondPER = Math.max(
      inputs.foyer.salaire * taxParams.per.tauxPlafond,
      taxParams.per.plancherLegal
    );
    
    const reliquatsDisponibles = inputs.per
      ? Object.values(inputs.per.reliquats).reduce((sum, val) => sum + val, 0)
      : 0;
    
    const plafondPERTotal = plafondPER + reliquatsDisponibles;
    
    // Économie fiscale PER (IR uniquement, pas de PS)
    const economiePER = plafondPERTotal * simulation.ir.trancheMarginate;
    const ratioPER = plafondPERTotal > 0 ? economiePER / plafondPERTotal : 0;
    
    // ============================================================================
    // STRATÉGIE TRAVAUX (Phase 1 uniquement pour comparaison)
    // ============================================================================
    
    const revenusImmobiliers = Math.max(0, simulation.consolidation.revenusFonciers + simulation.consolidation.revenusBIC);
    const montantTravaux = revenusImmobiliers;
    
    const partRevenusImmobiliers = simulation.ir.revenuImposable > 0
      ? revenusImmobiliers / simulation.ir.revenuImposable
      : 0;
    
    const economieTravaux = simulation.ir.impotNet * partRevenusImmobiliers + simulation.ps.montant;
    const ratioTravaux = montantTravaux > 0 ? economieTravaux / montantTravaux : 0;
    
    // ============================================================================
    // STRATÉGIE COMBINÉE
    // ============================================================================
    
    // Optimiser l'allocation entre PER et Travaux selon les ratios
    const investissementCombine = plafondPERTotal + montantTravaux;
    const economieCombine = economiePER + economieTravaux;
    const ratioCombine = investissementCombine > 0 ? economieCombine / investissementCombine : 0;
    
    // ============================================================================
    // RECOMMANDATION
    // ============================================================================
    
    let strategyRecommendation: 'per' | 'travaux' | 'combine';
    let reasoning = '';
    
    if (ratioPER > ratioTravaux && ratioPER > OPTIMIZATION_THRESHOLDS.RATIO_BON) {
      strategyRecommendation = 'per';
      reasoning = `Le PER offre le meilleur ratio (${(ratioPER * 100).toFixed(0)}% vs ${(ratioTravaux * 100).toFixed(0)}% pour travaux). `;
      reasoning += `L'épargne est bloquée jusqu'à la retraite mais l'avantage fiscal est immédiat et garanti.`;
    } else if (ratioTravaux > ratioPER && ratioTravaux > OPTIMIZATION_THRESHOLDS.RATIO_EXCELLENT) {
      strategyRecommendation = 'travaux';
      reasoning = `Les travaux offrent le meilleur ratio (${(ratioTravaux * 100).toFixed(0)}% vs ${(ratioPER * 100).toFixed(0)}% pour PER). `;
      reasoning += `Ils valorisent votre patrimoine et génèrent des économies IR + PS.`;
    } else if (ratioCombine > OPTIMIZATION_THRESHOLDS.RATIO_BON) {
      strategyRecommendation = 'combine';
      reasoning = `La stratégie combinée optimise les deux leviers. `;
      reasoning += `Ratio global : ${(ratioCombine * 100).toFixed(0)}%. Diversification des avantages fiscaux.`;
    } else {
      strategyRecommendation = 'combine';
      reasoning = `Ratios modestes mais la combinaison reste intéressante pour diversifier.`;
    }
    
    return {
      per: {
        investissement: plafondPERTotal,
        economie: economiePER,
        ratio: ratioPER,
        disponibilite: 'Bloqué jusqu\'à la retraite',
      },
      travaux: {
        investissement: montantTravaux,
        economie: economieTravaux,
        ratio: ratioTravaux,
        disponibilite: 'Valorise le patrimoine',
      },
      combine: {
        investissement: investissementCombine,
        economie: economieCombine,
        ratio: ratioCombine,
        recommandation: reasoning,
      },
      strategyRecommendation,
      reasoning,
    };
  }
  
  // ============================================================================
  // SUGGESTIONS D'OPTIMISATION
  // ============================================================================
  
  /**
   * Génère des suggestions d'optimisation diverses
   */
  private generateSuggestions(
    simulation: SimulationResult,
    inputs: FiscalInputs,
    taxParams: TaxParams
  ): OptimizationResult['suggestions'] {
    const suggestions: OptimizationResult['suggestions'] = [];
    
    // ============================================================================
    // Suggestion 1 : Optimisation des régimes fiscaux
    // ============================================================================
    
    console.log(`[Optimizer] Analyse des régimes pour ${simulation.biens.length} bien(s)...`);
    
    for (const bien of simulation.biens) {
      console.log(`[Optimizer] ${bien.nom}:`, {
        regimeUtilise: bien.regimeUtilise,
        regimeSuggere: bien.regimeSuggere,
        economieRegimeReel: bien.details.economieRegimeReel,
        eligibleMicro: bien.details.eligibleMicro,
      });
      
      // ✅ Ne suggérer QUE si le régime utilisé est différent du régime suggéré
      if (bien.regimeUtilise !== bien.regimeSuggere && bien.details.economieRegimeReel) {
        const economie = Math.abs(bien.details.economieRegimeReel);
        
        console.log(`  → Régimes différents ! Économie : ${economie.toFixed(2)}€`);
        
        // ✅ Afficher toutes les suggestions de régime, même les petites économies
        // (car elles sont importantes pour l'utilisateur)
        if (economie > 0) {
          // Déterminer le sens de la suggestion
          const versReel = bien.regimeSuggere === 'reel' || bien.regimeSuggere === 'REEL' || bien.regimeSuggere === 'REEL_SIMPLIFIE';
          const versMicro = bien.regimeSuggere === 'micro' || bien.regimeSuggere === 'MICRO' || bien.regimeSuggere === 'MICRO_BIC';
          
          let titre = '';
          let description = '';
          
          if (versReel) {
            // Suggérer de passer au réel
            titre = `Passer au régime réel pour "${bien.nom}"`;
            description = `Le régime réel vous ferait économiser environ ${this.formatEuro(economie)} par an par rapport au micro (charges réelles > abattement).`;
          } else if (versMicro) {
            // Suggérer de passer au micro
            titre = `Passer au régime micro pour "${bien.nom}"`;
            description = `Le régime micro vous ferait économiser environ ${this.formatEuro(economie)} par an par rapport au réel (abattement > charges réelles).`;
          } else {
            // Cas générique
            titre = `Optimiser le régime fiscal de "${bien.nom}"`;
            description = `Passer au régime ${bien.regimeSuggere} vous ferait économiser environ ${this.formatEuro(economie)} par an.`;
          }
          
          console.log(`  → ✅ Suggestion ajoutée: ${titre} (${economie.toFixed(2)}€)`);
          
          suggestions.push({
            type: 'regime',
            titre,
            description,
            economieEstimee: economie,
            complexite: 'moyenne',
          });
        } else {
          console.log(`  → ❌ Économie nulle (${economie.toFixed(2)}€)`);
        }
      } else {
        if (bien.regimeUtilise === bien.regimeSuggere) {
          console.log(`  → ℹ️ Déjà optimal (${bien.regimeUtilise})`);
        } else if (!bien.details.economieRegimeReel) {
          console.log(`  → ⚠️ economieRegimeReel non défini`);
        }
      }
    }
    
    console.log(`[Optimizer] ${suggestions.length} suggestion(s) de régime générée(s)`);

    
    // ============================================================================
    // Suggestion 2 : Timing des travaux
    // ============================================================================
    
    if (simulation.consolidation.revenusFonciers > OPTIMIZATION_THRESHOLDS.REVENUS_MIN_TRAVAUX) {
      suggestions.push({
        type: 'timing',
        titre: 'Planifier les travaux en année de revenus élevés',
        description: 'Vos revenus fonciers sont importants cette année. C\'est le moment idéal pour réaliser des travaux déductibles et maximiser l\'économie d\'impôt.',
        economieEstimee: simulation.ps.montant * 0.5,  // Estimation : 50% des PS économisables
        complexite: 'facile',
      });
    }
    
    // ============================================================================
    // Suggestion 3 : Structure juridique (SCI IS)
    // ============================================================================
    
    if (simulation.ir.trancheMarginate >= OPTIMIZATION_THRESHOLDS.TMI_ELEVE_SCI && 
        simulation.consolidation.revenusFonciers > OPTIMIZATION_THRESHOLDS.REVENUS_MIN_SCI) {
      // ✅ Utiliser le taux IS normal depuis taxParams
      const tauxIS = taxParams.sciIS.tauxNormal;
      const economieSCIIS = simulation.consolidation.revenusFonciers * (simulation.ir.trancheMarginate - tauxIS);
      
      suggestions.push({
        type: 'structure',
        titre: 'Étudier une SCI à l\'IS',
        description: `Avec une TMI de ${(simulation.ir.trancheMarginate * 100).toFixed(0)}%, une SCI à l\'IS pourrait réduire votre imposition de ${(simulation.ir.trancheMarginate * 100).toFixed(0)}% à ${(tauxIS * 100).toFixed(0)}% (IS). Économie estimée : ${this.formatEuro(economieSCIIS)}/an.`,
        economieEstimee: economieSCIIS,
        complexite: 'difficile',
      });
    }
    
    // ============================================================================
    // Suggestion 4 : Répartition LMNP
    // ============================================================================
    
    // ✅ Filtrer les biens de catégorie FONCIER (NU)
    const biensNU = simulation.biens.filter(b => b.type === 'NU');
    if (biensNU.length > 0 && simulation.consolidation.revenusFonciers > taxParams.micro.foncierPlafond) {
      suggestions.push({
        type: 'repartition',
        titre: 'Envisager la location meublée (LMNP)',
        description: 'La location meublée offre des abattements plus importants (50% vs 30%) et permet l\'amortissement du bien. Particulièrement intéressant pour les biens rénovés.',
        economieEstimee: simulation.consolidation.revenusFonciers * OPTIMIZATION_THRESHOLDS.ESTIMATION_GAIN_LMNP,
        complexite: 'moyenne',
      });
    }
    
    // ============================================================================
    // Suggestion 5 : Optimisation PER si non utilisé
    // ============================================================================
    
    if (!simulation.per || simulation.per.versement === 0) {
      const plafondPER = Math.max(
        inputs.foyer.salaire * taxParams.per.tauxPlafond,
        taxParams.per.plancherLegal
      );
      
      const economiePotentielle = plafondPER * simulation.ir.trancheMarginate;
      
      suggestions.push({
        type: 'regime',
        titre: 'Utiliser le plafond PER disponible',
        description: `Vous avez ${this.formatEuro(plafondPER)} de plafond PER non utilisé. Un versement vous ferait économiser environ ${this.formatEuro(economiePotentielle)} d\'IR.`,
        economieEstimee: economiePotentielle,
        complexite: 'facile',
      });
    }
    
    // Trier par économie décroissante
    suggestions.sort((a, b) => b.economieEstimee - a.economieEstimee);
    
    return suggestions.slice(0, 5);  // Top 5 suggestions
  }
  
  // ============================================================================
  // HELPERS
  // ============================================================================
  
  /**
   * Formate un montant en euros
   */
  private formatEuro(amount: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }
}

// ============================================================================
// EXPORT SINGLETON
// ============================================================================

export const Optimizer = new OptimizerClass();

