-- CreateEnum
CREATE TYPE "LoanRateType" AS ENUM ('FIXED');

-- CreateEnum
CREATE TYPE "EcheanceType" AS ENUM ('PRET', 'COPRO', 'PNO', 'ASSURANCE', 'IMPOT', 'CFE', 'ENTRETIEN', 'AUTRE', 'LOYER_ATTENDU', 'CHARGE_RECUP');

-- CreateEnum
CREATE TYPE "Periodicite" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY', 'ONCE');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "SensEcheance" AS ENUM ('DEBIT', 'CREDIT');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "deductible" BOOLEAN NOT NULL DEFAULT false,
    "capitalizable" BOOLEAN NOT NULL DEFAULT false,
    "system" BOOLEAN NOT NULL DEFAULT false,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL DEFAULT 'default',
    "bucketKey" TEXT NOT NULL,
    "filenameOriginal" TEXT NOT NULL,
    "filenameNormalized" TEXT,
    "fileName" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "previewUrl" TEXT,
    "fileSha256" TEXT,
    "textSha256" TEXT,
    "simHash" TEXT,
    "documentTypeId" TEXT,
    "detectedTypeId" TEXT,
    "typeConfidence" DOUBLE PRECISION,
    "typeAlternatives" TEXT,
    "ocrStatus" TEXT NOT NULL DEFAULT 'pending',
    "ocrError" TEXT,
    "ocrVendor" TEXT,
    "ocrConfidence" DOUBLE PRECISION,
    "extractedText" TEXT,
    "indexed" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "source" TEXT NOT NULL DEFAULT 'upload',
    "uploadedBy" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tagsJson" TEXT,
    "tags" TEXT,
    "metadata" TEXT,
    "linkedTo" TEXT,
    "linkedId" TEXT,
    "uploadSessionId" TEXT,
    "intendedContextType" TEXT,
    "intendedContextTempKey" TEXT,
    "propertyId" TEXT,
    "transactionId" TEXT,
    "leaseId" TEXT,
    "loanId" TEXT,
    "tenantId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "replacesDocumentId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userReason" TEXT,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentExtractionRule" (
    "id" TEXT NOT NULL,
    "documentTypeId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "postProcess" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentExtractionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentField" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "valueText" TEXT,
    "valueNum" DOUBLE PRECISION,
    "valueDate" TIMESTAMP(3),
    "confidence" DOUBLE PRECISION,
    "sourceRuleId" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentKeyword" (
    "id" TEXT NOT NULL,
    "documentTypeId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "context" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentKeyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentLink" (
    "documentId" TEXT NOT NULL,
    "linkedType" TEXT NOT NULL,
    "linkedId" TEXT NOT NULL,
    "entityName" TEXT,

    CONSTRAINT "DocumentLink_pkey" PRIMARY KEY ("documentId","linkedType","linkedId")
);

-- CreateTable
CREATE TABLE "DocumentTextIndex" (
    "documentId" TEXT NOT NULL,
    "page" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentTextIndex_pkey" PRIMARY KEY ("documentId","page")
);

-- CreateTable
CREATE TABLE "DocumentType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "scope" TEXT NOT NULL DEFAULT 'global',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSensitive" BOOLEAN NOT NULL DEFAULT false,
    "autoAssignThreshold" DOUBLE PRECISION,
    "regexFilename" TEXT,
    "validExtensions" TEXT,
    "validMimeTypes" TEXT,
    "ocrProfileKey" TEXT,
    "versioningEnabled" BOOLEAN NOT NULL DEFAULT true,
    "defaultContexts" TEXT,
    "suggestionsConfig" TEXT,
    "flowLocks" TEXT,
    "metaSchema" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentTypeField" (
    "id" TEXT NOT NULL,
    "documentTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dataType" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentTypeField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcheanceRecurrente" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT,
    "leaseId" TEXT,
    "label" TEXT NOT NULL,
    "type" "EcheanceType" NOT NULL,
    "periodicite" "Periodicite" NOT NULL,
    "montant" DECIMAL(10,2) NOT NULL,
    "recuperable" BOOLEAN NOT NULL DEFAULT false,
    "sens" "SensEcheance" NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcheanceRecurrente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "leaseId" TEXT,
    "tenantId" TEXT,
    "type" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Landlord" (
    "id" SERIAL NOT NULL,
    "fullName" TEXT NOT NULL DEFAULT '',
    "address1" TEXT NOT NULL DEFAULT '',
    "address2" TEXT,
    "postalCode" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT,
    "siret" TEXT,
    "iban" TEXT,
    "bic" TEXT,
    "signatureUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Landlord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lease" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "rentAmount" DOUBLE PRECISION NOT NULL,
    "deposit" DOUBLE PRECISION,
    "paymentDay" INTEGER,
    "notes" TEXT,
    "noticeMonths" INTEGER,
    "indexationType" TEXT,
    "furnishedType" TEXT,
    "overridesJson" TEXT,
    "status" TEXT NOT NULL DEFAULT 'BROUILLON',
    "signedPdfUrl" TEXT,
    "chargesRecupMensuelles" DOUBLE PRECISION,
    "chargesNonRecupMensuelles" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaseVersion" (
    "id" SERIAL NOT NULL,
    "leaseId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaseVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "principal" DECIMAL(12,2) NOT NULL,
    "annualRatePct" DECIMAL(6,3) NOT NULL,
    "durationMonths" INTEGER NOT NULL,
    "defermentMonths" INTEGER NOT NULL DEFAULT 0,
    "insurancePct" DECIMAL(6,3),
    "feesUpfront" DECIMAL(12,2),
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "rateType" "LoanRateType" NOT NULL DEFAULT 'FIXED',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagementCompany" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "contact" TEXT,
    "email" TEXT,
    "telephone" TEXT,
    "modeCalcul" TEXT NOT NULL DEFAULT 'LOYERS_UNIQUEMENT',
    "taux" DOUBLE PRECISION NOT NULL,
    "fraisMin" DOUBLE PRECISION,
    "baseSurEncaissement" BOOLEAN NOT NULL DEFAULT true,
    "tvaApplicable" BOOLEAN NOT NULL DEFAULT false,
    "tauxTva" DOUBLE PRECISION,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagementCompany_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NatureDefault" (
    "natureCode" TEXT NOT NULL,
    "defaultCategoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NatureDefault_pkey" PRIMARY KEY ("natureCode")
);

-- CreateTable
CREATE TABLE "NatureEntity" (
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "flow" TEXT,

    CONSTRAINT "NatureEntity_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "NatureRule" (
    "id" TEXT NOT NULL,
    "natureCode" TEXT NOT NULL,
    "allowedType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NatureRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OccupancyHistory" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leaseId" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "monthlyRent" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OccupancyHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "leaseId" TEXT,
    "periodYear" INTEGER NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "nature" TEXT NOT NULL DEFAULT 'AUTRE',
    "categoryId" TEXT,
    "snapshotAccounting" TEXT,
    "label" TEXT NOT NULL,
    "method" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAttachment" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "propertyId" TEXT NOT NULL,
    "room" TEXT,
    "tag" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "surface" DOUBLE PRECISION NOT NULL,
    "rooms" INTEGER NOT NULL,
    "acquisitionDate" TIMESTAMP(3) NOT NULL,
    "acquisitionPrice" DOUBLE PRECISION NOT NULL,
    "notaryFees" DOUBLE PRECISION NOT NULL,
    "currentValue" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "statusMode" TEXT NOT NULL DEFAULT 'AUTO',
    "statusManual" TEXT,
    "occupation" TEXT NOT NULL DEFAULT 'VACANT',
    "evalSource" TEXT,
    "evalDate" TIMESTAMP(3),
    "exitFeesRate" DOUBLE PRECISION,
    "notes" TEXT,
    "managementCompanyId" TEXT,
    "fiscalTypeId" TEXT,
    "fiscalRegimeId" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL DEFAULT 'default',
    "documentId" TEXT,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "alertDays" TEXT,
    "autoCreated" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'open',
    "snoozedUntil" TIMESTAMP(3),
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Signal" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "regex" TEXT NOT NULL,
    "flags" TEXT NOT NULL DEFAULT 'iu',
    "description" TEXT,
    "protected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Signal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxConfig" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "json" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalVersion" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "validatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "FiscalVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalParams" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "jsonData" TEXT NOT NULL,
    "overrides" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiscalParams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalType" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiscalType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalRegime" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "appliesToIds" TEXT NOT NULL,
    "engagementYears" INTEGER,
    "eligibility" TEXT,
    "calcProfile" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "fiscalTypeId" TEXT,

    CONSTRAINT "FiscalRegime_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalCompatibility" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "left" TEXT NOT NULL,
    "right" TEXT NOT NULL,
    "rule" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiscalCompatibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "birthDate" TIMESTAMP(3),
    "nationality" TEXT,
    "address" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "country" TEXT,
    "occupation" TEXT,
    "employer" TEXT,
    "monthlyIncome" DOUBLE PRECISION,
    "emergencyContact" TEXT,
    "emergencyPhone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "tags" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "leaseId" TEXT,
    "bailId" TEXT,
    "categoryId" TEXT,
    "label" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "reference" TEXT,
    "month" INTEGER,
    "year" INTEGER,
    "accounting_month" TEXT,
    "isRecurring" BOOLEAN,
    "nature" TEXT,
    "paidAt" TIMESTAMP(3),
    "method" TEXT,
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "idempotencyKey" TEXT,
    "monthsCovered" TEXT,
    "parentTransactionId" TEXT,
    "moisIndex" INTEGER,
    "moisTotal" INTEGER,
    "rapprochementStatus" TEXT NOT NULL DEFAULT 'non_rapprochee',
    "dateRapprochement" TIMESTAMP(3),
    "bankRef" TEXT,
    "montantLoyer" DOUBLE PRECISION,
    "chargesRecup" DOUBLE PRECISION,
    "chargesNonRecup" DOUBLE PRECISION,
    "isAutoAmount" BOOLEAN,
    "managementCompanyId" TEXT,
    "isAuto" BOOLEAN NOT NULL DEFAULT false,
    "autoSource" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TypeSignal" (
    "id" TEXT NOT NULL,
    "documentTypeId" TEXT NOT NULL,
    "signalId" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TypeSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadSession" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scope" TEXT,
    "transactionId" TEXT,

    CONSTRAINT "UploadSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadStagedItem" (
    "id" TEXT NOT NULL,
    "uploadSessionId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "existingDocumentId" TEXT,
    "intendedContextType" TEXT,
    "intendedContextTempKey" TEXT,
    "intendedRefId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadStagedItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL DEFAULT '',
    "lastName" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "postalCode" TEXT,
    "company" TEXT,
    "siret" TEXT,
    "signature" TEXT,
    "logo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "nature_category_allowed" (
    "id" TEXT NOT NULL,
    "natureKey" TEXT NOT NULL,
    "categoryType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nature_category_allowed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nature_category_default" (
    "id" TEXT NOT NULL,
    "natureKey" TEXT NOT NULL,
    "defaultCategoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nature_category_default_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_chat_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL DEFAULT 'default',
    "context_json" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_activity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meta_json" TEXT,

    CONSTRAINT "ai_chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_messages" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tool_calls_json" TEXT,
    "tool_results_json" TEXT,
    "tokens_used" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "correlation_id" TEXT,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_tool_logs" (
    "id" TEXT NOT NULL,
    "message_id" TEXT,
    "tool_name" TEXT NOT NULL,
    "args_json" TEXT NOT NULL,
    "result_json" TEXT,
    "duration_ms" INTEGER,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "correlation_id" TEXT,

    CONSTRAINT "ai_tool_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "AppConfig_key_key" ON "AppConfig"("key");

-- CreateIndex
CREATE INDEX "AppConfig_key_idx" ON "AppConfig"("key");

-- CreateIndex
CREATE UNIQUE INDEX "AppSetting_key_key" ON "AppSetting"("key");

-- CreateIndex
CREATE INDEX "AppSetting_key_idx" ON "AppSetting"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Document_fileSha256_key" ON "Document"("fileSha256");

-- CreateIndex
CREATE INDEX "Document_deletedAt_idx" ON "Document"("deletedAt");

-- CreateIndex
CREATE INDEX "Document_detectedTypeId_idx" ON "Document"("detectedTypeId");

-- CreateIndex
CREATE INDEX "Document_documentTypeId_idx" ON "Document"("documentTypeId");

-- CreateIndex
CREATE INDEX "Document_fileSha256_idx" ON "Document"("fileSha256");

-- CreateIndex
CREATE INDEX "Document_leaseId_idx" ON "Document"("leaseId");

-- CreateIndex
CREATE INDEX "Document_linkedTo_linkedId_idx" ON "Document"("linkedTo", "linkedId");

-- CreateIndex
CREATE INDEX "Document_loanId_idx" ON "Document"("loanId");

-- CreateIndex
CREATE INDEX "Document_ocrStatus_idx" ON "Document"("ocrStatus");

-- CreateIndex
CREATE INDEX "Document_ownerId_idx" ON "Document"("ownerId");

-- CreateIndex
CREATE INDEX "Document_propertyId_idx" ON "Document"("propertyId");

-- CreateIndex
CREATE INDEX "Document_replacesDocumentId_idx" ON "Document"("replacesDocumentId");

-- CreateIndex
CREATE INDEX "Document_source_idx" ON "Document"("source");

-- CreateIndex
CREATE INDEX "Document_status_idx" ON "Document"("status");

-- CreateIndex
CREATE INDEX "Document_tenantId_idx" ON "Document"("tenantId");

-- CreateIndex
CREATE INDEX "Document_textSha256_idx" ON "Document"("textSha256");

-- CreateIndex
CREATE INDEX "Document_transactionId_idx" ON "Document"("transactionId");

-- CreateIndex
CREATE INDEX "Document_version_idx" ON "Document"("version");

-- CreateIndex
CREATE INDEX "DocumentExtractionRule_documentTypeId_idx" ON "DocumentExtractionRule"("documentTypeId");

-- CreateIndex
CREATE INDEX "DocumentField_documentId_idx" ON "DocumentField"("documentId");

-- CreateIndex
CREATE INDEX "DocumentField_fieldName_idx" ON "DocumentField"("fieldName");

-- CreateIndex
CREATE INDEX "DocumentKeyword_documentTypeId_idx" ON "DocumentKeyword"("documentTypeId");

-- CreateIndex
CREATE INDEX "DocumentKeyword_keyword_idx" ON "DocumentKeyword"("keyword");

-- CreateIndex
CREATE INDEX "DocumentLink_documentId_idx" ON "DocumentLink"("documentId");

-- CreateIndex
CREATE INDEX "DocumentLink_linkedType_linkedId_idx" ON "DocumentLink"("linkedType", "linkedId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentType_code_key" ON "DocumentType"("code");

-- CreateIndex
CREATE INDEX "DocumentType_code_idx" ON "DocumentType"("code");

-- CreateIndex
CREATE INDEX "DocumentType_isActive_order_idx" ON "DocumentType"("isActive", "order");

-- CreateIndex
CREATE INDEX "DocumentType_isRequired_idx" ON "DocumentType"("isRequired");

-- CreateIndex
CREATE INDEX "DocumentType_scope_idx" ON "DocumentType"("scope");

-- CreateIndex
CREATE INDEX "DocumentTypeField_documentTypeId_idx" ON "DocumentTypeField"("documentTypeId");

-- CreateIndex
CREATE INDEX "EcheanceRecurrente_isActive_startAt_idx" ON "EcheanceRecurrente"("isActive", "startAt");

-- CreateIndex
CREATE INDEX "EcheanceRecurrente_leaseId_idx" ON "EcheanceRecurrente"("leaseId");

-- CreateIndex
CREATE INDEX "EcheanceRecurrente_periodicite_idx" ON "EcheanceRecurrente"("periodicite");

-- CreateIndex
CREATE INDEX "EcheanceRecurrente_propertyId_idx" ON "EcheanceRecurrente"("propertyId");

-- CreateIndex
CREATE INDEX "EcheanceRecurrente_type_idx" ON "EcheanceRecurrente"("type");

-- CreateIndex
CREATE INDEX "EmailLog_leaseId_idx" ON "EmailLog"("leaseId");

-- CreateIndex
CREATE INDEX "EmailLog_tenantId_idx" ON "EmailLog"("tenantId");

-- CreateIndex
CREATE INDEX "LeaseVersion_leaseId_createdAt_idx" ON "LeaseVersion"("leaseId", "createdAt");

-- CreateIndex
CREATE INDEX "Loan_propertyId_idx" ON "Loan"("propertyId");

-- CreateIndex
CREATE INDEX "Loan_isActive_idx" ON "Loan"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "NatureRule_natureCode_allowedType_key" ON "NatureRule"("natureCode", "allowedType");

-- CreateIndex
CREATE INDEX "OccupancyHistory_propertyId_startDate_idx" ON "OccupancyHistory"("propertyId", "startDate");

-- CreateIndex
CREATE INDEX "OccupancyHistory_propertyId_tenantId_idx" ON "OccupancyHistory"("propertyId", "tenantId");

-- CreateIndex
CREATE INDEX "Payment_categoryId_idx" ON "Payment"("categoryId");

-- CreateIndex
CREATE INDEX "Payment_leaseId_periodYear_periodMonth_idx" ON "Payment"("leaseId", "periodYear", "periodMonth");

-- CreateIndex
CREATE INDEX "Payment_propertyId_periodYear_periodMonth_idx" ON "Payment"("propertyId", "periodYear", "periodMonth");

-- CreateIndex
CREATE INDEX "PaymentAttachment_paymentId_idx" ON "PaymentAttachment"("paymentId");

-- CreateIndex
CREATE INDEX "Photo_propertyId_idx" ON "Photo"("propertyId");

-- CreateIndex
CREATE INDEX "Photo_propertyId_room_idx" ON "Photo"("propertyId", "room");

-- CreateIndex
CREATE INDEX "Property_isArchived_idx" ON "Property"("isArchived");

-- CreateIndex
CREATE INDEX "Property_fiscalTypeId_idx" ON "Property"("fiscalTypeId");

-- CreateIndex
CREATE INDEX "Property_fiscalRegimeId_idx" ON "Property"("fiscalRegimeId");

-- CreateIndex
CREATE INDEX "Reminder_documentId_idx" ON "Reminder"("documentId");

-- CreateIndex
CREATE INDEX "Reminder_dueDate_idx" ON "Reminder"("dueDate");

-- CreateIndex
CREATE INDEX "Reminder_ownerId_status_idx" ON "Reminder"("ownerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "Signal_code_key" ON "Signal"("code");

-- CreateIndex
CREATE INDEX "Signal_code_idx" ON "Signal"("code");

-- CreateIndex
CREATE INDEX "Signal_deletedAt_idx" ON "Signal"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TaxConfig_year_key" ON "TaxConfig"("year");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalVersion_code_key" ON "FiscalVersion"("code");

-- CreateIndex
CREATE INDEX "FiscalVersion_year_idx" ON "FiscalVersion"("year");

-- CreateIndex
CREATE INDEX "FiscalVersion_status_idx" ON "FiscalVersion"("status");

-- CreateIndex
CREATE INDEX "FiscalVersion_code_idx" ON "FiscalVersion"("code");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalParams_versionId_key" ON "FiscalParams"("versionId");

-- CreateIndex
CREATE INDEX "FiscalParams_versionId_idx" ON "FiscalParams"("versionId");

-- CreateIndex
CREATE INDEX "FiscalType_category_idx" ON "FiscalType"("category");

-- CreateIndex
CREATE INDEX "FiscalType_isActive_idx" ON "FiscalType"("isActive");

-- CreateIndex
CREATE INDEX "FiscalRegime_isActive_idx" ON "FiscalRegime"("isActive");

-- CreateIndex
CREATE INDEX "FiscalCompatibility_scope_idx" ON "FiscalCompatibility"("scope");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalCompatibility_scope_left_right_key" ON "FiscalCompatibility"("scope", "left", "right");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_email_key" ON "Tenant"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_idempotencyKey_key" ON "Transaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Transaction_bailId_idx" ON "Transaction"("bailId");

-- CreateIndex
CREATE INDEX "Transaction_date_idx" ON "Transaction"("date");

-- CreateIndex
CREATE INDEX "Transaction_leaseId_amount_paidAt_idx" ON "Transaction"("leaseId", "amount", "paidAt");

-- CreateIndex
CREATE INDEX "Transaction_managementCompanyId_idx" ON "Transaction"("managementCompanyId");

-- CreateIndex
CREATE INDEX "Transaction_parentTransactionId_idx" ON "Transaction"("parentTransactionId");

-- CreateIndex
CREATE INDEX "Transaction_propertyId_date_idx" ON "Transaction"("propertyId", "date");

-- CreateIndex
CREATE INDEX "Transaction_rapprochementStatus_idx" ON "Transaction"("rapprochementStatus");

-- CreateIndex
CREATE INDEX "TypeSignal_documentTypeId_idx" ON "TypeSignal"("documentTypeId");

-- CreateIndex
CREATE INDEX "TypeSignal_signalId_idx" ON "TypeSignal"("signalId");

-- CreateIndex
CREATE UNIQUE INDEX "TypeSignal_documentTypeId_signalId_key" ON "TypeSignal"("documentTypeId", "signalId");

-- CreateIndex
CREATE UNIQUE INDEX "UploadSession_transactionId_key" ON "UploadSession"("transactionId");

-- CreateIndex
CREATE INDEX "UploadSession_createdById_idx" ON "UploadSession"("createdById");

-- CreateIndex
CREATE INDEX "UploadSession_expiresAt_idx" ON "UploadSession"("expiresAt");

-- CreateIndex
CREATE INDEX "UploadSession_scope_idx" ON "UploadSession"("scope");

-- CreateIndex
CREATE INDEX "UploadSession_transactionId_idx" ON "UploadSession"("transactionId");

-- CreateIndex
CREATE INDEX "UploadStagedItem_existingDocumentId_idx" ON "UploadStagedItem"("existingDocumentId");

-- CreateIndex
CREATE INDEX "UploadStagedItem_kind_idx" ON "UploadStagedItem"("kind");

-- CreateIndex
CREATE INDEX "UploadStagedItem_uploadSessionId_idx" ON "UploadStagedItem"("uploadSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "nature_category_allowed_natureKey_categoryType_key" ON "nature_category_allowed"("natureKey", "categoryType");

-- CreateIndex
CREATE UNIQUE INDEX "nature_category_default_natureKey_key" ON "nature_category_default"("natureKey");

-- CreateIndex
CREATE INDEX "ai_chat_sessions_user_id_idx" ON "ai_chat_sessions"("user_id");

-- CreateIndex
CREATE INDEX "ai_chat_sessions_created_at_idx" ON "ai_chat_sessions"("created_at");

-- CreateIndex
CREATE INDEX "ai_messages_session_id_idx" ON "ai_messages"("session_id");

-- CreateIndex
CREATE INDEX "ai_messages_created_at_idx" ON "ai_messages"("created_at");

-- CreateIndex
CREATE INDEX "ai_messages_correlation_id_idx" ON "ai_messages"("correlation_id");

-- CreateIndex
CREATE INDEX "ai_tool_logs_tool_name_idx" ON "ai_tool_logs"("tool_name");

-- CreateIndex
CREATE INDEX "ai_tool_logs_created_at_idx" ON "ai_tool_logs"("created_at");

-- CreateIndex
CREATE INDEX "ai_tool_logs_correlation_id_idx" ON "ai_tool_logs"("correlation_id");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_documentTypeId_fkey" FOREIGN KEY ("documentTypeId") REFERENCES "DocumentType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadSessionId_fkey" FOREIGN KEY ("uploadSessionId") REFERENCES "UploadSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentExtractionRule" ADD CONSTRAINT "DocumentExtractionRule_documentTypeId_fkey" FOREIGN KEY ("documentTypeId") REFERENCES "DocumentType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentField" ADD CONSTRAINT "DocumentField_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentKeyword" ADD CONSTRAINT "DocumentKeyword_documentTypeId_fkey" FOREIGN KEY ("documentTypeId") REFERENCES "DocumentType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentLink" ADD CONSTRAINT "DocumentLink_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTextIndex" ADD CONSTRAINT "DocumentTextIndex_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTypeField" ADD CONSTRAINT "DocumentTypeField_documentTypeId_fkey" FOREIGN KEY ("documentTypeId") REFERENCES "DocumentType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcheanceRecurrente" ADD CONSTRAINT "EcheanceRecurrente_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcheanceRecurrente" ADD CONSTRAINT "EcheanceRecurrente_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaseVersion" ADD CONSTRAINT "LeaseVersion_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NatureDefault" ADD CONSTRAINT "NatureDefault_defaultCategoryId_fkey" FOREIGN KEY ("defaultCategoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NatureDefault" ADD CONSTRAINT "NatureDefault_natureCode_fkey" FOREIGN KEY ("natureCode") REFERENCES "NatureEntity"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NatureRule" ADD CONSTRAINT "NatureRule_natureCode_fkey" FOREIGN KEY ("natureCode") REFERENCES "NatureEntity"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OccupancyHistory" ADD CONSTRAINT "OccupancyHistory_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OccupancyHistory" ADD CONSTRAINT "OccupancyHistory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAttachment" ADD CONSTRAINT "PaymentAttachment_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_managementCompanyId_fkey" FOREIGN KEY ("managementCompanyId") REFERENCES "ManagementCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_fiscalTypeId_fkey" FOREIGN KEY ("fiscalTypeId") REFERENCES "FiscalType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_fiscalRegimeId_fkey" FOREIGN KEY ("fiscalRegimeId") REFERENCES "FiscalRegime"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalParams" ADD CONSTRAINT "FiscalParams_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "FiscalVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalRegime" ADD CONSTRAINT "FiscalRegime_fiscalTypeId_fkey" FOREIGN KEY ("fiscalTypeId") REFERENCES "FiscalType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_bailId_fkey" FOREIGN KEY ("bailId") REFERENCES "Lease"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TypeSignal" ADD CONSTRAINT "TypeSignal_documentTypeId_fkey" FOREIGN KEY ("documentTypeId") REFERENCES "DocumentType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TypeSignal" ADD CONSTRAINT "TypeSignal_signalId_fkey" FOREIGN KEY ("signalId") REFERENCES "Signal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadStagedItem" ADD CONSTRAINT "UploadStagedItem_existingDocumentId_fkey" FOREIGN KEY ("existingDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadStagedItem" ADD CONSTRAINT "UploadStagedItem_uploadSessionId_fkey" FOREIGN KEY ("uploadSessionId") REFERENCES "UploadSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nature_category_default" ADD CONSTRAINT "nature_category_default_defaultCategoryId_fkey" FOREIGN KEY ("defaultCategoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "ai_chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_tool_logs" ADD CONSTRAINT "ai_tool_logs_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "ai_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
