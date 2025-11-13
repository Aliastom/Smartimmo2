'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/utils/cn';
import { useOptionalRouteProgress } from '../RouteProgressProvider';

interface RouteProgressProps {
  className?: string;
  color?: string;
  height?: number;
  showDelay?: number;
}

export function RouteProgress({ 
  className, 
  color = 'bg-primary',
  height = 2,
  showDelay = 300
}: RouteProgressProps) {
  const pathname = usePathname();
  const routeProgressContext = useOptionalRouteProgress();
  
  // États locaux (fallback si pas de provider)
  const [localIsVisible, setLocalIsVisible] = useState(false);
  const [localProgress, setLocalProgress] = useState(0);

  // Utiliser le contexte si disponible, sinon fallback local
  const isVisible = routeProgressContext?.isActive ?? localIsVisible;
  const progress = routeProgressContext?.progress ?? localProgress;

  // Logique locale uniquement si pas de provider
  useEffect(() => {
    if (routeProgressContext) return; // Provider gère déjà tout

    let timeout: NodeJS.Timeout;
    let interval: NodeJS.Timeout;

    const startProgress = () => {
      setLocalIsVisible(true);
      setLocalProgress(10);

      // Simulation progressive du chargement
      interval = setInterval(() => {
        setLocalProgress(prev => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 10;
        });
      }, 200);
    };

    const finishProgress = () => {
      setLocalProgress(100);
      setTimeout(() => {
        setLocalIsVisible(false);
        setLocalProgress(0);
      }, 200);
    };

    // Démarrer après le délai pour éviter les flashs
    timeout = setTimeout(startProgress, showDelay);

    // Simuler la fin du chargement après un délai réaliste
    const finishTimeout = setTimeout(finishProgress, 1000 + Math.random() * 2000);

    return () => {
      clearTimeout(timeout);
      clearTimeout(finishTimeout);
      clearInterval(interval);
    };
  }, [pathname, showDelay, routeProgressContext]);

  if (!isVisible) return null;

  return (
    <div 
      className={cn(
        'fixed top-0 left-0 right-0 z-50',
        className
      )}
      role="progressbar"
      aria-busy="true"
      aria-label="Chargement de la page"
    >
      <div 
        className={cn(
          'h-0.5 transition-all duration-200 ease-out motion-reduce:transition-none',
          color
        )}
        style={{ 
          width: `${progress}%`,
          height: `${height}px`
        }}
      />
    </div>
  );
}

// Hook pour contrôler manuellement la barre de progression
export function useRouteProgress() {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const start = () => {
    setIsLoading(true);
    setProgress(10);
  };

  const update = (value: number) => {
    setProgress(Math.min(100, Math.max(0, value)));
  };

  const finish = () => {
    setProgress(100);
    setTimeout(() => {
      setIsLoading(false);
      setProgress(0);
    }, 200);
  };

  return {
    isLoading,
    progress,
    start,
    update,
    finish
  };
}

// Composant pour les barres de progression contextuelles
export function ContextualProgress({ 
  isVisible, 
  progress = 0, 
  label,
  className 
}: {
  isVisible: boolean;
  progress?: number;
  label?: string;
  className?: string;
}) {
  if (!isVisible) return null;

  return (
    <div className={cn('w-full space-y-2', className)}>
      {label && (
        <div className="flex justify-between items-center text-sm text-gray-600">
          <span>{label}</span>
          <span>{Math.round(progress)}%</span>
        </div>
      )}
      <div 
        className="w-full bg-gray-200 rounded-full h-2 overflow-hidden"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div 
          className="h-full bg-primary transition-all duration-300 ease-out rounded-full motion-reduce:transition-none"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
