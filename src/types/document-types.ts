import { z } from 'zod';

// Schémas de validation pour les types de documents
export const DocumentTypeSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(1, 'Code requis').max(50, 'Code trop long'),
  label: z.string().min(1, 'Libellé requis').max(100, 'Libellé trop long'),
  description: z.string().optional(),
  order: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  isSensitive: z.boolean().default(false),
  autoAssignThreshold: z.number().min(0).max(1).optional(),
  openTransaction: z.boolean().default(false),
  // JSON fields
  defaultContexts: z.any().optional(),
  suggestionsConfig: z.any().optional(),
  flowLocks: z.any().optional(),
  metaSchema: z.any().optional(),
});

export const DocumentKeywordSchema = z.object({
  id: z.string().optional(),
  keyword: z.string().min(1, 'Mot-clé requis'),
  weight: z.number().min(0).max(10).default(1),
  context: z.string().optional(),
});

export const DocumentSignalSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(1, 'Code requis'),
  label: z.string().min(1, 'Label requis'),
  weight: z.number().min(0).max(10).default(1),
  description: z.string().optional(),
  type: z.enum(['catalog', 'custom']).default('catalog'),
  pattern: z.string().optional(),
  flags: z.string().optional(),
});

export const DocumentExtractionRuleSchema = z.object({
  id: z.string().optional(),
  fieldName: z.string().min(1, 'Nom du champ requis'),
  pattern: z.string().min(1, 'Pattern regex requis'),
  postProcess: z.enum(['fr_date', 'money_eur', 'iban_norm', 'siren', 'year', 'fr_month', 'string']).optional(),
  priority: z.number().int().min(1).default(100),
});

// Types TypeScript dérivés des schémas
export type DocumentType = z.infer<typeof DocumentTypeSchema>;
export type DocumentKeyword = z.infer<typeof DocumentKeywordSchema>;
export type DocumentSignal = z.infer<typeof DocumentSignalSchema>;
export type DocumentExtractionRule = z.infer<typeof DocumentExtractionRuleSchema>;

// Types pour l'interface admin
export interface DocumentTypeWithRelations extends DocumentType {
  keywords: DocumentKeyword[];
  signals: DocumentSignal[];
  rules: DocumentExtractionRule[];
  _count?: {
    keywords: number;
    signals: number;
    rules: number;
  };
}

// Types pour les tests
export interface DocumentTestRequest {
  text?: string;
  fileId?: string;
}

export interface ClassificationResult {
  typeId: string;
  typeCode: string;
  typeLabel: string;
  score: number;
  confidence: number;
  matchedKeywords: Array<{
    keyword: string;
    weight: number;
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
  ruleUsed: string;
}

export interface DocumentTestResponse {
  classification: {
    top3: ClassificationResult[];
    autoAssigned: boolean;
    autoAssignedType?: string;
  };
  extraction: ExtractionResult[];
}

// Types pour l'import/export
export interface DocumentConfigExport {
  version: number;
  types: DocumentTypeWithRelations[];
}

export interface DocumentConfigImport {
  json: string;
  mode: 'merge' | 'overwrite';
}

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

// Types pour les options de post-processing
export const POST_PROCESS_OPTIONS = [
  { value: 'fr_date', label: 'Date française' },
  { value: 'money_eur', label: 'Montant EUR' },
  { value: 'iban_norm', label: 'IBAN normalisé' },
  { value: 'siren', label: 'SIREN' },
  { value: 'year', label: 'Année' },
  { value: 'fr_month', label: 'Mois français' },
  { value: 'string', label: 'Chaîne de caractères' },
] as const;
