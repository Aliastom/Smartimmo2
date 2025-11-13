'use client';

import React, { useEffect, useState } from 'react';
import { FileText, Zap, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { ContextualProgress } from '@/components/ui/RouteProgress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

export interface ConversionStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'completed' | 'error';
  duration?: number;
}

export interface ConversionProgress {
  fileIndex: number;
  fileName: string;
  totalFiles: number;
  currentStep: string;
  steps: ConversionStep[];
  overallProgress: number;
}

interface ConversionLoaderProps {
  isVisible: boolean;
  progress: ConversionProgress;
  className?: string;
}

const defaultSteps: ConversionStep[] = [
  { id: 'validation', label: 'Validation du fichier', status: 'pending' },
  { id: 'conversion', label: 'Conversion en PDF', status: 'pending' },
  { id: 'ocr', label: 'Extraction du texte', status: 'pending' },
  { id: 'classification', label: 'Classification automatique', status: 'pending' },
  { id: 'complete', label: 'Finalisation', status: 'pending' }
];

export default function ConversionLoader({ 
  isVisible, 
  progress, 
  className = '' 
}: ConversionLoaderProps) {
  const [animatedProgress, setAnimatedProgress] = useState(0);

  // Animation du progress
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedProgress(progress.overallProgress);
    }, 100);
    return () => clearTimeout(timer);
  }, [progress.overallProgress]);

  if (!isVisible) return null;

  const getStepIcon = (step: ConversionStep) => {
    switch (step.status) {
      case 'active':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <div className="h-4 w-4 rounded-full border-2 border-gray-300" />;
    }
  };

  const getStepTextColor = (step: ConversionStep) => {
    switch (step.status) {
      case 'active':
        return 'text-blue-900 font-medium';
      case 'completed':
        return 'text-green-700';
      case 'error':
        return 'text-red-700';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className={`w-full max-w-lg ${className}`}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <Zap className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-xl">Conversion en cours</CardTitle>
              <p className="text-sm text-gray-600">
                Fichier {progress.fileIndex + 1} sur {progress.totalFiles}
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Fichier en cours */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-blue-600" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{progress.fileName}</p>
                <p className="text-xs text-gray-500">
                  {progress.currentStep}
                </p>
              </div>
            </div>
          </div>

          {/* Barre de progression globale */}
          <ContextualProgress
            isVisible={true}
            progress={animatedProgress}
            label="Progression"
          />

          {/* Étapes détaillées */}
          <div>
            <h4 className="font-medium text-sm mb-3 text-gray-700">Étapes</h4>
            <div className="space-y-3">
              {(progress.steps.length > 0 ? progress.steps : defaultSteps).map((step, index) => (
                <div key={step.id} className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    {getStepIcon(step)}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm ${getStepTextColor(step)}`}>
                      {step.label}
                      {step.duration && step.status === 'completed' && (
                        <span className="ml-2 text-xs text-gray-400">
                          ({step.duration}ms)
                        </span>
                      )}
                    </p>
                  </div>
                  {step.status === 'active' && (
                    <div className="flex-shrink-0">
                      <div className="flex space-x-1">
                        <div className="w-1 h-1 bg-blue-600 rounded-full animate-pulse"></div>
                        <div className="w-1 h-1 bg-blue-600 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                        <div className="w-1 h-1 bg-blue-600 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Message informatif */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-700">
              💡 <strong>Patience :</strong> La conversion peut prendre quelques secondes selon la taille du document.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
