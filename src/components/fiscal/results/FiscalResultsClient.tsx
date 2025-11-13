/**
 * FiscalResultsClient - Page unifiée des résultats fiscaux
 * 
 * Intègre les 4 onglets : Synthèse, Détails, Projections, Optimisations
 */

'use client';

import { useMemo } from 'react';
import { useResultsRouting } from '@/hooks/useResultsRouting';
import { ResultsTabs } from './ResultsTabs';
import { KpiCard } from './KpiCard';
import { Button } from '@/components/ui/Button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SyntheseTab } from './tabs/SyntheseTab';
import { DetailsTab } from './tabs/DetailsTab';
import { ProjectionsTab } from './tabs/ProjectionsTab';
import { OptimisationsTab } from './tabs/OptimisationsTab';
import { 
  Euro, 
  Home, 
  Percent, 
  Save, 
  FileDown,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';
import type { SimulationResult } from '@/types/fiscal';

interface FiscalResultsClientProps {
  simulation: SimulationResult | null;
  onSave?: () => void;
  onExportPDF?: () => void;
  onGoToSimulation?: () => void;
  savedSimulationId?: string;
}

export function FiscalResultsClient({
  simulation,
  onSave,
  onExportPDF,
  onGoToSimulation,
  savedSimulationId,
}: FiscalResultsClientProps) {
  const { activeTab, setActiveTab } = useResultsRouting();

  const formatEuro = (amount: number) =>
    new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  const formatPercent = (rate: number) => `${(rate * 100).toFixed(1)} %`;

  // Calculer le nombre de suggestions d'optimisation
  const badgeCounts = useMemo(() => {
    if (!simulation || !simulation.biens || !Array.isArray(simulation.biens)) {
      return {};
    }

    const regimesNonOptimaux = simulation.biens.filter((bien) => {
      const regimeUtilise = bien.regimeUtilise || 'micro';
      const regimeSuggere = bien.regimeSuggere || regimeUtilise;
      const gainPotentiel = bien.details?.economieRegimeReel || 0;
      return regimeUtilise !== regimeSuggere && Math.abs(gainPotentiel) >= 20;
    }).length;

    return {
      optimisations: regimesNonOptimaux,
    };
  }, [simulation]);

  // Empty state si pas de simulation
  if (!simulation) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Aucune simulation en cache. Veuillez relancer une simulation.
          </AlertDescription>
        </Alert>
        {onGoToSimulation && (
          <Button onClick={onGoToSimulation} size="lg" className="mt-4">
            Relancer une simulation
          </Button>
        )}
      </div>
    );
  }

  // Calculer les KPIs résumé
  const totalImpots = simulation.ir.impotNet + (simulation.ps.montant || 0);
  // Calculer les totaux depuis les biens
  const loyersTotal = simulation.biens?.reduce((sum, b) => sum + (b.recettesBrutes || b.loyers || 0), 0) || 0;
  const chargesTotal = simulation.biens?.reduce((sum, b) => sum + (b.chargesDeductibles || b.charges || 0) + (b.interetsEmprunt || b.interets || 0), 0) || 0;
  const beneficeNet = loyersTotal - chargesTotal - totalImpots;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header sticky avec KPIs et actions */}
      <div className="sticky top-0 z-10 bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          {/* KPIs compactes */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <KpiCard
              title="Total impôts (IR+PS)"
              value={formatEuro(totalImpots)}
              valueColor="text-violet-600"
              icon={<Euro className="h-5 w-5" />}
              size="sm"
            />

            <KpiCard
              title="Bénéfice net immobilier"
              value={formatEuro(beneficeNet)}
              valueColor={beneficeNet >= 0 ? 'text-emerald-600' : 'text-rose-600'}
              icon={<Home className="h-5 w-5" />}
              size="sm"
            />

        <KpiCard
          title="Taux effectif"
          value={formatPercent(simulation.resume?.tauxEffectif || 0)}
          valueColor="text-sky-600"
          icon={<Percent className="h-5 w-5" />}
          size="sm"
        />

            <KpiCard
              title="Tranche marginale"
              value={formatPercent(simulation.ir.trancheMarginate)}
              valueColor="text-purple-600"
              icon={<TrendingUp className="h-5 w-5" />}
              size="sm"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <ResultsTabs 
              activeTab={activeTab} 
              onTabChange={setActiveTab} 
              badges={badgeCounts}
            />

            <div className="flex items-center gap-2">
              {onSave && (
                <Button variant="outline" size="sm" onClick={onSave}>
                  <Save className="h-4 w-4 mr-2" />
                  Sauvegarder
                </Button>
              )}

              {onExportPDF && (
                <Button variant="outline" size="sm" onClick={onExportPDF}>
                  <FileDown className="h-4 w-4 mr-2" />
                  Export PDF
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-7xl mx-auto">
        <div
          role="tabpanel"
          id={`tabpanel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
        >
          {activeTab === 'synthese' && (
            <SyntheseTab
              simulation={simulation}
              onGoToDetails={() => setActiveTab('details')}
              onGoToOptimizations={() => setActiveTab('optimisations')}
            />
          )}

          {activeTab === 'details' && (
            <DetailsTab
              simulation={simulation}
              onOpenProjectionModal={() => setActiveTab('projections')}
              onExportPDF={onExportPDF}
            />
          )}

          {activeTab === 'projections' && (
            <ProjectionsTab
              biens={simulation.biens}
              year={simulation.inputs.year}
            />
          )}

          {activeTab === 'optimisations' && (
            <OptimisationsTab
              simulationId={savedSimulationId}
              onGoToNewSimulation={onGoToSimulation}
            />
          )}
        </div>
      </div>
    </div>
  );
}

