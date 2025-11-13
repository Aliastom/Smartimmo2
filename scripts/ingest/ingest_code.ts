#!/usr/bin/env tsx
/**
 * Script d'ingestion du code source
 * Lit les fichiers .ts/.tsx/.prisma, les chunke et les envoie à Qdrant
 * Ignore les tests, node_modules, .next, etc.
 */

import { config } from 'dotenv';
import { resolve as resolvePath } from 'path';
config({ path: resolvePath(process.cwd(), '.env.local') });
config({ path: resolvePath(process.cwd(), '.env') });

import { readdirSync, statSync, readFileSync } from 'fs';
import { join, resolve, dirname, relative } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { generateEmbedding } from './embedder';
import { upsertPoints } from '../../src/lib/ai/clients/qdrant';
import type { QdrantPoint } from '../../src/lib/ai/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '../..');
const COLLECTION_NAME = process.env.QDRANT_COLLECTION || 'smartimmo_kb';

// Extensions à ingérer
const CODE_EXTENSIONS = ['.ts', '.tsx', '.prisma', '.js', '.jsx'];

// Dossiers à ignorer
const IGNORE_DIRS = new Set([
  'node_modules',
  '.next',
  'dist',
  'build',
  '.git',
  'coverage',
  'qdrant_storage',
  'backups',
]);

// Patterns à ignorer
const IGNORE_PATTERNS = [
  /\.test\.(ts|tsx|js|jsx)$/,
  /\.spec\.(ts|tsx|js|jsx)$/,
  /\.d\.ts$/,
  /__tests__\//,
];

/**
 * Point d'entrée principal
 */
async function main() {
  console.log('\n🚀 Smartimmo - Ingestion du code source\n');
  console.log('═'.repeat(60));

  const startTime = Date.now();

  try {
    // 1. Lire et chunker les fichiers de code
    console.log('\n📄 Lecture des fichiers de code...');
    const chunks = await readAndChunkCodeFiles();

    if (chunks.length === 0) {
      console.log('⚠️  Aucun chunk généré.');
      process.exit(0);
    }

    console.log(`\n📊 ${chunks.length} chunks de code générés`);

    // 2. Générer les embeddings
    console.log('\n🔢 Génération des embeddings...');
    const points = await generateEmbeddingsForChunks(chunks);

    // 3. Envoyer à Qdrant
    console.log('\n📤 Envoi vers Qdrant...');
    await upsertPoints(points, COLLECTION_NAME);

    console.log(`\n✅ Ingestion du code terminée !`);
    console.log(`   - ${points.length} chunks de code ingérés`);

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
 * Lit tous les fichiers de code et les chunke
 */
async function readAndChunkCodeFiles() {
  const codeFiles = findCodeFiles(PROJECT_ROOT);
  console.log(`   📁 ${codeFiles.length} fichier(s) de code trouvé(s)`);

  const allChunks = [];

  for (const file of codeFiles) {
    const chunks = chunkCodeFile(file);
    if (chunks.length > 0) {
      console.log(`   ✓ ${relative(PROJECT_ROOT, file)}: ${chunks.length} chunk(s)`);
      allChunks.push(...chunks);
    }
  }

  return allChunks;
}

/**
 * Trouve tous les fichiers de code récursivement
 */
function findCodeFiles(dir: string, baseDir = dir): string[] {
  const files: string[] = [];

  try {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        // Ignorer les dossiers à exclure
        if (IGNORE_DIRS.has(entry)) {
          continue;
        }
        files.push(...findCodeFiles(fullPath, baseDir));
      } else {
        // Vérifier l'extension
        const ext = CODE_EXTENSIONS.find((e) => entry.endsWith(e));
        if (!ext) continue;

        // Vérifier les patterns à ignorer
        const relativePath = relative(baseDir, fullPath);
        if (IGNORE_PATTERNS.some((p) => p.test(relativePath))) {
          continue;
        }

        files.push(fullPath);
      }
    }
  } catch (error: any) {
    console.error(`⚠️  Erreur lors de la lecture du dossier ${dir}:`, error.message);
  }

  return files;
}

/**
 * Chunke un fichier de code
 * Stratégie: découper par fonction/classe ou par blocs de 50 lignes
 */
function chunkCodeFile(filePath: string): any[] {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    const chunks = [];
    const CHUNK_SIZE = 50; // Lignes par chunk
    const OVERLAP = 5; // Lignes de chevauchement

    const relativePath = relative(PROJECT_ROOT, filePath);

    for (let i = 0; i < lines.length; i += CHUNK_SIZE - OVERLAP) {
      const chunkLines = lines.slice(i, i + CHUNK_SIZE);
      const chunkText = chunkLines.join('\n').trim();

      if (chunkText.length < 50) continue; // Ignorer les chunks trop petits

      chunks.push({
        text: chunkText,
        metadata: {
          path: relativePath,
          type: 'code',
          startLine: i + 1,
          endLine: Math.min(i + CHUNK_SIZE, lines.length),
          extension: filePath.split('.').pop(),
        },
      });
    }

    return chunks;
  } catch (error: any) {
    console.error(`⚠️  Erreur lors de la lecture de ${filePath}:`, error.message);
    return [];
  }
}

/**
 * Génère les embeddings pour tous les chunks
 */
async function generateEmbeddingsForChunks(chunks: any[]): Promise<QdrantPoint[]> {
  const points: QdrantPoint[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    // Afficher progression
    if ((i + 1) % 20 === 0 || i === chunks.length - 1) {
      const percent = Math.round(((i + 1) / chunks.length) * 100);
      process.stdout.write(`\r   🔄 Progression: ${i + 1}/${chunks.length} (${percent}%)`);
    }

    // Générer embedding
    const embedding = await generateEmbedding(chunk.text);

    // Créer le point Qdrant
    points.push({
      id: randomUUID(),
      vector: embedding,
      payload: {
        text: chunk.text,
        source: chunk.metadata.path,
        type: chunk.metadata.type,
        startLine: chunk.metadata.startLine,
        endLine: chunk.metadata.endLine,
        extension: chunk.metadata.extension,
        tags: ['code', chunk.metadata.extension],
      },
    });
  }

  console.log(''); // Nouvelle ligne après progression
  return points;
}

// Lancer le script
main();

