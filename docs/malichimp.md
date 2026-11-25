# MALICHIMP

> Changelog: [malichimp-CHANGELOG.md](./malichimp-CHANGELOG.md) · Índice: [README.md](./README.md)

## Qué es

Base de audiencia de correo independiente de los CRM de WhatsApp. Conserva contactos, estados, grupos, etiquetas históricas y campos importados desde Mailchimp o desde lotes XLSX manuales. En campañas nuevas la audiencia se elige con **una sola fuente**: opciones de grupo, etiquetas o lista de correos ya existentes en MALICHIMP.

## Responsabilidades

- **MALICHIMP:** audiencia, consentimiento, segmentación y campañas.
- **Campañas y Boletines (hub):** biblioteca org (`shared`), registro de campañas y remitentes globales; no opera envíos MALICHIMP.
- **Motor de correo:** cola, tracking y transporte reutilizable por AWS SES en `apps/api/src/core/email-delivery/`.
- **CRM PAM / CRM WhatsApp:** no dependen de SES ni aportan audiencia a MALICHIMP.
- **SMTP PAM (`PAM_SMTP_*`):** canal aparte para welcome `pam@mali.pe`; no forma parte de este módulo ni del motor SES.

## Datos

- `MalichimpContact`: perfil y estado de Mailchimp / importaciones manuales.
- `MalichimpGroup`, `MalichimpGroupOption` y `MalichimpContactGroupOption`: categorías, opciones y pertenencias usadas para segmentar boletines.
- `MalichimpTag` y `MalichimpContactTag`: etiquetas históricas de Mailchimp; también pueden segmentar campañas (modo Etiquetas).
- `EmailCampaign.audienceMode`: `groups` | `tags` | `emails` (null = campaña histórica → grupos).
- `MalichimpSuppression`: bajas y limpiados exclusivos de esta audiencia.
- `EmailGlobalSuppression`: rebotes, quejas y bloqueos del proveedor aplicables a cualquier módulo.
- `MalichimpImportRun` / `MalichimpImportJob`: huella, consentimiento (XLSX) y progreso de ZIP y XLSX.
- `EmailCampaign` y `EmailSend`: snapshot de contenido, destinatarios y ciclo de entrega compartido.
- `EmailSender`: catálogo por `scope` (`malichimp` para este módulo; también `shared` e `internal_communications`).

Solo `subscribed` es elegible para campañas. También se excluyen las supresiones MALICHIMP y las globales. `unsubscribed`, `cleaned` y `nonsubscribed` no se reactivan desde una importación XLSX. El ZIP de Mailchimp conserva el estado del export. Ningún CRM de WhatsApp aporta audiencia a este módulo.

## Campañas

1. En **Nueva campaña** el flujo es un panel numerado: **Para** → **De** → **Contenido** → **Envío**. En Para se elige **una** forma de audiencia (Grupos por defecto en campañas nuevas).
2. **Grupos** o **Etiquetas**: incluir una o más (unión: al menos una); exclusiones opcionales y secundarias (siempre prevalecen). **Lista de correos**: pegar direcciones ya en MALICHIMP → `POST /campaigns/resolve-emails` clasifica listos / no encontrados / inválidos / no pueden recibir; solo los no encontrados llevan a Importar (con consentimiento). Tope 10 000 correos únicos.
3. Elegibilidad única en todo el módulo: `subscribed` + sin supresión MALICHIMP + sin supresión global (`eligibleContacts` en tags; preview/create/send).
4. La API calcula destinatarios finales y una muestra tabular (nombre/email) antes de confirmar. En lista de correos el afinado quita IDs de `includeContactIds` (sin `excludeContactIds`).
5. **Contenido** es la biblioteca acotada MALICHIMP (`scope=malichimp`, `kind=library`): se crea/edita sin campaña y sin permiso de Boletines. El asistente de campañas usa **solo** esa biblioteca (no `shared` published).
6. Al crear o duplicar una campaña se genera un **fork exclusivo** (`workingNewsletterId`, `campaign_working_copy`) en la misma transacción. El asunto se propone desde la base; el nombre interno del envío es opcional.
7. El fork de una campaña en borrador se edita con el mismo editor (`?tab=content&edit={id}`). La URL pública `/n/:slug` es solo para biblioteca `shared` published del hub.
8. Remitentes: pestaña **Remitentes** en MALICHIMP (CRUD `scope=malichimp`) y también visibles en el hub. El selector de campaña filtra ese catálogo; reply-to en opciones avanzadas. `fromEmail` y `replyTo` deben ser `@mali.pe`.
9. Radios **Enviar ahora** / **Programar envío**, con confirmación explícita. Prueba y envío envían `contentRevision`; si el fork cambió → `409`.
10. Al confirmar se congelan asunto, HTML, diseño, marca, criterios de audiencia y destinatarios desde el fork.
11. **Duplicar** crea campaña + fork desde snapshots. Copia modo de audiencia (grupos/etiquetas/correos), remitente, asunto e inclusiones/exclusiones; limpia programación y métricas. En modo correos reconstruye destinatarios desde IDs guardados (no copia no encontrados/bloqueados).
12. `EmailCampaignDispatcherService` procesa lotes persistidos, personaliza placeholders por destinatario, respeta la tasa configurada y reintenta fallos temporales hasta tres veces. En asunto y HTML se sustituyen `{{first_name}}`, `*|FNAME|*` y `<<First Name>>` con el primer nombre del contacto (`EmailSend.name`); si falta, usa `estimado(a)`.
13. SES publica entrega, rebote, complaint, apertura y clic. El procesador compartido proyecta esos eventos sobre `EmailSend`.
14. Chrome de envío (estilo de plataforma): arriba, “Ver este correo en el navegador” → `{APP_URL}/mail/view/{openToken}` (snapshot + personalización; sin contar apertura); abajo, “Cancelar suscripción” → `/mail/unsubscribe/{token}`. `/n/{slug}` es solo el boletín público vigente de biblioteca.

El mismo dispatcher ya atiende Campañas internas (Usuarios Workspace) y queda disponible para otros módulos. Los consumidores crean campañas con snapshots; nunca entregan al motor una consulta a sus tablas de contactos.

## Importación

### XLSX de contactos (UI, lotes nuevos)

Cualquier usuario con módulo `malichimp` abre `/admin/malichimp` → **Importar contactos** → pestaña **XLSX de contactos**:

1. Descarga la plantilla en `/plantillas/plantilla-contactos-malichimp.xlsx` (fila 1: encabezados; fila 2: ejemplo a reemplazar) o sube un XLSX con una columna de correo (acepta alias como `Correo`, `Email`, `Email address`).
2. Límite: 10 MB y 10 000 contactos por lote.
3. Selecciona una o más opciones de grupo que se agregarán a cada contacto importable sin quitar membresías previas.
4. Confirma el consentimiento explícito en la UI.
5. La API muestra preview (nuevos, existentes, bloqueados, muestra) sin escribir PostgreSQL.
6. Al confirmar, crea o completa perfiles en una sola transacción, añade membresías y registra `MalichimpImportJob` + `MalichimpImportRun` (incluye huella del archivo, usuario y marca de consentimiento).

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

Las 13 columnas de grupos del export se normalizan como categorías y opciones. La migración también promueve automáticamente los valores que versiones anteriores conservaron en `MalichimpContact.attributes`, evitando una reimportación obligatoria. Las etiquetas se conservan y pueden usarse como fuente de audiencia en campañas (modo Etiquetas).

Las supresiones globales originadas por SES viven fuera de MALICHIMP y prevalecen sobre cualquier importación. El contador de elegibles excluye ambas listas.

El Nginx incluido acepta hasta 100 MB. Si Nginx Proxy Manager aplica un límite propio en EC2, su host proxy también debe configurar `client_max_body_size 100m;`.

### Desde consola

La simulación es el modo predeterminado:

```bash
pnpm --filter @mali-one/api prisma:import:malichimp -- --dir /ruta/al/export
```

Para escribir en PostgreSQL se debe agregar explícitamente `--apply`. El directorio debe contener exactamente los cuatro CSV `subscribed`, `unsubscribed`, `cleaned` y `nonsubscribed`.

## Remitentes

El catálogo `EmailSender` con `scope=malichimp` se administra en **MALICHIMP → Remitentes** (autonomía) y también en el hub **Campañas y Boletines → Remitentes** (ver [newsletters.md](./newsletters.md)).

## API y UI

- UI: `/admin/malichimp`
  - Audiencia por defecto
  - `?tab=campaigns` · `?tab=campaigns&new=1` · `?tab=campaigns&campaign={id}`
  - `?tab=content` · `?tab=content&new=1` · `?tab=content&edit={id}` (biblioteca MALICHIMP o fork de campaña)
- `GET /api/malichimp/stats`
- `GET /api/malichimp/contacts` — opcional `tagId`, `groupOptionId`, `q`
- `PATCH /api/malichimp/contacts/{id}` — perfil + grupos; no cambia email ni status
- `GET /api/malichimp/tags` — `contacts` (histórico) + `eligibleContacts` (enviables)
- `GET /api/malichimp/groups`
- `GET /api/malichimp/newsletters/library` — bases: solo library MALICHIMP
- `GET|POST|PATCH|DELETE /api/malichimp/senders` — catálogo remitentes del módulo
- `GET /api/malichimp/content` — biblioteca MALICHIMP (`malichimp`/`library`)
- `POST /api/malichimp/content` — nuevo contenido de biblioteca
- `GET|PATCH /api/malichimp/content/{id}` — library o working copy (fork solo si campaña draft)
- `GET /api/malichimp/content/{id}/view` — HTML autenticado
- `POST /api/malichimp/content/{id}/duplicate` · `DELETE /api/malichimp/content/{id}` — solo library
- `GET /api/malichimp/campaigns` — incluye `createdBy` y contadores (incl. `replied`)
- `POST /api/malichimp/campaigns/export` — Excel de todas o `campaignIds` seleccionadas
- `GET /api/malichimp/campaigns/{id}` — detalle; `workingNewsletterId`, `contentRevision`, criterios manuales
- `GET /api/malichimp/campaigns/{id}/stats?days=30&scope=production|test|all`
- `GET /api/malichimp/campaigns/{id}/sends?event=&scope=&q=&page=`
- `GET /api/malichimp/campaigns/{id}/view`
- `GET /api/malichimp/test-recipients?q=`
- `POST /api/malichimp/campaigns/test-send` — exige `contentRevision` si ya hay fork
- `POST /api/malichimp/campaigns/preview` — `audienceMode` opcional (`groups` por defecto)
- `POST /api/malichimp/campaigns/resolve-emails` — clasifica lista pegada (máx. 10 000 únicos)
- `POST /api/malichimp/campaigns` — campaña + fork desde library MALICHIMP; persiste `audienceMode`
- `POST /api/malichimp/campaigns/{id}/duplicate`
- `DELETE /api/malichimp/campaigns/{id}` — borradores (elimina el fork)
- `POST /api/malichimp/campaigns/{id}/send` — snapshot desde fork; `contentRevision` obligatorio
- `GET /api/email-delivery/senders` — autenticado (selector de campañas)
- `POST|PATCH|DELETE /api/email-delivery/senders…` — administrador (UI en Boletines)
- `POST /api/malichimp/imports/xlsx/preview` — multipart `file` + `groupOptionIds` + `consentConfirmed`
- `POST /api/malichimp/imports/xlsx/{previewId}/apply`
- `POST /api/malichimp/imports/preview` — **solo admin**, multipart `file` (ZIP)
- `POST /api/malichimp/imports/{previewId}/apply` — **solo admin** (ZIP)
- `GET /api/malichimp/imports/jobs/{jobId}`

Permiso: módulo `malichimp`. Solo el import ZIP de Mailchimp exige además rol `admin`. Remitentes del módulo: CRUD con `malichimp`.

### Contador “respondieron”

Al enviar, el dispatcher pone `Reply-To` plus-address (`usuario+mc.{sendId}@mali.pe`). Con `GOOGLE_GMAIL_REPLY_SYNC=true` y la misma service account de Workspace (scope `gmail.readonly` + domain-wide delegation), un cron marca `EmailSend.repliedAt` sin guardar cuerpos. Revisa buzones con envíos recientes (prueba o real), aunque la campaña siga en borrador. Las stats muestran “X personas respondieron”.

### Envío de prueba

En el wizard (paso Envío) → **Enviar prueba**:

1. Destinatarios solo `@mali.pe` (siempre el usuario en sesión + hasta 4 más del directorio interno).
2. Se crea o reutiliza un borrador de campaña; cada prueba es un `EmailSend` con `isTest: true`.
3. El envío es síncrono (no usa el dispatcher). Incluye tracking de apertura/clic, “ver en navegador” (`/mail/view/{openToken}`) y Reply-To con token; **no** inserta enlace de baja.
4. El asunto lleva prefijo `[PRUEBA]`. No altera `sentCount` / KPIs de producción.
5. En estadísticas: por defecto solo envíos reales; checkbox **Incluir pruebas** suma las de prueba (denominador coherente con el alcance).

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
administran en Boletines. El CRUD no verifica identidades en AWS: antes de
usar una dirección, el dominio o la dirección debe estar autorizado en SES.

El conjunto publica eventos en EventBridge y la cola SQS. El consumidor guarda
cada evento de forma idempotente en `SesEventRecord`. Rebotes, quejas y bajas
globales se sincronizan con `EmailGlobalSuppression`; nunca con una audiencia
de negocio específica. El dispatcher compartido solo utiliza snapshots de
campaña y no conoce MALICHIMP, Workspace ni ningún CRM.
