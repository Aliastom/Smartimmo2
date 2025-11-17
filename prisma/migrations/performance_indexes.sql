-- Index PostgreSQL pour optimiser les performances
-- À appliquer manuellement sur la base de données de production

-- Index pour les transactions (requêtes fréquentes)
-- Optimise les filtres par organizationId et nature
CREATE INDEX IF NOT EXISTS idx_transaction_org_nature 
ON "Transaction"("organizationId", "nature");

-- Optimise les filtres par organizationId et date
CREATE INDEX IF NOT EXISTS idx_transaction_org_date 
ON "Transaction"("organizationId", "date");

-- Optimise les recherches par accounting_month
CREATE INDEX IF NOT EXISTS idx_transaction_org_accounting_month 
ON "Transaction"("organizationId", "accounting_month");

-- Optimise les filtres de rapprochement
CREATE INDEX IF NOT EXISTS idx_transaction_org_rapprochement 
ON "Transaction"("organizationId", "rapprochementStatus") 
WHERE "rapprochementStatus" IS NOT NULL;

-- Optimise les recherches par parentTransactionId (groupage)
CREATE INDEX IF NOT EXISTS idx_transaction_parent_id 
ON "Transaction"("parentTransactionId") 
WHERE "parentTransactionId" IS NOT NULL;

-- Note: DocumentLink indexes existent déjà dans le schéma Prisma
-- @@index([documentId])
-- @@index([linkedType, linkedId])

-- Index pour les baux
-- Optimise les requêtes filtrées par statut et dates
CREATE INDEX IF NOT EXISTS idx_lease_status_dates 
ON "Lease"("status", "startDate", "endDate");

-- Optimise les requêtes par organizationId et statut
CREATE INDEX IF NOT EXISTS idx_lease_org_status 
ON "Lease"("organizationId", "status");

-- Index pour les propriétés
-- Optimise les requêtes filtrées par organizationId et type
CREATE INDEX IF NOT EXISTS idx_property_org_type 
ON "Property"("organizationId", "type");

-- Optimise les recherches par ville
CREATE INDEX IF NOT EXISTS idx_property_city 
ON "Property"("city") 
WHERE "city" IS NOT NULL;

-- Index pour les prêts
-- Optimise les requêtes par organizationId et isActive
CREATE INDEX IF NOT EXISTS idx_loan_org_active 
ON "Loan"("organizationId", "isActive");

-- Index pour les échéances
-- Optimise les requêtes par propertyId et sens
CREATE INDEX IF NOT EXISTS idx_echeance_property_sens 
ON "Echeance"("propertyId", "sens");

-- Optimise les requêtes par active
CREATE INDEX IF NOT EXISTS idx_echeance_active 
ON "Echeance"("active") 
WHERE "active" = true;

-- Index composites pour les requêtes agrégées fréquentes
-- Optimise les calculs de totaux par nature et organizationId
CREATE INDEX IF NOT EXISTS idx_transaction_org_nature_amount 
ON "Transaction"("organizationId", "nature", "amount");

-- Note: Ces index peuvent être appliqués via psql ou Prisma Studio
-- Exemple: psql -d smartimmo -f prisma/migrations/performance_indexes.sql

