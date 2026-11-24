# Usuarios Google Workspace (google-admin)

> Changelog: [google-admin-CHANGELOG.md](./google-admin-CHANGELOG.md) · Índice: [README.md](./README.md)

## Qué es

CRUD de cuentas `@mali.pe` vía Google Admin SDK (Directory API) con Domain-Wide Delegation, más **Campañas internas** (antes Comunicación interna): envíos SES a activos recientes por unidad organizativa.

## Cómo funciona

1. API autentica con SA JSON e impersona `GOOGLE_ADMIN_IMPERSONATE`.
2. Operadores con `workspace_users` listan, crean, editan, resetean password y cierran sesiones.
3. En **Campañas internas** el flujo es el mismo patrón que MALICHIMP: OU (include/exclude), actividad (1–90 días), remitente del catálogo `internal_communications`, plantilla de la biblioteca del módulo (`?tab=contenido`), asunto, y enviar ahora o programar. También hay miniatura en fila, duplicar y continuar borradores.

## Código

- `apps/api/src/modules/google-admin/`
- `apps/api/src/modules/internal-communications/` — API de campañas internas (`RequireModule(workspace_users)`)
- Web: `admin-users-page.tsx`, `workspace-internal-campaigns.tsx`

## UI

| `/admin/users` | Directorio Workspace |
| `/admin/users?tab=campanas` | Campañas internas |
| `/admin/users?tab=contenido` | Biblioteca de plantillas del módulo |
| `/admin/comunicacion-interna` | Redirect legacy → `?tab=campanas` |

## API

Prefijo `/api/admin/users` — list, get, create, patch, reset-password, sign-out, delete, generate-password.
Health: `GET /api/health/google-admin`.

Campañas internas (`/api/internal-communications`, permiso `workspace_users`):

- `GET /audience?activeDays=`
- `POST /audience/preview` — `{ orgUnitPaths?, excludeOrgUnitPaths?, activeDays? }`
- `GET /newsletters`, `GET /newsletters/:id`, `POST /newsletters/draft`
- `GET /campaigns`, `GET /campaigns/:id`, `GET /campaigns/:id/view`, `GET /campaigns/:id/stats`
- `POST /campaigns` — `{ name, newsletterId, draftNewsletterId?, subject, fromEmail, replyTo, orgUnitPaths, excludeOrgUnitPaths?, activeDays?, scheduledAt? }`
- `POST /campaigns/:id/duplicate`, `DELETE /campaigns/:id` (solo borradores; libera boletín huérfano en draft), `POST /campaigns/:id/send`

## Datos (Prisma)

No persiste usuarios Workspace en Prisma (vive en Google). Usa el usuario local solo para permisos.

## Conexiones externas

| **Google Admin SDK** | Directory users |
| **secrets/google-sa.json** | Credencial SA |

## Variables de entorno

```env
GOOGLE_SECRETS_DIR=./secrets
GOOGLE_SERVICE_ACCOUNT_JSON_PATH=/run/secrets/google-sa.json
GOOGLE_ADMIN_IMPERSONATE=admin@mali.pe
```

## Permisos

Módulo: `workspace_users`

## Relacionados

- [newsletters.md](./newsletters.md) — boletines y remitentes
- [malichimp.md](./malichimp.md) — motor SES compartido
- [auth-google.md](./auth-google.md)
- [plataforma.md](./plataforma.md)
