import { z } from 'zod';

// ===== OCR Status =====
export const OcrStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  SUCCESS: 'success',
  FAILED: 'failed',
} as const;

export type OcrStatusType = typeof OcrStatus[keyof typeof OcrStatus];

// ===== Reminder Kinds =====
export const ReminderKind = {
  INSURANCE_EXPIRY: 'INSURANCE_EXPIRY',
  TAX_PAYMENT: 'TAX_PAYMENT',
  DPE_EXPIRY: 'DPE_EXPIRY',
  LEASE_END: 'LEASE_END',
  DOCUMENT_RENEWAL: 'DOCUMENT_RENEWAL',
  CUSTOM: 'CUSTOM',
} as const;

export type ReminderKindType = typeof ReminderKind[keyof typeof ReminderKind];

// ===== Reminder Status =====
export const ReminderStatus = {
  OPEN: 'open',
  DONE: 'done',
  DISMISSED: 'dismissed',
  SNOOZED: 'snoozed',
} as const;

export type ReminderStatusType = typeof ReminderStatus[keyof typeof ReminderStatus];

// ===== Field Data Types =====
export const FieldDataType = {
  DATE: 'date',
  MONEY: 'money',
  STRING: 'string',
  INT: 'int',
  IBAN: 'iban',
  SIREN: 'siren',
  SIRET: 'siret',
  ADDRESS: 'address',
  EMAIL: 'email',
  PHONE: 'phone',
} as const;

export type FieldDataTypeType = typeof FieldDataType[keyof typeof FieldDataType];

// ===== Post Process Types =====
export const PostProcessType = {
  FR_DATE: 'fr_date',
  MONEY_EUR: 'money_eur',
  IBAN: 'iban',
  SIREN: 'siren',
  SIRET: 'siret',
  ADDRESS: 'address',
  EMAIL: 'email',
  PHONE: 'phone',
} as const;

export type PostProcessTypeType = typeof PostProcessType[keyof typeof PostProcessType];

// ===== Document Types =====
export interface DocumentType {
  id: string;
  code: string;
  label: string;
  description?: string | null;
  icon?: string | null;
  isSystem: boolean;
  isActive: boolean;
  order?: number | null;
  isSensitive: boolean;
  defaultContexts?: string | null;
  suggestionConfig?: string | null;
  lockInFlows?: string | null;
  metadataSchema?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentTypeWithRelations extends DocumentType {
  fields: DocumentTypeField[];
  rules: DocumentExtractionRule[];
  keywords: DocumentKeyword[];
}

export interface DocumentTypeField {
  id: string;
  documentTypeId: string;
  name: string;
  dataType: FieldDataTypeType;
  isRequired: boolean;
  label?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentExtractionRule {
  id: string;
  documentTypeId: string;
  fieldName: string;
  pattern: string;
  postProcess?: PostProcessTypeType | null;
  priority: number;
  description?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentKeyword {
  id: string;
  documentTypeId: string;
  keyword: string;
  weight: number;
  context?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ===== Document =====
export interface Document {
  id: string;
  ownerId: string;
  bucketKey: string;
  filenameOriginal: string;
  filenameNormalized?: string | null;
  fileName: string;
  mime: string;
  fileSha256?: string | null;
  size: number;
  url: string;
  previewUrl?: string | null;
  documentTypeId?: string | null;
  typeConfidence?: number | null;
  typeAlternatives?: string | null;
  ocrStatus: OcrStatusType;
  ocrError?: string | null;
  indexed: boolean;
  tagsJson?: string | null;
  tags?: string | null;
  metadata?: string | null;
  propertyId?: string | null;
  transactionId?: string | null;
  leaseId?: string | null;
  loanId?: string | null;
  tenantId?: string | null;
  deletedAt?: Date | null;
  deletedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentWithRelations extends Document {
  documentType?: DocumentType | null;
  fields: DocumentField[];
  textIndex: DocumentTextIndex[];
  reminders: Reminder[];
}

export interface DocumentField {
  id: string;
  documentId: string;
  fieldName: string;
  valueText?: string | null;
  valueNum?: number | null;
  valueDate?: Date | null;
  confidence?: number | null;
  sourceRuleId?: string | null;
  metadata?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentTextIndex {
  documentId: string;
  page: number;
  content: string;
  metadata?: string | null;
  createdAt: Date;
}

export interface Reminder {
  id: string;
  ownerId: string;
  documentId?: string | null;
  kind: ReminderKindType;
  title: string;
  description?: string | null;
  dueDate: Date;
  alertDays?: string | null;
  autoCreated: boolean;
  status: ReminderStatusType;
  snoozedUntil?: Date | null;
  metadata?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ===== Classification Result =====
export interface ClassificationScore {
  typeId: string;
  typeCode: string;
  typeLabel: string;
  confidence: number;
}

export interface ClassificationResult {
  suggested: ClassificationScore | null;
  alternatives: ClassificationScore[];
  autoAssigned: boolean;
}

// ===== DTOs (Zod Schemas) =====

// Document Upload
export const DocumentUploadSchema = z.object({
  files: z.array(z.any()), // File objects
  propertyId: z.string().optional(),
  leaseId: z.string().optional(),
  tenantId: z.string().optional(),
  transactionId: z.string().optional(),
  loanId: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export type DocumentUploadInput = z.infer<typeof DocumentUploadSchema>;

// Document Update
export const DocumentUpdateSchema = z.object({
  documentTypeId: z.string().optional(),
  filenameNormalized: z.string().optional(),
  tags: z.array(z.string()).optional(),
  propertyId: z.string().nullable().optional(),
  leaseId: z.string().nullable().optional(),
  tenantId: z.string().nullable().optional(),
  transactionId: z.string().nullable().optional(),
  loanId: z.string().nullable().optional(),
  metadata: z.record(z.any()).optional(),
});

export type DocumentUpdateInput = z.infer<typeof DocumentUpdateSchema>;

// Document Search
export const DocumentSearchSchema = z.object({
  query: z.string().optional(),
  type: z.string().optional(),
  propertyId: z.string().optional(),
  leaseId: z.string().optional(),
  tenantId: z.string().optional(),
  transactionId: z.string().optional(),
  loanId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  dateFrom: z.string().or(z.date()).optional(),
  dateTo: z.string().or(z.date()).optional(),
  includeDeleted: z.boolean().optional(),
  scope: z.enum(['general', 'property', 'lease', 'tenant', 'transaction', 'loan']).optional(),
  limit: z.number().int().positive().optional().default(50),
  offset: z.number().int().nonnegative().optional().default(0),
});

export type DocumentSearchInput = z.infer<typeof DocumentSearchSchema>;

// Field Extraction Input
export const FieldExtractionInputSchema = z.object({
  fieldName: z.string(),
  valueText: z.string().optional(),
  valueNum: z.number().optional(),
  valueDate: z.date().optional(),
  confidence: z.number().min(0).max(1).optional(),
  sourceRuleId: z.string().optional(),
});

export type FieldExtractionInput = z.infer<typeof FieldExtractionInputSchema>;

// Reminder Creation
export const ReminderCreateSchema = z.object({
  documentId: z.string().optional(),
  kind: z.nativeEnum(ReminderKind),
  title: z.string().min(1),
  description: z.string().optional(),
  dueDate: z.date().or(z.string()),
  alertDays: z.array(z.number()).optional(),
  metadata: z.record(z.any()).optional(),
});

export type ReminderCreateInput = z.infer<typeof ReminderCreateSchema>;

// Reminder Update
export const ReminderUpdateSchema = z.object({
  status: z.nativeEnum(ReminderStatus).optional(),
  snoozedUntil: z.date().or(z.string()).nullable().optional(),
  dueDate: z.date().or(z.string()).optional(),
  title: z.string().optional(),
  description: z.string().optional(),
});

export type ReminderUpdateInput = z.infer<typeof ReminderUpdateSchema>;

// OCR Result
export interface OcrResult {
  text: string;
  pages: Array<{
    pageNumber: number;
    text: string;
    confidence?: number;
    metadata?: Record<string, any>;
  }>;
  metadata?: Record<string, any>;
}

// Extraction Result
export interface ExtractionResult {
  fields: Array<{
    fieldName: string;
    valueText?: string;
    valueNum?: number;
    valueDate?: Date;
    confidence?: number;
    sourceRuleId?: string;
  }>;
  metadata?: Record<string, any>;
}

// Job Status
export interface JobStatus {
  documentId: string;
  jobType: 'ocr' | 'classify' | 'extract' | 'index' | 'reminders' | 'gc';
  status: 'pending' | 'processing' | 'success' | 'failed';
  progress?: number;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

// Document with full details for UI
export interface DocumentDetail extends DocumentWithRelations {
  classification?: ClassificationResult;
  extractedFields: Array<DocumentField & {
    displayValue: string;
    fieldLabel?: string;
    dataType: FieldDataTypeType;
  }>;
  linkedEntities: {
    property?: { id: string; name: string; address: string } | null;
    lease?: { id: string; startDate: Date; rentAmount: number } | null;
    tenant?: { id: string; firstName: string; lastName: string } | null;
    transaction?: { id: string; label: string; amount: number; date: Date } | null;
    loan?: { id: string; bankName: string; loanAmount: number } | null;
  };
  downloadUrl: string;
  canDelete: boolean;
  canEdit: boolean;
}

// Bulk operations
export const BulkDocumentOperationSchema = z.object({
  documentIds: z.array(z.string()).min(1),
  operation: z.enum(['delete', 'update_type', 'add_tags', 'remove_tags', 'restore']),
  data: z.record(z.any()).optional(),
});

export type BulkDocumentOperationInput = z.infer<typeof BulkDocumentOperationSchema>;

