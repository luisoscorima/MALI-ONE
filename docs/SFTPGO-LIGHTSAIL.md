# SFTPGo en Windows Lightsail — disco para MALI ONE

MALI ONE no monta el disco: **SFTPGo** es el motor (listar, subir, bajar, permisos). La API NestJS actúa de BFF con la cookie Google de MALI ONE y llama a la REST API de SFTPGo con una API key. El navegador nunca ve secretos de SFTPGo.

```
Usuario @mali.pe → MALI ONE (Google JWT) → Nest /api/files
  → HTTP http://172.26.4.218:8080 (VPC peering)
  → SFTPGo User API → D:\tms_media
```

Producción actual: **HTTP en la red privada**. No hace falta DNS ni TLS porque el tráfico no sale a internet (EC2 default VPC ↔ Lightsail, misma región `us-east-1`).

## 1. Instancia y disco

Carpeta real en Windows TMS:

```text
D:\tms_media
```

`SYSTEM` (cuenta del servicio SFTPGo) ya tiene Full Control; no hace falta `icacls` extra.

## 2. Instalar SFTPGo

Community 2.7.x como servicio Windows (`winget install -e --id drakkan.SFTPGo` o el installer oficial).

```powershell
Get-Service *sftpgo*
# Running  SFTPGo
# HTTP en 0.0.0.0:8080
```

Config: `C:\ProgramData\SFTPGo\`.

## 3. Red (HTTP privado, sin DNS)

| Recurso | Valor |
|---------|--------|
| EC2 MALI ONE | default VPC `172.31.0.0/16`, IP privada `172.31.47.32` |
| Windows Lightsail | IP privada `172.26.4.218`, HTTP `8080` |
| Peering | Lightsail ↔ default VPC `us-east-1` (Account → Advanced) |

IPs públicas (`3.210.230.147` / `44.194.58.189`) **no** se usan para esta integración. No abras `8080` ni `2022` en el firewall público de Lightsail.

### Firewall de Windows

Solo el EC2:

```powershell
New-NetFirewallRule `
  -DisplayName "SFTPGo API - MALI ONE" `
  -Direction Inbound `
  -Protocol TCP `
  -LocalPort 8080 `
  -RemoteAddress 172.31.47.32 `
  -Action Allow `
  -Profile Any
```

Deshabilita la regla amplia `SFTPGo Service` que crea el instalador (`Any/Any`).

El firewall de Lightsail **no** filtra tráfico por IP privada; el de Windows sí.

### Conflicto Docker `172.26.0.0/16` en el EC2

Si otra red Docker (p. ej. SIGE2) usa `172.26.0.0/16`, Linux enruta `172.26.4.218` al bridge y da `No route to host`. Ruta persistente `/32` en Netplan (`/etc/netplan/99-sftpgo-route.yaml`):

```yaml
network:
  version: 2
  ethernets:
    ens5:
      routes:
        - to: 172.26.4.218/32
          via: 172.31.32.1
```

Comprueba: `ip route get 172.26.4.218` debe salir por `ens5` con `src 172.31.47.32`.

HTTPS público (Let’s Encrypt, DNS, puerto 443) es opcional y no está en uso.

## 4. Usuario de integración

- Usuario SFTPGo: `mali-one`
- Storage: Local disk
- Root: `D:\tms_media` → `/` en la REST API es esa carpeta
- Permisos: list, download, upload, overwrite, delete, create dirs, rename
- **Allow API key authentication**
- API key de scope **User** (header `X-SFTPGO-API-KEY`)

`SFTPGO_ROOT_PREFIX` se deja vacío.

## 5. Probar la API (HTTP)

Desde el contenedor `mali-one-api-1` o el host EC2:

```bash
curl -sS -H "X-SFTPGO-API-KEY: TU_API_KEY" \
  "http://172.26.4.218:8080/api/v2/user/dirs?path=/"
```

Debe listar `Objetos`, `thumbnails`, etc.

## 6. Variables en MALI ONE

`env_file: .env` del servicio `api` (no interpolar la API key en Compose: puede contener `$`).

```env
SFTPGO_BASE_URL=http://172.26.4.218:8080
SFTPGO_API_KEY=tu_api_key_de_usuario
# SFTPGO_ROOT_PREFIX=
```

Sin barra final. `http://` es correcto en esta topología.

Recrear solo la API:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --no-deps api
```

El módulo `files` proxyfica:

- `GET /api/files` — listar
- `POST /api/files/mkdir`
- `POST /api/files/upload`
- `GET /api/files/download`
- `POST /api/files/rename`
- `DELETE /api/files`

## 7. Hardening

- WebAdmin (`:8080/web/admin`) solo desde RDP o IP allowlist; no exponer `8080` a internet.
- No exponer SFTP (2022) a `0.0.0.0/0`.
- API key solo en `.env` de Nest; rotar si se filtra.
- CORS en SFTPGo no es necesario: Nest habla server-to-server.
- Backups / snapshots de `D:\tms_media`.

## 8. Checklist go-live

1. `D:\tms_media` accesible por `SYSTEM`.
2. SFTPGo en HTTP `8080`, REST API on, peering + ruta `/32` OK.
3. Usuario `mali-one` + API key: curl list dirs = 200.
4. `SFTPGO_BASE_URL=http://172.26.4.218:8080` y `SFTPGO_API_KEY` en `.env`; recrear `api`.
5. Módulo `files` asignado al usuario en Accesos MALI ONE.
6. Abrir `/files`: listar, crear carpeta, subir, bajar, borrar.
