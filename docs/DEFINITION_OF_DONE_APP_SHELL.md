# Definition of Done - APP-SHELL

Checklist anti-régression pour garantir que l'app-shell reste conforme aux règles d'architecture.

---

## ✅ Navigation

- [ ] **Aucun lien dans l'app-shell ne pointe vers les routes "normal"** (`/biens`, `/transactions`, `/baux`, etc.)
- [ ] **Tous les liens utilisent `/app?view=...`** (navigation interne app-shell)
- [ ] **La sidebar utilise `window.history.pushState`** (pas de `<Link>` Next.js pour la navigation interne)
- [ ] **Navigation interne ne déclenche pas de rechargement complet** (pas de `router.push()` ou `window.location.href`)
- [ ] **Les liens externes (hors app-shell) sont autorisés** (ex: liens vers documentation, support)

---

## ✅ CRUD & Services

- [ ] **Aucun `fetch('/api/properties')` direct dans les composants app-shell**
- [ ] **Aucun `fetch('/api/leases')` direct dans les composants app-shell**
- [ ] **Aucun `fetch('/api/transactions')` direct dans les composants app-shell**
- [ ] **Tous les CRUD passent par les Services** (`PropertyService`, `LeaseService`, `TransactionService`)
- [ ] **Les modales utilisent les Services** (pas de fetch direct dans `TransactionModal`, `PropertyForm`, `LeaseForm`)
- [ ] **Les factories sont utilisées** : `createPropertyServiceWithMode('app-shell')`, etc.
- [ ] **En mode offline** : écriture locale (IndexedDB) + pendingOp créée
- [ ] **En mode online** : sync immédiate après action (push pendingOps → pull remote)

---

## ✅ Synchronisation

- [ ] **PendingOps créées pour chaque action** (create/update/delete)
- [ ] **PendingOps ont le bon format** : `{ type, table, orgId, payload, status: 'pending' }`
- [ ] **Sync silencieuse** : push pendingOps → pull remote (overwrite SB → IDB)
- [ ] **Full sync** : vide IDB → recharge depuis Supabase
- [ ] **Événements émis** : `sync:refresh`, `fullSync:complete`
- [ ] **UI écoute les événements** : rafraîchissement automatique après sync

---

## ✅ Conformité métier

- [ ] **Commissions auto créées** pour transactions gestion déléguée (LOYER avec `managementCompanyId`)
- [ ] **Cascades respectées** : suppression transaction → suppression commission auto
- [ ] **Overlaps baux détectés** : création bail avec dates qui chevauchent → erreur métier
- [ ] **Validations métier dans les Services** (pas dans l'UI ni les routes API)
- [ ] **Protections respectées** : suppression bien avec baux actifs → erreur ou confirmation
- [ ] **Multi-mois** : transactions avec `monthsCovered > 1` → série créée correctement

---

## ✅ Résilience

- [ ] **10+ actions offline** → toutes synchronisées après reprise réseau
- [ ] **UI se rafraîchit sans reload complet** (via événements `sync:refresh`)
- [ ] **PendingOps en erreur** : statut `error` + message + retry possible
- [ ] **Pas de blocage UI** : les actions locales fonctionnent même si sync échoue
- [ ] **Gestion des conflits** : en cas de conflit, Supabase gagne (source de vérité)

---

## ✅ IndexedDB

- [ ] **Tous les repositories offline utilisent `await getLocalDB()`** (pas de `getLocalDB()` synchrone)
- [ ] **Pattern `_dbPromise` + `async getDb()`** utilisé dans les classes
- [ ] **Aucune erreur "Cannot read properties of undefined (reading 'where')"**
- [ ] **Tables Dexie correctement initialisées** : `Property`, `Lease`, `Transaction`, `Tenant`, `Document`, `Loan`, `Echeance`, `pendingOperations`

---

## ✅ Hooks & Data

- [ ] **Hooks unifiés utilisés** : `usePropertiesData({ mode: 'app-shell' })`, etc.
- [ ] **En mode app-shell, les hooks lisent uniquement IndexedDB** (pas de fetch API)
- [ ] **En mode normal, les hooks peuvent utiliser React Query** (fetch API autorisé)
- [ ] **Même interface de sortie** : les hooks retournent la même structure en normal et app-shell

---

## ✅ Tests

- [ ] **Tests E2E passent** : `npm run test:e2e:app-shell`
- [ ] **Aucun test qui échoue** (sauf si régression intentionnelle)
- [ ] **Couverture minimale** : smoke, CRUD transaction, CRUD property, CRUD lease, sync
- [ ] **Tests de régression** : vérifier qu'aucune fonctionnalité existante n'est cassée

---

## ✅ Documentation

- [ ] **`docs/TESTS_E2E_APP_SHELL.md`** à jour
- [ ] **`docs/SOURCE_OF_TRUTH.md`** mentionne PropertyService/LeaseService/TransactionService
- [ ] **`docs/CONFORMANCE_CHECKLIST.md`** à jour avec les nouveaux tests

---

## ❌ Interdictions strictes

- ❌ **Aucun fetch direct vers `/api/properties`, `/api/leases`, `/api/transactions` dans les composants app-shell**
- ❌ **Aucun `router.push('/biens/...')` dans l'app-shell** (utiliser `/app?view=property&propertyId=...`)
- ❌ **Aucune logique métier dans les routes API** (uniquement auth + validation shape + appel service)
- ❌ **Aucune logique métier dans l'UI** (uniquement état UI + collecte formulaire + appel service)
- ❌ **Aucun appel Prisma/Supabase direct dans les composants app-shell** (uniquement via Services)

---

## 🔍 Vérification rapide

Pour vérifier rapidement qu'un composant est conforme :

1. **Chercher les fetch directs** :
   ```bash
   grep -r "fetch('/api/properties" src/features src/components
   ```

2. **Chercher les router.push vers routes normal** :
   ```bash
   grep -r "router.push('/biens" src/features src/components
   ```

3. **Vérifier l'utilisation des Services** :
   ```bash
   grep -r "createPropertyServiceWithMode\|createLeaseServiceWithMode\|createTransactionServiceWithMode" src/features src/components
   ```

4. **Vérifier les pendingOps** :
   ```bash
   grep -r "pendingOperations" src/lib/offline src/features
   ```

---

## 📝 Notes

- Cette checklist doit être vérifiée **avant chaque merge** d'une PR qui touche l'app-shell
- Les tests E2E doivent **tous passer** avant de merger
- En cas de divergence, **corriger immédiatement** (pas de "on verra plus tard")

---

**Dernière mise à jour** : Après implémentation des tests E2E App-Shell
