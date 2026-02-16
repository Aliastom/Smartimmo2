'use client';

import { useState, useCallback } from 'react';

export type SubmitStep = 'idle' | 'validating' | 'saving' | 'syncing' | 'done' | 'error';

export interface UseModalSubmitFlowReturn {
  submitStep: SubmitStep;
  submitError: string | null;
  startValidation: () => void;
  startSaving: () => void;
  startSync: () => void;
  markDone: () => void;
  markError: (error: unknown) => void;
  reset: () => void;
}

/**
 * Hook réutilisable pour piloter l'overlay de soumission d'une modale.
 * Les étapes reflètent des états réels (validation, appel onSubmit, sync réelle, succès).
 * Aucun setTimeout : le consommateur appelle start* / mark* au bon moment.
 */
export function useModalSubmitFlow(): UseModalSubmitFlowReturn {
  const [submitStep, setSubmitStep] = useState<SubmitStep>('idle');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const startValidation = useCallback(() => {
    setSubmitError(null);
    setSubmitStep('validating');
  }, []);

  const startSaving = useCallback(() => {
    setSubmitStep('saving');
  }, []);

  const startSync = useCallback(() => {
    setSubmitStep('syncing');
  }, []);

  const markDone = useCallback(() => {
    setSubmitStep('done');
    setSubmitError(null);
  }, []);

  const markError = useCallback((error: unknown) => {
    setSubmitStep('error');
    const message =
      error instanceof Error ? error.message : typeof error === 'string' ? error : 'Erreur lors de la sauvegarde';
    setSubmitError(message);
  }, []);

  const reset = useCallback(() => {
    setSubmitStep('idle');
    setSubmitError(null);
  }, []);

  return {
    submitStep,
    submitError,
    startValidation,
    startSaving,
    startSync,
    markDone,
    markError,
    reset,
  };
}
