-- Absorb internal_communications into workspace_users, then drop the enum value.

ALTER TABLE "UserModuleAccess" ALTER COLUMN "module" SET DATA TYPE TEXT;

INSERT INTO "UserModuleAccess" ("userId", "module")
SELECT DISTINCT "userId", 'workspace_users'
FROM "UserModuleAccess"
WHERE "module" = 'internal_communications'
ON CONFLICT DO NOTHING;

DELETE FROM "UserModuleAccess"
WHERE "module" = 'internal_communications';

DROP TYPE "AppModule";

CREATE TYPE "AppModule" AS ENUM (
  'links',
  'workspace_users',
  's3_manager',
  'password_vault',
  'widget_educacion',
  'widget_biblioteca',
  'widget_museo',
  'widget_pam',
  'screen_cast',
  'bsale_reports',
  'mailing',
  'malichimp',
  'newsletters',
  'landings',
  'crm_pam',
  'crm_educacion',
  'catalog_educacion',
  'portfolio',
  'files',
  'treasury'
);

ALTER TABLE "UserModuleAccess"
  ALTER COLUMN "module" SET DATA TYPE "AppModule"
  USING "module"::"AppModule";
