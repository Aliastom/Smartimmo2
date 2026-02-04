# Audit Complet : Sources RSC Restantes

## ⚠️ VERDICT : IL RESTE UNE SOURCE RSC

### 🔴 Problème Principal Identifié

**Fichier :** `src/app/app/AppShellClient.tsx`  
**Ligne :** 611  
**Mécanisme :** `urlParams.get('tab')` dans `renderView` useMemo dépend de `searchParams` via `useSearchParams()`

**FLUX ACTUEL (PROBLÉMATIQUE) :**
1. Clic onglet → `handleTabChange()` dans `PropertyTabs.tsx` (ligne 96)
2. `history.replaceState()` met à jour l'URL (ligne 104)
3. Événement `app-shell:url-change` émis (ligne 108) ❌ **MAUVAIS ÉVÉNEMENT**
4. `urlChangeKey` incrémenté dans `AppShellClient` (ligne 67)
5. `urlParams` recalculé (ligne 296)
6. `renderView` useMemo recalculé avec `urlParams.get('tab')` (ligne 611)
7. **PROBLÈME** : `useSearchParams()` de Next.js peut **ENCORE** déclencher un fetch RSC même après `replaceState()`

### 🔍 Preuve

**Ligne 611 dans AppShellClient.tsx :**
```typescript
const propertyTab = urlParams.get('tab') || 'transactions';
```

**Ligne 296 :**
```typescript
const urlParams = useMemo(() => searchParams, [searchParams, urlChangeKey]);
```

**Ligne 58 :**
```typescript
const searchParams = useSearchParams(); // ❌ Source RSC potentielle
```

**Ligne 659 :**
```typescript
}, [safeCurrentView, organizationId, urlParams]); // ❌ Dépend de urlParams
```

**Mécanisme** : `useSearchParams()` de Next.js peut interpréter le changement d'URL (même via `replaceState`) comme une navigation et tenter de précharger la route en RSC.

## ✅ Checklist d'Audit

### A. Sources de Navigation Next

**Résultats :**

1. **`<Link>` dans /property :**
   - ❌ `src/components/property/PropertyTabs.tsx` : **CORRIGÉ** (remplacé par `<button>`)
   - ⚠️ `src/app/app/views/property/tabs/PropertyLoansClient.tsx` ligne 25 : Import `Link` mais **NON UTILISÉ** (faux positif)
   - ⚠️ `src/app/app/views/property/tabs/PropertyEcheancesClient.tsx` ligne 36 : Import `Link` mais **NON UTILISÉ** (faux positif)

2. **`router.push/replace/prefetch` :**
   - ❌ `src/components/property/PropertySwitcher.tsx` ligne 140 : `router.push()` **MAIS N'EST PAS UTILISÉ** pour les onglets (utilisé uniquement pour la navigation PropertySwitcher → property view)
   - ✅ Aucun `router.push/replace` dans les composants d'onglets

3. **Server Components :**
   - ✅ `src/app/app/page.tsx` : **100% client-side** (`'use client'` ligne 1)
   - ✅ Aucun Server Component ne lit `searchParams` pour le `tab`

### B. Composants SERVER dépendant du paramètre tab

**Résultat :** ✅ **AUCUN**

- `src/app/app/page.tsx` est un Client Component
- Aucun `layout.tsx` ou `page.tsx` dans `/app` ne lit `searchParams.tab` côté serveur

### C. Guards / Offline Gating

**Résultats :**

1. **Écran "Vous êtes hors connexion" :**
   - `src/components/offline/LocalDbUnavailableScreen.tsx` : Affiché si `dbStatus === 'UNAVAILABLE'`
   - Condition : `src/app/app/AppShellClient.tsx` lignes 663-664 et 668-669
   - ✅ **Pas de fetch() dans les guards**
   - ✅ **Pas de Next navigation dans les guards**

### D. Data Layer

**Résultats :**

1. **Mode app-shell :**
   - ✅ `PropertyLeasesClient` : `mode: 'app-shell'` (ligne 168)
   - ✅ `PropertyDocumentsClient` : `mode: 'app-shell'` (ligne 115)
   - ✅ `PropertyEcheancesClient` : `mode: 'app-shell'` (ligne 128)
   - ✅ `PropertyLoansClient` : `mode: 'app-shell'` (ligne 95)

2. **Fetch API direct :**
   - ✅ Aucun `fetch('/api/...')` direct dans les composants d'onglets
   - ✅ Tous utilisent des hooks qui lisent depuis IndexedDB en mode app-shell

3. **React Query :**
   - ✅ Tous les hooks utilisent `mode: 'app-shell'` qui désactive les queries remote

### E. Effet "replaceState + useSearchParams"

**Résultat :** ❌ **PROBLÈME CONFIRMÉ**

**Le rendu DÉPEND ENCORE de `useSearchParams()` :**

1. `AppShellClient` ligne 611 : `const propertyTab = urlParams.get('tab')` dans `renderView` useMemo
2. `urlParams` ligne 296 : `useMemo(() => searchParams, [searchParams, urlChangeKey])`
3. `searchParams` ligne 58 : `useSearchParams()` (Next.js hook)
4. `renderView` ligne 659 : Dépend de `urlParams` dans les dépendances

**Problème :** Next.js `useSearchParams()` peut déclencher un fetch RSC même après `replaceState()`.

## 🔧 Solution Requise

### Refactor : State Local pour le Tab + URL Sync Passive

**Objectif :** Le `tab` doit être géré via un **state local** dans `PropertyDetailView`, et l'URL doit être synchronisée **passivement** (sans forcer Next.js à relire les searchParams pour le rendu).

**Changements :**

1. **`PropertyDetailView.tsx`** : Ajouter un state local `activeTab` initialisé depuis la prop `tab`
2. **`PropertyTabs.tsx`** : Au lieu d'utiliser `searchParams.get('tab')`, utiliser un callback `onTabChange`
3. **`AppShellClient.tsx`** : Retirer `urlParams.get('tab')` de `renderView`, passer le `tab` uniquement à l'init

## 📋 Plan de Correction

1. ✅ Créer un state local `activeTab` dans `PropertyDetailView`
2. ✅ Passer `onTabChange` callback à `PropertyTabs`
3. ✅ Retirer la dépendance de `urlParams.get('tab')` dans `renderView`
4. ✅ Synchroniser l'URL via `replaceState` sans déclencher de re-render via `useSearchParams()`
5. ✅ Supprimer l'événement `app-shell:url-change` (plus nécessaire)
