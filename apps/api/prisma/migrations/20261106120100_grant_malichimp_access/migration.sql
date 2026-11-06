-- Keep the enum addition in the preceding committed migration: PostgreSQL does
-- not allow using a new enum value in the transaction where it was created.
INSERT INTO "UserModuleAccess" ("userId", "module")
SELECT DISTINCT "userId", 'malichimp'::"AppModule"
FROM "UserModuleAccess"
WHERE "module" = 'newsletters'::"AppModule"
ON CONFLICT DO NOTHING;
