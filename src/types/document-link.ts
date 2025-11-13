/**
 * Types pour le système de liens polymorphiques des documents
 * ⚠️  NOUVELLE STRUCTURE : linkedType/linkedId au lieu de targetType/targetId/role
 */

export type DocumentLinkTarget = 
  | 'global'
  | 'property'
  | 'lease'
  | 'tenant'
  | 'transaction';

export interface DocumentContext {
  entityType: string; // 'GLOBAL' | 'PROPERTY' | 'LEASE' | 'TENANT' | 'TRANSACTION' (uppercase pour compatibilité)
  entityId?: string; // null/undefined pour GLOBAL
}

export type DedupDecision = 
  | 'link_existing'  // Lier au document existant sans créer de nouveau Document
  | 'replace'        // Créer un nouveau Document et remplacer le principal
  | 'keep_both'      // Créer un nouveau Document et garder les deux
  | 'cancel';        // Annuler l'opération

export interface DedupAction {
  decision: DedupDecision;
  matchedId?: string; // ID du document existant si doublon
  setAsPrimary?: boolean; // Pour keep_both, définir comme principal (obsolète)
}

export interface DocumentLink {
  documentId: string;
  linkedType: DocumentLinkTarget;
  linkedId: string;
}

export interface DocumentLinkWithDocument extends DocumentLink {
  document: {
    id: string;
    filenameOriginal: string;
    uploadedAt: Date;
    documentTypeId: string | null;
  };
}

/**
 * Body pour l'endpoint /api/documents/finalize
 */
export interface FinalizeDocumentRequest {
  tempId: string;
  typeCode?: string; // Code du type de document (réutilise DocumentType existant)
  context: DocumentContext;
  dedup?: DedupAction;
  customName?: string;
  userReason?: string;
}

/**
 * Valide un contexte de document
 */
export function validateDocumentContext(context: DocumentContext): { valid: boolean; error?: string } {
  if (!context.entityType) {
    return { valid: false, error: 'entityType est requis' };
  }

  const validTypes: DocumentLinkTarget[] = ['GLOBAL', 'PROPERTY', 'LEASE', 'TENANT', 'TRANSACTION'];
  if (!validTypes.includes(context.entityType)) {
    return { valid: false, error: `entityType invalide. Valeurs acceptées: ${validTypes.join(', ')}` };
  }

  if (context.entityType !== 'GLOBAL' && !context.entityId) {
    return { valid: false, error: `entityId est requis pour entityType=${context.entityType}` };
  }

  if (context.entityType === 'GLOBAL' && context.entityId) {
    return { valid: false, error: 'entityId ne doit pas être fourni pour entityType=GLOBAL' };
  }

  return { valid: true };
}

