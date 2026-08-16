-- Reassign items that point at duplicate types (same name, later row) to the keeper.
WITH keepers AS (
  SELECT DISTINCT ON (lower(name)) id, lower(name) AS n
  FROM "TodoType"
  ORDER BY lower(name), "createdAt" ASC, id ASC
)
UPDATE "TodoItem" AS item
SET "typeId" = keepers.id
FROM "TodoType" AS dup
JOIN keepers ON keepers.n = lower(dup.name)
WHERE item."typeId" = dup.id
  AND dup.id <> keepers.id;

DELETE FROM "TodoType" AS dup
WHERE NOT EXISTS (
  SELECT 1
  FROM (
    SELECT DISTINCT ON (lower(name)) id
    FROM "TodoType"
    ORDER BY lower(name), "createdAt" ASC, id ASC
  ) AS k
  WHERE k.id = dup.id
);

CREATE UNIQUE INDEX "TodoType_name_key" ON "TodoType"("name");
