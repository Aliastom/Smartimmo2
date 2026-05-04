'use client';

import { useEffect } from 'react';

/**
 * Composant client pour enregistrer le service worker PWA
 * 
 * Ce composant :
 * - S'execute uniquement en production
 * - S'execute uniquement cote client (verifie window)
 * - Enregistre le service worker /sw.js avec le scope "/"
 * - Gere les erreurs proprement sans casser l'app
 * - Evite les enregistrements multiples
 * 
 * Note: La détection des mises à jour est gérée par useAppUpdate() (version.json + SW).
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    // Verifications de securite
    if (typeof window === 'undefined') {
      return; // Ne rien faire cote serveur
    }

    if (!('serviceWorker' in navigator)) {
      // Service Worker non supporte (ancien navigateur)
      return;
    }

    // En developpement, nettoyer les anciens SW/caches pour eviter
    // les pages blanches dues a des chunks _next obsoletes.
    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => Promise.all(registrations.map((r) => r.unregister())))
        .catch(() => undefined);

      if ('caches' in window) {
        caches
          .keys()
          .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
          .catch(() => undefined);
      }
      return;
    }

    let updateIntervalId: number | null = null;
    const cleanupListeners: Array<() => void> = [];

    const setupUpdateChecks = (registration: ServiceWorkerRegistration) => {
      const safeUpdate = () => {
        registration.update().catch(() => undefined);
      };

      // Check immediat au chargement pour detecter vite les nouveaux deploys.
      safeUpdate();

      // Check periodique (defense en profondeur).
      updateIntervalId = window.setInterval(safeUpdate, 60 * 60 * 1000);

      // Check actif quand l'utilisateur revient sur l'app.
      const onVisible = () => {
        if (document.visibilityState === 'visible') safeUpdate();
      };
      const onFocus = () => safeUpdate();
      const onOnline = () => safeUpdate();

      document.addEventListener('visibilitychange', onVisible);
      window.addEventListener('focus', onFocus);
      window.addEventListener('online', onOnline);

      cleanupListeners.push(() => document.removeEventListener('visibilitychange', onVisible));
      cleanupListeners.push(() => window.removeEventListener('focus', onFocus));
      cleanupListeners.push(() => window.removeEventListener('online', onOnline));
    };

    // Verifier si un service worker est deja enregistre.
    navigator.serviceWorker.getRegistration('/').then((existingRegistration) => {
      if (existingRegistration) {
        setupUpdateChecks(existingRegistration);
        return;
      }

      // Enregistrer le service worker s'il n'existe pas encore.
      navigator.serviceWorker
        .register('/sw.js', {
          scope: '/',
        })
        .then((registration) => {
          console.info('[PWA] Service Worker enregistre avec succes:', registration.scope);
          setupUpdateChecks(registration);
        })
        .catch((error) => {
          // Erreur lors de l'enregistrement (ne pas casser l'app)
          console.warn('[PWA] Erreur lors de l\'enregistrement du service worker:', error);
        });
    }).catch((error) => {
      // Erreur lors de la verification des enregistrements
      console.warn('[PWA] Erreur lors de la verification des service workers:', error);
    });

    return () => {
      if (updateIntervalId != null) {
        window.clearInterval(updateIntervalId);
      }
      for (const dispose of cleanupListeners) {
        dispose();
      }
    };
  }, []); // Executer une seule fois au montage

  // Ce composant ne rend rien visuellement
  return null;
}
