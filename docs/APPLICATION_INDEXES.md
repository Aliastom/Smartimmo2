# 📊 Application des Index PostgreSQL - Guide Rapide

**Migration :** `prisma/migrations/20250116184513_performance_indexes/migration.sql`  
**11 index** pour optimiser les performances des requêtes fréquentes

---

## 🚀 Application de la Migration

### Option 1 : Via Prisma Migrate (Recommandé)

**En développement :**
```bash
npm run db:migrate:dev
```

**En production :**
```bash
npm run db:migrate
```

La migration sera détectée automatiquement et appliquée.

### Option 2 : Via Script Node.js

```bash
tsx scripts/apply-performance-indexes.ts
```

### Option 3 : Via SQL Direct

Si vous avez accès direct à la base PostgreSQL :

```bash
# Via psql
psql -d smartimmo -f prisma/migrations/20250116184513_performance_indexes/migration.sql

# Ou via Prisma Studio
# Ouvrir Prisma Studio, puis copier/coller le contenu de la migration
```

---

## 📋 Index Créés

### Transactions (5 index)
- `idx_transaction_org_nature` - Filtres par organisation + nature
- `idx_transaction_org_date` - Filtres par organisation + date
- `idx_transaction_org_accounting_month` - Recherches par mois comptable
- `idx_transaction_org_rapprochement` - Filtres de rapprochement
- `idx_transaction_org_nature_amount` - Calculs agrégés (totaux)

### Leases (2 index)
- `idx_lease_status_dates` - Filtres par statut + dates
- `idx_lease_org_status` - Filtres par organisation + statut

### Properties (2 index)
- `idx_property_org_type` - Filtres par organisation + type
- `idx_property_city` - Recherches par ville

### Loans (1 index)
- `idx_loan_org_active` - Filtres par organisation + actif

### Echeances (2 index)
- `idx_echeance_property_sens` - Filtres par bien + sens (revenus/charges)
- `idx_echeance_active` - Filtres sur échéances actives uniquement

---

## ✅ Vérification

Après application, vérifier que les index ont été créés :

```sql
-- Lister tous les index sur Transaction
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'Transaction' 
AND indexname LIKE 'idx_%';

-- Lister tous les index créés
SELECT indexname, tablename 
FROM pg_indexes 
WHERE indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
```

---

## 📈 Impact Attendu

- **Requêtes de transactions :** -40% à -60% de temps d'exécution
- **Listes de baux :** -30% à -50% de temps d'exécution
- **Recherches de propriétés :** -50% à -70% de temps d'exécution
- **Calculs agrégés :** -60% à -80% de temps d'exécution

---

**Note :** Les index DocumentLink existent déjà dans le schéma Prisma et n'ont pas besoin d'être créés.

