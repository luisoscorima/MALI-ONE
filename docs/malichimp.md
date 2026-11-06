# MALICHIMP

> Changelog: [malichimp-CHANGELOG.md](./malichimp-CHANGELOG.md) · Índice: [README.md](./README.md)

## Qué es

Base de audiencia de correo independiente de los CRM de WhatsApp. Conserva contactos, estados, etiquetas y campos de segmentación importados desde Mailchimp.

## Responsabilidades

- **MALICHIMP:** audiencia, consentimiento y supresiones.
- **Boletines:** creación del HTML.
- **Motor de correo:** transporte reutilizable por AWS SES en `apps/api/src/core/email-delivery/`.
- **CRM PAM / CRM WhatsApp:** no dependen de SES ni aportan audiencia a MALICHIMP.
- **SMTP PAM (`PAM_SMTP_*`):** canal aparte para welcome `pam@mali.pe`; no forma parte de este módulo ni del motor SES.

## Datos

- `MalichimpContact`: perfil y estado de Mailchimp.
- `MalichimpTag` y `MalichimpContactTag`: segmentos recuperados.
- `MalichimpSuppression`: bajas, limpiados y futuros rebotes/quejas de SES.
- `MalichimpImportRun`: huella y auditoría de cada importación.

Solo `subscribed` es elegible para un futuro envío. `unsubscribed` y `cleaned` siempre están suprimidos; `nonsubscribed` se conserva, pero no es elegible.

## Importación

### Desde la UI (recomendado)

Un administrador abre `/admin/malichimp` y selecciona **Importar ZIP de Mailchimp**:

1. Sube un único ZIP de hasta 100 MB.
2. El servidor exige exactamente los cuatro CSV `subscribed`, `unsubscribed`, `cleaned` y `nonsubscribed`, aunque estén dentro de una carpeta del ZIP.
3. La UI muestra el resumen sin modificar PostgreSQL.
4. El administrador confirma explícitamente y observa el progreso.
5. El ZIP y los CSV temporales se eliminan al finalizar; si no se confirma, expiran en 30 minutos.

La importación corre en segundo plano y es idempotente. Un ZIP ya importado muestra una advertencia, pero puede reaplicarse sin duplicar contactos.

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
- `POST /api/malichimp/imports/preview` — administrador, multipart `file`
- `POST /api/malichimp/imports/{previewId}/apply` — administrador
- `GET /api/malichimp/imports/jobs/{jobId}` — administrador

Permiso de lectura: `malichimp`. La importación requiere además rol `admin`.

## Motor SES compartido

`EmailDeliveryService` solo conoce transporte. No conoce campañas, contactos ni módulos de negocio. Admite credenciales SES dedicadas y, por compatibilidad, credenciales AWS generales:

```env
AWS_SES_REGION=us-east-1
AWS_SES_ACCESS_KEY_ID=
AWS_SES_SECRET_ACCESS_KEY=
SES_FROM_EMAIL=boletines@mali.pe
SES_FROM_NAME=MALI
```

La existencia del motor no habilita envíos. La ejecución masiva, límites, eventos de rebote/queja y salida del sandbox se incorporarán en una fase posterior.
