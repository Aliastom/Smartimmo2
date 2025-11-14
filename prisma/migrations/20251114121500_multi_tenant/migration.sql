-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- Seed default organization to preserve existing data
INSERT INTO "Organization" ("id", "name", "slug")
VALUES ('default', 'Organisation par défaut', 'default')
ON CONFLICT ("id") DO NOTHING;

-- AlterTable: User
ALTER TABLE "User"
ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT 'default';

-- AlterTable: Property
ALTER TABLE "Property"
ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT 'default';

-- AlterTable: Reminder
ALTER TABLE "Reminder"
ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT 'default';

-- AlterTable: Tenant
ALTER TABLE "Tenant"
ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT 'default';

-- AlterTable: Transaction
ALTER TABLE "Transaction"
ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT 'default';

-- AlterTable: Document
ALTER TABLE "Document"
ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT 'default';

-- AlterTable: EcheanceRecurrente
ALTER TABLE "EcheanceRecurrente"
ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT 'default';

-- AlterTable: Lease
ALTER TABLE "Lease"
ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT 'default';

-- AlterTable: Loan
ALTER TABLE "Loan"
ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT 'default';

-- AlterTable: Payment
ALTER TABLE "Payment"
ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT 'default';

-- AlterTable: Photo
ALTER TABLE "Photo"
ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT 'default';

-- AlterTable: FiscalSimulation
ALTER TABLE "FiscalSimulation"
ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT 'default';

-- AlterTable: UploadSession
ALTER TABLE "UploadSession"
ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT 'default';

-- AlterTable: UploadStagedItem
ALTER TABLE "UploadStagedItem"
ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT 'default';

-- Create Indexes
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");
CREATE INDEX "Property_organizationId_idx" ON "Property"("organizationId");
CREATE INDEX "Reminder_organizationId_idx" ON "Reminder"("organizationId");
CREATE INDEX "Tenant_organizationId_idx" ON "Tenant"("organizationId");
CREATE INDEX "Transaction_organizationId_idx" ON "Transaction"("organizationId");
CREATE INDEX "Document_organizationId_idx" ON "Document"("organizationId");
CREATE INDEX "EcheanceRecurrente_organizationId_idx" ON "EcheanceRecurrente"("organizationId");
CREATE INDEX "Lease_organizationId_idx" ON "Lease"("organizationId");
CREATE INDEX "Loan_organizationId_idx" ON "Loan"("organizationId");
CREATE INDEX "Payment_organizationId_idx" ON "Payment"("organizationId");
CREATE INDEX "Photo_organizationId_idx" ON "Photo"("organizationId");
CREATE INDEX "FiscalSimulation_organizationId_idx" ON "FiscalSimulation"("organizationId");
CREATE INDEX "UploadSession_organizationId_idx" ON "UploadSession"("organizationId");
CREATE INDEX "UploadStagedItem_organizationId_idx" ON "UploadStagedItem"("organizationId");

-- Add Foreign Keys
ALTER TABLE "User"
ADD CONSTRAINT "User_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Property"
ADD CONSTRAINT "Property_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Reminder"
ADD CONSTRAINT "Reminder_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Tenant"
ADD CONSTRAINT "Tenant_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Transaction"
ADD CONSTRAINT "Transaction_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Document"
ADD CONSTRAINT "Document_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EcheanceRecurrente"
ADD CONSTRAINT "EcheanceRecurrente_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Lease"
ADD CONSTRAINT "Lease_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Loan"
ADD CONSTRAINT "Loan_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Photo"
ADD CONSTRAINT "Photo_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FiscalSimulation"
ADD CONSTRAINT "FiscalSimulation_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UploadSession"
ADD CONSTRAINT "UploadSession_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UploadStagedItem"
ADD CONSTRAINT "UploadStagedItem_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

