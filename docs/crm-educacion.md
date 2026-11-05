# CRM Educación (crm-educacion)

> Changelog: [crm-educacion-CHANGELOG.md](./crm-educacion-CHANGELOG.md) · Índice: [README.md](./README.md)

## Qué es

Panel operativo de **contactos y oportunidades** de Educación (números WA EP/CA/Diseño). La captación entra por el widget de leads; la fuente de verdad de ciclos/estados/SLA es **mali-whatsapp**. MALI ONE orquesta UI, catálogo local de apoyo y sync.

## Cómo funciona

1. Widget `lead-form` → `POST /api/widgets/educacion/leads` → `EducacionLead` → sync origen WhatsApp (+ Sheets opcional).
2. CRM Educación lista contactos/leads/ciclos/SLA vía API WhatsApp (`education` scope).
3. Asesores cambian etapa, asignan, revisan; estados terminales cierran ciclo.
4. Catálogo de estados administrable desde [catalog-educacion.md](./catalog-educacion.md) (espejo hacia WA).

## Código

- `apps/api/src/modules/crm-educacion/`
- Leads widget: `apps/api/src/modules/widgets/educacion/educacion-leads*.ts`
- Cliente: `apps/api/src/modules/crm/whatsapp-crm-client.service.ts`
- Web: `crm-educacion-page.tsx`

## UI

| Ruta | Uso |
|------|-----|
| `/admin/crm-educacion` | Contactos, oportunidades, SLA, sync Prospectia |

## API

Prefijo `/api/crm-educacion`: contacts, leads, cycles, sla, catalogs, management, distribute, review, manual lead, prospectia sync/check.

## Datos (Prisma)

- `EducacionLead` (captación local + estado sync WA/Sheets)
- Ciclos/estados/SLA: mali-whatsapp
- Catálogo apoyo: modelos `EducacionCatalog*`

## Conexiones externas

| Sistema | Uso |
|---------|-----|
| **mali-whatsapp** | CRM educación, orígenes, SLA, estados |
| **Google Sheets** (opcional) | Espejo EP/CA/Diseño si `EDUCACION_LEADS_SHEETS_ENABLED` |
| **WordPress / landings** | Origen de captura del formulario |
| **Prospectia** | Sync/check endpoints |

## Variables de entorno

```env
WHATSAPP_CRM_BASE_URL=
WHATSAPP_CRM_SERVICE_TOKEN=
EDUCACION_LEADS_SHEETS_ENABLED=false
GOOGLE_SHEETS_LEADS_EP_ID=
GOOGLE_SHEETS_LEADS_TAB_EP=EP
GOOGLE_SHEETS_LEADS_CA_ID=
GOOGLE_SHEETS_LEADS_TAB_CA=CA
GOOGLE_SHEETS_LEADS_DISENO_ID=
GOOGLE_SHEETS_LEADS_TAB_DISENO=Diseno
```

## Permisos

Módulo: `crm_educacion`

## Relacionados

- [widgets.md](./widgets.md), [catalog-educacion.md](./catalog-educacion.md), [landings.md](./landings.md)

## Go-live y operación (leads)

# Leads Educación — go-live y apagado del Sheet

Widget `lead-form.html` → `POST /api/widgets/educacion/leads` → `EducacionLead` → MALI WhatsApp (+ Google Sheets opcional).

El widget es único para las fichas oficiales de WordPress y las landings. El
documento padre le entrega por `postMessage` la URL real, referrer, origen de
captura y atribución. Se aceptan estos campos:

- `captureSource`: `wordpress_widget` o `landing`.
- `utmSource`, `utmMedium`, `utmCampaign`, `utmContent`, `utmTerm`.
- `gclid`, `fbclid`, `pageUrl` y `referrer`.

Si una visita entra con atribución y navega antes de enviar, los valores se
conservan en `sessionStorage`. Una URL con una campaña nueva reemplaza la
atribución anterior de esa sesión. Después del alta, el widget abre el prefill
de WhatsApp; las UTMs quedan en MALI ONE y en el origen de MALI WhatsApp, no en
el texto visible del mensaje.

Estados del asesor y del ciclo: [Estados de lead](#estados-de-lead).

Backlog de requerimientos (Sheet → CRM, fases y RQs): [Requerimientos Educación](#requerimientos-educación--backlog-consolidado).

SLA 1.ª respuesta (promedio / % / por asesor): CRM Educación → pestaña **Oportunidades** (datos desde WhatsApp `GET /api/crm/education/sla`).

## Operación en CRM Educación

La pestaña **Oportunidades** trabaja sobre ciclos comerciales de MALI WhatsApp, no sobre captaciones sueltas:

- **Abiertas**: cartera activa.
- **Cerradas**: ciclos finalizados por un estado terminal.
- **Requieren revisión**: separa asesores retenidos por confirmar y conflictos comerciales de reingreso.
- **Sin asignar**: ciclos abiertos sin asesor responsable.

Desde la tabla se puede asignar o reasignar al asesor, confirmar al asesor retenido y cambiar la etapa comercial. Seleccionar un estado terminal cierra el ciclo. El curso o interés y el origen reciente se leen de la última captación asociada. La conversación continúa operándose en el inbox de MALI WhatsApp.

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
   - Plugin `mali-one-embed` ≥ 1.1.4 para atribución, eventos, caché de landings de 60 segundos y aislamiento de GSpeech (incluida la pantalla de landing no encontrada)
   - `MALI_ONE_URL` apunta al entorno correcto
   - Plantillas EP / cursos ya usan `[mali_lead_form]`
5. **Prueba E2E** (curso EP de prueba):
   - Enviar formulario «Conversemos»
   - Verificar fila en tabla `EducacionLead` (`waStatus=ok`)
   - Contacto en [whatsapp.mali.pe](https://whatsapp.mali.pe) área **Educación** con categoría **EP** (o CA), origen `channel=widget`; `source_key=educacion_lead_widget` para fichas o `source_key=educacion_landing` para landings
   - Confirmar en el payload del origen: curso, URL, `capture_source`, referrer, UTMs y click IDs presentes en la URL de prueba
   - Si Sheets está on: fila nueva en el rango configurado
   - Apagar Sheet a propósito (`ENABLED=false`) y confirmar que el submit sigue OK y WA sync funciona

## Apagar el espejo Sheet (cuando CRM Educación / WhatsApp baste)

```env
EDUCACION_LEADS_SHEETS_ENABLED=false
```

No hace falta cambiar el widget ni WordPress. Los leads nuevos solo irán a `EducacionLead` + WhatsApp.

## Área y categorías (contrato WhatsApp)

WhatsApp es fuente de verdad. **Área de ficha:** solo `educacion`. **Categoría:** `ca` | `ep` | general (`program_id` nulo). Los alias `educacion_ca` / `educacion_ep` en captura/embeds se traducen a categoría; no son tenants.

CRM Educación en MALI ONE es **vitrina**: lista y opera con `area=educacion` y filtro de categoría (`all` | `general` | `ca` | `ep`).

| Contexto WordPress | Categoría | Notas |
|--------------------|-----------|--------|
| Extensión Profesional (`extensionprofesional`) | `ep` | Captura widget/landing aún puede enviar alias legacy; WhatsApp normaliza |
| Cursos de Arte (`curso-de-arte`) | `ca` | Igual |
| Educación genérica / sin programa | general | Línea o form sin `program_key` |


## Estados de lead

# Estados de lead — Educación

El asesor elige **una** etapa. Cada paso del camino significa más cerca de la inscripción. Al lado, el sistema podrá marcar si la llegada cuenta como captación nueva; esa marca no se elige a mano.

Catálogo en WhatsApp (`lead_status_definitions`) bajo el área canónica **`educacion`**. CA/EP son **categorías** del ciclo, no áreas. El selector está en **CRM Educación** de MALI ONE (Contactos y Oportunidades), agrupado en Inscripción e Intento o cierre.

La administración del catálogo está en **MALI ONE → Catálogo Educación → Estados de lead**. Desde allí se crean, renombran y ordenan estados, se define el inicial o terminal y se desactivan/reactivan. WhatsApp continúa siendo la fuente de verdad. Desactivar reemplaza a eliminar para conservar los ciclos históricos.

Definición: `EDUCATION_LEAD_STATUSES` en mali-whatsapp (`api/src/leads/leads.types.ts`). PAM, TI y Patronato no usan este catálogo.

## Camino de inscripción

| Orden | Estado | Slug | Qué significa |
|------:|--------|------|----------------|
| 1 | Por contactar | `por_contactar` | Llegó y nadie ha hecho el primer intento. Es el estado inicial. |
| 2 | Contactado | `contactado` | El asesor ya escribió o llamó. |
| 3 | Evaluando | `evaluando` | La persona respondió y está mirando curso, horario o precio. |
| 4 | Promesa | `promesa` | Hay una fecha concreta de pago o inscripción. |
| 5 | Venta exitosa | `venta_exitosa` | Se inscribió. El ciclo se cierra. |

## Intento o cierre

Desde Contactado el ciclo puede desviarse. Eso no adelanta la inscripción.

| Estado | Slug | Ciclo | Qué significa |
|--------|------|-------|----------------|
| No contesta | `no_contesta` | Sigue abierto | Hubo intento y no hubo respuesta. Se reintenta. Si responde, pasa a Evaluando. Si se agotan los intentos, cierra en Perdido. |
| No interesado | `no_interesado` | Cierra | Dijo que no. |
| Perdido | `perdido` | Cierra | Se cierra sin venta. Lleva un motivo: no contestó más, promesa vencida, dejó de responder o dato inválido. |

Promesa exige fecha. Si esa fecha pasa, el ciclo cierra en Perdido con motivo «promesa vencida».

## Marcas del sistema

El asesor no las elige. Van junto a cualquier etapa.

| Marca | Cuándo |
|-------|--------|
| Nuevo | La captación abre ciclo: otro curso, o el mismo curso ya fuera de la ventana. |
| Duplicado | Mismo número y mismo curso, dentro de la ventana. No abre otro ciclo. |
| Retorno | Reaparece alguien que estaba en No interesado. Ese contacto se excluye de un masivo de la misma promo. |
| Prometió antes | Vuelve después de una promesa vencida. El ciclo nuevo arranca en Por contactar. |

La ventana de trabajo es de **60 días** desde el último mensaje del cliente. Una venta recién cerrada no abre otro ciclo sola: queda en revisión. Pasada la ventana, sí abre ciclo nuevo.

## Catálogo anterior

Los leads ya etiquetados se movieron así. Las etiquetas viejas quedan inactivas y no salen en el selector.

| Antes | Ahora |
|-------|--------|
| Nuevo | Por contactar |
| Contactado | Contactado |
| Calificado | Evaluando |
| Convertido | Venta exitosa |
| Perdido | Perdido |

Migración: `20260928120000_education_lead_statuses` en mali-whatsapp. Al abrir CRM Educación el API también deja el catálogo al día.

## Qué ya hace el sistema

- Las ocho etiquetas viven en el área `educacion` y se asignan desde CRM Educación (filtro de categoría CA/EP/General aparte).
- Por contactar es el estado por defecto de un contacto nuevo.
- No contesta no cierra el ciclo. No interesado, Perdido y Venta exitosa sí (`is_terminal`).
- **RQ0017:** no se puede pasar a Venta exitosa (ni legacy Convertido) sin nombre usable, DNI, email, teléfono o identidad WhatsApp, y categoría CA/EP del ciclo. Si faltan datos, el ciclo se queda en el estado anterior; en CRM Educación aparece un diálogo para completar y reintentar.

Todavía no están solas la fecha de Promesa, el motivo de Perdido, ni las marcas Nuevo, Duplicado, Retorno y Prometió antes. Mientras tanto, un reingreso se clasifica con la regla de 60 días que ya corre en WhatsApp: Venta exitosa va a revisión; No interesado dentro de la ventana también; el resto, dentro de la ventana, sigue en el mismo ciclo.

## Requerimientos Educación — backlog (consolidado)

Backlog de negocio ordenado a partir del sheet de RQs (jul–oct 2026). Traduce el lenguaje de hojas Condensado / BBDD 2026 al modelo actual: **WhatsApp guarda y decide; MALI ONE muestra y opera.**

Documentos vivos del producto:

- Modelo y operación (fuente de verdad): `mali-whatsapp/docs/LEADS.md`

Fecha de corte de este ordenamiento: **4 nov 2026**. Las fechas de fase del plan original (30/10, 6/11, 13/11) ya vencieron → **prioridad efectiva Alta** salvo las explícitamente Baja con horizonte 30/11.

---

## 0. Cómo leer este documento

| Sección | Para qué |
|---------|----------|
| §1 Glosario | Equivalencia Sheet → CRM |
| §2 Legacy Sheets | Pedidos que no se recrean en el CRM |
| §3 Gap corto | Qué ya existe vs qué falta |
| §4 Backlog por dominio | Requerimientos claros, mejorados donde hace falta |
| §5 Roadmap | Fases, vencidos y prioridad efectiva |
| §6 Índice RQ | RQ0001–RQ0029 → sección y estado |
| §7 Fuera de producto | SIGE / Niubiz y dependencias externas |

Cada ítem del §4 lleva: **objetivo**, **regla**, **app**, **RQ**, **fase**, **prioridad efectiva**, **estado**.

Estados usados aquí:

| Estado | Significado |
|--------|-------------|
| Legacy | Pedido de Sheets; no es trabajo CRM (o ya se resolvió fuera) |
| Implementado | Cubierto por MALI ONE + WhatsApp (o equivalente) |
| En desarrollo | Parcialmente en código / operación |
| Registrado | Pedido claro pendiente de construir |
| Externo | Otro sistema (SIGE, Caja/boleteo fuera del ciclo lead, etc.) |

---

## 1. Glosario (Sheet → sistema actual)

| Antes (Sheet / lenguaje RQ) | Ahora (MALI ONE + WhatsApp) |
|-----------------------------|-----------------------------|
| Sheet 1 / ingreso bruto / “todas las hojas” | Orígenes (`contact_origins`) + entradas (`education_lead_entries`) |
| Condensado / BBDD 2026 | Vista consolidada de captaciones (Hub Leads / Historial); no hay una hoja Condensado en ONE |
| Consolidado limpio / base final | Ciclos asignables (`education_lead_cycles`) + Oportunidades en CRM Educación |
| Hoja del asesor | Cartera del asesor: Oportunidades abiertas + inbox WhatsApp |
| Hoja CONFLICTO | Oportunidades → **Requieren revisión** (reingresos / conflictos) |
| Traslado / derivar base | Asignar o repartir ciclo (`distribute` / gestión en CRM) |
| Estado Condensado / estado asesor | Etapa del ciclo (`por_contactar` … `venta_exitosa`, etc.) |
| Lead “nuevo” vs “duplicado” (manual) | Clasificación de sistema: `new` / `duplicate` / `conflict` / `reassignable` (ventana 60 días) |
| Solo info Meta sin WhatsApp | Canal Instant Form / TikTok + etiqueta **Solo contacto** (`came_with_inbound` = no) |
| ProspectIA como medio | Match post-captación; puede copiar asesor si aplica; no es un CRM paralelo |
| FUENTE = META / ORGÁNICO / RRSS | Canal de origen + categoría CA/EP/General (no “campaña” como fuente) |
| “Área” CA / EP / tres números | **Categoría** dentro del área única `educacion` (ficha canónica) |

**No se pide** recrear Condensado, hojas por asesora ni Apps Script dentro de MALI ONE.

**Límite de sistemas:** mali-whatsapp guarda personas, fichas, leads, ciclos y chat. MALI ONE muestra y opera (CRM Educación) y es dueño de producto/pagos/mailing/captura web; no mantiene BD paralela de leads.

---

## 2. Qué ya no se pide al CRM (legacy Sheets)

Estos RQs hablan de copiar filas entre hojas. El flujo operativo ya es **widget / Meta / TikTok / orgánico → EducacionLead o WhatsApp → CRM Educación**. El espejo Sheet es opcional y se puede apagar ([Go-live y operación (leads)](#go-live-y-operación-leads)).

| RQ | Pedido original | Lectura actual |
|----|-----------------|----------------|
| **RQ0001** | Botón Sheet1 → Sheet2, copia a BBDD asesores | Legacy. Equivalente: captación → entrada/ciclo → asignación en CRM. **No recrear en CRM.** |
| **RQ0002** | Asesor coloca N° de registro y se lleva el lead a su hoja | Legacy. Equivalente: ownership en el **ciclo** del asesor. |
| **RQ0003** | Jalar estado VENTA del Sheet2 al Sheet3 | Legacy. Equivalente: etapa `venta_exitosa` (y posteriores de boleteo si aplica) en el ciclo. |
| **RQ0004** | Módulo Web → Sheet y a la vez MALI One | **Implementado** vía widget → `EducacionLead` → sync WhatsApp. Sheet solo espejo opcional. |

Comentario de negocio (“esto es lo que se hace manual… no tiene nada que ver con el CRM”) se respeta: **no son épicas de producto CRM**.

---

## 3. Capacidad actual vs pedido (gap corto)

| Tema | Ya existe | Gap / pedido pendiente |
|------|-----------|------------------------|
| Captación multi-fuente | Meta, CTWA, TikTok, widget, botones, links/QR, orgánico, import | Consolidar narrativa “Prospectia orgánico” y reportería única |
| Duplicados / 60 días | Clasificación `new` / `duplicate` / `conflict` / revisión | Falso duplicado (cambio de dígito), fusión de contactos, alerta explícita |
| Estados asesor | 8 estados Educación en ONE + WhatsApp | Marcas sistema (Nuevo/Duplicado/Retorno), REMARKETING, estados Caja OBS/BOLETEADO |
| Asignación | Ciclo + distribute + revisión | Reclamo formal con constancia; notificación 3 días sin gestión; reasignación manual supervisada |
| Contactabilidad WA | Canal + Solo contacto / con chat | Filtros/listas para “atacar por llamada”; claridad Meta sin viaje a chat |
| SLA 10 min | Timestamps (`first_human_reply_at`, etc.) | Motor SLA + alertas + horario de atención + reporte cumplimiento |
| Alta manual asesor | Formulario ONE → `POST .../leads/manual` + 409 `already_exists` | Merge fuerte A+B sigue en Admin conflictos; editar teléfono en ficha |
| Carga masiva | Canal `import` | Plantilla + reporte aceptados/duplicados/errores con mismas reglas |
| Venta / Caja | Candado RQ0017 a `venta_exitosa` (nombre, DNI, email, tel/WA, categoría) | Flujo OBS / boleteado (RQ0018), permisos Caja |
| Correos / KPIs / comisiones / roles | Parcial o nulo | Ver §4 |

---

## 4. Backlog por dominio

### 4.1 Captación y consolidado

#### RQ0007 — Consolidación de leads totales

- **Objetivo:** Una vista de todos los leads brutos sin filtrar por “solo pauta” o “solo web”.
- **Regla:** Incluir META, TikTok, Web (widget/botones), QR/links MALI ONE, C2C Wsp, orgánicos (presencial, Noche MALI, ingreso manual) y lo que aporte Prospectia como medio de ingreso. Pestaña conceptual: **Leads / Historial** (orígenes + entradas).
- **App:** Ambos (WhatsApp fuente; ONE vitrina).
- **Fase / prioridad efectiva:** Alta (base del CRM) · **Estado:** Implementado en gran parte; falta cerrar narrativa Prospectia y orgánicos no pautados.

#### RQ0008 — Consolidado bruto (data tal cual)

- **Objetivo:** Base uniforme para estadística: afluencia, estados previos y finales.
- **Regla (columnas mínimas homologadas):** ID, Fecha, FUENTE (META / ORGÁNICO / canal concreto; **no** sustituir fuente por nombre de campaña), curso/programa, nombre, correo, teléfono, estado de clasificación (`nuevo` / `duplicado` / `proceso` u equivalentes de sistema). Se actualiza cuando cambian etapa o etiquetas por llamada o WhatsApp. Debe reflejar también altas manuales de asesores (antes “sus hojas”).
- **App:** Ambos.
- **Fase / prioridad efectiva:** Alta · **Estado:** En desarrollo (Hub + entradas; no recrear hoja Condensado).

#### RQ0011 — Consolidado limpio / vista asesor

- **Objetivo:** El asesor solo ve clientes que puede atender, con datos completos, sin adivinar de dónde vienen.
- **Regla:** Tras validación (§4.2), el ciclo asignado es la vista limpia. Si el asesor guarda/ingresa un lead, el sistema **valida** teléfono/identidad contra el bruto; si ya existía por otro medio, **trae la ficha completa** y no lo crea como nuevo.
- **App:** Ambos.
- **Fase / prioridad efectiva:** Alta · **Estado:** En desarrollo.

#### RQ0028 — Carga masiva con reglas

- **Objetivo:** Importar bases (pauta, pendientes) sin ensuciar el consolidado.
- **Regla:** Plantilla con columnas homologadas (ID, fecha, fuente, curso, nombre, correo, teléfono). Cada fila pasa por las mismas reglas de RQ0009. Reporte: aceptados / duplicados / errores.
- **App:** Preferente MALI ONE (operación) + WhatsApp (persistencia).
- **Fase:** 1 · **Prioridad efectiva:** Alta (vencida 30/10) · **Estado:** Registrado.

---

### 4.2 Validación, duplicados y falso duplicado

#### RQ0009 — Validación antes del limpio

- **Objetivo:** Filtrar lo que el asesor no debe contactar (troll, prueba, duplicado en atención, no quiere atención).
- **Regla:** Etapa intermedia entre bruto y limpio: reglas de validación; lo descartado no llega a cartera asignable (sí puede quedar como historial/conflicto según caso).
- **App:** Ambos.
- **Fase / prioridad efectiva:** Alta · **Estado:** En desarrollo (ventana 60 días + conflictos; faltan reglas “troll/prueba” explícitas).

#### RQ0015 — Consistencia cartera ↔ consolidado + falso duplicado + fusión

- **Objetivo:** Una sola persona/cartera; alta de históricos / solo-llamada / orgánico sin chat desde el panel, sin doble ficha.
- **Regla (implementada):**
  1. Alta manual **solo en MALI ONE** (`Registrar lead`) → WhatsApp `POST /api/crm/education/leads/manual`.
  2. Canal `other` + `source_key` `manual_call` | `manual_historical` | `manual_organic`; categoría CA/EP.
  3. Si ya hay ficha Educación por teléfono/DNI/email → `409 already_exists` + datos del existente; **no** crea otro lead.
  4. Inbox WhatsApp **no** crea leads. Merge fuerte A+B sigue en Admin conflictos; cambio de número en ficha + merge complementario automático si aplica.
- **App:** ONE (formulario) + WhatsApp (motor).
- **Fase:** 1 · **Prioridad efectiva:** Alta · **Estado:** Implementado (núcleo). Pendiente: fusión UI explícita y alertas supervisor en reintentos.

---

### 4.3 Estados transversales

#### RQ0010 — Estados de leads transversales

- **Objetivo:** Misma lectura en apps y en la data trazada.
- **Regla:** Un solo catálogo sincronizado (hoy: camino inscripción + intento/cierre en [Estados de lead](#estados-de-lead)). No inventar un segundo set “tipo Sheet”. Completar marcas de sistema (Nuevo, Duplicado, Retorno, Prometió antes) cuando el producto las exponga.
- **App:** Ambos.
- **Fase:** 3 · **Prioridad efectiva:** Alta (vencida 13/11) · **Estado:** En desarrollo (8 estados vivos; marcas sistema pendientes).

#### RQ0022 — Estado / etiqueta REMARKETING

- **Objetivo:** Medir remarketing sin perder fuente original ni inflar leads nuevos.
- **Regla:** Distinto de **Reactivación interna** (ingreso manual del asesor) y **Reactivación externa** (vuelve por pauta). Se marca REMARKETING si pide info de nuevo fuera del mes, o con conversación activa (~15 días). Conserva fuente e historial. **Solo el sistema** la asigna.
- **App:** Ambos.
- **Fase:** 2 · **Prioridad efectiva:** Alta (vencida 6/11) · **Estado:** Registrado.

---

### 4.4 Asignación, reclamo y reasignación

#### RQ0012 — Asignación de asesores

- **Objetivo:** Leads ↔ agentes sin cruces ni horas hombre de copiar filas.
- **Regla:** Asignación/reparto sobre el ciclo. El asesor también puede ingresar orgánicos o vía Prospectia; el sistema valida y asigna. Reasignación casi automática en reglas de producto; excepciones a revisión.
- **App:** Ambos.
- **Fase / prioridad efectiva:** Alta · **Estado:** En desarrollo.

#### RQ0013 — Reclamar propiedad de lead

- **Objetivo:** Constancia de reclamo de venta/atención; decide el supervisor.
- **Regla:** Asesor que ingresa un lead “nuevo” y pasa filtros: se le permite **una vez** en su vista. Queda constancia en **conflicto/revisión**. El supervisor valida y puede transferir el lead **original** al asesor correspondiente. El intento “duplicado” de reclamo queda como historial de conflicto; **no** vuelve a bruto ni a limpio como lead nuevo.
- **App:** Ambos (revisión en ONE; ownership en WhatsApp).
- **Fase / prioridad efectiva:** Alta · **Estado:** Registrado / parcial (existe review de entradas; falta flujo “reclamo de venta” con constancia explícita).

#### RQ0016 — Reasignación a los 3 días (manual)

- **Objetivo:** Que los leads no se estanquen sin gestión.
- **Regla:** **No es automático.** Notificar base de leads no tocados en 3 días. Supervisor/coordinador reasigna a mano. Historial por movimiento: fecha, hora, tipo **IN** (enviado a asesor) / **OUT** (quitado).
- **App:** Ambos.
- **Fase:** 2 · **Prioridad efectiva:** Alta (vencida) · **Estado:** Registrado.

---

### 4.5 Tiempo de atención y SLA

#### RQ0020 — SLA de primera respuesta

- **Objetivo:** Meta de **10 minutos** de primera respuesta; detectar desatendidos a tiempo.
- **Regla:** Solo dentro de horario: L–V 08:30–20:00; sáb 08:30–18:00; dom 09:00–18:00. Si se supera: alerta a asesor y supervisor. Reporte de cumplimiento por asesor y por área (CA, EP).
- **App:** Ambos (métrica en WhatsApp; alertas/reportes en ONE o Hub).
- **Fase:** (sin fase en sheet; tratar con F1 por criticidad) · **Prioridad efectiva:** Alta · **Estado:** Motor + alertas en WhatsApp; KPI en CRM Educación (MALI ONE).

#### RQ0021 — Reportería unificada de chats por área

- **Objetivo:** Un solo reporte (Educación / CA / EP) para no bajar tres veces y alimentar el SLA.
- **Regla:** Filtro por categoría y rango de fechas; promedio de 1.ª respuesta, % ≤ 10 min, por asesor. Sheets/Looker fuera. Vitrina principal: **MALI ONE → CRM Educación → Oportunidades**. Espejo operativo en WhatsApp Reportería.
- **App:** Ambos.
- **Fase:** 1 · **Prioridad efectiva:** Alta (vencida) · **Estado:** Implementado (motor WA + bloque SLA en ONE).

---

### 4.6 Contactabilidad WhatsApp y llamada

#### RQ0006 — Detectar leads sin contacto Wsp

Dos filas del sheet, un solo requerimiento de producto:

| Origen del pedido | Qué detectar |
|-------------------|--------------|
| Web / MALI One | Llegó por web y **no** inició conversación WhatsApp |
| Meta / Prospectia | Llegó con datos (Instant Form u otro) y **no** viajó a chat |

- **Objetivo:** Atacar con **llamadas u otros medios** a quienes no tuvieron interacción WA inicial.
- **Regla:** Usar el eje ya existente **Solo contacto** vs **con chat** (no confundir con el canal de captación). Listas/filtros operativos en CRM + WhatsApp para TMK/llamada.
- **App:** Ambos.
- **Fase / prioridad efectiva:** Alta · **Estado:** Implementado en señal (`came_with_inbound`); falta empaquetar como vista/ataque “sin WA”.

---

### 4.7 Calidad de venta y flujo Caja

#### RQ0017 — Controles para pasar a VENTA EXITOSA

- **Objetivo:** No cerrar ventas con datos incompletos; CRM actualizado.
- **Regla (implementada):** Candado en `updateManagement` solo al pasar a `venta_exitosa` / `convertido`. Obligatorios: nombre usable, DNI, email, teléfono o identidad WA, categoría del ciclo. Si falta algo → `400 missing_fields`; el estado **no** cambia. En ONE: diálogo para completar y reintentar, o cancelar y quedarse. Factura / Caja fuera de este RQ (RQ0018).
- **App:** Ambos.
- **Fase:** 1 · **Prioridad efectiva:** Alta · **Estado:** Implementado.

#### RQ0018 — Observaciones de Caja: PROCESO-OBS → BOLETEADO

- **Objetivo:** Subsanar errores antes del comprobante.
- **Regla:**
  1. Caja observa venta exitosa → estado **PROCESO - OBS** + observación resaltada.
  2. Asesor no cambia estado hasta subsanar → **PROCESO - OBS PEND. DE VALIDACIÓN - ASESOR**.
  3. Caja valida → **BOLETEADO** (final). Si mal corregido → vuelve a PROCESO - OBS; alerta a coordinador; solo coordinador desbloquea en ese caso.
  4. Alertas a supervisor y agente en cada tramo relevante.
- **App:** MALI ONE (venta/caja) + reflejo de etapa en ciclo WhatsApp.
- **Fase:** 2 · **Prioridad efectiva:** Alta (vencida) · **Estado:** Registrado. *Nota:* estos estados son de **post-venta/boleteo**, no del catálogo corto de inscripción; hay que extender catálogo o subflujo sin romper los 8 estados actuales.

---

### 4.8 Comunicación y recordatorios

#### RQ0019a — Secuencia de correos a agentes

- **Objetivo:** Reducir seguimientos olvidados.
- **Regla:** Disparador por estado o fecha; si no hay gestión en X días, siguiente correo. Se detiene cuando el prospecto responde o el agente registra gestión.
- **App:** ONE / Comunicaciones (dependencia).
- **Fase:** 1 · **Prioridad efectiva:** Alta (vencida; en sheet era Baja de fase → por vencimiento se eleva en roadmap F1) · **Estado:** Registrado. *En el sheet original: Baja; en tabla de fases F1 Baja → 30/11. Aquí: mantener Baja de negocio salvo decisión contraria; ver §5.*

#### RQ0019b — Secuencia de correos a prospectos + bandeja

- **Objetivo:** Contactabilidad y recordatorios al prospecto; bandeja asesor leído/no leído.
- **Regla:** Disparadores por disposición de comunicaciones; cumpleaños u ofertas en campaña. Coordinar con Comunicaciones.
- **App:** ONE / Comunicaciones.
- **Fase:** 2 · **Prioridad efectiva:** según §5 (Baja 30/11 o Media F2) · **Estado:** Registrado.

---

### 4.9 Reportería, KPIs y comisiones

#### RQ0024 — Dashboard de KPIs comerciales

- **Objetivo:** Embudo y conversión por fuente, inversión vs rentabilidad, cuartiles por asesor.
- **Regla:** Números macro + detalle TMK (campo MOTIVO). Filtros: categoría CA/EP/General, asesor, fuente, fecha.
- **App:** ONE (tablero) consumiendo WhatsApp.
- **Fase:** 3 · **Prioridad efectiva:** Alta (vencida 13/11) · **Estado:** Registrado.

#### RQ0026 — Liquidación automática de comisiones

- **Objetivo:** Menos trabajo manual y errores en liquidación mensual.
- **Regla:** Si vende en CA y EP, se suman contra **una** meta de S/ 30,000. Solo ventas con estado final **BOLETEADO**.
- **App:** ONE.
- **Fase:** 3 · **Prioridad efectiva:** Alta (vencida) · **Estado:** Registrado.

---

### 4.10 Gobernanza

#### RQ0027 — Roles, permisos y auditoría

- **Objetivo:** Trazabilidad de estados, asignaciones y datos de venta.
- **Regla:** Roles: asesor, supervisor, coordinador, Caja, administrador. Permisos de ver/editar/aprobar. Bitácora: usuario, fecha/hora, campo, valor anterior y nuevo.
- **App:** Ambos.
- **Fase:** Por definir · **Prioridad efectiva:** Media · **Estado:** Registrado.

#### RQ0029 — Cruce de ventas / atención multi-agente

- **Objetivo:** Evitar cruces cuando el mismo cliente deja interés en varios cursos y cae a distintos agentes.
- **Regla:** Alerta de posible cruce; no silenciar el conflicto. Resolución por supervisor.
- **App:** Ambos.
- **Fase:** 3 · **Prioridad efectiva:** Baja de negocio → en F3 Baja; por vencimiento de F3 tratar revisión, no bloquear núcleo · **Estado:** Registrado.

---

## 5. Roadmap por fase / prioridad (con vencidos)

Regla operativa acordada: **fecha de fase vencida → tratar el bloque como Alta** para priorizar trabajo, sin borrar la fase ni la prioridad de negocio original.

| Fase | Objetivo original | Situación al 4/11/2026 | Prioridad efectiva |
|------|-------------------|------------------------|--------------------|
| **1** | 30/10/2026 | Vencida | **Alta** |
| **2** | 6/11/2026 | Vencida | **Alta** |
| **3** | 13/11/2026 | Vencida | **Alta** (después de cerrar F1/F2) |
| Bajas 30/11 | 30/11/2026 | Aún no | **Baja** (salvo que negocio eleve) |

### Fase 1 — núcleo de limpieza y SLA (vencida → Alta)

| RQ | Tema | Prioridad negocio | Notas |
|----|------|-------------------|-------|
| RQ0015 | Alta manual ONE + already_exists | Alta | Núcleo implementado |
| RQ0017 | Controles → venta exitosa | Alta | Implementado |
| RQ0021 | Reportería unificada chats / SLA | Alta | Alimenta RQ0020 |
| RQ0028 | Carga masiva con reglas | Media | Misma validación que alta unitaria |
| RQ0019a | Correos a agentes | Baja (F1) | Horizonte 30/11 si se respeta Baja |

**Relacionado sin número de fase en sheet:** RQ0020 (SLA 10 min) — ejecutar junto a RQ0021.

### Fase 2 — gestión viva y post-venta (vencida → Alta)

| RQ | Tema | Prioridad negocio |
|----|------|-------------------|
| RQ0016 | Alerta 3 días + reasignación manual | Media |
| RQ0018 | Flujo Caja OBS → boleteado | Media |
| RQ0022 | REMARKETING | Alta |
| RQ0019b | Correos prospectos + bandeja | Baja |

### Fase 3 — medición y money (vencida → Alta relativa)

| RQ | Tema | Prioridad negocio |
|----|------|-------------------|
| RQ0010 | Cierre estados transversales / marcas | Alta |
| RQ0024 | Dashboard KPIs | Media |
| RQ0026 | Comisiones | Media |
| RQ0029 | Cruce multi-agente | Baja |

### Continuo (ya en curso o base)

RQ0006 (vista sin WA), RQ0007–0012 (consolidado, validación, asignación), RQ0013 (reclamo).

### No priorizar como CRM

RQ0001–0004 (legacy Sheets). RQ0005 → §7.

---

## 6. Índice RQ → sección

| RQ | Título corto | Sección | Estado |
|----|--------------|---------|--------|
| RQ0001 | Copia Sheet1 → Sheet2 | §2 Legacy | Legacy |
| RQ0002 | Ingreso N° en hoja asesor | §2 Legacy | Legacy |
| RQ0003 | Estado Condensado → ventas | §2 Legacy | Legacy |
| RQ0004 | Módulo Web → Sheet + ONE | §2 Legacy | Implementado (vía widget/CRM) |
| RQ0005 | Pago Niubiz → SIGE | §7 Externo | Registrado / Externo |
| RQ0006 | Leads sin contacto Wsp | §4.6 | Señal Implementada; vista Registrada |
| RQ0007 | Consolidación totals | §4.1 | Implementado (parcial Prospectia) |
| RQ0008 | Consolidado bruto | §4.1 | En desarrollo |
| RQ0009 | Validación duplicados | §4.2 | En desarrollo |
| RQ0010 | Estados transversales | §4.3 | En desarrollo |
| RQ0011 | Consolidado limpio | §4.1 | En desarrollo |
| RQ0012 | Asignación asesores | §4.4 | En desarrollo |
| RQ0013 | Reclamar propiedad | §4.4 | Registrado (review parcial) |
| RQ0014 | — | — | *No vino en el sheet* |
| RQ0015 | Alta manual + already_exists | §4.2 | Implementado (núcleo) · F1 |
| RQ0016 | Reasignación 3 días | §4.4 | Registrado · F2 |
| RQ0017 | Controles venta exitosa | §4.7 | Implementado · F1 |
| RQ0018 | Flujo Caja OBS | §4.7 | Registrado · F2 |
| RQ0019a | Correos agentes | §4.8 | Registrado · F1 |
| RQ0019b | Correos prospectos | §4.8 | Registrado · F2 |
| RQ0020 | SLA 10 min | §4.5 | Motor + alertas WA; KPI en ONE |
| RQ0021 | Reportería unificada / SLA | §4.5 | Implementado (ONE Oportunidades + WA Reportería) · F1 |
| RQ0022 | REMARKETING | §4.3 | Registrado · F2 |
| RQ0023 | — | — | *No vino en el sheet* |
| RQ0024 | Dashboard KPIs | §4.9 | Registrado · F3 |
| RQ0025 | — | — | *No vino en el sheet* |
| RQ0026 | Comisiones | §4.9 | Registrado · F3 |
| RQ0027 | Roles y auditoría | §4.10 | Registrado |
| RQ0028 | Carga masiva | §4.1 | Registrado · F1 |
| RQ0029 | Cruce ventas | §4.10 | Registrado · F3 |

---

## 7. Fuera de este producto / dependencias externas

### RQ0005 — Proceso de pago Niubiz dirigido a SIGE

- **Pedido:** Link compartible con datos de cliente prellenados → pasarela → reflejo en SIGE; agilizar boleteo.
- **Lectura:** No es ciclo de lead ni consolidado CRM. Vive en **SIGE / web de pago / Tesorería**.
- **Estado:** Registrado · Prioridad negocio Baja · Responsable original: SIGE.
- **Dependencia posible con leads:** solo si se quiere deep-link desde una oportunidad `venta_exitosa` / boleteo; eso se define aparte.

### Otras dependencias

| Tema | Depende de |
|------|------------|
| Correos RQ0019 | Módulo Comunicaciones / plantillas |
| Boleteo RQ0018 / comisiones RQ0026 | Caja + definición de estado BOLETEADO |
| Prospectia en RQ0006/0007 | Contrato/API Prospectia estable |
| Sheet espejo | Flag `EDUCACION_LEADS_SHEETS_ENABLED` — apagar cuando el CRM baste |

---

## Resumen ejecutivo

1. **Sheets RQ0001–0004** no se implementan como CRM: el producto ya cubre captura, ownership y etapa.
2. El núcleo pendiente de valor es **integridad (0015, 0009, 0011)**, **tiempo de atención (0020–0021)**, **reclamo/reasignación (0013, 0016)** y **contactabilidad sin WA (0006)**.
3. Post-venta (**0017–0018**), **REMARKETING (0022)** y **money/KPIs (0024, 0026)** siguen en fases 1–3, todas con fechas vencidas → priorizar en ese orden de fase.
4. **SIGE/Niubiz (0005)** queda fuera del backlog de leads.
)
