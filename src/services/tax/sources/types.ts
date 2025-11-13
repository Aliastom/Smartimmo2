/**
 * Types pour le scraping des sources fiscales officielles
 */

/**
 * Sections fiscales disponibles
 */
export type TaxSection = 
  | 'IR'          // Impôt sur le revenu (barème)
  | 'IR_DECOTE'   // Décote IR
  | 'PS'          // Prélèvements sociaux
  | 'MICRO'       // Régimes micro (BIC/Foncier)
  | 'DEFICIT'     // Déficit foncier
  | 'PER'         // Plan d'épargne retraite
  | 'SCI_IS';     // SCI à l'IS

/**
 * Sources officielles
 */
export type TaxSource = 
  | 'BOFIP'           // Bulletin Officiel des Finances Publiques
  | 'DGFIP'           // Direction Générale des Finances Publiques
  | 'SERVICE_PUBLIC'  // Service-Public.fr
  | 'LEGIFRANCE';     // Legifrance

/**
 * Niveau de confiance dans les données extraites
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

/**
 * Métadonnées d'une extraction
 */
export interface TaxSourceMeta {
  source: TaxSource;
  url: string;
  fetchedAt: Date;
  hash: string;           // SHA256 du contenu brut
  confidence: ConfidenceLevel;
  notes?: string;         // Notes complémentaires
}

/**
 * Données partielles extraites d'une source
 */
export interface TaxPartial {
  section: TaxSection;
  data: any;              // Données spécifiques à la section
  meta: TaxSourceMeta;
}

/**
 * Paramètres fiscaux normalisés complets
 */
export interface NormalizedTaxParams {
  year: number;
  
  // Barèmes IR
  irBrackets?: Array<{
    lower: number;
    upper: number | null;
    rate: number;
  }>;
  
  // Décote IR
  irDecote?: {
    seuilCelibataire: number;
    seuilCouple: number;
    facteur: number;
  };
  
  // 🆕 Abattement forfaitaire salaires (Article 83 CGI)
  salaryDeduction?: {
    taux: number;        // 0.10 (10%)
    min: number;         // 472 € (2025)
    max: number;         // 13 522 € (2025)
  };
  
  // Prélèvements sociaux
  psRate?: number;
  
  // Régimes micro
  micro?: {
    foncier: {
      plafond: number;
      abattement: number;
    };
    bic: {
      vente: { plafond: number; abattement: number };
      services: { plafond: number; abattement: number };
    };
  };
  
  // Déficit foncier
  deficitFoncier?: {
    plafondImputationRevenuGlobal: number;
    reportYears: number;
  };
  
  // PER
  per?: {
    plafondBase: number;
    plafondMaxPASSMultiple: number;
  };
  
  // SCI à l'IS
  sciIS?: {
    tauxReduit: number;
    plafondTauxReduit: number;
    tauxNormal: number;
  };
}

/**
 * État de complétude d'une section
 */
export type CompletenessStatus = 'ok' | 'missing' | 'invalid';

/**
 * Rapport de complétude par section
 */
export interface SectionCompleteness {
  status: CompletenessStatus;
  source?: TaxSource;
  url?: string;
  reason?: string;
  validationErrors?: string[];
}

/**
 * Rapport de complétude complet
 */
export type CompletenessReport = Record<TaxSection, SectionCompleteness>;

/**
 * Résultat de fusion des données partielles
 */
export interface MergeResult {
  params: NormalizedTaxParams;
  provenance: Record<TaxSection, TaxSourceMeta[]>;
  warnings: string[];
  completeness: CompletenessReport;
}

/**
 * Résultat de validation
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Différence entre deux paramètres
 */
export interface ParamDiff {
  path: string;
  before: any;
  after: any;
}

/**
 * Snapshot de source sauvegardé en DB
 */
export interface TaxSourceSnapshotData {
  id?: string;
  year: number;
  section: TaxSection;
  source: TaxSource;
  url: string;
  fetchedAt: Date;
  hash: string;
  payload: any;         // Payload brut (HTML, JSON, etc.)
}

/**
 * État d'un job de scraping
 */
export type JobState = 
  | 'pending'
  | 'fetching'
  | 'parsing'
  | 'merging'
  | 'validating'
  | 'comparing'
  | 'creating-draft'
  | 'completed'
  | 'failed';

/**
 * Résultat d'un job de scraping
 */
export interface ScrapeJobResult {
  jobId: string;
  state: JobState;
  progress?: number;        // 0-100
  currentStep?: string;
  logs?: string[];
  
  // Résultat final
  status?: 'no-change' | 'draft-created' | 'incomplete' | 'partial-merge' | 'error';
  draftCode?: string;       // Code de la version draft créée
  changes?: ParamDiff[];
  warnings?: string[];
  error?: string;
  
  // Rapport de complétude
  completeness?: CompletenessReport;
  sectionsOk?: number;
  sectionsMissing?: number;
  sectionsInvalid?: number;
  
  // Scores de confiance (système OpenFisca + consensus)
  confidence?: Record<TaxSection, number>;
  blocking?: TaxSection[]; // Sections bloquantes (confiance insuffisante)
  sources?: Record<TaxSection, string>; // Source choisie par section
  
  // Observabilité par adapter
  adapterMetrics?: Array<{
    adapter: string;
    url: string;
    httpStatus?: number;
    bytes?: number;
    durationMs?: number;
    error?: string;
  }>;
}

/**
 * Configuration de rate limiting
 */
export interface RateLimitConfig {
  requestsPerSecond: number;
  maxRetries: number;
  retryDelayMs: number;
  backoffMultiplier: number;
  circuitBreakerThreshold: number;
}

/**
 * Configuration de cache
 */
export interface CacheConfig {
  enabled: boolean;
  ttlHours: number;
  directory: string;
}

