# Changelog — google-admin

Formato: entradas en orden inverso (lo más reciente arriba). Cada mejora del módulo debe registrarse aquí.

## [Unreleased]

- Migración: `boletin-prueba-ti` → biblioteca `internal_communications`.
- Biblioteca propia `internal_communications` (pestaña Contenido); campañas ya no usan `shared` published.
- Remitentes de campaña filtrados a `scope=internal_communications`.
- Eliminar campañas internas en **borrador**; si el boletín ligado está en borrador y sin otras campañas, también se elimina.
- Paridad con MALICHIMP: miniatura en fila, duplicar, programar envío, crear borrador de boletín, continuar borradores.
- Campañas internas (antes Comunicación interna) viven en `/admin/users?tab=campanas`; permiso absorbido en `workspace_users`.
- Audiencia por OU (include/exclude) + activos recientes; sin tope 200; remitente desde catálogo `EmailSender`.
- Redirect legacy `/admin/comunicacion-interna` → `?tab=campanas`.

## [2026-11-05] — baseline documental

Reorganización de la documentación por módulo. Contenido consolidado desde el código y la documentación previa del módulo.

- CRUD Workspace vía Admin SDK + DWD.
