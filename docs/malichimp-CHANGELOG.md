# Changelog — MALICHIMP

## [Unreleased]

### Fixed

- La importación no reemplaza supresiones de SES y se revierte completa si falla un lote.
- El contador de elegibles excluye las direcciones suprimidas.
- Los trabajos de importación persisten en PostgreSQL y la UI muestra el estado fallido sin mantener el indicador de carga.

### Added

- Base independiente de contactos, etiquetas, supresiones y auditoría de importaciones.
- Importador idempotente con simulación por defecto.
- API paginada y tablero operativo.
- Importación administrativa por ZIP con preview, confirmación, progreso y limpieza temporal.
- Motor SES transversal en `core/email-delivery`.

### Changed

- CRM PAM deja de exponer campañas o depender de SES.
- Documentación y `.env.example` separan SES compartido del SMTP PAM (`PAM_SMTP_*`).
- El importador vive en `src/modules/malichimp/lib` para no romper `dist/main.js` en el build Nest.
