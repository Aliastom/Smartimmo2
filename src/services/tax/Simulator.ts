/**
 * Simulator - Service de calcul fiscal immobilier
 * 
 * Ce service implémente tous les calculs fiscaux français pour l'immobilier :
 * - Impôt sur le revenu (IR) avec tranches et décote
 * - Prélèvements sociaux (PS)
 * - Revenus fonciers (micro-foncier / réel)
 * - Revenus BIC meublés (micro-BIC / réel avec amortissements)
 * - Déficit foncier et reports
 * - PER (Plan Épargne Retraite)
 * - SCI à l'IS
 */

import type {
  FiscalInputs,
  SimulationResult,
  RentalPropertyResult,
  IRResult,
  PSResult,
  PERResult,
  TaxParams,
  RentalPropertyInput,
} from '@/types/fiscal';
import { computeIRResult } from '@/services/tax/computeIRResult';
import { computeRevenuProFoyerIR } from '@/services/tax/computeRevenuProFoyerIR';

// ============================================================================
// SERVICE PRINCIPAL
// ============================================================================

class SimulatorClass {
  private toCents(amount: number): number {
    return Math.round((Number(amount) + Number.EPSILON) * 100);
  }

  private fromCents(cents: number): number {
    return cents / 100;
  }

  /**
   * Lance une simulation fiscale complète
   */
  async simulate(inputs: FiscalInputs, taxParams: TaxParams): Promise<SimulationResult> {
    const startTime = Date.now();
    
    console.log(`🧮 Simulation fiscale ${inputs.year}...`);
    
    // 1. Simuler chaque bien individuellement
    const regimeForce = inputs.options.regimeForce;
    const biens = inputs.biens.map(bien => 
      this.simulateProperty(bien, taxParams, regimeForce)
    );
    
    // 2. Consolider les revenus fonciers et BIC
    const consolidation = this.consolidateRevenues(biens, taxParams);
    
    // 3. Base foyer avant quotient / barème (revenus d’activité nets + chaîne pensions si `pensionsBrutes` > 0)
    const revenuProFoyer = computeRevenuProFoyerIR(inputs.foyer, taxParams);

    // 4. Calculer le revenu imposable total
    let revenuImposableTotal =
      revenuProFoyer +
      consolidation.revenusFonciers +
      consolidation.revenusBIC;
    
    // ✅ Déduire le déficit foncier imputable GLOBAL (hors intérêts)
    if (consolidation.deficitImputableRevenuGlobal && consolidation.deficitImputableRevenuGlobal > 0) {
      revenuImposableTotal -= consolidation.deficitImputableRevenuGlobal;
      console.log(`[IR] Revenu imposable après déficit: ${revenuImposableTotal.toFixed(2)}€ (déficit imputable: ${consolidation.deficitImputableRevenuGlobal.toFixed(2)}€)`);
    }
    
    // Déduction PER
    revenuImposableTotal -= (inputs.per?.versementPrevu || 0);
    
    // 🆕 Calcul de l'IR supplémentaire dû aux revenus immobiliers
    // 1. IR sans revenus immobiliers (juste salaire)
    let revenuSansFoncier = revenuProFoyer - (inputs.per?.versementPrevu || 0);
    const irSansFoncier = this.calculateIR(
      revenuSansFoncier,
      inputs.foyer.parts,
      inputs.foyer.isCouple,
      taxParams
    );
    
    // 2. IR avec revenus immobiliers
    const ir = this.calculateIR(
      revenuImposableTotal,
      inputs.foyer.parts,
      inputs.foyer.isCouple,
      taxParams
    );
    
    // 3. IR supplémentaire = différence
    const irSupplementaire = ir.impotNet - irSansFoncier.impotNet;
    
    // 4. Calculer les PS
    const basePS = consolidation.revenusFonciers + consolidation.revenusBIC;
    const ps = this.calculatePS(basePS, taxParams);
    
    // 🆕 Impôts supplémentaires TOTAUX (IR + PS) causés par l'immobilier
    const impotsSuppTotal = (ir.impotNet + ps.montant) - (irSansFoncier.impotNet + 0);
    
    // 5. Calculer le PER (si applicable)
    let per: PERResult | undefined;
    if (inputs.per && inputs.per.versementPrevu > 0) {
      per = this.calculatePER(
        inputs.per,
        inputs.foyer.salaire,
        ir.trancheMarginate,
        taxParams
      );
    }
    
    // 6. Calculer le cash-flow
    const cashflow = this.calculateCashflow(biens, ir.impotNet, ps.montant);
    
    // 7. Calculer les résumés
    const totalImpots = ir.impotNet + ps.montant;
    
    // 🆕 Bénéfice net immobilier = Loyers - Charges - Impôts supplémentaires (si > 0)
    const loyersBruts = biens.reduce((sum, b) => sum + b.recettesBrutes, 0);
    const chargesTotal = biens.reduce((sum, b) => sum + b.chargesDeductibles, 0);
    
    // ✅ Si impôts supp < 0 (économie), ne pas les soustraire
    const impotsSuppADeduire = Math.max(0, impotsSuppTotal);
    const beneficeNetImmobilier = loyersBruts - chargesTotal - impotsSuppADeduire;
    
    const tauxEffectif = revenuImposableTotal > 0 ? totalImpots / revenuImposableTotal : 0;
    
    // ✅ Rendement = 0 si déficit (pas pertinent)
    const rendementNet = beneficeNetImmobilier > 0 && loyersBruts > 0
      ? beneficeNetImmobilier / loyersBruts 
      : 0;
    
    const dureeCalculMS = Date.now() - startTime;
    
    console.log(`✅ Simulation terminée en ${dureeCalculMS}ms`);
    console.log(`   IR sans foncier: ${irSansFoncier.impotNet.toFixed(2)} €`);
    console.log(`   IR avec foncier: ${ir.impotNet.toFixed(2)} €`);
    console.log(`   PS avec foncier: ${ps.montant.toFixed(2)} €`);
    console.log(`   IR supplémentaire: ${irSupplementaire.toFixed(2)} €`);
    console.log(`   Impôts supplémentaires TOTAUX (IR+PS): ${impotsSuppTotal.toFixed(2)} €`);
    console.log(`   Bénéfice net immobilier: ${beneficeNetImmobilier.toFixed(2)} €`);
    
    return {
      taxParams,
      inputs,
      biens,
      consolidation,
      ir,
      ps,
      per,
      cashflow,
      resume: {
        totalImpots,
        beneficeNetImmobilier,
        irSupplementaire,
        impotsSuppTotal,  // 🆕 Total IR + PS supplémentaires
        tauxEffectif,
        rendementNet,
      },
      dateCalcul: new Date(),
      dureeCalculMS,
    };
  }
  
  // ============================================================================
  // CALCUL PAR BIEN
  // ============================================================================
  
  /**
   * ✅ Simule un bien immobilier selon son régime fiscal
   * Utilise la CATÉGORIE du type fiscal (FONCIER, BIC, IS) depuis BDD
   */
  private simulateProperty(
    property: RentalPropertyInput,
    taxParams: TaxParams,
    regimeForce?: 'micro' | 'reel'
  ): RentalPropertyResult {
    // Priorité : regimeForce > regimeChoisi > regimeSuggere
    const regime = regimeForce || property.regimeChoisi || property.regimeSuggere;
    const regimeSuggere = property.regimeSuggere; // Toujours garder la suggestion
    
    // ✅ Déterminer la catégorie fiscale depuis le type
    // Types en BDD : NU (FONCIER), MEUBLE (BIC), SCI_IS (IS)
    let category = 'FONCIER'; // Fallback
    
    if (property.type === 'NU') {
      category = 'FONCIER';
    } else if (property.type === 'MEUBLE' || property.type === 'LMNP' || property.type === 'LMP') {
      category = 'BIC';
    } else if (property.type === 'SCI_IS') {
      category = 'IS';
    }
    
    // Router vers la bonne méthode selon la catégorie
    let result: RentalPropertyResult;
    switch (category) {
      case 'FONCIER':
        result = this.simulateFoncier(property, regime, regimeSuggere, taxParams);
        break;
      case 'BIC':
        result = this.simulateMeuble(property, regime, regimeSuggere, taxParams);
        break;
      case 'IS':
        result = this.simulateSCIIS(property, taxParams);
        break;
      default:
        throw new Error(`Catégorie fiscale non supportée : ${category} (type: ${property.type})`);
    }

    return {
      ...result,
      declaration2044: property.declaration2044,
    };
  }
  
  /**
   * Simule un bien en location nue (foncier)
   */
  private simulateFoncier(
    property: RentalPropertyInput,
    regime: 'micro' | 'reel',
    regimeSuggere: 'micro' | 'reel',
    taxParams: TaxParams
  ): RentalPropertyResult {
    const recettesBrutesCents = this.toCents(property.loyers) + this.toCents(property.autresRevenus || 0);
    const recettesBrutes = this.fromCents(recettesBrutesCents);
    
    if (regime === 'micro' || regime === 'MICRO') {
      // Micro-foncier : abattement 30%
      const abattementCents = Math.round(recettesBrutesCents * taxParams.micro.foncierAbattement);
      const resultatFiscalCents = recettesBrutesCents - abattementCents;
      const abattement = this.fromCents(abattementCents);
      const resultatFiscal = this.fromCents(resultatFiscalCents);
      
      return {
        id: property.id,
        nom: property.nom,
        type: property.type,
        regime: 'micro',
        regimeUtilise: regime,
        regimeSuggere,
        recettesBrutes,
        chargesDeductibles: abattement,
        amortissements: 0,
        resultatFiscal,
        baseImposableIR: resultatFiscal,
        baseImposablePS: resultatFiscal,
        details: {
          abattement,
          tauxAbattement: taxParams.micro.foncierAbattement,
          eligibleMicro: recettesBrutes <= taxParams.micro.foncierPlafond,
        },
        breakdown: property.breakdown, // 🆕 Copier le breakdown
      };
    } else {
      // Régime réel
      const chargesDeductiblesCents =
        this.toCents(property.charges) +
        this.toCents(property.interets) +
        this.toCents(property.assuranceEmprunt) +
        this.toCents(property.taxeFonciere) +
        this.toCents(property.fraisGestion) +
        this.toCents(property.assurancePNO) +
        this.toCents(property.chargesCopro) +
        this.toCents(property.autresCharges) +
        this.toCents(property.travaux.entretien); // Travaux entretien/réparation déductibles

      const resultatFiscalCents = recettesBrutesCents - chargesDeductiblesCents;
      const chargesDeductibles = this.fromCents(chargesDeductiblesCents);
      const resultatFiscal = this.fromCents(resultatFiscalCents);
      
      // Déficit foncier
      let deficit: number | undefined;
      let deficitImputableRevenuGlobal: number | undefined;
      let deficitReportable: number | undefined;
      
      if (resultatFiscalCents < 0) {
        deficit = this.fromCents(Math.abs(resultatFiscalCents));
        
        // ✅ Déficit imputable sur revenu global (hors intérêts d'emprunt)
        // Charges hors intérêts = charges totales - intérêts
        const chargesHorsInteretsCents = chargesDeductiblesCents - this.toCents(property.interets);
        
        // Déficit hors intérêts = max(0, charges HI - recettes)
        const deficitHorsInteretsCents = Math.max(0, chargesHorsInteretsCents - recettesBrutesCents);
        
        const plafondCents = this.toCents(taxParams.deficitFoncier.plafondImputationRevenuGlobal);
        const imputableCents = Math.min(deficitHorsInteretsCents, plafondCents);
        deficitImputableRevenuGlobal = this.fromCents(imputableCents);
        
        deficitReportable = this.fromCents(Math.abs(resultatFiscalCents) - imputableCents);
      }
      
      return {
        id: property.id,
        nom: property.nom,
        type: property.type,
        regime: 'reel',
        regimeUtilise: regime,
        regimeSuggere,
        recettesBrutes,
        chargesDeductibles,
        amortissements: 0,
        resultatFiscal,
        baseImposableIR: this.fromCents(Math.max(0, resultatFiscalCents)),
        baseImposablePS: this.fromCents(Math.max(0, resultatFiscalCents)),
        deficit,
        deficitImputableRevenuGlobal,
        deficitReportable,
        details: {
          eligibleMicro: recettesBrutes <= taxParams.micro.foncierPlafond,
          economieRegimeReel: this.compareRegimes(
            property,
            recettesBrutes,
            chargesDeductibles,
            taxParams
          ),
        },
        breakdown: property.breakdown, // 🆕 Copier le breakdown
      };
    }
  }
  
  /**
   * ✅ Simule un bien en location meublée (LMNP/LMP)
   * Catégorie BIC selon BDD (type MEUBLE)
   */
  private simulateMeuble(
    property: RentalPropertyInput,
    regime: 'micro' | 'reel',
    regimeSuggere: 'micro' | 'reel',
    taxParams: TaxParams
  ): RentalPropertyResult {
    const recettesBrutesCents = this.toCents(property.loyers) + this.toCents(property.autresRevenus || 0);
    const recettesBrutes = this.fromCents(recettesBrutesCents);
    
    if (regime === 'micro' || regime === 'MICRO' || regime === 'MICRO_BIC') {
      // Micro-BIC : 50 % par défaut ; 71 % si meubleTourismeClasse et sous plafond
      const plafondTourisme = taxParams.micro.meubleTourismePlafond ?? 188700;
      const eligibleMeubleTourismeClasse =
        property.meubleTourismeClasse === true && recettesBrutes <= plafondTourisme;
      const tauxAbattement = eligibleMeubleTourismeClasse
        ? (taxParams.micro.meubleTourismeAbattement ?? 0.71)
        : taxParams.micro.bicAbattement;
      
      const abattementCents = Math.round(recettesBrutesCents * tauxAbattement);
      const resultatFiscalCents = recettesBrutesCents - abattementCents;
      const abattement = this.fromCents(abattementCents);
      const resultatFiscal = this.fromCents(resultatFiscalCents);
      
      return {
        id: property.id,
        nom: property.nom,
        type: property.type,
        regime: 'micro',
        regimeUtilise: regime,
        regimeSuggere,
        recettesBrutes,
        chargesDeductibles: abattement,
        amortissements: 0,
        resultatFiscal,
        baseImposableIR: resultatFiscal,
        baseImposablePS: resultatFiscal,
        details: {
          abattement,
          tauxAbattement,
          eligibleMicro: recettesBrutes <= taxParams.micro.bicPlafond,
        },
        breakdown: property.breakdown, // 🆕 Copier le breakdown
      };
    } else {
      // Régime réel avec amortissements
      const chargesDeductiblesCents =
        this.toCents(property.charges) +
        this.toCents(property.interets) +
        this.toCents(property.assuranceEmprunt) +
        this.toCents(property.taxeFonciere) +
        this.toCents(property.fraisGestion) +
        this.toCents(property.assurancePNO) +
        this.toCents(property.chargesCopro) +
        this.toCents(property.autresCharges) +
        this.toCents(property.travaux.entretien);

      const amortissementsCents = property.amortissements
        ? this.toCents(property.amortissements.batiment) +
          this.toCents(property.amortissements.mobilier) +
          this.toCents(property.amortissements.fraisAcquisition)
        : 0;

      const resultatFiscalCents = recettesBrutesCents - chargesDeductiblesCents - amortissementsCents;
      const chargesDeductibles = this.fromCents(chargesDeductiblesCents);
      const amortissements = this.fromCents(amortissementsCents);
      const resultatFiscal = this.fromCents(resultatFiscalCents);
      
      // Les déficits BIC ne sont imputables que sur les bénéfices BIC futurs
      let deficit: number | undefined;
      let deficitReportable: number | undefined;
      
      if (resultatFiscalCents < 0) {
        deficit = this.fromCents(Math.abs(resultatFiscalCents));
        deficitReportable = deficit;  // Reportable sur BIC futurs
      }
      
      return {
        id: property.id,
        nom: property.nom,
        type: property.type,
        regime: 'reel',
        regimeUtilise: regime,
        regimeSuggere,
        recettesBrutes,
        chargesDeductibles,
        amortissements,
        resultatFiscal,
        baseImposableIR: this.fromCents(Math.max(0, resultatFiscalCents)),
        baseImposablePS: this.fromCents(Math.max(0, resultatFiscalCents)),
        deficit,
        deficitReportable,
        details: {
          eligibleMicro: recettesBrutes <= taxParams.micro.bicPlafond,
          economieRegimeReel: this.compareRegimesMeuble(
            property,
            recettesBrutes,
            chargesDeductibles,
            amortissements,
            taxParams
          ),
        },
        breakdown: property.breakdown, // 🆕 Copier le breakdown
      };
    }
  }
  
  /**
   * Simule une SCI à l'IS
   */
  private simulateSCIIS(
    property: RentalPropertyInput,
    taxParams: TaxParams
  ): RentalPropertyResult {
    const recettesBrutesCents = this.toCents(property.loyers) + this.toCents(property.autresRevenus || 0);
    const chargesDeductiblesCents =
      this.toCents(property.charges) +
      this.toCents(property.interets) +
      this.toCents(property.assuranceEmprunt) +
      this.toCents(property.taxeFonciere) +
      this.toCents(property.fraisGestion) +
      this.toCents(property.assurancePNO) +
      this.toCents(property.chargesCopro) +
      this.toCents(property.autresCharges) +
      this.toCents(property.travaux.entretien);

    const resultatFiscalCents = recettesBrutesCents - chargesDeductiblesCents;
    const recettesBrutes = this.fromCents(recettesBrutesCents);
    const chargesDeductibles = this.fromCents(chargesDeductiblesCents);
    const resultatFiscal = this.fromCents(resultatFiscalCents);
    
    // Calcul IS
    let impotIS = 0;
    if (resultatFiscalCents > 0) {
      const plafondCents = this.toCents(taxParams.sciIS.plafondTauxReduit);
      if (resultatFiscalCents <= plafondCents) {
        impotIS = this.fromCents(Math.round(resultatFiscalCents * taxParams.sciIS.tauxReduit));
      } else {
        const partReduiteCents = Math.round(plafondCents * taxParams.sciIS.tauxReduit);
        const partNormaleCents = Math.round((resultatFiscalCents - plafondCents) * taxParams.sciIS.tauxNormal);
        impotIS = this.fromCents(partReduiteCents + partNormaleCents);
      }
    }
    
    const resultatNetIS = resultatFiscal - impotIS;
    
    return {
      id: property.id,
      nom: property.nom,
      type: property.type,
      regime: 'reel',
      regimeUtilise: 'reel',
      regimeSuggere: 'reel', // SCI IS = toujours réel
      recettesBrutes,
      chargesDeductibles,
      amortissements: 0,
      resultatFiscal: resultatNetIS,
      baseImposableIR: 0,  // L'IS remplace l'IR
      baseImposablePS: 0,   // Pas de PS sur SCI IS
      details: {
        eligibleMicro: false,
      },
      breakdown: property.breakdown, // 🆕 Copier le breakdown
    };
  }
  
  // ============================================================================
  // CONSOLIDATION REVENUS
  // ============================================================================
  
  /**
   * ✅ Consolide les revenus fonciers et BIC de tous les biens
   * RÈGLE FISCALE : On additionne TOUS les résultats (positifs ET négatifs)
   * 
   * RÈGLE DÉFICIT FONCIER :
   * - Résultat global = Loyers - Charges (toutes natures)
   * - Si déficit :
   *   → cap = max(0, loyers_totaux - interets_totaux)
   *   → imputable = max(0, charges_hors_interets - cap)  [plafonné 10 700€]
   *   → reportable = déficit_total - imputable
   * - Les intérêts ne peuvent JAMAIS créer de déficit imputable sur revenu global
   */
  private consolidateRevenues(biens: RentalPropertyResult[], taxParams: TaxParams) {
    let resultatFoncierGlobalCents = 0;
    let resultatBICGlobalCents = 0;
    let loyersTotauxCents = 0;
    let chargesHorsInteretsTotalesCents = 0;
    let interetsTotauxCents = 0;
    const detailsParBien: Array<{
      id: string;
      nom: string;
      type: string;
      resultatFiscal: number;
      resultatFiscalCentimes: number;
    }> = [];
    
    // ✅ Additionner TOUS les résultats + tracker loyers/charges/intérêts
    for (const bien of biens) {
      // ✅ Classifier par type (NU = FONCIER, MEUBLE/LMNP/LMP = BIC)
      const isFoncier = bien.type === 'NU';
      const isBIC = bien.type === 'MEUBLE' || bien.type === 'LMNP' || bien.type === 'LMP';
      
      if (isFoncier) {
        // Revenus fonciers : additionner (peut être positif ou négatif)
        const resultatFiscalCents = this.toCents(bien.resultatFiscal);
        resultatFoncierGlobalCents += resultatFiscalCents;
        loyersTotauxCents += this.toCents(bien.recettesBrutes);
        detailsParBien.push({
          id: bien.id,
          nom: bien.nom,
          type: bien.type,
          resultatFiscal: bien.resultatFiscal,
          resultatFiscalCentimes: resultatFiscalCents,
        });
        
        // ✅ Extraire les intérêts depuis le breakdown (si disponible)
        const interetsBien = bien.breakdown?.total?.interetsEmprunt || 0;
        const interetsBienCents = this.toCents(interetsBien);
        const chargesHorsInteretsCents = this.toCents(bien.chargesDeductibles) - interetsBienCents;
        
        interetsTotauxCents += interetsBienCents;
        chargesHorsInteretsTotalesCents += chargesHorsInteretsCents;
        
        console.log(`[Consolidation] ${bien.nom} (FONCIER): Loyers ${bien.recettesBrutes.toFixed(2)}€, Charges HI ${this.fromCents(chargesHorsInteretsCents).toFixed(2)}€, Intérêts ${interetsBien.toFixed(2)}€ → Résultat: ${bien.resultatFiscal.toFixed(2)}€`);
      } else if (isBIC) {
        // Revenus BIC : additionner (peut être positif ou négatif)
        resultatBICGlobalCents += this.toCents(bien.resultatFiscal);
        console.log(`[Consolidation] ${bien.nom} (BIC): ${bien.resultatFiscal.toFixed(2)}€ → Total BIC: ${this.fromCents(resultatBICGlobalCents).toFixed(2)}€`);
      }
      // SCI_IS : déjà imposé à l'IS, ne rentre pas dans l'IR
    }
    
    // ✅ Si résultat global < 0 → déficit, sinon → revenus
    const resultatFoncierGlobal = this.fromCents(resultatFoncierGlobalCents);
    const revenusFonciers = this.fromCents(Math.max(0, resultatFoncierGlobalCents));
    const revenusFonciers4BA = resultatFoncierGlobal;
    const deficitFoncierTotal = this.fromCents(resultatFoncierGlobalCents < 0 ? Math.abs(resultatFoncierGlobalCents) : 0);
    
    // 🆕 Si déficit foncier : calculer selon la VRAIE formule fiscale
    // ✅ Recalculer l'imputable APRÈS compensation entre biens
    let deficitImputableRevenuGlobal = 0;
    let deficitReportable = 0;
    
    if (deficitFoncierTotal > 0) {
      // Déficit hors intérêts GLOBAL (après compensation)
      const deficitHorsInteretsGlobalCents = Math.max(0, chargesHorsInteretsTotalesCents - loyersTotauxCents);
      
      // Imputable = déficit hors intérêts (plafonné 10 700 €)
      const plafImputationCents = this.toCents(taxParams.deficitFoncier.plafondImputationRevenuGlobal);
      const imputableCents = Math.min(deficitHorsInteretsGlobalCents, plafImputationCents);
      deficitImputableRevenuGlobal = this.fromCents(imputableCents);
      
      // Reportable = déficit total - imputable
      deficitReportable = this.fromCents(Math.max(0, Math.abs(resultatFoncierGlobalCents) - imputableCents));
      
      console.log(`[Déficit foncier] Loyers totaux: ${this.fromCents(loyersTotauxCents).toFixed(2)}€`);
      console.log(`[Déficit foncier] Charges hors intérêts: ${this.fromCents(chargesHorsInteretsTotalesCents).toFixed(2)}€`);
      console.log(`[Déficit foncier] Intérêts totaux: ${this.fromCents(interetsTotauxCents).toFixed(2)}€`);
      console.log(`[Déficit foncier] Déficit HI global (après compensation): ${this.fromCents(deficitHorsInteretsGlobalCents).toFixed(2)}€`);
      console.log(`[Déficit foncier] Imputable revenu global: ${deficitImputableRevenuGlobal.toFixed(2)}€ (plafonné ${taxParams.deficitFoncier.plafondImputationRevenuGlobal}€)`);
      console.log(`[Déficit foncier] Reportable sur 10 ans: ${deficitReportable.toFixed(2)}€`);
    }
    
    const resultatBICGlobal = this.fromCents(resultatBICGlobalCents);
    const revenusBIC = this.fromCents(Math.max(0, resultatBICGlobalCents));
    const deficitBIC = this.fromCents(resultatBICGlobalCents < 0 ? Math.abs(resultatBICGlobalCents) : 0);
    
    console.log(`[Consolidation] Résultat foncier global: ${resultatFoncierGlobal.toFixed(2)}€ → Revenus: ${revenusFonciers.toFixed(2)}€, Déficit: ${deficitFoncierTotal.toFixed(2)}€`);
    console.log(`[Consolidation] Résultat BIC global: ${resultatBICGlobal.toFixed(2)}€ → Revenus: ${revenusBIC.toFixed(2)}€, Déficit: ${deficitBIC.toFixed(2)}€`);
    const sumResultatsBiens = this.fromCents(
      detailsParBien.reduce((acc, d) => acc + d.resultatFiscalCentimes, 0),
    );
    const rawSumResultatsBiens = detailsParBien.reduce((acc, d) => acc + d.resultatFiscal, 0);
    const montant4BA = revenusFonciers4BA;
    const delta = Math.abs(sumResultatsBiens - montant4BA);
    const deltaArrondi4BA = Math.abs(rawSumResultatsBiens - montant4BA);

    if (delta > 0.01) {
      console.error('[FISCAL_COHERENCE_ERROR]', {
        sumResultatsBiens,
        montant4BA,
        delta,
        detailsParBien,
      });
    }
    
    return {
      revenusFonciers,
      revenusFonciers4BA,
      revenusBIC,
      deficitFoncier: deficitFoncierTotal,
      deficitBIC,
      deficitImputableRevenuGlobal,  // 🆕 Déficit imputable global
      deficitReportable,             // 🆕 Déficit reportable global
      deltaArrondi4BA,
      detailsParBien,
    };
  }
  
  // ============================================================================
  // CALCUL IR
  // ============================================================================
  
  /**
   * Calcule l'impôt sur le revenu avec tranches et décote
   */
  private calculateIR(
    revenuImposable: number,
    parts: number,
    isCouple: boolean,
    taxParams: TaxParams
  ): IRResult {
    return computeIRResult(revenuImposable, parts, taxParams, isCouple);
  }
  
  // ============================================================================
  // CALCUL PS
  // ============================================================================
  
  /**
   * Calcule les prélèvements sociaux
   */
  private calculatePS(baseImposable: number, taxParams: TaxParams): PSResult {
    if (baseImposable <= 0) {
      return {
        baseImposable: 0,
        montant: 0,
        taux: taxParams.psRate,
      };
    }
    
    const montant = baseImposable * taxParams.psRate;
    
    return {
      baseImposable,
      montant,
      taux: taxParams.psRate,
    };
  }
  
  // ============================================================================
  // CALCUL PER
  // ============================================================================
  
  /**
   * Calcule les avantages fiscaux d'un versement PER
   */
  private calculatePER(
    per: NonNullable<FiscalInputs['per']>,
    revenusPro: number,
    trancheMarginate: number,
    taxParams: TaxParams
  ): PERResult {
    // Calculer le plafond disponible
    const plafondAnnuel = Math.max(
      revenusPro * taxParams.per.tauxPlafond,
      taxParams.per.plancherLegal
    );
    
    // Calculer les reliquats utilisables
    const reliquatsDisponibles = Object.values(per.reliquats).reduce((sum, val) => sum + val, 0);
    const plafondTotal = plafondAnnuel + reliquatsDisponibles;
    
    // Déduction utilisée
    const deductionUtilisee = Math.min(per.versementPrevu, plafondTotal);
    
    // Reliquats utilisés
    const reliquatsUtilises = Math.min(
      Math.max(0, per.versementPrevu - plafondAnnuel),
      reliquatsDisponibles
    );
    
    // Nouveau reliquat généré si non utilisé
    const nouveauReliquat = Math.max(0, plafondAnnuel - per.versementPrevu);
    
    // Économies fiscales
    const economieIR = deductionUtilisee * trancheMarginate;
    const economiePS = 0;  // PER ne réduit pas les PS
    const economieTotal = economieIR + economiePS;
    
    return {
      versement: per.versementPrevu,
      deductionUtilisee,
      reliquatsUtilises,
      nouveauReliquat,
      economieIR,
      economiePS,
      economieTotal,
      details: {
        plafondDisponible: plafondAnnuel,
        plafondUtilise: Math.min(per.versementPrevu, plafondAnnuel),
        plafondRestant: Math.max(0, plafondAnnuel - per.versementPrevu),
        reliquatsParAnnee: per.reliquats,
      },
    };
  }
  
  // ============================================================================
  // CASH-FLOW
  // ============================================================================
  
  /**
   * Calcule le cash-flow immobilier
   */
  private calculateCashflow(
    biens: RentalPropertyResult[],
    impotIR: number,
    impotPS: number
  ) {
    let loyersBruts = 0;
    let chargesNonFinancieres = 0;
    let interets = 0;
    
    for (const bien of biens) {
      loyersBruts += bien.recettesBrutes;
      chargesNonFinancieres += bien.chargesDeductibles - (bien.amortissements || 0);
      // Note: les intérêts sont inclus dans chargesDeductibles, on les isole
    }
    
    const cashflowBrut = loyersBruts - chargesNonFinancieres;
    const impots = impotIR + impotPS;
    const cashflowNet = cashflowBrut - interets - impots;
    
    return {
      loyersBruts,
      chargesNonFinancieres,
      cashflowBrut,
      interets,
      impots,
      cashflowNet,
    };
  }
  
  // ============================================================================
  // HELPERS
  // ============================================================================
  
  /**
   * ✅ Compare micro-foncier vs réel pour déterminer l'économie
   * 
   * RETOURNE : Différence de résultat fiscal (Micro - Réel)
   * - Si > 0 → Réel est MEILLEUR (résultat fiscal plus bas = moins d'impôts)
   * - Si < 0 → Micro est MEILLEUR (résultat fiscal plus bas = moins d'impôts)
   * 
   * L'économie réelle en € d'impôt = |différence| × TMI
   */
  private compareRegimes(
    property: RentalPropertyInput,
    recettesBrutes: number,
    chargesReelles: number,
    taxParams: TaxParams
  ): number {
    const abattementMicro = recettesBrutes * taxParams.micro.foncierAbattement;
    const resultatMicro = recettesBrutes - abattementMicro;
    const resultatReel = recettesBrutes - chargesReelles;
    
    // Différence de résultat fiscal
    // Si positif → Réel meilleur (résultat plus bas)
    // Si négatif → Micro meilleur (résultat plus bas)
    return resultatMicro - resultatReel;
  }
  
  /**
   * ✅ Compare micro-BIC vs réel pour meublé
   * 
   * RETOURNE : Différence de résultat fiscal (Micro - Réel)
   * - Si > 0 → Réel est MEILLEUR (résultat fiscal plus bas)
   * - Si < 0 → Micro est MEILLEUR (résultat fiscal plus bas)
   */
  private compareRegimesMeuble(
    property: RentalPropertyInput,
    recettesBrutes: number,
    chargesReelles: number,
    amortissements: number,
    taxParams: TaxParams
  ): number {
    const plafondTourisme = taxParams.micro.meubleTourismePlafond ?? 188700;
    const tauxMicro =
      property.meubleTourismeClasse === true && recettesBrutes <= plafondTourisme
        ? (taxParams.micro.meubleTourismeAbattement ?? 0.71)
        : taxParams.micro.bicAbattement;
    const abattementMicro = recettesBrutes * tauxMicro;
    const resultatMicro = recettesBrutes - abattementMicro;
    const resultatReel = recettesBrutes - chargesReelles - amortissements;
    
    // Différence de résultat fiscal
    return resultatMicro - resultatReel;
  }
}

// ============================================================================
// EXPORT SINGLETON
// ============================================================================

export const Simulator = new SimulatorClass();

