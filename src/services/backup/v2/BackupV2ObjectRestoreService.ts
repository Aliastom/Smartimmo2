import AdmZip from 'adm-zip';
import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';
import { getStorageService } from '@/services/storage.service';
import { BackupV2ValidationIssue, ObjectIndexEntryV2 } from './BackupV2Contract';

export interface BackupV2ObjectRestoreStats {
  objectsRestored: number;
  bytesObjectsRestored: number;
  objectsIgnored: number;
  warnings: BackupV2ValidationIssue[];
  errors: BackupV2ValidationIssue[];
}

interface RestoreObjectsInput {
  archiveBuffer: Buffer;
  objectIndexEntries: ObjectIndexEntryV2[];
  strictDbConsistency?: boolean;
  onProgress?: (progress: {
    restored: number;
    total: number;
    objectId: string;
  }) => Promise<void> | void;
}

export class BackupV2ObjectRestoreService {
  async restoreObjects(input: RestoreObjectsInput): Promise<BackupV2ObjectRestoreStats> {
    const strictDbConsistency = input.strictDbConsistency !== false;
    const storageService = getStorageService();
    const zip = new AdmZip(input.archiveBuffer);
    const warnings: BackupV2ValidationIssue[] = [];
    const errors: BackupV2ValidationIssue[] = [];
    let objectsRestored = 0;
    let bytesObjectsRestored = 0;
    let objectsIgnored = 0;

    const documentIds = input.objectIndexEntries
      .map((entry) => entry.documentId)
      .filter((value): value is string => typeof value === 'string' && value.length > 0);
    const uniqueDocumentIds = [...new Set(documentIds)];
    const existingDocumentRows = uniqueDocumentIds.length
      ? await prisma.document.findMany({
          where: { id: { in: uniqueDocumentIds } },
          select: { id: true },
        })
      : [];
    const existingDocumentSet = new Set(existingDocumentRows.map((row) => row.id));

    for (let index = 0; index < input.objectIndexEntries.length; index++) {
      const entry = input.objectIndexEntries[index];

      if (entry.documentId && !existingDocumentSet.has(entry.documentId)) {
        const issue: BackupV2ValidationIssue = {
          code: 'OBJECT_RESTORE_DB_INCONSISTENT_DOCUMENT',
          severity: strictDbConsistency ? 'blocking' : 'warning',
          path: 'objects/index.ndjson',
          message: `Objet ${entry.objectId} référencé sur un document absent après restore DB`,
          context: {
            objectId: entry.objectId,
            documentId: entry.documentId,
          },
        };
        if (strictDbConsistency) {
          errors.push(issue);
          continue;
        }
        warnings.push(issue);
        objectsIgnored += 1;
        continue;
      }

      const archiveEntry = zip.getEntry(entry.relativePath);
      if (!archiveEntry) {
        errors.push({
          code: 'OBJECT_RESTORE_ARCHIVE_BLOB_MISSING',
          severity: 'blocking',
          path: entry.relativePath,
          message: `Blob manquant dans l’archive pour ${entry.objectId}`,
          context: { objectId: entry.objectId, relativePath: entry.relativePath },
        });
        continue;
      }

      const blobBuffer = archiveEntry.getData();
      const archiveSha256 = this.sha256(blobBuffer);
      if (archiveSha256 !== entry.sha256.toLowerCase()) {
        errors.push({
          code: 'OBJECT_RESTORE_HASH_MISMATCH_ARCHIVE',
          severity: 'blocking',
          path: entry.relativePath,
          message: `Hash archive différent du hash index pour ${entry.objectId}`,
          context: {
            objectId: entry.objectId,
            expected: entry.sha256.toLowerCase(),
            actual: archiveSha256,
          },
        });
        continue;
      }

      try {
        // En full replace, la clé cible est déterministe: on réinjecte sur storageKey.
        await storageService.uploadWithKey(blobBuffer, entry.storageKey, entry.mime);
      } catch (error) {
        errors.push({
          code: 'OBJECT_RESTORE_UPLOAD_FAILED',
          severity: 'blocking',
          path: entry.storageKey,
          message: `Échec upload storage pour ${entry.objectId}`,
          context: {
            objectId: entry.objectId,
            reason: error instanceof Error ? error.message : 'Erreur inconnue',
          },
        });
        continue;
      }

      let restoredBuffer: Buffer;
      try {
        const exists = await storageService.documentExists(entry.storageKey);
        if (!exists) {
          errors.push({
            code: 'OBJECT_RESTORE_MISSING_AFTER_UPLOAD',
            severity: 'blocking',
            path: entry.storageKey,
            message: `Objet non trouvé après upload pour ${entry.objectId}`,
            context: { objectId: entry.objectId },
          });
          continue;
        }
        restoredBuffer = await storageService.downloadDocument(entry.storageKey);
      } catch (error) {
        errors.push({
          code: 'OBJECT_RESTORE_VERIFY_DOWNLOAD_FAILED',
          severity: 'blocking',
          path: entry.storageKey,
          message: `Impossible de vérifier l’objet restauré ${entry.objectId}`,
          context: {
            objectId: entry.objectId,
            reason: error instanceof Error ? error.message : 'Erreur inconnue',
          },
        });
        continue;
      }

      const restoredSha256 = this.sha256(restoredBuffer);
      if (restoredSha256 !== entry.sha256.toLowerCase()) {
        errors.push({
          code: 'OBJECT_RESTORE_HASH_MISMATCH_STORAGE',
          severity: 'blocking',
          path: entry.storageKey,
          message: `Hash restauré différent du hash attendu pour ${entry.objectId}`,
          context: {
            objectId: entry.objectId,
            expected: entry.sha256.toLowerCase(),
            actual: restoredSha256,
          },
        });
        continue;
      }

      if (restoredBuffer.byteLength !== entry.size) {
        errors.push({
          code: 'OBJECT_RESTORE_SIZE_MISMATCH_STORAGE',
          severity: 'blocking',
          path: entry.storageKey,
          message: `Taille restaurée différente de la taille attendue pour ${entry.objectId}`,
          context: {
            objectId: entry.objectId,
            expected: entry.size,
            actual: restoredBuffer.byteLength,
          },
        });
        continue;
      }

      objectsRestored += 1;
      bytesObjectsRestored += restoredBuffer.byteLength;

      await input.onProgress?.({
        restored: objectsRestored,
        total: input.objectIndexEntries.length,
        objectId: entry.objectId,
      });
    }

    return {
      objectsRestored,
      bytesObjectsRestored,
      objectsIgnored,
      warnings,
      errors,
    };
  }

  private sha256(content: Buffer): string {
    return createHash('sha256').update(content).digest('hex');
  }
}

export const backupV2ObjectRestoreService = new BackupV2ObjectRestoreService();
