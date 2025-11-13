'use client';

import { useRouter } from 'next/navigation';
import { startTransition } from 'react';
import { useOptionalRouteProgress } from '@/components/RouteProgressProvider';

interface ViewTransitionOptions {
  enableTransition?: boolean;
  transitionName?: string;
  fallbackDelay?: number;
}

/**
 * Hook pour navigation avec View Transitions API
 * Fournit une navigation fluide avec fallback gracieux
 */
export function useViewTransitionNav(options: ViewTransitionOptions = {}) {
  const {
    enableTransition = true,
    transitionName,
    fallbackDelay = 0
  } = options;
  
  const router = useRouter();
  const routeProgress = useOptionalRouteProgress();

  // Vérifier le support de View Transitions API
  const supportsViewTransition = typeof document !== 'undefined' && 
    'startViewTransition' in document;

  /**
   * Navigation avec transition fluide
   */
  const navigate = async (href: string, replace = false) => {
    // Démarrer le feedback de progression si disponible
    routeProgress?.start();

    if (enableTransition && supportsViewTransition) {
      try {
        // Utiliser View Transition API
        const transition = (document as any).startViewTransition(() => {
          return new Promise<void>((resolve) => {
            startTransition(() => {
              if (replace) {
                router.replace(href);
              } else {
                router.push(href);
              }
              // Résoudre après un court délai pour permettre au DOM de se mettre à jour
              setTimeout(resolve, 50);
            });
          });
        });

        // Ajouter nom de transition si spécifié
        if (transitionName && transition.ready) {
          await transition.ready;
          document.documentElement.style.setProperty('view-transition-name', transitionName);
        }

        return transition;
      } catch (error) {
        console.warn('View Transition failed, falling back to normal navigation:', error);
        // Fallback vers navigation normale
        return navigateNormal(href, replace);
      }
    } else {
      // Navigation normale avec délai optionnel
      return navigateNormal(href, replace);
    }
  };

  /**
   * Navigation normale (fallback)
   */
  const navigateNormal = (href: string, replace = false) => {
    return new Promise<void>((resolve) => {
      if (fallbackDelay > 0) {
        setTimeout(() => {
          startTransition(() => {
            if (replace) {
              router.replace(href);
            } else {
              router.push(href);
            }
            resolve();
          });
        }, fallbackDelay);
      } else {
        startTransition(() => {
          if (replace) {
            router.replace(href);
          } else {
            router.push(href);
          }
          resolve();
        });
      }
    });
  };

  /**
   * Navigation avec préchargement
   */
  const prefetchAndNavigate = async (href: string, replace = false) => {
    // Précharger la route
    try {
      await router.prefetch(href);
    } catch (error) {
      console.warn('Prefetch failed:', error);
    }

    // Naviguer
    return navigate(href, replace);
  };

  /**
   * Navigation avec transition personnalisée
   */
  const navigateWithTransition = async (
    href: string, 
    customTransitionName: string,
    replace = false
  ) => {
    const originalTransitionName = transitionName;
    
    try {
      // Appliquer temporairement le nom de transition personnalisé
      const result = await navigate(href, replace);
      
      if (supportsViewTransition && customTransitionName) {
        document.documentElement.style.setProperty('view-transition-name', customTransitionName);
      }
      
      return result;
    } finally {
      // Restaurer le nom de transition original
      if (supportsViewTransition) {
        setTimeout(() => {
          if (originalTransitionName) {
            document.documentElement.style.setProperty('view-transition-name', originalTransitionName);
          } else {
            document.documentElement.style.removeProperty('view-transition-name');
          }
        }, 300);
      }
    }
  };

  return {
    navigate,
    prefetchAndNavigate,
    navigateWithTransition,
    supportsViewTransition,
    // Raccourcis pour actions courantes
    push: (href: string) => navigate(href, false),
    replace: (href: string) => navigate(href, true),
    pushWithPrefetch: (href: string) => prefetchAndNavigate(href, false),
    replaceWithPrefetch: (href: string) => prefetchAndNavigate(href, true)
  };
}

/**
 * Hook spécialisé pour les cartes/tuiles cliquables
 */
export function useCardNavigation() {
  return useViewTransitionNav({
    enableTransition: true,
    transitionName: 'card-transition',
    fallbackDelay: 50 // Petit délai pour effet visuel
  });
}

/**
 * Hook spécialisé pour la navigation dans des listes
 */
export function useListNavigation() {
  return useViewTransitionNav({
    enableTransition: true,
    transitionName: 'list-item-transition'
  });
}

/**
 * Utilitaire pour ajouter des classes CSS de transition
 */
export function addViewTransitionClasses() {
  if (typeof document === 'undefined') return;

  const style = document.createElement('style');
  style.textContent = `
    /* View Transitions - compatibles avec prefers-reduced-motion */
    ::view-transition-old(root),
    ::view-transition-new(root) {
      animation-duration: 0.3s;
    }

    @media (prefers-reduced-motion: reduce) {
      ::view-transition-old(root),
      ::view-transition-new(root) {
        animation-duration: 0.1s;
      }
    }

    /* Transitions spécialisées */
    ::view-transition-old(card-transition),
    ::view-transition-new(card-transition) {
      transform-origin: center;
    }

    ::view-transition-old(list-item-transition),
    ::view-transition-new(list-item-transition) {
      transform-origin: left center;
    }
  `;
  
  document.head.appendChild(style);
}
