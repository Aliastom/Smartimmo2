-- Migration manuelle : Ajout de organizationId à UserProfile
-- À appliquer quand la base de données sera accessible

-- 1. Ajouter la colonne organizationId avec valeur par défaut
ALTER TABLE "UserProfile" 
ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL DEFAULT 'default';

-- 2. Créer l'index pour améliorer les performances
CREATE INDEX IF NOT EXISTS "UserProfile_organizationId_idx" ON "UserProfile"("organizationId");

-- 3. Ajouter la contrainte de clé étrangère
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'UserProfile_organizationId_fkey'
    ) THEN
        ALTER TABLE "UserProfile"
        ADD CONSTRAINT "UserProfile_organizationId_fkey" 
        FOREIGN KEY ("organizationId") 
        REFERENCES "Organization"("id") 
        ON DELETE CASCADE;
    END IF;
END $$;

-- 4. S'assurer que l'organisation 'default' existe (si elle n'existe pas déjà)
INSERT INTO "Organization" ("id", "name", "slug", "createdAt", "updatedAt")
SELECT 'default', 'Organisation par défaut', 'default', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Organization" WHERE "id" = 'default');

-- Note : Les UserProfiles existants auront organizationId = 'default'
-- Vous pourrez les mettre à jour manuellement pour chaque utilisateur si nécessaire

