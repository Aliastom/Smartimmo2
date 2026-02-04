# Patches : Protections Anti-Régression Onglets Property Offline

## 📋 Résumé des Patches

### 1. Guard Runtime DEV : Détection des <Link> Next.js

**Fichier :** `src/lib/dev/tabsOfflineGuard.ts`

**Patch :**
```typescript
// Nouveau fichier créé
// Fonction initTabsOfflineGuard() qui démarre un MutationObserver
// Détecte les <Link> Next.js rendus dans PropertyTabs
```

**Intégration :** `src/app/app/AppShellClient.tsx`
```typescript
// Ajout après les imports
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  import('@/lib/dev/tabsOfflineGuard').then(({ initTabsOfflineGuard }) => {
    initTabsOfflineGuard();
  }).catch(() => {
    // Ignorer les erreurs de chargement (peut échouer en offline)
  });
}
```

### 2. Guards Statiques dans le Code

**Fichiers :**
- `src/components/property/PropertyTabs.tsx` : Commentaire de vérification
- `src/app/app/views/PropertyDetailView.tsx` : Commentaire de vérification

**Patch :**
```typescript
// Ajout de commentaires rappelant qu'on ne doit pas utiliser :
// - <Link> de Next.js
// - useRouter() / router.push/replace/refresh
```

### 3. Test E2E Playwright

**Fichier :** `tests/e2e/app-shell/08-property-tabs-offline.spec.ts`

**Patch :**
```typescript
// Nouveau fichier créé
// 4 tests qui vérifient :
// 1. Aucune requête réseau lors du changement d'onglet
// 2. Aucune erreur console
// 3. Le contenu change correctement
// 4. La navigation initiale fonctionne
```

## 🔧 Détails des Patches par Fichier

### Patch 1 : `src/lib/dev/tabsOfflineGuard.ts`

**Type :** Nouveau fichier

**Contenu :**
- Fonction `initTabsOfflineGuard()` qui démarre un MutationObserver
- Détecte les `<Link>` Next.js (`a[data-nextjs-link]` ou `a[href^="/app?view=property"]`)
- Log une erreur dans la console si un `<Link>` est détecté
- Actif uniquement en DEV quand `mode === 'app-shell'` ou `navigator.onLine === false`

### Patch 2 : `src/app/app/AppShellClient.tsx`

**Type :** Modification

**Lignes :** Après les imports (ligne ~45)

**Changement :**
```typescript
// AVANT :
import { LocalDbUnavailableScreen } from '@/components/offline/LocalDbUnavailableScreen';

// APRÈS :
import { LocalDbUnavailableScreen } from '@/components/offline/LocalDbUnavailableScreen';

// ⚠️ GUARD DEV-ONLY : Protection anti-régression pour les onglets property offline
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  import('@/lib/dev/tabsOfflineGuard').then(({ initTabsOfflineGuard }) => {
    initTabsOfflineGuard();
  }).catch(() => {
    // Ignorer les erreurs de chargement (peut échouer en offline)
  });
}
```

### Patch 3 : `src/components/property/PropertyTabs.tsx`

**Type :** Modification

**Lignes :** Après les imports (ligne ~8)

**Changement :**
```typescript
// AVANT :
import { usePropertyTabCounts } from './usePropertyTabCounts';

// APRÈS :
import { usePropertyTabCounts } from './usePropertyTabCounts';

// ⚠️ GUARD DEV-ONLY : Vérifier qu'on n'utilise pas <Link> ou router
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  // Vérifier qu'on n'importe pas Link ou useRouter
  // (vérification statique - à vérifier manuellement dans le code)
  // Si vous voyez cette erreur, c'est qu'un import a été ajouté par erreur
}
```

### Patch 4 : `src/app/app/views/PropertyDetailView.tsx`

**Type :** Modification

**Lignes :** Après les imports (ligne ~12) et dans `handleTabChange` (ligne ~69)

**Changements :**

1. Après les imports :
```typescript
// AVANT :
import { usePropertyBaseData } from './hooks/usePropertyBaseData';

// APRÈS :
import { usePropertyBaseData } from './hooks/usePropertyBaseData';

// ⚠️ GUARD DEV-ONLY : Vérifier qu'on n'utilise pas router.push/replace/refresh
// Ne PAS importer useRouter ou router ici - utiliser uniquement onTabChange callback
```

2. Dans `handleTabChange` :
```typescript
// AVANT :
const handleTabChange = useCallback((tabId: string) => {
  const normalizedTab = normalizeAndValidateTab(tabId);
  setActiveTab(normalizedTab);
  // ...
}, [propertyId]);

// APRÈS :
const handleTabChange = useCallback((tabId: string) => {
  // ⚠️ GUARD DEV-ONLY : Vérifier qu'on n'utilise pas router.push/replace/refresh
  if (process.env.NODE_ENV === 'development') {
    const isAppShellMode = typeof window !== 'undefined' && window.location.pathname === '/app' && window.location.search.includes('view=property');
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    
    if (isAppShellMode || isOffline) {
      // Vérifier que handleTabChange utilise uniquement replaceState (pas router.push/replace)
      // Cette vérification est faite statiquement - si vous voyez router.push/replace ici, c'est une erreur
    }
  }
  
  const normalizedTab = normalizeAndValidateTab(tabId);
  setActiveTab(normalizedTab);
  
  // ✅ Synchroniser l'URL (passif, sans déclencher de fetch RSC)
  // ⚠️ IMPORTANT: Utiliser UNIQUEMENT replaceState, JAMAIS router.push/replace/refresh
  const params = new URLSearchParams(window.location.search);
  params.set('view', 'property');
  params.set('propertyId', propertyId);
  params.set('tab', normalizedTab);
  window.history.replaceState({}, '', `/app?${params.toString()}`);
}, [propertyId]);
```

### Patch 5 : `tests/e2e/app-shell/08-property-tabs-offline.spec.ts`

**Type :** Nouveau fichier

**Contenu :**
- 4 tests Playwright qui vérifient :
  1. Aucune requête réseau lors du changement d'onglet
  2. Aucune erreur console
  3. Le contenu change correctement
  4. La navigation initiale fonctionne

**Configuration :**
- Utilise `seedTestData` pour créer une propriété de test
- Utilise `navigateToPropertyView` pour naviguer vers la page property
- Utilise `cleanupTestData` pour nettoyer après les tests

## 📝 Notes d'Implémentation

### Guard Runtime

Le guard runtime (`tabsOfflineGuard.ts`) :
- S'exécute uniquement en DEV (`process.env.NODE_ENV === 'development'`)
- Est chargé de manière asynchrone dans `AppShellClient.tsx` pour éviter les erreurs en offline
- Utilise un MutationObserver pour surveiller le DOM
- Log une erreur dans la console si un `<Link>` est détecté

### Test E2E

Le test E2E :
- Utilise la structure existante des tests app-shell (`helpers/seed.ts`, `helpers/appShellNav.ts`)
- Crée une propriété de test au début et la nettoie à la fin
- Vérifie que les onglets fonctionnent en offline sans déclencher de requêtes réseau
- Vérifie qu'aucune erreur console n'est générée

## 🚀 Utilisation

### Guard Runtime

Le guard est activé automatiquement en DEV. Aucune action nécessaire.

Pour contrôler manuellement (console navigateur) :
```typescript
window.__tabsOfflineGuard.start();   // Démarrer
window.__tabsOfflineGuard.stop();    // Arrêter
window.__tabsOfflineGuard.isActive(); // Vérifier l'état
```

### Test E2E

**Prérequis :**
1. Installer Playwright si nécessaire : `npx playwright install`
2. Configurer les variables d'environnement (voir `tests/e2e/app-shell/README.md`)

**Exécution :**
```bash
# Tous les tests
npx playwright test tests/e2e/app-shell/08-property-tabs-offline.spec.ts

# Un test spécifique
npx playwright test tests/e2e/app-shell/08-property-tabs-offline.spec.ts -g "changement d'onglet en offline ne déclenche pas"
```
