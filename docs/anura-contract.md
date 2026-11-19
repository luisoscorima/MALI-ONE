# Contrato Anura → CRM Educación

Verificado en vivo contra `https://api.anura.com.pe` (2026-11-18), tenant MALI.

## Auth

### Poll / import CDRs (nosotros → Anura)

- Spike: `ANURA_REFRESH_TOKEN` + cliente panel `controlpanel-new` (SSO Perú).
- Access ~5 min; refresh de sesión ~20 días.
- Prod: preferir `client_id` / `client_secret` offline de Soporte Anura.

### Webhook (Anura → nosotros) — **no usa refresh token**

Anura empuja HTTP al CRM. Solo hace falta:

- URL pública HTTPS de ONE
- `ANURA_WEBHOOK_SECRET` (misma clave en panel: **Bearer** o **X-Hub-Signature HMAC SHA1**)

Doc Anura: [Webhooks](https://kb.anura.com.ar/es/articles/2579270-webhooks).

## Endpoint CDRs

`GET {ANURA_API_BASE}/GCAPI/rest/tenants/stats/cdrs/?startDate=YYYY-MM-DD HH:mm&endDate=…&filter=`

Respuesta: **array** de CDRs (no envuelto).

## Shape real (sample scrubbed)

```json
{
  "id": 178000854,
  "direction": "OUT",
  "status": "ANSWER",
  "calling": "200",
  "callingName": "Genesis-200",
  "called": "0051…831",
  "calledName": "PERU -  RESTO - MOVIL",
  "account": { "id": 29534, "name": "Genesis-200" },
  "dialTime": 1795047637319,
  "duration": 45,
  "billSeconds": 32,
  "wasRecorded": true,
  "routePriceTypeName": "LDN MOVIL",
  "lastAction": null,
  "price": 0.027
}
```

Claves observadas: `account`, `billSeconds`, `called`, `calledName`, `calling`, `callingName`, `dialTime`, `direction`, `duration`, `id`, `lastAction`, `price`, `routePriceTypeName`, `status`, `wasRecorded`.

## Cómo leerlo (humano)

| Campo Anura | Significado real |
|---|---|
| `calling` / `called` cortos (`108`, `200`) | **Ramal** interno |
| `account.name` / `callingName` (`Karol-108`) | **Asesor** (nombre + ramal). No es el lead. |
| `calledName` en OUT (`PERU - RESTO - MOVIL`) | Etiqueta de **ruta**, no persona |
| `called` / `calling` con `0051…` | Teléfono del lead (normalizar a `+51…`) |
| `billSeconds` | Segundos de **conversación** (preferir) |
| `duration` | Tiempo total (timbre + habla) |
| `status` | `ANSWER` / `CANCEL` / `NOANSWER` / `BUSY` / `CONGESTION` |
| `direction` | `OUT` saliente · `IN` entrante |

**El nombre del lead no viene en el CDR.** Se obtiene matcheando el teléfono contra `EducacionPerson` / contactos WA.

Frase objetivo UI: *«Karol llamó a Pepito (+5193…) · contestó · 32 s»*.

## Persistencia en ONE

`EducacionCrmActivity`:

- `externalSystem = anura`
- `externalRef = String(cdr.id)`
- `payload = CDR completo` (Json) → la UI puede armar columnas sin re-fetch
- `notes` = respaldo corto (`tel · agente · Ns`) para filas viejas
- `waCycleId` / `opportunityId` / `waContactId` por match de teléfono

## Observaciones del spike (24 h)

- ~500–1200 CDRs/día; mayoría `OUT`.
- Cuentas frecuentes: `Genesis-200`, `Karol-108`, `Kiara-103`, `Gilbert-102`, …
- `callingName` / `calledName` casi siempre presentes, pero **no** sustituyen ficha CRM.

## Modelo operativo: backfill API + webhook

1. **Backfill 24 h (API poll)** — llena la tabla de golpe (`importHours` / script). En prod 2026-11-18: **591 CDRs → 576 insertadas** (+8 previas = **584** Anura; 7 sin teléfono externo).
2. **Webhook END** — completa en tiempo real sin refresh token.
3. Idempotencia por `externalRef = cdr.id` (no duplica si llegan por ambos caminos).

El poll/import sigue siendo útil para reprocesar histórico; el día a día es webhook.

## Webhook → tabla CRM

### Endpoint ONE

`POST https://<host>/api/crm-educacion/webhooks/anura`  
Auth (una de las dos):

- `Authorization: Bearer <ANURA_WEBHOOK_SECRET>`
- o `X-Hub-Signature: sha1=<hmac>` (HMAC-SHA1 del body con la misma clave)

- Trigger recomendado: **END** + dirección **BOTH**
- START / TALK: se aceptan (`200`) pero **no** crean fila (aún no hay duración/estado final)
- Idempotencia: `externalRef = id` del CDR (o huella si falta id)

### Configurar en panel Anura

1. **CONFIGURACIÓN → Eventos → Agregar** (evento personalizado)
2. Petición:
   - Protocolo `HTTPS`, Host de ONE, Puerto `443`
   - Ruta: `api/crm-educacion/webhooks/anura` (sin `/` inicial, según doc Anura)
   - Método `POST`, contenido `JSON`
   - Auth: **Bearer** o **X-Hub-Signature (HMAC SHA1)** + **Clave** = `ANURA_WEBHOOK_SECRET`
     (si el panel no deja cambiar de X-Hub a Bearer, dejá X-Hub: ONE acepta ambos)
3. Cuerpo JSON (usar el predictivo del editor; nombres alineados al CDR):

```json
{
  "hook": "END",
  "id": "${id}",
  "direction": "${direction}",
  "status": "${status}",
  "calling": "${calling}",
  "called": "${called}",
  "callingName": "${callingName}",
  "calledName": "${calledName}",
  "accountName": "${accountName}",
  "dialTime": "${dialTime}",
  "duration": "${duration}",
  "billSeconds": "${billSeconds}",
  "wasRecorded": "${wasRecorded}",
  "routePriceTypeName": "${routePriceTypeName}",
  "lastAction": "${lastAction}",
  "price": "${price}"
}
```

> Los nombres exactos de variables salen del predictivo del panel. Si difieren (`account.name`, etc.), el receptor acepta alias (`accountName`, `origin`/`destination`, …) y guarda el JSON crudo en `payload`.

4. **Cuenta → Eventos → Agregar** trigger: Evento `END`, Dirección `BOTH`, plantilla anterior, Activo sí.  
   Repetir en cada cuenta de asesores (o la cuenta padre que dispare para todas).

### Prueba rápida

```bash
curl -sS -X POST "https://<host>/api/crm-educacion/webhooks/anura" \
  -H "Authorization: Bearer $ANURA_WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "hook":"END","id":999001,"direction":"OUT","status":"ANSWER",
    "calling":"108","called":"0051999999999","callingName":"Karol-108",
    "calledName":"PERU - RESTO - MOVIL","accountName":"Karol-108",
    "dialTime":1795047637319,"duration":45,"billSeconds":32
  }'
```

Respuesta típica: `{ "accepted": true, "stored": true|false, "reason"?, "summary via list recent" }`.  
`stored:false` + `unmatched` = teléfono sin ciclo/persona en CRM (igual que el import).
