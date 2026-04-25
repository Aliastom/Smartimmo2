-- Couche additive export LMNP (aucune modification des tables existantes)

CREATE TABLE "lmnp_export_mapping_rule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "exerciseYear" INTEGER NOT NULL,
    "propertyId" TEXT,
    "natureCode" TEXT,
    "categoryId" TEXT,
    "lmnpBucket" TEXT NOT NULL,
    "lmnpLabel" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "mappingVersion" TEXT NOT NULL DEFAULT '1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lmnp_export_mapping_rule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lmnp_export_override" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "transactionId" TEXT,
    "documentId" TEXT,
    "loanId" TEXT,
    "lmnpBucket" TEXT NOT NULL,
    "lmnpLabel" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lmnp_export_override_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lmnp_export_run" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "exerciseYear" INTEGER NOT NULL,
    "mappingVersion" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "coverageRate" DOUBLE PRECISION NOT NULL,
    "anomalyCount" INTEGER NOT NULL,
    "manifestJson" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lmnp_export_run_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lmnp_export_anomaly" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,

    CONSTRAINT "lmnp_export_anomaly_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lmnp_export_mapping_rule_organizationId_exerciseYear_active_idx" ON "lmnp_export_mapping_rule"("organizationId", "exerciseYear", "active");
CREATE INDEX "lmnp_export_mapping_rule_organizationId_exerciseYear_propertyI_idx" ON "lmnp_export_mapping_rule"("organizationId", "exerciseYear", "propertyId");

CREATE INDEX "lmnp_export_override_organizationId_idx" ON "lmnp_export_override"("organizationId");
CREATE INDEX "lmnp_export_override_transactionId_idx" ON "lmnp_export_override"("transactionId");
CREATE INDEX "lmnp_export_override_documentId_idx" ON "lmnp_export_override"("documentId");
CREATE INDEX "lmnp_export_override_loanId_idx" ON "lmnp_export_override"("loanId");

CREATE INDEX "lmnp_export_run_organizationId_propertyId_exerciseYear_idx" ON "lmnp_export_run"("organizationId", "propertyId", "exerciseYear");

CREATE INDEX "lmnp_export_anomaly_runId_idx" ON "lmnp_export_anomaly"("runId");

ALTER TABLE "lmnp_export_mapping_rule" ADD CONSTRAINT "lmnp_export_mapping_rule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lmnp_export_mapping_rule" ADD CONSTRAINT "lmnp_export_mapping_rule_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lmnp_export_mapping_rule" ADD CONSTRAINT "lmnp_export_mapping_rule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "lmnp_export_override" ADD CONSTRAINT "lmnp_export_override_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lmnp_export_override" ADD CONSTRAINT "lmnp_export_override_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lmnp_export_override" ADD CONSTRAINT "lmnp_export_override_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lmnp_export_override" ADD CONSTRAINT "lmnp_export_override_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lmnp_export_run" ADD CONSTRAINT "lmnp_export_run_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lmnp_export_run" ADD CONSTRAINT "lmnp_export_run_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lmnp_export_anomaly" ADD CONSTRAINT "lmnp_export_anomaly_runId_fkey" FOREIGN KEY ("runId") REFERENCES "lmnp_export_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;
