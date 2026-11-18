-- Correct provisional invented aliases from the first catalog seed.
-- Alias starts equal to the Niubiz portal name; operators may rename later in UI.

WITH wanted(reference, portal) AS (
  VALUES
    ('650177853', 'CURSOSDELMALI'),
    ('650178711', 'MUSEO DE ARTE DE LIMA'),
    ('650239803', 'ASOCIACION MUSEO DE ARTE DE LIMA'),
    ('650239881', 'MUSEO DE ARTE DE LIMA'),
    ('651047392', 'ASOCIACION MUSEO DE ARTE DE LIMA')
)
UPDATE "TreasuryTarget" t
SET
  "externalName" = w.portal,
  "name" = w.portal,
  "updatedAt" = CURRENT_TIMESTAMP
FROM wanted w
JOIN "TreasurySource" s ON s."id" = t."sourceId"
WHERE t."reference" = w.reference
  AND s."provider" = 'niubiz_sales'
  AND t."kind" = 'merchant';
