# Refactorisation des routes API Transactions

## Résumé

Les routes API `/api/transactions` (POST, PUT, DELETE) ont été refactorisées pour utiliser `TransactionService` comme unique source de vérité métier.

## Changements effectués

### 1. Routes API refactorisées

#### POST `/api/transactions`
- ✅ Validation basique du payload (propertyId, categoryId, nature, amount)
- ✅ Extraction des documentIds depuis `stagedLinkItemIds` (UploadStagedItem → Document)
- ✅ Récupération des settings de gestion déléguée
- ✅ Appel à `TransactionService.createTransaction()`
- ✅ Migration des fichiers (tmp/ → documents/) après création (logique spécifique API)
- ✅ Suppression des UploadStagedItem après traitement
- ✅ Mapping des erreurs vers les bons status HTTP

#### PUT `/api/transactions/[id]`
- ✅ Extraction des documentIds depuis `stagedLinkItemIds`
- ✅ Récupération des settings de gestion déléguée
- ✅ Appel à `TransactionService.updateTransaction()`
- ✅ Migration des fichiers (tmp/ → documents/) après mise à jour
- ✅ Suppression des UploadStagedItem après traitement
- ✅ Mapping des erreurs vers les bons status HTTP

#### DELETE `/api/transactions/[id]`
- ✅ Récupération des bucketKeys AVANT suppression (pour supprimer les fichiers physiques après)
- ✅ Appel à `TransactionService.deleteTransaction()`
- ✅ Suppression des fichiers physiques si `mode=delete_docs` (logique spécifique API)
- ✅ Mapping des erreurs vers les bons status HTTP

### 2. Helpers créés

#### `src/domain/services/transactionServiceHelpers.ts`
- `getGestionSettings()` : Récupère les settings de gestion déléguée
- `mapTransactionServiceErrorToHttpStatus(error)` : Mappe les erreurs TransactionService vers les status HTTP appropriés

### 3. Tests

#### Tests in-memory (conformité)
- ✅ 6 tests passent
- ✅ Vérifient la conformité Normal vs AppShell

#### Tests API routes
- ✅ 6 tests passent
- ✅ Vérifient validation payload (400)
- ✅ Vérifient appel à TransactionService
- ✅ Vérifient mapping des erreurs (404, 400, etc.)

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Routes API (/api/transactions)                         │
│ - Validation payload                                    │
│ - Auth + organizationId                                 │
│ - Extraction stagedLinkItemIds → documentIds            │
│ - Migration fichiers (tmp/ → documents/)               │
│ - Suppression UploadStagedItem                          │
│ - Mapping erreurs → HTTP status                         │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│ TransactionService                                      │
│ - Logique métier complète                              │
│ - Multi-mois                                            │
│ - Commissions auto                                      │
│ - Documents (finalisation, liens)                       │
│ - Cascade suppression                                   │
│ - Validations (org, ownership)                          │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│ Repositories (Prisma / InMemory)                        │
│ - ITransactionRepository                                │
│ - IPropertyRepository                                   │
│ - ILeaseRepository                                      │
│ - ICategoryRepository                                    │
│ - IDocumentRepository                                   │
│ - IDocumentLinkRepository                               │
│ - INatureRepository                                     │
└─────────────────────────────────────────────────────────┘
```

## Conformité Normal vs AppShell

✅ **Garantie** : Les tests in-memory prouvent que `TransactionService` produit les mêmes résultats (transactions + commissions + documents) en mode normal et app-shell.

## Points d'attention

1. **Migration des fichiers** : La migration `tmp/ → documents/` reste dans l'API car elle dépend du storage service. TransactionService gère seulement la finalisation du statut et la création des liens.

2. **Suppression des fichiers physiques** : La suppression des fichiers physiques (mode `delete_docs`) reste dans l'API car elle dépend du storage service. TransactionService supprime seulement de la base.

3. **UploadStagedItem** : Les UploadStagedItem sont supprimés dans l'API après traitement, car ils sont spécifiques au workflow d'upload et ne font pas partie du domaine métier.

## Checklist de conformité

- [x] POST utilise TransactionService
- [x] PUT utilise TransactionService
- [x] DELETE utilise TransactionService
- [x] Zéro logique métier dans les routes API
- [x] Tests in-memory passent (6/6)
- [x] Tests API routes passent (6/6)
- [x] Mapping erreurs → HTTP status
- [x] Migration fichiers gérée dans l'API
- [x] Suppression fichiers physiques gérée dans l'API

## Commandes de test

```bash
# Tests de conformité (in-memory)
npm run test -- tests/transaction-service-conformance-inmemory.test.ts

# Tests API routes
npm run test -- tests/api-transactions-routes.test.ts
```
