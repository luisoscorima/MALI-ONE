# Changelog — MALICHIMP

## [Unreleased]

### Fixed

- La importación no reemplaza supresiones de SES y se revierte completa si falla un lote.
- El contador de elegibles excluye las direcciones suprimidas.
- Los trabajos de importación persisten en PostgreSQL y la UI muestra el estado fallido sin mantener el indicador de carga.

### Added

- Grupos de Mailchimp normalizados como categorías, opciones y pertenencias por contacto.
- Selector de múltiples opciones de grupo con conteos y preview de destinatarios.
- Campañas MALICHIMP con preview de audiencia, programación, snapshots inmutables, baja propia e historial de entrega.
- Dispatcher de campañas reutilizable con lotes persistidos, claims, límite de velocidad y reintentos.
- Supresión global de proveedor separada de las bajas de cada audiencia.
- Base independiente de contactos, etiquetas, supresiones y auditoría de importaciones.
- Importador idempotente con simulación por defecto.
- API paginada y tablero operativo.
- Importación administrativa por ZIP con preview, confirmación, progreso y limpieza temporal.
- Motor SES transversal en `core/email-delivery`.

### Changed

- Las campañas MALICHIMP exigen opciones de grupo y dejan de segmentar por etiquetas.
- La migración recupera desde `attributes` las pertenencias de grupos ya importadas.
- Tracking de aperturas/clics sale de Boletines y pasa al motor compartido.
- Eventos SES ya no escriben tablas MALICHIMP; proyectan entregas y supresiones globales.
- CRM PAM deja de exponer campañas o depender de SES.
- Documentación y `.env.example` separan SES compartido del SMTP PAM (`PAM_SMTP_*`).
- El importador vive en `src/modules/malichimp/lib` para no romper `dist/main.js` en el build Nest.
