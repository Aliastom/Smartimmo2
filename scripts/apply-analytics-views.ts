#!/usr/bin/env tsx
/**
 * Script pour appliquer les vues analytiques SQL
 * Crée les 6 vues analytiques sur PostgreSQL
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Définitions des 6 vues analytiques
 */
const VIEWS = [
  {
    name: 'v_loyers_encaissements_mensuels',
    sql: `CREATE OR REPLACE VIEW v_loyers_encaissements_mensuels AS
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
WHERE t.amount > 0
GROUP BY 1, 2, 3`,
  },
  {
    name: 'v_loyers_a_encaisser_courant',
    sql: `CREATE OR REPLACE VIEW v_loyers_a_encaisser_courant AS
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
WHERE l.status IN ('ACTIF', 'SIGNE', 'EN_COURS')`,
  },
  {
    name: 'v_echeances_3_mois',
    sql: `CREATE OR REPLACE VIEW v_echeances_3_mois AS
SELECT
  'INDEXATION_BAIL'::text AS type,
  l."propertyId" AS property_id,
  l.id AS ref_id,
  p.name AS property_name,
  l."rentAmount" AS montant_actuel,
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
SELECT
  'PRET'::text AS type,
  ln."propertyId" AS property_id,
  ln.id AS ref_id,
  p.name AS property_name,
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
  AND COALESCE(ln."endDate", NOW() + INTERVAL '100 years') >= NOW()`,
  },
  {
    name: 'v_prets_statut',
    sql: `CREATE OR REPLACE VIEW v_prets_statut AS
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
    CASE
      WHEN ln."annualRatePct" = 0 THEN (ln.principal / ln."durationMonths")
      ELSE (ln.principal * ((ln."annualRatePct" / 100 / 12) * POWER(1 + (ln."annualRatePct" / 100 / 12), ln."durationMonths"))) 
           / (POWER(1 + (ln."annualRatePct" / 100 / 12), ln."durationMonths") - 1)
    END AS mensualite_calculee,
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
INNER JOIN "Property" p ON p.id = lc."propertyId"`,
  },
  {
    name: 'v_documents_statut',
    sql: `CREATE OR REPLACE VIEW v_documents_statut AS
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
GROUP BY 1, 2, 3, 4, 5, 6, 7, 8, 9`,
  },
  {
    name: 'v_cashflow_global',
    sql: `CREATE OR REPLACE VIEW v_cashflow_global AS
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
ORDER BY 1 DESC, 3`,
  },
  {
    name: 'v_loyers_en_retard',
    sql: `CREATE OR REPLACE VIEW v_loyers_en_retard AS
WITH 
  rent_nature AS (
    SELECT value as nature_loyer
    FROM "AppConfig"
    WHERE key = 'rentNature'
    LIMIT 1
  ),
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
        DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month',
        INTERVAL '1 month'
      ) as mois
    ) gs
  ),
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
  unpaid_months AS (
    SELECT 
      em.lease_id,
      em."propertyId",
      em."tenantId",
      em."rentAmount",
      em.accounting_month,
      em.end_of_month,
      EXTRACT(DAY FROM (CURRENT_DATE - em.end_of_month))::INTEGER as retard_jours
    FROM expected_months em
    LEFT JOIN paid_transactions pt 
      ON pt."leaseId" = em.lease_id 
      AND pt.accounting_month = em.accounting_month
    WHERE pt.accounting_month IS NULL
  )
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
ORDER BY um.retard_jours DESC, um.accounting_month`,
  },
];

async function main() {
  console.log('\n🚀 Application des vues analytiques SQL...\n');
  console.log('═'.repeat(60));

  try {
    console.log('\n⏳ Création des 7 vues SQL...\n');
    
    console.log('ℹ️  Note: v_loyers_en_retard utilise AppConfig.rentNature');
    console.log('   Si non configuré, créez: INSERT INTO "AppConfig" (key, value) VALUES (\'rentNature\', \'RECETTE_LOYER\');\n');

    let successCount = 0;
    for (const view of VIEWS) {
      try {
        await prisma.$executeRawUnsafe(view.sql);
        console.log(`   ✓ Vue ${view.name} créée`);
        successCount++;
      } catch (error: any) {
        console.error(`   ✗ Erreur sur ${view.name}:`, error.message);
      }
    }

    console.log(`\n✅ ${successCount}/${VIEWS.length} vue(s) créée(s) avec succès`);

    console.log('\n📊 Vues disponibles:');
    console.log('   1. v_loyers_encaissements_mensuels - Encaissements par mois');
    console.log('   2. v_loyers_a_encaisser_courant - Loyers dus vs payés');
    console.log('   3. v_echeances_3_mois - Échéances à venir');
    console.log('   4. v_prets_statut - Statut des prêts');
    console.log('   5. v_documents_statut - Statut des documents');
    console.log('   6. v_cashflow_global - Cashflow global');
    console.log('   7. v_loyers_en_retard - Loyers en retard (NOUVELLE - avec accounting_month) ⭐');

    console.log('\n🧪 Vérifications rapides:');
    
    // Test de chaque vue
    const tests = [
      'v_loyers_encaissements_mensuels',
      'v_loyers_a_encaisser_courant',
      'v_echeances_3_mois',
      'v_prets_statut',
      'v_documents_statut',
      'v_cashflow_global',
      'v_loyers_en_retard',
    ];

    for (const viewName of tests) {
      try {
        await prisma.$queryRawUnsafe(`SELECT * FROM ${viewName} LIMIT 1`);
        console.log(`   ✓ ${viewName}`);
      } catch (e: any) {
        console.log(`   ✗ ${viewName} - ${e.message}`);
      }
    }

    console.log('\n💡 Exemples de questions pour l\'agent IA:');
    console.log('   - "Combien de loyers encaissés ce mois ?"');
    console.log('   - "Liste des loyers impayés"');
    console.log('   - "Échéances dans les 3 prochains mois ?"');
    console.log('   - "Capital restant sur mes prêts ?"');
    console.log('   - "Cashflow du mois dernier ?"');

    console.log('\n' + '═'.repeat(60));
  } catch (error: any) {
    console.error('\n❌ Erreur:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
