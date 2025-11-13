/**
 * TaxParamsService - Service de gestion des paramètres fiscaux
 * 
 * Ce service gère les barèmes fiscaux français (IR, PS, micro, déficit foncier, PER, LMP, SCI IS)
 * avec versioning, historique et mise à jour automatique.
 * 
 * VERSION 2.0 : Charge depuis PostgreSQL (FiscalVersion) au lieu de Map en mémoire
 */

import type { TaxParams, TaxVersion, TaxYear, TaxParamsChangelog } from '@/types/fiscal';
import { prisma } from '@/lib/prisma';
import { fiscalVersionToTaxParams } from './converters/fiscalVersionToParams';

// ============================================================================
// BARÈMES FISCAUX 2025 (SOURCE: DGFiP, Service-Public, BOFiP)
// ============================================================================

/**
 * Barèmes IR 2025 (revenus 2024)
 * Source: https://www.service-public.fr/particuliers/vosdroits/F1419
 */
const TAX_PARAMS_2025: TaxParams = {
  version: '2025.1',
  year: 2025,
  
  // Impôt sur le revenu - Tranches 2025
  irBrackets: [
    { lower: 0, upper: 11294, rate: 0.00 },           // 0%
    { lower: 11294, upper: 28797, rate: 0.11 },       // 11%
    { lower: 28797, upper: 82341, rate: 0.30 },       // 30%
    { lower: 82341, upper: 177106, rate: 0.41 },      // 41%
    { lower: 177106, upper: null, rate: 0.45 },       // 45%
  ],
  
  // Décote IR 2025
  irDecote: {
    threshold: 1929,  // Seuil pour une personne seule
    formula: (tax: number, parts: number) => {
      // Décote = (seuil × parts) - (75% × impôt brut)
      const seuilDecote = parts === 1 ? 1929 : 3858;  // 3858€ pour un couple
      const decote = seuilDecote - (0.75 * tax);
      return Math.max(0, decote);
    }
  },
  
  // Abattement forfaitaire salaires 2025 (Article 83 CGI)
  salaryDeduction: {
    taux: 0.10,      // 10% (stable depuis 1970)
    min: 472,        // Minimum 2025
    max: 13522,      // Maximum 2025
  },
  
  // Prélèvements sociaux 2025
  psRate: 0.172,  // 17.2% sur revenus du patrimoine
  
  // Régimes micro
  micro: {
    // Micro-foncier
    foncierAbattement: 0.30,      // 30% d'abattement
    foncierPlafond: 15000,         // Plafond 15 000€ de revenus bruts
    
    // Micro-BIC (meublé)
    bicAbattement: 0.50,           // 50% d'abattement
    bicPlafond: 77700,             // Plafond 77 700€ (seuil classique)
    
    // Meublé de tourisme classé (optionnel)
    meubleTourismeAbattement: 0.71, // 71% d'abattement
    meubleTourismePlafond: 188700,  // Plafond 188 700€
  },
  
  // Déficit foncier
  deficitFoncier: {
    plafondImputationRevenuGlobal: 10700,  // 10 700€ max sur revenu global
    dureeReport: 10,                        // Reportable 10 ans
  },
  
  // PER (Plan Épargne Retraite)
  per: {
    tauxPlafond: 0.10,              // 10% des revenus professionnels
    plancherLegal: 4399,            // Plancher 2025 : 4 399€
    dureeReportReliquats: 3,        // Report des reliquats sur 3 ans
  },
  
  // LMP (Loueur Meublé Professionnel)
  lmp: {
    recettesMin: 23000,             // 23 000€ de recettes annuelles minimum
    tauxRecettesProMin: 0.50,       // > 50% des revenus professionnels du foyer
    inscriptionRCSObligatoire: true, // Inscription au RCS obligatoire
  },
  
  // SCI à l'IS
  sciIS: {
    tauxReduit: 0.15,               // 15% jusqu'à 42 500€
    plafondTauxReduit: 42500,       // Plafond taux réduit
    tauxNormal: 0.25,               // 25% au-delà
  },
  
  // Métadonnées
  source: 'DGFiP - Loi de finances 2025',
  dateMAJ: new Date('2025-01-01'),
  validatedBy: 'system',
};

/**
 * Barèmes historiques (pour comparaisons et simulations passées)
 */
const TAX_PARAMS_2024: TaxParams = {
  version: '2024.1',
  year: 2024,
  
  irBrackets: [
    { lower: 0, upper: 11294, rate: 0.00 },
    { lower: 11294, upper: 28797, rate: 0.11 },
    { lower: 28797, upper: 82341, rate: 0.30 },
    { lower: 82341, upper: 177106, rate: 0.41 },
    { lower: 177106, upper: null, rate: 0.45 },
  ],
  
  irDecote: {
    threshold: 1841,
    formula: (tax: number, parts: number) => {
      const seuilDecote = parts === 1 ? 1841 : 3682;
      const decote = seuilDecote - (0.75 * tax);
      return Math.max(0, decote);
    }
  },
  
  // Abattement forfaitaire salaires 2024 (Article 83 CGI)
  salaryDeduction: {
    taux: 0.10,      // 10%
    min: 472,        // Minimum 2024
    max: 13180,      // Maximum 2024
  },
  
  psRate: 0.172,
  
  micro: {
    foncierAbattement: 0.30,
    foncierPlafond: 15000,
    bicAbattement: 0.50,
    bicPlafond: 77700,
    meubleTourismeAbattement: 0.71,
    meubleTourismePlafond: 188700,
  },
  
  deficitFoncier: {
    plafondImputationRevenuGlobal: 10700,
    dureeReport: 10,
  },
  
  per: {
    tauxPlafond: 0.10,
    plancherLegal: 4399,
    dureeReportReliquats: 3,
  },
  
  lmp: {
    recettesMin: 23000,
    tauxRecettesProMin: 0.50,
    inscriptionRCSObligatoire: true,
  },
  
  sciIS: {
    tauxReduit: 0.15,
    plafondTauxReduit: 42500,
    tauxNormal: 0.25,
  },
  
  source: 'DGFiP - Loi de finances 2024',
  dateMAJ: new Date('2024-01-01'),
  validatedBy: 'system',
};

// ============================================================================
// CACHE EN MÉMOIRE (pour éviter requêtes BDD répétées)
// ============================================================================

interface CachedParams {
  params: TaxParams;
  loadedAt: Date;
}

/**
 * Cache des paramètres chargés depuis la BDD
 * TTL : 5 minutes
 */
const paramsCache = new Map<string, CachedParams>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fallback : Paramètres hardcodés si BDD vide
 * Utilisés uniquement si aucune version publiée n'existe en BDD
 */
const FALLBACK_PARAMS: Map<number, TaxParams> = new Map([
  [2025, TAX_PARAMS_2025],
  [2024, TAX_PARAMS_2024],
]);

// ============================================================================
// SERVICE PRINCIPAL
// ============================================================================

class TaxParamsServiceClass {
  /**
   * Récupère les paramètres fiscaux pour une année donnée
   * 
   * VERSION 2.0 : Charge depuis PostgreSQL (FiscalVersion) avec cache 5 min
   * 
   * @param year Année fiscale
   * @param versionCode Code de version spécifique (optionnel)
   * @returns Paramètres fiscaux
   */
  async get(year: TaxYear, versionCode?: string): Promise<TaxParams> {
    const cacheKey = versionCode || `${year}-published`;
    
    // 1. Vérifier le cache
    const cached = paramsCache.get(cacheKey);
    if (cached && (Date.now() - cached.loadedAt.getTime()) < CACHE_TTL) {
      console.log(`[TaxParamsService] Cache hit pour ${cacheKey}`);
      return cached.params;
    }
    
    // 2. Charger depuis PostgreSQL
    try {
      const params = versionCode 
        ? await this.loadByCode(versionCode)
        : await this.loadPublishedByYear(year);
      
      // 3. Mettre en cache
      paramsCache.set(cacheKey, { params, loadedAt: new Date() });
      
      console.log(`[TaxParamsService] Paramètres ${params.version} chargés depuis BDD (year: ${year})`);
      return params;
      
    } catch (error) {
      console.warn(`[TaxParamsService] Erreur chargement BDD, fallback sur hardcodé:`, error);
      
      // 4. Fallback sur hardcodé
      const fallback = FALLBACK_PARAMS.get(year);
      if (!fallback) {
        throw new Error(`Aucun paramètre fiscal disponible pour ${year}`);
      }
      
      return fallback;
    }
  }
  
  /**
   * Charge une version spécifique par code
   */
  private async loadByCode(code: string): Promise<TaxParams> {
    const fiscalVersion = await prisma.fiscalVersion.findFirst({
      where: { code },
      include: { params: true }
    });
    
    if (!fiscalVersion || !fiscalVersion.params) {
      throw new Error(`Version ${code} introuvable`);
    }
    
    return fiscalVersionToTaxParams(fiscalVersion as any);
  }
  
  /**
   * Charge la dernière version publiée pour une année
   */
  private async loadPublishedByYear(year: number): Promise<TaxParams> {
    console.log(`[TaxParamsService] Recherche version publiée pour l'année ${year}...`);
    
    const fiscalVersion = await prisma.fiscalVersion.findFirst({
      where: {
        year,
        OR: [
          { status: 'published' },  // Anglais
          { status: 'Publié' },     // Français
        ]
      },
      include: { params: true },
      orderBy: { updatedAt: 'desc' }  // ✅ Utiliser updatedAt au lieu de publishedAt
    });
    
    console.log(`[TaxParamsService] Résultat requête:`, {
      found: !!fiscalVersion,
      code: fiscalVersion?.code,
      status: fiscalVersion?.status,
      year: fiscalVersion?.year,
      hasParams: !!fiscalVersion?.params,
      publishedAt: fiscalVersion?.publishedAt,
    });
    
    if (!fiscalVersion || !fiscalVersion.params) {
      throw new Error(`Aucune version publiée pour ${year}`);
    }
    
    console.log(`[TaxParamsService] ✅ Version trouvée: ${fiscalVersion.code} (status: ${fiscalVersion.status})`);
    return fiscalVersionToTaxParams(fiscalVersion as any);
  }
  
  /**
   * Récupère la dernière version des paramètres fiscaux (toutes années confondues)
   */
  async getLatest(): Promise<TaxParams> {
    try {
      const fiscalVersion = await prisma.fiscalVersion.findFirst({
        where: {
          OR: [
            { status: 'published' },
            { status: 'Publié' },
          ]
        },
        include: { params: true },
        orderBy: [
          { year: 'desc' },
          { updatedAt: 'desc' }
        ]
      });
      
      if (!fiscalVersion || !fiscalVersion.params) {
        console.warn('[TaxParamsService] Aucune version publiée en BDD, fallback sur 2025');
        return FALLBACK_PARAMS.get(2025)!;
      }
      
      return fiscalVersionToTaxParams(fiscalVersion as any);
      
    } catch (error) {
      console.error('[TaxParamsService] Erreur getLatest:', error);
      return FALLBACK_PARAMS.get(2025)!;
    }
  }
  
  /**
   * Récupère la dernière version pour une année donnée
   * Cette méthode retourne null si aucune version publiée n'est trouvée
   */
  async getLatestVersion(year: TaxYear): Promise<TaxParams | null> {
    try {
      return await this.get(year);
    } catch (error) {
      // Si erreur (pas de version publiée), retourner null
      return null;
    }
  }
  
  /**
   * Liste toutes les versions disponibles (publiées uniquement)
   */
  async listVersions(): Promise<TaxParams[]> {
    try {
      const fiscalVersions = await prisma.fiscalVersion.findMany({
        where: { status: 'published' },
        include: { params: true },
        orderBy: [
          { year: 'desc' },
          { updatedAt: 'desc' }
        ]
      });
      
      return fiscalVersions
        .filter(v => v.params)
        .map(v => fiscalVersionToTaxParams(v as any));
        
    } catch (error) {
      console.error('[TaxParamsService] Erreur listVersions:', error);
      return Array.from(FALLBACK_PARAMS.values());
    }
  }
  
  /**
   * Vérifie si une version existe
   */
  async exists(versionCode: string): Promise<boolean> {
    try {
      const count = await prisma.fiscalVersion.count({
        where: { code: versionCode }
      });
      return count > 0;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * @deprecated Utiliser l'interface Admin /admin/impots/parametres pour créer des versions
   * Cette méthode est conservée pour compatibilité mais redirige vers PostgreSQL
   */
  async save(params: TaxParams, validatedBy: string): Promise<void> {
    console.warn('[TaxParamsService] save() est deprecated. Utilisez l\'interface Admin pour créer des versions.');
    throw new Error('Méthode save() deprecated. Utilisez /admin/impots/parametres pour gérer les versions.');
  }
  
  /**
   * @deprecated Utiliser l'interface Admin /admin/impots/parametres pour modifier des versions
   */
  async update(version: TaxVersion, updates: Partial<TaxParams>, validatedBy: string): Promise<void> {
    console.warn('[TaxParamsService] update() est deprecated. Utilisez l\'interface Admin pour modifier des versions.');
    throw new Error('Méthode update() deprecated. Utilisez /admin/impots/parametres pour gérer les versions.');
  }
  
  /**
   * Récupère le changelog d'une version depuis PostgreSQL
   */
  async getChangelog(versionCode: string): Promise<TaxParamsChangelog | null> {
    try {
      // TODO: Implémenter le changelog via FiscalVersion.metadata
      console.warn('[TaxParamsService] getChangelog() non implémenté pour PostgreSQL');
      return null;
    } catch (error) {
      return null;
    }
  }
  
  /**
   * Liste tous les changelogs
   */
  async listChangelogs(year?: TaxYear): Promise<TaxParamsChangelog[]> {
    // TODO: Implémenter via FiscalVersion.metadata
    console.warn('[TaxParamsService] listChangelogs() non implémenté pour PostgreSQL');
    return [];
  }
  
  /**
   * @deprecated Utiliser l'interface Admin pour supprimer des versions
   */
  async delete(version: TaxVersion): Promise<void> {
    console.warn('[TaxParamsService] delete() est deprecated. Utilisez l\'interface Admin pour supprimer des versions.');
    throw new Error('Méthode delete() deprecated. Utilisez /admin/impots/parametres pour gérer les versions.');
  }
  
  /**
   * Vide le cache (forcer rechargement depuis BDD)
   */
  clearCache(): void {
    paramsCache.clear();
    console.log('[TaxParamsService] Cache vidé');
  }
  
  // ============================================================================
  // HELPERS PRIVÉS
  // ============================================================================
  
  /**
   * Crée un changelog entre deux versions
   */
  private createChangelog(
    oldParams: TaxParams,
    newParams: TaxParams,
    validatedBy: string
  ): TaxParamsChangelog {
    const changes: TaxParamsChangelog['changes'] = [];
    
    // Comparer les tranches IR
    if (JSON.stringify(oldParams.irBrackets) !== JSON.stringify(newParams.irBrackets)) {
      changes.push({
        field: 'irBrackets',
        oldValue: oldParams.irBrackets,
        newValue: newParams.irBrackets,
        description: 'Modification des tranches d\'imposition IR',
      });
    }
    
    // Comparer PS
    if (oldParams.psRate !== newParams.psRate) {
      changes.push({
        field: 'psRate',
        oldValue: oldParams.psRate,
        newValue: newParams.psRate,
        description: `Taux PS : ${(oldParams.psRate * 100).toFixed(1)}% → ${(newParams.psRate * 100).toFixed(1)}%`,
      });
    }
    
    // Comparer micro-foncier
    if (oldParams.micro.foncierPlafond !== newParams.micro.foncierPlafond) {
      changes.push({
        field: 'micro.foncierPlafond',
        oldValue: oldParams.micro.foncierPlafond,
        newValue: newParams.micro.foncierPlafond,
        description: `Plafond micro-foncier : ${oldParams.micro.foncierPlafond}€ → ${newParams.micro.foncierPlafond}€`,
      });
    }
    
    // Comparer déficit foncier
    if (oldParams.deficitFoncier.plafondImputationRevenuGlobal !== newParams.deficitFoncier.plafondImputationRevenuGlobal) {
      changes.push({
        field: 'deficitFoncier.plafondImputationRevenuGlobal',
        oldValue: oldParams.deficitFoncier.plafondImputationRevenuGlobal,
        newValue: newParams.deficitFoncier.plafondImputationRevenuGlobal,
        description: `Plafond déficit foncier : ${oldParams.deficitFoncier.plafondImputationRevenuGlobal}€ → ${newParams.deficitFoncier.plafondImputationRevenuGlobal}€`,
      });
    }
    
    // Comparer PER
    if (oldParams.per.plancherLegal !== newParams.per.plancherLegal) {
      changes.push({
        field: 'per.plancherLegal',
        oldValue: oldParams.per.plancherLegal,
        newValue: newParams.per.plancherLegal,
        description: `Plancher PER : ${oldParams.per.plancherLegal}€ → ${newParams.per.plancherLegal}€`,
      });
    }
    
    // Comparer SCI IS
    if (oldParams.sciIS.tauxNormal !== newParams.sciIS.tauxNormal) {
      changes.push({
        field: 'sciIS.tauxNormal',
        oldValue: oldParams.sciIS.tauxNormal,
        newValue: newParams.sciIS.tauxNormal,
        description: `Taux IS normal : ${(oldParams.sciIS.tauxNormal * 100).toFixed(0)}% → ${(newParams.sciIS.tauxNormal * 100).toFixed(0)}%`,
      });
    }
    
    return {
      version: newParams.version,
      previousVersion: oldParams.version,
      changes,
      source: newParams.source,
      validatedBy,
      createdAt: new Date(),
    };
  }
  
  /**
   * Incrémente une version (ex: "2025.1" → "2025.2")
   */
  private incrementVersion(version: TaxVersion): TaxVersion {
    const [year, minor] = version.split('.').map(Number);
    return `${year}.${minor + 1}` as TaxVersion;
  }
}

// ============================================================================
// EXPORT SINGLETON
// ============================================================================

export const TaxParamsService = new TaxParamsServiceClass();

