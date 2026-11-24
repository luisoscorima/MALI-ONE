# Campañas y Boletines (newsletters)

> Changelog: [newsletters-CHANGELOG.md](./newsletters-CHANGELOG.md) · Índice: [README.md](./README.md)

## Qué es

Hub global de correo: biblioteca org (`shared`), visibilidad de plantillas de módulo, registro de campañas (solo lectura) y catálogo de remitentes por scope. El editor org publica HTML en `/n/{slug}`. Las campañas se **operan** en cada módulo de audiencia (MALICHIMP, Usuarios Workspace).

## Glosario

| Concepto UI | `audienceArea` | `NewsletterScope` / sender scope | `AppModule` |
|-------------|---------------|----------------------------------|-------------|
| MALICHIMP | `malichimp` | `malichimp` | `malichimp` |
| Campañas internas | `internal_workspace` | `internal_communications` | `workspace_users` |
| Hub Campañas y Boletines | — | `shared` (CRUD) + ve todos | `newsletters` |
| Legacy | `pam` | — | `mailing` (enum muerto) |

## Cómo funciona

1. **Hub → Boletines:** lista `kind=library` de todos los scopes. Crear/editar/publicar/duplicar/eliminar solo aplica a `shared`. Piezas de módulo se abren con deep link al módulo dueño.
2. **Hub → Campañas:** registro readonly de `EmailCampaign` + enlace al asistente del módulo.
3. **Hub → Remitentes:** CRUD de todos los scopes (badge de módulo).
4. Cada módulo tiene su biblioteca (`scope` + `kind=library`) y elige **solo** esa biblioteca al crear campañas. Fork exclusivo `campaign_working_copy`.
5. `/n/{slug}` solo sirve `shared` + `library` + `published`.
6. Personalización `{{first_name}}` y tracking viven en `core/email-delivery` al enviar.

## UI

| Ruta | Uso |
|------|-----|
| `/admin/newsletters` | Hub: Boletines (multi-scope) |
| `/admin/newsletters?tab=campanas` | Registro de campañas |
| `/admin/newsletters?tab=remitentes` | Remitentes globales |
| `/n/:slug` | Público shared published |
| MALICHIMP → Contenido / Remitentes | Biblioteca y CRUD remitentes `malichimp` |
| Usuarios → Contenido | Biblioteca `internal_communications` |

## API

- Admin: `/api/newsletters` CRUD shared; `GET /api/newsletters/campaigns` registro.
- Remitentes hub: `/api/email-delivery/senders` (`scope` opcional en query/body).
- Remitentes MALICHIMP: `/api/malichimp/senders`.
- Público: `GET /n/:slug`.

## Remitentes

- Particionados por `EmailSender.scope` (`@@unique([scope, email])`).
- Mínimo 1 remitente **por scope**.
- `assertEnabled(email, scope)` estricto al módulo.
- MALICHIMP tiene pestaña Remitentes (autonomía sin `newsletters`). IC consume el selector; CRUD IC vía hub.

## Permisos

Módulo: `newsletters` (hub). Operación de campañas: `malichimp` / `workspace_users`.

## Relacionados

- [malichimp.md](./malichimp.md)
- [google-admin.md](./google-admin.md)
