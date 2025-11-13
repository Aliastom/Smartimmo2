/**
 * Fusion à consensus entre OpenFisca et les scrapers web
 * Règles de confiance et validation croisée
 */

import { TaxPartial, TaxSection, NormalizedTaxParams, CompletenessReport } from '../../sources/types';
import { validateSection } from '../../sources/utils';
import { calculateConfidence, isConfidenceAcceptable, Confidence } from './confidence';

const CRITICAL_SECTIONS: TaxSection[] = ['IR', 'PS'];

export interface ConsensusResult {
  merged: Partial<NormalizedTaxParams>;
  completeness: CompletenessReport;
  confidence: Record<TaxSection, Confidence>;
  blocking: TaxSection[]; // Sections critiques sous le seuil
  sources: Record<TaxSection, string>; // Source choisie par section
}

/**
 * Fusionne les données avec consensus
 */
export function consensusMerge(
  active: NormalizedTaxParams,
  allPartials: TaxPartial[]
): ConsensusResult {
  const merged: any = {};
  const completeness: any = {};
  const confidence: Record<TaxSection, Confidence> = {} as any;
  const blocking: TaxSection[] = [];
  const sources: Record<TaxSection, string> = {} as any;
  
  // Convertir la version active en partials virtuels pour la comparaison
  const activePartials = convertActiveToPartials(active);
  
  // Ajouter les partials actifs aux partials scrapés
  const allPartialsWithActive = [...allPartials, ...activePartials];
  
  // Grouper par section
  const grouped = groupBySection(allPartialsWithActive);
  
  // Pour chaque section
  for (const section of Object.keys(grouped) as TaxSection[]) {
    const partials = grouped[section];
    
    if (partials.length === 0) {
      completeness[section] = { status: 'missing', reason: 'Aucune donnée récupérée' };
      confidence[section] = 0;
      continue;
    }
    
    // Calculer la confiance
    const conf = calculateConfidence(section, partials);
    confidence[section] = conf;
    
    // Choisir la meilleure source (tri par DATE d'abord, puis par priorité)
    const sorted = sortByPriority(partials);
    let best = sorted[0];
    
    // RÈGLE SPÉCIALE : OpenFisca PS incomplet (< 17%)
    // OpenFisca 174.2.8 ne modélise pas la CRDS (0.5%)
    // Taux max OpenFisca = 16.7%, Taux réel = 17.2%
    // → Préférer la version active si disponible
    if (section === 'PS' && best.meta.notes?.includes('OpenFisca')) {
      const ofRate = best.data.psRate || 0;
      if (ofRate < 0.17) {
        const activePartial = sorted.find(p => p.meta.notes?.includes('version active'));
        if (activePartial) {
          console.log(`[ConsensusMerge] PS OpenFisca incomplet (${(ofRate * 100).toFixed(1)}% < 17%), utilisation version active`);
          best = activePartial;
        }
      }
    }
    
    const sourceName = best.meta.notes?.includes('OpenFisca') ? 'OpenFisca' : best.meta.source;
    sources[section] = sourceName;
    
    // Logger la décision de fusion
    if (partials.length > 1) {
      const bestDate = extractDate(best);
      const otherSources = sorted.slice(1).map(p => {
        const src = p.meta.notes?.includes('OpenFisca') ? 'OpenFisca' : p.meta.source;
        const date = extractDate(p);
        return `${src} (${date.toISOString().split('T')[0]})`;
      }).join(', ');
      
      console.log(`[ConsensusMerge] ${section}: ${sourceName} choisi (${bestDate.toISOString().split('T')[0]}) parmi: ${otherSources}`);
    }
    
    // Valider
    const validationStatus = validateSection(section, best.data[getSectionDataKey(section)]);
    
    if (validationStatus === 'ok') {
      completeness[section] = {
        status: 'ok',
        source: sources[section],
        url: best.meta.url
      };
      
      // Ajouter aux données fusionnées
      merged[getSectionDataKey(section)] = best.data[getSectionDataKey(section)];
      
      // Vérifier si bloquant (section critique avec confiance insuffisante)
      if (CRITICAL_SECTIONS.includes(section) && !isConfidenceAcceptable(section, conf)) {
        blocking.push(section);
      }
    } else {
      completeness[section] = {
        status: 'invalid',
        source: sources[section],
        url: best.meta.url,
        reason: 'Validation échouée'
      };
      confidence[section] = 0;
    }
  }
  
  return { merged, completeness, confidence, blocking, sources };
}

/**
 * Groupe les partials par section
 */
function groupBySection(partials: TaxPartial[]): Record<TaxSection, TaxPartial[]> {
  const grouped: Record<TaxSection, TaxPartial[]> = {
    IR: [],
    IR_DECOTE: [],
    PS: [],
    MICRO: [],
    DEFICIT: [],
    PER: [],
    SCI_IS: []
  };
  
  for (const partial of partials) {
    grouped[partial.section].push(partial);
  }
  
  return grouped;
}

/**
 * Extrait la date de référence d'un partial pour comparaison de priorité
 * 
 * STRATÉGIE DE PRIORISATION :
 * - OpenFisca : utilise "Valide jusqu'au" (PRIORITÉ) pour indiquer que les données
 *   sont valides pour l'année fiscale, même si "Dernière mise à jour" est ancienne
 * - Scrapers web : utilise fetchedAt (date de récupération = données actuelles)
 * - Version active : utilise fetchedAt (date de publication)
 * 
 * Exemple : OpenFisca 174.2.8 a "lastUpdate: 2024-01-01" mais "validUntil: 2025-02-18"
 * → Les données sont VALIDES pour 2025, donc on utilise 2025-02-18 pour la comparaison
 */
function extractDate(partial: TaxPartial): Date {
  // OpenFisca : PRIORITÉ à "Valide jusqu'au" (validité pour année fiscale)
  if (partial.meta.notes?.includes('OpenFisca')) {
    // 1. PRIORITÉ : "Valide jusqu'au: YYYY-MM-DD"
    // Cette date indique jusqu'à quand les données sont valides
    // Exemple : "Valide jusqu'au: 2025-02-18" = données valides pour année fiscale 2025
    const validUntilMatch = partial.meta.notes.match(/Valide jusqu'au:\s*(\d{4}-\d{2}-\d{2})/);
    if (validUntilMatch) {
      const date = validUntilMatch[1];
      console.log(`[ConsensusMerge] ${partial.section} OpenFisca: validUntil ${date} (prioritaire)`);
      return new Date(date);
    }
    
    // 2. FALLBACK : "Dernière mise à jour: YYYY-MM-DD"
    // Date de dernière modification du paramètre dans OpenFisca
    const lastUpdateMatch = partial.meta.notes.match(/Dernière mise à jour:\s*(\d{4}-\d{2}-\d{2})/);
    if (lastUpdateMatch) {
      const date = lastUpdateMatch[1];
      console.log(`[ConsensusMerge] ${partial.section} OpenFisca: lastUpdate ${date} (fallback)`);
      return new Date(date);
    }
    
    // 3. Sinon, chercher n'importe quelle date dans les notes
    const anyDateMatch = partial.meta.notes.match(/(\d{4})-(\d{2}-\d{2})/);
    if (anyDateMatch) {
      console.log(`[ConsensusMerge] ${partial.section} OpenFisca: date trouvée ${anyDateMatch[0]}`);
      return new Date(anyDateMatch[0]);
    }
    
    // 4. Sinon, date conservatrice (2020 pour la plupart des params OpenFisca)
    console.log(`[ConsensusMerge] ${partial.section} OpenFisca: aucune date, utilise 2020-01-01`);
    return new Date('2020-01-01');
  }
  
  // Version active : date de publication (début d'année par défaut)
  if (partial.meta.notes?.includes('version active')) {
    const yearMatch = partial.meta.url?.match(/Version active (\d{4})/);
    const year = yearMatch ? parseInt(yearMatch[1]) : 2024;
    console.log(`[ConsensusMerge] ${partial.section} Version active: ${year}-01-01`);
    return new Date(year, 0, 1); // 1er janvier de l'année
  }
  
  // Scrapers web : date de récupération = données actuelles (considérées comme aujourd'hui)
  const dateStr = partial.meta.fetchedAt.toISOString().split('T')[0];
  console.log(`[ConsensusMerge] ${partial.section} ${partial.meta.source}: date scraping ${dateStr}`);
  return partial.meta.fetchedAt;
}

/**
 * Trie les partials par DATE (plus récent d'abord), puis par priorité de source
 */
function sortByPriority(partials: TaxPartial[]): TaxPartial[] {
  const sourcePriority = (p: TaxPartial): number => {
    // OpenFisca détecté via notes
    if (p.meta.notes?.includes('OpenFisca')) return 0;
    
    const priorities: Record<string, number> = {
      BOFIP: 1,
      DGFIP: 2,
      SERVICE_PUBLIC: 3,
      LEGIFRANCE: 4
    };
    
    return priorities[p.meta.source] || 999;
  };
  
  return [...partials].sort((a, b) => {
    // 1. Trier par DATE (plus récent d'abord)
    const dateA = extractDate(a);
    const dateB = extractDate(b);
    
    if (dateA.getTime() !== dateB.getTime()) {
      return dateB.getTime() - dateA.getTime(); // Plus récent en premier
    }
    
    // 2. Si même date, trier par priorité de source
    return sourcePriority(a) - sourcePriority(b);
  });
}

/**
 * Récupère la clé de données pour une section
 */
function getSectionDataKey(section: TaxSection): string {
  switch (section) {
    case 'IR': return 'irBrackets';
    case 'IR_DECOTE': return 'irDecote';
    case 'PS': return 'psRate';
    case 'MICRO': return 'micro';
    case 'DEFICIT': return 'deficitFoncier';
    case 'PER': return 'per';
    case 'SCI_IS': return 'sciIS';
  }
}

/**
 * Convertit la version active en partials virtuels pour la comparaison
 * Cela permet à la version active de participer à la fusion par date
 */
function convertActiveToPartials(active: NormalizedTaxParams): TaxPartial[] {
  const partials: TaxPartial[] = [];
  
  // Date de la version active : on suppose qu'elle date du début d'année
  // (ou de sa dernière publication, mais on n'a pas cette info ici)
  const activeDate = new Date(active.year, 0, 1); // 1er janvier de l'année
  
  const sections: Array<{ section: TaxSection; key: string }> = [
    { section: 'IR', key: 'irBrackets' },
    { section: 'IR_DECOTE', key: 'irDecote' },
    { section: 'PS', key: 'psRate' },
    { section: 'MICRO', key: 'micro' },
    { section: 'DEFICIT', key: 'deficitFoncier' },
    { section: 'PER', key: 'per' },
    { section: 'SCI_IS', key: 'sciIS' },
  ];
  
  for (const { section, key } of sections) {
    const data = (active as any)[key];
    
    // Si la section existe dans la version active, créer un partial virtuel
    if (data !== undefined && data !== null) {
      partials.push({
        section,
        data: { [key]: data },
        meta: {
          source: 'BOFIP', // Source fictive pour le tri
          url: `Version active ${active.year}`,
          fetchedAt: activeDate,
          hash: JSON.stringify(data),
          confidence: 'high',
          notes: `Données de la version active ${active.year} (publiée)`
        }
      });
    }
  }
  
  console.log(`[ConsensusMerge] Version active convertie: ${partials.length} section(s)`);
  
  return partials;
}

