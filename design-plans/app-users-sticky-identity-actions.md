# Mantener Usuario y Guardar visibles al desplazar la matriz de módulos

Written against: `6b6232ed85341cf32032691f2e98fe486697aaf4`

## Evidence chain

- Surface: `apps/web/src/pages/app-users-page.tsx` · ruta `/admin/app-users`
- Problem: La fila exige identidad + toggles de módulo + Guardar, pero la tabla mide ~2987px en un contenedor ~637px; al mostrar Acciones, Usuario queda fuera del viewport (`left ≈ -2068`).
- Design evidence: Misma fila presenta `Usuario`, columnas `APP_MODULES`, y `Acciones`/`Guardar` como único commit por operador (`app-users-page.tsx` L133–L228). Patrón sticky de columna de identidad en `crm-pam-page.tsx` (`meta.className: 'sticky left-0 z-10 bg-background'`).
- Owner: `apps/web/src/pages/app-users-page.tsx`
- Scope and affected surfaces: Solo esa página (header + celdas de Usuario, Rol y Acciones).
- Uncertainty: Ninguna sobre el problema. El ancho exacto de Usuario puede variar con nombres largos; fijar `min-w`/`w` en Usuario evita solapar Rol sticky.

## Design decision

Hacer sticky horizontal la identidad (`Usuario` + `Rol`) a la izquierda y `Acciones` a la derecha, con fondo opaco `bg-card` (la tabla vive dentro de `Card` con `bg-card`, no `bg-background`). Así el admin puede recorrer módulos sin perder a quién edita ni el botón Guardar.

## Reuse

- Utilidades Tailwind ya usadas en el producto: `sticky`, `left-0`, `right-0`, `z-10`/`z-20`, `bg-card`
- Componentes existentes: `TableHead`, `TableCell` de `@/components/ui`
- Exemplar: `apps/web/src/pages/crm-pam-page.tsx` columna `name` con `sticky left-0 z-10 bg-background` (adaptar fondo a `bg-card` por contexto Card)

No crear primitivo compartido: el sticky es local a esta matriz.

## Changes

1. `apps/web/src/pages/app-users-page.tsx`
   - Change:
     - Eliminar el wrapper redundante `<div className="overflow-x-auto">` alrededor de `<Table>` (L130–L131 / cierre L235). `Table` ya provee `data-slot="table-container"` con `relative w-full overflow-x-auto` en `apps/web/src/components/ui/table.tsx`; un solo scrollport es requisito para que `position: sticky` funcione de forma predecible.
     - En header y celdas de **Usuario**: `className` que incluya `sticky left-0 z-20 bg-card p-4` y ancho estable, p. ej. `min-w-[14rem] w-[14rem]` (o `w-56`), más `border-r border-border/60` para separar del scroll.
     - En header y celdas de **Rol**: `sticky z-20 bg-card p-4` con `left` igual al ancho fijado de Usuario (`left-56` si Usuario es `w-56`), más `border-r border-border/60`.
     - En header y celdas de **Acciones**: `sticky right-0 z-20 bg-card p-4` más `border-l border-border/60`.
     - Asegurar que el `TableRow` hover (`hover:bg-muted/50`) no deje transparentes las celdas sticky: en esas celdas sticky añadir `group-hover/…` solo si el row ya expone group; si el hover del tr se ve mal bajo sticky, preferir `bg-card` sólido (aceptable) antes de inventar un sistema de hover nuevo.
   - Preserve: Orden de columnas (Usuario → Rol → módulos → Acciones); lógica de drafts/save; badges; checkboxes; EmptyState/TableSkeleton colSpans.
   - Verify: Con viewport estrecho (~1000px total / ~600px de contenido), al hacer scroll horizontal hasta el último módulo, nombre/email y Guardar (o “Acceso total”) permanecen visibles; el contenido de módulos no se ve a través de las celdas sticky.

## Scope

- Inherit: Ningún otro consumer; cambio solo en clases de esta página.
- Verify: Visualmente `/admin/app-users` en dark (estado actual de dev) y, si aplica, light.
- Exclude: No cambiar `Table` primitivo global; no sticky en otras páginas admin; no reordenar columnas; no auto-save.

## Validation

- Product: Abrir Accesos, editar un checkbox de un módulo hacia el final de la lista, confirmar que se ve el usuario y Guardar sin perder el scroll de módulos; Guardar sigue deshabilitado sin cambios y habilita con cambios.
- Interface: `/admin/app-users`; filas admin (“Acceso total”) y operador; loading skeleton y empty; scroll horizontal extremo izquierda/derecha.
- System: Mismo patrón sticky que CRM PAM, fondo `bg-card` por contexto Card; sin segundo `overflow-x-auto`.
- Repository: `npm run lint --workspace=apps/web` (o el comando de lint del monorepo que use el repo) → sin errores nuevos en `app-users-page.tsx`.

## Stop conditions

- Stop if sticky falla porque otro ancestro crea un scrollport distinto (inspeccionar y no parchear `table.tsx` global sin acuerdo).
- Stop if fijar ancho de Usuario recorta emails de forma inaceptable: entonces sticky solo `Usuario` + `Acciones` (Rol scrollea) en lugar de ampliar el alcance a un layout nuevo.

## Design documentation

- After acceptance and validation: none (decisión local de presentación; `docs/app-users.md` no documenta layout de columnas).
