# Changelog — MALICHIMP

## [Unreleased]

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
