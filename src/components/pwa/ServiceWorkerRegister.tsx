'use client';

import { useEffect } from 'react';

/**
 * Composant client pour enregistrer le service worker PWA
 * 
 * Ce composant :
 * - S'exécute uniquement en production
 * - S'exécute uniquement côté client (vérifie window)
 * - Enregistre le service worker /sw.js avec le scope "/"
 * - Gère les erreurs proprement sans casser l'app
 * - Évite les enregistrements multiples
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    // Vérifications de sécurité
    if (typeof window === 'undefined') {
      return; // Ne rien faire côté serveur
    }

    // Vérifier que nous sommes en production
    // En Next.js, NODE_ENV est remplacé à la compilation
    const isProduction = process.env.NODE_ENV === 'production';
    if (!isProduction) {
      return; // Ne rien faire en développement
    }

    if (!('serviceWorker' in navigator)) {
      // Service Worker non supporté (ancien navigateur)
      return;
    }

    // Vérifier si un service worker est déjà enregistré
    // pour éviter les enregistrements multiples
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      const hasSwRegistered = registrations.some(
        (registration) => registration.scope === window.location.origin + '/'
      );

      if (hasSwRegistered) {
        // Service worker déjà enregistré, ne rien faire
        return;
      }

      // Enregistrer le service worker
      navigator.serviceWorker
        .register('/sw.js', {
          scope: '/',
        })
        .then((registration) => {
          console.info('[PWA] Service Worker enregistré avec succès:', registration.scope);

          // Écouter les mises à jour du service worker
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.info('[PWA] Nouveau service worker disponible. Rechargez la page pour l\'activer.');
                }
              });
            }
          });
        })
        .catch((error) => {
          // Erreur lors de l'enregistrement (ne pas casser l'app)
          console.warn('[PWA] Erreur lors de l\'enregistrement du service worker:', error);
        });
    }).catch((error) => {
      // Erreur lors de la vérification des enregistrements
      console.warn('[PWA] Erreur lors de la vérification des service workers:', error);
    });
  }, []); // Exécuter une seule fois au montage

  // Ce composant ne rend rien visuellement
  return null;
}

