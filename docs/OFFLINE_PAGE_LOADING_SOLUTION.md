# Solution pour le chargement des pages en mode offline

## Problème identifié

Lorsqu'on navigue vers une page (ex: `/biens`) en mode offline dans la PWA, le navigateur affiche "Vous êtes hors connexion" au lieu de charger la page depuis le cache.

### Causes

1. **Next.js App Router tente le rendu serveur** : Même si le service worker sert le HTML depuis le cache, Next.js essaie de faire le rendu serveur pour les Server Components, ce qui échoue en mode offline.

2. **Le middleware bloque les requêtes** : Si l'authentification échoue (ce qui peut arriver en mode offline), le middleware redirige vers `/login`.

3. **Le service worker ne peut pas vraiment intercepter avant Next.js** : Le service worker peut servir le HTML, mais Next.js essaie quand même de se connecter au serveur pour le rendu serveur.

## Solutions appliquées

### 1. Modification de la stratégie du service worker

Modifié `next.config.mjs` pour utiliser `CacheFirst` au lieu de `StaleWhileRevalidate` pour les pages HTML. Cela garantit que le cache est servi en premier, même en mode offline.

### 2. Gestion des erreurs dans les Server Components

Les pages Server Components (comme `src/app/biens/page.tsx`) gèrent maintenant les erreurs d'authentification et retournent des données vides, permettant au composant client de charger depuis IndexedDB.

### 3. Chargement automatique depuis IndexedDB

Le composant client `BiensClient.tsx` détecte automatiquement le mode offline et charge les données depuis IndexedDB si les données initiales du serveur sont vides ou si on est hors ligne.

## Test à effectuer

1. **Synchroniser complètement** dans la PWA pour précharger les pages HTML et les données
2. **Mettre en mode offline** (DevTools → Network → Offline)
3. **Naviguer vers `/biens`**
4. La page devrait se charger depuis le cache et afficher les données depuis IndexedDB

## Notes importantes

- Le problème peut persister si "Disable cache" est activé dans les DevTools
- Les pages doivent être préchargées lors de la synchronisation complète
- Le service worker doit être actif et enregistré


