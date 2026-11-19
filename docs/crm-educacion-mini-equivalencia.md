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

## Resultados posteriores al despliegue ONE `f6f81e4`

| # | wa_cycle_id | etapa_WA | fila_ONE | linked | gaps |
|---|-------------|----------|----------|--------|------|
| 1 | 19036 | contactado | wa-cycle-19036: contactado | proyección WA | sin vínculo nativo |
| 2 | 19032 | contactado | wa-cycle-19032: contactado | proyección WA | sin vínculo nativo |
| 3 | 19014 | contactado | wa-cycle-19014: contactado | proyección WA | sin vínculo nativo |
| 4 | 19012 | contactado | wa-cycle-19012: contactado | proyección WA | sin vínculo nativo |
| 5 | 19009 | contactado | wa-cycle-19009: contactado | proyección WA | sin vínculo nativo |
| 6 | 17943 | contactado | wa-cycle-17943: contactado | proyección WA | sin vínculo nativo |
| 7 | 17863 | evaluando | wa-cycle-17863: evaluando | proyección WA | sin vínculo nativo |
| 8 | 17853 | evaluando | wa-cycle-17853: evaluando | proyección WA | sin vínculo nativo |
| 9 | 18687 | contactado | wa-cycle-18687: contactado | proyección WA | sin vínculo nativo |
| 10 | 18685 | contactado | wa-cycle-18685: contactado | proyección WA | sin vínculo nativo |

Filas 1–5 CA; 6–10 EP. Diez etapas coinciden y diez fichas responden.
La muestra se selecciona de datos vivos, priorizando estados distintos de
`por_contactar`; los IDs pueden variar entre ejecuciones. No se alteraron etapas.
API ONE healthy; endpoint interno de autoridad responde 200 y mantiene `wa`,
`wa_ux=stable`, fuentes pendientes meta/tiktok/wa_inbound. Sin migraciones fallidas
pendientes; seeds automáticos de widgets desactivados.

Al comprobar: 8.250 oportunidades ONE, 0 enlaces nativos, 1 venta y 604 actividades
Anura. Estos conteos son una observación puntual, no metas de aceptación.
No acredita un flujo nuevo de cobro/matrícula ni ingestión de formularios reales:
se evitó introducir clientes/pagos ficticios en producción. Esas pruebas funcionales
con datos controlados permanecen separadas del smoke de lectura.

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
