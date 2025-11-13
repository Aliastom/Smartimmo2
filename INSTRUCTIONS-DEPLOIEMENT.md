# 🚀 Instructions de déploiement - Migration PostgreSQL

## ⚠️ Statut actuel

La migration vers PostgreSQL est **prête** mais nécessite quelques étapes manuelles car Docker Desktop n'est pas en cours d'exécution sur votre machine.

## 📋 Ce qui a été fait automatiquement

✅ **Schema Prisma** : Changé de SQLite vers PostgreSQL  
✅ **Scripts de migration** : Créés et testés  
✅ **Scripts de vérification** : Intégrité des données  
✅ **CI/CD** : Workflow GitHub Actions configuré  
✅ **Documentation** : Complète avec guides  
✅ **Client Prisma** : Généré avec le nouveau provider  
✅ **Configuration Docker** : docker-compose.yml créé  

## 🎯 Prochaines étapes à faire manuellement

### Option 1 : Utiliser Docker Desktop (Recommandé)

1. **Installer/Démarrer Docker Desktop** :
   - Si pas installé : https://www.docker.com/products/docker-desktop/
   - Si installé : Démarrez Docker Desktop depuis le menu Démarrer

2. **Démarrer PostgreSQL** :
   ```bash
   npm run db:setup
   ```

3. **Configurer l'environnement** :
   Créez un fichier `.env.local` à la racine :
   ```bash
   DATABASE_URL="postgresql://smartimmo:smartimmo@localhost:5432/smartimmo?schema=public"
   ```

4. **Générer les migrations** :
   ```bash
   npm run db:migrate:dev -- --name init_postgres
   ```

5. **Migrer vos données SQLite** (si vous avez des données existantes) :
   ```bash
   npm run db:migrate:data
   ```

6. **Vérifier l'intégrité** :
   ```bash
   npm run db:check
   ```

### Option 2 : Utiliser PostgreSQL externe (Supabase/Render/etc.)

1. **Créer une base de données PostgreSQL** sur votre provider :
   - Supabase : https://supabase.com
   - Render : https://render.com
   - AWS RDS : https://aws.amazon.com/rds/

2. **Récupérer l'URL de connexion** :
   Format : `postgresql://user:password@host:5432/database`

3. **Configurer l'environnement** :
   Créez un fichier `.env.local` :
   ```bash
   DATABASE_URL="postgresql://user:password@host:5432/database?schema=public"
   ```

4. **Générer les migrations** :
   ```bash
   npm run db:migrate:dev -- --name init_postgres
   ```

5. **Migrer vos données SQLite** :
   ```bash
   npm run db:migrate:data
   ```

6. **Vérifier l'intégrité** :
   ```bash
   npm run db:check
   ```

## 🔍 Commandes utiles

| Commande | Description |
|----------|-------------|
| `npm run db:setup` | Démarre PostgreSQL avec Docker |
| `npm run db:migrate:dev -- --name <nom>` | Crée une nouvelle migration |
| `npm run db:migrate` | Applique les migrations (prod) |
| `npm run db:migrate:data` | Migre SQLite → PostgreSQL |
| `npm run db:check` | Vérifie l'intégrité |
| `npm run db:studio` | Ouvre Prisma Studio |
| `npm run prisma:generate` | Régénère le client Prisma |

## 🚀 Lancer l'application

Une fois la migration complète :

```bash
npm run dev
```

L'application devrait démarrer sur http://localhost:3000

## 📚 Documentation complète

- **Guide rapide** : [MIGRATION-POSTGRESQL-QUICK-START.md](MIGRATION-POSTGRESQL-QUICK-START.md)
- **Documentation complète** : [docs/MIGRATION-POSTGRESQL.md](docs/MIGRATION-POSTGRESQL.md)
- **Résumé technique** : [docs/RESUME-MIGRATION-POSTGRESQL.md](docs/RESUME-MIGRATION-POSTGRESQL.md)

## 🐛 Dépannage

### "Docker Desktop is not running"
Solution : Installez ou démarrez Docker Desktop

### "relation does not exist"
Solution : Exécutez `npm run db:migrate:dev -- --name init_postgres`

### "connection refused"
Solution : Vérifiez que PostgreSQL est démarré et que DATABASE_URL est correct

### Erreurs de migration de données
Solution : Consultez les rapports générés : `migration-report-*.json`

## ✅ Checklist finale

Avant de déployer en production :

- [ ] Tests locaux réussis
- [ ] Vérification d'intégrité OK
- [ ] Toutes les fonctionnalités testées
- [ ] Backup de la base SQLite actuelle
- [ ] DATABASE_URL configuré pour staging
- [ ] Tests sur staging
- [ ] DATABASE_URL configuré pour production
- [ ] Plan de rollback validé

## 🎉 Félicitations !

Une fois ces étapes terminées, votre application SmartImmo sera prête à utiliser PostgreSQL avec :
- Meilleures performances
- Gestion des verrous améliorée
- Scalabilité horizontale
- Features avancées PostgreSQL
