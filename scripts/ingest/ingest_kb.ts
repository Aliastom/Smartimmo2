#!/usr/bin/env tsx
/**
 * Script d'ingestion de la base de connaissances
 * Lit les fichiers markdown, les découpe en chunks, génère les embeddings et les envoie à Qdrant
 * 
 * Usage:
 *   npm run ingest:kb              → Ingestion normale
 *   npm run kb:truncate            → Supprime tous les chunks
 *   npm run kb:rebuild             → Supprime puis ingère
 */

// Charger les variables d'environnement depuis .env.local
import { config } from 'dotenv';
import { resolve as resolvePath } from 'path';
config({ path: resolvePath(process.cwd(), '.env.local') });
config({ path: resolvePath(process.cwd(), '.env') });

import { readdirSync, statSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { chunkMarkdownFile, calculateStats } from './chunker';
import { generateEmbedding, checkEmbedder, getEmbeddingDimension } from './embedder';
import { ensureCollection, upsertPoints, countPoints, deleteCollection } from '../../src/lib/ai/clients/qdrant';
import type { QdrantPoint } from '../../src/lib/ai/types';

// Configuration (ES modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const KB_DIR = resolve(__dirname, '../../docs/kb');
const COLLECTION_NAME = process.env.QDRANT_COLLECTION || 'smartimmo_kb';
const EMBEDDING_DIMENSION = getEmbeddingDimension();

// Arguments CLI
const args = process.argv.slice(2);
const isTruncate = args.includes('--truncate');

/**
 * Point d'entrée principal
 */
async function main() {
  console.log('\n🚀 Smartimmo - Ingestion de la base de connaissances\n');
  console.log('═'.repeat(60));

  const startTime = Date.now();

  try {
    // 1. Mode truncate (suppression)
    if (isTruncate) {
      await truncateCollection();
      return;
    }

    // 2. Vérifier les prérequis
    console.log('\n📋 Vérification des prérequis...');
    await checkPrerequisites();

    // 3. Lire et chunker les fichiers markdown
    console.log('\n📄 Lecture des fichiers markdown...');
    const chunks = await readAndChunkMarkdownFiles();

    if (chunks.length === 0) {
      console.log('⚠️  Aucun chunk généré. Vérifiez le dossier docs/kb/');
      process.exit(1);
    }

    // Afficher les stats
    const stats = calculateStats(chunks);
    console.log(`\n📊 Statistiques de chunking:`);
    console.log(`   - Fichiers traités: ${stats.totalFiles}`);
    console.log(`   - Chunks générés: ${stats.totalChunks}`);
    console.log(`   - Taille moyenne: ${stats.avgChunkSize} caractères`);
    console.log(`   - Taille min/max: ${stats.minChunkSize} / ${stats.maxChunkSize}`);

    // 4. Générer les embeddings
    console.log('\n🔢 Génération des embeddings...');
    const points = await generateEmbeddingsForChunks(chunks);

    // 5. Envoyer à Qdrant
    console.log('\n📤 Envoi vers Qdrant...');
    await ensureCollection(COLLECTION_NAME, EMBEDDING_DIMENSION);
    await upsertPoints(points, COLLECTION_NAME);

    // 6. Vérification finale
    const totalPoints = await countPoints(COLLECTION_NAME);
    console.log(`\n✅ Ingestion terminée !`);
    console.log(`   - Total de points dans Qdrant: ${totalPoints}`);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`   - Durée: ${duration}s`);
    console.log('\n' + '═'.repeat(60));
  } catch (error: any) {
    console.error('\n❌ Erreur lors de l\'ingestion:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

/**
 * Vérifie les prérequis (Qdrant, embedder)
 */
async function checkPrerequisites() {
  // Vérifier l'embedder
  console.log('   🔍 Vérification du modèle d\'embedding...');
  const embedderOk = await checkEmbedder();
  if (!embedderOk) {
    throw new Error('Impossible de charger le modèle d\'embedding');
  }
  console.log('   ✅ Modèle d\'embedding OK');

  // Vérifier Qdrant (tentera de se connecter lors de ensureCollection)
  console.log('   🔍 Vérification de Qdrant...');
  console.log(`   ✅ Qdrant configuré (${process.env.QDRANT_URL || 'http://localhost:6333'})`);
}

/**
 * Lit tous les fichiers markdown et les chunke
 */
async function readAndChunkMarkdownFiles() {
  const markdownFiles = findMarkdownFiles(KB_DIR);
  console.log(`   📁 ${markdownFiles.length} fichier(s) markdown trouvé(s)`);

  const allChunks = [];

  for (const file of markdownFiles) {
    const chunks = chunkMarkdownFile(file, KB_DIR);
    console.log(`   ✓ ${file.replace(KB_DIR, 'docs/kb')}: ${chunks.length} chunk(s)`);
    allChunks.push(...chunks);
  }

  return allChunks;
}

/**
 * Génère les embeddings pour tous les chunks
 */
async function generateEmbeddingsForChunks(chunks: any[]): Promise<QdrantPoint[]> {
  const points: QdrantPoint[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    // Afficher progression
    if ((i + 1) % 10 === 0 || i === chunks.length - 1) {
      const percent = Math.round(((i + 1) / chunks.length) * 100);
      process.stdout.write(`\r   🔄 Progression: ${i + 1}/${chunks.length} (${percent}%)`);
    }

    // Générer embedding
    const embedding = await generateEmbedding(chunk.text);

    // Créer le point Qdrant (UUID pour l'id)
    points.push({
      id: randomUUID(), // UUID au lieu de string custom
      vector: embedding,
      payload: {
        text: chunk.text,
        source: chunk.metadata.path,
        title: chunk.metadata.title,
        slug: chunk.metadata.slug,
        section: chunk.metadata.section,
        chunkId: chunk.metadata.id, // ID original dans payload
        updatedAt: chunk.metadata.updatedAt,
        tags: extractTags(chunk.metadata.path),
      },
    });
  }

  console.log(''); // Nouvelle ligne après progression
  return points;
}

/**
 * Extrait des tags depuis le chemin du fichier
 */
function extractTags(filePath: string): string[] {
  const fileName = filePath.split('/').pop()?.replace('.md', '') || '';
  
  // Mapping simple
  const tagMap: Record<string, string[]> = {
    'guide_baux': ['baux', 'bail', 'location'],
    'guide_transactions': ['transactions', 'comptabilité', 'finance'],
    'glossaire_fiscal': ['fiscal', 'impôts', 'glossaire'],
    'onboarding': ['onboarding', 'démarrage', 'guide'],
  };

  return tagMap[fileName] || [fileName.replace(/_/g, '-')];
}

/**
 * Trouve tous les fichiers markdown récursivement
 */
function findMarkdownFiles(dir: string): string[] {
  const files: string[] = [];

  try {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        files.push(...findMarkdownFiles(fullPath));
      } else if (entry.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  } catch (error: any) {
    console.error(`⚠️  Erreur lors de la lecture du dossier ${dir}:`, error.message);
  }

  return files;
}

/**
 * Supprime tous les points de la collection (mode --truncate)
 */
async function truncateCollection() {
  console.log(`\n⚠️  Mode TRUNCATE - Suppression de la collection "${COLLECTION_NAME}"`);
  console.log('   Cette opération est irréversible !');

  try {
    await deleteCollection(COLLECTION_NAME);
    console.log(`\n✅ Collection "${COLLECTION_NAME}" supprimée avec succès`);
  } catch (error: any) {
    console.error(`\n❌ Erreur lors de la suppression:`, error.message);
    process.exit(1);
  }
}

// Lancer le script
main();

