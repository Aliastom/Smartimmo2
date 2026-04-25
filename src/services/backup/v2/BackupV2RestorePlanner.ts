import { DbOrderV2 } from './BackupV2Contract';
import { dbExportPlanner } from './DbExportPlanner';

export interface BackupV2RestorePlan {
  restoreOrder: string[];
  truncateOrder: string[];
  missingDatasets: string[];
  missingCriticalDatasets: string[];
  unknownDatasetsInArchive: string[];
  datasetsByGroup: DbOrderV2['groups'];
}

const CRITICAL_DATASETS: readonly string[] = [
  'organizations',
  'users',
  'properties',
  'tenants',
  'leases',
  'transactions',
  'documents',
  'categories',
  'system_settings',
] as const;

export class BackupV2RestorePlanner {
  buildPlan(
    dbOrder: DbOrderV2,
    archiveDatasetNames: string[]
  ): BackupV2RestorePlan {
    const datasetEntryMap = dbExportPlanner.getDatasetEntryMap();
    const knownDatasets = Object.keys(datasetEntryMap);
    const archiveSet = new Set(archiveDatasetNames);

    const restoreOrder = dbOrder.restoreOrder.filter((dataset) => archiveSet.has(dataset));
    const truncateOrder = [...restoreOrder].reverse();

    const missingDatasets = dbOrder.restoreOrder.filter((dataset) => !archiveSet.has(dataset));
    const missingCriticalDatasets = CRITICAL_DATASETS.filter((dataset) => !archiveSet.has(dataset));
    const unknownDatasetsInArchive = archiveDatasetNames.filter((dataset) => !knownDatasets.includes(dataset));

    return {
      restoreOrder,
      truncateOrder,
      missingDatasets,
      missingCriticalDatasets,
      unknownDatasetsInArchive,
      datasetsByGroup: dbOrder.groups,
    };
  }
}

export const backupV2RestorePlanner = new BackupV2RestorePlanner();
