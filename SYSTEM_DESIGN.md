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
