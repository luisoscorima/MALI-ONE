# Documentación MALI ONE — por módulo

Cada módulo de producto/código tiene **dos** archivos:

| Archivo | Contenido |
|---------|-----------|
| `<modulo>.md` | Descripción, funcionamiento, código, API, datos, conexiones externas, env y permisos |
| `<modulo>-CHANGELOG.md` | Registro evolutivo (Added / Changed / Fixed) |

Convención de nombres: kebab-case alineado a `apps/api/src/modules/<modulo>/` (salvo `plataforma`, transversal).

## Índice

### Plataforma y acceso

| Módulo | Doc | Changelog |
|--------|-----|-----------|
| Plataforma (Docker, NPM, OAuth, S3 base) | [plataforma.md](./plataforma.md) | [CHANGELOG](./plataforma-CHANGELOG.md) |
| Auth Google | [auth-google.md](./auth-google.md) | [CHANGELOG](./auth-google-CHANGELOG.md) |
| Accesos MALI ONE | [app-users.md](./app-users.md) | [CHANGELOG](./app-users-CHANGELOG.md) |
| Auditoría admin | [admin-audit.md](./admin-audit.md) | [CHANGELOG](./admin-audit-CHANGELOG.md) |
| Usuarios Workspace | [google-admin.md](./google-admin.md) | [CHANGELOG](./google-admin-CHANGELOG.md) |
| Bóveda de contraseñas | [password-vault.md](./password-vault.md) | [CHANGELOG](./password-vault-CHANGELOG.md) |

### Operaciones

| Módulo | Doc | Changelog |
|--------|-----|-----------|
| Enlaces y QR | [links.md](./links.md) | [CHANGELOG](./links-CHANGELOG.md) |
| Gestor S3 | [s3-manager.md](./s3-manager.md) | [CHANGELOG](./s3-manager-CHANGELOG.md) |
| Archivos TMS (SFTPGo) | [sftpgo-files.md](./sftpgo-files.md) | [CHANGELOG](./sftpgo-files-CHANGELOG.md) |
| Transmisión a pantallas | [screen-cast.md](./screen-cast.md) | [CHANGELOG](./screen-cast-CHANGELOG.md) |
| Kardex Bsale | [bsale.md](./bsale.md) | [CHANGELOG](./bsale-CHANGELOG.md) |
| Verificación de pagos | [treasury.md](./treasury.md) | [CHANGELOG](./treasury-CHANGELOG.md) |

### Contenido y CRMs

| Módulo | Doc | Changelog |
|--------|-----|-----------|
| Landings | [landings.md](./landings.md) | [CHANGELOG](./landings-CHANGELOG.md) |
| Boletines | [newsletters.md](./newsletters.md) | [CHANGELOG](./newsletters-CHANGELOG.md) |
| CRM PAM | [crm-pam.md](./crm-pam.md) | [CHANGELOG](./crm-pam-CHANGELOG.md) |
| CRM Educación | [crm-educacion.md](./crm-educacion.md) | [CHANGELOG](./crm-educacion-CHANGELOG.md) |
| Catálogo Educación | [catalog-educacion.md](./catalog-educacion.md) | [CHANGELOG](./catalog-educacion-CHANGELOG.md) |
| PAM (admin / ledger) | [pam.md](./pam.md) | [CHANGELOG](./pam-CHANGELOG.md) |

### Widgets embebidos

| Módulo | Doc | Changelog |
|--------|-----|-----------|
| Widgets (visión + embeds) | [widgets.md](./widgets.md) | [CHANGELOG](./widgets-CHANGELOG.md) |

### Gestión interna

| Módulo | Doc | Changelog |
|--------|-----|-----------|
| Portafolio de área | [todos.md](./todos.md) | [CHANGELOG](./todos-CHANGELOG.md) |

## Cliente CRM compartido

`apps/api/src/modules/crm/` no es un módulo de producto con UI propia: es el **cliente HTTP global** hacia mali-whatsapp (`WHATSAPP_CRM_*`). Documentado en los consumidores: [crm-pam.md](./crm-pam.md), [crm-educacion.md](./crm-educacion.md), [widgets.md](./widgets.md), [catalog-educacion.md](./catalog-educacion.md), [pam.md](./pam.md).

## Cómo mantener

1. Al tocar un módulo, actualiza su `<modulo>.md` si cambia comportamiento, API o conexiones.
2. Añade una entrada en `<modulo>-CHANGELOG.md` (sección `[Unreleased]` o fecha del día).
3. No crees docs sueltos en la raíz de `docs/`; usa el par módulo + changelog.
