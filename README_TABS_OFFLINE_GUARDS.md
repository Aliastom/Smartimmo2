# Protections Anti-Régression : Onglets Property Offline

## 📋 Résumé

Des protections ont été ajoutées pour empêcher toute régression qui réintroduirait des navigations Next.js (RSC) lors du changement d'onglet property en mode offline.

## 🔒 Protections Ajoutées

### 1. Guard Runtime DEV (Recommandé)

**Fichier :** `src/lib/dev/tabsOfflineGuard.ts`

Détecte automatiquement les `<Link>` Next.js rendus dans PropertyTabs via MutationObserver.

**Activation automatique en DEV quand :**
- Mode app-shell (`/app?view=property`)
- OU mode offline (`navigator.onLine === false`)

**Déjà intégré dans :** `src/app/app/AppShellClient.tsx`

### 2. Guards Statiques

**Fichiers :**
- `src/components/property/PropertyTabs.tsx`
- `src/app/app/views/PropertyDetailView.tsx`

Commentaires de vérification statique dans le code pour rappeler qu'on ne doit pas utiliser :
- `<Link>` de Next.js
- `useRouter()` / `router.push/replace/refresh`

### 3. Test E2E Playwright

**Fichier :** `tests/e2e/property-tabs-offline.spec.ts`

4 tests qui vérifient :
- Aucune requête réseau lors du changement d'onglet
- Aucune erreur console
- Le contenu change correctement
- La navigation initiale fonctionne

## 🚀 Utilisation

### Guard Runtime

Le guard est déjà activé automatiquement en DEV. Aucune action nécessaire.

Si vous voulez le contrôler manuellement :
```typescript
// Dans la console du navigateur (DEV uniquement)
window.__tabsOfflineGuard.start();   // Démarrer
window.__tabsOfflineGuard.stop();    // Arrêter
window.__tabsOfflineGuard.isActive(); // Vérifier l'état
```

### Tests E2E

**Prérequis :**
1. Installer Playwright si nécessaire : `npx playwright install`
2. Configurer `TEST_PROPERTY_ID` dans `tests/e2e/property-tabs-offline.spec.ts` (remplacer `'xxx'` par un ID valide)

**Exécution :**
```bash
# Tous les tests
npx playwright test tests/e2e/property-tabs-offline.spec.ts

# Un test spécifique
npx playwright test tests/e2e/property-tabs-offline.spec.ts -g "changement d'onglet en offline ne déclenche pas"
```

## ⚠️ Checklist de Protection

### Avant chaque commit/PR

- [ ] Vérifier qu'aucun `<Link>` n'est importé/utilisé dans `PropertyTabs.tsx`
- [ ] Vérifier qu'aucun `useRouter()` / `router.push/replace/refresh` n'est utilisé dans `PropertyDetailView.tsx`
- [ ] Vérifier que `handleTabChange` utilise uniquement `window.history.replaceState()`
- [ ] Exécuter les tests E2E en offline
- [ ] Vérifier la console DEV (aucune erreur `[TabsOfflineGuard]`)

### Code Review

- [ ] Rejeter toute PR qui ajoute `<Link>` dans `PropertyTabs.tsx`
- [ ] Rejeter toute PR qui ajoute `router.push/replace/refresh` dans `PropertyDetailView.tsx`
- [ ] Vérifier que les tests E2E passent

## 📊 Exemple de Log d'Erreur

Si un `<Link>` est détecté, vous verrez dans la console :

```
[TabsOfflineGuard] ❌ <Link> Next.js détecté dans PropertyTabs en mode app-shell/offline !
  <a href="/app?view=property&propertyId=...&tab=lease" data-nextjs-link>
    ...
  </a>
[TabsOfflineGuard] Stack trace:
  Error
    at MutationObserver...
```

## 🔍 Détails Techniques

Voir `docs/TABS_OFFLINE_GUARDS.md` pour plus de détails.
