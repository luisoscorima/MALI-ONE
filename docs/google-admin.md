# Usuarios Google Workspace (google-admin)

> Changelog: [google-admin-CHANGELOG.md](./google-admin-CHANGELOG.md) · Índice: [README.md](./README.md)

## Qué es

CRUD de cuentas `@mali.pe` vía Google Admin SDK (Directory API) con Domain-Wide Delegation.

## Cómo funciona

1. API autentica con SA JSON e impersona `GOOGLE_ADMIN_IMPERSONATE`.
2. Operadores con `workspace_users` listan, crean, editan, resetean password y cierran sesiones.

## Código

- `apps/api/src/modules/google-admin/`
- Web: `admin-users-page.tsx`

## UI

| `/admin/users` | Gestión Workspace |

## API

Prefijo `/api/admin/users` — list, get, create, patch, reset-password, sign-out, delete, generate-password.
Health: `GET /api/health/google-admin`.

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

- [auth-google.md](./auth-google.md)
- [plataforma.md](./plataforma.md)
