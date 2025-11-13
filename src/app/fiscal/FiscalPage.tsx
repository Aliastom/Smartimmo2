/**
 * FiscalPage - Page unifiée de l'Espace Fiscal
 * 
 * Orchestration des 5 onglets avec état global
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useFiscalStore } from '@/store/fiscalStore';
import { useFiscalTabs } from '@/hooks/useFiscalTabs';
import { FiscalTabs } from '@/components/fiscal/unified/FiscalTabs';
import { FiscalProgressBar } from '@/components/fiscal/unified/FiscalProgressBar';
import { SavedSimulationsDropdown } from '@/components/fiscal/SavedSimulationsDropdown';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Calculator, 
  Save, 
  FileDown, 
  Loader2, 
  Check, 
  Info,
} from 'lucide-react';

// Lazy load des onglets lourds
import dynamic from 'next/dynamic';

const SimulationTab = dynamic(() => import('@/components/fiscal/unified/tabs/SimulationTab'), {
  loading: () => <div className="p-6"><div className="h-96 bg-gray-100 animate-pulse rounded-2xl" /></div>,
});

const SyntheseTab = dynamic(() => import('@/components/fiscal/results/tabs/SyntheseTab').then(m => ({ default: m.SyntheseTab })), {
  loading: () => <div className="p-6"><div className="h-96 bg-gray-100 animate-pulse rounded-2xl" /></div>,
});

const DetailsTab = dynamic(() => import('@/components/fiscal/results/tabs/DetailsTab').then(m => ({ default: m.DetailsTab })), {
  loading: () => <div className="p-6"><div className="h-96 bg-gray-100 animate-pulse rounded-2xl" /></div>,
});

const ProjectionsTab = dynamic(() => import('@/components/fiscal/results/tabs/ProjectionsTab').then(m => ({ default: m.ProjectionsTab })), {
  loading: () => <div className="p-6"><div className="h-96 bg-gray-100 animate-pulse rounded-2xl" /></div>,
});

const OptimisationsTab = dynamic(() => import('@/components/fiscal/results/tabs/OptimisationsTab').then(m => ({ default: m.OptimisationsTab })), {
  loading: () => <div className="p-6"><div className="h-96 bg-gray-100 animate-pulse rounded-2xl" /></div>,
});

export function FiscalPage() {
  const { activeTab, setActiveTab } = useFiscalTabs();
  const { 
    simulationDraft,
    simulationResult, 
    status, 
    error,
    savedSimulationId,
    computeFiscalSimulation,
    setStatus,
    setSavedSimulationId,
    setResult,
    resetSimulation,
    updateDraft,
  } = useFiscalStore();

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedSimulations, setSavedSimulations] = useState<any[]>([]);
  const [loadingSimulations, setLoadingSimulations] = useState(false);
  const [optimizationCount, setOptimizationCount] = useState(0);
  const [optimizationSuggestions, setOptimizationSuggestions] = useState<any[]>([]);

  // Charger le nombre d'optimisations depuis l'API (PER, régimes, travaux, etc.)
  useEffect(() => {
    if (!simulationResult) {
      setOptimizationCount(0);
      return;
    }

    const loadOptimizationCount = async () => {
      try {
        // Si on a un simulationId sauvegardé, l'utiliser, sinon utiliser la dernière simulation
        const url = savedSimulationId 
          ? `/api/fiscal/optimize?simulationId=${savedSimulationId}`
          : '/api/fiscal/optimize';
        
        const response = await fetch(url);
        
        if (response.ok) {
          const data = await response.json();
          const totalSuggestions = data.suggestions?.length || 0;
          setOptimizationCount(totalSuggestions);
          setOptimizationSuggestions(data.suggestions || []); // ✅ Stocker les suggestions pour l'export PDF
          console.log(`✅ ${totalSuggestions} suggestion(s) d'optimisation disponible(s)`);
        } else {
          // Si erreur (pas encore de simulation sauvegardée), on peut pas avoir de suggestions
          setOptimizationCount(0);
          setOptimizationSuggestions([]);
        }
      } catch (error) {
        console.error('Erreur chargement optimisations:', error);
        setOptimizationCount(0);
        setOptimizationSuggestions([]);
      }
    };

    // Attendre un peu après le calcul pour que la simulation soit sauvegardée
    const timer = setTimeout(loadOptimizationCount, 500);
    return () => clearTimeout(timer);
  }, [simulationResult, savedSimulationId]);

  // Charger la liste des simulations sauvegardées et réinitialiser
  useEffect(() => {
    // 1. Nettoyer TOUS les caches au démarrage
    localStorage.removeItem('fiscal-simulation-cache');
    localStorage.removeItem('fiscal-store');
    
    // 2. Réinitialiser complètement le store (page vide)
    resetSimulation();
    
    // 3. Charger la liste des simulations
    loadSavedSimulations();
  }, []);

  const loadSavedSimulations = async () => {
    setLoadingSimulations(true);
    try {
      const response = await fetch('/api/fiscal/simulations?limit=20');
      if (response.ok) {
        const data = await response.json();
        const sims = data.simulations || [];
        
        console.log('📥 Simulations chargées:', sims.length);
        sims.forEach((sim: any) => {
          console.log('  -', sim.name, '| dateCalcul:', sim.dateCalcul, '| type:', typeof sim.dateCalcul);
        });
        
        setSavedSimulations(sims);
      }
    } catch (error) {
      console.error('Erreur chargement simulations:', error);
    } finally {
      setLoadingSimulations(false);
    }
  };

  const handleLoadSimulation = async (simulationId: string) => {
    try {
      console.log('🔄 Chargement simulation:', simulationId);
      
      // Charger depuis l'API pour avoir toutes les données
      const response = await fetch(`/api/fiscal/simulations/${simulationId}`);
      
      if (!response.ok) {
        throw new Error('Simulation introuvable');
      }
      
      const data = await response.json();
      const { result, inputs } = data.simulation;
      
      console.log('✅ Simulation chargée:', data.simulation.name);
      
      // Mettre à jour le store avec TOUS les inputs (incluant _uiMetadata)
      if (inputs) {
        updateDraft(inputs);
      }
      setResult(result);
      setSavedSimulationId(simulationId);
      
      // Basculer sur Synthèse
      setActiveTab('synthese');
    } catch (error) {
      console.error('Erreur chargement simulation:', error);
      alert('Erreur lors du chargement de la simulation');
    }
  };

  // Supprimer une simulation
  const handleDeleteSimulation = async (simulationId: string) => {
    try {
      const response = await fetch(`/api/fiscal/simulations/${simulationId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la suppression');
      }

      console.log('✅ Simulation supprimée:', simulationId);

      // Si c'était la simulation active, la désélectionner
      if (savedSimulationId === simulationId) {
        setSavedSimulationId(null);
      }

      // Recharger la liste
      await loadSavedSimulations();
    } catch (error) {
      console.error('Erreur suppression simulation:', error);
      throw error; // Re-throw pour que le composant puisse gérer l'erreur
    }
  };


  // Calculer la simulation
  const handleCalculate = async () => {
    try {
      await computeFiscalSimulation();
      // Basculer automatiquement sur Synthèse
      setActiveTab('synthese');
    } catch (error) {
      console.error('Erreur calcul:', error);
    }
  };

  // Sauvegarder la simulation
  const handleSave = async () => {
    if (!simulationResult) return;

    setSaving(true);
    setSaved(false);

    try {
      const response = await fetch('/api/fiscal/simulations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Simulation ${simulationResult.inputs.year + 1} (revenus ${simulationResult.inputs.year})`,
          inputs: { ...simulationResult.inputs, ...simulationDraft }, // ✅ Fusionner avec simulationDraft pour préserver _uiMetadata
          result: simulationResult,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSavedSimulationId(data.simulation.id);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
        
        // Recharger la liste des simulations
        await loadSavedSimulations();
      }
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
    } finally {
      setSaving(false);
    }
  };

  // Exporter en PDF
  const handleExportPDF = async () => {
    if (!simulationResult) return;

    try {
      const response = await fetch('/api/fiscal/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          simulation: simulationResult,
          suggestions: optimizationSuggestions, // ✅ Inclure les suggestions d'optimisation
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `simulation-fiscale-${simulationResult.inputs.year}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Erreur export PDF:', error);
    }
  };

  const hasSimulation = !!simulationResult;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header sticky avec fond glassy/transparent */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md shadow-sm border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          {/* Titre + Dropdown sauvegardes */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-gray-900">Espace fiscal</h1>
              
              {/* Mini-dropdown des simulations sauvegardées */}
              <SavedSimulationsDropdown
                simulations={savedSimulations}
                currentSimulationId={savedSimulationId}
                onLoad={handleLoadSimulation}
                onDelete={handleDeleteSimulation}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {/* Calculer (visible dans onglet Simulation) */}
              {activeTab === 'simulation' && (
                <Button
                  onClick={handleCalculate}
                  disabled={status === 'calculating'}
                  size="lg"
                  className="gap-2"
                >
                  {status === 'calculating' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Calcul en cours...
                    </>
                  ) : (
                    <>
                      <Calculator className="h-4 w-4" />
                      {hasSimulation ? 'Mettre à jour' : 'Calculer la simulation'}
                    </>
                  )}
                </Button>
              )}

              {/* Sauvegarder */}
              {hasSimulation && (
                <Button
                  onClick={handleSave}
                  variant="outline"
                  disabled={saving || saved}
                  className="gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sauvegarde...
                    </>
                  ) : saved ? (
                    <>
                      <Check className="h-4 w-4 text-green-600" />
                      Sauvegardé !
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Sauvegarder
                    </>
                  )}
                </Button>
              )}

              {/* Export PDF */}
              {hasSimulation && (
                <Button
                  onClick={handleExportPDF}
                  variant="outline"
                  className="gap-2"
                >
                  <FileDown className="h-4 w-4" />
                  Export PDF
                </Button>
              )}
            </div>
          </div>

          {/* Navigation onglets + Badges */}
          <div className="flex items-center justify-between">
            <FiscalTabs
              activeTab={activeTab}
              onTabChange={setActiveTab}
              hasSimulation={hasSimulation}
              badges={{ optimisations: optimizationCount }}
            />
            
            {/* Badges année et version à droite */}
            {simulationResult && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-300">
                  Année {simulationResult.inputs.year}
                </Badge>
                <Badge variant="outline" className="bg-sky-100 text-sky-700 border-sky-300">
                  {simulationResult.taxParams.version}
                </Badge>
              </div>
            )}
          </div>

          {/* Barre de progression (dans le header sticky) */}
          <div className="mt-4">
            <FiscalProgressBar activeTab={activeTab} hasSimulation={hasSimulation} />
          </div>
        </div>
      </div>


      {/* Erreur */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 py-4">
          <Alert variant="destructive">
            <Info className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Contenu principal */}
      <div className="w-full">
        <div
          role="tabpanel"
          id={`tabpanel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
        >
          {activeTab === 'simulation' && <SimulationTab />}
          
          {activeTab === 'synthese' && simulationResult && (
            <SyntheseTab
              simulation={simulationResult}
              onGoToDetails={() => setActiveTab('details')}
              onGoToOptimizations={() => setActiveTab('optimisations')}
            />
          )}

          {activeTab === 'details' && simulationResult && (
            <DetailsTab
              simulation={simulationResult}
              onOpenProjectionModal={() => setActiveTab('projections')}
              onExportPDF={handleExportPDF}
            />
          )}

          {activeTab === 'projections' && simulationResult && (
            <ProjectionsTab
              biens={simulationResult.biens}
              year={simulationResult.inputs.year}
            />
          )}

          {activeTab === 'optimisations' && simulationResult && (
            <OptimisationsTab
              simulationId={savedSimulationId || undefined}
              onGoToNewSimulation={() => setActiveTab('simulation')}
            />
          )}
        </div>
      </div>
    </div>
  );
}

