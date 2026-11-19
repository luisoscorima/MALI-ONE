# Congelación go-live mali-whatsapp (ventana 6h)

Fecha: 2026-11-18. Rollback y operación para mañana.

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
git checkout <commit_anterior_estable>
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build api web
```

Commits de esta ventana (referencia):

- `53c1591` bandeja/ficha hub comercial
- `13c835a` channel-event shadow ingest

**WA:** revert del commit de hooks (`link-cycle` retry + channel-event shadow) si falla inbound/gestión.

## Authority

`GET /api/crm-educacion/commercial-authority` debe seguir:

- `authority: "wa"`
- `wa_ux: "stable"`
- `wa_channels_pending` incluye meta/tiktok/wa_inbound
