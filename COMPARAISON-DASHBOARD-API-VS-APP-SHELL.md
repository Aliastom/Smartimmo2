# Comparaison Dashboard API vs App-Shell

## ✅ CORRECTIONS APPLIQUÉES

### 1. Sommes encaissées
- **Problème** : Utilisait `flow === 'INCOME' || flow === 'RECETTE'` en app-shell
- **Correction** : Utilise uniquement `flow === 'INCOME'` (cohérent avec l'API)
- **Problème** : Fallback sur `date` si pas d'`accounting_month`
- **Correction** : Exclut les transactions sans `accounting_month` (cohérent avec l'API)

### 2. Dépenses réalisées
- **Problème** : Utilisait `flow === 'EXPENSE' || flow === 'DEPENSE'` en app-shell
- **Correction** : Utilise uniquement `flow === 'EXPENSE'` (cohérent avec l'API)

### 3. Taux d'encaissement (loyers encaissés)
- **Problème** : Utilisait `flow === 'INCOME' || flow === 'RECETTE'` en app-shell
- **Correction** : Utilise uniquement `flow === 'INCOME'` (cohérent avec l'API)

---

## 🔍 ÉLÉMENTS À VÉRIFIER

### 4. Cashflow
- **API** : `sommesEncaisses - depensesRealisees`
- **App-shell** : `sommesEncaisses - depensesRealisees` (via `computeCashflow`)
- **Status** : ✅ Identique (calculé à partir des valeurs corrigées)

### 5. Baux actifs
- **API** : Compte les baux avec `status: 'ACTIF'` et dates dans le mois
- **App-shell** : Compte les baux avec `status === 'ACTIF'` et dates dans le mois
- **Différence potentielle** : 
  - API : `activeLeases.length` (après filtrage Prisma)
  - App-shell : `currentMonthLeases.filter(l => l.status === 'ACTIF').length`
- **Status** : ⚠️ À vérifier si les filtres de dates sont identiques

### 6. Documents envoyés
- **API** : `prisma.document.count({ uploadedAt: { gte: firstDay, lte: lastDay }, status: { not: 'pending' } })`
- **App-shell** : `documents.filter(d => uploadDate >= monthStart && uploadDate <= monthEnd && d.status !== 'pending').length`
- **Différence potentielle** :
  - API : `status: { not: 'pending' }` (exclut 'pending')
  - App-shell : `d.status !== 'pending'` (identique)
- **Status** : ✅ Devrait être identique

### 7. Loyers en retard (Relances)
- **API** : 
  - Charge TOUS les baux (actifs ou pas) avec filtres bienIds/locataireIds
  - Charge TOUTES les transactions de loyer avec `nature === rentNature` et `categoryId === rentCategoryId`
  - Vérifie pour chaque bail chaque mois entre `effectiveStartDate` (max(leaseStart, propertyAcquisitionDate)) et `endDate`
  - Compte comme en retard si pas de transaction avec `leaseId + accounting_month`
- **App-shell** :
  - Utilise `leases` (tous les baux chargés)
  - Utilise `allRentTransactions` filtrées par nature/category
  - Même logique de vérification
- **Différence potentielle** :
  - API : Filtre les transactions par `bienIds` et `locataireIds` dans la requête Prisma
  - App-shell : Filtre après chargement
  - **MAIS** : Les transactions utilisées pour `allRentTransactions` ne sont PAS filtrées par bienIds/locataireIds en app-shell !
- **Status** : ⚠️ **PROBLÈME** - Les transactions de loyer ne sont pas filtrées par bienIds/locataireIds en app-shell

### 8. Transactions non rapprochées
- **API** : 
  - Requête Prisma avec `accounting_month: month`, `rapprochementStatus: { not: 'rapprochee' }`
  - Filtres bienIds/locataireIds appliqués dans la requête
  - Limite à 20
- **App-shell** :
  - Utilise `filteredTransactions` (déjà filtrées par mois et autres filtres)
  - Filtre par `rapprochementStatus !== 'rapprochee'`
  - Limite à 20
- **Différence potentielle** :
  - Les `filteredTransactions` sont déjà filtrées par tous les filtres (bienIds, locataireIds, type, source, statut, focusLoyer)
  - **MAIS** : Le filtre `statut` est appliqué, alors que dans l'API, les transactions non rapprochées ne sont PAS filtrées par statut !
- **Status** : ⚠️ **PROBLÈME** - Les transactions non rapprochées sont filtrées par statut en app-shell mais pas en API

### 9. Indexations à traiter
- **API** : 
  - Charge les baux avec `status: 'ACTIF'` et `indexationType: { not: null }`
  - Vérifie si l'anniversaire est dans `[monthStart - 15j, monthEnd + 15j]`
- **App-shell** :
  - Filtre les baux avec `status === 'ACTIF'` et `indexationType`
  - Même logique de vérification
- **Status** : ✅ Devrait être identique

### 10. Échéances de prêts
- **API** : 
  - Charge les prêts avec `isActive: true` et dates dans le mois
  - Utilise `buildSchedule` pour calculer les échéances
- **App-shell** :
  - Filtre les prêts avec `isActive` et dates dans le mois
  - Utilise `buildSchedule` (même fonction)
- **Status** : ✅ Devrait être identique

### 11. Échéances récurrentes (charges)
- **API** : 
  - Charge les échéances avec `isActive: true` et dates dans le mois
  - Calcule selon la périodicité (MONTHLY, QUARTERLY, YEARLY)
- **App-shell** :
  - Filtre les échéances avec `isActive` et dates dans le mois
  - Même logique de calcul
- **Status** : ✅ Devrait être identique

### 12. Baux arrivant à échéance
- **API** : 
  - Charge les baux avec `status: 'ACTIF'`, `endDate` dans `[today, today + 90j]`
- **App-shell** :
  - Filtre les baux avec `status === 'ACTIF'`, `endDate` dans `[today, today + 90j]`
- **Status** : ✅ Devrait être identique

### 13. Documents à valider
- **API** : 
  - Charge les documents avec `ocrStatus: 'pending' | 'error'` OU `status: 'pending'`
  - Filtrés par `uploadedAt` dans le mois
  - Limite à 20
- **App-shell** :
  - Filtre les documents avec `ocrStatus === 'pending' || ocrStatus === 'error' || status === 'pending'`
  - Filtrés par `uploadedAt` dans le mois
  - Limite à 20
- **Status** : ✅ Devrait être identique

### 14. Graphiques
- **API** : Retourne des tableaux vides `[]` (calculés côté client)
- **App-shell** : Retourne des tableaux vides `[]`
- **Status** : ✅ Identique

---

## ✅ PROBLÈMES CORRIGÉS

### Problème 1 : Transactions de loyer pour relances non filtrées par bienIds/locataireIds
**Fichier** : `src/features/dashboard/hooks/useDashboardData.ts` ligne 416

**Problème** : `allRentTransactions` n'appliquait pas les filtres `bienIds` et `locataireIds`

**Correction appliquée** : ✅ Filtrage de `allRentTransactions` par `bienIds` et `locataireIds` avant de créer `paidMonths`

### Problème 2 : Transactions non rapprochées filtrées par statut
**Fichier** : `src/features/dashboard/hooks/useDashboardData.ts` ligne 667

**Problème** : `filteredTransactions` étaient déjà filtrées par `statut`, mais l'API ne filtre PAS les transactions non rapprochées par statut

**Correction appliquée** : ✅ Utilisation des transactions du mois SANS le filtre statut pour les transactions non rapprochées (filtre `statut: 'ALL'` forcé)

---

## 📋 RÉSUMÉ DES CORRECTIONS

1. ✅ **Sommes encaissées** : `flow === 'INCOME'` uniquement (pas 'RECETTE')
2. ✅ **Dépenses réalisées** : `flow === 'EXPENSE'` uniquement (pas 'DEPENSE')
3. ✅ **Taux d'encaissement** : `flow === 'INCOME'` uniquement pour les loyers encaissés
4. ✅ **Filtrage par mois** : Uniquement `accounting_month` (pas de fallback sur `date`)
5. ✅ **Relances (loyers en retard)** : Filtrage par `bienIds` et `locataireIds` appliqué
6. ✅ **Transactions non rapprochées** : Pas de filtre `statut` appliqué (cohérent avec l'API)

