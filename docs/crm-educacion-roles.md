# Roles CRM Educación (transición vs destino)

| Rol | Transición | Destino |
|-----|------------|---------|
| **Asesor** | WA: etapa, ficha, chat. CRM: **solo** alta lead no captado + asociar código (sin `/treasury`) | Solo mali-whatsapp (incluye asociar código vía API ONE) |
| **Jefe / supervisor** | CRM: cartera, distribute, review, historial, stale, reportes | Igual (+ reglas comerciales en ONE post-cutover) |
| **Caja** | CRM/Treasury: aplicar importe, OBS/boleteo | Igual |
| **Admin** | Todo + higiene widget | Todo |

**Asesor comercial ≠ responsable del chat.** Cubrir el inbox no transfiere venta ni comisión. Reasignar oportunidad (jefe) puede solicitar cambio de chat; son datos distintos.

Permiso módulo: `crm_educacion`. Restringir en App Users el acceso asesor a pantallas amplias cuando el modal WA de pago esté listo. En F5 retirar acceso asesor a CRM salvo alta excepcional / soporte.

Env servicio WA→ONE (lookup código): `CRM_EDUCACION_SERVICE_TOKEN` (header `x-crm-educacion-service-token`). Cutover: [crm-educacion-cutover.md](./crm-educacion-cutover.md). Inventario: [crm-educacion-crm-consumers.md](./crm-educacion-crm-consumers.md).
