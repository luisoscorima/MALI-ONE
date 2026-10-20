# Tesorería y conciliación

Objetivo acordado: ventas cobradas y abonos bancarios conciliados, con consultas cada hora y presentación en horario America/Lima. Módulo independiente, sin relación con PAM.

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

Éxito: seleccionar y verificar comercio y fechas; descargar el reporte correcto; detectar cambio de columnas o archivo incompleto; distinguir cero operaciones de fallo de consulta. Login fallido o desafío de acceso detiene el trabajo y solicita intervención, sin reintentos ilimitados.

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

- Acceso autorizado de consulta a Niubiz y a la cuenta BCP elegida, mediante un mecanismo seguro; no escribir claves en este documento.
- Comercios iniciales, cuenta receptora y monedas correspondientes.
- Un reporte de ventas, uno de liquidaciones y un extracto bancario del mismo período, con totales confirmados por contabilidad.
- Persona responsable de resolver MFA y revisar diferencias.
