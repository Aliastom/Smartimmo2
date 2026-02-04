/**
 * Configuration de l'agent IA
 * Permet de basculer entre l'ancien système (RAG simple) et le nouveau (ReAct)
 */

export type AiMode = 'legacy' | 'react';

// Configuration depuis les variables d'environnement
const AI_MODE = (process.env.NEXT_PUBLIC_AI_MODE || 'react') as AiMode;
const AI_ENABLED = process.env.NEXT_PUBLIC_AI_ENABLED !== 'false';
const AI_ANIMATIONS = process.env.NEXT_PUBLIC_AI_ANIMATIONS !== 'false';

export const aiConfig = {
  /**
   * Active ou désactive complètement l'assistant IA
   * Par défaut : true
   * Pour désactiver : NEXT_PUBLIC_AI_ENABLED=false
   */
  enabled: AI_ENABLED,

  /**
   * Active ou désactive les animations du robot IA
   * Par défaut : true
   * Pour désactiver : NEXT_PUBLIC_AI_ANIMATIONS=false
   */
  animations: AI_ANIMATIONS,

  /**
   * Mode de l'agent IA
   * - 'legacy' : Ancien système RAG simple (streaming basique)
   * - 'react' : Nouveau système agent ReAct avec outils (SQL + RAG + OCR)
   */
  mode: AI_MODE,

  /**
   * Vérifie si l'IA est activée
   */
  isEnabled: () => aiConfig.enabled,

  /**
   * Vérifie si les animations sont activées
   */
  isAnimated: () => aiConfig.animations,

  /**
   * Vérifie si le mode ReAct est activé
   */
  isReActMode: () => aiConfig.enabled && aiConfig.mode === 'react',

  /**
   * Vérifie si le mode Legacy est activé
   */
  isLegacyMode: () => aiConfig.enabled && aiConfig.mode === 'legacy',

  /**
   * Configuration Ollama
   */
  ollama: {
    host: process.env.OLLAMA_HOST || 'http://localhost:11434',
    model: process.env.GEN_MODEL || 'mistral:instruct',
  },

  /**
   * Configuration Qdrant
   */
  qdrant: {
    url: process.env.QDRANT_URL || 'http://localhost:6333',
    collection: process.env.QDRANT_COLLECTION || 'smartimmo_kb',
  },

  /**
   * Configuration Embeddings
   */
  embeddings: {
    model: process.env.EMBEDDING_MODEL || 'Xenova/bge-small-en-v1.5',
    dimension: 384, // bge-small-en-v1.5
  },

  /**
   * Configuration Agent ReAct
   */
  react: {
    maxIterations: 5,
    maxTokens: 2000,
    timeout: 30000, // 30 secondes
  },

  /**
   * Configuration SQL
   */
  sql: {
    maxLimit: 500,
    timeout: 5000, // 5 secondes
    readOnly: true,
  },

  /**
   * Fonctionnalités activées/désactivées
   */
  features: {
    sqlTool: true, // Outil SQL
    kbSearch: true, // Recherche KB
    docFetch: true, // Récupération documents
    ocrSummarize: true, // Résumé OCR
    streaming: true, // Streaming SSE
    memory: true, // Mémoire de session
  },
};

// TODO: Companion IA temporairement désactivé
// import { logDebug } from '@/lib/utils/logger';

/**
 * Helper pour logger la configuration au démarrage
 * TODO: Désactivé temporairement avec le companion
 */
export function logAiConfig() {
  // TODO: Companion IA temporairement désactivé
  // logDebug('═'.repeat(60));
  // logDebug('🤖 Smartimmo AI Configuration');
  // logDebug('═'.repeat(60));
  
  // if (!aiConfig.enabled) {
  //   logDebug('❌ IA DÉSACTIVÉE (NEXT_PUBLIC_AI_ENABLED=false)');
  //   logDebug('═'.repeat(60));
  //   return;
  // }
  
  // logDebug(`Mode: ${aiConfig.mode.toUpperCase()}`);
  // logDebug(`Ollama: ${aiConfig.ollama.host} (${aiConfig.ollama.model})`);
  // logDebug(`Qdrant: ${aiConfig.qdrant.url} (${aiConfig.qdrant.collection})`);
  // logDebug(`Embeddings: ${aiConfig.embeddings.model}`);
  
  // if (aiConfig.mode === 'react') {
  //   logDebug('\n✅ Agent ReAct activé avec outils:');
  //   logDebug(`   - SQL: ${aiConfig.features.sqlTool ? '✓' : '✗'}`);
  //   logDebug(`   - KB Search: ${aiConfig.features.kbSearch ? '✓' : '✗'}`);
  //   logDebug(`   - Doc Fetch: ${aiConfig.features.docFetch ? '✓' : '✗'}`);
  //   logDebug(`   - OCR Summarize: ${aiConfig.features.ocrSummarize ? '✓' : '✗'}`);
  // } else {
  //   logDebug('\n⚠️  Mode Legacy (RAG simple)');
  // }
  
  // logDebug('═'.repeat(60));
}

