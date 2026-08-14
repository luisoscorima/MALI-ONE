# SFTPGo en Windows Lightsail — disco para MALI ONE

MALI ONE no monta el disco: **SFTPGo** es el motor (listar, subir, bajar, permisos). La API NestJS actúa de BFF con la cookie Google de MALI ONE y llama a la REST API de SFTPGo con una API key. El navegador nunca ve secretos de SFTPGo.

```
Usuario @mali.pe → MALI ONE (Google JWT) → Nest /api/files → SFTPGo User API → Disco Windows
```

## 1. Instancia y disco

1. Crea o usa una instancia **Lightsail Windows**.
2. Adjunta un disco adicional y asígnalo a una letra (ej. `D:`).
3. Crea la carpeta raíz del compartido, por ejemplo:
   ```powershell
   New-Item -ItemType Directory -Force -Path "D:\mali-files"
   ```

## 2. Instalar SFTPGo

### Opción A — Installer oficial

1. Descarga el instalador Windows desde [sftpgo.com](https://sftpgo.com) / GitHub releases (`sftpgo_*_windows_x86_64.exe` o el MSI Enterprise si aplica).
2. Instala como **servicio Windows**.
3. Config por defecto:
   - Community: `C:\ProgramData\SFTPGo\`
   - Enterprise: `C:\ProgramData\SFTPGo Enterprise\`
4. Variables de entorno del servicio: carpeta `env.d\` dentro del directorio de config (cualquier archivo de texto se carga al arrancar).

### Opción B — winget

```powershell
winget install -e --id drakkan.SFTPGo
# o Enterprise si tienes licencia:
# winget install -e --id drakkan.SFTPGoEnterprise
```

Comprueba el servicio:

```powershell
Get-Service *sftpgo*
```

## 3. Red y TLS

Abre en el firewall de Windows / Lightsail **solo** lo necesario:

| Puerto | Uso | Recomendación |
|--------|-----|----------------|
| 443 (o 8080 detrás de proxy) | WebAdmin + REST API HTTPS | Obligatorio para MALI ONE |
| 2022 | SFTP | Cerrado a internet si solo usáis la API vía Nest; o restringido a IP de la API MALI ONE |

TLS (elige una):

- **win-acme** / Let’s Encrypt en el propio SFTPGo (`enable_https` + cert/key).
- Reverse proxy (Caddy/Nginx) delante en 443.
- Load balancer Lightsail con certificado.

La API de Nest debe llamar siempre a `https://…` (`SFTPGO_BASE_URL`).

## 4. Primer arranque (admin)

1. Abre `https://TU-HOST/web/admin` (o el puerto configurado).
2. Crea el administrador inicial.
3. Confirma que **REST API** está habilitada (`enable_rest_api: true` en el binding `httpd`).

Ejemplo mínimo de binding (variables o `sftpgo.json`):

```json
{
  "httpd": {
    "bindings": [
      {
        "port": 443,
        "address": "",
        "enable_web_admin": true,
        "enable_web_client": true,
        "enable_rest_api": true,
        "enable_https": true,
        "certificate_file": "C:\\\\ProgramData\\\\SFTPGo\\\\certs\\\\fullchain.pem",
        "certificate_key_file": "C:\\\\ProgramData\\\\SFTPGo\\\\certs\\\\privkey.pem"
      }
    ]
  }
}
```

## 5. Usuario de integración y disco

### MVP — disco compartido (recomendado al inicio)

1. En WebAdmin → Users → crea usuario `mali-shared`.
2. **Home Dir** = `D:\mali-files` (ruta absoluta).
3. Storage = **Local filesystem**.
4. Permisos: list, download, upload, overwrite, delete, create dirs, rename (según política).
5. Habilita **Allow API key authentication** en el usuario.
6. Crea una API key asociada a ese usuario (o una key genérica + impersonación `KEY.mali-shared`).

Permisos NTFS para la cuenta del servicio (por defecto `LOCAL SYSTEM`):

```powershell
icacls "D:\mali-files" /grant "SYSTEM:(OI)(CI)F" /T
```

Si cambias la identidad del servicio, otorga a esa cuenta en su lugar.

### Fase 2 — carpetas por persona

Home base `D:\mali-files\{email}` y mapeo en Nest (`req.user.email` → prefijo). Misma API; solo cambia el root lógico.

## 6. Probar la API (curl)

Sustituye host, user y key:

```bash
# Listar raíz (API key de usuario)
curl -sS -H "X-SFTPGO-API-KEY: TU_API_KEY" \
  "https://sftpgo.ejemplo.com/api/v2/user/dirs?path=/"

# Crear carpeta
curl -sS -X POST -H "X-SFTPGO-API-KEY: TU_API_KEY" \
  "https://sftpgo.ejemplo.com/api/v2/user/dirs?path=/prueba"

# Subir archivo
curl -sS -X POST -H "X-SFTPGO-API-KEY: TU_API_KEY" \
  -F "filenames=@./hola.txt" \
  "https://sftpgo.ejemplo.com/api/v2/user/files?path=/prueba&mkdir_parents=true"

# Descargar
curl -sS -H "X-SFTPGO-API-KEY: TU_API_KEY" \
  -o hola-desc.txt \
  "https://sftpgo.ejemplo.com/api/v2/user/files?path=/prueba/hola.txt"
```

Token JWT alternativo (caduca ~20 min):

```bash
TOKEN=$(curl -sS -u "mali-shared:PASSWORD" \
  "https://sftpgo.ejemplo.com/api/v2/user/token" | jq -r .access_token)
curl -sS -H "Authorization: Bearer $TOKEN" \
  "https://sftpgo.ejemplo.com/api/v2/user/dirs?path=/"
```

## 7. Variables en MALI ONE

En `.env` de la API:

```env
SFTPGO_BASE_URL=https://sftpgo.ejemplo.com
SFTPGO_API_KEY=tu_api_key_de_usuario
# Opcional: prefijo dentro del home del usuario SFTPGo
# SFTPGO_ROOT_PREFIX=
```

Reinicia el contenedor/servicio `api`. El módulo `files` en MALI ONE proxyficará:

- `GET /api/files` — listar
- `POST /api/files/mkdir`
- `POST /api/files/upload`
- `GET /api/files/download`
- `POST /api/files/rename`
- `DELETE /api/files`

## 8. Hardening

- WebAdmin solo por VPN o IP allowlist (firewall Lightsail).
- No exponer SFTP (2022) a `0.0.0.0/0` si no hace falta.
- API key solo en secrets de Nest; rotar si se filtra.
- Deshabilitar protocolos no usados (FTP/WebDAV) en el usuario.
- CORS en SFTPGo no es necesario: Nest habla server-to-server.
- Backups del disco `D:\mali-files` (snapshots Lightsail).

## 9. OIDC Google (opcional, fuera de MALI ONE)

Si alguien debe entrar al WebClient de SFTPGo directamente, configura OIDC con Google Workspace (`config_url=https://accounts.google.com`, `username_field=email`, redirect a tu host SFTPGo). **No es necesario** para el explorador embebido en MALI ONE (ese flujo usa la cookie de MALI ONE + API key).

## 10. Checklist go-live

1. Disco montado y `D:\mali-files` accesible por el servicio.
2. SFTPGo en HTTPS con REST API on.
3. Usuario `mali-shared` + API key OK (curl list dirs).
4. `SFTPGO_BASE_URL` + `SFTPGO_API_KEY` en la API MALI ONE.
5. Módulo `files` asignado al usuario en Accesos MALI ONE.
6. Abrir `/files` en la app: listar, crear carpeta, subir, bajar, borrar.
