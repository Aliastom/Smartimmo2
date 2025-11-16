/**
 * API Endpoint pour DedupAI
 * 
 * Analyse un fichier temporaire contre des candidats existants
 * pour déterminer s'il s'agit d'un doublon.
 */

import { NextRequest, NextResponse } from 'next/server';
import { dedupAI } from '@/services/dedup-ai.service';
import { requireAuth } from '@/lib/auth/getCurrentUser';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    
    console.log('[DedupAI] Analyse demandée:', {
      tempFileId: body.tempFile?.id,
      candidatesCount: body.existingCandidates?.length || 0
    });

    // Validation des données d'entrée
    if (!body.tempFile) {
      return NextResponse.json({
        success: false,
        error: 'tempFile manquant'
      }, { status: 400 });
    }

    if (!body.existingCandidates || !Array.isArray(body.existingCandidates)) {
      return NextResponse.json({
        success: false,
        error: 'existingCandidates manquant ou invalide'
      }, { status: 400 });
    }

    // Analyse avec DedupAI
    const result = dedupAI.analyze(body.tempFile, body.existingCandidates);

    console.log('[DedupAI] Résultat:', {
      duplicateType: result.duplicateType,
      suggestedAction: result.suggestedAction,
      matchedDocumentId: result.matchedDocument.id,
      textSimilarity: Math.round(result.signals.text_similarity * 100) + '%'
    });

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('[DedupAI] Erreur:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erreur interne du serveur'
    }, { status: 500 });
  }
}
