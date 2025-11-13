/**
 * FiscalResultsPage - Page serveur pour l'espace résultats
 * 
 * Wrapper autour de FiscalResultsClient (client component)
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FiscalResultsClient } from '@/components/fiscal';
import { Skeleton } from '@/components/ui/Skeleton';
import type { SimulationResult } from '@/types/fiscal';

export function FiscalResultsPage() {
  const router = useRouter();
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [savedSimulationId, setSavedSimulationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Ne PAS charger automatiquement de simulation
  useEffect(() => {
    setLoading(false);
  }, []);

  const handleSave = async () => {
    if (!simulation) return;

    try {
      const response = await fetch('/api/fiscal/simulations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Simulation ${simulation.inputs.year + 1} (revenus ${simulation.inputs.year})`,
          anneeDeclaration: simulation.inputs.year + 1,
          inputs: simulation.inputs,
          result: simulation,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSavedSimulationId(data.id);
        
        // Mettre à jour le cache
        localStorage.setItem(
          'fiscal-simulation-cache',
          JSON.stringify({
            result: simulation,
            savedId: data.id,
          })
        );
      }
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
    }
  };

  const handleExportPDF = async () => {
    if (!simulation) return;

    try {
      const response = await fetch('/api/fiscal/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ simulation }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `simulation-fiscale-${simulation.inputs.year}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Erreur export PDF:', error);
    }
  };

  const handleGoToSimulation = () => {
    router.push('/impots/simulation');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  return (
    <FiscalResultsClient
      simulation={simulation}
      onSave={handleSave}
      onExportPDF={handleExportPDF}
      onGoToSimulation={handleGoToSimulation}
      savedSimulationId={savedSimulationId || undefined}
    />
  );
}

