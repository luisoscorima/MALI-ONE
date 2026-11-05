# Boletines (newsletters)

> Changelog: [newsletters-CHANGELOG.md](./newsletters-CHANGELOG.md) · Índice: [README.md](./README.md)

## Qué es

Editor visual por bloques de boletines HTML con URL pública `/n/{slug}`. El **envío masivo SES** se dispara desde CRM PAM (campañas), no desde el editor solo.

## Cómo funciona

1. Crear/editar newsletter (draft/published).
2. URL pública sirve HTML; tracking opens/clicks vía tokens `/mail/o|c/:token` cuando hay campaña.
3. CRM PAM selecciona audiencia WhatsApp + newsletter y envía por SES.

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
- Campañas/envíos viven con CRM PAM: `EmailCampaign`, `EmailSend`, `EmailEvent`

## Conexiones externas

| **AWS SES** | Envío masivo (desde crm-pam) |
| Públicos | HTML del boletín |

## Variables de entorno

```env
SES_FROM_EMAIL=noreply@mali.pe
SES_FROM_NAME=MALI
# mismas AWS_ACCESS_KEY_ID / SECRET / REGION
```

## Permisos

Módulo: `newsletters` (envío requiere también `crm_pam`)

## Relacionados

- [crm-pam.md](./crm-pam.md)
- [crm-pam.md](./crm-pam.md)
