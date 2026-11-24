-- Purge test campaigns (cascade sends/events via FK).
DELETE FROM "EmailCampaign";

-- Orphan exclusive working copies left after campaigns are gone.
DELETE FROM "Newsletter" WHERE "kind" = 'campaign_working_copy';

-- Partition EmailSender by NewsletterScope (shared | malichimp | internal_communications).
ALTER TABLE "EmailSender" ADD COLUMN "scope" "NewsletterScope" NOT NULL DEFAULT 'shared';

DROP INDEX IF EXISTS "EmailSender_email_key";
CREATE UNIQUE INDEX "EmailSender_scope_email_key" ON "EmailSender"("scope", "email");
CREATE INDEX "EmailSender_scope_idx" ON "EmailSender"("scope");

-- Copy existing (now shared) senders into module catalogs so selectors are not empty.
INSERT INTO "EmailSender" ("id", "email", "createdById", "createdAt", "updatedAt", "scope")
SELECT
  'es_m_' || substr(md5('malichimp:' || "email"), 1, 22),
  "email",
  "createdById",
  NOW(),
  NOW(),
  'malichimp'::"NewsletterScope"
FROM "EmailSender"
WHERE "scope" = 'shared'
ON CONFLICT ("scope", "email") DO NOTHING;

INSERT INTO "EmailSender" ("id", "email", "createdById", "createdAt", "updatedAt", "scope")
SELECT
  'es_i_' || substr(md5('internal_communications:' || "email"), 1, 22),
  "email",
  "createdById",
  NOW(),
  NOW(),
  'internal_communications'::"NewsletterScope"
FROM "EmailSender"
WHERE "scope" = 'shared'
ON CONFLICT ("scope", "email") DO NOTHING;

CREATE INDEX IF NOT EXISTS "EmailCampaign_audienceArea_idx" ON "EmailCampaign"("audienceArea");
