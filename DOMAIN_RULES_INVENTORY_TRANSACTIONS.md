<!--
NOTE: Le nom du fichier est imposé par le prompt utilisateur.
Le contenu ci-dessous documente la page Gestion déléguée (/app?view=gestion-deleguee).
-->

# DOMAIN RULES INVENTORY — Gestion déléguée (App-Shell)

## Périmètre
- Page App-Shell : `/app?view=gestion-deleguee`
- Page référence (mode normal) : `/gestion-deleguee`
- Entités : `ManagementCompany`, `Property`
- Données locales : IndexedDB (`ManagementCompany`, `Property`)

## Inputs UI
- Création/édition d’une société :
  - nom (obligatoire)
  - contact
  - email
  - téléphone
  - mode de calcul (LOYERS_UNIQUEMENT | REVENUS_TOTAUX)
  - taux (%)
  - frais minimum
  - base sur encaissement (bool)
  - TVA applicable (bool) + taux TVA (%)
  - affectation de biens (liste de biens)
- Actions liste :
  - modifier
  - activer/désactiver
  - création (bouton +)

## KPI / agrégats
*(Non présents sur la page actuelle.)*

## Règles métier CRUD
- Create ManagementCompany
  - Écrire localement (IndexedDB) + pendingOp `create`
  - Affectation des biens : mettre à jour `managementCompanyId` sur les biens sélectionnés
- Update ManagementCompany
  - Écrire localement (IndexedDB) + pendingOp `update`
  - Affectation des biens : diff entre biens sélectionnés et biens précédemment liés
    - assigner les nouveaux
    - délier les retirés (managementCompanyId → null)
- Toggle active
  - Écrire localement (IndexedDB) + pendingOp `update` `{ actif: !actif }`

## Documents
*(Non applicable à cette page.)*

## Sécurité orgId
- Toutes les lectures/écritures filtrent par `organizationId`
- Interdit : déduire l’orgId depuis l’URL

## Navigation app-shell
- Interne : `/app?view=gestion-deleguee`
- Interdit : liens vers routes normales depuis app-shell

## Différences à éliminer (objectif App-Shell)
- Aucune lecture serveur en app-shell (pas de `/api/*`)
- CRUD via **Domain Service** (pas de logique métier dans UI)
- Refresh ciblés : `managementCompany:refresh` et `properties:refresh`
- Pas de `sync:refresh` global

## Incertitudes / à clarifier
- Statut “gestion déléguée activée” en offline : pas de flag serveur disponible.
  - En app-shell offline : le CRUD est autorisé par défaut.
# 📋 INVENTAIRE DES RÈGLES MÉTIER — TRANSACTIONS

**Date:** 2025-01-XX  
**Contexte:** Transformation App-Shell pour `/app?view=transactions`  
**Objectif:** Documenter toutes les règles métier, filtres, KPI, comportements pour garantir la conformité entre mode normal et app-shell

---

## 1. INPUTS UI — FILTRES, RECHERCHE, TRI

### 1.1. Filtres disponibles

#### Filtres de base
- **Recherche textuelle** (`search`): Recherche dans `label`, `reference`, nom du bien (`Property.name`)
- **Bien** (`propertyId`): Filtre par propriété (optionnel, masqué dans l'onglet d'un bien)
- **Bail** (`leaseId`): Filtre par bail
- **Locataire** (`tenantId`): Filtre par locataire
- **Nature** (`natureId`): Filtre par nature comptable (RECETTE/DEPENSE)
- **Catégorie** (`categoryId`): Filtre par catégorie comptable (filtrée selon la nature sélectionnée)
- **Montant min/max** (`amountMin`, `amountMax`): Filtre par montant (valeur absolue)
- **Date du/au** (`dateFrom`, `dateTo`): Filtre par date de transaction
- **Document** (`hasDocument`): `'yes'` = avec document, `'no'` = sans document, `''` = tous
- **Statut rapprochement** (`status`): `'rapprochee'` ou `'non_rapprochee'` (géré via carte KPI)

#### Filtres de période comptable
- **Période comptable** (`periodStart`, `periodEnd`): Format `YYYY-MM`
  - Raccourcis: "Mois courant", "Année courante", "3 derniers mois", "12 derniers mois", "Tous"
  - Filtre sur `accountingMonth` (ou calculé depuis `date` si `accountingMonth` est NULL)

#### Options d'affichage
- **Inclure frais de gestion** (`includeManagementFees`): Par défaut `true`, masque les transactions avec `autoSource === 'gestion'` si `false`
- **Grouper par parent** (`groupByParent`): Par défaut `true`, groupe les transactions parent/enfant (loyer + commission)
- **Inclure biens archivés** (`includeArchived`): Par défaut `false`, inclut les biens archivés dans les filtres

### 1.2. Cartes KPI filtrantes

Les cartes KPI sont **filtrantes** (cliquables) :

1. **Recettes totales** (`activeKpiFilter === 'recettes'`)
   - Filtre: `nature.type === 'RECETTE'` (ou `flow === 'INCOME'`)
   - Carte verte

2. **Dépenses totales** (`activeKpiFilter === 'depenses'`)
   - Filtre: `nature.type === 'DEPENSE'` (ou `flow === 'EXPENSE'`)
   - Carte rouge

3. **Solde net** (`activeKpiFilter === 'solde'` ou `null`)
   - Aucun filtre (vue globale)
   - Carte bleue si solde ≥ 0, rouge sinon
   - **Par défaut actif**

4. **Transactions non rapprochées** (`activeKpiFilter === 'nonRapprochees'`)
   - Filtre: `status === 'non_rapprochee'` (ou `rapprochementStatus === 'non_rapprochee'`)
   - Carte jaune

**Comportement:**
- Clic sur une carte active (sauf "solde") → désactive le filtre (retour à "solde")
- Clic sur "solde" déjà actif → ne fait rien
- Clic sur une autre carte → active cette carte

### 1.3. Tri

Le tri est géré par le composant `TransactionsTable` :
- **Par défaut:** Tri par date (plus récent en premier)
- **Colonnes triables:** Date, Montant, Nature, Catégorie
- **Tri local en mémoire** (pas de refetch serveur)

### 1.4. Pagination

- **Par défaut:** 50 transactions par page
- **Pagination côté client** en mode app-shell (toutes les transactions sont chargées, pagination UI uniquement)
- **Pagination côté serveur** en mode normal (API avec `page` et `limit`)

---

## 2. KPI & AGRÉGATS

### 2.1. KPI calculés

Les KPI sont calculés depuis les transactions filtrées (selon `periodStart`, `periodEnd`, `propertyId`, `activeKpiFilter`) :

1. **Recettes totales** (`recettesTotales`)
   - Somme des montants absolus des transactions avec `nature.flow === 'INCOME'` (ou `amount > 0` si nature non trouvée)

2. **Dépenses totales** (`depensesTotales`)
   - Somme des montants absolus des transactions avec `nature.flow === 'EXPENSE'` (ou `amount < 0` si nature non trouvée)
   - **Stocké comme valeur négative** pour le calcul du solde

3. **Solde net** (`soldeNet`)
   - Calcul: `recettesTotales + depensesTotales` (depensesTotales est déjà négatif)

4. **Transactions non rapprochées** (`nonRapprochees`)
   - Compte des transactions avec `rapprochementStatus === 'non_rapprochee'`

### 2.2. Graphiques

#### Graphique 1: Évolution cumulée (`TransactionsCumulativeChart`)
- **Type:** Area chart avec gradient
- **Axe X:** Mois (format `YYYY-MM`)
- **Données:** 
  - `income`: Recettes du mois
  - `expense`: Dépenses du mois (négatif)
  - `net`: Solde du mois (income + expense)
  - `cumulated`: Solde cumulé depuis le début de la période
- **Période:** Génère tous les mois entre `periodStart` et `periodEnd`

#### Graphique 2: Répartition par catégorie (`TransactionsByCategoryChart`)
- **Type:** Pie chart ou bar chart
- **Données:** Agrégation par `category.label` (somme des montants absolus)
- **Tri:** Par montant décroissant

#### Graphique 3: Recettes vs Dépenses (`TransactionsIncomeExpenseChart`)
- **Type:** Bar chart comparatif
- **Données:**
  - `income`: Total recettes (somme des montants absolus)
  - `expense`: Total dépenses (négatif pour l'affichage)

### 2.3. Résumé des montants (`amountsSummary`)

- **`positiveSum`**: Somme des recettes (montants > 0)
- **`negativeSum`**: Somme des dépenses (montants < 0, valeur négative)

---

## 3. RÈGLES MÉTIER — CRÉATION/UPDATE/DELETE

### 3.1. Création de transaction

**Service:** `TransactionService.createTransaction()`

**Paramètres requis:**
- `organizationId` (obligatoire)
- `propertyId` (obligatoire)
- `categoryId` (obligatoire)
- `nature` / `natureId` (obligatoire)
- `amount` (obligatoire)
- `date` (obligatoire)
- `label` (optionnel, défaut: "Transaction")

**Paramètres optionnels:**
- `leaseId` / `bailId`
- `tenantId`
- `reference`
- `notes`
- `paidAt` / `paymentDate`
- `method` / `paymentMethod`
- `accountingMonth`
- `periodStart`, `periodMonth`, `periodYear`, `monthsCovered` (multi-mois)
- `rapprochementStatus` (défaut: `'non_rapprochee'`)
- `bankRef`
- `montantLoyer`, `chargesRecup`, `chargesNonRecup` (gestion déléguée)
- `isAutoAmount`
- `stagedDocumentIds` (documents à créer et lier)
- `stagedLinkItemIds` (documents existants à lier)
- `factures` (tableau de factures pour calcul commission)

**Règles métier:**

1. **Validation:**
   - Vérifier que `propertyId` appartient à `organizationId`
   - Vérifier que `leaseId` (si fourni) appartient à `organizationId` et est lié à `propertyId`
   - Vérifier que `categoryId` existe
   - Vérifier que `nature` existe

2. **Multi-mois:**
   - Si `periodStart`, `periodMonth`, `periodYear`, `monthsCovered` sont fournis:
     - Créer `monthsCovered` transactions (une par mois)
     - Chaque transaction a `moisIndex` (1, 2, 3...) et `moisTotal` (total)
     - `parentTransactionId` de la première transaction = `null`
     - `parentTransactionId` des suivantes = ID de la première transaction
     - `label` suffixé avec " (Mois X/Y)"

3. **Gestion déléguée (commissions auto):**
   - Si `gestionEnabled === true` et nature = loyer (`rentNature`):
     - Calculer la commission via `calcCommission()`
     - Créer une transaction commission avec:
       - `isAuto = true`
       - `autoSource = 'gestion'`
       - `parentTransactionId = transaction.id` (transaction loyer)
       - `nature = mgmtNature` (défaut: `'DEPENSE_GESTION'`)
       - `categoryId = mgmtCategory` (défaut: `'frais-gestion'`)
       - `amount = -commissionTTC` (négatif)
   - **En mode app-shell:** `skipAutoCommissions = true` (commissions créées côté serveur lors de la sync)

4. **Documents:**
   - Si `stagedDocumentIds` fourni:
     - Mettre à jour les documents de `status: 'draft'` → `status: 'active'`
     - Créer 4 `DocumentLink` par document:
       - `linkedType: 'transaction'`, `linkedId: transaction.id`
       - `linkedType: 'property'`, `linkedId: propertyId` (si `propertyId` existe)
       - `linkedType: 'lease'`, `linkedId: leaseId` (si `leaseId` existe)
       - `linkedType: 'global'`, `linkedId: 'global'`
   - Si `stagedLinkItemIds` fourni:
     - Créer les mêmes 4 `DocumentLink` pour chaque document existant

5. **Accounting month:**
   - Si `accountingMonth` fourni, l'utiliser
   - Sinon, calculer depuis `date` (format `YYYY-MM`)

### 3.2. Mise à jour de transaction

**Service:** `TransactionService.updateTransaction()`

**Règles métier:**

1. **Validation:**
   - Vérifier que la transaction existe
   - Vérifier que `propertyId` (si modifié) appartient à `organizationId`
   - Vérifier que `leaseId` (si modifié) appartient à `organizationId`

2. **Champs immuables:**
   - `organizationId` ne peut pas être modifié
   - `id` ne peut pas être modifié

3. **Gestion déléguée (recalcul commissions):**
   - Si la transaction est un loyer et que `montantLoyer`, `chargesRecup`, ou `factures` changent:
     - Supprimer l'ancienne commission auto (si existe)
     - Recalculer et créer une nouvelle commission auto
   - Si la nature change (plus un loyer):
     - Supprimer la commission auto associée

4. **Documents:**
   - Même logique que création (mise à jour `draft` → `active`, création `DocumentLink`)

### 3.3. Suppression de transaction

**Service:** `TransactionService.deleteTransaction()`

**Paramètres:**
- `mode`: `'delete_docs'` ou `'keep_docs_globalize'`

**Règles métier:**

1. **Cascade commissions:**
   - Supprimer automatiquement toutes les transactions avec:
     - `parentTransactionId === transaction.id`
     - `isAuto === true`
     - `autoSource === 'gestion'`

2. **Documents:**
   - Si `mode === 'delete_docs'`:
     - Supprimer tous les `DocumentLink` liés à la transaction
     - Supprimer les documents physiques (côté serveur uniquement)
   - Si `mode === 'keep_docs_globalize'`:
     - Supprimer uniquement les `DocumentLink` avec `linkedType === 'transaction'`
     - Conserver les liens `property`, `lease`, `global`

3. **Protection:**
   - Les commissions auto ne peuvent pas être supprimées directement (supprimées en cascade avec le parent)

---

## 4. DOCUMENTS

### 4.1. Liens documents ↔ transactions

- **Création:** 4 liens créés par document lors de la création/mise à jour de transaction:
  - `transaction` (obligatoire)
  - `property` (si `propertyId` existe)
  - `lease` (si `leaseId` existe)
  - `global` (toujours)

### 4.2. Statut documents

- **Draft → Active:** Lors de la création/mise à jour de transaction avec `stagedDocumentIds`
- **Suppression:** Selon le mode de suppression de transaction (`delete_docs` vs `keep_docs_globalize`)

---

## 5. SÉCURITÉ — ORGID

### 5.1. Filtrage obligatoire

- **Toutes les requêtes** doivent filtrer par `organizationId`
- **Toutes les opérations CRUD** doivent vérifier que l'entité appartient à `organizationId`
- **Interdiction** de déduire `organizationId` depuis l'URL (utiliser la session)

### 5.2. Validation ownership

- Vérifier que `propertyId` appartient à `organizationId`
- Vérifier que `leaseId` appartient à `organizationId` et est lié à `propertyId`

---

## 6. NAVIGATION APP-SHELL

### 6.1. URLs

- **Vue globale:** `/app?view=transactions`
- **Vue propriété:** `/app?view=property&propertyId=xxx&tab=transactions`

### 6.2. Navigation interne

- **Uniquement via `/app?view=...`**
- **Pas de liens "mode normal"** depuis app-shell

---

## 7. DIFFÉRENCES À ÉLIMINER

### 7.1. Refresh global

**Problème actuel:**
- Les filtres/tri/cartes KPI déclenchent un `refreshKey` qui force un rechargement complet
- `PropertyDetailView` peut se remonter lors des changements de filtres

**Solution:**
- Retirer `refreshKey` des dépendances des hooks KPI/Charts
- Utiliser `useMemo` pour les calculs qui dépendent uniquement des filtres
- Ne pas incrémenter `refreshKey` lors des changements de filtres/tri/cartes
- S'assurer que `PropertyDetailView` ne se remonte pas (keys stables, `useMemo`)

### 7.2. Lecture IndexedDB

**Règle:**
- En mode app-shell, **aucun `fetch('/api/...')`** pour charger les données métier
- Lecture **uniquement depuis IndexedDB** via les repositories offline

### 7.3. Écriture via Domain Services

**Règle:**
- Tous les CRUD doivent passer par `TransactionService` (factory `createTransactionServiceWithMode(mode)`)
- **Aucune logique métier** dans les composants UI / modales / routes API

---

## 8. INCERTITUDES / QUESTIONS

### 8.1. Commissions auto en app-shell

**Question:** Les commissions sont-elles créées localement ou uniquement côté serveur ?

**Réponse actuelle:** En mode app-shell, `skipAutoCommissions = true`. Les commissions sont créées côté serveur lors de la sync. Un round-trip push→pull est effectué en online pour récupérer les commissions immédiatement.

### 8.2. Tri local vs serveur

**Question:** Le tri doit-il être local (en mémoire) ou serveur (refetch) ?

**Réponse actuelle:** Tri local en mémoire (pas de refetch serveur) pour éviter les refresh globaux.

### 8.3. Pagination

**Question:** Pagination côté client (toutes les transactions chargées) ou serveur (API avec page/limit) ?

**Réponse actuelle:** 
- Mode app-shell: Pagination côté client (toutes les transactions chargées, pagination UI uniquement)
- Mode normal: Pagination côté serveur (API avec `page` et `limit`)

---

## 9. COMPORTEMENTS ATTENDUS

### 9.1. Filtres/tri/cartes

- **Pas de remount** de `PropertyDetailView`
- **Pas de refresh global** (seule la table et les agrégats dépendants se mettent à jour)
- **Pas de flash loader** global
- **Tri local** en mémoire (pas de refetch)

### 9.2. CRUD

- **Écriture immédiate** dans IndexedDB (optimistic)
- **Création pendingOp** pour sync ultérieure
- **Refresh ciblé** via événement `transactions:refresh` (pas `sync:refresh` global)
- **Pas de remount** de la vue

### 9.3. Online vs Offline

- **Offline:** Lecture/filtrage identiques (IndexedDB only), mutations stockées en pendingOps
- **Online:** Optionnellement round-trip push→pull immédiat après mutation critique, MAIS sans refresh global ni remount

---

## 10. ÉVÉNEMENTS

### 10.1. Événements ciblés

- **`transactions:refresh`**: Refresh ciblé des transactions uniquement
  - Payload: `{ scope?: 'property', propertyId?: string, reason?: string }`
  - Filtré par `propertyId` si spécifié

### 10.2. Événements interdits

- **`sync:refresh`**: Ne doit **pas** être émis depuis les pages/tabs pour les interactions UI
- **Événements globaux**: Ne doivent pas être utilisés pour les filtres/tri/cartes

---

## 11. TESTS OBLIGATOIRES

### 11.1. E2E Playwright (app-shell)

1. La page s'affiche offline (zéro requête réseau métier)
2. Filtres/tri/cartes:
   - Ne provoquent pas de remount de `PropertyDetailView`
   - Pas de flash loader global
   - Seules la table et les agrégats nécessaires évoluent
3. CRUD offline: create/update/delete + pendingOps + UI immédiate
4. Passage online: push/pull + cohérence
5. Commission auto (selon option choisie): visible au bon moment
6. Documents: draft→active + liens cohérents local/remote

### 11.2. Instrumentation test

- Compteur/trace simple (dev-only) pour détecter remount (ex: log mount/unmount `PropertyDetailView` / `TransactionTab`)
- Vérifier l'absence de remount lors d'un filtre/tri

---

## 12. DEFINITION OF DONE (DoD)

- [ ] Zéro fetch réseau métier en app-shell
- [ ] CRUD via Domain Services uniquement
- [ ] Modales conformes
- [ ] Navigation app-shell only
- [ ] KPI/graphes calculés depuis IndexedDB
- [ ] **FILTRES/TRI/CARTES = pas de refresh global / pas de remount**
- [ ] Tests conformance + E2E verts
- [ ] Docs à jour

