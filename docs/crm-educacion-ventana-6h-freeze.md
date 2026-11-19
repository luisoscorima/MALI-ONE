# Congelación go-live mali-whatsapp (ventana 6h)

Fecha: 2026-11-18. Rollback y operación para mañana.

## Despliegue de consolidación verificado

- ONE API: `f6f81e4`; WA API: `87628b9`.
- Despliegue por `git pull --ff-only` y `docker compose ... up -d --no-deps --build api`.
- Frontends sin cambios respecto de lo ya desplegado; bases y volúmenes no recreados.
- Health ONE 200/healthy; health WA 200 y DB up.
- Migración aditiva WA `20261120010000_cycle_shadow_outbox_trigger` aplicada;
  cero migraciones incompletas activas en ambas bases.
- Usuarios 30, asociaciones de áreas 23, contactos 24.703 y ciclos 19.036,
  idénticos antes/después del despliegue WA.
- `APPLY_OPERATIONAL_ROLE_SEED` no habilitado: el arranque preserva permisos.
- Consulta interna WA→ONE 200: authority=wa, wa_ux=stable;
  Meta/TikTok/wa_inbound siguen pendientes del corte F4.
- Miniensayo de lectura: 10/10 etapas y fichas correctas; ver documento de equivalencia.
- Evento técnico `wa-one-smoke-87628b9` entregado automáticamente en un intento,
  sin error, recibido en ONE con `processedAt=null`. Replay mantiene una sola fila
  y el contenido original. No modifica datos comerciales y queda como evidencia.
- Pruebas locales: 8 ONE y 3 WA pasan; TypeScript de ambas APIs pasa.

Pendiente de validación funcional con datos controlados: creación manual/widget,
ingestión nueva Anura/Prospectia y aplicación/boleteo de un pago. El smoke de lectura
no sustituye ese recorrido ni habilita F4. No se fabricaron clientes/pagos en producción.

## Operación mañana

| Rol | Dónde |
|-----|-------|
| Asesor | Solo mali-whatsapp (etapa, ficha, chat, asociar código). UX sin cambios. |
| Jefe / supervisor | CRM Educación ONE: **Bandeja** + laterales Llamadas / Pagos·Caja / Contactos WA / Herramientas |
| Caja | Lateral Pagos / Caja (associate + apply/boleteo) |

## Prohibido mañana

- `COMMERCIAL_AUTHORITY=one`
- Dual-write de etapa
- `prisma migrate deploy` / SQL manual en prod
- `cp` / `scp` / edición directa en host
- Mover Meta/TikTok a escritor ONE

## Rollback

**ONE:** en servidor `~/MALI-ONE`:

```bash
git log -5 --oneline
git checkout cb195346c5fc8fe98d55bdce2a3d8f0e19c7dedb
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build api web
```

Commits de esta ventana (referencia):

- `53c1591` bandeja/ficha hub comercial
- `13c835a` channel-event shadow ingest

**WA:** revert del commit de hooks (`link-cycle` retry + channel-event shadow) si falla inbound/gestión.

Referencia previa comprobada en el servidor WA: `0ce71248d67e7ce733b5700a1f41497cb8be189e`.
No revertir ni borrar migraciones aplicadas. El nuevo trigger shadow es aditivo y
compatible con código anterior: conserva hechos en la outbox hasta recuperar el emisor.
No usar `compose down -v`, reset, eliminación de tablas ni limpieza de volúmenes.

## Authority

`GET /api/crm-educacion/commercial-authority` debe seguir:

- `authority: "wa"`
- `wa_ux: "stable"`
- `wa_channels_pending` incluye meta/tiktok/wa_inbound
