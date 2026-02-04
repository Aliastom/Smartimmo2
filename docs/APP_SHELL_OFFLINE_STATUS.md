# 📱 App Shell Offline - État d'avancement

## ✅ Ce qui a été fait

### 1. Route `/app` créée

- ✅ `src/app/app/page.tsx` - Page App Shell avec Suspense
- ✅ `src/app/app/AppShellClient.tsx` - App Shell avec navigation interne
- ✅ `src/app/app/views/BiensView.tsx` - Vue Biens (structure créée)

### 2. Middleware

- ✅ Déjà adapté avec `try/catch` qui laisse passer en cas d'erreur réseau/offline

### 3. Configuration PWA

- ✅ Déjà configuré avec `NetworkFirst` pour les navigations HTML

## ⚠️ Problème identifié

`BiensClient` utilise `useRouter()` et `useSearchParams()` qui nécessitent le routing Next.js. Dans l'App Shell, ces hooks ne fonctionneront pas correctement car il n'y a pas de routing Next.js.

## 🔧 Solutions à implémenter

### Option 1 : Créer un contexte Router mock

Créer un contexte qui fournit des valeurs mock pour `useRouter` et `useSearchParams` dans l'App Shell.

### Option 2 : Vue Biens simplifiée

Créer une vue Biens complètement indépendante qui charge directement depuis IndexedDB sans dépendre de `BiensClient`.

### Option 3 : Adapter BiensClient

Modifier `BiensClient` pour accepter des props optionnelles pour le routing (router et searchParams en props).

## 🎯 Prochaines étapes

1. Résoudre le problème du routing pour `BiensView`
2. Créer les autres vues (Dashboard, Locataires, Baux, etc.)
3. Tester en mode production (`npm run build && npm start`)
4. Vérifier que le service worker sert bien `/app` en offline

## 📝 Note

L'infrastructure de base est en place. Il reste à résoudre le problème du routing pour que les vues puissent réutiliser les composants clients existants ou créer des versions simplifiées.


