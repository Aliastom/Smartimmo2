/**
 * Utilitaires pour le traitement des données fiscales scrapées
 */

import crypto from 'crypto';
import {
  TaxPartial,
  TaxSection,
  NormalizedTaxParams,
  MergeResult,
  ValidationResult,
  ParamDiff,
  TaxSource,
  TaxSourceMeta,
  CompletenessStatus,
  SectionCompleteness,
  CompletenessReport
} from './types';

/**
 * Crée un hash SHA256 d'un contenu
 */
export function createHash(content: string | Buffer): string {
  const hash = crypto.createHash('sha256');
  hash.update(content);
  return hash.digest('hex');
}

/**
 * Valide une section fiscale
 */
export function validateSection(section: TaxSection, value: any): CompletenessStatus {
  switch (section) {
    case 'IR':
      // Doit être un array d'au moins 3 tranches
      if (!Array.isArray(value)) return 'invalid';
      if (value.length < 3) return 'invalid';
      // Vérifier que chaque tranche a les champs requis
      const validBrackets = value.every(b => 
        typeof b.lower === 'number' && 
        (b.upper === null || typeof b.upper === 'number') &&
        typeof b.rate === 'number'
      );
      return validBrackets ? 'ok' : 'invalid';
      
    case 'IR_DECOTE':
      // Doit avoir les 3 champs
      if (!value || typeof value !== 'object') return 'invalid';
      if (typeof value.seuilCelibataire !== 'number') return 'invalid';
      if (typeof value.seuilCouple !== 'number') return 'invalid';
      if (typeof value.facteur !== 'number') return 'invalid';
      return 'ok';
      
    case 'PS':
      // Doit être un nombre entre 0 et 1
      if (typeof value !== 'number') return 'invalid';
      if (value <= 0 || value >= 1) return 'invalid';
      return 'ok';
      
    case 'MICRO':
      // Doit avoir au moins foncier.abattement
      if (!value || typeof value !== 'object') return 'invalid';
      if (!value.foncier || typeof value.foncier.abattement !== 'number') return 'invalid';
      return 'ok';
      
    case 'DEFICIT':
      // Doit avoir plafondImputationRevenuGlobal
      if (!value || typeof value !== 'object') return 'invalid';
      if (typeof value.plafondImputationRevenuGlobal !== 'number') return 'invalid';
      return 'ok';
      
    case 'PER':
      // Doit avoir au moins un champ
      if (!value || typeof value !== 'object') return 'invalid';
      if (value.plafondBase === undefined && value.plafondMaxPASSMultiple === undefined) return 'invalid';
      return 'ok';
      
    case 'SCI_IS':
      // Doit avoir les 3 taux
      if (!value || typeof value !== 'object') return 'invalid';
      if (typeof value.tauxReduit !== 'number') return 'invalid';
      if (typeof value.tauxNormal !== 'number') return 'invalid';
      return 'ok';
      
    default:
      return 'invalid';
  }
}

/**
 * Fusion profonde d'objets (deep merge)
 * Préserve les valeurs existantes non présentes dans incoming
 */
function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  
  for (const key in source) {
    const sourceValue = source[key];
    const targetValue = target[key];
    
    if (sourceValue === undefined) {
      // Ne rien faire, garder la valeur de target
      continue;
    }
    
    if (
      typeof sourceValue === 'object' &&
      sourceValue !== null &&
      !Array.isArray(sourceValue) &&
      typeof targetValue === 'object' &&
      targetValue !== null &&
      !Array.isArray(targetValue)
    ) {
      // Fusion récursive pour les objets
      result[key] = deepMerge(targetValue, sourceValue);
    } else {
      // Remplacement simple pour les primitives et arrays
      result[key] = sourceValue as any;
    }
  }
  
  return result;
}

/**
 * Fusion sécurisée section par section
 * Ne remplace QUE les sections valides trouvées
 * Utilise une fusion profonde pour préserver les champs non scrapés
 */
export function mergeSafely(
  active: NormalizedTaxParams,
  incoming: NormalizedTaxParams,
  completeness: CompletenessReport
): NormalizedTaxParams {
  const out = structuredClone(active);
  
  // IR : Barème (remplacement complet OK car c'est un array)
  if (completeness.IR.status === 'ok' && incoming.irBrackets) {
    out.irBrackets = incoming.irBrackets;
  }
  
  // IR : Décote (fusion profonde)
  if (completeness.IR_DECOTE.status === 'ok' && incoming.irDecote) {
    out.irDecote = out.irDecote 
      ? deepMerge(out.irDecote, incoming.irDecote)
      : incoming.irDecote;
  }
  
  // PS : Prélèvements sociaux (primitive OK)
  if (completeness.PS.status === 'ok' && incoming.psRate !== undefined) {
    out.psRate = incoming.psRate;
  }
  
  // MICRO : Régimes micro (fusion profonde !)
  if (completeness.MICRO.status === 'ok' && incoming.micro) {
    out.micro = out.micro
      ? deepMerge(out.micro, incoming.micro)
      : incoming.micro;
  }
  
  // DEFICIT : Déficit foncier (fusion profonde)
  if (completeness.DEFICIT.status === 'ok' && incoming.deficitFoncier) {
    out.deficitFoncier = out.deficitFoncier
      ? deepMerge(out.deficitFoncier, incoming.deficitFoncier)
      : incoming.deficitFoncier;
  }
  
  // PER : Plan Épargne Retraite (fusion profonde !)
  if (completeness.PER.status === 'ok' && incoming.per) {
    out.per = out.per
      ? deepMerge(out.per, incoming.per)
      : incoming.per;
  }
  
  // SCI_IS : SCI à l'IS (fusion profonde)
  if (completeness.SCI_IS.status === 'ok' && incoming.sciIS) {
    out.sciIS = out.sciIS
      ? deepMerge(out.sciIS, incoming.sciIS)
      : incoming.sciIS;
  }
  
  return out;
}

/**
 * Fusionne les données partielles en appliquant une priorité
 * Priorité: BOFIP > DGFIP > SERVICE_PUBLIC > LEGIFRANCE
 */
export function mergePartials(partials: TaxPartial[]): MergeResult {
  const params: NormalizedTaxParams = { year: 0 };
  const provenance: Record<TaxSection, TaxSourceMeta[]> = {
    IR: [],
    IR_DECOTE: [],
    PS: [],
    MICRO: [],
    DEFICIT: [],
    PER: [],
    SCI_IS: []
  };
  const warnings: string[] = [];
  const completeness: CompletenessReport = {
    IR: { status: 'missing' },
    IR_DECOTE: { status: 'missing' },
    PS: { status: 'missing' },
    MICRO: { status: 'missing' },
    DEFICIT: { status: 'missing' },
    PER: { status: 'missing' },
    SCI_IS: { status: 'missing' }
  };
  
  // Grouper par section
  const bySection: Record<TaxSection, TaxPartial[]> = {
    IR: [],
    IR_DECOTE: [],
    PS: [],
    MICRO: [],
    DEFICIT: [],
    PER: [],
    SCI_IS: []
  };
  
  for (const partial of partials) {
    bySection[partial.section].push(partial);
    provenance[partial.section].push(partial.meta);
  }
  
  // Extraire l'année (depuis la première meta qui en a une)
  const firstPartial = partials[0];
  if (firstPartial?.meta?.fetchedAt) {
    params.year = firstPartial.meta.fetchedAt.getFullYear();
  }
  
  // Fusionner chaque section avec priorité + validation
  for (const section of Object.keys(bySection) as TaxSection[]) {
    const sectionPartials = bySection[section];
    
    if (sectionPartials.length === 0) {
      // Section non trouvée
      completeness[section] = { status: 'missing', reason: 'Aucune donnée récupérée' };
      continue;
    }
    
    // Trier par priorité de source
    const sorted = sectionPartials.sort((a, b) => {
      return getSourcePriority(a.meta.source) - getSourcePriority(b.meta.source);
    });
    
    // Prendre la source la plus prioritaire
    const best = sorted[0];
    
    // Vérifier les divergences
    if (sorted.length > 1) {
      const divergences = checkDivergences(sorted, section);
      if (divergences.length > 0) {
        warnings.push(...divergences);
      }
    }
    
    // Merger les données
    mergeSection(params, best.data, section);
    
    // Valider la section fusionnée
    const sectionValue = getSectionValue(params, section);
    const validationStatus = validateSection(section, sectionValue);
    
    if (validationStatus === 'ok') {
      completeness[section] = {
        status: 'ok',
        source: best.meta.source,
        url: best.meta.url
      };
    } else {
      completeness[section] = {
        status: 'invalid',
        source: best.meta.source,
        url: best.meta.url,
        reason: 'Validation échouée'
      };
      warnings.push(`Section ${section} invalide après merge (source: ${best.meta.source})`);
    }
  }
  
  return { params, provenance, warnings, completeness };
}

/**
 * Retourne la priorité d'une source (plus bas = plus prioritaire)
 */
function getSourcePriority(source: TaxSource): number {
  const priorities: Record<TaxSource, number> = {
    BOFIP: 1,
    DGFIP: 2,
    SERVICE_PUBLIC: 3,
    LEGIFRANCE: 4
  };
  return priorities[source] || 999;
}

/**
 * Vérifie les divergences entre plusieurs sources pour une même section
 */
function checkDivergences(partials: TaxPartial[], section: TaxSection): string[] {
  const warnings: string[] = [];
  
  if (partials.length < 2) return warnings;
  
  const reference = partials[0];
  
  for (let i = 1; i < partials.length; i++) {
    const current = partials[i];
    
    // Comparer les données
    const diffs = deepDiff(reference.data, current.data);
    
    if (diffs.length > 0) {
      warnings.push(
        `Divergence détectée pour ${section} entre ${reference.meta.source} et ${current.meta.source}: ` +
        diffs.map(d => `${d.path} (${d.before} vs ${d.after})`).join(', ')
      );
    }
  }
  
  return warnings;
}

/**
 * Récupère la valeur d'une section depuis les paramètres
 */
function getSectionValue(params: NormalizedTaxParams, section: TaxSection): any {
  switch (section) {
    case 'IR': return params.irBrackets;
    case 'IR_DECOTE': return params.irDecote;
    case 'PS': return params.psRate;
    case 'MICRO': return params.micro;
    case 'DEFICIT': return params.deficitFoncier;
    case 'PER': return params.per;
    case 'SCI_IS': return params.sciIS;
    default: return undefined;
  }
}

/**
 * Fusionne les données d'une section dans les paramètres normalisés
 */
function mergeSection(params: NormalizedTaxParams, data: any, section: TaxSection): void {
  switch (section) {
    case 'IR':
      if (data.irBrackets) {
        params.irBrackets = data.irBrackets;
      }
      break;
      
    case 'IR_DECOTE':
      if (data.irDecote) {
        params.irDecote = data.irDecote;
      }
      break;
      
    case 'PS':
      if (typeof data.psRate === 'number') {
        params.psRate = data.psRate;
      }
      break;
      
    case 'MICRO':
      if (data.micro) {
        params.micro = mergeMicro(params.micro, data.micro);
      }
      break;
      
    case 'DEFICIT':
      if (data.deficitFoncier) {
        params.deficitFoncier = data.deficitFoncier;
      }
      break;
      
    case 'PER':
      if (data.per) {
        params.per = data.per;
      }
      break;
      
    case 'SCI_IS':
      if (data.sciIS) {
        params.sciIS = data.sciIS;
      }
      break;
  }
}

/**
 * Fusionne intelligemment les données micro (prend les valeurs non-null)
 */
function mergeMicro(existing: any, incoming: any): any {
  if (!existing) return incoming;
  if (!incoming) return existing;
  
  return {
    foncier: {
      plafond: incoming.foncier?.plafond ?? existing.foncier?.plafond,
      abattement: incoming.foncier?.abattement ?? existing.foncier?.abattement
    },
    bic: {
      vente: {
        plafond: incoming.bic?.vente?.plafond ?? existing.bic?.vente?.plafond,
        abattement: incoming.bic?.vente?.abattement ?? existing.bic?.vente?.abattement
      },
      services: {
        plafond: incoming.bic?.services?.plafond ?? existing.bic?.services?.plafond,
        abattement: incoming.bic?.services?.abattement ?? existing.bic?.services?.abattement
      }
    }
  };
}

/**
 * Valide les paramètres fiscaux normalisés
 */
export function validateParams(params: NormalizedTaxParams): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Vérifier l'année
  if (!params.year || params.year < 2020 || params.year > 2030) {
    errors.push(`Année invalide: ${params.year}`);
  }
  
  // Vérifier le barème IR
  if (params.irBrackets) {
    if (params.irBrackets.length === 0) {
      errors.push('Barème IR vide');
    }
    
    // Vérifier que les tranches sont croissantes
    for (let i = 0; i < params.irBrackets.length - 1; i++) {
      const current = params.irBrackets[i];
      const next = params.irBrackets[i + 1];
      
      if (current.upper !== null && next.lower < current.upper) {
        errors.push(`Tranches IR non croissantes: ${current.upper} >= ${next.lower}`);
      }
      
      if (current.rate < 0 || current.rate > 1) {
        errors.push(`Taux IR hors bornes [0,1]: ${current.rate}`);
      }
    }
    
    // Première tranche devrait commencer à 0
    if (params.irBrackets[0].lower !== 0) {
      warnings.push(`Première tranche IR ne commence pas à 0: ${params.irBrackets[0].lower}`);
    }
  }
  
  // Vérifier la décote
  if (params.irDecote) {
    if (params.irDecote.seuilCelibataire <= 0) {
      errors.push(`Seuil décote célibataire invalide: ${params.irDecote.seuilCelibataire}`);
    }
    if (params.irDecote.seuilCouple <= 0) {
      errors.push(`Seuil décote couple invalide: ${params.irDecote.seuilCouple}`);
    }
    if (params.irDecote.facteur < 0 || params.irDecote.facteur > 1) {
      errors.push(`Facteur décote hors bornes [0,1]: ${params.irDecote.facteur}`);
    }
  }
  
  // Vérifier les PS
  if (params.psRate !== undefined) {
    if (params.psRate < 0 || params.psRate > 1) {
      errors.push(`Taux PS hors bornes [0,1]: ${params.psRate}`);
    }
  }
  
  // Vérifier les plafonds micro
  if (params.micro) {
    if (params.micro.foncier) {
      if (params.micro.foncier.plafond <= 0) {
        errors.push(`Plafond micro-foncier invalide: ${params.micro.foncier.plafond}`);
      }
      if (params.micro.foncier.abattement < 0 || params.micro.foncier.abattement > 1) {
        errors.push(`Abattement micro-foncier hors bornes [0,1]: ${params.micro.foncier.abattement}`);
      }
    }
    
    if (params.micro.bic) {
      if (params.micro.bic.vente.plafond <= 0) {
        errors.push(`Plafond micro-BIC vente invalide: ${params.micro.bic.vente.plafond}`);
      }
      if (params.micro.bic.services.plafond <= 0) {
        errors.push(`Plafond micro-BIC services invalide: ${params.micro.bic.services.plafond}`);
      }
    }
  }
  
  // Vérifier le déficit foncier
  if (params.deficitFoncier) {
    if (params.deficitFoncier.plafondImputationRevenuGlobal <= 0) {
      errors.push(`Plafond déficit foncier invalide: ${params.deficitFoncier.plafondImputationRevenuGlobal}`);
    }
    if (params.deficitFoncier.reportYears < 0) {
      errors.push(`Durée report déficit invalide: ${params.deficitFoncier.reportYears}`);
    }
  }
  
  // Vérifier le PER
  if (params.per) {
    if (params.per.plafondBase && params.per.plafondBase <= 0) {
      errors.push(`Plafond PER invalide: ${params.per.plafondBase}`);
    }
  }
  
  // Vérifier les taux IS
  if (params.sciIS) {
    if (params.sciIS.tauxReduit < 0 || params.sciIS.tauxReduit > 1) {
      errors.push(`Taux IS réduit hors bornes [0,1]: ${params.sciIS.tauxReduit}`);
    }
    if (params.sciIS.tauxNormal < 0 || params.sciIS.tauxNormal > 1) {
      errors.push(`Taux IS normal hors bornes [0,1]: ${params.sciIS.tauxNormal}`);
    }
    if (params.sciIS.plafondTauxReduit <= 0) {
      errors.push(`Plafond taux réduit IS invalide: ${params.sciIS.plafondTauxReduit}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Calcule les différences entre deux paramètres fiscaux
 */
export function diffParams(before: NormalizedTaxParams, after: NormalizedTaxParams): ParamDiff[] {
  return deepDiff(before, after);
}

/**
 * Calcule les différences profondes entre deux objets
 */
function deepDiff(obj1: any, obj2: any, path: string = ''): ParamDiff[] {
  const diffs: ParamDiff[] = [];
  
  // Gérer les cas null/undefined
  if (obj1 === null || obj1 === undefined) {
    if (obj2 !== null && obj2 !== undefined) {
      diffs.push({ path, before: obj1, after: obj2 });
    }
    return diffs;
  }
  
  if (obj2 === null || obj2 === undefined) {
    diffs.push({ path, before: obj1, after: obj2 });
    return diffs;
  }
  
  // Primitives
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object') {
    if (obj1 !== obj2) {
      diffs.push({ path, before: obj1, after: obj2 });
    }
    return diffs;
  }
  
  // Arrays
  if (Array.isArray(obj1) && Array.isArray(obj2)) {
    // Comparer les longueurs
    if (obj1.length !== obj2.length) {
      diffs.push({
        path: `${path}.length`,
        before: obj1.length,
        after: obj2.length
      });
    }
    
    // Comparer élément par élément
    const maxLen = Math.max(obj1.length, obj2.length);
    for (let i = 0; i < maxLen; i++) {
      const subDiffs = deepDiff(
        obj1[i],
        obj2[i],
        `${path}[${i}]`
      );
      diffs.push(...subDiffs);
    }
    
    return diffs;
  }
  
  // Objects
  const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);
  
  for (const key of allKeys) {
    const newPath = path ? `${path}.${key}` : key;
    
    if (!(key in obj1)) {
      diffs.push({ path: newPath, before: undefined, after: obj2[key] });
    } else if (!(key in obj2)) {
      diffs.push({ path: newPath, before: obj1[key], after: undefined });
    } else {
      const subDiffs = deepDiff(obj1[key], obj2[key], newPath);
      diffs.push(...subDiffs);
    }
  }
  
  return diffs;
}

/**
 * Convertit les NormalizedTaxParams vers le format FiscalParams.jsonData
 */
export function toFiscalParamsJson(params: NormalizedTaxParams): string {
  // Le format attendu par FiscalParams correspond déjà à NormalizedTaxParams
  // mais sans l'année qui est stockée dans FiscalVersion
  
  const { year, ...rest } = params;
  
  return JSON.stringify(rest, null, 2);
}

/**
 * Parse le format FiscalParams.jsonData vers NormalizedTaxParams
 */
export function fromFiscalParamsJson(jsonData: string, year: number): NormalizedTaxParams {
  const parsed = JSON.parse(jsonData);
  return {
    year,
    ...parsed
  };
}

