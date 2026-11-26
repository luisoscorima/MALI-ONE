-- Rename AppModule permission IDs. Existing UserModuleAccess rows keep their grants.
BEGIN;
ALTER TYPE "AppModule" RENAME VALUE 'newsletters' TO 'email_hub';
ALTER TYPE "AppModule" RENAME VALUE 'workspace_users' TO 'google_workspace';
COMMIT;
