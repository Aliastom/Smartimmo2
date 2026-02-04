# Checklist de conformité Normal vs AppShell

## Services couverts

### ✅ TransactionService
- **Fichier service** : `src/domain/services/TransactionService.ts`
- **Tests** : `tests/transaction-service-conformance-inmemory.test.ts`
- **Commandes** :
  ```bash
  npm run test -- tests/transaction-service-conformance-inmemory.test.ts
  ```
- **Couverture** :
  - ✅ CREATE (multi-mois, commissions auto)
  - ✅ UPDATE (recalcul commissions)
  - ✅ DELETE (cascade commissions, documents)

### ✅ PropertyService
- **Fichier service** : `src/domain/services/PropertyService.ts`
- **Tests** : `tests/property-service-conformance-inmemory.test.ts`
- **Commandes** :
  ```bash
  npm run test -- tests/property-service-conformance-inmemory.test.ts
  ```
- **Couverture** :
  - ✅ CREATE (validation, sanitization)
  - ✅ UPDATE (validation, sanitization)
  - ✅ DELETE archive (soft delete)
  - ✅ DELETE cascade (hard delete si aucune donnée liée)
  - ✅ DELETE reassign (transfert vers autre bien)

### ✅ LeaseService
- **Fichier service** : `src/domain/services/LeaseService.ts`
- **Tests** : `tests/lease-service-conformance-inmemory.test.ts`
- **Commandes** :
  ```bash
  npm run test -- tests/lease-service-conformance-inmemory.test.ts
  ```
- **Couverture** :
  - ✅ CREATE (validation, chevauchement, calcul dates, dépôt)
  - ✅ UPDATE (transitions statut, calcul dates)
  - ✅ DELETE (protection baux actifs, transactions)

## Commandes de test globales

### Tous les tests de conformité
```bash
npm run test -- tests/transaction-service-conformance-inmemory.test.ts tests/property-service-conformance-inmemory.test.ts tests/lease-service-conformance-inmemory.test.ts
```

### Tests individuels
```bash
# TransactionService
npm run test -- tests/transaction-service-conformance-inmemory.test.ts

# PropertyService
npm run test -- tests/property-service-conformance-inmemory.test.ts

# LeaseService
npm run test -- tests/lease-service-conformance-inmemory.test.ts
```

## Critères de validation

Pour qu'un service soit considéré conforme :

1. ✅ **Tests in-memory passent** (normal vs app-shell)
2. ✅ **Même input => même output** (entités retournées identiques)
3. ✅ **Mêmes effets de bord** (cascade, protections, modes delete)
4. ✅ **Mêmes erreurs** (même type, même message)

## État actuel

- ✅ **TransactionService** : 6 tests passent
- ✅ **PropertyService** : 6 tests passent
- ✅ **LeaseService** : 7 tests passent

**Total : 19 tests de conformité passent**

## Adapters (Étape 2)

### ✅ PropertyService Adapters
- **Prisma** : `src/domain/repositories/adapters/PrismaPropertyRepository.ts`
  - ✅ CRUD complet (create, update, delete)
  - ✅ Queries (findById, findFirst, findFirstWithManagementCompany)
  - ✅ Stats (getStats)
  - ✅ Réassignation (reassignLeases, reassignTransactions, reassignDocuments, etc.)
- **IndexedDB** : `src/domain/repositories/adapters/IndexedDBPropertyRepository.ts`
  - ✅ CRUD complet
  - ✅ Queries
  - ✅ Stats
  - ✅ Réassignation

### ✅ LeaseService Adapters
- **Prisma** : `src/domain/repositories/adapters/PrismaLeaseRepository.ts`
  - ✅ CRUD complet (create, update, delete)
  - ✅ Queries (findById, findFirst, findByPropertyId, findByTenantId, findMany)
  - ✅ countTransactions
- **IndexedDB** : `src/domain/repositories/adapters/IndexedDBLeaseRepository.ts`
  - ✅ CRUD complet
  - ✅ Queries
  - ✅ countTransactions

### ✅ Factories
- **PropertyService** : `src/domain/services/propertyServiceFactory.ts`
  - ✅ `createPropertyServicePrisma()` - mode normal
  - ✅ `createPropertyServiceIndexedDB()` - mode app-shell
  - ✅ `createPropertyServiceWithMode(mode)` - factory unifiée
- **LeaseService** : `src/domain/services/leaseServiceFactory.ts`
  - ✅ `createLeaseServicePrisma()` - mode normal
  - ✅ `createLeaseServiceIndexedDB()` - mode app-shell
  - ✅ `createLeaseServiceWithMode(mode)` - factory unifiée

### ✅ Smoke Tests
- **Tests** : `tests/property-lease-service-smoke.test.ts`
- **Commande** :
  ```bash
  npm run test -- tests/property-lease-service-smoke.test.ts
  ```
- **Couverture** :
  - ✅ Instanciation PropertyService Prisma
  - ✅ Instanciation PropertyService IndexedDB (via in-memory en test)
  - ✅ Instanciation LeaseService Prisma
  - ✅ Instanciation LeaseService IndexedDB (via in-memory en test)

## Routes API & UI (Étape 4)

### ✅ Routes API refactorées
- **Property** : POST/PUT/DELETE `/api/properties` → `PropertyService` via factory
- **Lease** : POST/PUT/DELETE `/api/leases` → `LeaseService` via factory
- **Smoke tests** : `tests/api-properties-routes-smoke.test.ts`, `tests/api-leases-routes-smoke.test.ts`
  - ✅ 8 tests passent (wiring + mapping erreurs)

### ✅ Core Components refactorés
- **PropertiesPageCore** : handlers → `PropertyService` via `createPropertyServiceWithMode()`
  - ✅ `handlePropertySubmit` (create/update)
  - ✅ `handleDeleteProperty` (stats)
  - ✅ `handleDeleteConfirmed` (delete avec 3 modes)
- **LeasesPageCore** : handlers → `LeaseService` via `createLeaseServiceWithMode()`
  - ✅ `handleModalSubmit` (create/update)
  - ✅ `handleConfirmDelete` (delete)
  - ✅ `handleTerminateMultiple` (résiliation)

### ✅ Mode app-shell
- Les Core Components utilisent `createPropertyServiceWithMode('app-shell')` / `createLeaseServiceWithMode('app-shell')`
- Sync automatique si online après chaque action
- Navigation reste en `/app?view=...` (pas de liens vers routes "normal")

## Prochaines étapes

1. ✅ Adapters Prisma & IndexedDB créés
2. ✅ Factories créées
3. ✅ Smoke tests passent
4. ✅ Routes API refactorées
5. ✅ Core Components + modales refactorés
6. ⏳ Vérifier qu'aucune autre modale/composant n'appelle directement API/repositories


