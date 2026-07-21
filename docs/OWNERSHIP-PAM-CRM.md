# Ownership PAM — CRM, producto y mailing

## Tres capas

| Capa | Dónde (UI) | Rol |
|------|------------|-----|
| **Vitrina** | `/admin/pam` Membresías PAM | Solo planes, beneficios, checkout del widget |
| **CRM + pagos** | `/admin/crm-pam` CRM PAM | Contactos WhatsApp + ledger MP (manual hoy) + welcome SMTP |
| **Boletines** | `/admin/newsletters` | Editor; envío masivo SES desde CRM PAM |

## Fuente de verdad

| Dato | Dueño |
|------|--------|
| Persona (nombre, apellido, email, celular) | WhatsApp CRM `contacts` área `pam` |
| Demografía (DNI, dirección, etc.) | Atributos CRM |
| Plan, frecuencia, MP, caducidad, welcome, checkout | Ledger ONE `PamRegistration` (copia de plan/MP/expiry en attrs CRM para segmentar) |

## Flujo

```text
Widget → ONE ledger + sync persona a CRM WhatsApp
      → Checkout MP
      → CRM PAM → pestaña Pagos: marcar MP + caducidad (manual hoy)
      → re-sync attrs membresía al CRM
      → Welcome / avisos caducidad por SMTP pam@
      → CRM PAM → Contactos: ve persona CRM cruzada con ledger
```

## Módulos de acceso

| Módulo | Qué abre |
|--------|----------|
| `pam_memberships` | Solo vitrina `/admin/pam` |
| `crm_pam` | CRM + ledger pagos + envío boletines |
| `newsletters` | Editor de boletines |

## Para cerrar el flujo (SMTP; sin SES de bienvenida)

Usable con config:

- Alta widget → ledger + CRM
- CRM PAM → Pagos: MP, caducidad, reenviar welcome
- Cron avisos caducidad si `PAM_SMTP_*`
- Caducidad: mensual +1 mes; anual +1 año

Pendiente:

1. `PAM_SMTP_*` en producción
2. `WHATSAPP_CRM_*` en ambos lados
3. Webhook Mercado Pago fiable
4. IDs de pago MP en ledger
5. Política de renovaciones
6. Plantillas welcome/expiry editables
