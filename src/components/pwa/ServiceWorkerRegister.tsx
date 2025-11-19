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
 * Note: La detection des mises a jour est geree par useServiceWorkerUpdate()
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    // Verifications de securite
    if (typeof window === 'undefined') {
      return; // Ne rien faire cote serveur
    }

    // Verifier que nous sommes en production
    // En Next.js, NODE_ENV est remplace a la compilation
    const isProduction = process.env.NODE_ENV === 'production';
    if (!isProduction) {
      return; // Ne rien faire en developpement
    }

    if (!('serviceWorker' in navigator)) {
      // Service Worker non supporte (ancien navigateur)
      return;
    }

    // Verifier si un service worker est deja enregistre
    // pour eviter les enregistrements multiples
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      const hasSwRegistered = registrations.some(
        (registration) => registration.scope === window.location.origin + '/'
      );

      if (hasSwRegistered) {
        // Service worker deja enregistre, ne rien faire
        // La detection des mises a jour sera geree par useServiceWorkerUpdate()
        return;
      }

      // Enregistrer le service worker
      navigator.serviceWorker
        .register('/sw.js', {
          scope: '/',
        })
        .then((registration) => {
          console.info('[PWA] Service Worker enregistre avec succes:', registration.scope);
          
          // Verifier periodiquement les mises a jour (toutes les heures)
          setInterval(() => {
            registration.update();
          }, 60 * 60 * 1000);
        })
        .catch((error) => {
          // Erreur lors de l'enregistrement (ne pas casser l'app)
          console.warn('[PWA] Erreur lors de l\'enregistrement du service worker:', error);
        });
    }).catch((error) => {
      // Erreur lors de la verification des enregistrements
      console.warn('[PWA] Erreur lors de la verification des service workers:', error);
    });
  }, []); // Executer une seule fois au montage

  // Ce composant ne rend rien visuellement
  return null;
}
