-- Réalignement _prisma_migrations ↔ dossiers Git (aucune donnée métier modifiée).
-- Exécuter sur Supabase (SQL Editor) APRÈS avoir récupéré le dépôt contenant les bons noms
-- de dossiers (isFavorite, index perfs, loan borrower après multi_tenant, etc.).
--
-- Contexte shadow DB : organizationId sur Transaction/… vient de 20251114121500_multi_tenant.
-- La table Organization est aussi créée dans multi_tenant : LoanBorrower doit être APRÈS 141215.
-- -----------------------------------------------------------------------------

BEGIN;

-- 0) isFavorite sur Document (ancien 20250215 = avant création de Document en shadow)
UPDATE "_prisma_migrations" m
SET migration_name = '20251106091500_add_document_is_favorite'
FROM (
  SELECT ctid
  FROM "_prisma_migrations"
  WHERE migration_name = '20250215000000_add_document_is_favorite'
  LIMIT 1
) x
WHERE m.ctid = x.ctid;

DELETE FROM "_prisma_migrations"
WHERE migration_name = '20250215000000_add_document_is_favorite';

-- 1) Index perfs → après multi_tenant (141216)
UPDATE "_prisma_migrations"
SET migration_name = '20251114121600_performance_indexes'
WHERE migration_name IN (
  '20250116184513_performance_indexes',
  '20251106093000_performance_indexes'
);

-- 2) LoanBorrower → après multi_tenant + index perfs (141217)
UPDATE "_prisma_migrations"
SET migration_name = '20251114121700_add_loan_borrower'
WHERE migration_name IN (
  '20250116190000_add_loan_borrower',
  '20251106093500_add_loan_borrower'
);

-- 3) Au plus une entrée doublon Git 20251124123257
UPDATE "_prisma_migrations" m
SET migration_name = '20251114121700_add_loan_borrower'
FROM (
  SELECT ctid
  FROM "_prisma_migrations"
  WHERE migration_name = '20251124123257_add_loan_borrower'
  LIMIT 1
) x
WHERE m.ctid = x.ctid
  AND NOT EXISTS (
    SELECT 1 FROM "_prisma_migrations" x2
    WHERE x2.migration_name = '20251114121700_add_loan_borrower'
  );

DELETE FROM "_prisma_migrations"
WHERE migration_name = '20251124123257_add_loan_borrower';

COMMIT;

-- Contrôle :
-- SELECT migration_name, checksum, finished_at
-- FROM "_prisma_migrations"
-- WHERE migration_name LIKE '%91500%' OR migration_name LIKE '%141216%' OR migration_name LIKE '%141217%'
-- ORDER BY finished_at;
