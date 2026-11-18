# Cutover autoridad comercial → ONE (F4)

## Principio

**No tumbar mensajería mali-whatsapp.** El cutover pausa escrituras *comerciales* en BD WA; inbox y webhooks de mensajes siguen.

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
