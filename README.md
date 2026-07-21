# MALI ONE

Sistema de operaciones internas (backoffice) para **mali.pe**.

## Módulos (Fase 1)

- Login Google Workspace (`@mali.pe` únicamente)
- Gestión manual de usuarios Google Admin
- **Enlaces y QR** (`/links`): acortador, WhatsApp, archivos S3, QR personalizable, carga masiva Excel y estadísticas
- Gestor S3 (super admin)
- Configuradores de widgets embebidos (educación, biblioteca, museo) y membresías PAM
- **Boletines** (`/admin/newsletters`): editor por bloques, URL pública `/n/{slug}`
- **CRM PAM** (`/admin/crm-pam`): lista de contactos (fuente WhatsApp) y envío SES de boletines

Ver ownership CRM/producto/vitrina en [docs/OWNERSHIP-PAM-CRM.md](docs/OWNERSHIP-PAM-CRM.md).

### Enlaces y QR (`/links`)

| Función | Descripción |
|---------|-------------|
| URL / WhatsApp / Archivo | Creación individual con slug, tags y QR |
| Carga masiva Excel | Hasta 100 filas (URL o WhatsApp); archivos vía selector múltiple (hasta 50) |
| Diseño QR | Colores sólidos o degradado, fondo blanco/transparente, formas (cuadrados, círculos, redondeados), logo MALI preset o propio |
| Export | PNG, SVG y EPS por enlace |
| Estilo predeterminado | Por usuario; cada enlace nuevo hereda una copia editable |
| Estadísticas | Clicks/escaneos por día, dispositivo, navegador y SO (`LinkClick`) |

Ver sugerencias de evolución en [docs/MEJORAS-PROXIMAS.md](docs/MEJORAS-PROXIMAS.md).

## Stack

- **API:** NestJS + Prisma + PostgreSQL + Redis
- **Web:** React 19 + Vite + Tailwind CSS v4 + [shadcn/ui](https://ui.shadcn.com) (Radix)
- **QR (API):** `@loskir/styled-qr-code-node` (skia-canvas, prebuilds Linux)
- **QR (Web):** `qr-code-styling` (preview en vivo)
- **Gráficos:** Recharts (estadísticas de enlaces)
- **Excel:** `xlsx` (importación masiva en enlaces)
- **Infra:** Docker Compose en EC2, Nginx Proxy Manager en `dev.mali.pe`

### Frontend (admin `apps/web`)

Interfaz oscura MALI ONE basada en shadcn/ui:

- **Componentes:** button, input, card, table, dialog, tabs, sheet, select, breadcrumb, tooltip, sonner, etc. en `apps/web/src/components/ui/`
- **Notificaciones:** Sonner (reemplaza el toast custom anterior)
- **Confirmaciones:** `useConfirm()` con Alert Dialog
- **Patrones UX:** `ModuleCard` en dashboard y hubs de widgets, `PageLoading` / `TableSkeleton` para estados de carga, acciones con iconos + tooltip, botones de guardado compactos (`WidgetSaveButton`)
- **Navegación:** sidebar shadcn (`SidebarProvider`, `AppSidebar`, `NavUser` con dropdown) agrupado por secciones; header con `SidebarTrigger`
- **Dashboard:** cards estilo `SectionCards` de shadcn (gradiente + grid responsivo con `@container`)

Los iframes embebidos en sitios públicos viven en `apps/web/public/widgets/` y no forman parte del admin.

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
| `links` | `/links` | Enlaces cortos, QR personalizable, carga masiva, estadísticas y subida de archivos |
| `workspace_users` | `/admin/users` | Gestión de cuentas Google Workspace |
| `s3_manager` | `/admin/s3` | Explorador de buckets y archivos en AWS |
| `widget_educacion` | `/admin/widgets/educacion` | Mapa, selector, calendario, popup y aliados (educacion.mali.pe) |
| `widget_biblioteca` | `/admin/widgets/biblioteca` | Configurador carrusel Koha (biblioteca.mali.pe) |
| `widget_museo` | `/admin/widgets/museo` | Popup e interfaz embebible (mali.pe/es) |
| `pam_memberships` | `/admin/pam` | Vitrina PAM: planes y beneficios (pagos en CRM PAM) |
| `newsletters` | `/admin/newsletters` | Boletines HTML (bloques), URL pública compartible |
| `crm_pam` | `/admin/crm-pam` | Contactos WhatsApp + ledger pagos MP + envío SES |
| `screen_cast` | `/admin/screen-cast` | Playlists y monitores para tótems y quioscos |
| `bsale_reports` | `/bsale/kardex` | Kardex consolidado Bsale |
| `password_vault` | `/vault` | Acceso a Vaultwarden |

Ver [docs/WIDGETS-EMBED.md](docs/WIDGETS-EMBED.md) para snippets iframe en sitios públicos.

### API de enlaces (referencia rápida)

| Método | Ruta | Uso |
|--------|------|-----|
| `POST` | `/api/links/shorten` | Acortar URL |
| `POST` | `/api/links/whatsapp` | Enlace WhatsApp |
| `POST` | `/api/links/upload` | Subir archivo a S3 |
| `POST` | `/api/links/bulk/shorten` | Carga masiva URLs (JSON) |
| `POST` | `/api/links/bulk/whatsapp` | Carga masiva WhatsApp |
| `POST` | `/api/links/bulk/upload` | Carga masiva archivos (multipart) |
| `GET` | `/api/links/:id/qr?format=png\|svg\|eps` | Descargar QR con estilo del enlace |
| `PATCH` | `/api/links/:id/qr-style` | Guardar diseño QR (JSON o multipart con logo) |
| `GET` | `/api/links/me/qr-default-style` | Leer estilo predeterminado del usuario |
| `PUT` | `/api/links/me/qr-default-style` | Guardar estilo predeterminado |
| `GET` | `/api/links/:id/stats?days=30` | Estadísticas de clicks |
| `GET` | `/r/:slug` | Redirect público (registra click) |

Presets de logo MALI: definidos en `packages/shared/src/qr-logo-presets.ts`.

Los operadores solo ven en el menú los módulos que el super admin les habilita. La API también valida el acceso por módulo.

### Flujo típico

1. Un compañero entra con Google → aparece en **Accesos MALI ONE** tras su primer login
2. Tú (super admin) marcas los módulos que necesita y guardas
3. El usuario recarga la página y ya ve esos módulos en el menú

### Migración de base de datos

Tras desplegar, aplica las migraciones:

```bash
pnpm --filter @mali-one/api prisma:migrate
pnpm --filter @mali-one/api prisma:seed:widgets
```

Migraciones recientes relevantes:

- `20250705160000_qr_style_and_link_clicks` — campos `qrStyle` / `qrLogoKey` en enlaces, `qrDefaultStyle` en usuarios, tabla `LinkClick` para estadísticas.

En Docker, al arrancar el contenedor `api` solo se aplican migraciones. El seed **no** corre por defecto (para no sobrescribir datos editados en el admin). Para un entorno vacío, define `WIDGET_SEED_ON_START=true` en `.env` o ejecuta el seed manualmente dentro del contenedor.

### QR en Docker (API)

La generación de QR usa `@loskir/styled-qr-code-node` (skia-canvas con binarios precompilados). La imagen API usa **`node:20-bookworm-slim`**. Reconstruir sin caché tras cambios de dependencias nativas:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml build --no-cache api
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d api web
```
