-- Scope LMNP par activité (SIRET), additif et rétro-compatible.

CREATE TABLE "LmnpActivity" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "siret" VARCHAR(14) NOT NULL,
    "fiscalRegime" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LmnpActivity_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Property" ADD COLUMN "lmnpActivityId" TEXT;

CREATE INDEX "LmnpActivity_organizationId_idx" ON "LmnpActivity"("organizationId");
CREATE UNIQUE INDEX "LmnpActivity_organizationId_siret_key" ON "LmnpActivity"("organizationId", "siret");
CREATE INDEX "Property_lmnpActivityId_idx" ON "Property"("lmnpActivityId");

ALTER TABLE "LmnpActivity"
  ADD CONSTRAINT "LmnpActivity_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Property"
  ADD CONSTRAINT "Property_lmnpActivityId_fkey"
  FOREIGN KEY ("lmnpActivityId") REFERENCES "LmnpActivity"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Migration douce:
-- 1) Crée une activité LMNP par organisation qui possède des biens meublés / LMNP
-- 2) Associe ces biens à cette activité si non renseigné.
WITH orgs AS (
  SELECT DISTINCT p."organizationId" AS org_id
  FROM "Property" p
  WHERE
    p."lmnpActivityId" IS NULL
    AND (
      lower(coalesce(p."rentalMode", '')) = 'seasonal_airbnb'
      OR lower(coalesce(p."fiscalTypeId", '')) LIKE '%meuble%'
      OR lower(coalesce(p."fiscalRegimeId", '')) LIKE '%bic%'
      OR lower(coalesce(p."fiscalRegimeId", '')) LIKE '%lmnp%'
      OR lower(coalesce(p."fiscalRegimeId", '')) LIKE '%reel%'
    )
),
created AS (
  INSERT INTO "LmnpActivity" ("id", "organizationId", "name", "siret", "fiscalRegime", "createdAt", "updatedAt")
  SELECT
    md5(org_id || '-lmnp-migration')::text,
    org_id,
    'LMNP - Migration',
    substring(regexp_replace(org_id, '[^0-9]', '', 'g') || '00000000000000' from 1 for 14),
    'reel_simplifie',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  FROM orgs
  ON CONFLICT ("id") DO NOTHING
  RETURNING "id", "organizationId"
)
UPDATE "Property" p
SET "lmnpActivityId" = coalesce(c."id", md5(p."organizationId" || '-lmnp-migration')::text)
FROM "LmnpActivity" c
WHERE
  p."organizationId" = c."organizationId"
  AND p."lmnpActivityId" IS NULL
  AND (
    lower(coalesce(p."rentalMode", '')) = 'seasonal_airbnb'
    OR lower(coalesce(p."fiscalTypeId", '')) LIKE '%meuble%'
    OR lower(coalesce(p."fiscalRegimeId", '')) LIKE '%bic%'
    OR lower(coalesce(p."fiscalRegimeId", '')) LIKE '%lmnp%'
    OR lower(coalesce(p."fiscalRegimeId", '')) LIKE '%reel%'
  );
