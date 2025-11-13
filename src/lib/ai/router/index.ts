/**
 * Router intelligent - MAX COVERAGE
 * Choisit automatiquement le bon outil (SQL, RAG, OCR, Code) selon la question
 */

import { normalizeFr, detectIntent, timeRangeToSql } from '../nlp/normalizeFr';
import { getUiContextFromUrl, mergeContexts, contextToSqlWhere, contextToPrompt, type UiContext } from '../context/getUiContext';
import { executeSafeSql, maskPii, formatSqlResults } from '../sql/executor';
import { retrieveContext } from '../rag/retrieve';
import { generateCompletion } from '../clients/mistral';
import { PrismaClient } from '@prisma/client';
import catalogData from '../sql/catalog.json';

const prisma = new PrismaClient();

export interface RouterInput {
  question: string;
  uiContext?: UiContext;
  sessionUser?: string;
  pathname?: string;
  searchParams?: URLSearchParams;
}

export interface RouterOutput {
  answer: string;
  plan: string;
  tool: 'sql' | 'ocr' | 'kb' | 'code' | 'template';
  sources: Array<{
    type: 'sql' | 'doc' | 'kb' | 'code';
    content: string;
    metadata?: any;
  }>;
  sql?: string; // Si SQL a été utilisé
  rowCount?: number;
  durationMs: number;
  metadata?: Record<string, any>;
}

/**
 * Point d'entrée du router
 */
export async function route(input: RouterInput): Promise<RouterOutput> {
  const startTime = Date.now();

  console.log(`[Router] Question: "${input.question.substring(0, 100)}..."`);

  try {
    // Étape 1 : Normaliser la question
    const normalized = normalizeFr(input.question);
    console.log(`[Router] Normalized: "${normalized.cleaned}"`);
    console.log(`[Router] TimeRange:`, normalized.timeRange?.label || 'none');

    // Étape 2 : Extraire/fusionner le contexte UI
    let uiContext = input.uiContext;
    if (!uiContext && input.pathname) {
      uiContext = getUiContextFromUrl(input.pathname, input.searchParams);
    }
    
    const mergedContext = mergeContexts(uiContext || { scope: {}, route: '/', locale: 'fr-FR' }, normalized);
    console.log(`[Router] Context:`, contextToPrompt(mergedContext));

    // Étape 3 : Détecter l'intent
    const intent = detectIntent(normalized.cleaned);
    console.log(`[Router] Intent: ${intent}`);

    // Étape 4 : Choisir et exécuter l'outil
    let result: RouterOutput;

    switch (intent) {
      case 'kpi':
        result = await handleKpiIntent(normalized, mergedContext);
        break;

      case 'doc':
        result = await handleDocIntent(normalized, mergedContext);
        break;

      case 'howto':
        result = await handleHowtoIntent(normalized, mergedContext);
        break;

      case 'code':
        result = await handleCodeIntent(normalized, mergedContext);
        break;

      default:
        // Fallback : essayer SQL puis KB
        result = await handleFallback(normalized, mergedContext);
        break;
    }

    // Ajouter la durée totale
    result.durationMs = Date.now() - startTime;

    console.log(`[Router] Tool used: ${result.tool}, Duration: ${result.durationMs}ms`);

    return result;
  } catch (error: any) {
    console.error('[Router] Erreur:', error);

    return {
      answer: `Désolé, une erreur est survenue: ${error.message}`,
      plan: 'Erreur lors du routage',
      tool: 'template',
      sources: [],
      durationMs: Date.now() - startTime,
      metadata: { error: error.message },
    };
  }
}

/**
 * Gère les questions KPI/SQL
 */
async function handleKpiIntent(normalized: any, context: UiContext): Promise<RouterOutput> {
  console.log('[Router:KPI] Utilisation de SQL');

  const plan = `Je vais interroger la base de données pour répondre à cette question.`;

  // Générer le SQL
  const sql = await generateSqlFromQuestion(normalized, context);
  console.log(`[Router:KPI] SQL: ${sql.substring(0, 200)}...`);

  // Exécuter
  const sqlResult = await executeSafeSql(sql);

  if (!sqlResult.ok) {
    return {
      answer: `Erreur SQL: ${sqlResult.error}`,
      plan,
      tool: 'sql',
      sources: [],
      sql,
      durationMs: 0,
    };
  }

  // Masquer PII si global
  let data = sqlResult.data || [];
  if (!context.scope.propertyId && data.length > 0) {
    data = maskPii(data);
  }

  // Générer la réponse
  const answer = await generateAnswerFromSqlResults(normalized.original, data, sql);

  return {
    answer,
    plan,
    tool: 'sql',
    sql,
    rowCount: data.length,
    sources: [
      {
        type: 'sql',
        content: sql,
        metadata: { rowCount: data.length, durationMs: sqlResult.durationMs },
      },
    ],
    durationMs: 0,
  };
}

/**
 * Gère les questions sur documents/OCR
 */
async function handleDocIntent(normalized: any, context: UiContext): Promise<RouterOutput> {
  console.log('[Router:DOC] Recherche de documents');

  const plan = `Je vais chercher dans les documents.`;

  // Recherche sémantique ou filtrée
  const documents = await searchDocuments(normalized.cleaned, context);

  if (documents.length === 0) {
    return {
      answer: `Je n'ai trouvé aucun document correspondant à "${normalized.original}".`,
      plan,
      tool: 'ocr',
      sources: [],
      durationMs: 0,
    };
  }

  // Générer la réponse
  const answer = await generateDocAnswer(normalized.original, documents);

  return {
    answer,
    plan,
    tool: 'ocr',
    sources: documents.map(d => ({
      type: 'doc' as const,
      content: d.fileName,
      metadata: { id: d.id, type: d.type },
    })),
    durationMs: 0,
  };
}

/**
 * Gère les questions how-to/guide
 */
async function handleHowtoIntent(normalized: any, context: UiContext): Promise<RouterOutput> {
  console.log('[Router:HOWTO] Recherche dans la base de connaissances');

  const plan = `Je vais chercher dans la documentation.`;

  // Recherche sémantique dans Qdrant
  const chunks = await retrieveContext(normalized.cleaned, 5, ['howto', 'guide']);

  if (chunks.length === 0) {
    return {
      answer: `Je n'ai pas trouvé de guide pour "${normalized.original}". Voulez-vous que je cherche dans les données ?`,
      plan,
      tool: 'kb',
      sources: [],
      durationMs: 0,
    };
  }

  // Générer la réponse depuis les chunks
  const kbContext = chunks.map((c, i) => `[${i + 1}] ${c.text}`).join('\n\n');
  const answer = await generateKbAnswer(normalized.original, kbContext);

  return {
    answer,
    plan,
    tool: 'kb',
    sources: chunks.map(c => ({
      type: 'kb' as const,
      content: c.source || 'knowledge-base',
      metadata: { score: c.score },
    })),
    durationMs: 0,
  };
}

/**
 * Gère les questions sur le code
 */
async function handleCodeIntent(normalized: any, context: UiContext): Promise<RouterOutput> {
  console.log('[Router:CODE] Recherche dans le code');

  const plan = `Je vais chercher dans le code source.`;

  // Recherche sémantique dans le code
  const chunks = await retrieveContext(normalized.cleaned, 5, ['code']);

  if (chunks.length === 0) {
    return {
      answer: `Je n'ai pas trouvé de code correspondant à "${normalized.original}".`,
      plan,
      tool: 'code',
      sources: [],
      durationMs: 0,
    };
  }

  // Générer la réponse
  const codeContext = chunks.map((c, i) => `[${i + 1}] Fichier: ${c.source}\n${c.text}`).join('\n\n');
  const answer = await generateCodeAnswer(normalized.original, codeContext);

  return {
    answer,
    plan,
    tool: 'code',
    sources: chunks.map(c => ({
      type: 'code' as const,
      content: c.source || 'source-code',
      metadata: { score: c.score },
    })),
    durationMs: 0,
  };
}

/**
 * Fallback : essayer SQL puis KB
 */
async function handleFallback(normalized: any, context: UiContext): Promise<RouterOutput> {
  console.log('[Router:FALLBACK] Essai SQL puis KB');

  // Essayer SQL d'abord
  try {
    return await handleKpiIntent(normalized, context);
  } catch (sqlError) {
    console.log('[Router:FALLBACK] SQL échoué, essai KB');
  }

  // Sinon KB
  return await handleHowtoIntent(normalized, context);
}

/**
 * Génère SQL depuis question normalisée + contexte
 */
async function generateSqlFromQuestion(normalized: any, context: UiContext): Promise<string> {
  const question = normalized.cleaned;
  const questionLower = question.toLowerCase();

  // Utiliser la génération heuristique améliorée
  let sql = '';

  // Baux actifs
  if (questionLower.includes('baux actifs') || questionLower.includes('nombre de baux')) {
    sql = `SELECT COUNT(*) as count FROM "Lease" WHERE status IN ('ACTIF', 'SIGNE', 'EN_COURS')`;
  }
  
  // Loyers encaissés
  else if (questionLower.includes('loyers encaissés') || questionLower.includes('encaissé')) {
    const timeWhere = normalized.timeRange 
      ? `mois = '${normalized.timeRange.start.toISOString().split('T')[0]}'::date`
      : `mois = DATE_TRUNC('month', CURRENT_DATE)`;
    
    sql = `SELECT SUM(loyer_encaisse) as total FROM v_loyers_encaissements_mensuels WHERE ${timeWhere}`;
  }
  
  // Loyers impayés / retard
  else if (questionLower.includes('retard') || questionLower.includes('impayé')) {
    sql = `SELECT property_name, tenant_name, reste_a_payer, statut FROM v_loyers_a_encaisser_courant WHERE statut IN ('IMPAYE', 'PARTIEL') ORDER BY reste_a_payer DESC`;
  }
  
  // Échéances
  else if (questionLower.includes('échéances') || questionLower.includes('echeances')) {
    sql = `SELECT type, property_name, due_date, montant_actuel, description FROM v_echeances_3_mois ORDER BY due_date`;
  }
  
  // Prêts
  else if (questionLower.includes('prêt') || questionLower.includes('capital restant')) {
    sql = `SELECT property_name, label, capital_restant_du, mensualite, mois_restants FROM v_prets_statut WHERE actif = true ORDER BY capital_restant_du DESC`;
  }
  
  // Par défaut : compter les biens
  else {
    sql = `SELECT COUNT(*) as count FROM "Property" WHERE "isArchived" = false`;
  }

  // Appliquer le scope depuis le contexte
  const scopeWhere = contextToSqlWhere(context);
  if (scopeWhere.length > 0 && !sql.includes('WHERE')) {
    sql += ` WHERE ${scopeWhere.join(' AND ')}`;
  } else if (scopeWhere.length > 0) {
    sql += ` AND ${scopeWhere.join(' AND ')}`;
  }

  // Ajouter LIMIT si absent
  if (!sql.includes('LIMIT')) {
    sql += ' LIMIT 100';
  }

  return sql;
}

/**
 * Génère une réponse depuis les résultats SQL
 */
async function generateAnswerFromSqlResults(question: string, data: any[], sql: string): Promise<string> {
  if (data.length === 0) {
    return "Aucun résultat trouvé dans la base de données.";
  }

  // Si c'est un simple count
  if (data.length === 1 && 'count' in data[0]) {
    return `Il y a ${data[0].count} résultat(s).`;
  }

  // Si c'est un simple total
  if (data.length === 1 && 'total' in data[0]) {
    const total = parseFloat(data[0].total || 0);
    return `Le total est de ${total.toFixed(2)} €.`;
  }

  // Sinon, formater les résultats
  const formatted = formatSqlResults(data, 10);
  
  // Générer une réponse avec le LLM
  const prompt = `Question: "${question}"

Résultats de la base de données:
${formatted}

Réponds de manière claire et structurée en français. Présente les résultats de façon lisible.`;

  const answer = await generateCompletion(prompt, { maxTokens: 800 });

  return answer;
}

/**
 * Recherche de documents
 */
async function searchDocuments(query: string, context: UiContext): Promise<any[]> {
  const where: any = {
    deletedAt: null,
  };

  // Appliquer le scope
  if (context.scope.propertyId) where.propertyId = context.scope.propertyId;
  if (context.scope.leaseId) where.leaseId = context.scope.leaseId;

  // Recherche par type de document si mentionné
  if (query.includes('relevé')) {
    const typeReleve = await prisma.documentType.findFirst({
      where: { code: { contains: 'releve', mode: 'insensitive' } },
    });
    if (typeReleve) where.documentTypeId = typeReleve.id;
  }

  const documents = await prisma.document.findMany({
    where,
    include: {
      DocumentType: true,
      Property: { select: { name: true } },
    },
    take: 10,
  });

  return documents.map(d => ({
    id: d.id,
    fileName: d.fileName,
    type: d.DocumentType?.label,
    ocrText: d.extractedText,
    property: d.Property?.name,
  }));
}

/**
 * Génère une réponse sur les documents
 */
async function generateDocAnswer(question: string, documents: any[]): Promise<string> {
  const docList = documents
    .map((d, i) => `${i + 1}. ${d.fileName} (${d.type}) - ${d.property || 'Général'}`)
    .join('\n');

  const prompt = `Question: "${question}"

Documents trouvés:
${docList}

Réponds de manière claire. Si un document contient du texte OCR, mentionne-le.`;

  const answer = await generateCompletion(prompt, { maxTokens: 500 });

  return answer;
}

/**
 * Génère une réponse depuis la KB
 */
async function generateKbAnswer(question: string, kbContext: string): Promise<string> {
  const prompt = `Question: "${question}"

Documentation:
${kbContext}

Réponds de manière claire et concise en te basant sur la documentation.`;

  const answer = await generateCompletion(prompt, { maxTokens: 1000 });

  return answer;
}

/**
 * Génère une réponse depuis le code
 */
async function generateCodeAnswer(question: string, codeContext: string): Promise<string> {
  const prompt = `Question: "${question}"

Code source pertinent:
${codeContext}

Explique où se trouve le code et comment il fonctionne.`;

  const answer = await generateCompletion(prompt, { maxTokens: 800 });

  return answer;
}

