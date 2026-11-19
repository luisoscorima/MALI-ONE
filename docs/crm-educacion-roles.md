# Roles CRM Educación (transición vs destino)

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
