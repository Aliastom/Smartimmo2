-- CreateTable
CREATE TABLE "LoanBorrower" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL DEFAULT 'default',
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3),
    "email" TEXT,
    "phone" TEXT,
    "responsibilityPct" DECIMAL(5,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanBorrower_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoanBorrower_loanId_idx" ON "LoanBorrower"("loanId");

-- CreateIndex
CREATE INDEX "LoanBorrower_organizationId_idx" ON "LoanBorrower"("organizationId");

-- AddForeignKey
ALTER TABLE "LoanBorrower" ADD CONSTRAINT "LoanBorrower_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanBorrower" ADD CONSTRAINT "LoanBorrower_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

