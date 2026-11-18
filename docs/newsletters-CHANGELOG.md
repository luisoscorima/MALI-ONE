# Changelog — newsletters

Formato: entradas en orden inverso (lo más reciente arriba). Cada mejora del módulo debe registrarse aquí.

## [Unreleased]

- Logo header Cursos de Arte actualizado a púrpura `#63277f` (alineado al footer / bloque Color Cursos); query `?v=` en logos de marca para evitar caché del PNG.
- Acción **Duplicar** en la lista (reemplaza Copiar URL): crea borrador con el mismo diseño, asunto y marca; slug nuevo. La URL pública sigue disponible con Abrir.
- Al eliminar un borrador de campaña (MALICHIMP / Campañas internas), si el boletín ligado está en draft y sin otras campañas, también se elimina y deja de bloquear Boletines.
- Pestaña **Remitentes** en Boletines (catálogo `EmailSender`); sale de MALICHIMP.
- UI del editor: nota + botón **Insertar {{first_name}}** (y atajo `{{fn}}` en GrapesJS / asunto) para la variable de nombre.
- Placeholders de nombre en boletines/campañas: `{{first_name}}` (y compatibles `<<First Name>>` / `*|FNAME|*`) se resuelven al enviar; fallback `estimado(a)`.
- Scrub de plantillas Mailchimp: “Ver este correo en el navegador” en todas (`/n/{slug}`); se eliminan preferencias/baja y badge “Powered by Mailchimp” (la baja la inyecta MALICHIMP al enviar); íconos sociales pasan a `/newsletter-brands/social/…`. Script: `pnpm --filter @mali-one/api prisma:fix:mailchimp-newsletter-links`.
- Bloques MALI alineados a sembradas: cabecera con logo, tipografía/CTA rosa en columnas, Color Museo/Cursos/Extensión, CTA Entradas + Outline, Redes sociales, pie con nav/redes/copyright.
- Copyright unificado en español con año actual (`newsletterCopyrightLine`) en footers de marca (museo/cursos/EP) y en el scrub de sembrados.
- Footer de marca usa íconos PNG (no letras) servidos desde el origen web.
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
