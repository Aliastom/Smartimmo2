# Audit Complet du Comportement Offline-First (App Shell PWA)

**Date :** 16 février 2025  
**Objectif :** Identifier pourquoi certaines pages ne fonctionnent pas offline alors que prêts et échéances fonctionnent correctement.

---

## 1. Tableau Comparatif Page par Page

| Page | URL App Shell | Statut Offline | Cause probable |
|------|---------------|----------------|----------------|
| Dashboard | `/app` ou `/app?view=dashboard` | ✅ OK | Hook `useDashboardData` IDB-only, imports statiques |
| Patrimoine | `/app?view=patrimoine` | ✅ OK | `usePatrimoineData` IDB, `usePropertiesData` IDB |
| Biens | `/app?view=biens` | ✅ OK | `PropertiesPageCore` → `usePropertiesData` IDB, imports statiques |
| Détail bien | `/app?view=property&propertyId=xxx` | ⚠️ Partiel | Transactions tab → **TransactionModal dynamic** = ChunkLoadError au clic "Ajouter" |
| Locataires | `/app?view=locataires` | ✅ OK | `useTenantsData` IDB, imports statiques |
| Transactions | `/app?view=transactions` | ❌ Ne fonctionne pas | **TransactionModal + DuplicateDetectedModal** en `dynamic()` → ChunkLoadError |
| Documents | `/app?view=documents` | ❌ Ne fonctionne pas | **DocumentEditModal, DocumentDrawer, ConfirmDeleteDocumentModal** en `dynamic()` → ChunkLoadError |
| Échéances | `/app?view=echeances` | ✅ OK (référence) | Imports statiques, `useEcheancesData` IDB |
| Prêts | `/app?view=loans` | ✅ OK (référence) | Imports statiques, `useLoansData` IDB |
| Simulation fiscale | `/app?view=fiscal` | ❌ Ne fonctionne pas | **6 onglets en dynamic()** (SimulationTab, SyntheseTab, etc.) → ChunkLoadError au changement d’onglet |
| Paramètres | `/app?view=parametres` | ⚠️ Partiel | Liens vers `/parametres/preferences` (routes normales) → pas en cache si jamais visitées |
| Administration | `/app?view=admin` | ⚠️ Partiel | Carte "Prisma Studio" fait fetch `/api/admin/database/studio` ; modules admin font fetch |
| Sync | `/app?view=sync` | ✅ OK | Pas de dynamic import critique, données IDB |

---

## 2. Causes Identifiées

### 2.1. Chunks non précachés (dynamic imports) — cause principale

**Référence (prêts/échéances) :** Imports statiques pour tous les modals et drawers.

```tsx
// LoansPageCore.tsx - STATIQUE
import { LoanModalV2 } from '@/components/loans/LoanModalV2';
import { LoanDrawer } from '@/components/loans/LoanDrawer';
import { ConfirmDeleteLoanModal } from '@/components/loans/ConfirmDeleteLoanModal';
```

**Problème (transactions, documents, fiscal) :** Imports dynamiques.

```tsx
// TransactionsPageCore.tsx - DYNAMIQUE (échoue offline)
const TransactionModal = dynamic(
  () => import('@/components/transactions/TransactionModalV2').then(mod => ({ default: mod.TransactionModal })),
  { ssr: false }
);
const DuplicateDetectedModal = dynamic(
  () => import('@/components/documents/DuplicateDetectedModal')...
);
```

Les chunks générés par `dynamic()` ne sont **pas** dans le precache du Service Worker. Lors d’une ouverture offline, le chargement échoue avec `ChunkLoadError`.

### 2.2. Service Worker / navigateFallback

- **Fallback actuel :** `fallbacks.document: '/offline.html'` dans `next.config.mjs`.
- **Comportement :** `NetworkFirst` pour les navigations, avec `ignoreSearch: true` sur le cache html-pages.
- **Résultat :** `/app?view=xxx` matche bien le cache de `/app` si la page a déjà été visitée une fois en ligne.
- Pas de `navigateFallback` explicite vers `/app`. Si `/app` n’a jamais été visitée, le fallback est `/offline.html`.

### 2.3. Hooks de gestion déléguée (useGestionDelegueStatus, useGestionCodes)

- En premier : lecture dans `localStorage`.
- Si valeur en localStorage → pas de fetch bloquant.
- Si pas de valeur → `fetch('/api/settings?prefix=...')` au montage.

En offline sans valeur en cache : le fetch échoue, mais les hooks ont un fallback (`false` / `null`).  
Impact limité : risque de comportement dégradé (gestion déléguée désactivée), pas de crash.

### 2.4. useAppSession et /api/auth/me

- `useAppSession` appelle `fetch('/api/auth/me')` via React Query.
- En offline : échec du fetch, mais `useAppSession` a un fallback `localStorage` pour `organizationId`.
- `useAppAuth` : en offline, utilise uniquement `localStorage` (localUser).
- Pas de blocage si `localUser` et `organizationId` sont déjà en localStorage.

### 2.5. Routes avec query params

- SW : `matchOptions: { ignoreSearch: true }` pour html-pages.
- Une seule entrée `/app` en cache sert toutes les URLs du type `/app?view=xxx`.
- Pas de problème de routing lié aux query params.

---

## 3. Corrections Techniques Proposées

### 3.1. Remplacer les dynamic imports par des imports statiques (priorité haute)

**TransactionsPageCore.tsx :**

```diff
- const TransactionModal = dynamic(
-   () => import('@/components/transactions/TransactionModalV2').then(mod => ({ default: mod.TransactionModal })),
-   { loading: () => <div>...</div>, ssr: false }
- );
- const DuplicateDetectedModal = dynamic(
-   () => import('@/components/documents/DuplicateDetectedModal')...
- );
+ import { TransactionModal } from '@/components/transactions/TransactionModalV2';
+ import { ConfirmDeleteTransactionModal } from '@/components/transactions/ConfirmDeleteTransactionModal';
+ import { ConfirmDeleteMultipleTransactionsModal } from '@/components/transactions/ConfirmDeleteMultipleTransactionsModal';
+ import { DuplicateDetectedModal } from '@/components/documents/DuplicateDetectedModal';
```

**DocumentsPageCore.tsx :**

```diff
- const DocumentEditModal = dynamic(() => import('...'));
- const DocumentDrawer = dynamic(() => import('...'));
- const ConfirmDeleteDocumentModal = dynamic(() => import('...'));
+ import { DocumentEditModal } from '@/components/documents/unified/DocumentEditModal';
+ import DocumentDrawer from '@/components/documents/DocumentDrawer';
+ import { ConfirmDeleteDocumentModal } from '@/components/documents/ConfirmDeleteDocumentModal';
```

**FiscalPageCore.tsx :**

Remplacer les `dynamic()` des onglets par des imports statiques :

```diff
- const SimulationTab = dynamic(() => import('@/components/fiscal/unified/tabs/SimulationTab'), {...});
- const SyntheseTab = dynamic(() => import('@/components/fiscal/results/tabs/SyntheseTab')...);
+ import SimulationTab from '@/components/fiscal/unified/tabs/SimulationTab';
+ import SyntheseTab from '@/components/fiscal/results/tabs/SyntheseTab';
+ // etc. pour DetailsTab, DeclarationTab, ProjectionsTab, OptimisationsTab
```

Impact : légère augmentation du bundle initial, mais fonctionnement offline garanti.

### 3.2. Option alternative : precache des chunks dynamiques

Si le bundle devient trop lourd, ajouter les chunks des modals au precache next-pwa :

```js
// next.config.mjs - pwaConfig
additionalManifestEntries: [
  { url: '/offline.html', revision: null },
  // Ajouter les chunks des modals (à adapter selon le build)
  // { url: '/_next/static/chunks/...TransactionModalV2...', revision: '...' },
],
```

Problème : les noms de chunks changent à chaque build.  
Recommandation : privilégier les imports statiques.

### 3.3. Préchargement explicite de /app

S’assurer que `/app` est mise en cache au premier chargement :

```ts
// Dans preloadPages.ts ou au boot App Shell
const APP_SHELL_PAGES = ['/app', '/app?view=dashboard', '/app?view=loans', '/app?view=echeances', ...];
```

Et inclure `/app` dans `IMPORTANT_PAGES` de `preloadPages.ts` pour qu’elle soit préchargée si l’utilisateur ouvre la page Sync.

### 3.4. navigateFallback vers /app

Dans `next.config.mjs` :

```js
// next-pwa - si la lib le supporte
fallbacks: {
  document: '/offline.html',
},
// Vérifier si next-pwa supporte navigateFallback
// navigateFallback: '/app',  // Rediriger les navigations ratées vers App Shell
```

À valider selon la doc de next-pwa.

### 3.5. useGestionDelegueStatus / useGestionCodes

Vérifier que les valeurs par défaut sont correctes en offline :

```ts
// useGestionDelegueStatus - si localStorage vide ET offline
if (!navigator.onLine && stored === null) {
  setIsEnabled(false); // Comportement par défaut
  setIsLoading(false);
  return;
}
```

Comportement déjà raisonnable, à ajuster si des cas limites apparaissent.

---

## 4. Résumé des Différences avec la Référence (Prêts/Échéances)

| Critère | Prêts / Échéances ✅ | Transactions / Documents / Fiscal ❌ |
|---------|----------------------|--------------------------------------|
| Modals | Imports statiques | `dynamic()` |
| Hooks données | IDB uniquement en app-shell | IDB uniquement (identique) |
| Chunks au montage | Tout dans le bundle principal | Chunks chargés à la demande |
| Précache SW | Chunk principal seulement | Chunks modaux absents du precache |

---

## 5. Plan d’Action Recommandé

1. **Court terme (bloquant offline) :**
   - Remplacer les `dynamic()` par des imports statiques dans :
     - `TransactionsPageCore.tsx`
     - `DocumentsPageCore.tsx`
     - `FiscalPageCore.tsx`

2. **Moyen terme :**
   - Ajouter `/app` au préchargement dans `preloadPages.ts`.
   - Mesurer l’impact sur le bundle après passage aux imports statiques.

3. **Vérifications :**
   - Paramètres : remplacer les liens `/parametres/preferences` par des vues app-shell (`/app?view=...`) si nécessaire.
   - Administration : rendre la carte Prisma Studio optionnelle ou la masquer en mode app-shell/offline.

---

## 6. Fichiers à Modifier

| Fichier | Modification |
|---------|--------------|
| `src/features/transactions/TransactionsPageCore.tsx` | Remplacer dynamic par imports statiques |
| `src/features/documents/DocumentsPageCore.tsx` | Remplacer dynamic par imports statiques |
| `src/features/fiscal/FiscalPageCore.tsx` | Remplacer dynamic par imports statiques |
| `src/lib/offline/preloadPages.ts` | Ajouter `/app` à IMPORTANT_PAGES |
| `next.config.mjs` | Vérifier options navigateFallback (si supporté) |
