# Rol AWS de ejecución para MALI ONE

En producción, MALI ONE usa credenciales temporales del rol asociado a su
instancia EC2. No se guardan access keys permanentes en `.env` ni en Docker.

## Recursos

- Rol: `mali-one-ec2-role`
- Política S3 existente: `mali-one-policy`
- Política de correo: `mali-one-email-delivery-policy`
- Región SES/SQS: `us-east-1`
- Identidad SES: `mali.pe`
- Cola: `mali-one-ses-events`

La regla EventBridge conserva su propio rol de ejecución. No debe usar el rol
de la instancia.

## Confianza del rol

Al crear el rol, seleccionar `Servicio de AWS` y caso de uso `EC2`. La relación
de confianza resultante debe permitir `sts:AssumeRole` a
`ec2.amazonaws.com`.

## Política de correo de mínimo privilegio

Crear `mali-one-email-delivery-policy` con el siguiente JSON, reemplazando
`ACCOUNT_ID` por el ID de la cuenta AWS:

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
        "arn:aws:ses:us-east-1:ACCOUNT_ID:identity/mali.pe",
        "arn:aws:ses:us-east-1:ACCOUNT_ID:configuration-set/mali-one-newsletters"
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
      "Resource": "arn:aws:sqs:us-east-1:ACCOUNT_ID:mali-one-ses-events"
    }
  ]
}
```

Adjuntar al rol la política anterior y la política S3 existente
`mali-one-policy`. Mantenerlas separadas facilita auditar o revocar un servicio
sin afectar al otro.

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
AWS_S3_MANAGER_BUCKETS=mali-assets,mali-backups,mali-one-files,tmsaws

AWS_SES_ENABLED=true
AWS_SES_REGION=us-east-1
AWS_SES_CONFIGURATION_SET=mali-one-newsletters
AWS_SES_EVENTS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/ACCOUNT_ID/mali-one-ses-events
SES_FROM_EMAIL=boletines@mali.pe
SES_FROM_NAME=MALI
```

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
