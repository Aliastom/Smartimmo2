/**
 * Module Fiscal SmartImmo - Types & Interfaces
 * 
 * Ce module définit tous les types nécessaires pour le calcul d'impôts immobiliers
 * en France (IR, PS, micro/réel, LMNP/LMP, foncier, SCI IS, PER, déficit foncier)
 */

// ============================================================================
// TYPES DE BASE
// ============================================================================

export type TaxYear = number;
export type TaxVersion = `${TaxYear}.${number}`;

export type RegimeFiscal = 'micro' | 'reel';
export type TypeBien = 'NU' | 'LMNP' | 'LMP' | 'SCI_IS';
export type TypeTravaux = 'entretien' | 'reparation' | 'amelioration' | 'construction';

// ============================================================================
// PARAMÈTRES FISCAUX (BARÈMES)
// ============================================================================

/**
 * Tranche d'imposition IR
 */
export interface IRBracket {
  lower: number;          // Seuil inférieur (€)
  upper: number | null;   // Seuil supérieur (€) - null si tranche illimitée
  rate: number;           // Taux (0.0 à 1.0)
}

/**
 * Décote IR
 */
export interface IRDecote {
  threshold: number;                                    // Seuil de revenu (€)
  formula: (tax: number, parts: number) => number;     // Formule de calcul
}

/**
 * Paramètres du régime micro (foncier et BIC)
 */
export interface MicroRegimeParams {
  foncierAbattement: number;           // Abattement micro-foncier (ex: 0.3 = 30%)
  foncierPlafond: number;              // Plafond revenus micro-foncier (€)
  bicAbattement: number;               // Abattement micro-BIC meublé (ex: 0.5 = 50%)
  bicPlafond: number;                  // Plafond revenus micro-BIC (€)
  meubleTourismeAbattement?: number;   // Abattement meublé tourisme classé (ex: 0.71 = 71%)
  meubleTourismePlafond?: number;      // Plafond meublé tourisme (€)
}

/**
 * Paramètres du déficit foncier
 */
export interface DeficitFoncierParams {
  plafondImputationRevenuGlobal: number;  // Max imputable sur revenu global (€)
  dureeReport: number;                     // Durée de report des déficits (années)
}

/**
 * Paramètres PER (Plan Épargne Retraite)
 */
export interface PERParams {
  tauxPlafond: number;            // Taux de plafonnement (ex: 0.1 = 10% des revenus pro)
  plancherLegal: number;          // Plancher légal de déduction (€)
  dureeReportReliquats: number;   // Durée de report des reliquats (années)
}

/**
 * Critères LMP (Loueur Meublé Professionnel)
 */
export interface LMPThresholds {
  recettesMin: number;            // Recettes annuelles minimum (€)
  tauxRecettesProMin: number;     // % minimum par rapport aux revenus pro (0-1)
  inscriptionRCSObligatoire: boolean;
}

/**
 * Paramètres fiscaux complets pour une année
 */
export interface TaxParams {
  version: TaxVersion;
  year: TaxYear;
  
  // Impôt sur le revenu
  irBrackets: IRBracket[];
  irDecote?: IRDecote;
  
  // Abattement forfaitaire salaires (Article 83 CGI)
  salaryDeduction?: {
    taux: number;        // Taux d'abattement (ex: 0.10 = 10%)
    min: number;         // Minimum (€)
    max: number;         // Maximum (€)
  };
  
  // Prélèvements sociaux
  psRate: number;                     // Taux PS (ex: 0.172 = 17.2%)
  
  // Régimes micro
  micro: MicroRegimeParams;
  
  // Déficit foncier
  deficitFoncier: DeficitFoncierParams;
  
  // PER
  per: PERParams;
  
  // LMP
  lmp: LMPThresholds;
  
  // SCI à l'IS
  sciIS: {
    tauxReduit: number;            // Taux réduit IS (ex: 0.15 = 15%)
    plafondTauxReduit: number;     // Plafond pour taux réduit (€)
    tauxNormal: number;            // Taux normal IS (ex: 0.25 = 25%)
  };
  
  // Métadonnées
  source: string;                  // Source des données (ex: "DGFiP 2025")
  dateMAJ: Date;                   // Date de dernière mise à jour
  validatedBy?: string;            // Validé par (admin)
}

// ============================================================================
// INPUTS UTILISATEUR / DONNÉES AGRÉGÉES
// ============================================================================

/**
 * Informations du foyer fiscal
 */
export interface HouseholdInfo {
  salaire: number;                 // Salaire et revenus du travail (€)
  autresRevenus: number;          // Autres revenus imposables (€)
  parts: number;                   // Nombre de parts fiscales
  isCouple: boolean;               // En couple (marié/pacsé)
}

/**
 * Informations d'un bien immobilier pour calcul fiscal
 */
export interface RentalPropertyInput {
  id: string;                      // ID du bien
  nom: string;                     // Nom du bien
  type: TypeBien;                  // Type de bien (NU/LMNP/LMP/SCI_IS)
  
  // Revenus
  loyers: number;                  // Loyers encaissés (€)
  autresRevenus?: number;          // Autres revenus locatifs (€)
  
  // Charges déductibles
  charges: number;                 // Charges locatives, entretien, etc. (€)
  interets: number;                // Intérêts d'emprunt (€)
  assuranceEmprunt: number;        // Assurance emprunteur (€)
  taxeFonciere: number;            // Taxe foncière (€)
  fraisGestion: number;            // Frais de gestion/agence (€)
  assurancePNO: number;            // Assurance PNO (€)
  chargesCopro: number;            // Charges de copropriété (€)
  autresCharges: number;           // Autres charges déductibles (€)
  
  // Travaux
  travaux: {
    entretien: number;             // Travaux d'entretien/réparation déductibles (€)
    amelioration: number;          // Travaux d'amélioration capitalisables (€)
    dejaRealises: number;          // Travaux déjà réalisés cette année (€)
  };
  
  // Amortissements (LMNP/LMP réel uniquement)
  amortissements?: {
    batiment: number;              // Amortissement bâtiment (€/an)
    mobilier: number;              // Amortissement mobilier (€/an)
    fraisAcquisition: number;      // Amortissement frais d'acquisition (€/an)
  };
  
  // Régime fiscal suggéré (calculé ou choisi)
  regimeSuggere: RegimeFiscal;
  regimeChoisi?: RegimeFiscal;     // Permet de forcer un régime
  
  // 🆕 Breakdown détaillé (passé + projection)
  breakdown?: {
    passe: {
      recettes: number;              // Recettes réalisées
      chargesDeductibles: number;    // Charges déductibles réalisées
      interetsEmprunt: number;       // Intérêts d'emprunt réalisés
      nombreTransactions: number;    // Nombre de transactions
    };
    projection: {
      loyersFuturs: number;          // Loyers projetés (mois restants)
      chargesFutures: number;        // Charges projetées
      interetsEmpruntFuturs: number; // Intérêts projetés
      moisRestants: number;          // Nombre de mois à projeter
      chargesMensuelles?: number;    // 🆕 Charges qui se répètent chaque mois (pour extrapolation)
      chargesAnnuelles?: number;     // 🆕 Charges qui tombent 1 fois par an
    };
    total: {
      recettes: number;              // Total (passé + projection)
      chargesDeductibles: number;    // Total (passé + projection)
      interetsEmprunt: number;       // Total (passé + projection)
    };
  };
  
  // Société (pour SCI IS)
  societeId?: string;
  societeName?: string;
}

/**
 * Informations PER
 */
export interface PERInput {
  versementPrevu: number;          // Versement prévu pour l'année (€)
  plafondDisponible: number;       // Plafond disponible année N (€)
  reliquats: Record<number, number>; // Reliquats des 3 années précédentes (année → montant)
}

/**
 * Inputs complets pour simulation fiscale
 */
export interface FiscalInputs {
  year: TaxYear;
  foyer: HouseholdInfo;
  biens: RentalPropertyInput[];
  per?: PERInput;
  
  // Options de calcul
  options: {
    autofill: boolean;             // Activer l'autofill depuis les données SmartImmo
    baseCalcul: 'encaisse' | 'exigible';  // Base de calcul (encaissé vs exigible)
    optimiserRegimes: boolean;     // Optimiser automatiquement les régimes fiscaux
    regimeForce?: 'micro' | 'reel'; // Forcer un régime spécifique (override)
    prelevementSourceDejaPaye?: number;  // 🆕 Impôt à la source déjà payé (€)
    acomptesDejaPayes?: number;          // 🆕 Acomptes déjà payés (€)
  };
  
  // 🆕 Scope de l'agrégation (filtres optionnels)
  scope?: {
    propertyIds?: string[];        // Filtrer par IDs de biens spécifiques
    societyIds?: string[];         // Filtrer par IDs de sociétés spécifiques
  };
  
  // 🆕 Métadonnées UI (pour préserver l'état du formulaire entre changements d'onglets)
  _uiMetadata?: {
    salaryMode?: 'brut' | 'netImposable';    // Mode de saisie du salaire
    salaireBrutOriginal?: number;             // Valeur brute originale saisie par l'utilisateur
    deductionMode?: 'forfaitaire' | 'reels'; // Mode de déduction
    fraisReels?: number;                      // Frais réels si mode = 'reels'
    perEnabled?: boolean;                     // PER activé ou non
    regimeOverride?: 'auto' | 'micro' | 'reel'; // Override manuel du régime fiscal
    autofill?: boolean;                       // Autofill activé ou non
    selectedBienIds?: string[];               // IDs des biens sélectionnés pour la simulation
  };
}

// ============================================================================
// RÉSULTATS DES CALCULS
// ============================================================================

/**
 * Résultat du calcul pour un bien (par régime)
 */
export interface RentalPropertyResult {
  id: string;
  nom: string;
  type: TypeBien;
  regime: RegimeFiscal;
  regimeUtilise: RegimeFiscal;     // 🆕 Régime réellement utilisé
  regimeSuggere: RegimeFiscal;     // 🆕 Régime optimal calculé
  
  // Bases
  recettesBrutes: number;          // Recettes brutes (€)
  chargesDeductibles: number;      // Total charges déductibles (€)
  amortissements: number;          // Amortissements (€)
  
  // Résultat fiscal
  resultatFiscal: number;          // Résultat fiscal (€)
  baseImposableIR: number;         // Base imposable IR (€)
  baseImposablePS: number;         // Base imposable PS (€)
  
  // Déficit éventuel
  deficit?: number;                // Déficit (€)
  deficitImputableRevenuGlobal?: number;  // Déficit imputable revenu global (€)
  deficitReportable?: number;      // Déficit reportable (€)
  
  // Détails du calcul
  details: {
    abattement?: number;           // Abattement micro (€)
    tauxAbattement?: number;       // Taux d'abattement (0-1)
    eligibleMicro: boolean;        // Éligible au régime micro
    economieRegimeReel?: number;   // Économie en passant au réel (€)
  };
  
  // 🆕 Breakdown (passé + projection) - copié depuis l'input
  breakdown?: {
    passe: {
      recettes: number;
      chargesDeductibles: number;
      interetsEmprunt: number;
      nombreTransactions: number;
    };
    projection: {
      loyersFuturs: number;
      chargesFutures: number;
      interetsEmpruntFuturs: number;
      moisRestants: number;
      chargesMensuelles?: number;    // 🆕 Charges qui se répètent chaque mois
      chargesAnnuelles?: number;     // 🆕 Charges qui tombent 1 fois par an
    };
    total: {
      recettes: number;
      chargesDeductibles: number;
      interetsEmprunt: number;
    };
  };
}

/**
 * Résultat du calcul IR
 */
export interface IRResult {
  revenuImposable: number;         // Revenu imposable total (€)
  revenuParPart: number;           // Revenu par part (€)
  impotBrut: number;               // Impôt brut avant décote (€)
  decote: number;                  // Décote (€)
  impotNet: number;                // Impôt net après décote (€)
  tauxMoyen: number;               // Taux moyen d'imposition (0-1)
  trancheMarginate: number;        // Taux marginal d'imposition (0-1)
  
  // Détails par tranche
  detailsTranches: Array<{
    tranche: IRBracket;
    baseTrancheImposable: number;  // Part du revenu dans cette tranche (€)
    impotTranche: number;          // Impôt de cette tranche (€)
  }>;
}

/**
 * Résultat du calcul PS
 */
export interface PSResult {
  baseImposable: number;           // Base imposable PS (€)
  montant: number;                 // Montant PS (€)
  taux: number;                    // Taux appliqué (0-1)
}

/**
 * Résultat du calcul PER
 */
export interface PERResult {
  versement: number;               // Versement effectué (€)
  deductionUtilisee: number;       // Déduction utilisée (€)
  reliquatsUtilises: number;       // Reliquats utilisés (€)
  nouveauReliquat: number;         // Nouveau reliquat généré (€)
  economieIR: number;              // Économie d'IR (€)
  economiePS: number;              // Économie de PS (€)
  economieTotal: number;           // Économie totale (€)
  
  details: {
    plafondDisponible: number;     // Plafond disponible (€)
    plafondUtilise: number;        // Plafond utilisé (€)
    plafondRestant: number;        // Plafond restant (€)
    reliquatsParAnnee: Record<number, number>;  // Reliquats par année
  };
}

/**
 * Résultat de la simulation complète
 */
export interface SimulationResult {
  // Paramètres utilisés
  taxParams: TaxParams;
  inputs: FiscalInputs;
  
  // Résultats par bien
  biens: RentalPropertyResult[];
  
  // Consolidation revenus fonciers / BIC
  consolidation: {
    revenusFonciers: number;       // Revenus fonciers nets (€)
    revenusBIC: number;            // Revenus BIC nets (€)
    deficitFoncier: number;        // Déficit foncier total (€)
    deficitBIC: number;            // Déficit BIC total (€)
  };
  
  // Impôts
  ir: IRResult;
  ps: PSResult;
  per?: PERResult;
  
  // Cash-flow
  cashflow: {
    loyersBruts: number;           // Loyers bruts totaux (€)
    chargesNonFinancieres: number; // Charges hors intérêts (€)
    cashflowBrut: number;          // Cash-flow brut (€)
    interets: number;              // Intérêts d'emprunt (€)
    impots: number;                // IR + PS (€)
    cashflowNet: number;           // Cash-flow net (€)
  };
  
  // Résumés
  resume: {
    totalImpots: number;           // Total IR + PS (€)
    beneficeNetImmobilier: number; // Bénéfice net après impôts (€)
    irSupplementaire: number;      // IR supplémentaire dû aux revenus immobiliers (€)
    impotsSuppTotal: number;       // 🆕 Impôts supplémentaires TOTAUX (IR + PS) (€)
    tauxEffectif: number;          // Taux d'imposition effectif (0-1)
    rendementNet: number;          // Rendement net (0-1)
  };
  
  // Métadonnées
  dateCalcul: Date;
  dureeCalculMS: number;           // Durée du calcul (ms)
}

// ============================================================================
// OPTIMISATION FISCALE
// ============================================================================

/**
 * Stratégie de travaux (Phase 1 & Phase 2)
 */
export interface WorksStrategy {
  phase1: {
    objectif: string;              // "Ramener revenus imposables à 0€"
    montantCible: number;          // Montant de travaux nécessaire (€)
    economieIR: number;            // Économie IR (€)
    economiePS: number;            // Économie PS (€)
    economieTotal: number;         // Économie totale (€)
    ratioEconomieSurInvest: number; // Ratio € économisé / € investi
  };
  
  phase2: {
    objectif: string;              // "Créer du déficit foncier reportable"
    montantCible: number;          // Montant de travaux supplémentaire (€)
    deficitCree: number;           // Déficit créé (€)
    economieIR: number;            // Économie IR (€)
    economieTotal: number;         // Économie totale (€)
    ratioEconomieSurInvest: number;
    avertissement: string;         // "PS non impactés en Phase 2"
  };
  
  recommandation: string;          // Stratégie recommandée
  totalEconomie: number;           // Économie totale (€)
  totalInvestissement: number;     // Investissement total (€)
}

/**
 * Comparaison PER vs Travaux
 */
export interface OptimizationComparison {
  per: {
    investissement: number;        // Versement PER (€)
    economie: number;              // Économie fiscale (€)
    ratio: number;                 // Ratio € économisé / € investi
    disponibilite: string;         // "Bloqué jusqu'à la retraite"
  };
  
  travaux: {
    investissement: number;        // Montant travaux (€)
    economie: number;              // Économie fiscale (€)
    ratio: number;                 // Ratio € économisé / € investi
    disponibilite: string;         // "Valorise le patrimoine"
  };
  
  combine: {
    investissement: number;        // Total investi (€)
    economie: number;              // Économie totale (€)
    ratio: number;                 // Ratio global
    recommandation: string;        // Stratégie recommandée
  };
  
  strategyRecommendation: 'per' | 'travaux' | 'combine';
  reasoning: string;               // Explication de la recommandation
}

/**
 * Résultat de l'optimisation fiscale
 */
export interface OptimizationResult {
  simulation: SimulationResult;
  
  // Optimisation déficit foncier / travaux
  works: WorksStrategy;
  
  // Comparaison PER vs Travaux
  comparison: OptimizationComparison;
  
  // Autres optimisations suggérées
  suggestions: Array<{
    type: 'regime' | 'repartition' | 'timing' | 'structure';
    titre: string;
    description: string;
    economieEstimee: number;       // Économie estimée (€)
    complexite: 'facile' | 'moyenne' | 'difficile';
  }>;
}

// ============================================================================
// EXPORTS PDF / RAPPORTS
// ============================================================================

/**
 * Options pour l'export PDF
 */
export interface PDFExportOptions {
  includeDetails: boolean;         // Inclure détails par bien
  includeFormulas: boolean;        // Inclure formules de calcul
  includeOptimization: boolean;    // Inclure suggestions d'optimisation
  includeAssumptions: boolean;     // Inclure hypothèses utilisées
}

/**
 * Données pour le rapport PDF
 */
export interface FiscalReport {
  simulation: SimulationResult;
  optimization?: OptimizationResult;
  exportOptions: PDFExportOptions;
  generatedAt: Date;
  generatedBy?: string;
}

// ============================================================================
// HISTORIQUE & VERSIONING
// ============================================================================

/**
 * Snapshot d'une simulation (pour historique)
 */
export interface SimulationSnapshot {
  id: string;
  userId: string;
  year: TaxYear;
  simulation: SimulationResult;
  optimization?: OptimizationResult;
  createdAt: Date;
  name?: string;                   // Nom personnalisé
  notes?: string;                  // Notes utilisateur
}

/**
 * Changelog des paramètres fiscaux
 */
export interface TaxParamsChangelog {
  version: TaxVersion;
  previousVersion?: TaxVersion;
  changes: Array<{
    field: string;
    oldValue: any;
    newValue: any;
    description: string;
  }>;
  source: string;
  validatedBy?: string;
  createdAt: Date;
}

