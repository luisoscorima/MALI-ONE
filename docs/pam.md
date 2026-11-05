# PAM admin / ledger (pam)

> Changelog: [pam-CHANGELOG.md](./pam-CHANGELOG.md) · Índice: [README.md](./README.md)

## Qué es

API admin de **settings, planes, registros (ledger)** y reenvío de welcome (SMTP/WhatsApp). La vitrina pública es el widget PAM; la operación comercial es CRM PAM.

## Cómo funciona

- Admin mantiene planes/beneficios y consulta registros.
- Altas desde widget crean `PamRegistration` y sync a WhatsApp.
- Expiry notices: preview/send.

## Código

- `apps/api/src/modules/pam/pam-admin.controller.ts`
- Widget público: `apps/api/src/modules/widgets/pam/`
- Web vitrina: `widget-pam-page.tsx`

## UI

| `/admin/widget-pam` | Vitrina (módulo `widget_pam`) |
| `/admin/crm-pam` | Pagos/contactos (`crm_pam`) |

## API

`/api/pam`: settings, plans, registrations, resend-welcome(+whatsapp), expiry-notices.
Widget público: `/api/widgets/pam/config`, `registrations`, `webhooks/mercadopago`.

## Datos (Prisma)

- `PamWidgetSettings`, `PamPlan`, `PamPaymentMethod`, `PamRegistration`

## Conexiones externas

| Sistema | Uso |
|---------|-----|
| **Mercado Pago** | Checkout + webhook |
| **SMTP PAM** | Correos welcome |
| **WhatsApp CRM + template Meta** | Sync persona / welcome WA |

## Variables de entorno

```env
PAM_SMTP_HOST=
PAM_SMTP_PORT=587
PAM_SMTP_USER=
PAM_SMTP_PASS=
PAM_SMTP_FROM=pam@mali.pe
PAM_WA_WELCOME_TEMPLATE=
WHATSAPP_CRM_BASE_URL=
WHATSAPP_CRM_SERVICE_TOKEN=
```

## Permisos

`widget_pam` (vitrina) y `crm_pam` (ledger operativo / campañas).

## Relacionados

- [crm-pam.md](./crm-pam.md)
- [widgets.md](./widgets.md)
