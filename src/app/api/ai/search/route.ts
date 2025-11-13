/**
 * POST /api/ai/search
 * Endpoint de recherche sémantique dans la base de connaissances
 * Recherche directe sans passer par l'agent ReAct
 */

import { NextRequest, NextResponse } from 'next/server';
import { retrieveContext } from '@/lib/ai/rag/retrieve';
import { aiConfig } from '@/lib/ai/config';

export async function POST(request: NextRequest) {
  // Vérifier si l'IA est activée
  if (!aiConfig.isEnabled()) {
    return NextResponse.json(
      { error: 'L\'assistant IA est actuellement désactivé' },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();

    const {
      query,
      topK = 5,
      tags,
      minScore = 0.6,
    } = body;

    // Validation
    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'La requête de recherche est requise' },
        { status: 400 }
      );
    }

    if (query.length > 500) {
      return NextResponse.json(
        { error: 'La requête est trop longue (max 500 caractères)' },
        { status: 400 }
      );
    }

    console.log(`[API:search] Recherche: "${query.substring(0, 100)}..."`);

    // Rechercher dans Qdrant
    const chunks = await retrieveContext(query, topK, tags);

    // Filtrer par score minimal
    const filtered = chunks.filter((chunk) => chunk.score >= minScore);

    console.log(`[API:search] ${filtered.length} résultats (score >= ${minScore})`);

    // Formater la réponse
    return NextResponse.json({
      results: filtered.map((chunk) => ({
        text: chunk.text,
        score: chunk.score,
        source: chunk.source,
        tags: chunk.tags,
        metadata: chunk.metadata,
      })),
      count: filtered.length,
      query,
    });
  } catch (error: any) {
    console.error('[API:search] Erreur:', error);

    return NextResponse.json(
      {
        error: 'Erreur lors de la recherche',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

// GET pour documentation
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/ai/search',
    method: 'POST',
    description: 'Recherche sémantique dans la base de connaissances (docs, code, guides)',
    body: {
      query: 'string (required) - La requête de recherche',
      topK: 'number (optional, default: 5) - Nombre de résultats',
      tags: 'string[] (optional) - Filtres par tags',
      minScore: 'number (optional, default: 0.6) - Score de similarité minimal',
    },
    response: {
      results: 'array - Résultats de recherche avec texte, score, source',
      count: 'number - Nombre de résultats',
      query: 'string - La requête effectuée',
    },
  });
}
