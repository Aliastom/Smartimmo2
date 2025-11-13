/**
 * Parseur HTML pour extraction de données fiscales
 */

import * as cheerio from 'cheerio';

/**
 * Parse un document HTML et retourne un objet Cheerio
 */
export function parseHTML(html: string): cheerio.CheerioAPI {
  return cheerio.load(html);
}

/**
 * Extrait le texte d'un élément en nettoyant les espaces
 */
export function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\u00A0/g, ' ')  // Non-breaking space
    .trim();
}

/**
 * Extrait un tableau HTML vers un array 2D
 */
export function extractTable($: cheerio.CheerioAPI, selector: string): string[][] {
  const rows: string[][] = [];
  
  $(selector).find('tr').each((_, tr) => {
    const cells: string[] = [];
    $(tr).find('td, th').each((_, cell) => {
      cells.push(cleanText($(cell).text()));
    });
    if (cells.length > 0) {
      rows.push(cells);
    }
  });
  
  return rows;
}

/**
 * Parse un montant en euros (gère les formats "10 000 €", "10.000,00 €", "1 77106", etc.)
 * AMÉLIORÉ : Normalise tous les espaces et séparateurs
 */
export function parseEuroAmount(text: string): number | null {
  // Nettoyer le texte de TOUS les espaces (y compris insécables)
  let cleaned = text
    .replace(/\s+/g, '')           // Tous les espaces
    .replace(/\u00A0/g, '')        // Non-breaking space
    .replace(/\u202F/g, '')        // Narrow no-break space
    .replace(/€/g, '')             // Symbole euro
    .replace(/'/g, '')             // Apostrophe
    .replace(/'/g, '')             // Apostrophe typographique
    .trim();
  
  // Gérer le format français (virgule = décimales, point = milliers)
  if (cleaned.includes(',')) {
    // Retirer les points (milliers) et remplacer virgule par point (décimales)
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  }
  
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Parse un pourcentage (gère "17,2 %", "17.2%", "30,00 %", etc.)
 * AMÉLIORÉ : Normalise tous les espaces et formats
 */
export function parsePercentage(text: string): number | null {
  const cleaned = text
    .replace(/\s+/g, '')           // Tous les espaces
    .replace(/\u00A0/g, '')        // Non-breaking space
    .replace(/\u202F/g, '')        // Narrow no-break space
    .replace(/%/g, '')
    .replace(',', '.')
    .trim();
  
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return null;
  
  // Retourner en fraction (0.172 pour 17.2%)
  return parsed / 100;
}

/**
 * Extrait un nombre entier d'un texte
 */
export function extractInteger(text: string): number | null {
  const match = text.match(/\d+/);
  if (!match) return null;
  
  const parsed = parseInt(match[0], 10);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Trouve une ligne dans un tableau qui contient un texte donné
 */
export function findRowContaining(table: string[][], searchText: string): string[] | null {
  for (const row of table) {
    if (row.some(cell => cell.toLowerCase().includes(searchText.toLowerCase()))) {
      return row;
    }
  }
  return null;
}

/**
 * Extrait plusieurs lignes d'un tableau qui correspondent à un pattern
 */
export function findRowsMatching(
  table: string[][], 
  pattern: RegExp, 
  columnIndex: number = 0
): string[][] {
  return table.filter(row => 
    row[columnIndex] && pattern.test(row[columnIndex])
  );
}

/**
 * Parse une tranche de barème IR depuis une ligne de tableau
 * Ex: ["De 11 295 € à 28 797 €", "11%"] -> { lower: 11295, upper: 28797, rate: 0.11 }
 */
export function parseIRBracketRow(row: string[]): {
  lower: number;
  upper: number | null;
  rate: number;
} | null {
  if (row.length < 2) return null;
  
  const rangeText = row[0];
  const rateText = row[1];
  
  // Extraire les montants
  const amounts = rangeText.match(/\d[\d\s']*\d|\d/g);
  if (!amounts || amounts.length === 0) return null;
  
  const lower = parseEuroAmount(amounts[0]);
  if (lower === null) return null;
  
  // Upper peut être null si "Au-delà de..."
  const upper = amounts.length > 1 ? parseEuroAmount(amounts[1]) : null;
  
  // Extraire le taux
  const rate = parsePercentage(rateText);
  if (rate === null) return null;
  
  return { lower, upper, rate };
}

/**
 * Extrait un attribut "content" d'une balise meta
 */
export function extractMetaContent($: cheerio.CheerioAPI, name: string): string | null {
  const content = $(`meta[name="${name}"]`).attr('content');
  return content ? cleanText(content) : null;
}

/**
 * Extrait tous les liens d'une page
 */
export function extractLinks($: cheerio.CheerioAPI, selector?: string): Array<{ href: string; text: string }> {
  const links: Array<{ href: string; text: string }> = [];
  
  const linkSelector = selector ? `${selector} a` : 'a';
  
  $(linkSelector).each((_, el) => {
    const href = $(el).attr('href');
    const text = cleanText($(el).text());
    if (href) {
      links.push({ href, text });
    }
  });
  
  return links;
}

