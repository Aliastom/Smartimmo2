'use client';

/**
 * Indicateur de synchronisation discret pour la sidebar
 * Affiche un spinner discret quand une sync est en cours
 * Non bloquant, avec debounce pour éviter le clignotement
 */

import React, { useState, useEffect, useRef } from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { useSyncStatus } from '@/hooks/offline/useSyncStatus';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';

interface SidebarSyncIndicatorProps {
  className?: string;
}

export function SidebarSyncIndicator({ className }: SidebarSyncIndicatorProps) {
  const { organizationId } = useCurrentOrganization();
  const { status: hookStatus, fullSyncRunning } = useSyncStatus(organizationId);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error' | 'offline'>('idle');
  const [showSpinner, setShowSpinner] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const successTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousStatusRef = useRef<'idle' | 'syncing' | 'error' | 'offline'>('idle');

  // Écouter les événements sync:status pour recevoir les mises à jour de statut depuis toutes les instances
  useEffect(() => {
    const handleSyncStatus = (event: CustomEvent) => {
      const { status, organizationId: eventOrgId } = event.detail;
      // Ne prendre en compte que si c'est pour la même organisation
      if (!organizationId || eventOrgId === organizationId) {
        setSyncStatus(status);
      }
    };

    window.addEventListener('sync:status', handleSyncStatus as EventListener);
    return () => {
      window.removeEventListener('sync:status', handleSyncStatus as EventListener);
    };
  }, [organizationId]);

  // Utiliser le statut de l'événement en priorité, sinon celui du hook
  const effectiveStatus = syncStatus !== 'idle' ? syncStatus : hookStatus;

  // Détecter quand la sync se termine (passage de 'syncing' à 'idle')
  useEffect(() => {
    const wasSyncing = previousStatusRef.current === 'syncing';
    const isNowIdle = effectiveStatus === 'idle' && !fullSyncRunning;
    
    if (wasSyncing && isNowIdle) {
      // La sync vient de se terminer avec succès
      setShowSpinner(false);
      setShowSuccess(true);
      
      // Nettoyer le timeout précédent si présent
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
      
      // Faire disparaître progressivement après 1.5 secondes
      successTimeoutRef.current = setTimeout(() => {
        setIsFadingOut(true);
        // Masquer complètement après la fin de l'animation (0.5s)
        setTimeout(() => {
          setShowSuccess(false);
          setIsFadingOut(false);
        }, 500);
      }, 1500);
    }
    
    previousStatusRef.current = effectiveStatus;
    
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, [effectiveStatus, fullSyncRunning]);

  // Debounce l'affichage du spinner (100ms pour éviter le clignotement sur les sync très rapides)
  useEffect(() => {
    // Considérer qu'une sync est en cours si status === 'syncing' OU fullSyncRunning === true
    const isSyncing = effectiveStatus === 'syncing' || fullSyncRunning;
    
    // Nettoyer le timeout précédent
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }

    if (isSyncing) {
      // Masquer le succès si on recommence une sync
      setShowSuccess(false);
      // Afficher après 100ms si toujours en sync (debounce pour éviter le clignotement)
      debounceTimeoutRef.current = setTimeout(() => {
        setShowSpinner(true);
      }, 100);
    } else if (effectiveStatus !== 'idle' || fullSyncRunning) {
      // Masquer immédiatement si on n'est pas en sync et pas en idle
      setShowSpinner(false);
    }

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }
    };
  }, [effectiveStatus, fullSyncRunning]);

  // Ne rien afficher si pas de sync en cours et pas de succès à afficher
  if (!showSpinner && !showSuccess) {
    return null;
  }

  return (
    <div
      className={`inline-flex items-center ${className || ''}`}
      title={showSpinner ? "Synchronisation des données en cours…" : "Synchronisation terminée"}
    >
      {showSpinner && (
        <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
      )}
      {showSuccess && (
        <CheckCircle2 
          className={`h-4 w-4 text-green-500 transition-opacity duration-500 ${
            isFadingOut ? 'opacity-0' : 'opacity-100'
          }`}
        />
      )}
    </div>
  );
}

