# Changelog — crm-educacion

Formato: entradas en orden inverso (lo más reciente arriba). Cada mejora del módulo debe registrarse aquí.

## [Unreleased]

- Associate pagos: `Autorizada` / `authorized` / `processing` cierran ciclo (`settlementKind: authorized` + obs); `Por pagar` / pending / mediation siguen sin cerrar. Caja valida liquidación antes de postventa.
- Anura → actividades CRM: cliente CDRs + import 24h (match ciclo WA por teléfono); UI recientes + botón import. Spike con `ANURA_REFRESH_TOKEN`.
- Anura: contrato real documentado (`docs/anura-contract.md`); `EducacionCrmActivity.payload` guarda el CDR completo; UI resume agente/persona/teléfono/segundos (billSeconds). `calledName` ≠ persona.
- Anura webhook: `POST /api/crm-educacion/webhooks/anura` + `ANURA_WEBHOOK_SECRET` (Bearer). No depende del refresh token; trigger END → misma tabla de actividades.
- Inbox Prospectia en fuente: Web / WA CA / WA EP / WA XP (`enrichment.inbox`, `prospectia_inbox`).
- Prospectia-first: `cameWithInbound` = hay conversación Chatwoot; solo contacto no mira mali-whatsapp; `linked_wa` aparte; link-cycle no pisa el flag.
- Badge binario Prospectia · Meta: attrs `ctwa_*` → `fromMeta` / `sourceLabel` + badge en Historial y Solo contacto.
- Prospectia solo en ONE: check/ingest/import nativos; se quitó match/sync proxy a WA y el botón «Match Prospectia (WA)». WA solo `link-cycle` al inbound.
- Prospectia como medio de ingreso (ONE): `EducacionPerson` / `EducacionOpportunity` / poller; import manual; Historial + Solo contacto. Solo env nueva: `PROSPECTIA_API_ACCESS_TOKEN`.
- Enriquecimiento Prospectia (Chatwoot) desde API live: etiquetas→`prospectiaStatus`/`stageSlug`, attrs→`interestCourse`/`leadScore`, assignee→`advisorEmail`; payload `{ contact, conversation, enrichment }`. Contrato: [prospectia-contract.md](./prospectia-contract.md).
- Revalidación live contratos Chatwoot (2026-11-18): 16/16 labels; shapes `agents`/`custom_attribute_definitions` = array raíz; `lead_scoring`/`categoria` en payload conversación aunque no siempre en definiciones; fallback `contact.last_lead_scoring`.
- Option A: `venta_exitosa` no cierra ciclo; cierre por pago positivo / sin pago / pérdida. Columna **Pago** (`payment_link` desde `EducacionSale`) en Oportunidades. Associate: positivo / en_proceso (+obs) / negativo (rechazo). Internal `GET sales/by-cycle/:id` para WA.
- F0: docs destino/roles; inventario consumidores; sync widget `area=educacion`+categoría; retry WA; higiene attrs.
- F1: `stale` / `solo_contacto`; Historial; UI Promesa fecha / Perdido motivo.
- F2: actividades UI + API; spike Anura; asesor ≠ chat documentado.
- F3: venta/aplicaciones; lookup+associate (ONE + proxy WA `/api/leads/payments/*`); apply/reverse Caja; internal service token.
- F4 scaffolding: `commercial-authority`, `EducacionChannelEvent`, doc cutover (mensajería intacta).
- F5: boleteo OBS→boleteado + matrícula ref en UI Pagos.
- Apagar Sheets: `EDUCACION_LEADS_SHEETS_ENABLED=false` cuando baste.
- RQs pendientes: ver «Requerimientos Educación» en crm-educacion.md

## [2026-11-05] — baseline documental

Reorganización de la documentación por módulo. Contenido consolidado desde el código y la documentación previa del módulo.

- CRM sobre ciclos WA; widget leads → EducacionLead → WhatsApp (+ Sheets opcional).
- Estados de inscripción documentados; catálogo administrable en ONE.
