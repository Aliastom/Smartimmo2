/**
 * Core Component pour la page Fiscal
 * 
 * Une seule source de vérité graphique utilisable en mode "normal" et "app-shell"
 * Toute la logique UI est centralisée ici.
 * 
 * Réplique EXACTEMENT le comportement de FiscalPage.tsx
 */

'use client';

import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useFiscalStore } from '@/store/fiscalStore';
import { useFiscalTabs } from '@/hooks/useFiscalTabs';
import { useExpertModeStore } from '@/store/expertModeStore';
import { FiscalProgressBar } from '@/components/fiscal/unified/FiscalProgressBar';
import { SavedSimulationsDropdown } from '@/components/fiscal/SavedSimulationsDropdown';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { Switch } from '@/components/ui/Switch';
import { Input } from '@/components/ui/Input';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';

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
    armManualFiscalCompute,
    setStatus,
    setSavedSimulationId,
    setResult,
    resetSimulation,
    updateDraft,
    setAutofillCache,
  } = useFiscalStore();
  const { session: fiscalSession, loading: fiscalSessionLoading } = useFiscalSession();

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
  const [saveAsPending, setSaveAsPending] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [loadedFromSnapshot, setLoadedFromSnapshot] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [calculationSource, setCalculationSource] = useState<'snapshot' | 'recalculate' | null>(null);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState<string | null>(null);
  const [pendingOpenId, setPendingOpenId] = useState<string | null>(null);
  const [dirtyConfirmOpen, setDirtyConfirmOpen] = useState(false);
  const [saveActionOpen, setSaveActionOpen] = useState(false);
  const [saveActionType, setSaveActionType] = useState<'saveAs' | 'rename' | 'duplicate' | 'delete' | null>(null);
  const [saveActionTargetId, setSaveActionTargetId] = useState<string | null>(null);
  const [saveActionName, setSaveActionName] = useState('');
  const [saveActionBusy, setSaveActionBusy] = useState(false);
  const optimizationAbortControllerRef = useRef<AbortController | null>(null);
  const optimizationLoadedRef = useRef<string | null>(null);
  const optimizationJustLoadedInCalculateRef = useRef<boolean>(false);
  const snapshotBootstrapKeyRef = useRef<string | null>(null);
  const [fiscalSnapshotBootstrapDone, setFiscalSnapshotBootstrapDone] = useState(false);
  const { toast } = useToast();

  const currentSaveId = savedSimulationId;
  const currentSave = useMemo(
    () => savedSimulations.find((s) => s.id === currentSaveId) ?? null,
    [savedSimulations, currentSaveId]
  );

  const buildSnapshot = useCallback(() => {
    if (!simulationResult) return null;
    const payload = {
      inputs: { ...simulationResult.inputs, ...simulationDraft },
      result: simulationResult,
    };
    return JSON.stringify(payload);
  }, [simulationDraft, simulationResult]);

  const isDirty = useMemo(() => {
    if (!simulationResult) return false;
    if (!currentSaveId) return true;
    const currentSnapshot = buildSnapshot();
    if (!currentSnapshot || !lastSavedSnapshot) return true;
    return currentSnapshot !== lastSavedSnapshot;
  }, [buildSnapshot, currentSaveId, lastSavedSnapshot, simulationResult]);

  const openSaveAsDialog = useCallback(() => {
    if (!simulationResult) return;
    const defaultName = currentSave?.name
      ? `Copie de ${currentSave.name}`
      : `Simulation ${simulationResult.inputs.year + 1}`;
    setSaveActionType('saveAs');
    setSaveActionTargetId(null);
    setSaveActionName(defaultName);
    setSaveActionOpen(true);
  }, [currentSave?.name, simulationResult]);

  const openRenameDialog = useCallback(
    (simulationId: string) => {
      const sim = savedSimulations.find((s) => s.id === simulationId);
      if (!sim) return;
      setSaveActionType('rename');
      setSaveActionTargetId(simulationId);
      setSaveActionName(sim.name);
      setSaveActionOpen(true);
    },
    [savedSimulations]
  );

  const openDuplicateDialog = useCallback(
    (simulationId: string) => {
      const sim = savedSimulations.find((s) => s.id === simulationId);
      if (!sim) return;
      setSaveActionType('duplicate');
      setSaveActionTargetId(simulationId);
      setSaveActionName(`Copie de ${sim.name}`);
      setSaveActionOpen(true);
    },
    [savedSimulations]
  );

  const openDeleteDialog = useCallback(
    (simulationId: string) => {
      const sim = savedSimulations.find((s) => s.id === simulationId);
      if (!sim) return;
      setSaveActionType('delete');
      setSaveActionTargetId(simulationId);
      setSaveActionName(sim.name);
      setSaveActionOpen(true);
    },
    [savedSimulations]
  );
  
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

  // Au montage : réinitialiser le store ; chargement liste + snapshot après session fiscale prête (effet dédié)
  useEffect(() => {
    localStorage.removeItem('fiscal-simulation-cache');
    localStorage.removeItem('fiscal-store');
    resetSimulation();
    snapshotBootstrapKeyRef.current = null;
    setFiscalSnapshotBootstrapDone(false);
    setLastSavedAt(null);
    setLoadedFromSnapshot(false);
    setCalculationSource(null);
    setIsRefreshing(false);
    setLastSavedSnapshot(null);
    setSaveMessage(null);
    setPendingOpenId(null);
    setDirtyConfirmOpen(false);
  }, [mode, resetSimulation]);

  useEffect(() => {
    if (fiscalSessionLoading) {
      return;
    }
    if (!fiscalSession?.organizationId) {
      setFiscalSnapshotBootstrapDone(true);
      return;
    }
    const key = `${fiscalSession.organizationId}:${fiscalSession.incomeYear}`;
    if (snapshotBootstrapKeyRef.current === key) {
      return;
    }
    snapshotBootstrapKeyRef.current = key;
    setFiscalSnapshotBootstrapDone(false);
    void (async () => {
      try {
        await loadSavedSimulations({ tryAutoLoadSnapshot: true });
      } finally {
        setFiscalSnapshotBootstrapDone(true);
      }
    })();
  }, [fiscalSessionLoading, fiscalSession?.incomeYear, fiscalSession?.organizationId, mode]);

  // ✅ Si on est sur un onglet résultat (synthese, details, etc.) sans simulation → revenir à Simulation
  useEffect(() => {
    const resultsTabs = ['synthese', 'details', 'declaration', 'projections', 'optimisations'];
    if (resultsTabs.includes(activeTab) && !simulationResult) {
      setActiveTab('simulation');
    }
  }, [activeTab, simulationResult, setActiveTab]);

  const loadSavedSimulations = async (options?: { tryAutoLoadSnapshot?: boolean }) => {
    setLoadingSimulations(true);
    try {
      const response = await fetch('/api/fiscal/simulations?limit=20');
      if (response.ok) {
        const data = await response.json();
        const sims = data.simulations || [];
        setSavedSimulations(sims);
        if (currentSaveId) {
          const active = sims.find((s: any) => s.id === currentSaveId);
          if (active?.updatedAt) {
            setLastSavedAt(active.updatedAt);
          }
        }
        if (
          options?.tryAutoLoadSnapshot &&
          fiscalSession &&
          sims.length > 0 &&
          !useFiscalStore.getState().simulationResult
        ) {
          const incomeYear = fiscalSession.incomeYear;
          const latestForYear = sims.find((sim: any) => sim.year === incomeYear);
          if (latestForYear) {
            await performLoadSimulation(latestForYear.id, { source: 'snapshot' });
          }
        }
      }
    } catch (error) {
      console.error('Erreur chargement simulations:', error);
    } finally {
      setLoadingSimulations(false);
    }
  };

  const performLoadSimulation = async (
    simulationId: string,
    options?: { source?: 'snapshot' | 'recalculate' }
  ) => {
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
      const y = inputs.year;
      const bc = (inputs.options?.baseCalcul ?? 'encaisse') as 'encaisse' | 'exigible';
      if (inputs.biens?.length && y != null) {
        setAutofillCache({
          biens: inputs.biens.map((b: any) => ({
            id: b.id,
            name: b.nom,
            loyers: b.loyers ?? 0,
            charges: b.charges ?? 0,
          })),
          year: y,
          baseCalcul: bc,
        });
      }
      setSavedSimulationId(simulationId);
      setLastSavedAt(simulationData.updatedAt || simulationData.createdAt || null);
      setLoadedFromSnapshot(true);
      setCalculationSource('snapshot');
      setLastSavedSnapshot(
        JSON.stringify({
          inputs: { ...result.inputs, ...inputs },
          result,
        })
      );
      setSaveMessage(null);
    } catch (error) {
      console.error('Erreur chargement simulation:', error);
      if (toast?.error) toast.error('Erreur lors du chargement de la simulation');
      else alert('Erreur lors du chargement de la simulation');
    } finally {
      setLoadingSimulationId(null);
    }
  };

  const handleLoadSimulation = async (simulationId: string) => {
    if (!simulationResult || !isDirty || simulationId === currentSaveId) {
      await performLoadSimulation(simulationId, { source: 'snapshot' });
      return;
    }
    setPendingOpenId(simulationId);
    setDirtyConfirmOpen(true);
  };

  const handleDeleteSimulation = async (simulationId: string) => {
    try {
      const wasActive = currentSaveId === simulationId;
      const response = await fetch(`/api/fiscal/simulations/${simulationId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la suppression');
      }

      if (wasActive) {
        setSavedSimulationId(null);
        setLastSavedAt(null);
        setLastSavedSnapshot(null);
        setSaveMessage(null);
      }

      await loadSavedSimulations();
      const remaining = savedSimulations.filter((s) => s.id !== simulationId);
      if (wasActive) {
        if (remaining.length > 0) {
          await performLoadSimulation(remaining[0].id);
        } else {
          resetSimulation();
          setActiveTab('simulation');
        }
      }
    } catch (error) {
      console.error('Erreur suppression simulation:', error);
      throw error;
    }
  };

  // Calculer la simulation
  const handleCalculate = async () => {
    const startTime = Date.now();
    setIsRefreshing(true);
    
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
      setAutofillCache(null);
      armManualFiscalCompute();
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
      setLoadedFromSnapshot(false);
      setCalculationSource('recalculate');
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
      setIsRefreshing(false);
    }
  };

  // Sauvegarder la simulation
  const handleSave = async (): Promise<boolean> => {
    if (!simulationResult) return false;

    setSaving(true);
    setSaved(false);

    try {
      const payload = {
        inputs: { ...simulationResult.inputs, ...simulationDraft },
        result: simulationResult,
      };
      const defaultName = `Simulation ${simulationResult.inputs.year + 1} (revenus ${simulationResult.inputs.year})`;
      const isUpdate = !!currentSaveId;

      const response = await fetch(
        isUpdate ? `/api/fiscal/simulations/${currentSaveId}` : '/api/fiscal/simulations',
        {
          method: isUpdate ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: currentSave?.name || defaultName,
            ...payload,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Erreur lors de l’enregistrement');
      }

      const data = await response.json();
      const id = isUpdate ? currentSaveId : data.simulation.id;
      const timestamp = data.simulation?.updatedAt || new Date().toISOString();

      setSavedSimulationId(id);
      setLastSavedAt(timestamp);
      const snap = buildSnapshot();
      setLastSavedSnapshot(snap);
      setSaved(true);
      setSaveMessage(isUpdate ? 'Sauvegarde mise à jour' : 'Nouvelle sauvegarde créée');
      setTimeout(() => setSaved(false), 2500);
      await loadSavedSimulations();
      return true;
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      if (toast?.error) toast.error("Impossible d'enregistrer la sauvegarde");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAs = async () => {
    if (!simulationResult || saveAsPending || !saveActionName.trim()) return;
    setSaveAsPending(true);
    try {
      const response = await fetch('/api/fiscal/simulations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: saveActionName.trim(),
          inputs: { ...simulationResult.inputs, ...simulationDraft },
          result: simulationResult,
        }),
      });

      if (!response.ok) throw new Error('Erreur Enregistrer sous');
      const data = await response.json();
      setSavedSimulationId(data.simulation.id);
      setLastSavedAt(data.simulation.updatedAt || data.simulation.createdAt || new Date().toISOString());
      setLastSavedSnapshot(buildSnapshot());
      setSaveMessage(`Nouvelle sauvegarde créée : ${saveActionName.trim()}`);
      await loadSavedSimulations();
      setSaveActionOpen(false);
    } catch (error) {
      console.error('Erreur Enregistrer sous:', error);
      if (toast?.error) toast.error("Impossible de créer la nouvelle sauvegarde");
    } finally {
      setSaveAsPending(false);
    }
  };

  const handleRenameSimulation = async (simulationId: string) => {
    if (!saveActionName.trim()) return;
    try {
      const sim = savedSimulations.find((s) => s.id === simulationId);
      if (!sim) return;
      const nextName = saveActionName.trim();
      if (nextName === sim.name) {
        setSaveActionOpen(false);
        return;
      }
      const response = await fetch(`/api/fiscal/simulations/${simulationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nextName }),
      });
      if (!response.ok) {
        throw new Error('Erreur de renommage');
      }
      await loadSavedSimulations();
      if (simulationId === currentSaveId) {
        setSaveMessage(`Sauvegarde renommée : ${nextName}`);
      }
      setSaveActionOpen(false);
    } catch (error) {
      console.error('Erreur renommage:', error);
      if (toast?.error) toast.error('Impossible de renommer la sauvegarde');
    }
  };

  const handleDuplicateSimulation = async (simulationId: string) => {
    if (!saveActionName.trim()) return;
    try {
      const sim = savedSimulations.find((s) => s.id === simulationId);
      if (!sim) return;
      const requestedName = saveActionName.trim();
      const response = await fetch(`/api/fiscal/simulations/${simulationId}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: requestedName }),
      });
      if (!response.ok) {
        throw new Error('Erreur de duplication');
      }
      await loadSavedSimulations();
      const data = await response.json();
      setSaveMessage(`Sauvegarde dupliquée : ${data.simulation?.name || requestedName}`);
      setSaveActionOpen(false);
    } catch (error) {
      console.error('Erreur duplication:', error);
      if (toast?.error) toast.error('Impossible de dupliquer la sauvegarde');
    }
  };

  const handleDirtyConfirmSaveAndContinue = async () => {
    if (!pendingOpenId) {
      setDirtyConfirmOpen(false);
      return;
    }
    const ok = await handleSave();
    if (!ok) return;
    setDirtyConfirmOpen(false);
    const targetId = pendingOpenId;
    setPendingOpenId(null);
    await performLoadSimulation(targetId);
  };

  const handleDirtyConfirmDiscardAndContinue = async () => {
    if (!pendingOpenId) {
      setDirtyConfirmOpen(false);
      return;
    }
    const targetId = pendingOpenId;
    setDirtyConfirmOpen(false);
    setPendingOpenId(null);
    await performLoadSimulation(targetId);
  };

  const executeSaveAction = async () => {
    if (!saveActionType) return;
    setSaveActionBusy(true);
    try {
      if (saveActionType === 'saveAs') {
        await handleSaveAs();
        return;
      }
      if (!saveActionTargetId) return;
      if (saveActionType === 'rename') {
        await handleRenameSimulation(saveActionTargetId);
        return;
      }
      if (saveActionType === 'duplicate') {
        await handleDuplicateSimulation(saveActionTargetId);
        return;
      }
      if (saveActionType === 'delete') {
        await handleDeleteSimulation(saveActionTargetId);
        setSaveActionOpen(false);
      }
    } finally {
      setSaveActionBusy(false);
    }
  };

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

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
        <div className="max-w-7xl mx-auto px-4 py-3">
          {/* Ligne haute : titre + badges alignés, sous-titre ; à droite (lg+) les sélecteurs Déclaration / Revenus / Barème */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
            <div className="flex min-w-0 gap-2 lg:min-w-0 lg:flex-1">
              {sidebarContext && (
                <button
                  type="button"
                  onClick={sidebarContext.toggleSidebar}
                  className="lg:hidden flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                  aria-label={sidebarContext.sidebarOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
                >
                  {sidebarContext.sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                  <h1 className="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">Espace fiscal</h1>
                  {simulationResult && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge
                        variant="outline"
                        className="border-purple-200/70 bg-purple-50/80 px-2 py-0.5 text-[11px] font-medium text-purple-900 shadow-none"
                      >
                        Revenus {simulationResult.inputs.year}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="border-sky-200/70 bg-sky-50/80 px-2 py-0.5 text-[11px] font-medium text-sky-900 shadow-none"
                      >
                        Barème {simulationResult.taxParams.version}
                      </Badge>
                      {optimizationCount > 0 && (
                        <Badge
                          variant="outline"
                          className="border-orange-200/70 bg-orange-50/80 px-2 py-0.5 text-[11px] font-medium text-orange-900 shadow-none"
                        >
                          {optimizationCount} optimisation{optimizationCount > 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-gray-600 sm:text-[13px]">
                  Déclaration, revenus et barème : une session unique avant les onglets de résultats.
                </p>
              </div>
            </div>
            <div className="flex w-full min-w-0 shrink-0 justify-start lg:w-auto lg:justify-end">
              <FiscalHeaderControls variant="cockpit" />
            </div>
          </div>

          {/* Panneau Sauvegardes / session / actions — pleine largeur, directement sous le bloc titre */}
          <div className="mt-2 w-full rounded-2xl border border-gray-200/80 bg-gradient-to-br from-white via-white to-gray-50/90 p-2.5 shadow-[0_1px_0_rgba(15,23,42,0.04),0_10px_28px_-14px_rgba(15,23,42,0.12)] ring-1 ring-black/[0.05] backdrop-blur-md sm:p-2 sm:py-2">
            <div className="flex w-full min-w-0 flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-2 lg:flex-nowrap lg:items-stretch">
              {/* Sauvegardes */}
              <div className="flex min-w-0 shrink-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400">
                  Sauvegardes
                </span>
                <div className="min-w-0 sm:max-w-[min(100%,20rem)]">
                  <SavedSimulationsDropdown
                    simulations={savedSimulations}
                    currentSaveId={currentSaveId}
                    onOpen={handleLoadSimulation}
                    onRename={openRenameDialog}
                    onDuplicate={openDuplicateDialog}
                    onDelete={async (id) => {
                      openDeleteDialog(id);
                    }}
                    loading={!!loadingSimulationId}
                  />
                </div>
              </div>

              {hasSimulation && (
                <>
                  <span className="hidden h-9 w-px shrink-0 self-center bg-gray-200/90 sm:inline" aria-hidden />
                  <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-gray-200/70 bg-white/80 px-2.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] sm:min-h-[2.5rem]">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
                        Sauvegarde active
                      </p>
                      <p className="truncate text-[13px] font-semibold leading-snug text-gray-900">
                        {currentSave ? currentSave.name : 'État non sauvegardé'}
                      </p>
                      {lastSavedAt && (
                        <p className="mt-0.5 truncate text-[10px] leading-snug text-gray-500">
                          Dernière sauvegarde · {new Date(lastSavedAt).toLocaleString('fr-FR')}
                        </p>
                      )}
                      <p className="mt-0.5 truncate text-[10px] leading-snug text-gray-500">
                        Source calcul · {loadedFromSnapshot ? 'Snapshot sauvegardé' : calculationSource === 'recalculate' ? 'Recalcul manuel' : 'Aucune'}
                        {isRefreshing ? ' · rafraîchissement en cours' : ''}
                      </p>
                    </div>
                    <span
                      title={
                        isDirty
                          ? 'Modifications non enregistrées'
                          : 'Synchronisé avec la dernière sauvegarde'
                      }
                      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-none ${
                        isDirty
                          ? 'border-amber-300/90 bg-amber-50 text-amber-950'
                          : 'border-emerald-300/90 bg-emerald-50 text-emerald-950'
                      }`}
                    >
                      {isDirty ? 'Non enregistré' : 'Synchronisé'}
                    </span>
                  </div>
                </>
              )}

              <span className="hidden h-9 w-px shrink-0 self-center bg-gray-200/90 lg:inline" aria-hidden />

              {/* Actions : calcul + enregistrement / export / expert */}
              <div
                className={`flex w-full min-w-0 flex-wrap items-center gap-1.5 border-t border-gray-200/60 pt-2 sm:w-auto sm:border-t-0 sm:pt-0 lg:ml-auto lg:flex-nowrap lg:justify-end lg:border-l lg:border-gray-200/60 lg:pl-4 ${
                  activeTab === 'simulation' ? 'sm:justify-between lg:justify-end' : 'sm:justify-end'
                }`}
              >
                {activeTab === 'simulation' && (
                  <Button
                    onClick={handleCalculate}
                    disabled={status === 'calculating'}
                    size="md"
                    className="shrink-0 gap-1.5"
                  >
                    {status === 'calculating' ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Calcul en cours...
                      </>
                    ) : (
                      <>
                        <Calculator className="h-4 w-4" />
                        Mettre à jour / Recalculer
                      </>
                    )}
                  </Button>
                )}

                <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1.5 sm:flex-initial">
                  {hasSimulation && (
                    <Button
                      onClick={handleSave}
                      variant="outline"
                      size="sm"
                      disabled={saving || saveAsPending}
                      className="shrink-0 gap-1.5"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Enregistrement…
                        </>
                      ) : saved ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-green-600" />
                          Enregistré
                        </>
                      ) : (
                        <>
                          <Save className="h-3.5 w-3.5" />
                          Enregistrer
                        </>
                      )}
                    </Button>
                  )}

                  {hasSimulation && (
                    <Button
                      onClick={openSaveAsDialog}
                      variant="outline"
                      size="sm"
                      disabled={saving || saveAsPending}
                      className="shrink-0 gap-1.5"
                    >
                      {saveAsPending ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Enregistrer sous...
                        </>
                      ) : (
                        <>
                          <Save className="h-3.5 w-3.5" />
                          Enregistrer sous…
                        </>
                      )}
                    </Button>
                  )}

                  {hasSimulation && (
                    <Button onClick={handleExportPDF} variant="outline" size="sm" className="shrink-0 gap-1.5">
                      <FileDown className="h-3.5 w-3.5" />
                      Export PDF
                    </Button>
                  )}

                  {hasSimulation && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex shrink-0 items-center gap-1.5 rounded-xl border border-gray-200/90 bg-white/90 px-2 py-1.5 shadow-sm transition-colors hover:bg-white">
                            <Switch checked={isExpertMode} onCheckedChange={toggleExpertMode} />
                            <span className="text-xs font-medium text-gray-800">Mode expert</span>
                            {isExpertMode && (
                              <Badge
                                variant="outline"
                                className="border-indigo-300/80 bg-indigo-50 px-1 py-0 text-[10px] font-semibold text-indigo-800"
                              >
                                ON
                              </Badge>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs text-xs">
                            Active des détails avancés : calculs tranche par tranche, cohérence fiscale, scénarios,
                            overrides, etc.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="mt-2.5 border-t border-gray-200/80 pt-2">
            {saveMessage && <p className="mb-1 text-xs text-emerald-700">{saveMessage}</p>}
            <FiscalProgressBar
              embedded
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
          {activeTab === 'simulation' && (
            <>
              {fiscalSnapshotBootstrapDone &&
                !simulationResult &&
                !loadingSimulationId &&
                !loadingSimulations && (
                  <div className="max-w-7xl mx-auto px-4 pt-4">
                    <Alert className="border-amber-200 bg-amber-50/90 text-amber-950">
                      <Info className="h-4 w-4 text-amber-700" />
                      <AlertDescription className="text-sm">
                        Aucune simulation sauvegardée — cliquez sur Mettre à jour / Recalculer.
                      </AlertDescription>
                    </Alert>
                  </div>
                )}
              <SimulationTab />
            </>
          )}
          
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

    <Dialog
      open={saveActionOpen}
      onOpenChange={(open) => {
        if (saveActionBusy) return;
        setSaveActionOpen(open);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {saveActionType === 'saveAs' && 'Enregistrer sous…'}
            {saveActionType === 'rename' && 'Renommer la sauvegarde'}
            {saveActionType === 'duplicate' && 'Dupliquer la sauvegarde'}
            {saveActionType === 'delete' && 'Supprimer la sauvegarde'}
          </DialogTitle>
          <DialogDescription>
            {saveActionType === 'saveAs' &&
              'Crée une nouvelle sauvegarde à partir de l’état actuel (sans écraser la sauvegarde active).'}
            {saveActionType === 'rename' && 'Modifiez uniquement le nom de cette sauvegarde.'}
            {saveActionType === 'duplicate' &&
              'Crée une copie complète (données + résultat) de cette sauvegarde.'}
            {saveActionType === 'delete' &&
              'Cette action est irréversible. La sauvegarde sélectionnée sera supprimée définitivement.'}
          </DialogDescription>
        </DialogHeader>

        {(saveActionType === 'saveAs' || saveActionType === 'rename' || saveActionType === 'duplicate') && (
          <div className="space-y-2">
            <label htmlFor="save-action-name" className="text-sm font-medium text-gray-800">
              Nom de la sauvegarde
            </label>
            <Input
              id="save-action-name"
              value={saveActionName}
              onChange={(e) => setSaveActionName(e.target.value)}
              placeholder="Nom de la sauvegarde"
              autoFocus
            />
          </div>
        )}

        {saveActionType === 'delete' && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
            Sauvegarde concernée : <strong>{saveActionName}</strong>
          </div>
        )}

        <DialogFooter className="flex gap-2 sm:justify-end">
          <Button
            variant="outline"
            disabled={saveActionBusy}
            onClick={() => {
              setSaveActionOpen(false);
            }}
          >
            Annuler
          </Button>
          <Button
            onClick={executeSaveAction}
            disabled={
              saveActionBusy ||
              ((saveActionType === 'saveAs' || saveActionType === 'rename' || saveActionType === 'duplicate') &&
                !saveActionName.trim())
            }
            variant={saveActionType === 'delete' ? 'destructive' : 'default'}
          >
            {saveActionBusy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Traitement...
              </>
            ) : (
              <>
                {saveActionType === 'saveAs' && 'Créer la sauvegarde'}
                {saveActionType === 'rename' && 'Renommer'}
                {saveActionType === 'duplicate' && 'Dupliquer'}
                {saveActionType === 'delete' && 'Supprimer'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={dirtyConfirmOpen} onOpenChange={setDirtyConfirmOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Modifications non enregistrées</DialogTitle>
          <DialogDescription>
            Vous avez des changements non enregistrés sur la sauvegarde en cours. Que souhaitez-vous faire avant
            d&apos;ouvrir une autre sauvegarde ?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2 sm:justify-end">
          <Button
            variant="outline"
            onClick={() => {
              setDirtyConfirmOpen(false);
              setPendingOpenId(null);
            }}
          >
            Annuler
          </Button>
          <Button variant="outline" onClick={handleDirtyConfirmDiscardAndContinue}>
            Ignorer les modifications
          </Button>
          <Button onClick={handleDirtyConfirmSaveAndContinue}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
