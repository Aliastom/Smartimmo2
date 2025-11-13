import { z } from 'zod';

// DocumentType schemas
export const DocumentTypeSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(1, 'Le code est requis'),
  label: z.string().min(1, 'Le label est requis'),
  description: z.string().optional(),
  icon: z.string().optional(),
  isSystem: z.boolean().default(false),
  isActive: z.boolean().default(true),
  order: z.number().optional().default(0),
  isSensitive: z.boolean().default(false),
  autoAssignThreshold: z.number().min(0).max(1).optional(),
  defaultContexts: z.string().optional(),
  suggestionConfig: z.string().optional(),
  lockInFlows: z.string().optional(),
  metadataSchema: z.string().optional(),
  openTransaction: z.boolean().default(false),
});

export const DocumentKeywordSchema = z.object({
  id: z.string().optional(),
  documentTypeId: z.string(),
  keyword: z.string().min(1, 'Le mot-clé est requis'),
  weight: z.number().min(0).max(10).default(1.0),
  context: z.string().optional(),
});

export const DocumentSignalSchema = z.object({
  id: z.string().optional(),
  documentTypeId: z.string(),
  code: z.string().min(1, 'Le code du signal est requis'),
  label: z.string().min(1, 'Le label est requis'),
  weight: z.number().min(0).max(10).default(1.0),
  description: z.string().optional(),
});

export const DocumentExtractionRuleSchema = z.object({
  id: z.string().optional(),
  documentTypeId: z.string(),
  fieldName: z.string().min(1, 'Le nom du champ est requis'),
  pattern: z.string().min(1, 'Le pattern regex est requis'),
  postProcess: z.string().optional(),
  priority: z.number().default(100),
  description: z.string().optional(),
});

// Test schemas
export const DocumentTestSchema = z.object({
  text: z.string().optional(),
  fileId: z.string().optional(),
}).refine(data => data.text || data.fileId, {
  message: "Au moins un champ 'text' ou 'fileId' est requis"
});

// Import/Export schemas
export const DocumentConfigExportSchema = z.object({
  documentTypes: z.array(DocumentTypeSchema),
  keywords: z.array(DocumentKeywordSchema),
  signals: z.array(DocumentSignalSchema),
  extractionRules: z.array(DocumentExtractionRuleSchema),
  version: z.string(),
  exportedAt: z.string(),
});

// API Response types
export interface DocumentTypeWithMeta {
  id: string;
  code: string;
  label: string;
  description?: string;
  icon?: string;
  isSystem: boolean;
  isActive: boolean;
  order: number;
  isSensitive: boolean;
  autoAssignThreshold?: number;
  defaultContexts?: string;
  suggestionConfig?: string;
  lockInFlows?: string;
  metadataSchema?: string;
  openTransaction?: boolean;
  createdAt: string;
  updatedAt: string;
  _count: {
    keywords: number;
    signals: number;
    extractionRules: number;
    documents: number;
  };
}

export interface DocumentTypeDetail extends Omit<DocumentTypeWithMeta, '_count'> {
  keywords: Array<{
    id: string;
    keyword: string;
    weight: number;
    context?: string;
  }>;
  signals: Array<{
    id: string;
    code: string;
    label: string;
    weight: number;
    description?: string;
  }>;
  extractionRules: Array<{
    id: string;
    fieldName: string;
    pattern: string;
    postProcess?: string;
    priority: number;
    description?: string;
  }>;
}

export interface ClassificationResult {
  typeId: string;
  typeCode: string;
  typeLabel: string;
  confidence: number;
  matchedKeywords: Array<{
    keyword: string;
    weight: number;
    context?: string;
  }>;
  matchedSignals: Array<{
    code: string;
    label: string;
    weight: number;
  }>;
}

export interface ExtractionResult {
  fieldName: string;
  value: string;
  confidence: number;
  ruleId: string;
  rulePattern: string;
}

export interface TestResult {
  top3: ClassificationResult[];
  fieldsPreview: ExtractionResult[];
}

// Types for form handling
export type DocumentTypeFormData = z.infer<typeof DocumentTypeSchema>;
export type DocumentTypeAdmin = DocumentTypeFormData; // Alias pour compatibilité
export type DocumentKeywordFormData = z.infer<typeof DocumentKeywordSchema>;
export type DocumentSignalFormData = z.infer<typeof DocumentSignalSchema>;
export type DocumentExtractionRuleFormData = z.infer<typeof DocumentExtractionRuleSchema>;
export type DocumentTestFormData = z.infer<typeof DocumentTestSchema>;
export type DocumentConfigExportData = z.infer<typeof DocumentConfigExportSchema>;
