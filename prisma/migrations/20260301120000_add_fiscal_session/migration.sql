-- CreateTable
CREATE TABLE "FiscalSession" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "declarationYear" INTEGER NOT NULL,
    "incomeYear" INTEGER NOT NULL,
    "baremeCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiscalSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FiscalSession_organizationId_key" ON "FiscalSession"("organizationId");

-- CreateIndex
CREATE INDEX "FiscalSession_organizationId_idx" ON "FiscalSession"("organizationId");

-- AddForeignKey
ALTER TABLE "FiscalSession" ADD CONSTRAINT "FiscalSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
