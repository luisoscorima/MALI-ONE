# Ownership PAM — CRM, producto y mailing

## Tres capas

| Capa | Dónde | Rol |
|------|--------|-----|
| **CRM** | WhatsApp (`contacts` área `pam`) | Fuente de verdad de personas |
| **Producto** | MALI ONE (`PamRegistration`, planes, MP) | Membresías, pagos, históricos |
| **Vitrina** | Widget PAM embebido | Escaparate público; no lista CRM |

## Módulos en MALI ONE (separados)

| Módulo | Ruta | Permiso | Qué hace |
|--------|------|---------|----------|
| **Boletines** | `/admin/newsletters` | `newsletters` | Editor por bloques (drag & drop), publicar, URL `/n/{slug}` |
| **CRM PAM** | `/admin/crm-pam` | `crm_pam` | Lista contactos (API WhatsApp), export CSV, envío SES de boletines publicados |
| **Membresías PAM** | `/admin/pam` | `pam_memberships` | Producto: planes, registros, pagos |

## Configuración

```env
WHATSAPP_CRM_BASE_URL=https://whatsapp.mali.pe
WHATSAPP_CRM_SERVICE_TOKEN=<mismo que CRM_SERVICE_TOKEN en WhatsApp>
SES_FROM_EMAIL=noreply@mali.pe
SES_FROM_NAME=MALI
```

Contrato API WhatsApp: `docs/CRM-API.md` en mali-whatsapp-mvp (`/api/crm/sync`, `/api/crm/audience`, `/api/crm/contacts`).

## Flujo operativo

1. Widget/admin → `PamRegistration` → sync a WhatsApp CRM  
2. Usuario crea boletín en **Boletines** → publica → copia URL  
3. En **CRM PAM** ve la lista (fuente WhatsApp) → elige boletín → envía por SES  
