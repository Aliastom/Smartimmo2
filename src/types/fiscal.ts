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
/** Identifiants `FiscalType.id` (BDD) ; `MEUBLE` = location meublée / BIC (hors 2044 foncière). */
export type TypeBien = 'NU' | 'MEUBLE' | 'LMNP' | 'LMP' | 'SCI_IS';
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
 * Décote IR — paramètres issus du JSON FiscalVersion (admin).
 * Calcul effectif : `computeIrDecoteDGFiP` (plafond − taux × impôt brut, seuils célib./couple).
 */
export interface IRDecote {
  /** Legacy / admin : souvent le seuil « célibataire » (impôt brut au-delà duquel décote = 0) */
  threshold?: number;
  seuilCelibataire?: number;
  seuilCouple?: number;
  plafondCelibataire?: number;
  plafondCouple?: number;
  taux?: number;
  /** @deprecated ancienne formule barème (non utilisée si plafonds présents) */
  facteur?: number;
  /** @deprecated omis après sérialisation JSON ; ne pas s’en servir pour le calcul */
  formula?: (tax: number, parts: number) => number;
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

  /**
   * Estimation optionnelle (JSON BDD) des déductions sociales sur pensions après abattement 10 %.
   * Aucun taux par défaut dans le code : si absent, le mode « estimé » retombe sur la saisie manuelle.
   */
  pensionSocialesDeductiblesEstime?: {
    tauxSurNetApresAbattement?: number;
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
  /**
   * Revenus d’activité **nets imposables** (après abattement 10 % si saisie brute côté UI), hors pensions
   * lorsque `pensionsBrutes` est renseigné.
   */
  salaire: number;
  autresRevenus: number;          // Autres revenus imposables (€)
  parts: number;                   // Nombre de parts fiscales
  isCouple: boolean;               // En couple (marié/pacsé)
  /**
   * Pensions **brutes** annuelles (avant abattement 10 %). Si > 0, le moteur applique brut → abattement →
   * cotisations déductibles sur cette assiette, puis additionne `salaire` + `autresRevenus` (nets imposables).
   */
  pensionsBrutes?: number;
  /**
   * Cotisations / prélèvements sociaux **déductibles sur pensions** (après abattement 10 %), en € — saisie manuelle.
   * Si `pensionsBrutes` est absent, soustraite du total (comportement historique).
   */
  cotisationsSocialesDeductibles?: number;
  /**
   * `manuel` : utilise `cotisationsSocialesDeductibles` sur la voie pensions.
   * `estime` : utilise `taxParams.pensionSocialesDeductiblesEstime.tauxSurNetApresAbattement` si défini en BDD, sinon manuel.
   */
  cotisationsPensionsMode?: 'manuel' | 'estime';
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

  /** Micro-BIC : meublé de tourisme classé → abattement majoré (ex. 71 %), sinon taux BIC standard (50 %) */
  meubleTourismeClasse?: boolean;
  
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
    // 🆕 Breakdown par catégorie de transaction
    byCategory?: {
      recettes: Record<string, { label: string; amount: number }>;
      charges: Record<string, { label: string; amount: number }>;
    };
    lmnpDebug?: {
      chargesLines: Array<{
        transactionId: string;
        bienId: string;
        date: string | null;
        moisComptable: string | null;
        libelle: string;
        categorie: string;
        nature: string;
        montant: number;
        rapprochement: 'rapprochee' | 'non_rapprochee' | 'inconnu';
        sourceMappingLmnp: string;
        bucketFiscal: 'charge_directe' | 'amortissement' | 'hors_charges';
      }>;
      totalsByCategory: Record<string, number>;
      totalsByBien: Record<string, number>;
      totalsRapprochement: {
        rapprochees: number;
        nonRapprochees: number;
      };
      totalsDirectChargesVsAmortissements: {
        chargesDirectes: number;
        amortissements: number;
      };
      perimetreDiagnostic?: {
        anneeFiscale: number;
        transactionsApresDedup: number;
        nombreRecettesSynthese: number;
        nombreDepensesSynthese: number;
        nombreLignesChargesDirectesLmnp: number;
        nombreLignesAmortissementLmnp: number;
        nombreExclusions: number;
        totalRecettesRetenues: number;
        /** € — équivalent charges déductibles issues des seules transactions (hors forfait prêt) */
        totalChargesDepensesTransactions: number;
        totalForfaitHorsTransactions: number;
        /** € — intérêts+assurance fusionnés dans le moteur (calculateLoanInterests) */
        montantInteretsEmpruntHorsTransactions: number;
        montantAmortissementsComptablesHorsTransactions: number;
        /** Cotisations charges simulateur : charges (ID) + prêt — même base que la ligne « Charges déductibles » */
        chargesFromTransactionsCents: number;
        chargesOutsideTransactionsCents: number;
        chargesTotalSimulatorCents: number;
        outsideTransactionsBreakdown: {
          loanInterestsCents: number;
          loanInsuranceCents: number;
          forfaitOrCalculatedChargesCents: number;
          /** Écart résiduel ou méthode emprunt ≠ échéancier */
          otherCents: number;
        };
        exclusionsDetaillees: Array<{ id: string; label: string; amountAbs: number; reason: string }>;
        auditParTransaction: Array<{
          transactionId: string;
          label: string;
          statut: string;
          detail: string;
        }>;
      };
    };
  };
  
  // Société (pour SCI IS)
  societeId?: string;
  societeName?: string;

  // Ventilation declarative 2044 par bien
  declaration2044?: Fiscal2044PropertySummary;
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
    prelevementSourceDejaPaye?: number;  // Impôt à la source déjà payé (€)
    acomptesDejaPayes?: number;          // Acomptes déjà payés (€)
    // Pilotage PAS & acomptes DGFiP
    currentPersonalizedRate?: number | null;   // Taux personnalisé actuel (%)
    currentDgfipAdvanceAmount?: number | null;  // Acompte DGFiP actuel (€)
    currentAdvanceFrequency?: 'monthly' | 'quarterly' | null;  // Périodicité
    withholdingGoal?: 'avoid_catchup' | 'smooth_cashflow' | 'keep_cash' | null;  // Objectif
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
    baremeCode?: string;                     // Code barème (session fiscale, ex: "2026.1")
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
    // 🆕 Breakdown par catégorie de transaction
    byCategory?: {
      recettes: Record<string, { label: string; amount: number }>;
      charges: Record<string, { label: string; amount: number }>;
    };
    lmnpDebug?: {
      chargesLines: Array<{
        transactionId: string;
        bienId: string;
        date: string | null;
        moisComptable: string | null;
        libelle: string;
        categorie: string;
        nature: string;
        montant: number;
        rapprochement: 'rapprochee' | 'non_rapprochee' | 'inconnu';
        sourceMappingLmnp: string;
        bucketFiscal: 'charge_directe' | 'amortissement' | 'hors_charges';
      }>;
      totalsByCategory: Record<string, number>;
      totalsByBien: Record<string, number>;
      totalsRapprochement: {
        rapprochees: number;
        nonRapprochees: number;
      };
      totalsDirectChargesVsAmortissements: {
        chargesDirectes: number;
        amortissements: number;
      };
      perimetreDiagnostic?: {
        anneeFiscale: number;
        transactionsApresDedup: number;
        nombreRecettesSynthese: number;
        nombreDepensesSynthese: number;
        nombreLignesChargesDirectesLmnp: number;
        nombreLignesAmortissementLmnp: number;
        nombreExclusions: number;
        totalRecettesRetenues: number;
        totalChargesDepensesTransactions: number;
        totalForfaitHorsTransactions: number;
        montantInteretsEmpruntHorsTransactions: number;
        montantAmortissementsComptablesHorsTransactions: number;
        chargesFromTransactionsCents: number;
        chargesOutsideTransactionsCents: number;
        chargesTotalSimulatorCents: number;
        outsideTransactionsBreakdown: {
          loanInterestsCents: number;
          loanInsuranceCents: number;
          forfaitOrCalculatedChargesCents: number;
          otherCents: number;
        };
        exclusionsDetaillees: Array<{ id: string; label: string; amountAbs: number; reason: string }>;
        auditParTransaction: Array<{
          transactionId: string;
          label: string;
          statut: string;
          detail: string;
        }>;
      };
    };
  };

  // Ventilation declarative 2044 par bien (copiee depuis l'input)
  declaration2044?: Fiscal2044PropertySummary;
}

export interface Fiscal2044Lines {
  '211': number;
  '212': number;
  '213': number;
  '215': number;
  '221': number;
  '222': number;
  '223': number;
  '224': number;
  '225': number;
  '226': number;
  '227': number;
  '229': number;
  '230': number;
  '420': number;
}

export interface Fiscal2044Ambiguity {
  transactionId: string;
  label: string;
  amount: number;
  reason: string;
  categoryLabel?: string;
  categorySlug?: string;
  fiscalLineHint?: string | null;
}

export interface Fiscal2044Quality {
  missingHintCount: number;
  unmappedCount: number;
  ambiguousTransactions: Fiscal2044Ambiguity[];
}

/** Ambiguïté sur un prêt (hors transactions) — affichage déclaratif / qualité. */
export interface Fiscal2044LoanInterestAmbiguity {
  loanId: string;
  loanLabel: string;
  reason: string;
}

/** Détail des intérêts (et assurance emprunteur) issus de l'échéancier pour une année civile. */
export interface Fiscal2044LoanInterestPerLoan {
  loanId: string;
  label: string;
  /** Somme des `paymentInterest` des échéances de l'année (hors capital). */
  interetsPayesAnnee: number;
  assurancePayeeAnnee: number;
  nombreEcheancesDansAnnee: number;
  source: 'echeancier_amortissement';
}

export interface Fiscal2044InteretsEmpruntAnnuel {
  annee: number;
  /** Intérêts uniquement (assurance exclue de ce total). */
  totalInteretsEmprunt: number;
  totalAssuranceEmprunteur: number;
  byLoan: Fiscal2044LoanInterestPerLoan[];
  ambiguities: Fiscal2044LoanInterestAmbiguity[];
}

export type Fiscal2044DeclarativeMissingKey = 'bail' | 'dateAcquisition' | 'lots';

/** Données d'affichage déclaratif (ne pilote pas les calculs IR/PS). */
export interface Fiscal2044InformationsBien {
  adresseFormatee: string | null;
  locatairesNoms: string[];
  dateAcquisition: string | null;
  /** Indicatif pièces (modèle bien) — non équivalent à un lot de copropriété. */
  nombrePiecesOuLotsIndicatif: number | null;
  nombreBauxSurAnnee: number;
  missingDeclarative: Fiscal2044DeclarativeMissingKey[];
}

/** Détails UI (non fiscaux) pour expliquer certaines lignes 2044 dans la modal par bien. */
export interface Fiscal2044UiLineMatchInfo {
  count: number;
  /** Libellés transaction retenus pour la modal (max 2, purement UI). */
  labels: string[];
}

export type Fiscal2044UiHintLine = '211' | '221' | '222' | '223' | '224' | '225' | '227' | '230';

/** Trace UI des transactions réellement retenues pour une ligne 2044 (sans impact fiscal). */
export interface Fiscal2044UiLineUsageTrace {
  transactionIds: string[];
  labels: string[];
  duplicateIds: string[];
  amountFromTransactions: number;
  /** Ligne calculée fiscalement (sans source transactionnelle). */
  isSynthetic?: boolean;
  /** Nombre d'unités fiscales associées à la ligne synthétique (ex: nb lots loués). */
  syntheticUnits?: number;
  /** Détail unitaire par transaction retenue (pour UI de transparence). */
  transactionItems?: Array<{
    id: string;
    label: string;
    amount: number;
    isSynthetic?: boolean;
  }>;
}

/** Restitution UI par ligne 2044 (sans impact sur le calcul fiscal). */
export interface Fiscal2044UiDelegatedHints {
  byFiscalLine: Record<Fiscal2044UiHintLine, Fiscal2044UiLineMatchInfo>;
}

export interface Fiscal2044PropertySummary {
  propertyId: string;
  year: number;
  lines: Fiscal2044Lines;
  quality: Fiscal2044Quality;
  /** Intérêts payés sur l'année civile (échéancier), détail par prêt et ambiguïtés. */
  interetsEmpruntAnnee?: Fiscal2044InteretsEmpruntAnnuel;
  /** Locataire(s), adresse, acquisition, pièces — restitution déclarative uniquement. */
  informationsBien?: Fiscal2044InformationsBien;
  /** Indications UI des sous-textes par ligne 2044 (affichage modal uniquement). */
  uiDelegatedHints?: Fiscal2044UiDelegatedHints;
  /** Trace des transactions réellement ventilées par ligne 2044 (source de vérité UI). */
  uiLineUsageTrace?: Partial<Record<Fiscal2044UiHintLine, Fiscal2044UiLineUsageTrace>>;
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
    /** Case 4BA (somme des résultats fiscaux par bien, en sortie moteur). */
    revenusFonciers4BA?: number;
    revenusBIC: number;            // Revenus BIC nets (€)
    deficitFoncier: number;        // Déficit foncier total (€)
    deficitBIC: number;            // Déficit BIC total (€)
    /** Écart arrondi corrigé automatiquement sur 4BA (en €). */
    deltaArrondi4BA?: number;
    /** Détail moteur par bien (source debug / explicabilité). */
    detailsParBien?: Array<{
      id: string;
      nom: string;
      type: string;
      resultatFiscal: number;
      resultatFiscalCentimes: number;
    }>;
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

