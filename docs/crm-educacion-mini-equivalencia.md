# Mini-ensayo equivalencia WA ↔ ONE (ventana 6h)

Fecha: 2026-11-18. Muestra pequeña; **no activa F4**.

## Método

Comparar 5–10 ciclos (CA/EP si hay dato):

1. Etapa en mali-whatsapp (ciclo abierto).
2. Misma persona/teléfono en Bandeja ONE (fila `wa-cycle-*` o oportunidad con `wa_cycle_id`).
3. Si Prospectia: `prospectia_status` ≠ `stage_slug`.
4. Anura: llamada en timeline o lateral; unmatched no abre ciclo.
5. Pago: flag `payment_link` si hay `EducacionSale`.

## Resultados (rellenar en smoke)

| # | wa_cycle_id | etapa_WA | fila_ONE | linked | gaps |
|---|-------------|----------|----------|--------|------|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |
| 4 | | | | | |
| 5 | | | | | |

## Clasificación de gaps

**Bloquea F4**

- Etapa distinta en filas “enlazadas” sin regla de autoridad clara.
- Ciclos Meta/TikTok sin camino a ONE writer + facade WA.
- link-cycle falla de forma sistemática (token/URL).

**Cosmetic / no bloquea**

- Unmatched Anura visible.
- Prospectia solo-contacto sin ciclo WA.
- SLA solo vía proxy WA en bandeja.

## Conclusión de la ventana

- Escritor comercial global: **sigue WA** (`COMMERCIAL_AUTHORITY=wa`).
- Shadow outbox: management → `EducacionChannelEvent` (sin dual-write etapa).
- F4: **aplazado** hasta ensayo mayor + Meta/TikTok.
