import { createHash } from 'crypto';
import type { ObjectIndexEntryV2 } from '@/services/backup/v2/BackupV2Contract';
import type { LmnpAttachmentExportSummary } from '@/services/lmnp/lmnpExportAttachments';

const MANIFEST_PATH = 'lmnp/v2/manifest.v2.json';
const CHECKSUMS_PATH = 'lmnp/v2/checksums.sha256';
const OBJECTS_INDEX_PATH = 'lmnp/v2/objects/index.ndjson';
const REPORT_PATH = 'lmnp/v2/attachment_report.json';

export type LmnpZipStagingFile = { path: string; buffer: Buffer };

export type LmnpJustificatifMeta = {
  zipPath: string;
  documentId: string;
  organizationId: string;
  storageKey: string;
  filename: string;
  mime: string;
  primaryTransactionId?: string;
  linkedTransactionIds: string[];
  buffer: Buffer;
};

function sha256(buf: Buffer | string): string {
  return createHash('sha256').update(buf).digest('hex');
}

function buildChecksumsFileContent(checksums: Map<string, string>): string {
  return [...checksums.entries()]
    .sort(([leftPath], [rightPath]) => leftPath.localeCompare(rightPath))
    .map(([filePath, hash]) => `${hash}  ${filePath}`)
    .join('\n');
}

/**
 * Fichiers à ajouter sous lmnp/v2/ : objects/index.ndjson, attachment_report.json,
 * manifest.v2.json, checksums.sha256 (ce dernier liste tout le contenu **hors** manifest.v2.json,
 * et inclut les autres fichiers lmnp/v2/ sauf le manifest — aligné sur la logique backup global).
 */
export function buildLmnpZipIntegrityV2Files(input: {
  /** Tous les fichiers du ZIP hors dossier lmnp/v2 (écritures, justificatifs, etc.). */
  stagingFiles: LmnpZipStagingFile[];
  justificatifs: LmnpJustificatifMeta[];
  organizationId: string;
  exerciseYear: number;
  summary: LmnpAttachmentExportSummary;
}): LmnpZipStagingFile[] {
  const checksumMap = new Map<string, string>();
  for (const f of input.stagingFiles) {
    checksumMap.set(f.path, sha256(f.buffer));
  }

  const objectLines: ObjectIndexEntryV2[] = input.justificatifs.map((j) => ({
    objectId: j.documentId,
    storageKey: j.storageKey,
    relativePath: j.zipPath,
    sha256: sha256(j.buffer),
    size: j.buffer.byteLength,
    mime: j.mime,
    kind: 'document',
    organizationId: input.organizationId,
    documentId: j.documentId,
    filename: j.filename,
    linkedType: j.primaryTransactionId ? 'transaction' : undefined,
    linkedId: j.primaryTransactionId,
    metadata:
      j.linkedTransactionIds.length > 0
        ? { transactionIds: j.linkedTransactionIds.join(',') }
        : undefined,
  }));

  const objectsBuffer = Buffer.from(objectLines.map((o) => JSON.stringify(o)).join('\n'), 'utf8');
  const reportBuffer = Buffer.from(JSON.stringify(input.summary, null, 2), 'utf8');

  checksumMap.set(OBJECTS_INDEX_PATH, sha256(objectsBuffer));
  checksumMap.set(REPORT_PATH, sha256(reportBuffer));

  const checksumsContent = buildChecksumsFileContent(checksumMap);
  const globalSha256 = sha256(checksumsContent);

  const manifestBuffer = Buffer.from(
    JSON.stringify(
      {
        packageType: 'smartimmo.lmnp-export',
        schemaVersion: '2.0.0',
        generatedAt: new Date().toISOString(),
        exerciseYear: input.exerciseYear,
        organizationId: input.organizationId,
        checksums: {
          algorithm: 'sha256',
          files: CHECKSUMS_PATH,
          globalSha256,
        },
        objectsIndex: OBJECTS_INDEX_PATH,
        attachmentReport: REPORT_PATH,
        attachmentSummary: input.summary,
      },
      null,
      2
    ),
    'utf8'
  );

  const checksumsBuffer = Buffer.from(checksumsContent, 'utf8');

  return [
    { path: OBJECTS_INDEX_PATH, buffer: objectsBuffer },
    { path: REPORT_PATH, buffer: reportBuffer },
    { path: MANIFEST_PATH, buffer: manifestBuffer },
    { path: CHECKSUMS_PATH, buffer: checksumsBuffer },
  ];
}
