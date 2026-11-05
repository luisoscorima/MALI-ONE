# Bóveda de contraseñas (password-vault)

> Changelog: [password-vault-CHANGELOG.md](./password-vault-CHANGELOG.md) · Índice: [README.md](./README.md)

## Qué es

Acceso embebido/enlace a Vaultwarden (`vault.mali.pe`) desde el admin. No almacena secretos en MALI ONE.

## Cómo funciona

Usuario con módulo `password_vault` abre `/vault` (página puente al vault externo).

## Código

- Web: `password-vault-page.tsx`
- Sin módulo Nest dedicado

## UI

| `/vault` | Acceso a Vaultwarden |

## API

N/A (cliente → vault externo).

## Datos (Prisma)

N/A

## Conexiones externas

| **Vaultwarden** (`FINANCE_VAULT_URL` / vault.mali.pe) | UI de credenciales |

Nota: el **worker Niubiz** de tesorería también usa Vaultwarden vía CLI (ver [treasury.md](./treasury.md)), con cuenta de servicio distinta del uso humano.

## Variables de entorno

UI humana: URL pública del vault. Worker finanzas: `FINANCE_VAULT_*` (solo servidor).

## Permisos

Módulo: `password_vault`

## Relacionados

- [treasury.md](./treasury.md)
