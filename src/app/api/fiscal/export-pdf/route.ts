/**
 * API Route : Export PDF de la simulation fiscale
 * POST /api/fiscal/export-pdf
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateSimulationPDF } from '@/services/pdf/generateSimulationPDF';
import type { SimulationResult, OptimizationSuggestion } from '@/types/fiscal';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const simulation: SimulationResult = body.simulation;
    const suggestions: OptimizationSuggestion[] = body.suggestions || [];

    if (!simulation) {
      return NextResponse.json(
        { error: 'Simulation manquante' },
        { status: 400 }
      );
    }

    // Générer le PDF avec les suggestions d'optimisation
    const pdfBuffer = await generateSimulationPDF(simulation, suggestions);

    // Nom du fichier
    const filename = `simulation-fiscale-${simulation.inputs.year}-${new Date().toISOString().split('T')[0]}.pdf`;

    // Retourner le PDF
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('[API Export PDF] Erreur:', error);
    return NextResponse.json(
      { 
        error: 'Erreur lors de la génération du PDF',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
