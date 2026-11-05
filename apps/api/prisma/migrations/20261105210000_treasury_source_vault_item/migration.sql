-- Pointer to Vaultwarden login item per treasury source (not a secret).
ALTER TABLE "TreasurySource" ADD COLUMN "vaultItemId" VARCHAR(36);
