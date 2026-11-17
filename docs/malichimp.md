# MALICHIMP

> Changelog: [malichimp-CHANGELOG.md](./malichimp-CHANGELOG.md) · Índice: [README.md](./README.md)

## Qué es

Base de audiencia de correo independiente de los CRM de WhatsApp. Conserva contactos, estados, grupos, etiquetas históricas y campos importados desde Mailchimp o desde lotes XLSX manuales. Las opciones de grupo son la segmentación operativa para enviar boletines.

## Responsabilidades

- **MALICHIMP:** audiencia, consentimiento, segmentación y campañas.
- **Boletines:** creación y publicación del HTML; no conoce destinatarios.
- **Motor de correo:** cola, tracking y transporte reutilizable por AWS SES en `apps/api/src/core/email-delivery/`.
- **CRM PAM / CRM WhatsApp:** no dependen de SES ni aportan audiencia a MALICHIMP.
- **SMTP PAM (`PAM_SMTP_*`):** canal aparte para welcome `pam@mali.pe`; no forma parte de este módulo ni del motor SES.

## Datos

- `MalichimpContact`: perfil y estado de Mailchimp / importaciones manuales.
- `MalichimpGroup`, `MalichimpGroupOption` y `MalichimpContactGroupOption`: categorías, opciones y pertenencias usadas para segmentar boletines.
- `MalichimpTag` y `MalichimpContactTag`: metadato histórico recuperado; no decide los destinatarios de campañas nuevas.
- `MalichimpSuppression`: bajas y limpiados exclusivos de esta audiencia.
- `EmailGlobalSuppression`: rebotes, quejas y bloqueos del proveedor aplicables a cualquier módulo.
- `MalichimpImportRun` / `MalichimpImportJob`: huella, consentimiento (XLSX) y progreso de ZIP y XLSX.
- `EmailCampaign` y `EmailSend`: snapshot de contenido, destinatarios y ciclo de entrega compartido.
- `EmailSender`: catálogo compartido de direcciones `@mali.pe` disponibles para campañas nuevas.

Solo `subscribed` es elegible para campañas. También se excluyen las supresiones MALICHIMP y las globales. `unsubscribed`, `cleaned` y `nonsubscribed` no se reactivan desde una importación XLSX. El ZIP de Mailchimp conserva el estado del export. Ningún CRM de WhatsApp aporta audiencia a este módulo.

## Campañas

1. En **Nueva campaña**, el administrador elige **Usar existente** (boletín publicado) o **Crear nuevo** (borrador en la biblioteca de Boletines). El editor sigue siendo el módulo Boletines.
2. Debe seleccionar una o más opciones de grupo para incluir. Opcionalmente puede seleccionar otras opciones para excluir; la exclusión siempre prevalece. Cada correo se deduplica.
3. La API muestra coincidencias, exclusiones, destinatarios finales y una muestra antes de confirmar. No existe un envío accidental a “todos”: al menos una inclusión es obligatoria.
4. El remitente se elige del catálogo compartido administrado en la pestaña **Remitentes**. El nombre visible y el asunto pueden ajustarse por campaña. `fromEmail` y `replyTo` deben ser `@mali.pe`.
5. El envío puede salir inmediatamente o quedar programado. Una fecha programada vencida se rechaza para evitar un envío inmediato accidental.
6. Al confirmar se congelan asunto, HTML, remitente, inclusiones, exclusiones y destinatarios. Editar después el boletín o los grupos no altera la campaña.
7. Desde la tabla se puede previsualizar el snapshot y abrirlo en el navegador. En borradores (duplicados o creados nuevos), la vista muestra la versión actual del boletín asociado hasta que se confirma el envío.
8. **Duplicar** crea una nueva campaña en borrador y una copia editable del boletín en la biblioteca. Copia remitente, asunto e inclusiones/exclusiones; limpia programación, destinatarios materializados y métricas. La audiencia se recalcula y los `EmailSend` solo nacen al confirmar el borrador.
9. `EmailCampaignDispatcherService` procesa lotes persistidos, respeta la tasa configurada y reintenta fallos temporales hasta tres veces.
10. SES publica entrega, rebote, complaint, apertura y clic. El procesador compartido proyecta esos eventos sobre `EmailSend`.
11. El footer enlaza a `/mail/unsubscribe/{token}`. El GET pide confirmación y el POST aplica la baja solo en MALICHIMP, evitando que los escáneres de enlaces cancelen suscripciones automáticamente.

El mismo dispatcher ya atiende Comunicación Interna y queda disponible para otros módulos. Los consumidores crean campañas con snapshots; nunca entregan al motor una consulta a sus tablas de contactos.

## Importación

### XLSX de contactos (UI, lotes nuevos)

Un administrador abre `/admin/malichimp` → **Importar contactos** → pestaña **XLSX de contactos**:

1. Descarga la plantilla en `/plantillas/plantilla-contactos-malichimp.xlsx` o sube un XLSX con una columna de correo (acepta alias como `Correo`, `Email`, `Email address`).
2. Límite: 10 MB y 10 000 contactos por lote.
3. Selecciona una o más opciones de grupo que se agregarán a cada contacto importable sin quitar membresías previas.
4. Confirma explícitamente que los contactos autorizaron recibir correo.
5. La API muestra preview (nuevos, existentes, bloqueados, muestra) sin escribir PostgreSQL.
6. Al confirmar, crea o completa perfiles en una sola transacción, añade membresías y registra `MalichimpImportJob` + `MalichimpImportRun` (incluye huella del archivo, admin y marca de consentimiento).

Comportamiento:

- Nuevos contactos nacen como `subscribed` con `optInAt` / `confirmedAt` en el momento de la importación.
- Existentes `subscribed` se completan con los campos no vacíos del archivo.
- `unsubscribed`, `cleaned`, `nonsubscribed` y cualquier correo en `MalichimpSuppression` o `EmailGlobalSuppression` se omiten; no se reactivan.
- Campos vacíos en el XLSX no borran datos ya guardados.
- El origen queda en `MalichimpContact.source` como `xlsx:nombre-archivo`.
- La vista previa se guarda en disco bajo `/tmp` (TTL 30 minutos) y también en memoria; sobrevive un reinicio del mismo host mientras no expire. Un apply ZIP/XLSX en curso bloquea otros applies concurrentes.

### ZIP de Mailchimp (UI, sincronización completa)

Un administrador abre el mismo diálogo y elige **ZIP de Mailchimp**:

1. Sube un único ZIP de hasta 100 MB.
2. El servidor exige exactamente los cuatro CSV `subscribed`, `unsubscribed`, `cleaned` y `nonsubscribed`, aunque estén dentro de una carpeta del ZIP.
3. La UI muestra el resumen sin modificar PostgreSQL.
4. El administrador confirma explícitamente y observa el progreso.
5. El ZIP y los CSV temporales se eliminan al finalizar; si no se confirma, expiran en 30 minutos.

La importación corre en segundo plano y es idempotente. Los cambios de cada ZIP se confirman en una sola transacción: si falla, no se aplican lotes parciales. El estado del trabajo se guarda en PostgreSQL y la UI lo recupera tras recargar la página. Un ZIP ya importado muestra una advertencia, pero puede reaplicarse sin duplicar contactos. La vista previa también se persiste en disco con el mismo TTL.

Las 13 columnas de grupos del export se normalizan como categorías y opciones. La migración también promueve automáticamente los valores que versiones anteriores conservaron en `MalichimpContact.attributes`, evitando una reimportación obligatoria. Las etiquetas siguen guardándose, pero las campañas nuevas no las consultan.

Las supresiones globales originadas por SES viven fuera de MALICHIMP y prevalecen sobre cualquier importación. El contador de elegibles excluye ambas listas.

El Nginx incluido acepta hasta 100 MB. Si Nginx Proxy Manager aplica un límite propio en EC2, su host proxy también debe configurar `client_max_body_size 100m;`.

### Desde consola

La simulación es el modo predeterminado:

```bash
pnpm --filter @mali-one/api prisma:import:malichimp -- --dir /ruta/al/export
```

Para escribir en PostgreSQL se debe agregar explícitamente `--apply`. El directorio debe contener exactamente los cuatro CSV `subscribed`, `unsubscribed`, `cleaned` y `nonsubscribed`.

## Remitentes

La pestaña **Remitentes** (solo admin) administra el catálogo `EmailSender`:

- Solo acepta direcciones `@mali.pe`.
- La migración inicial inserta `boletines@mali.pe` si no existe.
- No se puede eliminar el último remitente del catálogo.
- Crear o editar una dirección no verifica identidades en AWS SES: el dominio o la dirección deben estar autorizados en SES antes de usarla.
- Borrar un remitente no altera campañas ya creadas (el `fromEmail` quedó congelado en el snapshot), pero sí lo quita del selector de campañas nuevas.
- `replyTo` de cada campaña también debe ser `@mali.pe` (puede diferir del remitente elegido).

## API y UI

- UI: `/admin/malichimp`
- `GET /api/malichimp/stats`
- `GET /api/malichimp/contacts` — opcional `tagId`, `groupOptionId`, `q`
- `GET /api/malichimp/tags`
- `GET /api/malichimp/groups`
- `GET /api/malichimp/newsletters`
- `GET /api/malichimp/newsletters/{id}` — administrador, para refrescar borradores creados desde la campaña
- `POST /api/malichimp/newsletters/draft` — administrador, crea borrador en Boletines desde Nueva campaña
- `GET /api/malichimp/campaigns`
- `GET /api/malichimp/campaigns/{id}` — detalle y preview
- `GET /api/malichimp/campaigns/{id}/view` — HTML en navegador, autenticado y sin scripts
- `POST /api/malichimp/campaigns/preview`
- `POST /api/malichimp/campaigns` — administrador; admite `draftNewsletterId` si el contenido es un borrador creado aquí
- `POST /api/malichimp/campaigns/{id}/duplicate` — administrador
- `POST /api/malichimp/campaigns/{id}/send` — confirma un borrador duplicado, administrador
- `GET /api/email-delivery/senders` — administrador
- `POST /api/email-delivery/senders` — administrador
- `PATCH /api/email-delivery/senders/{id}` — administrador
- `DELETE /api/email-delivery/senders/{id}` — administrador
- `POST /api/malichimp/imports/xlsx/preview` — administrador, multipart `file` + `groupOptionIds` + `consentConfirmed`
- `POST /api/malichimp/imports/xlsx/{previewId}/apply` — administrador
- `POST /api/malichimp/imports/preview` — administrador, multipart `file` (ZIP)
- `POST /api/malichimp/imports/{previewId}/apply` — administrador
- `GET /api/malichimp/imports/jobs/{jobId}` — administrador

Permiso de lectura: `malichimp`. Importaciones, campañas y remitentes requieren además rol `admin`.

## Notas operativas y riesgos

- **Previews en disco + memoria.** ZIP y XLSX escriben meta (y filas XLSX) bajo `/tmp` con TTL de 30 minutos. Un reinicio en el mismo host puede recuperar el `previewId` mientras no expire. Réplicas distintas del API no comparten `/tmp`.
- **Lock de importación.** Solo un `MalichimpImportJob` `queued`/`running` a la vez (ZIP o XLSX).
- **Auditoría XLSX.** Cada apply crea job + run con huella SHA-256, admin, consentimiento y conteos finales.
- **SES vs catálogo.** Registrar un remitente no garantiza que SES lo acepte. Un fallo de identidad aparece al despachar, no al guardar el catálogo.
- **Exclusiones de audiencia.** Una misma opción no puede estar en incluir y excluir. La exclusión se evalúa por membresía actual al crear la campaña; después el snapshot de destinatarios no cambia.
- **Programación.** Fechas vencidas se rechazan al crear. Cambios de reloj o de zona horaria del cliente deben enviarse como ISO futuro absoluto.
- **Plantilla pública.** El XLSX en `/plantillas/` es estático y descargable sin autenticación; no contiene datos de audiencia.

## Motor SES compartido

`EmailDeliveryService` solo conoce transporte. No conoce campañas, contactos ni
módulos de negocio. En producción usa el rol del EC2 mediante la cadena estándar
del SDK de AWS:

```env
AWS_SES_ENABLED=true
AWS_SES_REGION=us-east-1
AWS_SES_CONFIGURATION_SET=mali-one-newsletters
AWS_SES_EVENTS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/ACCOUNT_ID/mali-one-ses-events
SES_FROM_EMAIL=boletines@mali.pe
SES_FROM_NAME=MALI
SES_SEND_RATE_PER_SECOND=8
```

`SES_FROM_EMAIL` es únicamente el fallback del transporte para módulos que no
definen remitente. Los remitentes seleccionables viven en `EmailSender` y se
administran desde MALICHIMP. El CRUD no verifica identidades en AWS: antes de
usar una dirección, el dominio o la dirección debe estar autorizado en SES.

El conjunto publica eventos en EventBridge y la cola SQS. El consumidor guarda
cada evento de forma idempotente en `SesEventRecord`. Rebotes, quejas y bajas
globales se sincronizan con `EmailGlobalSuppression`; nunca con una audiencia
de negocio específica. El dispatcher compartido solo utiliza snapshots de
campaña y no conoce MALICHIMP, Workspace ni ningún CRM.
