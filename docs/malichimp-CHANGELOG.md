# Changelog — MALICHIMP

## [Unreleased]

### Added

- Personalización por destinatario en el dispatcher SES: `{{first_name}}`, `*|FNAME|*` y `<<First Name>>` se sustituyen con el primer nombre del contacto; sin nombre usa `estimado(a)`.
- Importación administrativa por XLSX con plantilla, preview, consentimiento, grupos del lote y apply transaccional.
- Persistencia en disco de previews ZIP/XLSX (TTL 30 min) recuperable tras reinicio en el mismo host.
- Auditoría XLSX vía `MalichimpImportJob` + `MalichimpImportRun` (huella, admin, consentimiento y conteos).
- Catálogo compartido `EmailSender` (`@mali.pe`) con CRUD en `/api/email-delivery/senders` (UI ahora en Boletines).
- Campañas con exclusión de opciones de grupo, asunto/remitente/nombre editables y rechazo de programación vencida.
- Duplicación de campañas como borrador, con copia editable del boletín, configuración heredada y audiencia recalculada.
- Vista previa del HTML congelado y apertura autenticada en navegador desde la tabla de campañas.
- En Nueva campaña: **Usar existente** o **Crear nuevo** (borrador en Boletines, sin editor embebido).
- Filtro opcional `tagId` en el listado de contactos.
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

- La pestaña **Remitentes** sale de MALICHIMP y vive en Boletines; el catálogo `EmailSender` sigue siendo compartido.
- Nueva campaña usa un panel numerado compacto (estilo CRM PAM): incluir/excluir con desplegables, preview tabular, boletín publicado, radios Ahora/Programar y confirmación antes de enviar.
- El diálogo de importación ofrece XLSX (lotes nuevos) y ZIP (sincronización Mailchimp).
- Las campañas exigen un remitente del catálogo; `fromEmail` y `replyTo` deben ser `@mali.pe`.
- `SES_FROM_EMAIL` queda solo como fallback del transporte.
- La importación XLSX no reactiva `nonsubscribed` (ni `unsubscribed`/`cleaned`).
- Un solo job de importación activo bloquea ZIP y XLSX concurrentes.
- No se puede eliminar el último remitente del catálogo.
- Las campañas MALICHIMP exigen opciones de grupo y dejan de segmentar por etiquetas.
- La migración recupera desde `attributes` las pertenencias de grupos ya importadas.
- Tracking de aperturas/clics sale de Boletines y pasa al motor compartido.
- Eventos SES ya no escriben tablas MALICHIMP; proyectan entregas y supresiones globales.
- CRM PAM deja de exponer campañas o depender de SES.
- Documentación y `.env.example` separan SES compartido del SMTP PAM (`PAM_SMTP_*`).
- El importador vive en `src/modules/malichimp/lib` para no romper `dist/main.js` en el build Nest.

### Fixed

- La importación no reemplaza supresiones de SES y se revierte completa si falla un lote.
- El contador de elegibles excluye las direcciones suprimidas.
- Los trabajos de importación persisten en PostgreSQL y la UI muestra el estado fallido sin mantener el indicador de carga.
- El conteo de bloqueados del preview XLSX refleja filas del archivo, no el tamaño del set de emails bloqueados en base.

### Risks / known limits

- Previews en `/tmp` del host: réplicas distintas del API no comparten el `previewId`.
- El catálogo de remitentes no valida identidades SES; un remitente inválido falla al despachar.
