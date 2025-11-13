/**
 * API Route pour l'agent Dedup
 * POST /api/documents/dedup
 * 
 * Analyse un nouveau fichier et retourne les recommandations de déduplication
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDedupAgent } from '@/services/dedup-agent.service';
import { DedupInput } from '@/types/dedup';
import { z } from 'zod';

// Schéma de validation pour la requête

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

const DedupRequestSchema = z.object({
  newFile: z.object({
    tempId: z.string(),
    name: z.string(),
    mime: z.string(),
    size: z.number(),
    pages: z.number(),
    checksum: z.string(),
    ocr: z.object({
      chars: z.number(),
      quality: z.number().min(0).max(1),
      text: z.string(),
    }),
    extracted: z.object({
      typePredictions: z.array(
        z.object({
          label: z.string(),
          score: z.number(),
        })
      ),
      period: z
        .object({
          from: z.string(),
          to: z.string(),
        })
        .optional(),
    }),
    context: z.object({
      propertyId: z.string().optional(),
      tenant: z.string().optional(),
      leaseId: z.string().optional(),
      transactionId: z.string().optional(),
    }),
  }),
  candidates: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      uploadedAt: z.string(),
      mime: z.string(),
      size: z.number(),
      pages: z.number(),
      checksum: z.string(),
      ocr: z.object({
        quality: z.number().min(0).max(1),
        textPreview: z.string(),
      }),
      extracted: z.object({
        type: z.string(),
        period: z
          .object({
            from: z.string(),
            to: z.string(),
          })
          .optional(),
      }),
      context: z.object({
        propertyId: z.string().optional(),
        tenant: z.string().optional(),
        leaseId: z.string().optional(),
        transactionId: z.string().optional(),
      }),
      url: z.string(),
    })
  ),
  config: z
    .object({
      textSimilarityThreshold: z.number().min(0).max(1).optional(),
      typePredictionMinScore: z.number().min(0).max(1).optional(),
      enableDebugLogs: z.boolean().optional(),
      locale: z.enum(['fr', 'en']).optional(),
    })
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validation
    const validationResult = DedupRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Données invalides',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { newFile, candidates, config } = validationResult.data;

    // Créer l'input pour l'agent
    const input: DedupInput = {
      newFile,
      candidates,
    };

    // Analyser avec l'agent Dedup
    const agent = getDedupAgent(config);
    const result = await agent.analyze(input);

    // Retourner le résultat
    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('[Dedup API] Erreur:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erreur lors de l\'analyse de déduplication',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/documents/dedup/health
 * Health check pour vérifier que le service est disponible
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    service: 'Dedup Agent',
    version: '1.0.0',
    status: 'healthy',
  });
}

