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
  IRBracket,
} from '@/types/fiscal';

// ============================================================================
// SERVICE PRINCIPAL
// ============================================================================

class SimulatorClass {
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
    
    // 3. Calculer le revenu imposable total
    let revenuImposableTotal = 
      inputs.foyer.salaire +
      inputs.foyer.autresRevenus +
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
    let revenuSansFoncier = inputs.foyer.salaire + inputs.foyer.autresRevenus - (inputs.per?.versementPrevu || 0);
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
    switch (category) {
      case 'FONCIER':
        return this.simulateFoncier(property, regime, regimeSuggere, taxParams);
      
      case 'BIC':
        return this.simulateMeuble(property, regime, regimeSuggere, taxParams);
      
      case 'IS':
        return this.simulateSCIIS(property, taxParams);
      
      default:
        throw new Error(`Catégorie fiscale non supportée : ${category} (type: ${property.type})`);
    }
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
    const recettesBrutes = property.loyers + (property.autresRevenus || 0);
    
    if (regime === 'micro' || regime === 'MICRO') {
      // Micro-foncier : abattement 30%
      const abattement = recettesBrutes * taxParams.micro.foncierAbattement;
      const resultatFiscal = recettesBrutes - abattement;
      
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
      const chargesDeductibles = 
        property.charges +
        property.interets +
        property.assuranceEmprunt +
        property.taxeFonciere +
        property.fraisGestion +
        property.assurancePNO +
        property.chargesCopro +
        property.autresCharges +
        property.travaux.entretien;  // Travaux entretien/réparation déductibles
      
      const resultatFiscal = recettesBrutes - chargesDeductibles;
      
      // Déficit foncier
      let deficit: number | undefined;
      let deficitImputableRevenuGlobal: number | undefined;
      let deficitReportable: number | undefined;
      
      if (resultatFiscal < 0) {
        deficit = Math.abs(resultatFiscal);
        
        // ✅ Déficit imputable sur revenu global (hors intérêts d'emprunt)
        // Charges hors intérêts = charges totales - intérêts
        const chargesHorsInterets = chargesDeductibles - property.interets;
        
        // Déficit hors intérêts = max(0, charges HI - recettes)
        const deficitHorsInterets = Math.max(0, chargesHorsInterets - recettesBrutes);
        
        deficitImputableRevenuGlobal = Math.min(
          deficitHorsInterets,
          taxParams.deficitFoncier.plafondImputationRevenuGlobal
        );
        
        deficitReportable = deficit - deficitImputableRevenuGlobal;
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
        baseImposableIR: Math.max(0, resultatFiscal),
        baseImposablePS: Math.max(0, resultatFiscal),
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
    const recettesBrutes = property.loyers + (property.autresRevenus || 0);
    
    if (regime === 'micro' || regime === 'MICRO' || regime === 'MICRO_BIC') {
      // Micro-BIC : abattement 50% (ou 71% si meublé tourisme classé)
      // ✅ Vérifier si éligible au taux majoré pour meublé de tourisme classé
      const isEligibleTourisme = recettesBrutes <= (taxParams.micro.meubleTourismePlafond || 188700);
      const tauxAbattement = isEligibleTourisme
        ? (taxParams.micro.meubleTourismeAbattement || 0.71)
        : taxParams.micro.bicAbattement;
      
      const abattement = recettesBrutes * tauxAbattement;
      const resultatFiscal = recettesBrutes - abattement;
      
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
      const chargesDeductibles = 
        property.charges +
        property.interets +
        property.assuranceEmprunt +
        property.taxeFonciere +
        property.fraisGestion +
        property.assurancePNO +
        property.chargesCopro +
        property.autresCharges +
        property.travaux.entretien;
      
      const amortissements = property.amortissements
        ? property.amortissements.batiment +
          property.amortissements.mobilier +
          property.amortissements.fraisAcquisition
        : 0;
      
      const resultatFiscal = recettesBrutes - chargesDeductibles - amortissements;
      
      // Les déficits BIC ne sont imputables que sur les bénéfices BIC futurs
      let deficit: number | undefined;
      let deficitReportable: number | undefined;
      
      if (resultatFiscal < 0) {
        deficit = Math.abs(resultatFiscal);
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
        baseImposableIR: Math.max(0, resultatFiscal),
        baseImposablePS: Math.max(0, resultatFiscal),
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
    const recettesBrutes = property.loyers + (property.autresRevenus || 0);
    
    const chargesDeductibles = 
      property.charges +
      property.interets +
      property.assuranceEmprunt +
      property.taxeFonciere +
      property.fraisGestion +
      property.assurancePNO +
      property.chargesCopro +
      property.autresCharges +
      property.travaux.entretien;
    
    const resultatFiscal = recettesBrutes - chargesDeductibles;
    
    // Calcul IS
    let impotIS = 0;
    if (resultatFiscal > 0) {
      if (resultatFiscal <= taxParams.sciIS.plafondTauxReduit) {
        impotIS = resultatFiscal * taxParams.sciIS.tauxReduit;
      } else {
        const parteTauxReduit = taxParams.sciIS.plafondTauxReduit * taxParams.sciIS.tauxReduit;
        const parteTauxNormal = (resultatFiscal - taxParams.sciIS.plafondTauxReduit) * taxParams.sciIS.tauxNormal;
        impotIS = parteTauxReduit + parteTauxNormal;
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
    let resultatFoncierGlobal = 0;
    let resultatBICGlobal = 0;
    let loyersTotaux = 0;
    let chargesHorsInteretsTotales = 0;
    let interetsTotaux = 0;
    
    // ✅ Additionner TOUS les résultats + tracker loyers/charges/intérêts
    for (const bien of biens) {
      // ✅ Classifier par type (NU = FONCIER, MEUBLE/LMNP/LMP = BIC)
      const isFoncier = bien.type === 'NU';
      const isBIC = bien.type === 'MEUBLE' || bien.type === 'LMNP' || bien.type === 'LMP';
      
      if (isFoncier) {
        // Revenus fonciers : additionner (peut être positif ou négatif)
        resultatFoncierGlobal += bien.resultatFiscal;
        loyersTotaux += bien.recettesBrutes;
        
        // ✅ Extraire les intérêts depuis le breakdown (si disponible)
        const interetsBien = bien.breakdown?.total?.interetsEmprunt || 0;
        const chargesHorsInterets = bien.chargesDeductibles - interetsBien;
        
        interetsTotaux += interetsBien;
        chargesHorsInteretsTotales += chargesHorsInterets;
        
        console.log(`[Consolidation] ${bien.nom} (FONCIER): Loyers ${bien.recettesBrutes.toFixed(2)}€, Charges HI ${chargesHorsInterets.toFixed(2)}€, Intérêts ${interetsBien.toFixed(2)}€ → Résultat: ${bien.resultatFiscal.toFixed(2)}€`);
      } else if (isBIC) {
        // Revenus BIC : additionner (peut être positif ou négatif)
        resultatBICGlobal += bien.resultatFiscal;
        console.log(`[Consolidation] ${bien.nom} (BIC): ${bien.resultatFiscal.toFixed(2)}€ → Total BIC: ${resultatBICGlobal.toFixed(2)}€`);
      }
      // SCI_IS : déjà imposé à l'IS, ne rentre pas dans l'IR
    }
    
    // ✅ Si résultat global < 0 → déficit, sinon → revenus
    const revenusFonciers = resultatFoncierGlobal >= 0 ? resultatFoncierGlobal : 0;
    const deficitFoncierTotal = resultatFoncierGlobal < 0 ? Math.abs(resultatFoncierGlobal) : 0;
    
    // 🆕 Si déficit foncier : calculer selon la VRAIE formule fiscale
    // ✅ Recalculer l'imputable APRÈS compensation entre biens
    let deficitImputableRevenuGlobal = 0;
    let deficitReportable = 0;
    
    if (deficitFoncierTotal > 0) {
      // Déficit hors intérêts GLOBAL (après compensation)
      const deficitHorsInteretsGlobal = Math.max(0, chargesHorsInteretsTotales - loyersTotaux);
      
      // Imputable = déficit hors intérêts (plafonné 10 700 €)
      deficitImputableRevenuGlobal = Math.min(
        deficitHorsInteretsGlobal,
        taxParams.deficitFoncier.plafondImputationRevenuGlobal
      );
      
      // Reportable = déficit total - imputable
      deficitReportable = deficitFoncierTotal - deficitImputableRevenuGlobal;
      
      console.log(`[Déficit foncier] Loyers totaux: ${loyersTotaux.toFixed(2)}€`);
      console.log(`[Déficit foncier] Charges hors intérêts: ${chargesHorsInteretsTotales.toFixed(2)}€`);
      console.log(`[Déficit foncier] Intérêts totaux: ${interetsTotaux.toFixed(2)}€`);
      console.log(`[Déficit foncier] Déficit HI global (après compensation): ${deficitHorsInteretsGlobal.toFixed(2)}€`);
      console.log(`[Déficit foncier] Imputable revenu global: ${deficitImputableRevenuGlobal.toFixed(2)}€ (plafonné ${taxParams.deficitFoncier.plafondImputationRevenuGlobal}€)`);
      console.log(`[Déficit foncier] Reportable sur 10 ans: ${deficitReportable.toFixed(2)}€`);
    }
    
    const revenusBIC = resultatBICGlobal >= 0 ? resultatBICGlobal : 0;
    const deficitBIC = resultatBICGlobal < 0 ? Math.abs(resultatBICGlobal) : 0;
    
    console.log(`[Consolidation] Résultat foncier global: ${resultatFoncierGlobal.toFixed(2)}€ → Revenus: ${revenusFonciers.toFixed(2)}€, Déficit: ${deficitFoncierTotal.toFixed(2)}€`);
    console.log(`[Consolidation] Résultat BIC global: ${resultatBICGlobal.toFixed(2)}€ → Revenus: ${revenusBIC.toFixed(2)}€, Déficit: ${deficitBIC.toFixed(2)}€`);
    
    return {
      revenusFonciers,
      revenusBIC,
      deficitFoncier: deficitFoncierTotal,
      deficitBIC,
      deficitImputableRevenuGlobal,  // 🆕 Déficit imputable global
      deficitReportable,             // 🆕 Déficit reportable global
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
    if (revenuImposable <= 0) {
      return {
        revenuImposable: 0,
        revenuParPart: 0,
        impotBrut: 0,
        decote: 0,
        impotNet: 0,
        tauxMoyen: 0,
        trancheMarginate: 0,
        detailsTranches: [],
      };
    }
    
    // Revenu par part
    const revenuParPart = revenuImposable / parts;
    
    // Calcul de l'impôt par tranche
    const detailsTranches: IRResult['detailsTranches'] = [];
    let impotBrut = 0;
    let trancheMarginate = 0;
    
    for (const tranche of taxParams.irBrackets) {
      const lower = tranche.lower;
      const upper = tranche.upper || Infinity;
      
      if (revenuParPart > lower) {
        const baseTrancheImposable = Math.min(revenuParPart, upper) - lower;
        const impotTranche = baseTrancheImposable * tranche.rate;
        
        detailsTranches.push({
          tranche,
          baseTrancheImposable,
          impotTranche,
        });
        
        impotBrut += impotTranche;
        trancheMarginate = tranche.rate;
      }
    }
    
    // Multiplier par le nombre de parts
    impotBrut *= parts;
    
    // Appliquer la décote si applicable
    let decote = 0;
    if (taxParams.irDecote && impotBrut > 0) {
      decote = taxParams.irDecote.formula(impotBrut, parts);
    }
    
    const impotNet = Math.max(0, impotBrut - decote);
    const tauxMoyen = revenuImposable > 0 ? impotNet / revenuImposable : 0;
    
    return {
      revenuImposable,
      revenuParPart,
      impotBrut,
      decote,
      impotNet,
      tauxMoyen,
      trancheMarginate,
      detailsTranches,
    };
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
    const abattementMicro = recettesBrutes * taxParams.micro.bicAbattement;
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

