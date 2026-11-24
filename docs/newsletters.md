# Boletines (newsletters)

> Changelog: [newsletters-CHANGELOG.md](./newsletters-CHANGELOG.md) · Índice: [README.md](./README.md)

## Qué es

Editor visual por bloques de boletines HTML con URL pública `/n/{slug}`. El editor no decide audiencia ni transporta correo.

## Cómo funciona

1. Crear/editar newsletter (draft/published).
2. La URL pública sirve el HTML publicado.
3. MALICHIMP, Campañas internas (Usuarios Workspace) u otro módulo autorizado seleccionan un boletín y guardan un snapshot inmutable al crear su campaña.
4. Tracking, bajas, “Ver este correo en el navegador” y transporte se añaden fuera de Boletines en `core/email-delivery` (al enviar). El HTML guardado del boletín no incluye ese link ni el de cancelar suscripción; el estilo es único para todos los envíos.
5. Personalización de nombre: en el HTML o asunto puedes usar `{{first_name}}` (también vale `<<First Name>>` o `*|FNAME|*`). Al enviar, el motor SES lo reemplaza con el primer nombre del destinatario; si no hay nombre, usa `estimado(a)`. En el editor hay una nota, un botón **Insertar {{first_name}}** y el atajo `{{fn}}` en la barra de GrapesJS; el asunto también tiene un acceso rápido.
6. La pestaña **Remitentes** (módulo `newsletters`) administra el catálogo compartido `EmailSender` (`@mali.pe`) usado por MALICHIMP y Campañas internas.

## Código

- `apps/api/src/modules/newsletters/` — admin + public controllers
- Web: `newsletters-page.tsx`

## UI

| `/admin/newsletters` | Boletines + Remitentes |
| `/admin/newsletters?tab=remitentes` | Catálogo `EmailSender` (módulo newsletters) |
| `/n/:slug` | Vista pública (`shared` + `library` + `published`) |
| `/mail/view/:token` | Correo histórico congelado (por destinatario) |
| MALICHIMP → Contenido | Working copies de campañas (no biblioteca) |

## API

Admin: `/api/newsletters` CRUD + `POST /api/newsletters/:id/duplicate`.
Público: `GET /n/:slug` (versión actual del boletín).

Las rutas `/mail/o|c|view/:token` pertenecen al motor compartido, no a este módulo. `GET /mail/view/:token` sirve el `htmlSnapshot` de la campaña con personalización del destinatario; no registra apertura.

## Datos (Prisma)

- `Newsletter` (incluye `brand` opcional: `museo`, `cursos_arte`, `extension_profesional`)
- Una campaña referencia el boletín para auditoría, pero envía `subjectSnapshot` y `htmlSnapshot`. Un boletín usado por campañas no puede eliminarse.
- Import Mailchimp: `pnpm --filter @mali-one/api prisma:seed:mailchimp-newsletters`
- Arreglar plantillas Mailchimp ya sembradas (enlaces Mailchimp, quitar “ver en navegador” del HTML, íconos sociales): `pnpm --filter @mali-one/api prisma:fix:mailchimp-newsletter-links` (usa `--dry-run` para inspeccionar). El link “Ver este correo…” se inyecta al enviar y apunta a `/mail/view/{openToken}` (snapshot), no a `/n/:slug`.
- Assets del import van a `s3://mali-one-files/newsletters/…`. El rol EC2 puede
  subirlos; la URL anónima S3 solo funciona si hay bucket policy pública (ver
  [aws-runtime-role.md](./aws-runtime-role.md)). Mientras tanto el HTML puede
  conservar `mcusercontent.com` y los logos de marca se sirven en
  `/newsletter-brands/`.

## Conexiones externas

| **MALICHIMP** | Audiencia y campañas de correo masivo |
| **Usuarios Workspace → Campañas internas** | Audiencia activa por OU de Google Workspace |
| Públicos | HTML del boletín |

## Remitentes

Pestaña en Boletines (quien tiene módulo `newsletters`):

- Solo acepta direcciones `@mali.pe`.
- Listado disponible para operadores autenticados al armar campañas; CRUD con módulo `newsletters`.
- El listado muestra quién creó cada remitente (registros antiguos pueden quedar sin autor).
- No se puede eliminar el último remitente.
- Crear o editar no verifica identidades en AWS SES: el dominio/dirección deben estar autorizados en SES.
- Borrar un remitente no altera campañas ya creadas.

## Variables de entorno

El editor no envía correo. El transporte SES vive en `core/email-delivery` (ver [malichimp.md](./malichimp.md)). El SMTP de PAM (`PAM_SMTP_*`) es otro canal, solo para welcome transaccional.

## Permisos

Módulo: `newsletters`

## Relacionados

- [malichimp.md](./malichimp.md)
- [google-admin.md](./google-admin.md) — Campañas internas
- [crm-pam.md](./crm-pam.md) — SMTP PAM, no SES
