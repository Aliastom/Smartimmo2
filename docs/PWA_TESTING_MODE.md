# 🧪 Mode de test pour la PWA

## ⚠️ Important : Mode développement vs Production

### Mode développement (`npm run dev`)

- ❌ **PWA désactivée** : Le service worker n'est pas enregistré
- ❌ **Pas de cache** : Les pages ne sont pas mises en cache
- ❌ **Pas de mode offline** : Impossible de tester le mode offline
- ❌ **Pas d'installation** : L'application ne peut pas être installée comme PWA

**Utilisation** : Pour le développement normal, pas pour tester la PWA.

### Mode production (`npm run build && npm start`)

- ✅ **PWA activée** : Le service worker est enregistré et actif
- ✅ **Cache disponible** : Les pages sont mises en cache
- ✅ **Mode offline fonctionnel** : Le mode offline peut être testé
- ✅ **Installation possible** : L'application peut être installée comme PWA

**Utilisation** : Pour tester toutes les fonctionnalités PWA et offline.

## 🔧 Configuration actuelle

Dans `next.config.mjs` :

```javascript
const pwaConfig = withPWA({
  disable: false, // ⚠️ TEMPORAIRE: Activé pour tester offline
  // Normalement : disable: process.env.NODE_ENV === 'development'
});
```

**Actuellement**, la PWA est activée même en développement (temporairement pour les tests).

## 📋 Procédure de test PWA

Pour tester le mode offline et la PWA :

1. **Build et start en mode production** :
   ```bash
   npm run build
   npm start
   ```

2. **Ouvrir dans le navigateur** : `http://localhost:3000`

3. **Vérifier le service worker** :
   - DevTools → Application → Service Workers
   - Le service worker doit être actif

4. **Synchroniser complètement** pour précharger les données et pages

5. **Tester le mode offline** :
   - DevTools → Network → Cocher "Offline"
   - Naviguer vers `/biens`
   - La page doit s'afficher avec les données depuis IndexedDB

## ⚙️ Pour activer la PWA en développement

Si vous voulez tester la PWA en mode dev (non recommandé pour le développement normal) :

Dans `next.config.mjs`, changer :
```javascript
disable: false, // PWA activée même en dev
```

⚠️ **Note** : Cela peut causer des problèmes de cache pendant le développement.

## 🎯 Recommandation

- **Développement normal** : Utiliser `npm run dev` (PWA désactivée)
- **Test PWA/Offline** : Utiliser `npm run build && npm start` (PWA activée)


