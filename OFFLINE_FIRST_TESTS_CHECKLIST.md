# ✅ Checklist de Tests - Mode Offline-First

## 🎯 Objectif

Valider que toutes les fonctionnalités offline-first fonctionnent correctement dans l'application PWA Smartimmo.

---

## 📋 Prérequis

- [ ] Application buildée en production : `npm run build && npm start`
- [ ] PWA installée sur le navigateur (ou mode installé)
- [ ] Compte utilisateur valide avec une organisation
- [ ] DevTools ouverts (Application → IndexedDB, Network, Console)

---

## 🧪 Tests de Base

### Test 1 : Synchronisation Initiale (Full Sync)

**Objectif** : Vérifier que toutes les données sont téléchargées au premier chargement.

**Étapes** :
1. [ ] Ouvrir l'application en ligne
2. [ ] Se connecter avec un compte utilisateur
3. [ ] Attendre 2-3 secondes après la connexion
4. [ ] Ouvrir DevTools → Console
5. [ ] Vérifier les logs :
   - `[FullSync] Démarrage full sync pour organizationId: ...`
   - `[FullSync] ✅ properties: X enregistrements synchronisés`
   - `[FullSync] ✅ leases: X enregistrements synchronisés`
   - `[FullSync] ✅ tenants: X enregistrements synchronisés`
   - `[FullSync] ✅ loans: X enregistrements synchronisés`
   - `[FullSync] ✅ payments: X enregistrements synchronisés`
   - `[FullSync] ✅ transactions: X enregistrements synchronisés`
   - `[FullSync] ✅ echeances: X enregistrements synchronisés`
   - `[FullSync] ✅ Full sync terminée`

**Résultat attendu** :
- ✅ Toutes les tables sont synchronisées
- ✅ Pas d'erreur dans les logs
- ✅ Indicateur de sync affiche "Synchronisé"

**Vérification IndexedDB** :
1. [ ] DevTools → Application → IndexedDB → `SmartimmoLocalDB`
2. [ ] Vérifier que toutes les tables sont remplies :
   - `properties`
   - `leases`
   - `tenants`
   - `loans`
   - `payments`
   - `transactions`
   - `echeances`
   - Tables de cache (fiscalTypes, natures, etc.)

---

### Test 2 : Cache des Données de Référence

**Objectif** : Vérifier que toutes les données admin sont préchargées.

**Étapes** :
1. [ ] Vérifier les logs console :
   - `[useSyncStatus] ✅ Types fiscaux préchargés: X`
   - `[useSyncStatus] ✅ Régimes fiscaux préchargés: X`
   - `[useSyncStatus] ✅ Compatibilités fiscales préchargées: X`
   - `[useSyncStatus] ✅ Sociétés de gestion préchargées: X`
   - `[useSyncStatus] ✅ Natures préchargées: X`
   - `[useSyncStatus] ✅ Catégories comptables préchargées: X`
   - `[useSyncStatus] ✅ Types de documents préchargés: X`
   - `[useSyncStatus] ✅ Signaux préchargés: X`

**Vérification IndexedDB** :
- [ ] Tables de cache remplies avec `cachedAt` récent

---

### Test 3 : Navigation Offline

**Objectif** : Vérifier que toutes les pages sont accessibles sans réseau.

**Étapes** :
1. [ ] Full sync effectuée (Test 1)
2. [ ] Activer le mode Offline : DevTools → Network → Offline
3. [ ] Vérifier l'indicateur de sync : doit afficher "Hors ligne"
4. [ ] Tester la navigation sur toutes les pages :
   - [ ] `/dashboard` - Doit se charger avec les données locales
   - [ ] `/biens` - Liste des biens doit s'afficher
   - [ ] `/baux` - Liste des baux doit s'afficher
   - [ ] `/locataires` - Liste des locataires doit s'afficher
   - [ ] `/prêts` - Liste des prêts doit s'afficher
   - [ ] `/transactions` - Liste des transactions doit s'afficher
   - [ ] `/documents` - Liste des documents doit s'afficher
   - [ ] `/échéances` - Liste des échéances doit s'afficher

**Résultat attendu** :
- ✅ Toutes les pages se chargent sans erreur réseau
- ✅ Les listes affichent les données locales
- ✅ Pas d'erreur 404 ou timeout
- ✅ L'interface est réactive

---

### Test 4 : Création Offline (CRUD - Create)

**Objectif** : Vérifier qu'on peut créer des données en offline.

#### Test 4.1 : Créer un Bien

**Étapes** :
1. [ ] Mode Offline activé
2. [ ] Aller sur `/biens`
3. [ ] Cliquer sur "Nouveau bien"
4. [ ] Remplir le formulaire :
   - [ ] Nom
   - [ ] Adresse (peut être saisi manuellement)
   - [ ] Type
   - [ ] Surface, nombre de pièces
   - [ ] Type fiscal (doit être chargé depuis le cache)
   - [ ] Régime fiscal (doit être chargé depuis le cache)
   - [ ] Société de gestion (doit être chargée depuis le cache)
5. [ ] Sauvegarder

**Résultat attendu** :
- ✅ Le bien apparaît immédiatement dans la liste
- ✅ Pas d'erreur réseau
- ✅ L'indicateur de sync affiche "X opérations en attente"

**Vérification** :
- [ ] DevTools → Application → IndexedDB → `pendingOperations`
- [ ] Vérifier qu'une opération avec `entity: 'property'`, `operation: 'create'`, `status: 'pending'` existe

#### Test 4.2 : Créer un Bail

**Étapes** :
1. [ ] Mode Offline activé
2. [ ] Aller sur `/baux`
3. [ ] Créer un nouveau bail
4. [ ] Remplir le formulaire (tous les champs doivent être accessibles)
5. [ ] Sauvegarder

**Résultat attendu** :
- ✅ Le bail apparaît dans la liste
- ✅ Opération en attente créée dans `pendingOperations`

#### Test 4.3 : Créer un Locataire

**Étapes** :
1. [ ] Mode Offline activé
2. [ ] Aller sur `/locataires`
3. [ ] Créer un nouveau locataire
4. [ ] Sauvegarder

**Résultat attendu** :
- ✅ Le locataire apparaît dans la liste
- ✅ Opération en attente créée

---

### Test 5 : Modification Offline (CRUD - Update)

**Objectif** : Vérifier qu'on peut modifier des données en offline.

**Étapes** :
1. [ ] Mode Offline activé
2. [ ] Ouvrir un bien existant
3. [ ] Modifier un ou plusieurs champs (ex: nom, surface, prix)
4. [ ] Sauvegarder

**Résultat attendu** :
- ✅ Les modifications sont visibles immédiatement
- ✅ L'indicateur de sync affiche "X opérations en attente"
- [ ] DevTools → IndexedDB → `pendingOperations` : opération `update` avec `status: 'pending'`

**Tester sur** :
- [ ] Biens
- [ ] Baux
- [ ] Locataires
- [ ] Prêts

---

### Test 6 : Suppression Offline (CRUD - Delete)

**Objectif** : Vérifier qu'on peut supprimer des données en offline.

**Étapes** :
1. [ ] Mode Offline activé
2. [ ] Sélectionner un bien (ou autre entité)
3. [ ] Cliquer sur "Supprimer" ou "Archiver"
4. [ ] Confirmer la suppression

**Résultat attendu** :
- ✅ L'élément disparaît de la liste immédiatement
- ✅ Opération en attente créée dans `pendingOperations`
- [ ] DevTools → IndexedDB : l'élément est supprimé/archivé localement

---

### Test 7 : Modales en Offline

**Objectif** : Vérifier que les modales fonctionnent avec les données en cache.

**Étapes** :
1. [ ] Mode Offline activé
2. [ ] Ouvrir une modale de création (bien, bail, transaction, etc.)
3. [ ] Vérifier que les listes déroulantes sont préremplies :
   - [ ] Types fiscaux
   - [ ] Régimes fiscaux
   - [ ] Sociétés de gestion
   - [ ] Natures de transaction
   - [ ] Catégories comptables
   - [ ] Types de documents

**Résultat attendu** :
- ✅ Toutes les listes déroulantes sont remplies
- ✅ Pas d'erreur "Chargement en cours..."
- ✅ Pas d'erreur réseau

---

### Test 8 : Synchronisation au Retour en Ligne

**Objectif** : Vérifier que les opérations offline sont synchronisées.

**Étapes** :
1. [ ] Mode Offline activé
2. [ ] Effectuer plusieurs opérations (création, modification, suppression)
3. [ ] Vérifier `pendingOperations` : plusieurs opérations avec `status: 'pending'`
4. [ ] Réactiver le réseau : DevTools → Network → Online
5. [ ] Observer l'indicateur de sync

**Résultat attendu** :
- ✅ L'indicateur affiche "Synchronisation..."
- ✅ Après quelques secondes : "Synchronisé"
- ✅ Le compteur d'opérations en attente revient à 0
- [ ] DevTools → IndexedDB → `pendingOperations` : les opérations passent à `status: 'synced'`
- [ ] Vérifier dans Supabase (ou via l'interface) que les données ont bien été créées/modifiées

**Vérification détaillée** :
- [ ] Les nouveaux biens apparaissent dans Supabase
- [ ] Les modifications sont appliquées
- [ ] Les suppressions sont effectuées

---

### Test 9 : Synchronisation Incrémentale

**Objectif** : Vérifier que seules les modifications sont synchronisées.

**Étapes** :
1. [ ] Full sync effectuée
2. [ ] En ligne, créer/modifier une donnée depuis un autre onglet/device
3. [ ] Revenir à l'onglet principal
4. [ ] Cliquer sur l'indicateur de sync pour forcer une synchronisation
5. [ ] Vérifier que les nouvelles modifications apparaissent

**Résultat attendu** :
- ✅ Les nouvelles données apparaissent sans full sync complète
- ✅ La sync est rapide (seulement les delta)

---

### Test 10 : Gestion des Erreurs de Sync

**Objectif** : Vérifier que les erreurs sont gérées correctement.

**Étapes** :
1. [ ] Mode Offline activé
2. [ ] Créer une donnée avec des valeurs invalides (ex: bien sans nom)
3. [ ] Réactiver le réseau
4. [ ] Observer la synchronisation

**Résultat attendu** :
- ✅ Les opérations valides sont synchronisées
- ✅ Les opérations invalides restent en erreur
- [ ] DevTools → IndexedDB → `pendingOperations` : certaines opérations ont `status: 'error'` et `errorMessage`
- ✅ L'indicateur de sync affiche le nombre d'erreurs

---

### Test 11 : Changement d'Organisation

**Objectif** : Vérifier que les données sont bien filtrées par organisation.

**Étapes** :
1. [ ] Se connecter avec Organisation A
2. [ ] Full sync effectuée
3. [ ] Vérifier IndexedDB : données de l'Organisation A
4. [ ] Se déconnecter
5. [ ] Se connecter avec Organisation B
6. [ ] Full sync effectuée

**Résultat attendu** :
- ✅ Seules les données de l'Organisation B sont chargées
- ✅ Pas de mélange avec les données de l'Organisation A
- ✅ L'interface affiche uniquement les données de l'organisation active

---

### Test 12 : Indicateur de Synchronisation

**Objectif** : Vérifier que l'indicateur affiche les bonnes informations.

**États à tester** :

1. **En ligne, synchronisé** :
   - [ ] Affiche "Synchronisé" avec icône verte
   - [ ] Tooltip : "Dernière sync: À l'instant" ou "Il y a X min"

2. **En ligne, opérations en attente** :
   - [ ] Affiche "X opérations en attente" avec badge orange
   - [ ] Icône RefreshCw
   - [ ] Cliquer déclenche une synchronisation

3. **Hors ligne** :
   - [ ] Affiche "Hors ligne" avec icône WiFi barrée
   - [ ] Tooltip indique le nombre d'opérations en attente

4. **Synchronisation en cours** :
   - [ ] Affiche "Synchronisation..." avec spinner
   - [ ] Bouton désactivé

5. **Erreurs** :
   - [ ] Affiche "X erreurs" avec icône d'alerte rouge
   - [ ] Tooltip indique le message d'erreur

---

### Test 13 : Performance et Limites

**Objectif** : Vérifier que l'application reste performante.

**Tests** :
- [ ] Chargement initial rapide (< 2 secondes)
- [ ] Navigation fluide entre les pages offline
- [ ] Recherche/filtrage fonctionne rapidement sur les données locales
- [ ] Pas de ralentissement avec beaucoup de données (100+ biens, 1000+ transactions)

**Vérification** :
- [ ] DevTools → Performance : mesurer les temps de chargement
- [ ] Vérifier qu'IndexedDB n'est pas saturé

---

## 🔍 Tests Avancés

### Test 14 : Multi-Onglets

**Objectif** : Vérifier que plusieurs onglets restent synchronisés.

**Étapes** :
1. [ ] Ouvrir 2 onglets avec la même application
2. [ ] Onglet 1 : Mode Offline, créer un bien
3. [ ] Onglet 2 : Vérifier (doit voir le bien si même session)
4. [ ] Réactiver le réseau : les 2 onglets doivent se synchroniser

---

### Test 15 : PWA Installée

**Objectif** : Vérifier que tout fonctionne en PWA installée.

**Étapes** :
1. [ ] Installer la PWA sur le PC/mobile
2. [ ] Ouvrir l'app installée
3. [ ] Effectuer tous les tests ci-dessus dans l'app installée

**Résultat attendu** :
- ✅ Tous les tests fonctionnent de la même manière
- ✅ Service Worker actif
- ✅ Mode offline fonctionne même après fermeture de l'app

---

### Test 16 : Retry et Résilience

**Objectif** : Vérifier que les opérations échouées sont retentées.

**Étapes** :
1. [ ] Créer une opération offline
2. [ ] Simuler une erreur temporaire (réseau instable)
3. [ ] Observer les retries

**Résultat attendu** :
- ✅ Les opérations sont retentées jusqu'à 3 fois
- ✅ Après 3 échecs, statut passe à `error`
- ✅ Les opérations peuvent être rejouées manuellement

---

## 📊 Rapport de Tests

Après chaque test, noter :

- [ ] Test réussi ✅ / Échec ❌
- [ ] Temps d'exécution
- [ ] Erreurs rencontrées (si applicable)
- [ ] Observations

---

## 🐛 Problèmes Connus / Limitations

- [ ] Documenter les problèmes rencontrés
- [ ] Noter les améliorations possibles

---

## ✅ Critères de Réussite Globaux

L'implémentation est réussie si :

- [ ] ✅ Full sync télécharge toutes les données
- [ ] ✅ Navigation offline fonctionne sur toutes les pages
- [ ] ✅ CRUD offline fonctionne pour toutes les entités
- [ ] ✅ Synchronisation automatique au retour en ligne
- [ ] ✅ Gestion des erreurs et retries
- [ ] ✅ Indicateur de statut informatif
- [ ] ✅ Pas de régression sur le fonctionnement existant

---

## 📝 Notes de Test

_Utilisez cet espace pour noter vos observations :_

```
Date: ___________
Tester: ___________
Version: ___________

Observations:
_____________________________________________
_____________________________________________
_____________________________________________
```



