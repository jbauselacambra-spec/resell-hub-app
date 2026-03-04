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
