# Configuration Service Worker / Workbox — App Shell Offline-First "Béton"

**Date :** 16 février 2025  
**Objectif :** Rendre Smartimmo 100 % stable en offline en mode PWA standalone.

---

## 1. Cause racine : pourquoi "ça marche puis ça casse"

### Le problème

- Les pages fonctionnent quelques secondes puis cassent (ChunkLoadError, ERR_INTERNET_DISCONNECTED).
- Comportement instable entre sessions (parfois OK, parfois KO).
- Différence web vs PWA standalone.

### La cause

Le runtime cache `html-pages` (NetworkFirst sur `request.mode === 'navigate'`) :

1. **Stocke des versions HTML variables** : online → une version, offline → une autre (ou une vieille version).
2. **N’est pas nettoyé** : `cleanupOutdatedCaches` supprime les anciens caches **precache** (chunks, CSS), mais **pas** les runtime caches (`html-pages`, `rsc-pages`, etc.).
3. **Mismatch HTML / chunks** : l’ancien HTML en cache référence des chunks supprimés → **ChunkLoadError**.
4. **Comportement non déterministe** : selon l’ordre réseau / cache, on sert tantôt le precache, tantôt `html-pages` → version incohérente.

Résumé : **HTML en cache runtime + precache nettoyé = HTML obsolète qui pointe vers des chunks inexistants.**

---

## 2. Stratégie App Shell "béton"

### Principes

| Règle | Implémentation |
|-------|----------------|
| Toute navigation `/app*` sert **toujours** `/app` depuis le precache | NavigationRoute + `createHandlerBoundToURL("/app")` |
| Pas de NetworkFirst sur le HTML de l’App Shell | Suppression du runtime cache `html-pages` |
| Query params ignorés pour matcher `/app` | `ignoreURLParametersMatching: [view, propertyId, tab, ...]` |
| Allowlist stricte | `/^\/app($|\/|\?)/` → `/app`, `/app/`, `/app?view=xxx`, `/app/login` |

### Chaîne de traitement des navigations

1. **Precache (priorité)**  
   - Requête `/app?view=loans` → params ignorés → lookup `/app` dans le precache → réponse servie.

2. **NavigationRoute**  
   - Pour les navigations qui matchent `/^\/app($|\/|\?)/`, servir `/app` depuis le precache.

3. **Route `/` (start-url)**  
   - NetworkFirst sur la racine ; en cas d’échec, `handlerDidError` → fallback document `/app`.

4. **Autres navigations**  
   - Aucun handler navigate générique → pas de cache runtime HTML instable.

---

## 3. Modifications appliquées

### 3.1. Suppression du cache `html-pages`

- Suppression de la règle `request.mode === 'navigate'` avec NetworkFirst.
- Suppression du cache runtime `html-pages`.
- Toutes les navigations `/app*` passent par precache / NavigationRoute uniquement.

### 3.2. `additionalManifestEntries`

- Avant : `[{ url: '/offline.html', revision: null }]`.
- Après : `[]` — pas de fallback vers `offline.html`, `/app` reste l’unique App Shell.
- `/app` est ajouté au precache via `fallbacks.document` (buildFallbackWorker).

### 3.3. `navigateFallbackAllowlist`

- Avant : `/^\/app($|\?)/`.
- Après : `/^\/app($|\/|\?)/` — prise en charge de `/app/login` et `/app/xxx`.

### 3.4. Filet de sécurité pour /app* (préfetches)

- La **NavigationRoute** ne matche que `request.mode === 'navigate'`.
- Les **préfetches** Next.js (Link) et certains fetches ont `mode !== 'navigate'` → non interceptés → `ERR_INTERNET_DISCONNECTED` offline.
- Une règle **NetworkFirst (timeout 0)** + `precacheFallback: '/app'` matche tout GET `/app*` (sauf `_rsc`) → sert toujours `/app` depuis le precache sans attendre le réseau.
- `maxEntries: 0` pour ne jamais cacher de réponse réseau (éviter HTML obsolète).

### 3.5. Protection HTML obsolète

- `cleanupOutdatedCaches: true` — supprime les anciens precache après un nouveau build.
- `clientsClaim: true` — prise de contrôle immédiate du SW.
- `skipWaiting: false` — pas de reload forcé ; l’UpdateBanner propose un reload manuel.

---

## 4. Checklist de tests reproductibles

### Préparation

- [ ] Hard refresh (Ctrl+Shift+R) ou Clear site data (DevTools > Application).
- [ ] Build prod : `npm run build`.
- [ ] Démarrer : `npm run start`.

### Scénario 1 — PWA standalone (Windows)

1. [ ] Ouvrir l’app en ligne dans Chrome/Edge.
2. [ ] Installer la PWA (icône dans la barre d’adresse ou menu).
3. [ ] Fermer le navigateur.
4. [ ] Ouvrir la PWA en fenêtre standalone.
5. [ ] Vérifier : Dashboard, Prêts, Échéances, Transactions, Documents.
6. [ ] Fermer la PWA.
7. [ ] Activer le mode avion.
8. [ ] Rouvrir la PWA.
9. [ ] Tester les navigations :
   - [ ] `/app?view=dashboard`
   - [ ] `/app?view=loans`
   - [ ] `/app?view=echeances`
   - [ ] `/app?view=transactions`
   - [ ] `/app?view=documents`
   - [ ] `/app?view=patrimoine`
10. [ ] Vérifier l’absence d’erreurs console (ChunkLoadError, ERR_INTERNET_DISCONNECTED).
11. [ ] Naviguer entre les vues plusieurs fois sans erreur.

### Scénario 2 — PWA iOS (si possible)

1. [ ] Ouvrir l’app en ligne dans Safari.
2. [ ] Partager > « Sur l’écran d’accueil ».
3. [ ] Ouvrir la PWA depuis l’écran d’accueil.
4. [ ] Visiter Dashboard, Prêts, etc.
5. [ ] Activer le mode avion.
6. [ ] Rouvrir la PWA et tester la navigation entre les vues.
7. [ ] Vérifier l’absence de ChunkLoadError et d’erreurs réseau.

### Scénario 3 — Mode web (onglet)

1. [ ] Ouvrir l’app en ligne.
2. [ ] Visiter `/app` et plusieurs vues.
3. [ ] Activer le mode avion.
4. [ ] Rafraîchir la page et naviguer.
5. [ ] Vérifier la stabilité (priorité moindre que PWA standalone).

---

## 5. Rappel : pas de modification React

Les imports dynamiques ont déjà été remplacés par des imports statiques (voir `AUDIT-OFFLINE-APP-SHELL.md`).  
Les changements ci-dessus concernent uniquement la configuration du Service Worker / Workbox.
