-- Merge any existing notes into detail before dropping the column.
UPDATE "TodoItem"
SET detail = CASE
  WHEN notes IS NULL OR btrim(notes) = '' THEN detail
  WHEN detail IS NULL OR btrim(detail) = '' THEN notes
  ELSE detail || E'\n\n' || notes
END
WHERE notes IS NOT NULL AND btrim(notes) <> '';

ALTER TABLE "TodoItem" DROP COLUMN "notes";
