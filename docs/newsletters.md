# Boletines (newsletters)

> Changelog: [newsletters-CHANGELOG.md](./newsletters-CHANGELOG.md) · Índice: [README.md](./README.md)

## Qué es

Editor visual por bloques de boletines HTML con URL pública `/n/{slug}`. El editor no decide audiencia ni transporta correo.

## Cómo funciona

1. Crear/editar newsletter (draft/published).
2. URL pública sirve HTML; tracking opens/clicks vía tokens `/mail/o|c/:token` cuando hay campaña.
3. MALICHIMP será el consumidor del boletín para campañas de correo; el transporte SES es infraestructura compartida.

## Código

- `apps/api/src/modules/newsletters/` — admin + public controllers
- Web: `newsletters-page.tsx`

## UI

| `/admin/newsletters` | Editor |
| `/n/:slug` | Vista pública |

## API

Admin: `/api/newsletters` CRUD.
Público: `GET /n/:slug`, `GET /mail/o/:token`, `GET /mail/c/:token`.

## Datos (Prisma)

- `Newsletter`
- Los modelos históricos `EmailCampaign`, `EmailSend` y `EmailEvent` se conservan mientras se rediseña el flujo independiente de campañas.

## Conexiones externas

| **MALICHIMP** | Audiencia futura para campañas |
| Públicos | HTML del boletín |

## Variables de entorno

El editor no envía correo. El transporte SES vive en `core/email-delivery` (ver [malichimp.md](./malichimp.md)). El SMTP de PAM (`PAM_SMTP_*`) es otro canal, solo para welcome transaccional.

## Permisos

Módulo: `newsletters`

## Relacionados

- [malichimp.md](./malichimp.md)
- [crm-pam.md](./crm-pam.md) — SMTP PAM, no SES
