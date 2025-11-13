# 🗄️ Migration vers PostgreSQL

## 📋 Vue d'ensemble

Ce document décrit la migration complète de SQLite vers PostgreSQL pour SmartImmo. Cette migration améliore la scalabilité, la gestion des verrous et les performances de la base de données.

## 🎯 Objectifs

1. ✅ Remplacer SQLite par PostgreSQL (local + staging + prod)
2. ✅ Générer les migrations Prisma sans perte de schéma
3. ✅ Migrer les données de SQLite → PostgreSQL
4. ✅ Mettre en place la CI/CD pour les migrations
5. ✅ Vérifier l'intégrité des données

## 📦 Prérequis

- Node.js 18+
- Docker et Docker Compose
- PostgreSQL 16+
- Accès à une base PostgreSQL de staging/prod

## 🚀 Installation locale

### 1. Démarrer PostgreSQL avec Docker

```bash
# Démarrer PostgreSQL
npm run db:setup

# Vérifier que PostgreSQL est opérationnel
docker ps | grep postgres
```

### 2. Configurer les variables d'environnement

Créez un fichier `.env.local`:

```bash
# Database
DATABASE_URL="postgresql://smartimmo:smartimmo@localhost:5432/smartimmo?schema=public"
```

### 3. Générer les migrations Prisma

```bash
# Générer le client Prisma
npm run prisma:generate

# Créer et appliquer la migration initiale
npm run db:migrate:dev -- --name init_postgres
```

### 4. Migrer les données SQLite → PostgreSQL

```bash
# Préparer la base SQLite (assurez-vous qu'elle existe)
# DATABASE_URL pointe vers SQLite dans .env initialement

# Migrer les données
npm run db:migrate:data

# Vérifier l'intégrité
npm run db:check
```

## 📊 Structure des données

### Ordre de migration (topologique)

Les tables sont migrées dans l'ordre suivant pour respecter les contraintes de clés étrangères:

1. Tables sans dépendances: `Landlord`, `UserProfile`, `TaxConfig`, etc.
2. Données utilisateur: `Tenant`, `Property`
3. Relations: `OccupancyHistory`, `Lease`, `Loan`, `Transaction`
4. Documents et médias: `Photo`, `Document`, `DocumentLink`
5. Logs: `EmailLog`

### Préservation des IDs

Les IDs d'origine (CUID) sont préservés pendant la migration pour maintenir les relations entre les tables.

## ✅ Vérification d'intégrité

Le script de vérification compare:

- **Comptages**: Nombre d'enregistrements dans chaque table
- **Échantillons**: 20 enregistrements aléatoires par table
- **Champs**: Vérification des différences (excluant `updatedAt`)

```bash
npm run db:check
```

Le script génère un rapport JSON avec:
- Comptages SQLite vs PostgreSQL
- Détails des échantillons vérifiés
- Différences détectées

## 🔄 CI/CD

### Staging/Production

Les migrations sont appliquées automatiquement au déploiement:

```yaml
# Exemple GitHub Actions
- name: Deploy migrations
  run: npm run db:migrate
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

### Pipeline de déploiement

1. Build de l'application
2. **Applique les migrations**: `npm run db:migrate`
3. **Vérifie la santé**: Healthcheck database
4. Déploie l'application

## 📝 Scripts disponibles

| Script | Description |
|--------|-------------|
| `npm run db:setup` | Démarre PostgreSQL avec Docker |
| `npm run db:migrate` | Applique les migrations (prod) |
| `npm run db:migrate:dev` | Crée et applique une nouvelle migration (dev) |
| `npm run db:migrate:data` | Migre les données SQLite → PostgreSQL |
| `npm run db:check` | Vérifie l'intégrité des données |
| `npm run db:studio` | Ouvre Prisma Studio |

## 🔐 Sécurité

### Variables d'environnement

- **Development**: `.env.local`
- **Staging**: Variables d'environnement Vercel/Hosting
- **Production**: Variables d'environnement sécurisées

### Connexion sécurisée

Pour utiliser SSL avec PostgreSQL:

```bash
DATABASE_URL="postgresql://user:pass@host:5432/db?schema=public&sslmode=require"
```

## 🔄 Rollback

### Plan de rollback

1. **Sauvegarde avant migration**: `pg_dump` de la base PostgreSQL
2. **Restaurer snapshot**: `pg_restore` depuis la sauvegarde
3. **Rouvrir version précédente**: Revert du commit

### Commandes de sauvegarde

```bash
# Créer une sauvegarde
pg_dump -h localhost -U smartimmo -d smartimmo > backup-$(date +%Y%m%d).sql

# Restaurer une sauvegarde
psql -h localhost -U smartimmo -d smartimmo < backup-YYYYMMDD.sql
```

### Sauvegardes automatiques (production)

Configurer des sauvegardes quotidiennes via:
- pg_dump avec cron (serveur dédié)
- Scripts automatisés (Supabase/Render/AWS RDS)

## 📈 Performances

### Index ajoutés

- `Transaction(date)` - Requêtes par date
- `Transaction(propertyId, date)` - Requêtes par bien et date
- `Document(propertyId, leaseId, transactionId)` - Requêtes par contexte

### Optimisations

- **Connection pooling**: Utiliser pgBouncer ou Prisma connection pooling
- **Index composites**: Pour les requêtes fréquentes
- **Partitionnement**: Pour les tables volumineuses (future)

## 🐛 Dépannage

### Erreur: "relation does not exist"

```bash
# Vérifier que les migrations ont été appliquées
npm run db:migrate

# Vérifier les tables
docker exec -it smartimmo-postgres psql -U smartimmo -d smartimmo -c "\dt"
```

### Erreur: "connection refused"

```bash
# Vérifier que PostgreSQL est démarré
docker ps | grep postgres

# Vérifier les logs
docker logs smartimmo-postgres

# Redémarrer si nécessaire
docker restart smartimmo-postgres
```

### Erreur: "duplicate key value violates unique constraint"

Les IDs existent déjà dans PostgreSQL. Options:

1. **Vider la base** (⚠️ DESTRUCTIF):
   ```bash
   npx prisma migrate reset
   npm run db:migrate:data
   ```

2. **Ignorer les doublons** dans le script de migration (activé par défaut)

## 📚 Ressources

- [Documentation Prisma Migrate](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Documentation PostgreSQL](https://www.postgresql.org/docs/)
- [Prisma avec PostgreSQL](https://www.prisma.io/docs/concepts/database-connectors/postgresql)

## ✅ Checklist de migration

- [ ] PostgreSQL local démarré
- [ ] Variables d'environnement configurées
- [ ] Migrations Prisma générées
- [ ] Données migrées
- [ ] Intégrité vérifiée
- [ ] Application testée localement
- [ ] CI/CD configurée pour staging
- [ ] Migration staging effectuée
- [ ] Tests sur staging
- [ ] Migration production planifiée
- [ ] Plan de rollback testé
- [ ] Sauvegardes automatisées configurées
