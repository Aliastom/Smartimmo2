# Correction Complète : Navigation Onglets Offline-First

## 🔴 Problème Identifié

**Racine du problème :** `AppShellClient` lit le `tab` depuis `useSearchParams()` dans `renderView` useMemo (ligne 611), ce qui peut déclencher un fetch RSC même après `replaceState()`.

**Fichier :** `src/app/app/AppShellClient.tsx`  
**Ligne :** 611  
**Code problématique :**
```typescript
const propertyTab = urlParams.get('tab') || 'transactions';
```

**Mécanisme :** `useSearchParams()` de Next.js peut interpréter le changement d'URL (même via `replaceState`) comme une navigation et tenter de précharger la route en RSC.

## ✅ Solution : State Local + URL Sync Passive

**Principe :** Le `tab` doit être géré via un **state local** dans `PropertyDetailView`, et l'URL doit être synchronisée **passivement** (sans forcer Next.js à relire les searchParams pour le rendu).

### Changements Requis

1. **`PropertyDetailView.tsx`** : Ajouter un state local `activeTab` initialisé depuis la prop `tab`
2. **`PropertyTabs.tsx`** : Ajouter un prop `onTabChange` callback et utiliser `activeTab` prop au lieu de `searchParams.get('tab')`
3. **`PropertyHeader.tsx`** : Passer `onTabChange` et `activeTab` à `PropertyTabs`
4. **`AppShellClient.tsx`** : Le `tab` reste dans l'URL mais n'est plus lu depuis `urlParams` pour le rendu (uniquement passé en prop initiale)

## 📋 Plan d'Implémentation

### Étape 1 : PropertyDetailView - State Local

```typescript
// PropertyDetailView.tsx
const [activeTab, setActiveTab] = useState(() => {
  // Initialiser depuis la prop tab (depuis l'URL initiale)
  let normalizedTab = tab;
  if (tab === 'echeances') normalizedTab = 'deadlines';
  if (tab === 'baux') normalizedTab = 'lease';
  const validTabs = ['transactions', 'documents', 'deadlines', 'lease', 'loans'];
  return validTabs.includes(normalizedTab) ? normalizedTab : 'transactions';
});

const handleTabChange = useCallback((tabId: string) => {
  setActiveTab(tabId);
  // Synchroniser l'URL (passif, sans déclencher de fetch RSC)
  const params = new URLSearchParams(window.location.search);
  params.set('view', 'property');
  params.set('propertyId', propertyId);
  params.set('tab', tabId);
  window.history.replaceState({}, '', `/app?${params.toString()}`);
}, [propertyId]);
```

### Étape 2 : PropertyTabs - Callback + Prop activeTab

```typescript
// PropertyTabs.tsx
interface PropertyTabsProps {
  propertyId: string;
  activeTab: string; // ✅ Prop au lieu de searchParams
  onTabChange: (tabId: string) => void; // ✅ Callback
}

// Retirer useSearchParams() pour le tab actif
// Utiliser activeTab prop directement
```

### Étape 3 : PropertyHeader - Passer Props

```typescript
// PropertyHeader.tsx
<MemoizedPropertyTabs 
  propertyId={propertyId}
  activeTab={activeTab}
  onTabChange={onTabChange}
/>
```

### Étape 4 : AppShellClient - Retirer urlParams.get('tab')

```typescript
// AppShellClient.tsx
// Dans renderView, ligne 611 :
// ❌ AVANT :
const propertyTab = urlParams.get('tab') || 'transactions';

// ✅ APRÈS :
const propertyTab = urlParams.get('tab') || 'transactions'; // Uniquement pour l'init
// Le tab sera géré par le state local dans PropertyDetailView
```

## 🧪 Test Plan

1. Ouvrir DevTools → Network → Cocher "Offline"
2. Naviguer vers `/app?view=property&propertyId=xxx&tab=transactions`
3. Cliquer sur un autre onglet (ex: "Baux")
4. **Vérifier :**
   - ✅ L'URL change : `?tab=lease`
   - ✅ Le contenu de l'onglet change immédiatement
   - ✅ **Aucune requête réseau** (vérifier dans l'onglet Network)
   - ✅ **Aucune erreur RSC** dans la console (`Failed to fetch RSC payload`)
   - ✅ Pas d'écran "Vous êtes hors connexion"
   - ✅ Console ne montre pas `fetch-server-response`
