'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/utils/cn';

interface RouteProgressContextType {
  isActive: boolean;
  progress: number;
  start: () => void;
  stop: () => void;
  update: (progress: number) => void;
}

const RouteProgressContext = createContext<RouteProgressContextType | null>(null);

interface RouteProgressProviderProps {
  children: React.ReactNode;
  className?: string;
  color?: string;
  height?: number;
  showDelay?: number;
  enableGlobalCapture?: boolean;
}

export function RouteProgressProvider({
  children,
  className,
  color = 'bg-primary',
  height = 2,
  showDelay = 80,
  enableGlobalCapture = true
}: RouteProgressProviderProps) {
  const [isActive, setIsActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const pathname = usePathname();
  
  const timeoutRef = useRef<NodeJS.Timeout>();
  const intervalRef = useRef<NodeJS.Timeout>();
  const maxTimeoutRef = useRef<NodeJS.Timeout>();

  // Arrêter automatiquement quand le pathname change
  useEffect(() => {
    if (isActive) {
      // Animation de fin
      setProgress(100);
      setTimeout(() => {
        setIsActive(false);
        setProgress(0);
      }, 200);
    }
  }, [pathname]);

  const start = useCallback(() => {
    if (isActive) return;

    // Délai avant activation pour éviter les flashs
    timeoutRef.current = setTimeout(() => {
      setIsActive(true);
      setProgress(10);

      // Progression simulée
      intervalRef.current = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 8;
        });
      }, 150);

      // Arrêt automatique après 8s
      maxTimeoutRef.current = setTimeout(() => {
        stop();
      }, 8000);
    }, showDelay);
  }, [isActive, showDelay]);

  const stop = useCallback(() => {
    // Nettoyage des timers
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    if (maxTimeoutRef.current) {
      clearTimeout(maxTimeoutRef.current);
    }

    if (isActive) {
      // Animation de fin
      setProgress(100);
      setTimeout(() => {
        setIsActive(false);
        setProgress(0);
      }, 200);
    } else {
      setIsActive(false);
      setProgress(0);
    }
  }, [isActive]);

  const update = useCallback((newProgress: number) => {
    setProgress(Math.min(100, Math.max(0, newProgress)));
  }, []);

  // Capture globale des clics pour navigation
  useEffect(() => {
    if (!enableGlobalCapture) return;

    const handlePointerDown = (e: PointerEvent) => {
      // Ignorer clic droit et interactions non-primaires
      if (e.button !== 0) return;
      
      const target = e.target as HTMLElement;
      
      // Vérifier si c'est un lien de navigation ou élément interactif
      const isNavigationElement = (
        target.tagName === 'A' ||
        target.closest('a') ||
        target.hasAttribute('data-navigation') ||
        target.closest('[data-navigation]') ||
        target.classList.contains('nav-link') ||
        target.closest('.nav-link')
      );

      if (isNavigationElement) {
        start();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isActive) {
        stop();
      }
    };

    // Capture au niveau document pour attraper tous les clics
    document.addEventListener('pointerdown', handlePointerDown, { capture: true });
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, { capture: true });
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [enableGlobalCapture, start, stop, isActive]);

  // Nettoyage à la destruction
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (maxTimeoutRef.current) clearTimeout(maxTimeoutRef.current);
    };
  }, []);

  const contextValue: RouteProgressContextType = {
    isActive,
    progress,
    start,
    stop,
    update
  };

  return (
    <RouteProgressContext.Provider value={contextValue}>
      {/* Barre de progression globale */}
      {isActive && (
        <div 
          className={cn(
            'fixed top-0 left-0 right-0 z-50',
            className
          )}
          role="progressbar"
          aria-busy="true"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Navigation en cours"
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
      )}
      
      {children}
    </RouteProgressContext.Provider>
  );
}

/**
 * Hook pour utiliser le contexte de progression de route
 */
export function useRouteProgressContext(): RouteProgressContextType {
  const context = useContext(RouteProgressContext);
  
  if (!context) {
    throw new Error(
      'useRouteProgressContext must be used within a RouteProgressProvider'
    );
  }
  
  return context;
}

/**
 * Hook optionnel qui fonctionne avec ou sans provider
 */
export function useOptionalRouteProgress(): RouteProgressContextType | null {
  return useContext(RouteProgressContext);
}
