# Rol AWS de ejecución para MALI ONE

En producción, MALI ONE usa credenciales temporales del rol asociado a su
instancia EC2. No se guardan access keys permanentes en `.env` ni en Docker.

## Recursos

- Cuenta AWS: `390372371680`
- Rol: `mali-one-ec2-role`
- Política S3: `mali-one-policy`
- Política de correo: `mali-one-email-delivery-policy`
- Región SES/SQS/S3: `us-east-1`
- Identidad SES: `mali.pe`
- Configuration set: `mali-one-newsletters`
- Cola: `mali-one-ses-events`
- Bucket principal: `mali-one-files`
- Buckets del gestor: `mali-assets`, `mali-backups`, `mali-one-files`, `tmsaws`

La regla EventBridge conserva su propio rol de ejecución. No debe usar el rol
de la instancia.

## Confianza del rol

Al crear el rol, seleccionar `Servicio de AWS` y caso de uso `EC2`. La relación
de confianza resultante debe permitir `sts:AssumeRole` a
`ec2.amazonaws.com`.

## Políticas adjuntas al rol (estado real)

Mantener **dos políticas separadas** en `mali-one-ec2-role`: correo y S3.
Así se puede auditar o revocar un servicio sin afectar al otro.

### `mali-one-email-delivery-policy` (SES + SQS)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "SendFromMaliDomain",
      "Effect": "Allow",
      "Action": [
        "ses:SendEmail",
        "ses:SendRawEmail"
      ],
      "Resource": [
        "arn:aws:ses:us-east-1:390372371680:identity/mali.pe",
        "arn:aws:ses:us-east-1:390372371680:configuration-set/mali-one-newsletters"
      ]
    },
    {
      "Sid": "ConsumeMaliOneSesEvents",
      "Effect": "Allow",
      "Action": [
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:ChangeMessageVisibility",
        "sqs:GetQueueAttributes",
        "sqs:GetQueueUrl"
      ],
      "Resource": "arn:aws:sqs:us-east-1:390372371680:mali-one-ses-events"
    }
  ]
}
```

### `mali-one-policy` (S3 manager + uploads)

`s3:PutObject` (subir) y `s3:ListBucket` (listar en Gestor S3) son permisos
distintos; ambos son necesarios.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ListBucketsForManager",
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::mali-assets",
        "arn:aws:s3:::mali-backups",
        "arn:aws:s3:::mali-one-files",
        "arn:aws:s3:::tmsaws"
      ]
    },
    {
      "Sid": "ObjectsInBuckets",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::mali-assets/*",
        "arn:aws:s3:::mali-backups/*",
        "arn:aws:s3:::mali-one-files/*",
        "arn:aws:s3:::tmsaws/*"
      ]
    }
  ]
}
```

### Qué cubren y qué no

| Necesidad | ¿Lo resuelve el rol IAM? |
|---|---|
| API sube/lee/borra objetos desde EC2 | Sí (`PutObject` / `GetObject` / `DeleteObject`) |
| Gestor S3 lista prefijos | Sí (`ListBucket`) |
| SES envía y consume eventos SQS | Sí (política de correo) |
| URL pública anónima `https://bucket.s3…/key` (correo, `<img src>`) | **No** |

`S3_PUBLIC_READ=true` solo hace que la app **devuelva** una URL sin firma. La
lectura anónima exige, además:

1. **Block Public Access** desactivado en el bucket (o lo bastante relajado), y
2. una **bucket policy** con `s3:GetObject` para `Principal: "*"` acotada a
   prefijos públicos.

Sin eso, el rol sube bien el objeto pero un `GET` sin credenciales responde
**403**. Las políticas IAM del EC2 no sustituyen la bucket policy pública.

El rol tampoco incluye acciones de administración del bucket
(`GetBucketPolicy`, `GetBucketPublicAccessBlock`, etc.); por eso desde la
instancia no se puede inspeccionar ni editar esas políticas: hay que hacerlo
con un usuario/admin IAM aparte.

### Bucket policy de `mali-one-files` (lectura pública acotada)

Estado operativo: Block Public Access desactivado; solo estos prefijos son
anónimos. `qr-logos/*` permanece privado (la API lee logos con el rol IAM).

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadScreenCast",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::mali-one-files/screen-cast/*"
    },
    {
      "Sid": "PublicReadNewsletters",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::mali-one-files/newsletters/*"
    },
    {
      "Sid": "PublicReadUploads",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::mali-one-files/uploads/*"
    }
  ]
}
```

| Prefijo | Uso |
|---|---|
| `screen-cast/*` | Medios de transmisión a pantallas |
| `newsletters/*` | Imágenes/GIFs de boletines (correo) |
| `uploads/*` | Archivos de Enlaces (`LinkType.FILE`) |

## EC2 y Docker

Asociar `mali-one-ec2-role` a la instancia de MALI ONE. En las opciones de
metadatos de la instancia:

- endpoint de metadatos: habilitado;
- IMDSv2: obligatorio;
- límite de saltos de respuesta: `2` para que los contenedores Docker puedan
  obtener las credenciales temporales.

## Variables del contenedor API

```env
AWS_REGION=us-east-1
AWS_S3_BUCKET=mali-one-files
S3_PUBLIC_READ=true
AWS_S3_MANAGER_BUCKETS=mali-assets,mali-backups,mali-one-files,tmsaws

AWS_SES_ENABLED=true
AWS_SES_REGION=us-east-1
AWS_SES_CONFIGURATION_SET=mali-one-newsletters
AWS_SES_EVENTS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/390372371680/mali-one-ses-events
SES_FROM_EMAIL=boletines@mali.pe
SES_FROM_NAME=MALI
SES_SEND_RATE_PER_SECOND=8
```

Con `S3_PUBLIC_READ=true`, la app emite URLs públicas del bucket. Esas URLs solo
funcionan si la bucket policy (arriba) lo permite. Si el bucket sigue privado,
usar `S3_PUBLIC_READ=false` (URLs prefirmadas) o servir assets por otro origen
público (p. ej. `https://dev.mali.pe/newsletter-brands/…` para logos de boletines).

Eliminar del entorno de producción:

```env
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_SES_ACCESS_KEY_ID
AWS_SES_SECRET_ACCESS_KEY
```

Después de cambiar el entorno se debe recrear el contenedor API; un simple
reinicio no siempre vuelve a leer las variables del archivo Compose.

## Retiro seguro del usuario IAM anterior

1. Asociar el rol al EC2 y recrear el API sin access keys.
2. Probar lectura, carga y eliminación controlada en S3.
3. Probar SES con el simulador de buzón y confirmar que el evento llega a SQS y
   se persiste en PostgreSQL.
4. Desactivar primero la access key del usuario `mali-one-s3`.
5. Observar la aplicación y repetir las pruebas.
6. Si no hay regresiones, eliminar la access key, desadjuntar la política y
   eliminar el usuario IAM.

No eliminar el usuario antes de comprobar el rol. Desactivar la clave primero
da una ventana reversible si aparece alguna dependencia antigua.

Como administrador autenticado se puede consultar `GET /api/email-delivery/status`
y disparar pruebas seguras con:

- `POST /api/email-delivery/simulator/success`
- `POST /api/email-delivery/simulator/bounce`
- `POST /api/email-delivery/simulator/complaint`

Estos endpoints solo aceptan direcciones del simulador oficial de SES; no
permiten enviar a destinatarios arbitrarios.
