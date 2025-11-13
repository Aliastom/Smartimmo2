/**
 * Parseur PDF pour extraction de données fiscales
 * 
 * Note: pdf-parse pose des problèmes avec Next.js en mode serveur
 * Le parsing PDF est donc optionnel pour ne pas bloquer le reste du module
 */

import { cleanText, parseEuroAmount, parsePercentage } from './html';

/**
 * Parse un buffer PDF et retourne le texte brut
 * 
 * Note: Actuellement désactivé car pdf-parse incompatible avec Next.js
 * Alternative: télécharger manuellement les PDFs et les convertir en HTML
 */
export async function parsePDF(buffer: Buffer): Promise<string> {
  // TODO: Implémenter avec une alternative compatible Next.js
  // Options possibles:
  // - @xmldom/xmldom + pdf2json
  // - Service externe de conversion PDF → text
  // - Utiliser uniquement les sources HTML
  
  console.warn('[PDF Parser] pdf-parse désactivé temporairement (incompatibilité Next.js)');
  return '';
}

/**
 * Parse un buffer PDF et retourne les pages séparément
 */
export async function parsePDFPages(buffer: Buffer): Promise<string[]> {
  console.warn('[PDF Parser] pdf-parse désactivé temporairement (incompatibilité Next.js)');
  return [];
}

/**
 * Extrait des lignes de tableau depuis du texte PDF
 * Détecte les lignes alignées avec des espaces multiples
 */
export function extractTableFromText(text: string): string[][] {
  const lines = text.split('\n');
  const table: string[][] = [];
  
  for (const line of lines) {
    // Détecter les colonnes séparées par 2+ espaces
    const cells = line
      .split(/\s{2,}/)
      .map(cell => cleanText(cell))
      .filter(cell => cell.length > 0);
    
    if (cells.length > 0) {
      table.push(cells);
    }
  }
  
  return table;
}

/**
 * Trouve une section dans un texte PDF entre deux marqueurs
 */
export function extractSection(
  text: string,
  startMarker: string,
  endMarker?: string
): string | null {
  const startIndex = text.toLowerCase().indexOf(startMarker.toLowerCase());
  if (startIndex === -1) return null;
  
  const startText = text.substring(startIndex + startMarker.length);
  
  if (!endMarker) {
    return cleanText(startText);
  }
  
  const endIndex = startText.toLowerCase().indexOf(endMarker.toLowerCase());
  if (endIndex === -1) {
    return cleanText(startText);
  }
  
  return cleanText(startText.substring(0, endIndex));
}

/**
 * Extrait un tableau de barème IR depuis du texte PDF
 */
export function extractIRBracketsFromPDF(text: string): Array<{
  lower: number;
  upper: number | null;
  rate: number;
}> | null {
  // Chercher la section du barème
  const section = extractSection(text, 'barème', 'décote');
  if (!section) return null;
  
  const table = extractTableFromText(section);
  const brackets: Array<{ lower: number; upper: number | null; rate: number }> = [];
  
  for (const row of table) {
    if (row.length < 2) continue;
    
    // Chercher un pattern de montants et taux
    const amountPattern = /\d[\d\s']*\d|\d/g;
    const amounts = row[0].match(amountPattern);
    const rateText = row[1] || row[row.length - 1];
    
    if (!amounts) continue;
    
    const lower = parseEuroAmount(amounts[0]);
    if (lower === null) continue;
    
    const upper = amounts.length > 1 ? parseEuroAmount(amounts[1]) : null;
    const rate = parsePercentage(rateText);
    
    if (rate !== null) {
      brackets.push({ lower, upper, rate });
    }
  }
  
  return brackets.length > 0 ? brackets : null;
}

/**
 * Extrait la décote IR depuis du texte PDF
 */
export function extractDecoteFromPDF(text: string): {
  seuilCelibataire: number;
  seuilCouple: number;
  facteur: number;
} | null {
  const section = extractSection(text, 'décote', 'prélèvements');
  if (!section) return null;
  
  // Chercher les seuils
  const celibataireMatch = section.match(/célibataire[^\d]*(\d[\d\s']*)/i);
  const coupleMatch = section.match(/couple[^\d]*(\d[\d\s']*)/i);
  const facteurMatch = section.match(/(\d+(?:[.,]\d+)?)\s*%/);
  
  if (!celibataireMatch || !coupleMatch || !facteurMatch) return null;
  
  const seuilCelibataire = parseEuroAmount(celibataireMatch[1]);
  const seuilCouple = parseEuroAmount(coupleMatch[1]);
  const facteur = parsePercentage(facteurMatch[1]);
  
  if (seuilCelibataire === null || seuilCouple === null || facteur === null) {
    return null;
  }
  
  return { seuilCelibataire, seuilCouple, facteur };
}

/**
 * Extrait le taux de prélèvements sociaux depuis du texte PDF
 */
export function extractPSRateFromPDF(text: string): number | null {
  const section = extractSection(text, 'prélèvements sociaux', 'micro');
  if (!section) return null;
  
  // Chercher un pourcentage (généralement 17.2%)
  const match = section.match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (!match) return null;
  
  return parsePercentage(match[1]);
}

/**
 * Extrait les plafonds micro depuis du texte PDF
 */
export function extractMicroFromPDF(text: string): {
  foncier: { plafond: number; abattement: number };
  bic: {
    vente: { plafond: number; abattement: number };
    services: { plafond: number; abattement: number };
  };
} | null {
  const section = extractSection(text, 'micro', 'déficit');
  if (!section) return null;
  
  // Patterns pour extraire les données
  const foncierMatch = section.match(/foncier[^\d]*(\d[\d\s']*)[^\d]*(\d+(?:[.,]\d+)?)\s*%/i);
  const venteMatch = section.match(/vente[^\d]*(\d[\d\s']*)[^\d]*(\d+(?:[.,]\d+)?)\s*%/i);
  const servicesMatch = section.match(/services[^\d]*(\d[\d\s']*)[^\d]*(\d+(?:[.,]\d+)?)\s*%/i);
  
  if (!foncierMatch && !venteMatch && !servicesMatch) return null;
  
  const result: any = {
    foncier: { plafond: 0, abattement: 0 },
    bic: {
      vente: { plafond: 0, abattement: 0 },
      services: { plafond: 0, abattement: 0 },
    },
  };
  
  if (foncierMatch) {
    result.foncier.plafond = parseEuroAmount(foncierMatch[1]) || 0;
    result.foncier.abattement = parsePercentage(foncierMatch[2]) || 0;
  }
  
  if (venteMatch) {
    result.bic.vente.plafond = parseEuroAmount(venteMatch[1]) || 0;
    result.bic.vente.abattement = parsePercentage(venteMatch[2]) || 0;
  }
  
  if (servicesMatch) {
    result.bic.services.plafond = parseEuroAmount(servicesMatch[1]) || 0;
    result.bic.services.abattement = parsePercentage(servicesMatch[2]) || 0;
  }
  
  return result;
}

