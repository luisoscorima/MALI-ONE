# Changelog — google-admin

Formato: entradas en orden inverso (lo más reciente arriba). Cada mejora del módulo debe registrarse aquí.

## [Unreleased]

- Campañas internas (antes Comunicación interna) viven en `/admin/users?tab=campanas`; permiso absorbido en `workspace_users`.
- Audiencia por OU (include/exclude) + activos recientes; sin tope 200; remitente desde catálogo `EmailSender`.
- Redirect legacy `/admin/comunicacion-interna` → `?tab=campanas`.

## [2026-11-05] — baseline documental

Reorganización de la documentación por módulo. Contenido consolidado desde el código y la documentación previa del módulo.

- CRUD Workspace vía Admin SDK + DWD.
