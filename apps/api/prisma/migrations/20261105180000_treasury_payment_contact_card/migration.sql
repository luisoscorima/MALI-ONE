-- Additive: contact + masked card / wallet fields for payment verification UI.
ALTER TABLE "TreasuryPayment" ADD COLUMN "customerEmail" VARCHAR(250);
ALTER TABLE "TreasuryPayment" ADD COLUMN "cardBrand" VARCHAR(80);
ALTER TABLE "TreasuryPayment" ADD COLUMN "cardType" VARCHAR(80);
ALTER TABLE "TreasuryPayment" ADD COLUMN "cardLastDigits" VARCHAR(8);
ALTER TABLE "TreasuryPayment" ADD COLUMN "wallet" VARCHAR(40);
