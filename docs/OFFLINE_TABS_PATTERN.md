# Pattern Offline-First pour les Onglets (Tabs)

## Problème identifié

En mode offline, certains onglets déclenchaient des navigations RSC (React Server Components) via Next.js `Link`, causant :
- `Failed to fetch RSC payload`
- `fetch-server-response`
- `Falling back to browser navigation`
- Affichage de l'écran "Vous êtes hors connexion" au lieu du contenu local

## Solution : Navigation Client-Side Pure

### ✅ Pattern Recommandé

**1. Utiliser des boutons (`<button>`) au lieu de `<Link>` Next.js**

```tsx
// ❌ MAUVAIS (déclenche navigation RSC)
<Link href={`/app?view=property&propertyId=${id}&tab=${tabId}`}>
  {label}
</Link>

// ✅ BON (navigation client-side pure)
<button
  onClick={() => handleTabChange(tabId)}
  type="button"
>
  {label}
</button>
```

**2. Mettre à jour l'URL via `history.replaceState`**

```tsx
const handleTabChange = (tabId: string) => {
  const params = new URLSearchParams(searchParams.toString());
  params.set('view', 'property');
  params.set('propertyId', propertyId);
  params.set('tab', tabId);
  const newUrl = `/app?${params.toString()}`;
  
  // ✅ Utiliser replaceState (pas pushState) pour éviter de polluer l'historique
  window.history.replaceState(
    { view: 'property', propertyId, tab: tabId }, 
    '', 
    newUrl
  );
  
  // ⚠️ IMPORTANT: Next.js useSearchParams() ne réagit PAS automatiquement à replaceState
  // Il faut forcer une mise à jour (voir section suivante)
};
```

**3. Forcer la mise à jour de `useSearchParams()`**

Next.js `useSearchParams()` ne réagit pas automatiquement à `history.replaceState()`. Solutions :

**Option A : Utiliser un événement personnalisé (recommandé)**

```tsx
// Dans le composant qui gère les onglets
window.dispatchEvent(new CustomEvent('app-shell:url-change', { 
  detail: { url: newUrl } 
}));

// Dans AppShellClient ou un composant parent
useEffect(() => {
  const handleUrlChange = () => {
    // Forcer un re-render en changeant un state
    setForceUpdate(prev => prev + 1);
  };
  
  window.addEventListener('app-shell:url-change', handleUrlChange);
  return () => window.removeEventListener('app-shell:url-change', handleUrlChange);
}, []);
```

**Option B : Utiliser un state local pour l'onglet actif**

```tsx
const [activeTab, setActiveTab] = useState(() => {
  // Initialiser depuis l'URL
  return searchParams.get('tab') || 'transactions';
});

const handleTabChange = (tabId: string) => {
  // Mettre à jour le state local (réactif immédiatement)
  setActiveTab(tabId);
  
  // Mettre à jour l'URL (pour la persistance et le partage)
  const params = new URLSearchParams(searchParams.toString());
  params.set('tab', tabId);
  window.history.replaceState({}, '', `/app?${params.toString()}`);
};
```

### ✅ Exemple Complet : PropertyTabs

Voir `src/components/property/PropertyTabs.tsx` pour l'implémentation complète.

### ⚠️ Points de Contrôle à Auditer

**1. Vérifier que les composants d'onglets sont 100% client-side**

```tsx
// ✅ BON : 'use client' en haut du fichier
'use client';

export function MyTabComponent() {
  // ...
}
```

**2. Vérifier qu'aucun `Link` Next.js n'est utilisé pour la navigation entre onglets**

```bash
# Rechercher les Link dans les composants d'onglets
grep -r "from 'next/link'" src/app/app/views/property/tabs/
grep -r "<Link" src/app/app/views/property/tabs/
```

**3. Vérifier qu'aucun `router.push` / `router.replace` n'est utilisé**

```bash
grep -r "router\.(push|replace)" src/app/app/views/property/tabs/
```

**4. Vérifier que les hooks de données ne font pas de fetch remote en offline**

```tsx
// ✅ BON : Hook qui lit uniquement depuis IndexedDB en mode app-shell
const { data } = useMyData({
  mode: 'app-shell', // ✅ Force l'utilisation d'IndexedDB
  propertyId,
});

// ❌ MAUVAIS : Hook qui fait toujours un fetch
const { data } = useQuery({
  queryKey: ['myData', propertyId],
  queryFn: () => fetch('/api/myData').then(r => r.json()), // ❌ Échoue en offline
});
```

**5. Vérifier que les composants d'onglets n'utilisent pas de Server Components**

```tsx
// ❌ MAUVAIS : Server Component (pas de 'use client')
export async function MyTabComponent() {
  const data = await fetch(...); // ❌ Échoue en offline
  return <div>{data}</div>;
}

// ✅ BON : Client Component
'use client';
export function MyTabComponent() {
  const { data } = useMyData({ mode: 'app-shell' }); // ✅ Lit depuis IndexedDB
  return <div>{data}</div>;
}
```

### ❌ Erreurs à Ne Plus Reproduire

1. **Utiliser `<Link>` Next.js pour la navigation entre onglets**
   - ❌ Déclenche des navigations RSC
   - ✅ Utiliser des boutons avec `history.replaceState`

2. **Utiliser `router.push()` / `router.replace()` pour changer d'onglet**
   - ❌ Déclenche des navigations RSC
   - ✅ Utiliser `history.replaceState` directement

3. **Faire des fetch API dans les composants d'onglets**
   - ❌ Échoue en offline
   - ✅ Utiliser des hooks qui lisent depuis IndexedDB en mode app-shell

4. **Utiliser des Server Components pour les onglets**
   - ❌ Nécessite une connexion serveur
   - ✅ Utiliser uniquement des Client Components (`'use client'`)

5. **Dépendre de `useSearchParams()` pour réagir immédiatement aux changements d'onglet**
   - ❌ `useSearchParams()` ne réagit pas à `replaceState`
   - ✅ Utiliser un state local + synchroniser avec l'URL

### 📋 Checklist de Vérification

Avant de créer un nouvel onglet, vérifier :

- [ ] Le composant a `'use client'` en haut
- [ ] Aucun `Link` Next.js n'est utilisé pour la navigation entre onglets
- [ ] Aucun `router.push` / `router.replace` n'est utilisé
- [ ] Les hooks de données utilisent `mode: 'app-shell'` et lisent depuis IndexedDB
- [ ] Aucun fetch API direct n'est fait dans le composant
- [ ] La navigation utilise `history.replaceState` + événement personnalisé ou state local
- [ ] Le composant fonctionne en mode offline (tester avec DevTools → Network → Offline)

### 🔍 Exemple de Test

```tsx
// Test manuel en offline
1. Ouvrir DevTools → Network → Cocher "Offline"
2. Naviguer vers `/app?view=property&propertyId=xxx&tab=transactions`
3. Cliquer sur un autre onglet (ex: "Baux")
4. Vérifier :
   - ✅ L'URL change : `?tab=lease`
   - ✅ Le contenu de l'onglet change immédiatement
   - ✅ Aucune erreur dans la console
   - ✅ Aucun fetch réseau (vérifier dans l'onglet Network)
   - ✅ Pas d'écran "Vous êtes hors connexion"
```

## Références

- `src/components/property/PropertyTabs.tsx` : Implémentation de référence
- `src/app/app/views/PropertyDetailView.tsx` : Gestion des onglets
- `src/utils/appShellNavigation.ts` : Utilitaires de navigation app-shell
