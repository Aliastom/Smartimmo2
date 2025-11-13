/**
 * Client Qdrant
 * Abstraction pour interagir avec Qdrant (vector database)
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import type { QdrantPoint, QdrantSearchRequest, QdrantSearchResult } from '../types';

// Configuration depuis ENV
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const QDRANT_API_KEY = process.env.QDRANT_API_KEY || undefined;
const QDRANT_COLLECTION = process.env.QDRANT_COLLECTION || 'smartimmo_kb';
const EMBEDDING_DIMENSION = parseInt(process.env.EMBEDDING_DIMENSION || '768', 10);

// Instance singleton du client
let clientInstance: QdrantClient | null = null;

/**
 * Récupère le client Qdrant (singleton)
 */
function getClient(): QdrantClient {
  if (!clientInstance) {
    clientInstance = new QdrantClient({
      url: QDRANT_URL,
      apiKey: QDRANT_API_KEY,
    });
  }
  return clientInstance;
}

/**
 * Vérifie si une collection existe, la crée si nécessaire
 * @param collectionName Nom de la collection
 * @param dimension Dimension des vecteurs
 */
export async function ensureCollection(
  collectionName: string = QDRANT_COLLECTION,
  dimension: number = EMBEDDING_DIMENSION
): Promise<void> {
  const client = getClient();

  try {
    // Vérifier si la collection existe
    const collections = await client.getCollections();
    const exists = collections.collections.some((c) => c.name === collectionName);

    if (!exists) {
      // Créer la collection
      await client.createCollection(collectionName, {
        vectors: {
          size: dimension,
          distance: 'Cosine',
        },
      });
      console.log(`[Qdrant] Collection "${collectionName}" créée (dimension: ${dimension})`);
    } else {
      console.log(`[Qdrant] Collection "${collectionName}" existe déjà`);
    }
  } catch (error) {
    console.error('[Qdrant] Erreur lors de la création de la collection:', error);
    throw error;
  }
}

/**
 * Insère ou met à jour des points dans Qdrant
 * @param points Tableau de points à upserter
 * @param collectionName Nom de la collection
 * @param batchSize Taille du batch (par défaut 100)
 */
export async function upsertPoints(
  points: QdrantPoint[],
  collectionName: string = QDRANT_COLLECTION,
  batchSize: number = 100
): Promise<void> {
  const client = getClient();

  try {
    // Découper en batches pour éviter les payloads trop gros
    const totalBatches = Math.ceil(points.length / batchSize);
    
    for (let i = 0; i < totalBatches; i++) {
      const start = i * batchSize;
      const end = Math.min(start + batchSize, points.length);
      const batch = points.slice(start, end);
      
      await client.upsert(collectionName, {
        wait: true,
        points: batch.map((point) => ({
          id: point.id,
          vector: point.vector,
          payload: point.payload,
        })),
      });
      
      console.log(`[Qdrant] Batch ${i + 1}/${totalBatches}: ${batch.length} points upsertés`);
    }
    
    console.log(`[Qdrant] ✅ Total: ${points.length} points upsertés dans "${collectionName}"`);
  } catch (error) {
    console.error('[Qdrant] Erreur lors de l\'upsert:', error);
    throw error;
  }
}

/**
 * Recherche sémantique dans Qdrant
 * @param request Requête de recherche (avec vecteur)
 * @param collectionName Nom de la collection
 * @returns Résultats de la recherche
 */
export async function search(
  vector: number[],
  topK: number = 5,
  filter?: Record<string, any>,
  collectionName: string = QDRANT_COLLECTION
): Promise<QdrantSearchResult[]> {
  const client = getClient();

  try {
    const results = await client.search(collectionName, {
      vector,
      limit: topK,
      filter,
      with_payload: true,
    });

    return results.map((result) => ({
      id: String(result.id),
      score: result.score,
      payload: result.payload as any,
    }));
  } catch (error) {
    console.error('[Qdrant] Erreur lors de la recherche:', error);
    throw error;
  }
}

/**
 * Compte le nombre de points dans une collection
 * @param collectionName Nom de la collection
 * @returns Nombre de points
 */
export async function countPoints(
  collectionName: string = QDRANT_COLLECTION
): Promise<number> {
  const client = getClient();

  try {
    const info = await client.getCollection(collectionName);
    return info.points_count || 0;
  } catch (error) {
    console.error('[Qdrant] Erreur lors du comptage:', error);
    return 0;
  }
}

/**
 * Supprime une collection (ATTENTION: destructif)
 * @param collectionName Nom de la collection
 */
export async function deleteCollection(
  collectionName: string = QDRANT_COLLECTION
): Promise<void> {
  const client = getClient();

  try {
    await client.deleteCollection(collectionName);
    console.log(`[Qdrant] Collection "${collectionName}" supprimée`);
  } catch (error) {
    console.error('[Qdrant] Erreur lors de la suppression:', error);
    throw error;
  }
}

/**
 * Vérifie la connexion à Qdrant
 * @returns true si Qdrant est accessible
 */
export async function healthCheck(): Promise<boolean> {
  const client = getClient();

  try {
    await client.getCollections();
    return true;
  } catch {
    return false;
  }
}

