# 🗄️ Configuration initiale de la base Supabase

## Situation

Vous avez une base Supabase vide (aucune table créée) et vous devez appliquer toutes les migrations Prisma.

## ✅ Solution : Appliquer les migrations via Prisma

### Étape 1 : Backup de votre .env

Copiez votre fichier `.env` actuel en `.env.backup` au cas où.

### Étape 2 : Pointer temporairement vers Supabase

Modifiez votre `.env` :

```bash
# Commentez la DATABASE_URL locale
# DATABASE_URL=postgresql://smartimmo:smartimmo@localhost:5432/smartimmo?schema=public

# Décommentez l'URL Supabase
DATABASE_URL=postgresql://postgres:NLEG0TeTa7cB8aF2@db.lvythpofldjkoupgflce.supabase.co:5432/postgres?sslmode=require&schema=public
```

### Étape 3 : Appliquer TOUTES les migrations

```bash
npx prisma migrate deploy
```

Cette commande va :
- ✅ Créer toutes les tables (User, Property, Lease, Transaction, etc.)
- ✅ Créer tous les index
- ✅ Appliquer toutes les relations
- ✅ Y compris la migration avec supabaseId

### Étape 4 : Vérifier que ça a fonctionné

```bash
npx prisma studio
```

Prisma Studio devrait maintenant se connecter à Supabase et vous montrer toutes vos tables.

### Étape 5 : Remettre l'URL locale

Dans `.env`, remettez :

```bash
DATABASE_URL=postgresql://smartimmo:smartimmo@localhost:5432/smartimmo?schema=public
```

## ⚠️ IMPORTANT

Après avoir fait ça :
1. **Redémarrez votre serveur local** : `npm run dev`
2. **Testez à nouveau sur Vercel** : https://smartimmo2.vercel.app/login

Le callback devrait maintenant fonctionner ! ✅

