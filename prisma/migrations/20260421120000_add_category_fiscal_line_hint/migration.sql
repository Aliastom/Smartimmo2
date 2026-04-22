-- Add optional fiscal line mapping hint for 2044 declaration.
ALTER TABLE "Category"
ADD COLUMN "fiscalLineHint" TEXT;

