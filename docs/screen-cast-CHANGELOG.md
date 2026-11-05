# Changelog — screen-cast

Formato: entradas en orden inverso (lo más reciente arriba). Cada mejora del módulo debe registrarse aquí.

## [Unreleased]

- Catch-up con still en vez de overlay negro (riesgo bajo).
- Re-anclar sync en borde de loop / fin de clip.
- Umbrales de auto-desync más perezosos si hay falsos positivos en lobby.
- Hold nunca negro puro cuando falta copia local.

## [2026-11-05] — editar playlist = mismo sync que «Sincronizar todos»

- Mutaciones de playlist/ítems usan `catchUpWhenUnchanged: true` (mismo contrato que el botón admin).
- Si el contenido cambió → reinicio con barrera; si no → reancla al reloj compartido.
- Sin pantallas conectadas al reiniciar, se invalida el reloj viejo para no servir firma obsoleta.

## [2026-11-05] — soft-sync también en imágenes/GIF

- Stills reportan `mediaTimeMs` (progreso local del slot) para que el watchdog detecte desfase entre hermanas sin esperar a que una ya haya cambiado de slide.
- El drift loop reancla el timer de avance de stills al reloj compartido (seguro mid-slot, a diferencia del video en Tizen).
- Si el progreso local vs reloj supera ~1.2 s, realinea Ken Burns sin cortar el slot.

## [2026-11-05] — normalize video upload to H.264

- Upload MP4/MOV → H.264 MP4 liviano (CRF 23, max edge 1920); audio opcional AAC.
- Si ya es H.264 y el reencode no reduce peso, se deja el original.
- Corrige preview admin/Chrome vs TVs para uploads nuevos (HEVC previos requieren re-subida).

## [2026-11-05] — baseline documental

Reorganización de la documentación por módulo. Contenido consolidado desde el código y la documentación previa del módulo.

- Documentación inicial del módulo (playlists, monitores, gateway, S3, agenda).
- Documentado soft-sync y auto catch-up. (La limitación de preview HEVC quedó obsoleta al normalizar uploads a H.264; ver entrada «normalize video upload».)
