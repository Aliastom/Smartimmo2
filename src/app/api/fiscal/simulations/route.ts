/**
 * API Routes : Gestion des simulations fiscales
 * 
 * GET /api/fiscal/simulations - Liste les simulations de l'utilisateur
 * POST /api/fiscal/simulations - Crée une nouvelle simulation
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { SimulationResult, FiscalInputs } from '@/types/fiscal';

// ============================================================================
// GET - Lister les simulations
// ============================================================================


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // TODO: Récupérer userId depuis session
    const userId = 'demo-user';
    
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const limit = parseInt(searchParams.get('limit') || '20');
    
    const where: any = { userId };
    if (year) {
      where.year = parseInt(year);
    }
    
    const simulations = await prisma.fiscalSimulation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        name: true,
        year: true,
        fiscalVersionId: true,
        createdAt: true,
        createdBy: true,
        updatedAt: true,
        // On ne charge pas inputsJson et resultJson pour optimiser
      },
    });
    
    return NextResponse.json({
      success: true,
      simulations,
      count: simulations.length,
    });
  } catch (error: any) {
    console.error('[API Simulations GET] Erreur:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Erreur lors du chargement des simulations',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Créer une nouvelle simulation
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // TODO: Récupérer userId depuis session
    const userId = 'demo-user';
    const createdBy = 'demo-user'; // TODO: session.user.email
    
    const body = await request.json();
    const { name, inputs, result } = body as {
      name?: string;
      inputs: FiscalInputs;
      result: SimulationResult;
    };
    
    if (!inputs || !result) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Données manquantes (inputs, result)' 
        },
        { status: 400 }
      );
    }
    
    // Créer la simulation
    const simulation = await prisma.fiscalSimulation.create({
      data: {
        userId,
        name: name || `Simulation ${result.inputs.year}`,
        year: result.inputs.year,
        fiscalVersionId: result.taxParams.version,
        inputsJson: JSON.stringify(inputs),
        resultJson: JSON.stringify(result),
        createdBy,
      },
    });
    
    console.log(`✅ Simulation sauvegardée: ${simulation.id} (${simulation.name})`);
    
    return NextResponse.json({
      success: true,
      simulation: {
        id: simulation.id,
        name: simulation.name,
        year: simulation.year,
        fiscalVersionId: simulation.fiscalVersionId,
        createdAt: simulation.createdAt,
      },
      message: 'Simulation sauvegardée avec succès',
    });
  } catch (error: any) {
    console.error('[API Simulations POST] Erreur:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Erreur lors de la sauvegarde de la simulation',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

