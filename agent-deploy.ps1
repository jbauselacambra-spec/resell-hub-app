# ═══════════════════════════════════════════════════════════════════════════
# ResellHub - Script de Deploy v4.9 (Localhost Stable Mode)
# ═══════════════════════════════════════════════════════════════════════════

param(
    [switch]$Local,
    [switch]$Cloud,
    [switch]$Check,
    [switch]$Help
)

$Colors = @{
    Primary = "Cyan"
    Success = "Green"
    Warning = "Yellow"
    Error   = "Red"
    Info    = "White"
    Magenta = "Magenta"
}

# ═══════════════════════════════════════════════════════════════════════════
# FUNCIÓN DEEP CLEAN LOCAL
# ═══════════════════════════════════════════════════════════════════════════

function Run-DeepClean {
    Write-Host "`n[*] Iniciando limpieza de procesos..." -ForegroundColor $Colors.Warning
    Stop-Process -Name java -Force -ErrorAction SilentlyContinue
    Stop-Process -Name KotlinCompile -Force -ErrorAction SilentlyContinue
    
    if (Test-Path ".expo") {
        Remove-Item -Recurse -Force ".expo" -ErrorAction SilentlyContinue
    }
}

# ═══════════════════════════════════════════════════════════════════════════
# MODO LOCAL (Basado en lo que te funciona)
# ═══════════════════════════════════════════════════════════════════════════

if ($Local) {
    Write-Host ""
    Write-Host "===============================================================" -ForegroundColor $Colors.Success
    Write-Host "  [MODO LOCAL] Servidor Expo + Localhost Tunnel" -ForegroundColor $Colors.Success
    Write-Host "===============================================================" -ForegroundColor $Colors.Success

    # 1️⃣ Limpieza ligera para no romper Gradle pero soltar puertos
    Run-DeepClean

    # 2️⃣ Configuración de Entorno
    $env:EXPO_METRO_PORT = "8081"
    
    # 3️⃣ ADB Reverse: El puente vital para que el móvil vea el localhost del PC
    Write-Host "[*] Estableciendo puente ADB Reverse (USB)..." -ForegroundColor $Colors.Primary
    & adb reverse tcp:8081 tcp:8081

    Write-Host ""
    Write-Host "[>] Lanzando Servidor Expo en modo Localhost..." -ForegroundColor $Colors.Magenta
    [System.Console]::Beep(440, 500)

    # 4️⃣ EJECUCIÓN: El comando que confirmaste que funciona
    npx expo start --localhost --android

    exit
}

# ═══════════════════════════════════════════════════════════════════════════
# BUILD CLOUD (EAS) - INTACTA (APK Preview en Develop)
# ═══════════════════════════════════════════════════════════════════════════

if ($Cloud -or (-not $Local -and -not $Cloud -and -not $Check)) {
    Write-Host ""
    Write-Host "===============================================================" -ForegroundColor $Colors.Primary
    Write-Host "  [CLOUD] PUSH & BUILD (EAS)" -ForegroundColor $Colors.Primary
    Write-Host "===============================================================" -ForegroundColor $Colors.Primary

    $branch = git branch --show-current
    
    $commitMsg = Read-Host "Introduce el mensaje de commit"
    if ($commitMsg) {
        git add .
        git commit -m "$commitMsg"
        git push origin $branch
        Write-Host "   [OK] Cambios subidos a $branch" -ForegroundColor $Colors.Success
    }

    Write-Host ""
    
    # Si es develop o cualquier otra, tiramos a preview para tener el APK
    if ($branch -eq "develop") {
        Write-Host "[>] Rama desarrollo detectada. Creando APK de Preview..." -ForegroundColor $Colors.Success
        eas build --platform android --profile preview
    } else {
        Write-Host "[>] Enviando build a EAS (Profile: Preview)..." -ForegroundColor $Colors.Primary
        eas build --platform android --profile preview
    }
}