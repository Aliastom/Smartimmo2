/**
 * Agent ReAct - Boucle Think → Plan → Use Tool → Observe → Synthesize
 * Implémente un agent autonome capable de raisonner et d'utiliser des outils
 */

import { generateCompletion } from '../clients/mistral';
import { toolRegistry, executeTool, type ToolContext, type Citation } from '../tools';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

// Configuration de l'agent
const MAX_ITERATIONS = 5; // Maximum d'itérations de la boucle ReAct
const MAX_TOKENS = 2000; // Maximum de tokens par génération

// Interface pour le scratchpad (mémoire de travail)
interface ReActStep {
  type: 'thought' | 'plan' | 'tool' | 'observation' | 'answer';
  content: string;
  toolCall?: {
    toolId: string;
    args: any;
  };
  toolResult?: any;
  timestamp: Date;
}

// Interface pour le résultat de l'agent
export interface AgentResult {
  answer: string;
  steps: ReActStep[];
  citations: Citation[];
  tokensUsed: number;
  durationMs: number;
  metadata?: Record<string, any>;
}

// Interface pour la configuration de l'agent
export interface AgentConfig {
  sessionId?: string;
  correlationId?: string;
  context?: ToolContext;
  maxIterations?: number;
  stream?: boolean;
}

/**
 * Exécute l'agent ReAct pour répondre à une question
 * @param question La question de l'utilisateur
 * @param config Configuration de l'agent
 * @returns La réponse avec les étapes de raisonnement
 */
export async function runReActAgent(
  question: string,
  config: AgentConfig = {}
): Promise<AgentResult> {
  const startTime = Date.now();
  const correlationId = config.correlationId || randomUUID();
  const sessionId = config.sessionId || randomUUID();

  console.log(`[Agent:${correlationId}] Démarrage pour: "${question.substring(0, 100)}..."`);

  // Scratchpad (mémoire de travail)
  const steps: ReActStep[] = [];
  const citations: Citation[] = [];
  let tokensUsed = 0;

  // Contexte de l'agent
  const context: ToolContext = {
    ...config.context,
    sessionId,
    correlationId,
  };

  try {
    // Boucle ReAct
    let iteration = 0;
    let isDone = false;
    let finalAnswer = '';

    while (!isDone && iteration < (config.maxIterations || MAX_ITERATIONS)) {
      iteration++;
      console.log(`[Agent:${correlationId}] Itération ${iteration}/${config.maxIterations || MAX_ITERATIONS}`);

      // ====================================
      // ÉTAPE 1: THINK (Réflexion)
      // ====================================
      const thinkPrompt = buildThinkPrompt(question, steps, context);
      const thought = await generateCompletion(thinkPrompt, { maxTokens: 500 });
      tokensUsed += 500; // Approximation

      steps.push({
        type: 'thought',
        content: thought,
        timestamp: new Date(),
      });

      console.log(`[Agent:${correlationId}] Pensée: ${thought.substring(0, 100)}...`);

      // ====================================
      // ÉTAPE 2: PLAN (Planification)
      // ====================================
      // Déterminer si on a besoin d'un outil ou si on peut répondre directement
      const needsTool = await decidesIfNeedsTool(thought, question, steps);

      if (!needsTool) {
        // On peut répondre directement
        console.log(`[Agent:${correlationId}] Pas besoin d'outil, réponse directe`);

        const answerPrompt = buildAnswerPrompt(question, steps, context);
        finalAnswer = await generateCompletion(answerPrompt, { maxTokens: MAX_TOKENS });
        tokensUsed += MAX_TOKENS;

        steps.push({
          type: 'answer',
          content: finalAnswer,
          timestamp: new Date(),
        });

        isDone = true;
        break;
      }

      // ====================================
      // ÉTAPE 3: TOOL SELECTION (Sélection d'outil)
      // ====================================
      console.log(`[Agent:${correlationId}] Sélection d'outil...`);

      // Sélectionner les outils pertinents
      const selectedTools = await toolRegistry.selectTools(question, 3);

      if (selectedTools.length === 0) {
        // Aucun outil pertinent, répondre directement
        console.log(`[Agent:${correlationId}] Aucun outil pertinent`);

        const answerPrompt = buildAnswerPrompt(question, steps, context);
        finalAnswer = await generateCompletion(answerPrompt, { maxTokens: MAX_TOKENS });
        tokensUsed += MAX_TOKENS;

        steps.push({
          type: 'answer',
          content: finalAnswer,
          timestamp: new Date(),
        });

        isDone = true;
        break;
      }

      // Choisir le meilleur outil et générer les arguments
      const toolChoice = selectedTools[0]; // Pour l'instant, on prend le premier
      console.log(`[Agent:${correlationId}] Outil choisi: ${toolChoice.id}`);

      const toolArgs = await generateToolArgs(toolChoice, question, steps);

      steps.push({
        type: 'plan',
        content: `Utiliser l'outil "${toolChoice.id}" avec les arguments: ${JSON.stringify(toolArgs)}`,
        toolCall: {
          toolId: toolChoice.id,
          args: toolArgs,
        },
        timestamp: new Date(),
      });

      // ====================================
      // ÉTAPE 4: TOOL EXECUTION (Exécution d'outil)
      // ====================================
      console.log(`[Agent:${correlationId}] Exécution de l'outil ${toolChoice.id}...`);

      const toolResult = await executeTool(toolChoice.id, toolArgs, context);

      // Logger l'exécution de l'outil
      await logToolExecution(toolChoice.id, toolArgs, toolResult, correlationId);

      steps.push({
        type: 'tool',
        content: `Outil exécuté: ${toolChoice.id}`,
        toolCall: {
          toolId: toolChoice.id,
          args: toolArgs,
        },
        toolResult,
        timestamp: new Date(),
      });

      // ====================================
      // ÉTAPE 5: OBSERVE (Observation)
      // ====================================
      const observation = formatToolResult(toolResult);
      console.log(`[Agent:${correlationId}] Observation: ${observation.substring(0, 100)}...`);

      steps.push({
        type: 'observation',
        content: observation,
        timestamp: new Date(),
      });

      // Ajouter les citations si disponibles
      if (toolResult.citations) {
        citations.push(...toolResult.citations);
      }

      // Vérifier si on a assez d'informations pour répondre
      const hasEnoughInfo = await decidesIfHasEnoughInfo(observation, question, steps);

      if (hasEnoughInfo) {
        // ====================================
        // ÉTAPE 6: SYNTHESIZE (Synthèse)
        // ====================================
        console.log(`[Agent:${correlationId}] Synthèse de la réponse...`);

        const answerPrompt = buildAnswerPrompt(question, steps, context);
        finalAnswer = await generateCompletion(answerPrompt, { maxTokens: MAX_TOKENS });
        tokensUsed += MAX_TOKENS;

        steps.push({
          type: 'answer',
          content: finalAnswer,
          timestamp: new Date(),
        });

        isDone = true;
      }
    }

    // Si on a atteint le max d'itérations sans réponse
    if (!isDone) {
      console.warn(`[Agent:${correlationId}] Max itérations atteint sans réponse complète`);

      const answerPrompt = buildAnswerPrompt(question, steps, context);
      finalAnswer = await generateCompletion(answerPrompt, { maxTokens: MAX_TOKENS });
      tokensUsed += MAX_TOKENS;

      steps.push({
        type: 'answer',
        content: finalAnswer,
        timestamp: new Date(),
      });
    }

    const durationMs = Date.now() - startTime;

    console.log(`[Agent:${correlationId}] Terminé en ${durationMs}ms (${iteration} itérations, ${tokensUsed} tokens)`);

    // Sauvegarder dans la mémoire de session
    await saveToMemory(sessionId, question, finalAnswer, steps, tokensUsed, correlationId);

    return {
      answer: finalAnswer,
      steps,
      citations,
      tokensUsed,
      durationMs,
      metadata: {
        iterations: iteration,
        maxIterations: config.maxIterations || MAX_ITERATIONS,
      },
    };
  } catch (error: any) {
    console.error(`[Agent:${correlationId}] Erreur:`, error.message);

    // Réponse d'erreur
    const durationMs = Date.now() - startTime;

    return {
      answer: `Désolé, j'ai rencontré une erreur: ${error.message}. Pouvez-vous reformuler votre question ?`,
      steps,
      citations,
      tokensUsed,
      durationMs,
      metadata: {
        error: error.message,
      },
    };
  }
}

/**
 * Construit le prompt de réflexion (Think)
 */
function buildThinkPrompt(question: string, steps: ReActStep[], context?: ToolContext): string {
  const previousSteps = steps
    .filter((s) => s.type === 'thought' || s.type === 'observation')
    .map((s) => `- ${s.type}: ${s.content}`)
    .join('\n');

  // NOUVEAU : Ajouter l'historique de conversation s'il existe
  let conversationContext = '';
  if (context?.conversationHistory && Array.isArray(context.conversationHistory) && context.conversationHistory.length > 0) {
    const recentHistory = context.conversationHistory
      .slice(-5) // Garder les 5 derniers échanges
      .map((msg: any) => `${msg.role === 'user' ? 'Utilisateur' : 'Assistant'}: ${msg.content}`)
      .join('\n');
    
    conversationContext = `\nHistorique de conversation récent:\n${recentHistory}\n`;
  }

  return `Tu es un assistant IA pour Smartimmo, une application de gestion immobilière.
${conversationContext}
Question actuelle de l'utilisateur: "${question}"

${previousSteps ? `Étapes précédentes:\n${previousSteps}\n` : ''}

Réfléchis à comment répondre à cette question. Si c'est une question de suivi (comme "c'est quoi le nom ?", "et pour l'autre ?"), utilise le contexte de l'historique pour identifier à quoi l'utilisateur fait référence.
De quelles informations as-tu besoin ?
Réponds en 1-2 phrases concises.`;
}

/**
 * Construit le prompt de réponse finale (Answer)
 */
function buildAnswerPrompt(question: string, steps: ReActStep[], context?: ToolContext): string {
  const observations = steps
    .filter((s) => s.type === 'observation')
    .map((s) => s.content)
    .join('\n\n');

  // NOUVEAU : Ajouter l'historique de conversation s'il existe
  let conversationContext = '';
  if (context?.conversationHistory && Array.isArray(context.conversationHistory) && context.conversationHistory.length > 0) {
    const recentHistory = context.conversationHistory
      .slice(-5) // Garder les 5 derniers échanges
      .map((msg: any) => `${msg.role === 'user' ? 'Utilisateur' : 'Assistant'}: ${msg.content}`)
      .join('\n');
    
    conversationContext = `\nHistorique de conversation récent:\n${recentHistory}\n`;
  }

  return `Tu es un assistant IA pour Smartimmo.
${conversationContext}
Question actuelle: "${question}"

${observations ? `Informations collectées:\n${observations}\n` : ''}

Instructions:
- Réponds à la question de manière claire, précise et professionnelle en français
- Si c'est une question de suivi (comme "c'est quoi le nom du fichier ?"), utilise l'historique pour comprendre à quoi l'utilisateur fait référence
- Si les données incluent des chiffres, présente-les de manière structurée
- Reste factuel et précis`;
}

/**
 * Décide si l'agent a besoin d'utiliser un outil
 */
async function decidesIfNeedsTool(thought: string, question: string, steps: ReActStep[]): Promise<boolean> {
  // Heuristique simple: si la question contient des mots-clés de données, on a besoin d'un outil
  const dataKeywords = ['combien', 'total', 'liste', 'nombre', 'montant', 'loyer', 'bail', 'document', 'prêt'];
  const questionLower = question.toLowerCase();

  for (const keyword of dataKeywords) {
    if (questionLower.includes(keyword)) {
      return true;
    }
  }

  // Si on a déjà des observations, peut-être qu'on a assez d'infos
  const hasObservations = steps.some((s) => s.type === 'observation');
  if (hasObservations) {
    return false;
  }

  return true; // Par défaut, utiliser un outil
}

/**
 * Décide si l'agent a assez d'informations pour répondre
 */
async function decidesIfHasEnoughInfo(observation: string, question: string, steps: ReActStep[]): Promise<boolean> {
  // Heuristique: si l'observation contient des données (chiffres, résultats), on a assez d'infos
  if (observation.includes('résultat') || observation.includes('ligne') || /\d+/.test(observation)) {
    return true;
  }

  // Si on a déjà plusieurs observations, c'est probablement suffisant
  const observationCount = steps.filter((s) => s.type === 'observation').length;
  if (observationCount >= 2) {
    return true;
  }

  return false;
}

/**
 * Génère les arguments pour un outil donné
 */
async function generateToolArgs(tool: any, question: string, steps: ReActStep[]): Promise<any> {
  // Logique simplifiée pour générer les arguments
  // TODO: utiliser un LLM pour générer les arguments de manière plus intelligente

  if (tool.id === 'sql.query') {
    // Générer une requête SQL basée sur la question
    return {
      sql: await generateSqlQuery(question),
      maskPii: true,
    };
  }

  if (tool.id === 'kb.search') {
    return {
      query: question,
      topK: 5,
    };
  }

  if (tool.id === 'time.now') {
    return {};
  }

  // Par défaut, retourner un objet vide
  return {};
}

/**
 * Génère une requête SQL basée sur la question (heuristique simple)
 * Utilise les nouvelles vues analytiques (Pack V1)
 */
async function generateSqlQuery(question: string): Promise<string> {
  const questionLower = question.toLowerCase();

  // Baux actifs
  if (questionLower.includes('baux actifs') || questionLower.includes('nombre de baux')) {
    return `SELECT COUNT(*) as count FROM "Lease" WHERE status IN ('ACTIF', 'EN_COURS', 'SIGNE') LIMIT 1`;
  }

  // Loyers encaissés ce mois
  if (questionLower.includes('loyers encaissés') || questionLower.includes('loyers ce mois') || questionLower.includes('encaissé ce mois')) {
    return `SELECT SUM(loyer_encaisse) as total_encaisse, SUM(loyer_total) as total_du FROM v_loyers_encaissements_mensuels WHERE mois = DATE_TRUNC('month', CURRENT_DATE) LIMIT 1`;
  }

  // Loyers mois dernier
  if (questionLower.includes('mois dernier') || questionLower.includes('mois précédent')) {
    return `SELECT mois, SUM(loyer_encaisse) as total_encaisse, SUM(loyer_total) as total_du FROM v_loyers_encaissements_mensuels WHERE mois = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') GROUP BY mois LIMIT 1`;
  }

  // Loyers impayés / retard (NOUVELLE LOGIQUE - accounting_month)
  if (questionLower.includes('impayés') || questionLower.includes('retard') || questionLower.includes('en retard')) {
    return `SELECT property_name, tenant_name, tenant_email, accounting_month, loyer_du, retard_jours, priorite FROM v_loyers_en_retard ORDER BY retard_jours DESC LIMIT 20`;
  }

  // Liste locataires en retard
  if (questionLower.includes('qui') && (questionLower.includes('retard') || questionLower.includes('impayé'))) {
    return `SELECT tenant_name, property_name, accounting_month, loyer_du, retard_jours FROM v_loyers_en_retard ORDER BY retard_jours DESC LIMIT 10`;
  }

  // Échéances prochaines
  if (questionLower.includes('échéances') || questionLower.includes('echeances') || questionLower.includes('à venir')) {
    return `SELECT type, property_name, due_date, montant_actuel, description FROM v_echeances_3_mois ORDER BY due_date LIMIT 20`;
  }

  // Indexations
  if (questionLower.includes('indexation') || questionLower.includes('irl') || questionLower.includes('ilat')) {
    return `SELECT property_name, due_date, montant_actuel, description FROM v_echeances_3_mois WHERE type = 'INDEXATION_BAIL' ORDER BY due_date LIMIT 10`;
  }

  // Prêts - capital restant
  if (questionLower.includes('capital restant') || questionLower.includes('reste à rembourser')) {
    return `SELECT SUM(capital_restant_du) as total_crd, SUM(mensualite) as total_mensualites FROM v_prets_statut WHERE actif = true LIMIT 1`;
  }

  // Prêts - détail
  if (questionLower.includes('prêt') || questionLower.includes('emprunt')) {
    return `SELECT property_name, label, capital_restant_du, mensualite, mois_restants FROM v_prets_statut WHERE actif = true ORDER BY capital_restant_du DESC LIMIT 10`;
  }

  // Cashflow
  if (questionLower.includes('cashflow') || questionLower.includes('cash flow') || (questionLower.includes('entrées') && questionLower.includes('sorties'))) {
    return `SELECT mois, SUM(entrees) as total_entrees, SUM(sorties) as total_sorties, SUM(solde_net) as solde FROM v_cashflow_global WHERE mois >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '3 months') GROUP BY mois ORDER BY mois DESC LIMIT 6`;
  }

  // Documents manquants
  if (questionLower.includes('documents') && (questionLower.includes('manquant') || questionLower.includes('reçu'))) {
    return `SELECT type_label, periode, COUNT(*) as nb FROM v_documents_statut WHERE periode >= TO_CHAR(CURRENT_DATE - INTERVAL '3 months', 'YYYY-MM') GROUP BY type_label, periode ORDER BY periode DESC LIMIT 20`;
  }

  // Par défaut, compter les biens
  return `SELECT COUNT(*) as count FROM "Property" WHERE "isArchived" = false LIMIT 1`;
}

/**
 * Formate le résultat d'un outil pour l'observation
 */
function formatToolResult(toolResult: any): string {
  if (!toolResult.ok) {
    return `Erreur: ${toolResult.error || 'Erreur inconnue'}`;
  }

  if (toolResult.data && toolResult.data.formatted) {
    return toolResult.data.formatted;
  }

  if (toolResult.data && toolResult.data.results) {
    const results = toolResult.data.results;
    if (Array.isArray(results) && results.length > 0) {
      return `Trouvé ${results.length} résultat(s):\n${JSON.stringify(results.slice(0, 3), null, 2)}`;
    }
  }

  return JSON.stringify(toolResult.data, null, 2);
}

/**
 * Sauvegarde la conversation dans la mémoire de session
 */
async function saveToMemory(
  sessionId: string,
  question: string,
  answer: string,
  steps: ReActStep[],
  tokensUsed: number,
  correlationId: string
): Promise<void> {
  try {
    // Créer ou récupérer la session
    let session = await prisma.aiChatSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      session = await prisma.aiChatSession.create({
        data: {
          id: sessionId,
          userId: 'default', // TODO: récupérer le vrai userId
        },
      });
    } else {
      // Mettre à jour lastActivity
      await prisma.aiChatSession.update({
        where: { id: sessionId },
        data: { lastActivity: new Date() },
      });
    }

    // Sauvegarder le message utilisateur
    await prisma.aiMessage.create({
      data: {
        sessionId,
        role: 'user',
        content: question,
        correlationId,
      },
    });

    // Sauvegarder la réponse de l'assistant
    await prisma.aiMessage.create({
      data: {
        sessionId,
        role: 'assistant',
        content: answer,
        toolCallsJson: JSON.stringify(
          steps.filter((s) => s.type === 'tool').map((s) => s.toolCall)
        ),
        tokensUsed,
        correlationId,
      },
    });

    console.log(`[Memory:${correlationId}] Conversation sauvegardée dans la session ${sessionId}`);
  } catch (error: any) {
    console.error(`[Memory:${correlationId}] Erreur lors de la sauvegarde:`, error.message);
  }
}

/**
 * Logger l'exécution d'un outil pour l'observabilité
 */
async function logToolExecution(
  toolId: string,
  args: any,
  result: any,
  correlationId: string
): Promise<void> {
  try {
    await prisma.aiToolLog.create({
      data: {
        toolName: toolId,
        argsJson: JSON.stringify(args),
        resultJson: result.ok ? JSON.stringify(result.data) : undefined,
        ok: result.ok,
        errorMessage: result.error,
        correlationId,
      },
    });
  } catch (error: any) {
    console.error(`[ToolLog:${correlationId}] Erreur lors du logging:`, error.message);
  }
}

