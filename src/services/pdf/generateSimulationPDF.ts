/**
 * Générateur de PDF pour la simulation fiscale
 * Utilise React.createElement pour compatibilité Next.js API routes
 */

import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { SimulationPDF } from '@/components/pdf/SimulationPDF';
import type { SimulationResult, OptimizationSuggestion } from '@/types/fiscal';

export async function generateSimulationPDF(
  simulation: SimulationResult,
  suggestions: OptimizationSuggestion[] = []
): Promise<Buffer> {
  // Créer le composant avec React.createElement (pas de JSX)
  const pdfDocument = React.createElement(SimulationPDF, { simulation, suggestions });
  
  // Générer le PDF
  const buffer = await renderToBuffer(pdfDocument);
  
  return buffer;
}

