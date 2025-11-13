-- CreateTable
CREATE TABLE "FiscalSimulation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL DEFAULT 'demo-user',
    "name" TEXT,
    "year" INTEGER NOT NULL,
    "fiscalVersionId" TEXT,
    "inputsJson" TEXT NOT NULL,
    "resultJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "FiscalSimulation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FiscalSimulation_userId_idx" ON "FiscalSimulation"("userId");

-- CreateIndex
CREATE INDEX "FiscalSimulation_year_idx" ON "FiscalSimulation"("year");

-- CreateIndex
CREATE INDEX "FiscalSimulation_fiscalVersionId_idx" ON "FiscalSimulation"("fiscalVersionId");

-- CreateIndex
CREATE INDEX "FiscalSimulation_createdAt_idx" ON "FiscalSimulation"("createdAt");
