-- AlterTable
ALTER TABLE "ManagementCompany" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT 'default';

-- CreateIndex
CREATE INDEX "ManagementCompany_organizationId_idx" ON "ManagementCompany"("organizationId");

-- AddForeignKey
ALTER TABLE "ManagementCompany" ADD CONSTRAINT "ManagementCompany_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

