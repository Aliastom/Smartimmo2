/**
 * Dispatcher d'agent IA
 * Bascule entre le mode Legacy (RAG simple) et ReAct selon la configuration
 */

import { aiConfig } from '../config';
import { runReActAgent, type AgentConfig, type AgentResult } from './react';
import { retrieveContext } from '../rag/retrieve';
import { generateCompletion } from '../clients/mistral';

/**
 * Interface unifiée pour les résultats (compatible legacy et react)
 */
export interface UnifiedAgentResult {
  answer: string;
  citations?: Array<{
    type: 'sql' | 'document' | 'kb' | 'view';
    source: string;
    snippet?: string;
    confidence?: number;
  }>;
  steps?: any[];
  metadata?: {
    mode: 'legacy' | 'react';
    tokensUsed?: number;
    durationMs: number;
    [key: string]: any;
  };
}

/**
 * Point d'entrée unifié pour interroger l'agent IA
 * Dispatche vers le bon système selon AI_MODE
 */
export async function queryAgent(
  question: string,
  config?: AgentConfig
): Promise<UnifiedAgentResult> {
  const startTime = Date.now();

  console.log(`[Dispatcher] Mode: ${aiConfig.mode}, Question: "${question.substring(0, 100)}..."`);

  try {
    if (aiConfig.isReActMode()) {
      // Mode ReAct : Utiliser l'agent complet avec outils
      const result = await runReActAgent(question, config);

      return {
        answer: result.answer,
        citations: result.citations,
        steps: result.steps,
        metadata: {
          mode: 'react',
          tokensUsed: result.tokensUsed,
          durationMs: result.durationMs,
          iterations: result.metadata?.iterations,
        },
      };
    } else {
      // Mode Legacy : RAG simple sans outils
      const result = await runLegacyRag(question);

      return {
        answer: result.answer,
        citations: result.citations,
        metadata: {
          mode: 'legacy',
          durationMs: Date.now() - startTime,
        },
      };
    }
  } catch (error: any) {
    console.error('[Dispatcher] Erreur:', error);

    return {
      answer: `Désolé, une erreur est survenue: ${error.message}`,
      metadata: {
        mode: aiConfig.mode,
        durationMs: Date.now() - startTime,
        error: error.message,
      },
    };
  }
}

/**
 * Mode Legacy : RAG simple (ancien système)
 * Recherche sémantique + génération de réponse simple
 */
async function runLegacyRag(question: string): Promise<UnifiedAgentResult> {
  console.log('[Legacy] Recherche sémantique...');

  // 1. Rechercher dans Qdrant
  const chunks = await retrieveContext(question, 5);

  if (chunks.length === 0) {
    return {
      answer: "Je n'ai pas trouvé d'information pertinente dans la base de connaissances.",
      citations: [],
    };
  }

  // 2. Construire le contexte
  const context = chunks
    .map((chunk, i) => `[${i + 1}] ${chunk.text}`)
    .join('\n\n');

  // 3. Générer la réponse avec Ollama
  const prompt = `Tu es un assistant IA pour Smartimmo, une application de gestion immobilière.

Contexte pertinent de la base de connaissances:
${context}

Question de l'utilisateur: ${question}

Réponds de manière claire et concise en français, en te basant uniquement sur le contexte fourni.`;

  console.log('[Legacy] Génération de la réponse...');
  const answer = await generateCompletion(prompt, { maxTokens: 1000 });

  // 4. Créer les citations
  const citations = chunks.map((chunk) => ({
    type: 'kb' as const,
    source: chunk.source || 'knowledge-base',
    snippet: chunk.text.substring(0, 150) + '...',
    confidence: chunk.score,
  }));

  return {
    answer,
    citations,
  };
}

/**
 * Vérifie si l'agent est prêt (services disponibles)
 */
export async function checkAgentHealth(): Promise<{
  ok: boolean;
  mode: string;
  services: {
    ollama: boolean;
    qdrant: boolean;
    database: boolean;
  };
  message?: string;
}> {
  const services = {
    ollama: false,
    qdrant: false,
    database: true, // Assume toujours OK (sera vérifié par Prisma)
  };

  try {
    // Vérifier Ollama
    const ollamaResponse = await fetch(`${aiConfig.ollama.host}/api/tags`, {
      method: 'GET',
    });
    services.ollama = ollamaResponse.ok;
  } catch (error) {
    console.error('[Health] Ollama non accessible:', error);
  }

  try {
    // Vérifier Qdrant
    const qdrantResponse = await fetch(`${aiConfig.qdrant.url}/health`, {
      method: 'GET',
    });
    services.qdrant = qdrantResponse.ok;
  } catch (error) {
    console.error('[Health] Qdrant non accessible:', error);
  }

  const allOk = Object.values(services).every((s) => s);

  return {
    ok: allOk,
    mode: aiConfig.mode,
    services,
    message: allOk
      ? 'Tous les services sont opérationnels'
      : 'Certains services sont indisponibles',
  };
}

