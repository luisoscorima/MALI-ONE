-- Grant the new module to the same users who already manage newsletters.
INSERT INTO "UserModuleAccess" ("userId", "module")
SELECT DISTINCT "userId", 'internal_communications'::"AppModule"
FROM "UserModuleAccess"
WHERE "module" = 'newsletters'::"AppModule"
ON CONFLICT DO NOTHING;
