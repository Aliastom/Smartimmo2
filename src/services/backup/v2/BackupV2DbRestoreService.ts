import { gunzipSync } from 'zlib';
import { BackupV2ValidationIssue } from './BackupV2Contract';
import { BackupV2RestorePlan } from './BackupV2RestorePlanner';
import { dbExportPlanner } from './DbExportPlanner';

export interface BackupV2DbRestoreStats {
  tablesRestored: string[];
  rowsImported: number;
  rowsPurged: number;
  tableImportCounts: Record<string, number>;
  tablePurgeCounts: Record<string, number>;
  warnings: BackupV2ValidationIssue[];
}

interface RestoreDbInput {
  plan: BackupV2RestorePlan;
  datasetFilesByName: Record<string, Buffer>;
}

export class BackupV2DbRestoreService {
  async restoreFullReplace(input: RestoreDbInput): Promise<BackupV2DbRestoreStats> {
    const datasetMap = dbExportPlanner.getDatasetEntryMap();
    const warnings: BackupV2ValidationIssue[] = [];

    const parsedRowsByDataset: Record<string, Record<string, unknown>[]> = {};
    for (const datasetName of input.plan.restoreOrder) {
      const datasetBuffer = input.datasetFilesByName[datasetName];
      if (!datasetBuffer) {
        throw new Error(`Dataset manquant pour la restauration: ${datasetName}`);
      }
      parsedRowsByDataset[datasetName] = this.parseNdjsonGz(datasetName, datasetBuffer);
    }

    const tablePurgeCounts: Record<string, number> = {};
    let rowsPurged = 0;
    for (const datasetName of input.plan.truncateOrder) {
      const entry = datasetMap[datasetName];
      if (!entry) {
        warnings.push({
          code: 'RESTORE_SKIP_UNKNOWN_PURGE_DATASET',
          severity: 'warning',
          path: datasetName,
          message: `Dataset inconnu ignoré pendant la purge: ${datasetName}`,
        });
        continue;
      }
      const purged = await entry.purgeRows();
      tablePurgeCounts[datasetName] = purged;
      rowsPurged += purged;
    }

    const tableImportCounts: Record<string, number> = {};
    let rowsImported = 0;
    const tablesRestored: string[] = [];
    for (const datasetName of input.plan.restoreOrder) {
      const entry = datasetMap[datasetName];
      if (!entry) {
        throw new Error(`Dataset inconnu dans le plan de restauration: ${datasetName}`);
      }
      const imported = await entry.restoreRows(parsedRowsByDataset[datasetName] || []);
      tableImportCounts[datasetName] = imported;
      rowsImported += imported;
      tablesRestored.push(datasetName);
    }

    return {
      tablesRestored,
      rowsImported,
      rowsPurged,
      tableImportCounts,
      tablePurgeCounts,
      warnings,
    };
  }

  private parseNdjsonGz(datasetName: string, content: Buffer): Record<string, unknown>[] {
    let decoded: string;
    try {
      decoded = gunzipSync(content).toString('utf8');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      throw new Error(`Dataset gzip invalide (${datasetName}): ${message}`);
    }

    const lines = decoded
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const rows: Record<string, unknown>[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      try {
        const parsed = JSON.parse(line) as Record<string, unknown>;
        rows.push(parsed);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erreur inconnue';
        throw new Error(`NDJSON invalide (${datasetName}) ligne ${i + 1}: ${message}`);
      }
    }
    return rows;
  }
}

export const backupV2DbRestoreService = new BackupV2DbRestoreService();
