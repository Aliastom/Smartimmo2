/**
 * AdminBackupService
 * 
 * Service de sauvegarde et restauration globale de la base admin SmartImmo
 * - Export : archive ZIP avec NDJSON + checksums + manifest
 * - Import : validation, diff, merge/replace avec transaction
 * - Historique : gestion des backups et planification
 */

import { prisma } from '@/lib/prisma';
import archiver from 'archiver';
import { Readable, PassThrough } from 'stream';
import { createHash } from 'crypto';
import { z } from 'zod';
import AdmZip from 'adm-zip';

// ============================================
// TYPES & SCHÉMAS
// ============================================

export interface BackupManifest {
  app: string;
  version: string;
  scope: string;
  environment: string;
  createdAt: string;
  datasets: string[];
  checksumGlobal: string;
}

export interface ExportOptions {
  scope: 'admin';
  includeSensitive?: boolean;
}

export interface ImportOptions {
  mode: 'validate' | 'dry-run' | 'apply';
  strategy: 'merge' | 'replace';
}

export interface DiffResult {
  adds: number;
  updates: number;
  deletes: number;
  conflicts: any[];
  preview: {
    [dataset: string]: {
      adds: any[];
      updates: any[];
      deletes: any[];
    };
  };
}

export interface ImportResult {
  success: boolean;
  diff?: DiffResult;
  applied?: {
    adds: number;
    updates: number;
    deletes: number;
  };
  errors?: string[];
  backupRecordId?: string;
}

// ============================================
// SERVICE PRINCIPAL
// ============================================

export class AdminBackupService {
  private readonly MAX_PREVIEW_ITEMS = 10;

  /**
   * Export global de la base admin
   * Retourne un stream ZIP avec manifest + datasets NDJSON + checksums
   */
  async exportAdmin(options: ExportOptions = { scope: 'admin' }): Promise<Readable> {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const output = new PassThrough();
    
    archive.pipe(output);

    try {
      // 1. Collecter toutes les données
      const datasets = await this.collectDatasets(options);

      // 2. Calculer les checksums individuels
      const checksums: Record<string, string> = {};
      const datasetFiles: Record<string, string> = {};

      for (const [name, data] of Object.entries(datasets)) {
        const ndjson = this.toNDJSON(data);
        const checksum = this.calculateChecksum(ndjson);
        checksums[`datasets/${name}.ndjson`] = checksum;
        datasetFiles[name] = ndjson;
      }

      // 3. Créer le manifest
      const manifest: BackupManifest = {
        app: 'smartimmo',
        version: '1.0',
        scope: options.scope,
        environment: process.env.NODE_ENV || 'development',
        createdAt: new Date().toISOString(),
        datasets: Object.keys(datasets),
        checksumGlobal: this.calculateChecksum(JSON.stringify(checksums)),
      };

      // 4. Ajouter les fichiers à l'archive
      archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });
      
      // Checksums
      const checksumLines = Object.entries(checksums)
        .map(([file, hash]) => `${hash}  ${file}`)
        .join('\n');
      archive.append(checksumLines, { name: 'checksums.sha256' });

      // Datasets NDJSON
      for (const [name, content] of Object.entries(datasetFiles)) {
        archive.append(content, { name: `datasets/${name}.ndjson` });
      }

      // 5. Finaliser
      await archive.finalize();
      
    } catch (error) {
      console.error('Error creating backup archive:', error);
      archive.abort();
      throw error;
    }

    return output;
  }

  /**
   * Import et validation d'une archive de backup
   */
  async importAdmin(
    zipBuffer: Buffer,
    options: ImportOptions,
    userId: string
  ): Promise<ImportResult> {
    try {
      // 1. Extraire et valider l'archive
      const extracted = await this.extractAndValidate(zipBuffer);
      
      if (!extracted.valid) {
        return {
          success: false,
          errors: extracted.errors || ['Archive invalide'],
        };
      }

      // 2. Parser les datasets
      const datasets = await this.parseDatasets(extracted.datasets!);

      // 3. Calculer le diff
      const diff = await this.calculateDiff(datasets, options.strategy);

      // 4. Si mode validate ou dry-run, retourner le diff
      if (options.mode === 'validate' || options.mode === 'dry-run') {
        return {
          success: true,
          diff,
        };
      }

      // 5. Si mode apply, appliquer les changements
      if (options.mode === 'apply') {
        const applied = await this.applyChanges(datasets, options.strategy, diff);

        // 6. Enregistrer le backup
        const backupRecord = await this.saveBackupRecord({
          userId,
          manifest: extracted.manifest!,
          checksum: extracted.manifest!.checksumGlobal,
          sizeBytes: zipBuffer.length,
          fileUrl: `backups/admin-${Date.now()}.zip`, // TODO: save to storage
        });

        return {
          success: true,
          diff,
          applied,
          backupRecordId: backupRecord.id,
        };
      }

      return { success: false, errors: ['Mode invalide'] };
    } catch (error) {
      console.error('Import error:', error);
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Erreur inconnue'],
      };
    }
  }

  // ============================================
  // COLLECTE DES DONNÉES
  // ============================================

  private async collectDatasets(options: ExportOptions) {
    const datasets: Record<string, any[]> = {};

    try {
      // FiscalVersions + FiscalParams
      const fiscalVersions = await prisma.fiscalVersion.findMany({
        include: { params: true },
        orderBy: { year: 'desc' },
      });
      datasets['fiscal.versions'] = fiscalVersions.map(v => ({
        id: v.id,
        code: v.code,
        year: v.year,
        source: v.source,
        status: v.status,
        validatedBy: v.validatedBy,
        notes: v.notes,
        params: v.params ? {
          jsonData: v.params.jsonData,
          overrides: v.params.overrides,
        } : null,
      }));
    } catch (error) {
      console.warn('Fiscal versions not available:', error);
      datasets['fiscal.versions'] = [];
    }

    try {
      // FiscalTypes
      const fiscalTypes = await prisma.fiscalType.findMany({
        orderBy: { id: 'asc' },
      });
      datasets['fiscal.types'] = fiscalTypes.map(t => ({
        id: t.id,
        label: t.label,
        category: t.category,
        description: t.description,
        isActive: t.isActive,
      }));
    } catch (error) {
      console.warn('Fiscal types not available:', error);
      datasets['fiscal.types'] = [];
    }

    try {
      // FiscalRegimes
      const fiscalRegimes = await prisma.fiscalRegime.findMany({
        orderBy: { id: 'asc' },
      });
      datasets['fiscal.regimes'] = fiscalRegimes.map(r => ({
        id: r.id,
        label: r.label,
        appliesToIds: r.appliesToIds,
        engagementYears: r.engagementYears,
        eligibility: r.eligibility,
        calcProfile: r.calcProfile,
        description: r.description,
        isActive: r.isActive,
      }));
    } catch (error) {
      console.warn('Fiscal regimes not available:', error);
      datasets['fiscal.regimes'] = [];
    }

    try {
      // FiscalCompatibility
      const fiscalCompat = await prisma.fiscalCompatibility.findMany();
      datasets['fiscal.compat'] = fiscalCompat.map(c => ({
        id: c.id,
        scope: c.scope,
        left: c.left,
        right: c.right,
        rule: c.rule,
        note: c.note,
      }));
    } catch (error) {
      console.warn('Fiscal compatibility not available:', error);
      datasets['fiscal.compat'] = [];
    }

    try {
      // Natures
      const natures = await prisma.natureEntity.findMany({
        include: { NatureDefault: true, NatureRule: true },
      });
      datasets['natures'] = natures.map(n => ({
        code: n.code,
        label: n.label,
        flow: n.flow,
        defaultCategoryId: n.NatureDefault?.defaultCategoryId,
        allowedTypes: n.NatureRule.map(r => r.allowedType),
      }));
    } catch (error) {
      console.warn('Natures not available:', error);
      datasets['natures'] = [];
    }

    try {
      // Categories
      const categories = await prisma.category.findMany({
        orderBy: { slug: 'asc' },
      });
      datasets['categories'] = categories.map(c => ({
        id: c.id,
        slug: c.slug,
        label: c.label,
        type: c.type,
        deductible: c.deductible,
        capitalizable: c.capitalizable,
        system: c.system,
        actif: c.actif,
      }));
    } catch (error) {
      console.warn('Categories not available:', error);
      datasets['categories'] = [];
    }

    try {
      // DocumentTypes complet
      const documentTypes = await prisma.documentType.findMany({
        include: {
          DocumentKeyword: true,
          TypeSignal: { include: { Signal: true } },
          DocumentExtractionRule: true,
        },
        orderBy: { order: 'asc' },
      });
    datasets['documents.types'] = documentTypes.map(dt => ({
      id: dt.id,
      code: dt.code,
      label: dt.label,
      description: dt.description,
      icon: dt.icon,
      scope: dt.scope,
      isSystem: dt.isSystem,
      isRequired: dt.isRequired,
      order: dt.order,
      isActive: dt.isActive,
      isSensitive: dt.isSensitive,
      autoAssignThreshold: dt.autoAssignThreshold,
      regexFilename: dt.regexFilename,
      validExtensions: dt.validExtensions,
      validMimeTypes: dt.validMimeTypes,
      ocrProfileKey: dt.ocrProfileKey,
      versioningEnabled: dt.versioningEnabled,
      defaultContexts: dt.defaultContexts,
      suggestionsConfig: dt.suggestionsConfig,
      flowLocks: dt.flowLocks,
      metaSchema: dt.metaSchema,
      keywords: dt.DocumentKeyword.map(k => ({
        keyword: k.keyword,
        weight: k.weight,
        context: k.context,
      })),
      signals: dt.TypeSignal.map(ts => ({
        signalCode: ts.Signal.code,
        weight: ts.weight,
        enabled: ts.enabled,
        order: ts.order,
      })),
      extractionRules: dt.DocumentExtractionRule.map(r => ({
        fieldName: r.fieldName,
        pattern: r.pattern,
        postProcess: r.postProcess,
        priority: r.priority,
      })),
    }));
    } catch (error) {
      console.warn('Document types not available:', error);
      datasets['documents.types'] = [];
    }

    try {
      // Signals catalog
      const signals = await prisma.signal.findMany({
      where: { deletedAt: null },
      orderBy: { code: 'asc' },
    });
    datasets['signals.catalog'] = signals.map(s => ({
      id: s.id,
      code: s.code,
      label: s.label,
      regex: s.regex,
      flags: s.flags,
      description: s.description,
      protected: s.protected,
    }));
    } catch (error) {
      console.warn('Signals not available:', error);
      datasets['signals.catalog'] = [];
    }

    try {
      // ManagementCompany (gestion déléguée)
      const managementCompanies = await prisma.managementCompany.findMany();
    datasets['delegated.settings'] = managementCompanies.map(mc => ({
      id: mc.id,
      nom: mc.nom,
      contact: mc.contact,
      email: mc.email,
      telephone: mc.telephone,
      modeCalcul: mc.modeCalcul,
      taux: mc.taux,
      fraisMin: mc.fraisMin,
      baseSurEncaissement: mc.baseSurEncaissement,
      tvaApplicable: mc.tvaApplicable,
      tauxTva: mc.tauxTva,
      actif: mc.actif,
    }));
    } catch (error) {
      console.warn('Management companies not available:', error);
      datasets['delegated.settings'] = [];
    }

    try {
      // AppSettings système (feature flags, etc.)
      const appSettings = await prisma.appSetting.findMany();
    datasets['system.settings'] = appSettings.map(s => ({
      key: s.key,
      value: s.value,
      description: s.description,
    }));
    } catch (error) {
      console.warn('App settings not available:', error);
      datasets['system.settings'] = [];
    }

    return datasets;
  }

  // ============================================
  // NDJSON UTILS
  // ============================================

  private toNDJSON(data: any[]): string {
    return data.map(item => JSON.stringify(item)).join('\n');
  }

  private fromNDJSON(content: string): any[] {
    return content
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));
  }

  // ============================================
  // CHECKSUMS
  // ============================================

  private calculateChecksum(content: string): string {
    return createHash('sha256').update(content, 'utf8').digest('hex');
  }

  // ============================================
  // EXTRACTION & VALIDATION
  // ============================================

  private async extractAndValidate(
    zipBuffer: Buffer
  ): Promise<{
    valid: boolean;
    manifest?: BackupManifest;
    checksums?: Record<string, string>;
    datasets?: Record<string, string>;
    errors?: string[];
  }> {
    const errors: string[] = [];
    let manifest: BackupManifest | undefined;
    const checksums: Record<string, string> = {};
    const datasets: Record<string, string> = {};

    try {
      const zip = new AdmZip(zipBuffer);
      const zipEntries = zip.getEntries();

      // 1. Extraire manifest
      const manifestEntry = zipEntries.find(e => e.entryName === 'manifest.json');
      if (!manifestEntry) {
        errors.push('Manifest manquant');
        return { valid: false, errors };
      }
      const manifestContent = manifestEntry.getData();
      manifest = JSON.parse(manifestContent.toString('utf8'));

      // 2. Vérifier version et scope
      if (manifest.scope !== 'admin') {
        errors.push(`Scope invalide: ${manifest.scope}`);
      }

      // 3. Extraire checksums
      const checksumEntry = zipEntries.find(e => e.entryName === 'checksums.sha256');
      if (checksumEntry) {
        const checksumContent = checksumEntry.getData();
        checksumContent
          .toString('utf8')
          .split('\n')
          .filter(line => line.trim())
          .forEach(line => {
            const [hash, ...fileParts] = line.split(/\s+/);
            const file = fileParts.join(' ');
            checksums[file] = hash;
          });
      }

      // 4. Extraire datasets
      for (const entry of zipEntries) {
        if (entry.entryName.startsWith('datasets/') && entry.entryName.endsWith('.ndjson')) {
          const content = entry.getData();
          const contentStr = content.toString('utf8');
          const datasetName = entry.entryName.replace('datasets/', '').replace('.ndjson', '');
          datasets[datasetName] = contentStr;

          // Vérifier checksum
          const expectedChecksum = checksums[entry.entryName];
          if (expectedChecksum) {
            const actualChecksum = this.calculateChecksum(contentStr);
            if (actualChecksum !== expectedChecksum) {
              errors.push(`Checksum invalide pour ${entry.entryName}`);
            }
          }
        }
      }

      return {
        valid: errors.length === 0,
        manifest,
        checksums,
        datasets,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      errors.push(`Erreur extraction: ${error}`);
      return { valid: false, errors };
    }
  }

  // ============================================
  // PARSING DATASETS
  // ============================================

  private async parseDatasets(datasetsRaw: Record<string, string>) {
    const parsed: Record<string, any[]> = {};

    for (const [name, content] of Object.entries(datasetsRaw)) {
      try {
        parsed[name] = this.fromNDJSON(content);
      } catch (error) {
        console.error(`Error parsing dataset ${name}:`, error);
        parsed[name] = [];
      }
    }

    return parsed;
  }

  // ============================================
  // DIFF CALCULATION
  // ============================================

  private async calculateDiff(
    importedDatasets: Record<string, any[]>,
    strategy: 'merge' | 'replace'
  ): Promise<DiffResult> {
    const diff: DiffResult = {
      adds: 0,
      updates: 0,
      deletes: 0,
      conflicts: [],
      preview: {},
    };

    // Pour chaque dataset, calculer le diff
    for (const [datasetName, importedData] of Object.entries(importedDatasets)) {
      const currentData = await this.getCurrentDataset(datasetName);
      const datasetDiff = this.diffDataset(currentData, importedData, strategy);

      diff.adds += datasetDiff.adds.length;
      diff.updates += datasetDiff.updates.length;
      diff.deletes += datasetDiff.deletes.length;
      diff.preview[datasetName] = datasetDiff;
    }

    return diff;
  }

  private async getCurrentDataset(name: string): Promise<any[]> {
    // Récupérer les données actuelles selon le nom du dataset
    // (simplifié - dans la vraie implémentation, router vers les bonnes tables)
    const mapping: Record<string, () => Promise<any[]>> = {
      'fiscal.versions': async () => prisma.fiscalVersion.findMany(),
      'fiscal.types': async () => prisma.fiscalType.findMany(),
      'fiscal.regimes': async () => prisma.fiscalRegime.findMany(),
      'fiscal.compat': async () => prisma.fiscalCompatibility.findMany(),
      'natures': async () => prisma.natureEntity.findMany(),
      'categories': async () => prisma.category.findMany(),
      'documents.types': async () => prisma.documentType.findMany(),
      'signals.catalog': async () => prisma.signal.findMany({ where: { deletedAt: null } }),
      'delegated.settings': async () => prisma.managementCompany.findMany(),
      'system.settings': async () => prisma.appSetting.findMany(),
    };

    const fetcher = mapping[name];
    return fetcher ? await fetcher() : [];
  }

  private diffDataset(
    current: any[],
    imported: any[],
    strategy: 'merge' | 'replace'
  ) {
    const adds: any[] = [];
    const updates: any[] = [];
    const deletes: any[] = [];

    const currentMap = new Map(current.map(item => [item.id || item.code, item]));
    const importedMap = new Map(imported.map(item => [item.id || item.code, item]));

    // Trouve les ajouts et mises à jour
    for (const [key, importedItem] of importedMap.entries()) {
      if (!currentMap.has(key)) {
        adds.push(importedItem);
      } else {
        updates.push({ old: currentMap.get(key), new: importedItem });
      }
    }

    // Trouve les suppressions (seulement si strategy = replace)
    if (strategy === 'replace') {
      for (const [key, currentItem] of currentMap.entries()) {
        if (!importedMap.has(key)) {
          deletes.push(currentItem);
        }
      }
    }

    return {
      adds: adds.slice(0, this.MAX_PREVIEW_ITEMS),
      updates: updates.slice(0, this.MAX_PREVIEW_ITEMS),
      deletes: deletes.slice(0, this.MAX_PREVIEW_ITEMS),
    };
  }

  // ============================================
  // APPLY CHANGES
  // ============================================

  private async applyChanges(
    datasets: Record<string, any[]>,
    strategy: 'merge' | 'replace',
    diff: DiffResult
  ) {
    let totalAdds = 0;
    let totalUpdates = 0;
    let totalDeletes = 0;

    await prisma.$transaction(async (tx) => {
      // Appliquer les changements pour chaque dataset
      // (implémentation simplifiée - à compléter selon les specs)

      // Example pour fiscal.types
      if (datasets['fiscal.types']) {
        for (const typeData of datasets['fiscal.types']) {
          const existing = await tx.fiscalType.findUnique({ where: { id: typeData.id } });
          
          if (!existing) {
            await tx.fiscalType.create({ data: typeData });
            totalAdds++;
          } else {
            await tx.fiscalType.update({
              where: { id: typeData.id },
              data: typeData,
            });
            totalUpdates++;
          }
        }

        // Si replace, soft-delete les types non présents
        if (strategy === 'replace') {
          const importedIds = datasets['fiscal.types'].map(t => t.id);
          await tx.fiscalType.updateMany({
            where: { id: { notIn: importedIds } },
            data: { isActive: false },
          });
        }
      }

      // TODO: Implémenter pour tous les autres datasets
    });

    return { adds: totalAdds, updates: totalUpdates, deletes: totalDeletes };
  }

  // ============================================
  // SAVE BACKUP RECORD
  // ============================================

  private async saveBackupRecord(data: {
    userId: string;
    manifest: BackupManifest;
    checksum: string;
    sizeBytes: number;
    fileUrl: string;
  }) {
    return await prisma.adminBackupRecord.create({
      data: {
        createdById: data.userId,
        scope: data.manifest.scope,
        fileUrl: data.fileUrl,
        checksum: data.checksum,
        sizeBytes: data.sizeBytes,
        meta: data.manifest as any,
      },
    });
  }

  // ============================================
  // HISTORIQUE
  // ============================================

  async getBackupHistory(limit = 20) {
    return await prisma.adminBackupRecord.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getBackupById(id: string) {
    return await prisma.adminBackupRecord.findUnique({
      where: { id },
    });
  }
}

export const adminBackupService = new AdminBackupService();

