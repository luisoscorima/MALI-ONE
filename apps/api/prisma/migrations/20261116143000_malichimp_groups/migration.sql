-- Preserve Mailchimp's ordered group taxonomy independently from flat tags.
CREATE TABLE "MalichimpGroup" (
  "id" TEXT NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "normalizedName" VARCHAR(200) NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MalichimpGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MalichimpGroupOption" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "normalizedName" VARCHAR(200) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MalichimpGroupOption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MalichimpContactGroupOption" (
  "contactId" TEXT NOT NULL,
  "optionId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MalichimpContactGroupOption_pkey" PRIMARY KEY ("contactId", "optionId")
);

CREATE UNIQUE INDEX "MalichimpGroup_normalizedName_key"
  ON "MalichimpGroup"("normalizedName");
CREATE INDEX "MalichimpGroup_sortOrder_name_idx"
  ON "MalichimpGroup"("sortOrder", "name");
CREATE UNIQUE INDEX "MalichimpGroupOption_groupId_normalizedName_key"
  ON "MalichimpGroupOption"("groupId", "normalizedName");
CREATE INDEX "MalichimpGroupOption_groupId_name_idx"
  ON "MalichimpGroupOption"("groupId", "name");
CREATE INDEX "MalichimpContactGroupOption_optionId_idx"
  ON "MalichimpContactGroupOption"("optionId");

ALTER TABLE "MalichimpGroupOption"
  ADD CONSTRAINT "MalichimpGroupOption_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "MalichimpGroup"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MalichimpContactGroupOption"
  ADD CONSTRAINT "MalichimpContactGroupOption_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "MalichimpContact"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MalichimpContactGroupOption"
  ADD CONSTRAINT "MalichimpContactGroupOption_optionId_fkey"
  FOREIGN KEY ("optionId") REFERENCES "MalichimpGroupOption"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- These are the 13 group categories present in the exported Mailchimp audience.
WITH group_fields("name", "normalizedName", "attributeKey", "sortOrder") AS (
  VALUES
    ('Dirección y Gerencia', 'dirección y gerencia', 'direccion_gerencia', 0),
    ('Curadurías', 'curadurías', 'curadurias', 1),
    ('Curaduría Educativa', 'curaduría educativa', 'curaduria_educativa', 2),
    ('Prensa', 'prensa', 'prensa', 3),
    ('Auditorio', 'auditorio', 'auditorio', 4),
    ('Marketing', 'marketing', 'marketing', 5),
    ('Educación-Talleres', 'educación-talleres', 'educacion_talleres', 6),
    ('Instituciones', 'instituciones', 'instituciones', 7),
    ('Comunidad MALI', 'comunidad mali', 'comunidad_mali', 8),
    ('APOYO', 'apoyo', 'apoyo', 9),
    ('Comunidad MALI Internacional', 'comunidad mali internacional', 'comunidad_mali_internacional', 10),
    ('Biblioteca y Archivo', 'biblioteca y archivo', 'biblioteca_archivo', 11),
    ('Me gustaría recibir información sobre:', 'me gustaría recibir información sobre:', 'intereses', 12)
)
INSERT INTO "MalichimpGroup" (
  "id", "name", "normalizedName", "sortOrder", "createdAt", "updatedAt"
)
SELECT
  'malichimp_group_' || md5("normalizedName"),
  "name",
  "normalizedName",
  "sortOrder",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM group_fields;

-- Promote the group values already retained in MalichimpContact.attributes.
WITH group_fields("normalizedName", "attributeKey") AS (
  VALUES
    ('dirección y gerencia', 'direccion_gerencia'),
    ('curadurías', 'curadurias'),
    ('curaduría educativa', 'curaduria_educativa'),
    ('prensa', 'prensa'),
    ('auditorio', 'auditorio'),
    ('marketing', 'marketing'),
    ('educación-talleres', 'educacion_talleres'),
    ('instituciones', 'instituciones'),
    ('comunidad mali', 'comunidad_mali'),
    ('apoyo', 'apoyo'),
    ('comunidad mali internacional', 'comunidad_mali_internacional'),
    ('biblioteca y archivo', 'biblioteca_archivo'),
    ('me gustaría recibir información sobre:', 'intereses')
), raw_options AS (
  SELECT DISTINCT
    group_record."id" AS "groupId",
    btrim(option_value, ' "') AS "name",
    lower(btrim(option_value, ' "')) AS "normalizedName"
  FROM "MalichimpContact" contact
  JOIN group_fields fields
    ON contact."attributes" ? fields."attributeKey"
  JOIN "MalichimpGroup" group_record
    ON group_record."normalizedName" = fields."normalizedName"
  CROSS JOIN LATERAL regexp_split_to_table(
    contact."attributes" ->> fields."attributeKey",
    '\s*,\s*'
  ) option_value
  WHERE jsonb_typeof(contact."attributes" -> fields."attributeKey") = 'string'
    AND btrim(option_value, ' "') <> ''
)
INSERT INTO "MalichimpGroupOption" (
  "id", "groupId", "name", "normalizedName", "createdAt", "updatedAt"
)
SELECT
  'malichimp_group_option_' || md5("groupId" || ':' || "normalizedName"),
  "groupId",
  "name",
  "normalizedName",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM raw_options
ON CONFLICT ("groupId", "normalizedName") DO NOTHING;

WITH group_fields("normalizedName", "attributeKey") AS (
  VALUES
    ('dirección y gerencia', 'direccion_gerencia'),
    ('curadurías', 'curadurias'),
    ('curaduría educativa', 'curaduria_educativa'),
    ('prensa', 'prensa'),
    ('auditorio', 'auditorio'),
    ('marketing', 'marketing'),
    ('educación-talleres', 'educacion_talleres'),
    ('instituciones', 'instituciones'),
    ('comunidad mali', 'comunidad_mali'),
    ('apoyo', 'apoyo'),
    ('comunidad mali internacional', 'comunidad_mali_internacional'),
    ('biblioteca y archivo', 'biblioteca_archivo'),
    ('me gustaría recibir información sobre:', 'intereses')
), memberships AS (
  SELECT DISTINCT
    contact."id" AS "contactId",
    option_record."id" AS "optionId"
  FROM "MalichimpContact" contact
  JOIN group_fields fields
    ON contact."attributes" ? fields."attributeKey"
  JOIN "MalichimpGroup" group_record
    ON group_record."normalizedName" = fields."normalizedName"
  CROSS JOIN LATERAL regexp_split_to_table(
    contact."attributes" ->> fields."attributeKey",
    '\s*,\s*'
  ) option_value
  JOIN "MalichimpGroupOption" option_record
    ON option_record."groupId" = group_record."id"
   AND option_record."normalizedName" = lower(btrim(option_value, ' "'))
  WHERE jsonb_typeof(contact."attributes" -> fields."attributeKey") = 'string'
)
INSERT INTO "MalichimpContactGroupOption" (
  "contactId", "optionId", "createdAt"
)
SELECT "contactId", "optionId", CURRENT_TIMESTAMP
FROM memberships
ON CONFLICT ("contactId", "optionId") DO NOTHING;
