-- CreateTable
CREATE TABLE "TaxSourceSnapshot" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "section" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "hash" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxSourceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaxSourceSnapshot_year_section_idx" ON "TaxSourceSnapshot"("year", "section");

-- CreateIndex
CREATE INDEX "TaxSourceSnapshot_source_idx" ON "TaxSourceSnapshot"("source");

-- CreateIndex
CREATE INDEX "TaxSourceSnapshot_hash_idx" ON "TaxSourceSnapshot"("hash");
