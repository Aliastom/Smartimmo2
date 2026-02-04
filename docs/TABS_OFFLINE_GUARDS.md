# Protections Anti-Régression : Navigation Onglets Property Offline

## 🔒 Protections Ajoutées

### 1. Guard Runtime DEV : Détection des <Link> Next.js

**Fichier :** `src/lib/dev/tabsOfflineGuard.ts`

**Fonction :** Détecte les `<Link>` Next.js rendus dans PropertyTabs en mode app-shell ou offline via MutationObserver.

**Activation :** Automatique en DEV quand :
- Mode app-shell (`/app?view=property`)
- OU mode offline (`navigator.onLine === false`)

**Comportement :** Log une erreur dans la console si un `<Link>` est détecté.

**Utilisation :**
```typescript
// L'observer démarre automatiquement en DEV
// Pour contrôler manuellement :
(window as any).__tabsOfflineGuard.start(); // Démarrer
(window as any).__tabsOfflineGuard.stop();  // Arrêter
(window as any).__tabsOfflineGuard.isActive(); // Vérifier l'état
```

**Import :** Ajouter dans `src/app/app/page.tsx` ou `src/app/app/AppShellClient.tsx` :
```typescript
if (process.env.NODE_ENV === 'development') {
  import('@/lib/dev/tabsOfflineGuard');
}
```

### 2. Guards Statiques dans le Code

**Fichiers :**
- `src/components/property/PropertyTabs.tsx` : Commentaire de vérification statique
- `src/app/app/views/PropertyDetailView.tsx` : Commentaire de vérification statique

**Fonction :** Rappels dans le code pour vérifier manuellement qu'on n'utilise pas :
- `<Link>` de Next.js
- `useRouter()` / `router.push/replace/refresh`

**Action :** Vérification manuelle lors des code reviews.

### 3. Test E2E Playwright

**Fichier :** `tests/e2e/property-tabs-offline.spec.ts`

**Tests :**
1. `changement d'onglet en offline ne déclenche pas de requêtes réseau`
2. `changement d'onglet en offline ne génère pas d'erreurs console`
3. `changement d'onglet en offline change le contenu correctement`
4. `navigation initiale en offline fonctionne`

**Configuration :**
- Remplacez `TEST_PROPERTY_ID = 'xxx'` par un propertyId valide de votre base de test
- Configurez `PLAYWRIGHT_TEST_BASE_URL` si nécessaire (défaut: `http://localhost:3000`)

**Exécution :**
```bash
npx playwright test tests/e2e/property-tabs-offline.spec.ts
```

## 📋 Checklist de Protection

### Avant chaque commit/PR

- [ ] Vérifier qu'aucun `<Link>` n'est importé/utilisé dans `PropertyTabs.tsx`
- [ ] Vérifier qu'aucun `useRouter()` / `router.push/replace/refresh` n'est utilisé dans `PropertyDetailView.tsx`
- [ ] Vérifier que `handleTabChange` utilise uniquement `window.history.replaceState()`
- [ ] Exécuter les tests E2E en offline
- [ ] Vérifier la console DEV (aucune erreur `[TabsOfflineGuard]` ou `[PropertyTabsGuard]`)

### Code Review

- [ ] Rejeter toute PR qui ajoute `<Link>` dans `PropertyTabs.tsx`
- [ ] Rejeter toute PR qui ajoute `router.push/replace/refresh` dans `PropertyDetailView.tsx`
- [ ] Vérifier que les tests E2E passent

## 🛠️ Intégration

### Option 1 : Guard Global (Recommandé)

Ajouter dans `src/app/app/AppShellClient.tsx` ou `src/app/app/page.tsx` :

```typescript
// Au début du fichier (après les imports)
if (process.env.NODE_ENV === 'development') {
  import('@/lib/dev/tabsOfflineGuard');
}
```

### Option 2 : Guard Composant (Alternative)

Utiliser `PropertyTabsGuard` au lieu de `PropertyTabs` dans `PropertyHeader.tsx` :

```typescript
import { PropertyTabsGuard } from '@/components/property/PropertyTabs.guard';

// Dans PropertyHeader :
<PropertyTabsGuard 
  propertyId={propertyId}
  activeTab={activeTab || 'transactions'}
  onTabChange={onTabChange}
/>
```

**Note :** L'option 1 (guard global) est recommandée car elle protège automatiquement tout le code.

## 📊 Exemple de Log d'Erreur

Si un `<Link>` est détecté, vous verrez :

```
[TabsOfflineGuard] ❌ <Link> Next.js détecté dans PropertyTabs en mode app-shell/offline !
  <a href="/app?view=property&propertyId=...&tab=lease" data-nextjs-link>
    ...
  </a>
[TabsOfflineGuard] Stack trace:
  Error
    at MutationObserver.tabsOfflineGuard.ts:XX
    ...
```

## ⚠️ Limitations

1. **Guard Runtime :** Ne peut pas intercepter `router.push/replace/refresh` directement (car `useRouter()` est un hook). La vérification doit être faite manuellement.

2. **Test E2E :** Nécessite un `propertyId` valide dans la base de test. Configurez-le avant d'exécuter.

3. **MutationObserver :** Peut avoir un léger impact sur les performances en DEV. C'est acceptable car c'est DEV-only.
