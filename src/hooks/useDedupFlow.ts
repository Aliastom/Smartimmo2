/**
 * Hook useDedupFlow - Gestion du flux de déduplication
 * 
 * Orchestre les interactions avec le module DedupFlow
 */

import { useState, useCallback } from 'react';
import { DedupFlowInput, DedupFlowOutput, DedupFlowContext } from '@/types/dedup-flow';

interface UseDedupFlowReturn {
  flowOutput: DedupFlowOutput | null;
  isProcessing: boolean;
  error: string | null;
  
  // Actions
  orchestrateFlow: (input: DedupFlowInput, context?: DedupFlowContext) => Promise<void>;
  processApiResult: (output: DedupFlowOutput, apiResult: any) => Promise<void>;
  reset: () => void;
}

export function useDedupFlow(): UseDedupFlowReturn {
  const [flowOutput, setFlowOutput] = useState<DedupFlowOutput | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Orchestre le flux de déduplication
   */
  const orchestrateFlow = useCallback(async (
    input: DedupFlowInput, 
    context?: DedupFlowContext
  ) => {
    setIsProcessing(true);
    setError(null);

    try {
      console.log('[useDedupFlow] Orchestration du flux:', input);

      const response = await fetch('/api/documents/dedup-flow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...input, ...context }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Erreur lors de l\'orchestration du flux');
      }

      setFlowOutput(result.data);
      console.log('[useDedupFlow] Flux orchestré:', result.data);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(errorMessage);
      console.error('[useDedupFlow] Erreur:', errorMessage);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  /**
   * Traite le résultat d'une action API
   */
  const processApiResult = useCallback(async (
    output: DedupFlowOutput, 
    apiResult: any
  ) => {
    setIsProcessing(true);
    setError(null);

    try {
      console.log('[useDedupFlow] Traitement résultat API:', { output, apiResult });

      const response = await fetch('/api/documents/dedup-flow', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ output, apiResult }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Erreur lors du traitement du résultat');
      }

      if (result.data) {
        setFlowOutput(result.data);
      }

      console.log('[useDedupFlow] Résultat traité:', result);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(errorMessage);
      console.error('[useDedupFlow] Erreur traitement:', errorMessage);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  /**
   * Remet à zéro l'état du hook
   */
  const reset = useCallback(() => {
    setFlowOutput(null);
    setIsProcessing(false);
    setError(null);
  }, []);

  return {
    flowOutput,
    isProcessing,
    error,
    orchestrateFlow,
    processApiResult,
    reset
  };
}
