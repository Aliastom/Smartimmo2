/**
 * Préchargement automatique des pages HTML importantes pour le mode offline
 * 
 * Inclut l'App Shell (`/app`) pour garantir qu'il soit en cache au premier chargement online.
 * Le Service Worker utilise `ignoreSearch: true` : une seule entrée `/app` sert toutes les vues
 * (`/app?view=biens`, `/app?view=transactions`, etc.)
 * 
 * Appelé manuellement depuis la page `/app?view=sync` (optionnel, non automatique)
 */
const IMPORTANT_PAGES = [
  '/app',
  '/biens',
  '/locataires',
  '/baux',
  '/transactions',
  '/dashboard',
  '/loans',
  '/echeances',
  '/documents',
];

/**
 * Précharge les pages HTML importantes en utilisant le Cache API
 * Les pages sont mises en cache via le service worker
 * Cette fonction est non-bloquante et peut être appelée en arrière-plan
 */
export async function preloadImportantPages(): Promise<{
  success: number;
  failed: number;
  errors: string[];
}> {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return { success: 0, failed: 0, errors: ['Cache API non disponible'] };
  }

  // Ne pas précharger si on est déjà hors ligne
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { success: 0, failed: 0, errors: ['Hors ligne'] };
  }

  const errors: string[] = [];
  let success = 0;
  let failed = 0;

  // Précharger chaque page importante (en parallèle pour plus de rapidité)
  const preloadPromises = IMPORTANT_PAGES.map(async (pagePath) => {
    try {
      const url = new URL(pagePath, window.location.origin).href;
      
      // Utiliser fetch pour précharger la page
      // Le service worker la mettra automatiquement en cache selon sa stratégie
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'default',
      });

      if (response.ok) {
        // Lire la réponse pour s'assurer qu'elle est bien mise en cache
        await response.text();
        return { success: true, pagePath };
      } else {
        return { success: false, pagePath, error: `${response.status} ${response.statusText}` };
      }
    } catch (error: any) {
      return { success: false, pagePath, error: error.message };
    }
  });

  // Attendre que tous les préchargements soient terminés
  const results = await Promise.allSettled(preloadPromises);
  
  results.forEach((result) => {
    if (result.status === 'fulfilled') {
      if (result.value.success) {
        success++;
      } else {
        failed++;
        errors.push(`${result.value.pagePath}: ${result.value.error}`);
      }
    } else {
      failed++;
      errors.push(`Erreur inattendue: ${result.reason}`);
    }
  });

  // Log simple pour les pages préchargées
  const allCached = failed === 0 && success > 0;
  console.log(`page prechargé en cache: ${allCached ? 'oui' : 'non'}`);

  // Mettre en cache manuellement dans le cache 'pages' pour garantir la disponibilité
  // Même si le service worker a déjà mis en cache, on double la sécurité
  try {
    const cache = await caches.open('pages');
    
    // Mettre en cache uniquement les pages qui ont réussi à être préchargées
    const successfulPages: string[] = [];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.success) {
        successfulPages.push(IMPORTANT_PAGES[index]);
      }
    });

    const cachePromises = successfulPages.map(async (pagePath) => {
      try {
        const url = new URL(pagePath, window.location.origin).href;
        
        // Vérifier si déjà en cache (avec matchOptions pour ignorer query params)
        const cached = await cache.match(url, {
          ignoreSearch: false, // D'abord chercher avec l'URL exacte
        });
        
        if (!cached) {
          // Si pas encore en cache, faire un nouveau fetch et mettre en cache
          const response = await fetch(url, {
            method: 'GET',
            credentials: 'same-origin',
          });
          if (response.ok) {
            // Mettre en cache avec l'URL complète
            await cache.put(url, response.clone());
            
            // AUSSI mettre en cache sans query params pour permettre le matching flexible
            // (Le clone de la réponse peut être utilisé plusieurs fois pour le même cache)
            const baseUrl = new URL(url);
            baseUrl.search = ''; // Retirer les query params
            if (baseUrl.href !== url) {
              // Créer une nouvelle réponse avec les mêmes données mais URL différente
              const clonedResponse = response.clone();
              await cache.put(baseUrl.href, clonedResponse);
            }
          }
        }
      } catch (error) {
        // Ignorer silencieusement, on a déjà loggé l'erreur plus haut
      }
    });

    await Promise.allSettled(cachePromises);
  } catch (error) {
    // Erreur silencieuse lors de la mise en cache
  }

  return { success, failed, errors };
}

/**
 * Vérifie si les pages importantes sont en cache
 */
export async function checkPagesCacheStatus(): Promise<Record<string, boolean>> {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return {};
  }

  const status: Record<string, boolean> = {};

  try {
    const cache = await caches.open('pages');
    
    for (const pagePath of IMPORTANT_PAGES) {
      const url = new URL(pagePath, window.location.origin).href;
      // Essayer de trouver avec ou sans query params
      const cached = await cache.match(url, { ignoreSearch: true });
      status[pagePath] = !!cached;
    }
  } catch (error) {
    // Erreur silencieuse lors de la vérification du cache
  }

  return status;
}

// Exposer la fonction globalement pour permettre un appel manuel depuis la console
// Usage: window.preloadPages()
if (typeof window !== 'undefined') {
  (window as any).preloadPages = preloadImportantPages;
  (window as any).checkPagesCache = checkPagesCacheStatus;
  // Fonctions disponibles: window.preloadPages() et window.checkPagesCache()
}



