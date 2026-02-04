# AUDIT RÈGLES — ONGLET PRÊTS PROPERTY TAB
## URL: `/app?view=property&propertyId=...&tab=loans`

Date: 2024-12-XX
Auditeur: Auto (IA)

---

## ✅ RÈGLES RESPECTÉES

### 1. Offline-First App-Shell
- ✅ Lecture depuis IndexedDB uniquement via `useLoansData` (mode app-shell)
- ✅ Aucun `fetch('/api/...')` direct dans `PropertyLoansClient`
- ✅ Filtres/tri appliqués en mémoire (`useMemo`)
- ✅ Pas de `router.push/replace` pour filtres/tri

### 2. Événements ciblés
- ✅ Utilise `loans:refresh` avec `scope: 'property'` et `propertyId`
- ✅ Pas d'émission de `sync:refresh` global
- ✅ Hook `useLoansData` écoute et filtre par `propertyId`
- ✅ Anti-loop : ignore les refresh identiques < 300ms

### 3. Stabilité UI
- ✅ Filtres mémorisés (`loansFilters` avec `useMemo`)
- ✅ Pas de keys instables (`key={loan.id}` stable)
- ✅ Pas de `refreshKey` sur composants parents
- ✅ Safeguard DEV pour détecter remount loops

### 4. React Query
- ✅ `useLoansCharts` utilise `getDefaultChartsQueryOptions()`
- ✅ `placeholderData: keepPreviousData` pour éviter blink
- ✅ `refetchOnWindowFocus: false`
- ✅ `refetchOnReconnect: false`

### 5. UI - Skeleton
- ✅ Condition correcte : `isLoading && allLoans.length === 0`
- ✅ Les données existantes restent visibles pendant refetch

---

## ❌ VIOLATIONS IDENTIFIÉES

### 1. Domain Services (CRITIQUE)
**Règle violée** : "AUCUNE logique métier dans UI / hooks / modales"

**Problème** :
- `PropertyLoansClient` utilise directement `getLoanRepositoryOffline().upsert()` et `.delete()`
- Pas de `LoanService` domain service

**Fichiers concernés** :
- `src/app/app/views/property/tabs/PropertyLoansClient.tsx` (lignes 208, 255, 282)

**Correction requise** :
- Créer `src/domain/services/LoanService.ts`
- Utiliser `LoanService` dans `PropertyLoansClient` au lieu du repository direct

---

### 2. SmartSelect (OBLIGATOIRE)
**Règle violée** : "Utiliser SmartSelect (pas de <select> HTML ni Radix Select)"

**Problème** :
- `LoansFilters` utilise `Select` de `@/components/ui/Select` (Radix)

**Fichiers concernés** :
- `src/components/loans/LoansFilters.tsx` (ligne 154)

**Correction requise** :
- Remplacer `Select` par `SmartSelect` de `@/components/ui/SmartSelect`

---

### 3. SmartDatePicker (OBLIGATOIRE)
**Règle violée** : "Utiliser SmartDatePicker (pas de <input type="date">)"

**Problème** :
- `LoansFilters` utilise `<input type="month">` pour les périodes

**Fichiers concernés** :
- `src/components/loans/LoansFilters.tsx` (lignes 132-146)

**Correction requise** :
- Remplacer par `SmartDatePicker` avec mode "month"

---

### 4. Graphiques min-w-0 (OBLIGATOIRE)
**Règle violée** : "Ajouter min-w-0 sur Card, CardHeader, CardContent, wrapper ResponsiveContainer"

**Problème** :
- Les graphiques n'ont pas `min-w-0` sur les composants Card

**Fichiers concernés** :
- `src/components/loans/LoansCRDTimelineChart.tsx`
- `src/components/loans/LoansByPropertyChart.tsx`
- `src/components/loans/LoansTopCostlyChart.tsx`

**Correction requise** :
- Ajouter `min-w-0` sur `Card`, `CardHeader`, `CardContent`
- Ajouter `min-w-0` sur le wrapper autour de `ResponsiveContainer`

---

### 5. Items de grille min-w-0 (OBLIGATOIRE)
**Règle violée** : "Les items de la grille contenant des graphiques ont min-w-0"

**Problème** :
- Les items de la grille dans `PropertyLoansClient` n'ont pas `min-w-0`

**Fichiers concernés** :
- `src/app/app/views/property/tabs/PropertyLoansClient.tsx` (ligne 375)

**Correction requise** :
- Ajouter `min-w-0` sur les items de la grille

---

### 6. fetch API dans LoanModalV2 (CRITIQUE)
**Règle violée** : "Aucun appel serveur direct depuis les pages/tabs en app-shell"

**Problème** :
- `LoanModalV2` utilise `fetch('/api/loans/${loanId}/borrowers')` et `fetch('/api/loans/${loanId}/documents')`
- Ces appels devraient être depuis IndexedDB en mode app-shell

**Fichiers concernés** :
- `src/components/loans/LoanModalV2.tsx` (lignes 262, 275)

**Correction requise** :
- Détecter le mode (app-shell vs normal)
- En app-shell : charger depuis IndexedDB
- En normal : garder les fetch API

---

### 7. Date picker dans LoanModalV2 (À VÉRIFIER)
**Problème potentiel** :
- `LoanModalV2` utilise probablement un date picker
- Vérifier qu'il utilise `SmartDatePicker` et non `<input type="date">`

**Fichiers concernés** :
- `src/components/loans/LoanModalV2.tsx`

**Correction requise** :
- Vérifier et remplacer si nécessaire

---

## 📋 CHECKLIST CORRECTIONS

- [ ] Créer `LoanService` domain service
- [ ] Refactor `PropertyLoansClient` pour utiliser `LoanService`
- [ ] Remplacer `Select` par `SmartSelect` dans `LoansFilters`
- [ ] Remplacer `<input type="month">` par `SmartDatePicker` dans `LoansFilters`
- [ ] Ajouter `min-w-0` sur tous les graphiques (Card, CardHeader, CardContent, wrapper)
- [ ] Ajouter `min-w-0` sur les items de grille dans `PropertyLoansClient`
- [ ] Remplacer fetch API par IndexedDB dans `LoanModalV2` (borrowers, documents)
- [ ] Vérifier date picker dans `LoanModalV2`

---

## 🎯 PRIORITÉS

1. **CRITIQUE** : Domain Services (LoanService)
2. **CRITIQUE** : fetch API dans LoanModalV2
3. **OBLIGATOIRE** : SmartSelect dans LoansFilters
4. **OBLIGATOIRE** : SmartDatePicker dans LoansFilters
5. **OBLIGATOIRE** : min-w-0 sur graphiques et grille
6. **À VÉRIFIER** : Date picker dans LoanModalV2

