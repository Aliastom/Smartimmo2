/**
 * Chunker - Découpage intelligent de documents markdown
 * Respecte les structures (headings, paragraphes) et génère des métadonnées
 */

import { readFileSync } from 'fs';
import { basename, relative } from 'path';

// Configuration
const CHUNK_SIZE = 800; // Caractères par chunk
const CHUNK_OVERLAP = 200; // Overlap entre chunks
const MIN_CHUNK_SIZE = 100; // Taille minimale d'un chunk

export interface ChunkMetadata {
  id: string;
  title: string;
  slug: string;
  path: string;
  section?: string;
  updatedAt: string;
}

export interface Chunk {
  text: string;
  metadata: ChunkMetadata;
}

/**
 * Lit un fichier markdown et le découpe en chunks
 * @param filePath Chemin du fichier markdown
 * @param basePath Chemin de base (pour les paths relatifs)
 * @returns Array de chunks avec métadonnées
 */
export function chunkMarkdownFile(filePath: string, basePath: string): Chunk[] {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const relativePath = relative(basePath, filePath);
    const fileName = basename(filePath, '.md');
    const slug = fileName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    // Extraire le titre (premier heading H1)
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : fileName;

    // Date de modification (approximation)
    const updatedAt = new Date().toISOString();

    // Découper en sections basées sur les headings
    const sections = extractSections(content);

    // Chunker chaque section
    const chunks: Chunk[] = [];
    let chunkIndex = 0;

    for (const section of sections) {
      const sectionChunks = chunkText(section.content, CHUNK_SIZE, CHUNK_OVERLAP);

      for (const chunkText of sectionChunks) {
        if (chunkText.trim().length < MIN_CHUNK_SIZE) {
          continue; // Skip trop petits chunks
        }

        chunks.push({
          text: chunkText.trim(),
          metadata: {
            id: `${slug}-${chunkIndex}`,
            title,
            slug,
            path: relativePath,
            section: section.heading || undefined,
            updatedAt,
          },
        });

        chunkIndex++;
      }
    }

    return chunks;
  } catch (error: any) {
    console.error(`[Chunker] ❌ Erreur lors du chunking de ${filePath}:`, error.message);
    return [];
  }
}

/**
 * Extrait les sections d'un document markdown (basées sur les headings)
 */
interface Section {
  heading?: string;
  content: string;
}

function extractSections(content: string): Section[] {
  const lines = content.split('\n');
  const sections: Section[] = [];
  let currentSection: Section = { content: '' };

  for (const line of lines) {
    // Détection heading (##, ###, etc.)
    const headingMatch = line.match(/^(#{2,6})\s+(.+)$/);

    if (headingMatch) {
      // Sauvegarder la section précédente si non vide
      if (currentSection.content.trim().length > 0) {
        sections.push(currentSection);
      }

      // Nouvelle section
      currentSection = {
        heading: headingMatch[2],
        content: line + '\n',
      };
    } else {
      currentSection.content += line + '\n';
    }
  }

  // Ajouter la dernière section
  if (currentSection.content.trim().length > 0) {
    sections.push(currentSection);
  }

  return sections;
}

/**
 * Découpe un texte en chunks avec overlap
 * @param text Le texte à découper
 * @param chunkSize Taille max d'un chunk
 * @param overlap Overlap entre chunks
 * @returns Array de chunks de texte
 */
function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  const chunks: string[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/); // Split sur phrases

  let currentChunk = '';
  let previousChunk = '';

  for (const sentence of sentences) {
    // Si ajouter cette phrase dépasse la taille max
    if ((currentChunk + sentence).length > chunkSize && currentChunk.length > 0) {
      // Sauvegarder le chunk actuel
      chunks.push(currentChunk.trim());

      // Commencer nouveau chunk avec overlap
      previousChunk = currentChunk;
      const overlapText = getLastNChars(previousChunk, overlap);
      currentChunk = overlapText + sentence + ' ';
    } else {
      currentChunk += sentence + ' ';
    }
  }

  // Ajouter le dernier chunk
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Récupère les N derniers caractères d'un texte (pour overlap)
 */
function getLastNChars(text: string, n: number): string {
  if (text.length <= n) return text;

  // Essayer de couper sur un espace pour éviter de couper un mot
  const substring = text.substring(text.length - n);
  const spaceIndex = substring.indexOf(' ');

  if (spaceIndex > 0) {
    return substring.substring(spaceIndex + 1);
  }

  return substring;
}

/**
 * Statistiques de chunking
 */
export interface ChunkingStats {
  totalFiles: number;
  totalChunks: number;
  avgChunkSize: number;
  minChunkSize: number;
  maxChunkSize: number;
}

/**
 * Calcule des statistiques sur les chunks
 */
export function calculateStats(chunks: Chunk[]): ChunkingStats {
  if (chunks.length === 0) {
    return {
      totalFiles: 0,
      totalChunks: 0,
      avgChunkSize: 0,
      minChunkSize: 0,
      maxChunkSize: 0,
    };
  }

  const sizes = chunks.map((c) => c.text.length);
  const totalFiles = new Set(chunks.map((c) => c.metadata.path)).size;

  return {
    totalFiles,
    totalChunks: chunks.length,
    avgChunkSize: Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length),
    minChunkSize: Math.min(...sizes),
    maxChunkSize: Math.max(...sizes),
  };
}

