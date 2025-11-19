-- Migration manuelle : Création de la table RentIndexation
-- À exécuter directement dans Supabase SQL Editor ou via psql

-- Créer la table RentIndexation
CREATE TABLE IF NOT EXISTS "RentIndexation" (
    "id" TEXT NOT NULL,
    "leaseId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL DEFAULT 'default',
    "previousRentAmount" DOUBLE PRECISION NOT NULL,
    "newRentAmount" DOUBLE PRECISION NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "indexType" TEXT,
    "indexValue" DOUBLE PRECISION,
    "indexDate" TIMESTAMP(3),
    "reason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "RentIndexation_pkey" PRIMARY KEY ("id")
);

-- Créer les index
CREATE INDEX IF NOT EXISTS "RentIndexation_leaseId_effectiveDate_idx" ON "RentIndexation"("leaseId", "effectiveDate");
CREATE INDEX IF NOT EXISTS "RentIndexation_organizationId_idx" ON "RentIndexation"("organizationId");

-- Ajouter les contraintes de clé étrangère
ALTER TABLE "RentIndexation" ADD CONSTRAINT "RentIndexation_leaseId_fkey" 
    FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RentIndexation" ADD CONSTRAINT "RentIndexation_organizationId_fkey" 
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

