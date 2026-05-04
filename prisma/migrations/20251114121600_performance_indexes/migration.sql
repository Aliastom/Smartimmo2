-- Migration: Performance Indexes
-- Ajout d'index PostgreSQL pour optimiser les requêtes fréquentes
-- Note: Les index qui existent déjà dans le schéma Prisma ne sont pas créés ici

-- ============================================================================
-- INDEX POUR LES TRANSACTIONS
-- ============================================================================

-- Optimise les filtres par organizationId et nature (requêtes fréquentes)
CREATE INDEX IF NOT EXISTS idx_transaction_org_nature 
ON "Transaction"("organizationId", "nature");

-- Optimise les filtres combinés par organizationId et date (plus rapide qu'individuel)
CREATE INDEX IF NOT EXISTS idx_transaction_org_date 
ON "Transaction"("organizationId", "date");

-- Optimise les recherches par accounting_month (format YYYY-MM)
CREATE INDEX IF NOT EXISTS idx_transaction_org_accounting_month 
ON "Transaction"("organizationId", "accounting_month");

-- Optimise les filtres de rapprochement (WHERE rapprochementStatus IS NOT NULL)
CREATE INDEX IF NOT EXISTS idx_transaction_org_rapprochement 
ON "Transaction"("organizationId", "rapprochementStatus") 
WHERE "rapprochementStatus" IS NOT NULL;

-- Optimise les requêtes agrégées (calculs de totaux par nature)
CREATE INDEX IF NOT EXISTS idx_transaction_org_nature_amount 
ON "Transaction"("organizationId", "nature", "amount");

-- Note: parentTransactionId index existe déjà dans le schéma

-- ============================================================================
-- INDEX POUR LES BAUX (LEASES)
-- ============================================================================

-- Optimise les requêtes filtrées par statut et dates (dashboard, liste baux)
CREATE INDEX IF NOT EXISTS idx_lease_status_dates 
ON "Lease"("status", "startDate", "endDate");

-- Optimise les requêtes par organizationId et statut combinés
CREATE INDEX IF NOT EXISTS idx_lease_org_status 
ON "Lease"("organizationId", "status");

-- ============================================================================
-- INDEX POUR LES PROPRIÉTÉS
-- ============================================================================

-- Optimise les requêtes filtrées par organizationId et type
CREATE INDEX IF NOT EXISTS idx_property_org_type 
ON "Property"("organizationId", "type");

-- Optimise les recherches par ville (filtres géographiques)
CREATE INDEX IF NOT EXISTS idx_property_city 
ON "Property"("city") 
WHERE "city" IS NOT NULL;

-- ============================================================================
-- INDEX POUR LES PRÊTS
-- ============================================================================

-- Optimise les requêtes par organizationId et isActive combinés
CREATE INDEX IF NOT EXISTS idx_loan_org_active 
ON "Loan"("organizationId", "isActive");

-- ============================================================================
-- INDEX POUR LES ÉCHÉANCES
-- ============================================================================

-- Optimise les requêtes par propertyId et sens (revenus vs charges)
CREATE INDEX IF NOT EXISTS idx_echeance_property_sens 
ON "EcheanceRecurrente"("propertyId", "sens");

-- Optimise les requêtes pour les échéances actives uniquement
CREATE INDEX IF NOT EXISTS idx_echeance_active 
ON "EcheanceRecurrente"("isActive") 
WHERE "isActive" = true;

-- Note: DocumentLink indexes existent déjà dans le schéma (@@index([documentId]), @@index([linkedType, linkedId]))

