# CRM PAM (crm-pam)

> Changelog: [crm-pam-CHANGELOG.md](./crm-pam-CHANGELOG.md) · Índice: [README.md](./README.md)

## Qué es

Operación de **contactos PAM** (fuente WhatsApp), **ledger de pagos**, medios de pago y **campañas de boletines SES**. La vitrina del widget está en [pam.md](./pam.md) / [widgets.md](./widgets.md); la persona nativa vive en mali-whatsapp.

## Cómo funciona

```text
Widget / alta manual → PamRegistration (ledger ONE)
  → sync attrs a WhatsApp (payment_id, medio_pago, plan, …)
  → welcome SMTP / WhatsApp template
  → campañas SES desde contactos/segmentos CRM
```

Cruce: `contact.attributes.payment_id === PamRegistration.id`.

## Código

- `apps/api/src/modules/crm-pam/` — controller, service, scheduler, `ses-mail.service.ts`
- Cliente WA global: `apps/api/src/modules/crm/` (`CrmClientModule` + `whatsapp-crm-client.service.ts`) — compartido con educación, widgets y catálogo
- Web: `crm-pam-page.tsx`
- Ledger/admin planes también en módulo `pam`; importa `NewslettersModule` para campañas

## UI

| Ruta | Uso |
|------|-----|
| `/admin/crm-pam` | Contactos, pagos, medios, campañas |

## API

Prefijo `/api/crm-pam`: contacts, attribute-definitions, segments, payments, payment-methods, newsletters, campaigns (+ audience-preview, send).

## Datos (Prisma)

- `PamRegistration`, `PamPaymentMethod`, `PamPlan`, `PamWidgetSettings` (vitrina)
- `EmailCampaign`, `EmailSend`, `EmailEvent`
- Contactos: **mali-whatsapp** (no tabla local de persona)

## Conexiones externas

| Sistema | Uso |
|---------|-----|
| **mali-whatsapp** (`WHATSAPP_CRM_*`) | Contactos, attrs, segmentos área `pam` |
| **AWS SES** | Campañas |
| **SMTP PAM** | Welcome `pam@mali.pe` |
| **Mercado Pago** | Checkout widget (webhook en widgets/pam) |
| **Meta WhatsApp template** | `PAM_WA_WELCOME_TEMPLATE` |

## Variables de entorno

```env
WHATSAPP_CRM_BASE_URL=
WHATSAPP_CRM_SERVICE_TOKEN=
SES_FROM_EMAIL=noreply@mali.pe
PAM_SMTP_HOST=
PAM_SMTP_USER=
PAM_SMTP_PASS=
PAM_SMTP_FROM=pam@mali.pe
PAM_WA_WELCOME_TEMPLATE=
```

## Permisos

Módulo: `crm_pam`

## Relacionados

- [pam.md](./pam.md), [newsletters.md](./newsletters.md), [widgets.md](./widgets.md)

## Ownership (fuente de verdad)

# Ownership PAM — CRM, producto y mailing

## Tres capas

| Capa | Dónde (UI) | Rol |
|------|------------|-----|
| **Vitrina** | `/admin/widget-pam` Widget PAM | Solo planes, beneficios, checkout del widget |
| **CRM + pagos** | `/admin/crm-pam` CRM PAM | Contactos WhatsApp + ledger de pagos + **medios de pago** |
| **Boletines** | `/admin/newsletters` | Editor; envío masivo SES desde CRM PAM |
| **Atributos / persona** | [WhatsApp `/attributes`](https://whatsapp.mali.pe/attributes) y `/contacts` | Catálogo y edición de attrs (incl. `payment_id`, `medio_pago`) |

## Fuente de verdad

| Dato | Dueño |
|------|--------|
| Persona nativa: nombre, apellido, teléfono, email, DNI | WhatsApp `contacts` |
| Segmentos y atributos custom | WhatsApp |
| `payment_id`, `medio_pago`, plan, mp_status, expiry, demografía widget | Attrs CRM (copia); **dueño del pago** = ledger ONE |
| Catálogo de medios de pago | `PamPaymentMethod` en MALI ONE |
| Ledger: plan, frecuencia, medio, MP, caducidad, welcome, checkout | `PamRegistration` en MALI ONE |

## Cruce Contactos ↔ Pagos

```text
contact.attributes.payment_id === PamRegistration.id
```

- Widget: sync crea/actualiza contacto + escribe `payment_id` y `medio_pago`.
- Históricos: **Vincular** / **Vincular por teléfono** (pago más reciente).
- `payment_id` y `medio_pago` son atributos editables en WhatsApp (defs creadas automáticamente si no existen).

## Medio de pago

Catálogo editable en **CRM PAM → Pagos → Medios de pago**.

- Único medio de sistema: **Mercado Pago** (`mercado_pago`) — default obligatorio en registros del widget (luego editable a mano).
- Puedes crear Niubiz, Izipay u otros y asignarlos al dar de alta un pago externo o al editar un pago.

Campo ledger: `PamRegistration.paymentMethod` (slug). Copia a CRM: atributo `medio_pago` (label).

## Ensure de atributos (widget → WhatsApp)

En cada sync, ONE llama `POST /api/crm/attribute-definitions/ensure`:

- Si el slug **no existe** en área `pam`, lo crea.
- Si **ya existe**, no hace nada.

Incluye: `payment_id`, `medio_pago`, `plan`, `frecuencia`, `mp_status`, `expiry`, demografía del formulario widget, etc.

## Flujo

```text
Widget → ONE ledger (medio = Mercado Pago)
   o Contacto CRM → Crear pago (form precargado)
   o Pagos → Añadir pago (autocomplete por nombre/celular)
      → ensure defs attrs WA (si faltan)
      → sync persona + payment_id + medio_pago
      → Pagos: marcar MP/caducidad / vincular
      → Welcome SMTP
```

## Módulos

| Módulo | Qué abre |
|--------|----------|
| `widget_pam` | Vitrina `/admin/widget-pam` |
| `crm_pam` | Contactos + Pagos + medios + envío boletines |
| `newsletters` | Editor |
