'use client';

import React, { useState, useEffect } from 'react';
import { Upload, FileText, Check, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/utils/cn';

interface DocumentUploadLoadingOverlayProps {
  isUploading: boolean;
  fileName?: string;
  progress?: number; // 0-100
  currentStep?: string;
}

export function DocumentUploadLoadingOverlay({
  isUploading,
  fileName,
  progress,
  currentStep,
}: DocumentUploadLoadingOverlayProps) {
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const prevIsUploadingRef = React.useRef(false);

  // Animer la progression
  useEffect(() => {
    // Détecter le passage de false à true (début d'upload)
    if (isUploading && !prevIsUploadingRef.current) {
      // Réinitialiser uniquement au début d'un nouvel upload
      setAnimatedProgress(0);
    }
    prevIsUploadingRef.current = isUploading;

    if (isUploading && progress !== undefined) {
      // Animation fluide de la barre de progression
      const targetProgress = Math.min(progress, 95); // Ne pas aller à 100% pendant l'upload
      setAnimatedProgress((prev) => {
        if (targetProgress > prev) {
          return Math.min(prev + 2, targetProgress); // Incrément progressif
        }
        return prev;
      });
    } else if (!isUploading) {
      // Mettre à 100% quand terminé
      setAnimatedProgress(100);
    }
  }, [isUploading, progress]);

  if (!isUploading) return null;

  const progressPercent = Math.round(animatedProgress);

  // Étapes possibles de l'upload
  const steps = [
    { name: 'Préparation du fichier', icon: FileText },
    { name: 'Upload vers le serveur', icon: Upload },
    { name: 'Traitement du document', icon: Loader2 },
    { name: 'Enregistrement final', icon: Check },
  ];

  // Déterminer l'étape actuelle basée sur la progression
  const currentStepIndex = progressPercent < 25 ? 0 : progressPercent < 50 ? 1 : progressPercent < 75 ? 2 : 3;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop avec blur */}
      <div className="absolute inset-0 bg-gradient-to-br from-orange-900/40 via-amber-900/50 to-orange-900/40 backdrop-blur-md" />
      
      {/* Contenu centré */}
      <div className="relative z-10 w-full max-w-2xl px-4">
        <div className="relative overflow-hidden rounded-2xl bg-white/95 shadow-2xl backdrop-blur-xl border border-white/20">
          {/* Effet de brillance animé en haut */}
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-orange-400 to-transparent animate-pulse" />
          
          {/* Contenu principal */}
          <div className="relative p-8">
            {/* Header avec icône */}
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="relative">
                {/* Icône upload avec animation */}
                <div className="absolute inset-0 bg-orange-400/20 rounded-full blur-xl animate-ping" />
                <div className="relative bg-gradient-to-br from-orange-500 via-amber-600 to-orange-600 p-4 rounded-2xl shadow-lg transform transition-transform duration-300 hover:scale-110">
                  <Upload className="h-8 w-8 text-white animate-pulse" />
                </div>
                {/* Particules animées autour */}
                <Sparkles className="absolute -top-1 -right-1 h-4 w-4 text-yellow-400 animate-spin" style={{ animationDuration: '3s' }} />
                <FileText className="absolute -bottom-1 -left-1 h-3 w-3 text-orange-400 animate-pulse" style={{ animationDelay: '1s' }} />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  Enregistrement du document
                  <FileText className="h-5 w-5 text-orange-500" />
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {fileName ? `Traitement de ${fileName}...` : 'Traitement en cours...'}
                </p>
              </div>
            </div>

            {/* Barre de progression */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Progression</span>
                <span className="text-sm font-bold text-orange-600">{progressPercent}%</span>
              </div>
              <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden">
                {/* Fond avec gradient */}
                <div className="absolute inset-0 bg-gradient-to-r from-gray-100 to-gray-200" />
                {/* Barre de progression animée */}
                <div
                  className={cn(
                    'absolute left-0 top-0 h-full bg-gradient-to-r from-orange-500 via-amber-600 to-orange-500 rounded-full transition-all duration-500 ease-out',
                    'shadow-lg shadow-orange-500/50'
                  )}
                  style={{ width: `${animatedProgress}%` }}
                >
                  {/* Effet de brillance qui bouge */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                </div>
              </div>
            </div>

            {/* Étapes de l'upload */}
            <div className="space-y-2 mb-6">
              {steps.map((step, index) => {
                const isCompleted = index < currentStepIndex;
                const isCurrent = index === currentStepIndex;
                const StepIcon = step.icon;
                
                return (
                  <div
                    key={index}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg border transition-all duration-300',
                      isCompleted && 'bg-green-50 border-green-200',
                      isCurrent && 'bg-orange-50 border-orange-300 shadow-md',
                      !isCompleted && !isCurrent && 'bg-gray-50 border-gray-200 opacity-50'
                    )}
                  >
                    <div className={cn(
                      'flex items-center justify-center w-8 h-8 rounded-full transition-all',
                      isCompleted && 'bg-green-500',
                      isCurrent && 'bg-orange-500 animate-pulse',
                      !isCompleted && !isCurrent && 'bg-gray-300'
                    )}>
                      {isCompleted ? (
                        <Check className="h-4 w-4 text-white" strokeWidth={3} />
                      ) : (
                        <StepIcon className={cn(
                          'h-4 w-4',
                          isCurrent ? 'text-white' : 'text-gray-500',
                          isCurrent && StepIcon === Loader2 && 'animate-spin'
                        )} />
                      )}
                    </div>
                    <span className={cn(
                      'text-sm font-medium flex-1',
                      isCompleted && 'text-green-700',
                      isCurrent && 'text-orange-700 font-semibold',
                      !isCompleted && !isCurrent && 'text-gray-500'
                    )}>
                      {step.name}
                    </span>
                    {isCurrent && StepIcon !== Loader2 && (
                      <Loader2 className="h-4 w-4 text-orange-600 animate-spin" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Message d'encouragement */}
            <div className="mt-6 text-center">
              <p className="text-xs text-gray-500 italic">
                {progressPercent < 25 && "Préparation de votre document..."}
                {progressPercent >= 25 && progressPercent < 50 && "Upload en cours..."}
                {progressPercent >= 50 && progressPercent < 75 && "Traitement et analyse..."}
                {progressPercent >= 75 && progressPercent < 95 && "Finalisation de l'enregistrement..."}
                {progressPercent >= 95 && "Presque terminé..."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

