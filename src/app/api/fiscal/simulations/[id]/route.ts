/**
 * API Routes : Gestion d'une simulation spécifique
 * 
 * GET /api/fiscal/simulations/[id] - Récupère une simulation complète
 * DELETE /api/fiscal/simulations/[id] - Supprime une simulation
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { SimulationResult, FiscalInputs } from '@/types/fiscal';

// ============================================================================
// GET - Récupérer une simulation par ID
// ============================================================================


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const { id } = context.params;
    
    // TODO: Vérifier que l'utilisateur a accès à cette simulation
    const userId = 'demo-user';
    
    const simulation = await prisma.fiscalSimulation.findUnique({
      where: { id },
    });
    
    if (!simulation) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Simulation introuvable' 
        },
        { status: 404 }
      );
    }
    
    // Vérifier que l'utilisateur est propriétaire
    if (simulation.userId !== userId) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Accès non autorisé' 
        },
        { status: 403 }
      );
    }
    
    // Désérialiser les données JSON
    const inputs: FiscalInputs = JSON.parse(simulation.inputsJson);
    const result: SimulationResult = JSON.parse(simulation.resultJson);
    
    return NextResponse.json({
      success: true,
      simulation: {
        id: simulation.id,
        name: simulation.name,
        year: simulation.year,
        fiscalVersionId: simulation.fiscalVersionId,
        createdAt: simulation.createdAt,
        createdBy: simulation.createdBy,
        inputs,
        result,
      },
    });
  } catch (error: any) {
    console.error('[API Simulations GET by ID] Erreur:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Erreur lors du chargement de la simulation',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE - Supprimer une simulation
// ============================================================================

export async function DELETE(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const { id } = context.params;
    
    // TODO: Vérifier que l'utilisateur a accès à cette simulation
    const userId = 'demo-user';
    
    const simulation = await prisma.fiscalSimulation.findUnique({
      where: { id },
    });
    
    if (!simulation) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Simulation introuvable' 
        },
        { status: 404 }
      );
    }
    
    // Vérifier que l'utilisateur est propriétaire
    if (simulation.userId !== userId) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Accès non autorisé' 
        },
        { status: 403 }
      );
    }
    
    await prisma.fiscalSimulation.delete({
      where: { id },
    });
    
    console.log(`✅ Simulation supprimée: ${id} (${simulation.name})`);
    
    return NextResponse.json({
      success: true,
      message: 'Simulation supprimée avec succès',
    });
  } catch (error: any) {
    console.error('[API Simulations DELETE] Erreur:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Erreur lors de la suppression de la simulation',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

