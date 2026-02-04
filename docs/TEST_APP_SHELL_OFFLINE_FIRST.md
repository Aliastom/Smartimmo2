# 🧪 Checklist de Test - App Shell Offline-First

Ce document liste toutes les pages/vues de l'App Shell et les points de vérification pour s'assurer qu'elles respectent le mode offline-first.

## 📋 Règles générales à vérifier

### ✅ Règle 1 : Lecture depuis IndexedDB uniquement
- Les Core Components doivent utiliser `mode="app-shell"`
- Les hooks doivent lire uniquement depuis IndexedDB (pas de fetch, pas de Prisma, pas de Supabase direct)
- Vérifier dans les DevTools (Network) qu'il n'y a **aucun** appel API pour les données métier

### ✅ Règle 2 : Navigation sans refetch
- Changer de vue (`/app?view=biens` → `/app?view=transactions`) ne doit **pas** déclencher de nouveaux appels réseau
- Les données doivent être lues depuis le cache IndexedDB existant

### ✅ Règle 3 : Actions utilisateur offline-first
- Créer/Modifier/Supprimer une entité doit :
  1. S'appliquer **d'abord** en IndexedDB (écriture optimiste)
  2. Créer une `pendingOp` dans la table `pendingOperations`
  3. Afficher un message de confirmation local

### ✅ Règle 4 : Fonctionnement offline complet
- Passer l'app en mode offline (DevTools > Network > Offline)
- Toutes les pages doivent continuer à fonctionner avec les données locales
- Les actions (créer/modifier/supprimer) doivent fonctionner et créer des pendingOps

---

## 🗺️ Liste des vues à tester

### 1. Dashboard (`/app?view=dashboard`)

**Core Component** : `DashboardPageCore` avec `mode="app-shell"`

**Hooks utilisés** :
- `useDashboardData({ mode: "app-shell" })` → doit lire depuis IndexedDB uniquement

**Points à vérifier** :
- [ ] La page se charge avec les données locales
- [ ] Aucun appel réseau dans Network pour `/api/dashboard` ou similaire
- [ ] Les KPI s'affichent (revenus, charges, cashflow, etc.)
- [ ] Les graphiques se chargent (revenus, charges, évolution)
- [ ] Les filtres fonctionnent (période, type de transaction)
- [ ] En mode offline, tout fonctionne avec les données locales
- [ ] Après une sync, les données se rafraîchissent automatiquement

**Comment tester** :
1. Ouvrir `/app?view=dashboard`
2. Ouvrir DevTools > Network
3. Vérifier qu'il n'y a **aucun** appel API (sauf éventuellement `/api/auth/me`)
4. Vérifier que les données s'affichent correctement
5. Passer en offline et rafraîchir → doit toujours fonctionner

---

### 2. Patrimoine (`/app?view=patrimoine`)

**Core Component** : `PatrimoinePageCore` avec `mode="app-shell"`

**Hooks utilisés** :
- `usePatrimoineData({ mode: "app-shell" })` → doit lire depuis IndexedDB uniquement
- `usePropertiesData({ mode: "app-shell" })` → doit lire depuis IndexedDB uniquement

**Points à vérifier** :
- [ ] La page se charge avec les données locales
- [ ] Aucun appel réseau pour les données métier
- [ ] Le graphique de patrimoine s'affiche
- [ ] Les détails par bien s'affichent
- [ ] En mode offline, tout fonctionne

---

### 3. Biens (`/app?view=biens`)

**Core Component** : `PropertiesPageCore` avec `mode="app-shell"`

**Hooks utilisés** :
- `usePropertiesData({ mode: "app-shell" })` → doit lire depuis IndexedDB uniquement

**Points à vérifier** :
- [ ] La liste des biens s'affiche depuis IndexedDB
- [ ] Aucun appel réseau pour `/api/properties`
- [ ] Les filtres fonctionnent (recherche, archivés)
- [ ] Créer un bien :
  - [ ] S'écrit immédiatement en IndexedDB
  - [ ] Crée une `pendingOp` de type `create`
  - [ ] Affiche un message de confirmation local
  - [ ] Apparaît dans la liste immédiatement
- [ ] Modifier un bien :
  - [ ] S'écrit immédiatement en IndexedDB
  - [ ] Crée une `pendingOp` de type `update`
  - [ ] Les modifications sont visibles immédiatement
- [ ] Supprimer un bien :
  - [ ] Se supprime immédiatement en IndexedDB
  - [ ] Crée une `pendingOp` de type `delete`
  - [ ] Disparaît de la liste immédiatement
- [ ] Navigation vers un bien (`/app?view=property&propertyId=xxx`) fonctionne
- [ ] En mode offline, toutes les actions fonctionnent

**Comment tester les actions** :
1. Créer un bien test
2. Ouvrir DevTools > Application > IndexedDB > `smartimmo_db` > `Property`
3. Vérifier que le bien est présent avec `organizationId` correct
4. Vérifier dans `pendingOperations` qu'une opération `create` existe
5. Modifier le bien → vérifier IndexedDB + pendingOp `update`
6. Supprimer le bien → vérifier IndexedDB + pendingOp `delete`

---

### 4. Locataires (`/app?view=locataires`)

**Core Component** : `TenantsPageCore` avec `mode="app-shell"`

**Hooks utilisés** :
- `useTenantsData({ mode: "app-shell" })` → doit lire depuis IndexedDB uniquement

**Points à vérifier** :
- [ ] La liste des locataires s'affiche depuis IndexedDB
- [ ] Aucun appel réseau pour `/api/tenants`
- [ ] Les filtres fonctionnent (recherche, statut)
- [ ] Créer/Modifier/Supprimer un locataire :
  - [ ] Écriture immédiate en IndexedDB
  - [ ] Création de `pendingOp`
  - [ ] Affichage immédiat dans la liste
- [ ] En mode offline, toutes les actions fonctionnent

---

### 5. Baux (`/app?view=baux`)

**Core Component** : `LeasesPageCore` avec `mode="app-shell"`

**Hooks utilisés** :
- `useLeasesData({ mode: "app-shell" })` → doit lire depuis IndexedDB uniquement

**Points à vérifier** :
- [ ] La liste des baux s'affiche depuis IndexedDB
- [ ] Aucun appel réseau pour `/api/leases`
- [ ] Les filtres fonctionnent (propriété, locataire, statut)
- [ ] Créer/Modifier/Supprimer un bail :
  - [ ] Écriture immédiate en IndexedDB
  - [ ] Création de `pendingOp`
  - [ ] Affichage immédiat dans la liste
- [ ] L'affichage des détails (locataire, bien) fonctionne
- [ ] En mode offline, toutes les actions fonctionnent

---

### 6. Transactions (`/app?view=transactions`)

**Core Component** : `TransactionsPageCore` avec `mode="app-shell"`

**Hooks utilisés** :
- `useTransactionsData({ mode: "app-shell" })` → doit lire depuis IndexedDB uniquement

**Points à vérifier** :
- [ ] La liste des transactions s'affiche depuis IndexedDB
- [ ] Aucun appel réseau pour `/api/transactions`
- [ ] Les filtres fonctionnent (propriété, nature, période, type)
- [ ] Les KPI s'affichent (total, revenus, charges)
- [ ] Créer/Modifier/Supprimer une transaction :
  - [ ] Écriture immédiate en IndexedDB
  - [ ] Création de `pendingOp`
  - [ ] Affichage immédiat dans la liste et dans les KPI
- [ ] Navigation entre `/app?view=transactions` et `/app?view=property&propertyId=xxx&tab=transactions` :
  - [ ] Ne doit **pas** déclencher de refetch
  - [ ] Les données sont partagées depuis IndexedDB
- [ ] En mode offline, toutes les actions fonctionnent

---

### 7. Documents (`/app?view=documents`)

**Core Component** : `DocumentsPageCore` avec `mode="app-shell"`

**Hooks utilisés** :
- `useDocumentsData({ mode: "app-shell" })` → doit lire depuis IndexedDB uniquement

**Points à vérifier** :
- [ ] La liste des documents s'affiche depuis IndexedDB
- [ ] Aucun appel réseau pour `/api/documents` (sauf pour télécharger un fichier spécifique)
- [ ] Les filtres fonctionnent (type, propriété)
- [ ] Créer/Modifier/Supprimer un document :
  - [ ] Écriture immédiate en IndexedDB
  - [ ] Création de `pendingOp`
  - [ ] Le téléchargement peut utiliser `/api/documents/${id}/file` (acceptable)
- [ ] En mode offline, les actions fonctionnent (sauf téléchargement qui nécessite online)

**Note** : Le téléchargement de fichier via `/api/documents/${id}/file` est acceptable car c'est pour accéder au fichier binaire, pas pour lire les métadonnées.

---

### 8. Échéances (`/app?view=echeances`)

**Core Component** : `EcheancesPageCore` avec `mode="app-shell"`

**Hooks utilisés** :
- `useEcheancesData({ mode: "app-shell" })` → doit lire depuis IndexedDB uniquement
- `useEcheancesKpis({ mode: "app-shell" })` → doit lire depuis IndexedDB uniquement
- `useEcheancesCharts({ mode: "app-shell" })` → doit lire depuis IndexedDB uniquement

**Points à vérifier** :
- [ ] La liste des échéances s'affiche depuis IndexedDB
- [ ] Aucun appel réseau pour les données métier
- [ ] Les KPI s'affichent (total, en attente, payées)
- [ ] Les graphiques s'affichent
- [ ] Les filtres fonctionnent (propriété, période, statut)
- [ ] Créer/Modifier/Supprimer une échéance :
  - [ ] Écriture immédiate en IndexedDB
  - [ ] Création de `pendingOp`
  - [ ] Affichage immédiat dans la liste et les KPI
- [ ] En mode offline, toutes les actions fonctionnent

---

### 9. Prêts (`/app?view=loans`)

**Core Component** : `LoansPageCore` avec `mode="app-shell"`

**Hooks utilisés** :
- `useLoansData({ mode: "app-shell" })` → doit lire depuis IndexedDB uniquement

**Points à vérifier** :
- [ ] La liste des prêts s'affiche depuis IndexedDB
- [ ] Aucun appel réseau pour `/api/loans`
- [ ] Les filtres fonctionnent (propriété, statut)
- [ ] Créer/Modifier/Supprimer un prêt :
  - [ ] Écriture immédiate en IndexedDB
  - [ ] Création de `pendingOp`
  - [ ] Affichage immédiat dans la liste
- [ ] Les détails d'un prêt (tableau d'amortissement) se calculent localement
- [ ] En mode offline, toutes les actions fonctionnent

---

### 10. Simulation fiscale (`/app?view=fiscal`)

**Core Component** : `FiscalPageCore` avec `mode="app-shell"`

**Hooks utilisés** :
- Doit lire depuis IndexedDB uniquement

**Points à vérifier** :
- [ ] La page se charge avec les données locales
- [ ] Aucun appel réseau pour les données métier
- [ ] Les calculs fiscaux se font localement
- [ ] Créer/Modifier une simulation fiscale :
  - [ ] Écriture immédiate en IndexedDB
  - [ ] Création de `pendingOp`
- [ ] En mode offline, toutes les actions fonctionnent

---

### 11. Détail d'un bien (`/app?view=property&propertyId=xxx`)

**Core Component** : `PropertyDetailView`

**Composants enfants** :
- `PropertyTransactionsClient` (tab `transactions`)
- `PropertyDocumentsClient` (tab `documents`)
- `PropertyEcheancesClient` (tab `deadlines`)
- `PropertyLeasesClient` (tab `lease`)
- `PropertyLoansClient` (tab `loans`)

**Hooks utilisés** :
- `useTransactionsData({ mode: "app-shell" })` avec `propertyId` en filtre
- `useDocumentsData({ mode: "app-shell" })` avec `propertyId` en filtre
- `useEcheancesData({ mode: "app-shell" })` avec `propertyId` en filtre
- `useLeasesData({ mode: "app-shell" })` avec `propertyId` en filtre
- `useLoansData({ mode: "app-shell" })` avec `propertyId` en filtre

**Points à vérifier** :
- [ ] Les onglets (transactions, documents, échéances, baux, prêts) fonctionnent
- [ ] Changer d'onglet ne déclenche **pas** de refetch réseau
- [ ] Toutes les données sont lues depuis IndexedDB
- [ ] Créer/Modifier/Supprimer dans chaque onglet :
  - [ ] Écriture immédiate en IndexedDB
  - [ ] Création de `pendingOp`
  - [ ] Affichage immédiat dans l'onglet concerné
- [ ] Navigation depuis `/app?view=biens` vers cette page :
  - [ ] Ne doit **pas** déclencher de refetch
  - [ ] Les données sont partagées depuis IndexedDB
- [ ] En mode offline, toutes les actions fonctionnent

**Onglets spécifiques** :

#### 11.1. Transactions
- [ ] Liste filtrée par `propertyId`
- [ ] KPI spécifiques au bien
- [ ] Créer une transaction → apparaît immédiatement

#### 11.2. Documents
- [ ] Liste filtrée par `propertyId`
- [ ] Upload de document (crée `pendingOp`)
- [ ] Téléchargement peut utiliser `/api/documents/${id}/file` (acceptable)

#### 11.3. Échéances
- [ ] Liste filtrée par `propertyId`
- [ ] Créer/Modifier une échéance → apparaît immédiatement

#### 11.4. Baux
- [ ] Liste filtrée par `propertyId`
- [ ] Créer/Modifier un bail → apparaît immédiatement

#### 11.5. Prêts
- [ ] Liste filtrée par `propertyId`
- [ ] Créer/Modifier un prêt → apparaît immédiatement
- [ ] Tableau d'amortissement calculé localement

---

### 12. Synchronisation (`/app?view=sync`)

**Core Component** : `PendingSyncView`

**Points à vérifier** :
- [ ] Affiche les `pendingOps` depuis IndexedDB
- [ ] Affiche les stats des tables IndexedDB
- [ ] Bouton "Synchroniser maintenant" :
  - [ ] Pousse les `pendingOps` vers Supabase
  - [ ] Fait un overwrite Supabase → IndexedDB
  - [ ] Émet un event `sync:refresh`
  - [ ] Met à jour l'affichage
- [ ] Bouton "Réinitialiser la sync complète" :
  - [ ] Vide les tables IndexedDB
  - [ ] Recharge toutes les données depuis Supabase
  - [ ] Émet un event `sync:refresh`
- [ ] Comparaison IndexedDB vs Supabase :
  - [ ] Peut faire des appels `/api/*/stats` pour comparer (acceptable car c'est la page de sync)
- [ ] En mode offline, la page fonctionne (affiche les pendingOps, mais ne peut pas sync)

**Note** : Cette page peut légitimement faire des appels réseau pour comparer les données locales et distantes. C'est son rôle.

---

### 13. Paramètres (`/app?view=parametres`)

**Core Component** : `ParametresPageCore` avec `mode="app-shell"`

**Points à vérifier** :
- [ ] La page se charge
- [ ] Les paramètres sont sauvegardés en IndexedDB ou localStorage
- [ ] En mode offline, la page fonctionne

---

### 14. Profil (`/app?view=profil`)

**Core Component** : `ProfilPageCore` avec `mode="app-shell"`

**Points à vérifier** :
- [ ] La page se charge
- [ ] Les informations utilisateur sont affichées (depuis localStorage ou IndexedDB)
- [ ] En mode offline, la page fonctionne

---

## 🔍 Tests de navigation

### Test 1 : Navigation entre vues globales
1. Ouvrir `/app?view=dashboard`
2. Naviguer vers `/app?view=biens`
3. Naviguer vers `/app?view=transactions`
4. Naviguer vers `/app?view=documents`

**Vérifier** :
- [ ] Aucun appel réseau lors des changements de vue
- [ ] Les données s'affichent immédiatement depuis IndexedDB
- [ ] L'URL change mais pas de rechargement de page

---

### Test 2 : Navigation vers un bien
1. Être sur `/app?view=biens`
2. Cliquer sur un bien pour aller à `/app?view=property&propertyId=xxx`

**Vérifier** :
- [ ] Aucun appel réseau
- [ ] Les données du bien sont déjà en IndexedDB (chargées dans la page Biens)
- [ ] Les onglets (transactions, documents, etc.) fonctionnent sans refetch

---

### Test 3 : Navigation depuis un bien vers transactions
1. Être sur `/app?view=property&propertyId=xxx&tab=transactions`
2. Naviguer vers `/app?view=transactions?propertyId=xxx`

**Vérifier** :
- [ ] Aucun appel réseau
- [ ] Les données sont les mêmes (partagées depuis IndexedDB)
- [ ] Les filtres sont conservés

---

## 🚨 Tests offline complets

### Test offline 1 : Navigation complète
1. Passer l'app en offline (DevTools > Network > Offline)
2. Ouvrir `/app?view=dashboard`
3. Naviguer entre toutes les vues :
   - Dashboard → Patrimoine → Biens → Locataires → Baux → Transactions → Documents → Échéances → Prêts
4. Ouvrir un bien et naviguer dans ses onglets

**Vérifier** :
- [ ] Toutes les pages fonctionnent
- [ ] Toutes les données s'affichent
- [ ] Aucune erreur réseau

---

### Test offline 2 : Actions utilisateur
1. Être en offline
2. Créer un bien, un locataire, un bail, une transaction
3. Modifier ces entités
4. Supprimer une entité

**Vérifier** :
- [ ] Toutes les actions fonctionnent
- [ ] Les modifications sont visibles immédiatement
- [ ] Des `pendingOps` sont créées dans IndexedDB
- [ ] Aucune erreur réseau

---

### Test offline 3 : Retour online
1. Avoir fait des actions en offline (créé/modifié/supprimé des entités)
2. Vérifier dans IndexedDB que les `pendingOps` existent
3. Revenir en online
4. Vérifier que la sync automatique se déclenche (ou déclencher manuellement)

**Vérifier** :
- [ ] La sync pousse les `pendingOps` vers Supabase
- [ ] La sync fait un overwrite Supabase → IndexedDB
- [ ] Les `pendingOps` sont supprimées après succès
- [ ] Les données locales sont à jour avec Supabase

---

## 📊 Vérifications dans les DevTools

### IndexedDB
1. Ouvrir DevTools > Application > IndexedDB > `smartimmo_db`
2. Vérifier les tables :
   - `Property`, `Tenant`, `Lease`, `Transaction`, `Document`, `Loan`, `EcheanceRecurrente`
   - `pendingOperations` (doit contenir les opérations en attente)
3. Vérifier que les données ont le bon `organizationId`

### Network
1. Ouvrir DevTools > Network
2. Filtrer par "XHR" ou "Fetch"
3. Naviguer dans l'app

**Vérifier** :
- [ ] Aucun appel vers `/api/properties`, `/api/tenants`, `/api/leases`, etc. (sauf `/api/auth/me`)
- [ ] Seuls les appels légitimes sont présents :
  - `/api/auth/me` (authentification)
  - `/api/documents/${id}/file` (téléchargement de fichier, acceptable)
  - `/api/*/stats` (uniquement dans la page Sync, acceptable)

---

## ✅ Résumé de vérification rapide

Pour chaque page, cocher :
- [ ] Pas d'appels réseau dans DevTools > Network (sauf exceptions légitimes)
- [ ] Données affichées depuis IndexedDB
- [ ] Actions (create/update/delete) créent des `pendingOps`
- [ ] Navigation ne déclenche pas de refetch
- [ ] Fonctionne en mode offline

---

## 🔧 Commandes utiles pour tester

### Vérifier les pendingOps
```javascript
// Dans la console DevTools
const db = await new Promise((resolve, reject) => {
  const request = indexedDB.open('smartimmo_db');
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
const pendingOps = await db.transaction('pendingOperations', 'readonly').objectStore('pendingOperations').getAll();
console.table(pendingOps);
```

### Vérifier les données d'une table
```javascript
// Exemple pour Property
const properties = await db.transaction('Property', 'readonly').objectStore('Property').getAll();
console.table(properties);
```

### Forcer le mode offline
```javascript
// Dans la console DevTools
window.dispatchEvent(new Event('offline'));
// Pour revenir en online
window.dispatchEvent(new Event('online'));
```

---

## 📝 Notes

- Les appels `/api/auth/me` sont acceptables (authentification)
- Les appels `/api/documents/${id}/file` sont acceptables (téléchargement de fichier binaire)
- Les appels `/api/*/stats` dans la page Sync sont acceptables (comparaison locale vs distante)
- Tout autre appel `/api/*` pour les données métier est **interdit** en mode app-shell

