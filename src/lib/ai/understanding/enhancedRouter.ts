/**
 * UNDERSTANDING BOOSTER - Router amélioré
 * Utilise tous les signaux pour maximiser la compréhension
 */

import { preprocessQuestion, type EnhancedInput, extractMentionedEntities } from './preprocessor';
import { executeSafeSql, maskPii, formatSqlResults } from '../sql/executor';
import { retrieveContext } from '../rag/retrieve';
import { generateCompletion } from '../clients/mistral';
import { resolveEntity } from '../resolver/entityResolver';
import { createKpiAnswer, createListAnswer, templateToText, type KpiAnswer, type ListAnswer } from '../templates';
import { PrismaClient } from '@prisma/client';
import catalogData from '../sql/catalog.json';

const prisma = new PrismaClient();

export interface EnhancedRouterOutput {
  answer: string;
  plan: string;
  tool: 'sql' | 'ocr' | 'kb' | 'code' | 'clarification';
  sources: Array<{
    type: 'sql' | 'doc' | 'kb' | 'code';
    content: string;
    snippet?: string;
    metadata?: any;
  }>;
  sql?: string;
  rowCount?: number;
  durationMs: number;
  needsClarification?: boolean;
  clarificationOptions?: string[];
  template?: KpiAnswer | ListAnswer;
  metadata?: Record<string, any>;
}

/**
 * Route une question avec compréhension maximale
 */
export async function routeWithUnderstanding(
  question: string,
  pathname?: string,
  searchParams?: URLSearchParams,
  recentHistory?: EnhancedInput['recentHistory']
): Promise<EnhancedRouterOutput> {
  const startTime = Date.now();

  console.log(`[EnhancedRouter] Question: "${question.substring(0, 100)}..."`);

  try {
    // ÉTAPE 1 : Pré-traitement complet
    const input = await preprocessQuestion(question, pathname, searchParams, recentHistory);

    console.log(`[EnhancedRouter] Normalized: "${input.normalized.cleaned}"`);
    console.log(`[EnhancedRouter] Signals:`, input.signals);
    console.log(`[EnhancedRouter] TimeRange:`, input.normalized.timeRange?.label || 'none');
    console.log(`[EnhancedRouter] Scope:`, input.uiContext.scope);

    // ÉTAPE 2 : Résolution d'entités fuzzy si nécessaire
    const entityMentions = extractMentionedEntities(input.normalized.cleaned);
    
    if (entityMentions.length > 0 && !input.uiContext.entity) {
      console.log(`[EnhancedRouter] Entités mentionnées:`, entityMentions);
      // Essayer de résoudre (ex: "villa familiale" → propertyId)
      // Pour l'instant, on skip si pas d'implémentation complète
    }

    // ÉTAPE 3 : Décider de l'outil selon les signaux
    const toolChoice = chooseToolFromSignals(input);
    console.log(`[EnhancedRouter] Tool choisi: ${toolChoice}`);

    // ÉTAPE 4 : Exécuter avec l'outil choisi
    let result: EnhancedRouterOutput;

    switch (toolChoice) {
      case 'sql':
        result = await executeSqlWithContext(input);
        break;

      case 'ocr':
        result = await executeOcrSearch(input);
        break;

      case 'kb':
        result = await executeKbSearch(input);
        break;

      case 'code':
        result = await executeCodeSearch(input);
        break;

      default:
        // Fallback chain : SQL → OCR → KB
        result = await executeFallbackChain(input);
        break;
    }

    // ÉTAPE 5 : Ajouter durée totale
    result.durationMs = Date.now() - startTime;

    // ÉTAPE 6 : Logger (pour feedback loop)
    await logQuery(input, result);

    return result;
  } catch (error: any) {
    console.error('[EnhancedRouter] Erreur:', error);

    return {
      answer: `Désolé, une erreur est survenue : ${error.message}`,
      plan: 'Erreur',
      tool: 'clarification',
      sources: [],
      durationMs: Date.now() - startTime,
      metadata: { error: error.message },
    };
  }
}

/**
 * Choisit l'outil selon les signaux
 */
function chooseToolFromSignals(input: EnhancedInput): 'sql' | 'ocr' | 'kb' | 'code' | 'fallback' {
  const { signals, normalized } = input;
  const q = normalized.cleaned.toLowerCase();

  // Priorité 1 : SQL si demande de chiffre/liste
  if (signals.hasNumericQuery || signals.hasListQuery) {
    // Mais pas si c'est explicitement une question de document
    if (!signals.hasDocumentReference || q.includes('combien de documents')) {
      return 'sql';
    }
  }

  // Priorité 2 : OCR/Docs si mention explicite
  if (signals.hasDocumentReference && !signals.hasNumericQuery) {
    if (q.includes('reçu') || q.includes('résumé') || q.includes('contenu')) {
      return 'ocr';
    }
  }

  // Priorité 3 : KB pour guides/how-to
  if (q.includes('comment') || q.includes('guide') || q.includes('explication')) {
    return 'kb';
  }

  // Priorité 4 : Code pour questions UI
  if (q.includes('fichier') || q.includes('composant') || q.includes('code')) {
    // Mais pas "fichier document"
    if (!q.includes('document') && !q.includes('pdf')) {
      return 'code';
    }
  }

  // Par défaut : fallback chain
  return 'fallback';
}

/**
 * Génère SQL avancé avec toutes les heuristiques
 */
async function generateAdvancedSql(input: EnhancedInput): Promise<string> {
  const { normalized, uiContext, signals } = input;
  const q = normalized.cleaned.toLowerCase();

  let sql = '';
  
  // Scope helpers
  const propertyFilter = uiContext.scope.propertyId ? `"propertyId" = '${uiContext.scope.propertyId}'` : '';
  const leaseFilter = uiContext.scope.leaseId ? `"leaseId" = '${uiContext.scope.leaseId}'` : '';
  const tenantFilter = uiContext.scope.tenantId ? `"tenantId" = '${uiContext.scope.tenantId}'` : '';
  
  // Période helper (pour Transaction qui a 'date', pas pour Property qui a 'createdAt')
  let transactionPeriodWhere = '';
  if (normalized.timeRange) {
    const start = normalized.timeRange.start.toISOString().split('T')[0];
    const end = normalized.timeRange.end.toISOString().split('T')[0];
    transactionPeriodWhere = `"date" BETWEEN '${start}' AND '${end}'`;
  }

  // === PATTERNS SQL AVANCÉS ===

  // Baux actifs
  if (q.match(/baux? actifs?|nombre de baux/)) {
    const whereParts = [`status IN ('ACTIF', 'SIGNE', 'EN_COURS')`];
    if (propertyFilter) whereParts.push(propertyFilter);
    if (tenantFilter) whereParts.push(tenantFilter);
    sql = `SELECT COUNT(*) as count FROM "Lease" WHERE ${whereParts.join(' AND ')}`;
  }
  
  // Loyers encaissés (avec période)
  else if (q.match(/loyers? (encaiss|pay|reç)|encaiss.*mois/)) {
    if (normalized.timeRange) {
      const monthFilter = `mois = DATE_TRUNC('month', '${normalized.timeRange.start.toISOString()}'::timestamp)`;
      sql = `SELECT SUM(loyer_encaisse) as total_encaisse, SUM(loyer_total) as total_du FROM v_loyers_encaissements_mensuels WHERE ${monthFilter}`;
    } else {
      sql = `SELECT SUM(loyer_encaisse) as total_encaisse FROM v_loyers_encaissements_mensuels WHERE mois = DATE_TRUNC('month', CURRENT_DATE)`;
    }
  }
  
  // Loyers impayés / en retard (NOUVELLE LOGIQUE avec accounting_month)
  else if (q.match(/retard|impay|en retard/)) {
    const whereParts = [];
    // Note: v_loyers_en_retard n'a pas de propertyId direct, il a property_name
    // On n'applique pas le scope ici car la vue agrège déjà
    sql = `SELECT property_name, tenant_name, tenant_email, accounting_month, loyer_du, retard_jours, priorite FROM v_loyers_en_retard ORDER BY retard_jours DESC`;
  }
  
  // Total cautions
  else if (q.match(/total.*caution|montant.*caution|cautions?/)) {
    const whereParts = [`status IN ('ACTIF', 'SIGNE', 'EN_COURS')`, `"deposit" IS NOT NULL`];
    if (propertyFilter) whereParts.push(propertyFilter);
    sql = `SELECT SUM("deposit") as total_cautions, COUNT(*) as nb_baux FROM "Lease" WHERE ${whereParts.join(' AND ')}`;
  }
  
  // Échéances
  else if (q.match(/échéances?|echeances?/)) {
    sql = `SELECT type, property_name, due_date, montant_actuel, description FROM v_echeances_3_mois ORDER BY due_date`;
  }
  
  // Indexations
  else if (q.match(/indexations?|irl|ilat|icc/)) {
    sql = `SELECT property_name, due_date, montant_actuel, meta_code, description FROM v_echeances_3_mois WHERE type = 'INDEXATION_BAIL' ORDER BY due_date`;
  }
  
  // Prêts - détail
  else if (q.match(/prêts?|emprunts?|capital restant|crd|mensualit/)) {
    if (q.includes('total') || q.includes('capital restant')) {
      sql = `SELECT SUM(capital_restant_du) as total_crd, SUM(mensualite) as total_mensualites, COUNT(*) as nb_prets FROM v_prets_statut WHERE actif = true`;
    } else {
      sql = `SELECT property_name, label, capital_restant_du, mensualite, date_fin, mois_restants FROM v_prets_statut WHERE actif = true ORDER BY capital_restant_du DESC`;
    }
  }
  
  // Cashflow
  else if (q.match(/cashflow|cash.?flow|entrées.*sorties|solde/)) {
    const monthFilter = normalized.timeRange
      ? `mois = DATE_TRUNC('month', '${normalized.timeRange.start.toISOString()}'::timestamp)`
      : `mois >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '3 months')`;
    
    sql = `SELECT mois, SUM(entrees) as entrees, SUM(sorties) as sorties, SUM(solde_net) as solde FROM v_cashflow_global WHERE ${monthFilter} GROUP BY mois ORDER BY mois DESC`;
  }
  
  // Liste locataires
  else if (q.match(/locataires?.*sans bail|sans bail actif/)) {
    sql = `SELECT t."firstName", t."lastName", t.email, t.status FROM "Tenant" t WHERE t.id NOT IN (SELECT DISTINCT "tenantId" FROM "Lease" WHERE status IN ('ACTIF', 'SIGNE', 'EN_COURS'))`;
  }
  
  // Locataire d'un bien spécifique
  else if (q.match(/qui.*locataire|locataire.*courant|locataire.*actuel/) && uiContext.scope.propertyId) {
    sql = `SELECT t."firstName" || ' ' || t."lastName" as nom, t.email, l."rentAmount" FROM "Lease" l INNER JOIN "Tenant" t ON t.id = l."tenantId" WHERE l."propertyId" = '${uiContext.scope.propertyId}' AND l.status IN ('ACTIF', 'SIGNE', 'EN_COURS') LIMIT 1`;
  }
  
  // Documents à classer
  else if (q.match(/documents?.*classer|à classer|non classés?/)) {
    sql = `SELECT COUNT(*) as nb FROM "Document" WHERE status = 'pending' AND "deletedAt" IS NULL`;
  }
  
  // Derniers documents
  else if (q.match(/derniers? documents?|documents? récents?/)) {
    const whereParts = [`"deletedAt" IS NULL`];
    if (propertyFilter) whereParts.push(propertyFilter);
    sql = `SELECT id, "fileName", "uploadedAt", status, "documentTypeId" FROM "Document" WHERE ${whereParts.join(' AND ')} ORDER BY "uploadedAt" DESC LIMIT 20`;
  }
  
  // Lecture d'un document spécifique (compte rendu, rapport, etc.)
  else if (q.match(/compte.?rendu|rapport|contenu.*document|dernier.*document.*dit|qu'il y a dans.*document/)) {
    // Chercher le dernier document de type rapport/compte rendu
    sql = `SELECT id, "fileName", "extractedText", "uploadedAt", "documentTypeId" 
           FROM "Document" 
           WHERE ("fileName" ILIKE '%compte%rendu%' 
              OR "fileName" ILIKE '%rapport%'
              OR "fileName" ILIKE '%gestion%')
             AND "deletedAt" IS NULL
           ORDER BY "uploadedAt" DESC 
           LIMIT 1`;
  }
  
  // Document d'une transaction spécifique
  else if (q.match(/document.*transaction|transaction.*document/)) {
    const whereParts = [`"deletedAt" IS NULL`, `"transactionId" IS NOT NULL`];
    if (leaseFilter) whereParts.push(leaseFilter);
    sql = `SELECT id, "fileName", "extractedText", "transactionId", "uploadedAt" 
           FROM "Document" 
           WHERE ${whereParts.join(' AND ')}
           ORDER BY "uploadedAt" DESC 
           LIMIT 5`;
  }
  
  // Transactions détaillées
  else if (q.match(/liste.*transactions?|détail.*transactions?|transactions? ce mois/)) {
    const whereParts = [];
    if (propertyFilter) whereParts.push(propertyFilter);
    if (leaseFilter) whereParts.push(leaseFilter);
    if (normalized.timeRange) {
      whereParts.push(transactionPeriodWhere);
    } else {
      // Mois courant par défaut
      whereParts.push(`EXTRACT(YEAR FROM "date") = EXTRACT(YEAR FROM CURRENT_DATE) AND EXTRACT(MONTH FROM "date") = EXTRACT(MONTH FROM CURRENT_DATE)`);
    }
    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';
    sql = `SELECT "date", label, amount, nature, "paidAt" FROM "Transaction" ${whereClause} ORDER BY "date" DESC LIMIT 50`;
  }
  
  // Loyer attendu (bail actif)
  else if (q.match(/loyer attendu|loyer prévu|loyer actuel|montant.*loyer/)) {
    if (uiContext.scope.propertyId) {
      sql = `SELECT l."rentAmount" as loyer, l."charges" as charges, l."deposit" as depot, t."firstName" || ' ' || t."lastName" as locataire FROM "Lease" l INNER JOIN "Tenant" t ON t.id = l."tenantId" WHERE l."propertyId" = '${uiContext.scope.propertyId}' AND l.status IN ('ACTIF', 'SIGNE', 'EN_COURS') ORDER BY l."startDate" DESC LIMIT 1`;
    } else if (uiContext.scope.leaseId) {
      sql = `SELECT "rentAmount" as loyer, "charges" as charges, "deposit" as depot FROM "Lease" WHERE id = '${uiContext.scope.leaseId}'`;
    } else {
      sql = `SELECT AVG("rentAmount") as loyer_moyen, SUM("rentAmount") as total_loyers FROM "Lease" WHERE status IN ('ACTIF', 'SIGNE', 'EN_COURS')`;
    }
  }
  
  // Tendance générale (transactions)
  else if (q.match(/tendance|évolution.*sur.*mois/)) {
    // Extraire le nombre de mois si présent
    const monthsMatch = q.match(/(\d+)\s*mois/);
    const months = monthsMatch ? parseInt(monthsMatch[1]) : 12;
    
    sql = `SELECT 
      TO_CHAR("date", 'YYYY-MM') as mois,
      SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as entrees,
      SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as sorties
    FROM "Transaction"
    WHERE "date" >= CURRENT_DATE - INTERVAL '${months} months'
    GROUP BY TO_CHAR("date", 'YYYY-MM')
    ORDER BY mois DESC`;
  }
  
  // Comparaison années
  else if (q.match(/entre \d{4} et \d{4}|compar.*\d{4}/)) {
    const years = q.match(/\d{4}/g);
    if (years && years.length === 2) {
      sql = `SELECT 
        EXTRACT(YEAR FROM "date") as annee,
        SUM(CASE WHEN nature = 'RECETTE_LOYER' OR nature = 'LOYER' THEN amount ELSE 0 END) as loyers,
        COUNT(*) as nb_transactions
      FROM "Transaction"
      WHERE EXTRACT(YEAR FROM "date") IN (${years[0]}, ${years[1]})
      GROUP BY EXTRACT(YEAR FROM "date")
      ORDER BY annee`;
    } else {
      sql = `SELECT COUNT(*) as count FROM "Property" WHERE "isArchived" = false`;
    }
  }
  
  // Nombre de biens
  else if (q.match(/combien.*biens?|nombre.*biens?|total.*biens?/)) {
    const whereParts = [`"isArchived" = false`];
    sql = `SELECT COUNT(*) as count FROM "Property" WHERE ${whereParts.join(' AND ')}`;
  }
  
  // Liste des biens
  else if (q.match(/liste.*biens?|quels? biens?/)) {
    sql = `SELECT id, name, address, city, type, status FROM "Property" WHERE "isArchived" = false ORDER BY name LIMIT 50`;
  }
  
  // Total locataires
  else if (q.match(/combien.*locataires?|nombre.*locataires?/)) {
    sql = `SELECT COUNT(*) as count FROM "Tenant" WHERE status = 'ACTIVE'`;
  }
  
  // Liste des locataires
  else if (q.match(/liste.*locataires?|quels? locataires?/)) {
    sql = `SELECT t."firstName", t."lastName", t.email, COUNT(l.id) as nb_baux FROM "Tenant" t LEFT JOIN "Lease" l ON l."tenantId" = t.id AND l.status IN ('ACTIF', 'SIGNE', 'EN_COURS') WHERE t.status = 'ACTIVE' GROUP BY t.id, t."firstName", t."lastName", t.email ORDER BY t."lastName" LIMIT 50`;
  }
  
  // Par défaut : compter les biens
  else {
    // Pour Property, utiliser "id" pas "propertyId"
    const whereParts = [`"isArchived" = false`];
    if (uiContext.scope.propertyId) {
      whereParts.push(`id = '${uiContext.scope.propertyId}'`);
    }
    sql = `SELECT COUNT(*) as count FROM "Property" WHERE ${whereParts.join(' AND ')}`;
  }

  // Ajouter LIMIT si absent
  if (!sql.includes('LIMIT') && !sql.includes('GROUP BY')) {
    sql += ' LIMIT 100';
  }

  return sql;
}

/**
 * Exécute une requête SQL avec contexte
 */
async function executeSqlWithContext(input: EnhancedInput): Promise<EnhancedRouterOutput> {
  const { normalized, uiContext, signals, resolvedEntities } = input;

  const plan = `Je vais interroger la base de données pour répondre à cette question.`;

  // Générer SQL avancé
  const sql = await generateAdvancedSql(input);

  console.log(`[EnhancedRouter:SQL] SQL généré: ${sql.substring(0, 200)}...`);

  // Exécuter
  const sqlResult = await executeSafeSql(sql);

  if (!sqlResult.ok) {
    console.error(`[EnhancedRouter:SQL] Erreur SQL:`, sqlResult.error);
    
    // Fallback vers KB
    return await executeKbSearch(input);
  }

  // Masquer PII si scope global
  let data = sqlResult.data || [];
  const shouldMask = !uiContext.scope.propertyId && !uiContext.scope.leaseId;
  
  if (shouldMask && data.length > 0) {
    data = maskPii(data);
  }

  // Créer template structuré
  const template = signals.hasNumericQuery && data.length === 1
    ? createKpiAnswer(input.original, data, sql)
    : createListAnswer(input.original, data, sql);

  // Générer réponse textuelle
  const answer = await generateSqlAnswer(input.original, data, sql, template);

  return {
    answer,
    plan,
    tool: 'sql',
    sql,
    rowCount: data.length,
    template,
    sources: [
      {
        type: 'sql',
        content: sql,
        snippet: `${data.length} résultat(s)`,
        metadata: { durationMs: sqlResult.durationMs },
      },
    ],
    durationMs: 0,
  };
}

/**
 * Recherche OCR/Documents
 */
async function executeOcrSearch(input: EnhancedInput): Promise<EnhancedRouterOutput> {
  console.log('[EnhancedRouter:OCR] Recherche de documents');

  const plan = `Je vais chercher dans les documents.`;

  // Construire filtres
  const where: any = {
    deletedAt: null,
  };

  // Appliquer scope
  if (input.uiContext.scope.propertyId) {
    where.propertyId = input.uiContext.scope.propertyId;
  }

  // Détecter type de document
  if (input.normalized.cleaned.match(/relevé.*propriétaire|releve.*proprio/)) {
    const type = await prisma.documentType.findFirst({
      where: { code: { contains: 'releve', mode: 'insensitive' } },
    });
    if (type) where.documentTypeId = type.id;
  }

  // Période
  if (input.normalized.timeRange) {
    where.uploadedAt = {
      gte: input.normalized.timeRange.start,
      lte: input.normalized.timeRange.end,
    };
  }

  const documents = await prisma.document.findMany({
    where,
    include: {
      DocumentType: true,
      Property: { select: { name: true } },
    },
    take: 10,
  });

  if (documents.length === 0) {
    return {
      answer: `Je n'ai trouvé aucun document correspondant à "${input.original}".`,
      plan,
      tool: 'ocr',
      sources: [],
      durationMs: 0,
    };
  }

  // Générer la réponse
  const docList = documents.map((d, i) => 
    `${i + 1}. ${d.fileName} (${d.DocumentType?.label || 'Type inconnu'}) - ${d.Property?.name || 'Global'} - ${d.uploadedAt.toLocaleDateString('fr-FR')}`
  ).join('\n');

  const answer = input.signals.isBinaryQuery
    ? `Oui, ${documents.length} document(s) trouvé(s) :\n\n${docList}`
    : `${documents.length} document(s) trouvé(s) :\n\n${docList}`;

  return {
    answer,
    plan,
    tool: 'ocr',
    rowCount: documents.length,
    sources: documents.map(d => ({
      type: 'doc',
      content: d.fileName,
      metadata: { id: d.id, type: d.DocumentType?.label },
    })),
    durationMs: 0,
  };
}

/**
 * Recherche dans la KB
 */
async function executeKbSearch(input: EnhancedInput): Promise<EnhancedRouterOutput> {
  console.log('[EnhancedRouter:KB] Recherche dans la base de connaissances');

  const plan = `Je vais chercher dans la documentation.`;

  // Recherche sémantique
  const chunks = await retrieveContext(input.normalized.cleaned, 5, ['howto', 'guide']);

  if (chunks.length === 0) {
    return {
      answer: `Je n'ai pas trouvé de guide pour "${input.original}". Voulez-vous que je cherche dans les données ?`,
      plan,
      tool: 'kb',
      sources: [],
      needsClarification: true,
      clarificationOptions: [
        'Chercher dans les données (baux, loyers, etc.)',
        'Chercher dans les documents',
      ],
      durationMs: 0,
    };
  }

  // Générer réponse
  const kbContext = chunks.map((c, i) => `[${i + 1}] ${c.text}`).join('\n\n');
  const answer = await generateKbAnswer(input.original, kbContext);

  return {
    answer,
    plan,
    tool: 'kb',
    sources: chunks.map(c => ({
      type: 'kb',
      content: c.source || 'knowledge-base',
      snippet: c.text.substring(0, 150),
      metadata: { score: c.score },
    })),
    durationMs: 0,
  };
}

/**
 * Recherche dans le code
 */
async function executeCodeSearch(input: EnhancedInput): Promise<EnhancedRouterOutput> {
  console.log('[EnhancedRouter:CODE] Recherche dans le code');

  const plan = `Je vais chercher dans le code source.`;

  const chunks = await retrieveContext(input.normalized.cleaned, 5, ['code']);

  if (chunks.length === 0) {
    return {
      answer: `Je n'ai pas trouvé de code correspondant.`,
      plan,
      tool: 'code',
      sources: [],
      durationMs: 0,
    };
  }

  const codeContext = chunks.map((c, i) => `[${i + 1}] ${c.source}\n${c.text.substring(0, 300)}`).join('\n\n');
  const answer = await generateCodeAnswer(input.original, codeContext);

  return {
    answer,
    plan,
    tool: 'code',
    sources: chunks.map(c => ({
      type: 'code',
      content: c.source || 'code',
      metadata: { score: c.score },
    })),
    durationMs: 0,
  };
}

/**
 * Fallback chain : SQL → OCR → KB
 */
async function executeFallbackChain(input: EnhancedInput): Promise<EnhancedRouterOutput> {
  console.log('[EnhancedRouter:FALLBACK] Tentative SQL...');

  // 1. Essayer SQL
  try {
    const sqlResult = await executeSqlWithContext(input);
    if (sqlResult.rowCount && sqlResult.rowCount > 0) {
      return sqlResult;
    }
  } catch (e) {
    console.log('[EnhancedRouter:FALLBACK] SQL échoué, tentative OCR...');
  }

  // 2. Essayer OCR
  try {
    const ocrResult = await executeOcrSearch(input);
    if (ocrResult.rowCount && ocrResult.rowCount > 0) {
      return ocrResult;
    }
  } catch (e) {
    console.log('[EnhancedRouter:FALLBACK] OCR échoué, tentative KB...');
  }

  // 3. Essayer KB
  return await executeKbSearch(input);
}

/**
 * Génère une réponse depuis résultats SQL
 */
async function generateSqlAnswer(question: string, data: any[], sql: string, template: any): Promise<string> {
  if (data.length === 0) {
    return "Aucun résultat trouvé.";
  }

  // NOUVEAU : Détecter si on a un document avec extractedText
  const hasExtractedText = data.length > 0 && data[0].extractedText;
  
  if (hasExtractedText) {
    const doc = data[0];
    const extractedText = doc.extractedText || '';
    
    // Limiter le texte pour éviter les prompts trop longs
    const textPreview = extractedText.substring(0, 2000);
    
    const prompt = `Question: "${question}"

Document trouvé: ${doc.fileName || 'Document'}
Date: ${doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString('fr-FR') : 'Non spécifiée'}

Contenu du document (extrait):
${textPreview}

Instructions:
1. Résume le contenu principal de ce document en 3-5 points
2. Réponds directement à la question posée
3. Cite des chiffres spécifiques si présents
4. Format: **[Nom du document]** suivi du résumé avec des • pour les points clés
5. Reste factuel et précis

Réponds en français, ton professionnel.`;

    const answer = await generateCompletion(prompt, { maxTokens: 800, temperature: 0.5 });
    return answer;
  }

  // Utiliser le template si disponible
  if (template) {
    const templateText = templateToText(template);
    
    // Enrichir avec contexte si besoin
    const prompt = `Question: "${question}"

${templateText}

Reformule cette réponse de manière naturelle et professionnelle en français.`;

    const enriched = await generateCompletion(prompt, { maxTokens: 600, temperature: 0.7 });
    return enriched;
  }

  // Sinon, formater basique
  return formatSqlResults(data, 20);
}

/**
 * Génère une réponse depuis la KB
 */
async function generateKbAnswer(question: string, kbContext: string): Promise<string> {
  const prompt = `Question: "${question}"

Documentation:
${kbContext}

Réponds de manière claire, étape par étape, en te basant sur la documentation.`;

  const answer = await generateCompletion(prompt, { maxTokens: 1000 });
  return answer;
}

/**
 * Génère une réponse depuis le code
 */
async function generateCodeAnswer(question: string, codeContext: string): Promise<string> {
  const prompt = `Question: "${question}"

Code pertinent:
${codeContext}

Explique où se trouve ce code et comment il fonctionne.`;

  const answer = await generateCompletion(prompt, { maxTokens: 800 });
  return answer;
}

/**
 * Log la requête pour feedback loop
 */
async function logQuery(input: EnhancedInput, result: EnhancedRouterOutput): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO ai_query_log (question, intent, tool_used, sql_executed, ok, row_count, duration_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      input.original,
      JSON.stringify(input.signals),
      result.tool,
      result.sql || null,
      !result.metadata?.error,
      result.rowCount || null,
      result.durationMs
    );
  } catch (error: any) {
    console.error('[LogQuery] Erreur:', error.message);
  }
}

