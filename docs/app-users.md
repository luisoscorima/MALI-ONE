# Accesos MALI ONE (app-users)

> Changelog: [app-users-CHANGELOG.md](./app-users-CHANGELOG.md) · Índice: [README.md](./README.md)

## Qué es

Panel del super admin para asignar módulos (`AppModule`) a usuarios que ya hicieron login.

## Cómo funciona

1. Tras el primer login, el usuario aparece en Accesos.
2. Super admin marca módulos y guarda → `UserModuleAccess`.
3. Sidebar y guards de API filtran por esos módulos. El bootstrap admin no se edita desde UI.

## Código

- API: `apps/api/src/modules/app-users/`
- Web: `apps/web/src/pages/app-users-page.tsx`
- Catálogo módulos: `packages/shared` + `apps/web/src/lib/app-modules.ts`

## UI

| `/admin/app-users` | Solo super admin |

## API

| Método | Ruta |
|--------|------|
| GET | `/api/admin/app-users` |
| PATCH | `/api/admin/app-users/:id/modules` |

## Datos (Prisma)

- `User`, `UserModuleAccess`

## Conexiones externas

Ninguna externa (solo DB).

## Variables de entorno

Usa `BOOTSTRAP_ADMIN_EMAIL` de auth.

## Permisos

Solo `isSuperAdmin` (email bootstrap).

## Relacionados

- [auth-google.md](./auth-google.md)
- [admin-audit.md](./admin-audit.md)
