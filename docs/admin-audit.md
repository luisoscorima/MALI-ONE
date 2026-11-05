# Auditoría admin (admin-audit)

> Changelog: [admin-audit-CHANGELOG.md](./admin-audit-CHANGELOG.md) · Índice: [README.md](./README.md)

## Qué es

Consulta de `AdminAuditLog` para acciones administrativas sensibles (p. ej. cambios de accesos, operaciones de tesorería).

## Cómo funciona

Los servicios escriben en `AdminAuditLog`; el super admin lista eventos con filtros.

## Código

- `apps/api/src/modules/admin-audit/`
- Web: `admin-audit-page.tsx`

## UI

| `/admin/audit` | Solo super admin |

## API

GET `/api/admin/audit-logs`

## Datos (Prisma)

- `AdminAuditLog`

## Conexiones externas

Ninguna externa.

## Variables de entorno

N/A

## Permisos

Solo super admin.

## Relacionados

- [app-users.md](./app-users.md)
- [treasury.md](./treasury.md)
