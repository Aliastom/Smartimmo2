/**
 * FiscalProgressBar - Barre de progression horizontale pour l'Espace Fiscal
 * 
 * Timeline visuelle indiquant la progression dans le flux fiscal
 */

'use client';

import React from 'react';
import type { FiscalTab } from '@/hooks/useFiscalTabs';

const STEPS: { 
  id: FiscalTab; 
  label: string; 
  color: string;
  emoji: string;
  disabled?: boolean;
}[] = [
  { id: 'simulation', label: 'Simulation', color: 'bg-blue-500', emoji: '⚙️' },
  { id: 'synthese', label: 'Total imposable', color: 'bg-purple-500', emoji: '🟣' },
  { id: 'details', label: 'Calcul de l\'impôt', color: 'bg-orange-500', emoji: '🟠' },
  { id: 'declaration', label: 'Déclaration', color: 'bg-emerald-500', emoji: '🟢' },
  { id: 'projections', label: 'Projections', color: 'bg-sky-500', emoji: '📈', disabled: true },
  { id: 'optimisations', label: 'Optimisations', color: 'bg-rose-500', emoji: '✨', disabled: true },
];

interface FiscalProgressBarProps {
  activeTab: FiscalTab;
  hasSimulation: boolean;
  onTabChange?: (tab: FiscalTab) => void;
}

export function FiscalProgressBar({ activeTab, hasSimulation, onTabChange }: FiscalProgressBarProps) {
  const activeIndex = STEPS.findIndex(s => s.id === activeTab);
  const progress = ((activeIndex + 1) / STEPS.length) * 100;

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-6">
      <div className="max-w-6xl mx-auto">
        {/* Timeline moderne */}
        <div className="relative">
          {/* Ligne de progression avec segments colorés */}
          <div className="flex items-center justify-between mb-3">
          {STEPS.map((step, index) => {
            const isActive = step.id === activeTab;
            const isCompleted = index < activeIndex;
            const isDisabled = step.disabled || (!hasSimulation && step.id !== 'simulation');
            const isClickable = !isDisabled && onTabChange;
              
              // Couleur du segment
              const getSegmentColor = () => {
                if (index >= activeIndex) return 'bg-gray-200';
                if (index === activeIndex - 1) return step.color.replace('bg-', 'bg-');
                return 'bg-gray-800';
              };

              return (
                <React.Fragment key={step.id}>
                  {/* Étape */}
                  <button
                    onClick={() => isClickable && onTabChange(step.id)}
                    disabled={isDisabled || !onTabChange}
                    className={`
                      flex flex-col items-center relative group
                      ${isClickable ? 'cursor-pointer' : 'cursor-default'}
                      ${isDisabled ? 'opacity-40' : ''}
                      transition-all duration-300
                    `}
                  >
                    {/* Icône avec halo subtil */}
                    <div className={`
                      relative mb-2 transition-all duration-300
                      ${isActive ? 'scale-110' : isCompleted ? 'scale-105' : 'scale-100'}
                      ${isClickable && !isActive ? 'group-hover:scale-108' : ''}
                    `}>
                      {/* Halo/Glow effect */}
                      {(isActive || isCompleted) && !isDisabled && (
                        <div className={`absolute inset-0 rounded-full blur-sm opacity-20 ${step.color}`} 
                             style={{ transform: 'scale(1.3)' }} 
                        />
                      )}
                      
                      {/* Emoji */}
                      <span className={`
                        relative text-2xl drop-shadow-sm
                        ${isDisabled ? 'grayscale opacity-50' : ''}
                      `}>
                        {isActive || isCompleted || !isDisabled ? step.emoji : '⚪'}
                      </span>
                    </div>

                    {/* Label */}
                    <div className="flex flex-col items-center gap-1">
                      <span className={`
                        text-xs font-semibold text-center max-w-[100px] leading-tight
                        transition-colors duration-300
                      ${isActive 
                        ? 'text-gray-900' 
                        : isCompleted 
                        ? step.id === 'simulation' 
                          ? 'text-blue-600' 
                          : step.id === 'synthese' 
                          ? 'text-purple-600'
                          : step.id === 'details'
                          ? 'text-orange-600'
                          : step.id === 'declaration'
                          ? 'text-emerald-600'
                          : step.id === 'projections'
                          ? 'text-sky-600'
                          : 'text-rose-600'
                        : 'text-gray-400'
                      }
                      `}>
                        {step.label}
                      </span>
                      
                      {/* Badge "À venir" */}
                      {step.disabled && (
                        <span className="text-[10px] px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full font-medium">
                          À venir
                        </span>
                      )}
                    </div>
                    
                    {/* Indicateur actif */}
                    {isActive && (
                      <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-8 h-0.5 bg-purple-600 rounded-full" />
                    )}
                  </button>

                  {/* Segment de connexion */}
                  {index < STEPS.length - 1 && (
                    <div className="flex-1 flex items-start pt-8 px-2">
                      <div className={`
                        h-1 w-full rounded-full transition-all duration-500
                        ${getSegmentColor()}
                      `} />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Compteur élégant */}
        <div className="text-center mt-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-gray-100 rounded-full">
            <span className="text-xs font-medium text-gray-600">
              Étape {activeIndex + 1}
            </span>
            <span className="text-xs text-gray-400">/</span>
            <span className="text-xs text-gray-500">
              {STEPS.length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

