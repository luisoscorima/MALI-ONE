-- Reemplaza widget_pam por widget_museo + pam_memberships

ALTER TABLE "UserModuleAccess" ALTER COLUMN "module" SET DATA TYPE TEXT;

INSERT INTO "UserModuleAccess" ("userId", "module")
SELECT "userId", 'widget_museo'
FROM "UserModuleAccess"
WHERE "module" = 'widget_pam'
ON CONFLICT DO NOTHING;

UPDATE "UserModuleAccess"
SET "module" = 'pam_memberships'
WHERE "module" = 'widget_pam';

DROP TYPE "AppModule";

CREATE TYPE "AppModule" AS ENUM (
  'links',
  'workspace_users',
  's3_manager',
  'password_vault',
  'widget_educacion',
  'widget_biblioteca',
  'widget_museo',
  'pam_memberships'
);

ALTER TABLE "UserModuleAccess"
  ALTER COLUMN "module" SET DATA TYPE "AppModule"
  USING "module"::"AppModule";
