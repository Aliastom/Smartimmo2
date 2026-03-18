-- CreateTable
CREATE TABLE "EcheanceTransactionLink" (
    "id" TEXT NOT NULL,
    "echeanceId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "matchType" TEXT NOT NULL,
    "confidenceScore" DOUBLE PRECISION,
    "occurrenceDate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcheanceTransactionLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EcheanceTransactionLink_echeanceId_transactionId_key" ON "EcheanceTransactionLink"("echeanceId", "transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "EcheanceTransactionLink_transactionId_key" ON "EcheanceTransactionLink"("transactionId");

-- CreateIndex
CREATE INDEX "EcheanceTransactionLink_echeanceId_idx" ON "EcheanceTransactionLink"("echeanceId");

-- CreateIndex
CREATE INDEX "EcheanceTransactionLink_transactionId_idx" ON "EcheanceTransactionLink"("transactionId");

-- AddForeignKey
ALTER TABLE "EcheanceTransactionLink" ADD CONSTRAINT "EcheanceTransactionLink_echeanceId_fkey" FOREIGN KEY ("echeanceId") REFERENCES "EcheanceRecurrente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcheanceTransactionLink" ADD CONSTRAINT "EcheanceTransactionLink_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
