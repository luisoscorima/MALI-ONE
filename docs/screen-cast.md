# Transmisión a pantallas (screen-cast)

> Changelog: [screen-cast-CHANGELOG.md](./screen-cast-CHANGELOG.md) · Índice: [README.md](./README.md)

## Qué es

Gestiona **playlists**, **monitores** (tótems/quioscos/TVs) y **overrides de agenda** para la pared de pantallas del MALI. Las pantallas públicas cargan `/screen-cast?id={screenKey}` y se sincronizan por **WebSocket** (socket.io) con un reloj compartido.

## Cómo funciona

1. Un operador con módulo `screen_cast` crea playlists (ítems imagen/video con duración) y monitores con `screenKey` único.
2. Cada monitor apunta a una playlist base; opcionalmente hay `ScreenCastScheduleOverride` por rango de fechas.
3. El scheduler recalcula qué playlist aplica y emite sync a las pantallas conectadas.
4. El player público pide `GET /api/screen-cast/screens/:screenKey/config`, cachea medios (Service Worker) y se une al gateway (`join`, `heartbeat`, `status`, `ready`, `local`).
5. Soft-sync vía `play:tick`: corrige desfase entre hermanas **sin** interrumpir un video mid-play (catch-up solo con umbral sostenido + cooldown).
6. Medios: subida a S3 (`POST .../s3/upload`, ffmpeg para MOV→H.264) o picker S3 acotado al prefijo `screen-cast`.

## Código

- API: `apps/api/src/modules/screen-cast/` — `screen-cast.controller.ts`, `screen-cast.service.ts`, `screen-cast.gateway.ts`, `screen-cast-schedule.scheduler.ts`, `screen-cast-video.util.ts`
- Web admin: `apps/web/src/pages/screen-cast-admin-page.tsx` + componentes `screen-cast-*`
- Web player: `apps/web/src/pages/screen-cast-player-page.tsx`
- Shared DTOs: `packages/shared` (`ScreenCast*`)
- Core: `apps/api/src/core/s3` (storage); importa `S3ManagerModule` para listado

## UI

| Ruta | Uso |
|------|-----|
| `/admin/screen-cast` | Admin: playlists, ítems, monitores, agenda, sync, preview |
| `/screen-cast?id={screenKey}` | Player kiosco (público) |

## API

Prefijo REST: `/api/screen-cast`

| Área | Endpoints |
|------|-----------|
| Público | `GET screens/:screenKey/config`, `GET media` |
| Playlists | CRUD + `duplicate` + ítems (`reorder`, `duplicate`) |
| Monitores | CRUD + `POST monitors/sync`, `POST monitors/:id/sync` |
| Agenda | CRUD `schedule-overrides` |
| S3 | `upload`, `config`, `buckets`, `objects`, `public-url` |

WebSocket (socket.io, path `/socket.io/`, namespace `/screen-cast`):
- Cliente → servidor: `join`, `heartbeat`, `status`, `ready`, `local`
- Servidor → cliente: `playlist:sync`, `playlist:updated`, `play:go`, `play:tick`

**Infra NPM:** requiere Websockets Support + timeouts largos en `/socket.io/` (ver [plataforma.md](./plataforma.md)). Una sola instancia de API (sin adapter Redis).

## Datos (Prisma)

- `ScreenCastPlaylist`, `ScreenCastPlaylistItem`
- `ScreenCastMonitor` (`screenKey`, orientación LANDSCAPE/PORTRAIT, `playlistId`, `lastSeenAt`)
- `ScreenCastScheduleOverride` (monitor + playlist + ventana temporal)

## Conexiones externas

| Sistema | Uso |
|---------|-----|
| **AWS S3** | Media de playlists (`AWS_S3_BUCKET` / `AWS_S3_SCREEN_CAST_*`); lectura pública opcional `S3_PUBLIC_READ` |
| **ffmpeg** | Transcodificación MOV→H.264 en upload |
| **socket.io** | Sync en tiempo real pantallas ↔ API |
| **Nginx Proxy Manager** | Upgrade WebSocket hacia `mali-one-web` → API |

## Variables de entorno

```env
AWS_S3_BUCKET=mali-one-files
S3_PUBLIC_READ=false
AWS_S3_SCREEN_CAST_PREFIX=screen-cast
# AWS_S3_SCREEN_CAST_BUCKET=   # opcional, default = AWS_S3_BUCKET
# SCREEN_CAST_UPLOAD_MAX_MB=50
# FFMPEG_PATH=/usr/bin/ffmpeg
UPLOAD_MAX_MB=25
```

## Permisos

- Módulo de acceso: `screen_cast`
- Rutas admin autenticadas; config pública del player sin JWT (conocida por `screenKey`)

## Relacionados

- [s3-manager.md](./s3-manager.md) — buckets / IAM
- [plataforma.md](./plataforma.md) — WebSocket en NPM

## Notas operativas

- **Upload de video:** MP4 y MOV se normalizan a **H.264 MP4** (CRF 23, lado largo ≤ 1920, AAC si hay audio). Si el origen ya es H.264 y el reencode pesaría más, se conserva el original. Así preview (Chrome) y TVs Tizen coinciden. Ítems HEVC ya publicados hay que **volver a subir** para que entren al pipeline.
- **Regla dura de sync:** nunca pelear mid-video (ni seek agresivo en Tizen). Catch-up limpio y raro > sync continuo.
