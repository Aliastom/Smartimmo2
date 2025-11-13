/**
 * Worker pour orchestrer le scraping des sources fiscales officielles
 * et créer une version draft des paramètres fiscaux
 */

import { prisma } from '@/lib/prisma';
import { BofipAdapter } from './adapters/BofipAdapter';
import { DgfipAdapter } from './adapters/DgfipAdapter';
import { ServicePublicAdapter } from './adapters/ServicePublicAdapter';
import { LegifranceAdapter } from './adapters/LegifranceAdapter';
import { openfiscaProvider } from '../providers/openfisca/OpenfiscaProvider';
import { consensusMerge } from '../providers/consensus/ConsensusMerger';
import type { Confidence } from '../providers/consensus/confidence';
import {
  TaxPartial,
  ScrapeJobResult,
  JobState,
  TaxSourceSnapshotData,
  RateLimitConfig,
  CacheConfig
} from './types';
import {
  mergePartials,
  validateParams,
  diffParams,
  toFiscalParamsJson,
  fromFiscalParamsJson,
  createHash,
  mergeSafely
} from './utils';

/**
 * Configuration par défaut du rate limiting
 */
const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  requestsPerSecond: 1,
  maxRetries: 3,
  retryDelayMs: 1000,
  backoffMultiplier: 2,
  circuitBreakerThreshold: 5
};

/**
 * Configuration du cache
 */
const DEFAULT_CACHE: CacheConfig = {
  enabled: true,
  ttlHours: 48,
  directory: '.cache/tax-sources'
};

/**
 * Store des jobs en cours (global au niveau de globalThis pour survivre aux reloads Next.js)
 * Avec TTL de 5 minutes pour nettoyer automatiquement
 */
declare global {
  var taxJobStore: Map<string, { job: ScrapeJobResult; expiresAt: number }> | undefined;
  var taxJobCleanupInterval: NodeJS.Timeout | undefined;
}

// Initialiser le store global s'il n'existe pas
if (!global.taxJobStore) {
  global.taxJobStore = new Map<string, { job: ScrapeJobResult; expiresAt: number }>();
  console.log('[TaxScrapeWorker] Store global initialisé');
}

// Nettoyer les anciens jobs toutes les minutes (une seule fois)
if (!global.taxJobCleanupInterval) {
  global.taxJobCleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [jobId, { expiresAt }] of global.taxJobStore!.entries()) {
      if (now > expiresAt) {
        global.taxJobStore!.delete(jobId);
        console.log(`[TaxScrapeWorker] Job ${jobId} expiré et supprimé`);
      }
    }
  }, 60000);
}

const jobStore = global.taxJobStore;

export class TaxScrapeWorker {
  private adapters: Array<any>;
  private rateLimitConfig: RateLimitConfig;
  private cacheConfig: CacheConfig;
  
  constructor(
    rateLimitConfig: RateLimitConfig = DEFAULT_RATE_LIMIT,
    cacheConfig: CacheConfig = DEFAULT_CACHE
  ) {
    this.adapters = [
      new BofipAdapter(),
      new DgfipAdapter(),
      new ServicePublicAdapter(),
      new LegifranceAdapter()
    ];
    this.rateLimitConfig = rateLimitConfig;
    this.cacheConfig = cacheConfig;
  }
  
  /**
   * Lance un job de scraping pour une année donnée
   */
  async startJob(year: number, userId: string): Promise<string> {
    const jobId = `scrape-${year}-${Date.now()}`;
    
    // Initialiser le job avec un TTL de 5 minutes
    const job: ScrapeJobResult = {
      jobId,
      state: 'pending',
      progress: 0,
      logs: [`Job créé pour l'année ${year}`]
    };
    
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes
    jobStore.set(jobId, { job, expiresAt });
    
    console.log(`[TaxScrapeWorker] Job ${jobId} créé et enregistré dans le store`);
    
    // Lancer le scraping en arrière-plan
    this.runJob(jobId, year, userId).catch(error => {
      console.error(`Erreur job ${jobId}:`, error);
      this.updateJob(jobId, {
        state: 'failed',
        error: error.message
      });
    });
    
    return jobId;
  }
  
  /**
   * Récupère l'état d'un job
   */
  getJobStatus(jobId: string): ScrapeJobResult | null {
    const entry = jobStore.get(jobId);
    if (!entry) {
      console.log(`[TaxScrapeWorker] Job ${jobId} non trouvé dans le store`);
      console.log(`[TaxScrapeWorker] Jobs disponibles:`, Array.from(jobStore.keys()));
      return null;
    }
    return entry.job;
  }
  
  /**
   * Exécute le job de scraping complet
   */
  private async runJob(jobId: string, year: number, userId: string): Promise<void> {
    this.addLog(jobId, `Démarrage du scraping pour ${year}`);
    
    // Étape 1a: Fetch depuis OpenFisca (source primaire)
    this.updateJob(jobId, { state: 'fetching', progress: 5 });
    this.addLog(jobId, 'Tentative de récupération depuis OpenFisca...');
    
    const openfiscaPartials = await this.fetchOpenfisca(jobId, year);
    
    if (openfiscaPartials.length > 0) {
      this.addLog(jobId, `✅ OpenFisca: ${openfiscaPartials.length} section(s) récupérée(s)`);
    } else {
      this.addLog(jobId, '⚠️ OpenFisca non disponible, utilisation des scrapers web uniquement');
    }
    
    // Étape 1b: Fetch depuis les scrapers web (sources secondaires)
    this.updateJob(jobId, { state: 'fetching', progress: 10 });
    const webPartials = await this.fetchAllSources(jobId, year);
    
    // Combiner toutes les sources
    const allPartials = [...openfiscaPartials, ...webPartials];
    
    if (allPartials.length === 0) {
      throw new Error('Aucune donnée récupérée depuis les sources');
    }
    
    this.addLog(jobId, `${allPartials.length} sections récupérées au total (${openfiscaPartials.length} OpenFisca + ${webPartials.length} web)`);
    
    // Logs détaillés : sources disponibles par section
    this.addLog(jobId, '📋 Sources disponibles par section:');
    const grouped = allPartials.reduce((acc, p) => {
      if (!acc[p.section]) acc[p.section] = [];
      acc[p.section].push(p);
      return acc;
    }, {} as Record<TaxSection, TaxPartial[]>);
    
    for (const section of ['IR', 'IR_DECOTE', 'PS', 'MICRO', 'DEFICIT', 'PER', 'SCI_IS'] as TaxSection[]) {
      const sources = grouped[section] || [];
      if (sources.length > 0) {
        const sourceNames = sources.map(s => s.meta.source).join(', ');
        this.addLog(jobId, `  • ${section}: ${sources.length} source(s) → ${sourceNames}`);
      } else {
        this.addLog(jobId, `  • ${section}: aucune source`);
      }
    }
    
    // Étape 2: Sauvegarder les snapshots
    this.updateJob(jobId, { state: 'parsing', progress: 30 });
    await this.saveSnapshots(jobId, allPartials);
    
    // Étape 3: Merge à consensus (OpenFisca + Web)
    this.updateJob(jobId, { state: 'merging', progress: 50 });
    this.addLog(jobId, 'Fusion à consensus (OpenFisca + sources web)...');
    
    // Récupérer la version active pour la fusion
    const activeVersion = await this.getActiveVersion(year);
    const activeParams = activeVersion 
      ? fromFiscalParamsJson(activeVersion.params.jsonData, year)
      : { year } as any;
    
    // Utiliser le consensus merger
    const consensusResult = consensusMerge(activeParams, allPartials);
    
    this.addLog(jobId, 'Fusion à consensus complétée');
    
    // Calculer les statistiques
    const sectionsOk = Object.values(consensusResult.completeness).filter(c => c.status === 'ok').length;
    const sectionsMissing = Object.values(consensusResult.completeness).filter(c => c.status === 'missing').length;
    const sectionsInvalid = Object.values(consensusResult.completeness).filter(c => c.status === 'invalid').length;
    
    this.addLog(jobId, `📊 Complétude: ${sectionsOk} OK, ${sectionsMissing} manquantes, ${sectionsInvalid} invalides`);
    
    // Afficher le détail par section avec confiance
    for (const [section, comp] of Object.entries(consensusResult.completeness)) {
      const conf = consensusResult.confidence[section as TaxSection];
      const source = consensusResult.sources[section as TaxSection];
      
      if (comp.status === 'ok') {
        this.addLog(jobId, `  ✅ ${section}: OK (${source}, confiance: ${(conf * 100).toFixed(0)}%)`);
      } else if (comp.status === 'missing') {
        this.addLog(jobId, `  ⚠️ ${section}: MANQUANTE`);
      } else {
        this.addLog(jobId, `  ❌ ${section}: INVALIDE - ${comp.reason}`);
      }
    }
    
    // Vérifier les sections bloquantes
    if (consensusResult.blocking.length > 0) {
      const blockingList = consensusResult.blocking.join(', ');
      const errorMsg = `Sections critiques avec confiance insuffisante: ${blockingList}`;
      this.addLog(jobId, `❌ ${errorMsg}`);
      
      this.updateJob(jobId, {
        state: 'completed',
        progress: 100,
        status: 'incomplete',
        completeness: consensusResult.completeness,
        confidence: consensusResult.confidence,
        blocking: consensusResult.blocking,
        sources: consensusResult.sources,
        warnings: [errorMsg]
      });
      
      return;
    }
    
    // Mettre à jour le job avec les stats
    this.updateJob(jobId, {
      completeness: consensusResult.completeness,
      confidence: consensusResult.confidence,
      sources: consensusResult.sources,
      blocking: consensusResult.blocking,
      sectionsOk,
      sectionsMissing,
      sectionsInvalid
    });
    
    // Vérifier le seuil de complétude (minimum 2 sections OK)
    const MIN_SECTIONS_OK = 2;
    
    if (sectionsOk < MIN_SECTIONS_OK) {
      const errorMsg = `Scraping incomplet: seulement ${sectionsOk} section(s) OK sur ${Object.keys(consensusResult.completeness).length}. Minimum requis: ${MIN_SECTIONS_OK}`;
      this.addLog(jobId, `❌ ${errorMsg}`);
      
      this.updateJob(jobId, {
        state: 'completed',
        progress: 100,
        status: 'incomplete',
        warnings: [errorMsg]
      });
      
      return;
    }
    
    // Étape 4: Validation globale
    this.updateJob(jobId, { state: 'validating', progress: 60 });
    
    // Construire les params complets pour validation
    const mergedForValidation = { year, ...consensusResult.merged };
    const validation = validateParams(mergedForValidation as any);
    
    if (!validation.valid) {
      const errorMsg = `Validation échouée: ${validation.errors.join(', ')}`;
      this.addLog(jobId, `❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }
    
    this.addLog(jobId, '✅ Validation globale réussie');
    
    if (validation.warnings.length > 0) {
      for (const warning of validation.warnings) {
        this.addLog(jobId, `⚠️ ${warning}`);
      }
    }
    
    // Étape 5: Comparer et fusionner avec la version active
    this.updateJob(jobId, { state: 'comparing', progress: 70 });
    
    if (!activeVersion) {
      this.addLog(jobId, `Aucune version active trouvée pour ${year}, création d'une nouvelle version`);
      
      // Créer une nouvelle version (sans fusion car pas de version existante)
      const scrapedSections = [...new Set(allPartials.map(p => p.section))];
      await this.createDraftVersion(jobId, year, consensusResult.merged, userId, [], scrapedSections);
      
      this.updateJob(jobId, {
        state: 'completed',
        progress: 100,
        status: 'draft-created'
      });
      
      return;
    }
    
    // FUSION SÉCURISÉE : On remplace SEULEMENT les sections validées comme 'ok'
    const mergedParams = mergeSafely(activeParams, consensusResult.merged as any, consensusResult.completeness);
    
    this.addLog(jobId, '✅ Fusion sécurisée avec version active (section par section)');
    
    // Compter les sections remplacées vs conservées
    const sectionsReplaced = Object.values(consensusResult.completeness).filter(c => c.status === 'ok').length;
    const sectionsPreserved = Object.values(consensusResult.completeness).filter(c => c.status !== 'ok').length;
    
    this.addLog(jobId, `  → ${sectionsReplaced} section(s) mise(s) à jour, ${sectionsPreserved} section(s) conservée(s)`);
    
    // Exclure 'year' du diff car il est stocké dans FiscalVersion, pas dans jsonData
    const { year: _activeYear, ...activeWithoutYear } = activeParams;
    const { year: _mergedYear, ...mergedWithoutYear } = mergedParams;
    
    const changes = diffParams(activeWithoutYear, mergedWithoutYear);
    
    if (changes.length === 0) {
      this.addLog(jobId, '✅ Aucun changement détecté par rapport à la version active');
      
      this.updateJob(jobId, {
        state: 'completed',
        progress: 100,
        status: 'no-change',
        changes: []
      });
      
      return;
    }
    
    this.addLog(jobId, `📊 ${changes.length} changement(s) détecté(s)`);
    
    for (const change of changes.slice(0, 10)) { // Limiter à 10 pour le log
      this.addLog(jobId, `  - ${change.path}: ${JSON.stringify(change.before)} → ${JSON.stringify(change.after)}`);
    }
    
    if (changes.length > 10) {
      this.addLog(jobId, `  ... et ${changes.length - 10} autre(s) changement(s)`);
    }
    
    // Étape 6: Créer une version draft avec les données fusionnées
    this.updateJob(jobId, { state: 'creating-draft', progress: 85 });
    
    // Extraire la liste des sections scrapées
    const scrapedSections = [...new Set(allPartials.map(p => p.section))];
    
    await this.createDraftVersion(jobId, year, mergedParams, userId, changes, scrapedSections);
    
    // Déterminer le statut final
    const finalStatus = sectionsPreserved > 0 ? 'partial-merge' : 'draft-created';
    
    this.updateJob(jobId, {
      state: 'completed',
      progress: 100,
      status: finalStatus,
      changes
    });
    
    if (finalStatus === 'partial-merge') {
      this.addLog(jobId, `⚠️ Job terminé avec fusion partielle (${sectionsPreserved} section(s) non mise(s) à jour)`);
    } else {
      this.addLog(jobId, '✅ Job terminé avec succès (toutes les sections mises à jour)');
    }
  }
  
  /**
   * Récupère les données depuis OpenFisca
   */
  private async fetchOpenfisca(jobId: string, year: number): Promise<TaxPartial[]> {
    try {
      const partials = await openfiscaProvider.fetchPartials(year);
      return partials;
    } catch (error: any) {
      this.addLog(jobId, `⚠️ OpenFisca indisponible: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Récupère les données depuis toutes les sources web
   */
  private async fetchAllSources(jobId: string, year: number): Promise<TaxPartial[]> {
    const allPartials: TaxPartial[] = [];
    const adapterMetrics: Array<any> = [];
    
    for (const adapter of this.adapters) {
      const adapterName = adapter.constructor.name;
      const startTime = Date.now();
      
      try {
        this.addLog(jobId, `Fetch depuis ${adapterName}...`);
        
        // Rate limiting
        await this.rateLimit();
        
        const partials = await adapter.fetchPartials(year);
        const durationMs = Date.now() - startTime;
        
        // Collecter les métriques
        const metrics = {
          adapter: adapterName,
          url: partials[0]?.meta?.url || 'N/A',
          httpStatus: 200, // Si on arrive ici, c'est que ça a marché
          bytes: JSON.stringify(partials).length,
          durationMs,
          sectionsCount: partials.length
        };
        
        adapterMetrics.push(metrics);
        
        this.addLog(jobId, `✅ ${adapterName}: ${partials.length} section(s) en ${durationMs}ms`);
        
        allPartials.push(...partials);
        
      } catch (error: any) {
        const durationMs = Date.now() - startTime;
        
        // Collecter les métriques même en cas d'erreur
        const metrics = {
          adapter: adapterName,
          url: error.config?.url || 'N/A',
          httpStatus: error.response?.status,
          durationMs,
          error: error.message
        };
        
        adapterMetrics.push(metrics);
        
        this.addLog(jobId, `⚠️ ${adapterName}: Erreur ${error.response?.status || ''} - ${error.message}`);
        // Continuer avec les autres adapters
      }
    }
    
    // Sauvegarder les métriques dans le job
    this.updateJob(jobId, { adapterMetrics });
    
    return allPartials;
  }
  
  /**
   * Sauvegarde les snapshots en base de données
   */
  private async saveSnapshots(jobId: string, partials: TaxPartial[]): Promise<void> {
    this.addLog(jobId, `Sauvegarde de ${partials.length} snapshot(s)...`);
    
    for (const partial of partials) {
      try {
        await prisma.taxSourceSnapshot.create({
          data: {
            year: partial.meta.fetchedAt.getFullYear(),
            section: partial.section,
            source: partial.meta.source,
            url: partial.meta.url,
            fetchedAt: partial.meta.fetchedAt,
            hash: partial.meta.hash,
            payload: JSON.stringify({
              data: partial.data,
              meta: {
                ...partial.meta,
                fetchedAt: partial.meta.fetchedAt.toISOString()
              }
            })
          }
        });
      } catch (error: any) {
        this.addLog(jobId, `⚠️ Erreur sauvegarde snapshot ${partial.section}: ${error.message}`);
      }
    }
    
    this.addLog(jobId, '✅ Snapshots sauvegardés');
  }
  
  /**
   * Récupère la version active pour une année
   */
  private async getActiveVersion(year: number): Promise<any | null> {
    const version = await prisma.fiscalVersion.findFirst({
      where: {
        year,
        status: 'published'
      },
      include: {
        params: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    return version;
  }
  
  /**
   * Crée une version draft
   */
  private async createDraftVersion(
    jobId: string,
    year: number,
    params: any,
    userId: string,
    changes: any[],
    scrapedSections?: string[]
  ): Promise<void> {
    const timestamp = Date.now();
    const code = `${year}.import-${timestamp}`;
    
    this.addLog(jobId, `Création de la version draft ${code}...`);
    
    // Construire les notes avec le résumé des changements
    let notes = `Version créée automatiquement par scraping des sources officielles\n\n`;
    notes += `Utilisateur: ${userId}\n`;
    notes += `Date: ${new Date().toISOString()}\n\n`;
    
    notes += `⚠️ IMPORTANT : Cette version est une FUSION INTELLIGENTE\n`;
    notes += `Les valeurs non scrapées ont été CONSERVÉES de la version active.\n`;
    notes += `Seuls les champs effectivement récupérés ont été mis à jour.\n\n`;
    
    if (scrapedSections && scrapedSections.length > 0) {
      notes += `Sections scrapées avec succès :\n`;
      for (const section of scrapedSections) {
        notes += `- ${section}\n`;
      }
      notes += `\n`;
    }
    
    if (changes.length > 0) {
      notes += `Changements détectés (${changes.length}):\n`;
      for (const change of changes.slice(0, 20)) {
        notes += `- ${change.path}: ${JSON.stringify(change.before)} → ${JSON.stringify(change.after)}\n`;
      }
      if (changes.length > 20) {
        notes += `... et ${changes.length - 20} autre(s) changement(s)\n`;
      }
    }
    
    // Créer la version (year sera exclu automatiquement par toFiscalParamsJson)
    const jsonData = toFiscalParamsJson(params);
    
    const newVersion = await prisma.fiscalVersion.create({
      data: {
        code,
        year,
        source: 'Scraping automatique (BOFiP, DGFiP, Service-Public)',
        status: 'draft',
        notes,
        validatedBy: userId,
        params: {
          create: {
            jsonData,
            overrides: null
          }
        }
      },
      include: {
        params: true
      }
    });
    
    this.addLog(jobId, `✅ Version draft créée: ${code}`);
    
    // Mettre à jour le job avec le code de la version
    this.updateJob(jobId, {
      draftCode: code
    });
  }
  
  /**
   * Rate limiting simple
   */
  private async rateLimit(): Promise<void> {
    const delay = 1000 / this.rateLimitConfig.requestsPerSecond;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  /**
   * Met à jour l'état d'un job
   */
  private updateJob(jobId: string, updates: Partial<ScrapeJobResult>): void {
    const entry = jobStore.get(jobId);
    if (!entry) {
      console.warn(`[TaxScrapeWorker] Impossible de mettre à jour le job ${jobId}: non trouvé`);
      return;
    }
    
    Object.assign(entry.job, updates);
    // Réinitialiser le TTL quand on met à jour
    entry.expiresAt = Date.now() + 5 * 60 * 1000;
    jobStore.set(jobId, entry);
  }
  
  /**
   * Ajoute un log à un job
   */
  private addLog(jobId: string, message: string): void {
    const entry = jobStore.get(jobId);
    if (!entry) {
      console.warn(`[TaxScrapeWorker] Impossible d'ajouter un log au job ${jobId}: non trouvé`);
      return;
    }
    
    if (!entry.job.logs) entry.job.logs = [];
    entry.job.logs.push(`[${new Date().toISOString()}] ${message}`);
    
    // Réinitialiser le TTL
    entry.expiresAt = Date.now() + 5 * 60 * 1000;
    
    console.log(`[Job ${jobId}] ${message}`);
  }
}

/**
 * Instance singleton du worker
 */
export const taxScrapeWorker = new TaxScrapeWorker();

