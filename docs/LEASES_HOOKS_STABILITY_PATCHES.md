# Patches : Stabilité Hooks Baux Offline-First

## 📋 Résumé

Amélioration de la stabilité totale des hooks `useLeasesKpis` et `useLeasesCharts` :
- Pas de spam de fetch
- Pas d'erreurs console en offline
- Pas de setState après unmount
- Protection contre les réponses obsolètes

## 🔧 Modifications Appliquées

### 1. Vérification des Dépendances useEffect

**Problème** : Les dépendances peuvent être instables (objets/func non memo) et relancer en boucle.

**Solution** : Extraction stricte des valeurs primitives dans les dépendances.

**Patch** :
```diff
export function useLeasesKpis(params: UseLeasesKpisParams = {}) {
- const { mode = 'normal' } = params;
+ const { mode = 'normal', propertyId, refreshKey } = params;
  const { organizationId } = useCurrentOrganization();
  
  // ...
  
  useEffect(() => {
    // ...
  }, [
-   params.propertyId,
-   params.refreshKey,
+   propertyId,
+   organizationId,
+   mode,
+   isOffline,
+   refreshKey,
    shouldUseLocalData,
-   organizationId,
  ]);
}
```

**Résultat** : Le `useEffect` ne se déclenche QUE si les dépendances primitives changent, pas si l'objet `params` change.

### 2. Ajout d'AbortController côté API

**Problème** : Les fetch en mode normal ne sont pas annulées lors du changement de `propertyId` ou du unmount.

**Solution** : Création d'un `AbortController` pour chaque requête et cleanup au unmount.

**Patch** :
```diff
+ const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const calculateKpis = async () => {
      // ...
      
      } else if (!shouldUseLocalData) {
+       // ✅ AbortController : Créer un nouveau controller pour cette requête
+       abortControllerRef.current?.abort();
+       const controller = new AbortController();
+       abortControllerRef.current = controller;

        try {
          const response = await fetch(`/api/leases/kpis?${queryParams.toString()}`, {
+           signal: controller.signal,
          });
          // ...
        } catch (err) {
+         // ✅ Ne pas logguer si la requête a été abortée (comportement attendu)
+         if (err instanceof Error && err.name === 'AbortError') {
+           return;
+         }
          // ...
        }
      }
    };
    
    // ...
    
    return () => {
      window.removeEventListener('leases:refresh', handleRefresh);
+     // ✅ Cleanup : Abort les requêtes en cours lors du unmount
+     if (abortControllerRef.current) {
+       abortControllerRef.current.abort();
+     }
    };
  }, [/* ... */]);
```

**Résultat** : Les requêtes en cours sont abortées lors du changement de `propertyId` ou du unmount, évitant les setState obsolètes.

### 3. Zéro console.error en Offline/App-Shell

**Problème** : Les erreurs IndexedDB en offline/app-shell sont loggées avec `console.error`, créant du bruit inutile.

**Solution** : Utiliser `console.warn` en DEV uniquement pour le debug.

**Patch** :
```diff
        } catch (err) {
-         // ✅ OFFLINE-FIRST: En cas d'erreur IndexedDB, retourner des valeurs vides
-         console.error('[useLeasesKpis] Erreur calcul local:', err);
+         // ✅ OFFLINE-FIRST: En offline/app-shell, pas d'erreur console (comportement attendu)
+         // Utiliser console.warn en DEV uniquement pour le debug
+         if (process.env.NODE_ENV === 'development') {
+           console.warn('[useLeasesKpis] Erreur calcul local (offline/app-shell):', err);
+         }
          setKpis(EMPTY_KPIS);
        }
```

**Résultat** : Aucune erreur console en offline/app-shell (comportement attendu), uniquement des warnings en DEV pour le debug.

### 4. Anti-Spam (Token de Requête)

**Problème** : Si l'utilisateur change rapidement de `propertyId` ou d'onglet, les réponses obsolètes peuvent mettre à jour l'état.

**Solution** : Utiliser un token de requête pour ignorer les réponses obsolètes.

**Patch** :
```diff
+ const requestTokenRef = useRef<number>(0);

  useEffect(() => {
    const calculateKpis = async () => {
+     // ✅ Anti-spam : Incrémenter le token pour ignorer les réponses obsolètes
+     const currentToken = ++requestTokenRef.current;
      
      // ...
      
+     // ✅ Anti-spam : Vérifier que la requête n'est pas obsolète
+     if (currentToken !== requestTokenRef.current) {
+       return;
+     }
      
      // ... (calcul ou fetch)
      
+     // ✅ Anti-spam : Vérifier que la requête n'est pas obsolète avant setState
+     if (currentToken !== requestTokenRef.current) {
+       return;
+     }
      
      setKpis(data);
      
      // ... (dans catch et finally aussi)
+     if (currentToken === requestTokenRef.current) {
+       setIsLoading(false);
+     }
    };
  }, [/* ... */]);
```

**Résultat** : Les réponses obsolètes sont ignorées, évitant les setState avec des données incorrectes.

## 📊 Diff Complet

Les patches complets sont disponibles dans :
- `src/hooks/useLeasesKpis.ts`
- `src/hooks/useLeasesCharts.ts`

## ✅ Checklist de Validation

### Stabilité
- [x] Dépendances strictes (propertyId, organizationId, mode, isOffline, refreshKey)
- [x] AbortController pour les fetch API
- [x] Cleanup au unmount
- [x] Token de requête anti-spam

### Offline/App-Shell
- [x] Zéro console.error en offline/app-shell
- [x] console.warn en DEV uniquement pour le debug
- [x] Fallback EMPTY_* sans erreur

### Mode Normal
- [x] AbortController pour annuler les requêtes obsolètes
- [x] Pas de log pour AbortError
- [x] Token de requête pour ignorer les réponses obsolètes

## 🧪 Tests Manuels

Voir `docs/TEST_LEASES_HOOKS_STABILITY.md` pour les tests manuels détaillés.

### Résumé des Tests

1. **Offline/Online**
   - Offline → Online : Les requêtes sont appelées après retour online
   - Online → Offline : Les requêtes sont abortées sans erreur
   - Offline (app-shell) : Aucune requête, pas d'erreur console

2. **Changement Rapide**
   - Changement rapide de `propertyId` : Seule la dernière requête aboutit
   - Navigation rapide entre onglets : Pas de setState après unmount

3. **Stabilité**
   - Le `useEffect` ne se déclenche QUE si les dépendances changent
   - Pas de re-render inutile
   - Pas de boucle infinie

## 📝 Notes

- Les hooks utilisent `useState` + `useEffect`, pas React Query
- Les patches sont identiques pour `useLeasesKpis` et `useLeasesCharts`
- Les `console.warn` en DEV sont acceptables pour le debug, mais pas les `console.error` en offline/app-shell
- Le token de requête est incrémenté à chaque appel de `calculateKpis` / `calculateCharts`
