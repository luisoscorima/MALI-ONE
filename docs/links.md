# Enlaces y QR (links)

> Changelog: [links-CHANGELOG.md](./links-CHANGELOG.md) · Índice: [README.md](./README.md)

## Qué es

Acortador de URLs, enlaces WhatsApp, subida de archivos a S3, QR personalizable (export PNG/SVG/EPS), carga masiva Excel y estadísticas de clicks/escaneos.

## Cómo funciona

1. Operador crea enlace (URL, WhatsApp o archivo). Se genera slug y opcionalmente QR con estilo (copia del default del usuario).
2. Público: `GET /r/:slug` redirige y registra `LinkClick` (dispositivo, navegador, SO).
3. WhatsApp: slug con ref; catálogo interno expuesto a mali-whatsapp vía token de servicio.
4. Archivos: upload a S3; redirect usa URL pública o presignada según `S3_PUBLIC_READ`.

## Código

- API: `apps/api/src/modules/links/` — `links.controller.ts`, `links-internal.controller.ts`, `redirect.controller.ts`, `links.service.ts`
- QR core: `apps/api/src/core/qr`
- Web: `apps/web/src/pages/links-page.tsx`
- Presets logo: `packages/shared/src/qr-logo-presets.ts`

## UI

| Ruta | Uso |
|------|-----|
| `/links` | Historial, creación, QR, bulk, stats |

## API

| Método | Ruta | Uso |
|--------|------|-----|
| POST | `/api/links/shorten` | Acortar URL |
| POST | `/api/links/whatsapp` | Enlace WhatsApp |
| POST | `/api/links/upload` | Archivo → S3 |
| POST | `/api/links/bulk/*` | Masivo URL / WhatsApp / upload |
| GET/PUT | `/api/links/me/qr-default-style` | Estilo default usuario |
| GET/PATCH | `/api/links/:id/qr*`, `qr-style`, `stats` | QR y métricas |
| GET | `/r/:slug` | Redirect público |
| GET | `/api/links/internal/whatsapp-catalog` | Catálogo para mali-whatsapp (`x-links-service-token`) |

## Datos (Prisma)

- `ShortLink` (`qrStyle`, `qrLogoKey`, tags, tipo URL/WA/file, archived)
- `LinkClick`
- Usuario: `qrDefaultStyle`

## Conexiones externas

| Sistema | Uso |
|---------|-----|
| **AWS S3** | Archivos de enlaces tipo file; logos QR |
| **Redis** | Caché de redirects / soporte operativo del acortador |
| **mali-whatsapp** | Catálogo WhatsApp / match `ref` → origen `mali_one_link` (`LINKS_CATALOG_SERVICE_TOKEN`) |
| **@loskir/styled-qr-code-node** (API) / **qr-code-styling** (web) | Generación QR (PNG/SVG/EPS; EPS vía Inkscape si está disponible) |

## Variables de entorno

```env
AWS_S3_BUCKET=mali-one-files
S3_PUBLIC_READ=false
LINKS_CATALOG_SERVICE_TOKEN=
UPLOAD_MAX_MB=25
```

## Permisos

- Módulo: `links`

## Relacionados

- [s3-manager.md](./s3-manager.md)
- [crm-educacion.md](./crm-educacion.md) / WhatsApp (orígenes)
