# 🔍 Debug - Badge de Version

## ✅ Modifications apportées

### 1. Mode debug en développement
- Le badge affiche maintenant `Smartimmo · dev · local` en mode développement local
- Cela permet de vérifier que le composant fonctionne même sans variables Vercel

### 2. Amélioration du footer
- Footer avec bordure supérieure pour meilleure visibilité
- Positionnement fixe en bas de l'écran
- Classes CSS améliorées pour garantir la visibilité

## 🧪 Tests à effectuer

### Test en local

1. **Démarrer l'application :**
```bash
npm run dev
```

2. **Vérifier :**
   - Le badge devrait s'afficher en bas à droite avec `Smartimmo · dev · local`
   - Le badge doit être visible même si le contenu est long (scroll)

3. **Si le badge n'apparaît pas :**
   - Ouvrir les DevTools (F12)
   - Vérifier la console pour d'éventuelles erreurs
   - Inspecter l'élément `<footer>` en bas de la page
   - Vérifier que le composant `AppVersionBadge` est bien rendu

### Test avec variables simulées

1. **Ajouter dans `.env.local` :**
```env
NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF=main
NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA=ead7fea1234567890abcdef
```

2. **Redémarrer l'application :**
```bash
npm run dev
```

3. **Vérifier :**
   - Le badge devrait afficher `Smartimmo · main · ead7fea`

### Test sur Vercel

1. **Vérifier la configuration des variables :**
   - Aller dans Vercel Dashboard > Settings > Environment Variables
   - Vérifier que ces variables existent :
     - `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` = `${VERCEL_GIT_COMMIT_SHA}`
     - `NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF` = `${VERCEL_GIT_COMMIT_REF}`
   - Vérifier que toutes les environnements sont cochés (Production, Preview, Development)

2. **Vérifier les logs de build :**
   - Aller dans Vercel Dashboard > Deployments > [Dernier déploiement] > Build Logs
   - Chercher les variables d'environnement dans les logs
   - Vérifier que `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` et `NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF` sont bien présentes

3. **Vérifier dans l'application déployée :**
   - Ouvrir l'application sur Vercel
   - Ouvrir les DevTools (F12)
   - Dans la console, taper : `process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA`
   - Vérifier que la valeur est bien définie

## 🐛 Problèmes courants

### Le badge ne s'affiche pas en local

**Cause :** Le composant retourne `null` si les variables ne sont pas définies (en production)

**Solution :** Le mode debug devrait maintenant afficher `Smartimmo · dev · local` en développement

### Le badge ne s'affiche pas sur Vercel

**Causes possibles :**
1. Les variables ne sont pas configurées dans Vercel
2. Les variables ne sont pas préfixées par `NEXT_PUBLIC_`
3. L'application n'a pas été redéployée après la configuration
4. Les variables ne sont pas disponibles pour l'environnement actuel

**Solutions :**
1. Vérifier la configuration dans Vercel (voir section "Test sur Vercel")
2. Redéployer l'application après avoir configuré les variables
3. Vérifier les logs de build pour confirmer que les variables sont injectées

### Le footer n'est pas visible

**Cause :** Le footer peut être caché par le contenu ou le z-index

**Solution :** Le footer a maintenant :
- Une bordure supérieure pour meilleure visibilité
- Un background `bg-gray-50` pour se démarquer
- Un `shrink-0` pour éviter qu'il soit compressé

## 📝 Notes techniques

- Les variables `NEXT_PUBLIC_*` sont injectées au moment du **build** Next.js
- Elles sont **statiques** : une fois le build terminé, elles ne changent pas
- Pour voir les nouvelles valeurs, il faut **redéployer** l'application
- En développement local, `NODE_ENV === 'development'` est toujours vrai

