# Changelog — links

Formato: entradas en orden inverso (lo más reciente arriba). Cada mejora del módulo debe registrarse aquí.

## [Unreleased]

- Más formas de QR + validación de contraste.
- Informe Excel post-carga masiva.
- Carpetas/campañas para enlaces.
- Cache de QR en S3; cola bulk; retención LinkClick.

## [2026-11-05] — baseline documental

Reorganización de la documentación por módulo. Contenido consolidado desde el código y la documentación previa del módulo.

- QR con estilos, logo presets MALI, bulk Excel, stats `LinkClick`, redirect `/r/:slug`.
- Catálogo interno WhatsApp para mali-whatsapp.
- Canvas/QR en Docker con `node:20-bookworm-slim` (hecho).

## Backlog histórico (desde MEJORAS-PROXIMAS)

# Mejoras próximas — MALI ONE

Sugerencias de evolución priorizadas por área. No constituyen compromiso de implementación; sirven como backlog de producto y técnico.

---

## Enlaces y QR

### Diseño y exportación

- **Más variantes de forma** — Ampliar el catálogo de cuerpo, marco del ojo y ojo (estilo QRCode Monkey: 15–20 opciones visuales con preview en grid de iconos).
- **Degradado radial** — Exponer en UI el tipo `radial` ya soportado en el DTO (`foregroundGradient.type`).
- **Rotación del degradado** — Control deslizante para ángulo (0–360°) en degradados lineales.
- **EPS de producción** — Mejorar la conversión SVG→EPS (paths PostScript reales) o integrar servicio externo; validar en Adobe Illustrator / CorelDRAW.
- **Validación de escaneabilidad** — Aviso en UI si contraste bajo (logo blanco sobre fondo claro, degradado muy claro, etc.).
- **Plantillas de diseño** — Presets nombrados (“MALI verde”, “Flyer oscuro”, “WhatsApp campaña”) guardables y compartibles entre usuarios admin.

### Logos y marca

- **Nuevos presets MALI** — Añadir variantes estacionales o por área (museo, biblioteca) en `packages/shared/src/qr-logo-presets.ts`.
- **Fondo detrás del logo** — Opción de padding/círculo blanco bajo el logo para presets blancos sobre QR claro.
- **Bulk con mismo diseño** — Aplicar un diseño QR concreto a todos los enlaces creados en una importación Excel.

### Carga masiva

- **Excel en pestaña Archivo con metadatos** — Columnas `slug`, `tags` por fila aunque el binario se suba aparte (matching por nombre de archivo).
- **Informe descargable post-import** — Excel/CSV con enlaces creados, URLs cortas y errores por fila.
- **Límite configurable** — Variable de entorno para max filas/archivos por lote.

---

## Estadísticas y analítica

- **Distinción QR vs clic** — Pixel de tracking o parámetro `?src=qr` en URLs impresas vs enlaces copiados manualmente.
- **Geo / país** — Derivar región desde IP (con hash o anonimización para privacidad).
- **Referrer** — Guardar `Referer` en `LinkClick` cuando esté disponible.
- **Retención de eventos** — Job nocturno que archive o agregue `LinkClick` antiguos (>90 días) para reducir volumen.
- **Dashboard global** — Vista admin con top enlaces, clicks del día y dispositivos agregados.
- **Export CSV** — Descargar estadísticas de un enlace o del historial filtrado.

---

## Producto y organización

- **Carpetas / campañas** — Agrupar enlaces por campaña (flyers, feria, WhatsApp masivo) con filtro en historial.
- **Etiquetas avanzadas** — Autocompletado, tags obligatorios por operador, colores por tag.
- **Caducidad de enlaces** — Fecha de expiración con redirect a página informativa.
- **UTM automáticos** — Añadir parámetros UTM al destino según campaña/tag al crear el enlace.

---

## Infraestructura y rendimiento

- ~~**Canvas en Docker**~~ — Implementado: `infra/docker/Dockerfile.api` usa `node:20-bookworm-slim` + Cairo/Pango (build y runtime).
- **Cache de QR** — Opcional: generar PNG/SVG una vez y guardar en S3 bajo `qr-exports/{linkId}/` para descargas repetidas.
- **Cola para bulk** — Jobs en background (Redis/Bull) cuando lotes >100 enlaces para no bloquear la API.
- **Rate limit en `/r/:slug`** — Mitigar abuso y bots sin perder métricas útiles.

---

## UX del admin

- **Code-split del módulo links** — Lazy load de `qr-code-styling` y Recharts para reducir el bundle inicial (~1.4 MB actual).
- **Vista previa QR en historial** — Miniatura en tabla sin abrir dialog.
- **Duplicar enlace** — Clonar destino + diseño QR con nuevo slug.
- **Historial de cambios** — Audit log cuando se edita destino, tags o diseño QR.

---

## Seguridad y cumplimiento

- **Anonimización IP** — Truncar o hashear IP en `LinkClick` si se añade geo.
- **Escaneo de archivos** — Antivirus o validación MIME estricta en uploads masivos.
- **Lista de dominios permitidos** — Restringir URLs acortables a dominios `@mali.pe` o lista blanca configurable.

---

## Screen-cast (pared de pantallas / lobby)

Contexto: las pantallas que comparten playlist (p. ej. `lobby_izquierdo` / `lobby_derecho`) usan un reloj compartido. El soft-sync (`play:tick` + drift) **no interrumpe** un video que ya está decodificando a propósito: en el pasado, nivelar en plena reproducción provocaba lageo y turnos de pantalla negra.

**Ya en código (fase actual, a desplegar):** auto catch-up solo si hay desfase relativo sostenido entre hermanas (≥ ~1.2 s de `mediaTimeMs` o índice distinto, racha ~15 s, cooldown 4 min). Usa el mismo path que «Sincronizar todos» sin `force`. No corrige frame a frame durante el play.

### Problema conocido (histórico): preview admin vs pantallas (HEVC)

Algunos videos de lobby ya publicados están en **HEVC / H.265**. Chrome no los preview; Tizen sí. **Uploads nuevos** se normalizan a H.264 MP4 (ver [screen-cast.md](../screen-cast.md)). Ítems viejos: volver a subir el archivo.

### Siguiente fase (experiencia del espectador)

Orden sugerido; cada paso debe preservar la regla dura: **nunca pelear mid-video** (ni seek en Tizen, ni sync agresivo cada pocos segundos). Una corrección limpia y rara > sync continuo.

1. **Catch-up con still en vez de negro** *(riesgo bajo)*  
   El catch-up (manual o auto) hoy cubre con overlay negro «Sincronizando…». Mantener el último frame/still visible durante el re-anclaje reduce el golpe visual sin cambiar cuándo ni cómo se dispara la sync. Mismo evento, otra máscara.

2. **Re-anclar en el borde del loop** *(riesgo bajo–medio)*  
   Si el detector ya confirmó desfase, diferir el catch-up al próximo fin de clip / wrap del ciclo en lugar de cortar a mitad de toma. Debe ser **un solo** catch-up coordinado + cooldown; no un bucle de reintentos que reintroduzca el lageo histórico.

3. **Umbral / sensibilidad más perezosos** *(riesgo muy bajo)*  
   Si en lobby el auto-sync corta más de lo deseable, subir el umbral de media (p. ej. 1.5–2 s) o exigir evidencia en ≥2 pantallas reproduciendo el mismo ítem. Preferible un leve desfase visible a flashes innecesarios.

4. **Hold nunca negro puro en lobby** *(riesgo bajo)*  
   Cuando falta copia local / playable, asegurar siempre still de respaldo (la lógica ya apunta ahí; reforzar para que el panel no quede negro).

### Qué no hacer en esta línea

- Corregir drift mid-video mientras el clip está `playing`.
- `currentTime` / seek en Tizen.
- Auto-sync periódico ciego (`force` o catch-up cada X minutos sin desfase).
- Varias pantallas “intentando nivelarse” en bucle sin cooldown.

### Validación antes de la siguiente fase

Observar unos días en lobby tras desplegar el auto-desync: ¿dispara?, ¿el negro molesta?, ¿hay falsos positivos cerca del wrap del loop? Con eso priorizar (1) o (3) antes que (2).

---

## Priorización sugerida (corto plazo)

1. ~~Dependencias `canvas` en Docker de producción~~ (hecho en Dockerfile.api).
2. Informe Excel post-carga masiva.
3. Carpetas/campañas para enlaces.
4. Más formas de QR + validación de contraste.
5. Retención/archivado de `LinkClick`.
6. Screen-cast: observar auto-desync en lobby; luego still-en-catch-up / borde de loop (ver sección arriba).

---

*Última actualización: noviembre 2026 — auto-desync screen-cast; problema conocido preview HEVC vs TVs documentado.*

