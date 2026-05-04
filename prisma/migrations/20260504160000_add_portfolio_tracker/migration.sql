-- Portefeuille réel (comptes + ordres)

CREATE TABLE "PortfolioAccount" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "inflationAnnualRate" DOUBLE PRECISION,
    "fiscalProfileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PortfolioAccount_pkey" PRIMARY KEY ("organizationId","id")
);

CREATE TABLE "PortfolioOrder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "assetSymbol" TEXT NOT NULL,
    "assetIsin" TEXT,
    "type" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitPrice" DOUBLE PRECISION,
    "grossAmount" DOUBLE PRECISION,
    "fees" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PortfolioOrder_pkey" PRIMARY KEY ("organizationId","id")
);

CREATE INDEX "PortfolioAccount_organizationId_idx" ON "PortfolioAccount"("organizationId");
CREATE INDEX "PortfolioAccount_updatedAt_idx" ON "PortfolioAccount"("updatedAt");
CREATE INDEX "PortfolioOrder_organizationId_idx" ON "PortfolioOrder"("organizationId");
CREATE INDEX "PortfolioOrder_date_idx" ON "PortfolioOrder"("date");
CREATE INDEX "PortfolioOrder_organizationId_accountId_idx" ON "PortfolioOrder"("organizationId", "accountId");

ALTER TABLE "PortfolioAccount"
ADD CONSTRAINT "PortfolioAccount_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PortfolioOrder"
ADD CONSTRAINT "PortfolioOrder_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PortfolioOrder"
ADD CONSTRAINT "PortfolioOrder_organizationId_accountId_fkey"
FOREIGN KEY ("organizationId", "accountId") REFERENCES "PortfolioAccount"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
