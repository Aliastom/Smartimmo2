# ⚙️ Configuration Vercel - Variables de Version Git

## 🎯 Objectif

Ce guide explique comment configurer les variables d'environnement Vercel pour que le badge de version affiche automatiquement la branche et le SHA du commit déployé.

## 📋 Étapes de Configuration

### 1. Accéder aux Variables d'Environnement

1. Connectez-vous à [Vercel Dashboard](https://vercel.com/dashboard)
2. Sélectionnez votre projet **Smartimmo**
3. Allez dans **Settings** > **Environment Variables**

### 2. Créer la Variable `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA`

1. Cliquez sur **Add New**
2. Remplissez :
   - **Key :** `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA`
   - **Value :** `${VERCEL_GIT_COMMIT_SHA}`
   - **Environments :** Cochez toutes les cases :
     - ✅ Production
     - ✅ Preview
     - ✅ Development
3. Cliquez sur **Save**

**Note :** La syntaxe `${VERCEL_GIT_COMMIT_SHA}` référence la variable interne Vercel qui contient le SHA du commit. Le préfixe `NEXT_PUBLIC_` est nécessaire pour que la variable soit accessible côté client Next.js.

### 3. Créer la Variable `NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF`

1. Cliquez sur **Add New**
2. Remplissez :
   - **Key :** `NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF`
   - **Value :** `${VERCEL_GIT_COMMIT_REF}`
   - **Environments :** Cochez toutes les cases :
     - ✅ Production
     - ✅ Preview
     - ✅ Development
3. Cliquez sur **Save**

**Note :** La syntaxe `${VERCEL_GIT_COMMIT_REF}` référence la variable interne Vercel qui contient le nom de la branche Git.

## ✅ Vérification

Après avoir configuré les variables :

1. **Redéployez** votre application (ou attendez le prochain déploiement automatique)
2. Ouvrez l'application déployée
3. Vérifiez que le badge de version s'affiche en bas à droite avec :
   - La branche Git (ex: `main`, `develop`)
   - Le SHA du commit (7 premiers caractères, ex: `3f2a9c1`)

**Exemple d'affichage :** `Smartimmo · main · 3f2a9c1`

## 🔍 Variables Internes Vercel Disponibles

Vercel expose automatiquement ces variables lors des builds :

- `VERCEL_GIT_COMMIT_SHA` : SHA complet du commit
- `VERCEL_GIT_COMMIT_REF` : Nom de la branche
- `VERCEL_GIT_COMMIT_MESSAGE` : Message du commit (non utilisé dans notre cas)
- `VERCEL` : Toujours `1` sur Vercel
- `VERCEL_ENV` : `production`, `preview`, ou `development`

**Important :** Pour utiliser ces variables côté client Next.js, elles doivent être préfixées par `NEXT_PUBLIC_` et mappées dans les Environment Variables.

## 🐛 Dépannage

### Le badge ne s'affiche pas

**Causes possibles :**
1. Les variables ne sont pas configurées dans Vercel
2. Les variables ne sont pas préfixées par `NEXT_PUBLIC_`
3. L'application n'a pas été redéployée après la configuration
4. Les variables ne sont pas disponibles pour l'environnement actuel (vérifier que Production/Preview/Development sont cochés)

**Solution :**
1. Vérifier que les variables sont bien créées dans Vercel
2. ⚠️ **Vérifier que la syntaxe est correcte : `${VERCEL_GIT_COMMIT_SHA}` (avec `${}` et non `@`)**
3. Si vous avez utilisé `@VERCEL_GIT_COMMIT_SHA`, supprimez la variable et recréez-la avec `${VERCEL_GIT_COMMIT_SHA}`
4. Redéployer l'application après correction
5. Vérifier dans les logs de build Vercel que les variables sont bien injectées

### Le badge affiche des valeurs incorrectes

**Cause :** Les variables peuvent être mises en cache par Next.js

**Solution :** Redéployer l'application pour forcer la mise à jour

## 📝 Notes Techniques

- Les variables `NEXT_PUBLIC_*` sont **injectées au moment du build** Next.js
- Elles sont **accessibles côté client** via `process.env.NEXT_PUBLIC_*`
- Elles sont **statiques** : une fois le build terminé, elles ne changent pas jusqu'au prochain build
- Chaque nouveau déploiement Vercel récupère automatiquement les nouvelles valeurs Git

