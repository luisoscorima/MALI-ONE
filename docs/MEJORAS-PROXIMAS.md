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

## Priorización sugerida (corto plazo)

1. ~~Dependencias `canvas` en Docker de producción~~ (hecho en Dockerfile.api).
2. Informe Excel post-carga masiva.
3. Carpetas/campañas para enlaces.
4. Más formas de QR + validación de contraste.
5. Retención/archivado de `LinkClick`.

---

*Última actualización: julio 2026 — tras implementación de QR personalizable, carga masiva Excel y estadísticas por enlace.*
