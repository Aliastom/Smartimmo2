import { prisma } from '@/lib/prisma';
import {
  adminBackupService,
  ExportOptions,
  ImportOptions,
} from '@/services/AdminBackupService';
import { backupV2Builder } from '@/services/backup/v2/BackupV2Builder';
import { backupV2RestoreOrchestrator } from '@/services/backup/v2/BackupV2RestoreOrchestrator';
import { backupV2Validator } from '@/services/backup/v2/BackupV2Validator';
import fs from 'fs/promises';
import path from 'path';

type AdminBackupJobState = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
type AdminBackupJobType =
  | 'export'
  | 'import'
  | 'restore'
  | 'export-v2'
  | 'restore-v2-db'
  | 'restore-v2-full';

interface StartExportJobInput {
  userId: string;
  options: ExportOptions;
}

interface StartExportV2JobInput {
  userId: string;
  userEmail?: string;
}

interface StartImportJobInput {
  userId: string;
  archiveBuffer: Buffer;
  options: ImportOptions;
}

interface StartRestoreJobInput {
  userId: string;
  backupId: string;
  options: ImportOptions;
}

interface StartRestoreV2DbJobInput {
  userId: string;
  backupId: string;
  mode: 'full-replace';
}

interface StartRestoreV2FullJobInput {
  userId: string;
  userEmail?: string;
  backupId: string;
  mode: 'full-replace';
}

interface StartRestoreV2FullUploadJobInput {
  userId: string;
  userEmail?: string;
  archiveBuffer: Buffer;
  sourceFileName: string;
  mode: 'full-replace';
}

interface JobLogEntry {
  at: string;
  message: string;
}

export class AdminBackupJobService {
  async startExportJob(input: StartExportJobInput): Promise<string> {
    const job = await this.createJobWithLock({
      type: 'export',
      userId: input.userId,
      lockAgainst: ['restore', 'restore-v2-db', 'restore-v2-full'],
      initialStep: 'Préparation',
    });

    void this.runExportJob(job.id, input.userId, input.options);
    return job.id;
  }

  async startExportV2Job(input: StartExportV2JobInput): Promise<string> {
    const job = await this.createJobWithLock({
      type: 'export-v2',
      scope: 'full-v2-db',
      userId: input.userId,
      lockAgainst: ['restore', 'restore-v2-db', 'restore-v2-full'],
      initialStep: 'Préparation',
    });

    void this.runExportV2Job(job.id, input);
    return job.id;
  }

  async startImportJob(input: StartImportJobInput): Promise<string> {
    const archiveFileUrl = await this.persistJobArchive(input.archiveBuffer, 'admin-import-job');
    const job = await this.createJobWithLock({
      type: 'import',
      userId: input.userId,
      lockAgainst: ['import', 'restore', 'restore-v2-db', 'restore-v2-full'],
      initialStep: 'Préparation',
    });

    void this.runImportJob(job.id, input.userId, archiveFileUrl, input.options);
    return job.id;
  }

  async startRestoreJob(input: StartRestoreJobInput): Promise<string> {
    const backupRecord = await adminBackupService.getBackupById(input.backupId);
    if (!backupRecord) {
      throw new Error('Backup introuvable');
    }

    let archiveBuffer: Buffer;
    try {
      archiveBuffer = await adminBackupService.readArchiveFromFileUrl(backupRecord.fileUrl);
    } catch {
      throw new Error('Archive introuvable ou illisible');
    }

    await adminBackupService.preValidateArchiveBuffer(archiveBuffer);

    const job = await this.createJobWithLock({
      type: 'restore',
      userId: input.userId,
      lockAgainst: ['export', 'import', 'restore', 'export-v2', 'restore-v2-db', 'restore-v2-full'],
      initialStep: 'Préparation',
    });

    void this.runRestoreJob(job.id, input.userId, input.backupId, input.options);
    return job.id;
  }

  async startRestoreV2DbJob(input: StartRestoreV2DbJobInput): Promise<string> {
    const backupRecord = await adminBackupService.getBackupById(input.backupId);
    if (!backupRecord) {
      throw new Error('Backup V2 introuvable');
    }

    const job = await this.createJobWithLock({
      type: 'restore-v2-db',
      scope: 'full-v2-restore-db',
      userId: input.userId,
      lockAgainst: ['export', 'import', 'restore', 'export-v2', 'restore-v2-db', 'restore-v2-full'],
      initialStep: 'Préparation',
    });

    void this.runRestoreV2DbJob(job.id, input);
    return job.id;
  }

  async startRestoreV2FullJob(input: StartRestoreV2FullJobInput): Promise<string> {
    const backupRecord = await adminBackupService.getBackupById(input.backupId);
    if (!backupRecord) {
      throw new Error('Backup V2 introuvable');
    }

    const job = await this.createJobWithLock({
      type: 'restore-v2-full',
      scope: 'full-v2-restore-full',
      userId: input.userId,
      lockAgainst: ['export', 'import', 'restore', 'export-v2', 'restore-v2-db', 'restore-v2-full'],
      initialStep: 'Préparation',
    });

    void this.runRestoreV2FullJob(job.id, input);
    return job.id;
  }

  async startRestoreV2FullUploadJob(input: StartRestoreV2FullUploadJobInput): Promise<string> {
    const validation = backupV2Validator.validateArchiveForFullRestore(input.archiveBuffer);
    if (validation.validation.status === 'incompatible') {
      const details = validation.validation.errors
        .map((error) => `${error.code}: ${error.message}`)
        .join(' | ');
      throw new Error(`Archive ZIP invalide pour restore V2 complet: ${details}`);
    }

    const archiveFileUrl = await this.persistJobArchive(input.archiveBuffer, 'restore-v2-full-upload');
    const job = await this.createJobWithLock({
      type: 'restore-v2-full',
      scope: 'full-v2-restore-upload',
      userId: input.userId,
      lockAgainst: ['export', 'import', 'restore', 'export-v2', 'restore-v2-db', 'restore-v2-full'],
      initialStep: 'Préparation',
    });

    void this.runRestoreV2FullUploadJob(job.id, input, archiveFileUrl);
    return job.id;
  }

  async getJobById(jobId: string) {
    return prisma.adminBackupJob.findUnique({ where: { id: jobId } });
  }

  private async createJobWithLock(input: {
    type: AdminBackupJobType;
    scope?: string;
    userId: string;
    lockAgainst: AdminBackupJobType[];
    initialStep: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const conflictingJob = await tx.adminBackupJob.findFirst({
        where: {
          state: { in: ['pending', 'running'] },
          type: { in: input.lockAgainst },
        },
        select: { id: true, type: true, state: true },
      });

      if (conflictingJob) {
        throw new Error(
          `Opération bloquée: un job ${conflictingJob.type} est déjà ${conflictingJob.state}`
        );
      }

      return tx.adminBackupJob.create({
        data: {
          type: input.type,
          scope: input.scope || 'admin',
          state: 'pending',
          currentStep: input.initialStep,
          progressPercent: 0,
          createdById: input.userId,
          logs: [],
        },
        select: { id: true },
      });
    });
  }

  private async runExportJob(jobId: string, userId: string, options: ExportOptions) {
    try {
      await this.updateJob(jobId, {
        state: 'running',
        currentStep: 'Préparation',
        progressPercent: 5,
        startedAt: new Date(),
      }, 'Job export initialisé');

      await this.updateJob(
        jobId,
        { currentStep: 'Analyse des données', progressPercent: 20 },
        'Analyse des datasets admin'
      );

      await this.updateJob(
        jobId,
        { currentStep: 'Export base', progressPercent: 55 },
        'Génération de l’archive ZIP'
      );
      const exportResult = await adminBackupService.exportAdminAndSave(options, userId);

      await this.updateJob(
        jobId,
        { currentStep: 'Finalisation', progressPercent: 90 },
        'Archive persistée, finalisation en cours'
      );

      await this.completeJob(jobId, {
        backupRecordId: exportResult.backupRecordId,
        fileUrl: exportResult.fileUrl,
        sizeBytes: exportResult.sizeBytes,
        checksumGlobal: exportResult.checksumGlobal,
        downloadUrl: `/api/admin/backup/download/${exportResult.backupRecordId}`,
      }, exportResult.backupRecordId, 'Export terminé avec succès');
    } catch (error) {
      await this.failJob(jobId, error, 'Échec du job export');
    }
  }

  private async runExportV2Job(jobId: string, input: StartExportV2JobInput) {
    try {
      await this.updateJob(
        jobId,
        {
          state: 'running',
          currentStep: 'Préparation',
          progressPercent: 5,
          startedAt: new Date(),
        },
        'Job export-v2 initialisé'
      );

      await this.updateJob(
        jobId,
        { currentStep: 'Analyse', progressPercent: 20 },
        'Planification des datasets DB V2'
      );
      const buildResult = await backupV2Builder.buildDbOnlyArchiveToFile({
        createdBy: {
          userId: input.userId,
          email: input.userEmail,
        },
        notes: 'Phase 2B: DB + objects export',
        includeObjects: true,
        strictMissingObjectFiles: true,
        onProgress: async ({ step, message }) => {
          if (step === 'export_db') {
            await this.updateJob(
              jobId,
              { currentStep: 'Export DB', progressPercent: 45 },
              message
            );
            return;
          }
          if (step === 'export_objects') {
            await this.updateJob(
              jobId,
              { currentStep: 'Export objets', progressPercent: 70 },
              message
            );
            return;
          }
          if (step === 'generate_archive') {
            await this.updateJob(
              jobId,
              { currentStep: 'Génération archive', progressPercent: 85 },
              message
            );
            return;
          }
          if (step === 'finalization') {
            await this.updateJob(
              jobId,
              { currentStep: 'Finalisation', progressPercent: 95 },
              message
            );
          }
        },
      });

      const backupRecord = await prisma.adminBackupRecord.create({
        data: {
          createdById: input.userId,
          scope: 'full-v2',
          fileUrl: buildResult.fileUrl,
          checksum: buildResult.manifest.checksums.globalSha256,
          sizeBytes: buildResult.sizeBytes,
          note: 'Backup V2 DB+objects (Phase 2B)',
          meta: buildResult.manifest,
        },
      });

      await this.updateJob(
        jobId,
        { currentStep: 'Finalisation', progressPercent: 98 },
        'Persisté dans l’historique de sauvegarde'
      );

      await this.completeJob(
        jobId,
        {
          backupVersion: buildResult.manifest.backupVersion,
          backupRecordId: backupRecord.id,
          fileUrl: buildResult.fileUrl,
          sizeBytes: buildResult.sizeBytes,
          rowCount: buildResult.rowCount,
          datasetCount: buildResult.datasetCount,
          objectCount: buildResult.objectCount,
          bytesObjects: buildResult.bytesObjects,
          checksumGlobal: buildResult.manifest.checksums.globalSha256,
          downloadUrl: `/api/admin/backup/download/${backupRecord.id}`,
        },
        backupRecord.id,
        'Export-v2 terminé avec succès'
      );
    } catch (error) {
      await this.failJob(jobId, error, 'Échec du job export-v2');
    }
  }

  private async runImportJob(
    jobId: string,
    userId: string,
    archiveFileUrl: string,
    options: ImportOptions
  ) {
    try {
      await this.updateJob(
        jobId,
        { state: 'running', currentStep: 'Préparation', progressPercent: 5, startedAt: new Date() },
        'Job import initialisé'
      );

      await this.updateJob(
        jobId,
        { currentStep: 'Lecture archive', progressPercent: 20 },
        'Lecture de l’archive importée'
      );
      const buffer = await adminBackupService.readArchiveFromFileUrl(archiveFileUrl);

      await this.updateJob(
        jobId,
        { currentStep: 'Validation', progressPercent: 40 },
        'Validation de la structure et des checksums'
      );
      const preflight = await adminBackupService.preValidateArchiveBuffer(buffer);

      await this.updateJob(
        jobId,
        { currentStep: 'Import des datasets', progressPercent: 70 },
        'Application des datasets admin'
      );
      const importResult = await adminBackupService.importAdmin(buffer, options, userId);

      await this.updateJob(
        jobId,
        { currentStep: 'Finalisation', progressPercent: 90 },
        'Finalisation du traitement d’import'
      );

      if (!importResult.success) {
        throw new Error(importResult.errors?.join(' | ') || 'Import échoué');
      }

      await prisma.appConfig.upsert({
        where: { key: 'last_backup_import' },
        update: {
          value: JSON.stringify({
            timestamp: new Date().toISOString(),
            userId,
            mode: options.mode,
            strategy: options.strategy,
            backupRecordId: importResult.backupRecordId,
          }),
        },
        create: {
          key: 'last_backup_import',
          value: JSON.stringify({
            timestamp: new Date().toISOString(),
            userId,
            mode: options.mode,
            strategy: options.strategy,
            backupRecordId: importResult.backupRecordId,
          }),
          description: 'Dernier import de backup admin',
        },
      });

      await this.completeJob(
        jobId,
        {
          mode: options.mode,
          strategy: options.strategy,
          datasetCount: preflight.datasetCount,
          manifest: preflight.manifest,
          diff: importResult.diff,
          applied: importResult.applied,
          backupRecordId: importResult.backupRecordId,
          logs: importResult.logs || [],
        },
        importResult.backupRecordId,
        'Import terminé avec succès'
      );
    } catch (error) {
      await this.failJob(jobId, error, 'Échec du job import');
    } finally {
      await this.safeDeleteArchive(archiveFileUrl);
    }
  }

  private async runRestoreJob(
    jobId: string,
    userId: string,
    backupId: string,
    options: ImportOptions
  ) {
    try {
      await this.updateJob(
        jobId,
        { state: 'running', currentStep: 'Préparation', progressPercent: 5, startedAt: new Date() },
        'Job restore initialisé'
      );

      const backupRecord = await adminBackupService.getBackupById(backupId);
      if (!backupRecord) {
        throw new Error('Backup introuvable');
      }

      await this.updateJob(
        jobId,
        { currentStep: 'Chargement archive', progressPercent: 20 },
        'Chargement de l’archive depuis l’historique'
      );
      const buffer = await adminBackupService.readArchiveFromFileUrl(backupRecord.fileUrl);

      await this.updateJob(
        jobId,
        { currentStep: 'Validation', progressPercent: 40 },
        'Validation de l’archive de restauration'
      );
      const preflight = await adminBackupService.preValidateArchiveBuffer(buffer);

      await this.updateJob(
        jobId,
        { currentStep: 'Restauration', progressPercent: 70 },
        'Application de la restauration admin'
      );
      const restoreResult = await adminBackupService.importAdmin(buffer, options, userId);
      if (!restoreResult.success) {
        throw new Error(restoreResult.errors?.join(' | ') || 'Restauration échouée');
      }

      await prisma.appConfig.upsert({
        where: { key: 'last_backup_restore' },
        update: {
          value: JSON.stringify({
            timestamp: new Date().toISOString(),
            userId,
            backupId,
            mode: options.mode,
            strategy: options.strategy,
          }),
        },
        create: {
          key: 'last_backup_restore',
          value: JSON.stringify({
            timestamp: new Date().toISOString(),
            userId,
            backupId,
            mode: options.mode,
            strategy: options.strategy,
          }),
          description: 'Dernière restauration de backup admin',
        },
      });

      await this.updateJob(
        jobId,
        { currentStep: 'Finalisation', progressPercent: 90 },
        'Finalisation du restore'
      );

      await this.completeJob(
        jobId,
        {
          sourceBackupId: backupId,
          sourceBackupCreatedAt: backupRecord.createdAt,
          mode: options.mode,
          strategy: options.strategy,
          datasetCount: preflight.datasetCount,
          manifest: preflight.manifest,
          diff: restoreResult.diff,
          applied: restoreResult.applied,
          logs: restoreResult.logs || [],
        },
        backupRecord.id,
        'Restauration terminée avec succès'
      );
    } catch (error) {
      await this.failJob(jobId, error, 'Échec du job restore');
    }
  }

  private async runRestoreV2DbJob(jobId: string, input: StartRestoreV2DbJobInput) {
    try {
      await this.updateJob(
        jobId,
        {
          state: 'running',
          currentStep: 'Préparation',
          progressPercent: 5,
          startedAt: new Date(),
        },
        'Job restore-v2-db initialisé'
      );

      const restoreResult = await backupV2RestoreOrchestrator.restoreDbOnly({
        backupId: input.backupId,
        mode: input.mode,
        onProgress: async ({ step, message }) => {
          if (step === 'loading_archive') {
            await this.updateJob(
              jobId,
              { currentStep: 'Chargement archive', progressPercent: 20 },
              message
            );
            return;
          }
          if (step === 'validation') {
            await this.updateJob(
              jobId,
              { currentStep: 'Validation', progressPercent: 35 },
              message
            );
            return;
          }
          if (step === 'purge_db') {
            await this.updateJob(
              jobId,
              { currentStep: 'Purge DB', progressPercent: 55 },
              message
            );
            return;
          }
          if (step === 'restore_db') {
            await this.updateJob(
              jobId,
              { currentStep: 'Restauration DB', progressPercent: 75 },
              message
            );
            return;
          }
          if (step === 'verification') {
            await this.updateJob(
              jobId,
              { currentStep: 'Vérification finale', progressPercent: 90 },
              message
            );
            return;
          }
          if (step === 'finalization') {
            await this.updateJob(
              jobId,
              { currentStep: 'Finalisation', progressPercent: 96 },
              message
            );
          }
        },
      });

      await prisma.appConfig.upsert({
        where: { key: 'last_backup_restore_v2_db' },
        update: {
          value: JSON.stringify({
            timestamp: new Date().toISOString(),
            userId: input.userId,
            backupId: input.backupId,
            mode: input.mode,
          }),
        },
        create: {
          key: 'last_backup_restore_v2_db',
          value: JSON.stringify({
            timestamp: new Date().toISOString(),
            userId: input.userId,
            backupId: input.backupId,
            mode: input.mode,
          }),
          description: 'Dernière restauration V2 DB-only',
        },
      });

      await this.completeJob(
        jobId,
        {
          backupVersion: restoreResult.backupVersion,
          backupId: input.backupId,
          mode: input.mode,
          sourceType: 'history',
          tablesRestored: restoreResult.tablesRestored,
          rowCount: restoreResult.rowCount,
          purgeCount: restoreResult.purgeCount,
          warnings: restoreResult.warnings,
          archiveMetadata: restoreResult.archiveMetadata,
        },
        input.backupId,
        'Restore-v2-db terminé avec succès'
      );
    } catch (error) {
      await this.failJob(jobId, error, 'Échec du job restore-v2-db');
    }
  }

  private async runRestoreV2FullJob(jobId: string, input: StartRestoreV2FullJobInput) {
    try {
      await this.updateJob(
        jobId,
        {
          state: 'running',
          currentStep: 'Préparation',
          progressPercent: 5,
          startedAt: new Date(),
        },
        'Job restore-v2-full initialisé'
      );

      const restoreResult = await backupV2RestoreOrchestrator.restoreFullWithSafety({
        backupId: input.backupId,
        mode: input.mode,
        triggeredBy: {
          userId: input.userId,
          email: input.userEmail,
        },
        onProgress: async ({ step, message }) => {
          if (step === 'pre_validation') {
            await this.updateJob(
              jobId,
              { currentStep: 'Pré-validation', progressPercent: 12 },
              message
            );
            return;
          }
          if (step === 'safety_backup') {
            await this.updateJob(
              jobId,
              { currentStep: 'Backup de sécurité', progressPercent: 25 },
              message
            );
            return;
          }
          if (step === 'loading_archive') {
            await this.updateJob(
              jobId,
              { currentStep: 'Chargement archive', progressPercent: 35 },
              message
            );
            return;
          }
          if (step === 'validation') {
            await this.updateJob(
              jobId,
              { currentStep: 'Validation', progressPercent: 45 },
              message
            );
            return;
          }
          if (step === 'purge_db') {
            await this.updateJob(
              jobId,
              { currentStep: 'Purge DB', progressPercent: 58 },
              message
            );
            return;
          }
          if (step === 'restore_db') {
            await this.updateJob(
              jobId,
              { currentStep: 'Restauration DB', progressPercent: 70 },
              message
            );
            return;
          }
          if (step === 'restore_objects') {
            await this.updateJob(
              jobId,
              { currentStep: 'Restauration objets', progressPercent: 82 },
              message
            );
            return;
          }
          if (step === 'rollback') {
            await this.updateJob(
              jobId,
              { currentStep: 'Rollback automatique', progressPercent: 90 },
              message
            );
            return;
          }
          if (step === 'verification') {
            await this.updateJob(
              jobId,
              { currentStep: 'Vérification finale', progressPercent: 94 },
              message
            );
            return;
          }
          if (step === 'finalization') {
            await this.updateJob(
              jobId,
              { currentStep: 'Finalisation', progressPercent: 97 },
              message
            );
          }
        },
      });

      await prisma.appConfig.upsert({
        where: { key: 'last_backup_restore_v2_full' },
        update: {
          value: JSON.stringify({
            timestamp: new Date().toISOString(),
            userId: input.userId,
            backupId: input.backupId,
            mode: input.mode,
            finalState: restoreResult.finalState,
            safetyBackupId: restoreResult.safetyBackupId,
            rollbackAttempted: restoreResult.rollbackAttempted,
            rollbackSucceeded: restoreResult.rollbackSucceeded,
          }),
        },
        create: {
          key: 'last_backup_restore_v2_full',
          value: JSON.stringify({
            timestamp: new Date().toISOString(),
            userId: input.userId,
            backupId: input.backupId,
            mode: input.mode,
            finalState: restoreResult.finalState,
            safetyBackupId: restoreResult.safetyBackupId,
            rollbackAttempted: restoreResult.rollbackAttempted,
            rollbackSucceeded: restoreResult.rollbackSucceeded,
          }),
          description: 'Dernière restauration V2 complète (DB+objets)',
        },
      });

      const resultPayload = {
        backupVersion: restoreResult.backupVersion,
        backupId: input.backupId,
        mode: input.mode,
        finalState: restoreResult.finalState,
        safetyBackupId: restoreResult.safetyBackupId,
        rollbackAttempted: restoreResult.rollbackAttempted,
        rollbackSucceeded: restoreResult.rollbackSucceeded,
        tablesRestored: restoreResult.tablesRestored,
        rowCount: restoreResult.rowCount,
        purgeCount: restoreResult.purgeCount,
        objectsRestored: restoreResult.objectsRestored,
        bytesObjectsRestored: restoreResult.bytesObjectsRestored,
        warnings: restoreResult.warnings,
        errors: restoreResult.errors,
        archiveMetadata: restoreResult.archiveMetadata,
        sourceBackupId: restoreResult.sourceBackupId,
        sourceBackupVersion: restoreResult.sourceBackupVersion,
      };

      if (restoreResult.finalState === 'success') {
        await this.completeJob(
          jobId,
          resultPayload,
          input.backupId,
          'Restore-v2-full terminé avec succès'
        );
        return;
      }

      if (restoreResult.finalState === 'rolled_back') {
        await this.completeJob(
          jobId,
          resultPayload,
          restoreResult.safetyBackupId || input.backupId,
          'Restore-v2-full compensé par rollback automatique'
        );
        return;
      }

      const terminalMessage =
        restoreResult.finalState === 'rollback_failed'
          ? 'Restore-v2-full en échec critique: rollback automatique échoué'
          : 'Restore-v2-full échoué avant application complète';
      await this.failJob(
        jobId,
        new Error(terminalMessage),
        'Échec du job restore-v2-full',
        resultPayload
      );
    } catch (error) {
      await this.failJob(jobId, error, 'Échec du job restore-v2-full');
    }
  }

  private async runRestoreV2FullUploadJob(
    jobId: string,
    input: StartRestoreV2FullUploadJobInput,
    archiveFileUrl: string
  ) {
    try {
      await this.updateJob(
        jobId,
        {
          state: 'running',
          currentStep: 'Préparation',
          progressPercent: 5,
          startedAt: new Date(),
        },
        `Job restore-v2-full upload initialisé (${input.sourceFileName})`
      );

      const archiveBuffer = await adminBackupService.readArchiveFromFileUrl(archiveFileUrl);
      const restoreResult = await backupV2RestoreOrchestrator.restoreFullWithSafetyFromArchiveBuffer({
        archiveBuffer,
        sourceFileName: input.sourceFileName,
        mode: input.mode,
        triggeredBy: {
          userId: input.userId,
          email: input.userEmail,
        },
        onProgress: async ({ step, message }) => {
          if (step === 'pre_validation') {
            await this.updateJob(
              jobId,
              { currentStep: 'Pré-validation ZIP', progressPercent: 12 },
              message
            );
            return;
          }
          if (step === 'safety_backup') {
            await this.updateJob(
              jobId,
              { currentStep: 'Backup de sécurité', progressPercent: 25 },
              message
            );
            return;
          }
          if (step === 'validation') {
            await this.updateJob(
              jobId,
              { currentStep: 'Validation archive', progressPercent: 45 },
              message
            );
            return;
          }
          if (step === 'purge_db') {
            await this.updateJob(
              jobId,
              { currentStep: 'Purge DB', progressPercent: 58 },
              message
            );
            return;
          }
          if (step === 'restore_db') {
            await this.updateJob(
              jobId,
              { currentStep: 'Restauration DB', progressPercent: 70 },
              message
            );
            return;
          }
          if (step === 'restore_objects') {
            await this.updateJob(
              jobId,
              { currentStep: 'Restauration objets', progressPercent: 82 },
              message
            );
            return;
          }
          if (step === 'rollback') {
            await this.updateJob(
              jobId,
              { currentStep: 'Rollback automatique', progressPercent: 90 },
              message
            );
            return;
          }
          if (step === 'verification') {
            await this.updateJob(
              jobId,
              { currentStep: 'Vérification finale', progressPercent: 94 },
              message
            );
            return;
          }
          if (step === 'finalization') {
            await this.updateJob(
              jobId,
              { currentStep: 'Finalisation', progressPercent: 97 },
              message
            );
          }
        },
      });

      const resultPayload = {
        backupVersion: restoreResult.backupVersion,
        mode: input.mode,
        sourceType: 'uploaded_zip',
        sourceFileName: input.sourceFileName,
        finalState: restoreResult.finalState,
        safetyBackupId: restoreResult.safetyBackupId,
        rollbackAttempted: restoreResult.rollbackAttempted,
        rollbackSucceeded: restoreResult.rollbackSucceeded,
        tablesRestored: restoreResult.tablesRestored,
        rowCount: restoreResult.rowCount,
        purgeCount: restoreResult.purgeCount,
        objectsRestored: restoreResult.objectsRestored,
        bytesObjectsRestored: restoreResult.bytesObjectsRestored,
        warnings: restoreResult.warnings,
        errors: restoreResult.errors,
        archiveMetadata: restoreResult.archiveMetadata,
        sourceBackupId: restoreResult.sourceBackupId,
        sourceBackupVersion: restoreResult.sourceBackupVersion,
      };

      if (restoreResult.finalState === 'success' || restoreResult.finalState === 'rolled_back') {
        await this.completeJob(
          jobId,
          resultPayload,
          restoreResult.safetyBackupId || undefined,
          restoreResult.finalState === 'success'
            ? 'Restore-v2-full (ZIP importé) terminé avec succès'
            : 'Restore-v2-full (ZIP importé) compensé par rollback automatique'
        );
        return;
      }

      const terminalMessage =
        restoreResult.finalState === 'rollback_failed'
          ? 'Restore-v2-full ZIP en échec critique: rollback automatique échoué'
          : 'Restore-v2-full ZIP échoué avant application complète';
      await this.failJob(
        jobId,
        new Error(terminalMessage),
        'Échec du job restore-v2-full ZIP',
        resultPayload
      );
    } catch (error) {
      await this.failJob(jobId, error, 'Échec du job restore-v2-full ZIP');
    } finally {
      await this.safeDeleteArchive(archiveFileUrl);
    }
  }

  private async completeJob(
    jobId: string,
    result: Record<string, unknown>,
    backupRecordId: string | undefined,
    message: string
  ) {
    await prisma.adminBackupJob.update({
      where: { id: jobId },
      data: {
        state: 'completed',
        currentStep: 'Terminé',
        progressPercent: 100,
        endedAt: new Date(),
        backupRecordId,
        result,
        logs: await this.appendLog(jobId, message),
      },
    });
  }

  private async failJob(
    jobId: string,
    error: unknown,
    context: string,
    result?: Record<string, unknown>
  ) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue';
    await prisma.adminBackupJob.update({
      where: { id: jobId },
      data: {
        state: 'failed',
        currentStep: 'Échec',
        endedAt: new Date(),
        error: { message, context },
        result,
        logs: await this.appendLog(jobId, `${context}: ${message}`),
      },
    });
  }

  private async updateJob(
    jobId: string,
    data: {
      state?: AdminBackupJobState;
      currentStep?: string;
      progressPercent?: number;
      startedAt?: Date;
    },
    logMessage?: string
  ) {
    const updateData: Record<string, unknown> = { ...data };
    if (logMessage) {
      updateData.logs = await this.appendLog(jobId, logMessage);
    }

    await prisma.adminBackupJob.update({
      where: { id: jobId },
      data: updateData,
    });
  }

  private async persistJobArchive(buffer: Buffer, prefix: string): Promise<string> {
    const backupDir = path.join(process.cwd(), 'storage', 'backups', 'admin', 'jobs');
    await fs.mkdir(backupDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = Math.random().toString(36).slice(2, 8);
    const fileName = `${prefix}-${stamp}-${random}.zip`;
    const fullPath = path.join(backupDir, fileName);
    await fs.writeFile(fullPath, buffer);
    return path.relative(process.cwd(), fullPath).replace(/\\/g, '/');
  }

  private async safeDeleteArchive(fileUrl: string) {
    try {
      const fullPath = adminBackupService.resolveBackupAbsolutePath(fileUrl);
      await fs.unlink(fullPath);
    } catch {
      // Ignore les erreurs de nettoyage
    }
  }

  private async appendLog(jobId: string, message: string): Promise<JobLogEntry[]> {
    const existing = await prisma.adminBackupJob.findUnique({
      where: { id: jobId },
      select: { logs: true },
    });
    const currentLogs = Array.isArray(existing?.logs) ? (existing.logs as JobLogEntry[]) : [];
    return [
      ...currentLogs,
      { at: new Date().toISOString(), message },
    ];
  }
}

export const adminBackupJobService = new AdminBackupJobService();
