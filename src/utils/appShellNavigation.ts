/**
 * Utilitaires pour la navigation dans l'App Shell
 * Gère le nettoyage des paramètres property-scoped lors de la navigation vers des vues globales
 */

export type ViewType = 
  | 'dashboard' 
  | 'patrimoine'
  | 'biens' 
  | 'locataires' 
  | 'baux' 
  | 'transactions' 
  | 'lmnp'
  | 'market'
  | 'documents' 
  | 'echeances' 
  | 'loans'
  | 'fiscal'
  | 'admin'
  | 'parametres'
  | 'sync'
  | 'profil'
  | 'property'
  | 'gestion-deleguee'
  | 'alertes';

/**
 * Liste des paramètres qui sont property-scoped (doivent être supprimés lors de la navigation vers des vues globales)
 */
const PROPERTY_SCOPED_PARAMS = ['propertyId', 'tab', 'leaseId'] as const;

/**
 * Détermine si une vue est globale (pas property-scoped)
 */
export function isGlobalView(view: ViewType): boolean {
  return view !== 'property';
}

/**
 * Nettoie les paramètres property-scoped d'une URL
 */
export function cleanPropertyScopedParams(url: URL): void {
  PROPERTY_SCOPED_PARAMS.forEach(param => {
    url.searchParams.delete(param);
  });
}

/**
 * Crée une URL propre pour une vue donnée
 * - Pour les vues globales : supprime propertyId et tab
 * - Pour la vue property : conserve propertyId et tab
 * - Pour dashboard : supprime même le paramètre view (URL la plus propre)
 */
export function buildViewUrl(view: ViewType, currentUrl?: string): string {
  const url = new URL(currentUrl || (typeof window !== 'undefined' ? window.location.href : '/app'));

  // Toutes les vues `?view=…` (sync, transactions, etc.) sont rendues sous `/app` (AppShell).
  // Depuis `/admin`, `/parametres`, etc., il faut forcer le pathname sinon on reste sur une page
  // qui n’embarque pas PendingSyncView (ex. `/admin?view=sync` ne montre pas la file d’attente).
  if (url.pathname !== '/app') {
    url.pathname = '/app';
  }
  
  if (view === 'dashboard') {
    // Dashboard : URL la plus propre, pas de query params
    url.searchParams.delete('view');
    cleanPropertyScopedParams(url);
  } else {
    url.searchParams.set('view', view);
    
    // Si c'est une vue globale, nettoyer les params property-scoped
    if (isGlobalView(view)) {
      cleanPropertyScopedParams(url);
    }
    // Si c'est property, on laisse propertyId et tab (ils doivent être fournis séparément)
  }
  
  return url.toString();
}

/**
 * Crée un chemin relatif (pathname + search) pour une vue donnée
 * Utile pour router.push() de Next.js
 */
export function buildViewPath(view: ViewType, currentUrl?: string): string {
  const url = new URL(buildViewUrl(view, currentUrl));
  return url.pathname + url.search;
}

/**
 * Navigue vers une vue en nettoyant automatiquement les paramètres property-scoped si nécessaire
 * Utilise window.history.pushState (pour l'app shell)
 * Note: useSearchParams() de Next.js réagit automatiquement aux changements d'URL
 */
export function navigateToView(view: ViewType): void {
  if (typeof window === 'undefined') return;
  
  const newUrl = buildViewUrl(view);
  console.log('[appShellNavigation] 🧭 navigateToView:', view, '→', newUrl);
  window.history.pushState({ view }, '', newUrl);
}

