# 📌 Système de Versionning Automatique - Smartimmo

## 🎯 Vue d'ensemble

Le système de versionning affiche **automatiquement** la version de l'application basée sur les informations Git de Vercel (branche + SHA du commit). Aucune maintenance manuelle nécessaire : chaque déploiement affiche automatiquement la nouvelle version.

Visible à la fois dans le navigateur, la PWA PC et la PWA mobile.

## 🔧 Configuration

### Variables d'environnement Vercel

Le système utilise les variables d'environnement automatiquement fournies par Vercel lors des déploiements.

#### 1. Commit SHA (automatique sur Vercel)

**Variable :** `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA`

**Description :** SHA complet du commit Git (automatiquement fourni par Vercel)

**Configuration sur Vercel :**
1. Aller dans **Settings** > **Environment Variables**
2. Créer une nouvelle variable :
   - **Key :** `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA`
   - **Value :** `${VERCEL_GIT_COMMIT_SHA}`
   - **Environments :** Production, Preview, Development

**Note :** Cette variable doit être mappée depuis la variable interne Vercel `VERCEL_GIT_COMMIT_SHA` pour être accessible côté client (préfixe `NEXT_PUBLIC_` requis).

#### 2. Branche Git (automatique sur Vercel)

**Variable :** `NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF`

**Description :** Nom de la branche Git (ex: `main`, `develop`, `feature/xyz`)

**Configuration sur Vercel :**
1. Aller dans **Settings** > **Environment Variables**
2. Créer une nouvelle variable :
   - **Key :** `NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF`
   - **Value :** `${VERCEL_GIT_COMMIT_REF}`
   - **Environments :** Production, Preview, Development

**Note :** Cette variable doit être mappée depuis la variable interne Vercel `VERCEL_GIT_COMMIT_REF` pour être accessible côté client.

#### 3. Configuration en local (optionnel - pour tests)

En développement local, les variables Vercel ne sont pas disponibles. Le badge ne s'affichera pas (comportement normal).

**Optionnel :** Pour tester en local, vous pouvez ajouter dans `.env.local` :

```env
NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF=dev
NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA=1234567890abcdef
```

Le badge affichera alors : `Smartimmo · dev · 1234567`

## 📍 Affichage

Le badge de version est affiché en bas à droite de l'écran, dans un footer discret.

**Format d'affichage :**
- Avec branche + SHA : `Smartimmo · main · 3f2a9c1`
- Avec branche uniquement : `Smartimmo · main`
- Avec SHA uniquement : `Smartimmo · 3f2a9c1`

**Style :**
- Taille : `10px` sur mobile, `12px` sur desktop
- Couleur : `slate-400` (gris discret)
- Police : `mono` (monospace)
- Position : Bas à droite, dans un footer discret

## 🧪 Tests

### Test en local

**Option 1 : Sans configuration (comportement normal)**
1. Démarrer l'application :
```bash
npm run dev
```
2. Vérifier que le badge **ne s'affiche pas** (normal, les variables Vercel ne sont pas disponibles en local)

**Option 2 : Avec simulation (pour tester l'affichage)**
1. Créer/modifier `.env.local` :
```env
NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF=dev
NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA=1234567890abcdef
```

2. Démarrer l'application :
```bash
npm run dev
```

3. Vérifier que le badge s'affiche en bas à droite avec `Smartimmo · dev · 1234567`

### Test en production (Vercel)

1. **Configurer les variables d'environnement dans Vercel :**
   - Aller dans **Settings** > **Environment Variables**
   - Ajouter `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` = `${VERCEL_GIT_COMMIT_SHA}`
   - Ajouter `NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF` = `${VERCEL_GIT_COMMIT_REF}`
   - Sélectionner tous les environnements (Production, Preview, Development)

2. **Déployer l'application** (push sur la branche connectée)

3. **Vérifier :**
   - Dans le navigateur : le badge s'affiche en bas à droite avec la branche et le SHA
   - Dans la PWA (PC) : le badge s'affiche également
   - Dans la PWA mobile : le badge s'affiche également
   - Le commit SHA (7 premiers caractères) correspond au commit déployé
   - La branche affichée correspond à la branche déployée

## 📝 Mise à jour automatique

**Aucune action manuelle nécessaire !** 

Le système est **100% automatique** :
- Chaque nouveau push / déploiement sur Vercel affiche automatiquement le nouveau commit SHA
- La branche affichée correspond automatiquement à la branche déployée
- Aucune maintenance de numéro de version requise

**Exemple :**
- Déploiement 1 : `Smartimmo · main · 3f2a9c1`
- Après un nouveau commit et déploiement : `Smartimmo · main · 7b8c9d2`
- Le badge se met à jour automatiquement

## 🔍 Composant technique

**Fichier :** `src/components/layout/AppVersionBadge.tsx`

**Intégration :** `src/components/layout/AppShell.tsx`

Le composant est masqué automatiquement sur les pages d'authentification (`/auth/*`, `/login`).

