/**
 * Embedder - Génération d'embeddings avec bge-small-en (offline)
 * Utilise @xenova/transformers pour des embeddings locaux
 */

import { pipeline, env } from '@xenova/transformers';

// Configuration
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'Xenova/bge-small-en-v1.5';
const EMBEDDING_DIMENSION = 384; // bge-small-en-v1.5 → 384 dimensions

// Désactiver le cache distant pour mode offline (optionnel)
// env.useBrowserCache = false;
// env.allowLocalModels = true;

// Cache du modèle (lazy loading)
let embedderInstance: any = null;

/**
 * Récupère ou initialise le modèle d'embedding
 */
async function getEmbedder() {
  if (!embedderInstance) {
    console.log(`[Embedder] 🔄 Chargement du modèle: ${EMBEDDING_MODEL}`);
    console.log('[Embedder] ⏳ Première utilisation peut prendre 30-60s...');
    
    const startTime = Date.now();
    embedderInstance = await pipeline('feature-extraction', EMBEDDING_MODEL);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Embedder] ✅ Modèle chargé en ${duration}s`);
  }
  return embedderInstance;
}

/**
 * Génère un embedding pour un texte
 * @param text Le texte à embedder
 * @returns Le vecteur d'embedding (384 dimensions pour bge-small-en)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    if (!text || text.trim().length === 0) {
      throw new Error('Texte vide');
    }

    const embedder = await getEmbedder();
    
    // Générer l'embedding avec pooling mean et normalisation
    const output = await embedder(text, {
      pooling: 'mean',
      normalize: true,
    });

    // Convertir le tensor en array
    const embedding = Array.from(output.data) as number[];

    // Vérifier la dimension
    if (embedding.length !== EMBEDDING_DIMENSION) {
      console.warn(
        `[Embedder] ⚠️  Dimension inattendue: ${embedding.length} (attendu: ${EMBEDDING_DIMENSION})`
      );
    }

    return embedding;
  } catch (error: any) {
    console.error('[Embedder] ❌ Erreur lors de la génération:', error.message);
    throw new Error(`Impossible de générer l'embedding: ${error.message}`);
  }
}

/**
 * Génère des embeddings pour plusieurs textes (batch)
 * @param texts Array de textes
 * @param onProgress Callback de progression (optionnel)
 * @returns Array d'embeddings
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  onProgress?: (current: number, total: number) => void
): Promise<number[][]> {
  const embeddings: number[][] = [];

  for (let i = 0; i < texts.length; i++) {
    const embedding = await generateEmbedding(texts[i]);
    embeddings.push(embedding);

    if (onProgress) {
      onProgress(i + 1, texts.length);
    }
  }

  return embeddings;
}

/**
 * Vérifie que le modèle est accessible
 * @returns true si le modèle peut être chargé
 */
export async function checkEmbedder(): Promise<boolean> {
  try {
    await getEmbedder();
    return true;
  } catch (error: any) {
    console.error('[Embedder] ❌ Modèle non accessible:', error.message);
    return false;
  }
}

/**
 * Retourne la dimension des embeddings
 */
export function getEmbeddingDimension(): number {
  return EMBEDDING_DIMENSION;
}

