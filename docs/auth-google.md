# Autenticación Google (auth-google)

> Changelog: [auth-google-CHANGELOG.md](./auth-google-CHANGELOG.md) · Índice: [README.md](./README.md)

## Qué es

Login OAuth2 con Google Workspace restringido a `@mali.pe`. Emite JWT en cookie httpOnly y expone `/api/auth/me`.

## Cómo funciona

1. Usuario entra a `/login` → `GET /api/auth/google`.
2. Callback valida dominio, crea/actualiza `User` (primer login = operador sin módulos).
3. Cookie JWT; `GET /api/auth/me` alimenta el admin; logout limpia cookie.
4. Opcional: `PUT /api/auth/me/accent-theme` para tema de acento.

## Código

- `apps/api/src/modules/auth-google/` — `auth.controller.ts`, `auth.service.ts`, `google.strategy.ts`, `jwt.strategy.ts`
- Web: `login-page.tsx`, contexto de auth

## UI

| `/login` | Inicio de sesión |

## API

| Método | Ruta |
|--------|------|
| GET | `/api/auth/google` |
| GET | `/api/auth/google/callback` |
| GET | `/api/auth/me` |
| PUT | `/api/auth/me/accent-theme` |
| POST | `/api/auth/logout` |

## Datos (Prisma)

- `User`, `UserModuleAccess`

## Conexiones externas

| **Google OAuth** | Identidad |
| **PostgreSQL** | Usuarios y accesos |

## Variables de entorno

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=
ALLOWED_DOMAIN=mali.pe
JWT_SECRET=
COOKIE_DOMAIN=
BOOTSTRAP_ADMIN_EMAIL=
```

## Permisos

Cualquier `@mali.pe` puede autenticarse. El super admin es `BOOTSTRAP_ADMIN_EMAIL` (todos los módulos).

## Relacionados

- [app-users.md](./app-users.md)
- [plataforma.md](./plataforma.md)
