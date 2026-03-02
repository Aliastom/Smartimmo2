/**
 * FiscalPage - Page unifiée de l'Espace Fiscal
 * 
 * Orchestration des 5 onglets avec état global
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
} from 'lucide-react';
import { FiscalCalculatingOverlay } from '@/components/fiscal/FiscalCalculatingOverlay';

// Lazy load des onglets lourds
import dynamic from 'next/dynamic';

const SimulationTab = dynamic(() => import('@/components/fiscal/unified/tabs/SimulationTab'), {
  loading: () => <div className="p-6"><div className="h-96 bg-gray-100 animate-pulse rounded-2xl" /></div>,
});

const SyntheseTab = dynamic(() => import('@/components/fiscal/results/tabs/SyntheseTab').then(m => ({ default: m.default || m.SyntheseTab })), {
  loading: () => <div className="p-6"><div className="h-96 bg-gray-100 animate-pulse rounded-2xl" /></div>,
});

const DetailsTab = dynamic(() => import('@/components/fiscal/results/tabs/DetailsTab').then(m => ({ default: m.DetailsTab })), {
  loading: () => <div className="p-6"><div className="h-96 bg-gray-100 animate-pulse rounded-2xl" /></div>,
});

const DeclarationTab = dynamic(() => import('@/components/fiscal/results/tabs/DeclarationTab').then(m => ({ default: m.DeclarationTab })), {
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
  const { isExpertMode, toggleExpertMode } = useExpertModeStore();
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
  const optimizationAbortControllerRef = useRef<AbortController | null>(null);
  const optimizationLoadedRef = useRef<string | null>(null); // Track which simulation ID has been loaded
  const optimizationJustLoadedInCalculateRef = useRef<boolean>(false); // Flag pour éviter le double chargement après handleCalculate
  
  // États pour le suivi de progression du calcul
  const [calculatingProgress, setCalculatingProgress] = useState({
    stepsProcessed: 0,
    totalSteps: 6, // ✅ 6 étapes maintenant (ajout de l'optimisation)
    currentStep: '',
    startTime: 0,
  });

  // Charger le nombre d'optimisations depuis l'API (PER, régimes, travaux, etc.)
  // ⚠️ Ne charger QUE lors du chargement d'une simulation sauvegardée, PAS après un calcul
  // L'optimisation est déjà chargée dans handleCalculate et affichée dans la modal
  useEffect(() => {
    if (!simulationResult || status === 'calculating') {
      if (status !== 'calculating') {
        setOptimizationCount(0);
        optimizationLoadedRef.current = null;
        optimizationJustLoadedInCalculateRef.current = false;
      }
      return;
    }

    // ⚠️ Si l'optimisation vient d'être chargée dans handleCalculate, ne JAMAIS la recharger
    // Le flag reste actif pour empêcher tout rechargement après la fermeture de la modal
    if (optimizationJustLoadedInCalculateRef.current) {
      return;
    }

    // ⚠️ DÉSACTIVER complètement le chargement automatique après un calcul
    // Ne charger l'optimisation que si on charge explicitement une simulation sauvegardée
    // (via handleLoadSimulation qui réinitialise le flag)
    // Si pas de savedSimulationId, c'est un calcul récent = optimisation déjà chargée
    if (!savedSimulationId) {
      return;
    }

    // Créer une clé unique pour cette simulation
    const simulationKey = savedSimulationId;
    
    // Si l'optimisation a déjà été chargée pour cette simulation, ne pas recharger
    if (optimizationLoadedRef.current === simulationKey) {
      return;
    }
    
    // Si une optimisation est déjà en cours, ne pas en lancer une autre
    if (isOptimizationLoading) {
      return;
    }

    const loadOptimizationCount = async () => {
      // Annuler toute requête précédente
      if (optimizationAbortControllerRef.current) {
        optimizationAbortControllerRef.current.abort();
      }

      const controller = new AbortController();
      optimizationAbortControllerRef.current = controller;
      setIsOptimizationLoading(true);
      
      // Marquer cette simulation comme étant en cours de chargement IMMÉDIATEMENT pour éviter les appels multiples
      optimizationLoadedRef.current = simulationKey;

      try {
        // Si on a un simulationId sauvegardé, l'utiliser, sinon utiliser la dernière simulation
        const url = savedSimulationId 
          ? `/api/fiscal/optimize?simulationId=${savedSimulationId}`
          : '/api/fiscal/optimize';
        
        const response = await fetch(url, { signal: controller.signal });
        
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
          optimizationLoadedRef.current = null; // Réinitialiser pour pouvoir réessayer
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          // Ne pas logger, c'est normal si on annule
          optimizationLoadedRef.current = null; // Réinitialiser si annulé
        } else {
          console.error('Erreur chargement optimisations:', error);
          setOptimizationCount(0);
          setOptimizationSuggestions([]);
          optimizationLoadedRef.current = null; // Réinitialiser pour pouvoir réessayer
        }
      } finally {
        setIsOptimizationLoading(false);
        if (optimizationAbortControllerRef.current === controller) {
          optimizationAbortControllerRef.current = null;
        }
      }
    };

    // ⚠️ Charger immédiatement pour les simulations sauvegardées uniquement
    // (le chargement automatique après un calcul est désactivé car fait dans handleCalculate)
    loadOptimizationCount();
    
    return () => {
      if (optimizationAbortControllerRef.current) {
        optimizationAbortControllerRef.current.abort();
        optimizationAbortControllerRef.current = null;
      }
    };
  }, [simulationResult, savedSimulationId, status]); // ⚠️ Retirer isOptimizationLoading des dépendances

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

  // ✅ Si on est sur un onglet résultat sans simulation → revenir à Simulation (évite écran blanc)
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
      
      // ✅ Réinitialiser le flag pour permettre le chargement de l'optimisation pour cette simulation
      optimizationJustLoadedInCalculateRef.current = false;
      
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
    const startTime = Date.now();
    
    // ✅ Réinitialiser le flag pour permettre le chargement de l'optimisation dans handleCalculate
    optimizationJustLoadedInCalculateRef.current = false;
    
    // Initialiser la progression
    setCalculatingProgress({
      stepsProcessed: 0,
      totalSteps: 6,
      currentStep: '',
      startTime,
    });
    
    // Simuler la progression pendant le calcul
    const steps = [
      'Analyse des biens immobiliers',
      'Calcul des revenus fonciers',
      'Optimisation des régimes fiscaux',
      'Calcul de l\'impôt sur le revenu',
      'Optimisation fiscale',
      'Finalisation de la simulation',
    ];
    
    let progressInterval: NodeJS.Timeout | null = null;
    
    // ✅ Créer un intervalle qui s'arrête automatiquement à l'étape 4
    progressInterval = setInterval(() => {
      setCalculatingProgress((prev) => {
        // ✅ Arrêter l'estimation automatique à l'étape 4 pour éviter les conflits
        if (prev.stepsProcessed >= 4) {
          if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = null;
          }
          return prev;
        }
        
        const elapsed = (Date.now() - prev.startTime) / 1000;
        // Estimation: ~0.8-1 seconde par étape
        const estimatedStep = Math.min(Math.floor(elapsed / 0.9), 4); // ✅ Limiter à 4 étapes max
        
        return {
          ...prev,
          stepsProcessed: estimatedStep,
          currentStep: estimatedStep < steps.length ? steps[estimatedStep] : '',
        };
      });
    }, 600);
    
    try {
      // ✅ Garder le statut 'calculating' pendant toute la durée du calcul et de l'optimisation
      // Le store met le status à 'done' après computeFiscalSimulation, mais on le remet à 'calculating'
      // pour garder la modal ouverte pendant l'optimisation
      
      // Étape 1-4 : Simulation fiscale
      await computeFiscalSimulation();
      
      // ✅ Arrêter l'intervalle avant les mises à jour manuelles pour éviter les conflits
      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }
      
      // ✅ Remettre le status à 'calculating' pour garder la modal ouverte pendant l'optimisation
      setStatus('calculating');
      
      // Marquer les 4 premières étapes comme complétées
      for (let i = 0; i < 4; i++) {
        setCalculatingProgress({
          stepsProcessed: i + 1,
          totalSteps: 6,
          currentStep: '',
          startTime,
        });
        await new Promise(resolve => setTimeout(resolve, 150));
      }
      
      // Étape 5 : Charger l'optimisation fiscale et ATTENDRE qu'elle soit terminée
      setCalculatingProgress({
        stepsProcessed: 4,
        totalSteps: 6,
        currentStep: 'Optimisation fiscale',
        startTime,
      });
      
      // Annuler toute requête d'optimisation précédente
      if (optimizationAbortControllerRef.current) {
        optimizationAbortControllerRef.current.abort();
      }

      const controller = new AbortController();
      optimizationAbortControllerRef.current = controller;
      setIsOptimizationLoading(true);
      
      // Créer la même clé que dans le useEffect pour éviter les appels multiples
      const simulationKey = savedSimulationId || `current-${simulationResult?.inputs?.year || 'unknown'}`;
      
      // Marquer immédiatement pour éviter que le useEffect ne se déclenche
      optimizationLoadedRef.current = simulationKey;
      optimizationJustLoadedInCalculateRef.current = true; // ✅ Empêcher le useEffect de recharger
      
      // ✅ Attendre que l'optimisation soit complètement terminée avant de continuer
      try {
        // Attendre un peu pour que la simulation soit disponible
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // ✅ Récupérer le résultat depuis le store pour être sûr d'avoir les inputs
        const currentResult = useFiscalStore.getState().simulationResult;
        
        // ✅ Utiliser les inputs de la simulation récente pour éviter de recharger
        if (!currentResult?.inputs) {
          console.warn('⚠️ Pas d\'inputs dans simulationResult, optimisation va recharger les données');
          console.warn('⚠️ simulationResult:', currentResult);
        } else {
          console.log('✅ Envoi des inputs à l\'API optimize:', {
            year: currentResult.inputs.year,
            biensCount: currentResult.inputs.biens?.length,
          });
        }
        
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
          // S'assurer que la clé est bien marquée
          optimizationLoadedRef.current = simulationKey;
          // ✅ Garder le flag activé pour empêcher le useEffect de recharger
          optimizationJustLoadedInCalculateRef.current = true;
        } else {
          // Si erreur, réinitialiser pour permettre un nouvel essai
          optimizationLoadedRef.current = null;
          optimizationJustLoadedInCalculateRef.current = false;
        }
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error('Erreur optimisation:', error);
        }
        // Ne pas bloquer si l'optimisation échoue
        optimizationJustLoadedInCalculateRef.current = false;
      } finally {
        setIsOptimizationLoading(false);
        if (optimizationAbortControllerRef.current === controller) {
          optimizationAbortControllerRef.current = null;
        }
      }
      
      // Marquer l'étape 5 (Optimisation fiscale) comme complétée
      setCalculatingProgress({
        stepsProcessed: 5,
        totalSteps: 6,
        currentStep: 'Finalisation de la simulation',
        startTime,
      });
      
      // Petit délai pour voir l'étape de finalisation
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Marquer l'étape 6 (Finalisation) comme complétée
      setCalculatingProgress({
        stepsProcessed: 6,
        totalSteps: 6,
        currentStep: '',
        startTime,
      });
      
      // Petit délai avant de masquer l'overlay pour voir le 100%
      await new Promise(resolve => setTimeout(resolve, 400));
      
      // ✅ Maintenant que l'optimisation est complètement terminée, mettre le status à 'done'
      // Cela fermera la modal et le flag empêchera le useEffect de recharger
      setStatus('done');
      
      // ✅ Garder le flag activé pour empêcher le useEffect de recharger l'optimisation
      // Il sera réinitialisé quand on lancera un nouveau calcul ou qu'on chargera une autre simulation
      
      // Basculer automatiquement sur Synthèse
      setActiveTab('synthese');
    } catch (error) {
      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }
      console.error('Erreur calcul:', error);
    } finally {
      // ✅ Nettoyer l'intervalle s'il existe encore
      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }
      // ✅ Réinitialiser la progression après un délai pour laisser voir le 100%
      setTimeout(() => {
        setCalculatingProgress({
          stepsProcessed: 0,
          totalSteps: 6,
          currentStep: '',
          startTime: 0,
        });
      }, 500);
      // Ne pas réinitialiser optimizationJustLoadedInCalculateRef ici
      // Il restera actif pour éviter le rechargement dans le useEffect
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

  // Calculer le temps estimé restant (ne jamais retourner 0, utiliser undefined à la place)
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
            {/* Badges année et version */}
            {simulationResult && (
              <div className="flex items-center justify-end gap-2 mb-3">
                <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-300">
                  Année {simulationResult.inputs.year}
                </Badge>
                <Badge variant="outline" className="bg-sky-100 text-sky-700 border-sky-300">
                  {simulationResult.taxParams.version}
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
                          <p className="text-xs font-medium text-gray-600 mb-1">TAUX EFFECTIF</p>
                          <p className="text-2xl font-bold text-gray-600 mb-1">
                            {((simulationResult.resume?.tauxEffectif || 0) * 100).toFixed(1)} %
                          </p>
                          <p className="text-xs text-gray-500">
                            TMI: {((simulationResult.ir.trancheMarginate || 0) * 100).toFixed(1)} %
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

