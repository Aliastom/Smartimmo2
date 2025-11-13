# Appliquer la migration sur Supabase (Production)

## Méthode 1 : Connection directe via Prisma

1. Modifier temporairement votre `.env` pour pointer vers Supabase :

```bash
# Commentez la DATABASE_URL locale
# DATABASE_URL=postgresql://smartimmo:smartimmo@localhost:5432/smartimmo

# Décommentez et utilisez l'URL Supabase
DATABASE_URL=postgresql://postgres:NLEG0TeTa7cB8aF2@db.lvythpofldjkoupgflce.supabase.co:5432/postgres?sslmode=require&schema=public
```

2. Appliquez la migration :

```bash
npx prisma migrate deploy
```

3. Vérifiez :

```bash
npx prisma studio
# Vérifiez que la colonne supabaseId existe dans le modèle User
```

4. **IMPORTANT** : Remettez votre DATABASE_URL locale après :

```bash
DATABASE_URL=postgresql://smartimmo:smartimmo@localhost:5432/smartimmo?schema=public
```

## Méthode 2 : Via Supabase SQL Editor (Plus simple)

Voir le fichier principal README pour les instructions SQL directes.

