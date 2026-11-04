# Niubiz: primer despliegue

Esta fase guarda y muestra ventas en Finanzas → Verificación de pagos. No convierte leads, no concilia abonos bancarios y no interpreta una venta denegada como pago confirmado.

## Qué está implementado

- Vaultwarden entrega el usuario y contraseña de Niubiz mediante el UUID del elemento compartido. Bitwarden CLI está fijado en **2026.6.0**, versión que funcionó en la prueba local; se ejecuta con Node 24 aislado del Node de la API.
- Chromium abre el formulario normal de Niubiz, completa sus campos y espera la respuesta de login. No resuelve ni evita desafíos CAPTCHA/MFA. El token permanece en memoria durante la ejecución. Si vence o llega un HTTP 401, intenta iniciar sesión de nuevo, con un máximo de tres logins por ejecución.
- `POST /order` con `export:true` alimenta directamente PostgreSQL. La lista canónica está en `apps/api/src/modules/treasury/niubiz-merchants.json`: 77 comercios. No depende del Excel ni del inventario editable de fuentes.
- Identidad única: proveedor + comercio + código de transacción. Repetir el rango actualiza estados sin duplicar. No se guardan PAN, correos de clientes ni respuestas completas de Niubiz.
- Guardado atómico por comercio, estado de la última ejecución y resultados por comercio. Una consulta fallida no equivale a cero operaciones. Las ejecuciones parciales conservan los comercios guardados. Reintentar el mismo rango recupera los pendientes.
- Dos horas entre ejecuciones programadas (00:00, 02:00, etc., Lima), consultando hoy y los 31 días anteriores. Un rango manual permite recuperar períodos anteriores, de hasta 32 días cada vez. Las operaciones anteriores a esa ventana solo se revisan mediante un rango manual.
- Bloqueo distribuido en PostgreSQL para evitar ejecuciones simultáneas. El bloqueo dura 90 minutos ante una caída del proceso; al vencer se muestra como interrumpida. Las ejecuciones tienen un límite de 45 minutos más la solicitud en curso y no se reanudan en medio de un comercio después de un reinicio.
- Tres intentos por comercio para errores transitorios/exportación pendiente, una pausa entre comercios y detención ante HTTP 429. Si se alcanza el límite conservador de 5000 filas o el total declarado supera las filas recibidas, no se guarda ese comercio: volver a consultar un rango menor.

## Configuración del servidor

En el `.env` de producción, **solo en el servidor**, completa:

```dotenv
NIUBIZ_SYNC_ENABLED=false
FINANCE_VAULT_URL=https://vault.mali.pe
FINANCE_VAULT_CLIENT_ID='user.UUID_DE_TESTING'
FINANCE_VAULT_CLIENT_SECRET='CLAVE_API_REGENERADA'
FINANCE_VAULT_MASTER_PASSWORD='CLAVE_MAESTRA_DE_TESTING'
FINANCE_VAULT_NIUBIZ_ITEM_ID='UUID_DEL_ELEMENTO_NIUBIZ_COMERCIO'
```

Usar la API key personal de la cuenta que tiene acceso al elemento en la colección FINANZAS. La clave maestra corresponde a esa misma cuenta de Vaultwarden. No es la contraseña de Niubiz. Para obtener el ID del elemento, abre **Niubiz Comercio** en la caja fuerte web y copia el UUID del parámetro `itemId` de la URL si esa versión lo muestra; alternativamente, con una CLI ya desbloqueada usa `bw list items --search 'Niubiz Comercio'` filtrando la salida **solo al campo `id`**, sin imprimir el objeto completo. No confundir el ID del elemento con el de colección u organización.

Las comillas simples en el `.env` de Docker Compose conservan los `$` literales; si el secreto contiene comillas simples, aplicar el escape documentado de Compose y comprobarlo sin imprimir su valor. No poner estos valores en variables `VITE_`, en el repositorio ni en el chat. El servidor necesita acceso de red a Vaultwarden, Niubiz y los recursos de su formulario de acceso. Para producción conviene una cuenta de bóveda dedicada con acceso solo a los elementos necesarios; `testing` sirve para esta primera prueba.

La imagen API incluye Chromium y las dependencias de login. `NIUBIZ_RUNTIME_NODE`, `NIUBIZ_LOGIN_SCRIPT` y `PLAYWRIGHT_BROWSERS_PATH` ya están definidos en el Dockerfile; no sobrescribirlos con rutas Windows en producción. El build descarga CLI y navegador y aumenta el tamaño de la imagen.

El `.env` permite que el servicio se recupere después de un reinicio sin intervención. Quien tenga acceso administrativo al host/contenedor también puede acceder a estos secretos: limitar permisos del archivo y de la cuenta. La bóveda de Niubiz sigue siendo Vaultwarden; no se crea una segunda bóveda en la base de datos. El worker usa un directorio temporal para el caché cifrado del CLI y lo elimina al terminar normalmente; un cierre forzado puede dejar ese caché temporal cifrado hasta recrear el contenedor.

## Despliegue y prueba

1. Commit de los cambios revisados, incluyendo las dos migraciones de pagos y sincronización, el JSON de comercios y `scripts/niubiz-runtime/package-lock.json`. No incluir `.env`, Excel ni secretos. Los cambios ajenos de Educación no forman parte de esta funcionalidad.
2. En el servidor, usando el procedimiento habitual de este repositorio, reconstruir y recrear API y web:

   ```sh
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build api web
   ```

   El entrypoint de API aplica las migraciones con `prisma migrate deploy` antes de iniciar. Respaldar PostgreSQL mediante el procedimiento habitual antes de migrar.
3. Entrar en MALI ONE con rol administrador y acceso al módulo. En **Finanzas → Verificación de pagos**, comprobar que aparece «Conexión configurada». Esto solo confirma presencia de variables, no que las credenciales sean válidas.
4. Seleccionar `2026-10-01` a `2026-10-31`, pulsar **Sincronizar pagos** y esperar el resultado de los 77 comercios. La UI consulta el avance y actualiza la tabla. La referencia autenticada previa fue de 694 operaciones en cinco comercios, incluidas 252 del `650177853`; la fuente puede haber cambiado desde esa consulta.
5. Filtrar el comercio `650177853`, revisar cantidades/estados y repetir el rango. La segunda ejecución debe mostrar cero nuevos si la fuente no cambió. Confirmar el origen «API Niubiz» en el último lote y que los datos persisten al recargar.
6. Si el login se bloquea, la UI mostrará un diagnóstico seguro: `VAULT_AUTH`, `VAULT_UNLOCK`, `VAULT_ITEM`, `NIUBIZ_LOGIN_REQUIRED` o fallo de runtime. Resolver esa causa antes de activar el cron. Si Niubiz exige un desafío interactivo desde el servidor, **este conector no lo supera automáticamente**: faltaría incorporar un flujo asistido o acordar un acceso API con Niubiz.
7. Solo después de esa prueba, cambiar `NIUBIZ_SYNC_ENABLED=true` y recrear la API. La siguiente hora par de Lima ejecutará la actualización. Cambiar a `false` y recrear la API desactiva futuras ejecuciones; no borra los pagos.

## Validación de desarrollo

Los builds de shared, API y web y las pruebas locales cubren persistencia, identidad única, rangos, bloqueo concurrente, renovación por 401, rechazos de esquema y ejecuciones parciales. `scripts/validate-niubiz-sync.cjs` usa una PostgreSQL local aislada y respuestas API simuladas, nunca secretos o producción. Ejecutarlo después de compilar y aplicar migraciones locales; solo acepta `127.0.0.1:55439/mali_niubiz_local`.

El login automático completo desde el servidor de producción **aún requiere la prueba del paso 4** con la clave API regenerada. Las consultas API reales de los 77 comercios y la lectura de Vaultwarden se verificaron previamente por separado; eso no demuestra que reCAPTCHA acepte el Chromium del servidor.

Validación realizada el 4 de noviembre de 2026: builds shared/API/web correctos, migración aplicada únicamente a PostgreSQL local, pruebas del conector e importación correctas y revisión visual del panel. La imagen API completa se construyó en Docker; dentro de esa imagen arrancaron Chromium y Bitwarden CLI 2026.6.0 con la red deshabilitada. No se ejecutó un despliegue ni se guardaron las credenciales regeneradas.
