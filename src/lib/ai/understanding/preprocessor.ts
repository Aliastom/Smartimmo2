/**
 * UNDERSTANDING BOOSTER - Pré-traitement avancé
 * Normalisation maximale FR + résolution de contexte
 */

import { normalizeFr, type NormalizedQuestion } from '../nlp/normalizeFr';
import { getUiContextFromUrl, type UiContext } from '../context/getUiContext';

export interface EnhancedInput {
  // Question originale
  original: string;
  
  // Normalisée (FR)
  normalized: NormalizedQuestion;
  
  // Contexte UI enrichi
  uiContext: UiContext;
  
  // Historique court (co-référence)
  recentHistory?: Array<{
    question: string;
    answer: string;
    entities?: string[];
  }>;
  
  // Métadonnées récentes (< 24h)
  recentActivity?: {
    newLeases?: number;
    newTransactions?: number;
    newDocuments?: number;
  };
  
  // Signaux combinés
  signals: {
    hasNumericQuery: boolean; // Demande un chiffre
    hasListQuery: boolean; // Demande une liste
    hasTimeReference: boolean; // Mentionne une période
    hasEntityReference: boolean; // Mentionne une entité
    hasDocumentReference: boolean; // Mentionne un document
    isComparisonQuery: boolean; // Compare (vs, par rapport à)
    isBinaryQuery: boolean; // Oui/Non attendu
  };
  
  // Entités résolues par co-référence
  resolvedEntities?: {
    propertyId?: string;
    leaseId?: string;
    tenantId?: string;
    documentId?: string;
  };
}

/**
 * Pré-traite une question avec tous les signaux disponibles
 */
export async function preprocessQuestion(
  question: string,
  pathname?: string,
  searchParams?: URLSearchParams,
  recentHistory?: EnhancedInput['recentHistory']
): Promise<EnhancedInput> {
  
  // 1. Normalisation FR de base
  const normalized = normalizeFr(question);
  
  // 2. Contexte UI
  const uiContext = pathname 
    ? getUiContextFromUrl(pathname, searchParams)
    : { scope: {}, route: '/', locale: 'fr-FR' };
  
  // 3. Résolution de co-référence (celui-ci, le précédent, etc.)
  const resolvedEntities = resolveCoreference(normalized.cleaned, recentHistory);
  
  // 4. Détection de signaux
  const signals = detectSignals(normalized.cleaned);
  
  // 5. Lemmatisation légère
  const lemmatized = lightLemmatization(normalized.cleaned);
  
  // 6. Résolution des variations orthographiques
  const normalized2 = resolveOrthographicVariants(lemmatized);
  
  // Mettre à jour le normalized avec la version améliorée
  normalized.cleaned = normalized2;
  
  return {
    original: question,
    normalized,
    uiContext,
    recentHistory,
    signals,
    resolvedEntities,
  };
}

/**
 * Résout les co-références ("celui-ci", "le précédent", "ce bien")
 */
function resolveCoreference(
  question: string,
  recentHistory?: EnhancedInput['recentHistory']
): EnhancedInput['resolvedEntities'] {
  
  if (!recentHistory || recentHistory.length === 0) {
    return undefined;
  }
  
  const resolved: EnhancedInput['resolvedEntities'] = {};
  
  // Patterns de co-référence
  const coreferencePatterns = [
    'celui-ci',
    'celui-là',
    'celle-ci',
    'celle-là',
    'le précédent',
    'l\'avant-dernier',
    'ce bien',
    'ce bail',
    'ce locataire',
    'ce document',
  ];
  
  const questionLower = question.toLowerCase();
  const hasCoreference = coreferencePatterns.some(p => questionLower.includes(p));
  
  if (!hasCoreference) {
    return undefined;
  }
  
  // Récupérer les entités de l'historique récent
  const lastEntry = recentHistory[recentHistory.length - 1];
  
  if (lastEntry.entities) {
    // Extraire les IDs depuis les entités mentionnées
    for (const entity of lastEntry.entities) {
      if (entity.startsWith('property:')) {
        resolved.propertyId = entity.replace('property:', '');
      } else if (entity.startsWith('lease:')) {
        resolved.leaseId = entity.replace('lease:', '');
      } else if (entity.startsWith('tenant:')) {
        resolved.tenantId = entity.replace('tenant:', '');
      } else if (entity.startsWith('document:')) {
        resolved.documentId = entity.replace('document:', '');
      }
    }
  }
  
  return Object.keys(resolved).length > 0 ? resolved : undefined;
}

/**
 * Détecte les signaux dans la question
 */
function detectSignals(question: string): EnhancedInput['signals'] {
  const q = question.toLowerCase();
  
  return {
    hasNumericQuery: /combien|total|montant|nombre|somme|capital/.test(q),
    hasListQuery: /liste|qui|quels?|lesquels|noms/.test(q),
    hasTimeReference: /mois|année|trimestre|jour|ytd|depuis|d'ici|hier|demain/.test(q),
    hasEntityReference: /bien|bail|locataire|prêt|document/.test(q),
    hasDocumentReference: /document|fichier|pdf|relevé|quittance|attestation/.test(q),
    isComparisonQuery: /vs|versus|par rapport|comparé|différence|écart/.test(q),
    isBinaryQuery: /^(as-tu|ai-je|est-ce que|y a-t-il)/.test(q) || /\?$/.test(q),
  };
}

/**
 * Lemmatisation légère (simplifié pour le français)
 */
function lightLemmatization(text: string): string {
  let lemmatized = text;
  
  // Verbes courants au participe passé → infinitif
  const verbMappings: Record<string, string> = {
    'encaissés': 'encaisser',
    'encaissé': 'encaisser',
    'payés': 'payer',
    'payé': 'payer',
    'reçus': 'recevoir',
    'reçu': 'recevoir',
    'dus': 'devoir',
    'dû': 'devoir',
    'actifs': 'actif',
    'active': 'actif',
  };
  
  for (const [variant, base] of Object.entries(verbMappings)) {
    const regex = new RegExp(`\\b${variant}\\b`, 'gi');
    lemmatized = lemmatized.replace(regex, base);
  }
  
  return lemmatized;
}

/**
 * Résout les variations orthographiques
 */
function resolveOrthographicVariants(text: string): string {
  let resolved = text;
  
  const variants: Record<string, string> = {
    'loyé': 'loyer',
    'loyés': 'loyer',
    'echeance': 'échéance',
    'echeances': 'échéances',
    'pret': 'prêt',
    'prets': 'prêts',
    'recu': 'reçu',
    'recus': 'reçus',
    'acquis': 'acquise',
  };
  
  for (const [variant, canonical] of Object.entries(variants)) {
    const regex = new RegExp(`\\b${variant}\\b`, 'gi');
    resolved = resolved.replace(regex, canonical);
  }
  
  return resolved;
}

/**
 * Extrait les entités mentionnées dans la question
 */
export function extractMentionedEntities(question: string): string[] {
  const entities: string[] = [];
  const q = question.toLowerCase();
  
  // Patterns d'entités
  if (q.includes('bien') || q.includes('propriété') || q.includes('villa') || q.includes('appartement')) {
    entities.push('property');
  }
  
  if (q.includes('locataire') || q.includes('occupant')) {
    entities.push('tenant');
  }
  
  if (q.includes('bail') || q.includes('contrat')) {
    entities.push('lease');
  }
  
  if (q.includes('prêt') || q.includes('emprunt')) {
    entities.push('loan');
  }
  
  if (q.includes('document') || q.includes('fichier') || q.includes('relevé') || q.includes('quittance')) {
    entities.push('document');
  }
  
  return entities;
}

