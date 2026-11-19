# Cutover autoridad comercial → ONE (F4)

## Principio

**No tumbar mensajería mali-whatsapp.** El cutover pausa escrituras *comerciales* en BD WA; inbox y webhooks de mensajes siguen.

**UX WA estable:** el asesor casi no debe notar el relocate del modelo (mismas pantallas de etapa/ficha/chat). Preferir facade/API compatible sobre rediseño del inbox. Migración **progresiva por canal** (Prospectia → manual/widget → Meta/TikTok) antes del flag global.

## Gate

1. F1–F3 en uso (o piloto cerrado).
2. Ensayo de equivalencia con volumen representativo.
3. `COMMERCIAL_AUTHORITY` sigue en `wa` hasta el corte.

## Pasos

1. **Aislar:** frontera de acceso CRM en WA; pruebas de comportamiento (captación repetida, retorno, identidad, asignación concurrente, venta, 1.ª respuesta).
2. **Ensayar:** import personas/oportunidades a ONE con mapeos de IDs; sin efectos externos.
3. **Cutover:** pausar management/distribute/origins comerciales en WA; encolar hechos en `EducacionChannelEvent`; reconciliar; activar `COMMERCIAL_AUTHORITY=one`; inbox WA escribe comercial a ONE.
4. **Criterio de cierre:** ONE lista/asigna/cambia etapa sin BD comercial antigua; un escritor por oportunidad.
5. **Rollback:** abortable antes de escrituras ONE nuevas; después requiere reconciliación.

## Estado actual (scaffolding)

- `GET /api/crm-educacion/commercial-authority` → `{ authority: "wa" }` (env `COMMERCIAL_AUTHORITY`).
- Tabla `EducacionChannelEvent` lista para outbox WA→ONE (aún sin productor en WA).
- UI asesor sigue siendo mali-whatsapp.

## Piloto Prospectia (no es cutover global)

Canal Prospectia escribe `EducacionOpportunity` en ONE sin poner `COMMERCIAL_AUTHORITY=one`.

- WA no crea orígenes Prospectia ni hace match/check (evita dual-write y rastro en WA).
- Inbound WA → `POST .../internal/opportunities/link-cycle` si ya existe oportunidad ONE.
- Criterio para generalizar F4: equivalencia en ensayo, luego otros canales.

## Orden por canal (antes de F4 global)

1. Prospectia — `commercialAuthority=one` (hecho).
2. Manual / widget — alta nativa ONE + link-cycle aditivo si aparece chat WA.
3. Anura — solo toques de voz (no abre ciclo solo).
4. **Meta / TikTok / resto WA inbound al final** — siguen `wa` hasta ensayo de equivalencia.
   - Lista pendiente: env `COMMERCIAL_AUTHORITY_WA_SOURCES` (default `meta,tiktok,wa_inbound`).
5. `COMMERCIAL_AUTHORITY=one` global **solo** cuando canales relevantes ya escriban en ONE y el asesor en mali-whatsapp siga sintiendo la misma UX (facade).

## Deploy Anura / CRM (git + compose)

No `cp`/`scp` ni migrate manual en prod. Flujo:

1. Commit + push de código (UI Anura, webhook, bandeja, migración Prisma).
2. En servidor: `git pull`.
3. `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build`.
4. Entrypoint API ejecuta `prisma migrate deploy` (incluye hub comercial / Anura).
