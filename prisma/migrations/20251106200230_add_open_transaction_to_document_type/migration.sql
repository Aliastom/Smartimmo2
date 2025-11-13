-- AlterTable
ALTER TABLE "DocumentType" ADD COLUMN     "openTransaction" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "admin_backup_records" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "note" TEXT,
    "meta" JSONB NOT NULL,

    CONSTRAINT "admin_backup_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_backup_schedules" (
    "id" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "frequency" TEXT NOT NULL,
    "hour" INTEGER NOT NULL DEFAULT 3,
    "dayOfWeek" INTEGER,
    "dayOfMonth" INTEGER,
    "retentionDays" INTEGER NOT NULL DEFAULT 30,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_backup_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admin_backup_records_createdAt_idx" ON "admin_backup_records"("createdAt");

-- CreateIndex
CREATE INDEX "admin_backup_records_scope_idx" ON "admin_backup_records"("scope");
