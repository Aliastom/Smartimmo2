# 📱 Documentation PWA - Smartimmo

## 🎯 Vue d'ensemble

Smartimmo a été transformé en **Progressive Web App (PWA)** pour permettre l'installation sur iOS et Android, tout en conservant son fonctionnement web classique.

## ✅ Ce qui a été implémenté

### 1. Manifest PWA (`public/manifest.webmanifest`)

Le manifest définit les métadonnées de l'application :
- **Nom** : "Smartimmo - Gestion Immobilière"
- **Nom court** : "Smartimmo"
- **Mode d'affichage** : `standalone` (plein écran)
- **Orientation** : `portrait-primary` (priorité portrait)
- **Couleur de thème** : `#3b82f6` (bleu principal Smartimmo)
- **Couleur de fond** : `#ffffff` (blanc)

### 2. Icônes PWA (`public/icons/`)

Des icônes placeholder ont été générées dans plusieurs tailles :
- 72x72, 96x96, 128x128, 144x144, 152x152, 180x180, 192x192, 384x384, 512x512

**⚠️ IMPORTANT** : Les icônes actuelles sont des placeholders avec le logo "SI". Pour la production, remplacez-les par de vraies icônes professionnelles.

**Comment générer de nouvelles icônes** :
```bash
node scripts/generate-pwa-icons.js
```

**Comment remplacer les icônes** :
1. Créez vos icônes professionnelles dans les tailles requises
2. Remplacez les fichiers dans `public/icons/`
3. Assurez-vous que les noms de fichiers correspondent : `icon-{taille}.png`

### 3. Meta Tags PWA (`src/app/layout.tsx`)

Les meta tags suivants ont été ajoutés :
- `<link rel="manifest" href="/manifest.webmanifest" />`
- `<meta name="theme-color" content="#3b82f6" />`
- Meta tags spécifiques iOS :
  - `apple-mobile-web-app-capable`
  - `apple-mobile-web-app-status-bar-style`
  - `apple-mobile-web-app-title`
  - `apple-touch-icon`

### 4. Service Worker (`next-pwa`)

Le service worker est géré par `next-pwa` avec des stratégies de cache intelligentes :

#### Stratégies de cache

1. **Supabase Auth** (`NetworkOnly`)
   - ❌ **Aucun cache** pour les endpoints d'authentification
   - Garantit que les tokens et refresh tokens fonctionnent correctement

2. **Supabase Data** (`NetworkFirst`)
   - Cache très court (1 minute)
   - Vérifie toujours en ligne en priorité
   - Fallback sur le cache uniquement si le réseau échoue

3. **Supabase Storage** (`NetworkFirst`)
   - Cache de 5 minutes
   - Priorité au réseau pour les fichiers uploadés

4. **Assets statiques Next.js** (`StaleWhileRevalidate`)
   - Cache agressif (1 an)
   - Mise à jour en arrière-plan

5. **Icônes** (`CacheFirst`)
   - Cache permanent pour les icônes statiques

6. **Uploads** (`NetworkFirst`)
   - Cache de 1 jour
   - Vérifie toujours la version en ligne

7. **Pages HTML** (`NetworkFirst`)
   - Cache de 5 minutes
   - Garantit d'avoir la dernière version de l'app

## 🧪 Tests et Validation

### Tests locaux

1. **Build en mode production** :
   ```bash
   npm run build
   npm run start
   ```

2. **Vérification avec Chrome DevTools** :
   - Ouvrez `http://localhost:3000`
   - Ouvrez DevTools → Onglet "Application"
   - Vérifiez :
     - ✅ Manifest présent et valide
     - ✅ Service Worker enregistré
     - ✅ Statut "Installable" affiché

3. **Test du service worker** :
   - DevTools → Application → Service Workers
   - Vérifiez que le service worker est actif
   - Testez le mode offline (DevTools → Network → Offline)

### Tests sur Android

1. **Déployez sur Vercel** (ou utilisez un tunnel comme ngrok)
2. **Ouvrez l'URL sur Chrome Android**
3. **Vérifiez** :
   - Un banner "Installer l'application" apparaît
   - Ou menu → "Ajouter à l'écran d'accueil"
4. **Après installation** :
   - L'app s'ouvre en plein écran
   - L'icône est correcte
   - La navigation fonctionne normalement

### Tests sur iOS (Safari)

1. **Déployez sur Vercel** (ou utilisez un tunnel)
2. **Ouvrez l'URL sur Safari iOS**
3. **Ajouter à l'écran d'accueil** :
   - Bouton "Partager" (icône carrée avec flèche)
   - "Ajouter à l'écran d'accueil"
4. **Après installation** :
   - L'app s'ouvre en plein écran
   - L'icône est correcte
   - La barre d'état utilise la couleur de thème

### Limitations iOS

⚠️ **Important** : iOS a des limitations spécifiques pour les PWA :

1. **Cache agressif** : iOS peut mettre en cache de manière très agressive. Le service worker utilise `NetworkFirst` pour minimiser ce problème.

2. **Offline limité** : Le support offline sur iOS est plus limité que sur Android. L'app fonctionne principalement en ligne.

3. **Mises à jour** : Les mises à jour peuvent prendre du temps à se propager sur iOS. Les utilisateurs peuvent devoir fermer et rouvrir l'app.

4. **Notifications push** : Non supportées sur iOS pour les PWA (seulement pour les apps natives).

## 🔧 Configuration

### Modifier les couleurs

1. **Couleur de thème** :
   - `public/manifest.webmanifest` : `theme_color`
   - `src/app/layout.tsx` : `themeColor` dans metadata et meta tag

2. **Couleur de fond** :
   - `public/manifest.webmanifest` : `background_color`

### Modifier les stratégies de cache

Éditez `next.config.mjs` dans la section `runtimeCaching` de `withPWA()`.

**Handlers disponibles** :
- `NetworkOnly` : Toujours en ligne, pas de cache
- `NetworkFirst` : Essaie en ligne, fallback sur cache
- `CacheFirst` : Essaie le cache, fallback sur réseau
- `StaleWhileRevalidate` : Retourne le cache, met à jour en arrière-plan

### Désactiver PWA en développement

Le PWA est automatiquement désactivé en développement (`disable: process.env.NODE_ENV === 'development'`).

Pour le tester en dev, modifiez temporairement `next.config.mjs` :
```javascript
disable: false, // ⚠️ À remettre à true après les tests
```

## 🚀 Déploiement sur Vercel

Le PWA fonctionne automatiquement sur Vercel. Aucune configuration supplémentaire n'est nécessaire.

**Vérifications post-déploiement** :
1. Le fichier `public/sw.js` est généré (service worker)
2. Le fichier `public/workbox-*.js` est généré (Workbox)
3. Le manifest est accessible : `https://votre-domaine.vercel.app/manifest.webmanifest`

## 📝 Checklist de validation

- [ ] Manifest présent et accessible
- [ ] Service worker enregistré et actif
- [ ] Icônes présentes dans toutes les tailles
- [ ] Installation fonctionne sur Android
- [ ] Installation fonctionne sur iOS
- [ ] Mode plein écran fonctionne
- [ ] Auth Supabase fonctionne (pas de problème de cache)
- [ ] Données dynamiques se mettent à jour correctement
- [ ] Build Vercel passe sans erreur

## 🐛 Dépannage

### Le service worker ne se met pas à jour

1. Ouvrez DevTools → Application → Service Workers
2. Cliquez sur "Unregister" pour supprimer l'ancien
3. Rechargez la page
4. Le nouveau service worker sera enregistré

### Les données ne se mettent pas à jour

Vérifiez que les stratégies de cache dans `next.config.mjs` utilisent `NetworkFirst` ou `NetworkOnly` pour les endpoints concernés.

### L'app ne s'installe pas

1. Vérifiez que le manifest est valide (DevTools → Application → Manifest)
2. Vérifiez que le service worker est actif
3. Vérifiez que vous êtes en HTTPS (requis pour les PWA)
4. Sur iOS, vérifiez que les meta tags Apple sont présents

## 📚 Ressources

- [Documentation next-pwa](https://github.com/shadowwalker/next-pwa)
- [MDN - Progressive Web Apps](https://developer.mozilla.org/fr/docs/Web/Progressive_web_apps)
- [Web.dev - PWA](https://web.dev/progressive-web-apps/)
- [Apple - Web App Manifest](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html)

## 🔄 Mises à jour futures

Pour améliorer la PWA à l'avenir :

1. **Remplacer les icônes placeholder** par de vraies icônes professionnelles
2. **Ajouter un splash screen** personnalisé pour iOS
3. **Implémenter un mode offline plus robuste** (si nécessaire)
4. **Ajouter des notifications push** (Android uniquement)
5. **Optimiser les performances** du service worker

---

**Dernière mise à jour** : Novembre 2025
**Version PWA** : 1.0.0

