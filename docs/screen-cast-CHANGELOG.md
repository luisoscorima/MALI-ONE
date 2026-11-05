# Changelog — screen-cast

Formato: entradas en orden inverso (lo más reciente arriba). Cada mejora del módulo debe registrarse aquí.

## [Unreleased]

- Catch-up con still en vez de overlay negro (riesgo bajo).
- Re-anclar sync en borde de loop / fin de clip.
- Umbrales de auto-desync más perezosos si hay falsos positivos en lobby.
- Hold nunca negro puro cuando falta copia local.

## [2026-11-05] — normalize video upload to H.264

- Upload MP4/MOV → H.264 MP4 liviano (CRF 23, max edge 1920); audio opcional AAC.
- Si ya es H.264 y el reencode no reduce peso, se deja el original.
- Corrige preview admin/Chrome vs TVs para uploads nuevos (HEVC previos requieren re-subida).

## [2026-11-05] — baseline documental

Reorganización de la documentación por módulo. Contenido consolidado desde el código y la documentación previa del módulo.

- Documentación inicial del módulo (playlists, monitores, gateway, S3, agenda).
- Documentado soft-sync, auto catch-up y limitación de preview HEVC vs Tizen.
