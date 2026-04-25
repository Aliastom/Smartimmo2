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
import AdmZip from 'adm-zip';
import fs from 'fs/promises';
import path from 'path';

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
  logs?: string[]; // Logs d'avancement
}

export interface ExportArchiveResult {
  buffer: Buffer;
  manifest: BackupManifest;
  checksumGlobal: string;
  sizeBytes: number;
  fileUrl: string;
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
    const archive = await this.buildArchiveBuffer(options);
    return Readable.from(archive.buffer);
  }

  /**
   * Exporte la sauvegarde admin, la persiste sur disque, et enregistre l'historique.
   */
  async exportAdminAndSave(
    options: ExportOptions,
    userId: string
  ): Promise<ExportArchiveResult & { backupRecordId: string }> {
    const archive = await this.buildArchiveBuffer(options);
    const fileUrl = await this.persistArchiveBuffer(archive.buffer, 'admin-export');
    const backupRecord = await this.saveBackupRecord({
      userId,
      manifest: archive.manifest,
      checksum: archive.manifest.checksumGlobal,
      sizeBytes: archive.buffer.length,
      fileUrl,
      note: 'Export admin',
    });

    return {
      ...archive,
      fileUrl,
      backupRecordId: backupRecord.id,
    };
  }

  resolveBackupAbsolutePath(fileUrl: string): string {
    if (path.isAbsolute(fileUrl)) {
      return fileUrl;
    }
    return path.join(process.cwd(), fileUrl);
  }

  async readArchiveFromFileUrl(fileUrl: string): Promise<Buffer> {
    const archivePath = this.resolveBackupAbsolutePath(fileUrl);
    return fs.readFile(archivePath);
  }

  async preValidateArchiveBuffer(
    zipBuffer: Buffer
  ): Promise<{ manifest: BackupManifest; datasetCount: number }> {
    const extracted = await this.extractAndValidate(zipBuffer);
    if (!extracted.valid || !extracted.manifest) {
      throw new Error(extracted.errors?.join(' | ') || 'Archive invalide');
    }

    const datasetCount = Object.keys(extracted.datasets || {}).length;
    if (datasetCount === 0) {
      throw new Error('Archive invalide: aucun dataset trouvé');
    }

    return {
      manifest: extracted.manifest,
      datasetCount,
    };
  }

  private async buildArchiveBuffer(options: ExportOptions): Promise<Omit<ExportArchiveResult, 'fileUrl'>> {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const output = new PassThrough();
    let manifest: BackupManifest | null = null;
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
      manifest = {
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

    const chunks: Buffer[] = [];
    for await (const chunk of output) {
      chunks.push(Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);

    if (!manifest) {
      throw new Error('Manifest de backup non généré');
    }

    return {
      buffer,
      manifest,
      checksumGlobal: manifest.checksumGlobal,
      sizeBytes: buffer.length,
    };
  }

  /**
   * Import et validation d'une archive de backup
   */
  async importAdmin(
    zipBuffer: Buffer,
    options: ImportOptions,
    userId: string
  ): Promise<ImportResult> {
    const logs: string[] = [];
    
    const addLog = (message: string) => {
      const timestamp = new Date().toLocaleTimeString('fr-FR');
      logs.push(`[${timestamp}] ${message}`);
    };

    try {
      addLog('📦 Début de l\'import de la sauvegarde...');
      addLog(`📋 Mode: ${options.mode}, Stratégie: ${options.strategy}`);
      
      // 1. Extraire et valider l'archive
      addLog('📂 Extraction et validation de l\'archive...');
      const extracted = await this.extractAndValidate(zipBuffer, addLog);
      
      if (!extracted.valid) {
        addLog('❌ Échec de la validation de l\'archive');
        if (extracted.errors && extracted.errors.length > 0) {
          extracted.errors.forEach(err => addLog(`   ⚠️ ${err}`));
        }
        return {
          success: false,
          errors: extracted.errors || ['Archive invalide'],
          logs,
        };
      }
      const datasetCount = extracted.datasets ? Object.keys(extracted.datasets).length : 0;
      addLog(`✅ Archive validée (${datasetCount} dataset(s) trouvé(s))`);

      // 2. Parser les datasets
      addLog('📄 Parsing des datasets...');
      const datasets = await this.parseDatasets(extracted.datasets!, addLog);
      const datasetNames = Object.keys(datasets);
      const totalItems = Object.values(datasets).reduce((sum, arr) => sum + arr.length, 0);
      addLog(`✅ ${datasetNames.length} dataset(s) parsé(s): ${datasetNames.join(', ')} (${totalItems} élément(s) au total)`);

      // 3. Calculer le diff
      addLog('🔍 Calcul des différences...');
      const diff = await this.calculateDiff(datasets, options.strategy);
      addLog(`📊 Diff calculé: ${diff.adds} ajout(s), ${diff.updates} mise(s) à jour, ${diff.deletes} suppression(s)`);

      // 4. Si mode validate ou dry-run, retourner le diff
      if (options.mode === 'validate' || options.mode === 'dry-run') {
        addLog(`✅ Mode ${options.mode} terminé (aucune modification appliquée)`);
        return {
          success: true,
          diff,
          logs,
        };
      }

      // 5. Si mode apply, appliquer les changements
      if (options.mode === 'apply') {
        addLog('⚙️ Application des changements...');
        const applied = await this.applyChanges(datasets, options.strategy, diff, addLog);
        addLog(`✅ Changements appliqués: ${applied.adds} ajout(s), ${applied.updates} mise(s) à jour, ${applied.deletes} suppression(s)`);

        // 6. Enregistrer le backup
        addLog('💾 Enregistrement de la sauvegarde...');
        const fileUrl = await this.persistArchiveBuffer(zipBuffer, 'admin-import');
        const backupRecord = await this.saveBackupRecord({
          userId,
          manifest: extracted.manifest!,
          checksum: extracted.manifest!.checksumGlobal,
          sizeBytes: zipBuffer.length,
          fileUrl,
          note: 'Import admin',
        });
        addLog(`✅ Sauvegarde enregistrée (ID: ${backupRecord.id})`);
        addLog('✨ Import terminé avec succès !');

        return {
          success: true,
          diff,
          applied,
          backupRecordId: backupRecord.id,
          logs,
        };
      }

      addLog('❌ Mode invalide');
      return { success: false, errors: ['Mode invalide'], logs };
    } catch (error) {
      console.error('Import error:', error);
      addLog(`❌ Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Erreur inconnue'],
        logs,
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
      openTransaction: dt.openTransaction,
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
      organizationId: mc.organizationId, // Inclure organizationId pour référence mais ne pas l'importer directement
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
    const lines = content.split('\n').filter(line => line.trim());
    const items: any[] = [];
    const errors: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      try {
        items.push(JSON.parse(line));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erreur inconnue';
        errors.push(`Ligne ${i + 1}: ${message}`);
      }
    }

    if (errors.length > 0) {
      throw new Error(`NDJSON invalide (${errors.length} ligne(s) en erreur): ${errors.slice(0, 5).join(' | ')}`);
    }

    return items;
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
    zipBuffer: Buffer,
    addLog?: (message: string) => void
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

    const log = addLog || (() => {}); // Fallback si pas de callback

    try {
      log('   📦 Ouverture de l\'archive ZIP...');
      const zip = new AdmZip(zipBuffer);
      const zipEntries = zip.getEntries();
      log(`   📋 ${zipEntries.length} entrée(s) trouvée(s) dans l'archive`);

      // Afficher toutes les entrées pour debug
      const entryNames = zipEntries.map(e => e.entryName);
      log(`   📝 Entrées: ${entryNames.join(', ')}`);

      // 1. Extraire manifest
      log('   🔍 Recherche du manifest.json...');
      const manifestEntry = zipEntries.find(e => e.entryName === 'manifest.json' || e.entryName === '/manifest.json');
      if (!manifestEntry) {
        log('   ❌ Manifest.json non trouvé dans l\'archive');
        errors.push('Manifest manquant');
        return { valid: false, errors };
      }
      log('   ✅ Manifest.json trouvé');
      const manifestContent = manifestEntry.getData();
      try {
        manifest = JSON.parse(manifestContent.toString('utf8'));
        log(`   📄 Manifest parsé: ${manifest.datasets?.length || 0} dataset(s) déclaré(s)`);
      } catch (parseError) {
        log(`   ❌ Erreur parsing manifest: ${parseError}`);
        errors.push(`Erreur parsing manifest: ${parseError}`);
        return { valid: false, errors };
      }

      // 2. Vérifier version et scope
      if (manifest.scope !== 'admin') {
        log(`   ⚠️ Scope invalide: ${manifest.scope} (attendu: admin)`);
        errors.push(`Scope invalide: ${manifest.scope}`);
      }

      // 3. Extraire checksums
      log('   🔍 Recherche du checksums.sha256...');
      const checksumEntry = zipEntries.find(e => e.entryName === 'checksums.sha256' || e.entryName === '/checksums.sha256');
      if (checksumEntry) {
        log('   ✅ Checksums.sha256 trouvé');
        const checksumContent = checksumEntry.getData();
        const checksumLines = checksumContent
          .toString('utf8')
          .split('\n')
          .filter(line => line.trim());
        
        checksumLines.forEach(line => {
          const [hash, ...fileParts] = line.split(/\s+/);
          const file = fileParts.join(' ');
          if (file) {
            checksums[file] = hash;
          }
        });
        log(`   📋 ${Object.keys(checksums).length} checksum(s) chargé(s)`);
      } else {
        log('   ⚠️ Checksums.sha256 non trouvé (vérification ignorée)');
      }

      // 4. Extraire datasets
      log('   📂 Extraction des datasets...');
      let datasetCount = 0;
      for (const entry of zipEntries) {
        const entryName = entry.entryName.replace(/^\/+/, ''); // Retirer les slashes initiaux
        if (entryName.startsWith('datasets/') && entryName.endsWith('.ndjson')) {
          const content = entry.getData();
          const contentStr = content.toString('utf8');
          const datasetName = entryName.replace(/^datasets\//, '').replace(/\.ndjson$/, '');
          
          if (!datasetName) {
            log(`   ⚠️ Nom de dataset invalide pour: ${entryName}`);
            continue;
          }

          datasets[datasetName] = contentStr;
          datasetCount++;
          log(`   ✅ Dataset extrait: ${datasetName} (${contentStr.split('\n').filter(l => l.trim()).length} ligne(s))`);

          // Vérifier checksum
          const expectedChecksum = checksums[entryName] || checksums[`/${entryName}`] || checksums[entry.entryName];
          if (expectedChecksum) {
            const actualChecksum = this.calculateChecksum(contentStr);
            if (actualChecksum !== expectedChecksum) {
              log(`   ⚠️ Checksum invalide pour ${datasetName} (attendu: ${expectedChecksum.slice(0, 8)}..., obtenu: ${actualChecksum.slice(0, 8)}...)`);
              errors.push(`Checksum invalide pour ${entryName}`);
            } else {
              log(`   ✅ Checksum valide pour ${datasetName}`);
            }
          }
        }
      }

      log(`   ✅ ${datasetCount} dataset(s) extrait(s) avec succès`);

      if (errors.length > 0) {
        log(`   ⚠️ ${errors.length} erreur(s) détectée(s) pendant la validation`);
      }

      return {
        valid: errors.length === 0,
        manifest,
        checksums,
        datasets,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log(`   ❌ Erreur extraction: ${errorMsg}`);
      errors.push(`Erreur extraction: ${errorMsg}`);
      return { valid: false, errors };
    }
  }

  // ============================================
  // PARSING DATASETS
  // ============================================

  private async parseDatasets(datasetsRaw: Record<string, string>, addLog?: (message: string) => void) {
    const parsed: Record<string, any[]> = {};
    const log = addLog || (() => {});

    for (const [name, content] of Object.entries(datasetsRaw)) {
      try {
        const lines = content.split('\n').filter(line => line.trim());
        log(`   📄 Parsing ${name}: ${lines.length} ligne(s)`);

        const items = this.fromNDJSON(content);
        parsed[name] = items;
        log(`   ✅ ${name}: ${items.length} élément(s) parsé(s)`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        log(`   ❌ Erreur parsing ${name}: ${errorMsg}`);
        console.error(`Error parsing dataset ${name}:`, error);
        throw new Error(`Dataset invalide (${name}): ${errorMsg}`);
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
      diff.preview[datasetName] = {
        adds: datasetDiff.adds.slice(0, this.MAX_PREVIEW_ITEMS),
        updates: datasetDiff.updates.slice(0, this.MAX_PREVIEW_ITEMS),
        deletes: datasetDiff.deletes.slice(0, this.MAX_PREVIEW_ITEMS),
      };
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

    // Utiliser id ou code comme clé selon ce qui est disponible
    const getKey = (item: any) => item.id || item.code || item.key || JSON.stringify(item);
    
    const currentMap = new Map(current.map(item => [getKey(item), item]));
    const importedMap = new Map(imported.map(item => [getKey(item), item]));

    // Trouve les ajouts et mises à jour
    for (const [key, importedItem] of importedMap.entries()) {
      if (!currentMap.has(key)) {
        adds.push(importedItem);
      } else {
        // Comparer pour voir si c'est vraiment une mise à jour
        const currentItem = currentMap.get(key);
        if (JSON.stringify(currentItem) !== JSON.stringify(importedItem)) {
          updates.push({ old: currentItem, new: importedItem });
        }
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

    return { adds, updates, deletes };
  }

  // ============================================
  // APPLY CHANGES
  // ============================================

  private async applyChanges(
    datasets: Record<string, any[]>,
    strategy: 'merge' | 'replace',
    diff: DiffResult,
    addLog?: (message: string) => void
  ) {
    let totalAdds = 0;
    let totalUpdates = 0;
    let totalDeletes = 0;

    const log = addLog || (() => {});

    try {
      await prisma.$transaction(async (tx) => {
      if (strategy === 'replace') {
        const replaceDeletes = await this.applyReplaceDeletes(tx, datasets, log);
        totalDeletes += replaceDeletes;
      }

      // 1. Fiscal Versions + Params
      if (datasets['fiscal.versions']) {
        let adds = 0;
        let updates = 0;
        log('   💼 Application des versions fiscales...');
        for (const versionData of datasets['fiscal.versions']) {
          const { params, ...versionFields } = versionData;
          const existing = await tx.fiscalVersion.findUnique({ where: { id: versionFields.id } });
          
          if (!existing) {
            // Exclure les champs automatiques (createdAt, updatedAt) et les champs null
            const { createdAt, updatedAt, ...cleanVersionFields } = versionFields;
            try {
              await tx.fiscalVersion.create({
                data: {
                  ...cleanVersionFields,
                  params: params ? {
                    create: {
                      ...params,
                      // versionId est géré automatiquement par Prisma via la relation
                    },
                  } : undefined,
                },
              });
              adds++;
              log(`      ✅ Créé: ${versionFields.code || versionFields.id}`);
            } catch (createError: any) {
              log(`      ❌ Erreur création ${versionFields.code || versionFields.id}: ${createError.message}`);
              throw createError;
            }
          } else {
            const { createdAt, updatedAt, ...cleanVersionFields } = versionFields;
            try {
              await tx.fiscalVersion.update({
                where: { id: versionFields.id },
                data: cleanVersionFields,
              });
              if (params) {
                await tx.fiscalParams.upsert({
                  where: { versionId: versionFields.id },
                  create: { 
                    ...params,
                    versionId: versionFields.id,
                  },
                  update: params,
                });
              }
              updates++;
              log(`      🔄 Mis à jour: ${versionFields.code || versionFields.id}`);
            } catch (updateError: any) {
              log(`      ❌ Erreur mise à jour ${versionFields.code || versionFields.id}: ${updateError.message}`);
              throw updateError;
            }
          }
        }
        totalAdds += adds;
        totalUpdates += updates;
        log(`   ✅ Versions fiscales: ${adds} ajout(s), ${updates} mise(s) à jour`);
      }

      // 2. Fiscal Types
      if (datasets['fiscal.types']) {
        let adds = 0;
        let updates = 0;
        log('   💼 Application des types fiscaux...');
        for (const typeData of datasets['fiscal.types']) {
          const existing = await tx.fiscalType.findUnique({ where: { id: typeData.id } });
          
          if (!existing) {
            await tx.fiscalType.create({ data: typeData });
            adds++;
          } else {
            await tx.fiscalType.update({
              where: { id: typeData.id },
              data: typeData,
            });
            updates++;
          }
        }
        totalAdds += adds;
        totalUpdates += updates;
        log(`   ✅ Types fiscaux: ${adds} ajout(s), ${updates} mise(s) à jour`);
      }

      // 3. Fiscal Regimes
      if (datasets['fiscal.regimes']) {
        let adds = 0;
        let updates = 0;
        log('   💼 Application des régimes fiscaux...');
        for (const regimeData of datasets['fiscal.regimes']) {
          const { createdAt, updatedAt, ...cleanRegimeData } = regimeData;
          const existing = await tx.fiscalRegime.findUnique({ where: { id: regimeData.id } });
          
          if (!existing) {
            try {
              await tx.fiscalRegime.create({ data: cleanRegimeData });
              adds++;
              log(`      ✅ Créé: ${regimeData.id}`);
            } catch (createError: any) {
              log(`      ❌ Erreur création ${regimeData.id}: ${createError.message}`);
              throw createError;
            }
          } else {
            try {
              await tx.fiscalRegime.update({
                where: { id: regimeData.id },
                data: cleanRegimeData,
              });
              updates++;
              log(`      🔄 Mis à jour: ${regimeData.id}`);
            } catch (updateError: any) {
              log(`      ❌ Erreur mise à jour ${regimeData.id}: ${updateError.message}`);
              throw updateError;
            }
          }
        }
        totalAdds += adds;
        totalUpdates += updates;
        log(`   ✅ Régimes fiscaux: ${adds} ajout(s), ${updates} mise(s) à jour`);
      }

      // 4. Fiscal Compatibilities
      if (datasets['fiscal.compat']) {
        let adds = 0;
        let updates = 0;
        log('   💼 Application des compatibilités fiscales...');
        for (const compatData of datasets['fiscal.compat']) {
          const { createdAt, updatedAt, ...cleanCompatData } = compatData;
          const existing = await tx.fiscalCompatibility.findUnique({ where: { id: compatData.id } });
          
          if (!existing) {
            try {
              await tx.fiscalCompatibility.create({ data: cleanCompatData });
              adds++;
              log(`      ✅ Créé: ${compatData.id}`);
            } catch (createError: any) {
              log(`      ❌ Erreur création ${compatData.id}: ${createError.message}`);
              throw createError;
            }
          } else {
            try {
              await tx.fiscalCompatibility.update({
                where: { id: compatData.id },
                data: cleanCompatData,
              });
              updates++;
              log(`      🔄 Mis à jour: ${compatData.id}`);
            } catch (updateError: any) {
              log(`      ❌ Erreur mise à jour ${compatData.id}: ${updateError.message}`);
              throw updateError;
            }
          }
        }
        totalAdds += adds;
        totalUpdates += updates;
        log(`   ✅ Compatibilités fiscales: ${adds} ajout(s), ${updates} mise(s) à jour`);
      }

      // 5. Categories (DOIT être avant les natures car les natures référencent les catégories)
      if (datasets['categories']) {
        let adds = 0;
        let updates = 0;
        log('   💼 Application des catégories...');
        for (const categoryData of datasets['categories']) {
          const { createdAt, updatedAt, ...cleanCategoryData } = categoryData;
          const existing = await tx.category.findUnique({ where: { slug: categoryData.slug } });
          
          if (!existing) {
            try {
              await tx.category.create({ data: cleanCategoryData });
              adds++;
              log(`      ✅ Créé: ${categoryData.slug}`);
            } catch (createError: any) {
              log(`      ❌ Erreur création ${categoryData.slug}: ${createError.message}`);
              throw createError;
            }
          } else {
            try {
              await tx.category.update({
                where: { slug: categoryData.slug },
                data: cleanCategoryData,
              });
              updates++;
              log(`      🔄 Mis à jour: ${categoryData.slug}`);
            } catch (updateError: any) {
              log(`      ❌ Erreur mise à jour ${categoryData.slug}: ${updateError.message}`);
              throw updateError;
            }
          }
        }
        totalAdds += adds;
        totalUpdates += updates;
        log(`   ✅ Catégories: ${adds} ajout(s), ${updates} mise(s) à jour`);
      }

      // 6. Natures (après les catégories car elles peuvent référencer des catégories)
      if (datasets['natures']) {
        let adds = 0;
        let updates = 0;
        log('   💼 Application des natures...');
        for (const natureData of datasets['natures']) {
          // Exclure les champs qui n'existent pas dans le schéma Prisma
          const { createdAt, updatedAt, defaultCategoryId, allowedTypes, ...cleanNatureData } = natureData;
          const existing = await tx.natureEntity.findUnique({ where: { code: natureData.code } });
          
          if (!existing) {
            try {
              // Vérifier si la catégorie existe avant de créer NatureDefault
              let validCategoryId = null;
              if (defaultCategoryId) {
                const categoryExists = await tx.category.findUnique({ where: { id: defaultCategoryId } });
                if (categoryExists) {
                  validCategoryId = defaultCategoryId;
                } else {
                  log(`      ⚠️ Catégorie ${defaultCategoryId} non trouvée pour ${natureData.code}, ignorée`);
                }
              }
              
              // NatureEntity n'a que: code, label, flow
              await tx.natureEntity.create({ 
                data: {
                  code: cleanNatureData.code,
                  label: cleanNatureData.label,
                  flow: cleanNatureData.flow || null,
                  // Créer NatureDefault si validCategoryId existe
                  NatureDefault: validCategoryId ? {
                    create: {
                      defaultCategoryId: validCategoryId,
                    },
                  } : undefined,
                  // Créer NatureRule si allowedTypes existe
                  NatureRule: allowedTypes && allowedTypes.length > 0 ? {
                    create: allowedTypes.map((allowedType: string) => ({
                      allowedType,
                    })),
                  } : undefined,
                }
              });
              adds++;
              log(`      ✅ Créé: ${natureData.code}${validCategoryId ? ' (avec catégorie par défaut)' : ''}${allowedTypes && allowedTypes.length > 0 ? ` (${allowedTypes.length} règle(s))` : ''}`);
            } catch (createError: any) {
              log(`      ❌ Erreur création ${natureData.code}: ${createError.message}`);
              throw createError;
            }
          } else {
            try {
              // NatureEntity n'a que: code, label, flow
              await tx.natureEntity.update({
                where: { code: natureData.code },
                data: {
                  label: cleanNatureData.label,
                  flow: cleanNatureData.flow || null,
                },
              });
              
              // Mettre à jour ou créer NatureDefault (vérifier que la catégorie existe)
              if (defaultCategoryId !== undefined) {
                let validCategoryId = null;
                if (defaultCategoryId) {
                  const categoryExists = await tx.category.findUnique({ where: { id: defaultCategoryId } });
                  if (categoryExists) {
                    validCategoryId = defaultCategoryId;
                  } else {
                    log(`      ⚠️ Catégorie ${defaultCategoryId} non trouvée pour ${natureData.code}, ignorée`);
                  }
                }
                
                await tx.natureDefault.upsert({
                  where: { natureCode: natureData.code },
                  create: {
                    natureCode: natureData.code,
                    defaultCategoryId: validCategoryId,
                  },
                  update: {
                    defaultCategoryId: validCategoryId,
                  },
                });
              }
              
              // Mettre à jour NatureRule (supprimer les anciennes et créer les nouvelles)
              if (allowedTypes !== undefined) {
                await tx.natureRule.deleteMany({ where: { natureCode: natureData.code } });
                if (allowedTypes.length > 0) {
                  await tx.natureRule.createMany({
                    data: allowedTypes.map((allowedType: string) => ({
                      natureCode: natureData.code,
                      allowedType,
                    })),
                  });
                }
              }
              
              updates++;
              log(`      🔄 Mis à jour: ${natureData.code}`);
            } catch (updateError: any) {
              log(`      ❌ Erreur mise à jour ${natureData.code}: ${updateError.message}`);
              throw updateError;
            }
          }
        }
        totalAdds += adds;
        totalUpdates += updates;
        log(`   ✅ Natures: ${adds} ajout(s), ${updates} mise(s) à jour`);
      }

      // 7. Document Types
      if (datasets['documents.types']) {
        let adds = 0;
        let updates = 0;
        log('   💼 Application des types de documents...');
        for (const docTypeData of datasets['documents.types']) {
          // Exclure les relations et champs automatiques
          const { createdAt, updatedAt, keywords, signals, extractionRules, ...cleanDocTypeData } = docTypeData;
          const existing = await tx.documentType.findUnique({ where: { id: docTypeData.id } });
          
          if (!existing) {
            try {
              // Résoudre les signaux d'abord (nécessite await)
              let validTypeSignals: any[] = [];
              if (signals && signals.length > 0) {
                validTypeSignals = await Promise.all(
                  signals.map(async (sig: any) => {
                    const signal = await tx.signal.findUnique({ where: { code: sig.signalCode } });
                    if (!signal) {
                      log(`      ⚠️ Signal ${sig.signalCode} non trouvé pour ${docTypeData.code}, ignoré`);
                      return null;
                    }
                    return {
                      signalId: signal.id,
                      weight: sig.weight || 1,
                      enabled: sig.enabled !== false,
                      order: sig.order || 0,
                    };
                  })
                );
                validTypeSignals = validTypeSignals.filter((s): s is NonNullable<typeof s> => s !== null);
              }
              
              // Créer le DocumentType avec ses relations
              await tx.documentType.create({ 
                data: {
                  ...cleanDocTypeData,
                  // Créer DocumentKeyword si keywords existe
                  DocumentKeyword: keywords && keywords.length > 0 ? {
                    create: keywords.map((kw: any) => ({
                      keyword: kw.keyword,
                      weight: kw.weight || 1,
                      context: kw.context || null,
                    })),
                  } : undefined,
                  // Créer TypeSignal si validTypeSignals existe
                  TypeSignal: validTypeSignals.length > 0 ? {
                    create: validTypeSignals,
                  } : undefined,
                  // Créer DocumentExtractionRule si extractionRules existe
                  DocumentExtractionRule: extractionRules && extractionRules.length > 0 ? {
                    create: extractionRules.map((rule: any) => ({
                      fieldName: rule.fieldName,
                      pattern: rule.pattern || null,
                      postProcess: rule.postProcess || null,
                      priority: rule.priority || 0,
                    })),
                  } : undefined,
                }
              });
              adds++;
              log(`      ✅ Créé: ${docTypeData.code}${keywords && keywords.length > 0 ? ` (${keywords.length} mot(s)-clé(s))` : ''}${validTypeSignals.length > 0 ? ` (${validTypeSignals.length} signal(aux))` : ''}${extractionRules && extractionRules.length > 0 ? ` (${extractionRules.length} règle(s))` : ''}`);
            } catch (createError: any) {
              log(`      ❌ Erreur création ${docTypeData.code}: ${createError.message}`);
              throw createError;
            }
          } else {
            try {
              // Mettre à jour le DocumentType
              await tx.documentType.update({
                where: { id: docTypeData.id },
                data: cleanDocTypeData,
              });
              
              // Mettre à jour DocumentKeyword (supprimer les anciennes et créer les nouvelles)
              if (keywords !== undefined) {
                await tx.documentKeyword.deleteMany({ where: { documentTypeId: docTypeData.id } });
                if (keywords.length > 0) {
                  await tx.documentKeyword.createMany({
                    data: keywords.map((kw: any) => ({
                      documentTypeId: docTypeData.id,
                      keyword: kw.keyword,
                      weight: kw.weight || 1,
                      context: kw.context || null,
                    })),
                  });
                }
              }
              
              // Mettre à jour TypeSignal (supprimer les anciennes et créer les nouvelles)
              if (signals !== undefined) {
                await tx.typeSignal.deleteMany({ where: { documentTypeId: docTypeData.id } });
                if (signals.length > 0) {
                  const validSignals = await Promise.all(
                    signals.map(async (sig: any) => {
                      const signal = await tx.signal.findUnique({ where: { code: sig.signalCode } });
                      if (!signal) {
                        log(`      ⚠️ Signal ${sig.signalCode} non trouvé pour ${docTypeData.code}, ignoré`);
                        return null;
                      }
                      return {
                        documentTypeId: docTypeData.id,
                        signalId: signal.id,
                        weight: sig.weight || 1,
                        enabled: sig.enabled !== false,
                        order: sig.order || 0,
                      };
                    })
                  );
                  const filteredSignals = validSignals.filter((s): s is NonNullable<typeof s> => s !== null);
                  if (filteredSignals.length > 0) {
                    await tx.typeSignal.createMany({ data: filteredSignals });
                  }
                }
              }
              
              // Mettre à jour DocumentExtractionRule (supprimer les anciennes et créer les nouvelles)
              if (extractionRules !== undefined) {
                await tx.documentExtractionRule.deleteMany({ where: { documentTypeId: docTypeData.id } });
                if (extractionRules.length > 0) {
                  await tx.documentExtractionRule.createMany({
                    data: extractionRules.map((rule: any) => ({
                      documentTypeId: docTypeData.id,
                      fieldName: rule.fieldName,
                      pattern: rule.pattern || null,
                      postProcess: rule.postProcess || null,
                      priority: rule.priority || 0,
                    })),
                  });
                }
              }
              
              updates++;
              log(`      🔄 Mis à jour: ${docTypeData.code}`);
            } catch (updateError: any) {
              log(`      ❌ Erreur mise à jour ${docTypeData.code}: ${updateError.message}`);
              throw updateError;
            }
          }
        }
        totalAdds += adds;
        totalUpdates += updates;
        log(`   ✅ Types de documents: ${adds} ajout(s), ${updates} mise(s) à jour`);
      }

      // 8. Signals Catalog
      if (datasets['signals.catalog']) {
        let adds = 0;
        let updates = 0;
        log('   💼 Application des signaux...');
        for (const signalData of datasets['signals.catalog']) {
          const { createdAt, updatedAt, deletedAt, ...cleanSignalData } = signalData;
          const existing = await tx.signal.findUnique({ where: { id: signalData.id } });
          
          if (!existing) {
            try {
              await tx.signal.create({ data: cleanSignalData });
              adds++;
              log(`      ✅ Créé: ${signalData.code || signalData.id}`);
            } catch (createError: any) {
              log(`      ❌ Erreur création ${signalData.code || signalData.id}: ${createError.message}`);
              throw createError;
            }
          } else {
            try {
              await tx.signal.update({
                where: { id: signalData.id },
                data: cleanSignalData,
              });
              updates++;
              log(`      🔄 Mis à jour: ${signalData.code || signalData.id}`);
            } catch (updateError: any) {
              log(`      ❌ Erreur mise à jour ${signalData.code || signalData.id}: ${updateError.message}`);
              throw updateError;
            }
          }
        }
        totalAdds += adds;
        totalUpdates += updates;
        log(`   ✅ Signaux: ${adds} ajout(s), ${updates} mise(s) à jour`);
      }

      // 9. Delegated Settings (Management Companies)
      if (datasets['delegated.settings']) {
        let adds = 0;
        let updates = 0;
        log('   💼 Application des sociétés de gestion...');
        for (const companyData of datasets['delegated.settings']) {
          // Note: organizationId n'est PAS importé car les ManagementCompany sont spécifiques à chaque organisation
          // Chaque organisation doit créer ses propres sociétés de gestion
          // Le backup admin peut servir de modèle mais ne doit pas créer de sociétés pour d'autres organisations
          const { createdAt, updatedAt, organizationId, ...cleanCompanyData } = companyData;
          log(`      ⚠️ Ignoré (organisation spécifique): ${companyData.nom || companyData.id}`);
          // On ne crée pas de ManagementCompany lors de l'import admin car elles sont spécifiques à chaque organisation
          // Les utilisateurs doivent créer leurs propres sociétés de gestion
          continue;
        }
        log(`   ⚠️ Sociétés de gestion: ignorées (spécifiques à chaque organisation)`);
      }

      // 10. System Settings
      if (datasets['system.settings']) {
        let adds = 0;
        let updates = 0;
        log('   💼 Application des paramètres système...');
        for (const settingData of datasets['system.settings']) {
          const { createdAt, updatedAt, ...cleanSettingData } = settingData;
          const existing = await tx.appSetting.findUnique({ where: { key: settingData.key } });
          
          if (!existing) {
            try {
              await tx.appSetting.create({ data: cleanSettingData });
              adds++;
              log(`      ✅ Créé: ${settingData.key}`);
            } catch (createError: any) {
              log(`      ❌ Erreur création ${settingData.key}: ${createError.message}`);
              throw createError;
            }
          } else {
            try {
              await tx.appSetting.update({
                where: { key: settingData.key },
                data: cleanSettingData,
              });
              updates++;
              log(`      🔄 Mis à jour: ${settingData.key}`);
            } catch (updateError: any) {
              log(`      ❌ Erreur mise à jour ${settingData.key}: ${updateError.message}`);
              throw updateError;
            }
          }
        }
        totalAdds += adds;
        totalUpdates += updates;
        log(`   ✅ Paramètres système: ${adds} ajout(s), ${updates} mise(s) à jour`);
      }

      log(`   ✅ Total: ${totalAdds} ajout(s), ${totalUpdates} mise(s) à jour, ${totalDeletes} suppression(s)`);
      }, {
        timeout: 30000, // 30 secondes max
      });

      return { adds: totalAdds, updates: totalUpdates, deletes: totalDeletes };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log(`   ❌ Erreur dans la transaction: ${errorMsg}`);
      if (error instanceof Error && error.stack) {
        log(`   Stack: ${error.stack.substring(0, 300)}`);
      }
      throw error; // Re-lancer pour que l'appelant puisse gérer
    }
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
    note?: string;
  }) {
    return await prisma.adminBackupRecord.create({
      data: {
        createdById: data.userId,
        scope: data.manifest.scope,
        fileUrl: data.fileUrl,
        checksum: data.checksum,
        sizeBytes: data.sizeBytes,
        note: data.note,
        meta: data.manifest as any,
      },
    });
  }

  private async persistArchiveBuffer(buffer: Buffer, prefix: string): Promise<string> {
    const backupDir = path.join(process.cwd(), 'storage', 'backups', 'admin');
    await fs.mkdir(backupDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = Math.random().toString(36).slice(2, 8);
    const fileName = `${prefix}-${stamp}-${random}.zip`;
    const fullPath = path.join(backupDir, fileName);
    await fs.writeFile(fullPath, buffer);
    return path.relative(process.cwd(), fullPath).replace(/\\/g, '/');
  }

  private async applyReplaceDeletes(
    tx: any,
    datasets: Record<string, any[]>,
    addLog?: (message: string) => void
  ): Promise<number> {
    const log = addLog || (() => {});
    let deleted = 0;

    if (datasets['fiscal.versions']) {
      const ids = datasets['fiscal.versions'].map((x: any) => x.id).filter(Boolean);
      const res = await tx.fiscalVersion.deleteMany({ where: ids.length ? { id: { notIn: ids } } : {} });
      deleted += res.count;
    }

    if (datasets['fiscal.types']) {
      const ids = datasets['fiscal.types'].map((x: any) => x.id).filter(Boolean);
      const res = await tx.fiscalType.deleteMany({ where: ids.length ? { id: { notIn: ids } } : {} });
      deleted += res.count;
    }

    if (datasets['fiscal.regimes']) {
      const ids = datasets['fiscal.regimes'].map((x: any) => x.id).filter(Boolean);
      const res = await tx.fiscalRegime.deleteMany({ where: ids.length ? { id: { notIn: ids } } : {} });
      deleted += res.count;
    }

    if (datasets['fiscal.compat']) {
      const ids = datasets['fiscal.compat'].map((x: any) => x.id).filter(Boolean);
      const res = await tx.fiscalCompatibility.deleteMany({ where: ids.length ? { id: { notIn: ids } } : {} });
      deleted += res.count;
    }

    if (datasets['natures']) {
      const codes = datasets['natures'].map((x: any) => x.code).filter(Boolean);
      await tx.natureRule.deleteMany({ where: codes.length ? { natureCode: { notIn: codes } } : {} });
      await tx.natureDefault.deleteMany({ where: codes.length ? { natureCode: { notIn: codes } } : {} });
      const res = await tx.natureEntity.deleteMany({ where: codes.length ? { code: { notIn: codes } } : {} });
      deleted += res.count;
    }

    if (datasets['categories']) {
      const slugs = datasets['categories'].map((x: any) => x.slug).filter(Boolean);
      const res = await tx.category.updateMany({
        where: slugs.length ? { slug: { notIn: slugs }, actif: true } : { actif: true },
        data: { actif: false },
      });
      deleted += res.count;
    }

    if (datasets['documents.types']) {
      const ids = datasets['documents.types'].map((x: any) => x.id).filter(Boolean);
      const res = await tx.documentType.updateMany({
        where: ids.length ? { id: { notIn: ids }, isActive: true } : { isActive: true },
        data: { isActive: false },
      });
      deleted += res.count;
    }

    if (datasets['signals.catalog']) {
      const ids = datasets['signals.catalog'].map((x: any) => x.id).filter(Boolean);
      const now = new Date();
      const res = await tx.signal.updateMany({
        where: ids.length
          ? { id: { notIn: ids }, deletedAt: null, protected: false }
          : { deletedAt: null, protected: false },
        data: { deletedAt: now },
      });
      deleted += res.count;
    }

    if (datasets['system.settings']) {
      const keys = datasets['system.settings'].map((x: any) => x.key).filter(Boolean);
      const res = await tx.appSetting.deleteMany({ where: keys.length ? { key: { notIn: keys } } : {} });
      deleted += res.count;
    }

    if (deleted > 0) {
      log(`   🗑️ Replace: ${deleted} suppression(s)/désactivation(s) appliquée(s)`);
    } else {
      log('   🗑️ Replace: aucune suppression nécessaire');
    }

    return deleted;
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

