# Ownership PAM — CRM, producto y mailing

## Tres capas

| Capa | Dónde | Rol |
|------|--------|-----|
| **CRM (persona)** | WhatsApp `contacts` área `pam` | Fuente de verdad de personas |
| **Pago / membresía** | MALI ONE `PamRegistration` (ledger) | MP, welcome SMTP, caducidad — UI **Pagos recientes** |
| **Vitrina** | Widget + `/admin/pam` | Planes, beneficios, checkout |

## Reparto de campos

**Ledger ONE:** registrado en, plan, frecuencia, checkout URL, acepta privacidad, estado MP, welcome, aviso caducidad, fecha caducidad (+ cobros MP a futuro).

**CRM WhatsApp — columnas:** nombre, apellido, correo, celular.

**CRM — atributos:** DNI, dirección, ciudad, distrito, género, fecha nacimiento, cómo te enteraste, y **copia** de `plan`, `frecuencia`, `mp_status`, `expiry`, `payment_id` (para segmentar; dueño = ONE).

## Flujo actual

```text
Widget → ONE (ledger) + sync persona a CRM
      → Checkout MP
      → (manual hoy / webhook) ONE: mp_status + expiry
      → re-sync atributos membresía al CRM
      → Welcome / avisos caducidad por SMTP pam@
      → Personas se leen en CRM PAM (ONE → API WhatsApp)
```

## Módulos

| Módulo | Ruta |
|--------|------|
| Membresías PAM (vitrina + pagos) | `/admin/pam` |
| CRM PAM (contactos + envío boletines) | `/admin/crm-pam` |
| Boletines | `/admin/newsletters` |

## Para cerrar el flujo (SMTP; sin SES de bienvenida)

Hecho / usable ahora (con config):

- Alta widget → ledger + CRM
- Pagos recientes: marcar MP, caducidad, reenviar welcome
- Cron avisos caducidad (si SMTP `PAM_SMTP_*` configurado)
- Caducidad mensual = +1 mes; anual = +1 año (desde confirmación)

Pendiente / frágil:

1. **`PAM_SMTP_*`** en producción (host, user, pass, from)
2. **`WHATSAPP_CRM_BASE_URL` + `WHATSAPP_CRM_SERVICE_TOKEN`** en ambos lados
3. **Webhook Mercado Pago** fiable (hoy matching por `checkoutUrl`/id es frágil; ops manual en Pagos)
4. **IDs de pago MP** persistidos en ledger (`mpPaymentId` / preapproval) para conciliar
5. **Renovaciones** (mismo celular, nuevo periodo) — política de update vs nueva fila
6. **Plantillas** welcome/expiry editables (hoy HTML fijo en código)
7. Boletines masivos SES = otro canal (no bloquea este flujo SMTP)
