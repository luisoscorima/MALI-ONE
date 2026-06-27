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
| [educacion.mali.pe](https://educacion.mali.pe) | Selector sedes | `{APP_URL}/widgets/educacion/selector-sedes.html` |

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

1. Asigna módulos `widget_educacion`, `widget_biblioteca` o `widget_pam` en **Accesos MALI ONE**.
2. Edita datos en **Widgets Educación / Biblioteca / PAM** (`/admin/widgets/...`, pestaña Configuración).
3. Previsualiza en la pestaña **Vista previa**.

**Nota:** Las rutas del panel admin son `/admin/widgets/*`. Los HTML embebibles públicos siguen en `/widgets/*.html` (sin conflicto con nginx).

## API pública (sin autenticación)

- `GET /api/widgets/educacion/config`
- `GET /api/widgets/biblioteca/carousel`
- `GET /api/widgets/pam/config`
- `POST /api/widgets/pam/registrations`
- `POST /api/widgets/pam/webhooks/mercadopago`

## Variables de entorno

```env
GOOGLE_MAPS_API_KEY=          # mapa educación
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
