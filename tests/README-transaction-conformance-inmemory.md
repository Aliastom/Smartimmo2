# Tests de conformité TransactionService (In-Memory)

## Contexte

Les tests de conformité TransactionService (Normal vs AppShell) utilisent désormais des **repositories in-memory** au lieu de Dexie/fake-indexeddb.

## Pourquoi in-memory ?

Les tests avec Dexie + fake-indexeddb échouaient systématiquement avec :
```
TypeError: Cannot read properties of undefined (reading 'prototype')
```

**Cause racine** : Dexie lit `indexedDB` au moment de l'import du module (via closure `idbReady()`), avant que `fake-indexeddb` soit initialisé, même avec `import 'fake-indexeddb/auto'` en première ligne.

**Solution** : Utiliser des repositories in-memory qui implémentent les mêmes interfaces que Prisma/Dexie, mais sans dépendre d'IndexedDB.

## Architecture

### Interfaces de repositories

Tous les repositories implémentent des interfaces définies dans `src/domain/repositories/interfaces/` :

- `ITransactionRepository`
- `IPropertyRepository`
- `ILeaseRepository`
- `ICategoryRepository`
- `IDocumentRepository`
- `IDocumentLinkRepository`
- `INatureRepository`

### Implémentations in-memory

Les implémentations in-memory sont dans `src/domain/repositories/inMemory/` :

- `InMemoryTransactionRepository`
- `InMemoryPropertyRepository`
- `InMemoryLeaseRepository`
- `InMemoryCategoryRepository`
- `InMemoryDocumentRepository`
- `InMemoryDocumentLinkRepository`
- `InMemoryNatureRepository`

### TransactionService

`TransactionService` (dans `src/domain/services/TransactionService.ts`) accepte des dépendances injectées via les interfaces, ce qui permet :

- En production : utiliser des adapters Prisma/Dexie
- En tests : utiliser des repositories in-memory

## Tests

### Exécution

```bash
npm run test -- tests/transaction-service-conformance-inmemory.test.ts
```

### Couverture

Les tests vérifient :

1. **CREATE** : même input => mêmes side-effects (transaction + commission)
2. **CREATE** : gestion déléguée désactivée => pas de commission
3. **UPDATE** : même input => mêmes side-effects (recalcul commission)
4. **DELETE** : même input => mêmes side-effects (suppression cascade commissions auto)
5. **DELETE** : commissions non-auto conservées par défaut
6. **CREATE** : multi-mois => transactions multiples créées

## Validation

Les tests comparent l'état final entre deux exécutions identiques :
- Une via "mode normal" (repositories in-memory)
- Une via "mode app-shell" (mêmes repositories in-memory)

Si les résultats sont identiques, cela prouve que la logique métier est la même dans les deux modes.

## Notes

- Les repositories in-memory sont **simples** : CRUD basique + requêtes filtrées
- Ils ne contiennent **aucune logique métier** (celle-ci est dans TransactionService)
- Les tests sont **rapides** (pas de setup IndexedDB/Dexie)
- Les tests sont **déterministes** (pas de problèmes d'ordre d'import)

