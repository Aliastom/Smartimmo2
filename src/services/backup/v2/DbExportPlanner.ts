import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { DbDatasetGroup, DbOrderV2 } from './BackupV2Contract';

export interface DbDatasetPlanEntry {
  dataset: string;
  group: DbDatasetGroup;
  exportPath: string;
  restoreOrder: number;
  fetchRows: () => Promise<Record<string, unknown>[]>;
  purgeRows: () => Promise<number>;
  restoreRows: (rows: Record<string, unknown>[]) => Promise<number>;
}

export interface DbExportPlan {
  datasets: DbDatasetPlanEntry[];
  dbOrder: DbOrderV2;
}

type DatasetDefinition = Omit<DbDatasetPlanEntry, 'exportPath'>;

const toSerializableRows = <T>(rows: T[]): Record<string, unknown>[] =>
  rows.map((row) => JSON.parse(JSON.stringify(row)) as Record<string, unknown>);

const sortRows = (rows: Record<string, unknown>[]): Record<string, unknown>[] => {
  return rows.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
};

const createManyCount = async (
  fn: (data: Record<string, unknown>[]) => Promise<{ count: number }>,
  rows: Record<string, unknown>[]
) => {
  if (rows.length === 0) return 0;
  const result = await fn(rows);
  return result.count;
};

const DATASET_DEFINITIONS: readonly DatasetDefinition[] = [
  {
    dataset: 'organizations',
    group: 'core',
    restoreOrder: 10,
    fetchRows: async () => sortRows(toSerializableRows(await prisma.organization.findMany())),
    purgeRows: async () => (await prisma.organization.deleteMany()).count,
    restoreRows: async (rows) =>
      createManyCount(
        (data) => prisma.organization.createMany({ data: data as unknown as Prisma.OrganizationCreateManyInput[] }),
        rows
      ),
  },
  {
    dataset: 'users',
    group: 'core',
    restoreOrder: 20,
    fetchRows: async () => sortRows(toSerializableRows(await prisma.user.findMany())),
    purgeRows: async () => (await prisma.user.deleteMany()).count,
    restoreRows: async (rows) =>
      createManyCount(
        (data) => prisma.user.createMany({ data: data as unknown as Prisma.UserCreateManyInput[] }),
        rows
      ),
  },
  {
    dataset: 'profiles',
    group: 'core',
    restoreOrder: 30,
    fetchRows: async () => sortRows(toSerializableRows(await prisma.userProfile.findMany())),
    purgeRows: async () => (await prisma.userProfile.deleteMany()).count,
    restoreRows: async (rows) =>
      createManyCount(
        (data) => prisma.userProfile.createMany({ data: data as unknown as Prisma.UserProfileCreateManyInput[] }),
        rows
      ),
  },
  {
    dataset: 'categories',
    group: 'admin',
    restoreOrder: 40,
    fetchRows: async () => sortRows(toSerializableRows(await prisma.category.findMany())),
    purgeRows: async () => (await prisma.category.deleteMany()).count,
    restoreRows: async (rows) =>
      createManyCount(
        (data) => prisma.category.createMany({ data: data as unknown as Prisma.CategoryCreateManyInput[] }),
        rows
      ),
  },
  {
    dataset: 'natures',
    group: 'admin',
    restoreOrder: 50,
    fetchRows: async () => sortRows(toSerializableRows(await prisma.natureEntity.findMany())),
    purgeRows: async () => (await prisma.natureEntity.deleteMany()).count,
    restoreRows: async (rows) =>
      createManyCount(
        (data) => prisma.natureEntity.createMany({ data: data as unknown as Prisma.NatureEntityCreateManyInput[] }),
        rows
      ),
  },
  {
    dataset: 'nature_defaults',
    group: 'admin',
    restoreOrder: 60,
    fetchRows: async () => sortRows(toSerializableRows(await prisma.natureDefault.findMany())),
    purgeRows: async () => (await prisma.natureDefault.deleteMany()).count,
    restoreRows: async (rows) =>
      createManyCount(
        (data) => prisma.natureDefault.createMany({ data: data as unknown as Prisma.NatureDefaultCreateManyInput[] }),
        rows
      ),
  },
  {
    dataset: 'nature_rules',
    group: 'admin',
    restoreOrder: 70,
    fetchRows: async () => sortRows(toSerializableRows(await prisma.natureRule.findMany())),
    purgeRows: async () => (await prisma.natureRule.deleteMany()).count,
    restoreRows: async (rows) =>
      createManyCount(
        (data) => prisma.natureRule.createMany({ data: data as unknown as Prisma.NatureRuleCreateManyInput[] }),
        rows
      ),
  },
  {
    dataset: 'properties',
    group: 'business',
    restoreOrder: 80,
    fetchRows: async () => sortRows(toSerializableRows(await prisma.property.findMany())),
    purgeRows: async () => (await prisma.property.deleteMany()).count,
    restoreRows: async (rows) =>
      createManyCount(
        (data) => prisma.property.createMany({ data: data as unknown as Prisma.PropertyCreateManyInput[] }),
        rows
      ),
  },
  {
    dataset: 'tenants',
    group: 'business',
    restoreOrder: 90,
    fetchRows: async () => sortRows(toSerializableRows(await prisma.tenant.findMany())),
    purgeRows: async () => (await prisma.tenant.deleteMany()).count,
    restoreRows: async (rows) =>
      createManyCount(
        (data) => prisma.tenant.createMany({ data: data as unknown as Prisma.TenantCreateManyInput[] }),
        rows
      ),
  },
  {
    dataset: 'leases',
    group: 'business',
    restoreOrder: 100,
    fetchRows: async () => sortRows(toSerializableRows(await prisma.lease.findMany())),
    purgeRows: async () => (await prisma.lease.deleteMany()).count,
    restoreRows: async (rows) =>
      createManyCount(
        (data) => prisma.lease.createMany({ data: data as unknown as Prisma.LeaseCreateManyInput[] }),
        rows
      ),
  },
  {
    dataset: 'transactions',
    group: 'business',
    restoreOrder: 110,
    fetchRows: async () => sortRows(toSerializableRows(await prisma.transaction.findMany())),
    purgeRows: async () => (await prisma.transaction.deleteMany()).count,
    restoreRows: async (rows) =>
      createManyCount(
        (data) => prisma.transaction.createMany({ data: data as unknown as Prisma.TransactionCreateManyInput[] }),
        rows
      ),
  },
  {
    dataset: 'loans',
    group: 'business',
    restoreOrder: 120,
    fetchRows: async () => sortRows(toSerializableRows(await prisma.loan.findMany())),
    purgeRows: async () => (await prisma.loan.deleteMany()).count,
    restoreRows: async (rows) =>
      createManyCount(
        (data) => prisma.loan.createMany({ data: data as unknown as Prisma.LoanCreateManyInput[] }),
        rows
      ),
  },
  {
    dataset: 'portfolio_accounts',
    group: 'business',
    restoreOrder: 125,
    fetchRows: async () => sortRows(toSerializableRows(await prisma.portfolioAccount.findMany())),
    purgeRows: async () => (await prisma.portfolioAccount.deleteMany()).count,
    restoreRows: async (rows) =>
      createManyCount(
        (data) =>
          prisma.portfolioAccount.createMany({ data: data as unknown as Prisma.PortfolioAccountCreateManyInput[] }),
        rows
      ),
  },
  {
    dataset: 'portfolio_orders',
    group: 'business',
    restoreOrder: 126,
    fetchRows: async () => sortRows(toSerializableRows(await prisma.portfolioOrder.findMany())),
    purgeRows: async () => (await prisma.portfolioOrder.deleteMany()).count,
    restoreRows: async (rows) =>
      createManyCount(
        (data) => prisma.portfolioOrder.createMany({ data: data as unknown as Prisma.PortfolioOrderCreateManyInput[] }),
        rows
      ),
  },
  {
    dataset: 'portfolio_snapshots',
    group: 'business',
    restoreOrder: 127,
    fetchRows: async () => sortRows(toSerializableRows(await prisma.portfolioSnapshot.findMany())),
    purgeRows: async () => (await prisma.portfolioSnapshot.deleteMany()).count,
    restoreRows: async (rows) =>
      createManyCount(
        (data) =>
          prisma.portfolioSnapshot.createMany({ data: data as unknown as Prisma.PortfolioSnapshotCreateManyInput[] }),
        rows
      ),
  },
  {
    dataset: 'echeances',
    group: 'business',
    restoreOrder: 130,
    fetchRows: async () => sortRows(toSerializableRows(await prisma.echeanceRecurrente.findMany())),
    purgeRows: async () => (await prisma.echeanceRecurrente.deleteMany()).count,
    restoreRows: async (rows) =>
      createManyCount(
        (data) =>
          prisma.echeanceRecurrente.createMany({
            data: data as unknown as Prisma.EcheanceRecurrenteCreateManyInput[],
          }),
        rows
      ),
  },
  {
    dataset: 'documents',
    group: 'documents',
    restoreOrder: 140,
    fetchRows: async () => sortRows(toSerializableRows(await prisma.document.findMany())),
    purgeRows: async () => (await prisma.document.deleteMany()).count,
    restoreRows: async (rows) =>
      createManyCount(
        (data) => prisma.document.createMany({ data: data as unknown as Prisma.DocumentCreateManyInput[] }),
        rows
      ),
  },
  {
    dataset: 'document_links',
    group: 'documents',
    restoreOrder: 150,
    fetchRows: async () => sortRows(toSerializableRows(await prisma.documentLink.findMany())),
    purgeRows: async () => (await prisma.documentLink.deleteMany()).count,
    restoreRows: async (rows) =>
      createManyCount(
        (data) => prisma.documentLink.createMany({ data: data as unknown as Prisma.DocumentLinkCreateManyInput[] }),
        rows
      ),
  },
  {
    dataset: 'document_fields',
    group: 'documents',
    restoreOrder: 160,
    fetchRows: async () => sortRows(toSerializableRows(await prisma.documentField.findMany())),
    purgeRows: async () => (await prisma.documentField.deleteMany()).count,
    restoreRows: async (rows) =>
      createManyCount(
        (data) => prisma.documentField.createMany({ data: data as unknown as Prisma.DocumentFieldCreateManyInput[] }),
        rows
      ),
  },
  {
    dataset: 'document_text_index',
    group: 'documents',
    restoreOrder: 170,
    fetchRows: async () => sortRows(toSerializableRows(await prisma.documentTextIndex.findMany())),
    purgeRows: async () => (await prisma.documentTextIndex.deleteMany()).count,
    restoreRows: async (rows) =>
      createManyCount(
        (data) =>
          prisma.documentTextIndex.createMany({
            data: data as unknown as Prisma.DocumentTextIndexCreateManyInput[],
          }),
        rows
      ),
  },
  {
    dataset: 'fiscal_versions',
    group: 'admin',
    restoreOrder: 180,
    fetchRows: async () => sortRows(toSerializableRows(await prisma.fiscalVersion.findMany())),
    purgeRows: async () => (await prisma.fiscalVersion.deleteMany()).count,
    restoreRows: async (rows) =>
      createManyCount(
        (data) => prisma.fiscalVersion.createMany({ data: data as unknown as Prisma.FiscalVersionCreateManyInput[] }),
        rows
      ),
  },
  {
    dataset: 'fiscal_types',
    group: 'admin',
    restoreOrder: 190,
    fetchRows: async () => sortRows(toSerializableRows(await prisma.fiscalType.findMany())),
    purgeRows: async () => (await prisma.fiscalType.deleteMany()).count,
    restoreRows: async (rows) =>
      createManyCount(
        (data) => prisma.fiscalType.createMany({ data: data as unknown as Prisma.FiscalTypeCreateManyInput[] }),
        rows
      ),
  },
  {
    dataset: 'fiscal_regimes',
    group: 'admin',
    restoreOrder: 200,
    fetchRows: async () => sortRows(toSerializableRows(await prisma.fiscalRegime.findMany())),
    purgeRows: async () => (await prisma.fiscalRegime.deleteMany()).count,
    restoreRows: async (rows) =>
      createManyCount(
        (data) =>
          prisma.fiscalRegime.createMany({ data: data as unknown as Prisma.FiscalRegimeCreateManyInput[] }),
        rows
      ),
  },
  {
    dataset: 'fiscal_compat',
    group: 'admin',
    restoreOrder: 210,
    fetchRows: async () => sortRows(toSerializableRows(await prisma.fiscalCompatibility.findMany())),
    purgeRows: async () => (await prisma.fiscalCompatibility.deleteMany()).count,
    restoreRows: async (rows) =>
      createManyCount(
        (data) =>
          prisma.fiscalCompatibility.createMany({
            data: data as unknown as Prisma.FiscalCompatibilityCreateManyInput[],
          }),
        rows
      ),
  },
  {
    dataset: 'document_types',
    group: 'admin',
    restoreOrder: 220,
    fetchRows: async () => sortRows(toSerializableRows(await prisma.documentType.findMany())),
    purgeRows: async () => (await prisma.documentType.deleteMany()).count,
    restoreRows: async (rows) =>
      createManyCount(
        (data) => prisma.documentType.createMany({ data: data as unknown as Prisma.DocumentTypeCreateManyInput[] }),
        rows
      ),
  },
  {
    dataset: 'document_keywords',
    group: 'admin',
    restoreOrder: 230,
    fetchRows: async () => sortRows(toSerializableRows(await prisma.documentKeyword.findMany())),
    purgeRows: async () => (await prisma.documentKeyword.deleteMany()).count,
    restoreRows: async (rows) =>
      createManyCount(
        (data) =>
          prisma.documentKeyword.createMany({ data: data as unknown as Prisma.DocumentKeywordCreateManyInput[] }),
        rows
      ),
  },
  {
    dataset: 'document_extraction_rules',
    group: 'admin',
    restoreOrder: 240,
    fetchRows: async () => sortRows(toSerializableRows(await prisma.documentExtractionRule.findMany())),
    purgeRows: async () => (await prisma.documentExtractionRule.deleteMany()).count,
    restoreRows: async (rows) =>
      createManyCount(
        (data) =>
          prisma.documentExtractionRule.createMany({
            data: data as unknown as Prisma.DocumentExtractionRuleCreateManyInput[],
          }),
        rows
      ),
  },
  {
    dataset: 'signals',
    group: 'admin',
    restoreOrder: 250,
    fetchRows: async () => sortRows(toSerializableRows(await prisma.signal.findMany())),
    purgeRows: async () => (await prisma.signal.deleteMany()).count,
    restoreRows: async (rows) =>
      createManyCount(
        (data) => prisma.signal.createMany({ data: data as unknown as Prisma.SignalCreateManyInput[] }),
        rows
      ),
  },
  {
    dataset: 'type_signals',
    group: 'admin',
    restoreOrder: 260,
    fetchRows: async () => sortRows(toSerializableRows(await prisma.typeSignal.findMany())),
    purgeRows: async () => (await prisma.typeSignal.deleteMany()).count,
    restoreRows: async (rows) =>
      createManyCount(
        (data) => prisma.typeSignal.createMany({ data: data as unknown as Prisma.TypeSignalCreateManyInput[] }),
        rows
      ),
  },
  {
    dataset: 'system_settings',
    group: 'admin',
    restoreOrder: 270,
    fetchRows: async () => sortRows(toSerializableRows(await prisma.appSetting.findMany())),
    purgeRows: async () => (await prisma.appSetting.deleteMany()).count,
    restoreRows: async (rows) =>
      createManyCount(
        (data) => prisma.appSetting.createMany({ data: data as unknown as Prisma.AppSettingCreateManyInput[] }),
        rows
      ),
  },
] as const;

export class DbExportPlanner {
  getPlan(): DbExportPlan {
    const ordered = [...DATASET_DEFINITIONS].sort((left, right) => left.restoreOrder - right.restoreOrder);

    const datasets: DbDatasetPlanEntry[] = ordered.map((definition) => ({
      ...definition,
      exportPath: `db/${definition.group}/${definition.dataset}.ndjson.gz`,
    }));

    const groups: Partial<Record<DbDatasetGroup, string[]>> = {};
    for (const entry of datasets) {
      const current = groups[entry.group] || [];
      groups[entry.group] = [...current, entry.dataset];
    }

    const dbOrder: DbOrderV2 = {
      version: 1,
      restoreOrder: datasets.map((entry) => entry.dataset),
      groups,
    };

    return { datasets, dbOrder };
  }

  getExpectedDatasetPaths(): string[] {
    return this.getPlan().datasets.map((entry) => entry.exportPath);
  }

  getDatasetNames(): string[] {
    return this.getPlan().datasets.map((entry) => entry.dataset);
  }

  getDatasetEntryMap(): Record<string, DbDatasetPlanEntry> {
    return this.getPlan().datasets.reduce<Record<string, DbDatasetPlanEntry>>((acc, entry) => {
      acc[entry.dataset] = entry;
      return acc;
    }, {});
  }
}

export const dbExportPlanner = new DbExportPlanner();
