-- Apprentissage LMNP léger (additif, hors métier Transaction)

CREATE TABLE "lmnp_learning_pattern" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "propertyId" TEXT,
    "patternKey" TEXT NOT NULL,
    "patternJson" TEXT NOT NULL,
    "lmnpBucket" TEXT NOT NULL,
    "lmnpLabel" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.75,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lmnp_learning_pattern_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lmnp_learning_pattern_organizationId_patternKey_key" ON "lmnp_learning_pattern"("organizationId", "patternKey");

CREATE INDEX "lmnp_learning_pattern_organizationId_idx" ON "lmnp_learning_pattern"("organizationId");

CREATE INDEX "lmnp_learning_pattern_organizationId_propertyId_idx" ON "lmnp_learning_pattern"("organizationId", "propertyId");

ALTER TABLE "lmnp_learning_pattern" ADD CONSTRAINT "lmnp_learning_pattern_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
