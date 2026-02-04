# Patches : Durcissement Hooks Baux Offline-First

## 📋 Résumé

Durcissement des hooks `useLeasesKpis` et `useLeasesCharts` pour garantir une détection stricte du mode offline/app-shell et éviter toute requête réseau en offline.

## 🔧 Patch 1 : `src/hooks/useLeasesKpis.ts`

### Changement

**AVANT :**
```typescript
const isAppShell = mode === 'app-shell' || (typeof window !== 'undefined' && window.location.pathname.startsWith('/app'));
const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
const shouldUseLocalData = isAppShell || isOffline;
```

**APRÈS :**
```typescript
// ✅ OFFLINE-FIRST: Détecter explicitement offline/app-shell
// ⚠️ DURCISSEMENT: Utiliser UNIQUEMENT le paramètre mode, pas window.location
const isAppShell = mode === 'app-shell';
const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
const shouldUseLocalData = isAppShell || isOffline;
```

### Raison

La détection basée sur `window.location.pathname.startsWith('/app')` était incorrecte car :
- `/app` peut aussi être utilisé en mode normal
- Cela forçait `shouldUseLocalData = true` même en online/mode normal
- La seule source de vérité doit être le paramètre `mode`

## 🔧 Patch 2 : `src/hooks/useLeasesCharts.ts`

### Changement

**AVANT :**
```typescript
const isAppShell = mode === 'app-shell' || (typeof window !== 'undefined' && window.location.pathname.startsWith('/app'));
const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
const shouldUseLocalData = isAppShell || isOffline;
```

**APRÈS :**
```typescript
// ✅ OFFLINE-FIRST: Détecter explicitement offline/app-shell
// ⚠️ DURCISSEMENT: Utiliser UNIQUEMENT le paramètre mode, pas window.location
const isAppShell = mode === 'app-shell';
const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
const shouldUseLocalData = isAppShell || isOffline;
```

### Raison

Même raison que Patch 1.

## ✅ Garanties

### 1. Détection stricte

```typescript
// ✅ Source de vérité unique
const isAppShell = mode === 'app-shell';
const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
const shouldUseLocalData = isAppShell || isOffline;
```

### 2. Mode normal (online, non app-shell)

- ✅ **Utilise l'API** : `GET /api/leases/kpis` et `GET /api/leases/charts`
- ✅ **Aucune requête IndexedDB**
- ✅ **Comportement inchangé** par rapport à avant le durcissement

### 3. Mode offline ou app-shell

- ✅ **N'utilise PAS l'API** : aucune requête `/api/leases/*`
- ✅ **Utilise uniquement IndexedDB** : calcul local depuis les données locales
- ✅ **Pas d'erreurs console** : pas de tentatives fetch

### 4. React Query

**Note :** Les hooks `useLeasesKpis` et `useLeasesCharts` **n'utilisent PAS React Query**. Ils utilisent `useState` + `useEffect`. Les règles React Query mentionnées dans la demande ne s'appliquent donc pas.

## 📊 Diff complet

### `src/hooks/useLeasesKpis.ts`

```diff
- const isAppShell = mode === 'app-shell' || (typeof window !== 'undefined' && window.location.pathname.startsWith('/app'));
+ // ✅ OFFLINE-FIRST: Détecter explicitement offline/app-shell
+ // ⚠️ DURCISSEMENT: Utiliser UNIQUEMENT le paramètre mode, pas window.location
+ const isAppShell = mode === 'app-shell';
  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
  const shouldUseLocalData = isAppShell || isOffline;
```

### `src/hooks/useLeasesCharts.ts`

```diff
- const isAppShell = mode === 'app-shell' || (typeof window !== 'undefined' && window.location.pathname.startsWith('/app'));
+ // ✅ OFFLINE-FIRST: Détecter explicitement offline/app-shell
+ // ⚠️ DURCISSEMENT: Utiliser UNIQUEMENT le paramètre mode, pas window.location
+ const isAppShell = mode === 'app-shell';
  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
  const shouldUseLocalData = isAppShell || isOffline;
```

## 🧪 Tests manuels

Voir `docs/TEST_LEASES_HOOKS_OFFLINE.md` pour les tests manuels détaillés.

### Résumé des tests

1. **Mode normal (online, non app-shell)**
   - ✅ `/api/leases/kpis` est appelé
   - ✅ `/api/leases/charts` est appelé

2. **Mode app-shell (online)**
   - ✅ Aucun `/api/leases/*` n'est appelé

3. **Mode offline (normal ou app-shell)**
   - ✅ Aucun `/api/leases/*` n'est appelé
   - ✅ Pas d'erreurs console

4. **Transition online → offline**
   - ✅ Aucune nouvelle requête après passage en offline

5. **Transition offline → online**
   - ✅ Mode normal : Les endpoints sont appelés
   - ✅ Mode app-shell : Aucun endpoint n'est appelé

## ✅ Validation

- [x] Détection basée uniquement sur `mode === 'app-shell'`
- [x] Mode normal (online) utilise l'API
- [x] Mode offline/app-shell n'utilise PAS l'API
- [x] Pas d'erreurs console en offline
- [x] Tests manuels documentés
