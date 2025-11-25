'use client';

import React, { useState, useEffect } from 'react';
import { Brain, Calculator, TrendingUp, FileText, Sparkles, Lightbulb, Check, Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';

interface FiscalCalculatingOverlayProps {
  isCalculating: boolean;
  stepsProcessed?: number;
  totalSteps?: number;
  currentStep?: string;
  estimatedTime?: number; // en secondes
}

export function FiscalCalculatingOverlay({
  isCalculating,
  totalSteps = 6, // ✅ 6 étapes par défaut (ajout de l'optimisation fiscale)
  stepsProcessed = 0,
  currentStep,
  estimatedTime,
}: FiscalCalculatingOverlayProps) {
  const [progress, setProgress] = useState(0);
  const [animatedSteps, setAnimatedSteps] = useState<string[]>([]);

  // Calculer la progression
  useEffect(() => {
    if (isCalculating && totalSteps > 0) {
      const calculatedProgress = Math.min((stepsProcessed / totalSteps) * 100, 95);
      setProgress(calculatedProgress);
    } else if (!isCalculating) {
      setProgress(100);
      setTimeout(() => setProgress(0), 300);
    }
  }, [isCalculating, totalSteps, stepsProcessed]);

  // Animer les étapes traitées
  useEffect(() => {
    if (currentStep && !animatedSteps.includes(currentStep)) {
      setAnimatedSteps((prev) => [...prev, currentStep]);
    }
  }, [currentStep, animatedSteps]);

  // Réinitialiser quand le calcul commence
  useEffect(() => {
    if (isCalculating) {
      setAnimatedSteps([]);
      setProgress(0);
    }
  }, [isCalculating]);

  if (!isCalculating) return null;

  const progressPercent = Math.round(progress);

  // Étapes possibles du calcul
  const steps = [
    { name: 'Analyse des biens immobiliers', icon: FileText },
    { name: 'Calcul des revenus fonciers', icon: TrendingUp },
    { name: 'Optimisation des régimes fiscaux', icon: Calculator },
    { name: 'Calcul de l\'impôt sur le revenu', icon: Calculator },
    { name: 'Optimisation fiscale', icon: Lightbulb },
    { name: 'Finalisation de la simulation', icon: Check },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop avec blur */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/40 via-blue-900/50 to-indigo-900/40 backdrop-blur-md" />
      
      {/* Contenu centré */}
      <div className="relative z-10 w-full max-w-2xl px-4">
        <div className="relative overflow-hidden rounded-2xl bg-white/95 shadow-2xl backdrop-blur-xl border border-white/20">
          {/* Effet de brillance animé en haut */}
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-purple-400 to-transparent animate-pulse" />
          
          {/* Contenu principal */}
          <div className="relative p-8">
            {/* Header avec icône cerveau/tête pensante */}
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="relative">
                {/* Icône cerveau avec animation */}
                <div className="absolute inset-0 bg-purple-400/20 rounded-full blur-xl animate-ping" />
                <div className="relative bg-gradient-to-br from-purple-500 via-indigo-600 to-blue-600 p-4 rounded-2xl shadow-lg transform transition-transform duration-300 hover:scale-110">
                  <Brain className="h-8 w-8 text-white animate-pulse" />
                </div>
                {/* Particules animées autour */}
                <Sparkles className="absolute -top-1 -right-1 h-4 w-4 text-yellow-400 animate-spin" style={{ animationDuration: '3s' }} />
                <Lightbulb className="absolute -bottom-1 -left-1 h-3 w-3 text-purple-400 animate-pulse" style={{ animationDelay: '1s' }} />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  Calcul de votre simulation fiscale
                  <Calculator className="h-5 w-5 text-purple-500" />
                </h3>
                <p className="text-sm text-gray-600 mt-1">Traitement des données en cours...</p>
              </div>
            </div>

            {/* Barre de progression */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Progression</span>
                <span className="text-sm font-bold text-purple-600">{progressPercent}%</span>
              </div>
              <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden">
                {/* Fond avec gradient */}
                <div className="absolute inset-0 bg-gradient-to-r from-gray-100 to-gray-200" />
                {/* Barre de progression animée */}
                <div
                  className={cn(
                    'absolute left-0 top-0 h-full bg-gradient-to-r from-purple-500 via-indigo-600 to-blue-500 rounded-full transition-all duration-500 ease-out',
                    'shadow-lg shadow-purple-500/50'
                  )}
                  style={{ width: `${progress}%` }}
                >
                  {/* Effet de brillance qui bouge */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                </div>
              </div>
            </div>

            {/* Étapes du calcul */}
            <div className="space-y-2 mb-6">
              {steps.slice(0, totalSteps).map((step, index) => {
                const isCompleted = index < stepsProcessed;
                const isCurrent = index === stepsProcessed;
                const StepIcon = step.icon;
                
                return (
                  <div
                    key={index}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg border transition-all duration-300',
                      isCompleted && 'bg-green-50 border-green-200',
                      isCurrent && 'bg-purple-50 border-purple-300 shadow-md',
                      !isCompleted && !isCurrent && 'bg-gray-50 border-gray-200 opacity-50'
                    )}
                  >
                    <div className={cn(
                      'flex items-center justify-center w-8 h-8 rounded-full transition-all',
                      isCompleted && 'bg-green-500',
                      isCurrent && 'bg-purple-500 animate-pulse',
                      !isCompleted && !isCurrent && 'bg-gray-300'
                    )}>
                      {isCompleted ? (
                        <Check className="h-4 w-4 text-white" strokeWidth={3} />
                      ) : (
                        <StepIcon className={cn(
                          'h-4 w-4',
                          isCurrent ? 'text-white' : 'text-gray-500'
                        )} />
                      )}
                    </div>
                    <span className={cn(
                      'text-sm font-medium flex-1',
                      isCompleted && 'text-green-700',
                      isCurrent && 'text-purple-700 font-semibold',
                      !isCompleted && !isCurrent && 'text-gray-500'
                    )}>
                      {step.name}
                    </span>
                    {isCurrent && (
                      <Loader2 className="h-4 w-4 text-purple-600 animate-spin" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Statistiques */}
            {estimatedTime && estimatedTime > 0 && (
              <div className="mb-4">
                <div className="text-center p-4 bg-purple-50 rounded-xl border border-purple-100">
                  <p className="text-xs text-gray-600 mb-1">Temps estimé restant</p>
                  <p className="text-lg font-bold text-purple-600">{Math.ceil(estimatedTime)} seconde{Math.ceil(estimatedTime) > 1 ? 's' : ''}</p>
                </div>
              </div>
            )}

            {/* Message d'encouragement */}
            <div className="mt-6 text-center">
              <p className="text-xs text-gray-500 italic">
                {progressPercent < 20 && "Analyse de vos biens immobiliers en cours..."}
                {progressPercent >= 20 && progressPercent < 40 && "Calcul des revenus et charges..."}
                {progressPercent >= 40 && progressPercent < 60 && "Optimisation des régimes fiscaux..."}
                {progressPercent >= 60 && progressPercent < 80 && "Calcul de l'impôt sur le revenu..."}
                {progressPercent >= 80 && progressPercent < 95 && "Optimisation fiscale en cours..."}
                {progressPercent >= 95 && "Finalisation de votre simulation..."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
      );
}

