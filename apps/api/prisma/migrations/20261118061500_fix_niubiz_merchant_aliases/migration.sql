-- Correct provisional invented aliases from the first catalog seed.
-- Alias starts equal to the Niubiz portal name; operators may rename later in UI.

UPDATE "TreasuryTarget" t
SET
  "externalName" = w.portal,
  "name" = w.portal,
  "updatedAt" = CURRENT_TIMESTAMP
FROM (
  VALUES
    ('650177853', 'CURSOSDELMALI'),
    ('650178711', 'MUSEO DE ARTE DE LIMA'),
    ('650239803', 'ASOCIACION MUSEO DE ARTE DE LIMA'),
    ('650239881', 'MUSEO DE ARTE DE LIMA'),
    ('651047392', 'ASOCIACION MUSEO DE ARTE DE LIMA')
) AS w(reference, portal)
WHERE t."reference" = w.reference
  AND t."kind" = 'merchant'
  AND EXISTS (
    SELECT 1
    FROM "TreasurySource" s
    WHERE s."id" = t."sourceId"
      AND s."provider" = 'niubiz_sales'
  );
