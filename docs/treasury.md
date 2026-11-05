# Verificación de pagos (treasury)

> Changelog: [treasury-CHANGELOG.md](./treasury-CHANGELOG.md) · Índice: [README.md](./README.md)

## Qué es

**Fuentes** (portales: Niubiz, BCP, …) y **pagos Niubiz** (import XLSX y sync API), con UI Fuente → operaciones y acciones en modales. Targets CRUD solo para fuentes sin conector. Módulo independiente de PAM. Objetivo: guardar/mostrar ventas Niubiz en horario America/Lima; conciliación bancaria fuera de alcance actual.

## Código

- `apps/api/src/modules/treasury/` — `treasury.controller.ts`, `treasury.service.ts`, `treasury-payments.service.ts`, `niubiz-sync.service.ts`, `niubiz-import.ts`, `niubiz-merchants.json`
- Runtime login: `scripts/niubiz-runtime/`
- Web: `treasury-page.tsx`, `treasury-payments.tsx`, `niubiz-sync.tsx`

## UI

| Ruta | Uso |
|------|-----|
| `/treasury` | Finanzas → Verificación de pagos |

## API

| Método | Ruta | Uso |
|--------|------|-----|
| GET/POST/PUT | `/api/treasury`, `sources`, `targets` | Inventario |
| GET | `/api/treasury/payments` | Listado + filtros + `q` |
| POST | `/api/treasury/payments/import-niubiz` | Import XLSX |
| GET/POST | `/api/treasury/niubiz/status`, `niubiz/sync` | Sync API |

## Datos (Prisma)

- `TreasurySource`, `TreasuryTarget`
- `TreasuryPayment` (incl. email / tarjeta enmascarada / billetera), `TreasuryPaymentImport`
- `NiubizSyncState`

## Conexiones externas

| Sistema | Uso |
|---------|-----|
| **Vaultwarden** | Usuario/password Niubiz vía CLI Bitwarden 2026.6.0 + Node 24 |
| **Niubiz Comercio** | Login web + API export órdenes |
| **Chromium/Playwright** | Automatización login en imagen API |
| **PostgreSQL** | Pagos + locks distribuidos de sync |

## Variables de entorno

```env
NIUBIZ_SYNC_ENABLED=false
FINANCE_VAULT_URL=https://vault.mali.pe
FINANCE_VAULT_CLIENT_ID=
FINANCE_VAULT_CLIENT_SECRET=
FINANCE_VAULT_MASTER_PASSWORD=
# Opcional: solo fallback si la fuente Niubiz no tiene vaultItemId en UI.
# FINANCE_VAULT_NIUBIZ_ITEM_ID=
```

Acceso a la bóveda (URL + API key + master) permanece en `.env`. El UUID del ítem de cada portal vive en la fuente (`TreasurySource.vaultItemId`), editable en UI. **Nunca** `VITE_*` para secretos Niubiz.

## Permisos

Módulo: `treasury`

## Relacionados

- [password-vault.md](./password-vault.md)
- [plataforma.md](./plataforma.md)

## Diseño y operación (consolidado)

## Estado actual: conector API + Vaultwarden preparado (4 de noviembre de 2026)

La implementación actual incluye extracción API de los 77 comercios, login con credenciales de Vaultwarden, persistencia, renovación de sesión, ejecución manual desde MALI ONE y cron cada dos horas desactivado por defecto. Ver [configuración y prueba de despliegue](#niubiz-primer-despliegue). No se ha desplegado a producción. El login automático desde ese servidor debe probarse con la clave regenerada, especialmente por reCAPTCHA. Los apartados posteriores conservan el historial de las verificaciones parciales.

### Interfaz: jerarquía fuente → operaciones (+ modales)

En **Finanzas → Verificación de pagos** (`/treasury`):

1. **Fuentes** (página) — cada card es un acceso a un portal. Al cargar se prioriza una fuente Niubiz activa si existe.
2. **Cabecera de la fuente** — nombre, entidad y acciones: **Editar**, y en Niubiz también **Actualizar pagos** y **Comercios** (modales).
3. **Operaciones** (página) — filtros y tabla; es el contenido diario de la fuente. Columnas: fecha, comercio (código + nombre), pedido, código de transacción, cliente, email, importe, estado; **Tarjeta** y **Billetera** solo si hay datos en la página. Clic en fila → modal de detalle.
4. **Modales** — Actualizar pagos (API + Excel juntos); Comercios (lectura: N del conector + lista con operaciones); Editar fuente; Detalle de operación.

La sync Niubiz usa la lista canónica de 77 comercios (`niubiz-merchants.json`). No hay CRUD de inventario Niubiz en la página; fuentes sin conector siguen pudiendo registrar cuentas/comercios como configuración.

### Buscador de pagos

`GET /api/treasury/payments` acepta `q` (texto) además de comercio, estado, fechas y página. La búsqueda es en servidor, case-insensitive y parcial, sobre número de pedido, código de transacción, nombre del cliente y correo. Escapa comodines SQL (`%`, `_`, `\`). Se combina con el resto de filtros. La UI envía `q` al pulsar Buscar (no en cada tecla) y resetea a página 1. Validación local: `scripts/validate-niubiz-search.cjs`.

### Secretos y plataformas futuras

- **En `.env` (infraestructura, una vez):** URL, API key y clave maestra de la cuenta de servicio de Vaultwarden, más el flag de cron. Son el acceso a la bóveda, no las contraseñas de cada portal.
- **UUID del elemento por fuente** en UI (`TreasurySource.vaultItemId`). Cómo obtenerlo: [UUID del elemento Niubiz Comercio](#uuid-del-elemento-niubiz-comercio). `FINANCE_VAULT_NIUBIZ_ITEM_ID` en env es solo fallback legacy.
- Usuario y contraseña de Niubiz/BCP/Mercado Pago/etc. permanecen solo en Vaultwarden; la API los lee en memoria con `bw get item <id>`. No crear una segunda bóveda en PostgreSQL.

### Validación previa de persistencia local

Implementados `TreasuryPayment` y `TreasuryPaymentImport`, importación autenticada `POST /api/treasury/payments/import-niubiz` (multipart `file`, XLSX de hasta 5 MB/5000 filas) y consulta `GET /api/treasury/payments` con comercio, estado, fechas de Lima, búsqueda `q` y paginación de 50 operaciones. Ambos endpoints heredan el permiso `treasury` y la autenticación global de la aplicación.

La importación conserva importe decimal, moneda, estado original, fecha, pedido, cliente, correo, marca/tipo de tarjeta con últimos dígitos del PAN ya enmascarado, billetera (p. ej. Yape/Plin) y referencias de comercio/transacción. No importa PAN completo, tokens ni la respuesta cruda. Identidad única: proveedor + comercio + transacción. Valida todo el archivo antes de escribir, serializa importaciones con un bloqueo transaccional PostgreSQL y registra auditoría, checksum y conteos de altas/cambios. Una reimportación conserva las operaciones y aplica el estado del archivo; el operador debe usar una exportación actualizada para evitar sobrescribir estados con una versión antigua. La última importación no representa una consulta en vivo a Niubiz.

Validado en la base **local aislada** `mali_niubiz_local`, puerto `55439`, contenedor `mali-niubiz-local-db`, volumen persistente `mali-niubiz-local-pgdata`: 252 operaciones de octubre del comercio `650177853`, 232 liquidadas y 20 denegadas. Pruebas reales: reimportación sin duplicados, actualización de una operación y restauración al reporte original, rechazo íntegro de un archivo inválido, filtros, paginación y conversión de fechas de Lima. Compilaciones de shared/API/web correctas. Migraciones aplicadas solo a la base local.

Vista local: `http://127.0.0.1:5187/treasury`. El arnés `scripts/validate-niubiz-local.cjs` sirve el frontend real y los servicios del módulo sobre PostgreSQL, con un usuario de prueba local. Solo acepta la base aislada, escucha en loopback y no forma parte del servidor de producción. `--serve-only` abre la vista sin repetir las pruebas. Ejecutar tras compilar, con `DATABASE_URL` apuntando explícitamente a esa base. Para repetir pruebas, pasar el archivo XLSX como primer argumento y opcionalmente `--serve`.

La extracción API ya reutiliza ese parser y la misma persistencia. Pendiente de verificar: credenciales nuevas y login automático en producción antes de activar el cron.

El usuario confirmó haber regenerado la API key de Vaultwarden expuesta durante el piloto. La nueva clave no se ha recibido ni guardado en este repositorio.

Objetivo de esta fase: guardar y mostrar pagos Niubiz, con consultas cada dos horas y presentación en horario America/Lima. Conciliación bancaria y CRM quedan fuera de esta fase. Módulo independiente, sin relación con PAM.

## Primera entrega: inventario de fuentes

- Pantalla `/treasury`, navegación y permiso de módulo `treasury`.
- API autenticada `/api/treasury`: consultar inventario; crear y editar fuentes; crear y editar cuentas/comercios.
- Fuentes previstas: BCP, Niubiz Comercio, Niubiz En Línea, Diners, Expressnet, PagoEfectivo y Mercado Pago. El catálogo describe el alcance a validar, no certifica disponibilidad de conectores ni APIs.
- Cada fuente identifica un acceso a un portal y su titular. Se pueden registrar varios accesos del mismo proveedor, con nombres distintos.
- Cada cuenta/comercio tiene nombre, referencia textual (conserva ceros iniciales), moneda PEN/USD y estado de inclusión. Una referencia puede aparecer una vez por moneda dentro de una fuente. El tipo de registro se deriva del proveedor en el servidor.
- La entidad/portal de una fuente es inmutable. Un portal distinto requiere otra fuente para evitar reasignar cuentas a otra entidad.
- Desactivar una fuente o registro lo archiva; no se borran registros. Al implementar el trabajador deberá respetar ambos estados.
- Auditoría transaccional: creación/edición y su registro de auditoría se confirman juntos. Las referencias de cuentas no se copian al registro general de auditoría.
- Frecuencia prevista fija de 60 minutos. **No hay programador ni navegación automática en esta entrega.** La pantalla muestra conexiones pendientes; no presenta saldos o conciliaciones ficticias.
- No almacena contraseñas, cookies, tokens ni identificadores de sesión. No hay endpoint para iniciar sincronizaciones.

Los administradores acceden según la política existente de MALI ONE. A operadores se les asigna `treasury` desde Accesos MALI ONE; ese acceso permite leer y mantener el inventario. Antes de incorporar importes o conciliación, separar permisos de consulta, configuración y aprobación si contabilidad lo necesita.

## Activación y validación

La migración aditiva `20261020120000_treasury_inventory` agrega el permiso y dos tablas. Se debe aplicar al entorno elegido mediante el procedimiento habitual antes de servir la nueva API; no se aplica automáticamente al iniciar la aplicación. No se han cargado cuentas ni códigos reales de comercio.

Comandos de validación desde la raíz:

```sh
pnpm --filter @mali-one/api exec prisma generate
pnpm --filter @mali-one/shared build
pnpm --filter @mali-one/api build
pnpm --filter @mali-one/web build
node --test scripts/treasury.test.cjs
node scripts/validate-treasury-ui.cjs
```

La prueba de interfaz usa el navegador local en modo headless, datos de prueba y una API simulada; bloquea solicitudes externas. La prueba del servicio utiliza dobles de persistencia. Estas verificaciones no sustituyen una prueba de migración y persistencia contra PostgreSQL en staging ni verifican el acceso a portales reales.

## Etapas siguientes

### 1. Piloto de extracción Niubiz

Elegir pocos comercios y un período cerrado validado por contabilidad. Confirmar permisos de consulta, recorrido actual, MFA, límites de fechas y formatos de exportación de ambos portales. Implementar un trabajador Playwright/TypeScript separado de la API, con sesión aislada por acceso, selectores DOM comprobados y capturas de diagnóstico restringidas y sin secretos.

#### Recorrido observado: Niubiz Comercio, Ventas

El usuario mostró el portal `https://comercio.niubiz.com.pe/views/home` con una sesión iniciada. Indicó que el inicio de sesión requiere usuario y contraseña. El recorrido manual es: seleccionar un código en el selector **Comercio** (actualmente se digita) → **Ventas** (`/views/sells`) → seleccionar período o rango **Desde/Hasta** → **Buscar** → **Exportar**. La lista de resultados muestra número de pedido, cliente, moneda, importe del pedido, descuento aplicado, marca y fecha de transacción; el ejemplo de octubre de 2026 muestra paginación (10 de 252 elementos). Esto describe la vista, no confirma todavía las columnas ni el estado de pago del archivo exportado.

Códigos de comercio proporcionados para recorrer (conservar como texto):

```text
651056503 651052503 651052502 651052501 651052499 651052500
651052496 651052498 651052495 651052497 651052493 651052494
651052492 651052490 651052491 651052484 651052488 651052486
651052483 651052487 651052489 651052481 651052482 651052459
651052485 651052463 651048804 651039377 651047392 651047043
651036145 651032161 651032169 651026383 651026389 651026388
651026387 651026386 651026385 651026384 651026379 651026377
651026371 651026369 651026366 651026358 651026333 651026330
651026328 651026327 651026324 651026322 651026320 651026317
650247136 650246946 650241029 650239881 650239803 650233738
650223785 650223786 650223783 650223781 650223784 650223670
650223782 650223669 650223668 650223666 650223667 650223665
650223299 650217150 650178711 650177853 168496619
```

Antes de automatizar: comprobar si el portal usa una API de consulta/exportación accesible con la sesión autorizada, su paginación y límites; verificar si **Exportar** incluye todos los resultados del rango; obtener un archivo de muestra para fijar columnas, identidad estable y estados de operación. La selección del comercio debe verificarse tras cada cambio. Registrar por separado los comercios que fallen y continuar con los demás; nunca interpretar una consulta fallida como cero ventas. La confirmación para CRM Educación exige identificar una operación aprobada y asociarla inequívocamente al lead o pedido; la presencia en la tabla de Ventas por sí sola no basta.

Muestra recibida: exportación de octubre de 2026 para el comercio `650177853`, hoja `sells`, 252 filas de datos y 50 columnas. El total coincide con los 252 elementos mostrados en la vista para ese comercio y rango. Incluye `Estado` (232 `Liquidada`, 20 `Denegada`), `Código de transaccion` (252 valores distintos), `Fecha de Liquidación`, `Código de comercio`, `Nro Pedido`, moneda e importe. Contiene también nombres, correos y PAN enmascarado: proteger el archivo original y minimizar los campos que se persistan. La muestra solo demuestra completitud para este comercio y período; no demuestra el comportamiento de otros rangos ni la disponibilidad de una API. En la revisión posterior, la sesión del portal había expirado y redirigía al inicio de sesión, por lo que siguen sin observarse las solicitudes de red de **Buscar** y **Exportar**. Estado de API interna: **no verificada**.

Éxito: seleccionar y verificar comercio y fechas; descargar el reporte correcto; detectar cambio de columnas o archivo incompleto; distinguir cero operaciones de fallo de consulta. Login fallido o desafío de acceso detiene el trabajo y solicita intervención, sin reintentos ilimitados.

#### API interna identificada en el código del portal

La revisión posterior del JavaScript público confirma que el portal implementa una API interna de ventas. Esta evidencia reemplaza el estado anterior «no verificada» respecto de su existencia; todavía no se ha ejecutado una consulta autenticada desde un conector propio.

- Base: `https://api.niubiz.pe/api.backoffice.merchant`.
- Consulta y exportación: `POST /order`, método del frontend `getSells`.
- Autenticación: el interceptor agrega `Authorization: Bearer <token>` para peticiones a esa base. El token procede de `accessToken` en los datos de autenticación. No se han extraído ni guardado tokens reales.
- Cuerpo: `page`, `size`, `fromDate`, `toDate`, `merchantId`, `purchaseNumber`, `clientName`, `brand`, `status`, `amount`, `currency`, `transactionDate`, `confirmationDate`, `pagolinkId`, `export`, `sortBy`.
- Fechas: el frontend las convierte a `d/m/yyyy`; para el piloto, `1/10/2026` y `31/10/2026`. El comercio de referencia es `650177853`.
- El frontend inicia la búsqueda en página 1. Interpreta `header.errorCode === 0` como éxito, lee `data.count` y `data.list`, y trata el código 10 como proceso pendiente.
- Exportar llama al mismo servicio con `export: true`. El navegador transforma `data.list` en Excel usando `exportExcelCustom`, hoja `sells`, título `Mis Ventas`, archivo `Gateway - Niubiz`. Por tanto, existe una ruta para obtener los datos previos al Excel; los límites y la completitud deben probarse con una sesión válida.
- Al cambiar comercio, el frontend actualiza `idCommerce` y reutiliza ese valor como `merchantId`. Esto sugiere un recorrido por comercios con el mismo acceso; los permisos efectivos de cada comercio quedan sujetos al servidor.
- La respuesta de lista se transforma desde filas compuestas por pares `label`/`value`. El parser propio debe preservar ceros y valores originales, sin copiar la conversión del frontend que sustituye valores falsy por texto vacío.

Fuentes inspeccionadas (recursos públicos del propio portal):

- `https://comercio.niubiz.com.pe/main-es2015.b53e2eaf7c5c896cfad0.js`: base, servicio, interceptor, cambio de comercio y formato de fechas.
- `https://comercio.niubiz.com.pe/6-es2015.8fc7d8119f82f4f5f3a7.js`: componente de Ventas, interpretación de la respuesta y exportación.

Prueba autenticada completada mediante `scripts/probe-niubiz-sales.cjs`, con inicio de sesión manual en un navegador aislado. `POST /order` con `export: true`, comercio `650177853` y fechas `1/10/2026` a `31/10/2026` devolvió HTTP 200 y `header.errorCode: 0`. Las 252 operaciones coinciden con el Excel de referencia: cero identificadores duplicados, faltantes o adicionales y cero diferencias en número de pedido, moneda, importe, fecha de transacción, estado, comercio y código de transacción. Estados: 232 `Liquidada` y 20 `Denegada`. La respuesta de exportación contiene objetos cuyas claves coinciden con los encabezados del Excel (a diferencia del formato de la lista de pantalla). El token se utilizó en memoria; el script cerró la sesión local del navegador sin guardar credenciales ni datos de sesión.

Pendiente para el conector: confirmar acceso a los demás comercios, límites, expiración y renovación de sesión, y comportamiento de `export: true` con volúmenes mayores. La prueba valida esta consulta concreta; no garantiza todavía ejecución desatendida ni estabilidad del contrato interno.

#### Prueba de los 77 comercios y vigencia de sesión

El 4 de noviembre de 2026 se completó `probe-niubiz-sales.cjs <xlsx> --all-merchants` para octubre de 2026. Los 77 códigos de `scripts/niubiz-merchants.json` respondieron HTTP 200 y código de aplicación 0. Hubo 694 operaciones en cinco comercios: `651047392` (293), `650239881` (143), `650239803` (2), `650178711` (4) y `650177853` (252). Los otros 72 devolvieron listas vacías. Totales de estados: 609 `Liquidada`, 80 `Denegada`, 1 `Anulada` y 4 `Abandonada`. Se comprobó que cada fila pertenece al comercio consultado y que no hay códigos de transacción duplicados dentro de cada comercio. Solo el comercio `650177853` cuenta con el Excel independiente de referencia; las listas vacías y demás totales todavía no se contrastaron con reportes independientes.

El JWT observado declara 15 minutos entre emisión y expiración. Esto es la vigencia declarada por el token, no una prueba de rechazo del servidor después de esos 15 minutos. El código público del login (`7-es2015.bc175f43d18f08bf2bbe.js`) obtiene reCAPTCHA mediante la acción `merchant/login` y envía `captchaToken` junto a usuario y contraseña a `POST /login`. No se identificó un flujo de refresh en los recursos inspeccionados. El acceso automático sigue pendiente de validar; un cron cada dos horas no puede depender de conservar este token inicial.

Cadencia propuesta para Niubiz: cada 120 minutos, reconsultando siete días recientes, más una revisión diaria del mes anterior. El módulo todavía no importa estas operaciones a su base de datos ni ejecuta ese cron. Próximas entregas: obtener sesión de forma fiable, persistencia idempotente y trazabilidad por comercio, ejecución programada, y vista de operaciones/última actualización en MALI ONE. Alcance actual: terminar Niubiz antes de otros proveedores; CRM Educación queda fuera de esta etapa.

### 2. Persistencia y ejecución horaria

Incorporar cola Redis, exclusión por acceso, reintentos limitados con espera creciente, ejecuciones y archivos originales protegidos. Guardar período solicitado/cubierto, fechas de consulta y publicación si existen, checksum y versión del parser. Avanzar el punto de recuperación solo después de validar y persistir el lote completo.

Importar cobros y liquidaciones por separado. Importes decimales o unidades menores, moneda explícita y referencias del proveedor. Deduplicar por identidad estable del origen; registrar cambios de estado sin duplicar operaciones. Consultar una ventana reciente superpuesta y reprocesar períodos históricos para operaciones tardías, devoluciones y contracargos. Elegir ventanas y límites a partir del piloto, no fijar promesas de latencia antes de medir.

Éxito: repetir un lote no duplica movimientos; recuperar una ejecución interrumpida no pierde registros; un error nunca aparece como cero ingresos. La cadencia horaria no garantiza que el proveedor haya publicado información nueva.

### 3. Abonos BCP y conciliación del piloto

Identificar el canal empresarial real y evaluar acceso oficial a movimientos. Si se usa portal, validar con una cuenta el recorrido DOM, MFA, disponibilidad de históricos y exportación. Los movimientos bancarios se conservan como fuente independiente.

Relacionar cobros → liquidaciones → abonos. Admitir agrupaciones y pagos parciales. No sumar esas etapas como ingresos distintos ni conciliar solo por monto y fecha. Incorporar comisiones, retenciones, ajustes y devoluciones; diferencias y coincidencias ambiguas pasan a revisión con trazabilidad de quién las resolvió.

Éxito: el período piloto coincide con reportes originales y extracto bancario por moneda; casos ambiguos quedan pendientes explícitos y una operación no se asigna dos veces.

### 4. Vista operativa y demás entidades

Mostrar importes por moneda y etapa, pendientes, diferencias, última consulta exitosa, cobertura y necesidad de intervención por fuente. Extender conectores a Diners (Ventas y Pagos), Expressnet, PagoEfectivo y Mercado Pago. Cada conector decide API oficial, archivo o navegación según cobertura verificada del contrato; no inferir que una API de cobro ofrece liquidaciones o todos los movimientos de la cuenta.

## Datos necesarios para iniciar el piloto

### Acceso a credenciales en Vaultwarden: prueba local completada

El 4 de noviembre de 2026 se validó el acceso de `testing@mali.pe` al elemento organizacional `Niubiz Comercio` en la colección Finanzas de `https://vault.mali.pe`. La prueba `scripts/probe-vaultwarden.ps1` autentica con API key personal, desbloquea con contraseña maestra, sincroniza y comprueba que usuario y contraseña del elemento sean accesibles, sin imprimirlos ni guardarlos como texto plano. Los secretos se introducen localmente con entrada oculta; al finalizar se limpian las variables y se cierra la sesión de la CLI.

Versión validada: **Bitwarden CLI 2026.6.0**. La 2026.10.1 falló en desbloqueo con diagnóstico de compatibilidad; la 2026.8.0 superó desbloqueo pero falló leyendo elementos (`invalid type: JsValue ... expected a string`). La 2026.6.0 completó todos los pasos. Fijar esta versión para reproducir el piloto; evaluar las futuras actualizaciones de cliente y servidor juntas. La prueba exige la versión validada para evitar una sustitución silenciosa.

Este resultado acredita la lectura local del secreto con intervención del usuario. Todavía no hay integración de Vaultwarden en el backend ni provisión de secretos en el servidor, inicio de sesión Niubiz desatendido, persistencia de pagos o cron activado. Para el servidor se necesitará configurar de forma protegida la autenticación y el desbloqueo de la cuenta de integración y resolver el elemento por identificador estable. La API key utilizada durante las pruebas se compartió en el chat: regenerarla al concluir las pruebas antes de configurar el despliegue, sin incluir su valor en documentación o repositorio.

- Acceso autorizado de consulta a Niubiz y a la cuenta BCP elegida, mediante un mecanismo seguro; no escribir claves en este documento.
- Comercios iniciales, cuenta receptora y monedas correspondientes.
- Un reporte de ventas, uno de liquidaciones y un extracto bancario del mismo período, con totales confirmados por contabilidad.
- Persona responsable de resolver MFA y revisar diferencias.

## Niubiz: primer despliegue

Esta fase guarda y muestra ventas en Finanzas → Verificación de pagos. No convierte leads, no concilia abonos bancarios y no interpreta una venta denegada como pago confirmado.

## Qué está implementado

- Vaultwarden entrega el usuario y contraseña de Niubiz mediante el UUID del elemento compartido. Bitwarden CLI está fijado en **2026.6.0**, versión que funcionó en la prueba local; se ejecuta con Node 24 aislado del Node de la API.
- Chromium abre el formulario normal de Niubiz, completa sus campos y espera la respuesta de login. No resuelve ni evita desafíos CAPTCHA/MFA. El token permanece en memoria durante la ejecución. Si vence o llega un HTTP 401, intenta iniciar sesión de nuevo, con un máximo de tres logins por ejecución.
- `POST /order` con `export:true` alimenta directamente PostgreSQL. La lista canónica está en `apps/api/src/modules/treasury/niubiz-merchants.json`: 77 comercios. No depende del Excel ni del inventario editable de fuentes.
- Identidad única: proveedor + comercio + código de transacción. Repetir el rango actualiza estados sin duplicar. Se guardan correo y PAN solo enmascarado (últimos dígitos); no se guardan PAN completo ni respuestas crudas de Niubiz.
- Guardado atómico por comercio, estado de la última ejecución y resultados por comercio. Una consulta fallida no equivale a cero operaciones. Las ejecuciones parciales conservan los comercios guardados. Reintentar el mismo rango recupera los pendientes.
- Dos horas entre ejecuciones programadas (00:00, 02:00, etc., Lima), consultando hoy y los 31 días anteriores. Un rango manual permite recuperar períodos anteriores, de hasta 32 días cada vez. Las operaciones anteriores a esa ventana solo se revisan mediante un rango manual.
- Bloqueo distribuido en PostgreSQL para evitar ejecuciones simultáneas. El bloqueo dura 90 minutos ante una caída del proceso; al vencer se muestra como interrumpida. Las ejecuciones tienen un límite de 45 minutos más la solicitud en curso y no se reanudan en medio de un comercio después de un reinicio.
- Tres intentos por comercio para errores transitorios/exportación pendiente, una pausa entre comercios y detención ante HTTP 429. Si se alcanza el límite conservador de 5000 filas o el total declarado supera las filas recibidas, no se guarda ese comercio: volver a consultar un rango menor.

## Configuración del servidor

En el `.env` de producción, **solo en el servidor**, completa:

```dotenv
NIUBIZ_SYNC_ENABLED=false
FINANCE_VAULT_URL=https://vault.mali.pe
FINANCE_VAULT_CLIENT_ID='user.UUID_DE_TESTING'
FINANCE_VAULT_CLIENT_SECRET='CLAVE_API_REGENERADA'
FINANCE_VAULT_MASTER_PASSWORD='CLAVE_MAESTRA_DE_TESTING'
```

Usar la API key personal de la cuenta que tiene acceso al elemento en la colección FINANZAS. La clave maestra corresponde a esa misma cuenta de Vaultwarden. No es la contraseña de Niubiz. El UUID del ítem Niubiz se pega en **Editar fuente → ID del elemento en Vaultwarden**.

### UUID del elemento Niubiz Comercio

`TreasurySource.vaultItemId` (UI) es el **UUID del ítem en Vaultwarden** que guarda usuario y contraseña del portal (p. ej. Niubiz Comercio). No es la contraseña de Niubiz ni la de la bóveda: es un puntero. El worker hace `bw get item <UUID>`, lee las credenciales en memoria e inicia sesión.

Cómo obtenerlo si no lo conoces:

1. Entra a `https://vault.mali.pe` con una cuenta que vea la colección Finanzas.
2. Abre el elemento **Niubiz Comercio**.
3. En la URL del navegador, copia el valor de `itemId` (`…?itemId=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`).
4. Alternativa con CLI ya desbloqueada: `bw list items --search 'Niubiz Comercio'` y usa **solo el campo `id`** del ítem correcto. No imprimas ni pegues el objeto completo (contiene secretos) en chats o documentación.

No confundir el ID del elemento con el de colección u organización. Si el ítem no aparece, la cuenta no tiene acceso a Finanzas o el nombre del elemento es distinto.

Acceso a Vaultwarden (URL, client id/secret, master password) permanece en `.env`; el UUID por fuente está en la base (`TreasurySource.vaultItemId`). Usuario/contraseña de cada portal siguen solo en Vaultwarden. Detalle en [Secretos y plataformas futuras](#secretos-y-plataformas-futuras).

Las comillas simples en el `.env` de Docker Compose conservan los `$` literales; si el secreto contiene comillas simples, aplicar el escape documentado de Compose y comprobarlo sin imprimir su valor. No poner estos valores en variables `VITE_`, en el repositorio ni en el chat. El servidor necesita acceso de red a Vaultwarden, Niubiz y los recursos de su formulario de acceso. Para producción conviene una cuenta de bóveda dedicada con acceso solo a los elementos necesarios; `testing` sirve para esta primera prueba.

La imagen API incluye Chromium y las dependencias de login. `NIUBIZ_RUNTIME_NODE`, `NIUBIZ_LOGIN_SCRIPT` y `PLAYWRIGHT_BROWSERS_PATH` ya están definidos en el Dockerfile; no sobrescribirlos con rutas Windows en producción. El build descarga CLI y navegador y aumenta el tamaño de la imagen.

El `.env` permite que el servicio se recupere después de un reinicio sin intervención. Quien tenga acceso administrativo al host/contenedor también puede acceder a estos secretos: limitar permisos del archivo y de la cuenta. La bóveda de Niubiz sigue siendo Vaultwarden; no se crea una segunda bóveda en la base de datos. El worker usa un directorio temporal para el caché cifrado del CLI y lo elimina al terminar normalmente; un cierre forzado puede dejar ese caché temporal cifrado hasta recrear el contenedor.

## Despliegue y prueba

1. Commit de los cambios revisados, incluyendo las dos migraciones de pagos y sincronización, el JSON de comercios y `scripts/niubiz-runtime/package-lock.json`. No incluir `.env`, Excel ni secretos. Los cambios ajenos de Educación no forman parte de esta funcionalidad.
2. En el servidor, usando el procedimiento habitual de este repositorio, reconstruir y recrear API y web:

   ```sh
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build api web
   ```

   El entrypoint de API aplica las migraciones con `prisma migrate deploy` antes de iniciar. Respaldar PostgreSQL mediante el procedimiento habitual antes de migrar.
3. Entrar en MALI ONE con rol administrador y acceso al módulo. En **Finanzas → Verificación de pagos**, comprobar que aparece «Conexión configurada». Esto solo confirma presencia de variables, no que las credenciales sean válidas.
4. Seleccionar `2026-10-01` a `2026-10-31`, pulsar **Sincronizar pagos** y esperar el resultado de los 77 comercios. La UI consulta el avance y actualiza la tabla. La referencia autenticada previa fue de 694 operaciones en cinco comercios, incluidas 252 del `650177853`; la fuente puede haber cambiado desde esa consulta.
5. Filtrar el comercio `650177853`, revisar cantidades/estados y repetir el rango. La segunda ejecución debe mostrar cero nuevos si la fuente no cambió. Confirmar el origen «API Niubiz» en el último lote y que los datos persisten al recargar.
6. Si el login se bloquea, la UI mostrará un diagnóstico seguro: `VAULT_AUTH`, `VAULT_UNLOCK`, `VAULT_ITEM`, `NIUBIZ_LOGIN_REQUIRED` o fallo de runtime. Resolver esa causa antes de activar el cron. Si Niubiz exige un desafío interactivo desde el servidor, **este conector no lo supera automáticamente**: faltaría incorporar un flujo asistido o acordar un acceso API con Niubiz.
7. Solo después de esa prueba, cambiar `NIUBIZ_SYNC_ENABLED=true` y recrear la API. La siguiente hora par de Lima ejecutará la actualización. Cambiar a `false` y recrear la API desactiva futuras ejecuciones; no borra los pagos.

## Validación de desarrollo

Los builds de shared, API y web y las pruebas locales cubren persistencia, identidad única, rangos, bloqueo concurrente, renovación por 401, rechazos de esquema y ejecuciones parciales. `scripts/validate-niubiz-sync.cjs` usa una PostgreSQL local aislada y respuestas API simuladas, nunca secretos o producción. Ejecutarlo después de compilar y aplicar migraciones locales; solo acepta `127.0.0.1:55439/mali_niubiz_local`.

El login automático completo desde el servidor de producción **aún requiere la prueba del paso 4** con la clave API regenerada. Las consultas API reales de los 77 comercios y la lectura de Vaultwarden se verificaron previamente por separado; eso no demuestra que reCAPTCHA acepte el Chromium del servidor.

Validación realizada el 4 de noviembre de 2026: builds shared/API/web correctos, migración aplicada únicamente a PostgreSQL local, pruebas del conector e importación correctas y revisión visual del panel. La imagen API completa se construyó en Docker; dentro de esa imagen arrancaron Chromium y Bitwarden CLI 2026.6.0 con la red deshabilitada. No se ejecutó un despliegue ni se guardaron las credenciales regeneradas.
