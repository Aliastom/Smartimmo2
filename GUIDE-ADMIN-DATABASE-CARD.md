# Guide : Carte Base de Données sur la Page Admin

## 📋 Description

La carte "Base de Données" sur la page `/admin` permet de lancer **Prisma Studio** directement depuis l'interface d'administration. Cette fonctionnalité doit être **explicitement activée** via la variable d'environnement `ENABLE_PRISMA_STUDIO=true` dans `.env.local` pour des raisons de sécurité.

## ✨ Fonctionnalités

- 🚀 Lancement de Prisma Studio en un clic
- 🔒 Activation conditionnelle (uniquement si `ENABLE_PRISMA_STUDIO=true` dans `.env.local`)
- 🎯 Ouverture automatique de Prisma Studio dans un nouvel onglet
- ⏳ Feedback visuel pendant le lancement
- 🔔 Notifications toast pour informer l'utilisateur

## 🔧 Configuration

### 1. Créer le fichier `.env.local`

Créez un fichier `.env.local` à la racine du projet.

### 2. Activer Prisma Studio

Dans votre fichier `.env.local`, ajoutez **obligatoirement** :

```env
ENABLE_PRISMA_STUDIO=true
DATABASE_URL="postgresql://smartimmo:smartimmo@localhost:5432/smartimmo?schema=public"
```

⚠️ **Sans cette variable explicitement définie à `true`, la carte n'apparaîtra pas !**

### 3. Vérifier la configuration de la base de données

Assurez-vous que PostgreSQL est en cours d'exécution via Docker :

```bash
npm run services:start
```

## 🎯 Utilisation

1. **Accéder à la page admin** : `http://localhost:3000/admin`

2. **Section "Administration Système"** : Vous verrez la carte "Base de Données" avec un badge vert "🚀 Dev"

3. **Cliquer sur la carte** : 
   - Un toast confirme le lancement
   - La carte affiche "Lancement..." avec un spinner
   - Après 3 secondes, Prisma Studio s'ouvre automatiquement à `http://localhost:5555`

## 🔒 Sécurité

### Restrictions

- ✅ **Visible uniquement** si `ENABLE_PRISMA_STUDIO=true` dans `.env.local`
- ✅ **L'API refuse les requêtes** si `process.env.ENABLE_PRISMA_STUDIO !== 'true'`
- ✅ **Par défaut**, la carte n'apparaît pas du tout (opt-in explicite)

### Exemple de comportement

| Configuration `.env.local` | Carte visible ? | API accessible ? |
|---------------|----------------|------------------|
| `ENABLE_PRISMA_STUDIO=true` | ✅ Oui | ✅ Oui |
| `ENABLE_PRISMA_STUDIO=false` | ❌ Non | ❌ Non (403) |
| Variable absente | ❌ Non | ❌ Non (403) |
| Fichier `.env.local` absent | ❌ Non | ❌ Non (403) |

## 🏗️ Architecture

### 1. Endpoint API

**Fichier** : `src/app/api/admin/database/studio/route.ts`

```typescript
POST /api/admin/database/studio
```

- Vérifie que `ENABLE_PRISMA_STUDIO === 'true'`
- Détecte si Prisma Studio est déjà en cours d'exécution (port 5555)
- Lance `npm run db:studio` en arrière-plan
- Retourne un message de succès avec l'URL

### 2. Page Admin (Serveur)

**Fichier** : `src/app/admin/page.tsx`

- Récupère `process.env.ENABLE_PRISMA_STUDIO` côté serveur
- Passe `enablePrismaStudio` comme prop au composant client

### 3. Composant Client

**Fichier** : `src/app/admin/AdminPageClient.tsx`

- Reçoit le prop `enablePrismaStudio`
- Affiche conditionnellement la carte database uniquement si `enablePrismaStudio === true`
- Gère l'état de chargement (`isLaunchingStudio`)
- Appelle l'API et ouvre Prisma Studio

## 🧪 Tests

### Test manuel

1. **Avec ENABLE_PRISMA_STUDIO=true** :
```bash
# Dans .env.local
ENABLE_PRISMA_STUDIO=true
```
```bash
npm run dev:pg
```
- ✅ Vérifier que la carte "Base de Données" est visible avec badge "🚀 Dev"
- ✅ Cliquer dessus et vérifier que Prisma Studio s'ouvre

2. **Sans ENABLE_PRISMA_STUDIO (variable absente ou false)** :
```bash
# Supprimer la ligne ENABLE_PRISMA_STUDIO dans .env.local
# OU définir :
ENABLE_PRISMA_STUDIO=false
```
```bash
npm run dev:pg
```
- ❌ Vérifier que la carte "Base de Données" n'est PAS visible
- ❌ Si vous tentez d'appeler l'API directement, vous obtenez une erreur 403

### Test API direct

```bash
# Avec ENABLE_PRISMA_STUDIO=true (devrait fonctionner)
curl -X POST http://localhost:3000/api/admin/database/studio

# Sans ENABLE_PRISMA_STUDIO (devrait retourner 403)
# Supprimer ou commenter la variable dans .env.local puis redémarrer le serveur
curl -X POST http://localhost:3000/api/admin/database/studio
```

## 📝 Notes

- **Prisma Studio** utilise le port `5555` par défaut
- Si le port est déjà utilisé, l'API détecte et informe l'utilisateur
- Le lancement prend environ 2-3 secondes
- L'ouverture automatique se fait après 3 secondes

## 🐛 Dépannage

### La carte n'apparaît pas

1. ✅ Vérifier que `.env.local` existe à la racine du projet
2. ✅ Vérifier qu'il contient **exactement** `ENABLE_PRISMA_STUDIO=true` (sensible à la casse)
3. ✅ **Redémarrer le serveur Next.js** (les variables d'environnement ne sont pas rechargées à chaud)
4. ✅ Vider le cache du navigateur et rafraîchir la page

### Prisma Studio ne s'ouvre pas

1. Vérifier que PostgreSQL est en cours d'exécution : `npm run services:start`
2. Vérifier les logs du serveur Next.js
3. Tenter d'ouvrir manuellement : `http://localhost:5555`

### Erreur 403 sur l'API

- La variable `ENABLE_PRISMA_STUDIO` n'est pas définie ou n'est pas égale à `true`
- Vérifier le fichier `.env.local`
- **Redémarrer le serveur** après avoir modifié `.env.local`

## 🎨 Personnalisation

### Changer le port de Prisma Studio

Modifier `package.json` :

```json
{
  "scripts": {
    "db:studio": "prisma studio --port 6000"
  }
}
```

Puis modifier l'URL dans `route.ts` et `AdminPageClient.tsx`.

### Changer le délai d'ouverture

Dans `AdminPageClient.tsx`, ligne 30-32 :

```typescript
setTimeout(() => {
  window.open('http://localhost:5555', '_blank');
}, 3000); // Modifier cette valeur (en millisecondes)
```

## ✅ Checklist d'implémentation

- [x] Endpoint API créé (`/api/admin/database/studio`)
- [x] Vérification `ENABLE_PRISMA_STUDIO=true` côté serveur (sécurité opt-in)
- [x] Détection si Prisma Studio déjà en cours
- [x] Lancement de Prisma Studio en arrière-plan
- [x] Page admin modifiée pour passer `enablePrismaStudio`
- [x] Composant client avec activation conditionnelle stricte
- [x] Gestion d'état et feedback visuel
- [x] Notifications toast
- [x] Ouverture automatique dans nouvel onglet
- [x] Documentation complète mise à jour

