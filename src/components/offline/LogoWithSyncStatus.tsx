'use client';

/**
 * Logo "S" qui se transforme en loader pendant la sync, puis en check, puis revient au "S"
 * Remplace le logo statique par un indicateur de sync intégré
 * En offline, affiche une icône WiFi barrée grisée
 * Tooltip au survol/long-press avec message selon l'état
 */

import React, { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { Loader2, CheckCircle2, WifiOff } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/Tooltip';
import { useSyncStatus } from '@/hooks/offline/useSyncStatus';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import { getSyncStatus } from '@/lib/offline/syncStatusStore';

const MIN_LOADER_DISPLAY_MS = 400;

interface LogoWithSyncStatusProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  bgColor?: string; // Couleur de fond personnalisée (ex: 'bg-primary-500', 'bg-[#ff6b35]')
}

export function LogoWithSyncStatus({ className, size = 'md', bgColor = 'bg-[#ff6b35]' }: LogoWithSyncStatusProps) {
  const pathname = usePathname();
  const { organizationId } = useCurrentOrganization();
  const { status: hookStatus, fullSyncRunning, isOnline } = useSyncStatus(organizationId);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error' | 'offline'>('idle');
  const [showSuccess, setShowSuccess] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const previousStatusRef = React.useRef<'idle' | 'syncing' | 'error' | 'offline'>('idle');
  const successTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartTimeRef = useRef<number | null>(null);
  const syncingStartRef = useRef<number | null>(null);
  const minDisplayTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Lire l'état actuel au montage (évite de rater "syncing" si chunk lazy en PWA)
  useEffect(() => {
    const stored = getSyncStatus();
    if (stored !== 'idle') setSyncStatus(stored);
  }, []);

  // Écouter les événements sync:status pour les mises à jour
  useEffect(() => {
    const handleSyncStatus = (event: CustomEvent) => {
      const { status, organizationId: eventOrgId } = event.detail;
      if (!organizationId || eventOrgId === organizationId) setSyncStatus(status);
    };

    window.addEventListener('sync:status', handleSyncStatus as EventListener);
    return () => {
      window.removeEventListener('sync:status', handleSyncStatus as EventListener);
      if (minDisplayTimeoutRef.current) clearTimeout(minDisplayTimeoutRef.current);
    };
  }, [organizationId]);

  const effectiveStatus = syncStatus !== 'idle' ? syncStatus : hookStatus;
  const rawSyncing = effectiveStatus === 'syncing' || fullSyncRunning;
  // Min display time: garder le loader visible au moins 400ms (évite flash si sync rapide en PWA)
  const [minDisplayActive, setMinDisplayActive] = useState(false);
  const isSyncing = rawSyncing || minDisplayActive;

  useEffect(() => {
    if (rawSyncing) {
      setMinDisplayActive(true);
      syncingStartRef.current = Date.now();
    } else if (minDisplayActive) {
      const elapsed = syncingStartRef.current ? Date.now() - syncingStartRef.current : 0;
      const remaining = Math.max(0, MIN_LOADER_DISPLAY_MS - elapsed);
      minDisplayTimeoutRef.current = setTimeout(() => setMinDisplayActive(false), remaining);
    }
    return () => {
      if (minDisplayTimeoutRef.current) {
        clearTimeout(minDisplayTimeoutRef.current);
        minDisplayTimeoutRef.current = null;
      }
    };
  }, [rawSyncing, minDisplayActive]);

  // Détecter quand la sync se termine (passage de 'syncing' à 'idle')
  useEffect(() => {
    const wasSyncing = previousStatusRef.current === 'syncing' || 
                       (previousStatusRef.current === 'idle' && fullSyncRunning);
    const isNowIdle = effectiveStatus === 'idle' && !fullSyncRunning;

    if (wasSyncing && isNowIdle) {
      // Afficher la check pendant 2 secondes
      setShowSuccess(true);
      setIsFadingOut(false);

      // Nettoyer le timeout précédent si il existe
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }

      // Faire disparaître la check après 2 secondes
      successTimeoutRef.current = setTimeout(() => {
        setIsFadingOut(true);
        // Après l'animation de fade-out, cacher complètement
        setTimeout(() => {
          setShowSuccess(false);
          setIsFadingOut(false);
        }, 500); // Durée de l'animation fade-out
      }, 2000);
    }

    previousStatusRef.current = effectiveStatus;

    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, [effectiveStatus, fullSyncRunning]);

  // Tailles du logo
  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-10 h-10 text-base',
  };

  const iconSizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  const sizeClass = sizeClasses[size];
  const iconSizeClass = iconSizeClasses[size];

  // Déterminer ce qu'on doit afficher
  const shouldShowOffline = !isOnline && !isSyncing && !showSuccess;

  // Déterminer le message du tooltip selon l'état
  const getTooltipMessage = (): string => {
    if (isSyncing) {
      return 'Synchronisation en cours…';
    }
    if (!isOnline) {
      return 'Hors connexion — les actions seront synchronisées ultérieurement';
    }
    if (isOnline) {
      return 'Connecté';
    }
    return 'Smartimmo';
  };

  // Gestion du long-press pour mobile (force l'ouverture du tooltip)
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartTimeRef.current = Date.now();
    longPressTimerRef.current = setTimeout(() => {
      setTooltipOpen(true);
      // Vibrer légèrement sur mobile pour feedback (si disponible)
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 500); // 500ms pour long-press
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    // Si c'était un long-press, garder le tooltip ouvert pendant 2 secondes
    if (touchStartTimeRef.current && Date.now() - touchStartTimeRef.current >= 500) {
      // Le tooltip est déjà ouvert, le fermer après 2 secondes
      setTimeout(() => {
        setTooltipOpen(false);
      }, 2000);
    }
    touchStartTimeRef.current = null;
  };

  const handleTouchCancel = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    touchStartTimeRef.current = null;
  };

  // Nettoyer les timers au démontage
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  return (
    <Tooltip 
      open={tooltipOpen}
      onOpenChange={(open) => {
        // Permettre à Radix UI de gérer le hover (desktop) ET notre long-press (mobile)
        setTooltipOpen(open);
      }}
    >
      <TooltipTrigger asChild>
        <div
          className={`flex items-center justify-center rounded-lg ${bgColor} ${sizeClass} ${className || ''} ${
            shouldShowOffline ? 'opacity-60' : ''
          }`}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchCancel}
        >
          {isSyncing ? (
            <Loader2 className={`${iconSizeClass} text-white animate-spin`} />
          ) : showSuccess ? (
            <CheckCircle2
              className={`${iconSizeClass} text-white transition-opacity duration-500 ${
                isFadingOut ? 'opacity-0' : 'opacity-100'
              }`}
            />
          ) : shouldShowOffline ? (
            <div className="relative flex items-center justify-center w-full h-full">
              <span className="text-white/50 font-bold filter grayscale">S</span>
              <WifiOff className={`${iconSizeClass} absolute text-white/70 filter grayscale`} strokeWidth={2.5} />
            </div>
          ) : (
            <span className="text-white font-bold">S</span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {getTooltipMessage()}
      </TooltipContent>
    </Tooltip>
  );
}

