# Correction Appliquée : Navigation Onglets Offline-First

## ✅ Solution Implémentée

**Principe :** Le `tab` est géré via un **state local** dans `PropertyDetailView`, et l'URL est synchronisée **passivement** (sans forcer Next.js à relire les searchParams pour le rendu).

## 📋 Changements Appliqués

### 1. PropertyDetailView.tsx

**Fichier :** `src/app/app/views/PropertyDetailView.tsx`

**Changements :**
- ✅ Ajout d'un state local `activeTab` initialisé depuis la prop `tab`
- ✅ Ajout d'un callback `handleTabChange` qui :
  - Met à jour le state local `activeTab`
  - Synchronise l'URL via `history.replaceState()` (passif)
- ✅ Passage de `activeTab` et `onTabChange` à `PropertyHeader`

**Code clé :**
```typescript
const [activeTab, setActiveTab] = useState(() => normalizeAndValidateTab(tab));

const handleTabChange = useCallback((tabId: string) => {
  const normalizedTab = normalizeAndValidateTab(tabId);
  setActiveTab(normalizedTab);
  // Sync URL passive (sans déclencher de fetch RSC)
  const params = new URLSearchParams(window.location.search);
  params.set('view', 'property');
  params.set('propertyId', propertyId);
  params.set('tab', normalizedTab);
  window.history.replaceState({}, '', `/app?${params.toString()}`);
}, [propertyId]);
```

### 2. PropertyTabs.tsx

**Fichier :** `src/components/property/PropertyTabs.tsx`

**Changements :**
- ✅ Retiré `useSearchParams()` (plus besoin de lire l'URL pour le tab)
- ✅ Ajout de props `activeTab` et `onTabChange`
- ✅ Utilisation directe de `activeTab` prop (source de vérité)
- ✅ Appel de `onTabChange` callback au lieu de gérer l'URL directement

**Code clé :**
```typescript
interface PropertyTabsProps {
  propertyId: string;
  activeTab: string; // ✅ Prop au lieu de searchParams.get('tab')
  onTabChange: (tabId: string) => void; // ✅ Callback
}

export function PropertyTabs({ propertyId, activeTab: activeTabProp, onTabChange }: PropertyTabsProps) {
  const validActiveTab = activeTabProp; // ✅ Utiliser prop directement
  // ...
  const handleTabClick = (tabId: string) => {
    onTabChange(tabId); // ✅ Appeler callback parent
  };
}
```

### 3. PropertyHeader.tsx

**Fichier :** `src/app/biens/[id]/PropertyHeader.tsx`

**Changements :**
- ✅ Ajout de prop `onTabChange` optionnelle
- ✅ Passage de `activeTab` et `onTabChange` à `PropertyTabs`

**Code clé :**
```typescript
interface PropertyHeaderProps {
  // ...
  onTabChange?: (tabId: string) => void; // ✅ Callback (app-shell uniquement)
}

<MemoizedPropertyTabs 
  propertyId={propertyId}
  activeTab={activeTab || 'transactions'}
  onTabChange={onTabChange}
/>
```

### 4. AppShellClient.tsx

**Fichier :** `src/app/app/AppShellClient.tsx`

**Changements :**
- ✅ Retiré `urlChangeKey` et l'événement `app-shell:url-change` (plus nécessaire)
- ✅ `urlParams.get('tab')` reste uniquement pour l'initialisation (passé en prop à PropertyDetailView)
- ✅ Une fois PropertyDetailView monté, le state local prend le relais

**Note importante :** Le `tab` est encore lu depuis `urlParams.get('tab')` ligne 596, mais **uniquement pour l'initialisation** (passé en prop à PropertyDetailView). Une fois que PropertyDetailView est monté, le state local `activeTab` prend le relais et le rendu ne dépend plus de `urlParams.get('tab')`.

## 🎯 Résultat

**AVANT :**
- ❌ `PropertyTabs` utilisait `useSearchParams().get('tab')` → pouvait déclencher fetch RSC
- ❌ `AppShellClient.renderView` dépendait de `urlParams.get('tab')` → pouvait déclencher fetch RSC
- ❌ Événement `app-shell:url-change` + `urlChangeKey` → complexité inutile

**APRÈS :**
- ✅ `PropertyTabs` utilise `activeTab` prop directement (state local)
- ✅ `AppShellClient.renderView` lit `urlParams.get('tab')` uniquement pour l'init (pas pour le rendu dynamique)
- ✅ State local `activeTab` dans `PropertyDetailView` → source de vérité pour le rendu
- ✅ URL sync passive via `replaceState()` → pas de fetch RSC

## 🧪 Test Plan

1. Ouvrir DevTools → Network → Cocher "Offline"
2. Naviguer vers `/app?view=property&propertyId=xxx&tab=transactions`
3. Cliquer sur un autre onglet (ex: "Baux", "Échéances", "Documents", "Prêts")
4. **Vérifier :**
   - ✅ L'URL change : `?tab=lease` (ou autre)
   - ✅ Le contenu de l'onglet change immédiatement
   - ✅ **Aucune requête réseau** (vérifier dans l'onglet Network)
   - ✅ **Aucune erreur RSC** dans la console (`Failed to fetch RSC payload`)
   - ✅ Pas d'écran "Vous êtes hors connexion"
   - ✅ Console ne montre pas `fetch-server-response`

## 📊 Flux de Navigation (Après Correction)

```
1. Clic onglet "Baux"
   ↓
2. PropertyTabs.handleTabClick('lease')
   ↓
3. PropertyDetailView.handleTabChange('lease')
   ↓
4. setActiveTab('lease') [State local]
   ↓
5. window.history.replaceState(..., '?tab=lease') [Sync URL passive]
   ↓
6. PropertyDetailView re-render avec activeTab='lease'
   ↓
7. renderTabContent useMemo recalcule → PropertyLeasesClient rendu
   ↓
✅ AUCUN fetch RSC (state local + URL sync passive)
```
