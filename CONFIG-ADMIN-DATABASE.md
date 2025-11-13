# Configuration : Carte Base de Données Admin

## 🚀 Activation rapide

Pour activer la carte "Base de Données" sur la page `/admin`, créez un fichier `.env.local` à la racine du projet :

```env
# ⚠️ REQUIS : Active la carte Base de Données sur la page admin
ENABLE_PRISMA_STUDIO=true

# Configuration de la base de données
DATABASE_URL="postgresql://smartimmo:smartimmo@localhost:5432/smartimmo?schema=public"
QDRANT_URL="http://localhost:6333"
```

**Important** : La variable `ENABLE_PRISMA_STUDIO=true` doit être **explicitement définie** dans `.env.local` pour que la carte apparaisse.

## ✅ Vérification

1. **Démarrer PostgreSQL** :
```bash
npm run services:start
```

2. **Démarrer l'application** :
```bash
npm run dev:pg
```

3. **Accéder à la page admin** :
```
http://localhost:3000/admin
```

4. **Vérifier** : Vous devriez voir la carte "Base de Données" avec un badge vert "🚀 Dev" dans la section "Administration Système"

## 📖 Documentation complète

Voir [GUIDE-ADMIN-DATABASE-CARD.md](./GUIDE-ADMIN-DATABASE-CARD.md) pour tous les détails.

