# MALICHIMP

> Changelog: [malichimp-CHANGELOG.md](./malichimp-CHANGELOG.md) · Índice: [README.md](./README.md)

## Qué es

Base de audiencia de correo independiente de los CRM de WhatsApp. Conserva contactos, estados, grupos, etiquetas históricas y campos importados desde Mailchimp. Las opciones de grupo son la segmentación operativa para enviar boletines.

## Responsabilidades

- **MALICHIMP:** audiencia, consentimiento, segmentación y campañas.
- **Boletines:** creación y publicación del HTML; no conoce destinatarios.
- **Motor de correo:** cola, tracking y transporte reutilizable por AWS SES en `apps/api/src/core/email-delivery/`.
- **CRM PAM / CRM WhatsApp:** no dependen de SES ni aportan audiencia a MALICHIMP.
- **SMTP PAM (`PAM_SMTP_*`):** canal aparte para welcome `pam@mali.pe`; no forma parte de este módulo ni del motor SES.

## Datos

- `MalichimpContact`: perfil y estado de Mailchimp.
- `MalichimpGroup`, `MalichimpGroupOption` y `MalichimpContactGroupOption`: categorías, opciones y pertenencias usadas para segmentar boletines.
- `MalichimpTag` y `MalichimpContactTag`: metadato histórico recuperado; no decide los destinatarios de campañas nuevas.
- `MalichimpSuppression`: bajas y limpiados exclusivos de esta audiencia.
- `EmailGlobalSuppression`: rebotes, quejas y bloqueos del proveedor aplicables a cualquier módulo.
- `MalichimpImportRun`: huella y auditoría de cada importación.
- `EmailCampaign` y `EmailSend`: snapshot de contenido, destinatarios y ciclo de entrega compartido.

Solo `subscribed` es elegible. También se excluyen las supresiones MALICHIMP y las globales. `unsubscribed`, `cleaned` y `nonsubscribed` nunca se incorporan desde otras bases ni desde los CRM de WhatsApp.

## Campañas

1. Un administrador selecciona un boletín publicado.
2. Debe seleccionar una o más opciones de grupo. Un contacto entra si pertenece a cualquiera de las opciones y se deduplica aunque pertenezca a varias.
3. La API muestra el conteo y una muestra antes de confirmar. No existe un envío accidental a “todos”: al menos una opción de grupo es obligatoria.
4. Al confirmar se congelan asunto, HTML, opciones y destinatarios. Editar después el boletín o los grupos no altera la campaña.
5. `EmailCampaignDispatcherService` procesa lotes persistidos, respeta la tasa configurada y reintenta fallos temporales hasta tres veces.
6. SES publica entrega, rebote, complaint, apertura y clic. El procesador compartido proyecta esos eventos sobre `EmailSend`.
7. El footer enlaza a `/mail/unsubscribe/{token}`. El GET pide confirmación y el POST aplica la baja solo en MALICHIMP, evitando que los escáneres de enlaces cancelen suscripciones automáticamente.

El mismo dispatcher ya atiende Comunicación Interna y queda disponible para otros módulos. Los consumidores crean campañas con snapshots; nunca entregan al motor una consulta a sus tablas de contactos.

## Importación

### Desde la UI (recomendado)

Un administrador abre `/admin/malichimp` y selecciona **Importar ZIP de Mailchimp**:

1. Sube un único ZIP de hasta 100 MB.
2. El servidor exige exactamente los cuatro CSV `subscribed`, `unsubscribed`, `cleaned` y `nonsubscribed`, aunque estén dentro de una carpeta del ZIP.
3. La UI muestra el resumen sin modificar PostgreSQL.
4. El administrador confirma explícitamente y observa el progreso.
5. El ZIP y los CSV temporales se eliminan al finalizar; si no se confirma, expiran en 30 minutos.

La importación corre en segundo plano y es idempotente. Los cambios de cada ZIP se confirman en una sola transacción: si falla, no se aplican lotes parciales. El estado del trabajo se guarda en PostgreSQL y la UI lo recupera tras recargar la página. Un ZIP ya importado muestra una advertencia, pero puede reaplicarse sin duplicar contactos.

Las 13 columnas de grupos del export se normalizan como categorías y opciones. La migración también promueve automáticamente los valores que versiones anteriores conservaron en `MalichimpContact.attributes`, evitando una reimportación obligatoria. Las etiquetas siguen guardándose, pero las campañas nuevas no las consultan.

Las supresiones globales originadas por SES viven fuera de MALICHIMP y prevalecen sobre cualquier importación. El contador de elegibles excluye ambas listas.

El Nginx incluido acepta hasta 100 MB. Si Nginx Proxy Manager aplica un límite propio en EC2, su host proxy también debe configurar `client_max_body_size 100m;`.

### Desde consola

La simulación es el modo predeterminado:

```bash
pnpm --filter @mali-one/api prisma:import:malichimp -- --dir /ruta/al/export
```

Para escribir en PostgreSQL se debe agregar explícitamente `--apply`. El directorio debe contener exactamente los cuatro CSV `subscribed`, `unsubscribed`, `cleaned` y `nonsubscribed`.

## API y UI

- UI: `/admin/malichimp`
- `GET /api/malichimp/stats`
- `GET /api/malichimp/contacts`
- `GET /api/malichimp/tags`
- `GET /api/malichimp/groups`
- `GET /api/malichimp/newsletters`
- `GET /api/malichimp/campaigns`
- `POST /api/malichimp/campaigns/preview`
- `POST /api/malichimp/campaigns` — administrador
- `POST /api/malichimp/imports/preview` — administrador, multipart `file`
- `POST /api/malichimp/imports/{previewId}/apply` — administrador
- `GET /api/malichimp/imports/jobs/{jobId}` — administrador

Permiso de lectura: `malichimp`. La importación requiere además rol `admin`.

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

El conjunto publica eventos en EventBridge y la cola SQS. El consumidor guarda
cada evento de forma idempotente en `SesEventRecord`. Rebotes, quejas y bajas
globales se sincronizan con `EmailGlobalSuppression`; nunca con una audiencia
de negocio específica. El dispatcher compartido solo utiliza snapshots de
campaña y no conoce MALICHIMP, Workspace ni ningún CRM.
