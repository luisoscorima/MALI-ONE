-- MALICHIMP campaign audience source: groups | tags | emails (null = legacy groups)
ALTER TABLE "EmailCampaign" ADD COLUMN IF NOT EXISTS "audienceMode" TEXT;
