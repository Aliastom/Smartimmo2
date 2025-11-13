/**
 * POST /api/ai/chat
 * Endpoint de conversation avec l'agent IA
 * Support du streaming pour une meilleure UX
 */

import { NextRequest, NextResponse } from 'next/server';
import { runReActAgent, type AgentConfig } from '@/lib/ai/agent/react';
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

  try {
    const body = await request.json();

    const {
      messages,
      sessionId,
      context,
      stream = false,
    } = body;

    // Validation
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Les messages sont requis' },
        { status: 400 }
      );
    }

    // Récupérer le dernier message utilisateur
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== 'user') {
      return NextResponse.json(
        { error: 'Le dernier message doit être de l\'utilisateur' },
        { status: 400 }
      );
    }

    const question = lastMessage.content;

    // Configuration de l'agent
    const actualSessionId = sessionId || randomUUID();
    
    // NOUVEAU : Récupérer l'historique de conversation pour la mémoire contextuelle
    let conversationHistory: any[] = [];
    if (actualSessionId) {
      try {
        const recentMessages = await prisma.aiMessage.findMany({
          where: { sessionId: actualSessionId },
          orderBy: { createdAt: 'desc' },
          take: 10, // Garder les 10 derniers messages
        });
        
        conversationHistory = recentMessages
          .reverse() // Remettre dans l'ordre chronologique
          .map(m => ({
            role: m.role,
            content: m.content,
            timestamp: m.createdAt,
          }));
        
        console.log(`[API:chat] Historique récupéré: ${conversationHistory.length} messages`);
      } catch (error: any) {
        console.warn(`[API:chat] Impossible de récupérer l'historique:`, error.message);
      }
    }
    
    const config: AgentConfig = {
      sessionId: actualSessionId,
      correlationId: randomUUID(),
      context: {
        ...(context || {}),
        conversationHistory, // Ajouter l'historique au contexte
      },
      maxIterations: 5,
      stream,
    };

    console.log(`[API:chat] Session: ${actualSessionId}, Question: "${question.substring(0, 100)}..."`);

    // Si streaming est demandé, utiliser un ReadableStream
    if (stream) {
      return streamResponse(question, config);
    }

    // Sinon, réponse classique
    const result = await runReActAgent(question, config);

    return NextResponse.json({
      role: 'assistant',
      content: result.answer,
      citations: result.citations,
      steps: result.steps.map((step) => ({
        type: step.type,
        content: step.content.substring(0, 300),
        timestamp: step.timestamp,
      })),
      metadata: {
        tokensUsed: result.tokensUsed,
        durationMs: result.durationMs,
      },
      sessionId: actualSessionId,
    });
  } catch (error: any) {
    console.error('[API:chat] Erreur:', error);

    return NextResponse.json(
      {
        error: 'Erreur lors du traitement du message',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * Créer une réponse en streaming (SSE - Server-Sent Events)
 */
async function streamResponse(question: string, config: AgentConfig): Promise<Response> {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Envoyer un événement de début
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'start' })}\n\n`));

        // Exécuter l'agent
        const result = await runReActAgent(question, config);

        // Streamer la réponse par morceaux (simulé pour l'instant)
        const answer = result.answer;
        const chunkSize = 50; // Caractères par chunk

        for (let i = 0; i < answer.length; i += chunkSize) {
          const chunk = answer.substring(i, i + chunkSize);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'chunk',
                content: chunk,
              })}\n\n`
            )
          );

          // Petit délai pour simuler le streaming
          await new Promise((resolve) => setTimeout(resolve, 20));
        }

        // Envoyer les citations et métadonnées
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: 'citations',
              citations: result.citations,
            })}\n\n`
          )
        );

        // Envoyer un événement de fin
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: 'done',
              metadata: {
                tokensUsed: result.tokensUsed,
                durationMs: result.durationMs,
              },
            })}\n\n`
          )
        );

        controller.close();
      } catch (error: any) {
        console.error('[API:chat:stream] Erreur:', error);

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: 'error',
              error: error.message,
            })}\n\n`
          )
        );

        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

// GET pour documentation
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/ai/chat',
    method: 'POST',
    description: 'Conversation avec l\'agent IA avec support du streaming',
    body: {
      messages: 'array (required) - Historique des messages [{role, content}]',
      sessionId: 'string (optional) - ID de session pour la continuité',
      context: 'object (optional) - Contexte additionnel',
      stream: 'boolean (optional, default: false) - Activer le streaming SSE',
    },
    response: {
      role: 'string - "assistant"',
      content: 'string - La réponse',
      citations: 'array - Sources',
      steps: 'array - Étapes de raisonnement',
      metadata: 'object - Métadonnées',
      sessionId: 'string - ID de session',
    },
    streaming: {
      description: 'Si stream=true, retourne un SSE (text/event-stream)',
      events: [
        'start - Début de la réponse',
        'chunk - Morceau de texte',
        'citations - Citations et sources',
        'done - Fin de la réponse',
        'error - Erreur',
      ],
    },
  });
}

/**
 * GET /api/ai/chat/:sessionId/history
 * Récupère l'historique d'une session
 */
export async function GET_SESSION(sessionId: string) {
  try {
    const messages = await prisma.aiMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      take: 50, // Limiter à 50 messages
    });

    return NextResponse.json({
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: m.createdAt,
      })),
      sessionId,
      count: messages.length,
    });
  } catch (error: any) {
    console.error('[API:chat:history] Erreur:', error);

    return NextResponse.json(
      {
        error: 'Erreur lors de la récupération de l\'historique',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
