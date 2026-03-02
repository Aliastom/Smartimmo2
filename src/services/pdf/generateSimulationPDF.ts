/**
 * Générateur de PDF pour la simulation fiscale
 * Utilise React.createElement pour compatibilité Next.js API routes
 */

import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { SimulationPDF } from '@/components/pdf/SimulationPDF';
import type { SimulationResult, OptimizationSuggestion } from '@/types/fiscal';
import type { SimulationPDFTransactionRow } from '@/components/pdf/SimulationPDF';

export async function generateSimulationPDF(
  simulation: SimulationResult,
  suggestions: OptimizationSuggestion[] = [],
  transactions: SimulationPDFTransactionRow[] = []
): Promise<Buffer> {
  const pdfDocument = React.createElement(SimulationPDF, {
    simulation,
    suggestions,
    transactions,
  });

  const buffer = await renderToBuffer(pdfDocument);
  return buffer;
}

