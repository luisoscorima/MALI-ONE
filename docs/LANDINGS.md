# Landings de MALI Educación

El módulo **Landings** mantiene el contenido, genera la vista previa y congela
una versión HTML al publicar. WordPress conserva la URL pública, pero no guarda
el contenido ni carga su theme.

## Flujo

1. En MALI ONE, un usuario con acceso a `landings` crea o edita bloques.
2. **Guardar borrador** no modifica la versión pública.
3. **Guardar y publicar** genera un nuevo snapshot HTML y aumenta su versión.
4. El plugin `mali-one-embed` resuelve `/landing/{slug}/`, consulta el snapshot
   público y lo entrega como documento completo.
5. El plugin conserva un minuto de caché y un respaldo de siete días para
   errores temporales de MALI ONE. Un `404` elimina el respaldo, de modo que una
   landing despublicada deja de servirse al vencer la caché corta.

La plantilla inicial `gestion-cultural` toma la información de la ficha vigente
de MALI Educación. No contiene precios, promociones ni testimonios que no estén
en esa fuente. El bloque `lead_form` reutiliza el widget oficial de Educación y
su flujo MALI ONE → MALI WhatsApp; no envía datos a otros CRM.

El editor mantiene bloques controlados y reordenables. Además de hero, texto,
beneficios, horarios, CTA, preguntas, formulario y footer, incluye `faculty`
para una plana docente con datos opcionales y `gallery` para una selección
editorial de imágenes. No se incorporan videos en esta fase.

El mismo widget distingue el origen `landing` de `wordpress_widget`. En ambos
casos conserva durante la sesión y envía `utm_source`, `utm_medium`,
`utm_campaign`, `utm_content`, `utm_term`, `gclid`, `fbclid`, la URL pública y
el referrer. MALI ONE guarda estos datos en `EducacionLead` y los incluye en el
payload del origen que crea en MALI WhatsApp. El mensaje prellenado de WhatsApp
no expone estos datos de atribución.

## Configuración

API de MALI ONE:

```env
APP_URL=https://dev.mali.pe
LANDINGS_PUBLIC_BASE_URL=https://educacion.mali.pe/landing
LANDINGS_GTM_ID=GTM-XXXXXXX
CORS_ORIGINS=https://educacion.mali.pe
```

`LANDINGS_GTM_ID` es opcional. Si se configura, el HTML independiente carga ese
contenedor y emite `view_program`, `click_cta`, `open_form`, `click_whatsapp`,
`download_brochure` y `generate_lead` en `dataLayer`.

WordPress (`wp-config.php`):

```php
define('MALI_ONE_URL', 'https://dev.mali.pe');
```

## Primer despliegue

```bash
pnpm --filter @mali-one/api prisma:migrate
pnpm --filter @mali-one/api prisma:seed:landings
```

Después se actualiza/activa `mali-one-embed`. La versión `1.1.3` refresca las
reglas de rewrite una vez desde `admin_init`; también pueden guardarse de nuevo
los enlaces permanentes de WordPress si la ruta todavía no responde.

El plugin aísla visualmente estas páginas de los elementos globales de GSpeech
(`.gspeech_pro_main_wrapper` y `#sexy_tooltip_title`). GSpeech continúa activo
en las fichas de cursos y en el resto del sitio WordPress.

El seed crea `gestion-cultural` como borrador. Si ya existe, conserva sus
ediciones y solo añade los bloques visuales `docentes` y `experiencia-mali`
cuando todavía no están presentes. Nunca publica ni reemplaza bloques
existentes: la revisión y publicación siempre se hacen explícitamente desde
MALI ONE.
