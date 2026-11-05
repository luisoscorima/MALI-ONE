# Catálogo Educación (catalog-educacion)

> Changelog: [catalog-educacion-CHANGELOG.md](./catalog-educacion-CHANGELOG.md) · Índice: [README.md](./README.md)

## Qué es

CRUD de áreas, cursos, programas, sedes, distritos y **estados de lead** usados por enlaces WhatsApp, widgets y CRM Educación.

## Cómo funciona

El admin mantiene catálogos en Postgres; opciones se exponen a otros módulos. Estados de lead se sincronizan/espejan con definiciones en mali-whatsapp.

## Código

- `apps/api/src/modules/catalog-educacion/`
- Web: `catalog-educacion-page.tsx`

## UI

| `/admin/catalogo-educacion` | Catálogo |

## API

Prefijo `/api/educacion-catalog`: options, cursos, programas, areas, distritos, sedes, estados-lead (CRUD).

## Datos (Prisma)

- `EducacionCatalogArea`, `EducacionCatalogCurso`, `EducacionCatalogPrograma`, `EducacionCatalogProgramaCurso`
- `EducacionCatalogSede`
- Distritos/sedes widget pueden solaparse con modelos widget (`EducacionDistrict`, etc.) — ver widgets

## Conexiones externas

| **mali-whatsapp** | Estados de lead (fuente de verdad del catálogo operativo) |

## Variables de entorno

Sin env específicas (usa DB + CRM token vía otros módulos).

## Permisos

Módulo: `catalog_educacion`

## Relacionados

- [crm-educacion.md](./crm-educacion.md)
- [widgets.md](./widgets.md)
- [links.md](./links.md)
