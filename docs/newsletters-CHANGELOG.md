# Changelog — newsletters

Formato: entradas en orden inverso (lo más reciente arriba). Cada mejora del módulo debe registrarse aquí.

## [Unreleased]

- Campo opcional `brand` (`museo` | `cursos_arte` | `extension_profesional`) para header/footer por marca.
- Seed/import de campañas Mailchimp públicas con rehost de imágenes a S3 (`newsletters/…`).
- Nota operativa: el rol EC2 sube a S3, pero la URL pública anónima depende de bucket policy (ver `aws-runtime-role.md`).
- Las campañas guardan snapshots del asunto y HTML; editar un boletín no altera envíos ya creados.
- Tracking y eventos de entrega pasan a `core/email-delivery` para poder reutilizarse desde cualquier módulo.
- Se impide eliminar un boletín que forma parte del historial de campañas.
- Se desacopla el editor de CRM PAM; audiencia MALICHIMP y transporte SES quedan como responsabilidades independientes.
- Se aclara que el SMTP PAM no forma parte del flujo de boletines/SES.

## [2026-11-05] — baseline documental

Reorganización de la documentación por módulo. Contenido consolidado desde el código y la documentación previa del módulo.

- Editor bloques + URL pública; tracking ligado a campañas SES.
