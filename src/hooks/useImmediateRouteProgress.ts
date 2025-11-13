'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';

interface UseImmediateRouteProgressOptions {
  delay?: number; // Délai avant d'afficher le loader (défaut: 80ms)
  maxDuration?: number; // Durée max avant auto-stop (défaut: 10s)
  enableVibration?: boolean; // Vibration tactile sur mobile (défaut: true)
}

interface UseImmediateRouteProgressReturn {
  isActive: boolean;
  progress: number;
  start: () => void;
  stop: () => void;
  onPointerDown: (e: React.PointerEvent) => void;
}

/**
 * Hook pour feedback immédiat de navigation dès pointerdown
 * Respecte la règle des 80ms et s'intègre avec le système global
 */
export function useImmediateRouteProgress(
  options: UseImmediateRouteProgressOptions = {}
): UseImmediateRouteProgressReturn {
  const {
    delay = 80,
    maxDuration = 10000,
    enableVibration = true
  } = options;

  const [isActive, setIsActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const pathname = usePathname();
  
  const timeoutRef = useRef<NodeJS.Timeout>();
  const intervalRef = useRef<NodeJS.Timeout>();
  const maxTimeoutRef = useRef<NodeJS.Timeout>();
  const startTimeRef = useRef<number>();

  // Arrêter automatiquement quand le pathname change
  useEffect(() => {
    if (isActive) {
      stop();
    }
  }, [pathname]);

  const start = useCallback(() => {
    if (isActive) return;

    // Vibration tactile sur mobile (si PWA et supporté)
    if (enableVibration && 'vibrate' in navigator && window.matchMedia('(pointer: coarse)').matches) {
      try {
        navigator.vibrate(10);
      } catch (error) {
        // Ignore silently
      }
    }

    startTimeRef.current = Date.now();

    // Délai avant activation pour éviter les flashs
    timeoutRef.current = setTimeout(() => {
      setIsActive(true);
      setProgress(10);

      // Progression simule
      intervalRef.current = setInterval(() => {
        const elapsed = Date.now() - (startTimeRef.current || 0);
        const progressValue = Math.min(90, 10 + (elapsed / maxDuration) * 80);
        setProgress(progressValue);
      }, 100);

      // Arrêt automatique après durée max
      maxTimeoutRef.current = setTimeout(() => {
        stop();
      }, maxDuration);
    }, delay);
  }, [isActive, delay, maxDuration, enableVibration]);

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
      }, 150);
    } else {
      setIsActive(false);
      setProgress(0);
    }
  }, [isActive]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    // Ignorer clic droit et interactions non-primaires
    if (e.button !== 0) return;
    
    // Démarrer le feedback immédiat
    start();

    // Écouter les annulations globales
    const handleKeyDown = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key === 'Escape') {
        stop();
      }
    };

    const handleContextMenu = () => {
      stop();
    };

    // Écouter les événements d'annulation
    document.addEventListener('keydown', handleKeyDown, { once: true });
    document.addEventListener('contextmenu', handleContextMenu, { once: true });

    // Nettoyage automatique après un délai
    setTimeout(() => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('contextmenu', handleContextMenu);
    }, 1000);
  }, [start, stop]);

  // Nettoyage à la destruction
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (maxTimeoutRef.current) clearTimeout(maxTimeoutRef.current);
    };
  }, []);

  return {
    isActive,
    progress,
    start,
    stop,
    onPointerDown
  };
}

/**
 * Hook simplifié pour les cas d'usage courants
 */
export function useQuickNavigationFeedback() {
  const { isActive, onPointerDown } = useImmediateRouteProgress({
    delay: 50, // Plus rapide pour navigation
    maxDuration: 5000
  });

  return {
    isNavigating: isActive,
    onNavigationStart: onPointerDown
  };
}
