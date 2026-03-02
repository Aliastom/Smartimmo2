/**
 * FiscalProgressBar - Barre de progression horizontale premium pour l'Espace Fiscal
 *
 * Navigation textuelle sobre, style outil patrimonial haut de gamme.
 * Aucun rond/glow/emoji — uniquement texte + ligne fine + underline animée.
 */

'use client';

import React from 'react';
import type { FiscalTab } from '@/hooks/useFiscalTabs';

const STEPS: {
  id: FiscalTab;
  label: string;
  disabled?: boolean;
}[] = [
  { id: 'simulation', label: 'Simulation' },
  { id: 'synthese', label: 'Total imposable' },
  { id: 'details', label: 'Calcul de l\'impôt' },
  { id: 'declaration', label: 'Déclaration' },
  { id: 'projections', label: 'Projections', disabled: true },
  { id: 'optimisations', label: 'Optimisations', disabled: true },
];

interface FiscalProgressBarProps {
  activeTab: FiscalTab;
  hasSimulation: boolean;
  onTabChange?: (tab: FiscalTab) => void;
}

export function FiscalProgressBar({ activeTab, hasSimulation, onTabChange }: FiscalProgressBarProps) {
  const activeIndex = STEPS.findIndex((s) => s.id === activeTab);
  const progress = ((activeIndex + 1) / STEPS.length) * 100;

  return (
    <div className="bg-white border-b border-gray-200 px-4 md:px-6 py-4 overflow-x-auto">
      <div className="max-w-6xl mx-auto flex flex-col gap-4">
        {/* Barre horizontale : étapes + compteur à droite */}
        <div className="flex items-center justify-between gap-6">
          {/* Étapes textuelles centrées / alignées */}
          <div className="relative flex-1 min-w-0">
            {/* Ligne de progression fine en arrière-plan (1px, subtle) */}
            <div
              className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-gray-200 transition-[width] duration-200 ease-out"
              aria-hidden
            />
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 h-px bg-primary/40 transition-[width] duration-200 ease-out"
              style={{ width: `${progress}%` }}
              aria-hidden
            />

            <div className="relative flex items-center justify-between gap-2 md:gap-4">
              {STEPS.map((step, index) => {
                const isActive = step.id === activeTab;
                const isCompleted = index < activeIndex;
                const isDisabled =
                  step.disabled || (!hasSimulation && step.id !== 'simulation');
                const isClickable = !isDisabled && onTabChange;

                return (
                  <button
                    key={step.id}
                    onClick={() => isClickable && onTabChange?.(step.id)}
                    disabled={isDisabled || !onTabChange}
                    aria-current={isActive ? 'step' : undefined}
                    className={`
                      relative flex flex-col items-center py-2 px-1 md:px-2
                      transition-colors duration-200 ease-out
                      focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 rounded
                      ${isClickable ? 'cursor-pointer' : 'cursor-default'}
                      ${isDisabled ? 'opacity-50' : ''}
                      ${isClickable && !isActive ? 'hover:text-gray-700' : ''}
                    `}
                  >
                    <span
                      className={`
                        text-xs md:text-sm leading-tight whitespace-nowrap
                        transition-colors duration-200 ease-out
                        ${isActive ? 'font-semibold text-primary' : ''}
                        ${isCompleted && !isActive ? 'text-gray-600 font-medium' : ''}
                        ${!isActive && !isCompleted ? 'text-gray-400 font-normal' : ''}
                      `}
                    >
                      {step.label}
                    </span>
                    {/* Underline fine animée — étape active */}
                    <span
                      className={`
                        absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 bg-primary rounded-full
                        transition-all duration-200 ease-out
                        ${isActive ? 'w-3/4 opacity-100' : 'w-0 opacity-0'}
                      `}
                      aria-hidden
                    />
                    {/* Badge "À venir" — étapes futures désactivées */}
                    {step.disabled && (
                      <span className="text-[10px] mt-0.5 text-gray-500 font-normal">
                        À venir
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Compteur Étape X / Y — aligné à droite, badge discret */}
          <div className="flex-shrink-0">
            <div
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-gray-100/80 text-gray-600"
              aria-label={`Étape ${activeIndex + 1} sur ${STEPS.length}`}
            >
              <span className="text-xs font-medium">Étape {activeIndex + 1}</span>
              <span className="text-xs text-gray-400">/</span>
              <span className="text-xs text-gray-500">{STEPS.length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

