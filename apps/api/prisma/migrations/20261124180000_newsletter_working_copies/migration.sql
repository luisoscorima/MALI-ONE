-- Newsletter scope / kind / lineage / content revision
CREATE TYPE "NewsletterScope" AS ENUM ('shared', 'malichimp', 'internal_communications');
CREATE TYPE "NewsletterKind" AS ENUM ('library', 'campaign_working_copy');

ALTER TABLE "Newsletter"
  ADD COLUMN "scope" "NewsletterScope" NOT NULL DEFAULT 'shared',
  ADD COLUMN "kind" "NewsletterKind" NOT NULL DEFAULT 'library',
  ADD COLUMN "sourceNewsletterId" TEXT,
  ADD COLUMN "contentRevision" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "Newsletter"
  ADD CONSTRAINT "Newsletter_sourceNewsletterId_fkey"
  FOREIGN KEY ("sourceNewsletterId") REFERENCES "Newsletter"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Newsletter_scope_kind_idx" ON "Newsletter"("scope", "kind");
CREATE INDEX "Newsletter_sourceNewsletterId_idx" ON "Newsletter"("sourceNewsletterId");

-- Campaign working copy + content / audience snapshots
ALTER TABLE "EmailCampaign"
  ADD COLUMN "workingNewsletterId" TEXT,
  ADD COLUMN "designJsonSnapshot" TEXT,
  ADD COLUMN "brandSnapshot" "NewsletterBrand",
  ADD COLUMN "audienceIncludeContactIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "audienceExcludeContactIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE UNIQUE INDEX "EmailCampaign_workingNewsletterId_key"
  ON "EmailCampaign"("workingNewsletterId");

ALTER TABLE "EmailCampaign"
  ADD CONSTRAINT "EmailCampaign_workingNewsletterId_fkey"
  FOREIGN KEY ("workingNewsletterId") REFERENCES "Newsletter"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- All existing rows start as shared library.
UPDATE "Newsletter"
SET "scope" = 'shared', "kind" = 'library';

-- Draft campaigns: create exclusive working copies; keep newsletterId as library base.
DO $$
DECLARE
  camp RECORD;
  wc_id TEXT;
  lib_id TEXT;
  wc_slug TEXT;
  lib_slug TEXT;
  scope_val "NewsletterScope";
  exclusive_count INT;
BEGIN
  FOR camp IN
    SELECT
      c."id" AS campaign_id,
      c."newsletterId" AS newsletter_id,
      c."audienceArea" AS audience_area,
      c."createdById" AS created_by_id,
      c."subjectSnapshot" AS subject_snapshot,
      c."htmlSnapshot" AS html_snapshot,
      n."slug" AS nl_slug,
      n."title" AS nl_title,
      n."subject" AS nl_subject,
      n."htmlBody" AS nl_html,
      n."designJson" AS nl_design,
      n."brand" AS nl_brand,
      n."status" AS nl_status
    FROM "EmailCampaign" c
    JOIN "Newsletter" n ON n."id" = c."newsletterId"
    WHERE c."status" = 'draft' AND c."workingNewsletterId" IS NULL
  LOOP
    scope_val := CASE
      WHEN camp.audience_area = 'malichimp' THEN 'malichimp'::"NewsletterScope"
      WHEN camp.audience_area = 'internal_workspace' THEN 'internal_communications'::"NewsletterScope"
      ELSE 'shared'::"NewsletterScope"
    END;

    SELECT COUNT(*)::int INTO exclusive_count
    FROM "EmailCampaign" WHERE "newsletterId" = camp.newsletter_id;

    -- Exclusive draft newsletter: promote it to working copy and mint a library base.
    IF exclusive_count = 1 AND camp.nl_status = 'draft' AND scope_val <> 'shared' THEN
      lib_id := 'lib' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 22);
      lib_slug := left(camp.nl_slug, 55) || '-lib-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
      INSERT INTO "Newsletter" (
        "id", "slug", "title", "subject", "htmlBody", "designJson", "brand",
        "status", "scope", "kind", "sourceNewsletterId", "contentRevision",
        "createdById", "createdAt", "updatedAt"
      ) VALUES (
        lib_id,
        lib_slug,
        camp.nl_title,
        camp.nl_subject,
        camp.nl_html,
        camp.nl_design,
        camp.nl_brand,
        'draft',
        'shared',
        'library',
        NULL,
        1,
        camp.created_by_id,
        NOW(),
        NOW()
      );

      UPDATE "Newsletter"
      SET
        "scope" = scope_val,
        "kind" = 'campaign_working_copy',
        "sourceNewsletterId" = lib_id
      WHERE "id" = camp.newsletter_id;

      UPDATE "EmailCampaign"
      SET
        "newsletterId" = lib_id,
        "workingNewsletterId" = camp.newsletter_id
      WHERE "id" = camp.campaign_id;
    ELSE
      -- Shared / published / multi-use base: fork a working copy from campaign snapshot.
      wc_id := 'wc' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 23);
      wc_slug := left(camp.nl_slug, 55) || '-wc-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
      INSERT INTO "Newsletter" (
        "id", "slug", "title", "subject", "htmlBody", "designJson", "brand",
        "status", "scope", "kind", "sourceNewsletterId", "contentRevision",
        "createdById", "createdAt", "updatedAt"
      ) VALUES (
        wc_id,
        wc_slug,
        camp.nl_title,
        left(camp.subject_snapshot, 200),
        camp.html_snapshot,
        CASE WHEN camp.html_snapshot = camp.nl_html THEN camp.nl_design ELSE NULL END,
        camp.nl_brand,
        'draft',
        scope_val,
        'campaign_working_copy',
        camp.newsletter_id,
        1,
        camp.created_by_id,
        NOW(),
        NOW()
      );

      UPDATE "EmailCampaign"
      SET "workingNewsletterId" = wc_id
      WHERE "id" = camp.campaign_id;
    END IF;
  END LOOP;
END $$;

ALTER TABLE "EmailCampaign"
  ADD CONSTRAINT "EmailCampaign_draft_requires_working_newsletter"
  CHECK ("status" <> 'draft' OR "workingNewsletterId" IS NOT NULL);
