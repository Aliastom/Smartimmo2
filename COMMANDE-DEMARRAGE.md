# 🚀 Commande de démarrage - PostgreSQL

## ⚡ Solution

À partir de maintenant, utilisez cette commande pour démarrer l'application :

```bash
npm run dev:pg
```

Cette commande configure automatiquement `DATABASE_URL` pour PostgreSQL avant de lancer l'application.

## 📋 Ce qui a été fait

1. ✅ Installation de `cross-env` pour gérer les variables d'environnement
2. ✅ Création d'un script `dev:pg` dans `package.json`
3. ✅ Configuration de l'URL PostgreSQL dans le script

## 🎯 Commandes disponibles

| Commande | Description |
|----------|-------------|
| `npm run dev:pg` | **Démarre avec PostgreSQL** (à utiliser maintenant) |
| `npm run dev` | Démarre avec la config .env (ne fonctionne plus) |
| `npm run db:setup` | Démarre PostgreSQL avec Docker |
| `npm run db:studio` | Ouvre Prisma Studio |

## ✅ Vérification

L'application devrait maintenant :
- ✅ Démarrer sans erreur
- ✅ Se connecter à PostgreSQL
- ✅ Afficher les champs de charges dans le formulaire de bail
- ✅ Fonctionner normalement

## 🎉 Résultat

Accédez à http://localhost:3000 et vérifiez que tout fonctionne correctement !
