# Portafolio de área (todos / portfolio)

> Changelog: [todos-CHANGELOG.md](./todos-CHANGELOG.md) · Índice: [README.md](./README.md)

## Qué es

Gestión interna del área TI: **proyectos**, **tareas (todos)**, **servicios operativos** y dashboard ejecutivo. Módulo Nest `todos` (controllers `todos` + `portfolio`).

## Cómo funciona

1. Se definen meta tipos/estados de tareas y estados de proyecto.
2. Proyectos del portafolio agrupan trabajo; tareas tienen prioridad, esfuerzo, origen.
3. Dashboard agrega estado; servicios operativos marcan up/degraded/down/maintenance.

## Código

- `apps/api/src/modules/todos/` — `todos.controller.ts`, `portfolio.controller.ts`, services
- Web: `portfolio-page.tsx`, `todos-page.tsx` (si aplica), `presentacion-page.tsx`

## UI

| Ruta | Uso |
|------|-----|
| `/portfolio` | Portafolio de área (proyectos, tareas, servicios) |
| `/todos` | Redirige a `/portfolio` |
| `/presentacion` | Vista pública de presentación (display) |

Nota: `apps/web/src/pages/todos-page.tsx` no tiene ruta propia en el router actual.

## API

- `/api/todos` — meta types/statuses, CRUD, reorder, time
- `/api/portfolio` — meta, dashboard, projects, services

## Datos (Prisma)

- `TodoType`, `TodoStatus`, `TodoItem`
- `PortfolioProjectStatus`, `PortfolioProject`
- `OperationalService`

## Conexiones externas

Ninguna (Postgres).

## Variables de entorno

N/A específicas.

## Permisos

Módulo: `portfolio`

## Relacionados

- [plataforma.md](./plataforma.md)
