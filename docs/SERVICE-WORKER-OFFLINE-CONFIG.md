# Configuration Service Worker / Workbox — App Shell Offline-First

**Date :** 16 février 2025  
**Objectif :** Stabiliser le comportement offline de l’App Shell PWA (mode web et standalone).

---

## 1. Problèmes observés

- Pages fonctionnent quelques secondes puis cassent
- `ERR_INTERNET_DISCONNECTED`
- `ChunkLoadError`
- Différence de comportement web vs PWA standalone
- Routes `/app?view=transactions`, `/app?view=loans` échouent en offline alors que l’App Shell devrait être utilisable

---

## 2. Pourquoi ça cassait

### 2.1. Problème des query params

- `/app` était mis en cache dans `html-pages` (NetworkFirst)
- `/app?view=loans` n’était pas reconnu comme équivalent à `/app` par le precache
- Sans `ignoreURLParametersMatching` adapté, le precache ne servait pas la bonne entrée

### 2.2. Fallback document

- `fallbacks.document: '/offline.html'` servait une page générique
- L’App Shell (`/app`) n’était pas utilisé comme fallback, donc pas d’App Shell offline

### 2.3. HTML obsolète après un build

- Cache `html-pages` conservait l’ancien HTML
- Nouveau build → nouveaux chunks, ancien HTML → références vers des chunks obsolètes → `ChunkLoadError`

### 2.4. Ordre des routes Workbox

- Le precache doit matcher `/app?view=xxx` comme `/app`
- Le navigate handler devait pouvoir fallback vers une version précachée de `/app` en cas d’échec

---

## 3. Modifications appliquées

### 3.1. `fallbacks.document: '/app'`

- Fallback document = App Shell
- `buildFallbackWorker` ajoute automatiquement `/app` au precache
- À l’install du SW (online), `/app` est récupéré et mis en precache

### 3.2. `ignoreURLParametersMatching`

```js
ignoreURLParametersMatching: [/^view$/, /^propertyId$/, /^tab$/, /^redirect$/, /^utm_/, /^fbclid$/]
```

- Les paramètres `view`, `propertyId`, `tab` sont ignorés pour le precache
- `/app?view=loans` est traité comme `/app` → match avec l’entrée précachée

### 3.3. `navigateFallback` et `navigateFallbackAllowlist`

```js
navigateFallback: '/app',
navigateFallbackAllowlist: [/^\/app($|\?)/],
```

- Fallback de navigation vers `/app` pour les routes qui commencent par `/app`
- Utilisé si aucune autre route ne répond

### 3.4. `precacheFallback` sur le handler navigate

```js
precacheFallback: { fallbackURL: '/app' }
```

- Quand NetworkFirst échoue (réseau + cache `html-pages` vides)
- Le plugin sert `/app` depuis le precache

### 3.5. Stabilisation du SW

- `skipWaiting: false` : pas de reload forcé
- `clientsClaim: true` : prise de contrôle immédiate après activation
- `cleanupOutdatedCaches: true` : suppression des caches obsolètes après un nouveau build

---

## 4. Chaîne de traitement des navigations

1. **Precache (priorité)**  
   - `/app?view=loans` → params ignorés → match sur `/app`  
   - Si `/app` est en precache → réponse servie directement (offline OK)

2. **Runtime navigate (NetworkFirst)**  
   - Si le precache ne répond pas :
     - Tenter le réseau (timeout 3 s)
     - Sinon cache `html-pages`
     - Sinon `precacheFallback` → servir `/app` du precache

3. **navigateFallback (sécurité)**  
   - Si aucune des routes ci-dessus ne répond → servir `/app` (precache)

---

## 5. Checklist de test

### Préparation

- [ ] Hard refresh (Ctrl+Shift+R)
- [ ] Clear storage (DevTools > Application > Clear site data)
- [ ] Build prod : `npm run build`
- [ ] Démarrer : `npm run start`

### Scénario online

- [ ] Ouvrir l’app en online
- [ ] Aller sur `/app`
- [ ] Visiter : dashboard, transactions, patrimoine, loans, documents
- [ ] Vérifier que le SW est actif (Application > Service Workers)

### Scénario offline

- [ ] Activer le mode avion
- [ ] Tester les navigations :
  - [ ] `/app?view=dashboard`
  - [ ] `/app?view=transactions`
  - [ ] `/app?view=patrimoine`
  - [ ] `/app?view=loans`
  - [ ] `/app?view=documents`
- [ ] Vérifier l’absence d’erreurs console
- [ ] Vérifier l’absence de `ChunkLoadError` ou `ERR_INTERNET_DISCONNECTED`

### Modes d’exécution

- [ ] Mode web (onglet navigateur)
- [ ] Mode PWA standalone (installée, fenêtre dédiée)

---

## 6. Rappel : pas de modification React

Les imports dynamiques ont déjà été remplacés par des imports statiques (voir `AUDIT-OFFLINE-APP-SHELL.md`).  
Les changements ci-dessus concernent uniquement la configuration du Service Worker / Workbox.
