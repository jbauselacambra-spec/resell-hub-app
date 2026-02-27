# 🚀 Guía Rápida de Instalación - ResellHub

## ⚡ Instalación Express (5 minutos)

### 1️⃣ Preparar el entorno

```bash
# Navegar a la carpeta del proyecto
cd resell-hub-app

# Instalar dependencias
npm install

# Si da errores, usar:
npm install --legacy-peer-deps
```

### 2️⃣ Ejecutar en modo desarrollo

```bash
# Iniciar servidor Expo
npx expo start

# En la terminal, presiona:
# 'a' - Abrir en emulador Android
# 'i' - Abrir en simulador iOS (solo Mac)
# Escanea QR con Expo Go app para probar en tu móvil
```

### 3️⃣ Compilar APK para instalación

**Opción A: Con EAS (Más fácil)**

```bash
# 1. Instalar EAS CLI
npm install -g eas-cli

# 2. Login (crear cuenta gratis en expo.dev)
eas login

# 3. Configurar proyecto
eas build:configure

# 4. Compilar APK
eas build -p android --profile preview

# 5. Esperar ~10 minutos, se descargará automáticamente
```

**Opción B: Build local (Más rápido pero requiere Android SDK)**

```bash
# Asegúrate de tener Android Studio instalado y configurado

# 1. Generar APK
npx expo run:android --variant release

# 2. La APK estará en:
# android/app/build/outputs/apk/release/app-release.apk

# 3. Instalar en tu Poco X7 Pro
adb install android/app/build/outputs/apk/release/app-release.apk
```

## 📱 Instalar en tu Poco X7 Pro

### Método 1: Via USB (Recomendado)

```bash
# 1. Activar "Depuración USB" en tu Poco X7 Pro
# Ajustes → Acerca del teléfono → Toca 7 veces "Número de compilación"
# Ajustes → Opciones de desarrollo → Depuración USB [ON]

# 2. Conectar móvil al PC via USB

# 3. Verificar conexión
adb devices
# Debe aparecer tu dispositivo

# 4. Instalar APK
adb install -r path/to/app-release.apk
```

### Método 2: Transferencia directa

```bash
# 1. Copiar APK al móvil (vía cable, Bluetooth, email, etc.)

# 2. En el móvil, abrir "Archivos"

# 3. Localizar la APK

# 4. Tap en la APK → "Instalar"
# (Permitir instalación de fuentes desconocidas si se solicita)
```

## 🎯 Primera Ejecución

1. **Abre ResellHub**
2. **Concede permisos** cuando lo solicite:
   - ✅ Almacenamiento
   - ✅ Notificaciones
   - ⚠️ Cámara (opcional)

3. **Configura carpeta de entrada**:
   - Tap en "Ajustes" (tab inferior)
   - "Carpetas" → Seleccionar directorio
   - Por defecto: `/ResellHub/`

4. **¡Listo!** Ya puedes empezar a añadir productos

## 🧪 Probar la App (Datos Demo)

La app viene con 3 productos de ejemplo para que pruebes todas las funciones:

1. iPhone 13 Pro (necesita resubida)
2. Nike Air Max 90 (activo)
3. Chaqueta Levi's (vendido)

**Explora**:
- 📊 Dashboard: Ver estadísticas
- 📦 Productos: Lista completa con filtros
- 📈 Stats: Gráficos detallados
- ⚙️ Ajustes: Configuración

## 🔧 Solución de Problemas Comunes

### ❌ "Cannot connect to development server"
```bash
# Solución:
npx expo start -c  # Limpia caché
```

### ❌ "Gradle build failed"
```bash
# Solución:
cd android
./gradlew clean
cd ..
npx expo run:android
```

### ❌ APK no se instala
```bash
# Solución 1: Desinstalar versión anterior
adb uninstall com.yourcompany.resellhub

# Solución 2: Verificar espacio en móvil
# La app ocupa ~50MB

# Solución 3: Permitir instalación de fuentes desconocidas
# Ajustes → Seguridad → Fuentes desconocidas [ON]
```

### ❌ Notificaciones no funcionan
```javascript
// En Settings screen, verifica:
Ajustes → Notificaciones → Todas activadas

// Si no funciona, reinicia la app y concede permisos de nuevo
```

## 📋 Comandos Útiles

```bash
# Limpiar caché de Expo
npx expo start -c

# Ver logs en tiempo real
npx react-native log-android

# Rebuild completo
rm -rf node_modules
npm install
npx expo start -c

# Ver dispositivos conectados
adb devices

# Desinstalar app
adb uninstall com.yourcompany.resellhub

# Abrir shell en dispositivo
adb shell

# Captura de pantalla
adb exec-out screencap -p > screenshot.png
```

## 🎨 Personalizar la App

### Cambiar nombre de la app
```javascript
// app.json
{
  "expo": {
    "name": "Mi Reseller"  // Cambia aquí
  }
}
```

### Cambiar colores
```javascript
// App.jsx - Busca estas variables y cámbialas
const COLORS = {
  primary: '#FF6B35',    // Naranja principal
  secondary: '#004E89',  // Azul
  success: '#00D9A3',    // Verde
  // ... etc
}
```

### Cambiar icono
```
1. Crea imagen 1024x1024px
2. Guarda en: assets/icon.png
3. Rebuild la app
```

## 📚 Próximos Pasos

Una vez instalada:

1. **Añade tu primer producto real**:
   - Crea carpeta: `/ResellHub/NombreProducto/`
   - Añade 3-5 imágenes
   - Tap "Procesar Nuevos Productos"

2. **Configura notificaciones**:
   - Ajustes → Notificaciones
   - Activa alertas de resubida
   - Ajusta umbral (30, 60, 90 días)

3. **Marca productos vendidos**:
   - Cuando vendas algo en Vinted
   - Tap en producto → "Marcar Vendido"
   - Introduce precio de venta

4. **Monitoriza estadísticas**:
   - Revisa Dashboard diariamente
   - Identifica productos estancados
   - Optimiza precios y descripciones

## 🆘 Ayuda

¿Problemas durante la instalación?

1. **Consulta README.md** (documentación completa)
2. **Revisa logs**: `adb logcat | grep ResellHub`
3. **Comunidad Expo**: https://forums.expo.dev

---

**¡Disfruta vendiendo más con ResellHub!** 🎉
