# Boletines (newsletters)

> Changelog: [newsletters-CHANGELOG.md](./newsletters-CHANGELOG.md) · Índice: [README.md](./README.md)

## Qué es

Editor visual por bloques de boletines HTML con URL pública `/n/{slug}`. El editor no decide audiencia ni transporta correo.

## Cómo funciona

1. Crear/editar newsletter (draft/published).
2. La URL pública sirve el HTML publicado.
3. MALICHIMP, Comunicación Interna u otro módulo autorizado seleccionan un boletín y guardan un snapshot inmutable al crear su campaña.
4. Tracking, bajas y transporte se añaden fuera de Boletines en `core/email-delivery` y en el módulo dueño de la audiencia.
5. Personalización de nombre: en el HTML o asunto puedes usar `{{first_name}}` (también vale `<<First Name>>` o `*|FNAME|*`). Al enviar, el motor SES lo reemplaza con el primer nombre del destinatario; si no hay nombre, usa `estimado(a)`.

## Código

- `apps/api/src/modules/newsletters/` — admin + public controllers
- Web: `newsletters-page.tsx`

## UI

| `/admin/newsletters` | Editor |
| `/n/:slug` | Vista pública |

## API

Admin: `/api/newsletters` CRUD.
Público: `GET /n/:slug`.

Las rutas `/mail/o|c/:token` pertenecen al motor compartido, no a este módulo.

## Datos (Prisma)

- `Newsletter` (incluye `brand` opcional: `museo`, `cursos_arte`, `extension_profesional`)
- Una campaña referencia el boletín para auditoría, pero envía `subjectSnapshot` y `htmlSnapshot`. Un boletín usado por campañas no puede eliminarse.
- Import Mailchimp: `pnpm --filter @mali-one/api prisma:seed:mailchimp-newsletters`
- Arreglar plantillas Mailchimp ya sembradas (enlaces, ver en navegador, íconos sociales): `pnpm --filter @mali-one/api prisma:fix:mailchimp-newsletter-links` (usa `--dry-run` para inspeccionar)
- Assets del import van a `s3://mali-one-files/newsletters/…`. El rol EC2 puede
  subirlos; la URL anónima S3 solo funciona si hay bucket policy pública (ver
  [aws-runtime-role.md](./aws-runtime-role.md)). Mientras tanto el HTML puede
  conservar `mcusercontent.com` y los logos de marca se sirven en
  `/newsletter-brands/`.

## Conexiones externas

| **MALICHIMP** | Audiencia y campañas de correo masivo |
| **Comunicación Interna** | Audiencia activa de Google Workspace |
| Públicos | HTML del boletín |

## Variables de entorno

El editor no envía correo. El transporte SES vive en `core/email-delivery` (ver [malichimp.md](./malichimp.md)). El SMTP de PAM (`PAM_SMTP_*`) es otro canal, solo para welcome transaccional.

## Permisos

Módulo: `newsletters`

## Relacionados

- [malichimp.md](./malichimp.md)
- [crm-pam.md](./crm-pam.md) — SMTP PAM, no SES
