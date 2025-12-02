-- Migration pour Supabase : Ajout du champ paymentDay à la table Loan
-- À exécuter dans le SQL Editor de Supabase si nécessaire

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
        -- Ajouter la colonne paymentDay
        ALTER TABLE "Loan" ADD COLUMN "paymentDay" INTEGER;
        
        -- Ajouter un commentaire explicatif
        COMMENT ON COLUMN "Loan"."paymentDay" IS 'Jour du mois pour le paiement (1-31). Si NULL, utilise le jour de startDate';
        
        RAISE NOTICE 'Colonne paymentDay ajoutée avec succès';
    ELSE
        RAISE NOTICE 'La colonne paymentDay existe déjà';
    END IF;
END $$;

-- Optionnel : Ajouter une contrainte de validation
ALTER TABLE "Loan" 
ADD CONSTRAINT "Loan_paymentDay_check" 
CHECK ("paymentDay" IS NULL OR ("paymentDay" >= 1 AND "paymentDay" <= 31));

-- Vérifier le résultat
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'Loan' 
  AND column_name = 'paymentDay';

