-- AlterTable
ALTER TABLE "Loan" ADD COLUMN "paymentDay" INTEGER;

-- AddComment
COMMENT ON COLUMN "Loan"."paymentDay" IS 'Jour du mois pour le paiement (1-31). Si NULL, utilise le jour de startDate';

