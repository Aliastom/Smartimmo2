# PWA : mise à jour, caches et données locales

## Ce qui est conservé lors d’une mise à jour

- **IndexedDB** (données métier Smartimmo, offline-first) : **jamais** effacé par le flux « Mettre à jour » ni par « Recharger sans cache » dans le code livré ici.
- **localStorage / sessionStorage** : non touchés, sauf clés techniques déjà existantes (`smartimmo.chunk-reload-once`, etc.).

## Ce qui est purgé

### Bouton « Mettre à jour » (par défaut)

1. Message `SKIP_WAITING` au service worker Workbox (activation du nouveau SW).
2. Au rechargement : Workbox exécute `cleanupOutdatedCaches` (next-pwa) pour les entrées de precache obsolètes.
3. Pas de purge manuelle des `caches` API sauf si aucun SW en attente (alors purge des caches nommés Workbox applicatifs via `purgeSwCaches()` puis reload).

Caches concernés par `purgeSwCaches()` (noms contenant notamment) : `workbox`, `precache`, `next-static`, `api-requests`, `supabase-`, `rsc-pages`, `app-shell`, `icons`, `uploads`.

### Bouton « Recharger sans cache » (dernier recours)

1. Même purge `purgeSwCaches()` que ci-dessus.
2. **`navigator.serviceWorker.getRegistrations()` puis `unregister()`** sur tous les SW du scope (plus agressif : la PWA re-enregistre un SW au prochain chargement).
3. Rechargement avec paramètre `__swu` pour éviter une page entièrement figée dans le cache navigateur.

## Détection de nouvelle version

- **`/version.json`** : `commit`, `buildTime`, `deployEnv` — en-têtes **no-store** (route dynamique + `vercel.json`).
- **Comparaison** : commit Git du bundle (`NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA`) vs commit renvoyé par le serveur.
- **Service worker** : worker en état `waiting` après `registration.update()`.

## Fichiers sensibles au cache CDN

- **`/sw.js`** et **`/workbox-*.js`** : `Cache-Control: max-age=0, must-revalidate` via `next.config.mjs` pour forcer une revalidation après déploiement.

## Multi-onglets

- `BroadcastChannel('smartimmo-pwa-update')` : un onglet qui active une mise à jour peut inviter les autres à se recharger après changement de contrôleur (comportement navigateur + broadcast).
