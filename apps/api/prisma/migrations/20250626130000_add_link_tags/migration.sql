ALTER TABLE "ShortLink" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX "ShortLink_tags_idx" ON "ShortLink" USING GIN ("tags");
