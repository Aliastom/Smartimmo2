# 📱 Solution App Shell Offline - Implémentation

## Objectif

Créer une route `/app` qui fonctionne **100% offline** comme une SPA client-side, sans dépendre des Server Components de Next.js.

## Structure créée

```
/app
  ├── page.tsx (App Shell 100% client avec Suspense)
  └── AppShellClient.tsx (App Shell avec navigation interne)
      └── views/
          └── BiensView.tsx (Vue Biens qui charge depuis IndexedDB)
```

## Fonctionnement

### 1. App Shell (`/app/page.tsx`)

- Composant 100% client (`'use client'`)
- Wrappe `AppShellClient` avec `Suspense`
- Aucun fetch serveur, aucune logique serveur

### 2. App Shell Client (`AppShellClient.tsx`)

- Navigation interne par état React (pas de routing Next.js)
- Sidebar simplifiée avec boutons (pas de `Link`)
- Changement de vue via `setCurrentView`
- Charge les données depuis IndexedDB uniquement

### 3. Vue Biens (`views/BiensView.tsx`)

- Utilise `BiensClient` avec des données vides initiales
- `BiensClient` détecte automatiquement le mode offline et charge depuis IndexedDB
- Wrappé dans `Suspense` pour gérer `useSearchParams()`

### 4. Middleware

- ✅ Déjà adapté avec `try/catch` qui laisse passer en cas d'erreur réseau/offline
- Retourne `NextResponse.next()` en cas d'erreur pour permettre le chargement offline

### 5. Service Worker

- Configuration `NetworkFirst` avec timeout de 3 secondes
- Sert le HTML depuis le cache si le réseau échoue

## Prochaines étapes

1. ✅ Créer `/app/page.tsx` (App Shell)
2. ✅ Créer `AppShellClient.tsx` avec navigation interne
3. ✅ Créer `views/BiensView.tsx`
4. ⏳ Créer les autres vues (Dashboard, Locataires, Baux, etc.)
5. ⏳ Tester en mode production (`npm run build && npm start`)
6. ⏳ Vérifier que le service worker sert bien `/app` en offline

## Notes importantes

- L'App Shell fonctionne complètement offline car tout est client-side
- Les vues chargent depuis IndexedDB via les repositories offline-first
- La navigation est interne (pas de routing Next.js)
- Le middleware laisse passer en cas d'erreur réseau pour permettre le mode offline


