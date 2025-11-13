/**
 * POST /api/ai
 * Endpoint principal du router MAX COVERAGE
 * Gère automatiquement SQL + RAG + OCR + Code avec fallbacks
 */

import { NextRequest, NextResponse } from 'next/server';
import { route as routeQuestion } from '@/lib/ai/router';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { aiConfig } from '@/lib/ai/config';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  // Vérifier si l'IA est activée
  if (!aiConfig.isEnabled()) {
    return NextResponse.json(
      { error: 'L\'assistant IA est actuellement désactivé' },
      { status: 503 }
    );
  }

  const correlationId = randomUUID();
  const startTime = Date.now();

  try {
    const body = await request.json();

    const {
      question,
      sessionUser = 'default',
      pathname,
      searchParams,
    } = body;

    // Validation
    if (!question || typeof question !== 'string') {
      return NextResponse.json(
        { error: 'La question est requise' },
        { status: 400 }
      );
    }

    if (question.length > 2000) {
      return NextResponse.json(
        { error: 'La question est trop longue (max 2000 caractères)' },
        { status: 400 }
      );
    }

    console.log(`[API:router:${correlationId}] Question: "${question.substring(0, 100)}..."`);

    // Convertir searchParams si fourni
    const searchParamsObj = searchParams
      ? new URLSearchParams(searchParams)
      : undefined;

    // Router la question
    const result = await routeQuestion({
      question,
      sessionUser,
      pathname,
      searchParams: searchParamsObj,
    });

    // Logger la requête
    await logQuery({
      correlationId,
      sessionUser,
      question,
      intent: result.metadata?.intent || 'unknown',
      toolUsed: result.tool,
      sqlExecuted: result.sql,
      ok: true,
      rowCount: result.rowCount,
      durationMs: result.durationMs,
    });

    // Retourner la réponse
    return NextResponse.json({
      answer: result.answer,
      plan: result.plan,
      tool: result.tool,
      sources: result.sources,
      sql: result.sql,
      rowCount: result.rowCount,
      metadata: {
        durationMs: result.durationMs,
        correlationId,
        ...result.metadata,
      },
    });
  } catch (error: any) {
    console.error(`[API:router:${correlationId}] Erreur:`, error);

    // Logger l'erreur
    await logQuery({
      correlationId,
      sessionUser: 'default',
      question: (await request.json()).question || '',
      intent: 'error',
      toolUsed: 'none',
      ok: false,
      errorMessage: error.message,
      durationMs: Date.now() - startTime,
    });

    return NextResponse.json(
      {
        error: 'Erreur lors du traitement de la question',
        details: error.message,
        correlationId,
      },
      { status: 500 }
    );
  }
}

/**
 * Log une requête dans ai_query_log
 */
async function logQuery(log: {
  correlationId: string;
  sessionUser: string;
  question: string;
  intent: string;
  toolUsed: string;
  sqlExecuted?: string;
  ok: boolean;
  errorMessage?: string;
  rowCount?: number;
  durationMs: number;
}): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO ai_query_log (id, user_id, question, intent, tool_used, sql_executed, ok, error_message, row_count, duration_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      log.correlationId,
      log.sessionUser,
      log.question,
      log.intent,
      log.toolUsed,
      log.sqlExecuted || null,
      log.ok,
      log.errorMessage || null,
      log.rowCount || null,
      log.durationMs
    );
  } catch (error: any) {
    console.error('[LogQuery] Erreur:', error.message);
  }
}

/**
 * POST /api/ai/feedback
 * Enregistre le feedback utilisateur (👍 / 👎)
 */
export async function POST_FEEDBACK(queryId: string, rating: 1 | -1, comment?: string) {
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE ai_query_log 
       SET feedback_rating = $1, feedback_comment = $2
       WHERE id = $3`,
      rating,
      comment || null,
      queryId
    );

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[Feedback] Erreur:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

// GET pour documentation
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/ai',
    method: 'POST',
    description: 'Router intelligent MAX COVERAGE - SQL + RAG + OCR + Code avec fallbacks',
    body: {
      question: 'string (required) - La question en français',
      sessionUser: 'string (optional) - ID utilisateur',
      pathname: 'string (optional) - Chemin actuel pour détecter le contexte',
      searchParams: 'object (optional) - Paramètres URL pour filtres',
    },
    response: {
      answer: 'string - La réponse',
      plan: 'string - Plan d\'exécution',
      tool: 'string - Outil utilisé (sql|ocr|kb|code|template)',
      sources: 'array - Sources des données',
      sql: 'string (optional) - SQL exécuté si tool=sql',
      rowCount: 'number (optional) - Nombre de lignes si SQL',
      metadata: 'object - Métadonnées (durée, etc.)',
    },
    features: {
      intent_detection: 'Détection automatique de l\'intention (kpi|doc|howto|code)',
      auto_context: 'Extraction automatique du contexte depuis l\'URL',
      time_normalization: 'Résolution des expressions temporelles FR (ce mois, mois dernier, etc.)',
      entity_resolution: 'Résolution fuzzy des entités (biens, locataires, etc.)',
      fallback_chain: 'SQL → OCR → KB avec fallback automatique',
      structured_answers: 'Templates KPI, List, Doc pour réponses cohérentes',
      logging: 'Logging dans ai_query_log pour feedback loop',
    },
  });
}

