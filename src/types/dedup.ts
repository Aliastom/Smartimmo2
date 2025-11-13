/**
 * Types pour l'agent Dedup de Smartimmo
 * Gère la détection et la résolution des doublons de documents
 */

// ===== Entrées de l'agent =====

export interface NewFileInput {
  tempId: string;
  name: string;
  mime: string;
  size: number;
  pages: number;
  checksum: string;
  ocr: {
    chars: number;
    quality: number;
    text: string;
  };
  extracted: {
    typePredictions: Array<{
      label: string;
      score: number;
    }>;
    period?: {
      from: string;
      to: string;
    };
  };
  context: {
    propertyId?: string;
    tenant?: string;
    leaseId?: string;
    transactionId?: string;
  };
}

export interface CandidateDocument {
  id: string;
  name: string;
  uploadedAt: string;
  mime: string;
  size: number;
  pages: number;
  checksum: string;
  ocr: {
    quality: number;
    textPreview: string;
  };
  extracted: {
    type: string;
    period?: {
      from: string;
      to: string;
    };
  };
  context: {
    propertyId?: string;
    tenant?: string;
    leaseId?: string;
    transactionId?: string;
  };
  url: string;
}

export interface DedupInput {
  newFile: NewFileInput;
  candidates: CandidateDocument[];
}

// ===== Sorties de l'agent =====

export type DuplicateStatus = 'exact_duplicate' | 'probable_duplicate' | 'not_duplicate';

export type SuggestedAction = 'cancel' | 'replace' | 'keep_both';

export type QualityComparison = 'new_better' | 'existing_better' | 'equal';

export type ModalLevel = 'danger' | 'warning' | 'info';

export interface DuplicateSignals {
  checksumMatch: boolean;
  textSimilarity: number;
  samePeriod: boolean;
  sameContext: boolean;
  qualityComparison: QualityComparison;
  differences: string[];
}

export interface MatchedDocument {
  id: string;
  name: string;
  url: string;
}

export interface ModalContent {
  level: ModalLevel;
  title: string;
  message: string;
  primaryCta: {
    action: SuggestedAction;
    label: string;
  };
  secondaryCta: {
    action: SuggestedAction;
    label: string;
  };
  showComparison: boolean;
}

export interface DedupOutput {
  status: DuplicateStatus;
  matchedDocument?: MatchedDocument;
  signals: DuplicateSignals;
  suggestedAction: SuggestedAction;
  modal: ModalContent;
  // Métadonnées pour logging
  metadata?: {
    decisionReason: string;
    timestamp: string;
    processingTimeMs: number;
  };
}

// ===== Configuration =====

export interface DedupConfig {
  /** Seuil de similarité textuelle pour considérer un quasi-doublon (0-1) */
  textSimilarityThreshold: number;
  
  /** Score minimum pour valider une prédiction de type (0-1) */
  typePredictionMinScore: number;
  
  /** Activer les logs détaillés */
  enableDebugLogs: boolean;
  
  /** Langue pour les messages de la modale */
  locale: 'fr' | 'en';
}

export const DEFAULT_DEDUP_CONFIG: DedupConfig = {
  textSimilarityThreshold: 0.9,
  typePredictionMinScore: 0.6,
  enableDebugLogs: false,
  locale: 'fr',
};

