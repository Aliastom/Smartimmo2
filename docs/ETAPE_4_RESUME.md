# Résumé - Étape 4 : Refactoring Routes API & UI

## ✅ Objectif atteint

**ZÉRO divergence entre "normal" et "app-shell" pour Property + Lease** :
- Toute la logique métier est dans `PropertyService` / `LeaseService`
- Routes API = auth + validation légère + appel service via factory + mapping HTTP
- UI/Core Components/modales = état UI + collecte formulaire + appel service via factory + rafraîchissement UI
- AUCUN CRUD direct Prisma/IndexedDB dans UI, AUCUNE règle métier dans UI

## 📦 Routes API refactorées

### Property Routes
- ✅ `POST /api/properties` → `PropertyService.createProperty()` via `createPropertyServicePrisma()`
- ✅ `PUT /api/properties/[id]` → `PropertyService.updateProperty()` via factory
- ✅ `DELETE /api/properties/[id]` → `PropertyService.deleteProperty()` via factory
- ✅ Helper `mapPropertyServiceErrorToHttpStatus()` créé

### Lease Routes
- ✅ `POST /api/leases` → `LeaseService.createLease()` via `createLeaseServicePrisma()`
- ✅ `PUT /api/leases/[id]` → `LeaseService.updateLease()` via factory
- ✅ `DELETE /api/leases/[id]` → `LeaseService.deleteLease()` via factory
- ✅ Helper `mapLeaseServiceErrorToHttpStatus()` créé

### Smoke Tests
- ✅ `tests/api-properties-routes-smoke.test.ts` : 4 tests passent
- ✅ `tests/api-leases-routes-smoke.test.ts` : 4 tests passent
- ✅ Vérifient le wiring : routes → services → mapping erreurs

## 🎨 Core Components refactorés

### PropertiesPageCore
- ✅ `handlePropertySubmit` : utilise `PropertyService` via `createPropertyServiceWithMode()`
  - Mode normal : `createPropertyServiceWithMode('normal')`
  - Mode app-shell : `createPropertyServiceWithMode('app-shell')`
- ✅ `handleDeleteProperty` : utilise `PropertyService.getPropertyStats()`
- ✅ `handleDeleteConfirmed` : utilise `PropertyService.deleteProperty()` avec 3 modes
- ✅ Plus d'appels directs à `getPropertyRepositoryOffline()` ou fetch API

### LeasesPageCore
- ✅ `handleModalSubmit` : utilise `LeaseService` via `createLeaseServiceWithMode()`
- ✅ `handleConfirmDelete` : utilise `LeaseService.deleteLease()`
- ✅ `handleTerminateMultiple` : utilise `LeaseService.updateLease()` pour résilier
- ✅ Plus d'appels directs à `getLeaseRepositoryOffline()` ou fetch API

## 🔄 Mode app-shell

- ✅ Les Core Components utilisent `createPropertyServiceWithMode('app-shell')` / `createLeaseServiceWithMode('app-shell')`
- ✅ Sync automatique si online après chaque action (via `getGlobalSyncService().syncAllPendingToRemote()`)
- ✅ Navigation reste en `/app?view=...` (pas de liens vers routes "normal")
- ✅ Messages adaptés selon online/offline

## 📊 Tests

**Total : 21 tests passent**
- ✅ PropertyService conformance : 6 tests
- ✅ LeaseService conformance : 7 tests
- ✅ API routes smoke tests : 8 tests

## 🎯 Principe respecté

**Zéro logique métier dans UI/routes** :
- Routes API : auth + validation minimale (shape) + appel service + mapping HTTP
- Core Components : état UI + collecte formulaire + appel service + rafraîchissement UI
- Modales : utilisent les handlers des Core Components (qui appellent les services)
- Toute la logique métier (validation, sanitization, cascade, protections, calculs) est dans les services

## 📝 Notes techniques

### Factories utilisées
- `createPropertyServiceWithMode(mode)` : factory unifiée pour Property
- `createLeaseServiceWithMode(mode)` : factory unifiée pour Lease
- Les factories injectent automatiquement les bons adapters (Prisma ou IndexedDB)

### Sync en mode app-shell
- Après chaque action (create/update/delete), si online :
  - Appel à `getGlobalSyncService().syncAllPendingToRemote(organizationId)`
  - Pousse les pendingOps vers Supabase
  - Message de succès adapté selon le résultat de la sync

### Navigation app-shell
- Les liens restent en querystring `/app?view=...`
- Pas de navigation vers routes "normal" (`/biens`, `/baux`, etc.)
- Utilisation de `window.history.pushState()` pour navigation atomique

## ⚠️ Composants restants

Certains composants UI (non Core Components) appellent encore directement les API :
- `src/ui/components/PropertyLeasesTab.tsx` : fetch `/api/leases`
- `src/components/forms/LeaseEditModal.tsx` : fetch `/api/leases` (actions spéciales)
- `src/ui/hooks/useLeases.ts` : fetch `/api/leases` (lecture seule)

**Ces composants ne sont pas les Core Components principaux** et peuvent être refactorés dans une phase ultérieure si nécessaire. Les Core Components (`PropertiesPageCore`, `LeasesPageCore`) sont maintenant la source de vérité pour les opérations CRUD.

## 🚀 État final

- ✅ Routes API Property/Lease refactorées → services
- ✅ Core Components Property/Lease refactorés → services (normal + app-shell)
- ✅ Tests API routes property/lease passants
- ✅ Aucune duplication restante de logique métier dans Core Components
- ✅ Navigation app-shell cohérente (`/app?view=...`)

**L'Étape 4 est terminée.**

