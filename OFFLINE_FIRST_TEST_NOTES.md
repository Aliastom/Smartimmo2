# Notes de test - Mode Offline-First

## ⚠️ Configuration temporaire pour tester

Pour tester le mode offline complet, la PWA a été temporairement activée en développement.

### Fichier modifié
- `next.config.mjs` ligne 63 : `disable: false` (au lieu de `process.env.NODE_ENV === 'development'`)

### Pour tester

1. **Arrêter le serveur actuel** (Ctrl+C)

2. **Nettoyer le cache Next.js** (optionnel mais recommandé) :
   ```bash
   rm -rf .next
   # Ou sur Windows :
   rmdir /s /q .next
   ```

3. **Relancer le serveur** :
   ```bash
   npm run dev
   ```

4. **Ouvrir l'app dans le navigateur** et attendre quelques secondes pour que le service worker s'enregistre

5. **Vérifier le service worker** :
   - DevTools → Application → Service Workers
   - Vous devriez voir un service worker actif

6. **Tester le mode offline** :
   - Ouvrir plusieurs pages de l'app (dashboard, biens, etc.) pour qu'elles soient mises en cache
   - DevTools → Network → Cocher "Offline"
   - Vous devriez pouvoir naviguer dans l'app et créer/modifier des biens
   - L'indicateur de sync devrait afficher "Hors ligne" et "X opération(s) en attente"

7. **Tester la synchronisation** :
   - Décocher "Offline"
   - Les opérations en attente devraient se synchroniser automatiquement

### ⚠️ Important : Remettre la configuration après les tests

Après avoir terminé les tests, remettre dans `next.config.mjs` :
```javascript
disable: process.env.NODE_ENV === 'development', // Désactiver en dev
```

Pour éviter les conflits lors du développement normal.

### Alternative : Build de production

Si vous préférez tester sans modifier la config dev, utilisez plutôt :
```bash
npm run build
npm start
```

Cela génère des pages statiques qui fonctionnent hors ligne sans service worker.




