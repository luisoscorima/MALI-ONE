# Contrato API Prospectia (Chatwoot)

**Prospectia = instancia Chatwoot** hospedada por AttachMedia (`prospectia.attachmedia.com`).  
Producto base: [Chatwoot](https://www.chatwoot.com/) — la API, el modelo (contacts, conversations, labels, agents, custom attributes) y el auth siguen la [API Chatwoot](https://www.chatwoot.com/developers/api/).

Account `21`. Base: `https://prospectia.attachmedia.com/api/v1/accounts/21`.

Auth servicio: header `api_access_token` = env `PROSPECTIA_API_ACCESS_TOKEN`.  
Auth UI: DeviseTokenAuth vía cookie `cw_d_session_info`.  
Account: env `PROSPECTIA_ACCOUNT_ID` o default `21`.

## Revalidación live

Fecha: **2026-11-18** (sesión Prospectia UI, conversación `#11524` / contacto `136836`).

| Check | Resultado |
|-------|-----------|
| `GET /contacts?page=1` | OK — `payload[]` + `meta.count` (8364) |
| `GET /contacts/search?q=+51907933410` | OK — match id `136836` |
| `POST /contacts/filter` (`phone_number`) | OK — match id `136836` |
| `GET /contacts/136836` | OK — phone/email/`whatsapp_user_id` |
| `GET /contacts/136836/conversations` | OK — labels, curso, assignee, team |
| `GET /conversations/11524` | OK — mismo enriquecimiento |
| `GET /labels` | OK — `payload[]`, **16/16** etiquetas del mapeo |
| `GET /agents` | OK — **array** raíz (no `payload`), 20 agentes |
| `GET /custom_attribute_definitions` | OK — **array** raíz |

### Diff vs contrato previo

- **Etiquetas:** sin faltantes ni extras respecto a `prospectia-mapping.ts`.
- **Attrs conversación en catálogo:** `cursos_arte_y_taller`, `cursos_ext_profesional`, `cursos_acelera`, `etiquetas`.  
  `lead_scoring` y `categoria` **aparecen en el payload** de la conversación pero **no** están en `custom_attribute_definitions` (campos dinámicos / no declarados). El cliente debe leerlos del JSON, no del catálogo.
- **Listado `/contacts`:** sí puede traer `labels` a nivel contacto; el **curso/interés y assignee** siguen en la conversación → la ingesta debe seguir llamando `/conversations`.
- **Contacto:** incluye `whatsapp_user_id` (ej. `PE.…`) y a veces `last_lead_scoring`.

## Endpoints usados

| Método | Ruta | Uso | Shape respuesta |
|--------|------|-----|-----------------|
| `GET` | `/contacts?page=N` | Poller | `{ payload: Contact[], meta: { count, current_page } }` |
| `GET` | `/contacts/search?q=` | Match teléfono/texto | igual |
| `POST` | `/contacts/filter` | Match atributo (`phone_number`, `whatsapp_user_id`, …) | igual |
| `GET` | `/contacts/:id` | Detalle contacto | `{ payload: Contact }` o Contact |
| `GET` | `/contacts/:id/conversations` | Labels, custom attrs, assignee, team | `{ payload: Conversation[] }` |
| `GET` | `/conversations/:id` | Detalle conversación | Conversation (raíz) |
| `GET` | `/labels` | Catálogo estados | `{ payload: Label[] }` |
| `GET` | `/agents` | Asesores | `Agent[]` (array raíz) |
| `GET` | `/custom_attribute_definitions` | Definiciones curso/sede/… | `Definition[]` (array raíz) |

## Payload conversación (muestra real `#11524`)

```json
{
  "id": 11524,
  "status": "open",
  "inbox_id": 27,
  "labels": ["venta_exitosa_arte"],
  "custom_attributes": {
    "cursos_arte_y_taller": "Improvisación Teatral",
    "lead_scoring": 50
  },
  "meta": {
    "assignee": {
      "id": 162,
      "name": "Genesis Crystal Bacaflor Liñan",
      "email": "gbacaflor@mali.pe"
    },
    "team": { "id": 14, "name": "equipo de arte" },
    "sender": {
      "id": 136836,
      "name": "Ariana",
      "email": "arianaveronicarendonpariona@gmail.com",
      "phone_number": "+51907933410"
    }
  }
}
```

Mapeo simulado OK: `prospectiaStatus=venta_exitosa_arte`, `interestCourse=Improvisación Teatral`, `leadScore=50`, `advisorEmail=gbacaflor@mali.pe`, categoría **ca**.

## Etiquetas = estados comerciales Prospectia (16)

| title | Significado (description) |
|-------|---------------------------|
| `mql_cursos_de_arte` / `mql_ep` / `mql_experiencias` | Interés / exploración |
| `sql_cursos_de_arte` / `sql_ep` / `sql_experiencias` | Listo para cierre |
| `venta_exitosa_arte` / `venta_exitosa_ep` | Comprobante / venta |
| `alumno_matriculado` | Ya pagó / inscrito mes |
| `agendamiento` | Visita agendada |
| `no_contesta` / `sin_respuesta` | Inactividad |
| `no_vent_*` / `obj_precio` | No venta / objeción |

Mapeo ONE: `apps/api/src/modules/crm-educacion/prospectia/prospectia-mapping.ts`.

## Atributos de interés (curso)

Conversación (en payload; parte también en definiciones):

- `cursos_arte_y_taller` → categoría **ca**
- `cursos_ext_profesional` → categoría **ep**
- `cursos_acelera`
- `lead_scoring` (número; presente en payload, no siempre en definiciones)
- `categoria` (texto libre, p.ej. "Cursos y Talleres"; puede no estar en definiciones)
- `etiquetas` (Estados ATC)

Contacto (definiciones):

- `curso_arte`, `curso_profesional`, `sede`, `rango_de_edad`, `institucion`, `tipo_institucion`, `nivel_educativo`, campos de cobranza…

## Atribución Meta (badge binario)

Attrs de conversación (no siempre en `custom_attribute_definitions`):

`ctwa_source_id`, `ctwa_source_url`, `ctwa_headline`, `ctwa_body`, `ctwa_clid`, `ctwa_media_url`, `ctwa_media_type`, `ctwa_source_type`.

Si alguno viene no vacío → `enrichment.fromMeta=true` y `sourceLabel` incluye `Meta` (p.ej. `Prospectia · Meta · …`). UI: badge **Meta** en Historial / Solo contacto. Sin paridad Instant Form vs CTWA de WA.

## Inbox Prospectia (poca info, útil)

| id | kind | label corto |
|----|------|-------------|
| 39 | web | Web |
| 27 | whatsapp | WA CA |
| 26 | whatsapp | WA EP |
| 28 | whatsapp | WA XP |

Va en `enrichment.inbox` + `sourceLabel` (`Prospectia · WA CA · Meta · …`) y API `prospectia_inbox`.

## Solo contacto vs con chat (Prospectia-first)

Inboxes Chatwoot (no son mali-whatsapp): Web Mali + 3 WhatsApp Prospectia.

| Flag | Criterio |
|------|----------|
| `has_prospectia_chat` / `cameWithInbound` | Hay conversación Chatwoot (`primaryConversation` con id) |
| `solo_contacto` | `cameWithInbound=false` (sin conversación Prospectia) |
| `linked_wa` | `waCycleId` set (puente opcional; **no** redefine solo contacto) |

El link-cycle desde mali-whatsapp no pisa `cameWithInbound`.

## Qué guarda ONE en la ingesta

`EducacionOpportunity`:

- `externalId` = contact id Prospectia / Chatwoot
- `advisorEmail` = `meta.assignee.email`
- `prospectiaStatus` = etiqueta primaria
- `interestCourse` = curso/interés
- `leadScore`, `category` (`ca`\|`ep`\|`general`), `stageSlug`
- `sourceLabel` = `Prospectia` · opcional `Meta` · opcional curso
- `payload` = `{ contact, conversation, enrichment }` (`enrichment.fromMeta`)

## Notas de implementación

1. Auth de servicio (`api_access_token`) no se revalidó en browser; el match legado WA ya lo usa en prod.
2. Shapes heterogéneos Chatwoot: `agents` y `custom_attribute_definitions` = array raíz; `labels`/`contacts` = `{ payload }`.
3. Enriquecimiento comercial (curso, score, assignee) exige `GET .../conversations` aunque el listado traiga `labels` de contacto.
