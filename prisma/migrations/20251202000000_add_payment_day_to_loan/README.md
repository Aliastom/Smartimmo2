# Migration : Ajout du champ paymentDay à la table Loan

**Date:** 2025-12-02  
**Type:** Ajout de colonne  
**Impact:** Faible - Colonne nullable, pas de données à migrer

## Description

Ajout du champ `paymentDay` (INTEGER, nullable) à la table `Loan` pour permettre de spécifier le jour du mois où les paiements d'échéances doivent être effectués.

## Comportement

- **Si `paymentDay` est NULL** : Le système utilise le jour de la `startDate` du prêt (comportement par défaut)
- **Si `paymentDay` est défini (1-31)** : Les échéances sont calculées pour ce jour spécifique de chaque mois

## Application en développement

Cette migration a déjà été appliquée en développement via `prisma db push` et marquée comme appliquée.

## Application en production (Supabase)

### Option 1 : Via Prisma Migrate (Recommandé)

```bash
npx prisma migrate deploy
```

### Option 2 : Manuellement via Supabase SQL Editor

1. Connectez-vous à votre dashboard Supabase
2. Allez dans **SQL Editor**
3. Exécutez le fichier `supabase_add_payment_day_to_loan.sql`

```sql
-- Vérifier si la colonne existe déjà
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'Loan' 
        AND column_name = 'paymentDay'
    ) THEN
        ALTER TABLE "Loan" ADD COLUMN "paymentDay" INTEGER;
        COMMENT ON COLUMN "Loan"."paymentDay" IS 'Jour du mois pour le paiement (1-31). Si NULL, utilise le jour de startDate';
        RAISE NOTICE 'Colonne paymentDay ajoutée avec succès';
    ELSE
        RAISE NOTICE 'La colonne paymentDay existe déjà';
    END IF;
END $$;
```

## Vérification

Pour vérifier que la migration a été appliquée :

```sql
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'Loan' 
  AND column_name = 'paymentDay';
```

Résultat attendu :
```
column_name | data_type | is_nullable | column_default
------------|-----------|-------------|---------------
paymentDay  | integer   | YES         | NULL
```

## Rollback

Si nécessaire, pour annuler cette migration :

```sql
ALTER TABLE "Loan" DROP COLUMN IF EXISTS "paymentDay";
```

⚠️ **Attention** : Cela supprimera toutes les valeurs de `paymentDay` enregistrées.

## Fichiers modifiés

- `prisma/schema.prisma` - Ajout du champ `paymentDay Int?` au modèle Loan
- `src/lib/finance/amortization.ts` - Prise en compte du paymentDay dans les calculs
- `src/components/loans/LoanModalV2.tsx` - Ajout du champ dans le formulaire
- `src/app/api/loans/route.ts` - Support de paymentDay dans l'API
- `src/app/api/loans/[id]/route.ts` - Support de paymentDay dans l'API

