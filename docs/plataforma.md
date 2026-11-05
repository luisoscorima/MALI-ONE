# Plataforma MALI ONE

> Changelog: [plataforma-CHANGELOG.md](./plataforma-CHANGELOG.md) · Índice: [README.md](./README.md)

Documentación transversal: stack, desarrollo local, Docker, Nginx Proxy Manager, OAuth/GCP base, S3 IAM genérico y migraciones. El detalle de cada producto vive en su módulo.

## Stack

- **API:** NestJS + Prisma + PostgreSQL + Redis — `apps/api`
- **Web:** React 19 + Vite + Tailwind v4 + shadcn/ui — `apps/web`
- **Shared:** `packages/shared`
- **Infra:** Docker Compose en EC2, NPM en `dev.mali.pe`

## Desarrollo local

```bash
cp .env.example .env
pnpm install
pnpm --filter @mali-one/shared build
pnpm --filter @mali-one/api prisma:generate
docker compose up postgres redis -d
pnpm dev:api   # :3000
pnpm dev:web   # :5173
```

## Despliegue Docker + NPM

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

- Contenedor `mali-one-web` en red `nginx-proxy-manager_default`.
- Proxy Host: domain `dev.mali.pe` → `mali-one-web:80`.
- Nginx interno reenvía `/api/` y `/r/` al servicio `api`.
- Headers: `X-Forwarded-Proto`, `X-Forwarded-For`; `TRUST_PROXY=true`.

### WebSocket (screen-cast)

Activar **Websockets Support** en NPM y timeouts largos en `/socket.io/` (ver detalle en [screen-cast.md](./screen-cast.md)). Una sola réplica de API.

### Variables base

`APP_URL`, `GOOGLE_*`, `JWT_SECRET`, `COOKIE_DOMAIN`, `DATABASE_URL`, `REDIS_URL`, `AWS_*`, `BOOTSTRAP_ADMIN_EMAIL`, `CORS_ORIGINS`.

Ver `.env.example` completo.

## Google OAuth (sin billing GCP)

1. OAuth consent Internal + Client ID Web
2. Origins/callback = `APP_URL` / `/api/auth/google/callback`
3. Solo dominio `ALLOWED_DOMAIN` (default `mali.pe`)

## Google Admin SDK

Service Account + Domain-Wide Delegation; JSON en `secrets/google-sa.json` montado en API. Detalle operativo: [google-admin.md](./google-admin.md).

## AWS S3 (base)

Bucket principal `AWS_S3_BUCKET`. Con `S3_PUBLIC_READ=false`, redirects usan URL presignada. Gestor multi-bucket: [s3-manager.md](./s3-manager.md).

## Migraciones

```bash
pnpm --filter @mali-one/api prisma:migrate
# seed widgets solo entornos vacíos:
# WIDGET_SEED_ON_START=true  o  prisma:seed:widgets
```

## Core compartido (API)

| Carpeta | Rol |
|---------|-----|
| `apps/api/src/core/guards` | Auth JWT / permisos |
| `apps/api/src/core/permissions` | Módulos → acceso |
| `apps/api/src/core/prisma` | PrismaService |
| `apps/api/src/core/redis` | Redis |
| `apps/api/src/core/s3` | Cliente S3 |
| `apps/api/src/core/qr` | Generación QR |
