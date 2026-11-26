# Changelog — screen-cast

Formato: entradas en orden inverso (lo más reciente arriba). Cada mejora del módulo debe registrarse aquí.

## [Unreleased]

- Caché offline unificada (`config/media v7`) y fallback de `/screen-cast?id=…`
  al shell local sin que el query string impida arrancar.
- Los despliegues del Service Worker ya no eliminan la caché persistente de
  videos completos (`screen-cast-video-v1`).
- Sin red declarada por el navegador, el player usa config local y pausa los
  handshakes WebSocket/descargas hasta el evento `online`, sin alterar el reloj
  ni la lógica de sincronización.
- Al arrancar se reconstruyen primero los `blob:` de videos persistidos; una
  playlist solo de video no intenta S3 antes de revisar su copia local.
- Las descargas cacheables ya no se degradan permanentemente a streaming tras
  fallas transitorias: reintentan con backoff de hasta 5 minutos.
- El auto-update conserva siempre el último shell arrancable y un stall de
  decoder sin API no elimina la única copia local del video.
- Imágenes/GIF de S3 se reproducen y cachean mediante el proxy same-origin; las
  firmas S3 guardadas que expiran a los 7 días ya no rompen la pantalla. Las
  respuestas legacy opacas se descartan y se rellenan de nuevo desde el proxy.
- Shell y config abandonan la red a los 4–5 segundos y usan caché cuando una TV
  sigue marcando `online` dentro de una LAN sin salida. Los assets con hash usan
  cache-first y `/screen-cast?id=…` prefiere su entrada exacta antes del fallback.
- El arranque local ya no espera el registro/actualización del Service Worker y
  un sondeo espaciado recupera el socket si el televisor pierde el evento online.
- Cada build fuerza la instalación del worker, refresca el shell canónico y
  precarga sus JS/CSS con hash; las entradas exactas de builds viejos se limpian
  solo después de guardar correctamente el nuevo shell.
- El favicon dinámico forma parte del shell offline y su actualización maneja
  cortes de red sin dejar rechazos `Failed to fetch` en la consola.
- Las pestañas Configuración / Vista previa quedan en la URL (`?tab=preview`).
- Catch-up con still en vez de overlay negro (riesgo bajo).
- Re-anclar sync en borde de loop / fin de clip.
- Umbrales de auto-desync más perezosos si hay falsos positivos en lobby.
- Hold nunca negro puro cuando falta copia local.

## [2026-11-05] — fix fronteras de agenda (`Cannot read … 'get'`)

- `applyScheduleTransition` usaba `server.sockets.sockets.get`; con namespace `/screen-cast` Nest inyecta un `Namespace` y el Map correcto es `server.sockets`.
- El poll de agenda aísla errores por pantalla para no abortar el resto del tick.
- Sin el fix, el override no aplicaba y reintentaba cada 15 s con el mismo error.

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
