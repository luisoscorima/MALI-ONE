# Ownership PAM — CRM, producto y mailing

## Tres capas

| Capa | Dónde (UI) | Rol |
|------|------------|-----|
| **Vitrina** | `/admin/pam` Membresías PAM | Solo planes, beneficios, checkout del widget |
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
| `pam_memberships` | Vitrina `/admin/pam` |
| `crm_pam` | Contactos + Pagos + medios + envío boletines |
| `newsletters` | Editor |
