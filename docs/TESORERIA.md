# Verificación de pagos

## Estado actual: conector API + Vaultwarden preparado (4 de noviembre de 2026)

La implementación actual incluye extracción API de los 77 comercios, login con credenciales de Vaultwarden, persistencia, renovación de sesión, ejecución manual desde MALI ONE y cron cada dos horas desactivado por defecto. Ver [configuración y prueba de despliegue](NIUBIZ-DESPLIEGUE.md). No se ha desplegado a producción. El login automático desde ese servidor debe probarse con la clave regenerada, especialmente por reCAPTCHA. Los apartados posteriores conservan el historial de las verificaciones parciales.

### Interfaz: jerarquía fuente → registros → inventario

En **Finanzas → Verificación de pagos** (`/treasury`) el orden de la pantalla es:

1. **Fuentes** — selector visible. Cada fuente es un acceso a un portal (Niubiz · Comercio, BCP, etc.). Al cargar se prioriza una fuente Niubiz activa si existe.
2. **Registros** — vista operativa de la fuente seleccionada. Solo `niubiz_sales` muestra sincronización, buscador, filtros y tabla; el resto indica que la sincronización aún no está disponible.
3. **Inventario de la fuente** — comercios o cuentas de esa misma fuente. No es un bloque hermano de «Niubiz»: Niubiz es una fuente; sus registros cuelgan de ella.

La sincronización Niubiz sigue usando la lista canónica de 77 comercios del conector (`niubiz-merchants.json`); el inventario editable todavía no modifica esa lista.

### Buscador de pagos

`GET /api/treasury/payments` acepta `q` (texto) además de comercio, estado, fechas y página. La búsqueda es en servidor, case-insensitive y parcial, sobre número de pedido, código de transacción y nombre del cliente. Escapa comodines SQL (`%`, `_`, `\`). Se combina con el resto de filtros. La UI envía `q` al pulsar Buscar (no en cada tecla) y resetea a página 1. Validación local: `scripts/validate-niubiz-search.cjs`.

### Secretos y plataformas futuras

- **En `.env` (infraestructura, una vez):** URL, API key y clave maestra de la cuenta de servicio de Vaultwarden, más el flag de cron. Son el acceso a la bóveda, no las contraseñas de cada portal.
- **Hoy el UUID del elemento Niubiz** también va en `.env` como `FINANCE_VAULT_NIUBIZ_ITEM_ID` (piloto). Cómo obtenerlo: [NIUBIZ-DESPLIEGUE.md — UUID del elemento](NIUBIZ-DESPLIEGUE.md#uuid-del-elemento-niubiz-comercio).
- **Decisión para más plataformas:** no añadir un env por cada portal. El UUID del ítem de Vaultwarden (puntero, no el secreto) debe vivir en la fuente (`TreasurySource`, p. ej. `vaultItemId`). Usuario y contraseña de Niubiz/BCP/etc. permanecen solo en Vaultwarden; la API los lee en memoria con `bw get item <id>`. No crear una segunda bóveda en PostgreSQL.

### Validación previa de persistencia local

Implementados `TreasuryPayment` y `TreasuryPaymentImport`, importación autenticada `POST /api/treasury/payments/import-niubiz` (multipart `file`, XLSX de hasta 5 MB/5000 filas) y consulta `GET /api/treasury/payments` con comercio, estado, fechas de Lima, búsqueda `q` y paginación de 50 operaciones. Ambos endpoints heredan el permiso `treasury` y la autenticación global de la aplicación.

La importación conserva importe decimal, moneda, estado original, fecha, pedido, cliente y referencias de comercio/transacción. No importa PAN, correo, tokens ni el resto del archivo. Identidad única: proveedor + comercio + transacción. Valida todo el archivo antes de escribir, serializa importaciones con un bloqueo transaccional PostgreSQL y registra auditoría, checksum y conteos de altas/cambios. Una reimportación conserva las operaciones y aplica el estado del archivo; el operador debe usar una exportación actualizada para evitar sobrescribir estados con una versión antigua. La última importación no representa una consulta en vivo a Niubiz.

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
