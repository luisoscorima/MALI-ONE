# Changelog — MALICHIMP

## [Unreleased]

### Added

- Audiencia de campaña con tres modos exclusivos: **Grupos**, **Etiquetas**, **Lista de correos** (`EmailCampaign.audienceMode`).
- `POST /api/malichimp/campaigns/resolve-emails` (listos / no en MALICHIMP / a revisar / no pueden recibir; solo no encontrados → Importar).
- `eligibleContacts` en `GET /api/malichimp/tags` sin cambiar el significado de `contacts`.
- Wizard: Contrato UX (Grupos por defecto solo en campañas nuevas; resumen humano; Enviarás a X de Y contactos disponibles).

### Changed

- Migración: boletines operativos (Asamblea, invitaciones, boletines mensuales/auditorio/EP/CA, etc.) pasan a biblioteca MALICHIMP.
- Campañas solo usan biblioteca MALICHIMP (ya no `shared` published).
- Remitentes con `scope=malichimp`: pestaña Remitentes + `assertEnabled` acotado; CRUD también en hub.

### Added

- Pestaña **Contenido** = biblioteca acotada MALICHIMP (`malichimp`/`library`) con Nuevo contenido, duplicar y eliminar; sin permiso de Boletines.
- Working copies exclusivas por campaña (`workingNewsletterId`) al crear/duplicar/enviar; editor compartido (`?tab=content&edit=`).
- Deep links: `?tab=campaigns&new=1`, `?tab=campaigns&campaign={id}`, `?tab=content&new=1`.
- Vista congelada del correo enviado: `GET /mail/view/:token` (snapshot + personalización; sin contar apertura).
- Eliminar campañas en **borrador** (`DELETE /api/malichimp/campaigns/:id`); elimina el fork de trabajo asociado.
- Personalización por destinatario en el dispatcher SES: `{{first_name}}`, `*|FNAME|*` y `<<First Name>>` se sustituyen con el primer nombre del contacto; sin nombre usa `estimado(a)`.
- Importación administrativa por XLSX con plantilla, preview, consentimiento, grupos del lote y apply transaccional.
- Persistencia en disco de previews ZIP/XLSX (TTL 30 min) recuperable tras reinicio en el mismo host.
- Auditoría XLSX vía `MalichimpImportJob` + `MalichimpImportRun` (huella, admin, consentimiento y conteos).
- Catálogo compartido `EmailSender` (`@mali.pe`) con CRUD en `/api/email-delivery/senders` (UI ahora en Boletines).
- Campañas con exclusión de opciones de grupo, asunto/remitente/nombre editables y rechazo de programación vencida.
- Duplicación de campañas como borrador, con fork desde snapshots, criterios de audiencia (grupos + contactos manuales) y métricas limpias.
- Vista previa del HTML congelado y apertura autenticada en navegador desde la tabla de campañas.
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

### Fixed

- Editor de Contenido MALICHIMP usa `/api/malichimp/content` (usuarios sin módulo Boletines pueden editar el fork).
- Hidratar borrador/duplicado restaura inclusiones y exclusiones manuales de contactos.
- `contentRevision` se valida y aplica en la misma transacción que el snapshot (prueba y envío).
- `composeHtml`/`inject` siempre reemplazan chrome histórico de “ver en navegador” (p. ej. `/n/:slug`) por `/mail/view/{token}`.
- Sync de respuestas Gmail: revisa buzones con envíos recientes (prueba o real), aunque la campaña siga en borrador.

### Changed

- “Ver este correo en el navegador” apunta a `/mail/view/{openToken}` (HTML congelado de la campaña), no a `/n/:slug`.
- Estados de Contenido: `queued`/`sending` → En curso; `failed` → Error; `completed` → Enviado.
- Copy UI en español (Clicaron/Reply/Prod/Directory, texto de prueba, estados de envío con badge) y KPIs de stats con `aria-pressed`.
- Estadísticas de campaña: checkbox **Incluir pruebas** (off por defecto) en lugar de Producción/Pruebas/Todo; `totalRecipients` sigue el alcance (evita `enviados / 0` en pruebas).
- Export Excel de campañas ya no hereda el tope de 200 de la lista UI (`listCampaigns({ limit: null })`).
- Las pestañas Audiencia / Campañas quedan en la URL (`?tab=campaigns`), igual que Boletines y Usuarios Workspace.
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
