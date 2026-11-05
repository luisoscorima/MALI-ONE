# Changelog — treasury

Formato: entradas en orden inverso (lo más reciente arriba). Cada mejora del módulo debe registrarse aquí.

## [Unreleased]

- Mover `vaultItemId` a `TreasurySource` (multi-portal).
- Conectores BCP / otros portales.
- Separar permisos consulta vs configuración si contabilidad lo pide.

## [2026-11-05] — UI jerarquía + columnas de pago

- Página: fuentes → cabecera → operaciones; acciones en modales (Editar, Actualizar pagos API+Excel, Comercios lectura, Detalle).
- Inventario CRUD Niubiz fuera de la superficie principal; sync sigue con `niubiz-merchants.json`.
- Tabla: fecha, comercio, pedido, transacción, cliente, email, importe, estado; Tarjeta/Billetera opcionales.
- Persistencia aditiva: `customerEmail`, `cardBrand`, `cardType`, `cardLastDigits`, `wallet` (migración `20261105180000_treasury_payment_contact_card`). Lotes antiguos quedan null hasta re-sync/reimport.

## [2026-11-05] — baseline documental

Reorganización de la documentación por módulo. Contenido consolidado desde el código y la documentación previa del módulo.

- Inventario fuentes/targets; import XLSX; sync API Niubiz + Vaultwarden; búsqueda `q`.
- Cron 2h desactivado por defecto; 77 comercios canónicos.
