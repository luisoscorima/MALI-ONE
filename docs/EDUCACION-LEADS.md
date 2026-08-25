# Leads Educación — go-live y apagado del Sheet

Widget `lead-form.html` → `POST /api/widgets/educacion/leads` → `EducacionLead` → WhatsApp CRM (+ Google Sheets opcional).

## Checklist go-live

1. **Migración**
   ```bash
   pnpm --filter @mali-one/api prisma:migrate
   ```
2. **WhatsApp CRM** en `.env` de MALI ONE:
   - `WHATSAPP_CRM_BASE_URL=https://whatsapp.mali.pe`
   - `WHATSAPP_CRM_SERVICE_TOKEN=` (mismo que `CRM_SERVICE_TOKEN` en mali-whatsapp)
3. **Sheet (transitorio)** — crear **tres** spreadsheets (EP, CA, Diseño) y compartirlos con el `client_email` de la service account (Editor):
   - `EDUCACION_LEADS_SHEETS_ENABLED=true`
   - `GOOGLE_SHEETS_LEADS_EP_ID=` ID **o URL** del libro Extensión Profesional
   - `GOOGLE_SHEETS_LEADS_TAB_EP=EP` (nombre exacto de la pestaña)
   - `GOOGLE_SHEETS_LEADS_CA_ID=` ID **o URL** del libro Cursos de Arte
   - `GOOGLE_SHEETS_LEADS_TAB_CA=CA`
   - `GOOGLE_SHEETS_LEADS_DISENO_ID=` ID **o URL** del libro Diseño y Comunicaciones
   - `GOOGLE_SHEETS_LEADS_TAB_DISENO=Diseno`
   - Columnas append: Fecha, Nombres, Apellidos, DNI, Celular, Correo, Curso, Fuente, Source, URL, OptIn Marketing, Lead ID, Bucket

   Enrutado automático:

   | Origen | Destino |
   |--------|---------|
   | `/extensionprofesional/…` (WhatsApp EP) | Libro EP |
   | `/diseno-y-comunicaciones/…` (sigue siendo WhatsApp EP) | Libro Diseño |
   | Cursos de Arte (WhatsApp CA) | Libro CA |

   Para cambiar de libro: solo edita la URL/ID en `.env` y reinicia la API.
4. **WordPress**
   - Plugin `mali-one-embed` ≥ 1.0.5
   - `MALI_ONE_URL` apunta al entorno correcto
   - Plantillas EP / cursos ya usan `[mali_lead_form]`
5. **Prueba E2E** (curso EP de prueba):
   - Enviar formulario «Conversemos»
   - Verificar fila en tabla `EducacionLead` (`waStatus=ok`)
   - Contacto en [whatsapp.mali.pe](https://whatsapp.mali.pe) área **Educación EP** con origen `channel=widget` (curso/fuente en payload del origen; **no** attrs `source`/`fuente`/`curso`)
   - Si Sheets está on: fila nueva en el rango configurado
   - Apagar Sheet a propósito (`ENABLED=false`) y confirmar que el submit sigue OK y WA sync funciona

## Apagar el espejo Sheet (cuando CRM Educación / WhatsApp baste)

```env
EDUCACION_LEADS_SHEETS_ENABLED=false
```

No hace falta cambiar el widget ni WordPress. Los leads nuevos solo irán a `EducacionLead` + WhatsApp.

## Áreas WhatsApp

Solo **EP** y **CA** en esta fase. La línea genérica `educacion` no se usa todavía.

| Contexto WordPress | Línea WhatsApp | `area` |
|--------------------|----------------|--------|
| Extensión Profesional (`extensionprofesional`) | Educación EP | `educacion_ep` |
| Cursos de Arte (`curso-de-arte`) | Educación CA | `educacion_ca` |
| Educación (genérica) | pendiente | — |
