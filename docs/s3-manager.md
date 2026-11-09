# Gestor S3 (s3-manager)

> Changelog: [s3-manager-CHANGELOG.md](./s3-manager-CHANGELOG.md) · Índice: [README.md](./README.md)

## Qué es

Explorador multi-bucket (listar, descargar, URL pública, borrar) restringido al super admin / módulo `s3_manager`.

## Cómo funciona

Lista buckets de `AWS_S3_MANAGER_BUCKETS`, navega prefijos, genera URLs y borra objetos con el rol IAM del EC2.

## Código

- `apps/api/src/modules/s3-manager/`
- Web: `s3-manager-page.tsx`
- Usado también por screen-cast (picker)

## UI

| `/admin/s3` | Explorador |

## API

`/api/s3-manager/buckets`, `.../objects`, `.../download`, `.../public-url`, DELETE objects.

## Datos (Prisma)

N/A (objetos en S3).

## Conexiones externas

| **AWS S3** | Varios buckets |

## Variables de entorno

```env
AWS_REGION=us-east-1
AWS_S3_MANAGER_BUCKETS=mali-assets,mali-backups,mali-one-files,tmsaws
```

En producción no se definen access keys permanentes. El SDK obtiene
credenciales temporales del rol asociado a la instancia.

## Permisos

Módulo `s3_manager` (en práctica alineado a bootstrap admin en UI histórica).

## Relacionados

- [links.md](./links.md)
- [screen-cast.md](./screen-cast.md)
- [plataforma.md](./plataforma.md)
