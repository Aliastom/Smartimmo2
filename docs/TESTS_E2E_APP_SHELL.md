# Tests E2E App-Shell - Guide Complet

## Vue d'ensemble

Cette suite de tests E2E valide le mode **APP-SHELL offline-first** après les refactors Domain Services (TransactionService, PropertyService, LeaseService).

### Objectifs

- ✅ Valider que l'app-shell fonctionne 100% offline
- ✅ Vérifier que tous les CRUD passent par les Services (pas de fetch direct)
- ✅ Tester la synchronisation (pendingOps, syncGlobal, fullSync)
- ✅ Vérifier la conformité métier (commissions auto, cascades, validations, overlaps)
- ✅ S'assurer qu'aucune navigation ne bascule vers les routes "normal"

---

## Structure des tests

```
tests/e2e/app-shell/
├── helpers/
│   ├── appShellNav.ts      # Navigation app-shell
│   ├── offline.ts          # Gestion offline/online
│   ├── seed.ts             # Seed/reset données test
│   └── assertions.ts       # Assertions IndexedDB/Supabase
├── 01-smoke-app-shell.spec.ts          # Scénario A
├── 02-crud-transaction.spec.ts         # Scénario B
├── 03-crud-property.spec.ts            # Scénario C
├── 04-crud-lease.spec.ts               # Scénario D
├── 05-documents-linking.spec.ts        # Scénario E
├── 06-reprise-resilience.spec.ts       # Scénario F
└── 07-gestion-deleguee.spec.ts         # Scénario G
```

---

## Configuration

### Prérequis

1. **Variables d'environnement** (`.env.local` ou `.env.test`) :
   ```bash
   TEST_API_TOKEN=your-secret-test-token
   ALLOW_TEST_ENDPOINTS=true  # Pour activer /api/test/*
   ```

2. **Base de données** :
   - Une base de test dédiée (recommandé)
   - Ou utiliser la base de dev avec précaution

3. **Playwright** :
   ```bash
   npm install -D @playwright/test
   npx playwright install chromium
   ```

### Configuration Playwright

Le fichier `playwright.config.ts` configure :
- Timeout global : 60s
- Workers : 1 (série pour éviter conflits)
- Base URL : `http://localhost:3000`
- Reporter : HTML + JSON + List

---

## Exécution des tests

### Tous les tests

```bash
npm run test:e2e:app-shell
```

### Un scénario spécifique

```bash
npx playwright test tests/e2e/app-shell/01-smoke-app-shell.spec.ts
```

### Mode debug (avec UI)

```bash
PLAYWRIGHT_HEADLESS=false npm run test:e2e:app-shell
```

### Mode CI

```bash
CI=true npm run test:e2e:app-shell
```

### Avec trace (pour déboguer)

```bash
npx playwright test --trace on
```

---

## Scénarios de test

### A. Smoke App-Shell

**Objectif** : Vérifier le boot et la navigation de base.

**Tests** :
- A1. Boot app-shell et chargement depuis cache
- A2. Navigation interne app-shell sans rechargement
- A3. Aucun lien vers routes "normal"
- A4. Sidebar utilise navigation app-shell
- A5. Navigation vers vue property avec propertyId

**Vérifications** :
- ✅ URL reste dans `/app?view=...`
- ✅ Aucun rechargement complet
- ✅ Données chargées depuis IndexedDB

---

### B. CRUD Transaction (offline-first)

**Objectif** : Valider le CRUD transaction en mode offline.

**Tests** :
- B1. Création transaction offline → local + pendingOp
- B2. Création transaction gestion déléguée → commission auto
- B3. Modification transaction → commission recalculée
- B4. Suppression transaction → cascade commission
- B5. Reprise réseau → pendingOps vidées

**Vérifications** :
- ✅ Transaction créée dans IndexedDB
- ✅ PendingOp créée avec statut `pending`
- ✅ Commission auto créée si gestion déléguée
- ✅ Après sync : transaction dans Supabase

---

### C. CRUD Property (offline + delete modes)

**Objectif** : Valider le CRUD property avec modes de suppression.

**Tests** :
- C1. Création bien offline → local + pendingOp
- C2. Modification bien offline → local + pendingOp
- C3. Suppression bien (archive) → local + pendingOp
- C4. Reprise réseau → cohérence serveur

**Vérifications** :
- ✅ Bien créé/modifié dans IndexedDB
- ✅ Archive : `isArchived = true` (soft delete)
- ✅ PendingOp créée pour chaque action
- ✅ Après sync : état cohérent dans Supabase

---

### D. CRUD Lease (overlaps + termination)

**Objectif** : Valider le CRUD bail avec détection d'overlaps.

**Tests** :
- D1. Création bail offline → local + pendingOp
- D2. Tentative création overlap → erreur métier
- D3. Résiliation bail → transition statut
- D4. Reprise réseau → cohérence serveur

**Vérifications** :
- ✅ Bail créé dans IndexedDB
- ✅ Overlap détecté et rejeté (erreur 409/validation)
- ✅ Résiliation : `status = 'RÉSILIÉ'`
- ✅ Après sync : état cohérent dans Supabase

---

### E. Documents (au moins liaison)

**Objectif** : Valider l'attachement de documents.

**Tests** :
- E1. Attacher document à transaction → lien local
- E2. Reprise réseau → cohérence serveur

**Vérifications** :
- ✅ DocumentLink créé dans IndexedDB
- ✅ Après sync : lien dans Supabase

---

### F. Reprise réseau + résilience

**Objectif** : Valider la résilience et la synchronisation massive.

**Tests** :
- F1. Enchaîner 10 actions offline → toutes en pendingOps
- F2. Reprise réseau → tout se synchronise
- F3. UI se rafraîchit sans reload complet

**Vérifications** :
- ✅ 10+ pendingOps créées
- ✅ Après sync : toutes vidées

---

### G. Gestion déléguée (offline-first)

**Objectif** : Valider le CRUD gestion déléguée en mode app-shell offline.

**Tests** :
- G1. Création société offline → local + pendingOp
- G2. Modification société offline (taux/mode) → local + pendingOp
- G3. Affectation biens (assign + unassign) → propriétés mises à jour localement
- G4. Toggle actif/inactif offline → pendingOp update
- G5. Reprise online → push/pull ciblé + UI stable (pas de remount)

**Vérifications** :
- ✅ ManagementCompany créée/éditée dans IndexedDB
- ✅ PendingOps `managementCompany` créées
- ✅ Propriétés affectées/désaffectées localement
- ✅ Aucun fetch `/api/*` en app-shell offline
- ✅ Pas de refresh global (pas de remount, pas de flash loader)
- ✅ UI rafraîchie via événements (pas de reload)

---

## Helpers disponibles

### Navigation (`appShellNav.ts`)

```typescript
// Naviguer vers une vue app-shell
await navigateToAppShellView(page, 'biens', { propertyId: 'xxx' });

// Vérifier qu'aucun lien ne pointe vers routes "normal"
await assertNoNormalRouteLinks(page);

// Vérifier que la sidebar utilise app-shell
await assertSidebarUsesAppShellNav(page);
```

### Offline (`offline.ts`)

```typescript
// Passer offline
await setOffline(context);

// Repasser online
await setOnline(context);

// Vérifier qu'aucune requête réseau n'est faite
await assertNoNetworkRequestsForData(page, ['/api/log']);

// Attendre la sync
await waitForSyncComplete(page, 30000);
```

### Seed (`seed.ts`)

```typescript
// Seed des données de test
const seedData = createMinimalTestSeed(organizationId);
await seedTestData(request, seedData);

// Reset
await resetTestData(request, organizationId);
```

### Assertions (`assertions.ts`)

```typescript
// Vérifier qu'une entité existe dans IndexedDB
await assertEntityInIndexedDB(page, 'Property', propertyId, orgId);

// Vérifier qu'une entité existe dans Supabase
await assertEntityInSupabase(request, '/api/properties', propertyId);

// Vérifier qu'une pendingOp existe
await assertPendingOpExists(page, 'property', propertyId, 'create', orgId);

// Vérifier qu'aucune pendingOp n'existe (après sync)
await assertNoPendingOp(page, 'property', propertyId, orgId);
```

---

## Endpoints de test

### POST `/api/test/seed`

Seed des données de test.

**Headers** :
```
X-Test-Token: <token>
Content-Type: application/json
```

**Body** :
```json
{
  "organizationId": "test-org-123",
  "properties": [...],
  "tenants": [...],
  "leases": [...],
  "transactions": [...]
}
```

**Réponse** :
```json
{
  "success": true,
  "data": {
    "properties": [...],
    "tenants": [...],
    "leases": [...],
    "transactions": [...]
  }
}
```

### POST `/api/test/reset`

Reset des données de test.

**Headers** :
```
X-Test-Token: <token>
Content-Type: application/json
```

**Body** :
```json
{
  "organizationId": "test-org-123"
}
```

**Réponse** :
```json
{
  "success": true,
  "message": "All test data for organization test-org-123 has been reset"
}
```

---

## Checklist "Definition of Done - APP-SHELL"

### Navigation

- [ ] Aucun lien dans l'app-shell ne pointe vers `/biens`, `/transactions`, etc.
- [ ] Tous les liens utilisent `/app?view=...`
- [ ] La sidebar utilise `window.history.pushState` (pas de Link Next.js)
- [ ] Navigation interne ne déclenche pas de rechargement complet

### CRUD

- [ ] Aucun `fetch('/api/properties')` direct dans les composants app-shell
- [ ] Tous les CRUD passent par les Services (`PropertyService`, `LeaseService`, `TransactionService`)
- [ ] Les modales utilisent les Services (pas de fetch direct)
- [ ] En mode offline : écriture locale + pendingOp créée
- [ ] En mode online : sync immédiate après action

### Synchronisation

- [ ] PendingOps créées pour chaque action (create/update/delete)
- [ ] Sync silencieuse : push pendingOps → pull remote
- [ ] Full sync : vide IDB → recharge depuis Supabase
- [ ] Événements `sync:refresh` et `fullSync:complete` émis

### Conformité métier

- [ ] Commissions auto créées pour transactions gestion déléguée
- [ ] Cascades respectées (suppression transaction → suppression commission)
- [ ] Overlaps baux détectés et rejetés
- [ ] Validations métier dans les Services (pas dans l'UI)

### Résilience

- [ ] 10+ actions offline → toutes synchronisées après reprise réseau
- [ ] UI se rafraîchit sans reload complet (via événements)
- [ ] PendingOps en erreur : statut `error` + message + retry possible

---

## Dépannage

### Tests qui échouent

1. **Vérifier les logs Playwright** :
   ```bash
   npx playwright show-report
   ```

2. **Vérifier les traces** :
   ```bash
   npx playwright show-trace trace.zip
   ```

3. **Vérifier l'état IndexedDB** :
   - Ouvrir DevTools → Application → IndexedDB
   - Vérifier les tables : `Property`, `Lease`, `Transaction`, `pendingOperations`

4. **Vérifier les pendingOps** :
   ```typescript
   // Dans la console du navigateur
   const { getLocalDB } = await import('@/lib/offline/db');
   const db = await getLocalDB();
   const ops = await db.pendingOperations.toArray();
   console.log(ops);
   ```

### Erreurs communes

**"Unauthorized" sur `/api/test/seed`** :
- Vérifier que `TEST_API_TOKEN` est défini
- Vérifier que le header `X-Test-Token` est envoyé

**"Test endpoints disabled in production"** :
- Vérifier que `ALLOW_TEST_ENDPOINTS=true` en dev/test
- Ne jamais activer en production

**"Cannot read properties of undefined (reading 'where')"** :
- Vérifier que `getLocalDB()` est bien `await`-ed
- Vérifier que la base IndexedDB est initialisée

**"PendingOp not found"** :
- Vérifier que l'`organizationId` est correct
- Vérifier que la pendingOp a bien été créée (check IndexedDB)

---

## CI/CD

### GitHub Actions (exemple)

```yaml
name: E2E App-Shell Tests

on:
  push:
    branches: [main]
  pull_request:

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e:app-shell
        env:
          TEST_API_TOKEN: ${{ secrets.TEST_API_TOKEN }}
          ALLOW_TEST_ENDPOINTS: 'true'
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

---

## Prochaines étapes

1. **Compléter les tests manquants** :
   - Tests de documents (upload réel)
   - Tests de prêts (loans)
   - Tests d'échéances

2. **Améliorer la couverture** :
   - Tests de performance (10+ actions)
   - Tests de conflits (modifications simultanées)
   - Tests de récupération après crash

3. **Automatiser** :
   - CI/CD complet
   - Tests de régression automatiques
   - Alertes en cas d'échec

---

## Notes importantes

⚠️ **Les endpoints `/api/test/*` sont protégés et ne fonctionnent qu'en environnement de test.**

⚠️ **Ne jamais activer `ALLOW_TEST_ENDPOINTS=true` en production.**

⚠️ **Les tests utilisent une organisation de test dédiée pour éviter de polluer les données de production.**
