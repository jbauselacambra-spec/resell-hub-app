# =============================================================================
# ResellHub - Script de Deploy v5.3 (Sprint 7 - Auto-detect JAVA_HOME)
# =============================================================================
# USO:
#   .\agent-deploy.ps1 -Build    PRIMERA VEZ: compila APK nativa e instala
#   .\agent-deploy.ps1 -Local    HOT RELOAD: solo metro, sin recompilar nativo
#   .\agent-deploy.ps1 -Cloud    Git push + EAS Build (APK preview nube)
#   .\agent-deploy.ps1 -Check    Diagnostico de entorno (ADB, Node, Expo, Java)
#   .\agent-deploy.ps1 -Help     Muestra esta ayuda
#
# BUNDLE ID: com.perdigon85.resellhub
# JAVA:      Requiere Java 17+ (Gradle 8.10.2 + AGP compileSdk 35)
#
# FLUJO RECOMENDADO:
#   1. Primera vez o tras cambios en package.json, app.json, android/:
#      .\agent-deploy.ps1 -Build
#   2. Solo cambios JS/JSX (lo normal en el dia a dia):
#      .\agent-deploy.ps1 -Local
#
# Si el build falla con JAVA_HOME error, ejecuta -Check para diagnosticar.
# =============================================================================

param(
    [switch]$Build,
    [switch]$Local,
    [switch]$Cloud,
    [switch]$Check,
    [switch]$Help
)

$BUNDLE_ID = "com.perdigon85.resellhub"
$LOG_FILE  = Join-Path $PSScriptRoot "deploy-log.txt"

# =============================================================================
# FUNCIONES DE LOGGING
# =============================================================================

function Write-Log {
    param([string]$Level, [string]$Msg)
    $ts   = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$ts] [$Level] $Msg"
    Add-Content -Path $LOG_FILE -Value $line -ErrorAction SilentlyContinue
}

function Write-Step {
    param([string]$Msg, [string]$Color = "Cyan")
    Write-Host ""
    Write-Host "  > $Msg" -ForegroundColor $Color
    Write-Log "STEP" $Msg
}

function Write-Ok {
    param([string]$Msg)
    Write-Host "    [OK] $Msg" -ForegroundColor Green
    Write-Log "OK" $Msg
}

function Write-Warn {
    param([string]$Msg)
    Write-Host "    [!]  $Msg" -ForegroundColor Yellow
    Write-Log "WARN" $Msg
}

function Write-Fail {
    param([string]$Msg)
    Write-Host "    [X]  $Msg" -ForegroundColor Red
    Write-Log "ERROR" $Msg
}

function Write-Info {
    param([string]$Msg)
    Write-Host "         $Msg" -ForegroundColor DarkGray
    Write-Log "INFO" $Msg
}

# =============================================================================
# JAVA_HOME AUTO-DETECCION
# =============================================================================
#
# Gradle 8.10.2 requiere Java 17+. Android Studio instala su propio JBR
# (JetBrains Runtime) pero NO lo registra en JAVA_HOME del sistema.
# Esta funcion lo busca automaticamente en las rutas conocidas de Windows.

function Find-JavaHome {
    # 1. Ya esta seteado correctamente
    if ($env:JAVA_HOME -and (Test-Path "$env:JAVA_HOME\bin\java.exe")) {
        return $env:JAVA_HOME
    }

    # 2. JBR embebido de Android Studio (ruta estandar)
    $androidStudioJbr = "C:\Program Files\Android\Android Studio\jbr"
    if (Test-Path "$androidStudioJbr\bin\java.exe") {
        return $androidStudioJbr
    }

    # 3. Busqueda en Program Files por JDK 17+ (orden: 21, 17, 11)
    $jdkCandidates = @(
        "C:\Program Files\Eclipse Adoptium",
        "C:\Program Files\Microsoft",
        "C:\Program Files\Java",
        "C:\Program Files\OpenJDK",
        "C:\Program Files\Zulu",
        "C:\Program Files\BellSoft",
        "C:\Program Files\Amazon Corretto",
        "C:\tools"
    )

    foreach ($base in $jdkCandidates) {
        if (-not (Test-Path $base)) { continue }
        # Buscar carpetas jdk-17, jdk-21, jdk17, jdk21 dentro de la base
        $found = Get-ChildItem -Path $base -Directory -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -match "jdk.?(17|18|19|20|21)" } |
            Sort-Object Name -Descending |
            Select-Object -First 1
        if ($found -and (Test-Path "$($found.FullName)\bin\java.exe")) {
            return $found.FullName
        }
    }

    # 4. Busqueda via registro de Windows
    try {
        $regPaths = @(
            "HKLM:\SOFTWARE\JavaSoft\JDK",
            "HKLM:\SOFTWARE\WOW6432Node\JavaSoft\JDK"
        )
        foreach ($regPath in $regPaths) {
            if (Test-Path $regPath) {
                $versions = Get-ChildItem $regPath -ErrorAction SilentlyContinue |
                    Where-Object { $_.PSChildName -match "^(17|18|19|20|21)" } |
                    Sort-Object PSChildName -Descending
                foreach ($v in $versions) {
                    $javaHome = (Get-ItemProperty $v.PSPath -ErrorAction SilentlyContinue).JavaHome
                    if ($javaHome -and (Test-Path "$javaHome\bin\java.exe")) {
                        return $javaHome
                    }
                }
            }
        }
    } catch { }

    # 5. Busqueda via 'java' en PATH (ultimo recurso)
    try {
        $javaExe = (Get-Command java -ErrorAction SilentlyContinue).Source
        if ($javaExe) {
            # java.exe esta en JAVA_HOME\bin\java.exe
            return Split-Path (Split-Path $javaExe)
        }
    } catch { }

    return $null
}

function Set-JavaEnvironment {
    Write-Step "Configurando JAVA_HOME para Gradle..."

    $javaHome = Find-JavaHome

    if (-not $javaHome) {
        Write-Fail "Java 17+ no encontrado en el sistema."
        Write-Host ""
        Write-Host "  SOLUCION: Abre Android Studio y comprueba que tienes el JDK:" -ForegroundColor Yellow
        Write-Host "  File > Settings > Build, Execution, Deployment > Build Tools > Gradle" -ForegroundColor Yellow
        Write-Host "  Gradle JDK: debe apuntar a un JDK 17 o superior" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "  O instala manualmente Eclipse Temurin 17:" -ForegroundColor Yellow
        Write-Host "  https://adoptium.net/es/temurin/releases/?version=17" -ForegroundColor Yellow
        Write-Host ""
        Write-Log "ERROR" "JAVA_HOME no encontrado - build abortado"
        return $false
    }

    # Verificar version de Java
    $javaVersion = ""
    try {
        $versionOutput = & "$javaHome\bin\java.exe" -version 2>&1
        $javaVersion   = ($versionOutput | Select-String "version").ToString()
    } catch { }

    # Setear para esta sesion de PowerShell
    $env:JAVA_HOME = $javaHome
    $env:PATH      = "$javaHome\bin;" + $env:PATH

    Write-Ok "JAVA_HOME: $javaHome"
    if ($javaVersion) { Write-Info "Version: $javaVersion" }
    Write-Log "INFO" "JAVA_HOME=$javaHome | $javaVersion"
    return $true
}

# =============================================================================
# FUNCIONES DE SISTEMA
# =============================================================================

function Get-AdbDevice {
    try {
        $out      = & adb devices 2>$null
        $devLines = $out | Select-String "\bdevice\b" | Where-Object { $_ -notmatch "List of" }
        return (($devLines | Measure-Object).Count -gt 0)
    } catch {
        return $false
    }
}

function Uninstall-AppFromDevice {
    param([string]$BundleId)
    Write-Step "Desinstalando APK anterior ($BundleId)..."

    if (-not (Get-AdbDevice)) {
        Write-Warn "No se detecto ningun dispositivo ADB."
        Write-Warn "Conecta el movil por USB con depuracion activada."
        return $false
    }

    $installed = & adb shell pm list packages 2>$null | Select-String $BundleId
    if ($installed) {
        Write-Info "App encontrada. Desinstalando..."
        $result    = & adb uninstall $BundleId 2>&1
        $resultStr = "$result"
        if ($resultStr -match "Success") {
            Write-Ok "APK desinstalada."
            return $true
        } else {
            Write-Warn "No se pudo desinstalar: $resultStr"
            return $false
        }
    } else {
        Write-Ok "App no estaba instalada (instalacion limpia)."
        return $true
    }
}

function Run-DeepClean {
    Write-Step "Limpiando procesos y cache..."
    Stop-Process -Name "java"          -Force -ErrorAction SilentlyContinue
    Stop-Process -Name "KotlinCompile" -Force -ErrorAction SilentlyContinue
    Stop-Process -Name "node"          -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 800

    if (Test-Path ".expo") {
        Remove-Item -Recurse -Force ".expo" -ErrorAction SilentlyContinue
        Write-Info "Cache .expo eliminada"
    }

    $tempPath = $env:TEMP
    if ($tempPath) {
        Get-ChildItem -Path $tempPath -Filter "metro-*"     -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
        Get-ChildItem -Path $tempPath -Filter "haste-map-*" -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
        Write-Info "Cache Metro/Haste eliminada"
    }

    if (Test-Path "node_modules\.cache") {
        Remove-Item -Recurse -Force "node_modules\.cache" -ErrorAction SilentlyContinue
        Write-Info "node_modules/.cache eliminada"
    }

    Write-Ok "Limpieza completada."
}

# =============================================================================
# MODO HELP
# =============================================================================

if ($Help) {
    Write-Host ""
    Write-Host "  ResellHub Deploy Script v5.3" -ForegroundColor Cyan
    Write-Host "  -----------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "  -Build   PRIMERA VEZ: compila nativo (expo run:android)" -ForegroundColor White
    Write-Host "  -Local   HOT RELOAD: solo Metro, sin compilar nativo" -ForegroundColor White
    Write-Host "  -Cloud   Git push + EAS Build APK en la nube" -ForegroundColor White
    Write-Host "  -Check   Diagnostico ADB, Node, Expo, Java" -ForegroundColor White
    Write-Host "  -Help    Esta ayuda" -ForegroundColor White
    Write-Host ""
    Write-Host "  CUANDO USAR CADA MODO:" -ForegroundColor DarkGray
    Write-Host "  -Build: primer deploy, cambio en plugins/package.json/app.json" -ForegroundColor DarkGray
    Write-Host "  -Local: cambios solo en .jsx/.js (lo habitual en desarrollo)" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  JAVA REQUERIDO: 17+ (Gradle 8.10.2 + compileSdk 35)" -ForegroundColor DarkGray
    Write-Host "  El script detecta automaticamente el JDK de Android Studio." -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  Log: $LOG_FILE" -ForegroundColor DarkGray
    Write-Host ""
    exit 0
}

Write-Log "SESSION" "=========================================="
Write-Log "SESSION" "Deploy v5.3. Flags: Build=$Build Local=$Local Cloud=$Cloud Check=$Check"

# =============================================================================
# MODO CHECK
# =============================================================================

if ($Check) {
    Write-Host ""
    Write-Host "  ==========================================================" -ForegroundColor Cyan
    Write-Host "   [CHECK] Diagnostico de entorno ResellHub" -ForegroundColor Cyan
    Write-Host "  ==========================================================" -ForegroundColor Cyan

    Write-Step "Node.js"
    try { $v = node --version 2>$null; Write-Ok "Node: $v" } catch { Write-Fail "Node no encontrado" }

    Write-Step "npm"
    try { $v = npm --version 2>$null; Write-Ok "npm: $v" } catch { Write-Fail "npm no encontrado" }

    Write-Step "Expo CLI"
    try { $v = npx expo --version 2>$null; Write-Ok "expo: $v" } catch { Write-Fail "Expo CLI no disponible" }

    Write-Step "Java / JAVA_HOME (requerido para -Build)"
    $javaHome = Find-JavaHome
    if ($javaHome) {
        $env:JAVA_HOME = $javaHome
        Write-Ok "Encontrado: $javaHome"
        try {
            $jv = & "$javaHome\bin\java.exe" -version 2>&1
            Write-Info ($jv | Select-String "version").ToString()
        } catch { }

        # Verificar que es Java 17+
        try {
            $majorVersion = & "$javaHome\bin\java.exe" -version 2>&1 |
                Select-String '"(\d+)' | ForEach-Object { $_.Matches[0].Groups[1].Value }
            if ([int]$majorVersion -ge 17) {
                Write-Ok "Version Java $majorVersion (compatible con Gradle 8.x)"
            } else {
                Write-Warn "Java $majorVersion detectado. Gradle 8.10.2 requiere Java 17+."
                Write-Warn "Actualiza el JDK en Android Studio o instala Temurin 17."
            }
        } catch { Write-Info "No se pudo verificar la version de Java" }
    } else {
        Write-Fail "Java 17+ NO encontrado."
        Write-Warn "Instala Eclipse Temurin 17: https://adoptium.net/es/temurin/releases/?version=17"
        Write-Warn "O abre Android Studio > File > Settings > Gradle JDK"
    }

    Write-Step "ADB"
    try {
        $v = & adb version 2>$null | Select-Object -First 1
        Write-Ok "$v"
    } catch { Write-Fail "ADB no encontrado. Agrega Android SDK Platform Tools al PATH." }

    Write-Step "Dispositivo ADB"
    if (Get-AdbDevice) {
        $devList = & adb devices 2>$null | Select-String "\bdevice\b" | Where-Object { $_ -notmatch "List of" }
        Write-Ok "Dispositivo detectado:"
        foreach ($d in $devList) { Write-Info "  $d" }
    } else {
        Write-Warn "Sin dispositivo. Conecta el movil con depuracion USB activada."
    }

    Write-Step "App '$BUNDLE_ID' en dispositivo"
    if (Get-AdbDevice) {
        $installed = & adb shell pm list packages 2>$null | Select-String $BUNDLE_ID
        if ($installed) { Write-Warn "App instalada. Usa -Build para reinstalar limpio." }
        else            { Write-Ok "App no instalada." }
    }

    Write-Step "Carpeta android/ (bare workflow)"
    if (Test-Path "android") { Write-Ok "Carpeta android/ encontrada" }
    else { Write-Warn "No hay android/. Ejecuta: npx expo prebuild" }

    Write-Host ""
    Write-Log "CHECK" "Diagnostico completado"
    exit 0
}

# =============================================================================
# MODO BUILD -- Primera instalacion o cambio nativo
# =============================================================================

if ($Build) {
    Write-Host ""
    Write-Host "  ==========================================================" -ForegroundColor Magenta
    Write-Host "   [BUILD] Compilar + Instalar APK de desarrollo" -ForegroundColor Magenta
    Write-Host "  ==========================================================" -ForegroundColor Magenta
    Write-Host ""
    Write-Host "  Usa este modo la primera vez o tras cambios en:" -ForegroundColor DarkGray
    Write-Host "  package.json, app.json (plugins), o carpeta android/." -ForegroundColor DarkGray
    Write-Host ""

    # 1. JAVA_HOME — CRITICO: sin esto Gradle falla con codigo 9009
    $javaOk = Set-JavaEnvironment
    if (-not $javaOk) {
        Write-Fail "Build abortado: Java no disponible."
        Write-Host ""
        Write-Host "  Ejecuta: .\agent-deploy.ps1 -Check para diagnosticar." -ForegroundColor Yellow
        exit 1
    }

    # 2. Desinstalar APK anterior para evitar conflictos de firma
    Uninstall-AppFromDevice -BundleId $BUNDLE_ID

    # 3. Limpiar cache
    Run-DeepClean

    # 4. Puerto Metro
    $env:EXPO_METRO_PORT = "8081"

    # 5. ADB Reverse
    Write-Step "Configurando ADB Reverse (tcp:8081)..."
    if (Get-AdbDevice) {
        & adb reverse tcp:8081 tcp:8081
        Write-Ok "ADB Reverse configurado."
    } else {
        Write-Warn "Sin dispositivo. Conecta el movil antes de que compile."
    }

    # 6. Compilar e instalar con expo run:android
    Write-Step "Compilando e instalando APK de desarrollo..." "Magenta"
    Write-Host ""
    Write-Host "  JAVA_HOME: $env:JAVA_HOME" -ForegroundColor DarkGray
    Write-Host "  Este proceso tarda 3-10 minutos la primera vez (Gradle)." -ForegroundColor DarkGray
    Write-Host ""
    Write-Log "LAUNCH" "npx expo run:android --device | JAVA_HOME=$env:JAVA_HOME"

    [System.Console]::Beep(440, 300)
    [System.Console]::Beep(660, 300)

    npx expo run:android --device

    Write-Log "BUILD" "expo run:android completado"
    exit 0
}

# =============================================================================
# MODO LOCAL -- Solo Metro bundler (cambios JS, sin recompilar nativo)
# =============================================================================

if ($Local) {
    Write-Host ""
    Write-Host "  ==========================================================" -ForegroundColor Green
    Write-Host "   [LOCAL] Hot Reload - Solo Metro Bundler" -ForegroundColor Green
    Write-Host "  ==========================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Bundle: $BUNDLE_ID" -ForegroundColor DarkGray
    Write-Host "  Requiere que la dev build este instalada (-Build primero)." -ForegroundColor DarkGray
    Write-Host ""

    # Comprobar que la dev build esta instalada
    if (Get-AdbDevice) {
        $installed = & adb shell pm list packages 2>$null | Select-String $BUNDLE_ID
        if (-not $installed) {
            Write-Warn "ATENCION: La dev build NO esta instalada."
            Write-Warn "Ejecuta: .\agent-deploy.ps1 -Build"
            Write-Host ""
            $resp = Read-Host "  Continuar de todas formas? (S/N)"
            if ($resp -notmatch "^[Ss]$") {
                Write-Log "LOCAL" "Abortado (dev build no instalada)"
                exit 1
            }
        } else {
            Write-Ok "Dev build instalada. Iniciando hot reload..."
        }
    }

    # Limpiar cache Metro
    Write-Step "Limpiando cache Metro..."
    Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 500
    if (Test-Path ".expo") {
        Remove-Item -Recurse -Force ".expo" -ErrorAction SilentlyContinue
        Write-Info "Cache .expo eliminada"
    }
    $tempPath = $env:TEMP
    if ($tempPath) {
        Get-ChildItem -Path $tempPath -Filter "metro-*" -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    }
    Write-Ok "Cache limpia."

    # Puerto y puente ADB
    $env:EXPO_METRO_PORT = "8081"
    Write-Step "Configurando ADB Reverse (tcp:8081)..."
    if (Get-AdbDevice) {
        & adb reverse tcp:8081 tcp:8081
        Write-Ok "ADB Reverse configurado."
    } else {
        Write-Warn "Sin dispositivo. Conecta el movil."
    }

    # Lanzar Metro
    Write-Step "Lanzando Metro Bundler (hot reload)..." "Green"
    Write-Host ""
    Write-Host "  La app en el movil recargara automaticamente." -ForegroundColor DarkGray
    Write-Host "  Pulsa Ctrl+C para parar." -ForegroundColor DarkGray
    Write-Host ""
    Write-Log "LAUNCH" "npx expo start --localhost"

    [System.Console]::Beep(440, 300)
    [System.Console]::Beep(660, 300)

    npx expo start --localhost

    Write-Log "SESSION" "Metro detenido"
    exit 0
}

# =============================================================================
# MODO CLOUD (EAS Build)
# =============================================================================

if ($Cloud -or (-not $Build -and -not $Local -and -not $Cloud -and -not $Check -and -not $Help)) {
    Write-Host ""
    Write-Host "  ==========================================================" -ForegroundColor Cyan
    Write-Host "   [CLOUD] Git Push + EAS Build (APK Preview)" -ForegroundColor Cyan
    Write-Host "  ==========================================================" -ForegroundColor Cyan

    $branch = git branch --show-current 2>$null
    Write-Step "Rama actual: $branch"

    $commitMsg = Read-Host "`n  Mensaje de commit"
    if ($commitMsg) {
        git add .
        git commit -m $commitMsg
        git push origin $branch
        Write-Ok "Cambios subidos a '$branch'"
        Write-Log "GIT" "Push a $branch : $commitMsg"
    } else {
        Write-Warn "Sin mensaje. Continuando sin push."
    }

    Write-Step "Iniciando EAS Build (profile: preview)..."
    Write-Log "EAS" "eas build --platform android --profile preview"
    eas build --platform android --profile preview

    Write-Log "SESSION" "EAS Build completado"
    exit 0
}