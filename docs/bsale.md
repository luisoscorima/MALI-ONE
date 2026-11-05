# Kardex Bsale (bsale)

> Changelog: [bsale-CHANGELOG.md](./bsale-CHANGELOG.md) · Índice: [README.md](./README.md)

## Qué es

Reportes Kardex consolidados contra la API Bsale Perú (stock por almacén/período) y exportación.

## Cómo funciona

El operador elige oficinas/rango; la API agrega movimientos vía cliente Bsale y puede exportar.

## Código

- `apps/api/src/modules/bsale/` — client, kardex, export, controller
- Web: `bsale-kardex-page.tsx`

## UI

| `/bsale/kardex` | Kardex consolidado |

## API

| GET | `/api/bsale/offices` |
| POST | `/api/bsale/kardex` |
| POST | `/api/bsale/kardex/export` |

## Datos (Prisma)

N/A (datos en Bsale).

## Conexiones externas

| **Bsale API** (`BSALE_BASE_URL`) | Oficinas y kardex |

## Variables de entorno

```env
BSALE_BASE_URL=https://api.bsale.com.pe
BSALE_ACCESS_TOKEN=
```

## Permisos

Módulo: `bsale_reports`

## Relacionados

- [treasury.md](./treasury.md) (finanzas, dominio distinto)
