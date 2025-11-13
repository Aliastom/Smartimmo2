/**
 * Types pour le module DedupFlow - Orchestration du flux de déduplication
 */

export interface DedupFlowInput {
  /** Type de doublon détecté */
  duplicateType: 'exact_duplicate' | 'probable_duplicate' | 'not_duplicate';
  
  /** Fichier existant trouvé */
  existingFile?: {
    id: string;
    name: string;
    uploadedAt: string;
    size: number;
    mime: string;
  };
  
  /** Fichier temporaire actuel */
  tempFile: {
    tempId: string;
    originalName: string;
    size: number;
    mime: string;
    checksum: string;
  };
  
  /** Décision de l'utilisateur */
  userDecision: 'cancel' | 'replace' | 'keep_both' | 'pending';
}

export interface DedupFlowOutput {
  /** Type de flux à exécuter */
  flow: 'upload_review' | 'replace_document' | 'cancel_upload' | 'duplicate_detection' | 'error';
  
  /** Statut de déduplication */
  duplicateStatus: 'exact_duplicate' | 'probable_duplicate' | 'not_duplicate' | 'user_forced';
  
  /** Décision de l'utilisateur */
  userDecision: 'cancel' | 'replace' | 'keep_both' | 'pending';
  
  /** Flags de contrôle */
  flags: {
    skipDuplicateCheck: boolean;
    userForcesDuplicate: boolean;
    replaceExisting: boolean;
    deleteTempFile: boolean;
  };
  
  /** Configuration UI */
  ui: {
    title: string;
    banner?: {
      type: 'info' | 'warning' | 'success' | 'error';
      text: string;
      icon: string;
    };
    suggestedFilename?: string;
    primaryAction: {
      label: string;
      action: 'confirm' | 'replace' | 'cancel';
    };
    secondaryAction?: {
      label: string;
      action: 'cancel' | 'back';
    };
    tertiaryAction?: {
      label: string;
      action: 'keep_both';
    };
  };
  
  /** Données pour l'API */
  api?: {
    endpoint: string;
    method: 'POST' | 'PUT' | 'DELETE';
    payload?: any;
  };
  
  /** Données du fichier temporaire (pour la 2ème modale) */
  tempFile?: {
    tempId: string;
    originalName: string;
    size: number;
    mime: string;
    checksum: string;
  };
  
  /** Données du fichier existant (pour la 2ème modale) */
  existingFile?: {
    id: string;
    name: string;
    uploadedAt: string;
    size: number;
    mime: string;
  };
}

export interface DedupFlowContext {
  /** Contexte du document */
  scope: 'property' | 'lease' | 'tenant' | 'global';
  scopeId?: string;
  
  /** Métadonnées du fichier */
  metadata?: {
    documentType?: string;
    extractedFields?: any;
    predictions?: any[];
  };
}

export interface DedupFlowResult {
  success: boolean;
  data?: DedupFlowOutput;
  error?: string;
  nextStep?: 'show_modal' | 'call_api' | 'redirect' | 'close';
}
