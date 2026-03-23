-- AlterTable: Échéance autonome (nature + catégorie explicites)
ALTER TABLE "EcheanceRecurrente" ADD COLUMN "natureCode" TEXT;
ALTER TABLE "EcheanceRecurrente" ADD COLUMN "defaultCategoryId" TEXT;
