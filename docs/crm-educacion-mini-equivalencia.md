# Mini-ensayo equivalencia WA ↔ ONE (ventana 6h)

Fecha: 2026-11-18. Muestra pequeña; **no activa F4**.

## Método

Comparar 5–10 ciclos (CA/EP si hay dato):

1. Etapa en mali-whatsapp (ciclo abierto).
2. Misma persona/teléfono en Bandeja ONE (fila `wa-cycle-*` o oportunidad con `wa_cycle_id`).
3. Si Prospectia: `prospectia_status` ≠ `stage_slug`.
4. Anura: llamada en timeline o lateral; unmatched no abre ciclo.
5. Pago: flag `payment_link` si hay `EducacionSale`.

## Ensayo previo al despliegue de correcciones

Ejecutado con servicios desplegados, solo lectura, sin nombres/teléfonos ni escrituras.
ONE servidor: `cb19534`; WA servidor: `0ce7124`. Autoridad efectiva: `wa`.
Script repetible: `scripts/crm-education-readonly-smoke.cjs` (stdin dentro de la API).

Diez ciclos con etapas distintas del valor por defecto fallaron equivalencia:
CA: 19057, 19049, 19041, 19039, 19037 (`contactado`).
EP: 18300, 18296 (`contactado`); 18291, 18287, 18134 (`evaluando`).
ONE mostraba `por_contactar` en los diez; las diez fichas respondían.
Corrección: leer `cycle.lead_status.slug` en la bandeja.

El ensayo previo encontró 0 oportunidades nativas enlazadas y 0 eventos shadow.
Por ello esta muestra verifica la proyección WA, no demuestra equivalencia de
oportunidades nativas enlazadas. Repetir después del despliegue y documentar el resultado.

## Resultados posteriores (pendientes de despliegue)

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
