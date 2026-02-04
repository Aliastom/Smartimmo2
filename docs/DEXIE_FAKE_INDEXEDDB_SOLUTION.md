# Solution Dexie + fake-indexeddb

⚠️ **ARCHIVÉ** : Cette approche a été abandonnée au profit de repositories in-memory pour les tests unitaires.

Voir `tests/README-transaction-conformance-inmemory.md` pour la solution actuelle.

---

# Solution Dexie + fake-indexeddb (ARCHIVÉ) — Impasse technique documentée

## Constat

Après analyse approfondie du code Dexie compilé (`node_modules/dexie/dist/dexie.js`), le problème est identifié :

### Cause racine

1. **`idbReady()` (ligne 3712-3724)** utilise directement `indexedDB` (pas `_global.indexedDB`), capturé au moment de l'évaluation du module Dexie. En Node.js, cette variable n'existe pas, donc `indexedDB` est `undefined` dans cette closure.

2. **`getDbNamesTable()` (ligne 3667-3678)** crée une instance Dexie interne qui appelle `version(1).stores()`, ce qui peut déclencher l'erreur si l'instance interne utilise une référence `indexedDB` incorrecte.

3. **Le code compilé ne montre pas d'accès direct à `indexedDB.prototype` dans `Version.stores()`**, mais l'erreur indique la ligne 58:60 du source TypeScript, suggérant un accès indirect via une closure interne.

### Pourquoi les patches ne fonctionnent pas

Même si on force `global.indexedDB`, `globalThis.indexedDB`, `Dexie.dependencies.indexedDB`, etc., la closure de `idbReady()` a déjà capturé `undefined` au moment de l'évaluation du module Dexie, avant que `setup.ts` ne s'exécute.

## Solution : Alternative de test

Comme on ne peut pas modifier Dexie et que les patches globaux ne fonctionnent pas, la solution est d'utiliser une alternative de test qui ne dépend pas de Dexie directement.

### Option 1 : Mock repository layer

Créer une couche d'abstraction qui permet de mocker les repositories sans passer par Dexie :

```typescript
// src/lib/offline/repositories/PropertyRepositoryOffline.ts
export class PropertyRepositoryOffline {
  // Implémentation qui utilise getLocalDB() mais peut être mockée en test
}
```

En test, on peut alors mocker `getLocalDB()` pour retourner un mock qui n'utilise pas Dexie.

### Option 2 : Utiliser un environnement de test différent

Utiliser `jsdom` au lieu de `node` pour Vitest, ce qui fournit un environnement plus proche du navigateur :

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    environment: 'jsdom',  // Au lieu de 'node'
    // ...
  },
});
```

### Option 3 : Utiliser dexie-testing-library ou équivalent

Chercher une bibliothèque de test dédiée à Dexie qui gère déjà ces problèmes.

## Recommandation

**Option 2** (jsdom) est la plus simple et la plus compatible avec l'architecture existante. Elle fournit un environnement plus proche du navigateur où `indexedDB` existe naturellement.
