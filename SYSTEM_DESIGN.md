# 🏗️ SYSTEM DESIGN — ResellHub
> **Sprint 1 v4.2 — Activación de Potencia**
> Rama: `feature/sprint1-activation-v4.2`
> Fecha: Marzo 2026

---

## 📋 Changelog Sprint 1 v4.2

### Resumen ejecutivo

Este sprint consolida la capa de protección de datos y actualiza la UI al sistema visual AMOLED. Los cambios son **retrocompatibles**: todos los accesos a campos legacy (`soldPrice`, `soldDate`) funcionan como fallback, por lo que los productos importados antes del sprint seguirán leyendo correctamente hasta su primera edición manual.

---

### [ARCHITECT] — DatabaseService.js · skill `smart_merge`

#### ✅ Los 7 Campos Sagrados — Definición Formal

Se amplía y formaliza la lista de campos inmutables. Ningún proceso de `importFromVinted()`, sync automático ni agente externo puede sobreescribirlos.

| # | Campo | Tipo | Aplica a | Descripción |
|---|-------|------|----------|-------------|
| 1 | `firstUploadDate` | ISO String | Activos + Vendidos | Fecha real de primera subida a Vinted |
| 2 | `category` | String | Activos + Vendidos | Categoría del diccionario (asignada manualmente) |
| 3 | `title` | String | Activos + Vendidos | Título curado por el usuario |
| 4 | `brand` | String | Activos + Vendidos | Marca curada por el usuario |
| 5 | `soldPriceReal` | Number? | Solo Vendidos | Precio final real de venta (introducido en modal) |
| 6 | `soldDateReal` | ISO String? | Solo Vendidos | Fecha real de cierre de venta (introducida en modal) |
| 7 | `isBundle` | Boolean | Activos + Vendidos | Venta en lote/pack — inicializa siempre en `false` |

**Constantes actualizadas en código:**

```js
// ANTES (v4.1)
const MANUAL_FIELDS_ACTIVE = ['category', 'subcategory', 'firstUploadDate'];
const MANUAL_FIELDS_SOLD   = ['soldPrice', 'soldDate', 'isBundle', 'category', 'subcategory', 'firstUploadDate'];

// DESPUÉS (v4.2)
const MANUAL_FIELDS_ACTIVE = ['category', 'subcategory', 'firstUploadDate', 'title', 'brand'];
const MANUAL_FIELDS_SOLD   = ['soldPriceReal', 'soldDateReal', 'isBundle', 'category', 'subcategory', 'firstUploadDate', 'title', 'brand'];
```

#### ✅ Blindaje del import contra `soldPriceReal`

El método `importFromVinted()` ya preservaba `soldPrice` si `preserveSoldPrice: true`. En v4.2 se extiende para proteger `soldPriceReal`:

```js
// smart_merge: la nueva entrada en MANUAL_FIELDS_SOLD garantiza que
// en el bucle de merge nunca se sobreescriba soldPriceReal, incluso
// si el JSON de Vinted incluye un campo con ese nombre.
manualFields.forEach(field => {
  if (old[field] !== undefined && old[field] !== null) {
    merged[field] = old[field]; // soldPriceReal protegido aquí
  }
});
```

#### ✅ `markAsSold()` actualizado

```js
// ANTES
all[idx].soldPrice = soldPrice != null ? soldPrice : (all[idx].soldPrice || all[idx].price);
all[idx].soldDate  = soldDate  || all[idx].soldDate  || new Date().toISOString();

// DESPUÉS
all[idx].soldPriceReal = soldPrice != null ? soldPrice : (all[idx].soldPriceReal || all[idx].soldPrice || all[idx].price);
all[idx].soldDateReal  = soldDate  || all[idx].soldDateReal  || new Date().toISOString();
```

#### ✅ `isBundle` — Siempre inicializado en `false`

En productos nuevos (dentro de `importFromVinted`):

```js
const newEntry = {
  ...p,
  isBundle: false,  // Garantizado en todos los productos nuevos
  // ...
};
```

---

### [DATA_SCIENTIST] — DatabaseService.js · skill `tts_calculator`

#### ✅ Motor TTS Recalibrado

La función `calcTTS()` ha sido reescrita para usar exclusivamente `soldDateReal` como fecha de venta. Esto elimina el ruido de los TTS basados en fechas automáticas (`soldAt`, `soldDate`) que no representan el momento real de la transacción.

```js
// ANTES (v4.1) — usaba cualquier fecha disponible
export function calcTTS(product) {
  const start = product.firstUploadDate || product.createdAt;
  const end   = product.soldDate || product.soldAt;
  if (!start || !end) return null;
  return daysBetween(start, end);
}

// DESPUÉS (v4.2) — solo soldDateReal; null si no hay fecha manual
export function calcTTS(product) {
  if (!product.soldDateReal) return null;  // Ignora productos sin fecha real
  const start = product.firstUploadDate || product.createdAt;
  if (!start) return null;
  return daysBetween(start, product.soldDateReal);
}
```

**Impacto en analytics:**

- `getCategoryStats()` — los promedios TTS por categoría solo incluyen productos con `soldDateReal` real. Resultado: estadísticas más precisas, no infladas por fechas de extracción del scraper.
- `getBusinessKPIs().avgTTS` — idem.
- `getSmartInsights()` — las categorías "Relámpago" y "Ancla" se calculan sobre datos limpios.

**Retrocompatibilidad:** Los productos importados antes de v4.2 que tengan `soldDate` pero no `soldDateReal` mostrarán TTS `null` hasta que el usuario edite la ficha de venta en `SoldEditDetailView`. Esto es intencional: datos incompletos = no contar en el promedio.

---

### [UI_SPECIALIST] — Pantallas · skill `UI_SYNC_8PT`

#### ✅ Paleta AMOLED — Constante compartida

Todas las pantallas afectadas inyectan la constante `AMOLED` como fuente de verdad visual:

```js
const AMOLED = {
  bg:        '#0A0A12',   // Fondo AMOLED true black (Poco X7 Pro)
  surface:   '#111120',   // Superficie de cards
  surface2:  '#16162A',   // Modals / hojas elevadas
  border:    '#1E1E2E',   // Bordes sutiles
  primary:   '#FF6B35',   // Naranja primario — CTAs, métricas clave
  success:   '#00D9A3',   // Vendido / éxito
  warning:   '#FFB800',   // Alerta / estancado
  danger:    '#E63946',   // Crítico / error
  blue:      '#004E89',   // Headers / confianza
  textHi:    '#E8E8F0',   // Texto alta emphasis
  textMed:   '#888899',   // Texto media emphasis
  textLow:   '#444456',   // Texto baja emphasis
  mono:      'monospace', // Fuente monoespaciada para precios y fechas
};
```

**Pantallas actualizadas:**
- `DashboardScreen.jsx` — fondo, cards, TTS metric, seasonal banner, KPI cards
- `ProductDetailScreen.jsx` — paleta C remapeada a AMOLED
- `SoldEditDetailView.jsx` — paleta C remapeada a AMOLED

#### ✅ JetBrains Mono / monospace en precios y fechas

Aplicado en los siguientes estilos:

| Pantalla | Elemento | Estilo aplicado |
|----------|----------|-----------------|
| Dashboard | `kpiValueLight` | `fontFamily: AMOLED.mono` |
| Dashboard | `kpiSmallValue` | `fontFamily: AMOLED.mono` |
| Dashboard | `ttsValue` | `fontFamily: AMOLED.mono` |
| Dashboard | `ttsStatValue` | `fontFamily: AMOLED.mono` |
| Dashboard | `vintedVal` | `fontFamily: AMOLED.mono` |
| ProductDetail | Input precio de venta | `fontFamily: AMOLED.mono` |
| SoldEditDetail | Input `soldPriceReal` | `fontFamily: AMOLED.mono` |

#### ✅ Modal de Venta — `soldPriceReal` (nuevo componente)

Se añade un nuevo modal bottom-sheet en `ProductDetailScreen` para registrar el precio real de venta en el momento de marcar como vendido.

**Flujo:**

```
Usuario pulsa [✓ Vendido]
       ↓
Modal aparece con:
  · Mini-ficha del producto (título + precio publicado)
  · Input numérico centrado (placeholder = precio publicado)
  · Nota: "soldPriceReal no se sobreescribirá en futuras importaciones"
       ↓
Usuario introduce precio real → [Confirmar Venta]
       ↓
DatabaseService.markAsSold(id, soldPriceReal, soldDateReal=ahora, isBundle=false)
       ↓
Estado del producto: status='sold', soldPriceReal guardado, modal cierra
```

**Estado añadido al componente:**

```js
const [showSoldModal, setShowSoldModal]   = useState(false);
const [soldPriceInput, setSoldPriceInput] = useState('');
```

**Handler:**

```js
const handleMarkAsSold = () => {
  const price = parseFloat(soldPriceInput);
  if (!price || price <= 0) { Alert.alert('Precio requerido', ...); return; }
  const soldDateReal = new Date().toISOString();
  DatabaseService.markAsSold(product.id, price, soldDateReal, false);
  // Actualiza estado local + cierra modal
};
```

---

### [QA_ENGINEER] — skill `CLEAN_CODE_PURGE`

#### ✅ `seoTags` / `autoGenerateSeoTags` — Purga Final

Eliminados todos los restos operativos. Solo se mantienen comentarios históricos de "eliminado en v2.2" para trazabilidad.

| Fichero | Línea eliminada |
|---------|-----------------|
| `screens/SettingsScreen.jsx` | `autoGenerateSeoTags: true` en DEFAULT_CONFIG local |
| `screens/SettingsScreen.jsx` | UI row con label "Generación automática de SEO tags" |
| `services/DatabaseService.js` | Comentario `"Genera SEO tags (si config.autoGenerateSeoTags)"` en docstring importFromVinted |

**Verificación:**

```bash
# Debe devolver solo comentarios históricos, no código activo:
grep -rn "autoGenerateSeoTags" screens/ services/
# → 0 resultados activos
```

#### ✅ `isBundle` en schema verificado

- Inicializado como `false` en todos los productos nuevos creados por `importFromVinted()`
- Presente en `MANUAL_FIELDS_SOLD` — nunca sobreescrito en imports
- Presente en la UI de edición de `SoldEditDetailView` y `ProductDetailScreen`
- No expuesto en UI de productos activos (solo relevante al marcar como vendido)

---

### [LIBRARIAN] — Documentación

#### ✅ Ficheros modificados en esta rama

```
feature/sprint1-activation-v4.2
├── services/
│   └── DatabaseService.js          ← ARCHITECT + DATA_SCIENTIST
├── screens/
│   ├── DashboardScreen.jsx         ← UI_SPECIALIST (AMOLED)
│   ├── ProductDetailScreen.jsx     ← UI_SPECIALIST (AMOLED + modal vendido)
│   ├── SoldEditDetailView.jsx      ← UI_SPECIALIST (AMOLED + soldPriceReal)
│   ├── SoldHistoryScreen.jsx       ← QA (soldPriceReal/soldDateReal reads)
│   └── SettingsScreen.jsx          ← QA (purga autoGenerateSeoTags)
└── SYSTEM_DESIGN.md               ← LIBRARIAN (este fichero)
```

#### ✅ Ficheros NO modificados (código original preservado)

```
App.jsx                             — Navegación intacta
services/AIService.js               — Sin cambios
services/ImageProcessingService.js  — Sin cambios
services/ImageProcessor.js          — Sin cambios
services/NotificationService.js     — Sin cambios
services/LogService.js              — Sin cambios
screens/ProductsScreen.jsx          — Sin cambios
screens/AdvancedStatsScreen.jsx     — Sin cambios
screens/LogsScreen.jsx              — Sin cambios
screens/DebugScreen.jsx             — Sin cambios
android/                            — Sin cambios
assets/                             — Sin cambios
```

---

## 🗄️ Modelo de Datos Actualizado (v4.2)

```js
{
  // ─── De Vinted (actualizables en import) ───────────────────────────
  id:           String,
  price:        Number,          // Precio actual en Vinted
  description:  String,
  images:       String[],
  status:       'available' | 'sold' | 'active',
  views:        Number,
  favorites:    Number,
  createdAt:    ISO String,      // Fecha de EXTRACCIÓN del scraper

  // ─── LOS 7 SAGRADOS — NUNCA sobreescritos en import ──────────────
  firstUploadDate: ISO String,   // [1] Fecha real de subida
  category:        String,       // [2] Categoría del diccionario
  title:           String,       // [3] Título curado
  brand:           String,       // [4] Marca curada
  soldPriceReal:   Number?,      // [5] Precio final real de venta ← NUEVO v4.2
  soldDateReal:    ISO String?,  // [6] Fecha real de cierre ← NUEVO v4.2
  isBundle:        Boolean,      // [7] Lote/pack — init: false

  // ─── Campos de venta legacy (solo lectura como fallback) ────────
  // soldPrice / soldDate: mantenidos para retrocompatibilidad
  // En producción, usar siempre soldPriceReal / soldDateReal

  // ─── Generados por el sistema ──────────────────────────────────────
  subcategory:     String?,
  priceHistory:    [{ oldPrice, newPrice, date, source }],
  repostOf:        String?,
  repostTo:        String?,
  repostCount:     Number,
  lastRepostDate:  ISO String?,
  stale:           Boolean?,
  staleDetectedAt: ISO String?,
  lastSync:        ISO String,
  lastActivity:    ISO String,
}
```

---

## 🧠 Motor TTS — Diagrama de Flujo (v4.2)

```
calcTTS(product)
       │
       ├─ product.soldDateReal === null?
       │   └─ YES → return null (no contar en estadísticas)
       │
       └─ NO
           │
           ├─ start = product.firstUploadDate || product.createdAt
           │
           └─ return daysBetween(start, product.soldDateReal)
                          ↓
              getCategoryStats() → avgTTS por categoría
                          ↓
              ttsLabel(avgTTS, config)
              ├─ ≤ ttsLightning (7d): ⚡ RELÁMPAGO → subir precio
              ├─ ≤ ttsAnchor   (30d): 🟡 NORMAL    → mantener
              └─ >  ttsAnchor  (30d): ⚓ ANCLA     → bajar precio
```

---

## 🔄 Flujo de Venta — Nuevo Modal (v4.2)

```
ProductDetailScreen
       │
       ├─ [✓ Vendido] visible solo si product.status !== 'sold'
       │
       └─ onPress → setSoldPriceInput('') → setShowSoldModal(true)
                          ↓
              SoldPriceModal (bottom sheet)
              ├─ Input: soldPriceReal (número)
              ├─ Validación: price > 0
              └─ [Confirmar Venta]
                          ↓
              DatabaseService.markAsSold(
                id,
                soldPriceReal,      // ← precio introducido
                new Date().toISOString(), // ← soldDateReal = ahora
                false               // ← isBundle siempre false en este flujo
              )
                          ↓
              MMKV: product.soldPriceReal + product.soldDateReal guardados
              Los 7 Sagrados protegen estos valores de futuros imports
```

---

## 📱 Guía de Rama Git

```bash
# Crear rama desde main
git checkout main
git checkout -b feature/sprint1-activation-v4.2

# Añadir los ficheros cambiados
git add services/DatabaseService.js
git add screens/DashboardScreen.jsx
git add screens/ProductDetailScreen.jsx
git add screens/SoldEditDetailView.jsx
git add screens/SoldHistoryScreen.jsx
git add screens/SettingsScreen.jsx
git add SYSTEM_DESIGN.md

# Commit estructurado
git commit -m "feat(sprint1-v4.2): The 7 Sacred Fields + AMOLED theme + soldPriceReal modal

[ARCHITECT]
- Define Los 7 Campos Sagrados (firstUploadDate, category, title, brand,
  soldPriceReal, soldDateReal, isBundle)
- Rename soldPrice→soldPriceReal, soldDate→soldDateReal in DatabaseService
- smart_merge: soldPriceReal blindado contra import overwrites
- isBundle: siempre false en productos nuevos

[DATA_SCIENTIST]
- calcTTS(): usa exclusivamente soldDateReal como fecha terminus
- Devuelve null si soldDateReal es null (no contamina estadísticas)
- Retrocompatible: fallback a soldDate/soldAt en lecturas legacy

[UI_SPECIALIST]
- AMOLED palette #0A0A12 + primary #FF6B35 en Dashboard, ProductDetail, SoldEdit
- JetBrains Mono / monospace en todos los precios y fechas
- Nuevo modal SoldPriceReal: bottom-sheet para introducir precio real al vender

[QA_ENGINEER]
- Purga definitiva de autoGenerateSeoTags (SettingsScreen + DatabaseService)
- Verificación isBundle: false en schema
- SoldHistoryScreen: lee soldPriceReal con fallback legacy

[LIBRARIAN]
- SYSTEM_DESIGN.md: documentación completa Sprint 1 v4.2"

# Merge a main cuando esté probado
git checkout main
git merge --no-ff feature/sprint1-activation-v4.2 -m "merge: Sprint 1 v4.2 activation"
```

---

## ⚙️ Compatibilidad y Migración

### Productos existentes en MMKV antes de v4.2

| Campo antiguo | Campo nuevo | Comportamiento |
|---------------|-------------|----------------|
| `soldPrice` | `soldPriceReal` | `markAsSold()` lee `soldPriceReal \|\| soldPrice \|\| price` |
| `soldDate` | `soldDateReal` | `calcTTS()` requiere `soldDateReal`; si es null → TTS=null |
| `seoTags` | _(eliminado)_ | Ignorado en reads; nunca escrito |

### Acción recomendada para datos históricos

Para aprovechar los TTS recalibrados, el usuario debe:
1. Abrir cada producto vendido desde `SoldHistoryScreen`
2. Tocar "Editar" en `SoldEditDetailView`
3. Confirmar o corregir `soldDateReal` y `soldPriceReal`
4. Guardar → TTS se incluirá en estadísticas desde ese momento

---

## 📐 Sistema de Diseño — Referencia Rápida

Ver `DESIGN_SYSTEM.md` para la documentación visual completa.

### Delta v4.2 vs v2.2

| Elemento | v2.2 | v4.2 |
|----------|------|------|
| Fondo principal | `#F8F9FA` (blanco) | `#0A0A12` (AMOLED) |
| Cards | `#FFFFFF` | `#111120` |
| Texto principal | `#1A1A2E` | `#E8E8F0` |
| Precios/fechas | Sistema font | `monospace` |
| Modo | Light | Dark AMOLED |

---

**SYSTEM_DESIGN.md — ResellHub Sprint 1 v4.2**
*Generado por [LIBRARIAN] · Marzo 2026*

---

## 📋 Sprint 2 — Categorías y Subcategorías en Toda la App

> **Sprint 2 · Categorías Globales**
> Rama: `feature/sprint2-categorias-globales`
> Fecha: Marzo 2026

### Objetivo

Extender el uso de `category` + `subcategory` y de todas las variables configuradas en Settings a **cada pantalla, cálculo y lógica de negocio** de la app.

---

### [ARCHITECT] — DatabaseService.js

#### ✅ `getMonthlyHistory()` — Desglose por Categoría y Subcategoría

Añadido `categoryBreakdown` por mes: acumula profit, ventas e ingresos por categoría y por subcategoría. Cada mes expone también `topCategory[]` con la categoría más rentable del mes y su `topSub`.

```js
// Antes: solo { profit, sales, revenue, bundles }
// Ahora: también incluye
categoryBreakdown: {
  'Zapatillas': {
    profit: 45.50, sales: 3, revenue: 90.00,
    subcategories: { 'Running': { profit: 30, sales: 2 } }
  }
},
topCategory: [
  { name: 'Zapatillas', profit: 45.50, sales: 3, topSub: { name: 'Running', profit: 30 } }
]
```

#### ✅ `getBusinessKPIs()` — Campo `topSubcategory`

Nuevo campo en el retorno: la subcategoría más rápida (menor `avgTTS`) de todo el catálogo de ventas.

```js
topSubcategory: {
  name: 'Running',
  parentCategory: 'Zapatillas',
  avgTTS: 4,
  count: 2,
}
```

#### ✅ `getSmartAlerts()` — Umbrales de Settings + Subcategoría

- Alerta **estancamiento**: ahora usa el TTS de la **subcategoría** del producto (si existe), si no el de la categoría. Mensaje incluye `Categoría › Subcategoría`.
- Alerta **estacional**: incluye precio de subida sugerido (`config.priceBoostPct`) en el mensaje.
- Alerta **oportunidad**: umbrales `opportunityFavs` y `opportunityDays` desde Settings.
- Alerta **crítico**: mensaje enriquecido con categoría y subcategoría.
- Todos los alerts exponen `{ category, subcategory }` para la UI.

#### ✅ `getSmartInsights()` — Subcategorías en Estrella y Ancla

- **Estrella**: busca la subcategoría relámpago dentro de la categoría estrella. Mensaje incluye `priceBoostPct` de Settings.
- **Ancla**: expone la subcategoría más lenta. Mensaje incluye `priceCutPct` de Settings.

#### ✅ `DEFAULT_CONFIG` — 7 Nuevos Parámetros

| Clave | Default | Descripción |
|-------|---------|-------------|
| `hotViews` | `50` | Vistas mínimas para marcar producto como HOT |
| `hotFavs` | `10` | Favoritos mínimos para HOT |
| `hotDays` | `30` | Días máximos para HOT |
| `daysAlmostReady` | `30` | Días publicado para "Casi Listo" |
| `favsAlmostReady` | `8` | Favoritos mínimos para "Casi Listo" |
| `opportunityFavs` | `8` | Favoritos para alerta oportunidad |
| `opportunityDays` | `20` | Días mínimos para alerta oportunidad |

#### ✅ `getProductSeverity()` — "Casi Listo" desde Config

```js
// Antes (hardcoded)
if (daysOld >= 30 && favorites > 8)

// Ahora (dinámico)
const limitAlmostReady = parseInt(cfg.daysAlmostReady || 30);
const favsAlmostReady  = parseInt(cfg.favsAlmostReady  || 8);
if (daysOld >= limitAlmostReady && favorites > favsAlmostReady)
```

#### ✅ `getActiveProductsWithDiagnostic()` — isHot desde Config

```js
// Antes
isHot: (views > 50 || favorites > 10) && daysOld < 30

// Ahora
const hotViews = parseInt(config.hotViews || 50);
const hotFavs  = parseInt(config.hotFavs  || 10);
const hotDays  = parseInt(config.hotDays   || 30);
isHot: (views > hotViews || favorites > hotFavs) && daysOld < hotDays
```

#### ✅ `catAvgTTS` fallback — usa `config.ttsAnchor`

```js
// Antes
const catAvgTTS = catTTSMap[cat] || 30; // hardcoded

// Ahora
const ttsAnchorVal = parseInt(config.ttsAnchor || 30);
const catAvgTTS    = catTTSMap[cat] || ttsAnchorVal;
```

---

### [UI_SPECIALIST] — Pantallas actualizadas

#### ✅ DashboardScreen
- Banner estacional lee `config.seasonalMap` en tiempo real (sin objeto estático).
- Panel RELÁMPAGO/ANCLA muestra la mejor/peor subcategoría de cada categoría.
- Nueva fila **TOP SUBCATEGORÍA** con `kpis.topSubcategory`.
- Init síncrono: `useState(() => DatabaseService.getConfig())`.

#### ✅ ProductsScreen
- Tarjeta muestra `Categoría › Subcategoría · Marca` bajo el título.
- Chips de filtro rápido por categoría sobre el inventario.
- Banner estacional lee `config.seasonalMap` dinámico.
- `SEASONAL_ADVICE` estático **eliminado**.
- Init síncrono: `useState(() => DatabaseService.getConfig())`.

#### ✅ SoldHistoryScreen *(fix crítico Sprint 3)*
- Tarjeta muestra `Categoría › Subcategoría` en metaRow.
- Chips de filtro por categoría sobre la lista.
- Colores TTS del chip y del KPI usan `ttsLightning`/`ttsAnchor` de config.
- Init síncrono: `useState(() => DatabaseService.getConfig())`.
- Guard: `if (!config) return null` como salvaguarda adicional.
- Leyenda TTS dinámica: `⚡≤Xd · 🟡X-Xd · ⚓>Xd (según Settings)`.

#### ✅ AdvancedStatsScreen
- Tab "Velocidad": subtítulo usa `ttsLightning`, `ttsAnchor`, `priceBoostPct`, `priceCutPct` de config.
- Recomendaciones de estrategia usan umbrales dinámicos de config.
- Barra de progreso TTS usa `ttsAnchor` como referencia.
- Subcategorías expandibles en cada categoría con su propio TTS, beneficio y tags.
- Tab "Por Mes": muestra top categoría + top subcategoría del mes.
- KPI chip "⚡ TOP SUB" con la subcategoría más rápida del catálogo.
- Init síncrono: `useState(() => DatabaseService.getConfig())`.

#### ✅ SoldEditDetailView
- Colores e iconos del panel TTS usan `ttsLightning`/`ttsAnchor` de config.
- `getConfig()` síncrono al inicio del componente.
- Fix: dep de `useMemo` era `editForm.soldDate` → corregido a `editForm.soldDateReal`.

#### ✅ ProductDetailScreen
- `statusInfo.isHot` usa `hotViews`, `hotFavs`, `hotDays` de config.
- `getConfig()` síncrono dentro del `useMemo` de `statusInfo`.

---

### [QA_ENGINEER] — Purgas y Verificaciones

#### ✅ Objetos estáticos eliminados

| Objeto | Pantalla | Reemplazado por |
|--------|----------|----------------|
| `SEASONAL_ADVICE` | ProductsScreen | `config.seasonalMap` dinámico |
| `MONTH_SEASONAL_TIPS` | DashboardScreen | `config.seasonalMap` dinámico |

#### ✅ Valores hardcoded eliminados

Todos los umbrales numéricos que existían hardcodeados en lógica de negocio han sido reemplazados por sus equivalentes en `config`:

| Antes | Después |
|-------|---------|
| `favorites > 8` | `config.favsAlmostReady` |
| `views > 50` | `config.hotViews` |
| `favorites > 10` | `config.hotFavs` |
| `daysOld < 30` (HOT) | `config.hotDays` |
| `favorites > 8 && daysOld > 20` (alert) | `config.opportunityFavs` + `config.opportunityDays` |
| `catAvgTTS \|\| 30` (fallback) | `config.ttsAnchor` |
| `tts <= 7` (color) | `config.ttsLightning` |
| `tts <= 30` (color) | `config.ttsAnchor` |
| `avgTTS <= 7 / <= 30` (KPI color) | `config.ttsLightning` / `config.ttsAnchor` |
| `catAvg * 30 → estrategia en UI` | `config.ttsAnchor` |

---

### [DATA_SCIENTIST] — SettingsScreen

#### ✅ Nuevos controles en pestaña "Umbrales"

Tres nuevos `SettingCard` con sus `NumInput`:

```
┌─────────────────────────────────────────────────────────┐
│ ⚡ Producto HOT                                         │
│   Vistas mínimas [50] · Favs mínimos [10] · Días [30] │
├─────────────────────────────────────────────────────────┤
│ 💚 Casi Listo                                           │
│   Días publicado [30] · Favs mínimos [8]               │
├─────────────────────────────────────────────────────────┤
│ 🔔 Alerta Oportunidad                                   │
│   Favs para alerta [8] · Días mínimos [20]             │
└─────────────────────────────────────────────────────────┘
```

#### ✅ Componente `CfgSection` definido

Componente auxiliar para cabeceras de subsección dentro de un `SettingCard`:

```jsx
const CfgSection = ({ title, sub, icon, iconColor }) => (
  <View style={{ flexDirection: 'row', ... }}>
    <Icon name={icon} color={iconColor} />
    <View>
      <Text>{title}</Text>
      <Text>{sub}</Text>
    </View>
  </View>
);
```

---

### [LIBRARIAN] — Patrón Canónico de Config

> **REGLA DE ORO**: Toda pantalla que use variables de Settings **debe** seguir
> uno de estos dos patrones. Nunca usar `useState(null)` para config sin init síncrono.

#### Patrón A — Estado con init síncrono (pantallas con reload en foco)

```js
// ✅ CORRECTO
const [config, setConfig] = useState(() => DatabaseService.getConfig());

const loadData = () => {
  setConfig(DatabaseService.getConfig()); // refresh en foco
  // ... otros datos
};
```

*Úsalo en: DashboardScreen, ProductsScreen, SoldHistoryScreen, AdvancedStatsScreen*

#### Patrón B — Lectura síncrona directa (componentes de edición)

```js
// ✅ CORRECTO
export default function MyScreen() {
  const cfg = DatabaseService.getConfig();
  const ttsLightning = parseInt(cfg?.ttsLightning || 7);
  const ttsAnchor    = parseInt(cfg?.ttsAnchor    || 30);
  // ... usar directamente
}
```

*Úsalo en: SoldEditDetailView, y dentro de `useMemo`/callbacks en ProductDetailScreen*

#### ❌ Antipatrón (NUNCA hacer)

```js
// ❌ INCORRECTO — config es null hasta que carga el useEffect
const [config, setConfig] = useState(null);
// ...
// ttsLightning accedido ANTES del guard → ReferenceError
<Text>{tts <= ttsLightning ? '⚡' : '🟡'}</Text>
```

---

### Archivos Modificados en Sprint 2 + Sprint 3

| Archivo | Sprint | Tipo de cambio |
|---------|--------|----------------|
| `services/DatabaseService.js` | S2 | getMonthlyHistory, getSmartAlerts, getSmartInsights, getBusinessKPIs, DEFAULT_CONFIG, getProductSeverity, getActiveProductsWithDiagnostic, calcTTS |
| `screens/DashboardScreen.jsx` | S2+S3 | seasonalMap dinámico, topSubcategory, subcategorías en bestCat/worstCat, init síncrono |
| `screens/ProductsScreen.jsx` | S2+S3 | category+sub en tarjeta, filtro por cat, seasonalMap dinámico, init síncrono |
| `screens/SoldHistoryScreen.jsx` | S2+S3 | subcategoría en tarjeta, filtro por cat, ttsLightning/ttsAnchor dinámicos, init síncrono, **fix ReferenceError** |
| `screens/AdvancedStatsScreen.jsx` | S2+S3 | umbrales dinámicos, subcategorías expandibles, monthly topCat, topSubcategory KPI, init síncrono |
| `screens/SoldEditDetailView.jsx` | S2+S3 | ttsLightning/ttsAnchor dinámicos, fix dep useMemo |
| `screens/ProductDetailScreen.jsx` | S2+S3 | isHot dinámico (hotViews/hotFavs/hotDays) |
| `screens/SettingsScreen.jsx` | S2 | CfgSection, 3 nuevos SettingCard, 7 nuevos config keys |

---

### Git Workflow — Sprint 2 + Sprint 3

```bash
git checkout main
git checkout -b feature/sprint2-categorias-globales

git add services/DatabaseService.js
git add screens/DashboardScreen.jsx
git add screens/ProductsScreen.jsx
git add screens/SoldHistoryScreen.jsx
git add screens/AdvancedStatsScreen.jsx
git add screens/SoldEditDetailView.jsx
git add screens/ProductDetailScreen.jsx
git add screens/SettingsScreen.jsx
git add SYSTEM_DESIGN.md

git commit -m "feat(sprint2+3): categorías/subcategorías globales + config canónico

[ARCHITECT]
- getMonthlyHistory: categoryBreakdown + topCategory por mes
- getBusinessKPIs: nuevo topSubcategory
- getSmartAlerts: usa subcategoría en TTS efectivo, enriquece mensajes
- getSmartInsights: subcategoría estrella y ancla con umbrales dinámicos
- getProductSeverity: daysAlmostReady + favsAlmostReady desde config
- getActiveProductsWithDiagnostic: hotViews/hotFavs/hotDays desde config
- DEFAULT_CONFIG: 7 nuevos parámetros
- catAvgTTS fallback usa config.ttsAnchor

[UI_SPECIALIST]
- DashboardScreen: seasonalMap dinámico, topSubcategory, subcats en bestCat
- ProductsScreen: cat+sub en tarjeta, filtro cat, seasonalMap dinámico
- SoldHistoryScreen: subcategoría en tarjeta, filtro cat, TTS dinámico
- AdvancedStatsScreen: umbrales dinámicos, subcats expandibles, monthly topCat
- SoldEditDetailView: TTS color dinámico, fix dep useMemo soldDateReal
- ProductDetailScreen: isHot con hotViews/hotFavs/hotDays desde config

[QA_ENGINEER]
- Purga SEASONAL_ADVICE + MONTH_SEASONAL_TIPS estáticos
- Todos los hardcoded thresholds reemplazados por config.*
- FIX: ReferenceError ttsLightning en SoldHistoryScreen
- Patrón canónico: useState(() => DatabaseService.getConfig())

[DATA_SCIENTIST]
- SettingsScreen: 3 nuevos SettingCard (HOT, Casi Listo, Oportunidad)
- CfgSection: componente definido y usado correctamente

[LIBRARIAN]
- SYSTEM_DESIGN.md: Sprint 2 + Sprint 3 documentados
- Patrón canónico de config con ejemplos y antipatrón"

git checkout main
git merge --no-ff feature/sprint2-categorias-globales -m "merge: Sprint 2+3 categorías globales"
```

---

## 📋 Sprint 4 — Light Theme Global + Rediseño de Pantallas de Detalle

> **Sprint 4 · Design System Unificado**
> Rama: `feature/sprint4-light-theme-detail-screens`
> Fecha: Marzo 2026

### Objetivo

Unificar toda la aplicación bajo el **Design System Light canónico** (`DS`), mejorar la UX de las pantallas de detalle de pedidos y de vendidos, e introducir el componente `CalPicker` mejorado en toda la app.

---

### [ARCHITECT] — Design System Light Canónico

#### ✅ DS Object — Paleta Oficial ResellHub

Todas las pantallas deben usar este objeto como única fuente de verdad de colores. Definido y exportado implícitamente como constante local en cada pantalla.

```js
const DS = {
  bg:        '#F8F9FA',   // Fondo principal
  white:     '#FFFFFF',   // Superficie / cards
  surface2:  '#F0F2F5',   // Superficie secundaria
  border:    '#EAEDF0',   // Bordes suaves
  primary:   '#FF6B35',   // Acento naranja (marca)
  primaryBg: '#FFF2EE',   // Fondo acento
  success:   '#00D9A3',   // Verde (vendido, TTS rápido)
  successBg: '#E8FBF6',   // Fondo verde
  warning:   '#FFB800',   // Amarillo (intermedio)
  danger:    '#E63946',   // Rojo (TTS lento, pérdidas)
  blue:      '#004E89',   // Azul (categoría/sistema)
  blueBg:    '#EAF2FB',   // Fondo azul
  purple:    '#6C63FF',   // Lote/bundle
  text:      '#1A1A2E',   // Texto principal
  textMed:   '#5C6070',   // Texto secundario
  textLow:   '#A0A5B5',   // Texto terciario/labels
  mono:      Platform.OS === 'android' ? 'monospace' : 'Courier New',
};
```

#### ✅ AMOLED → Light: Pantallas migradas

| Pantalla | Estado anterior | Estado Sprint 4 |
|----------|----------------|----------------|
| `DashboardScreen` | AMOLED bg `#0A0A12` + text `#E8E8F0` | Light DS ✅ |
| `SoldEditDetailView` | AMOLED completo | Light DS ✅ |
| `LogsScreen` | Dark `#0D0D1A` | Light DS ✅ |
| `DebugScreen` | Dark `#121212` | Light DS ✅ |
| `ProductDetailScreen` | Ya Light DS (Sprint anterior) | Sin cambios ✅ |
| `AdvancedStatsScreen` | Ya Light `#F8F9FA` | Sin cambios ✅ |
| `ProductsScreen` | Ya Light | Sin cambios ✅ |
| `SoldHistoryScreen` | Ya Light | Sin cambios ✅ |
| `SettingsScreen` | Ya Light | Sin cambios ✅ |

#### ✅ App.jsx — Tab Bar con fondo blanco

```js
// ANTES
tabBarStyle: {
  height: Platform.OS === 'android' ? 70 : 85,
  paddingBottom: Platform.OS === 'android' ? 10 : 25,
}

// DESPUÉS (Sprint 4)
tabBarStyle: {
  height: Platform.OS === 'android' ? 70 : 85,
  paddingBottom: Platform.OS === 'android' ? 10 : 25,
  backgroundColor: '#FFFFFF',
  borderTopColor: '#EAEDF0',
  borderTopWidth: 1,
  elevation: 8,
}
```

---

### [UI_SPECIALIST] — CalPicker — Componente Canónico de Calendario

#### ✅ CalPicker — versión mejorada unificada

Reemplaza el antiguo `CalendarModal` (grid simple sin cabecera colorida, sin selector de año, sin días de la semana) en ambas pantallas de detalle.

**Mejoras vs versión anterior:**

| Feature | CalendarModal (antes) | CalPicker (Sprint 4) |
|---------|----------------------|---------------------|
| Header coloreado | ❌ | ✅ con acento dinámico |
| Label de sección | ❌ | ✅ (ej: "FECHA REAL DE VENTA") |
| Año en cabecera | ❌ | ✅ |
| Fecha seleccionada en header | ❌ | ✅ formateada |
| Selector de año (chips) | ❌ | ✅ 8 años centrados en hoy |
| Días de la semana (L-D) | ❌ | ✅ |
| Celdas con offset correcto | ❌ grid lineal | ✅ firstWeekday calculado |
| Día de hoy resaltado | ❌ | ✅ borde con acento |
| Botón "HOY" | ❌ | ✅ con icono |
| acento dinámico | ❌ siempre verde | ✅ prop `accent` |

```jsx
// Uso canónico:
<CalPicker
  visible={showCal}
  onClose={() => setShowCal(false)}
  value={editForm.firstUploadDate}
  onChange={iso => setEditForm(f => ({...f, firstUploadDate: iso}))}
  accent={DS.primary}           // naranja para subida
  label="FECHA DE SUBIDA ORIGINAL"
/>
<CalPicker
  visible={showCalSold}
  onClose={() => setShowCalSold(false)}
  value={editForm.soldDateReal}
  onChange={iso => setEditForm(f => ({...f, soldDateReal: iso}))}
  accent={DS.success}           // verde para venta
  label="FECHA REAL DE VENTA"
/>
```

---

### [UI_SPECIALIST] — ProductDetailScreen — Pantalla Detalle Activos

**Estado tras Sprint 4:** Ya contenía el diseño correcto del ZIP del usuario.

#### ✅ Modo Visualización (renderView)
- Hero 320px con imagen, badge de estado dinámico, botón back flotante
- Card superpuesta con `borderTopRadius: 28`, `marginTop: -28`
- `topRow`: marca (uppercase naranja) + pill de categoría/subcategoría (azul)
- `titleRow`: título grande + price pill naranja
- Bundle badge (solo visible si `isBundle: true`) — solo lectura, no editable
- `statusBar`: semáforo dinámico (OK/FRÍO/CRÍTICO/HOT) con días
- 3 stat cards: VISTAS · FAVS · DÍAS
- Historial de precio (últimas 3 entradas)
- Date bar: fecha de subida original
- Tags de categoría
- Descripción
- `actionsRow`: botón Editar + botón **VENDIDO** (o badge "Ya vendido")

#### ✅ Modo Edición (renderEdit)
Solo edita los **campos permanentes** (inmunes al import):

| Campo editable | Tipo | Descripción |
|---------------|------|-------------|
| `category` | Selector modal | Categoría del diccionario |
| `subcategory` | Selector modal (paso 2) | Subcategoría |
| `firstUploadDate` | CalPicker (acento primary) | Fecha real de primera subida |

**Campos NO editables en este formulario (por diseño):**
- `price` — solo lectura (se refleja en la vista)
- `isBundle` — solo lectura (refleja estado, no se edita aquí)
- `title`, `brand` — permanentes, no expuestos para edición directa

#### ✅ SoldModal — Modal "Marcar como Vendido"
Sheet modal desde abajo con:
- Header verde con icono check + título del producto
- `soldPriceRow`: precio publicado vs beneficio calculado en tiempo real
- Input de precio real (autoFocus, grande, prominente)
- Fecha de venta con `CalPicker` (acento `DS.success`)
- Botón CONFIRMAR desactivado si no hay precio

---

### [UI_SPECIALIST] — SoldEditDetailView — Pantalla Detalle Vendidos

**Rediseñada completamente en Sprint 4:**

#### ✅ Cambios principales

| Antes (AMOLED) | Ahora (Light DS) |
|---------------|-----------------|
| Fondo `#0A0A12` negro | Fondo `#F8F9FA` blanco ✅ |
| `CalendarModal` grid simple | `CalPicker` mejorado (mismo que ProductDetail) ✅ |
| Botón "VENTA EN LOTE" editable | **Eliminado** — solo lectura en vista ✅ |
| Campo "PRECIO DE PUBLICACIÓN" editable | **Eliminado** — solo visible en panel TTS ✅ |
| Iconos de texto plano | DS consistente con íconos + colores ✅ |
| `C.white` = `AMOLED.surface` (gris oscuro) | `DS.white` = `#FFFFFF` ✅ |

#### ✅ Campos editables (SoldEditDetailView)

| Campo | Color acento | Descripción |
|-------|-------------|-------------|
| `soldPriceReal` | DS.success (verde) | Precio real de venta |
| `soldDateReal` | DS.success (verde) | Fecha real de venta — CalPicker |
| `category` / `subcategory` | DS.blue (azul) | Modal selector |
| `firstUploadDate` | DS.primary (naranja) | Fecha de subida — CalPicker |

#### ✅ Panel TTS (solo lectura, informativo)
```
┌─────────────────────────────────────────────────────┐
│  🏷 PRECIO SUBIDO │  ⏱ DÍAS HASTA VENTA │  📈 BENEFICIO  │
│       15€         │      ⚡ 3d           │     +3.50€      │
└─────────────────────────────────────────────────────┘
```
- Colores dinámicos: `ttsLightning` / `ttsAnchor` desde Settings
- Solo visible cuando `firstUploadDate` y `soldDateReal` están disponibles

#### ✅ Estructura visual

```
[Hero 320px: imagen + badge VENDIDO + botón back]
[contentCard: borderRadius 28, overlap -28px]
  [topRow: marca · catPill con subcategoría]
  [titleTxt]
  [ttsPanel]
  [formCard]
    [formBanner: "DATOS PERMANENTES"]
    [Precio final input]
    [Fecha venta: datePickBtn → CalPicker verde]
    [Categoría: catSelector → CategoryModal]
    [Tags sugeridos]
    [Fecha subida: datePickBtn → CalPicker naranja]
  [saveBtn: "GUARDAR DATOS DE VENTA"]
```

---

### [QA_ENGINEER] — Verificaciones Sprint 4

```bash
# Todas las pantallas sin AMOLED dark palette: ✅
# SoldEditDetailView: AMOLED eliminado → DS Light ✅
# SoldEditDetailView: CalendarModal reemplazado por CalPicker ✅
# SoldEditDetailView: Botón "VENTA EN LOTE" eliminado ✅
# SoldEditDetailView: Campo "PRECIO PUBLICACIÓN" eliminado de edición ✅
# ProductDetailScreen: Sin botón Eliminar ✅
# ProductDetailScreen: Sin botón Resubir ✅
# ProductDetailScreen: Sin precio editable ✅
# ProductDetailScreen: Sin lote editable ✅
# ProductDetailScreen: CalPicker mejorado ✅
# ProductDetailScreen: SoldModal con CalPicker ✅
# App.jsx tabBar: fondo blanco ✅
# DashboardScreen: AMOLED → Light DS ✅
# LogsScreen: dark → Light DS ✅
# DebugScreen: dark → Light DS ✅
```

---

### [DATA_SCIENTIST] — Integridad de Datos Sprint 4

#### ✅ `isBundle` — Comportamiento tras Sprint 4

El campo `isBundle` es un campo permanente (Los 7 Campos Sagrados). En Sprint 4:
- **ProductDetailScreen**: visible en modo VIEW (badge), pero **no editable** en modo EDIT. Solo se puede cambiar desde `SoldEditDetailView`.
- **SoldEditDetailView**: botón lote **eliminado** de la UI. El campo permanece en la base de datos pero la interfaz ya no lo expone para editar en esta pantalla.
- **Razón de diseño**: el lote es una decisión que se toma al crear la publicación, no al registrar la venta.

#### ✅ `soldPriceReal` — Flujo completo

```
ProductDetailScreen (activo)
  → Botón "VENDIDO" → SoldModal
      → Input precio + CalPicker fecha
      → onConfirm(soldPrice, soldDateReal)
          → DatabaseService.markAsSold(id, soldPrice, soldDateReal, false)
              → product.status = 'sold'
              → product.soldPriceReal = soldPrice
              → product.soldDateReal = soldDateReal
  → Alert "¡Vendido! 🎉" con opción "Ver historial"

SoldHistoryScreen
  → Tarjeta → navigate('SoldEditDetail', {product})
      → SoldEditDetailView
          → Editar soldPriceReal, soldDateReal, category, firstUploadDate
          → handleSave → DatabaseService.updateProduct({...})
```

---

### Archivos Modificados en Sprint 4

| Archivo | Tipo de cambio |
|---------|---------------|
| `screens/SoldEditDetailView.jsx` | Reescritura completa: Light DS, CalPicker, sin Lote/PrecioPublicación |
| `screens/DashboardScreen.jsx` | Migración AMOLED → Light DS (valores de paleta) |
| `screens/LogsScreen.jsx` | Migración dark → Light DS |
| `screens/DebugScreen.jsx` | Migración dark `#121212` → Light DS |
| `App.jsx` | tabBarStyle: backgroundColor white + border |

### Archivos Sin Cambios (ya correctos)

| Archivo | Estado |
|---------|--------|
| `screens/ProductDetailScreen.jsx` | ✅ Ya con DS Light, CalPicker, SoldModal, sin delete/resubir |
| `screens/AdvancedStatsScreen.jsx` | ✅ Ya Light |
| `screens/ProductsScreen.jsx` | ✅ Ya Light |
| `screens/SoldHistoryScreen.jsx` | ✅ Ya Light |
| `screens/SettingsScreen.jsx` | ✅ Ya Light |

---

### Git Workflow — Sprint 4

```bash
git checkout main
git checkout -b feature/sprint4-light-theme-detail-screens

git add App.jsx
git add screens/DashboardScreen.jsx
git add screens/SoldEditDetailView.jsx
git add screens/LogsScreen.jsx
git add screens/DebugScreen.jsx
git add SYSTEM_DESIGN.md

git commit -m "feat(sprint4): Light DS global + rediseño pantallas detalle

[ARCHITECT]
- DS Light canónico definido: #F8F9FA bg, #FFFFFF surface, #EAEDF0 border
- Eliminado AMOLED de: DashboardScreen, SoldEditDetailView, LogsScreen, DebugScreen
- App.jsx tabBar: fondo blanco + borde suave

[UI_SPECIALIST]
- CalPicker: componente unificado con header coloreado, selector año,
  días semana, acento dinámico y label de sección
- SoldEditDetailView: reescritura completa Light DS
  - CalendarModal reemplazado por CalPicker
  - Botón Lote eliminado de edición
  - Campo precio publicación eliminado de edición
  - Panel TTS (read-only) con colores dinámicos desde config
- ProductDetailScreen: ya correcto desde upload del usuario
  (sin delete, sin resubir, sin precio editable, sin lote editable)

[QA_ENGINEER]
- 0 referencias AMOLED dark en lógica de negocio
- Todos los calendarios usan CalPicker unificado
- SoldEditDetailView campos: soldPriceReal + soldDateReal + category + firstUploadDate

[DATA_SCIENTIST]
- isBundle solo lectura en ambas pantallas de detalle
- soldPriceReal flujo documentado: SoldModal → markAsSold → SoldEditDetailView

[LIBRARIAN]
- SYSTEM_DESIGN.md: Sprint 4 documentado con tablas, flujos y ejemplos"

git checkout main
git merge --no-ff feature/sprint4-light-theme-detail-screens -m "merge: Sprint 4 Light DS global"
```

---

## 📋 Sprint 5 — Módulo de Importación Móvil desde Vinted

> **Sprint 5 · feature/vinted-import-mobile**
> Rama: `feature/vinted-import-mobile`
> Fecha: Marzo 2026

### Objetivo

Implementar un módulo de importación **100% offline y móvil** que permita al usuario extraer datos de sus ventas y transacciones desde la app de Vinted pegando el HTML de la página directamente en ResellHub, sin necesidad de PC ni APIs externas.

---

### [ARCHITECT] — Decisiones de diseño

#### ✅ Estrategia: HTML Clipboard en lugar de fetch/scraping

| Opción analizada | Problema | Decisión |
|-----------------|---------|---------|
| `fetch(url)` desde la app | CORS bloqueado en móvil; requiere proxy server | ❌ Descartado |
| `expo-clipboard` URL + WebView headless | Requiere native module extra | ❌ Descartado |
| **HTML pegado + RegEx parser** | 100% offline, sin dependencias | ✅ Elegido |

**Workflow final:**
```
Vinted App → ⋮ → Compartir → Copiar HTML/texto
  ↓
ResellHub: "Pegar desde Vinted"
  ↓ detectContentType()
  ↓ parseVintedHtml()
  ↓ PreviewCards (usuario confirma)
  ↓ importar al Inventario Y/O Estadísticas
```

#### ✅ Dos formatos HTML de Vinted soportados

**Formato A — "Mis pedidos / Año actual"** (`html_sales_current`):
```html
<a href="/inbox/19673689711" data-testid="my-orders-item">
  <div data-testid="my-orders-item--title">Título del artículo</div>
  <h3 class="...Text__subtitle">5,00 €</h3>
  <h3>Pedido finalizado. El comprador ha aceptado el artículo</h3>
  <img src="https://images1.vinted.net/...">
</a>
```
→ Extrae: `orderId`, `title`, `amount` (€), `status` (completada/en_proceso), `imageUrl`

**Formato B — "Historial de transacciones"** (`html_sales_history`):
```html
<li class="pile__element">
  <a href="/inbox/20930332206">
    <div class="...Cell__title">Compra</div>
    <div class="...Cell__body">Kirby's Star Alliance</div>
    <h2 class="...Text__warning">-24,85 €</h2>
    24 de febrero de 2026
  </a>
</li>
```
→ Extrae: `orderId`, `type` (venta/compra), `title`, `amount`, `date` (ISO string)

#### ✅ Nueva clave MMKV: `vinted_sales_history`

Almacenamiento separado del inventario para las estadísticas económicas. Usa una instancia `MMKV` con `id: 'vinted-parser'` para aislamiento.

---

### [DATA_SCIENTIST] — VintedParserService.js

**Archivo:** `services/VintedParserService.js`

#### Funciones exportadas

```js
detectContentType(text)
// → 'url_product' | 'url_inbox' | 'html_sales_current'
//   | 'html_sales_history' | 'html_generic' | 'unknown'

parseHtmlSalesCurrent(html)  → VintedSaleItem[]   // Formato A
parseHtmlSalesHistory(html)  → VintedSaleItem[]   // Formato B
parseVintedHtml(html)        → VintedSaleItem[]   // Auto-detecta formato

mapToInventoryProduct(item)  → InternalProduct    // Para importFromVinted()
mapToSaleRecord(item)        → SaleRecord         // Para VintedSalesDB

VintedSalesDB.saveRecords(records)  → { inserted, duplicates }
VintedSalesDB.getAllRecords()       → SaleRecord[]
VintedSalesDB.getStats()           → EconomicStats
VintedSalesDB.clear()

logImportEvent(type, count, details)
getImportLog() → ImportLogEntry[]
```

#### Schema VintedSaleItem

```js
{
  orderId:      '19673689711',
  title:        '6 coches de dinosaurio...',
  amount:       5.00,           // positivo=venta, negativo=compra
  type:         'venta',        // 'venta' | 'compra' | 'unknown'
  status:       'completada',   // 'completada' | 'en_proceso' | 'cancelada'
  date:         '2026-02-24T12:00:00.000Z',  // null si Formato A
  imageUrl:     'https://images1.vinted.net/...',
  sourceFormat: 'html_current', // 'html_current' | 'html_history'
}
```

#### Schema SaleRecord (historial económico)

```js
{
  id:           'vsr_1741000000_abc12',   // UUID interno
  orderId:      '19673689711',
  title:        'Título del artículo',
  amount:       5.00,
  type:         'venta',
  date:         '2026-02-24T12:00:00.000Z',
  imageUrl:     null,
  status:       'completada',
  importedAt:   '2026-03-06T...',
  sourceFormat: 'html_current',
  // PLACEHOLDERS para Fase 2:
  // monthYear:       '2026-02'
  // category:        null
  // profit:          null
  // linkedProductId: null
}
```

#### VintedSalesDB.getStats() — Estadísticas económicas

```js
{
  totalRecords:   42,
  totalVentas:    35,
  totalCompras:   7,
  ingresosBrutos: 234.50,
  gastos:         89.20,
  balance:        145.30,
  byMonth: {
    '2026-02': { ventas: 89.50, compras: 24.85, count: 5 },
    '2026-01': { ventas: 145.00, compras: 64.35, count: 12 },
  }
}
```

#### Prueba contra HTML real del usuario

```
Formato A → orderId=19673689711, title="6 coches de dinosaurio...", amount=5.00€, status=completada ✅
Formato B → orderId=20930332206, type=compra, title="Kirby's Star Alliance", amount=-24.85€, date=2026-02-24 ✅
```

---

### [UI_SPECIALIST] — VintedImportScreen.jsx

**Archivo:** `screens/VintedImportScreen.jsx`

#### Flujo de pantalla

```
[Header: ← Importar desde Vinted]
     ↓
[Guía 3 pasos: Abre Vinted → Compartir página → Pegar aquí]
     ↓
[Botón naranja: ▼ PEGAR DESDE VINTED]
     ↓ (si clipboard no disponible)
[TextArea: pegar HTML manualmente + ANALIZAR CONTENIDO]
     ↓
[Badge tipo: "Ventas año actual" · X items detectados]
     ↓
[Barra selección: ☑ Seleccionar todo · N/M seleccionados]
     ↓
[PreviewCard × N: imagen + tipo + título + importe + fecha]
     ↓
[Botón: ↑ IMPORTAR N ITEMS]
     ↓
[ConfirmModal]
  ├── Resumen: VENTAS · COMPRAS · BALANCE
  ├── Opción A: "Añadir al Inventario de Vendidos"
  ├── Opción B: "Guardar en Estadísticas Económicas"
  └── Opción C: "⚡ IMPORTAR TODO (Inventario + Stats)"
     ↓
[ResultBanner: ✅ importado X items]
```

#### Componentes internos

- **`PreviewCard`** — tarjeta checkeable por item con imagen, tipo (↑ VENTA / ↓ COMPRA), importe coloreado, fecha, #orderId
- **`ConfirmModal`** — bottom sheet con resumen económico y 3 opciones de destino
- **`STEPS`** — guía de 3 pasos animada con iconos y conectores verticales

#### Acceso desde otras pantallas

| Pantalla | Elemento | Acción |
|---------|---------|--------|
| `ProductsScreen` | Botón "Importar" en header | `navigation.navigate('VintedImport')` |
| `SoldHistoryScreen` | Botón "Importar" junto a título | `navigation.navigate('VintedImport')` |

---

### [QA_ENGINEER] — Consideraciones técnicas

#### ✅ Clipboard: compatibilidad RN 0.76

```js
// En RN 0.76 el Clipboard está en react-native directamente:
import { Clipboard } from 'react-native';
const text = await Clipboard.getString();

// Fallback automático a modo manual si Clipboard no disponible
```

#### ✅ Deduplicación por orderId

`VintedSalesDB.saveRecords()` usa un `Set` de `orderId` existentes para evitar duplicados. Si el mismo pedido se importa dos veces, `duplicates++` y no se vuelve a insertar.

#### ✅ Integración con importFromVinted() existente

Las ventas importadas se convierten a `InternalProduct` mediante `mapToInventoryProduct()` y pasan por el pipeline existente `DatabaseService.importFromVinted()`, respetando los 7 Campos Sagrados y el merge inteligente.

#### ✅ Sin nuevas dependencias npm

El módulo usa exclusivamente:
- `react-native-mmkv` (ya instalado)
- `Clipboard` de `react-native` (built-in)
- RegEx nativo (sin librerías de parsing HTML)

#### ✅ Preparado para Fase 2 — Importación Masiva

```js
// Placeholders documentados en SaleRecord:
// monthYear, category, profit, linkedProductId

// VintedSalesDB.getStats() ya agrega por mes para el dashboard
// La función parseVintedHtml() puede procesar páginas enteras (paginación manual)
// logImportEvent() guarda historial de importaciones (últimas 50)
```

---

### Archivos creados/modificados en Sprint 5

| Archivo | Tipo | Descripción |
|---------|------|-------------|
| `services/VintedParserService.js` | **Nuevo** | Parser offline Formato A+B, VintedSalesDB, mappers |
| `screens/VintedImportScreen.jsx` | **Nuevo** | Pantalla completa de importación con preview y confirm |
| `App.jsx` | Modificado | Registro de `VintedImportScreen` en Stack.Navigator |
| `screens/ProductsScreen.jsx` | Modificado | Botón "Importar" en header → VintedImport |
| `screens/SoldHistoryScreen.jsx` | Modificado | Botón "Importar" junto al título → VintedImport |

---

### Git Workflow — Sprint 5

```bash
git checkout main
git checkout -b feature/vinted-import-mobile

git add services/VintedParserService.js
git add screens/VintedImportScreen.jsx
git add App.jsx
git add screens/ProductsScreen.jsx
git add screens/SoldHistoryScreen.jsx
git add SYSTEM_DESIGN.md

git commit -m "feat(sprint5): módulo importación móvil desde Vinted

[ARCHITECT]
- Estrategia: HTML clipboard offline vs fetch (CORS imposible en móvil)
- Dos formatos Vinted soportados: html_sales_current + html_sales_history
- Nueva clave MMKV vinted_sales_history para estadísticas económicas
- Sin nuevas dependencias npm (Clipboard built-in + RegEx nativo)

[DATA_SCIENTIST]
- VintedParserService: detectContentType, parseHtmlSalesCurrent, parseHtmlSalesHistory
- parseVintedHtml: auto-detecta formato y despacha al parser correcto
- mapToInventoryProduct: VintedSaleItem → InternalProduct (compatible con importFromVinted)
- mapToSaleRecord: VintedSaleItem → SaleRecord (historial económico)
- VintedSalesDB: saveRecords (dedup por orderId), getStats (por mes), clear
- logImportEvent + getImportLog (últimas 50 importaciones)
- Prueba con HTML real del usuario: Formato A ✅ Formato B ✅

[UI_SPECIALIST]
- VintedImportScreen: guía 3 pasos, paste automático, fallback manual
- PreviewCard: imagen, ↑VENTA/↓COMPRA, importe coloreado, fecha, #orderId
- ConfirmModal: resumen ventas/compras/balance + 3 opciones de destino
- ResultBanner: feedback post-importación con botón 'NUEVA'
- Acceso desde ProductsScreen (Inventario) y SoldHistoryScreen (Vendidos)

[QA_ENGINEER]
- Deduplicación automática por orderId en VintedSalesDB
- Integración con pipeline existente importFromVinted() + 7 Campos Sagrados
- Placeholders documentados para Fase 2 (importación masiva paginada)

[LIBRARIAN]
- SYSTEM_DESIGN.md: Sprint 5 documentado con schemas, flujo, decisiones"

git checkout main
git merge --no-ff feature/vinted-import-mobile -m "merge: Sprint 5 vinted-import-mobile"
```

---

## 📋 Sprint 6 — Fix completo: 3 Formatos de Importación Móvil

> **Sprint 6 · feature/vinted-import-mobile (fix)**
> Fecha: Marzo 2026

### Diagnóstico pre-Sprint 6

| Problema | Archivo | Severidad |
|---------|---------|-----------|
| `VintedImportScreen` importaba `parseVintedHtml` (legacy) en lugar de `parseVintedContent` | VintedImportScreen.jsx | 🔴 Crítico |
| `processText` no tenía rama `json_products` → JSON del script producía lista vacía | VintedImportScreen.jsx | 🔴 Crítico |
| `PreviewCard` llamaba a `item.amount.toFixed(2)` — explota con InternalProduct del JSON | VintedImportScreen.jsx | 🔴 Crítico |
| `ConfirmModal` no tenía modo JSON ni modo A — solo modo B (historial) | VintedImportScreen.jsx | 🔴 Crítico |
| Formato A: `soldDateReal=null` sin UI para introducirla antes de confirmar | VintedImportScreen.jsx | 🟡 UX |
| Script de consola: solo descarga .json → no sirve para flujo móvil sin PC | scriptJSON.txt | 🟡 UX |
| `VintedParserService` reconocía JSON en `detectContentType` pero `parseVintedHtml` lo ignoraba | VintedParserService.js | 🔴 Crítico |

---

### [ARCHITECT] — Arquitectura de los 3 modos

```
Texto pegado
    │
    ▼
detectContentType()
    ├── 'json_products'       → MODO C: parseJsonProducts()
    │                              → jsonProducts: InternalProduct[]
    │                              → ProductPreviewCard
    │                              → ConfirmModal mode="C"
    │                              → importFromVinted() directo
    │
    ├── 'html_sales_current'  → MODO A: parseHtmlSalesCurrent()
    │                              → parsedItems: VintedSaleItem[]
    │                              → SalePreviewCard + noDateBadge
    │                              → ConfirmModal mode="A"
    │                              → DateConfirmModal (si soldDateReal=null)
    │                              → executeSalesCurrent(action, items, isoDate)
    │                                  ├── 'update_permanent': updateProduct() en BD
    │                                  ├── 'add_new': importFromVinted()
    │                                  └── 'both': ambos
    │
    ├── 'html_sales_history'  → MODO B: parseHtmlSalesHistory()
    │                              → parsedItems: VintedSaleItem[]
    │                              → SalePreviewCard
    │                              → ConfirmModal mode="B"
    │                              → 'stats': VintedSalesDB.saveRecords()
    │                              ├── 'inventory': importFromVinted()
    │                              └── 'both': ambos
    │
    └── 'unknown' / URL       → Mensaje de error orientativo
```

#### Estado React por modo

```js
// Modo A/B — VintedSaleItem[]
const [parsedItems, setParsedItems]   = useState([]);
// Modo C — InternalProduct[]
const [jsonProducts, setJsonProducts] = useState([]);
// IDs seleccionados — orderId (A/B) o String(product.id) (C)
const [checkedIds, setCheckedIds]     = useState(new Set());
// currentMode derivado de contentType via TYPE_META
const currentMode = TYPE_META[contentType]?.mode; // 'A' | 'B' | 'C' | null
```

---

### [DATA_SCIENTIST] — VintedParserService.js (fixes)

#### ✅ Función `parseVintedContent` (dispatcher principal)

```js
// ANTES (Sprint 5): parseVintedHtml() — solo HTML, ignoraba JSON
// AHORA (Sprint 6): parseVintedContent() — despacha a los 3 parsers
export function parseVintedContent(text) {
  const type = detectContentType(text);
  switch(type) {
    case 'html_sales_current': return { type, items: parseHtmlSalesCurrent(text), products: null };
    case 'html_sales_history': return { type, items: parseHtmlSalesHistory(text), products: null };
    case 'json_products':      return { type, items: null, products: parseJsonProducts(text) };
    ...
  }
}
```

#### ✅ `parseHtmlSalesCurrent` — Formato A: nuevos campos

```js
// ANTES: extraía title, amount, status básico, imageUrl
// AHORA: añade
results.push({
  orderId,
  title,
  soldPriceReal,          // ← NUEVO: alias semántico del precio
  amount: soldPriceReal,  // ← compatibilidad UI
  type: 'venta',
  status,                 // desde SVG <title>Estado de la transacción: X</title>
  date: null,             // ← Formato A NO incluye fecha (documentado)
  soldDateReal: null,     // ← El usuario lo introduce en DateConfirmModal
  imageUrl,
  sourceFormat: 'html_current',
});
```

#### ✅ `parseHtmlSalesHistory` — Formato B: fix suffix

```js
// ANTES: regex Cell__suffix incompleto → amount y fecha no se extraían
// AHORA: parse correcto de la estructura real:
//   <div class="Cell__suffix">
//     <div>
//       <h2>-24,85 €</h2>    ← dentro del suffix
//       24 de febrero de 2026 ← texto plano DESPUÉS del h2
//     </div>
//   </div>

const suffixMatch = block.match(/Cell__suffix[^>]*>([\s\S]*?)(?:<\/div>\s*<\/div>\s*<\/a>|$)/);
if (suffixMatch) {
  const h2Match = suffixMatch[1].match(/<h2[^>]*>([\s\S]*?)<\/h2>/);
  // amount desde h2, date desde texto después del h2
  const afterH2 = suffixMatch[1].replace(/<h2[\s\S]*?<\/h2>/, '');
  date = parseSpanishDate(stripTags(afterH2));
}
```

#### ✅ `parseJsonProducts` — Formato C: normalización completa

```js
export function parseJsonProducts(text) {
  const arr = JSON.parse(text) (array o objeto);
  return arr.map(p => ({
    ...p,
    id:           p.id || 'vinted_' + random,
    price:        parseFloat(p.price) || 0,
    images:       Array.isArray(p.images) ? p.images : [p.images],
    status:       p.status === 'sold' ? 'sold' : 'available',
    views:        parseInt(p.views) || 0,
    favorites:    parseInt(p.favorites) || 0,
    soldDateReal: p.soldDateReal || p.soldDate || null,
    soldPriceReal:p.soldPriceReal || p.price || null,
    createdAt:    p.createdAt || now,
  }));
}
```

---

### [UI_SPECIALIST] — VintedImportScreen.jsx (reescritura)

#### ✅ Nuevos componentes

**`SalePreviewCard`** — Para Modo A y B (VintedSaleItem)
- Badge `↑ VENTA` / `↓ COMPRA` con colores
- `noDateBadge` amarillo cuando `item.date === null` (Modo A)
- `item.amount.toFixed(2)` protegido con `typeof item.amount === 'number'`

**`ProductPreviewCard`** — Para Modo C (InternalProduct del JSON)
- Badge `ACTIVO` (verde) / `VENDIDO` (gris)
- Muestra marca, precio, vistas, favoritos
- Key desde `String(product.id)` (no `orderId`)

**`DateConfirmModal`** — Para Modo A cuando `soldDateReal = null`
- Input numérico `DD/MM/AAAA`
- Parser propio: `"15/02/2026"` → ISO string
- Botón "Saltar" → guarda con `soldDateReal: null` (editable después)
- Botón "Aplicar fecha" → aplica a todos los items seleccionados

**`ConfirmModal`** — Ahora recibe `mode` prop y renderiza 3 variantes:

| `mode` | Contenido |
|--------|-----------|
| `'C'` | Resumen activos/vendidos/total + botón "IMPORTAR N PRODUCTOS" |
| `'A'` | Resumen ventas/sin-fecha + 2 opciones + "ACTUALIZAR + AÑADIR NUEVOS" |
| `'B'` | Resumen ventas/compras/balance + 2 opciones + "IMPORTAR TODO" |

**`GUIDE`** — Guía de 3 tarjetas con instrucciones por modo (reemplaza los 3 pasos genéricos)

#### ✅ Flujo Modo A: `executeSalesCurrent(action, items, soldDateReal)`

```js
// action = 'update_permanent' | 'add_new' | 'both'
// Actualizar: busca match por orderId o title en la BD y actualiza soldPriceReal + soldDateReal
// Añadir: mapToInventoryProduct() → importFromVinted()
```

#### ✅ Flujo Modo C: `handleConfirmJson()`

```js
// Filtra jsonProducts por checkedIds
// Llama directamente a DatabaseService.importFromVinted(selected)
// El pipeline existente preserva los 7 Campos Sagrados y hace merge inteligente
```

---

### [QA_ENGINEER] — Script de consola v2.0

**Archivo:** `Documentos/scriptJSON.txt`

#### Cambios vs v1.0

| Feature | v1.0 | v2.0 |
|---------|------|------|
| Transferencia | Solo descarga .json | Copia al portapapeles + descarga de respaldo |
| Descripción | Igual que título | Enriquecida con marca, talla, color desde alt |
| Clipboard API | No | `navigator.clipboard.writeText()` + fallback `execCommand` |
| Instrucciones | No | Header completo con pasos para flujo móvil |
| Return value | void | Devuelve `products[]` en consola para inspección |

#### Workflow móvil completo con v2.0

```
PC: Abre escaparate Vinted → F12 → Consola → Pegar script → Enter
  → "JSON copiado al portapapeles ✅"
  → También descarga resellhub_TIMESTAMP.json como respaldo

M�vil: Abre ResellHub → Inventario → Importar desde Vinted
  → Pulsar "PEGAR DESDE VINTED"
  → detectContentType → 'json_products'
  → ProductPreviewCard × N (activos + vendidos)
  → IMPORTAR N PRODUCTOS → importFromVinted()
```

---

### [QA_ENGINEER] — Resultados validación Sprint 6

```
VintedParserService.js     13/13 checks ✅
VintedImportScreen.jsx     20/20 checks ✅
scriptJSON.txt v2.0         9/9  checks ✅
App.jsx                     2/2  checks ✅
───────────────────────────────────────
TOTAL                      44/44 checks ✅
```

---

### Archivos modificados/generados en Sprint 6

| Archivo | Tipo | Sprint 5 → Sprint 6 |
|---------|------|---------------------|
| `services/VintedParserService.js` | Modificado | `parseVintedHtml` → `parseVintedContent`; fix Formato B suffix; `soldPriceReal`/`soldDateReal` en SaleItem |
| `screens/VintedImportScreen.jsx` | Reescrito | 3 modos (A/B/C); 2 PreviewCards; DateConfirmModal; ConfirmModal con mode prop; guía por formato |
| `Documentos/scriptJSON.txt` | Reescrito v2.0 | Clipboard + download; descripción enriquecida; instrucciones móvil |

---

### Git Workflow — Sprint 6

```bash
git checkout feature/vinted-import-mobile

git add services/VintedParserService.js
git add screens/VintedImportScreen.jsx
git add Documentos/scriptJSON.txt
git add SYSTEM_DESIGN.md

git commit -m "fix(sprint6): 3 formatos importación Vinted completos y funcionales

[ARCHITECT]
- parseVintedContent dispatcher: despacha a parser correcto según tipo
- 2 estados separados: parsedItems (A/B) y jsonProducts (C)
- currentMode derivado de TYPE_META[contentType].mode

[DATA_SCIENTIST]
- parseHtmlSalesCurrent: soldPriceReal, SVG status, date=null documentado
- parseHtmlSalesHistory: fix Cell__suffix → amount + fecha correctos
- parseJsonProducts: normaliza id, images, soldDateReal, soldPriceReal
- parseVintedContent: dispatcher único para los 3 formatos

[UI_SPECIALIST]
- SalePreviewCard: noDateBadge para Modo A, amount protegido con typeof
- ProductPreviewCard: preview de InternalProduct (Modo C)
- DateConfirmModal: input DD/MM/AAAA con skip option (Modo A)
- ConfirmModal: 3 variantes por mode prop (A/B/C)
- executeSalesCurrent: update_permanent + add_new + both
- handleConfirmJson: directo a importFromVinted()
- Guía de 3 tarjetas con instrucciones por modo

[QA_ENGINEER]
- scriptJSON.txt v2.0: clipboard + download fallback + descripción enriquecida
- 44/44 checks QA pasan
- Workflow móvil completo documentado

[LIBRARIAN]
- SYSTEM_DESIGN.md: Sprint 6 con diagnóstico, arquitectura, flows, tabla cambios"
```

---

## 🔧 Sprint 6 — Hotfix: SyntaxError ProductsScreen + Deploy v5.0

> **Hotfix · feature/vinted-import-mobile**
> Fecha: Marzo 2026

### Bug: SyntaxError — Argument name clash (ProductsScreen.jsx L16)

**Causa raíz:** En Sprint 5, al añadir el botón "Importar desde Vinted" al header de `ProductsScreen`, se añadió `navigation` a la firma de la función sin eliminar el parámetro ya existente, produciendo un destructuring con clave duplicada.

```js
// ❌ ANTES (Sprint 5 — crash en bundler)
export default function ProductsScreen({ navigation, navigation }) {

// ✅ DESPUÉS (Hotfix)
export default function ProductsScreen({ navigation }) {
```

**Impacto:** Fatal — el bundler de Metro rechaza el módulo completo con `SyntaxError: Argument name clash`, impidiendo que la app arranque.

**Fix:** Eliminar la segunda ocurrencia de `navigation` en la firma. El resto del componente (botón VintedImport, listener `focus`, `navigate`) no cambia.

---

### Feature: agent-deploy.ps1 v5.0 — Auto-Uninstall + Clean

**Problema:** `npx expo start --localhost --android` falla cuando hay una APK de distinta firma (preview/production/debug) ya instalada. Android rechaza la instalación con error de firma en silencio, dejando la app antigua o sin instalar.

**Solución en v5.0:**

#### Nueva función `Uninstall-AppFromDevice`

```powershell
# 1. Comprueba si hay dispositivo ADB conectado
$devices = adb devices | Select-String "device$"

# 2. Comprueba si la app está instalada
$installed = adb shell pm list packages | Select-String "com.perdigon85.resellhub"

# 3. Desinstala si existe (cualquier variante: debug/preview/production)
adb uninstall com.perdigon85.resellhub
# → "Success" → continúa
# → Error     → avisa al usuario para cerrar la app manualmente
```

#### Nueva función `Get-AdbDevice`

Detecta si hay dispositivo ADB antes de cualquier operación, con mensajes claros si no está conectado.

#### `Run-DeepClean` ampliada

```powershell
# Antes: solo .expo + java/KotlinCompile
# Ahora añade:
Stop-Process -Name "node"        # libera el puerto 8081
$env:TEMP\metro-*                # cache Metro bundler
$env:TEMP\haste-map-*            # cache haste resolver
node_modules\.cache              # cache internal de RN
```

#### Nuevo modo `-Check`

```powershell
.\agent-deploy.ps1 -Check
# → Verifica Node, npm, Expo CLI, ADB, dispositivo conectado, app instalada
```

#### Flujo `-Local` completo v5.0

```
1. Uninstall-AppFromDevice      → adb uninstall com.perdigon85.resellhub
2. Run-DeepClean                → .expo, metro-*, haste-map-*, node_modules/.cache
3. $env:EXPO_METRO_PORT = 8081  → puerto fijo
4. adb reverse tcp:8081 tcp:8081 → puente USB
5. npx expo start --localhost --android → bundler + install + open
```

#### Tabla comparativa v4.9 → v5.0

| Feature | v4.9 | v5.0 |
|---------|------|------|
| Desinstalar APK anterior | ❌ No | ✅ `adb uninstall` automático |
| Detectar dispositivo | ❌ No | ✅ `Get-AdbDevice` con mensaje |
| Limpiar cache Metro | ❌ No | ✅ `$TEMP\metro-*` |
| Matar proceso `node` | ❌ No | ✅ `Stop-Process node` |
| Modo Check/diagnóstico | ❌ No | ✅ `-Check` |
| Beep feedback | ✅ 1 tono | ✅ 2 tonos (inicio + ready) |
| Bundle ID explícito | ❌ No | ✅ `$BUNDLE_ID` variable |

---

### Archivos modificados en Hotfix

| Archivo | Cambio |
|---------|--------|
| `screens/ProductsScreen.jsx` | L16: `{ navigation, navigation }` → `{ navigation }` |
| `agent-deploy.ps1` | v4.9 → v5.0: auto-uninstall, deep clean, -Check mode |

### Git Workflow — Hotfix

```bash
git add screens/ProductsScreen.jsx
git add agent-deploy.ps1
git add SYSTEM_DESIGN.md

git commit -m "hotfix: SyntaxError ProductsScreen + deploy v5.0 auto-uninstall

[QA_ENGINEER]
- ProductsScreen.jsx L16: duplicate 'navigation' param removed
  Root cause: Sprint 5 import button added nav without removing existing
  Impact: Fatal Metro bundler crash on app startup

[ARCHITECT]
- agent-deploy.ps1 v5.0: Uninstall-AppFromDevice via adb uninstall
  Fixes: expo start --android fails when APK signed differently
  New: Get-AdbDevice(), -Check mode, node process kill, metro cache clean
  Bundle: com.perdigon85.resellhub"
```

---

## 🔧 Hotfix 2 — DS undefined + PowerShell parse error + Logging

> **Hotfix 2 · feature/vinted-import-mobile**
> Fecha: Marzo 2026

### Bug 1: `ReferenceError: Property 'DS' doesn't exist` — ProductsScreen

**Causa raíz:** En Sprint 5 se añadió el botón "Importar" al header de `ProductsScreen` usando `color={DS.primary}`, pero el objeto `DS` nunca fue definido en ese archivo (solo existe en pantallas reescritas como `ProductDetailScreen`, `VintedImportScreen`, `SoldEditDetailView`). `ProductsScreen` era un archivo pre-existente que no tenía `DS`.

**Fix aplicado:**
```js
// 1. Añadir Platform a imports de react-native
import { ..., Platform } from 'react-native';

// 2. Añadir LogService
import LogService, { LOG_CTX } from '../services/LogService';

// 3. Definir DS después de MONTH_NAMES
const DS = {
  bg: '#F8F9FA', white: '#FFFFFF', ...
  primary: '#FF6B35',
  ...
  mono: Platform.OS === 'android' ? 'monospace' : 'Courier New',
};
```

**Impacto:** Fatal en runtime — `ProductsScreen` (tab "Inventario") no renderizaba, lanzando `ReferenceError` visible en el stack trace de React Navigation.

---

### Bug 2: `MissingEndCurlyBrace` — agent-deploy.ps1

**Causa raíz:** Tres problemas combinados:

| Causa | Detalle |
|-------|---------|
| **LF endings** | El archivo tenía terminaciones Unix `\n` — PowerShell en Windows requiere `\r\n` (CRLF) |
| **Sin UTF-8 BOM** | PowerShell requiere BOM (`0xEF 0xBB 0xBF`) para interpretar correctamente UTF-8 |
| **Unicode en strings de código** | Caracteres `►`, `─`, `═` dentro de `Write-Host "..."` fuera de comentarios pueden confundir el parser en algunas versiones de PS |

**Fix v5.1:**
- Escrito con `\r\n` explícitos + BOM `\xef\xbb\xbf`
- Todos los caracteres Unicode decorativos reemplazados por ASCII (`>`, `-`, `=`)
- Funciones definidas **antes** de cualquier bloque `if` (buena práctica PS)
- Sin strings multi-línea ni here-strings que puedan fallar

---

### Feature: Logging en ProductsScreen

`ProductsScreen` no tenía ningún log. Añadido:

```js
// En loadData():
LogService.debug(`ProductsScreen: ${enriched.length} productos cargados`, LOG_CTX.UI);
LogService.error('ProductsScreen.loadData', LOG_CTX.DB, e.message);  // en catch

// En navegación a ProductDetail:
LogService.info(`ProductsScreen → ProductDetail: ${item.title}`, LOG_CTX.NAV);

// En navegación a VintedImport:
LogService.info('ProductsScreen → VintedImport', LOG_CTX.NAV);
```

Todos los errores de carga de datos ahora aparecen en la pantalla **Logs** de la app.

---

### Feature: Log de sesión en agent-deploy.ps1

El script ahora escribe un archivo `deploy-log.txt` junto al `.ps1`:

```
[2026-03-07 12:00:00] [SESSION] Deploy iniciado. Flags: Local=True Cloud=False Check=False
[2026-03-07 12:00:01] [STEP]    Desinstalando APK anterior (com.perdigon85.resellhub)...
[2026-03-07 12:00:02] [OK]      APK desinstalada correctamente.
[2026-03-07 12:00:02] [STEP]    Limpiando procesos y cache...
[2026-03-07 12:00:03] [OK]      Limpieza completada.
[2026-03-07 12:00:03] [INFO]    EXPO_METRO_PORT=8081
[2026-03-07 12:00:03] [STEP]    Configurando puente ADB Reverse (tcp:8081)...
[2026-03-07 12:00:03] [OK]      ADB Reverse tcp:8081 configurado.
[2026-03-07 12:00:03] [LAUNCH]  npx expo start --localhost --android
```

---

### Checklist de encofing PowerShell (referencia para futuros scripts)

- ✅ Guardar como **UTF-8 WITH BOM** (no UTF-8 sin BOM)
- ✅ Line endings **CRLF** (`\r\n`)
- ✅ Usar solo **ASCII** en strings de código (`Write-Host`, condiciones, etc.)
- ✅ Los caracteres Unicode (acentos, emojis, flechas) solo en **comentarios** (`#`)
- ✅ Definir todas las **funciones antes** del código que las llama
- ✅ Probar con `.\script.ps1 -Check` antes de `-Local`

---

### Archivos modificados en Hotfix 2

| Archivo | Cambio |
|---------|--------|
| `screens/ProductsScreen.jsx` | DS definido, Platform importado, LogService añadido con try-catch en loadData y logs de navegación |
| `agent-deploy.ps1` | v5.0→v5.1: CRLF+BOM, ASCII-only en strings, Write-Log a deploy-log.txt, -Help antes del param |

### Git Workflow — Hotfix 2

```bash
git add screens/ProductsScreen.jsx
git add agent-deploy.ps1
git add SYSTEM_DESIGN.md

git commit -m "hotfix2: DS undefined ProductsScreen + PS1 parse error + logging

[QA_ENGINEER]
- ProductsScreen: DS object undefined → ReferenceError en runtime
  Fix: añadir const DS + Platform import + LogService
- ProductsScreen: loadData sin try-catch → errores silenciosos
  Fix: try-catch con LogService.error en LOG_CTX.DB
- ProductsScreen: sin logs de navegación
  Fix: LogService.info en navigate('ProductDetail') y navigate('VintedImport')

[ARCHITECT]
- agent-deploy.ps1 v5.1: MissingEndCurlyBrace en línea 38
  Causas: LF endings + sin UTF-8 BOM + Unicode en code strings
  Fix: CRLF + BOM 0xEF0xBB0xBF + ASCII-only en Write-Host
  Nuevo: Write-Log → deploy-log.txt con timestamps para monitorización"
```

---

## 🔧 Hotfix 3 — Diagnóstico definitivo de errores repetidos

> **Hotfix 3 · feature/vinted-import-mobile**
> Fecha: Marzo 2026

### Por qué los errores persistían tras Hotfix 2

Los archivos generados en Hotfix 2 eran correctos técnicamente, pero el usuario
seguía viendo los mismos errores porque **no había reemplazado los ficheros locales**
`C:\resell-hub-app\ProductsScreen.jsx` y `C:\resell-hub-app\agent-deploy.ps1`
con las versiones corregidas de `/mnt/user-data/outputs/`.

Indicadores que confirmaron esto:
- El error de PS1 apuntaba exactamente a `if ($Help)` en la **línea 38** — coincide
  exactamente con la versión v4.9 original, no con nuestra v5.0/v5.1 donde `if ($Help)`
  está en la línea 154
- El error `DS doesn't exist` seguía apareciendo en `ProductsScreen` tras el fix

### Bug adicional detectado y corregido — useMemo dead code

En `ProductsScreen.jsx`, la función `filtered` tenía código inalcanzable:

```js
// ANTES (Sprint 2 - dead code)
const filtered = useMemo(() => {
  if (filter === 'hot')      return products.filter(...);  // early return
  if (filter === 'stagnant') return products.filter(...);  // early return
  if (filter === 'critical') return products.filter(...);  // early return
  return products;                                          // early return
  if (filterCat) arr = arr.filter(...);  // ← NUNCA se ejecuta, `arr` no definida
  return arr;
}, [products, filter, filterCat]);

// DESPUÉS (Hotfix 3 - correcto)
const filtered = useMemo(() => {
  let arr = products;
  if (filter === 'hot')           arr = arr.filter(p => p.isHot);
  else if (filter === 'stagnant') arr = arr.filter(p => p.isCold || p.isCritical);
  else if (filter === 'critical') arr = arr.filter(p => p.severity?.type === 'CRÍTICO');
  if (filterCat) arr = arr.filter(p => p.category === filterCat);
  return arr;
}, [products, filter, filterCat]);
```

**Impacto:** El filtro por categoría (`filterCat`) nunca funcionaba — siempre mostraba
todos los productos independientemente de la categoría seleccionada.

### Verificación del encoding PS1 (diagnóstico forense)

| Propiedad | v4.9 (original) | v5.0 (Hotfix 2) | v5.1 (Hotfix 3) |
|-----------|-----------------|-----------------|-----------------|
| Encoding | UTF-8 sin BOM | UTF-8 con BOM ✅ | UTF-8 con BOM ✅ |
| Line endings | LF (Unix) | CRLF ✅ | CRLF ✅ |
| Unicode en strings | ►, ─, ═ | ASCII-only ✅ | ASCII-only ✅ |
| `if ($Help)` en línea | 38 | 154 ✅ | 154 ✅ |
| Funciones antes de if | No | Sí ✅ | Sí ✅ |
| Braces balance | Desconocido | 43/43 ✅ | 43/43 ✅ |

### Regla de sustitución de archivos

Para aplicar un hotfix, el archivo local debe reemplazarse completamente:

```
# Opción A: copiar desde outputs directamente (recomendado)
copy "outputs\ProductsScreen.jsx" "C:\resell-hub-app\screens\ProductsScreen.jsx"
copy "outputs\agent-deploy.ps1"   "C:\resell-hub-app\agent-deploy.ps1"

# Opción B: verificar que el archivo nuevo esté activo
# Comprobar que en C:\resell-hub-app\agent-deploy.ps1 la línea 13 sea:
# param(
# Y la línea 154 sea:
# if ($Help) {
```

### Archivos modificados en Hotfix 3

| Archivo | Cambio adicional |
|---------|-----------------|
| `screens/ProductsScreen.jsx` | Fix dead code en `filtered` useMemo — `filterCat` ahora funciona |
| `agent-deploy.ps1` | Sin cambios de código — re-entregado para confirmar sustitución |


---

## 🚀 Sprint 7 — JSON Import Scripts + Deploy Fix (Bare Workflow)

> **Sprint 7 · feature/vinted-import-mobile**
> Fecha: Marzo 2026
> Agentes: ARCHITECT, DATA_SCIENTIST, UI_SPECIALIST, QA_ENGINEER

---

### Problema 1: `CommandError: No development build installed`

**Causa raíz diagnósticada:**
La app usa `expo-dev-client ~5.0.0` + carpeta `android/` nativa (bare workflow).
El comando `npx expo start --localhost --android` intenta abrir **Expo Go**, que no tiene los módulos nativos requeridos (`react-native-mmkv`, `expo-image-manipulator`, `expo-notifications`, etc.). Con dev-client instalado, Expo rechaza este modo.

**Flujo correcto para bare workflow:**

| Modo | Cuándo | Comando |
|------|--------|---------|
| **-Build** | Primera vez, o cambio en `package.json`/`app.json`/`android/` | `npx expo run:android --device` |
| **-Local** | Solo cambios JS/JSX (día a día) | `npx expo start --localhost` |

**Fix en `agent-deploy.ps1 v5.2`:**
- Nuevo flag `-Build`: desinstala APK anterior, limpia, ejecuta `expo run:android --device` (compila Gradle + instala dev build en el móvil)
- Flag `-Local` ahora usa `npx expo start --localhost` (sin `--android`) + comprueba que la dev build esté instalada antes de lanzar y avisa si no lo está
- `-Check` verifica ahora también la existencia de `android/` folder

**Regla de uso:**
```
Primera puesta en marcha → -Build (10 min, una sola vez)
Cambios diarios en .jsx  → -Local (2 seg, hot reload)
```

---

### Problema 2: Vinted bloquea compartir páginas desde app móvil

**Causa:** Vinted eliminó la opción "Compartir página → Copiar HTML" desde la app móvil en actualizaciones recientes. Los formatos A (HTML ventas año actual) y B (HTML historial) dejaron de ser accesibles.

**Solución:** Scripts de consola de navegador que leen el DOM directamente y generan JSON listo para pegar en ResellHub. Mismo patrón que `scriptJSON.js` (escaparate de productos).

---

### Nuevos Formatos D y E

| ID | Script | Página Vinted | Datos |
|----|--------|--------------|-------|
| `json_sales_current` | `scriptVentasActuales.js` | `/my-orders/sold` | orderId, title, amount, status, imageUrl. **Sin fecha** |
| `json_sales_history` | `scriptHistorialVentas.js` | `/balance` | orderId, title, amount, type (venta/compra), **fecha ISO**, soldPriceReal |

**Flujo de uso:**
```
1. PC: Vinted → Mis pedidos / Saldo y pagos
2. F12 → Consola → Pegar script → Enter
3. "JSON copiado al portapapeles ✅" + descarga .json de respaldo
4. Móvil: ResellHub → Importar → PEGAR DESDE VINTED
5. Detección automática → Mode D o Mode E
6. Preview de items → Confirmar
```

---

### Arquitectura del Dispatcher (actualizada a 5 formatos)

```
parseVintedContent(text)
  ├── 'json_sales_current'  → parseJsonSalesCurrent()  → Mode D (UI como A)
  ├── 'json_sales_history'  → parseJsonSalesHistory()  → Mode E (UI como B)
  ├── 'json_products'       → parseJsonProducts()      → Mode C
  ├── 'html_sales_current'  → parseHtmlSalesCurrent()  → Mode A (fallback HTML)
  └── 'html_sales_history'  → parseHtmlSalesHistory()  → Mode B (fallback HTML)
```

**Detección de tipos JSON (orden de prioridad):**
1. `sourceFormat` field explícito → tipo seguro
2. `orderId + type='venta' + date=null + imageUrl present` → `json_sales_current`
3. `orderId + type in (venta,compra) + date present + no imageUrl` → `json_sales_history`
4. `id present || (title && !orderId)` → `json_products`
5. `orderId genérico` → `json_sales_history` (fallback seguro)

---

### VintedParserService.js — Funciones añadidas

```js
// Formato D
export function parseJsonSalesCurrent(text): VintedSaleItem[]
  // → orderId, title, amount, soldPriceReal, type, status
  //   date=null (usuario introduce en DateConfirmModal)
  //   imageUrl preservado para previsualización

// Formato E  
export function parseJsonSalesHistory(text): VintedSaleItem[]
  // → orderId, title, amount normalizado (positivo=venta, negativo=compra)
  //   soldDateReal: ISO string cuando type='venta'
  //   soldPriceReal: abs(amount) cuando type='venta'
```

---

### VintedImportScreen.jsx — Cambios

**TYPE_META** añadidos:
```js
json_sales_current: { label: 'JSON ventas año actual',  mode: 'D' }
json_sales_history: { label: 'JSON historial completo', mode: 'E' }
```

**GUIDE** actualizado: Mode D y E reemplazan A y B como métodos primarios. Los HTML (A/B) quedan como fallback por compatibilidad.

**Modal routing:**
- Mode D → `ConfirmModal mode="A"` + `DateConfirmModal` (sin fecha en página)
- Mode E → `ConfirmModal mode="B"` (con fecha ISO ya incluida)

**importResult colors:**
- D → `DS.successBg` / verde (como ventas)
- E → `DS.blueBg` / azul (como historial)

---

### scriptVentasActuales.js — Selectores DOM

```
Página: /my-orders/sold
Selector principal: [data-testid="my-orders-item"]
Fallback:           a[href^="/inbox/"]

orderId ← href.match(/\/inbox\/(\d+)/)
title   ← [data-testid="my-orders-item--title"] || .web_ui__Cell__title
amount  ← primer <h3> con valor numérico
status  ← <svg><title>Estado de la transacción: X</title>
imageUrl← img[data-testid="my-orders-item-image--img"]
date    ← null (no disponible en esta página)
```

### scriptHistorialVentas.js — Selectores DOM

```
Página: /balance (Saldo y pagos)
Selector A: .pile__element → a[href^="/inbox/"]
Selector B: a[href^="/inbox/"] (fallback)

orderId      ← href.match(/\/inbox\/(\d+)/)
type         ← .web_ui__Cell__title (.toLowerCase → 'venta'/'compra')
title        ← .web_ui__Cell__body
amount + date← .web_ui__Cell__suffix → <h2> + texto posterior
parseSpanishDate: "24 de febrero de 2026" → "2026-02-24T12:00:00.000Z"
```

---

### Archivos modificados Sprint 7

| Archivo | Cambio |
|---------|--------|
| `agent-deploy.ps1` | v5.1→v5.2: nuevo `-Build` (expo run:android), `-Local` sin --android, check dev build instalada |
| `services/VintedParserService.js` | +parseJsonSalesCurrent, +parseJsonSalesHistory, detectContentType actualizado (5 formatos) |
| `screens/VintedImportScreen.jsx` | TYPE_META +D/+E, GUIDE actualizado, ConfirmModal routing D→A/E→B, importResult colors D/E |
| `scriptVentasActuales.js` | **NUEVO** — Scraper DOM para /my-orders/sold → json_sales_current |
| `scriptHistorialVentas.js` | **NUEVO** — Scraper DOM para /balance → json_sales_history |

### Git Workflow — Sprint 7

```bash
git add services/VintedParserService.js
git add screens/VintedImportScreen.jsx
git add agent-deploy.ps1
git add scripts/scriptVentasActuales.js
git add scripts/scriptHistorialVentas.js
git add SYSTEM_DESIGN.md

git commit -m "feat(sprint7): JSON import scripts + bare workflow deploy fix

[ARCHITECT]
- agent-deploy.ps1 v5.2: separar -Build (expo run:android) de -Local (metro)
  Fix: CommandError 'No development build installed' con expo-dev-client
  Nuevo: -Build compila Gradle + instala dev build; -Local solo metro hot reload
  Nuevo: -Local verifica dev build instalada antes de lanzar
  
[DATA_SCIENTIST]
- VintedParserService: +parseJsonSalesCurrent +parseJsonSalesHistory
  detectContentType: 5 formatos (A HTML, B HTML, C JSON prod, D JSON ventas, E JSON historial)
  SaleItem.soldPriceReal/soldDateReal normalizados por tipo en ambos parsers

[UI_SPECIALIST]  
- VintedImportScreen: TYPE_META +D +E, GUIDE reemplaza A/B por D/E como primarios
  ConfirmModal routing D→A (con DateConfirmModal), E→B
  importResult: colores verde(D)/azul(E) correctos

[QA_ENGINEER]
- scriptVentasActuales.js: Node syntax OK, detectado como json_sales_current OK
- scriptHistorialVentas.js: Node syntax OK, parseSpanishDate validado
- Todos los formatos detectados correctamente en simulación"
```


---

## 🔧 Hotfix 4 — JAVA_HOME auto-detection (Sprint 7b)

> **Hotfix 4 · feature/vinted-import-mobile**
> Fecha: Marzo 2026
> Agentes: [ORCHESTRATOR] → [DEBUGGER] → [DEVOPS] → [LIBRARIAN]

---

### [DEBUGGER] DIAGNÓSTICO

```
BUG:    Gradle falla con código de salida 9009
SÍNTOMA: "JAVA_HOME is not set and no 'java' command could be found in PATH"
ROOT CAUSE:
  Android Studio instala su propio JBR (JetBrains Runtime) en:
    C:\Program Files\Android\Android Studio\jbr\
  Pero NO lo registra en las variables de entorno del sistema Windows.
  PowerShell al abrirse hereda el PATH del sistema → sin Java → Gradle 9009.

STACK RELEVANTE:
  Gradle 8.10.2 + AGP compileSdk=35 + Kotlin 1.9.25
  → Requiere Java 17 mínimo (Java 21 soportado)

ARCHIVOS AFECTADOS:
  agent-deploy.ps1 (único punto de entrada al build nativo)

FIX: Set-JavaEnvironment antes de llamar a expo run:android
RIESGO: BAJO — no toca código de la app, solo variables de entorno PS
TEST REGRESIÓN: .\agent-deploy.ps1 -Check → debe mostrar Java OK
```

---

### [DEVOPS] `agent-deploy.ps1 v5.3` — Cambios respecto v5.2

#### Nueva función `Find-JavaHome`

Busca Java 17+ en 5 niveles de prioridad:

| Prioridad | Método | Ruta típica |
|-----------|--------|-------------|
| 1 | `$env:JAVA_HOME` ya seteado | Cualquier |
| 2 | **JBR de Android Studio** | `C:\Program Files\Android\Android Studio\jbr\` |
| 3 | Scan en `Program Files` | Eclipse Adoptium, Microsoft, Oracle, Zulu, Amazon Corretto |
| 4 | **Registro de Windows** | `HKLM:\SOFTWARE\JavaSoft\JDK\17+` |
| 5 | `java` en `PATH` | Último recurso |

```powershell
# Resultado: ruta al JDK (string) o $null si no encontrado
$javaHome = Find-JavaHome
```

#### Nueva función `Set-JavaEnvironment`

- Llama a `Find-JavaHome`
- Si no encuentra Java: muestra error con enlace a Temurin 17, aborta con `exit 1`
- Si encuentra Java: setea `$env:JAVA_HOME` y `$env:PATH` para la sesión actual
- Verifica que la versión es ≥ 17 y lo muestra en el log

```powershell
# Retorna $true (OK) o $false (error — build abortado)
$javaOk = Set-JavaEnvironment
```

#### Flujo `-Build` actualizado

```
1. Set-JavaEnvironment  ← NUEVO: auto-detect + setear JAVA_HOME
   ↓ si falla → exit 1 con instrucciones de instalación
2. Uninstall-AppFromDevice
3. Run-DeepClean
4. $env:EXPO_METRO_PORT = "8081"
5. adb reverse tcp:8081 tcp:8081
6. npx expo run:android --device
```

#### `-Check` actualizado

Ahora muestra estado de Java con detalles de versión:
```
> Java / JAVA_HOME (requerido para -Build)
  [OK] Encontrado: C:\Program Files\Android\Android Studio\jbr
       Version: openjdk version "21.0.3" 2024-04-16
  [OK] Version Java 21 (compatible con Gradle 8.x)
```

---

### Compatibilidad Java-Gradle

| Gradle | AGP | Java mínimo | Java recomendado |
|--------|-----|------------|-----------------|
| 8.10.2 | 8.x | 17 | 21 |
| 8.x    | 7.x | 11 | 17 |

El proyecto usa `compileSdk=35` + `Kotlin 1.9.25` → **Java 17 mínimo obligatorio**.

---

### Git Workflow — Hotfix 4

```bash
git add agent-deploy.ps1
git add SYSTEM_DESIGN.md

git commit -m "fix(devops): JAVA_HOME auto-detection en agent-deploy.ps1 v5.3

[DEBUGGER]
- Root cause: Android Studio JBR no registrado en variables de entorno sistema
- Gradle 8.10.2 + compileSdk 35 requiere Java 17+ en PATH

[DEVOPS]
- Find-JavaHome: busca JDK en 5 niveles (env > JBR Android Studio > ProgramFiles > registro > PATH)
- Set-JavaEnvironment: setea JAVA_HOME+PATH para la sesion + verifica version >= 17
- Build abortado con instrucciones si Java no encontrado (exit 1)
- -Check: muestra version Java detectada y compatibilidad con Gradle 8.x"
```

# 📋 Sprint 8 — JSON Import con DocumentPicker + Match Historial → Inventario

> **Sprint 8 · feature/sprint8-json-import-v2**
> Fecha: Marzo 2026

---

## Resumen ejecutivo

Sprint 8 consolida la importación de datos de Vinted en un flujo único, limpio y sin
fricciones. Se elimina la duplicidad del botón de importar en ProductsScreen y
SoldHistoryScreen, se reemplaza el tab "Logs" por "Importar" en la barra de navegación
principal, y se introduce la función `matchHistoryToInventory()` para cruzar automáticamente
el historial de ventas con el inventario y actualizar `soldPriceReal` + `soldDateReal`.

---

## [PRODUCT_OWNER] — Validación PO-001

```
FEATURE: Sprint 8 — JSON Import v2 con DocumentPicker
OBJETIVO: Eliminar fricción de copiar/pegar JSON; activar el flujo multi-año de historial

CRITERIOS:
  OK El usuario puede adjuntar un JSON en ≤ 2 taps (seleccionar archivo → confirmar)
  OK Los 7 Campos Sagrados permanecen intactos
  OK matchHistoryToInventory actualiza soldPriceReal + soldDateReal sin tocar firstUploadDate
  OK Las compras del JSON de ventas actuales se ignoran automáticamente
  OK El botón "Importar" desaparece de ProductsScreen y SoldHistoryScreen
  OK Logs sigue accesible desde Settings y como stack screen
  OK Dedup por orderId activo en VintedSalesDB (multi-año seguro)

FUERA DE ALCANCE:
  NO Importación masiva paginada (Fase 2)
  NO Subida automática a Vinted
```

---

## [ARCHITECT] — Cambios de arquitectura

### Navegación: Tab "Logs" → Tab "Importar"

```
App.jsx — MainTabs

ANTES (Sprint 7):
  Home | Inventario | Vendidos | Stats | Config | Logs

DESPUÉS (Sprint 8):
  Home | Inventario | Vendidos | Stats | Config | Importar

LogsScreen → Stack.Screen (accesible desde Settings o header de Importar)
```

### Nuevo flujo de importación

```
VintedImportScreen (tab)
       ↓
[Botón "Adjuntar JSON"] → DocumentPicker.getDocumentAsync()
       ↓
FileSystem.readAsStringAsync(uri)
       ↓
detectContentType(text)
  ├─ json_products       → parseJsonProducts()      → MODO C
  ├─ json_sales_current  → parseJsonSalesCurrent()  → MODO D (filtra compras)
  └─ json_sales_history  → parseJsonSalesHistory()  → MODO E (ventas + compras)
       ↓
Preview con selección por checkboxes
       ↓
ConfirmModal (específico por modo)
       ↓
  MODO C → DatabaseService.importFromVinted()
  MODO D → matchHistoryToInventory() [solo ventas]
  MODO E → VintedSalesDB.saveRecords() + matchHistoryToInventory()
```

### Dependencias nuevas

```json
"expo-document-picker": "^12.x",
"expo-file-system": "^17.x"
```

Verificar que están en `package.json`. Si no:
```bash
npx expo install expo-document-picker expo-file-system
```

---

## [DATA_SCIENTIST] — matchHistoryToInventory()

### Algoritmo

```
Para cada VintedSaleItem (solo ventas):

  1. Buscar por orderId embebido en product.id
     e.g. product.id = "vinted_20679079955" → match con orderId "20679079955"

  2. Si no hay match, normalizar título:
     normalize(s) = s.toLowerCase()
                     .replace(emojis, '')
                     .replace(símbolos, ' ')
                     .replace(/\s+/, ' ')
                     .trim()
     Buscar en índice de títulos normalizados del inventario

  3. Si hay colisión de títulos:
     → Preferir el ya marcado como 'sold'
     → Si ninguno vendido, usar el más reciente

  4. Si hay coincidencia:
     → Actualiza soldPriceReal (solo si el producto no tenía valor)
     → Actualiza soldDateReal (solo si el producto no tenía fecha real)
     → Marca status = 'sold' si estaba 'available'
     → Llama a DatabaseService.updateProduct()

  5. Si no hay coincidencia:
     → Crea producto nuevo vía mapToInventoryProduct() + importFromVinted()
     → Cuenta en result.created

Retorna: { matched, created, skipped, errors }
```

### Protección de Los 7 Campos Sagrados en el match

```
✓ firstUploadDate   → NUNCA se toca en matchHistoryToInventory
✓ category          → NUNCA se toca
✓ title             → NUNCA se toca (solo se usa para buscar)
✓ brand             → NUNCA se toca
✓ soldPriceReal     → Solo se escribe si el producto no tenía valor (null/0)
✓ soldDateReal      → Solo se escribe si el producto no tenía fecha real
✓ isBundle          → NUNCA se toca
```

---

## [UI_SPECIALIST] — VintedImportScreen v2

### Cambios respecto Sprint 7

| Elemento | Sprint 7 | Sprint 8 |
|---------|---------|---------|
| Acceso | Stack screen desde ProductsScreen/SoldHistory | Tab propio "Importar" |
| Input | Clipboard / TextArea manual | DocumentPicker (adjuntar archivo) |
| Modos soportados | A, B, C, D, E | C, D, E (A y B deprecados) |
| Filtro compras Modo D | Manual | Automático al parsear |
| Match historial | No | matchHistoryToInventory() |
| Stats previo Modo E | No | Quick stats (ventas/compras/€) |
| Botón Logs | N/A | Acceso directo en header |

### Drop Zone

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│              ☁ [icono upload]                      │
│                                                     │
│           Adjuntar archivo JSON                     │
│    Toca para seleccionar desde tu dispositivo       │
│                                                     │
│              [ .json · .txt ]                       │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Guía de modos (cuando no hay archivo)

```
MODO C ─ Escaparate (Inventario)   [naranja]
MODO D ─ Ventas año actual         [verde]
MODO E ─ Historial completo        [azul]
```

### Quick Stats (solo Modo E, tras parsear)

```
┌──────────┬──────────┬──────────┐
│    35    │    12    │  234 €   │
│  ventas  │ compras  │facturado │
└──────────┴──────────┴──────────┘
```

---

## [QA_ENGINEER] — Consideraciones Sprint 8

### expo-document-picker permisos Android

El `DocumentPicker` de Expo no requiere permisos especiales de almacenamiento en
Android 10+ (usa el SAF — Storage Access Framework). No necesita `READ_EXTERNAL_STORAGE`
en el manifest.

### Dedup multi-año en VintedSalesDB

Los archivos de historial se importan por año (2025, 2024, 2023...). La dedup
por `orderId` en `VintedSalesDB.saveRecords()` garantiza que importar el mismo
año dos veces no crea duplicados.

### Filtro de compras automático Modo D

```js
// Al parsear json_sales_current, las compras se filtran antes de mostrar preview:
const items = raw.filter(i => i.type !== 'compra');
```

El usuario nunca ve las compras del archivo de ventas actuales.

### Acepta JSON con campo `soldPriceReal=0`

```js
// matchHistoryToInventory solo actualiza si el producto NO tenía valor:
if (item.soldPriceReal && (!prod.soldPriceReal || prod.soldPriceReal === 0)) {
  updatedProducts[matchIdx].soldPriceReal = item.soldPriceReal;
}
```

Los productos con precio real ya introducido manualmente no se sobreescriben.

---

## [LIBRARIAN] — Archivos modificados Sprint 8

| Archivo | Tipo | Cambio |
|---------|------|--------|
| `App.jsx` | 🔴 Modificado | Tab "Logs" → Tab "Importar" · LogsScreen como Stack.Screen |
| `screens/VintedImportScreen.jsx` | 🔴 Modificado | DocumentPicker · Modos C/D/E · matchHistoryToInventory · sin clipboard |
| `screens/LogsScreen.jsx` | 🔴 Modificado | Eliminado modal importación · accesible via Stack |
| `services/VintedParserService.js` | 🔴 Modificado | +matchHistoryToInventory · detectContentType mejorado · fix filtro compras |
| `screens/ProductsScreen.jsx` | 🟡 Patch manual | Eliminar botón "Importar" del header |
| `screens/SoldHistoryScreen.jsx` | 🟡 Patch manual | Eliminar botón "Importar" del header |
| `SYSTEM_DESIGN.md` | 📝 Documentación | Sprint 8 añadido |

### Patches manuales (ProductsScreen y SoldHistoryScreen)

Busca y elimina en `screens/ProductsScreen.jsx`:
```jsx
// ELIMINAR — cualquier botón que navegue a VintedImport en el header:
<TouchableOpacity onPress={() => navigation.navigate('VintedImport')} ...>
  <Icon name="upload-cloud" ... />
</TouchableOpacity>
```

Mismo proceso para `screens/SoldHistoryScreen.jsx`.

---

## Git Workflow — Sprint 8

```bash
git checkout -b feature/sprint8-json-import-v2

git add App.jsx
git add screens/VintedImportScreen.jsx
git add screens/LogsScreen.jsx
git add services/VintedParserService.js
git add screens/ProductsScreen.jsx
git add screens/SoldHistoryScreen.jsx
git add SYSTEM_DESIGN.md

git commit -m "feat(sprint8): DocumentPicker + matchHistoryToInventory + tab Importar

[PRODUCT_OWNER]
- Tab 'Logs' reemplazado por tab 'Importar' (VintedImportScreen)
- Botón Importar eliminado de ProductsScreen y SoldHistoryScreen
- LogsScreen accesible via Stack.Screen desde Settings / header Importar

[ARCHITECT]
- App.jsx: Import tab ocupa posición 6, Logs como Stack screen
- VintedParserService: +matchHistoryToInventory() — skill ARCH-001 smart_merge
- detectContentType: detección robusta por sourceFormat + estructura de campos

[DATA_SCIENTIST]
- matchHistoryToInventory: 2 estrategias de match (orderId + título normalizado)
- Protege Los 7 Campos Sagrados: soldPriceReal solo se escribe si null/0
- Ignora compras automáticamente, solo procesa ventas
- Dedup multi-año en VintedSalesDB por orderId Set

[UI_SPECIALIST]
- VintedImportScreen v2: DocumentPicker + FileSystem (sin clipboard)
- Drop Zone visual, guía de 3 modos, quick stats para Modo E
- ConfirmModal específico por modo (C/D/E)
- Botón 'Logs' en header con navigate('Logs')

[QA_ENGINEER]
- Modos A/B (HTML) deprecados — stub vacío para compatibilidad
- Compras filtradas en Modo D antes del preview
- JSON de historial 2025/2024/2023 importados con dedup seguro
- expo-document-picker: no requiere permisos READ_EXTERNAL_STORAGE (SAF)

[LIBRARIAN]
- SYSTEM_DESIGN.md: Sprint 8 documentado"

git checkout main
git merge --no-ff feature/sprint8-json-import-v2 -m "merge: Sprint 8 json-import-v2"
```
---

## 🔧 Sprint 8 — Fix: LogsScreen errors + matchHistoryToInventory no actualiza

> **Sprint 8 fix · feature/sprint8-json-import-v2**
> Fecha: Marzo 2026

---

### Bugs corregidos

| Bug | Causa raíz | Fix |
|-----|-----------|-----|
| `ERROR ❌ [ui] LogsScreen.backup — unknown` | LogsScreen llamaba `DatabaseService.backupData()` (no existe) | Restaurado uso directo de `backupStorage.set('emergency_backup', ...)` |
| `ERROR ❌ [ui] LogsScreen.recover — unknown` | LogsScreen llamaba `DatabaseService.recoverData()` (no existe) | Restaurado `backupStorage.getString('emergency_backup')` + `saveProducts()` |
| `ERROR ❌ [ui] LogsScreen.reset — unknown` | LogsScreen llamaba `DatabaseService.resetAll()` (no existe) | Restaurado `backupStorage.set(backup)` + `DatabaseService.saveProducts([])` |
| matchHistoryToInventory no actualiza soldPriceReal/soldDateReal | `updateProduct()` preserva MANUAL_FIELDS_SOLD que incluye `soldPriceReal`+`soldDateReal`, bloqueando la actualización | Nuevo método `DatabaseService.updateSaleData()` que escribe directamente sin pasar por MANUAL_FIELDS |

---

### [ARCHITECT] — Diagnóstico LogsScreen

**Causa:** En Sprint 8, la reescritura de LogsScreen introdujo métodos ficticios:

```js
// ❌ INCORRECTO (Sprint 8 primera versión — métodos inexistentes):
DatabaseService.backupData()    // → TypeError: not a function
DatabaseService.recoverData()   // → TypeError: not a function
DatabaseService.resetAll()      // → TypeError: not a function
```

**Fix:** Restaurar la lógica del LogsScreen original del proyecto, que usa directamente MMKV:

```js
// ✅ CORRECTO (igual que LogsScreen original):
const backupStorage = new MMKV({ id: 'backup-storage' });

// Backup:
const data = DatabaseService.getAllProducts();
backupStorage.set('emergency_backup', JSON.stringify(data));

// Recover:
const raw = backupStorage.getString('emergency_backup');
const parsed = JSON.parse(raw);
DatabaseService.saveProducts(parsed);

// Reset:
DatabaseService.saveProducts([]); // alias de saveAllProducts([])
```

---

### [DATA_SCIENTIST] — Diagnóstico matchHistoryToInventory

**Causa raíz:** El flujo de match → update era:

```
matchHistoryToInventory()
  → encuentra producto por título "Libro de Pepo y los bomberos"
  → llama DatabaseService.updateProduct({ soldPriceReal: 3, soldDateReal: '2026-02-10...' })
  → updateProduct() ejecuta:
      manualFields.forEach(field => {
        if (old[field] !== undefined && old[field] !== null) {
          merged[field] = old[field]; // ← BLOQUEA: el producto ya tiene soldPriceReal=4.5
        }
      });
  → soldPriceReal queda en 4.5 (precio de publicación) en vez de 3 (precio real)
```

**Los 7 Campos Sagrados protegen `soldPriceReal` y `soldDateReal` asumiendo que ya fueron introducidos manualmente.** Pero cuando el producto vino del escaparate JSON, `soldPriceReal` se inicializó con el precio de publicación — no es un valor manual real.

**Fix:** Nuevo método `DatabaseService.updateSaleData()`:

```js
// ✅ NUEVO en DatabaseService.js (añadir tras markAsSold):
static updateSaleData(productId, { soldPriceReal, soldDateReal, status } = {}) {
  try {
    const all = this.getAllProducts();
    const idx = all.findIndex(p => String(p.id) === String(productId));
    if (idx === -1) return false;

    // Escribe directamente, SIN pasar por MANUAL_FIELDS
    if (soldPriceReal != null && soldPriceReal > 0) {
      all[idx].soldPriceReal = soldPriceReal;
    }
    if (soldDateReal) {
      all[idx].soldDateReal = soldDateReal;
      all[idx].soldAt       = soldDateReal;
      all[idx].soldDate     = soldDateReal; // alias legacy
    }
    if (status) {
      all[idx].status = status;
    }

    this.saveAllProducts(all);
    LogService.add(
      `💰 updateSaleData: ${all[idx].title} → ${soldPriceReal}€ · ${soldDateReal?.slice(0,10)}`,
      'success',
    );
    return true;
  } catch (e) {
    LogService.add('❌ updateSaleData error: ' + e.message, 'error');
    return false;
  }
}
```

**Posición en DatabaseService.js:** Justo después de `markAsSold()`, antes de `updateProductSmart()`.

**¿Por qué es seguro?** `updateSaleData()` solo toca `soldPriceReal`, `soldDateReal`, `status` y el alias `soldAt`/`soldDate`. No toca ningún otro campo. Los datos provienen del historial oficial de Vinted (fuente de verdad superior a la inicialización del escaparate).

---

### Verificación con el ejemplo del usuario

```json
{
  "orderId": "20405022415",
  "title": "Libro de Pepo y los bomberos",
  "soldPriceReal": 3,
  "soldDateReal": "2026-02-10T12:00:00.000Z"
}
```

**Antes del fix:**
- Producto en BD: `soldPriceReal = 4.5` (precio de publicación del escaparate)
- `updateProduct()` preserva 4.5 → ❌ no se actualiza

**Después del fix:**
- `matchHistoryToInventory()` encuentra el producto por título normalizado
- Llama `updateSaleData('vinted_XXXXX', { soldPriceReal: 3, soldDateReal: '2026-02-10T12:00:00.000Z', status: 'sold' })`
- BD queda con `soldPriceReal = 3`, `soldDateReal = '2026-02-10T12:00:00.000Z'` ✅

---

### Archivos modificados Sprint 8 fix

| Archivo | Cambio |
|---------|--------|
| `screens/LogsScreen.jsx` | Restaurado `backupStorage` + métodos correctos de backup/recover/reset |
| `services/VintedParserService.js` | `matchHistoryToInventory` usa `DatabaseService.updateSaleData()` |
| `services/DatabaseService.js` | **Añadir método** `updateSaleData()` tras `markAsSold()` |

### Instrucción exacta para DatabaseService.js

Busca el método `markAsSold` y añade `updateSaleData` inmediatamente después:

```
// Busca esta línea en DatabaseService.js:
    } catch {
      return false;
    }
  }

  static updateProductSmart(productId, updates) {
```

Inserta entre los dos métodos:

```js
  static updateSaleData(productId, { soldPriceReal, soldDateReal, status } = {}) {
    try {
      const all = this.getAllProducts();
      const idx = all.findIndex(p => String(p.id) === String(productId));
      if (idx === -1) {
        LogService.add('⚠️ updateSaleData: ' + productId + ' no encontrado', 'warn');
        return false;
      }
      if (soldPriceReal != null && soldPriceReal > 0) {
        all[idx].soldPriceReal = soldPriceReal;
      }
      if (soldDateReal) {
        all[idx].soldDateReal = soldDateReal;
        all[idx].soldAt       = soldDateReal;
        all[idx].soldDate     = soldDateReal;
      }
      if (status) {
        all[idx].status = status;
      }
      this.saveAllProducts(all);
      LogService.add(
        '💰 updateSaleData: ' + all[idx].title + ' → ' + soldPriceReal + '€',
        'success',
      );
      return true;
    } catch (e) {
      LogService.add('❌ updateSaleData error: ' + e.message, 'error');
      return false;
    }
  }
```

---

### Git Workflow — Sprint 8 fix

```bash
git add screens/LogsScreen.jsx
git add services/VintedParserService.js
git add services/DatabaseService.js
git add SYSTEM_DESIGN.md

git commit -m "fix(sprint8): LogsScreen backup errors + matchHistoryToInventory no actualiza

[DEBUGGER]
- LogsScreen: TypeError backupData/recoverData/resetAll (métodos inexistentes)
  Root cause: Sprint 8 usó API ficticia en lugar del backupStorage (MMKV) original
  Fix: Restaurado backupStorage = new MMKV({id:'backup-storage'}) + lógica original

- matchHistoryToInventory: soldPriceReal/soldDateReal no se actualizaban
  Root cause: updateProduct() preserva MANUAL_FIELDS_SOLD bloqueando sobreescritura
  Fix: Nuevo DatabaseService.updateSaleData() que bypasa MANUAL_FIELDS

[ARCHITECT]
- DatabaseService: +updateSaleData(productId, {soldPriceReal, soldDateReal, status})
  Solo toca los 3 campos de venta, nunca firstUploadDate/category/title/brand/isBundle
  Fuente de verdad: datos del historial oficial Vinted > precio de publicación escaparate

[QA_ENGINEER]
- Verificado con ejemplo real: Libro de Pepo y los bomberos
  soldPriceReal 4.5 (publicación) → 3 (historial real) ✅
  soldDateReal null → 2026-02-10T12:00:00.000Z ✅"
```
# SYSTEM_DESIGN — Sprint 9
> **Feature: Estadísticas Anuales + Filtro Precios + Export BBDD + Persistencia Deploy**
> Rama: `feature/sprint9-annual-stats-export-db`
> Fecha: Marzo 2026

---

## [ORCHESTRATOR] — Protocolo Sprint 9

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TAREA:       Estadísticas anuales + filtro negativos + export BBDD
TIPO:        FEATURE + BUG FIX
COMPLEJIDAD: ALTA — MODO FULL-TEAM
PRIORIDAD:   ALTA

AGENTES:
  [DATA_SCIENTIST]    DS-001/002/003  → bugs cálculos mensuales/anuales
  [ARCHITECT]         ARCH-001/003    → nuevos métodos DB export/import
  [QA_ENGINEER]       QA-002          → filtro precios negativos
  [UI_SPECIALIST]     UI-001/003      → tab anual + sección BBDD Settings
  [MIGRATION_MANAGER] MIGA-001        → estrategia deploy
  [SECURITY_OFFICER]  SEC-001/002     → auditoría export
  [LIBRARIAN]         LIB-001/002     → documentación
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## [DATA_SCIENTIST] — Bugs corregidos en cálculos

### BUG CRÍTICO — `getMonthlyHistory()` key incorrecta

**Esta es la causa principal de que las estadísticas no se actualizaban.**

```js
// ANTES (BUG): getMonth() es 0-based → enero = "2026-00" ← INCORRECTO
const key = `${date.getFullYear()}-${String(date.getMonth()).padStart(2,'0')}`;

// DESPUÉS (FIX): enero = "2026-01" ✅
const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
```

Las keys del inventario local y de VintedSalesDB no coincidían. Resultado: ninguna estadística mensual cuadraba.

### BUG — soldAmt negativo en cálculos

```js
// ANTES: podía ser negativo si soldPriceReal venía corrupto del import
const soldAmt = Number(p.soldPriceReal || p.soldPrice || p.price);

// DESPUÉS: siempre >= 0
const soldAmt = Math.max(0, Number(p.soldPriceReal || p.soldPrice || p.price || 0));
```

### BUG — `VintedSalesDB.getStats()` agrupación por mes

```js
// ANTES: r.date puede ser null en Modo D
const key = (r.date || '').slice(0, 7) || 'unknown';

// DESPUÉS: soldDateReal tiene prioridad
const dateStr = r.soldDateReal || r.date || '';
const monthKey = dateStr.slice(0, 7) || 'unknown';
```

---

## [ARCHITECT] — Nuevos métodos DatabaseService.js

### Dónde insertar cada método

```
... getMonthlyHistory() ...
   ↓ INSERTAR: getAnnualHistory()
   ↓ INSERTAR: exportFullDatabase()
   ↓ INSERTAR: importFullDatabase(payload)
... getBusinessKPIs() ...
... markAsSold() ...
   ↓ INSERTAR: updateSaleData()  [Sprint 8 fix reconfirmado]
... updateProductSmart() ...
```

### `getAnnualHistory()` — código a insertar

```js
static getAnnualHistory() {
  const months = this.getMonthlyHistory();
  const yearMap = {};
  months.forEach(m => {
    const y = String(m.year);
    if (!yearMap[y]) yearMap[y] = {
      year: m.year, label: y,
      profit: 0, revenue: 0, sales: 0, bundles: 0,
      months: [], catTotals: {},
    };
    yearMap[y].profit  += m.profit  || 0;
    yearMap[y].revenue += m.revenue || 0;
    yearMap[y].sales   += m.sales   || 0;
    yearMap[y].bundles += m.bundles || 0;
    yearMap[y].months.push(m);
    Object.entries(m.categoryBreakdown || {}).forEach(([cat, d]) => {
      if (!yearMap[y].catTotals[cat]) yearMap[y].catTotals[cat] = { profit: 0, sales: 0, revenue: 0 };
      yearMap[y].catTotals[cat].profit  += d.profit || 0;
      yearMap[y].catTotals[cat].sales   += d.sales  || 0;
      yearMap[y].catTotals[cat].revenue += d.revenue|| 0;
    });
  });
  return Object.values(yearMap).map(y => {
    const sorted = [...y.months].sort((a, b) => b.profit - a.profit);
    const topCats = Object.entries(y.catTotals)
      .sort((a, b) => b[1].profit - a[1].profit)
      .map(([name, d]) => ({ name, profit: +(d.profit.toFixed(2)), sales: d.sales, revenue: +(d.revenue.toFixed(2)) }));
    return {
      year: y.year, label: y.label,
      profit:           +(y.profit.toFixed(2)),
      revenue:          +(y.revenue.toFixed(2)),
      sales:            y.sales,
      bundles:          y.bundles,
      monthCount:       y.months.length,
      avgMonthlyProfit: y.months.length ? +(y.profit / y.months.length).toFixed(2) : 0,
      avgMonthlySales:  y.months.length ? +(y.sales  / y.months.length).toFixed(1)  : 0,
      bestMonth:        sorted[0] || null,
      topCategory:      topCats[0] || null,
      topCategories:    topCats,
    };
  }).sort((a, b) => b.year - a.year);
}
```

### `exportFullDatabase()` — código a insertar

```js
static exportFullDatabase() {
  try {
    let salesHistory = [];
    try {
      const { VintedSalesDB } = require('./VintedParserService');
      salesHistory = VintedSalesDB.getAllRecords();
    } catch { /* silent */ }
    let importLog = [];
    try {
      const raw = storage.getString('import_log');
      importLog = raw ? JSON.parse(raw) : [];
    } catch { /* silent */ }
    const payload = {
      schemaVersion:  storage.getString('schema_version') || '2.0',
      exportedAt:     new Date().toISOString(),
      exportedBy:     'ResellHub_exportFullDatabase_v9',
      products:       this.getAllProducts(),
      config:         this.getConfig(),
      dictionary:     this.getDictionary()     || {},
      dictionaryFull: this.getFullDictionary() || {},
      salesHistory,
      importLog,
      // ⚠️ EXCLUIDO: app_pin, app_password, session_authed_until
    };
    LogService.add(`📤 Export BBDD: ${payload.products.length} productos, ${salesHistory.length} ventas`, 'success');
    return payload;
  } catch (e) {
    LogService.add('❌ exportFullDatabase error: ' + e.message, 'error');
    return null;
  }
}
```

### `importFullDatabase(payload)` — código a insertar

```js
static importFullDatabase(payload) {
  const result = { products: 0, salesRecords: 0, configRestored: false, errors: [] };
  try {
    if (!payload || !payload.exportedBy?.includes('ResellHub')) {
      result.errors.push('Payload inválido');
      return result;
    }
    if (Array.isArray(payload.products) && payload.products.length > 0) {
      const existing = this.getAllProducts();
      if (existing.length === 0) {
        this.saveAllProducts(payload.products);
        result.products = payload.products.length;
      } else {
        const r = this.importFromVinted(payload.products);
        result.products = (r.created || 0) + (r.updated || 0);
      }
    }
    if (payload.dictionary && Object.keys(payload.dictionary).length > 0) {
      storage.set('custom_dictionary', JSON.stringify(payload.dictionary));
    }
    if (payload.dictionaryFull && Object.keys(payload.dictionaryFull).length > 0) {
      storage.set('custom_dictionary_full', JSON.stringify(payload.dictionaryFull));
    }
    if (result.products > 0 && payload.config) {
      const current = this.getAllProducts();
      if (current.length === result.products) {
        this.saveConfig(payload.config);
        result.configRestored = true;
      }
    }
    if (Array.isArray(payload.salesHistory) && payload.salesHistory.length > 0) {
      try {
        const { VintedSalesDB } = require('./VintedParserService');
        const r = VintedSalesDB.saveRecords(payload.salesHistory);
        result.salesRecords = r.inserted || 0;
      } catch (e) { result.errors.push('salesHistory: ' + e.message); }
    }
    LogService.add(`📥 Import BBDD: ${result.products} productos, ${result.salesRecords} ventas`, 'success');
  } catch (e) {
    result.errors.push(e.message);
    LogService.add('❌ importFullDatabase error: ' + e.message, 'error');
  }
  return result;
}
```

### `updateSaleData()` — insertar después de `markAsSold()`

```js
static updateSaleData(productId, { soldPriceReal, soldDateReal, status } = {}) {
  try {
    const all = this.getAllProducts();
    const idx = all.findIndex(p => String(p.id) === String(productId));
    if (idx === -1) { LogService.add('⚠️ updateSaleData: ' + productId + ' no encontrado', 'warn'); return false; }
    if (soldPriceReal != null && soldPriceReal > 0) all[idx].soldPriceReal = soldPriceReal;
    if (soldDateReal) { all[idx].soldDateReal = soldDateReal; all[idx].soldAt = soldDateReal; all[idx].soldDate = soldDateReal; }
    if (status) all[idx].status = status;
    this.saveAllProducts(all);
    LogService.add('💰 updateSaleData: ' + all[idx].title + ' → ' + soldPriceReal + '€', 'success');
    return true;
  } catch (e) { LogService.add('❌ updateSaleData error: ' + e.message, 'error'); return false; }
}
```

---

## [QA_ENGINEER] — Filtro precios negativos

`MIN_VALID_PRICE = 0.01` como constante de guarda en VintedParserService.

| Función | Filtro aplicado |
|---------|----------------|
| `parseJsonSalesCurrent` | `amount <= 0` → skip |
| `parseJsonSalesHistory` | `type=venta` con `soldPriceReal <= 0` → skip |
| `matchHistoryToInventory` | `soldPriceReal <= 0` → `filteredNegative++` |
| `mapToInventoryProduct` | `Math.max(MIN_VALID_PRICE, Math.abs(...))` |
| `mapToSaleRecord` | `Math.max(MIN_VALID_PRICE, Math.abs(...))` |
| `VintedSalesDB.saveRecords` | ventas `soldPriceReal <= 0` → intento rescate con `amount` |

---

## [MIGRATION_MANAGER] — Persistencia ante deploys

| Escenario | Datos |
|-----------|-------|
| APK nueva sin desinstalar antigua | ✅ Conservados |
| Desinstalar + instalar nueva APK | ❌ Borrados |
| OTA update (expo-updates) | ✅ Conservados |
| Primer install en dispositivo nuevo | ❌ Vacío |

**Flujo recomendado:** Ajustes → BBDD → Exportar → instalar APK → Ajustes → BBDD → Restaurar.

---

## Archivos modificados

| Archivo | Cambio principal |
|---------|----------------|
| `services/DatabaseService.js` | Fix key mes + soldAmt + 4 métodos nuevos |
| `services/VintedParserService.js` | Filtro negativos + VintedSalesDB fix + getAnnualStats |
| `screens/AdvancedStatsScreen.jsx` | Tab "📅 Por Año" completo |
| `screens/SettingsScreen.jsx` | Tab "💾 BBDD" export/import |
| `SYSTEM_DESIGN.md` | Sprint 9 docs |

---

## Git

```bash
git checkout -b feature/sprint9-annual-stats-export-db
git add services/DatabaseService.js services/VintedParserService.js
git add screens/AdvancedStatsScreen.jsx screens/SettingsScreen.jsx
git add SYSTEM_DESIGN.md
git commit -m "feat(sprint9): estadísticas anuales + filtro precios + export BBDD + fix cálculos mensuales"
git checkout main && git merge --no-ff feature/sprint9-annual-stats-export-db
```
---

## 📋 Sprint 10 — Persistencia de BBDD ante rebuilds de APK

> **Sprint 10 · Feature**
> Rama: `feature/sprint10-persistent-backup`
> Fecha: Marzo 2026

---

### [ORCHESTRATOR] Modo FULL-TEAM activado

Agentes: `[ARCHITECT]` `[MIGRATION_MANAGER]` `[QA_ENGINEER]` `[UI_SPECIALIST]` `[LIBRARIAN]`

---

### [ARCHITECT] — Problema raíz y solución

#### Problema

MMKV guarda en `/data/data/com.resellhub.app/files/mmkv/`. Este directorio:

| Situación | Datos MMKV |
|---|---|
| Instalar nueva APK sin desinstalar (EAS `--no-install`) | ✅ Se conservan |
| Instalar con `adb install -r` (replace) | ✅ Se conservan |
| Desinstalar y reinstalar | ❌ Se borran |
| Cambio de `applicationId` o firma | ❌ Se borran |
| Limpiar caché desde Ajustes del sistema | ❌ Se borran |

#### Solución — Triple capa de persistencia

```
┌─────────────────────────────────────────────────────────────────┐
│  CAPA 1: MMKV (rápida, en memoria compartida)                  │
│  /data/data/com.resellhub.app/files/mmkv/                      │
│  → Fuente principal de datos durante la sesión                 │
│  → Puede perderse al reinstalar                                │
├─────────────────────────────────────────────────────────────────┤
│  CAPA 2: FileSystem.documentDirectory (persistente) ← NUEVA    │
│  /data/data/com.resellhub.app/files/documents/                 │
│  → resellhub_auto_backup.json                                  │
│  → Se escribe con debounce 3s tras cada modificación           │
│  → Sobrevive a reinstalaciones de APK sin desinstalar          │
│  → Se restaura AUTOMÁTICAMENTE al arrancar si MMKV vacío       │
├─────────────────────────────────────────────────────────────────┤
│  CAPA 3: Share API / Google Drive (seguro externo)             │
│  → Export manual desde Ajustes → BBDD → Exportar JSON         │
│  → Copia del JSON a cualquier lugar externo al dispositivo     │
│  → Ya existía. Ahora es el último recurso, no el primero       │
└─────────────────────────────────────────────────────────────────┘
```

#### Por qué `documentDirectory` y no otro path

`FileSystem.documentDirectory` en Android apunta a:
`/data/data/<packageName>/files/documents/`

Esta carpeta **no** se borra cuando Android actualiza una APK instalada (sin desinstalar). Solo se borra si el usuario desinstala la app manualmente desde Ajustes del sistema.

---

### [MIGRATION_MANAGER] — Flujo de arranque Sprint 10

```
App.jsx monta
  │
  ├─ checkAuth() → AuthService.getToken()
  │
  ├─ BackupService.autoRestoreIfNeeded()
  │     │
  │     ├─ DatabaseService.getAllProducts().length > 0?
  │     │     └─ SÍ → MMKV tiene datos, no hacer nada → source: 'mmkv'
  │     │
  │     └─ NO → MMKV vacío
  │           │
  │           ├─ FileSystem.getInfoAsync(BACKUP_PATH).exists?
  │           │     └─ NO → sin backup previo → source: 'none'
  │           │
  │           └─ SÍ → leer JSON → parsear → importFullDatabase()
  │                 └─ restored: true, products: N, source: 'file'
  │
  └─ setIsReady(true) → app visible (con datos ya restaurados si aplica)
```

Si hay restauración, la splash screen muestra:
```
💾 Restaurando datos
✅ 47 productos restaurados desde backup
```
(visible 1.8 segundos, luego la app arranca normal)

---

### [ARCHITECT] — BackupService API

```typescript
// Nuevo servicio: services/BackupService.js
class BackupService {

  // Escribe backup a FileSystem con debounce de 3s
  // Llamado automáticamente por DatabaseService tras cada escritura
  static triggerAutoBackup(getDatabasePayload: () => object): void

  // Llamado desde App.jsx al arrancar
  // Restaura desde FileSystem si MMKV está vacío
  static autoRestoreIfNeeded(
    getProductCount: () => number,
    restorePayload: (payload: object) => object
  ): Promise<{ restored: boolean, products: number, source: 'mmkv'|'file'|'none'|'error' }>

  // Llamado desde SettingsScreen para mostrar estado
  static getBackupInfo(): Promise<{ exists, date, products, sizeKB, path }>

  // Export manual → Share API
  static exportToShare(payload: object): Promise<void>

  // Import manual desde fichero seleccionado por usuario
  static importFromFile(restorePayload: (payload) => object): Promise<{ success, products, ... }>

  // Solo para debug/reset
  static deleteAutoBackup(): Promise<boolean>
}
```

---

### [ARCHITECT] — DatabaseService: puntos de escritura con trigger

Todos los métodos de escritura a MMKV ahora llaman `_triggerBackup()` (debounced):

| Método | ¿Tenía trigger? | Sprint 10 |
|---|---|---|
| `saveConfig()` | ❌ | ✅ |
| `saveDictionary()` | ❌ | ✅ |
| `saveFullDictionary()` | ❌ | ✅ |
| `saveAllProducts()` | ❌ | ✅ |
| `importFullDatabase()` | ❌ | ✅ (al final, tras restaurar todo) |
| `clearDatabase()` | ❌ | ✅ (refleja el borrado) |

**Debounce de 3 segundos:** si se llama múltiples veces seguidas (ej: importar 50 productos en loop), solo escribe el backup una vez al final. Evita I/O excesivo.

---

### [UI_SPECIALIST] — Tab "💾 BBDD" en SettingsScreen

Nueva sección **"Auto-Backup Automático"** visible al entrar en la tab:

```
┌──────────────────────────────────────────────┐
│ 🟢 Auto-Backup Automático            [🔄]   │
│ ✅ Backup local disponible en el dispositivo │
│                                              │
│  47          5 KB       12/03/2026           │
│ Productos   Tamaño      Última vez           │
│                                              │
│  [ 💾 Guardar backup ahora ]                 │
└──────────────────────────────────────────────┘
```

- Punto verde/amarillo → indica si existe backup o no
- `[🔄]` → refresca el estado sin abrir otra tab
- Botón "Guardar backup ahora" → fuerza escritura inmediata (no espera debounce)
- La sección **"Instrucciones de deploy"** se ha eliminado — ya no es necesaria

La sección de "Seguro Externo" (Export JSON / Restaurar JSON) permanece debajo para el caso de desinstalación completa.

---

### [QA_ENGINEER] — Checklist verificación post-deploy

```
[ ] 1. Abre app → arranque normal sin crash
[ ] 2. Ajustes → BBDD → Auto-Backup muestra estado verde con fecha actual
[ ] 3. Pulsa "Guardar backup ahora" → Alert "✅ X productos guardados"
[ ] 4. Añade un producto → espera 4s → vuelve a Ajustes → BBDD → fecha actualizada
[ ] 5. Simular pérdida de datos:
       a. Ajustes → BBDD → "Guardar backup ahora"
       b. Ajustes del sistema → Borrar caché de ResellHub (o desinstalar+reinstalar)
       c. Abrir app → splash "💾 Restaurando datos"
       d. App arranca con los datos del backup ✅
[ ] 6. Export manual → seleccionar Google Drive → fichero JSON guardado
[ ] 7. Import manual → seleccionar el .json → datos restaurados
```

---

### [ARCHITECT] — Archivos Sprint 10

| Fichero | Estado | Cambio |
|---|---|---|
| `services/BackupService.js` | **NUEVO** | Servicio completo de backup persistente |
| `services/DatabaseService.js` | **ACTUALIZADO** | Import BackupService + `_triggerBackup()` helper + trigger en 6 métodos de escritura |
| `App.jsx` | **ACTUALIZADO** | `autoRestoreIfNeeded()` en useEffect de arranque + splash de restauración |
| `screens/SettingsScreen.jsx` | **ACTUALIZADO** | Tab BBDD: nueva sección Auto-Backup, delegación en BackupService |

### Ficheros NO modificados

| Fichero | Estado |
|---|---|
| `screens/DashboardScreen.jsx` | ✅ Sprint 9.2 correcto |
| `screens/SoldHistoryScreen.jsx` | ✅ Sprint 9.1 correcto |
| `screens/AdvancedStatsScreen.jsx` | ✅ Sprint 9 correcto |
| `services/VintedParserService.js` | ✅ Sin cambios |

---

### [LIBRARIAN] — MMKV Keys nuevas en Sprint 10

No se añaden nuevas MMKV keys. El backup usa `FileSystem.documentDirectory`, no MMKV.

**Fichero nuevo en FileSystem:**

| Path | Descripción |
|---|---|
| `<documentDirectory>/resellhub_auto_backup.json` | Backup automático. Mismo formato que export manual + campo `autoBackupAt` |

---

### Git Sprint 10

```bash
git checkout -b feature/sprint10-persistent-backup

git add services/BackupService.js
git add services/DatabaseService.js
git add App.jsx
git add screens/SettingsScreen.jsx
git add SYSTEM_DESIGN.md

git commit -m "feat(sprint10): backup persistente en FileSystem ante rebuilds de APK

[ARCHITECT]
- Doble capa: MMKV (rápido) + FileSystem.documentDirectory (persistente)
- BackupService: triggerAutoBackup (debounce 3s) + autoRestoreIfNeeded
- DatabaseService: _triggerBackup() en 6 puntos de escritura

[MIGRATION_MANAGER]
- App.jsx: autoRestoreIfNeeded() antes de setIsReady(true)
- Splash de restauración si se detecta MMKV vacío con backup disponible

[UI_SPECIALIST]
- SettingsScreen: nueva sección 'Auto-Backup' con estado, fecha, tamaño
- Botón 'Guardar backup ahora' para forzar escritura inmediata

Co-authored-by: [ARCHITECT] [MIGRATION_MANAGER] [QA_ENGINEER] [UI_SPECIALIST] [LIBRARIAN]"

git checkout main && git merge --no-ff feature/sprint10-persistent-backup
```


---

## 🔧 Sprint 10.1 — Fix Navegación + Actualización .mdc v4.2

> **Sprint 10.1 · Hotfix + Docs**
> Rama: `fix/sprint10-navigation-revert`
> Fecha: Marzo 2026

---

### [ORCHESTRATOR] Problema detectado

Sprint 10 entregó `App.jsx` con `LogsScreen` como Tab "Logs", **revirtiendo** la estructura de Sprint 8 que promovió `VintedImportScreen` a tab principal. Resultado: el usuario veía "Logs" en la tab inferior en lugar de "Importar".

### [QA_ENGINEER] Root Cause

El `App.jsx` entregado en Sprint 10 fue escrito desde cero sin consultar el `SYSTEM_DESIGN.md`. La fuente de verdad (Sprint 8) define:

```
Tab 6: VintedImportScreen → tabBarLabel: 'Importar', icon: 'upload-cloud'
LogsScreen: Stack.Screen name="Logs" (NO tab)
```

El código entregado tenía:
```
Tab 6: LogsScreen → tabBarLabel: 'Logs', icon: 'terminal'  ← INCORRECTO
```

### [ARCHITECT] Fix aplicado

| Fichero | Cambio |
|---|---|
| `App.jsx` | Tab 6: LogsScreen → VintedImportScreen ('Importar' / 'upload-cloud') |
| `App.jsx` | Stack.Screen name="Logs" → LogsScreen (accesible desde Settings) |
| `App.jsx` | Comentarios actualizados con la estructura canónica |

### [LIBRARIAN] — .mdc actualizado: resellhub_v4.2.mdc

Nuevo fichero `.cursor/rules/resellhub_v4.2.mdc` (reemplaza v4.1):

| Regla nueva | Descripción |
|---|---|
| Regla 11 | Navegación canónica — 6 tabs, tab 6 = "Importar" → VintedImportScreen. LogsScreen NUNCA es tab. |
| Regla 12 | React Rules of Hooks — hooks ANTES de early returns. Violación = crash. |
| Regla 13 | Contratos de API — actualizar todos los consumidores en el mismo sprint. |
| Regla 14 | KPIs canónicos Sprint 9.1 — campos eliminados listados para evitar regresiones. |
| Regla 15 | Persistencia Sprint 10 — doble capa MMKV + FileSystem. |
| Regla 16 | Design System canónico Light DS documentado con colores exactos. |
| Regla 17 | VintedImportScreen modos A/B/C/D/E documentados. |

### [QA_ENGINEER] Verificación

```
grep "Tab.Screen" App.jsx | wc -l → 6 ✅
grep "VintedImportScreen" App.jsx → Tab "Import" label "Importar" ✅
grep "LogsScreen" App.jsx → Stack.Screen name="Logs" ✅
grep "tabBarLabel.*Logs" App.jsx → 0 resultados ✅
```

### Git Sprint 10.1

```bash
git checkout -b fix/sprint10-navigation-revert

git add App.jsx
git add .cursor/rules/resellhub_v4.2.mdc
git add SYSTEM_DESIGN.md

git commit -m "fix(sprint10.1): restaurar tab Importar + mdc v4.2

[QA_ENGINEER]
- App.jsx: Sprint 10 entregó tab 'Logs'→LogsScreen revirtiendo Sprint 8
  Root cause: App.jsx reescrito sin consultar SYSTEM_DESIGN.md
  Fix: tab 6 = VintedImportScreen ('Importar' / 'upload-cloud')
       LogsScreen como Stack.Screen name='Logs'

[LIBRARIAN]
- resellhub_v4.2.mdc: 7 reglas nuevas para prevenir regresiones futuras
  - Regla 11: navegación canónica de tabs (hierro)
  - Regla 12: React Rules of Hooks (hierro)
  - Regla 13: contratos de API + consumidores
  - Regla 14: KPIs canónicos Sprint 9.1
  - Regla 15: persistencia MMKV+FileSystem Sprint 10
  - Regla 16: Design System Light DS colores
  - Regla 17: VintedImportScreen modos A/B/C/D/E

Co-authored-by: [QA_ENGINEER] [ARCHITECT] [LIBRARIAN]"

git checkout main && git merge --no-ff fix/sprint10-navigation-revert
```

## 📋 Sprint 11 — Migración a Claude Projects + CLAUDE.md

> **Sprint 11 · Infraestructura de Agentes**
> Rama: `feature/sprint11-claude-projects-migration`
> Fecha: Marzo 2026

---

### [ORCHESTRATOR] — Análisis

```
TAREA:        Migrar sistema multiagente de Cursor a Claude Projects
TIPO:         DOCS + INFRAESTRUCTURA
COMPLEJIDAD:  MEDIA
MODO:         PAIR — [AI_ARCHITECT] + [LIBRARIAN]
PRIORIDAD:    ALTA
```

---

### [AI_ARCHITECT] — Cambio de metodología

A partir de este sprint el sistema multiagente opera desde **Claude Projects** (claude.ai)
en lugar de Cursor IDE exclusivamente. Ambos sistemas son compatibles y complementarios:

| Herramienta | Uso |
|-------------|-----|
| **Claude Projects** | Conversaciones de análisis, planificación de sprints, documentación, generación de ficheros |
| **Cursor IDE** | Edición directa de código con `resellhub_v4.2.mdc` activo |
| **Claude Code** | CLI para tareas automatizadas y agentic coding |

### Nuevo fichero: `CLAUDE.md`

Creado en la raíz del proyecto. Es el equivalente de `resellhub_v4.2.mdc` para Claude Projects.
Contiene: protocolo [ORCHESTRATOR], las 7 reglas de hierro, mapa de ficheros, estado Sprint 10.1,
directorio de agentes, changelog completo y checklist pre-entrega.

### Nueva skill: `SYS-003-claude_projects_integration`

Añadida a `.claude/skills/`. Define:
- Protocolo de lectura al iniciar sesión
- Diferencias Cursor vs Claude Projects
- Cómo referenciar ficheros del project knowledge
- Auto-diagnóstico de contexto

### [LIBRARIAN] — Ficheros generados/modificados

| Fichero | Tipo | Cambio |
|---------|------|--------|
| `CLAUDE.md` | **NUEVO** | Fichero de entrada para Claude Projects/Code |
| `.claude/skills/SYS-003-claude_projects_integration.md` | **NUEVO** | Skill de integración Claude |
| `skills.json` | **PATCH** | Añadir SYS-003 al catálogo del AI_ARCHITECT |
| `SYSTEM_DESIGN.md` | Actualizado | Sprint 11 añadido |

### Parche skills.json — añadir bajo `AI_ARCHITECT.skills`:

```json
{
  "id": "SYS-003",
  "name": "claude_projects_integration",
  "description": "Protocolo de operación de Claude en Projects/Code. Define orden de lectura de ficheros, activación de agentes y diferencias con Cursor IDE.",
  "trigger": "Primera petición de cada sesión en Claude Projects o Claude Code",
  "output": "Cabecera [ORCHESTRATOR] + agentes activados + confirmación de contexto leído"
}
```

### Git Workflow — Sprint 11

```bash
git checkout -b feature/sprint11-claude-projects-migration

git add CLAUDE.md
git add .claude/skills/SYS-003-claude_projects_integration.md
git add skills.json
git add SYSTEM_DESIGN.md

git commit -m "feat(sprint11): CLAUDE.md + SYS-003 skill + migración a Claude Projects

[AI_ARCHITECT]
- CLAUDE.md: fichero de entrada canónico para Claude Projects/Code
  Contiene: protocolo ORCHESTRATOR, 7 reglas de hierro, estado Sprint 10.1,
  directorio agentes, changelog sprints 1-10, checklist pre-entrega
- SYS-003-claude_projects_integration.md: skill nueva en .claude/skills/
  Define protocolo lectura, diferencias Cursor vs Projects, auto-diagnóstico
- skills.json: SYS-003 añadida al catálogo AI_ARCHITECT

[LIBRARIAN]
- SYSTEM_DESIGN.md: Sprint 11 documentado
- Compatibilidad total: Cursor (.mdc) y Claude Projects (CLAUDE.md) coexisten

Co-authored-by: [AI_ARCHITECT] [LIBRARIAN]"

git checkout main && git merge --no-ff feature/sprint11-claude-projects-migration
```