# ═══════════════════════════════════════════════════════════════════════════
# ResellHub - Script de Deploy v2.3
# Soporta builds en la nube (EAS) y builds locales (cuando cuota agotada)
# Incluye verificacion automatizada de entorno Android
# ═══════════════════════════════════════════════════════════════════════════

param(
    [switch]$Local,
    [switch]$Cloud,
    [switch]$Check,
    [switch]$Help
)

# --- Colores ---
$Colors = @{
    Primary = "Cyan"
    Success = "Green"
    Warning = "Yellow"
    Error   = "Red"
    Info    = "White"
    Magenta = "Magenta"
}

# --- Funcion: Mostrar guia de instalacion de Android SDK ---
function Show-AndroidSetupGuide {
    Write-Host ""
    Write-Host "===============================================================" -ForegroundColor $Colors.Error
    Write-Host "  [X] ANDROID SDK NO CONFIGURADO" -ForegroundColor $Colors.Error
    Write-Host "===============================================================" -ForegroundColor $Colors.Error
    Write-Host ""
    Write-Host "La variable ANDROID_HOME no esta definida. Sigue estos pasos:" -ForegroundColor $Colors.Warning
    Write-Host ""
    Write-Host "+-------------------------------------------------------------+" -ForegroundColor $Colors.Info
    Write-Host "|  OPCION 1: Instalar Android Studio (Recomendado)            |" -ForegroundColor $Colors.Info
    Write-Host "+-------------------------------------------------------------+" -ForegroundColor $Colors.Info
    Write-Host ""
    Write-Host "  1. Descarga Android Studio desde:" -ForegroundColor $Colors.Info
    Write-Host "     https://developer.android.com/studio" -ForegroundColor $Colors.Primary
    Write-Host ""
    Write-Host "  2. Durante la instalacion, asegurate de instalar:" -ForegroundColor $Colors.Info
    Write-Host "     [OK] Android SDK" -ForegroundColor $Colors.Success
    Write-Host "     [OK] Android SDK Platform-Tools" -ForegroundColor $Colors.Success
    Write-Host "     [OK] Android SDK Build-Tools" -ForegroundColor $Colors.Success
    Write-Host ""
    Write-Host "  3. La ruta por defecto del SDK es:" -ForegroundColor $Colors.Info
    $sdkPath = "C:\Users\$env:USERNAME\AppData\Local\Android\Sdk"
    Write-Host "     $sdkPath" -ForegroundColor $Colors.Magenta
    Write-Host ""
    Write-Host "+-------------------------------------------------------------+" -ForegroundColor $Colors.Info
    Write-Host "|  OPCION 2: Configurar ANDROID_HOME manualmente              |" -ForegroundColor $Colors.Info
    Write-Host "+-------------------------------------------------------------+" -ForegroundColor $Colors.Info
    Write-Host ""
    Write-Host "  Si ya tienes el SDK instalado, configura la variable:" -ForegroundColor $Colors.Info
    Write-Host ""
    Write-Host "  PowerShell (sesion actual):" -ForegroundColor $Colors.Warning
    Write-Host '  $env:ANDROID_HOME = "C:\Users\TU_USUARIO\AppData\Local\Android\Sdk"' -ForegroundColor $Colors.Magenta
    Write-Host ""
    Write-Host "  PowerShell (permanente para usuario):" -ForegroundColor $Colors.Warning
    Write-Host '  [Environment]::SetEnvironmentVariable("ANDROID_HOME", "RUTA_SDK", "User")' -ForegroundColor $Colors.Magenta
    Write-Host ""
    Write-Host "  Tambien anade al PATH:" -ForegroundColor $Colors.Warning
    Write-Host '  $env:Path += ";$env:ANDROID_HOME\platform-tools"' -ForegroundColor $Colors.Magenta
    Write-Host ""
    Write-Host "+-------------------------------------------------------------+" -ForegroundColor $Colors.Info
    Write-Host "|  VERIFICAR INSTALACION                                      |" -ForegroundColor $Colors.Info
    Write-Host "+-------------------------------------------------------------+" -ForegroundColor $Colors.Info
    Write-Host ""
    Write-Host "  Despues de configurar, ejecuta:" -ForegroundColor $Colors.Info
    Write-Host "  .\agent-deploy.ps1 -Check" -ForegroundColor $Colors.Primary
    Write-Host ""
}

# --- Funcion: Verificar entorno Android completo ---
function Test-AndroidEnvironment {
    $result = @{
        AndroidHome = $false
        AdbExists = $false
        AdbWorks = $false
        DevicesConnected = @()
        PocoDetected = $false
    }
    
    # 1. Verificar ANDROID_HOME
    if ($env:ANDROID_HOME -and (Test-Path $env:ANDROID_HOME)) {
        $result.AndroidHome = $true
    }
    
    # 2. Verificar que adb existe
    if ($result.AndroidHome) {
        $adbPath = Join-Path $env:ANDROID_HOME "platform-tools\adb.exe"
        if (Test-Path $adbPath) {
            $result.AdbExists = $true
        }
    }
    
    # 3. Verificar que adb funciona y obtener dispositivos
    if ($result.AdbExists) {
        try {
            $adbPath = Join-Path $env:ANDROID_HOME "platform-tools\adb.exe"
            $devicesOutput = & $adbPath devices 2>&1
            if ($LASTEXITCODE -eq 0) {
                $result.AdbWorks = $true
                $lines = $devicesOutput -split "`n" | Where-Object { $_ -match "device$" -or $_ -match "unauthorized$" }
                foreach ($line in $lines) {
                    if ($line -match "^(\S+)\s+(device|unauthorized)") {
                        $result.DevicesConnected += @{
                            Id = $matches[1]
                            Status = $matches[2]
                        }
                    }
                }
                if ($result.DevicesConnected.Count -gt 0) {
                    $result.PocoDetected = $true
                }
            }
        }
        catch {
            $result.AdbWorks = $false
        }
    }
    
    return $result
}

# --- Funcion: Mostrar estado del entorno ---
function Show-EnvironmentStatus {
    param($Status)
    
    Write-Host ""
    Write-Host "===============================================================" -ForegroundColor $Colors.Primary
    Write-Host "  [?] VERIFICACION DE ENTORNO ANDROID" -ForegroundColor $Colors.Primary
    Write-Host "===============================================================" -ForegroundColor $Colors.Primary
    Write-Host ""
    
    # ANDROID_HOME
    if ($Status.AndroidHome) {
        Write-Host "  [OK] ANDROID_HOME: $env:ANDROID_HOME" -ForegroundColor $Colors.Success
    }
    else {
        Write-Host "  [X] ANDROID_HOME: No configurado" -ForegroundColor $Colors.Error
    }
    
    # ADB
    if ($Status.AdbExists) {
        Write-Host "  [OK] ADB: Encontrado en platform-tools" -ForegroundColor $Colors.Success
    }
    else {
        Write-Host "  [X] ADB: No encontrado" -ForegroundColor $Colors.Error
    }
    
    # ADB funcional
    if ($Status.AdbWorks) {
        Write-Host "  [OK] ADB Server: Funcionando" -ForegroundColor $Colors.Success
    }
    elseif ($Status.AdbExists) {
        Write-Host "  [!] ADB Server: Error al ejecutar" -ForegroundColor $Colors.Warning
    }
    
    # Dispositivos
    Write-Host ""
    if ($Status.DevicesConnected.Count -gt 0) {
        Write-Host "  [i] DISPOSITIVOS CONECTADOS:" -ForegroundColor $Colors.Primary
        foreach ($device in $Status.DevicesConnected) {
            if ($device.Status -eq "device") {
                Write-Host "     [OK] $($device.Id) [$($device.Status)]" -ForegroundColor $Colors.Success
            }
            else {
                Write-Host "     [!] $($device.Id) [$($device.Status)]" -ForegroundColor $Colors.Warning
            }
        }
        $hasUnauthorized = $Status.DevicesConnected | Where-Object { $_.Status -eq "unauthorized" }
        if ($hasUnauthorized) {
            Write-Host ""
            Write-Host "  [!] Dispositivo no autorizado. En el telefono:" -ForegroundColor $Colors.Warning
            Write-Host "     1. Desconecta y reconecta el USB" -ForegroundColor $Colors.Info
            Write-Host "     2. Acepta el dialogo 'Permitir depuracion USB'" -ForegroundColor $Colors.Info
        }
    }
    else {
        Write-Host "  [i] DISPOSITIVOS CONECTADOS: Ninguno" -ForegroundColor $Colors.Warning
        Write-Host ""
        Write-Host "  [TIP] Para conectar tu Poco X7 Pro:" -ForegroundColor $Colors.Info
        Write-Host "     1. Ajustes > Sobre el telefono > Toca 'Version MIUI' 7 veces" -ForegroundColor $Colors.Info
        Write-Host "     2. Ajustes > Ajustes adicionales > Opciones de desarrollador" -ForegroundColor $Colors.Info
        Write-Host "     3. Activa 'Depuracion USB'" -ForegroundColor $Colors.Info
        Write-Host "     4. Conecta el cable USB y acepta el dialogo" -ForegroundColor $Colors.Info
    }
    
    Write-Host ""
    
    # Resumen
    $allGood = $Status.AndroidHome -and $Status.AdbExists -and $Status.AdbWorks -and ($Status.DevicesConnected.Count -gt 0)
    if ($allGood) {
        Write-Host "===============================================================" -ForegroundColor $Colors.Success
        Write-Host "  [OK] ENTORNO LISTO PARA BUILD LOCAL" -ForegroundColor $Colors.Success
        Write-Host "  Ejecuta: .\agent-deploy.ps1 -Local" -ForegroundColor $Colors.Success
        Write-Host "===============================================================" -ForegroundColor $Colors.Success
    }
    else {
        Write-Host "===============================================================" -ForegroundColor $Colors.Warning
        Write-Host "  [!] ENTORNO INCOMPLETO - Revisa los errores arriba" -ForegroundColor $Colors.Warning
        Write-Host "===============================================================" -ForegroundColor $Colors.Warning
    }
    Write-Host ""
    
    return $allGood
}

# --- Ayuda ---
if ($Help) {
    Write-Host ""
    Write-Host "===============================================================" -ForegroundColor $Colors.Primary
    Write-Host "  ResellHub Deploy Script v2.3" -ForegroundColor $Colors.Primary
    Write-Host "===============================================================" -ForegroundColor $Colors.Primary
    Write-Host ""
    Write-Host "USO:" -ForegroundColor $Colors.Warning
    Write-Host "  .\agent-deploy.ps1 -Check     # Verifica entorno Android"
    Write-Host "  .\agent-deploy.ps1 -Local     # Build local (sin cuota EAS)"
    Write-Host "  .\agent-deploy.ps1 -Cloud     # Build en EAS (requiere cuota)"
    Write-Host "  .\agent-deploy.ps1 -Help      # Muestra esta ayuda"
    Write-Host ""
    Write-Host "REQUISITOS PARA BUILD LOCAL:" -ForegroundColor $Colors.Warning
    Write-Host "  - Android SDK instalado (Android Studio)"
    Write-Host "  - ANDROID_HOME configurado"
    Write-Host "  - Dispositivo conectado por USB con depuracion habilitada"
    Write-Host ""
    Write-Host "PRIMERA VEZ? Ejecuta:" -ForegroundColor $Colors.Success
    Write-Host "  .\agent-deploy.ps1 -Check" -ForegroundColor $Colors.Primary
    Write-Host ""
    exit
}

# --- Verificacion de entorno (-Check) ---
if ($Check) {
    $status = Test-AndroidEnvironment
    $ready = Show-EnvironmentStatus -Status $status
    if (-not $status.AndroidHome) {
        Show-AndroidSetupGuide
    }
    exit
}

# --- Validaciones iniciales ---
Write-Host ""
Write-Host "[*] Validando entorno..." -ForegroundColor $Colors.Primary

$branch = git branch --show-current
Write-Host "   [i] Rama actual: $branch" -ForegroundColor $Colors.Info

# --- BUILD LOCAL (sin EAS) ---
if ($Local) {
    Write-Host ""
    Write-Host "===============================================================" -ForegroundColor $Colors.Warning
    Write-Host "  [BUILD LOCAL] Modo offline (sin cuota EAS)" -ForegroundColor $Colors.Warning
    Write-Host "===============================================================" -ForegroundColor $Colors.Warning
    Write-Host ""
    
    # Verificar entorno completo
    $envStatus = Test-AndroidEnvironment
    
    # Verificar ANDROID_HOME
    if (-not $envStatus.AndroidHome) {
        Show-AndroidSetupGuide
        exit 1
    }
    Write-Host "   [OK] ANDROID_HOME: $env:ANDROID_HOME" -ForegroundColor $Colors.Success
    
    # Verificar ADB
    if (-not $envStatus.AdbExists) {
        Write-Host "   [X] ERROR: ADB no encontrado en platform-tools" -ForegroundColor $Colors.Error
        Write-Host "   Reinstala Android SDK Platform-Tools desde Android Studio" -ForegroundColor $Colors.Info
        exit 1
    }
    Write-Host "   [OK] ADB: Disponible" -ForegroundColor $Colors.Success
    
    # Verificar dispositivos conectados
    Write-Host ""
    Write-Host "[i] Buscando dispositivos conectados..." -ForegroundColor $Colors.Primary
    
    if ($envStatus.DevicesConnected.Count -eq 0) {
        Write-Host ""
        Write-Host "   [X] ERROR: No hay dispositivos Android conectados" -ForegroundColor $Colors.Error
        Write-Host ""
        Write-Host "   Para conectar tu Poco X7 Pro:" -ForegroundColor $Colors.Warning
        Write-Host "   1. Activa 'Opciones de desarrollador' en Ajustes" -ForegroundColor $Colors.Info
        Write-Host "   2. Activa 'Depuracion USB'" -ForegroundColor $Colors.Info
        Write-Host "   3. Conecta el cable USB" -ForegroundColor $Colors.Info
        Write-Host "   4. Acepta el dialogo de autorizacion en el telefono" -ForegroundColor $Colors.Info
        Write-Host ""
        Write-Host "   Luego ejecuta: .\agent-deploy.ps1 -Check" -ForegroundColor $Colors.Primary
        exit 1
    }
    
    # Mostrar dispositivos
    foreach ($device in $envStatus.DevicesConnected) {
        if ($device.Status -eq "device") {
            Write-Host "   [OK] $($device.Id) [$($device.Status)]" -ForegroundColor $Colors.Success
        }
        else {
            Write-Host "   [!] $($device.Id) [$($device.Status)]" -ForegroundColor $Colors.Warning
        }
    }
    
    # Verificar si hay dispositivos no autorizados
    $unauthorized = $envStatus.DevicesConnected | Where-Object { $_.Status -eq "unauthorized" }
    if ($unauthorized -and ($envStatus.DevicesConnected.Count -eq @($unauthorized).Count)) {
        Write-Host ""
        Write-Host "   [!] Todos los dispositivos estan sin autorizar" -ForegroundColor $Colors.Warning
        Write-Host "   Acepta el dialogo 'Permitir depuracion USB' en el telefono" -ForegroundColor $Colors.Info
        exit 1
    }
    
    # Preguntar confirmacion
    Write-Host ""
    $confirm = Read-Host "Continuar con build local? (S/N)"
    if ($confirm -ne "S" -and $confirm -ne "s") {
        Write-Host "[X] Build cancelada" -ForegroundColor $Colors.Error
        exit
    }
    
    Write-Host ""
    Write-Host "[>] Iniciando build local Android..." -ForegroundColor $Colors.Primary
    Write-Host "   Esto puede tardar varios minutos la primera vez" -ForegroundColor $Colors.Info
    Write-Host ""
    
    # Ejecutar build local
    npx expo run:android
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "===============================================================" -ForegroundColor $Colors.Success
        Write-Host "  [OK] BUILD LOCAL COMPLETADA" -ForegroundColor $Colors.Success
        Write-Host "  [i] App instalada en dispositivo conectado" -ForegroundColor $Colors.Success
        Write-Host "===============================================================" -ForegroundColor $Colors.Success
    }
    else {
        Write-Host ""
        Write-Host "[X] Error en build local" -ForegroundColor $Colors.Error
        Write-Host ""
        Write-Host "POSIBLES SOLUCIONES:" -ForegroundColor $Colors.Warning
        Write-Host "  1. Verifica que el dispositivo sigue conectado" -ForegroundColor $Colors.Info
        Write-Host "  2. Ejecuta: .\agent-deploy.ps1 -Check" -ForegroundColor $Colors.Info
        Write-Host "  3. Intenta: npx expo prebuild --clean" -ForegroundColor $Colors.Info
        Write-Host "  4. Revisa que el SDK de Android este actualizado" -ForegroundColor $Colors.Info
    }
    exit
}

# --- BUILD EN LA NUBE (EAS) ---
if ($Cloud -or (-not $Local -and -not $Cloud -and -not $Check)) {
    Write-Host ""
    Write-Host "===============================================================" -ForegroundColor $Colors.Primary
    Write-Host "  [CLOUD] BUILD EN LA NUBE - EAS Build" -ForegroundColor $Colors.Primary
    Write-Host "===============================================================" -ForegroundColor $Colors.Primary
    Write-Host ""
    
    # Validar rama
    if ($branch -ne "develop" -and $branch -ne "main") {
        Write-Host "[!] WARNING: Estas en rama '$branch', no en develop/main" -ForegroundColor $Colors.Warning
        $continue = Read-Host "Continuar de todos modos? (S/N)"
        if ($continue -ne "S" -and $continue -ne "s") {
            Write-Host "[X] Build cancelada" -ForegroundColor $Colors.Error
            exit
        }
    }
    
    # Commit y push
    $commitMsg = Read-Host "Introduce el mensaje de commit"
    if ($commitMsg) {
        git add .
        git commit -m "$commitMsg"
        git push origin $branch
        Write-Host "   [OK] Cambios pusheados a $branch" -ForegroundColor $Colors.Success
    }
    
    Write-Host ""
    Write-Host "[>] Enviando build a EAS..." -ForegroundColor $Colors.Primary
    
    # Ejecutar EAS build
    eas build --platform android --profile preview
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "===============================================================" -ForegroundColor $Colors.Success
        Write-Host "  [OK] BUILD ENVIADA A EAS" -ForegroundColor $Colors.Success
        Write-Host "  [i] Descarga el APK desde expo.dev cuando termine" -ForegroundColor $Colors.Success
        Write-Host "===============================================================" -ForegroundColor $Colors.Success
    }
    else {
        Write-Host ""
        Write-Host "[X] Error en EAS Build" -ForegroundColor $Colors.Error
        Write-Host ""
        Write-Host "[TIP] Si la cuota de EAS esta agotada, usa:" -ForegroundColor $Colors.Warning
        Write-Host "   .\agent-deploy.ps1 -Local" -ForegroundColor $Colors.Info
        Write-Host ""
    }
}
