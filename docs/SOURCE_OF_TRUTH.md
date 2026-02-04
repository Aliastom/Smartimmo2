# Source of Truth - Architecture Domain Services

## Principe fondamental

**Toute logique métier doit vivre dans les Domain Services, jamais dans les routes API, Core Components ou modales.**

## Services métier (Source unique de vérité)

### TransactionService
- **Fichier** : `src/domain/services/TransactionService.ts`
- **Responsabilités** :
  - Création transactions (multi-mois, commissions auto)
  - Mise à jour transactions (recalcul commissions)
  - Suppression transactions (cascade commissions, documents)
  - Validation (org, ownership, champs immuables)
  - Gestion déléguée (création/mise à jour frais de gestion)
- **Où ne doit PAS vivre** :
  - ❌ Routes API (`src/app/api/transactions/**`)
  - ❌ Core Components (`src/features/transactions/**`)
  - ❌ Modales transaction

### PropertyService
- **Fichier** : `src/domain/services/PropertyService.ts`
- **Responsabilités** :
  - Création propriétés (validation, sanitization)
  - Mise à jour propriétés (validation, sanitization)
  - Suppression propriétés (3 modes : archive, reassign, cascade)
  - Stats propriétés (leases, transactions, documents, etc.)
  - Réassignation (transfert données liées vers autre bien)
- **Où ne doit PAS vivre** :
  - ❌ Routes API (`src/app/api/properties/**`)
  - ❌ Core Components (`src/features/properties/**`)
  - ❌ Modales propriété

### LeaseService
- **Fichier** : `src/domain/services/LeaseService.ts`
- **Responsabilités** :
  - Création baux (validation, chevauchement, calcul dates, dépôt)
  - Mise à jour baux (transitions statut, calcul dates)
  - Suppression baux (protection baux actifs, transactions)
  - Validation chevauchement baux actifs
  - Calcul automatique endDate (meublé=1an, vide=3ans)
- **Où ne doit PAS vivre** :
  - ❌ Routes API (`src/app/api/leases/**`)
  - ❌ Core Components (`src/features/leases/**`)
  - ❌ Modales bail

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Routes API / Core Components / Modales                  │
│ - Auth + validation payload basique                     │
│ - Appel Domain Service                                  │
│ - Mapping réponse → HTTP / UI                           │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│ Domain Services (TransactionService, PropertyService,  │
│ LeaseService)                                           │
│ - TOUTE la logique métier                               │
│ - Validation complète                                    │
│ - Règles métier (cascade, protections, calculs)         │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│ Repositories (Interfaces)                               │
│ - ITransactionRepository                                │
│ - IPropertyRepository                                   │
│ - ILeaseRepository                                     │
│ - ITenantRepository                                     │
│ - IDocumentRepository                                   │
│ - etc.                                                  │
└──────────────────┬──────────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
        ▼                     ▼
┌──────────────┐      ┌──────────────┐
│ Prisma       │      │ IndexedDB    │
│ Adapters     │      │ Adapters     │
│ (Normal)     │      │ (AppShell)   │
└──────────────┘      └──────────────┘
```

## Flux offline (App Shell)

```
UI → Domain Service → IDB Repository → IndexedDB
                      ↓
                   pendingOps
                      ↓
                   Sync → Supabase
```

## Tests de conformité

Chaque service a des tests in-memory qui prouvent que la logique métier est identique entre mode normal et app-shell :

- `tests/transaction-service-conformance-inmemory.test.ts`
- `tests/property-service-conformance-inmemory.test.ts`
- `tests/lease-service-conformance-inmemory.test.ts`

Voir `docs/CONFORMANCE_CHECKLIST.md` pour les commandes de test.

## Règles strictes

1. **Aucune logique métier dans les routes API**
   - Seulement : auth, validation payload basique, appel service, mapping HTTP

2. **Aucune logique métier dans les Core Components**
   - Seulement : orchestration UI, state, toasts

3. **Aucune logique métier dans les modales**
   - Seulement : formulaire, validation UI, appel service

4. **Domain Services = source unique**
   - Toute règle métier doit être dans un service
   - Les services sont partagés entre normal et app-shell
   - Les services sont testables (in-memory)

## Factories & Adapters

### Factories de services

Chaque service a une factory qui permet de l'instancier avec différents backends :

- **TransactionService** :
  - `createTransactionServicePrisma()` (mode normal)
  - Factory IndexedDB à créer si nécessaire
- **PropertyService** :
  - `createPropertyServicePrisma()` (mode normal)
  - `createPropertyServiceIndexedDB()` (mode app-shell)
  - `createPropertyServiceWithMode(mode)` (factory unifiée)
- **LeaseService** :
  - `createLeaseServicePrisma()` (mode normal)
  - `createLeaseServiceIndexedDB()` (mode app-shell)
  - `createLeaseServiceWithMode(mode)` (factory unifiée)

### Adapters (Prisma & IndexedDB)

Les adapters implémentent les interfaces de repositories sans logique métier :

- **Prisma adapters** : `src/domain/repositories/adapters/Prisma*.ts`
  - CRUD + requêtes + agrégations uniquement
  - Pas de règles métier (validation, calculs, cascade)
- **IndexedDB adapters** : `src/domain/repositories/adapters/IndexedDB*.ts`
  - Même principe : CRUD + requêtes uniquement
  - Utilisent la DB locale (Dexie)

## Migration en cours

- ✅ TransactionService : services + routes API refactorées
- ✅ PropertyService : services + adapters + factories + routes API refactorées + Core Components refactorés
- ✅ LeaseService : services + adapters + factories + routes API refactorées + Core Components refactorés

**Tous les CRUD passent maintenant par les services** :
- Routes API : auth + validation minimale + appel service + mapping HTTP
- Core Components : état UI + collecte formulaire + appel service via factory + rafraîchissement UI
- Modales : utilisent les handlers des Core Components (qui appellent les services)

Voir `docs/AUDIT_RULES_PROPERTY_LEASE.md` pour l'inventaire complet des règles métier.


