/**
 * API Endpoint pour le module DedupFlow
 * 
 * Orchestre le flux de déduplication selon la décision de l'utilisateur
 */

import { NextRequest, NextResponse } from 'next/server';
import { dedupFlowService } from '@/services/dedup-flow.service';
import { DedupFlowInput, DedupFlowContext } from '@/types/dedup-flow';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('[DedupFlow API] Requête reçue:', {
      duplicateType: body.duplicateType,
      userDecision: body.userDecision,
      tempId: body.tempFile?.tempId
    });

    // Validation des données d'entrée
    const requiredFields = ['duplicateType', 'userDecision', 'tempFile'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json({
          success: false,
          error: `Champ manquant: ${field}`
        }, { status: 400 });
      }
    }

    // Préparation des données d'entrée
    const input: DedupFlowInput = {
      duplicateType: body.duplicateType,
      existingFile: body.existingFile,
      tempFile: body.tempFile,
      userDecision: body.userDecision
    };

    const context: DedupFlowContext = {
      scope: body.scope || 'global',
      scopeId: body.scopeId,
      metadata: body.metadata
    };

    // Orchestration du flux
    const result = await dedupFlowService.orchestrateFlow(input, context);

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 500 });
    }

    console.log('[DedupFlow API] Flux orchestré:', {
      flow: result.data?.flow,
      nextStep: result.nextStep,
      flags: result.data?.flags
    });

    return NextResponse.json({
      success: true,
      data: result.data,
      nextStep: result.nextStep
    });

  } catch (error) {
    console.error('[DedupFlow API] Erreur:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erreur interne du serveur'
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('[DedupFlow API] Traitement résultat API:', body);

    // Traitement du résultat d'une action API
    const { output, apiResult } = body;

    if (!output || !apiResult) {
      return NextResponse.json({
        success: false,
        error: 'Données manquantes pour le traitement du résultat'
      }, { status: 400 });
    }

    const result = await dedupFlowService.processApiResult(output, apiResult);

    return NextResponse.json({
      success: result.success,
      data: result.data,
      nextStep: result.nextStep,
      error: result.error
    });

  } catch (error) {
    console.error('[DedupFlow API] Erreur traitement résultat:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erreur interne du serveur'
    }, { status: 500 });
  }
}
