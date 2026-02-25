# 📐 Documentación del Sistema de Diseño — ResellHub
> **v2.1** — Actualizado Febrero 2026

---

## 🎯 Visión del Sistema

ResellHub es una app Android de gestión inteligente de ventas en Vinted. Su núcleo es un **motor de inteligencia de resubida** que aprende del comportamiento de los productos para generar oportunidades óptimas de venta.

La app se alimenta de datos scrapeados desde la consola del navegador en Vinted (vía script JSON), que el usuario importa puntualmente. El sistema mantiene una capa de **campos manuales protegidos** que nunca son sobreescritos por ninguna importación.

---

## 🎨 Filosofía de Diseño

**Minimalismo Vibrante** — interfaces limpias con toques de color estratégicos para guiar la atención hacia acciones importantes.

### Principios Clave

1. **Claridad Visual** — Jerarquía clara con espaciado generoso
2. **Acción Inmediata** — Botones y CTAs prominentes
3. **Feedback Constante** — Estados visuales para cada interacción
4. **Datos Primero** — Estadísticas siempre visibles y actualizadas
5. **Mobile-First** — Optimizado para uso con una mano (Poco X7 Pro)
6. **Configurabilidad Total** — Todos los parámetros del motor de IA son editables en Settings
7. **Sin SEO Tags** — Las etiquetas provienen del diccionario de categorías/subcategorías, no de un campo libre

---

## 🎨 Paleta de Colores

```css
Primary Orange:  #FF6B35  — CTAs, acciones importantes
Secondary Blue:  #004E89  — Headers, categorías, confianza
Success:         #00D9A3  — Vendidos, TTS relámpago, confirmaciones
Warning:         #FFB800  — Alertas, TTS normal
Danger:          #E63946  — Errores, TTS ancla, críticos
Purple:          #6C63FF  — Lotes/packs
Gray 900:        #1A1A2E  — Texto principal, fondos dark
Gray 700:        #666666  — Texto secundario
Gray 500:        #999999  — Labels, placeholders
Gray 100:        #F0F0F0  — Fondos suaves, borders
```

---

## 📏 Espaciado (8pt Grid)

```
xs:4  sm:8  md:12  base:16  lg:20  xl:24  xxl:32  xxxl:48
paddingHorizontal del container: 20dp
borderRadius cards:              20-28dp (mayor = más premium)
elevation cards:                 1-3
```

---

## 📱 Pantallas y Flujo

```
Tab Navigator (Bottom Tabs)
├── DashboardScreen          — KPIs, alertas, Smart Insights
├── ProductsScreen           — Lista activos con diagnóstico
├── SoldHistoryScreen        — Vendidos + edición campos manuales
├── AdvancedStatsScreen      — Gráficos TTS, calendario, categorías
└── SettingsScreen           — Config global (5 tabs)

Stack Modals
├── ProductDetailScreen      — Detalle activo + edición permanente
└── SoldEditDetailView       — Edición datos de venta permanentes
```

---

## ⚙️ SettingsScreen — 5 Pestañas

| Pestaña | Contenido |
|---------|-----------|
| Umbrales | Diagnóstico, TTS relámpago/ancla con %, sensibilidad, límite histórico |
| Calendario | Multi-categoría por mes (array), modal selector con chips eliminables |
| Categorías | Árbol categoría→subcategoría→tags, CRUD completo |
| Importación | Toggles campos protegidos, automatizaciones |
| Avisos | Toggle global, frecuencia, 4 tipos de alerta |

---

## 🗃️ ProductDetailScreen (v2.1)

### Vista normal
- **Header**: marca (uppercase naranja) + pill categoría/subcategoría (azul)
- **Título + precio**: título flexible + pill verde precio + pill morado "LOTE"
- **Historial de precios**: caja naranja suave con evolución oldPrice→newPrice + fecha + fuente
- **Stats panel**: Vistas / Favs / Días / Estado (con color semántico)
- **Fechas**: subida original + contador resubidas
- **Tags de categoría**: chips azules con los tags del diccionario (categoría + subcategoría)
- **Descripción**
- **Acciones**: Editar / Resubido / Borrar

### Modo edición (campos permanentes)
Aviso visible: *"Estos datos se conservan aunque importes un JSON actualizado"*

| Campo | Control |
|-------|---------|
| Precio de publicación | TextInput numérico |
| Categoría / Subcategoría | Modal selector 2 pasos (cat → sub) con tags informativos |
| Fecha de subida original | CalendarModal con día seleccionado destacado |
| Publicado en lote/pack | Toggle con color azul activo |

**NO hay campo SEO tags** — los tags vienen del diccionario de categorías.

### CategoryModal (2 pasos)
1. **Paso 1 — Categoría**: lista de categorías del diccionario con contador de subcategorías y preview de tags. Si tiene subcategorías → avanza al paso 2
2. **Paso 2 — Subcategoría**: lista de subcategorías + opción "Sin subcategoría"
- Flecha back para volver al paso 1
- Marca con ✓ la selección actual

---

## 🗃️ SoldEditDetailView (v2.1)

### Layout
- Imagen header 300dp con banner verde "VENDIDO" superpuesto
- Panel TTS: precio original / días hasta venta (color semántico) / beneficio (+/-)
- Formulario con fondo gris suave

### Campos permanentes

| Campo | Control | Color acento |
|-------|---------|-------------|
| Precio final de venta | Input grande con underline verde | success |
| Fecha real de venta | DateSelector con icono calendario | success |
| Categoría / Subcategoría | Modal selector igual que ProductDetail | blue |
| Tags informativos | Vista de los tags de la categoría seleccionada | blue chips |
| Fecha de subida original | DateSelector con icono upload | primary |
| Venta en lote/pack | Toggle con color púrpura activo | purple |

**NO hay campo SEO tags.**

### Cálculo automático de TTS
```
TTS = soldDate - firstUploadDate (días)
Color: verde ≤7d | amarillo ≤30d | rojo >30d
```
El panel TTS se calcula en tiempo real mientras el usuario edita las fechas.

---

## 🔄 Motor de Importación Inteligente (v2.1)

### Campos manuales protegidos

**Activos:**
- `category` — asignada manualmente en la ficha
- `subcategory` — asignada manualmente en la ficha  
- `firstUploadDate` — fecha real de subida (el JSON trae la de extracción)

**Vendidos (adicionalmente):**
- `soldPrice` — precio final real de venta
- `soldDate` — fecha real de cierre de venta
- `isBundle` — si fue vendido en lote/pack

**⚠️ ELIMINADO:** `seoTags` ya no existe como campo. Los tags provienen del diccionario.

### Flujo de fusión

```
MISMO ID → MERGE
  ├─ Actualiza: precio, vistas, favs, status, descripción, imágenes
  ├─ PRESERVA: category, subcategory, firstUploadDate (activos)
  ├─ PRESERVA: + soldPrice, soldDate, isBundle (vendidos)
  └─ Precio cambiado → priceHistory

NUEVO ID → ¿Resubida?
  ├─ SÍ (mismo título+marca): hereda category, subcategory, firstUploadDate
  └─ NO: detecta categoría/subcategoría desde diccionario automáticamente

AUSENTE en JSON → marcado como stale (no eliminado)
```

---

## 📊 LogService (v2.0)

### Niveles disponibles

| Nivel | Emoji | Uso |
|-------|-------|-----|
| `debug` | 🔍 | Trazas de operaciones internas |
| `info` | ℹ️ | Eventos del sistema |
| `success` | ✅ | Operaciones completadas correctamente |
| `warn` | ⚠️ | Situaciones anómalas no críticas |
| `error` | ❌ | Errores recuperables |
| `critical` | 🔥 | Fallos graves del sistema |

### Contextos (LOG_CTX)

| Contexto | Color | Uso |
|----------|-------|-----|
| `IMPORT` | naranja | Importación de JSON de Vinted |
| `DB` | azul | Operaciones MMKV |
| `UI` | verde | Interacciones de usuario |
| `NAV` | gris | Navegación |
| `CAT` | amarillo | Diccionario y categorías |
| `NOTIF` | morado | Notificaciones |
| `SYSTEM` | dark | Arranque, config |

### API

```javascript
// Básico
LogService.info('mensaje', LOG_CTX.UI)
LogService.error('mensaje', LOG_CTX.DB, { extra: 'datos' })
LogService.exception('descripción', errorObj, LOG_CTX.IMPORT)

// Span (medir duración)
const span = LogService.span('Operación', LOG_CTX.DB)
// ... operación ...
span.end({ resultado: 'ok' })    // o span.fail(error)

// Importación
LogService.logImportResult(result)  // formatea el resultado completo

// Categorías
LogService.logCategoryDetection(texto, resultado)

// Filtrado
LogService.getLogs({ level: 'error', context: 'IMPORT', search: 'timeout', limit: 20 })
LogService.getErrors()      // solo errores y críticos
LogService.getImportLogs()  // solo logs de importación
LogService.getStats()       // conteo por nivel
```

### LogsScreen (v2.0)

- **Tema oscuro** (`#0D0D1A`) — consola estilo terminal
- **Stats bar** — chips por nivel con conteo, tap para filtrar
- **Buscador** — texto libre en mensajes y extra
- **Filtro de contexto** — scroll horizontal con todos los contextos
- **Log expandible** — tap en item para ver datos extra (JSON)
- **Importación en modal** — bottom sheet con info sobre preservación de campos
- **Importación inteligente** — usa `importFromVinted()` en lugar de `saveProducts()`
- **Acciones**: Backup manual / Restaurar / Reset DB

---

## 🗄️ Modelo de Datos del Producto (v2.1)

```javascript
{
  // ─── De Vinted (actualizables en import) ───────────────────────────
  id:           String,
  title:        String,
  brand:        String,
  price:        Number,          // Precio actual en Vinted
  description:  String,
  images:       String[],
  status:       'available' | 'sold' | 'active',
  views:        Number,
  favorites:    Number,
  createdAt:    ISO String,      // Fecha de EXTRACCIÓN (≠ subida real)

  // ─── Manuales protegidos — NUNCA sobreescritos en import ──────────
  category:        String,       // Categoría del diccionario
  subcategory:     String?,      // Subcategoría (opcional)
  firstUploadDate: ISO String,   // Fecha real de subida a Vinted
  // (eliminado: seoTags — los tags vienen del diccionario)
  soldPrice:       Number?,      // Precio final real de venta
  soldDate:        ISO String?,  // Fecha real de cierre
  isBundle:        Boolean,      // ¿Vendido en lote/pack?

  // ─── Generados por el sistema ──────────────────────────────────────
  priceHistory:    [{ oldPrice, newPrice, date, source }],
  repostOf:        String?,      // ID del producto original (resubida)
  repostTo:        String?,      // ID de la resubida (en el original)
  repostCount:     Number,
  lastRepostDate:  ISO String?,
  stale:           Boolean?,     // No apareció en último import
  staleDetectedAt: ISO String?,
  lastSync:        ISO String,
  lastActivity:    ISO String,
}
```

---

## 🔑 Storage Keys (MMKV)

| Clave | Contenido |
|-------|-----------|
| `products` | Array de todos los productos |
| `app_user_config` | Configuración global |
| `custom_dictionary` | Diccionario legacy: `{ cat: [tags] }` |
| `custom_dictionary_full` | Diccionario con subcategorías |
| `import_log` | Historial últimas 50 importaciones |
| `app_logs_v2` | Logs del sistema (máx 200, formato v2) |
| `emergency_backup` | Backup manual antes de reset |

---

## 🧩 Componentes Reutilizables Clave

### CategoryModal (compartido)
- 2 pasos: categoría → subcategoría
- Muestra tags informativos de cada categoría
- Opción "Sin subcategoría" en paso 2
- Back arrow para navegar entre pasos

### CalendarModal
- Navegación mes a mes
- Día seleccionado destacado con color acento
- Label configurable para indicar qué fecha se selecciona

### TagCloud (display)
- Chips azules con tags del diccionario
- Solo display, no editable desde las fichas
- Editable únicamente desde SettingsScreen → Categorías

---

## 📦 Estructura de Archivos

```
screens/
├── DashboardScreen.jsx
├── ProductsScreen.jsx
├── SoldHistoryScreen.jsx
├── AdvancedStatsScreen.jsx
├── SettingsScreen.jsx           — Config global (5 tabs, multi-cat, subcats)
├── ProductDetailScreen.jsx      — v2.1: cat+subcat modal, sin SEO tags
├── SoldEditDetailView.jsx       — v2.1: cat+subcat modal, TTS live, sin SEO
├── LogsScreen.jsx               — v2.0: dark terminal, filtros, import inteligente
└── DebugScreen.jsx

services/
├── DatabaseService.js           — v2.1: sin seoTags, getCategoryTags, LOG_CTX
├── LogService.js                — v2.0: niveles, contextos, span, filtrado
├── AIService.js
├── ImageProcessingService.js
├── NotificationService.js
└── ImageProcessor.js
```

---

**Sistema de Diseño v2.1 — ResellHub**  
*Última actualización: Febrero 2026*

---

## 🎯 Visión del Sistema

ResellHub es una app Android de gestión inteligente de ventas en Vinted. Su núcleo es un **motor de inteligencia de resubida** que aprende del comportamiento de los productos para generar oportunidades óptimas de venta.

La app se alimenta de datos scrapeados desde la consola del navegador en Vinted (vía script JSON), que el usuario importa puntualmente. El sistema mantiene una capa de **campos manuales protegidos** que nunca son sobreescritos por ninguna importación.

---

## 🎨 Filosofía de Diseño

**Minimalismo Vibrante** — interfaces limpias con toques de color estratégicos para guiar la atención hacia acciones importantes.

### Principios Clave

1. **Claridad Visual** — Jerarquía clara con espaciado generoso
2. **Acción Inmediata** — Botones y CTAs prominentes
3. **Feedback Constante** — Estados visuales para cada interacción
4. **Datos Primero** — Estadísticas siempre visibles y actualizadas
5. **Mobile-First** — Optimizado para uso con una mano (Poco X7 Pro)
6. **Configurabilidad Total** — Todos los parámetros del motor de IA son editables en Settings

---

## 🎨 Paleta de Colores

### Colores Primarios

```css
Primary Orange:    #FF6B35  — CTAs principales, acciones importantes
Secondary Blue:    #004E89  — Headers, elementos de confianza, tabs activos
```

### Colores Semánticos

```css
Success:   #00D9A3  — Productos vendidos, confirmaciones, TTS relámpago
Warning:   #FFB800  — Alertas, productos para resubir, TTS normal
Danger:    #E63946  — Errores, acciones destructivas, TTS ancla
Info:      #5E81AC  — Información neutral
```

### Colores Neutros

```css
Gray 50:   #F8F9FA  — Fondos suaves
Gray 100:  #F0F0F0  — Borders sutiles
Gray 200:  #E8E8E8  — Dividers
Gray 300:  #D0D0D0  — Disabled states
Gray 500:  #999999  — Secondary text
Gray 700:  #666666  — Body text
Gray 900:  #1A1A2E  — Headings, texto principal
```

### Gradientes

```css
Sunset:  linear-gradient(135deg, #FF6B35 0%, #E63946 100%)
Ocean:   linear-gradient(135deg, #004E89 0%, #5E81AC 100%)
Success: linear-gradient(135deg, #00D9A3 0%, #00C896 100%)
```

---

## 📏 Espaciado y Grid (8pt Grid)

```javascript
const SPACING = {
  xs:   4,   sm:   8,   md:   12,  base: 16,
  lg:   20,  xl:   24,  xxl:  32,  xxxl: 48,
};
// paddingHorizontal del container: 16dp
// marginBottom entre secciones: 20dp
// padding interno de cards: 16–18dp
```

---

## 🔤 Tipografía

```javascript
display1: { fontSize: 36, fontWeight: '800' }
h1:       { fontSize: 28, fontWeight: '800' }
h2:       { fontSize: 24, fontWeight: '700' }
h3:       { fontSize: 20, fontWeight: '700' }
body:     { fontSize: 16, fontWeight: '400' }
small:    { fontSize: 14, fontWeight: '400' }
caption:  { fontSize: 12, fontWeight: '500' }
label:    { fontSize: 10, fontWeight: '900', letterSpacing: 1.8, textTransform: 'uppercase' }
```

---

## 📱 Pantallas y Flujo de Navegación

```
Tab Navigator (Bottom Tabs)
├── DashboardScreen       — KPIs, alertas inteligentes, Smart Insights
├── ProductsScreen        — Lista activos con diagnóstico por producto
├── SoldHistoryScreen     — Historial vendidos, edición manual de campos
├── AdvancedStatsScreen   — Gráficos, TTS por categoría, calendario
└── SettingsScreen        — Configuración global (ver sección dedicada)

Stack Modals
├── ProductDetailScreen   — Detalle + acciones (resubir, vender, editar)
└── SoldEditDetailView    — Edición de campos manuales de vendidos
```

---

## ⚙️ SettingsScreen — Configuración Global (v2.0)

La pantalla de configuración organiza todos los parámetros en **5 pestañas horizontales** con scroll:

### Pestaña 1: Umbrales

| Parámetro | Clave | Por defecto | Descripción |
|-----------|-------|-------------|-------------|
| Producto invisible | `daysInvisible` + `viewsInvisible` | 60d / 20 vistas | Días sin ventas + pocas vistas |
| Falta de interés | `daysDesinterest` | 45d | Vistas pero 0 favoritos |
| Estado crítico | `daysCritical` | 90d | Umbral de alerta urgente |
| TTS Relámpago | `ttsLightning` + `priceBoostPct` | 7d / +10% | Vende rápido → subir precio |
| TTS Ancla | `ttsAnchor` + `priceCutPct` | 30d / -10% | Vende lento → bajar precio |
| Sensibilidad | `staleMultiplier` | 1.5× | Multiplicador sobre media de categoría |
| Límite histórico | `criticalMonthThreshold` | 6 meses | Meses hasta republicación obligatoria |

### Pestaña 2: Calendario de Oportunidades

- **Multi-categoría por mes**: cada mes puede tener **1 o más categorías** asignadas (array)
- Modal selector con lista de todas las categorías del diccionario
- Chips eliminables directamente en la fila del mes
- El motor de alertas y Smart Insights usa estas categorías para priorizar
- Formato en BD: `seasonalMap: { 0: ['Juguetes', 'Lotes'], 1: ['Ropa'], ... }`

### Pestaña 3: Categorías y Subcategorías

**Estructura del Diccionario Completo:**
```
Categoría raíz
├── Tags generales (detectan la categoría)
└── Subcategorías
    ├── Tags específicos (afinan la clasificación)
    └── ...más subcategorías
```

**Operaciones disponibles:**
- Crear/eliminar categorías raíz
- Crear/eliminar subcategorías dentro de cada categoría
- Añadir/eliminar tags en categoría o subcategoría
- El sistema detecta primero la categoría, luego intenta afinar la subcategoría

**Formato en BD:**
```json
{
  "Juguetes": {
    "tags": ["lego", "playmobil", "juguete"],
    "subcategories": {
      "Construcción": { "tags": ["lego", "bloques"] },
      "Figuras":      { "tags": ["playmobil", "muñeco"] }
    }
  }
}
```

**Doble almacenamiento:**
- `custom_dictionary` (legacy): `{ Juguetes: ["lego", "playmobil", ...] }` — usado por `detectCategory()` para compatibilidad
- `custom_dictionary_full`: formato completo con subcategorías

### Pestaña 4: Importación

**Campos protegidos configurables:**

| Campo | Toggle | Aplica a |
|-------|--------|----------|
| Categoría / Subcategoría | `preserveCategory` | Activos + Vendidos |
| Fecha de subida original | `preserveUploadDate` | Activos + Vendidos |
| Precio final de venta | `preserveSoldPrice` | Vendidos |
| Fecha real de venta | `preserveSoldDate` | Vendidos |
| Venta en lote/pack | `preserveIsBundle` | Vendidos |

**Automatización:**
- `autoDetectCategory`: detecta categoría automáticamente en productos nuevos
- `autoGenerateSeoTags`: genera tags SEO en productos nuevos

### Pestaña 5: Notificaciones

- Toggle global (`notifEnabled`)
- Frecuencia de revisión (`notifDays`)
- 4 tipos de alerta con toggle individual: Crítico, Estancado, Estacional, Oportunidad

---

## 🔄 Motor de Importación Inteligente (v2.0)

### Flujo de actualización

```
Usuario extrae JSON desde Vinted (scriptJSON en consola navegador)
         ↓
Carga archivo en la app (mis_productos_vinted_ACTUALIZADO.json)
         ↓
DatabaseService.importFromVinted(newProducts)
         ↓
┌─────────────────────────────────────────────────────────┐
│                   PARA CADA PRODUCTO                     │
│                                                         │
│  ¿Existe mismo ID en BD?                                │
│  ├── SÍ → MERGE INTELIGENTE                             │
│  │   ├─ Actualiza: precio, vistas, favs, status, imgs   │
│  │   ├─ PRESERVA: campos manuales según config           │
│  │   ├─ Si precio cambió → guarda en priceHistory       │
│  │   └─ Si vuelve de sold→active → marca reactivación   │
│  └── NO → ¿Es una resubida? (mismo título+marca)        │
│      ├── SÍ → Vincula con original (repostOf/repostTo)  │
│      │   └─ Hereda: category, seoTags, firstUploadDate  │
│      └── NO → Producto NUEVO                            │
│          ├─ Detecta categoría/subcategoría              │
│          └─ Genera SEO tags                             │
│                                                         │
│  Productos ausentes del JSON → marcados como `stale`    │
│  (no se eliminan, se marcan para revisión manual)       │
└─────────────────────────────────────────────────────────┘
         ↓
Log de importación guardado (últimos 50 imports)
```

### Campos manuales NUNCA sobreescritos

**Productos activos:** `category`, `subcategory`, `firstUploadDate`, `seoTags`

**Productos vendidos:** + `soldPrice`, `soldDate`, `isBundle`

### Detección de resubidas

Dos productos con **mismo título + misma marca pero diferente ID** se tratan como resubida:
- El nuevo hereda: `category`, `subcategory`, `seoTags`, `firstUploadDate`, `priceHistory`
- El original recibe: `repostTo`, `repostCount`, `repostedAt`
- El nuevo recibe: `repostOf` (referencia al original)

---

## 🧠 Motor de Inteligencia (Smart Engine)

### TTS — Time to Sell

```
TTS = soldDate - firstUploadDate    (en días)

⚡ RELÁMPAGO: TTS ≤ ttsLightning (def. 7d)  → Subir precio priceBoostPct%
🟡 NORMAL:   TTS entre lightning y anchor    → Mantener, mejorar fotos
⚓ ANCLA:    TTS > ttsAnchor (def. 30d)     → Bajar precio priceCutPct%
```

### Diagnóstico de productos activos

```
CRÍTICO:    daysOld >= daysCritical (def. 90d)
INVISIBLE:  daysOld >= daysInvisible (def. 60d) AND views < viewsInvisible (def. 20)
DESINTERÉS: daysOld >= daysDesinterest (def. 45d) AND favorites == 0
CASI LISTO: daysOld >= 30d AND favorites > 8
```

### Alertas Inteligentes (getSmartAlerts)

1. **ESTANCAMIENTO** — producto lleva más de `catAvgTTS × staleMultiplier` días → "REVISAR PRECIO"
2. **ESTACIONAL** — categoría del producto está en la lista del mes actual → "REPUBLICAR"
3. **CRÍTICO** — supera `criticalMonthThreshold × 30` días → "REPUBLICAR URGENTE"
4. **OPORTUNIDAD** — más de 8 favoritos y >20 días → "HACER OFERTA"

### Smart Insights (getSmartInsights)

Tarjetas de decisión ejecutiva en el Dashboard:
- **Categoría estrella** — la que vende más rápido
- **Ancla** — la más lenta, con consejo de reducción
- **Estacional** — categorías del mes actual (multi-categoría)
- **Benchmark TTS** — comparación con objetivo configurable

---

## 🗄️ Modelo de Datos del Producto

```javascript
{
  // ─── De Vinted (actualizables en import) ───────────────────────────
  id:           String,          // ID único Vinted
  title:        String,
  brand:        String,
  price:        Number,          // Precio actual en Vinted
  description:  String,
  images:       String[],
  status:       'available' | 'sold' | 'active',
  views:        Number,
  favorites:    Number,
  createdAt:    ISO String,      // Fecha de EXTRACCIÓN (no subida real)

  // ─── Manuales protegidos — NUNCA sobreescritos en import ──────────
  category:        String,       // Categoría principal
  subcategory:     String?,      // Subcategoría (opcional)
  firstUploadDate: ISO String,   // Fecha real de subida original a Vinted
  seoTags:         String,       // Tags SEO separados por coma
  soldPrice:       Number?,      // Precio final real de venta
  soldDate:        ISO String?,  // Fecha real de cierre
  isBundle:        Boolean,      // ¿Fue vendido en lote/pack?

  // ─── Generados por el sistema ──────────────────────────────────────
  priceHistory:    [{ oldPrice, newPrice, date, source }],
  repostOf:        String?,      // ID del producto original (si es resubida)
  repostTo:        String?,      // ID de la resubida (en el original)
  repostCount:     Number,       // Veces que ha sido resubido
  lastRepostDate:  ISO String?,
  stale:           Boolean?,     // true si no apareció en último import
  staleDetectedAt: ISO String?,
  lastSync:        ISO String,   // Última sincronización con Vinted
  lastActivity:    ISO String,
}
```

---

## 🧩 Componentes Clave

### SettingsScreen — Tab Bar Horizontal

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Configuración                                          💾   │
├─────────┬──────────┬────────────┬─────────────┬─────────────────┤
│Umbrales │Calendario│  Categorías │  Importación│     Avisos      │
└─────────┴──────────┴────────────┴─────────────┴─────────────────┘
```

### Selector Multi-Categoría (Calendario)

```
ENERO           [Juguetes ×] [Lotes ×]        [+]
FEBRERO         [Ropa ×]                       [+]
MARZO           Sin categoría                  [+]

  ↓ tap [+] abre modal bottom sheet
  ┌─────────────────────────┐
  │ Categorías para Enero   │
  │ Toca para añadir/quitar │
  │ ✓ Juguetes              │
  │   Ropa                  │
  │ ✓ Lotes                 │
  │   Calzado               │
  │        [Cerrar]         │
  └─────────────────────────┘
```

### Árbol de Categorías

```
▼ Juguetes [15 tags] [3 sub]          [⌄] [🗑]
  Tags generales: lego  playmobil  juguete  ...
  [+ Añadir tag]
  ──────────────
  Subcategorías
  ▶ Construcción       [+ sub]
  ▶ Figuras
  [Nueva subcategoría...]  [+]
```

---

## ♿ Accesibilidad

- Touch targets mínimo 48×48dp
- Contraste WCAG AA en todos los pares de color
- `accessibilityLabel` en todos los botones de acción
- `accessibilityRole` en interactivos
- Soporte lectores de pantalla (TalkBack Android)

---

## 📊 Iconografía (Feather Icons)

```
home          → Dashboard
package       → Productos
bar-chart-2   → Estadísticas
settings      → Configuración
alert-circle  → Crítico / Error
check-circle  → Vendido / Éxito
refresh-cw    → Resubir
eye / eye-off → Vistas / Invisible
clock         → Tiempo / Estancado
zap           → Relámpago / Oportunidad
anchor        → Ancla (lento)
heart         → Favoritos
download      → Importación
tag           → Categorías
calendar      → Calendario
bell          → Notificaciones
sliders       → Umbrales / Ajustes
corner-down-right → Subcategoría
```

---

## 🎭 Animaciones

| Tipo | Duración | Uso |
|------|----------|-----|
| Scale on Press | 200ms spring | Botones y cards |
| Fade In | 300ms timing | Carga de pantallas |
| Pulse | 1s loop | AlertBanner urgente |
| Slide from Bottom | spring friction:8 | Modals y sheets |

---

## 📱 Responsive — Poco X7 Pro

```javascript
// 393dp de ancho → clasificado como 'medium'
const { width, height } = Dimensions.get('window');
// Portrait: paddingHorizontal 20dp, cards full-width
// Landscape: grid 2 columnas para stats
const statsPerRow = width > height ? 4 : 3;
```

---

## 🌙 Modo Oscuro (Planificado)

```css
Dark Background:  #121212
Dark Surface:     #1E1E1E
Dark Border:      #2C2C2C
Primary Dark:     #FF7F4D
Success Dark:     #00EBB5
```

---

## 📦 Estructura de Archivos

```
screens/
├── DashboardScreen.jsx       — KPIs + alertas + insights
├── ProductsScreen.jsx        — Lista activos con diagnóstico
├── SoldHistoryScreen.jsx     — Vendidos + edición campos manuales
├── AdvancedStatsScreen.jsx   — Gráficos TTS, calendario, categorías
├── SettingsScreen.jsx        — Config global (5 tabs)
├── ProductDetailScreen.jsx   — Detalle + acciones
├── SoldEditDetailView.jsx    — Edición campos manuales vendidos
├── LogsScreen.jsx            — Debug y log de operaciones
└── DebugScreen.jsx           — Herramientas de desarrollo

services/
├── DatabaseService.js        — FUENTE ÚNICA DE VERDAD (datos + lógica)
├── AIService.js              — Análisis de imágenes con IA
├── ImageProcessingService.js — Conversión WEBP→JPEG, recorte 1px
├── NotificationService.js    — Gestión de alertas y avisos
└── LogService.js             — Sistema de logging
```

---

## 🔑 Storage Keys (MMKV)

| Clave | Contenido |
|-------|-----------|
| `products` | Array de todos los productos (activos + vendidos) |
| `app_user_config` | Configuración global del usuario |
| `custom_dictionary` | Diccionario legacy: `{ cat: [tags] }` |
| `custom_dictionary_full` | Diccionario completo con subcategorías |
| `import_log` | Historial de las últimas 50 importaciones |

---

**Sistema de Diseño v2.0 — ResellHub**  
*Última actualización: Febrero 2026*
