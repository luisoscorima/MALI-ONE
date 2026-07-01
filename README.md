# MALI ONE

Sistema de operaciones internas (backoffice) para **mali.pe**.

## Módulos (Fase 1)

- Login Google Workspace (`@mali.pe` únicamente)
- Gestión manual de usuarios Google Admin
- Acortador de URLs + códigos QR
- Subida de archivos a S3 con URL corta y QR

## Stack

- **API:** NestJS + Prisma + PostgreSQL + Redis
- **Web:** React + Vite + Tailwind
- **Infra:** Docker Compose en EC2, Nginx Proxy Manager en `dev.mali.pe`

## Desarrollo local

```bash
cp .env.example .env
# Edita .env con tus credenciales

pnpm install
pnpm --filter @mali-one/shared build
pnpm --filter @mali-one/api prisma:generate

# Levantar solo DB (o usar docker compose up)
docker compose up postgres redis -d

pnpm dev:api   # terminal 1
pnpm dev:web   # terminal 2
```

- Web: http://localhost:5173
- API: http://localhost:3000/api

## Despliegue en EC2 con Docker

```bash
cp .env.example .env
# Configura producción (ver sección NPM)

mkdir -p secrets
# Copia tu JSON de GCP con nombre fijo (o ajusta GOOGLE_SERVICE_ACCOUNT_JSON_PATH):
cp /ruta/a/tu-service-account.json secrets/google-sa.json
chmod 600 secrets/google-sa.json

docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

El contenedor `mali-one-web` se une a la red **`nginx-proxy-manager_default`**. NPM debe apuntar por nombre de contenedor, no por puerto del host.

## Nginx Proxy Manager (`dev.mali.pe`)

1. Crear **Proxy Host**
   - Domain: `dev.mali.pe`
   - Scheme: `http`
   - Forward Hostname / IP: `mali-one-web` (nombre del contenedor en la red NPM)
   - Forward Port: `80`
   - SSL: Let's Encrypt activado en NPM

2. No necesitas locations extra: el Nginx del contenedor `web` ya reenvía `/api/` y `/r/` al servicio `api` por la red interna `mali-one_internal`.

3. Asegúrate de que NPM envíe headers:
   - `X-Forwarded-Proto: https`
   - `X-Forwarded-For`

4. En `.env` de producción:
   - `APP_URL=https://dev.mali.pe`
   - `GOOGLE_CALLBACK_URL=https://dev.mali.pe/api/auth/google/callback`
   - `COOKIE_DOMAIN=dev.mali.pe`
   - `TRUST_PROXY=true`

### Verificar red Docker

```bash
docker network inspect nginx-proxy-manager_default --format '{{range .Containers}}{{.Name}} {{end}}'
# Debe listar ... mali-one-web ... junto a los contenedores de NPM
```

### Desarrollo local con Docker (sin NPM)

Solo el archivo base publica el puerto **8080** en el host:

```bash
docker compose up -d --build
# http://localhost:8080
```

## Google OAuth (sin facturación GCP)

1. [Google Cloud Console](https://console.cloud.google.com) → nuevo proyecto (sin activar billing)
2. **APIs & Services → OAuth consent screen** → Internal
3. **Credentials → OAuth client ID** → Web application
   - Authorized JavaScript origins: `https://dev.mali.pe`
   - Authorized redirect URIs: `https://dev.mali.pe/api/auth/google/callback`
4. Copia Client ID y Secret a `.env`

## Google Admin SDK

1. Crear **Service Account** en el mismo proyecto GCP
2. Descargar JSON → `secrets/google-sa.json`
3. En **Google Workspace Admin** → Security → API Controls → Domain-wide delegation:
   - Client ID de la service account
   - Scopes:
     ```
     https://www.googleapis.com/auth/admin.directory.user
     https://www.googleapis.com/auth/admin.directory.user.security
     ```
4. Configura `GOOGLE_ADMIN_IMPERSONATE` con un super admin `@mali.pe`

**Importante:** el archivo debe existir en el host **antes** de `docker compose up`. Si montas un archivo que no existe, Docker crea un directorio vacío y verás `EISDIR`. Solución:

```bash
cp secrets/mali-one-XXXX.json secrets/google-sa.json
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate api
```

Verifica: `GET https://dev.mali.pe/api/health/google-admin`

## AWS S3

1. Bucket en `us-east-1` (ej. `mali-one-files`)
2. IAM user con permisos sobre los buckets que uses
3. Variables en `.env`: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`

Con `S3_PUBLIC_READ=false` (recomendado), los archivos se sirven con URL presignada al seguir el enlace corto `/r/{slug}`.

### Gestor S3 (solo super admin)

Mismas `AWS_ACCESS_KEY_ID` y `AWS_SECRET_ACCESS_KEY`, pero la política IAM debe incluir **todos los buckets** del gestor:

```env
BOOTSTRAP_ADMIN_EMAIL=loscorima@mali.pe
AWS_S3_MANAGER_BUCKETS=mali-assets,mali-backups,mali-one-files,tmsaws
```

Ejemplo de política IAM (mismas keys). **Importante:** `s3:PutObject` (subir en Enlaces) y `s3:ListBucket` (listar en Gestor S3) son permisos distintos:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ListBucketsForManager",
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::mali-assets",
        "arn:aws:s3:::mali-backups",
        "arn:aws:s3:::mali-one-files",
        "arn:aws:s3:::tmsaws"
      ]
    },
    {
      "Sid": "ObjectsInBuckets",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": [
        "arn:aws:s3:::mali-assets/*",
        "arn:aws:s3:::mali-backups/*",
        "arn:aws:s3:::mali-one-files/*",
        "arn:aws:s3:::tmsaws/*"
      ]
    }
  ]
}
```

Ruta del panel: `/admin/s3` (solo visible si tu email coincide con `BOOTSTRAP_ADMIN_EMAIL`).

## Migración futura a RDS

1. `pg_dump` del contenedor Postgres
2. Restore en RDS
3. Cambiar `DATABASE_URL` en `.env`
4. Reiniciar solo el servicio `api`

## Roles y permisos por módulo

### Quién puede entrar

Cualquier cuenta `@mali.pe` puede iniciar sesión con Google. Al primer login se crea como **operador** sin módulos asignados.

### Administrador del sistema

El email en `BOOTSTRAP_ADMIN_EMAIL` (ej. `loscorima@mali.pe`) es el **único super administrador**:

- Tiene acceso a todos los módulos automáticamente
- Gestiona accesos en **Accesos MALI ONE** (`/admin/app-users`)
- No se pueden modificar sus permisos desde la UI

### Módulos asignables

| Módulo | Ruta | Descripción |
|--------|------|-------------|
| `links` | `/links` | Enlaces cortos, QR y subida de archivos |
| `workspace_users` | `/admin/users` | Gestión de cuentas Google Workspace |
| `s3_manager` | `/admin/s3` | Explorador de buckets y archivos en AWS |
| `widget_educacion` | `/admin/widgets/educacion` | Mapa, selector, calendario, popup y aliados (educacion.mali.pe) |
| `widget_biblioteca` | `/admin/widgets/biblioteca` | Configurador carrusel Koha (biblioteca.mali.pe) |
| `widget_museo` | `/admin/widgets/museo` | Popup e interfaz embebible (mali.pe/es) |
| `pam_memberships` | `/admin/pam` | Planes, beneficios, registros y pagos PAM |

Ver [docs/WIDGETS-EMBED.md](docs/WIDGETS-EMBED.md) para snippets iframe en sitios públicos.

Los operadores solo ven en el menú los módulos que el super admin les habilita. La API también valida el acceso por módulo.

### Flujo típico

1. Un compañero entra con Google → aparece en **Accesos MALI ONE** tras su primer login
2. Tú (super admin) marcas los módulos que necesita y guardas
3. El usuario recarga la página y ya ve esos módulos en el menú

### Migración de base de datos

Tras desplegar, aplica la migración:

```bash
pnpm --filter @mali-one/api prisma:migrate
pnpm --filter @mali-one/api prisma:seed:widgets
```

O reinicia el contenedor `api` en Docker (ejecuta `prisma migrate deploy` al arrancar).
