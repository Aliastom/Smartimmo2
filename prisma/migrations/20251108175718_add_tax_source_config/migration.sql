-- CreateTable
CREATE TABLE "TaxSourceConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "configJson" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxSourceConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaxSourceConfig_key_key" ON "TaxSourceConfig"("key");

-- CreateIndex
CREATE INDEX "TaxSourceConfig_key_idx" ON "TaxSourceConfig"("key");

-- CreateIndex
CREATE INDEX "TaxSourceConfig_status_idx" ON "TaxSourceConfig"("status");
