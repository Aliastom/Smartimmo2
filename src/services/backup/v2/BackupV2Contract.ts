export const BACKUP_V2_VERSION = '2.0.0' as const;

export type BackupV2Mode = 'full-replace';
export type BackupV2Scope = 'full';
export type ChecksumAlgorithm = 'sha256';
export type BackupCompatibilityStatus =
  | 'compatible'
  | 'compatible_with_warnings'
  | 'incompatible';
export type BackupEnvironment = 'development' | 'staging' | 'production';
export type DbDatasetGroup = 'core' | 'business' | 'documents' | 'admin';
export type ObjectKind = 'document' | 'photo' | 'payment_attachment' | 'other';

export interface BackupV2CreatedBy {
  userId: string;
  email: string;
}

export interface BackupV2Includes {
  db: boolean;
  admin: boolean;
  business: boolean;
  documentsMetadata: boolean;
  documentsBinary: boolean;
}

export interface BackupV2Counts {
  tables: number;
  rows: number;
  objects: number;
  bytesDbCompressed: number;
  bytesObjects: number;
}

export interface ChecksumsV2 {
  algorithm: ChecksumAlgorithm;
  files: 'checksums.sha256';
  globalSha256: string;
}

export interface CompatibilityV2 {
  minImporterVersion: string;
  maxTestedImporterVersion: string;
  minAppVersion: string;
  requiredFeatures: string[];
  breakingFlags: string[];
}

export interface ManifestV2 {
  backupVersion: string;
  appVersion: string;
  schemaVersion: string;
  createdAt: string;
  mode: BackupV2Mode;
  scope: BackupV2Scope;
  includes: BackupV2Includes;
  counts: BackupV2Counts;
  checksums: ChecksumsV2;
  compatibility: CompatibilityV2;
  organizationId?: string;
  createdBy?: BackupV2CreatedBy;
  notes?: string;
}

export interface MetadataAppV2 {
  appName: string;
  appVersion: string;
  buildId?: string;
  environment: BackupEnvironment;
}

export interface MetadataSchemaV2 {
  schemaVersion: string;
  source: 'prisma';
  generatedAt: string;
  tables: string[];
}

export interface MetadataCompatibilityV2 extends CompatibilityV2 {}

export interface DbOrderV2 {
  version: number;
  restoreOrder: string[];
  groups?: Partial<Record<DbDatasetGroup, string[]>>;
}

export interface ObjectIndexEntryV2 {
  objectId: string;
  storageKey: string;
  relativePath: string;
  sha256: string;
  size: number;
  mime: string;
  kind: ObjectKind;
  organizationId: string;
  documentId?: string;
  filename?: string;
  hashAlgorithm?: ChecksumAlgorithm;
  sourceProvider?: 'local' | 'supabase' | 'unknown';
  linkedType?: string;
  linkedId?: string;
  createdAt?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export type ValidationSeverity = 'blocking' | 'warning';

export interface BackupV2ValidationIssue {
  code: string;
  severity: ValidationSeverity;
  path?: string;
  message: string;
  context?: Record<string, string | number | boolean | null>;
  hint?: string;
}

export interface BackupV2ValidationResult {
  status: BackupCompatibilityStatus;
  errors: BackupV2ValidationIssue[];
  warnings: BackupV2ValidationIssue[];
}
