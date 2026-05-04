-- Historique de valorisation portefeuille (snapshots d’instantanés)

CREATE TABLE "PortfolioSnapshot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "totalMarketValue" DOUBLE PRECISION NOT NULL,
    "totalRemainingCostBasis" DOUBLE PRECISION NOT NULL,
    "totalUnrealizedPnL" DOUBLE PRECISION NOT NULL,
    "totalRealizedPnL" DOUBLE PRECISION NOT NULL,
    "totalDividendsNet" DOUBLE PRECISION NOT NULL,
    "grossPerformanceEuro" DOUBLE PRECISION NOT NULL,
    "netPerformanceAfterTaxEuro" DOUBLE PRECISION NOT NULL,
    "surplusInflationEuro" DOUBLE PRECISION NOT NULL,
    "valuationIncomplete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PortfolioSnapshot_pkey" PRIMARY KEY ("organizationId","id")
);

CREATE INDEX "PortfolioSnapshot_organizationId_idx" ON "PortfolioSnapshot"("organizationId");
CREATE INDEX "PortfolioSnapshot_organizationId_capturedAt_idx" ON "PortfolioSnapshot"("organizationId", "capturedAt");

ALTER TABLE "PortfolioSnapshot"
ADD CONSTRAINT "PortfolioSnapshot_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
