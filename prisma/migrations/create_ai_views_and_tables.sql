-- ============================================
-- SMARTIMMO - Migration AI Agent V3+
-- Vues analytiques + Tables de mémoire AI
-- ============================================

-- ============================================
-- PARTIE 1: TABLES POUR L'AGENT IA
-- ============================================

-- Table des sessions de chat
CREATE TABLE IF NOT EXISTS ai_chat_sessions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL DEFAULT 'default',
  context_json TEXT, -- JSON avec route, propertyId, leaseId, etc.
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_activity TIMESTAMP NOT NULL DEFAULT NOW(),
  meta_json TEXT -- JSON pour metadata additionnelle
);

CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_user_id ON ai_chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_created_at ON ai_chat_sessions(created_at);

-- Table des messages (historique de conversation)
CREATE TABLE IF NOT EXISTS ai_messages (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  session_id TEXT NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- 'user' | 'assistant' | 'system' | 'tool'
  content TEXT NOT NULL,
  tool_calls_json TEXT, -- JSON array des appels d'outils
  tool_results_json TEXT, -- JSON array des résultats d'outils
  tokens_used INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  correlation_id TEXT -- Pour tracer les appels bout-en-bout
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_session_id ON ai_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_created_at ON ai_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_messages_correlation_id ON ai_messages(correlation_id);

-- Table des logs d'outils (observabilité)
CREATE TABLE IF NOT EXISTS ai_tool_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  message_id TEXT REFERENCES ai_messages(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  args_json TEXT NOT NULL,
  result_json TEXT,
  duration_ms INTEGER,
  ok BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  correlation_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_ai_tool_logs_tool_name ON ai_tool_logs(tool_name);
CREATE INDEX IF NOT EXISTS idx_ai_tool_logs_created_at ON ai_tool_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_tool_logs_correlation_id ON ai_tool_logs(correlation_id);

-- ============================================
-- PARTIE 2: VUES ANALYTIQUES
-- ============================================

-- Vue 1: Cashflow mensuel
-- Agrège loyers encaissés, charges payées, solde par bien et global
CREATE OR REPLACE VIEW vw_cashflow_month AS
WITH monthly_transactions AS (
  SELECT
    EXTRACT(YEAR FROM date)::INTEGER AS year,
    EXTRACT(MONTH FROM date)::INTEGER AS month,
    "propertyId",
    SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS total_credits,
    SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END) AS total_debits,
    SUM(amount) AS net_balance
  FROM "Transaction"
  WHERE "paidAt" IS NOT NULL -- Seulement les transactions payées
  GROUP BY EXTRACT(YEAR FROM date), EXTRACT(MONTH FROM date), "propertyId"
)
SELECT
  year,
  month,
  "propertyId",
  p.name AS property_name,
  total_credits AS loyers_encaisses,
  ABS(total_debits) AS charges_payees,
  net_balance AS solde,
  TO_DATE(year || '-' || LPAD(month::TEXT, 2, '0') || '-01', 'YYYY-MM-DD') AS period_date
FROM monthly_transactions mt
JOIN "Property" p ON p.id = mt."propertyId"
ORDER BY year DESC, month DESC, property_name;

-- Vue 2: Loyers dus et impayés
-- Liste les loyers attendus vs reçus avec retard calculé
CREATE OR REPLACE VIEW vw_rent_due AS
WITH expected_rents AS (
  SELECT
    l.id AS lease_id,
    l."propertyId",
    l."tenantId",
    l."rentAmount",
    EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER AS year,
    EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER AS month,
    CURRENT_DATE AS reference_date
  FROM "Lease" l
  WHERE l.status IN ('ACTIF', 'EN_COURS', 'SIGNE')
    AND l."startDate" <= CURRENT_DATE
    AND (l."endDate" IS NULL OR l."endDate" >= CURRENT_DATE)
),
actual_payments AS (
  SELECT
    t."leaseId",
    EXTRACT(YEAR FROM t.date)::INTEGER AS year,
    EXTRACT(MONTH FROM t.date)::INTEGER AS month,
    SUM(t.amount) AS amount_paid,
    MAX(t."paidAt") AS last_paid_at
  FROM "Transaction" t
  WHERE t."leaseId" IS NOT NULL
    AND t."paidAt" IS NOT NULL
    AND t.amount > 0
  GROUP BY t."leaseId", EXTRACT(YEAR FROM t.date), EXTRACT(MONTH FROM t.date)
)
SELECT
  er.lease_id,
  er."propertyId",
  p.name AS property_name,
  er."tenantId",
  t."firstName" || ' ' || t."lastName" AS tenant_name,
  t.email AS tenant_email,
  er."rentAmount" AS expected_amount,
  COALESCE(ap.amount_paid, 0) AS paid_amount,
  er."rentAmount" - COALESCE(ap.amount_paid, 0) AS balance_due,
  CASE
    WHEN COALESCE(ap.amount_paid, 0) >= er."rentAmount" THEN 'PAID'
    WHEN COALESCE(ap.amount_paid, 0) > 0 THEN 'PARTIAL'
    ELSE 'DUE'
  END AS status,
  CASE
    WHEN ap.last_paid_at IS NULL THEN EXTRACT(DAY FROM (CURRENT_DATE - DATE_TRUNC('month', CURRENT_DATE)))::INTEGER
    ELSE EXTRACT(DAY FROM (CURRENT_DATE - ap.last_paid_at))::INTEGER
  END AS days_late,
  er.year,
  er.month
FROM expected_rents er
JOIN "Property" p ON p.id = er."propertyId"
JOIN "Tenant" t ON t.id = er."tenantId"
LEFT JOIN actual_payments ap ON ap."leaseId" = er.lease_id AND ap.year = er.year AND ap.month = er.month
WHERE COALESCE(ap.amount_paid, 0) < er."rentAmount" -- Seulement les impayés/partiels
ORDER BY balance_due DESC, days_late DESC;

-- Vue 3: Statut des prêts
-- Calcule CRD (capital restant dû), mensualité, date fin pour chaque prêt
CREATE OR REPLACE VIEW vw_loan_status AS
WITH loan_calculations AS (
  SELECT
    id,
    "propertyId",
    label,
    principal::NUMERIC AS principal,
    "annualRatePct"::NUMERIC AS annual_rate,
    "durationMonths",
    "startDate",
    "endDate",
    "insurancePct"::NUMERIC AS insurance_rate,
    "isActive",
    -- Calcul mensualité simple (formule standard)
    CASE
      WHEN "annualRatePct" = 0 THEN (principal / "durationMonths")
      ELSE (principal * (("annualRatePct" / 100 / 12) * POWER(1 + ("annualRatePct" / 100 / 12), "durationMonths"))) 
           / (POWER(1 + ("annualRatePct" / 100 / 12), "durationMonths") - 1)
    END AS monthly_payment_base,
    -- Assurance mensuelle
    CASE 
      WHEN "insurancePct" IS NOT NULL THEN (principal * ("insurancePct" / 100 / 12))
      ELSE 0
    END AS monthly_insurance,
    -- Nombre de mois écoulés
    EXTRACT(YEAR FROM AGE(CURRENT_DATE, "startDate")) * 12 + EXTRACT(MONTH FROM AGE(CURRENT_DATE, "startDate")) AS months_elapsed
  FROM "Loan"
)
SELECT
  lc.id,
  lc."propertyId",
  p.name AS property_name,
  lc.label,
  lc.principal AS initial_principal,
  lc.annual_rate,
  lc."durationMonths" AS total_duration_months,
  lc."startDate",
  lc."endDate",
  ROUND(lc.monthly_payment_base + lc.monthly_insurance, 2) AS monthly_payment_total,
  ROUND(lc.monthly_payment_base, 2) AS monthly_payment_principal_interest,
  ROUND(lc.monthly_insurance, 2) AS monthly_payment_insurance,
  -- Capital restant dû simplifié (approximation linéaire)
  CASE
    WHEN lc.months_elapsed >= lc."durationMonths" THEN 0
    ELSE ROUND(lc.principal * (1 - (lc.months_elapsed::NUMERIC / lc."durationMonths")), 2)
  END AS capital_remaining,
  lc."durationMonths" - lc.months_elapsed AS months_remaining,
  lc."isActive"
FROM loan_calculations lc
JOIN "Property" p ON p.id = lc."propertyId"
ORDER BY lc."isActive" DESC, lc."endDate" ASC NULLS LAST;

-- Vue 4: Indexations à venir
-- Baux éligibles à indexation (IRL/ILAT/ICC) dans les N prochains mois
CREATE OR REPLACE VIEW vw_indexations_upcoming AS
WITH lease_anniversary AS (
  SELECT
    l.id AS lease_id,
    l."propertyId",
    l."tenantId",
    l."rentAmount",
    l."startDate",
    l."indexationType",
    l.status,
    -- Prochain anniversaire du bail
    CASE
      WHEN MAKE_DATE(EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER, EXTRACT(MONTH FROM l."startDate")::INTEGER, EXTRACT(DAY FROM l."startDate")::INTEGER) < CURRENT_DATE
      THEN MAKE_DATE(EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER + 1, EXTRACT(MONTH FROM l."startDate")::INTEGER, EXTRACT(DAY FROM l."startDate")::INTEGER)
      ELSE MAKE_DATE(EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER, EXTRACT(MONTH FROM l."startDate")::INTEGER, EXTRACT(DAY FROM l."startDate")::INTEGER)
    END AS next_anniversary
  FROM "Lease" l
  WHERE l.status IN ('ACTIF', 'EN_COURS', 'SIGNE')
    AND l."indexationType" IS NOT NULL
    AND l."indexationType" != 'NONE'
)
SELECT
  la.lease_id,
  la."propertyId",
  p.name AS property_name,
  la."tenantId",
  t."firstName" || ' ' || t."lastName" AS tenant_name,
  la."rentAmount" AS current_rent,
  la."indexationType",
  la."startDate" AS lease_start_date,
  la.next_anniversary,
  EXTRACT(DAY FROM (la.next_anniversary - CURRENT_DATE))::INTEGER AS days_until_anniversary,
  ROUND(EXTRACT(DAY FROM (la.next_anniversary - CURRENT_DATE))::NUMERIC / 30, 1) AS months_until_anniversary
FROM lease_anniversary la
JOIN "Property" p ON p.id = la."propertyId"
JOIN "Tenant" t ON t.id = la."tenantId"
WHERE la.next_anniversary <= (CURRENT_DATE + INTERVAL '90 days') -- 3 mois d'horizon
ORDER BY la.next_anniversary ASC;

-- Vue 5: Statut des documents par mois
-- Vérifie présence/absence de types de docs attendus par mois
CREATE OR REPLACE VIEW vw_docs_status AS
WITH expected_doc_types AS (
  -- Documents attendus chaque mois (relevés bancaires, relevés propriétaire, etc.)
  SELECT 
    dt.id AS doc_type_id,
    dt.code AS doc_type_code,
    dt.label AS doc_type_label,
    gs.year_month
  FROM "DocumentType" dt
  CROSS JOIN (
    -- Génération des 12 derniers mois
    SELECT TO_CHAR(DATE_TRUNC('month', CURRENT_DATE - (n || ' month')::INTERVAL), 'YYYY-MM') AS year_month
    FROM generate_series(0, 11) AS n
  ) gs
  WHERE dt."isRequired" = true
    AND dt.scope = 'global'
),
actual_docs AS (
  SELECT
    d."documentTypeId",
    TO_CHAR(DATE_TRUNC('month', d."uploadedAt"), 'YYYY-MM') AS year_month,
    COUNT(*) AS doc_count
  FROM "Document" d
  WHERE d."deletedAt" IS NULL
    AND d."documentTypeId" IS NOT NULL
  GROUP BY d."documentTypeId", TO_CHAR(DATE_TRUNC('month', d."uploadedAt"), 'YYYY-MM')
)
SELECT
  edt.year_month,
  edt.doc_type_code,
  edt.doc_type_label,
  COALESCE(ad.doc_count, 0) AS docs_received,
  CASE
    WHEN COALESCE(ad.doc_count, 0) > 0 THEN 'RECEIVED'
    ELSE 'MISSING'
  END AS status
FROM expected_doc_types edt
LEFT JOIN actual_docs ad ON ad."documentTypeId" = edt.doc_type_id AND ad.year_month = edt.year_month
ORDER BY edt.year_month DESC, edt.doc_type_label;

-- ============================================
-- INDICES ADDITIONNELS POUR PERFORMANCE
-- ============================================

-- Index sur les transactions pour accélérer les vues
CREATE INDEX IF NOT EXISTS idx_transaction_paid_at ON "Transaction"("paidAt") WHERE "paidAt" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transaction_date_property ON "Transaction"(date, "propertyId");
CREATE INDEX IF NOT EXISTS idx_transaction_lease_date ON "Transaction"("leaseId", date) WHERE "leaseId" IS NOT NULL;

-- Index sur les baux pour les vues
CREATE INDEX IF NOT EXISTS idx_lease_status_dates ON "Lease"(status, "startDate", "endDate");
CREATE INDEX IF NOT EXISTS idx_lease_indexation ON "Lease"("indexationType") WHERE "indexationType" IS NOT NULL;

-- Index sur les documents pour vw_docs_status
CREATE INDEX IF NOT EXISTS idx_document_type_uploaded ON "Document"("documentTypeId", "uploadedAt") WHERE "deletedAt" IS NULL;

-- ============================================
-- COMMENTAIRES ET METADATA
-- ============================================

COMMENT ON TABLE ai_chat_sessions IS 'Sessions de conversation avec l''agent IA';
COMMENT ON TABLE ai_messages IS 'Historique des messages (user + assistant + tool)';
COMMENT ON TABLE ai_tool_logs IS 'Logs d''exécution des outils (SQL, RAG, OCR, etc.)';

COMMENT ON VIEW vw_cashflow_month IS 'Cashflow mensuel: loyers encaissés, charges payées, solde';
COMMENT ON VIEW vw_rent_due IS 'Loyers dus et impayés avec retard calculé';
COMMENT ON VIEW vw_loan_status IS 'Statut des prêts: CRD, mensualité, échéance';
COMMENT ON VIEW vw_indexations_upcoming IS 'Baux éligibles à indexation dans les 90 prochains jours';
COMMENT ON VIEW vw_docs_status IS 'Documents attendus vs reçus par mois et par type';

