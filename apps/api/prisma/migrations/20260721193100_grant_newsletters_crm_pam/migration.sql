-- Grant both new modules to users who had mailing
INSERT INTO "UserModuleAccess" ("userId", "module")
SELECT "userId", 'newsletters'::"AppModule"
FROM "UserModuleAccess"
WHERE "module" = 'mailing'
ON CONFLICT DO NOTHING;

INSERT INTO "UserModuleAccess" ("userId", "module")
SELECT "userId", 'crm_pam'::"AppModule"
FROM "UserModuleAccess"
WHERE "module" = 'mailing'
ON CONFLICT DO NOTHING;
