# Ownership PAM — CRM, producto y mailing

## Tres capas

| Capa | Dónde (UI) | Rol |
|------|------------|-----|
| **Vitrina** | `/admin/pam` Membresías PAM | Solo planes, beneficios, checkout del widget |
| **CRM + pagos** | `/admin/crm-pam` CRM PAM | Centralizadora: contactos WhatsApp + ledger MP + vínculo `payment_id` |
| **Boletines** | `/admin/newsletters` | Editor; envío masivo SES desde CRM PAM |

## Fuente de verdad

| Dato | Dueño |
|------|--------|
| Persona nativa: nombre, apellido, teléfono, email, DNI (opcional), opt-ins | WhatsApp `contacts` área `pam` |
| Segmentos | WhatsApp `contact_segments` |
| Atributos demográficos / custom | WhatsApp `contact_attributes` según catálogo `/attributes` |
| Plan, frecuencia, MP, caducidad, welcome, checkout | Ledger ONE `PamRegistration` |
| Copia operativa en CRM (`payment_id`, `plan`, `mp_status`, `expiry`, …) | Escrita por sync ONE → WA (para segmentar) |

## Cruce Contactos ↔ Pagos

```text
contact.attributes.payment_id === PamRegistration.id
```

- Altas del widget: sync crea/actualiza contacto y escribe `payment_id`.
- Históricos / otras pasarelas: en **Pagos** → “Vincular a este pago” o “Vincular por teléfono” (elige el `PamRegistration` más reciente por celular).
- La tabla Contactos **no** hace fallback por teléfono: solo muestra ledger si hay `payment_id`.

## Bidireccionalidad

- WhatsApp es canónico de personas/attrs.
- MALI ONE lee y escribe vía CRM API (`GET/PATCH contacts`, defs, sync).
- Editar en CRM PAM o en WhatsApp `/contacts` actualiza la misma ficha.
- Definiciones de atributos: WhatsApp `/attributes` o pestaña **Atributos** en CRM PAM.

## Flujo

```text
Widget / alta legacy → ONE ledger
      → sync (o Vincular) → contacto WA + payment_id
      → CRM PAM Pagos: marcar MP + caducidad
      → re-sync attrs membresía
      → Welcome SMTP pam@
      → CRM PAM Contactos: persona + attrs + estado ledger
```

## Módulos de acceso

| Módulo | Qué abre |
|--------|----------|
| `pam_memberships` | Solo vitrina `/admin/pam` |
| `crm_pam` | CRM + ledger pagos + defs + envío boletines |
| `newsletters` | Editor de boletines |

## Para cerrar el flujo (SMTP)

1. `PAM_SMTP_*` en producción
2. `WHATSAPP_CRM_*` en ambos lados
3. Webhook Mercado Pago fiable
4. IDs de pago MP en ledger
5. Política de renovaciones (hoy un solo `payment_id` activo por contacto)
6. Plantillas welcome/expiry editables
