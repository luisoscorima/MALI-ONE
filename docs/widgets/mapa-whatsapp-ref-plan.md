# Plan: clic a WhatsApp con ref en el mapa de sedes

Estado: **pendiente** (fase 2). Fase 1 ya hecha: cada sede del catálogo tiene `whatsapp` y `correo` propios y el mapa los muestra (migración `20261126230000_catalog_sede_whatsapp_correo`).

## Objetivo

Que el número de WhatsApp de cada sede en el mapa (educacion.mali.pe) sea clicable y que la conversación llegue al CRM de WhatsApp atribuida al mapa y a la sede, con conteo de clics. Campaña de ~3 meses.

## Contexto

- 22 de los 23 números ya están conectados al CRM de WhatsApp (mali-whatsapp); el restante se conectará pronto.
- En MALI ONE el `ref` **es el slug de un enlace corto**. Al crear un enlace WHATSAPP, el texto queda `ref:{slug} · mensaje` (`links/whatsapp-ref.util.ts`).
- mali-whatsapp atribuye leyendo `GET /api/links/internal/whatsapp-catalog` (match `ref` → enlace → sede/tags). Un `ref` sin enlace no se atribuye.
- Los clics se cuentan en `LinkClick` al pasar por `{APP_URL}/r/{slug}`. Si el slug no está en Redis, `resolveRedirect` lo lee de la base, así que los enlaces sembrados por SQL funcionan sin precargar caché.
- Cada sede tiene un número distinto: hacen falta **23 enlaces**, uno por sede, todos con el mismo texto genérico.

## Diseño

### 1. Migración de datos: 23 enlaces WHATSAPP

Una migración nueva (no editar la de fase 1 si ya está desplegada) que inserte en `ShortLink`:

| Campo | Valor |
|-------|-------|
| `slug` | `mapa-` + parte local del correo de la sede con `.` → `-` (ej. `mapa-callao-bellavista`, `mapa-bertello`, `mapa-chorrillos-horizontes`). Máx. 32 caracteres; los slugs de sede no sirven (`mapa-innova-schools-sanchez-pinillos` = 36). |
| `type` | `WHATSAPP` |
| `targetUrl` | `https://api.whatsapp.com/send?phone=51{dígitos}&text=ref%3A{slug}%20%C2%B7%20{texto}` (mismo formato que `buildWhatsappUrl`) |
| `tags` | `{mapa}` |
| `catalogSedeId` | id de la sede, resuelto por `slug` de sede |
| `createdById` | usuario administrador (pendiente de definir) |
| `qrStyle` | `NULL` |

- `INSERT ... ON CONFLICT ("slug") DO NOTHING` para que sea idempotente.
- Antes de escribirla: `SELECT` de solo lectura en producción para confirmar que ningún slug `mapa-*` está ocupado.

### 2. API pública del mapa

`EducacionWidgetsService.getPublicConfig()` añade `whatsappUrl` por sede:

- Si la sede tiene `whatsapp` y existe un enlace con tag `mapa`, `catalogSedeId` = sede y `archivedAt` nulo → `{APP_URL}/r/{slug}`.
- Si no → `null`.

Una sola consulta extra (`include` de `links` filtrado), sin lógica nueva en el módulo Links.

### 3. Widget (`mapa-app.js`)

El número pasa a ser un enlace (`target="_blank"`, `rel="noopener"`):

| Caso | Destino del clic |
|------|------------------|
| Sede con `whatsappUrl` | Enlace corto (cuenta clic + ref al CRM) |
| Sede con `whatsapp` sin enlace | `https://wa.me/51{dígitos}` directo |
| Sede sin `whatsapp` (usa el general) | `https://wa.me/51{dígitos del general}` directo |

## Operación

- **Cambio de número durante la campaña:** editar la sede (lo que se muestra) **y** el enlace en el módulo Links (adonde lleva el clic). Links ya permite editarlo y reaplica el `ref`. Es el único costo de este diseño: el número vive en dos sitios.
- **Fin de campaña:** vaciar `whatsapp` de las sedes; el mapa vuelve al número general. Opcional: archivar los enlaces con tag `mapa` (conservan estadísticas y siguen en el catálogo del CRM).

## Pendiente de definir

1. Texto genérico del mensaje (ej. "Hola, quiero información sobre los cursos").
2. Usuario administrador creador de los enlaces.

## Verificación tras desplegar

1. `SELECT` en producción: 23 filas `ShortLink` con tag `mapa` y `catalogSedeId` no nulo.
2. Abrir `{APP_URL}/r/mapa-bertello`: redirige a WhatsApp con `ref:mapa-bertello · …` y suma un `LinkClick`.
3. Mensaje de prueba a un número conectado: el CRM lo muestra con origen enlace MALI ONE y la sede correcta.
4. Los enlaces aparecen bien en la lista del módulo Links (comprobar que `qrStyle` nulo no rompe la vista ni la descarga del QR).
5. En el mapa, clic en una sede con número propio y en Museo de Arte de Lima (número general).

## Fuera de alcance

- Sincronizar automáticamente número de sede ↔ enlace.
- Saludos distintos por sede.
- QR impresos para estos enlaces.
