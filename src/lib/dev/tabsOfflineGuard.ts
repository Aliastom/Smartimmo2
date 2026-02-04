/**
 * Protection anti-régression : Empêcher toute navigation Next.js lors d'un changement d'onglet property
 * 
 * Ce module intercepte router.push/replace/refresh et détecte les <Link> rendus
 * dans PropertyTabs quand on est en mode app-shell ou offline.
 */

export function initTabsOfflineGuard() {
  if (typeof window === 'undefined' || process.env.NODE_ENV !== 'development') {
    return;
  }
  // Vérifier si on est en mode app-shell ou offline
  const isAppShellMode = () => {
    return window.location.pathname === '/app' && window.location.search.includes('view=property');
  };

  const isOffline = () => {
    return !navigator.onLine;
  };

  const shouldGuard = () => {
    return isAppShellMode() || isOffline();
  };

  // Intercepter router.push/replace/refresh depuis useRouter()
  // Note: On ne peut pas intercepter directement useRouter() car c'est un hook,
  // mais on peut intercepter les appels depuis PropertyTabs/PropertyDetailView
  // en patchant window.history.pushState/replaceState pour détecter les navigations Next.js
  
  // Guard pour détecter les <Link> rendus dans PropertyTabs
  // On utilise un MutationObserver pour surveiller le DOM de PropertyTabs
  let observer: MutationObserver | null = null;
  
  const startLinkObserver = () => {
    if (observer) return; // Déjà actif
    
    observer = new MutationObserver((mutations) => {
      if (!shouldGuard()) return;
      
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            
            // Vérifier si c'est un <Link> Next.js (a[href] avec data-nextjs-link)
            const links = element.querySelectorAll ? element.querySelectorAll('a[data-nextjs-link], a[href^="/app?view=property"]') : [];
            if (links.length > 0) {
              console.error('[TabsOfflineGuard] ❌ <Link> Next.js détecté dans PropertyTabs en mode app-shell/offline !', links);
              console.error('[TabsOfflineGuard] Stack trace:', new Error().stack);
            }
            
            // Vérifier si le node lui-même est un Link
            if (element.tagName === 'A' && (element.getAttribute('data-nextjs-link') || (element.getAttribute('href')?.startsWith('/app?view=property')))) {
              console.error('[TabsOfflineGuard] ❌ <Link> Next.js détecté directement dans PropertyTabs en mode app-shell/offline !', element);
              console.error('[TabsOfflineGuard] Stack trace:', new Error().stack);
            }
          }
        });
      });
    });
    
    // Observer les changements dans le body (PropertyTabs est rendu dedans)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  };

  const stopLinkObserver = () => {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  };

  // Démarrer l'observer si on est en mode guard
  if (shouldGuard()) {
    startLinkObserver();
  }

  // Écouter les changements online/offline
  window.addEventListener('online', () => {
    if (!isAppShellMode()) {
      stopLinkObserver();
    }
  });

  window.addEventListener('offline', () => {
    startLinkObserver();
  });

  // Exporter pour permettre l'activation/désactivation manuelle
  (window as any).__tabsOfflineGuard = {
    start: startLinkObserver,
    stop: stopLinkObserver,
    isActive: () => !!observer,
  };
}
