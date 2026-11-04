# Interactive local connectivity probe. Never prints or saves item credentials.
param([ValidateSet('password', 'apikey')][string]$AuthMode = 'apikey')
$ErrorActionPreference = 'Stop'
$probeRuntime = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin'
if (Test-Path (Join-Path $probeRuntime 'node.exe')) { $env:PATH = $probeRuntime + ';' + $env:PATH }
$probeCli = Join-Path $env:TEMP 'mali-vault-probe\node_modules\.bin\bw.cmd'
$probeReport = Join-Path $env:TEMP 'mali-vault-probe-result.txt'
$env:BITWARDENCLI_APPDATA_DIR = Join-Path $env:TEMP ('mali-vault-session-' + [guid]::NewGuid().ToString('N'))
$env:BW_NOINTERACTION = 'true'
$probePassword = $null
$probeApiSecret = $null
$probeItem = $null
$probeItems = $null
$probeSession = $null
$probeStage = 'CONFIGURAR_SERVIDOR'
$probeHint = 'No identificado'
$Host.UI.RawUI.WindowTitle = 'MALI ONE - Prueba Vaultwarden'
'EN_CURSO: esperando entrada local; sin resultado aun.' | Set-Content -LiteralPath $probeReport -Encoding UTF8
function Get-UnlockDiagnostic([string]$Message) {
    if ($Message -match 'invalid type: JsValue|expected a string|decryptManyLegacy') { return 'COMPATIBILIDAD_LECTURA_ELEMENTOS' }
    if ($Message -match 'user-key-id|KeyIdBackfill|User Decryption Options|404|not implemented') { return 'COMPATIBILIDAD_CLIENTE_SERVIDOR' }
    if ($Message -match 'Invalid master password|invalid password|incorrect password|password is incorrect|password.*invalid') { return 'CONTRASENA_MAESTRA_RECHAZADA' }
    if ($Message -match 'SSO|single.sign.on|trusted device|Key Connector|no master password') { return 'CUENTA_SSO_O_SIN_CONTRASENA_MAESTRA_COMPATIBLE' }
    if ($Message -match 'not logged in|unauthenticated|unauthorized|401') { return 'SESION_NO_AUTENTICADA' }
    if ($Message -match 'ENOTFOUND|ECONN|ETIMEDOUT|certificate|fetch failed') { return 'CONEXION_O_CERTIFICADO' }
    if ($Message -match 'decrypt|MAC|cipher|KDF|argon|key derivation') { return 'FALLO_DESCIFRADO_O_DERIVACION_DE_CLAVE' }
    if ($Message -match 'password.*required|password.*provided|password.*empty|password.*specified|password.*not set') { return 'NO_SE_RECIBIO_CONTRASENA' }
    if ($Message -match 'locked|too many|429|rate limit') { return 'BLOQUEO_O_LIMITE_DE_INTENTOS' }
    return 'DESBLOQUEO_RECHAZADO_SIN_CLASIFICAR'
}
try {
    $probeStage = 'VALIDAR_VERSION_CLI'
    $probeVersion = & $probeCli --version
    if ($LASTEXITCODE -ne 0 -or "$probeVersion".Trim() -ne '2026.6.0') {
        $probeHint = 'USAR_VERSION_VALIDADA_2026_6_0'
        throw 'Unexpected CLI version'
    }
    $probeStage = 'CONFIGURAR_SERVIDOR'
    & $probeCli config server https://vault.mali.pe | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo configurar el servidor.' }
    Write-Host 'Prueba local: testing@mali.pe -> Vaultwarden -> Niubiz Comercio'
    if ($AuthMode -eq 'apikey') {
        Write-Host 'Usa la API key PERSONAL de testing: Configuracion > Seguridad > Claves.'
        $env:BW_CLIENTID = Read-Host 'client_id'
        $probeApiSecret = Read-Host 'client_secret (oculto)' -AsSecureString
        $env:BW_CLIENTSECRET = [System.Net.NetworkCredential]::new('', $probeApiSecret).Password
    }
    Write-Host 'Escribe la clave MAESTRA de Vaultwarden de testing. No la de Niubiz.'
    $probePassword = Read-Host 'Clave maestra (oculta)' -AsSecureString
    $env:BW_PASSWORD = [System.Net.NetworkCredential]::new('', $probePassword).Password
    $probeStage = 'INICIAR_SESION'
    # Capture CLI diagnostics in memory and emit only a classified result.
    # Windows PowerShell can treat native stderr as terminating errors; capture it explicitly.
    $ErrorActionPreference = 'Continue'
    if ($AuthMode -eq 'apikey') {
        $probeLoginOutput = & $probeCli login --apikey 2>&1
    } else {
        $probeLoginOutput = & $probeCli login testing@mali.pe --passwordenv BW_PASSWORD --raw 2>&1
    }
    $probeLoginExit = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    $probeLoginText = ($probeLoginOutput | ForEach-Object { $_.ToString() }) -join "`n"
    if ($probeLoginExit -ne 0) {
        if ($probeLoginText -match 'user-key-id|KeyIdBackfill|User Decryption Options|404') { $probeHint = 'COMPATIBILIDAD_CLIENTE_SERVIDOR' }
        elseif ($probeLoginText -match 'API key|client_secret|authentication challenge|captcha') { $probeHint = 'REQUIERE_CLAVE_API_O_DESAFIO' }
        elseif ($probeLoginText -match 'two.step|two.factor|2FA|verification code') { $probeHint = 'REQUIERE_SEGUNDO_FACTOR' }
        elseif ($probeLoginText -match 'invalid.*password|password.*incorrect|Username or password') { $probeHint = 'CREDENCIALES_RECHAZADAS' }
        elseif ($probeLoginText -match 'ENOTFOUND|ECONN|ETIMEDOUT|certificate|fetch failed') { $probeHint = 'CONEXION_O_CERTIFICADO' }
        else { $probeHint = 'LOGIN_RECHAZADO_SIN_CLASIFICAR' }
        throw 'Login failed'
    }
    $env:BW_CLIENTSECRET = $null
    $env:BW_CLIENTID = $null
    if ($AuthMode -eq 'apikey') {
        $probeStage = 'DESBLOQUEAR_BOVEDA'
        $ErrorActionPreference = 'Continue'
        $probeLoginOutput = & $probeCli unlock --passwordenv BW_PASSWORD --raw 2>&1
        $probeLoginExit = $LASTEXITCODE
        $ErrorActionPreference = 'Stop'
        $probeLoginText = ($probeLoginOutput | ForEach-Object { $_.ToString() }) -join "`n"
        if ($probeLoginExit -ne 0) {
            $probeHint = Get-UnlockDiagnostic $probeLoginText
            throw 'Unlock failed'
        }
    }
    $probeSession = $probeLoginText.Trim()
    $probeLoginOutput = $null
    $probeLoginText = $null
    if ($LASTEXITCODE -ne 0) { throw 'Inicio de sesión fallido. Puede requerir API key, segundo factor o revisar compatibilidad de la CLI.' }
    $env:BW_PASSWORD = $null
    $env:BW_CLIENTID = $null
    $env:BW_CLIENTSECRET = $null
    if ($probeSession -isnot [string] -or $probeSession -notmatch '^[A-Za-z0-9+/]+=*$') { throw 'No se recibió una sesión válida.' }
    $env:BW_SESSION = $probeSession
    $probeStage = 'SINCRONIZAR_BOVEDA'
    $ErrorActionPreference = 'Continue'
    $probeCommandOutput = & $probeCli sync 2>&1
    $probeCommandExit = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($probeCommandExit -ne 0) {
        $probeHint = Get-UnlockDiagnostic (($probeCommandOutput | ForEach-Object { $_.ToString() }) -join "`n")
        throw 'Sync failed'
    }
    $probeCommandOutput = $null
    $probeStage = 'LEER_ELEMENTO'
    $ErrorActionPreference = 'Continue'
    $probeCommandOutput = & $probeCli list items --search 'Niubiz Comercio' 2>&1
    $probeCommandExit = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    $probeRaw = ($probeCommandOutput | ForEach-Object { $_.ToString() }) -join "`n"
    $probeCommandOutput = $null
    if ($probeCommandExit -ne 0) {
        $probeHint = Get-UnlockDiagnostic $probeRaw
        throw 'Read failed'
    }
    $probeItems = @($probeRaw | ConvertFrom-Json | Where-Object { $_.name -eq 'Niubiz Comercio' -and $_.organizationId -and -not $_.deletedDate })
    $probeRaw = $null
    $probeStage = 'VALIDAR_ELEMENTO'
    if ($probeItems.Count -ne 1) { $probeHint = 'ELEMENTO_AUSENTE_O_AMBIGUO'; throw 'No se encontró un único elemento Niubiz Comercio de la organización.' }
    $probeItem = $probeItems[0]
    if (-not $probeItem.login.username -or -not $probeItem.login.password) { $probeHint = 'CREDENCIALES_VACIAS_O_SIN_PERMISO'; throw 'El elemento no permite leer ambas credenciales.' }
    $probeResult = 'OK: usuario y contraseña de Niubiz accesibles. No se guardaron ni mostraron sus valores.'
    $probeResult | Set-Content -LiteralPath $probeReport -Encoding UTF8
    Write-Host $probeResult -ForegroundColor Green
} catch {
    # Do not serialize exception objects or captured CLI output: they may contain secrets.
    $probeResult = "ERROR: etapa=$probeStage; diagnostico=$probeHint"
    $probeResult | Set-Content -LiteralPath $probeReport -Encoding UTF8
    Write-Host $probeResult -ForegroundColor Yellow
} finally {
    $env:BW_PASSWORD = $null
    $env:BW_CLIENTID = $null
    $env:BW_CLIENTSECRET = $null
    $env:BW_SESSION = $null
    $probeSession = $null
    $probeItem = $null
    $probeItems = $null
    $probeLoginOutput = $null
    $probeLoginText = $null
    $probeRaw = $null
    $probeCommandOutput = $null
    if ($probePassword) { $probePassword.Dispose() }
    if ($probeApiSecret) { $probeApiSecret.Dispose() }
    try { & $probeCli logout 2>$null | Out-Null } catch { Write-Host 'No se pudo confirmar el cierre de sesion de la CLI.' }
}
Read-Host 'Pulsa Enter para cerrar'
