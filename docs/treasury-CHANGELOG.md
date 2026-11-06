# Changelog — treasury

Formato: entradas en orden inverso (lo más reciente arriba). Cada mejora del módulo debe registrarse aquí.

## [Unreleased]

- Conectores BCP / otros portales.
- Separar permisos consulta vs configuración si contabilidad lo pide.

## [2026-11-05] — PagoEfectivo y token único de Mercado Pago

- Persistencia por fuente (`PagoEfectivoPayment`, `PagoEfectivoSyncState`, `payload`) y migración `20261105233000_pagoefectivo_sync`.
- El ítem de Vaultwarden de PagoEfectivo guarda `accessKey`, `secretKey` e `idService`. No hay variables de entorno de esa API. La consulta de movimientos queda pendiente del contrato oficial.
- Mercado Pago sincroniza solo con `access_token`, en páginas de 50, filtrando por fecha de creación. Se quitó `client_id` / `client_secret`.

## [2026-11-05] — registro del portal en cada venta

- `TreasuryPayment.payload` y `MercadoPagoPayment.payload` guardan la venta recibida de la API, sin número de tarjeta ni documento del pagador.
- Una importación Excel de Niubiz no borra ese registro. La próxima sincronización de la API lo completa. Las ventas ya guardadas siguen con el campo vacío hasta entonces.

## [2026-11-05] — conector Mercado Pago preparado

- Persistencia por fuente (`MercadoPagoPayment`, `MercadoPagoSyncState`) y migración `20261105230000_mercadopago_sync`.
- Listado, filtros, actualización manual y detalle de venta en la fuente Mercado Pago.
- Lectura segura desde Vaultwarden de `access_token` o `client_id` + `client_secret`; no se persisten tokens. La venta queda en columnas y en `payload`, ya recortada.
- Pendiente: primera consulta real y validación de campos con credenciales productivas. El login web asistido requiere un perfil de navegador persistente del servidor; no se copian cookies de navegadores personales.
- Runtime renombrado de `niubiz-runtime` a `finance-runtime`; Node/Bitwarden/Playwright son infraestructura compartida y cada conector conserva solo su script específico.

## [2026-11-05] — vaultItemId en UI por fuente

- `TreasurySource.vaultItemId` editable en Editar fuente; sync Niubiz lo usa (fallback opcional `FINANCE_VAULT_NIUBIZ_ITEM_ID`).
- Migración `20261105210000_treasury_source_vault_item`. Toggle renombrado a «Fuente activa».

## [2026-11-05] — formulario de fuente reducido

- Quitado “Titular / razón social” del modal y de la cabecera; `legalEntity` sigue en DB y la API lo rellena con la entidad del proveedor si no viene.

## [2026-11-05] — UI jerarquía + columnas de pago

- Página: fuentes → cabecera → operaciones; acciones en modales (Editar, Actualizar pagos API+Excel, Comercios lectura, Detalle).
- Inventario CRUD Niubiz fuera de la superficie principal; sync sigue con `niubiz-merchants.json`.
- Tabla: fecha, comercio, pedido, transacción, cliente, email, importe, estado; Tarjeta/Billetera opcionales.
- Persistencia aditiva: `customerEmail`, `cardBrand`, `cardType`, `cardLastDigits`, `wallet` (migración `20261105180000_treasury_payment_contact_card`). Lotes antiguos quedan null hasta re-sync/reimport.

## [2026-11-05] — baseline documental

Reorganización de la documentación por módulo. Contenido consolidado desde el código y la documentación previa del módulo.

- Inventario fuentes/targets; import XLSX; sync API Niubiz + Vaultwarden; búsqueda `q`.
- Cron 2h desactivado por defecto; 77 comercios canónicos.
