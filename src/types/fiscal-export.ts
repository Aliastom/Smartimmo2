/**
 * Types et schémas de validation pour l'export/import des paramètres fiscaux
 */

import { z } from 'zod';

// ========== SCHÉMAS DE VALIDATION ==========

export const FiscalExportMetaSchema = z.object({
  exportedAt: z.string(),
  app: z.literal('SmartImmo'),
  version: z.string(),
  checksum: z.string(),
  exportedBy: z.string().optional(),
});

export const FiscalExportVersionSchema = z.object({
  code: z.string().min(1),
  year: z.number().int().min(2020).max(2100),
  source: z.string().min(1),
  status: z.enum(['draft', 'published', 'archived']),
  notes: z.string().nullable().optional(),
});

export const FiscalExportParamsSchema = z.object({
  jsonData: z.record(z.any()),
  overrides: z.record(z.any()).nullable().optional(),
});

export const FiscalExportTypeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  category: z.enum(['FONCIER', 'BIC', 'IS']),
  description: z.string().nullable().optional(),
  isActive: z.boolean(),
});

export const FiscalExportRegimeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  appliesToIds: z.array(z.string()),
  engagementYears: z.number().int().nullable().optional(),
  eligibility: z.record(z.any()).nullable().optional(),
  calcProfile: z.enum([
    'FONCIER_MICRO',
    'FONCIER_REEL',
    'BIC_MICRO',
    'BIC_REEL',
    'IS',
  ]),
  description: z.string().nullable().optional(),
  isActive: z.boolean(),
});

export const FiscalExportCompatSchema = z.object({
  id: z.string().optional(), // Généré à l'import si absent
  scope: z.enum(['category', 'type']),
  left: z.string().min(1),
  right: z.string().min(1),
  rule: z.enum(['CAN_MIX', 'GLOBAL_SINGLE_CHOICE', 'MUTUALLY_EXCLUSIVE']),
  note: z.string().nullable().optional(),
});

export const FiscalExportDataSchema = z.object({
  version: FiscalExportVersionSchema,
  params: FiscalExportParamsSchema,
  types: z.array(FiscalExportTypeSchema).optional(),
  regimes: z.array(FiscalExportRegimeSchema).optional(),
  compat: z.array(FiscalExportCompatSchema).optional(),
});

export const FiscalExportBundleSchema = z.object({
  meta: FiscalExportMetaSchema,
  data: FiscalExportDataSchema,
});

// ========== TYPES TYPESCRIPT ==========

export type FiscalExportMeta = z.infer<typeof FiscalExportMetaSchema>;
export type FiscalExportVersion = z.infer<typeof FiscalExportVersionSchema>;
export type FiscalExportParams = z.infer<typeof FiscalExportParamsSchema>;
export type FiscalExportType = z.infer<typeof FiscalExportTypeSchema>;
export type FiscalExportRegime = z.infer<typeof FiscalExportRegimeSchema>;
export type FiscalExportCompat = z.infer<typeof FiscalExportCompatSchema>;
export type FiscalExportData = z.infer<typeof FiscalExportDataSchema>;
export type FiscalExportBundle = z.infer<typeof FiscalExportBundleSchema>;

// ========== OPTIONS D'IMPORT ==========

export const ImportStrategySchema = z.enum(['merge', 'replace']);
export const ImportModeSchema = z.enum(['validate', 'dry-run', 'apply']);

export type ImportStrategy = z.infer<typeof ImportStrategySchema>;
export type ImportMode = z.infer<typeof ImportModeSchema>;

export interface ImportOptions {
  mode: ImportMode;
  strategy: ImportStrategy;
  targetCode?: string; // Code de la version à créer/mettre à jour
  importTypes?: boolean;
  importRegimes?: boolean;
  importCompat?: boolean;
}

export interface ImportValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    version: boolean;
    params: boolean;
    typesCount: number;
    regimesCount: number;
    compatCount: number;
  };
}

export interface ImportDryRunResult extends ImportValidationResult {
  preview: {
    versionToCreate?: FiscalExportVersion;
    versionToUpdate?: { id: string; changes: string[]; oldParams?: any };
    typesToCreate: string[];
    typesToUpdate: string[];
    regimesToCreate: string[];
    regimesToUpdate: string[];
    compatToCreate: string[];
    compatToUpdate: string[];
  };
}

export interface ImportResult {
  success: boolean;
  versionId: string;
  versionCode: string;
  changes: {
    version: 'created' | 'updated';
    types: { created: number; updated: number };
    regimes: { created: number; updated: number };
    compat: { created: number; updated: number };
  };
  message: string;
}

