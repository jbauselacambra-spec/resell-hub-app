# 📱 ResellHub - Aplicación de Gestión de Productos para Vinted

## 🎯 Descripción

ResellHub es una aplicación móvil Android diseñada para automatizar y optimizar la gestión de productos en plataformas de segunda mano como Vinted y Wallapop. La app procesa automáticamente imágenes, extrae información de productos, monitoriza estadísticas de venta y envía alertas para resubir productos sin vender.

## ✨ Características Principales

### 🖼️ Procesamiento Automático de Imágenes
- **Conversión de formatos**: WEBP → JPEG automático
- **Recorte inteligente**: Elimina 1px de cada lado para evitar detección de imágenes duplicadas
- **Análisis con IA**: Extracción automática de título, marca, descripción, etiquetas y precio sugerido
- **Gestión de metadatos**: Preserva información EXIF relevante

### 📊 Monitorización y Estadísticas
- **Dashboard en tiempo real**: Vista general de productos activos, vendidos y alertas
- **Gráficos interactivos**: Visualización de ventas mensuales y tendencias
- **Análisis por categoría**: Rendimiento desglosado por tipo de producto
- **Tiempo promedio de venta**: Métricas de performance de cada producto
- **Historial completo**: Registro detallado de todas las ventas

### 🔔 Sistema de Notificaciones
- **Alertas de resubida**: Notificaciones automáticas para productos +60 días sin vender
- **Productos sin interés**: Avisos de items con pocas vistas (configurable)
- **Resumen semanal**: Informe automático de estadísticas
- **Notificaciones personalizables**: Ajusta umbrales y frecuencia

### 📦 Gestión de Productos
- **Vista de lista completa**: Todos tus productos con filtros avanzados
- **Tarjetas informativas**: Estado, precio, vistas, días activos
- **Acción rápida**: Resubir, marcar como vendido, editar
- **Estados visuales**: Códigos de color para identificar rápidamente el estado

## 🏗️ Arquitectura Técnica

### Stack Tecnológico
```
Frontend:     React Native 0.73 + Expo 50
Navigation:   React Navigation 6 (Bottom Tabs)
UI:           Custom components + React Native Paper
Charts:       react-native-chart-kit + Victory Native
State:        Zustand (gestión de estado global)
Storage:      MMKV (alta performance, reemplaza AsyncStorage)
Images:       expo-image-manipulator + expo-image-picker
Notifications: expo-notifications
```

### Estructura del Proyecto
```
resell-hub-app/
├── App.jsx                          # Componente principal + navegación
├── services/
│   ├── ImageProcessingService.js   # Procesamiento de imágenes
│   ├── NotificationService.js      # Sistema de notificaciones
│   └── DatabaseService.js          # Base de datos local (MMKV)
├── components/                      # (Componentes reutilizables)
├── screens/                         # (Pantallas adicionales)
├── assets/                          # Iconos, imágenes, fuentes
├── package.json
├── app.json                         # Configuración Expo
└── README.md
```

## 🚀 Instalación y Configuración

### Requisitos Previos
- Node.js 18+ y npm/yarn
- Android Studio (ya instalado según tu mensaje)
- Expo CLI: `npm install -g expo-cli`
- EAS CLI: `npm install -g eas-cli`

### Paso 1: Instalar Dependencias
```bash
cd resell-hub-app
npm install
```

### Paso 2: Configurar Android Studio
1. Abre Android Studio
2. Ve a **Tools → Device Manager**
3. Crea un emulador Pixel 7 (API 33) o usa tu Poco X7 Pro via USB debugging

### Paso 3: Ejecutar en Desarrollo
```bash
# Iniciar servidor Expo
npm start

# O directamente en Android
npm run android
```

### Paso 4: Compilar APK para Producción

#### Opción A: Build con EAS (Recomendado)
```bash
# Login en Expo
eas login

# Configurar proyecto
eas build:configure

# Compilar APK
eas build -p android --profile preview
```

La APK se descargará automáticamente cuando esté lista.

#### Opción B: Build Local con Expo
```bash
# Build APK local (requiere más configuración)
npx expo run:android --variant release
```

### Paso 5: Instalar en tu Poco X7 Pro
```bash
# Via ADB
adb install path/to/app-release.apk

# O transferir APK al móvil y instalar manualmente
```

## 📖 Guía de Uso

### 1️⃣ Primera Configuración

Al abrir la app por primera vez:

1. **Concede permisos**:
   - Almacenamiento (leer/escribir)
   - Cámara (opcional, para fotos)
   - Notificaciones

2. **Configura carpeta de entrada**:
   - Ve a **Ajustes → Carpetas**
   - Selecciona directorio donde dejarás las imágenes
   - Por defecto: `/storage/emulated/0/ResellHub/`

3. **Configura notificaciones**:
   - **Ajustes → Notificaciones**
   - Activa "Alertas de resubida (60 días)"
   - Ajusta umbrales según preferencias

### 2️⃣ Añadir Nuevos Productos

**Método 1: Carpeta automática** (Recomendado)
```
1. Crea carpeta con nombre del producto en:
   /ResellHub/iPhone_13_Pro/

2. Añade imágenes del producto:
   - Formato: JPG, PNG, WEBP
   - Mínimo: 1 imagen
   - Recomendado: 3-5 imágenes

3. En la app, toca "Procesar Nuevos Productos"
   
4. La app automáticamente:
   ✓ Convierte imágenes a JPEG
   ✓ Recorta 1px por lado
   ✓ Analiza con IA (título, marca, precio)
   ✓ Crea registro en base de datos
```

**Método 2: Desde la app**
```
1. Dashboard → Botón "+"
2. Selecciona imágenes de galería o toma foto
3. Completa información manualmente
4. Guarda producto
```

### 3️⃣ Gestionar Productos

#### Ver Lista de Productos
- **Tap en "Productos"** (tab inferior)
- Filtra por: Todos / Activos / Para Resubir / Vendidos
- Swipe para ver más opciones

#### Detalles de Producto
- **Tap en cualquier tarjeta** de producto
- Ver galería de imágenes completa
- Editar información
- Ver estadísticas (vistas, días activo)

#### Resubir Producto
```
1. Productos con borde amarillo = necesitan resubida
2. Tap en el producto
3. Botón "Resubir"
4. Se reprocesa imagen (nuevos metadatos)
5. Copiar info al formulario de Vinted
```

#### Marcar como Vendido
```
1. Tap en producto vendido
2. Botón "Marcar Vendido"
3. Introduce precio de venta
4. Se añade a estadísticas
5. Se guarda en historial
```

### 4️⃣ Monitorizar Estadísticas

#### Dashboard
- **Stats Cards**: Vista rápida de activos/vendidos/alertas
- **Banner de alertas**: Productos que necesitan atención
- **Gráfico mensual**: Evolución de ventas
- **Lista de productos**: Estado actual

#### Pantalla de Stats
- **Ingresos totales**: Con comparativa mensual
- **Rendimiento por categoría**: Qué se vende mejor
- **Tiempo promedio de venta**: Por rango de días
- **Tendencias**: Identifica patrones

### 5️⃣ Configurar Notificaciones

```
Ajustes → Notificaciones

Alertas de resubida (60 días)      [ON]
→ Notifica cuando un producto lleva >60 días sin vender

Productos sin vistas (7 días)      [ON]  
→ Alerta si un producto tiene <10 vistas en 7 días

Resumen semanal                    [OFF]
→ Email/notificación cada lunes con estadísticas
```

## 🎨 Diseño y UX

### Paleta de Colores
```css
Primary:   #FF6B35  /* Naranja energético - acciones */
Secondary: #004E89  /* Azul profundo - confianza */
Success:   #00D9A3  /* Verde menta - vendido */
Warning:   #FFB800  /* Amarillo - alerta */
Danger:    #E63946  /* Rojo - urgente */
Neutral:   #F8F9FA  /* Fondo claro */
```

### Jerarquía Visual
1. **Header**: Título de app + Avatar usuario (60dp)
2. **Stats Cards**: Métricas principales (120dp)
3. **Alert Banner**: Acciones urgentes (80dp)
4. **Content**: Gráficos y listas (resto)
5. **Bottom Navigation**: 4 tabs principales (60dp)

### Estados Interactivos
- **Normal**: Opacidad 100%, elevación 2
- **Pressed**: Scale 0.96, elevación 4
- **Disabled**: Opacidad 50%
- **Loading**: Shimmer effect
- **Success**: Animación de confeti (vendido)

## 🔧 Configuración Avanzada

### Integración con IA (GPT-4 Vision)

Para habilitar análisis automático real:

```javascript
// services/ImageProcessingService.js

static async analyzeProductWithAI(imagePaths) {
  const openai = new OpenAI({ apiKey: 'tu-api-key' });
  
  const response = await openai.chat.completions.create({
    model: 'gpt-4-vision-preview',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Analiza este producto y extrae: título, marca, descripción, estado, precio medio de segunda mano en España, y etiquetas relevantes. Responde en JSON.'
          },
          {
            type: 'image_url',
            image_url: { url: imagePaths[0] }
          }
        ]
      }
    ]
  });
  
  return JSON.parse(response.choices[0].message.content);
}
```

### Sincronización Cloud (Firebase)

Para sincronizar entre dispositivos:

```bash
npm install @react-native-firebase/app @react-native-firebase/firestore
```

```javascript
// services/SyncService.js
import firestore from '@react-native-firebase/firestore';

static async syncToCloud(product) {
  await firestore()
    .collection('products')
    .doc(product.id.toString())
    .set(product);
}
```

### Export/Import de Datos

```javascript
// Exportar a JSON
const data = DatabaseService.exportData();
const json = JSON.stringify(data, null, 2);
// Guardar en /Downloads/resellhub-backup.json

// Importar desde JSON
const imported = JSON.parse(backupFileContent);
DatabaseService.importData(imported);
```

## 📱 Optimización para Poco X7 Pro

### Especificaciones
- **Pantalla**: 6.67" AMOLED, 1080x2400px
- **Densidad**: ~395 ppi (~2.5x)
- **Refresh Rate**: 120Hz

### Ajustes Específicos
```javascript
// App.jsx - Optimizaciones de performance

import { enableScreens } from 'react-native-screens';
enableScreens();

// Reducir re-renders innecesarios
const MemoizedProductCard = React.memo(ProductCard);

// Lazy loading de imágenes
<Image 
  source={{ uri: image }} 
  fadeDuration={200}
  resizeMode="cover"
  progressiveRenderingEnabled
/>

// Animaciones optimizadas para 120Hz
useNativeDriver: true
```

## 🐛 Troubleshooting

### APK no instala
```bash
# Verifica firma de debug
keytool -list -v -keystore ~/.android/debug.keystore

# Reinstala limpia
adb uninstall com.yourcompany.resellhub
adb install -r app-release.apk
```

### Imágenes no se procesan
- Verifica permisos de almacenamiento
- Comprueba ruta de carpeta en Ajustes
- Revisa logs: `adb logcat | grep ResellHub`

### Notificaciones no llegan
```javascript
// Verifica permisos
const { status } = await Notifications.getPermissionsAsync();
console.log('Notification permission:', status);

// Comprueba canales (Android)
await Notifications.getNotificationChannelsAsync();
```

### Base de datos corrupta
```javascript
// Reinicia MMKV
DatabaseService.clearAll();
// Reimporta backup si existe
```

## 📊 Métricas y KPIs

La app trackea automáticamente:
- **Conversion Rate**: % productos vendidos vs total
- **Tiempo medio venta**: Días desde publicación hasta venta
- **Precio promedio**: Por categoría
- **Tasa de resubida**: Cuántas veces se reprocessa cada producto
- **ROI por categoría**: Ingresos vs esfuerzo

## 🔐 Privacidad y Datos

- ✅ Todos los datos se almacenan **localmente** en el dispositivo
- ✅ No se envía información a servidores externos
- ✅ Las imágenes permanecen en tu móvil
- ⚠️ Si habilitas sincronización cloud, datos se guardan en Firebase (tu cuenta)

## 🚀 Roadmap Futuro

### v1.1 (Q2 2025)
- [ ] Integración directa con API de Vinted
- [ ] Auto-publicación desde la app
- [ ] Plantillas de descripción personalizables

### v1.2 (Q3 2025)
- [ ] Soporte para Wallapop
- [ ] Chat con compradores integrado
- [ ] Gestión de envíos

### v2.0 (Q4 2025)
- [ ] Modo multi-cuenta
- [ ] Análisis predictivo con ML
- [ ] Sugerencias automáticas de precio

## 🤝 Contribuir

Este es un proyecto personal, pero si quieres colaborar:

1. Fork el repositorio
2. Crea rama feature: `git checkout -b feature/nueva-funcionalidad`
3. Commit: `git commit -m 'Añade nueva funcionalidad'`
4. Push: `git push origin feature/nueva-funcionalidad`
5. Abre Pull Request

## 📄 Licencia

MIT License - Uso libre para proyectos personales y comerciales

## 📧 Soporte

Si tienes dudas o problemas:
- Abre un issue en GitHub
- Email: support@resellhub.app (ficticio)
- Twitter: @ResellHubApp (ficticio)

---

**Desarrollado con ❤️ para vendedores de segunda mano**

*ResellHub - Gestiona, Monitoriza, Vende Más*
