/**
 * POST /api/ai/query
 * Endpoint principal pour interroger l'agent IA
 * L'agent choisit automatiquement les outils nécessaires
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryAgent } from '@/lib/ai/agent/dispatcher';
import { type AgentConfig } from '@/lib/ai/agent/react';
import { aiConfig } from '@/lib/ai/config';
import { requireAuth } from '@/lib/auth/getCurrentUser';
import { randomUUID } from 'crypto';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Vérifier si l'IA est activée
  if (!aiConfig.isEnabled()) {
    return NextResponse.json(
      { error: 'L\'assistant IA est actuellement désactivé' },
      { status: 503 }
    );
  }

  const user = await requireAuth();

  try {
    const body = await request.json();

    const {
      question,
      sessionId,
      context,
      maxIterations = 5,
    } = body;

    // Validation
    if (!question || typeof question !== 'string') {
      return NextResponse.json(
        { error: 'La question est requise' },
        { status: 400 }
      );
    }

    if (question.length > 1000) {
      return NextResponse.json(
        { error: 'La question est trop longue (max 1000 caractères)' },
        { status: 400 }
      );
    }

    // Configuration de l'agent
    const config: AgentConfig = {
      sessionId: sessionId || `${user.id}-${randomUUID()}`,
      correlationId: randomUUID(),
      context: context || {},
      maxIterations,
      stream: false, // Pour l'instant, pas de streaming
    };

    console.log(`[API:query] Mode: ${aiConfig.mode}, Question: "${question.substring(0, 100)}..."`);

    // Exécuter l'agent (dispatcher bascule automatiquement selon AI_MODE)
    const result = await queryAgent(question, config);

    // Retourner la réponse
    return NextResponse.json({
      answer: result.answer,
      citations: result.citations || [],
      steps: result.steps?.map((step) => ({
        type: step.type,
        content: step.content?.substring(0, 500), // Tronquer pour l'API
        toolCall: step.toolCall,
        timestamp: step.timestamp,
      })) || [],
      metadata: {
        ...result.metadata,
        mode: aiConfig.mode,
      },
      sessionId: config.sessionId,
    });
  } catch (error: any) {
    console.error('[API:query] Erreur:', error);

    return NextResponse.json(
      {
        error: 'Erreur lors du traitement de la question',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

// GET pour documentation
export async function GET() {
  await requireAuth();
  return NextResponse.json({
    endpoint: '/api/ai/query',
    method: 'POST',
    description: 'Interroge l\'agent IA avec une question en langage naturel',
    body: {
      question: 'string (required) - La question à poser',
      sessionId: 'string (optional) - ID de session pour la mémoire',
      context: 'object (optional) - Contexte additionnel (propertyId, leaseId, etc.)',
      maxIterations: 'number (optional, default: 5) - Nombre max d\'itérations',
    },
    response: {
      answer: 'string - La réponse de l\'agent',
      citations: 'array - Sources des données',
      steps: 'array - Étapes de raisonnement',
      metadata: 'object - Métadonnées (tokens, durée, etc.)',
      sessionId: 'string - ID de session',
    },
  });
}

