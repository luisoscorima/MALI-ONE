# Unificar la introducción de Accesos en el PageHeader

Written against: `6b6232ed85341cf32032691f2e98fe486697aaf4`

## Evidence chain

- Surface: `apps/web/src/pages/app-users-page.tsx` · ruta `/admin/app-users`
- Problem: Antes de la tarea (buscar / editar accesos) hay dos bloques instructivos que se solapan: `PageHeader` description (“Habilita qué módulos…”) y un `Card` que vuelve a decir que aquí se definen módulos, más hechos únicos (`@mali.pe`, admin con acceso completo).
- Design evidence: L104–L119 de `app-users-page.tsx`; patrón hermano sin card informativo: `admin-audit-page.tsx` L90–L99 (`PageHeader` + contenido de tarea).
- Owner: `apps/web/src/pages/app-users-page.tsx`
- Scope and affected surfaces: Solo el bloque intro (header + card informativo). El `Card` de búsqueda (L121–L127) no se toca.
- Uncertainty: Ninguna: los únicos hechos no redundantes del Card son login `@mali.pe` y acceso total del administrador.

## Design decision

Eliminar el `Card` informativo y concentrar la orientación en `PageHeader.description`, conservando solo la guía de tarea más los dos hechos únicos del Card. Queda una sola capa de instrucción, alineada con Auditoría admin.

## Reuse

- `PageHeader` (`apps/web/src/components/page-header.tsx`) prop `description`
- Exemplar de estructura de página: `apps/web/src/pages/admin-audit-page.tsx` (header → error → tabla, sin card de ayuda)

No crear componente de “info callout” nuevo.

## Changes

1. `apps/web/src/pages/app-users-page.tsx`
   - Change:
     - Reemplazar la `description` del `PageHeader` (hoy L106) por exactamente:
       > Los usuarios con cuenta @mali.pe inician sesión automáticamente. Aquí defines qué módulos ven en el menú. El administrador del sistema siempre tiene acceso completo.
     - Eliminar por completo el bloque:
       ```tsx
       <Card className="mb-6">
         <p className="text-sm text-muted">
           Los usuarios con cuenta <strong>@mali.pe</strong> pueden iniciar sesión
           automáticamente. Aquí defines qué módulos ven en el menú y pueden usar.
           El administrador del sistema siempre tiene acceso completo.
         </p>
       </Card>
       ```
     - Mantener el `Card` de búsqueda y el `Card` de la tabla.
     - Si tras quitar el Card informativo `Card` solo se usa para search/tabla, no eliminar el import de `Card`.
   - Preserve: Título “Accesos MALI ONE”; búsqueda; tabla; toasts; errores `AlertBanner`.
   - Verify: En el primer viewport solo hay un párrafo de ayuda bajo el título; no hay card gris de instrucciones encima del buscador; el copy conserva `@mali.pe` y “administrador del sistema”.

## Scope

- Inherit: Solo esta página.
- Verify: `/admin/app-users` tras load.
- Exclude: No cambiar copy de `EmptyState`; no docs salvo aceptación explícita; no tocar `admin-users-page` ni otros intros.

## Validation

- Product: Un admin entiende de un vistazo login `@mali.pe`, asignación de módulos y excepción del administrador, sin leer dos bloques.
- Interface: `/admin/app-users`; estados con/sin error banner (el banner sigue debajo del header).
- System: Misma composición PageHeader → (opcional Alert) → search Card → table Card que Auditoría/Workspace usan en espíritu.
- Repository: lint de `apps/web` → limpio; sin import `Card` huérfano.

## Stop conditions

- Stop if producto exige el callout visual separado (p. ej. onboarding permanente): no reintroducir el Card con el mismo texto duplicado; abrir decisión de producto nueva.

## Design documentation

- After acceptance and validation: none (o, si el equipo quiere, una línea en `docs/app-users.md` sección UI: “Intro vía PageHeader; sin card informativo”), solo tras merge del cambio.
