/**
 * Normaliseur de langue française
 * Résout les expressions temporelles, numériques, et nettoie le texte
 */

import { startOfMonth, endOfMonth, subMonths, addMonths, startOfYear, endOfYear, addDays } from 'date-fns';

export interface NormalizedQuestion {
  original: string;
  normalized: string;
  timeRange?: {
    start: Date;
    end: Date;
    label: string;
  };
  numbers?: number[];
  entities?: string[];
  cleaned: string; // Sans formules de politesse
}

/**
 * Normalise une question en français
 */
export function normalizeFr(question: string): NormalizedQuestion {
  const original = question;
  let normalized = question.toLowerCase().trim();

  // 1. Résoudre les expressions temporelles
  const timeRange = extractTimeRange(normalized);

  // 2. Extraire les nombres (mots → chiffres)
  const numbers = extractNumbers(normalized);

  // 3. Extraire les entités potentielles
  const entities = extractEntities(normalized);

  // 4. Nettoyer (formules de politesse, ponctuation inutile)
  const cleaned = cleanText(normalized);

  return {
    original,
    normalized,
    timeRange,
    numbers,
    entities,
    cleaned,
  };
}

/**
 * Extrait et résout les expressions temporelles
 */
function extractTimeRange(text: string): NormalizedQuestion['timeRange'] {
  const now = new Date();

  // Ce mois
  if (text.match(/ce mois|mois en cours|mois actuel|mois courant/)) {
    return {
      start: startOfMonth(now),
      end: endOfMonth(now),
      label: 'ce mois',
    };
  }

  // Mois dernier / mois précédent
  if (text.match(/mois dernier|mois précédent|mois passé/)) {
    const lastMonth = subMonths(now, 1);
    return {
      start: startOfMonth(lastMonth),
      end: endOfMonth(lastMonth),
      label: 'mois dernier',
    };
  }

  // Mois prochain
  if (text.match(/mois prochain|mois suivant/)) {
    const nextMonth = addMonths(now, 1);
    return {
      start: startOfMonth(nextMonth),
      end: endOfMonth(nextMonth),
      label: 'mois prochain',
    };
  }

  // D'ici X jours/mois
  const dansMatch = text.match(/d'?ici (\d+) (jours?|mois)/);
  if (dansMatch) {
    const amount = parseInt(dansMatch[1], 10);
    const unit = dansMatch[2];
    
    if (unit.startsWith('jour')) {
      return {
        start: now,
        end: addDays(now, amount),
        label: `${amount} prochains jours`,
      };
    } else if (unit.startsWith('mois')) {
      return {
        start: now,
        end: addMonths(now, amount),
        label: `${amount} prochains mois`,
      };
    }
  }

  // 3 mois / 90 jours
  if (text.match(/3 mois|90 jours|trois mois/)) {
    return {
      start: now,
      end: addMonths(now, 3),
      label: '3 prochains mois',
    };
  }

  // 60 jours / 2 mois
  if (text.match(/60 jours|2 mois|deux mois/)) {
    return {
      start: now,
      end: addMonths(now, 2),
      label: '2 prochains mois',
    };
  }

  // Ce trimestre
  if (text.match(/ce trimestre|trimestre en cours|trimestre actuel/)) {
    const month = now.getMonth();
    const quarter = Math.floor(month / 3);
    const qStart = new Date(now.getFullYear(), quarter * 3, 1);
    const qEnd = endOfMonth(addMonths(qStart, 2));
    
    return {
      start: qStart,
      end: qEnd,
      label: 'ce trimestre',
    };
  }

  // Cette année / année en cours
  if (text.match(/cette année|année en cours|année actuelle/)) {
    return {
      start: startOfYear(now),
      end: endOfYear(now),
      label: 'cette année',
    };
  }

  // YTD (Year To Date)
  if (text.match(/ytd|depuis janvier|depuis le début de l'année/)) {
    return {
      start: startOfYear(now),
      end: now,
      label: 'YTD',
    };
  }

  // Mois spécifique (mars, avril, etc.)
  const monthNames = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  for (let i = 0; i < monthNames.length; i++) {
    if (text.includes(monthNames[i])) {
      const monthDate = new Date(now.getFullYear(), i, 1);
      return {
        start: startOfMonth(monthDate),
        end: endOfMonth(monthDate),
        label: monthNames[i],
      };
    }
  }

  return undefined;
}

/**
 * Extrait et convertit les nombres écrits en mots
 */
function extractNumbers(text: string): number[] {
  const numbers: number[] = [];

  // Nombres en chiffres
  const digitMatches = text.match(/\d+/g);
  if (digitMatches) {
    numbers.push(...digitMatches.map(n => parseInt(n, 10)));
  }

  // Nombres en lettres (limité à 0-20 pour simplicité)
  const wordNumbers: Record<string, number> = {
    'zéro': 0, 'un': 1, 'une': 1, 'deux': 2, 'trois': 3, 'quatre': 4, 'cinq': 5,
    'six': 6, 'sept': 7, 'huit': 8, 'neuf': 9, 'dix': 10,
    'onze': 11, 'douze': 12, 'treize': 13, 'quatorze': 14, 'quinze': 15,
    'seize': 16, 'vingt': 20, 'trente': 30, 'quarante': 40, 'cinquante': 50,
  };

  for (const [word, num] of Object.entries(wordNumbers)) {
    if (text.includes(word)) {
      numbers.push(num);
    }
  }

  return [...new Set(numbers)]; // Dédupliqué
}

/**
 * Extrait les entités potentielles (noms propres, identifiants)
 */
function extractEntities(text: string): string[] {
  const entities: string[] = [];

  // Patterns d'entités
  const patterns = [
    /bien\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g, // "bien Villa Familiale"
    /locataire\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g, // "locataire Dupont"
    /bail\s+([A-Z0-9-]+)/g, // "bail ABC-123"
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      entities.push(match[1]);
    }
  }

  return entities;
}

/**
 * Nettoie le texte (formules de politesse, ponctuation)
 */
function cleanText(text: string): string {
  let cleaned = text;

  // Retirer formules de politesse
  const politePatterns = [
    /s'?il\s+(te|vous)\s+plaît/gi,
    /stp/gi,
    /svp/gi,
    /merci\s+(beaucoup|bien|d'avance)?/gi,
    /peux-tu/gi,
    /pourrai[st]-tu/gi,
    /est-ce que tu peux/gi,
    /tu peux/gi,
    /pourrais-je/gi,
    /puis-je/gi,
  ];

  for (const pattern of politePatterns) {
    cleaned = cleaned.replace(pattern, '');
  }

  // Retirer ponctuation excessive
  cleaned = cleaned.replace(/[?!]+$/, '');
  cleaned = cleaned.replace(/\s+/g, ' ');
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * Détecte l'intent d'une question (classification simple)
 */
export function detectIntent(question: string): 'kpi' | 'doc' | 'howto' | 'code' | 'other' {
  const q = question.toLowerCase();

  // KPI / SQL
  const kpiPatterns = [
    /combien/,
    /total/,
    /liste/,
    /qui/,
    /quels?/,
    /cashflow/,
    /encaissements?/,
    /en retard/,
    /impayés?/,
    /montant/,
    /nombre/,
    /capital/,
    /mensualité/,
    /échéances?/,
    /prêts?/,
    /baux/,
  ];

  for (const pattern of kpiPatterns) {
    if (pattern.test(q)) return 'kpi';
  }

  // Documents / OCR
  const docPatterns = [
    /as-tu reçu/,
    /j'ai reçu/,
    /contenu du document/,
    /résumé du document/,
    /document.*lié/,
    /relevé/,
    /quittance/,
  ];

  for (const pattern of docPatterns) {
    if (pattern.test(q)) return 'doc';
  }

  // How-to / Guide
  const howtoPatterns = [
    /comment/,
    /guide/,
    /explication/,
    /où se trouve/,
    /où trouver/,
    /c'est quoi/,
    /qu'est-ce que/,
  ];

  for (const pattern of howtoPatterns) {
    if (pattern.test(q)) return 'howto';
  }

  // Code / UI
  const codePatterns = [
    /quel fichier/,
    /quel composant/,
    /quel style/,
    /quelle classe/,
    /dans le code/,
  ];

  for (const pattern of codePatterns) {
    if (pattern.test(q)) return 'code';
  }

  return 'other';
}

/**
 * Convertit un TimeRange en SQL WHERE clause
 */
export function timeRangeToSql(timeRange: NormalizedQuestion['timeRange'], dateColumn = 'date'): string {
  if (!timeRange) return '';

  const start = timeRange.start.toISOString().split('T')[0];
  const end = timeRange.end.toISOString().split('T')[0];

  return `${dateColumn} BETWEEN '${start}' AND '${end}'`;
}

