# Roles CRM Educación (transición vs destino)

> Quién responde en la ruta de negocio: [modelo operativo §4](./crm-educacion/modelo-operativo.md#4-el-recorrido-y-quién-responde-por-cada-paso).
> La tabla de abajo es transición/destino operativo. Los **permisos por acción**
> son anexo no ratificado: no sustituyen el modelo ni garantizan autorización ya
> implementada.

| Rol | Transición | Destino |
|-----|------------|---------|
| **Asesor** | WA: etapa, ficha, chat. CRM: **solo** alta lead no captado + asociar código (sin `/treasury`) | Solo mali-whatsapp (incluye asociar código vía API ONE). **Si el dato comercial vive en ONE, la UX WA no cambia** (facade). |
| **Jefe / supervisor** | CRM ONE: **Bandeja** + ficha, distribute/review WA, historial, Anura, reportes | Bandeja/ficha ONE como centro; reglas comerciales en ONE |
| **Caja** | CRM/Treasury: aplicar importe, OBS/boleteo (pestaña Pagos / Caja) | Igual |
| **Admin** | Todo + higiene widget + herramientas ingesta | Todo |

**Asesor comercial ≠ responsable del chat.** Cubrir el inbox no transfiere venta ni comisión. Reasignar oportunidad (jefe) puede solicitar cambio de chat; son datos distintos.

**Prospectia `prospectia_status`:** solo lectura (conversación Chatwoot) ≠ etapa comercial (`stage_slug`).

Permiso módulo: `crm_educacion`. Restringir en App Users el acceso asesor a pantallas amplias cuando el modal WA de pago esté listo. En F5 retirar acceso asesor a CRM salvo alta excepcional / soporte.

Env servicio WA→ONE (lookup código): `CRM_EDUCACION_SERVICE_TOKEN` (header `x-crm-educacion-service-token`). Cutover: [crm-educacion-cutover.md](./crm-educacion-cutover.md). Inventario: [crm-educacion-crm-consumers.md](./crm-educacion-crm-consumers.md).

## Permisos propuestos por acción

**Anexo no ratificado.** Candidatos a alinear con el modelo tras su revisión con
negocio. No activar como política ni usarlo para adelantar X, cliente o
habilitación. Si contradice el [modelo operativo](./crm-educacion/modelo-operativo.md),
gana el modelo.

- **Sistema:** deduplicar captaciones, abrir según regla acordada, aplicar asignación
  configurada y cerrar por inactividad solo conforme a la política. Reintentos no
  cambian propietario ni crean ventas duplicadas. No confirmar ventas por una
  etiqueta externa ni validar pagos por un voucher.
- **Asesor propietario o delegado explícitamente:** registrar toques, próxima
  gestión/promesa, cambiar etapas abiertas, cerrar como venta exitosa con datos mínimos,
  cerrar como perdido con motivo y reportar pagos. Reclamar un lead solo si
  está libre y es elegible para su ámbito; la operación debe ser atómica.
- **Jefe/supervisor:** asignar y reasignar dentro de su ámbito, resolver conflictos
  de identidad/interés, autorizar excepciones de continuidad y corregir cierres
  con motivo. No validar financieramente por el solo hecho de ser jefe.
- **Caja:** consultar operaciones autorizadas, confirmar/aplicar importes, observar
  asociaciones, revertir aplicaciones con motivo y registrar emisión de documentos.
  Una reversión de aplicación CRM no ejecuta automáticamente un reembolso bancario.
  No cambiar etapas ni apropiarse de la venta al aplicar un pago.
- **Administración académica:** confirmar matrícula y registrar su referencia cuando
  se cumplan requisitos; mantenerla separada del comprobante fiscal.
- **Administrador técnico:** configurar accesos/integraciones. Su rol técnico no
  concede aprobación comercial/financiera automática; una intervención excepcional
  debe ser explícita y auditada.

Una persona puede acumular roles, con permisos explícitos. Aplicar un cobro válido
es competencia de Caja; crédito, excepciones de habilitación y correcciones de
ventas con pagos requieren autorización comercial y coordinación con Caja.

En toda mutación: actor, fecha, estado anterior/nuevo, origen y motivo cuando
corresponda. Comprobar permiso y alcance antes de escribir. Cubrir un chat no
transfiere comisión/propiedad (igual que en el modelo).

Más matices candidatos: [anexo de propuestas](./crm-educacion.md#anexo-propuestas-de-diseño-no-ratificadas).
