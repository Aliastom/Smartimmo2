import AdmZip from 'adm-zip';
import { createHash } from 'crypto';
import { gunzipSync } from 'zlib';
import {
  BACKUP_V2_VERSION,
  BackupCompatibilityStatus,
  BackupV2ValidationIssue,
  BackupV2ValidationResult,
  ChecksumsV2,
  DbOrderV2,
  ManifestV2,
  ObjectIndexEntryV2,
} from './BackupV2Contract';
import { dbExportPlanner } from './DbExportPlanner';

interface ValidateChecksumsInput {
  checksumsFileContent: string;
  fileContents: Record<string, Buffer>;
  expectedGlobalSha256: string;
}

interface ValidateDatasetsInput {
  datasetFiles: Record<string, Buffer>;
  expectedDatasets: string[];
}

export interface ValidateRestoreV2ArchiveOutput {
  validation: BackupV2ValidationResult;
  manifest: ManifestV2 | null;
  dbOrder: DbOrderV2 | null;
  archiveFilePaths: string[];
  datasetFilesByPath: Record<string, Buffer>;
  datasetFilesByName: Record<string, Buffer>;
  objectFilePaths: string[];
  objectIndexEntries: ObjectIndexEntryV2[];
}

const MANDATORY_ARCHIVE_PATHS = [
  'manifest.v2.json',
  'checksums.sha256',
  'metadata/app.json',
  'metadata/schema.json',
  'metadata/compatibility.json',
  'db/order.json',
] as const;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const SHA256_RE = /^[a-f0-9]{64}$/i;
const SEMVER_RE = /^\d+\.\d+\.\d+(?:[-+][a-z0-9.-]+)?$/i;

export class BackupV2Validator {
  validateArchiveForDbRestore(zipBuffer: Buffer): ValidateRestoreV2ArchiveOutput {
    const zip = new AdmZip(zipBuffer);
    const normalizedEntries = zip
      .getEntries()
      .map((entry) => entry.entryName.replace(/^\/+/, ''))
      .filter((entry) => entry.length > 0);

    const fileContents: Record<string, Buffer> = {};
    for (const entry of zip.getEntries()) {
      const entryName = entry.entryName.replace(/^\/+/, '');
      if (!entryName || entry.isDirectory) continue;
      fileContents[entryName] = entry.getData();
    }

    const datasetFilesByPath: Record<string, Buffer> = {};
    const datasetFilesByName: Record<string, Buffer> = {};
    for (const [entryPath, content] of Object.entries(fileContents)) {
      if (entryPath.startsWith('db/') && entryPath.endsWith('.ndjson.gz')) {
        datasetFilesByPath[entryPath] = content;
        const datasetName = entryPath
          .replace(/^db\/[^/]+\//, '')
          .replace(/\.ndjson\.gz$/, '');
        datasetFilesByName[datasetName] = content;
      }
    }

    const objectFilePaths = normalizedEntries.filter((entryPath) => entryPath.startsWith('objects/files/'));

    const structureResult = this.validateArchiveStructure(zip);
    const manifest = this.readJsonEntry<ManifestV2>(fileContents, 'manifest.v2.json');
    const dbOrder = this.readJsonEntry<DbOrderV2>(fileContents, 'db/order.json');
    const checksumsRaw = this.readTextEntry(fileContents, 'checksums.sha256');

    const manifestResult = manifest
      ? this.validateManifest(manifest)
      : this.composeResult(
          [
            {
              code: 'MANIFEST_MISSING_OR_INVALID',
              severity: 'blocking',
              path: 'manifest.v2.json',
              message: 'manifest.v2.json absent ou invalide',
            },
          ],
          []
        );

    const checksumsResult =
      manifest && checksumsRaw
        ? this.validateChecksums({
            checksumsFileContent: checksumsRaw,
            fileContents,
            expectedGlobalSha256: manifest.checksums.globalSha256,
          })
        : this.composeResult(
            [
              {
                code: 'CHECKSUMS_VALIDATION_UNAVAILABLE',
                severity: 'blocking',
                path: 'checksums.sha256',
                message: 'Impossible de valider les checksums sans manifest/checksums',
              },
            ],
            []
          );

    const expectedDatasetPaths = dbExportPlanner.getExpectedDatasetPaths();
    const datasetsResult = this.validateDatasets({
      datasetFiles: datasetFilesByPath,
      expectedDatasets: expectedDatasetPaths,
    });

    const dbOrderResult =
      dbOrder !== null
        ? this.validateDbOrder(dbOrder, Object.keys(datasetFilesByName))
        : this.composeResult(
            [
              {
                code: 'DB_ORDER_MISSING_OR_INVALID',
                severity: 'blocking',
                path: 'db/order.json',
                message: 'db/order.json absent ou invalide',
              },
            ],
            []
          );

    const archiveVsManifestResult =
      manifest !== null
        ? this.validateArchiveAgainstManifest(manifest, normalizedEntries)
        : this.composeResult([], []);

    const objectIndexEntries = this.parseObjectIndexEntries(fileContents['objects/index.ndjson']?.toString('utf8'));
    const objectIndexResult =
      manifest?.includes.documentsBinary && fileContents['objects/index.ndjson']
        ? this.validateObjectsIndex(fileContents['objects/index.ndjson'].toString('utf8'), objectFilePaths)
        : this.composeResult([], []);

    const binaryNotRestoredWarning =
      manifest?.includes.documentsBinary
        ? this.composeResult(
            [],
            [
              {
                code: 'OBJECT_RESTORE_NOT_IMPLEMENTED_PHASE_2C',
                severity: 'warning',
                path: 'objects/',
                message:
                  'Archive contient des objets binaires: la phase 2C restaure uniquement la base de données',
              },
            ]
          )
        : this.composeResult([], []);

    const modeResult =
      manifest?.mode === 'full-replace'
        ? this.composeResult([], [])
        : this.composeResult(
            [
              {
                code: 'RESTORE_MODE_MUST_BE_FULL_REPLACE',
                severity: 'blocking',
                path: 'manifest.v2.json',
                message: 'Seul le mode full-replace est autorisé en phase 2C',
              },
            ],
            []
          );

    const mergedValidation = this.mergeResults([
      structureResult,
      manifestResult,
      checksumsResult,
      datasetsResult,
      dbOrderResult,
      archiveVsManifestResult,
      objectIndexResult,
      binaryNotRestoredWarning,
      modeResult,
    ]);

    return {
      validation: mergedValidation,
      manifest,
      dbOrder,
      archiveFilePaths: normalizedEntries,
      datasetFilesByPath,
      datasetFilesByName,
      objectFilePaths,
      objectIndexEntries,
    };
  }

  validateArchiveForFullRestore(zipBuffer: Buffer): ValidateRestoreV2ArchiveOutput {
    const output = this.validateArchiveForDbRestore(zipBuffer);
    const fullErrors: BackupV2ValidationIssue[] = [];
    const fullWarnings: BackupV2ValidationIssue[] = [];
    const baseValidationWithoutDbOnlyWarning = this.composeResult(
      output.validation.errors,
      output.validation.warnings.filter(
        (warning) => warning.code !== 'OBJECT_RESTORE_NOT_IMPLEMENTED_PHASE_2C'
      )
    );

    if (!output.manifest) {
      fullErrors.push({
        code: 'FULL_RESTORE_MANIFEST_MISSING',
        severity: 'blocking',
        path: 'manifest.v2.json',
        message: 'Manifest requis pour un restore-v2-full',
      });
    } else {
      if (!output.manifest.includes.documentsBinary) {
        fullErrors.push({
          code: 'FULL_RESTORE_DB_ONLY_ARCHIVE_NOT_ALLOWED',
          severity: 'blocking',
          path: 'manifest.v2.json',
          message: 'Archive DB-only refusée pour restore-v2-full',
        });
      }
      if (output.manifest.mode !== 'full-replace') {
        fullErrors.push({
          code: 'FULL_RESTORE_MODE_INVALID',
          severity: 'blocking',
          path: 'manifest.v2.json',
          message: 'Seul le mode full-replace est autorisé pour restore-v2-full',
        });
      }
    }

    if (!output.archiveFilePaths.includes('objects/index.ndjson')) {
      fullErrors.push({
        code: 'FULL_RESTORE_OBJECT_INDEX_MISSING',
        severity: 'blocking',
        path: 'objects/index.ndjson',
        message: 'objects/index.ndjson requis pour restore-v2-full',
      });
    }

    if (output.objectIndexEntries.length === 0) {
      fullWarnings.push({
        code: 'FULL_RESTORE_OBJECT_INDEX_EMPTY',
        severity: 'warning',
        path: 'objects/index.ndjson',
        message: 'Index objets vide',
      });
    }

    const merged = this.mergeResults([
      baseValidationWithoutDbOnlyWarning,
      this.composeResult(fullErrors, fullWarnings),
    ]);

    return {
      ...output,
      validation: merged,
    };
  }

  validateArchiveStructure(zip: AdmZip): BackupV2ValidationResult {
    const entries = zip
      .getEntries()
      .map((entry) => entry.entryName.replace(/^\/+/, ''))
      .filter((entryName) => entryName.length > 0);

    const errors: BackupV2ValidationIssue[] = [];
    const warnings: BackupV2ValidationIssue[] = [];

    for (const requiredPath of MANDATORY_ARCHIVE_PATHS) {
      if (!entries.includes(requiredPath)) {
        errors.push({
          code: 'ARCHIVE_MISSING_REQUIRED_PATH',
          severity: 'blocking',
          path: requiredPath,
          message: `Chemin requis absent dans l'archive: ${requiredPath}`,
        });
      }
    }

    const datasetEntries = entries.filter((entry) => entry.startsWith('db/') && entry.endsWith('.ndjson.gz'));
    if (datasetEntries.length === 0) {
      errors.push({
        code: 'ARCHIVE_NO_DB_DATASETS',
        severity: 'blocking',
        path: 'db/',
        message: 'Aucun dataset DB trouvé dans l’archive',
      });
    }

    if (!entries.some((entry) => entry.startsWith('reports/'))) {
      warnings.push({
        code: 'ARCHIVE_REPORTS_MISSING',
        severity: 'warning',
        path: 'reports/',
        message: 'Le dossier reports/ est absent (SHOULD)',
      });
    }

    return this.composeResult(errors, warnings);
  }

  validateArchiveAgainstManifest(
    manifest: ManifestV2,
    archiveFilePaths: string[]
  ): BackupV2ValidationResult {
    const errors: BackupV2ValidationIssue[] = [];
    const warnings: BackupV2ValidationIssue[] = [];

    const hasObjectsIndex = archiveFilePaths.includes('objects/index.ndjson');
    const hasAnyObjectFile = archiveFilePaths.some((path) => path.startsWith('objects/files/'));

    if (manifest.includes.documentsBinary) {
      if (!hasObjectsIndex) {
        errors.push({
          code: 'OBJECTS_INDEX_MISSING',
          severity: 'blocking',
          path: 'objects/index.ndjson',
          message: 'documentsBinary=true exige objects/index.ndjson',
        });
      }
      if (!hasAnyObjectFile) {
        errors.push({
          code: 'OBJECTS_FILES_MISSING',
          severity: 'blocking',
          path: 'objects/files/',
          message: 'documentsBinary=true exige au moins un objet binaire',
        });
      }
    } else {
      if (hasObjectsIndex || hasAnyObjectFile) {
        warnings.push({
          code: 'OBJECTS_PRESENT_BUT_FLAG_FALSE',
          severity: 'warning',
          path: 'objects/',
          message: 'Objets présents alors que documentsBinary=false',
        });
      } else {
        warnings.push({
          code: 'DB_ONLY_ARCHIVE',
          severity: 'warning',
          path: 'manifest.v2.json',
          message: 'Archive V2 en mode DB-only (phase de transition)',
        });
      }
    }

    return this.composeResult(errors, warnings);
  }

  validateManifest(manifest: ManifestV2): BackupV2ValidationResult {
    const errors: BackupV2ValidationIssue[] = [];
    const warnings: BackupV2ValidationIssue[] = [];

    if (!SEMVER_RE.test(manifest.backupVersion)) {
      errors.push({
        code: 'MANIFEST_INVALID_BACKUP_VERSION',
        severity: 'blocking',
        path: 'manifest.v2.json',
        message: 'backupVersion doit être une semver valide',
      });
    }

    if (manifest.mode !== 'full-replace') {
      errors.push({
        code: 'MANIFEST_INVALID_MODE',
        severity: 'blocking',
        path: 'manifest.v2.json',
        message: 'mode doit valoir "full-replace"',
      });
    }

    if (manifest.scope !== 'full') {
      errors.push({
        code: 'MANIFEST_INVALID_SCOPE',
        severity: 'blocking',
        path: 'manifest.v2.json',
        message: 'scope doit valoir "full"',
      });
    }

    if (!ISO_DATE_RE.test(manifest.createdAt)) {
      errors.push({
        code: 'MANIFEST_INVALID_CREATED_AT',
        severity: 'blocking',
        path: 'manifest.v2.json',
        message: 'createdAt doit être au format ISO-8601 UTC',
      });
    }

    if (manifest.checksums.files !== 'checksums.sha256') {
      errors.push({
        code: 'MANIFEST_INVALID_CHECKSUMS_POINTER',
        severity: 'blocking',
        path: 'manifest.v2.json',
        message: 'checksums.files doit pointer vers checksums.sha256',
      });
    }

    if (!SHA256_RE.test(manifest.checksums.globalSha256)) {
      errors.push({
        code: 'MANIFEST_INVALID_GLOBAL_CHECKSUM',
        severity: 'blocking',
        path: 'manifest.v2.json',
        message: 'checksums.globalSha256 doit être un hash sha256 hexadécimal',
      });
    }

    if (manifest.includes.documentsBinary && manifest.counts.objects <= 0) {
      errors.push({
        code: 'MANIFEST_INCONSISTENT_OBJECT_COUNTS',
        severity: 'blocking',
        path: 'manifest.v2.json',
        message: 'documentsBinary=true implique counts.objects > 0',
      });
    }

    if (!manifest.compatibility.requiredFeatures.includes('full-backup-v2')) {
      warnings.push({
        code: 'MANIFEST_MISSING_REQUIRED_FEATURE_HINT',
        severity: 'warning',
        path: 'manifest.v2.json',
        message: 'requiredFeatures SHOULD inclure full-backup-v2',
      });
    }

    if (manifest.backupVersion !== BACKUP_V2_VERSION) {
      warnings.push({
        code: 'MANIFEST_VERSION_DIFFERENT_FROM_CURRENT',
        severity: 'warning',
        path: 'manifest.v2.json',
        message: `backupVersion (${manifest.backupVersion}) diffère de la version courante (${BACKUP_V2_VERSION})`,
      });
    }

    return this.composeResult(errors, warnings);
  }

  validateChecksums(input: ValidateChecksumsInput): BackupV2ValidationResult {
    const errors: BackupV2ValidationIssue[] = [];
    const warnings: BackupV2ValidationIssue[] = [];

    const lines = input.checksumsFileContent
      .split('\n')
      .map((line) => line.trimEnd())
      .filter((line) => line.trim().length > 0);

    const parsedChecksums = new Map<string, string>();
    for (const line of lines) {
      const match = line.match(/^([a-f0-9]{64})\s{2}(.+)$/i);
      if (!match) {
        errors.push({
          code: 'CHECKSUMS_INVALID_LINE_FORMAT',
          severity: 'blocking',
          path: 'checksums.sha256',
          message: `Ligne checksum invalide: "${line}"`,
        });
        continue;
      }
      parsedChecksums.set(match[2], match[1].toLowerCase());
    }

    const computedGlobal = this.sha256(input.checksumsFileContent);
    if (computedGlobal !== input.expectedGlobalSha256.toLowerCase()) {
      errors.push({
        code: 'CHECKSUMS_GLOBAL_MISMATCH',
        severity: 'blocking',
        path: 'checksums.sha256',
        message: 'Le checksum global de checksums.sha256 est invalide',
        context: {
          expected: input.expectedGlobalSha256.toLowerCase(),
          actual: computedGlobal,
        },
      });
    }

    for (const [path, content] of Object.entries(input.fileContents)) {
      if (path === 'checksums.sha256') continue;
      const expected = parsedChecksums.get(path);
      if (path === 'manifest.v2.json' && !expected) {
        warnings.push({
          code: 'CHECKSUMS_MANIFEST_ENTRY_MISSING',
          severity: 'warning',
          path,
          message:
            'manifest.v2.json absent de checksums.sha256 (toléré pour éviter la dépendance circulaire globalSha256)',
        });
        continue;
      }
      if (!expected) {
        errors.push({
          code: 'CHECKSUMS_MISSING_FILE_ENTRY',
          severity: 'blocking',
          path,
          message: `Fichier absent de checksums.sha256: ${path}`,
        });
        continue;
      }
      const actual = this.sha256(content);
      if (actual !== expected) {
        errors.push({
          code: 'CHECKSUM_MISMATCH',
          severity: 'blocking',
          path,
          message: `Checksum invalide pour ${path}`,
          context: { expected, actual },
        });
      }
    }

    for (const listedPath of parsedChecksums.keys()) {
      if (!input.fileContents[listedPath]) {
        warnings.push({
          code: 'CHECKSUMS_UNUSED_ENTRY',
          severity: 'warning',
          path: listedPath,
          message: `Entrée checksum sans fichier correspondant: ${listedPath}`,
        });
      }
    }

    return this.composeResult(errors, warnings);
  }

  validateDatasets(input: ValidateDatasetsInput): BackupV2ValidationResult {
    const errors: BackupV2ValidationIssue[] = [];
    const warnings: BackupV2ValidationIssue[] = [];

    for (const expectedPath of input.expectedDatasets) {
      if (!input.datasetFiles[expectedPath]) {
        errors.push({
          code: 'DATASET_MISSING',
          severity: 'blocking',
          path: expectedPath,
          message: `Dataset obligatoire absent: ${expectedPath}`,
        });
      }
    }

    for (const [path, gzContent] of Object.entries(input.datasetFiles)) {
      if (!path.endsWith('.ndjson.gz')) {
        warnings.push({
          code: 'DATASET_UNEXPECTED_EXTENSION',
          severity: 'warning',
          path,
          message: `Extension dataset inattendue (SHOULD .ndjson.gz): ${path}`,
        });
      }

      let decoded: string;
      try {
        decoded = gunzipSync(gzContent).toString('utf8');
      } catch {
        errors.push({
          code: 'DATASET_GZIP_INVALID',
          severity: 'blocking',
          path,
          message: `Dataset gzip illisible: ${path}`,
        });
        continue;
      }

      const lines = decoded
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      if (lines.length === 0) {
        warnings.push({
          code: 'DATASET_EMPTY',
          severity: 'warning',
          path,
          message: `Dataset vide: ${path}`,
        });
      }

      lines.forEach((line, index) => {
        try {
          JSON.parse(line);
        } catch {
          errors.push({
            code: 'DATASET_NDJSON_INVALID_LINE',
            severity: 'blocking',
            path,
            message: `Ligne NDJSON invalide`,
            context: { line: index + 1 },
          });
        }
      });
    }

    return this.composeResult(errors, warnings);
  }

  validateObjectsIndex(
    indexContent: string,
    objectFilePaths: string[] = []
  ): BackupV2ValidationResult {
    const errors: BackupV2ValidationIssue[] = [];
    const warnings: BackupV2ValidationIssue[] = [];
    const lines = indexContent
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const seenObjectIds = new Set<string>();
    const referencedPaths = new Set<string>();
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let parsed: ObjectIndexEntryV2;
      try {
        parsed = JSON.parse(line) as ObjectIndexEntryV2;
      } catch {
        errors.push({
          code: 'OBJECT_INDEX_INVALID_LINE',
          severity: 'blocking',
          path: 'objects/index.ndjson',
          message: 'Ligne JSON invalide dans objects/index.ndjson',
          context: { line: i + 1 },
        });
        continue;
      }

      if (!parsed.objectId || seenObjectIds.has(parsed.objectId)) {
        errors.push({
          code: 'OBJECT_INDEX_DUPLICATE_OR_MISSING_ID',
          severity: 'blocking',
          path: 'objects/index.ndjson',
          message: 'objectId manquant ou dupliqué',
          context: { line: i + 1, objectId: parsed.objectId || null },
        });
      }
      seenObjectIds.add(parsed.objectId);

      if (!parsed.relativePath.startsWith('objects/files/')) {
        errors.push({
          code: 'OBJECT_INDEX_INVALID_RELATIVE_PATH',
          severity: 'blocking',
          path: 'objects/index.ndjson',
          message: 'relativePath doit être sous objects/files/',
          context: { line: i + 1, relativePath: parsed.relativePath },
        });
      }
      referencedPaths.add(parsed.relativePath);

      if (!parsed.storageKey || parsed.storageKey.trim().length === 0) {
        errors.push({
          code: 'OBJECT_INDEX_MISSING_STORAGE_KEY',
          severity: 'blocking',
          path: 'objects/index.ndjson',
          message: 'storageKey manquant',
          context: { line: i + 1 },
        });
      }

      if (!SHA256_RE.test(parsed.sha256)) {
        errors.push({
          code: 'OBJECT_INDEX_INVALID_SHA256',
          severity: 'blocking',
          path: 'objects/index.ndjson',
          message: 'sha256 invalide',
          context: { line: i + 1 },
        });
      }

      if (parsed.size < 0) {
        errors.push({
          code: 'OBJECT_INDEX_INVALID_SIZE',
          severity: 'blocking',
          path: 'objects/index.ndjson',
          message: 'size doit être positif',
          context: { line: i + 1, size: parsed.size },
        });
      }
    }

    if (objectFilePaths.length > 0) {
      for (const referencedPath of referencedPaths) {
        if (!objectFilePaths.includes(referencedPath)) {
          errors.push({
            code: 'OBJECT_INDEX_REFERENCES_MISSING_FILE',
            severity: 'blocking',
            path: referencedPath,
            message: 'Entrée index orpheline: fichier objet introuvable dans l’archive',
          });
        }
      }
    }

    if (lines.length === 0) {
      warnings.push({
        code: 'OBJECT_INDEX_EMPTY',
        severity: 'warning',
        path: 'objects/index.ndjson',
        message: 'Index objets vide',
      });
    }

    return this.composeResult(errors, warnings);
  }

  validateDbOrder(dbOrder: DbOrderV2, datasetNames: string[]): BackupV2ValidationResult {
    const errors: BackupV2ValidationIssue[] = [];
    const warnings: BackupV2ValidationIssue[] = [];

    if (!Array.isArray(dbOrder.restoreOrder) || dbOrder.restoreOrder.length === 0) {
      errors.push({
        code: 'DB_ORDER_INVALID_RESTORE_ORDER',
        severity: 'blocking',
        path: 'db/order.json',
        message: 'restoreOrder doit être un tableau non vide',
      });
      return this.composeResult(errors, warnings);
    }

    for (const datasetName of datasetNames) {
      if (!dbOrder.restoreOrder.includes(datasetName)) {
        errors.push({
          code: 'DB_ORDER_MISSING_DATASET',
          severity: 'blocking',
          path: 'db/order.json',
          message: `Dataset absent de restoreOrder: ${datasetName}`,
        });
      }
    }

    for (const orderedDataset of dbOrder.restoreOrder) {
      if (!datasetNames.includes(orderedDataset)) {
        warnings.push({
          code: 'DB_ORDER_UNUSED_DATASET',
          severity: 'warning',
          path: 'db/order.json',
          message: `restoreOrder contient un dataset non exporté: ${orderedDataset}`,
        });
      }
    }

    return this.composeResult(errors, warnings);
  }

  validateCompatibility(metadata: ChecksumsV2, manifest: ManifestV2): BackupV2ValidationResult {
    const errors: BackupV2ValidationIssue[] = [];
    const warnings: BackupV2ValidationIssue[] = [];

    if (metadata.algorithm !== 'sha256') {
      errors.push({
        code: 'COMPATIBILITY_INVALID_CHECKSUM_ALGO',
        severity: 'blocking',
        path: 'manifest.v2.json',
        message: 'algorithm doit valoir sha256',
      });
    }

    if (manifest.compatibility.requiredFeatures.length === 0) {
      warnings.push({
        code: 'COMPATIBILITY_EMPTY_REQUIRED_FEATURES',
        severity: 'warning',
        path: 'metadata/compatibility.json',
        message: 'requiredFeatures vide (SHOULD contenir les features minimales)',
      });
    }

    return this.composeResult(errors, warnings);
  }

  private composeResult(
    errors: BackupV2ValidationIssue[],
    warnings: BackupV2ValidationIssue[]
  ): BackupV2ValidationResult {
    let status: BackupCompatibilityStatus = 'compatible';
    if (errors.length > 0) {
      status = 'incompatible';
    } else if (warnings.length > 0) {
      status = 'compatible_with_warnings';
    }
    return { status, errors, warnings };
  }

  private mergeResults(results: BackupV2ValidationResult[]): BackupV2ValidationResult {
    const errors = results.flatMap((result) => result.errors);
    const warnings = results.flatMap((result) => result.warnings);
    return this.composeResult(errors, warnings);
  }

  private readJsonEntry<T>(fileContents: Record<string, Buffer>, filePath: string): T | null {
    const raw = fileContents[filePath];
    if (!raw) return null;
    try {
      return JSON.parse(raw.toString('utf8')) as T;
    } catch {
      return null;
    }
  }

  private readTextEntry(fileContents: Record<string, Buffer>, filePath: string): string | null {
    const raw = fileContents[filePath];
    if (!raw) return null;
    return raw.toString('utf8');
  }

  private parseObjectIndexEntries(indexContent?: string): ObjectIndexEntryV2[] {
    if (!indexContent) return [];
    const lines = indexContent
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    const entries: ObjectIndexEntryV2[] = [];
    for (const line of lines) {
      try {
        entries.push(JSON.parse(line) as ObjectIndexEntryV2);
      } catch {
        // L'erreur est déjà portée par validateObjectsIndex
      }
    }
    return entries;
  }

  private sha256(content: Buffer | string): string {
    return createHash('sha256').update(content).digest('hex');
  }
}

export const backupV2Validator = new BackupV2Validator();
