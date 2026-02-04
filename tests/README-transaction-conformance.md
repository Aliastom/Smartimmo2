# Tests de conformité TransactionService (Normal vs App-Shell)

## Contexte

Ces tests vérifient que `TransactionService` produit exactement les mêmes résultats et side-effects (commissions, cascade, documents) en mode normal (via API routes) et en mode app-shell (via IndexedDB + pendingOps).

## Contrainte technique: Dexie + fake-indexeddb

### Problème

Dexie accède à `indexedDB.prototype` **au moment de l'import du module Dexie** (top-level evaluation), notamment dans:
- `Version.stores()` (ligne 58 de `dexie/src/classes/version/version.ts`)
- `idbReady()` qui utilise la référence **GLOBALE** `indexedDB` (ligne 3716)

Si `fake-indexeddb` n'est pas initialisé **AVANT** l'import de Dexie, `indexedDB.prototype` est `undefined` et les tests échouent avec:
```
TypeError: Cannot read properties of undefined (reading 'prototype')
```

### Solution

**Règle stricte**: `fake-indexeddb/auto` **DOIT** être importé **EN PREMIÈRE LIGNE** de chaque fichier de test utilisant IndexedDB.

```typescript
// ✅ CORRECT: fake-indexeddb en premier
import 'fake-indexeddb/auto';
import { getLocalDB } from '@/lib/offline/db';

// ❌ INCORRECT: autre import avant fake-indexeddb
import { getLocalDB } from '@/lib/offline/db';
import 'fake-indexeddb/auto';
```

### Architecture

- `src/test/setup.ts`: Initialise `fake-indexeddb/auto` en premier, puis ajoute `prototype` à `indexedDB` si absent
- `src/lib/offline/db.ts`: 
  - Import dynamique de Dexie (`await import('dexie')`) **APRÈS** vérification/initialisation de `indexedDB`
  - Injection explicite de `Dexie.dependencies.indexedDB` et `Dexie.dependencies.IDBKeyRange`
  - Passage explicite de ces dépendances au constructeur `super()`
- En test, `getLocalDB()` peut ré-initialiser `fake-indexeddb` si nécessaire avant l'import Dexie

### Pourquoi cette contrainte?

Dexie lit `indexedDB` global via `idbReady()`, donc on init `globalThis.indexedDB` avant import Dexie. C'est une contrainte Dexie + Vitest, pas un choix architectural.

## Exécution

```bash
npm run test:transaction-conformance
```

## Debug

Pour activer les logs d'instrumentation Dexie:

```bash
DEBUG_DEXIE_TEST=1 npm run test:transaction-conformance
```

Les logs affichent l'état de `indexedDB` et `Dexie.dependencies.indexedDB` à différents moments:
- AVANT init fake-indexeddb
- AVANT import Dexie
- APRÈS import Dexie
- AVANT new SmartimmoLocalDBClass()
- AVANT this.version(1).stores()
