import archiver from 'archiver';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import { gzipSync } from 'zlib';
import { dbExportPlanner } from './DbExportPlanner';
import { objectExportService } from './ObjectExportService';
import {
  BACKUP_V2_VERSION,
  CompatibilityV2,
  ManifestV2,
  MetadataAppV2,
  MetadataCompatibilityV2,
  MetadataSchemaV2,
  ObjectIndexEntryV2,
} from './BackupV2Contract';

interface BuildBackupV2DbOnlyInput {
  createdBy: {
    userId: string;
    email?: string;
  };
  notes?: string;
  organizationId?: string;
  includeObjects?: boolean;
  strictMissingObjectFiles?: boolean;
  onProgress?: (progress: {
    step:
      | 'preparation'
      | 'analysis'
      | 'export_db'
      | 'export_objects'
      | 'generate_archive'
      | 'finalization';
    message: string;
  }) => Promise<void> | void;
}

export interface BuildBackupV2DbOnlyResult {
  fileUrl: string;
  absolutePath: string;
  manifest: ManifestV2;
  datasetCount: number;
  rowCount: number;
  objectCount: number;
  bytesObjects: number;
  sizeBytes: number;
}

interface ArchiveAppendFile {
  path: string;
  content: Buffer;
  checksumTracked: boolean;
}

export class BackupV2Builder {
  async buildDbOnlyArchiveToFile(input: BuildBackupV2DbOnlyInput): Promise<BuildBackupV2DbOnlyResult> {
    const { datasets, dbOrder } = dbExportPlanner.getPlan();
    await input.onProgress?.({
      step: 'preparation',
      message: 'Initialisation du builder V2',
    });

    const outputDir = path.join(process.cwd(), 'storage', 'backups', 'v2');
    await fsp.mkdir(outputDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `smartimmo-backup-v2-${timestamp}.zip`;
    const absolutePath = path.join(outputDir, fileName);

    const archive = archiver('zip', { zlib: { level: 9 } });
    const output = fs.createWriteStream(absolutePath);
    const checksumMap = new Map<string, string>();

    let rowCount = 0;
    let bytesDbCompressed = 0;
    let objectCount = 0;
    let bytesObjects = 0;
    let objectIndexEntries: ObjectIndexEntryV2[] = [];
    const includeObjects = input.includeObjects !== false;
    const warnings: string[] = [
      includeObjects
        ? 'Phase 2B: export V2 DB + objects'
        : 'Phase 2A compatibility mode: export V2 DB-only, documentsBinary=false',
      'checksums.sha256 exclut manifest.v2.json pour éviter la dépendance circulaire de globalSha256',
    ];

    archive.pipe(output);

    const appendFile = (file: ArchiveAppendFile) => {
      archive.append(file.content, { name: file.path });
      if (file.checksumTracked) {
        checksumMap.set(file.path, this.sha256(file.content));
      }
    };

    await input.onProgress?.({
      step: 'analysis',
      message: `Plan export DB chargé (${datasets.length} dataset(s))`,
    });

    const appMetadata: MetadataAppV2 = {
      appName: 'smartimmo',
      appVersion: process.env.NEXT_PUBLIC_APP_VERSION || process.env.npm_package_version || 'unknown',
      environment: this.resolveEnvironment(),
    };

    const schemaMetadata: MetadataSchemaV2 = {
      schemaVersion: process.env.SMARTIMMO_SCHEMA_VERSION || `prisma-${new Date().toISOString().slice(0, 10)}`,
      source: 'prisma',
      generatedAt: new Date().toISOString(),
      tables: dbOrder.restoreOrder,
    };

    const compatibilityMetadata: MetadataCompatibilityV2 = {
      minImporterVersion: '2.0.0',
      maxTestedImporterVersion: '2.x',
      minAppVersion: '2026.04.0',
      requiredFeatures: includeObjects
        ? ['full-backup-v2', 'object-index-v1']
        : ['full-backup-v2', 'db-only-export-phase-2a'],
      breakingFlags: [],
    };

    appendFile({
      path: 'metadata/app.json',
      content: Buffer.from(JSON.stringify(appMetadata, null, 2), 'utf8'),
      checksumTracked: true,
    });
    appendFile({
      path: 'metadata/schema.json',
      content: Buffer.from(JSON.stringify(schemaMetadata, null, 2), 'utf8'),
      checksumTracked: true,
    });
    appendFile({
      path: 'metadata/compatibility.json',
      content: Buffer.from(JSON.stringify(compatibilityMetadata, null, 2), 'utf8'),
      checksumTracked: true,
    });

    appendFile({
      path: 'db/order.json',
      content: Buffer.from(JSON.stringify(dbOrder, null, 2), 'utf8'),
      checksumTracked: true,
    });

    for (const dataset of datasets) {
      await input.onProgress?.({
        step: 'export_db',
        message: `Export dataset: ${dataset.dataset}`,
      });
      const rows = await dataset.fetchRows();
      rowCount += rows.length;
      const ndjsonContent = rows.map((row) => JSON.stringify(row)).join('\n');
      const gzContent = gzipSync(Buffer.from(ndjsonContent, 'utf8'));
      bytesDbCompressed += gzContent.byteLength;
      appendFile({
        path: dataset.exportPath,
        content: gzContent,
        checksumTracked: true,
      });
    }

    if (includeObjects) {
      await input.onProgress?.({
        step: 'export_objects',
        message: 'Collecte des objets binaires référencés',
      });
      const objectSummary = await objectExportService.exportObjects({
        strictMissingFiles: input.strictMissingObjectFiles !== false,
        onObject: ({ relativePath, buffer }) => {
          appendFile({
            path: relativePath,
            content: buffer,
            checksumTracked: true,
          });
        },
      });

      objectCount = objectSummary.objectCount;
      bytesObjects = objectSummary.bytesObjects;
      objectIndexEntries = objectSummary.indexEntries;
      if (objectSummary.warnings.length > 0) {
        warnings.push(...objectSummary.warnings.map((warning) => `${warning.code}: ${warning.message}`));
      }

      const indexContent = objectSummary.indexEntries.map((entry) => JSON.stringify(entry)).join('\n');
      appendFile({
        path: 'objects/index.ndjson',
        content: Buffer.from(indexContent, 'utf8'),
        checksumTracked: true,
      });

      const documentsMapCsv = this.buildDocumentsMapCsv(objectSummary.indexEntries);
      appendFile({
        path: 'reports/documents-map.csv',
        content: Buffer.from(documentsMapCsv, 'utf8'),
        checksumTracked: true,
      });

      const documentsMapJson = this.buildDocumentsMapJson(objectSummary.indexEntries);
      appendFile({
        path: 'reports/documents-map.json',
        content: Buffer.from(JSON.stringify(documentsMapJson, null, 2), 'utf8'),
        checksumTracked: true,
      });
    }

    await input.onProgress?.({
      step: 'generate_archive',
      message: 'Construction des checksums et du manifest',
    });
    appendFile({
      path: 'reports/warnings.json',
      content: Buffer.from(JSON.stringify({ warnings }, null, 2), 'utf8'),
      checksumTracked: true,
    });
    appendFile({
      path: 'reports/export-report.json',
      content: Buffer.from(
        JSON.stringify(
          {
            phase: includeObjects ? '2B' : '2A',
            mode: includeObjects ? 'db-plus-objects' : 'db-only',
            generatedAt: new Date().toISOString(),
            datasetCount: datasets.length,
            rowCount,
            bytesDbCompressed,
            objectCount,
            bytesObjects,
          },
          null,
          2
        ),
        'utf8'
      ),
      checksumTracked: true,
    });
    appendFile({
      path: 'README_BACKUP.txt',
      content: Buffer.from(
        this.buildBackupReadme({
          includeObjects,
          objectCount,
          documentRows: this.getUniqueDocumentRows(objectIndexEntries).length,
        }),
        'utf8'
      ),
      checksumTracked: true,
    });

    const checksumsContent = this.buildChecksumsFileContent(checksumMap);
    const globalSha256 = this.sha256(checksumsContent);

    const manifest: ManifestV2 = {
      backupVersion: BACKUP_V2_VERSION,
      appVersion: appMetadata.appVersion,
      schemaVersion: schemaMetadata.schemaVersion,
      createdAt: new Date().toISOString(),
      mode: 'full-replace',
      scope: 'full',
      organizationId: input.organizationId,
      includes: {
        db: true,
        admin: true,
        business: true,
        documentsMetadata: true,
        documentsBinary: includeObjects,
      },
      counts: {
        tables: datasets.length,
        rows: rowCount,
        objects: objectCount,
        bytesDbCompressed,
        bytesObjects,
      },
      checksums: {
        algorithm: 'sha256',
        files: 'checksums.sha256',
        globalSha256,
      },
      compatibility: compatibilityMetadata as CompatibilityV2,
      createdBy: {
        userId: input.createdBy.userId,
        email: input.createdBy.email || 'unknown@smartimmo.local',
      },
      notes: input.notes,
    };

    appendFile({
      path: 'manifest.v2.json',
      content: Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'),
      checksumTracked: false,
    });
    appendFile({
      path: 'checksums.sha256',
      content: Buffer.from(checksumsContent, 'utf8'),
      checksumTracked: false,
    });

    await archive.finalize();
    await new Promise<void>((resolve, reject) => {
      output.on('close', () => resolve());
      output.on('error', (error) => reject(error));
      archive.on('error', (error) => reject(error));
    });

    const stats = await fsp.stat(absolutePath);
    await input.onProgress?.({
      step: 'finalization',
      message: 'Archive V2 finalisée',
    });

    return {
      fileUrl: path.relative(process.cwd(), absolutePath).replace(/\\/g, '/'),
      absolutePath,
      manifest,
      datasetCount: datasets.length,
      rowCount,
      objectCount,
      bytesObjects,
      sizeBytes: stats.size,
    };
  }

  private buildChecksumsFileContent(checksums: Map<string, string>): string {
    return [...checksums.entries()]
      .sort(([leftPath], [rightPath]) => leftPath.localeCompare(rightPath))
      .map(([filePath, hash]) => `${hash}  ${filePath}`)
      .join('\n');
  }

  private buildDocumentsMapCsv(indexEntries: ObjectIndexEntryV2[]): string {
    const headers = [
      'documentId',
      'filename',
      'storageKey',
      'relativePath',
      'mime',
      'size',
      'createdAt',
    ];
    const rows = this.getUniqueDocumentRows(indexEntries).map((entry) => [
      entry.documentId || '',
      entry.filename || '',
      entry.storageKey || '',
      entry.relativePath || '',
      entry.mime || '',
      String(entry.size ?? 0),
      entry.createdAt || '',
    ]);
    const csvLines = [headers, ...rows].map((columns) =>
      columns.map((value) => this.escapeCsvCell(value)).join(',')
    );
    return `${csvLines.join('\n')}\n`;
  }

  private buildDocumentsMapJson(indexEntries: ObjectIndexEntryV2[]) {
    const rows = this.getUniqueDocumentRows(indexEntries).map((entry) => ({
      documentId: entry.documentId || null,
      filename: entry.filename || null,
      storageKey: entry.storageKey,
      relativePath: entry.relativePath,
      mime: entry.mime,
      size: entry.size,
      createdAt: entry.createdAt || null,
      objectId: entry.objectId,
      kind: entry.kind,
      organizationId: entry.organizationId,
      sha256: entry.sha256,
    }));
    return {
      generatedAt: new Date().toISOString(),
      separator: ',',
      totalRows: rows.length,
      rows,
    };
  }

  private buildBackupReadme(input: {
    includeObjects: boolean;
    objectCount: number;
    documentRows: number;
  }): string {
    return [
      'SMARTIMMO BACKUP V2',
      '',
      'Contenu principal de l archive:',
      '- db/ : datasets de la base en NDJSON compresse (.ndjson.gz)',
      '- objects/files/ : fichiers binaires (nommes par hash + nom lisible)',
      '- objects/index.ndjson : source de verite technique du mapping DB <-> fichiers',
      '- reports/documents-map.csv : mapping lisible pour Excel (documents)',
      '- reports/documents-map.json : mapping JSON lisible (debug/integration)',
      '',
      `Mode objets: ${input.includeObjects ? 'actif' : 'desactive'}`,
      `Objets indexes: ${input.objectCount}`,
      `Lignes documents-map.csv: ${input.documentRows}`,
      '',
      'Pour retrouver un document rapidement:',
      '1) Ouvrir reports/documents-map.csv',
      '2) Chercher documentId ou filename',
      '3) Utiliser la colonne relativePath pour trouver le fichier dans objects/files/',
      '',
      'Note: objects/index.ndjson reste la reference technique pour les restaurations.',
      '',
    ].join('\n');
  }

  private getUniqueDocumentRows(indexEntries: ObjectIndexEntryV2[]): ObjectIndexEntryV2[] {
    const documents = indexEntries.filter((entry) => entry.kind === 'document');
    const seen = new Set<string>();
    const unique: ObjectIndexEntryV2[] = [];
    for (const entry of documents) {
      const key = entry.relativePath;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(entry);
    }
    return unique;
  }

  private escapeCsvCell(value: string): string {
    if (value.includes('"') || value.includes(',') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  private sha256(content: Buffer | string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  private resolveEnvironment(): 'development' | 'staging' | 'production' {
    const env = process.env.NODE_ENV || 'development';
    if (env === 'production') return 'production';
    if (env === 'test') return 'staging';
    return 'development';
  }
}

export const backupV2Builder = new BackupV2Builder();
