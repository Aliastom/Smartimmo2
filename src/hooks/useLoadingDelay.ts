'use client';

import { useState, useEffect } from 'react';

/**
 * Hook pour éviter l'affichage de loaders pendant les premières millisecondes
 * Respecte la règle globale : ne rien afficher < 300ms
 * 
 * @param isLoading - État de chargement
 * @param delay - Délai en milliseconds avant d'afficher le loader (défaut: 300ms)
 * @returns boolean - true si le loader doit être affiché
 * 
 * @example
 * const showLoader = useLoadingDelay(isLoading, 300);
 * return showLoader ? <Skeleton /> : null;
 */
export function useLoadingDelay(isLoading: boolean, delay: number = 300): boolean {
  const [showLoader, setShowLoader] = useState(false);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    if (isLoading) {
      // Démarrer le timer pour afficher le loader après le délai
      timeoutId = setTimeout(() => {
        setShowLoader(true);
      }, delay);
    } else {
      // Cacher immédiatement si plus en chargement
      setShowLoader(false);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isLoading, delay]);

  return showLoader;
}

/**
 * Hook pour gérer les différents états temporels selon la règle globale
 * 
 * @param isLoading - État de chargement
 * @param startTime - Timestamp du début du chargement
 * @returns Objet avec les différents états temporels
 */
export function useLoadingStates(isLoading: boolean, startTime?: number) {
  const [elapsedTime, setElapsedTime] = useState(0);
  
  const showLoader = useLoadingDelay(isLoading, 300);

  useEffect(() => {
    if (!isLoading || !startTime) {
      setElapsedTime(0);
      return;
    }

    const interval = setInterval(() => {
      setElapsedTime(Date.now() - startTime);
    }, 100);

    return () => clearInterval(interval);
  }, [isLoading, startTime]);

  return {
    // < 300ms : ne rien afficher
    showLoader,
    // 0.3-2s : SKELETONS
    showSkeleton: showLoader && elapsedTime < 2000,
    // > 2s : barre de progression + micro-texte
    showProgressBar: showLoader && elapsedTime >= 2000,
    // > 8s : action utilisateur possible
    showUserActions: showLoader && elapsedTime >= 8000,
    elapsedTime
  };
}
