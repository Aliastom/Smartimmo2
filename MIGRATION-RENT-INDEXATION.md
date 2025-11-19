# 📋 Migration : Table RentIndexation

## 🎯 Objectif

Créer la table `RentIndexation` pour gérer l'historique des réindexations de loyer.

## ✅ Méthode 1 : Script SQL manuel (Recommandé)

### Étape 1 : Accéder à Supabase SQL Editor

1. Connectez-vous à votre projet Supabase : https://supabase.com/dashboard
2. Allez dans **SQL Editor**
3. Créez une nouvelle requête

### Étape 2 : Exécuter le script SQL

Copiez-collez le contenu du fichier `prisma/migrations/manual_create_rent_indexation.sql` dans l'éditeur SQL et exécutez-le.

### Étape 3 : Vérifier

Vérifiez que la table a été créée :
```sql
SELECT * FROM "RentIndexation" LIMIT 1;
```

## ✅ Méthode 2 : Via Prisma (si connexion fonctionne)

Si vous avez accès à la base de données depuis votre machine locale :

```bash
# Option A : db push (sans migration)
npx prisma db push

# Option B : migrate deploy (pour production)
npx prisma migrate deploy
```

## 📊 Structure de la table

La table `RentIndexation` contient :
- **id** : Identifiant unique (CUID)
- **leaseId** : Référence au bail
- **organizationId** : Organisation propriétaire
- **previousRentAmount** : Ancien montant de loyer
- **newRentAmount** : Nouveau montant de loyer
- **effectiveDate** : Date d'effet de la réindexation
- **indexType** : Type d'indice (IRL, ILAT, ICC, MANUAL)
- **indexValue** : Valeur de l'indice utilisé
- **indexDate** : Date de référence de l'indice
- **reason** : Raison de la réindexation
- **notes** : Notes supplémentaires
- **createdAt** : Date de création
- **createdBy** : Utilisateur créateur

## 🔗 Relations

- **Lease** : Relation avec la table Lease (CASCADE on delete)
- **Organization** : Relation avec la table Organization

## ✅ Après la migration

Une fois la table créée, vous pouvez :
1. Utiliser l'API `/api/leases/[id]/index-rent` pour créer des réindexations
2. Ajouter l'UI dans `LeaseEditModal.tsx` (bouton + modal)

