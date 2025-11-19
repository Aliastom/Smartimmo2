# 🔄 Système de Notification de Mise à Jour PWA

## 🎯 Objectif

Afficher un bandeau de notification quand une nouvelle version de l'application est disponible, permettant à l'utilisateur de choisir quand mettre à jour.

## ✅ Implémentation

### 1. Configuration (`next.config.mjs`)

- **`skipWaiting: false`** : Le service worker n'active plus automatiquement les mises à jour
- L'utilisateur doit confirmer la mise à jour via le bandeau

### 2. Hook `useServiceWorkerUpdate` (`src/hooks/useServiceWorkerUpdate.ts`)

Détecte les mises à jour du service worker :
- Vérifie s'il y a un `waiting` worker (nouveau SW installé mais pas encore activé)
- Écoute les événements `updatefound` et `statechange`
- Expose :
  - `waitingWorker` : Le service worker en attente
  - `isUpdateAvailable` : Boolean indiquant si une mise à jour est disponible
  - `updateServiceWorker()` : Fonction pour mettre à jour (envoie SKIP_WAITING + reload)
  - `dismissUpdate()` : Fonction pour masquer le bandeau

### 3. Composant `UpdateBanner` (`src/components/pwa/UpdateBanner.tsx`)

Bandeau affiché en bas de l'écran :
- Message : "Une nouvelle version de SmartImmo est disponible."
- Bouton "Mettre à jour" : Envoie SKIP_WAITING et recharge la page
- Bouton "Plus tard" (X) : Masque le bandeau

### 4. Intégration (`src/app/layout.tsx`)

- `<ServiceWorkerRegister />` : Enregistre le SW
- `<UpdateBanner />` : Affiche le bandeau de mise à jour

## 🔧 Fonctionnement

1. **Détection** : Le hook vérifie périodiquement (toutes les heures) s'il y a un nouveau SW
2. **Affichage** : Quand un `waiting` worker est détecté, le bandeau s'affiche
3. **Mise à jour** : Clic sur "Mettre à jour" → envoie `SKIP_WAITING` → recharge la page
4. **Activation** : Le nouveau SW prend le contrôle après le reload

## 📝 Service Worker

Le service worker généré par next-pwa/Workbox gère déjà les messages. Le code dans `public/sw-custom.js` est une sauvegarde mais n'est probablement pas nécessaire car Workbox gère déjà les messages.

## 🧪 Tests

1. Déployer version 1 sur Vercel
2. Ouvrir l'app et installer la PWA
3. Déployer version 2 (avec des changements)
4. Attendre quelques minutes ou forcer la vérification
5. Le bandeau devrait apparaître
6. Clic sur "Mettre à jour" → la page se recharge avec la nouvelle version

## ⚠️ Notes importantes

- Le système fonctionne uniquement en **production** (pas en dev)
- Le bandeau n'apparaît que si :
  - Un SW est déjà actif (`navigator.serviceWorker.controller`)
  - Un nouveau SW est installé et en attente (`registration.waiting`)
- La vérification des mises à jour se fait automatiquement toutes les heures
- Le SW vérifie aussi les mises à jour à chaque navigation (comportement par défaut)

