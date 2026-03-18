/**
 * Core Component pour la page Fiscal
 * 
 * Une seule source de vérité graphique utilisable en mode "normal" et "app-shell"
 * Toute la logique UI est centralisée ici.
 * 
 * Réplique EXACTEMENT le comportement de FiscalPage.tsx
 */

'use client';

import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useFiscalStore } from '@/store/fiscalStore';
import { useFiscalTabs } from '@/hooks/useFiscalTabs';
import { useExpertModeStore } from '@/store/expertModeStore';
import { FiscalProgressBar } from '@/components/fiscal/unified/FiscalProgressBar';
import { SavedSimulationsDropdown } from '@/components/fiscal/SavedSimulationsDropdown';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { Switch } from '@/components/ui/Switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip';
import { 
  Calculator, 
  Save, 
  FileDown, 
  Loader2, 
  Check, 
  Info,
  FileText,
  Coins,
  PiggyBank,
  Percent,
  Menu,
  X,
} from 'lucide-react';
import { FiscalCalculatingOverlay } from '@/components/fiscal/FiscalCalculatingOverlay';
import { FiscalHeaderControls } from '@/components/fiscal/FiscalHeaderControls';
import { useSidebarOptional } from '@/contexts/SidebarContext';
import { useFiscalSession, FiscalSessionProvider } from '@/hooks/useFiscalSession';

// ✅ IMPORT STATIQUE pour garantir le fonctionnement offline (évite ChunkLoadError en app-shell)
import SimulationTab from '@/components/fiscal/unified/tabs/SimulationTab';
import { SyntheseTab } from '@/components/fiscal/results/tabs/SyntheseTab';
import { DetailsTab } from '@/components/fiscal/results/tabs/DetailsTab';
import { DeclarationTab } from '@/components/fiscal/results/tabs/DeclarationTab';
import { ProjectionsTab } from '@/components/fiscal/results/tabs/ProjectionsTab';
import { OptimisationsTab } from '@/components/fiscal/results/tabs/OptimisationsTab';
import { useToast } from '@/hooks/use-toast';

export interface FiscalPageCoreProps {
  mode: 'normal' | 'app-shell';
}

export function FiscalPageCore({ mode }: FiscalPageCoreProps) {
  return (
    <FiscalSessionProvider>
      <FiscalPageCoreInner mode={mode} />
    </FiscalSessionProvider>
  );
}

function FiscalPageCoreInner({ mode }: FiscalPageCoreProps) {
  const { activeTab, setActiveTab } = useFiscalTabs();
  const { isExpertMode, toggleExpertMode } = useExpertModeStore();
  const sidebarContext = useSidebarOptional();
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
  const { session: fiscalSession } = useFiscalSession();

  // Synchroniser le draft avec la session fiscale dès que la session change (ex. combobox Déclaration)
  useEffect(() => {
    if (!fiscalSession) return;
    const incomeYear = fiscalSession.incomeYear;
    const baremeCode = fiscalSession.baremeCode;
    const currentYear = simulationDraft.year;
    const currentBareme = (simulationDraft._uiMetadata as any)?.baremeCode;
    if (currentYear !== incomeYear || currentBareme !== baremeCode) {
      console.log('[Fiscal] Sync draft: année revenus', currentYear, '→', incomeYear);
      updateDraft({
        year: incomeYear,
        _uiMetadata: {
          ...(simulationDraft._uiMetadata as object),
          baremeCode,
        },
      });
    }
  }, [fiscalSession?.incomeYear, fiscalSession?.baremeCode, fiscalSession?.updatedAt, simulationDraft.year, simulationDraft._uiMetadata, updateDraft]);

  // Fonction de formatage
  const formatEuro = (amount: number) =>
    new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedSimulations, setSavedSimulations] = useState<any[]>([]);
  const [loadingSimulations, setLoadingSimulations] = useState(false);
  const [optimizationCount, setOptimizationCount] = useState(0);
  const [optimizationSuggestions, setOptimizationSuggestions] = useState<any[]>([]);
  const [isOptimizationLoading, setIsOptimizationLoading] = useState(false);
  const [loadingSimulationId, setLoadingSimulationId] = useState<string | null>(null);
  const optimizationAbortControllerRef = useRef<AbortController | null>(null);
  const optimizationLoadedRef = useRef<string | null>(null);
  const optimizationJustLoadedInCalculateRef = useRef<boolean>(false);
  const { toast } = useToast();
  
  // États pour le suivi de progression du calcul
  const [calculatingProgress, setCalculatingProgress] = useState({
    stepsProcessed: 0,
    totalSteps: 6,
    currentStep: '',
    startTime: 0,
  });

  // Charger le nombre d'optimisations depuis l'API
  useEffect(() => {
    if (!simulationResult || status === 'calculating') {
      if (status !== 'calculating') {
        setOptimizationCount(0);
        optimizationLoadedRef.current = null;
        optimizationJustLoadedInCalculateRef.current = false;
      }
      return;
    }

    if (optimizationJustLoadedInCalculateRef.current) {
      return;
    }

    if (!savedSimulationId) {
      return;
    }

    const simulationKey = savedSimulationId;
    
    if (optimizationLoadedRef.current === simulationKey) {
      return;
    }
    
    if (isOptimizationLoading) {
      return;
    }

    const loadOptimizationCount = async () => {
      if (optimizationAbortControllerRef.current) {
        optimizationAbortControllerRef.current.abort();
      }

      const controller = new AbortController();
      optimizationAbortControllerRef.current = controller;
      setIsOptimizationLoading(true);
      
      optimizationLoadedRef.current = simulationKey;

      try {
        const url = savedSimulationId 
          ? `/api/fiscal/optimize?simulationId=${savedSimulationId}`
          : '/api/fiscal/optimize';
        
        const response = await fetch(url, { signal: controller.signal });
        
        if (response.ok) {
          const data = await response.json();
          const totalSuggestions = data.suggestions?.length || 0;
          setOptimizationCount(totalSuggestions);
          setOptimizationSuggestions(data.suggestions || []);
        } else {
          setOptimizationCount(0);
          setOptimizationSuggestions([]);
          optimizationLoadedRef.current = null;
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          optimizationLoadedRef.current = null;
        } else {
          console.error('Erreur chargement optimisations:', error);
          setOptimizationCount(0);
          setOptimizationSuggestions([]);
          optimizationLoadedRef.current = null;
        }
      } finally {
        setIsOptimizationLoading(false);
        if (optimizationAbortControllerRef.current === controller) {
          optimizationAbortControllerRef.current = null;
        }
      }
    };

    loadOptimizationCount();
    
    return () => {
      if (optimizationAbortControllerRef.current) {
        optimizationAbortControllerRef.current.abort();
        optimizationAbortControllerRef.current = null;
      }
    };
  }, [simulationResult, savedSimulationId, status]);

  // Au montage : réinitialiser le store pour partir sur un formulaire vide
  // Les données apparaissent uniquement quand l'utilisateur charge une sauvegarde
  useEffect(() => {
    localStorage.removeItem('fiscal-simulation-cache');
    localStorage.removeItem('fiscal-store');
    resetSimulation();
    loadSavedSimulations();
  }, [mode]);

  // ✅ Si on est sur un onglet résultat (synthese, details, etc.) sans simulation → revenir à Simulation
  useEffect(() => {
    const resultsTabs = ['synthese', 'details', 'declaration', 'projections', 'optimisations'];
    if (resultsTabs.includes(activeTab) && !simulationResult) {
      setActiveTab('simulation');
    }
  }, [activeTab, simulationResult, setActiveTab]);

  const loadSavedSimulations = async () => {
    setLoadingSimulations(true);
    try {
      const response = await fetch('/api/fiscal/simulations?limit=20');
      if (response.ok) {
        const data = await response.json();
        const sims = data.simulations || [];
        setSavedSimulations(sims);
      }
    } catch (error) {
      console.error('Erreur chargement simulations:', error);
    } finally {
      setLoadingSimulations(false);
    }
  };

  const handleLoadSimulation = async (simulationId: string) => {
    setLoadingSimulationId(simulationId);
    try {
      optimizationJustLoadedInCalculateRef.current = false;

      const response = await fetch(`/api/fiscal/simulations/${simulationId}`);

      if (!response.ok) {
        throw new Error('Simulation introuvable');
      }

      const data = await response.json();
      const simulationData = data?.simulation;
      const result = simulationData?.result;
      const inputs = simulationData?.inputs;

      console.log('Loaded simulation:', { id: simulationId, hasResult: !!result, hasInputs: !!inputs, inputsKeys: inputs ? Object.keys(inputs) : [] });

      if (!result || !inputs) {
        if (toast?.error) toast.error('Erreur de chargement de la sauvegarde');
        else alert('Erreur de chargement de la sauvegarde');
        return;
      }

      // Mise à jour du draft (fusion pour ne pas écraser par des undefined)
      updateDraft({
        ...inputs,
        foyer: inputs.foyer ? { ...inputs.foyer } : undefined,
        options: inputs.options ? { ...inputs.options } : undefined,
        _uiMetadata: inputs._uiMetadata ? { ...(inputs._uiMetadata as object) } : undefined,
      });
      setResult(result);
      setSavedSimulationId(simulationId);

      setActiveTab('synthese');
    } catch (error) {
      console.error('Erreur chargement simulation:', error);
      if (toast?.error) toast.error('Erreur lors du chargement de la simulation');
      else alert('Erreur lors du chargement de la simulation');
    } finally {
      setLoadingSimulationId(null);
    }
  };

  const handleDeleteSimulation = async (simulationId: string) => {
    try {
      const response = await fetch(`/api/fiscal/simulations/${simulationId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la suppression');
      }

      if (savedSimulationId === simulationId) {
        setSavedSimulationId(null);
      }

      await loadSavedSimulations();
    } catch (error) {
      console.error('Erreur suppression simulation:', error);
      throw error;
    }
  };

  // Calculer la simulation
  const handleCalculate = async () => {
    const startTime = Date.now();
    
    optimizationJustLoadedInCalculateRef.current = false;
    
    setCalculatingProgress({
      stepsProcessed: 0,
      totalSteps: 6,
      currentStep: '',
      startTime,
    });
    
    const steps = [
      'Analyse des biens immobiliers',
      'Calcul des revenus fonciers',
      'Optimisation des régimes fiscaux',
      'Calcul de l\'impôt sur le revenu',
      'Optimisation fiscale',
      'Finalisation de la simulation',
    ];
    
    let progressInterval: NodeJS.Timeout | null = null;
    
    progressInterval = setInterval(() => {
      setCalculatingProgress((prev) => {
        if (prev.stepsProcessed >= 4) {
          if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = null;
          }
          return prev;
        }
        
        const elapsed = (Date.now() - prev.startTime) / 1000;
        const estimatedStep = Math.min(Math.floor(elapsed / 0.9), 4);
        
        return {
          ...prev,
          stepsProcessed: estimatedStep,
          currentStep: estimatedStep < steps.length ? steps[estimatedStep] : '',
        };
      });
    }, 600);
    
    try {
      await computeFiscalSimulation();
      
      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }
      
      setStatus('calculating');
      
      for (let i = 0; i < 4; i++) {
        setCalculatingProgress({
          stepsProcessed: i + 1,
          totalSteps: 6,
          currentStep: '',
          startTime,
        });
        await new Promise(resolve => setTimeout(resolve, 150));
      }
      
      setCalculatingProgress({
        stepsProcessed: 4,
        totalSteps: 6,
        currentStep: 'Optimisation fiscale',
        startTime,
      });
      
      if (optimizationAbortControllerRef.current) {
        optimizationAbortControllerRef.current.abort();
      }

      const controller = new AbortController();
      optimizationAbortControllerRef.current = controller;
      setIsOptimizationLoading(true);
      
      const simulationKey = savedSimulationId || `current-${simulationResult?.inputs?.year || 'unknown'}`;
      
      optimizationLoadedRef.current = simulationKey;
      optimizationJustLoadedInCalculateRef.current = true;
      
      try {
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const currentResult = useFiscalStore.getState().simulationResult;
        
        const response = await fetch('/api/fiscal/optimize', { 
          signal: controller.signal,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            inputs: currentResult?.inputs || null,
            useRecent: !!currentResult?.inputs,
          }),
        });
        if (response.ok) {
          const data = await response.json();
          const totalSuggestions = data.suggestions?.length || 0;
          setOptimizationCount(totalSuggestions);
          setOptimizationSuggestions(data.suggestions || []);
          optimizationLoadedRef.current = simulationKey;
          optimizationJustLoadedInCalculateRef.current = true;
        } else {
          optimizationLoadedRef.current = null;
          optimizationJustLoadedInCalculateRef.current = false;
        }
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error('Erreur optimisation:', error);
        }
        optimizationJustLoadedInCalculateRef.current = false;
      } finally {
        setIsOptimizationLoading(false);
        if (optimizationAbortControllerRef.current === controller) {
          optimizationAbortControllerRef.current = null;
        }
      }
      
      setCalculatingProgress({
        stepsProcessed: 5,
        totalSteps: 6,
        currentStep: 'Finalisation de la simulation',
        startTime,
      });
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setCalculatingProgress({
        stepsProcessed: 6,
        totalSteps: 6,
        currentStep: '',
        startTime,
      });
      
      await new Promise(resolve => setTimeout(resolve, 400));
      
      setStatus('done');
      setActiveTab('synthese');
    } catch (error) {
      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }
      console.error('Erreur calcul:', error);
    } finally {
      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }
      setTimeout(() => {
        setCalculatingProgress({
          stepsProcessed: 0,
          totalSteps: 6,
          currentStep: '',
          startTime: 0,
        });
      }, 500);
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
          inputs: { ...simulationResult.inputs, ...simulationDraft },
          result: simulationResult,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSavedSimulationId(data.simulation.id);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
        
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
          suggestions: optimizationSuggestions,
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

  const estimatedTimeRemaining = calculatingProgress.startTime > 0 && calculatingProgress.totalSteps > 0
    ? (() => {
        const time = ((calculatingProgress.totalSteps - calculatingProgress.stepsProcessed) * 0.9);
        return time > 0 ? time : undefined;
      })()
    : undefined;

  return (
    <>
      {/* Overlay de calcul avec progression */}
      <FiscalCalculatingOverlay
        isCalculating={status === 'calculating'}
        totalSteps={calculatingProgress.totalSteps}
        stepsProcessed={calculatingProgress.stepsProcessed}
        currentStep={calculatingProgress.currentStep}
        estimatedTime={estimatedTimeRemaining}
      />

      {/* Garde chargement sauvegarde : éviter écran vide / overwrite par état vide */}
      {loadingSimulationId && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-white/80 backdrop-blur-sm">
          <Card className="p-6 max-w-sm">
            <CardContent className="flex flex-col items-center gap-3 pt-6">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
              <p className="text-sm font-medium text-gray-700">Chargement de la sauvegarde...</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="min-h-screen bg-gray-50">
      {/* Header sticky avec fond glassy/transparent */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md shadow-sm border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          {/* Titre + Dropdown sauvegardes */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
              {/* Bouton hamburger mobile - Discret, aligné à gauche du titre */}
              {sidebarContext && (
                <button
                  onClick={sidebarContext.toggleSidebar}
                  className="lg:hidden flex items-center justify-center w-10 h-10 min-w-[40px] min-h-[40px] flex-shrink-0 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                  aria-label={sidebarContext.sidebarOpen ? "Fermer le menu" : "Ouvrir le menu"}
                >
                  {sidebarContext.sidebarOpen ? (
                    <X className="h-5 w-5" />
                  ) : (
                    <Menu className="h-5 w-5" />
                  )}
                </button>
              )}
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate min-w-0">Espace fiscal</h1>
              
              {/* Mini-dropdown des simulations sauvegardées */}
              <SavedSimulationsDropdown
                simulations={savedSimulations}
                currentSimulationId={savedSimulationId}
                onLoad={handleLoadSimulation}
                onDelete={handleDeleteSimulation}
                loading={!!loadingSimulationId}
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
              
              {/* Toggle Mode Expert */}
              {hasSimulation && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors">
                        <Switch
                          checked={isExpertMode}
                          onCheckedChange={toggleExpertMode}
                        />
                        <span className="text-sm font-medium text-gray-700">
                          Mode expert
                        </span>
                        {isExpertMode && (
                          <Badge variant="outline" className="bg-indigo-100 text-indigo-700 border-indigo-300 text-xs">
                            ON
                          </Badge>
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs text-xs">
                        Active des détails avancés : calculs tranche par tranche, cohérence fiscale, scénarios, overrides, etc.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>

          {/* Barre de progression cliquable (remplace les onglets) */}
          <div className="mt-4">
            {/* Sélecteurs Déclaration / Barème + badges session */}
            <div className="mb-3">
              <FiscalHeaderControls />
            </div>
            {/* Badges résultat simulation (si calcul effectué) */}
            {simulationResult && (
              <div className="flex items-center justify-end gap-2 mb-3">
                <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-300">
                  Revenus {simulationResult.inputs.year}
                </Badge>
                <Badge variant="outline" className="bg-sky-100 text-sky-700 border-sky-300">
                  Barème {simulationResult.taxParams.version}
                </Badge>
                {optimizationCount > 0 && (
                  <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300">
                    {optimizationCount} optimisation{optimizationCount > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            )}
            
            <FiscalProgressBar 
              activeTab={activeTab} 
              hasSimulation={hasSimulation}
              onTabChange={setActiveTab}
            />
          </div>
        </div>
      </div>

      {/* KPI principales - Visibles sur tous les onglets */}
      {simulationResult && (
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {(() => {
              const totalImpots = simulationResult.resume?.totalImpots || 0;
              const beneficeNet = simulationResult.resume?.beneficeNetImmobilier || 0;
              const prelevementSourceDejaPaye = simulationResult.inputs?.options?.prelevementSourceDejaPaye || 0;
              const acomptesDejaPayes = simulationResult.inputs?.options?.acomptesDejaPayes || 0;
              const totalDejaPaye = prelevementSourceDejaPaye + acomptesDejaPayes;
              const impotRestantAPayer = Math.max(0, totalImpots - totalDejaPaye);
              
              return (
                <>
                  <Card className="bg-white/70 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-xs font-medium text-gray-600 mb-1">BASE IMPOSABLE</p>
                          <p className="text-2xl font-bold text-purple-600 mb-1">
                            {formatEuro(simulationResult.ir.revenuImposable)}
                          </p>
                          <p className="text-xs text-gray-500">Assiette de calcul de l'impôt</p>
                        </div>
                        <FileText className="h-6 w-6 text-purple-400" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white/70 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-xs font-medium text-gray-600 mb-1">
                            {totalDejaPaye > 0 ? 'IMPÔT RESTANT À PAYER' : 'TOTAL IMPÔTS'}
                          </p>
                          <p className="text-2xl font-bold text-orange-600 mb-1">
                            {formatEuro(totalDejaPaye > 0 ? impotRestantAPayer : totalImpots)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {totalDejaPaye > 0 ? `Déjà payé: ${formatEuro(totalDejaPaye)}` : 'IR + PS'}
                          </p>
                        </div>
                        <Coins className="h-6 w-6 text-orange-400" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white/70 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-xs font-medium text-gray-600 mb-1">RÉSULTAT NET APRÈS IMPÔT</p>
                          <p className="text-2xl font-bold text-emerald-600 mb-1">
                            {formatEuro(beneficeNet)}
                          </p>
                          <p className="text-xs text-gray-500">Argent réellement conservé</p>
                        </div>
                        <PiggyBank className="h-6 w-6 text-emerald-400" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white/70 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-xs font-medium text-gray-600 mb-1">Taux moyen</p>
                          <p className="text-2xl font-bold text-gray-600 mb-1">
                            {((simulationResult.resume?.tauxEffectif || 0) * 100).toFixed(1)} %
                          </p>
                          <p className="text-xs text-gray-500">
                            TMI : {((simulationResult.ir.trancheMarginate || 0) * 100).toFixed(1)} %
                          </p>
                        </div>
                        <Percent className="h-6 w-6 text-gray-400" />
                      </div>
                    </CardContent>
                  </Card>
                </>
              );
            })()}
          </div>
        </div>
      )}

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

          {activeTab === 'declaration' && simulationResult && (
            <DeclarationTab
              simulation={simulationResult}
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
    </>
  );
}
