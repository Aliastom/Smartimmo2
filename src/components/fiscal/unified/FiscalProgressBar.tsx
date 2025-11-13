/**
 * FiscalProgressBar - Barre de progression horizontale pour l'Espace Fiscal
 * 
 * Timeline visuelle indiquant la progression dans le flux fiscal
 */

'use client';

import { SlidersHorizontal, BarChart2, FileText, TrendingUp, Sparkles } from 'lucide-react';
import type { FiscalTab } from '@/hooks/useFiscalTabs';

const STEPS: { id: FiscalTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'simulation', label: 'Simulation', icon: SlidersHorizontal },
  { id: 'synthese', label: 'Synthèse', icon: BarChart2 },
  { id: 'details', label: 'Détails', icon: FileText },
  { id: 'projections', label: 'Projections', icon: TrendingUp },
  { id: 'optimisations', label: 'Optimisations', icon: Sparkles },
];

interface FiscalProgressBarProps {
  activeTab: FiscalTab;
  hasSimulation: boolean;
}

export function FiscalProgressBar({ activeTab, hasSimulation }: FiscalProgressBarProps) {
  const activeIndex = STEPS.findIndex(s => s.id === activeTab);
  const progress = ((activeIndex + 1) / STEPS.length) * 100;

  return (
    <div className="bg-white/90 backdrop-blur-sm border-b border-gray-200 px-4 py-3">
      <div className="max-w-7xl mx-auto">
        {/* Timeline */}
        <div className="flex items-center justify-between relative">
          {/* Ligne de fond */}
          <div className="absolute top-4 left-0 right-0 h-1 bg-gray-200 rounded-full" style={{ zIndex: 0 }} />
          
          {/* Ligne de progression */}
          <div 
            className="absolute top-4 left-0 h-1 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%`, zIndex: 1 }}
          />

          {/* Steps */}
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = step.id === activeTab;
            const isCompleted = index < activeIndex;
            const isDisabled = !hasSimulation && step.id !== 'simulation';

            return (
              <div key={step.id} className="flex flex-col items-center relative" style={{ zIndex: 2 }}>
                {/* Cercle */}
                <div 
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center transition-all
                    ${isActive 
                      ? 'bg-gradient-to-br from-purple-500 to-blue-500 shadow-lg scale-110' 
                      : isCompleted
                      ? 'bg-emerald-500 shadow-md'
                      : isDisabled
                      ? 'bg-gray-300'
                      : 'bg-white border-2 border-gray-300'
                    }
                  `}
                >
                  <Icon 
                    className={`h-4 w-4 ${
                      isActive || isCompleted ? 'text-white' : isDisabled ? 'text-gray-400' : 'text-gray-600'
                    }`} 
                  />
                </div>

                {/* Label */}
                <span 
                  className={`
                    text-xs mt-1 font-medium
                    ${isActive ? 'text-purple-600' : isCompleted ? 'text-emerald-600' : 'text-gray-500'}
                  `}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Compteur */}
        <div className="text-center mt-2">
          <span className="text-xs text-gray-500">
            Étape {activeIndex + 1} sur {STEPS.length}
          </span>
        </div>
      </div>
    </div>
  );
}

