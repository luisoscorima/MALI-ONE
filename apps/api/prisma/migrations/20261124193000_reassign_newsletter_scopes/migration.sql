-- Move operational Mailchimp/org pieces into MALICHIMP library so they appear
-- under MALICHIMP → Contenido and campaign pickers (not as shared/org only).
UPDATE "Newsletter"
SET
  "scope" = 'malichimp'::"NewsletterScope",
  "kind" = 'library',
  "updatedAt" = NOW()
WHERE "kind" = 'library'
  AND "scope" = 'shared'
  AND "slug" IN (
    'asamblea-asociados-2026-1',
    'asamblea-asociados-2026-1-copia-mwuzv9zj-f57c2bc8',
    'lanzamiento-casa-del-moral',
    'invitacion-pacchas',
    'invitacion-sandra-gamarra-replica',
    'boletin-auditorio-nov-2026',
    'boletin-mensual-nov-2026',
    'boletin-extension-profesional',
    'boletin-cursos-arte',
    'cursos-ep-ca-cine',
    'alumnos-noche-mali',
    'boletin-amigos-mali'
  );

-- TI test bulletin → Usuarios Workspace / Campañas internas library.
UPDATE "Newsletter"
SET
  "scope" = 'internal_communications'::"NewsletterScope",
  "kind" = 'library',
  "updatedAt" = NOW()
WHERE "kind" = 'library'
  AND "scope" = 'shared'
  AND "slug" = 'boletin-prueba-ti';
