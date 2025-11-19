'use client';

import { useState, useEffect, useCallback } from 'react';

interface ServiceWorkerUpdateState {
  waitingWorker: ServiceWorker | null;
  isUpdateAvailable: boolean;
  updateServiceWorker: () => void;
  dismissUpdate: () => void;
}

/**
 * Hook pour détecter et gérer les mises à jour du service worker
 * 
 * Usage:
 * const { waitingWorker, isUpdateAvailable, updateServiceWorker } = useServiceWorkerUpdate();
 */
export function useServiceWorkerUpdate(): ServiceWorkerUpdateState {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);

  // Fonction pour mettre à jour le service worker
  const updateServiceWorker = useCallback(() => {
    if (waitingWorker) {
      // Envoyer le message SKIP_WAITING au service worker
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      
      // Réinitialiser l'état
      setWaitingWorker(null);
      setIsUpdateAvailable(false);
      
      // Recharger la page après un court délai pour laisser le SW se mettre à jour
      setTimeout(() => {
        window.location.reload();
      }, 100);
    }
  }, [waitingWorker]);

  // Fonction pour ignorer la mise à jour (masquer le bandeau)
  const dismissUpdate = useCallback(() => {
    setWaitingWorker(null);
    setIsUpdateAvailable(false);
  }, []);

  useEffect(() => {
    // Vérifications de sécurité
    if (typeof window === 'undefined') {
      return;
    }

    // Vérifier que nous sommes en production
    const isProduction = process.env.NODE_ENV === 'production';
    if (!isProduction) {
      return;
    }

    if (!('serviceWorker' in navigator)) {
      return;
    }

    // Fonction pour vérifier les mises à jour
    const checkForUpdates = () => {
      navigator.serviceWorker.getRegistration().then((registration) => {
        if (!registration) {
          return;
        }

        // Vérifier s'il y a un service worker en attente
        if (registration.waiting) {
          // Il y a un SW en attente et un SW actif → mise à jour disponible
          if (navigator.serviceWorker.controller) {
            setWaitingWorker(registration.waiting);
            setIsUpdateAvailable(true);
            return; // Pas besoin de continuer si on a déjà trouvé un waiting worker
          }
        }

        // Écouter les nouvelles mises à jour (si pas déjà de waiting worker)
        if (!registration.waiting) {
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (!newWorker) {
              return;
            }

            // Écouter les changements d'état du nouveau worker
            const stateChangeHandler = () => {
              // Quand le nouveau worker est installé et qu'il y a déjà un worker actif
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // Le nouveau worker passe en état "waiting"
                // On le récupère depuis registration.waiting
                if (registration.waiting) {
                  setWaitingWorker(registration.waiting);
                  setIsUpdateAvailable(true);
                }
                // Retirer le listener après utilisation
                newWorker.removeEventListener('statechange', stateChangeHandler);
              } else if (newWorker.state === 'activated') {
                // Le worker a été activé, retirer le listener
                newWorker.removeEventListener('statechange', stateChangeHandler);
              }
            };
            
            newWorker.addEventListener('statechange', stateChangeHandler);
          });
        }
      }).catch((error) => {
        console.warn('[PWA Update] Erreur lors de la vérification des mises à jour:', error);
      });
    };

    // Vérifier immédiatement
    checkForUpdates();

    // Vérifier périodiquement (toutes les heures)
    const interval = setInterval(checkForUpdates, 60 * 60 * 1000);

    // Écouter les événements de contrôle du service worker
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // Le service worker a changé, recharger la page
      window.location.reload();
    });

    return () => {
      clearInterval(interval);
    };
  }, []);

  return {
    waitingWorker,
    isUpdateAvailable,
    updateServiceWorker,
    dismissUpdate,
  };
}

