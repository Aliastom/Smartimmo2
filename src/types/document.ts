export interface DocumentType {
  id: string;
  code: string;
  label: string;
  icon?: string;
  isSystem: boolean;
  isActive: boolean;
  order?: number;
  isSensitive: boolean;
  defaultContexts: string[];
  suggestionConfig?: DocumentSuggestionConfig;
  lockInFlows: string[];
  metadataSchema?: DocumentMetadataSchema;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentSuggestionRule {
  pattern: string;
  apply_in: string[];
  mime_in?: string[];
  ocr_keywords?: string[];
  weight: number;
  type_code: string;
  lock: boolean;
}

export interface DocumentSuggestionConfig {
  rules: DocumentSuggestionRule[];
  defaults_by_context?: Record<string, string>;
  mime_overrides?: Record<string, string>;
  postprocess?: {
    min_confidence_for_autoselect?: number;
    ask_top3_below?: number;
  };
}

export interface DocumentMetadataSchema {
  type: "object";
  properties: Record<string, {
    type: string;
    title: string;
    description?: string;
    enum?: string[];
    format?: string;
    required?: boolean;
  }>;
  required?: string[];
}

export interface DocumentTypeCreateData {
  code: string;
  label: string;
  icon?: string;
  order?: number;
  isSensitive?: boolean;
  defaultContexts?: string[];
  suggestionConfig?: DocumentSuggestionConfig;
  lockInFlows?: string[];
  metadataSchema?: DocumentMetadataSchema;
}

export interface DocumentTypeUpdateData {
  label?: string;
  icon?: string;
  order?: number;
  isSensitive?: boolean;
  defaultContexts?: string[];
  suggestionConfig?: DocumentSuggestionConfig;
  lockInFlows?: string[];
  metadataSchema?: DocumentMetadataSchema;
}

export interface Document {
  id: string;
  fileName: string;
  mime: string;
  size: number;
  url: string;
  sha256?: string;
  docType: string;
  type: string;
  tagsJson?: string;
  metadata?: string;
  documentTypeId: string;
  propertyId?: string;
  transactionId?: string;
  leaseId?: string;
  loanId?: string;
  createdAt: string;
  updatedAt: string;
  
  // Relations
  documentType?: DocumentType;
  property?: {
    id: string;
    name: string;
  };
  transaction?: {
    id: string;
    label: string;
  };
  lease?: {
    id: string;
    tenant?: {
      firstName: string;
      lastName: string;
    };
  };
  loan?: {
    id: string;
    bankName: string;
  };
}

export interface DocumentFilters {
  propertyId?: string;
  leaseId?: string;
  tenantId?: string;
  loanId?: string;
  documentTypeId?: string;
  typeCode?: string;
  docType?: string;
  type?: string;
  q?: string; // search query
  page?: number;
  pageSize?: number;
}

export interface DocumentUploadData {
  propertyId?: string;
  leaseId?: string;
  tenantId?: string;
  loanId?: string;
  documentTypeId: string;
  file: {
    name: string;
    mime: string;
    size: number;
    base64: string;
  };
  metadata?: Record<string, any>;
}

