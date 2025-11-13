-- ================================================================
-- SMARTIMMO - VUES ANALYTIQUES V1
-- Adaptées au schéma Prisma existant
-- ================================================================

-- ================================================================
-- 1) VUE : v_loyers_encaissements_mensuels
--    Total encaissé / total des loyers par mois, par bien et bail
-- ================================================================
CREATE OR REPLACE VIEW v_loyers_encaissements_mensuels AS
SELECT
  DATE_TRUNC('month', t.date)::date AS mois,
  t."propertyId",
  t."leaseId",
  COALESCE(SUM(CASE 
    WHEN t.nature IN ('LOYER', 'LOYER_BASE') 
    AND t."paidAt" IS NOT NULL 
    THEN t.amount 
  END), 0)::numeric(14,2) AS loyer_encaisse,
  COALESCE(SUM(CASE 
    WHEN t.nature IN ('LOYER', 'LOYER_BASE') 
    THEN t.amount 
  END), 0)::numeric(14,2) AS loyer_total,
  COUNT(DISTINCT t."leaseId") AS nb_baux
FROM "Transaction" t
WHERE t.amount > 0 -- Seulement les recettes
GROUP BY 1, 2, 3;

COMMENT ON VIEW v_loyers_encaissements_mensuels IS 'Encaissements de loyers par mois (encaissé vs total), par bien et par bail.';

-- ================================================================
-- 2) VUE : v_loyers_a_encaisser_courant
--    Loyers attendus vs déjà payés sur le mois courant
-- ================================================================
CREATE OR REPLACE VIEW v_loyers_a_encaisser_courant AS
WITH paye AS (
  SELECT
    t."leaseId",
    COALESCE(SUM(CASE 
      WHEN t.nature IN ('LOYER', 'LOYER_BASE')
      AND t."paidAt" IS NOT NULL
      AND DATE_TRUNC('month', t.date) = DATE_TRUNC('month', NOW())
      THEN t.amount 
    END), 0)::numeric(14,2) AS deja_paye
  FROM "Transaction" t
  GROUP BY 1
)
SELECT
  l.id AS lease_id,
  l."propertyId" AS property_id,
  l."tenantId" AS tenant_id,
  p.name AS property_name,
  t."firstName" || ' ' || t."lastName" AS tenant_name,
  t.email AS tenant_email,
  DATE_TRUNC('month', NOW())::date AS mois,
  COALESCE(l."rentAmount", 0)::numeric(14,2) AS loyer_du,
  COALESCE(paye.deja_paye, 0)::numeric(14,2) AS deja_paye,
  GREATEST(COALESCE(l."rentAmount", 0) - COALESCE(paye.deja_paye, 0), 0)::numeric(14,2) AS reste_a_payer,
  CASE
    WHEN COALESCE(paye.deja_paye, 0) >= COALESCE(l."rentAmount", 0) THEN 'PAYE'
    WHEN COALESCE(paye.deja_paye, 0) > 0 THEN 'PARTIEL'
    ELSE 'IMPAYE'
  END AS statut
FROM "Lease" l
INNER JOIN "Property" p ON p.id = l."propertyId"
INNER JOIN "Tenant" t ON t.id = l."tenantId"
LEFT JOIN paye ON paye."leaseId" = l.id
WHERE l.status IN ('ACTIF', 'SIGNE', 'EN_COURS');

COMMENT ON VIEW v_loyers_a_encaisser_courant IS 'Loyers dus vs payés pour le mois courant, par bail avec infos locataire.';

-- ================================================================
-- 3) VUE : v_echeances_3_mois
--    Échéances sur 90 jours : indexations baux + prêts (mensualités)
-- ================================================================
CREATE OR REPLACE VIEW v_echeances_3_mois AS
-- Indexations baux (anniversaire du bail)
SELECT
  'INDEXATION_BAIL'::text AS type,
  l."propertyId" AS property_id,
  l.id AS ref_id,
  p.name AS property_name,
  l."rentAmount" AS montant_actuel,
  -- Calculer le prochain anniversaire
  CASE
    WHEN MAKE_DATE(EXTRACT(YEAR FROM NOW())::int, EXTRACT(MONTH FROM l."startDate")::int, EXTRACT(DAY FROM l."startDate")::int) >= CURRENT_DATE
    THEN MAKE_DATE(EXTRACT(YEAR FROM NOW())::int, EXTRACT(MONTH FROM l."startDate")::int, EXTRACT(DAY FROM l."startDate")::int)
    ELSE MAKE_DATE(EXTRACT(YEAR FROM NOW())::int + 1, EXTRACT(MONTH FROM l."startDate")::int, EXTRACT(DAY FROM l."startDate")::int)
  END AS due_date,
  l."indexationType" AS meta_code,
  'Indexation bail (anniversaire ' || TO_CHAR(l."startDate", 'DD/MM') || ')' AS description
FROM "Lease" l
INNER JOIN "Property" p ON p.id = l."propertyId"
WHERE l.status IN ('ACTIF', 'SIGNE', 'EN_COURS')
  AND l."indexationType" IS NOT NULL
  AND l."indexationType" != 'NONE'
  AND CASE
    WHEN MAKE_DATE(EXTRACT(YEAR FROM NOW())::int, EXTRACT(MONTH FROM l."startDate")::int, EXTRACT(DAY FROM l."startDate")::int) >= CURRENT_DATE
    THEN MAKE_DATE(EXTRACT(YEAR FROM NOW())::int, EXTRACT(MONTH FROM l."startDate")::int, EXTRACT(DAY FROM l."startDate")::int)
    ELSE MAKE_DATE(EXTRACT(YEAR FROM NOW())::int + 1, EXTRACT(MONTH FROM l."startDate")::int, EXTRACT(DAY FROM l."startDate")::int)
  END <= (CURRENT_DATE + INTERVAL '90 days')

UNION ALL

-- Échéances de prêts (mensualités projetées sur 3 mois)
SELECT
  'PRET'::text AS type,
  ln."propertyId" AS property_id,
  ln.id AS ref_id,
  p.name AS property_name,
  -- Calcul mensualité (approximation si pas stockée)
  CASE
    WHEN ln."annualRatePct" = 0 THEN (ln.principal / ln."durationMonths")::numeric(14,2)
    ELSE ROUND(
      (ln.principal * ((ln."annualRatePct" / 100 / 12) * POWER(1 + (ln."annualRatePct" / 100 / 12), ln."durationMonths"))) 
      / (POWER(1 + (ln."annualRatePct" / 100 / 12), ln."durationMonths") - 1),
      2
    )
  END AS montant_actuel,
  DATE_TRUNC('month', gs.mois)::date AS due_date,
  'MENSUALITE'::text AS meta_code,
  'Mensualité prêt ' || ln.label AS description
FROM "Loan" ln
INNER JOIN "Property" p ON p.id = ln."propertyId"
CROSS JOIN LATERAL (
  SELECT generate_series(
    DATE_TRUNC('month', GREATEST(ln."startDate", NOW())),
    DATE_TRUNC('month', LEAST(COALESCE(ln."endDate", NOW() + INTERVAL '10 years'), NOW() + INTERVAL '3 months')),
    INTERVAL '1 month'
  ) AS mois
) gs
WHERE ln."isActive" = true
  AND COALESCE(ln."endDate", NOW() + INTERVAL '100 years') >= NOW();

COMMENT ON VIEW v_echeances_3_mois IS 'Échéances à 3 mois : indexations baux (anniversaire) + mensualités prêts.';

-- ================================================================
-- 4) VUE : v_prets_statut
--    Statut des prêts : CRD, mensualité, date fin
-- ================================================================
CREATE OR REPLACE VIEW v_prets_statut AS
WITH loan_calc AS (
  SELECT
    ln.id,
    ln."propertyId",
    ln.label,
    ln.principal,
    ln."annualRatePct",
    ln."durationMonths",
    ln."startDate",
    ln."endDate",
    ln."isActive",
    -- Mensualité calculée
    CASE
      WHEN ln."annualRatePct" = 0 THEN (ln.principal / ln."durationMonths")
      ELSE (ln.principal * ((ln."annualRatePct" / 100 / 12) * POWER(1 + (ln."annualRatePct" / 100 / 12), ln."durationMonths"))) 
           / (POWER(1 + (ln."annualRatePct" / 100 / 12), ln."durationMonths") - 1)
    END AS mensualite_calculee,
    -- Mois écoulés
    EXTRACT(YEAR FROM AGE(CURRENT_DATE, ln."startDate")) * 12 + 
    EXTRACT(MONTH FROM AGE(CURRENT_DATE, ln."startDate")) AS mois_ecoules
  FROM "Loan" ln
)
SELECT
  lc.id AS loan_id,
  lc."propertyId" AS property_id,
  p.name AS property_name,
  lc.label,
  lc.principal::numeric(14,2) AS capital_initial,
  lc."annualRatePct"::numeric(6,3) AS taux_annuel,
  -- Capital restant dû (approximation linéaire)
  CASE
    WHEN lc.mois_ecoules >= lc."durationMonths" THEN 0
    ELSE ROUND(lc.principal * (1 - (lc.mois_ecoules::numeric / lc."durationMonths")), 2)
  END::numeric(14,2) AS capital_restant_du,
  ROUND(lc.mensualite_calculee, 2)::numeric(14,2) AS mensualite,
  lc."startDate" AS date_debut,
  lc."endDate" AS date_fin,
  (lc."durationMonths" - lc.mois_ecoules)::int AS mois_restants,
  lc."isActive" AS actif
FROM loan_calc lc
INNER JOIN "Property" p ON p.id = lc."propertyId";

COMMENT ON VIEW v_prets_statut IS 'Statut prêts : CRD (approximation), mensualité calculée, date de fin.';

-- ================================================================
-- 5) VUE : v_documents_statut
--    Documents reçus/manquants par période & type
-- ================================================================
CREATE OR REPLACE VIEW v_documents_statut AS
SELECT
  d."propertyId" AS property_id,
  d."leaseId" AS lease_id,
  dt.code AS type_code,
  dt.label AS type_label,
  TO_CHAR(d."uploadedAt", 'YYYY-MM') AS periode,
  EXTRACT(YEAR FROM d."uploadedAt")::int AS annee,
  EXTRACT(MONTH FROM d."uploadedAt")::int AS mois,
  d."ocrStatus" AS ocr_status,
  d.status,
  COUNT(*) AS nb_documents
FROM "Document" d
INNER JOIN "DocumentType" dt ON dt.id = d."documentTypeId"
WHERE d."deletedAt" IS NULL
GROUP BY 1, 2, 3, 4, 5, 6, 7, 8, 9;

COMMENT ON VIEW v_documents_statut IS 'Statut des documents par type/période (reçu, à classer, etc.).';

-- ================================================================
-- 6) VUE : v_cashflow_global
--    Vue de synthèse : entrées vs sorties par mois
-- ================================================================
CREATE OR REPLACE VIEW v_cashflow_global AS
SELECT
  DATE_TRUNC('month', t.date)::date AS mois,
  t."propertyId" AS property_id,
  p.name AS property_name,
  SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END)::numeric(14,2) AS entrees,
  SUM(CASE WHEN t.amount < 0 THEN ABS(t.amount) ELSE 0 END)::numeric(14,2) AS sorties,
  SUM(t.amount)::numeric(14,2) AS solde_net
FROM "Transaction" t
INNER JOIN "Property" p ON p.id = t."propertyId"
GROUP BY 1, 2, 3
ORDER BY 1 DESC, 3;

COMMENT ON VIEW v_cashflow_global IS 'Cashflow global : entrées, sorties, solde par mois et par bien.';

-- ================================================================
-- INDICES SUGGÉRÉS (si pas déjà créés)
-- ================================================================
CREATE INDEX IF NOT EXISTS idx_transaction_date ON "Transaction"(date);
CREATE INDEX IF NOT EXISTS idx_transaction_paidat ON "Transaction"("paidAt") WHERE "paidAt" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transaction_lease ON "Transaction"("leaseId") WHERE "leaseId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transaction_property ON "Transaction"("propertyId");
CREATE INDEX IF NOT EXISTS idx_lease_status ON "Lease"(status);
CREATE INDEX IF NOT EXISTS idx_document_uploaded ON "Document"("uploadedAt") WHERE "deletedAt" IS NULL;
CREATE INDEX IF NOT EXISTS idx_loan_active ON "Loan"("isActive") WHERE "isActive" = true;

-- ================================================================
-- FIN DES VUES ANALYTIQUES
-- ================================================================

