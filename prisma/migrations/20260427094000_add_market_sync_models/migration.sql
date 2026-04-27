-- PR1 Marché sync serveur: settings + action logs (scopés organisation)

CREATE TABLE "MarketInvestmentSettings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "referenceSymbol" TEXT NOT NULL,
    "referenceLabel" TEXT NOT NULL,
    "envelope" TEXT NOT NULL,
    "athPeriod" TEXT NOT NULL,
    "availableCash" DOUBLE PRECISION NOT NULL,
    "monthlyDcaAmount" DOUBLE PRECISION NOT NULL,
    "reinforce10Threshold" DOUBLE PRECISION NOT NULL,
    "reinforce20Threshold" DOUBLE PRECISION NOT NULL,
    "reinforce10Amount" DOUBLE PRECISION NOT NULL,
    "reinforce20Amount" DOUBLE PRECISION NOT NULL,
    "strategy" TEXT NOT NULL,
    "cashReferenceAmount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "peaSocialContributionsOnGainsRate" DOUBLE PRECISION,
    "investmentStrategyJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketInvestmentSettings_pkey" PRIMARY KEY ("organizationId","id")
);

CREATE TABLE "MarketInvestmentActionLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL,
    "recommendedAmount" DOUBLE PRECISION NOT NULL,
    "validatedAmount" DOUBLE PRECISION NOT NULL,
    "cashBefore" DOUBLE PRECISION NOT NULL,
    "cashAfter" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "drawdownAtDecision" DOUBLE PRECISION NOT NULL,
    "athPriceAtDecision" DOUBLE PRECISION NOT NULL,
    "currentPriceAtDecision" DOUBLE PRECISION NOT NULL,
    "symbolAtDecision" TEXT NOT NULL,
    "marketStatusAtDecision" TEXT NOT NULL,
    "athPeriodAtDecision" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "thresholdKey" TEXT,
    "marketLevelKey" TEXT,
    "drawdownPercentAtAction" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketInvestmentActionLog_pkey" PRIMARY KEY ("organizationId","id")
);

CREATE INDEX "MarketInvestmentSettings_organizationId_idx" ON "MarketInvestmentSettings"("organizationId");
CREATE INDEX "MarketInvestmentSettings_updatedAt_idx" ON "MarketInvestmentSettings"("updatedAt");

CREATE INDEX "MarketInvestmentActionLog_organizationId_idx" ON "MarketInvestmentActionLog"("organizationId");
CREATE INDEX "MarketInvestmentActionLog_updatedAt_idx" ON "MarketInvestmentActionLog"("updatedAt");
CREATE INDEX "MarketInvestmentActionLog_date_idx" ON "MarketInvestmentActionLog"("date");
CREATE INDEX "MarketInvestmentActionLog_thresholdKey_idx" ON "MarketInvestmentActionLog"("thresholdKey");

ALTER TABLE "MarketInvestmentSettings"
ADD CONSTRAINT "MarketInvestmentSettings_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MarketInvestmentActionLog"
ADD CONSTRAINT "MarketInvestmentActionLog_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
