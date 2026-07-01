# Widgets embebidos en sitios públicos

MALI ONE sirve los shells HTML en `{APP_URL}/widgets/**` y la configuración en `{APP_URL}/api/widgets/**`.

## Dominios destino

| Sitio | Widget | URL iframe |
|-------|--------|------------|
| [biblioteca.mali.pe](https://biblioteca.mali.pe) | Carrusel Koha | `{APP_URL}/widgets/biblioteca/carrusel-biblioteca.html` |
| [mali.pe/es](https://mali.pe/es) | Interfaz sistemas | `{APP_URL}/widgets/museo/interfaz-sistemas.html` |
| [mali.pe/es](https://mali.pe/es) | PAM membresías | `{APP_URL}/widgets/pam/membership.html?embed=1` |
| [educacion.mali.pe](https://educacion.mali.pe) | Calendario | `{APP_URL}/widgets/educacion/calendario.html` |
| [educacion.mali.pe](https://educacion.mali.pe) | Mapa sedes | `{APP_URL}/widgets/educacion/mapa.html` |
| [educacion.mali.pe](https://educacion.mali.pe) | Selector sedes | Script `{APP_URL}/widgets/educacion/selector-loader.js` |
| [educacion.mali.pe](https://educacion.mali.pe) | Popup promocional | Script `{APP_URL}/widgets/shared/popup-loader.js?ctx=educacion` |
| [mali.pe/es](https://mali.pe/es) | Popup promocional | Script `{APP_URL}/widgets/shared/popup-loader.js?ctx=museo` |
| [educacion.mali.pe](https://educacion.mali.pe) | Aliados | `{APP_URL}/widgets/educacion/aliados.html` |

Reemplaza `{APP_URL}` por tu instancia (ej. `https://dev.mali.pe`).

## Ejemplo PAM en WordPress (con postMessage)

```html
<iframe
  id="pam-membership"
  src="https://dev.mali.pe/widgets/pam/membership.html?embed=1"
  style="width:100%;border:0;"
  scrolling="no"
  title="Programa Amigos del MALI"
></iframe>
<script>
window.addEventListener('message', function (e) {
  if (e.origin !== 'https://dev.mali.pe') return;
  if (e.data?.type === 'pam-iframe-resize') {
    document.getElementById('pam-membership').style.height = e.data.height + 'px';
  }
  if (e.data?.type === 'pam-open-checkout') {
    window.open(e.data.url, '_blank', 'noopener,noreferrer');
  }
});
</script>
```

## Ejemplo carrusel en Koha

```html
<iframe
  src="https://dev.mali.pe/widgets/biblioteca/carrusel-biblioteca.html"
  style="width:100%;max-width:1200px;height:720px;border:0;"
  title="Nuevas adquisiciones MALI"
></iframe>
```

## Configuración en MALI ONE

1. Asigna módulos `widget_educacion`, `widget_biblioteca`, `widget_museo` y/o `pam_memberships` en **Accesos MALI ONE**.
2. Edita widgets en **Widgets Educación / Biblioteca / Museo** (`/admin/widgets/...`). La operación PAM (planes, registros) está en **Membresías PAM** (`/admin/pam`).
3. Previsualiza en la pestaña **Vista previa**.

**Nota:** Las rutas del panel admin son `/admin/widgets/*`. Los HTML embebibles públicos siguen en `/widgets/*.html` (sin conflicto con nginx).

### Fuente BentonSansFB

Los widgets cargan `widgets/educacion/benton-sans.css`, que apunta a:

`widgets/educacion/fonts/BentonSansFB-*.woff2`

Asegúrate de que esos 4 archivos `.woff2` existan en el contenedor `web` (misma carpeta que usa mapa y calendario). No van en git por licencia; cópialos desde el tema WordPress o MALI-TI al desplegar.

Los loaders **selector-loader.js** y **popup-loader.js** (en `/widgets/shared/`) incluyen la fuente automáticamente al inyectarse.

## WordPress (plugin `mali-one-embed`)

### Educación (`web-educacion-wp`)

En `wp-config.php`:

```php
define('MALI_ONE_URL', 'https://dev.mali.pe');
```

Activa el plugin y usa los shortcodes:

| Shortcode | Comportamiento |
|-----------|----------------|
| `[mali_mapa]` | iframe del mapa |
| `[mali_calendario]` | iframe del calendario |
| `[mali_aliados]` | iframe de aliados |
| `[mali_popup]` | flag: carga popup-loader.js (`ctx=educacion`) |

El **selector flotante** se carga globalmente en todas las páginas (filtro `mali_one_embed_selector_global`).

### Museo (`web-mali-wp`)

Mismo `MALI_ONE_URL` en `wp-config.php`. Shortcodes:

| Shortcode | Comportamiento |
|-----------|----------------|
| `[mali_popup]` | Popup del museo (`ctx=museo`, config separada) |
| `[mali_membership]` / `[mali_pam]` | iframe PAM + postMessage |
| `[mali_interfaz]` | iframe interfaz de sistemas |

Tras migrar, desactiva `mali-popup` y la config popup legacy de `mali-shared-config`.

## API pública (sin autenticación)

- `GET /api/widgets/educacion/config`
- `GET /api/widgets/educacion/selector/config`
- `GET /api/widgets/educacion/calendar/config`
- `GET /api/widgets/educacion/calendar/events?month=&year=`
- `GET /api/widgets/educacion/popup/config`
- `GET /api/widgets/museo/popup/config`
- `GET /api/widgets/educacion/aliados/config`
- `GET /api/widgets/biblioteca/carousel`
- `GET /api/widgets/pam/config`
- `POST /api/widgets/pam/registrations`
- `POST /api/widgets/pam/webhooks/mercadopago`

### API administración PAM (requiere módulo `pam_memberships`)

- `GET /api/pam/settings`
- `PUT /api/pam/settings`
- `GET /api/pam/plans`
- `PATCH /api/pam/plans/:id`
- `GET /api/pam/registrations`
- `PATCH /api/pam/registrations/:id`

### API administración Widgets Museo (requiere módulo `widget_museo`)

- `GET /api/widgets/museo/popup`
- `PUT /api/widgets/museo/popup`

## Variables de entorno

```env
GOOGLE_MAPS_API_KEY=          # mapa educación
GOOGLE_CALENDAR_API_KEY=      # calendario educación
# Orígenes de sitios que cargan widgets vía fetch (selector, popup)
CORS_ORIGINS=https://educacion.mali.pe,https://biblioteca.mali.pe,https://mali.pe
PAM_SMTP_HOST=
PAM_SMTP_PORT=587
PAM_SMTP_USER=
PAM_SMTP_PASS=
PAM_SMTP_FROM=pam@mali.pe
```

## Seed inicial

```bash
pnpm --filter @mali-one/api prisma:migrate
pnpm --filter @mali-one/api prisma:seed:widgets
```

Datos importados desde MALI-TI (`mapa_conf`, `carrusel-data`, `pam-data`).
