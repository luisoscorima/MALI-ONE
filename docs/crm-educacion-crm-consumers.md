# Inventario consumidores CRM Educación (F0)

Fecha: 2026-11-18. Solo inventario; no implica cutover.

## mali-whatsapp (escritor comercial actual)

| Consumidor | Qué usa |
|------------|---------|
| `EducationLeadWorkflowService` | ciclos, management, distribute, review, SLA, stale/solo_contacto |
| `LeadsService` / webhooks Meta-TikTok | orígenes, entradas, captación |
| Inbox conversaciones | asignación chat (≠ asesor comercial); refleja ciclo |
| `MaliOneOpportunityLinkService` | post-`recordEntry` → ONE `link-cycle` (aditivo) |
| CRM API (`/api/crm/education/*`) | contrato HTTP para ONE |
| PAM sync (`/api/crm/sync`) | identidad/attrs PAM (mismo `people`) |

## MALI ONE (proxy / dominio nuevo + piloto Prospectia)

| Consumidor | Qué usa |
|------------|---------|
| `CrmEducacionService` + page | vitrina contactos/ciclos/leads |
| Widget `EducacionLead` | `POST /api/crm/origins` channel=widget |
| `EducacionSaleService` | venta, lookup/associate/apply Treasury |
| `EducacionActivityService` | actividades multi-canal |
| `ProspectiaClientService` | check/lookup Chatwoot (sin proxy WA) |
| `ProspectiaIngestService` | poller → `EducacionPerson` + `EducacionOpportunity` |
| `EducacionOpportunityService` | listado / link-cycle / Solo contacto ONE |
| Catálogo estados | proxy CRUD statuses WA |
| CRM PAM | personas compartidas (cutover: alinear maestro) |

## Destino post-cutover

Escrituras comerciales → ONE. WA conserva mensajería + outbox de hechos de canal. Ver [crm-educacion-cutover.md](./crm-educacion-cutover.md).

Piloto actual: Prospectia (+ manual/widget vía `POST /opportunities`) con `commercialAuthority=one`; ciclos WA sin enlace siguen `wa`. Bandeja ONE une ambos.

### Contrato compatibilidad UX WA (facade)

Cuando el dato comercial se mueva a ONE, mali-whatsapp debe seguir ofreciendo al asesor:

- mismas rutas/pantallas de etapa, ficha, chat, asociar código;
- mismos campos de respuesta hacia la UI del asesor;
- cambios solo aditivos (`link-cycle`, deep-link, outbox/mirror).

ONE expone `GET /commercial-authority` con `wa_ux: stable`, `per_opportunity: true` y `wa_channels_pending` (Meta/TikTok/WA inbound al final).

### Hooks aditivos WA (sin rediseño inbox)

| Hook | Rol |
|------|-----|
| `POST .../internal/opportunities/link-cycle` | Binding ciclo WA → oportunidad ONE |
| Deep-link ciclo / Prospectia en ficha ONE | Abrir chat sin cambiar UX asesor |
| `EducacionChannelEvent` outbox | Espejo futuro hechos de canal |
