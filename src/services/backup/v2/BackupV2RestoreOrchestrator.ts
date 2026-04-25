import { prisma } from '@/lib/prisma';
import { adminBackupService } from '@/services/AdminBackupService';
import { BackupV2ValidationIssue } from './BackupV2Contract';
import { backupV2Builder } from './BackupV2Builder';
import { backupV2Validator } from './BackupV2Validator';
import { backupV2RestorePlanner } from './BackupV2RestorePlanner';
import { backupV2DbRestoreService } from './BackupV2DbRestoreService';
import { backupV2ObjectRestoreService } from './BackupV2ObjectRestoreService';

export interface RestoreV2DbOnlyResult {
  status: 'success' | 'failed';
  backupVersion: string;
  archiveMetadata: {
    backupId: string;
    fileUrl: string;
    createdAt: string;
    appVersion: string;
    schemaVersion: string;
  };
  tablesRestored: string[];
  rowCount: number;
  purgeCount: number;
  warnings: BackupV2ValidationIssue[];
}

interface RestoreV2DbOnlyOptions {
  backupId: string;
  mode: 'full-replace';
  onProgress?: (progress: {
    step:
      | 'preparation'
      | 'pre_validation'
      | 'safety_backup'
      | 'loading_archive'
      | 'validation'
      | 'purge_db'
      | 'restore_db'
      | 'restore_objects'
      | 'rollback'
      | 'verification'
      | 'finalization';
    message: string;
  }) => Promise<void> | void;
}

export interface RestoreV2FullResult extends RestoreV2DbOnlyResult {
  objectsRestored: number;
  bytesObjectsRestored: number;
}

type RestoreV2FinalState = 'success' | 'failed' | 'rolled_back' | 'rollback_failed';

export interface RestoreV2FullSafetyResult extends RestoreV2FullResult {
  finalState: RestoreV2FinalState;
  safetyBackupId: string | null;
  rollbackAttempted: boolean;
  rollbackSucceeded: boolean;
  errors: BackupV2ValidationIssue[];
  sourceBackupId: string | null;
  sourceBackupVersion: string | null;
  sourceType: 'history' | 'uploaded_zip';
  sourceFileName?: string;
}

export class BackupV2RestoreOrchestrator {
  async restoreDbOnly(options: RestoreV2DbOnlyOptions): Promise<RestoreV2DbOnlyResult> {
    if (options.mode !== 'full-replace') {
      throw new Error('Mode invalide: seul full-replace est autorisé pour restore-v2-db');
    }

    await options.onProgress?.({
      step: 'preparation',
      message: 'Préparation du restore V2 DB-only',
    });

    const backupRecord = await prisma.adminBackupRecord.findUnique({
      where: { id: options.backupId },
    });
    if (!backupRecord) {
      throw new Error('Backup V2 introuvable');
    }

    await options.onProgress?.({
      step: 'loading_archive',
      message: 'Chargement de l’archive V2',
    });
    const archiveBuffer = await adminBackupService.readArchiveFromFileUrl(backupRecord.fileUrl);

    await options.onProgress?.({
      step: 'validation',
      message: 'Validation complète de l’archive V2',
    });
    const validationOutput = backupV2Validator.validateArchiveForDbRestore(archiveBuffer);
    if (validationOutput.validation.status === 'incompatible' || !validationOutput.manifest || !validationOutput.dbOrder) {
      const details = validationOutput.validation.errors
        .map((error) => `${error.code}: ${error.message}`)
        .join(' | ');
      throw new Error(`Archive V2 invalide: ${details || 'manifest/dbOrder manquant'}`);
    }

    const planner = backupV2RestorePlanner.buildPlan(
      validationOutput.dbOrder,
      Object.keys(validationOutput.datasetFilesByName)
    );

    if (planner.missingCriticalDatasets.length > 0) {
      throw new Error(
        `Datasets critiques manquants: ${planner.missingCriticalDatasets.join(', ')}`
      );
    }

    const warnings: BackupV2ValidationIssue[] = [...validationOutput.validation.warnings];
    if (planner.missingDatasets.length > 0) {
      warnings.push({
        code: 'RESTORE_PLAN_MISSING_DATASETS',
        severity: 'warning',
        message: `Datasets absents du restore: ${planner.missingDatasets.join(', ')}`,
      });
    }
    if (planner.unknownDatasetsInArchive.length > 0) {
      warnings.push({
        code: 'RESTORE_PLAN_UNKNOWN_DATASETS',
        severity: 'warning',
        message: `Datasets inconnus dans l'archive: ${planner.unknownDatasetsInArchive.join(', ')}`,
      });
    }

    await options.onProgress?.({
      step: 'purge_db',
      message: 'Purge full replace des datasets DB',
    });
    await options.onProgress?.({
      step: 'restore_db',
      message: 'Restauration des datasets DB',
    });
    const restoreStats = await backupV2DbRestoreService.restoreFullReplace({
      plan: planner,
      datasetFilesByName: validationOutput.datasetFilesByName,
    });
    warnings.push(...restoreStats.warnings);

    await options.onProgress?.({
      step: 'verification',
      message: 'Vérifications post-restore DB',
    });
    if (validationOutput.manifest.counts.rows !== restoreStats.rowsImported) {
      warnings.push({
        code: 'RESTORE_ROW_COUNT_MISMATCH',
        severity: 'warning',
        message: `rows du manifest (${validationOutput.manifest.counts.rows}) différent des lignes restaurées (${restoreStats.rowsImported})`,
      });
    }
    if (validationOutput.manifest.includes.documentsBinary) {
      warnings.push({
        code: 'OBJECTS_NOT_RESTORED_PHASE_2C',
        severity: 'warning',
        message:
          'L’archive contient des objets binaires, non restaurés en phase 2C (DB-only)',
      });
    }

    await options.onProgress?.({
      step: 'finalization',
      message: 'Restore V2 DB-only finalisé',
    });

    return {
      status: 'success',
      backupVersion: validationOutput.manifest.backupVersion,
      archiveMetadata: {
        backupId: backupRecord.id,
        fileUrl: backupRecord.fileUrl,
        createdAt: backupRecord.createdAt.toISOString(),
        appVersion: validationOutput.manifest.appVersion,
        schemaVersion: validationOutput.manifest.schemaVersion,
      },
      tablesRestored: restoreStats.tablesRestored,
      rowCount: restoreStats.rowsImported,
      purgeCount: restoreStats.rowsPurged,
      warnings,
    };
  }

  async restoreFull(options: RestoreV2DbOnlyOptions): Promise<RestoreV2FullResult> {
    if (options.mode !== 'full-replace') {
      throw new Error('Mode invalide: seul full-replace est autorisé pour restore-v2-full');
    }

    await options.onProgress?.({
      step: 'preparation',
      message: 'Préparation du restore V2 complet',
    });

    const backupRecord = await prisma.adminBackupRecord.findUnique({
      where: { id: options.backupId },
    });
    if (!backupRecord) {
      throw new Error('Backup V2 introuvable');
    }

    await options.onProgress?.({
      step: 'loading_archive',
      message: 'Chargement de l’archive V2',
    });
    const archiveBuffer = await adminBackupService.readArchiveFromFileUrl(backupRecord.fileUrl);
    const executed = await this.performFullRestoreFromArchive({
      backupRecord: {
        id: backupRecord.id,
        fileUrl: backupRecord.fileUrl,
        createdAtIso: backupRecord.createdAt.toISOString(),
      },
      archiveBuffer,
      onProgress: options.onProgress,
    });

    return executed.result;
  }

  async restoreFullWithSafety(options: RestoreV2DbOnlyOptions & {
    triggeredBy: { userId: string; email?: string };
  }): Promise<RestoreV2FullSafetyResult> {
    if (options.mode !== 'full-replace') {
      throw new Error('Mode invalide: seul full-replace est autorisé pour restore-v2-full');
    }

    await options.onProgress?.({
      step: 'preparation',
      message: 'Préparation du restore V2 complet sécurisé',
    });

    const sourceBackupRecord = await prisma.adminBackupRecord.findUnique({
      where: { id: options.backupId },
    });
    if (!sourceBackupRecord) {
      throw new Error('Backup V2 source introuvable');
    }

    await options.onProgress?.({
      step: 'pre_validation',
      message: 'Pré-validation stricte de l’archive source',
    });
    await options.onProgress?.({
      step: 'loading_archive',
      message: 'Lecture archive source avant backup de sécurité',
    });
    const sourceArchiveBuffer = await adminBackupService.readArchiveFromFileUrl(sourceBackupRecord.fileUrl);
    const sourceValidation = backupV2Validator.validateArchiveForFullRestore(sourceArchiveBuffer);
    if (sourceValidation.validation.status === 'incompatible' || !sourceValidation.manifest) {
      const details = sourceValidation.validation.errors
        .map((error) => `${error.code}: ${error.message}`)
        .join(' | ');
      throw new Error(`Archive source invalide: ${details || 'manifest manquant'}`);
    }

    await options.onProgress?.({
      step: 'safety_backup',
      message: 'Création du backup de sécurité pré-restore',
    });
    const safetyBuild = await backupV2Builder.buildDbOnlyArchiveToFile({
      createdBy: {
        userId: options.triggeredBy.userId,
        email: options.triggeredBy.email,
      },
      notes: `Safety backup before restore-v2-full (${options.backupId})`,
      includeObjects: true,
      strictMissingObjectFiles: true,
      onProgress: async ({ message }) => {
        await options.onProgress?.({
          step: 'safety_backup',
          message: `Backup de sécurité: ${message}`,
        });
      },
    });

    const safetyRecord = await prisma.adminBackupRecord.create({
      data: {
        createdById: options.triggeredBy.userId,
        scope: 'full-v2-safety',
        fileUrl: safetyBuild.fileUrl,
        checksum: safetyBuild.manifest.checksums.globalSha256,
        sizeBytes: safetyBuild.sizeBytes,
        note: `Safety backup auto avant restore-v2-full source=${options.backupId}`,
        meta: {
          ...safetyBuild.manifest,
          safetyContext: {
            purpose: 'pre-restore-safety',
            sourceBackupId: options.backupId,
            createdAt: new Date().toISOString(),
          },
        },
      },
    });

    let rollbackAttempted = false;
    let rollbackSucceeded = false;
    let applicationStarted = false;
    const sourceObjectStorageKeys = sourceValidation.objectIndexEntries.map((entry) => entry.storageKey);

    try {
      const mainRestore = await this.performFullRestoreFromArchive({
        backupRecord: {
          id: sourceBackupRecord.id,
          fileUrl: sourceBackupRecord.fileUrl,
          createdAtIso: sourceBackupRecord.createdAt.toISOString(),
        },
        archiveBuffer: sourceArchiveBuffer,
        onProgress: async (progress) => {
          if (progress.step === 'purge_db' || progress.step === 'restore_db' || progress.step === 'restore_objects') {
            applicationStarted = true;
          }
          await options.onProgress?.(progress);
        },
      });

      return {
        ...mainRestore.result,
        finalState: 'success',
        safetyBackupId: safetyRecord.id,
        rollbackAttempted,
        rollbackSucceeded,
        errors: [],
        sourceBackupId: sourceBackupRecord.id,
        sourceBackupVersion: sourceValidation.manifest.backupVersion,
        sourceType: 'history',
      };
    } catch (restoreError) {
      const errors: BackupV2ValidationIssue[] = [
        this.errorAsIssue(
          restoreError,
          'RESTORE_FULL_PRIMARY_FAILED',
          'Échec du restore principal'
        ),
      ];

      if (!applicationStarted) {
        return {
          status: 'failed',
          backupVersion: sourceValidation.manifest.backupVersion,
          archiveMetadata: {
            backupId: sourceBackupRecord.id,
            fileUrl: sourceBackupRecord.fileUrl,
            createdAt: sourceBackupRecord.createdAt.toISOString(),
            appVersion: sourceValidation.manifest.appVersion,
            schemaVersion: sourceValidation.manifest.schemaVersion,
          },
          tablesRestored: [],
          rowCount: 0,
          purgeCount: 0,
          objectsRestored: 0,
          bytesObjectsRestored: 0,
          warnings: sourceValidation.validation.warnings,
          finalState: 'failed',
          safetyBackupId: safetyRecord.id,
          rollbackAttempted,
          rollbackSucceeded,
          errors,
          sourceBackupId: sourceBackupRecord.id,
          sourceBackupVersion: sourceValidation.manifest.backupVersion,
          sourceType: 'history',
        };
      }

      rollbackAttempted = true;
      await options.onProgress?.({
        step: 'rollback',
        message: `Échec restore principal: rollback auto depuis backup de sécurité ${safetyRecord.id}`,
      });

      try {
        const safetyArchiveBuffer = await adminBackupService.readArchiveFromFileUrl(safetyRecord.fileUrl);
        const rollbackRestore = await this.performFullRestoreFromArchive({
          backupRecord: {
            id: safetyRecord.id,
            fileUrl: safetyRecord.fileUrl,
            createdAtIso: safetyRecord.createdAt.toISOString(),
          },
          archiveBuffer: safetyArchiveBuffer,
          onProgress: async ({ message }) => {
            await options.onProgress?.({
              step: 'rollback',
              message: `Rollback: ${message}`,
            });
          },
        });
        rollbackSucceeded = true;

        const rollbackObjectStorageKeys = new Set(rollbackRestore.objectStorageKeys);
        const maybeOrphanKeys = [...new Set(sourceObjectStorageKeys)].filter(
          (key) => !rollbackObjectStorageKeys.has(key)
        );
        const rollbackWarnings = [...rollbackRestore.result.warnings];
        if (maybeOrphanKeys.length > 0) {
          rollbackWarnings.push({
            code: 'ROLLBACK_OBJECTS_POTENTIAL_ORPHANS',
            severity: 'warning',
            message:
              'Rollback DB+objets terminé, mais certains objets potentiellement écrits pendant l’échec initial peuvent rester sur le storage',
            context: {
              keyCount: maybeOrphanKeys.length,
              sampleKeys: maybeOrphanKeys.slice(0, 20),
            },
          });
        }

        return {
          ...rollbackRestore.result,
          warnings: rollbackWarnings,
          finalState: 'rolled_back',
          safetyBackupId: safetyRecord.id,
          rollbackAttempted,
          rollbackSucceeded,
          errors,
          sourceBackupId: sourceBackupRecord.id,
          sourceBackupVersion: sourceValidation.manifest.backupVersion,
          sourceType: 'history',
        };
      } catch (rollbackError) {
        errors.push(
          this.errorAsIssue(
            rollbackError,
            'RESTORE_FULL_ROLLBACK_FAILED',
            'Échec du rollback automatique'
          )
        );
        return {
          status: 'failed',
          backupVersion: sourceValidation.manifest.backupVersion,
          archiveMetadata: {
            backupId: sourceBackupRecord.id,
            fileUrl: sourceBackupRecord.fileUrl,
            createdAt: sourceBackupRecord.createdAt.toISOString(),
            appVersion: sourceValidation.manifest.appVersion,
            schemaVersion: sourceValidation.manifest.schemaVersion,
          },
          tablesRestored: [],
          rowCount: 0,
          purgeCount: 0,
          objectsRestored: 0,
          bytesObjectsRestored: 0,
          warnings: sourceValidation.validation.warnings,
          finalState: 'rollback_failed',
          safetyBackupId: safetyRecord.id,
          rollbackAttempted,
          rollbackSucceeded: false,
          errors,
          sourceBackupId: sourceBackupRecord.id,
          sourceBackupVersion: sourceValidation.manifest.backupVersion,
          sourceType: 'history',
        };
      }
    }
  }

  async restoreFullWithSafetyFromArchiveBuffer(options: {
    archiveBuffer: Buffer;
    sourceFileName: string;
    mode: 'full-replace';
    triggeredBy: { userId: string; email?: string };
    onProgress?: RestoreV2DbOnlyOptions['onProgress'];
  }): Promise<RestoreV2FullSafetyResult> {
    if (options.mode !== 'full-replace') {
      throw new Error('Mode invalide: seul full-replace est autorisé pour restore-v2-full');
    }

    await options.onProgress?.({
      step: 'preparation',
      message: 'Préparation du restore V2 complet sécurisé (ZIP importé)',
    });
    await options.onProgress?.({
      step: 'pre_validation',
      message: 'Pré-validation stricte de l’archive importée',
    });
    const sourceValidation = backupV2Validator.validateArchiveForFullRestore(options.archiveBuffer);
    if (sourceValidation.validation.status === 'incompatible' || !sourceValidation.manifest) {
      const details = sourceValidation.validation.errors
        .map((error) => `${error.code}: ${error.message}`)
        .join(' | ');
      throw new Error(`Archive ZIP importée invalide: ${details || 'manifest manquant'}`);
    }

    await options.onProgress?.({
      step: 'safety_backup',
      message: 'Création du backup de sécurité pré-restore',
    });
    const safetyBuild = await backupV2Builder.buildDbOnlyArchiveToFile({
      createdBy: {
        userId: options.triggeredBy.userId,
        email: options.triggeredBy.email,
      },
      notes: `Safety backup before restore-v2-full (uploaded zip: ${options.sourceFileName})`,
      includeObjects: true,
      strictMissingObjectFiles: true,
      onProgress: async ({ message }) => {
        await options.onProgress?.({
          step: 'safety_backup',
          message: `Backup de sécurité: ${message}`,
        });
      },
    });

    const safetyRecord = await prisma.adminBackupRecord.create({
      data: {
        createdById: options.triggeredBy.userId,
        scope: 'full-v2-safety',
        fileUrl: safetyBuild.fileUrl,
        checksum: safetyBuild.manifest.checksums.globalSha256,
        sizeBytes: safetyBuild.sizeBytes,
        note: `Safety backup auto avant restore-v2-full source=uploaded_zip:${options.sourceFileName}`,
        meta: {
          ...safetyBuild.manifest,
          safetyContext: {
            purpose: 'pre-restore-safety',
            sourceBackupId: 'uploaded-zip',
            sourceFileName: options.sourceFileName,
            createdAt: new Date().toISOString(),
          },
        },
      },
    });

    let rollbackAttempted = false;
    let rollbackSucceeded = false;
    let applicationStarted = false;
    const sourceObjectStorageKeys = sourceValidation.objectIndexEntries.map((entry) => entry.storageKey);

    try {
      const mainRestore = await this.performFullRestoreFromArchive({
        backupRecord: {
          id: 'uploaded-zip',
          fileUrl: options.sourceFileName,
          createdAtIso: new Date().toISOString(),
        },
        archiveBuffer: options.archiveBuffer,
        onProgress: async (progress) => {
          if (progress.step === 'purge_db' || progress.step === 'restore_db' || progress.step === 'restore_objects') {
            applicationStarted = true;
          }
          await options.onProgress?.(progress);
        },
      });

      return {
        ...mainRestore.result,
        finalState: 'success',
        safetyBackupId: safetyRecord.id,
        rollbackAttempted,
        rollbackSucceeded,
        errors: [],
        sourceBackupId: null,
        sourceBackupVersion: sourceValidation.manifest.backupVersion,
        sourceType: 'uploaded_zip',
        sourceFileName: options.sourceFileName,
      };
    } catch (restoreError) {
      const errors: BackupV2ValidationIssue[] = [
        this.errorAsIssue(
          restoreError,
          'RESTORE_FULL_PRIMARY_FAILED',
          'Échec du restore principal'
        ),
      ];

      if (!applicationStarted) {
        return {
          status: 'failed',
          backupVersion: sourceValidation.manifest.backupVersion,
          archiveMetadata: {
            backupId: 'uploaded-zip',
            fileUrl: options.sourceFileName,
            createdAt: new Date().toISOString(),
            appVersion: sourceValidation.manifest.appVersion,
            schemaVersion: sourceValidation.manifest.schemaVersion,
          },
          tablesRestored: [],
          rowCount: 0,
          purgeCount: 0,
          objectsRestored: 0,
          bytesObjectsRestored: 0,
          warnings: sourceValidation.validation.warnings,
          finalState: 'failed',
          safetyBackupId: safetyRecord.id,
          rollbackAttempted,
          rollbackSucceeded,
          errors,
          sourceBackupId: null,
          sourceBackupVersion: sourceValidation.manifest.backupVersion,
          sourceType: 'uploaded_zip',
          sourceFileName: options.sourceFileName,
        };
      }

      rollbackAttempted = true;
      await options.onProgress?.({
        step: 'rollback',
        message: `Échec restore principal: rollback auto depuis backup de sécurité ${safetyRecord.id}`,
      });

      try {
        const safetyArchiveBuffer = await adminBackupService.readArchiveFromFileUrl(safetyRecord.fileUrl);
        const rollbackRestore = await this.performFullRestoreFromArchive({
          backupRecord: {
            id: safetyRecord.id,
            fileUrl: safetyRecord.fileUrl,
            createdAtIso: safetyRecord.createdAt.toISOString(),
          },
          archiveBuffer: safetyArchiveBuffer,
          onProgress: async ({ message }) => {
            await options.onProgress?.({
              step: 'rollback',
              message: `Rollback: ${message}`,
            });
          },
        });
        rollbackSucceeded = true;

        const rollbackObjectStorageKeys = new Set(rollbackRestore.objectStorageKeys);
        const maybeOrphanKeys = [...new Set(sourceObjectStorageKeys)].filter(
          (key) => !rollbackObjectStorageKeys.has(key)
        );
        const rollbackWarnings = [...rollbackRestore.result.warnings];
        if (maybeOrphanKeys.length > 0) {
          rollbackWarnings.push({
            code: 'ROLLBACK_OBJECTS_POTENTIAL_ORPHANS',
            severity: 'warning',
            message:
              'Rollback DB+objets terminé, mais certains objets potentiellement écrits pendant l’échec initial peuvent rester sur le storage',
            context: {
              keyCount: maybeOrphanKeys.length,
              sampleKeys: maybeOrphanKeys.slice(0, 20),
            },
          });
        }

        return {
          ...rollbackRestore.result,
          warnings: rollbackWarnings,
          finalState: 'rolled_back',
          safetyBackupId: safetyRecord.id,
          rollbackAttempted,
          rollbackSucceeded,
          errors,
          sourceBackupId: null,
          sourceBackupVersion: sourceValidation.manifest.backupVersion,
          sourceType: 'uploaded_zip',
          sourceFileName: options.sourceFileName,
        };
      } catch (rollbackError) {
        errors.push(
          this.errorAsIssue(
            rollbackError,
            'RESTORE_FULL_ROLLBACK_FAILED',
            'Échec du rollback automatique'
          )
        );
        return {
          status: 'failed',
          backupVersion: sourceValidation.manifest.backupVersion,
          archiveMetadata: {
            backupId: 'uploaded-zip',
            fileUrl: options.sourceFileName,
            createdAt: new Date().toISOString(),
            appVersion: sourceValidation.manifest.appVersion,
            schemaVersion: sourceValidation.manifest.schemaVersion,
          },
          tablesRestored: [],
          rowCount: 0,
          purgeCount: 0,
          objectsRestored: 0,
          bytesObjectsRestored: 0,
          warnings: sourceValidation.validation.warnings,
          finalState: 'rollback_failed',
          safetyBackupId: safetyRecord.id,
          rollbackAttempted,
          rollbackSucceeded: false,
          errors,
          sourceBackupId: null,
          sourceBackupVersion: sourceValidation.manifest.backupVersion,
          sourceType: 'uploaded_zip',
          sourceFileName: options.sourceFileName,
        };
      }
    }
  }

  private async performFullRestoreFromArchive(input: {
    backupRecord: {
      id: string;
      fileUrl: string;
      createdAtIso: string;
    };
    archiveBuffer: Buffer;
    onProgress?: RestoreV2DbOnlyOptions['onProgress'];
  }): Promise<{
    result: RestoreV2FullResult;
    objectStorageKeys: string[];
  }> {
    await input.onProgress?.({
      step: 'validation',
      message: 'Validation complète de l’archive V2 (DB + objets)',
    });

    const validationOutput = backupV2Validator.validateArchiveForFullRestore(input.archiveBuffer);
    if (
      validationOutput.validation.status === 'incompatible' ||
      !validationOutput.manifest ||
      !validationOutput.dbOrder
    ) {
      const details = validationOutput.validation.errors
        .map((error) => `${error.code}: ${error.message}`)
        .join(' | ');
      throw new Error(`Archive V2 invalide pour restore complet: ${details || 'manifest/dbOrder manquant'}`);
    }

    const planner = backupV2RestorePlanner.buildPlan(
      validationOutput.dbOrder,
      Object.keys(validationOutput.datasetFilesByName)
    );
    if (planner.missingCriticalDatasets.length > 0) {
      throw new Error(
        `Datasets critiques manquants: ${planner.missingCriticalDatasets.join(', ')}`
      );
    }

    const warnings: BackupV2ValidationIssue[] = [...validationOutput.validation.warnings];
    if (planner.missingDatasets.length > 0) {
      warnings.push({
        code: 'RESTORE_PLAN_MISSING_DATASETS',
        severity: 'warning',
        message: `Datasets absents du restore: ${planner.missingDatasets.join(', ')}`,
      });
    }
    if (planner.unknownDatasetsInArchive.length > 0) {
      warnings.push({
        code: 'RESTORE_PLAN_UNKNOWN_DATASETS',
        severity: 'warning',
        message: `Datasets inconnus dans l'archive: ${planner.unknownDatasetsInArchive.join(', ')}`,
      });
    }

    await input.onProgress?.({
      step: 'purge_db',
      message: 'Purge full replace des datasets DB',
    });
    await input.onProgress?.({
      step: 'restore_db',
      message: 'Restauration des datasets DB',
    });
    const restoreStats = await backupV2DbRestoreService.restoreFullReplace({
      plan: planner,
      datasetFilesByName: validationOutput.datasetFilesByName,
    });
    warnings.push(...restoreStats.warnings);

    await input.onProgress?.({
      step: 'restore_objects',
      message: 'Restauration des objets/binaires',
    });
    const objectRestoreStats = await backupV2ObjectRestoreService.restoreObjects({
      archiveBuffer: input.archiveBuffer,
      objectIndexEntries: validationOutput.objectIndexEntries,
      strictDbConsistency: true,
    });
    warnings.push(...objectRestoreStats.warnings);
    if (objectRestoreStats.errors.length > 0) {
      const detail = objectRestoreStats.errors
        .map((error) => `${error.code}: ${error.message}`)
        .join(' | ');
      throw new Error(`Restauration objets échouée: ${detail}`);
    }

    await input.onProgress?.({
      step: 'verification',
      message: 'Vérifications post-restore complètes',
    });
    if (validationOutput.manifest.counts.rows !== restoreStats.rowsImported) {
      warnings.push({
        code: 'RESTORE_ROW_COUNT_MISMATCH',
        severity: 'warning',
        message: `rows du manifest (${validationOutput.manifest.counts.rows}) différent des lignes restaurées (${restoreStats.rowsImported})`,
      });
    }
    if (validationOutput.manifest.counts.objects !== objectRestoreStats.objectsRestored) {
      warnings.push({
        code: 'RESTORE_OBJECT_COUNT_MISMATCH',
        severity: 'warning',
        message: `objects du manifest (${validationOutput.manifest.counts.objects}) différent des objets restaurés (${objectRestoreStats.objectsRestored})`,
      });
    }

    await input.onProgress?.({
      step: 'finalization',
      message: 'Restore V2 complet finalisé',
    });

    return {
      result: {
        status: 'success',
        backupVersion: validationOutput.manifest.backupVersion,
        archiveMetadata: {
          backupId: input.backupRecord.id,
          fileUrl: input.backupRecord.fileUrl,
          createdAt: input.backupRecord.createdAtIso,
          appVersion: validationOutput.manifest.appVersion,
          schemaVersion: validationOutput.manifest.schemaVersion,
        },
        tablesRestored: restoreStats.tablesRestored,
        rowCount: restoreStats.rowsImported,
        purgeCount: restoreStats.rowsPurged,
        objectsRestored: objectRestoreStats.objectsRestored,
        bytesObjectsRestored: objectRestoreStats.bytesObjectsRestored,
        warnings,
      },
      objectStorageKeys: validationOutput.objectIndexEntries.map((entry) => entry.storageKey),
    };
  }

  private errorAsIssue(
    error: unknown,
    code: string,
    fallbackMessage: string
  ): BackupV2ValidationIssue {
    return {
      code,
      severity: 'blocking',
      message:
        error instanceof Error
          ? `${fallbackMessage}: ${error.message}`
          : fallbackMessage,
    };
  }
}

export const backupV2RestoreOrchestrator = new BackupV2RestoreOrchestrator();
