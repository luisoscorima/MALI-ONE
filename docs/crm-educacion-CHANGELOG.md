# Changelog — crm-educacion

Formato: entradas en orden inverso (lo más reciente arriba). Cada mejora del módulo debe registrarse aquí.

## [Unreleased]

- F0: docs destino/roles; inventario consumidores; sync widget `area=educacion`+categoría; retry WA; higiene attrs.
- F1: `stale` / `solo_contacto`; Historial; UI Promesa fecha / Perdido motivo.
- F2: actividades UI + API; spike Anura; asesor ≠ chat documentado.
- F3: venta/aplicaciones; lookup+associate (ONE + proxy WA `/api/leads/payments/*`); apply/reverse Caja; internal service token.
- F4 scaffolding: `commercial-authority`, `EducacionChannelEvent`, doc cutover (mensajería intacta).
- F5: boleteo OBS→boleteado + matrícula ref en UI Pagos.
- Apagar Sheets: `EDUCACION_LEADS_SHEETS_ENABLED=false` cuando baste.
- RQs pendientes: ver «Requerimientos Educación» en crm-educacion.md

## [2026-11-05] — baseline documental

Reorganización de la documentación por módulo. Contenido consolidado desde el código y la documentación previa del módulo.

- CRM sobre ciclos WA; widget leads → EducacionLead → WhatsApp (+ Sheets opcional).
- Estados de inscripción documentados; catálogo administrable en ONE.
