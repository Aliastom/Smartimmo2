'use client';

import React from 'react';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';

export type SubmitStep = 'idle' | 'validating' | 'saving' | 'syncing' | 'done' | 'error';

export interface ModalSubmitOverlayProps {
  /** Étape courante (idle = overlay masqué) */
  step: SubmitStep;
  /** Message d'erreur affiché quand step === 'error' */
  errorMessage?: string | null;
  /** Libellés par étape (optionnel) */
  labels?: Partial<Record<Exclude<SubmitStep, 'idle'>, string>>;
  /** Callback Réessayer en cas d'erreur */
  onRetry?: () => void;
  /** Callback pour fermer l'overlay d'erreur (garder la modale ouverte) */
  onDismissError?: () => void;
  className?: string;
}

const defaultLabels: Record<Exclude<SubmitStep, 'idle'>, string> = {
  validating: 'Validation...',
  saving: 'Enregistrement...',
  syncing: 'Synchronisation...',
  done: 'Terminé',
  error: 'Erreur',
};

export function ModalSubmitOverlay({
  step,
  errorMessage = null,
  labels = {},
  onRetry,
  onDismissError,
  className,
}: ModalSubmitOverlayProps) {
  if (step === 'idle') return null;

  const text = labels[step] ?? defaultLabels[step];

  return (
    <div
      className={cn(
        'absolute inset-0 z-50 flex items-center justify-center rounded-b-2xl',
        'bg-white/90 backdrop-blur-[2px]',
        className
      )}
      role="status"
      aria-live="polite"
      aria-busy={step !== 'done' && step !== 'error'}
    >
      <div className="flex flex-col items-center justify-center text-center px-4">
        {step === 'error' ? (
          <>
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 text-red-600 mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-gray-900 mb-1">{defaultLabels.error}</p>
            <p className="text-sm text-gray-600 mb-4 max-w-xs">
              {errorMessage || 'Une erreur est survenue.'}
            </p>
            <div className="flex gap-2">
              {onDismissError && (
                <Button type="button" variant="outline" size="sm" onClick={onDismissError}>
                  Fermer
                </Button>
              )}
              {onRetry && (
                <Button type="button" size="sm" onClick={onRetry}>
                  Réessayer
                </Button>
              )}
            </div>
          </>
        ) : step === 'done' ? (
          <>
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-100 text-green-600 mb-2">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-gray-700">{text}</p>
          </>
        ) : (
          <>
            <Loader2 className="w-10 h-10 text-orange-500 animate-spin mb-3" />
            <p className="text-sm font-medium text-gray-700">{text}</p>
          </>
        )}
      </div>
    </div>
  );
}
