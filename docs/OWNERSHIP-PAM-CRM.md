# Ownership PAM — CRM, producto y mailing

## Tres capas

| Capa | Dónde (UI) | Rol |
|------|------------|-----|
| **Vitrina** | `/admin/pam` Membresías PAM | Solo planes, beneficios, checkout del widget |
| **CRM + pagos** | `/admin/crm-pam` CRM PAM | Contactos WhatsApp + ledger de pagos (pasarela editable) |
| **Boletines** | `/admin/newsletters` | Editor; envío masivo SES desde CRM PAM |
| **Atributos / persona** | [WhatsApp `/attributes`](https://whatsapp.mali.pe/attributes) y `/contacts` | Catálogo y edición de attrs (incl. `payment_id`) |

## Fuente de verdad

| Dato | Dueño |
|------|--------|
| Persona nativa: nombre, apellido, teléfono, email, DNI | WhatsApp `contacts` |
| Segmentos y atributos custom | WhatsApp |
| `payment_id`, `pasarela`, plan, mp_status, expiry, demografía widget | Attrs CRM (copia); **dueño del pago** = ledger ONE |
| Ledger: plan, frecuencia, pasarela, MP, caducidad, welcome, checkout | `PamRegistration` en MALI ONE |

## Cruce Contactos ↔ Pagos

```text
contact.attributes.payment_id === PamRegistration.id
```

- Widget: sync crea/actualiza contacto + escribe `payment_id` y `pasarela`.
- Históricos: **Vincular** / **Vincular por teléfono** (pago más reciente).
- `payment_id` es atributo editable en WhatsApp (def creada automáticamente si no existe).

## Pasarela / opción de pago

Campo ledger `paymentGateway` (default `mercado_pago` en altas del widget).

Opciones: Mercado Pago, Niubiz, Izipay, Otro — editables en Pagos; altas manuales desde CRM PAM.

Copia a CRM: atributo `pasarela`.

## Ensure de atributos (widget → WhatsApp)

En cada sync, ONE llama `POST /api/crm/attribute-definitions/ensure`:

- Si el slug **no existe** en área `pam`, lo crea.
- Si **ya existe**, no hace nada.

Incluye: `payment_id`, `pasarela`, `plan`, `frecuencia`, `mp_status`, `expiry`, demografía del formulario widget, etc.

## Flujo

```text
Widget / alta manual Pagos → ONE ledger (pasarela)
      → ensure defs attrs WA (si faltan)
      → sync persona + payment_id + pasarela
      → Pagos: marcar MP/caducidad / vincular
      → Welcome SMTP
```

## Módulos

| Módulo | Qué abre |
|--------|----------|
| `pam_memberships` | Vitrina `/admin/pam` |
| `crm_pam` | Contactos + Pagos + envío boletines |
| `newsletters` | Editor |
