-- Mise à jour des checksums Prisma (colonne seule) pour des migration.sql modifiés
-- après application — aligne _prisma_migrations avec le contenu actuel des fichiers
-- (aucune table métier modifiée, pas de rejeu de SQL).
--
-- Algorithme (Prisma / schema-engine) : SHA-256 du contenu binaire de migration.sql,
-- encodage hexadécimal minuscule sur 64 caractères.
--
-- Valeurs calculées à partir du dépôt au moment de la livraison :
--   20251124130000_add_loan_fields            → cb61792097a553d9a53382def459ba37cc0354063bca560e5e24d49890f2f6d0
--   20260425114000_add_lmnp_activity_scope    → 179527bf0e921b478a10900dc233e4138794506f31995a38c226a466f0597796
--
-- Si les fichiers migration.sql change encore : node prisma/scripts/compute-migration-checksum.mjs
--
BEGIN;

UPDATE "_prisma_migrations"
SET checksum = 'cb61792097a553d9a53382def459ba37cc0354063bca560e5e24d49890f2f6d0'
WHERE migration_name = '20251124130000_add_loan_fields';

UPDATE "_prisma_migrations"
SET checksum = '179527bf0e921b478a10900dc233e4138794506f31995a38c226a466f0597796'
WHERE migration_name = '20260425114000_add_lmnp_activity_scope';

COMMIT;

-- Vérification :
-- SELECT migration_name, checksum, LENGTH(checksum) AS len FROM "_prisma_migrations"
-- WHERE migration_name IN (
--   '20251124130000_add_loan_fields',
--   '20260425114000_add_lmnp_activity_scope'
-- );
