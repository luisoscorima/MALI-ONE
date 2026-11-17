# Estrechar columnas de módulo con encabezados verticales

Written against: `6b6232ed85341cf32032691f2e98fe486697aaf4`

## Evidence chain

- Surface: `apps/web/src/pages/app-users-page.tsx` · ruta `/admin/app-users`
- Problem: Cada columna de módulo mide ~89–180px solo por el texto de `APP_MODULES.label`, mientras la celda solo renderiza un `Checkbox` de `size-4` (~16px), inflando la matriz (~2987px).
- Design evidence: Headers en L136–L139 usan `{mod.label}` con `className="p-4 text-center"`; labels largos en `apps/web/src/lib/app-modules.ts` (p. ej. “Bóveda de Contraseñas”, “Transmisión a pantallas”); `TableHead` base aplica `whitespace-nowrap` (`apps/web/src/components/ui/table.tsx`).
- Owner: `apps/web/src/pages/app-users-page.tsx`
- Scope and affected surfaces: Solo `TableHead` (y padding de `TableCell`) de columnas generadas por `APP_MODULES.map`.
- Uncertainty: Ninguna sobre labels (no inventar abreviaturas). Orientación vertical puede alargar un poco la fila de header; aceptable frente al ancho horizontal.

## Design decision

Mantener el texto completo de `mod.label` y presentarlo en escritura vertical en el header de cada módulo, con padding horizontal reducido en header y celdas de checkbox, para que el ancho de columna lo dicte el control (~checkbox) y no la frase horizontal.

## Reuse

- `APP_MODULES[].label` y `description` sin cambios de copy
- `Checkbox`, `TableHead`, `TableCell` existentes
- Tailwind arbitrary / utilities: `[writing-mode:vertical-rl]`, anular `whitespace-nowrap` del `TableHead` base con `whitespace-normal`
- Exemplar de datos: `apps/web/src/lib/app-modules.ts` (fuente de labels)

No añadir labels cortos nuevos ni iconos de módulo: eso inventaría contrato de naming/iconografía.

## Changes

1. `apps/web/src/pages/app-users-page.tsx`
   - Change:
     - En el `TableHead` dentro de `APP_MODULES.map` (hoy L136–L139), reemplazar clases por algo equivalente a:
       - Contenedor th: `px-1.5 py-3 text-center align-bottom h-auto max-w-[2.5rem] whitespace-normal`
       - Contenido: envolver `{mod.label}` en `<span className="inline-block max-h-36 overflow-hidden text-ellipsis [writing-mode:vertical-rl] text-xs font-medium leading-tight">` (o `writing-vertical-rl` si el toolchain Tailwind del repo ya lo expone; preferir la utility nativa si existe en el proyecto).
       - Añadir `title={mod.label}` en el `th` o `span` para tooltip nativo si el texto se recorta en altura.
       - Opcional y recomendado: `title={mod.description}` no sustituye el label visible; si se usa un solo `title`, priorizar `mod.label` completo; no mezclar description en el texto visible del header.
     - En `TableCell` de cada módulo (L201): reducir padding horizontal a `px-1.5 py-4 text-center` (o `p-2 text-center`) para alinear el ancho con el header estrecho.
     - No modificar `min-w-[880px]` salvo que tras el cambio la tabla quede innecesariamente forzada; si el ancho natural baja, se puede bajar el `min-w` solo lo necesario para Usuario+Rol+Acciones+módulos, sin inventar un layout distinto.
   - Preserve: Orden e ids de módulos; `aria-label` de checkboxes; comportamiento checked/disabled de admin; sin cambios a `app-modules.ts`.
   - Verify: Headers legibles en vertical; columnas claramente más estrechas que antes; scroll horizontal total menor; checkboxes centrados bajo su header.

## Scope

- Inherit: Solo esta matriz.
- Verify: `/admin/app-users` con todos los módulos actuales del catálogo (labels cortos y largos).
- Exclude: No cambiar el primitivo `TableHead` global; no abreviaturas nuevas; no iconos; no pivotar a layout usuario→panel.

## Validation

- Product: Identificar un módulo por su label vertical y togglear el checkbox de esa columna.
- Interface: `/admin/app-users`; labels extremos (“Enlaces y QR”, “Transmisión a pantallas”, “Verificación de pagos”); dark/light si aplica.
- System: Labels siguen saliendo de `APP_MODULES`; sin segundo catálogo de nombres cortos.
- Repository: lint de `apps/web` → limpio en el archivo tocado.

## Stop conditions

- Stop if `writing-mode` vertical rompe alineación de checkbox de forma no corregible con padding/align (no pivotar a otra UI sin nuevo plan).
- Stop if el producto exige abreviaturas oficiales: eso es decisión de copy nueva, fuera de este plan.

## Design documentation

- After acceptance and validation: none.
