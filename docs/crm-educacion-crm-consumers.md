# Inventario consumidores CRM Educación (F0)

Fecha: 2026-11-18. Solo inventario; no implica cutover.

## mali-whatsapp (escritor comercial actual)

| Consumidor | Qué usa |
|------------|---------|
| `EducationLeadWorkflowService` | ciclos, management, distribute, review, SLA, stale/solo_contacto |
| `LeadsService` / webhooks Meta-TikTok | orígenes, entradas, captación |
| Inbox conversaciones | asignación chat (≠ asesor comercial); refleja ciclo |
| Prospectia sync/check | snapshot en entradas |
| CRM API (`/api/crm/education/*`) | contrato HTTP para ONE |
| PAM sync (`/api/crm/sync`) | identidad/attrs PAM (mismo `people`) |

## MALI ONE (proxy / dominio nuevo)

| Consumidor | Qué usa |
|------------|---------|
| `CrmEducacionService` + page | vitrina contactos/ciclos/leads |
| Widget `EducacionLead` | `POST /api/crm/origins` channel=widget |
| `EducacionSaleService` | venta, lookup/associate/apply Treasury |
| `EducacionActivityService` | actividades multi-canal |
| Catálogo estados | proxy CRUD statuses WA |
| CRM PAM | personas compartidas (cutover: alinear maestro) |

## Destino post-cutover

Escrituras comerciales → ONE. WA conserva mensajería + outbox de hechos de canal. Ver [crm-educacion-cutover.md](./crm-educacion-cutover.md).
