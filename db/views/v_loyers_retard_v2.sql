-- ============================================
-- VUE : v_loyers_en_retard (V2)
-- Basée sur accounting_month + nature configurée
-- Implémente la logique exacte de détection des retards
-- ============================================

CREATE OR REPLACE VIEW v_loyers_en_retard AS
WITH 
  -- 1. Récupérer la nature du loyer depuis la config
  rent_nature AS (
    SELECT value as nature_loyer
    FROM "AppConfig"
    WHERE key = 'rentNature'
    LIMIT 1
  ),
  
  -- 2. Baux actifs
  active_leases AS (
    SELECT 
      l.id as lease_id,
      l."propertyId",
      l."tenantId",
      l."startDate",
      l."endDate",
      l."rentAmount"
    FROM "Lease" l
    WHERE l.status = 'ACTIF'
      AND l."startDate" <= CURRENT_DATE
      AND (l."endDate" IS NULL OR l."endDate" >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month')
  ),
  
  -- 3. Générer tous les mois attendus pour chaque bail (depuis startDate jusqu'au mois dernier)
  expected_months AS (
    SELECT 
      al.lease_id,
      al."propertyId",
      al."tenantId",
      al."rentAmount",
      TO_CHAR(gs.mois, 'YYYY-MM') as accounting_month,
      gs.mois as month_date,
      DATE_TRUNC('month', gs.mois) + INTERVAL '1 month' - INTERVAL '1 day' as end_of_month
    FROM active_leases al
    CROSS JOIN LATERAL (
      SELECT generate_series(
        DATE_TRUNC('month', al."startDate"),
        DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month', -- Exclure le mois en cours
        INTERVAL '1 month'
      ) as mois
    ) gs
  ),
  
  -- 4. Transactions payées (avec la nature du loyer)
  paid_transactions AS (
    SELECT DISTINCT
      t."leaseId",
      t.accounting_month
    FROM "Transaction" t
    CROSS JOIN rent_nature rn
    WHERE t."leaseId" IS NOT NULL
      AND t.nature = rn.nature_loyer
      AND t."paidAt" IS NOT NULL
      AND t.accounting_month IS NOT NULL
  ),
  
  -- 5. Identifier les mois impayés
  unpaid_months AS (
    SELECT 
      em.lease_id,
      em."propertyId",
      em."tenantId",
      em."rentAmount",
      em.accounting_month,
      em.end_of_month,
      -- Calcul du retard en jours
      EXTRACT(DAY FROM (CURRENT_DATE - em.end_of_month))::INTEGER as retard_jours
    FROM expected_months em
    LEFT JOIN paid_transactions pt 
      ON pt."leaseId" = em.lease_id 
      AND pt.accounting_month = em.accounting_month
    WHERE pt.accounting_month IS NULL -- Aucune transaction payée trouvée
  )

-- 6. Résultat final avec infos enrichies
SELECT 
  um.lease_id,
  um."propertyId",
  p.name as property_name,
  um."tenantId",
  t."firstName" || ' ' || t."lastName" as tenant_name,
  t.email as tenant_email,
  um.accounting_month,
  um."rentAmount" as loyer_du,
  um.retard_jours,
  CASE
    WHEN um.retard_jours > 90 THEN 'URGENT'
    WHEN um.retard_jours > 30 THEN 'IMPORTANT'
    ELSE 'RECENT'
  END as priorite,
  um.end_of_month as fin_mois
FROM unpaid_months um
INNER JOIN "Property" p ON p.id = um."propertyId"
INNER JOIN "Tenant" t ON t.id = um."tenantId"
ORDER BY um.retard_jours DESC, um.accounting_month;

COMMENT ON VIEW v_loyers_en_retard IS 'Loyers en retard basés sur accounting_month + nature configurée + paidAt. Inclut TOUS les mois impayés depuis le début du bail.';

