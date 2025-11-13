/**
 * Templates de réponses structurées
 * Garantit des formats cohérents pour KPI, listes, documents
 */

export interface KpiAnswer {
  type: 'kpi';
  headline: string;
  bullets: string[];
  value?: number;
  unit?: string;
  sources: SourceInfo[];
}

export interface ListAnswer {
  type: 'list';
  title: string;
  columns: string[];
  rows: any[][];
  total?: number;
  sources: SourceInfo[];
}

export interface DocAnswer {
  type: 'doc';
  title: string;
  detectedDates?: string[];
  amounts?: string[];
  parties?: string[];
  shortSummary: string;
  sources: SourceInfo[];
}

export interface SourceInfo {
  type: 'sql' | 'doc' | 'kb' | 'code';
  content: string;
  snippet?: string;
  metadata?: any;
}

/**
 * Crée une réponse KPI depuis des résultats SQL
 */
export function createKpiAnswer(
  question: string,
  data: any[],
  sql: string
): KpiAnswer {
  // Si c'est un count simple
  if (data.length === 1 && 'count' in data[0]) {
    const count = parseInt(data[0].count, 10);
    return {
      type: 'kpi',
      headline: `${count} résultat(s)`,
      bullets: [],
      value: count,
      sources: [
        {
          type: 'sql',
          content: sql,
          snippet: `${count} ligne(s)`,
        },
      ],
    };
  }

  // Si c'est un total simple
  if (data.length === 1 && 'total' in data[0]) {
    const total = parseFloat(data[0].total || 0);
    return {
      type: 'kpi',
      headline: `Total : ${total.toFixed(2)} €`,
      bullets: [],
      value: total,
      unit: '€',
      sources: [
        {
          type: 'sql',
          content: sql,
          snippet: `1 résultat`,
        },
      ],
    };
  }

  // Si c'est une liste de résultats
  if (data.length > 1) {
    const bullets = data.slice(0, 5).map((row) => {
      const values = Object.values(row).slice(0, 3);
      return values.join(' | ');
    });

    if (data.length > 5) {
      bullets.push(`... et ${data.length - 5} autre(s) résultat(s)`);
    }

    return {
      type: 'kpi',
      headline: `${data.length} résultat(s) trouvé(s)`,
      bullets,
      sources: [
        {
          type: 'sql',
          content: sql,
          snippet: `${data.length} ligne(s)`,
        },
      ],
    };
  }

  // Fallback
  return {
    type: 'kpi',
    headline: 'Résultat',
    bullets: [],
    sources: [
      {
        type: 'sql',
        content: sql,
      },
    ],
  };
}

/**
 * Crée une réponse liste depuis des résultats SQL
 */
export function createListAnswer(
  title: string,
  data: any[],
  sql: string
): ListAnswer {
  if (data.length === 0) {
    return {
      type: 'list',
      title,
      columns: [],
      rows: [],
      total: 0,
      sources: [
        {
          type: 'sql',
          content: sql,
        },
      ],
    };
  }

  const columns = Object.keys(data[0]);
  const rows = data.map(row => columns.map(col => row[col]));

  return {
    type: 'list',
    title,
    columns,
    rows,
    total: data.length,
    sources: [
      {
        type: 'sql',
        content: sql,
        snippet: `${data.length} résultat(s)`,
      },
    ],
  };
}

/**
 * Crée une réponse document avec analyse OCR
 */
export function createDocAnswer(
  document: any,
  ocrText?: string
): DocAnswer {
  const dates = extractDates(ocrText || '');
  const amounts = extractAmounts(ocrText || '');
  const parties = extractParties(ocrText || '');

  const shortSummary = ocrText
    ? ocrText.substring(0, 500) + (ocrText.length > 500 ? '...' : '')
    : 'Pas de texte OCR disponible';

  return {
    type: 'doc',
    title: document.fileName || 'Document',
    detectedDates: dates,
    amounts,
    parties,
    shortSummary,
    sources: [
      {
        type: 'doc',
        content: document.fileName,
        metadata: { id: document.id },
      },
    ],
  };
}

/**
 * Extrait les dates d'un texte
 */
function extractDates(text: string): string[] {
  const dateRegex = /\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\b/g;
  const matches = text.match(dateRegex) || [];
  return [...new Set(matches)].slice(0, 5);
}

/**
 * Extrait les montants d'un texte
 */
function extractAmounts(text: string): string[] {
  const amountRegex = /\b(\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{2})?)\s*(?:€|EUR|euros?)\b/gi;
  const matches = text.match(amountRegex) || [];
  return [...new Set(matches)].slice(0, 5);
}

/**
 * Extrait les noms de parties (basique)
 */
function extractParties(text: string): string[] {
  // Pattern simple : Mots commençant par majuscule suivis d'autres mots
  const partyRegex = /\b([A-Z][a-zéèêàâôù]+(?:\s+[A-Z][a-zéèêàâôù]+)*)\b/g;
  const matches = text.match(partyRegex) || [];
  return [...new Set(matches)].slice(0, 3);
}

/**
 * Convertit un template en texte pour l'affichage
 */
export function templateToText(template: KpiAnswer | ListAnswer | DocAnswer): string {
  if (template.type === 'kpi') {
    let text = template.headline;
    if (template.bullets.length > 0) {
      text += '\n\n' + template.bullets.map(b => `• ${b}`).join('\n');
    }
    return text;
  }

  if (template.type === 'list') {
    let text = template.title;
    if (template.rows.length > 0) {
      text += `\n\n${template.total} résultat(s) :\n\n`;
      text += template.rows.slice(0, 10).map((row, i) => 
        `${i + 1}. ${row.join(' | ')}`
      ).join('\n');
      
      if (template.rows.length > 10) {
        text += `\n... et ${template.rows.length - 10} autre(s)`;
      }
    }
    return text;
  }

  if (template.type === 'doc') {
    let text = `Document : ${template.title}\n\n`;
    
    if (template.detectedDates && template.detectedDates.length > 0) {
      text += `📅 Dates : ${template.detectedDates.join(', ')}\n`;
    }
    
    if (template.amounts && template.amounts.length > 0) {
      text += `💰 Montants : ${template.amounts.join(', ')}\n`;
    }
    
    if (template.parties && template.parties.length > 0) {
      text += `👤 Parties : ${template.parties.join(', ')}\n`;
    }
    
    text += `\n${template.shortSummary}`;
    
    return text;
  }

  return '';
}

