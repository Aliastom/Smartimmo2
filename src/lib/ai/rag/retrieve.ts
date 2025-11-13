/**
 * RAG Retrieve - Récupération de contexte sémantique
 * Transforme une requête en embedding et cherche dans Qdrant
 */

import { pipeline } from '@xenova/transformers';
import * as qdrant from '../clients/qdrant';
import type { ChunkData } from '../types';

// Configuration
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'Xenova/bge-small-en-v1.5';
const DEFAULT_TOP_K = 5;

// Cache du modèle d'embedding (lazy loading)
let embedderInstance: any = null;

/**
 * Récupère ou initialise le modèle d'embedding
 */
async function getEmbedder() {
  if (!embedderInstance) {
    console.log(`[RAG] Chargement du modèle d'embedding: ${EMBEDDING_MODEL}`);
    embedderInstance = await pipeline('feature-extraction', EMBEDDING_MODEL);
    console.log('[RAG] Modèle d\'embedding chargé');
  }
  return embedderInstance;
}

/**
 * Génère un embedding pour une requête texte
 * @param text Le texte à embedder
 * @returns Le vecteur d'embedding
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const embedder = await getEmbedder();
    const output = await embedder(text, {
      pooling: 'mean',
      normalize: true,
    });

    // Convertir le tensor en array
    const embedding = Array.from(output.data);
    return embedding;
  } catch (error) {
    console.error('[RAG] Erreur lors de la génération de l\'embedding:', error);
    throw new Error('Impossible de générer l\'embedding pour la requête');
  }
}

/**
 * Récupère le contexte sémantique pour une requête
 * @param query La question de l'utilisateur
 * @param topK Nombre de chunks à récupérer
 * @param tags Filtres optionnels par tags
 * @returns Chunks pertinents triés par score
 */
export async function retrieveContext(
  query: string,
  topK: number = DEFAULT_TOP_K,
  tags?: string[]
): Promise<ChunkData[]> {
  try {
    console.log(`[RAG] Récupération du contexte pour: "${query.substring(0, 50)}..."`);

    // 1. Générer l'embedding de la requête
    const queryEmbedding = await generateEmbedding(query);

    // 2. Construire le filtre optionnel
    let filter: Record<string, any> | undefined;
    if (tags && tags.length > 0) {
      filter = {
        must: [
          {
            key: 'tags',
            match: {
              any: tags,
            },
          },
        ],
      };
    }

    // 3. Rechercher dans Qdrant
    const results = await qdrant.search(queryEmbedding, topK, filter);

    // 4. Convertir en ChunkData
    const chunks: ChunkData[] = results.map((result) => ({
      id: result.id,
      text: result.payload.text,
      score: result.score,
      source: result.payload.source,
      tags: result.payload.tags,
      metadata: result.payload,
    }));

    console.log(`[RAG] ${chunks.length} chunks récupérés (scores: ${chunks.map((c) => c.score.toFixed(3)).join(', ')})`);

    return chunks;
  } catch (error) {
    console.error('[RAG] Erreur lors de la récupération du contexte:', error);
    // En cas d'erreur, retourner un tableau vide plutôt que throw
    // (permet au chat de continuer sans contexte)
    return [];
  }
}

/**
 * Récupère le contexte avec un seuil de score minimal
 * @param query La question
 * @param minScore Score minimal (ex: 0.7)
 * @param topK Nombre max de chunks
 * @returns Chunks pertinents au-dessus du seuil
 */
export async function retrieveContextWithThreshold(
  query: string,
  minScore: number = 0.6,
  topK: number = DEFAULT_TOP_K
): Promise<ChunkData[]> {
  const chunks = await retrieveContext(query, topK);
  return chunks.filter((chunk) => chunk.score >= minScore);
}

