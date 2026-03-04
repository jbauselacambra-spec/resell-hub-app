# ═══════════════════════════════════════════════════════════════════════════
# ResellHub - Script de Deploy v4.1 (Automatización de Perfiles Cloud)
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

# ═══════════════════════════════════════════════════════════════════════════
# FUNCIÓN DEEP CLEAN LOCAL EXTENDIDA
# ═══════════════════════════════════════════════════════════════════════════

function Run-DeepClean {

    Write-Host "`n[*] Iniciando limpieza profunda local..." -ForegroundColor $Colors.Warning

    # 1️⃣ Limpiar cache npm
    Write-Host "   -> Limpiando cache npm..." -ForegroundColor $Colors.Info
    npm cache clean --force

    # 2️⃣ Cerrar procesos pesados
    Stop-Process -Name java -Force -ErrorAction SilentlyContinue
    Stop-Process -Name KotlinCompile -Force -ErrorAction SilentlyContinue

    # 3️⃣ Borrar builds pesados
    $pathsToClean = @(
        "android/app/build",
        "android/.gradle",
        "node_modules/.cache"
    )

    foreach ($path in $pathsToClean) {
        if (Test-Path $path) {
            Write-Host "   -> Eliminando $path..." -ForegroundColor $Colors.Info
            Remove-Item -Recurse -Force $path
        }
    }

    # 4️⃣ Limpiar temporales Windows
    Write-Host "   -> Limpiando temporales Windows..." -ForegroundColor $Colors.Info
    if (Test-Path $env:TEMP) {
        Remove-Item -Recurse -Force "$env:TEMP\*" -ErrorAction SilentlyContinue
    }

    # 5️⃣ Desinstalar versión anterior SOLO LOCAL
    Write-Host "   -> Desinstalando APK anterior..." -ForegroundColor $Colors.Info
    & adb uninstall com.perdigon85.resellhub | Out-Null
}

# ═══════════════════════════════════════════════════════════════════════════
# BUILD LOCAL
# ═══════════════════════════════════════════════════════════════════════════

if ($Local) {

    Write-Host ""
    Write-Host "===============================================================" -ForegroundColor $Colors.Warning
    Write-Host "  [BUILD LOCAL] Ultra Limpieza + Entorno Forzado" -ForegroundColor $Colors.Warning
    Write-Host "===============================================================" -ForegroundColor $Colors.Warning
    Write-Host ""

    # 1️⃣ FORZAR RUTAS
    Write-Host "[*] Configurando entorno Android..." -ForegroundColor $Colors.Primary

    $env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
    $env:ANDROID_HOME = "C:\Users\jesus\AppData\Local\Android\Sdk"
    $env:Path += ";$env:ANDROID_HOME\platform-tools;$env:JAVA_HOME\bin"

    Write-Host "   JAVA_HOME=$env:JAVA_HOME" -ForegroundColor $Colors.Info
    Write-Host "   ANDROID_HOME=$env:ANDROID_HOME" -ForegroundColor $Colors.Info

    # 2️⃣ Generar local.properties automáticamente
    Write-Host "   -> Generando android/local.properties..." -ForegroundColor $Colors.Info
    $sdkLine = "sdk.dir=C:/Users/jesus/AppData/Local/Android/Sdk"
    Set-Content -Path "android/local.properties" -Value $sdkLine -Encoding ASCII

    # 3️⃣ Limpieza profunda
    Run-DeepClean

    # 4️⃣ Confirmación
    $confirm = Read-Host "Continuar con build local? (S/N)"
    if ($confirm -ne "S" -and $confirm -ne "s") {
        Write-Host "[X] Build cancelada" -ForegroundColor $Colors.Error
        exit
    }

    Write-Host ""
    Write-Host "[>] Iniciando build local Android..." -ForegroundColor $Colors.Primary
    [System.Console]::Beep(440, 500)

    # 5️⃣ Ejecutar build
    npx expo run:android

    if ($LASTEXITCODE -eq 0) {
        [System.Console]::Beep(880, 300)
        [System.Console]::Beep(1000, 300)

        Write-Host ""
        Write-Host "===============================================================" -ForegroundColor $Colors.Success
        Write-Host "  [OK] APP INSTALADA CORRECTAMENTE" -ForegroundColor $Colors.Success
        Write-Host "===============================================================" -ForegroundColor $Colors.Success
    }
    else {
        Write-Host ""
        Write-Host "[X] Error en build local" -ForegroundColor $Colors.Error
    }

    exit
}

# ═══════════════════════════════════════════════════════════════════════════
# BUILD CLOUD (EAS) - CON DETECCIÓN DE RAMA PARA PREVIEW
# ═══════════════════════════════════════════════════════════════════════════

if ($Cloud -or (-not $Local -and -not $Cloud -and -not $Check)) {

    Write-Host ""
    Write-Host "===============================================================" -ForegroundColor $Colors.Primary
    Write-Host "  [CLOUD] BUILD EN LA NUBE - EAS Build" -ForegroundColor $Colors.Primary
    Write-Host "===============================================================" -ForegroundColor $Colors.Primary
    Write-Host ""

    $branch = git branch --show-current

    if ($branch -ne "develop" -and $branch -ne "main") {
        Write-Host "[!] WARNING: Estas en rama '$branch'" -ForegroundColor $Colors.Warning
        $continue = Read-Host "Continuar de todos modos? (S/N)"
        if ($continue -ne "S" -and $continue -ne "s") {
            Write-Host "[X] Build cancelada" -ForegroundColor $Colors.Error
            exit
        }
    }

    $commitMsg = Read-Host "Introduce el mensaje de commit"
    if ($commitMsg) {
        git add .
        git commit -m "$commitMsg"
        git push origin $branch
        Write-Host "   [OK] Cambios pusheados a $branch" -ForegroundColor $Colors.Success
    }

    Write-Host ""
    
    # Lógica de creación de APK automática:
    # Si la rama es develop, lanza preview (APK). Si es main, podrías cambiarlo a production, 
    # pero según tu petición, forzamos preview cuando subes desarrollo.
    if ($branch -eq "develop") {
        Write-Host "[>] Rama desarrollo detectada. Creando APK de Preview..." -ForegroundColor $Colors.Success
        eas build --platform android --profile preview
    } else {
        Write-Host "[>] Enviando build a EAS..." -ForegroundColor $Colors.Primary
        eas build --platform android --profile preview
    }
}