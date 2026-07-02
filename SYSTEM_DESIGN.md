# SYSTEM DESIGN — ResellHub v4.3 · Sprint 14
> Fuente única de verdad. Última actualización: Junio 2026

---

## 1. REGLAS DE HIERRO (9)

| # | Regla | Consecuencia si se viola |
|---|-------|--------------------------|
| 1 | `SYSTEM_DESIGN.md` es la única fuente de verdad | Regresión de arquitectura |
| 2 | Los 7 Campos Sagrados son INMUTABLES en imports | Corrupción de datos |
| 3 | Hooks SIEMPRE antes de early returns | Crash React invariant |
| 4 | Tab 6 = VintedImportScreen · LogsScreen = Stack.Screen | UX rota |
| 5 | `_triggerBackup()` tras CADA escritura MMKV | Pérdida de datos |
| 6 | `seoTags` eliminado desde v2.1 — nunca reintroducir | Regresión |
| 7 | Todo trabajo pasa por [ORCHESTRATOR] | Inconsistencia |
| 8 | SIEMPRE archivos COMPLETOS — nunca fragmentos | Typos fatales (ej: `seEffect`) |
| 9 | Handlers con estado anidado → `useRef` mirror | Stale closure silencioso |

---

## 2. LOS 7 CAMPOS SAGRADOS

**NUNCA sobreescribir en `importFromVinted()` ni ningún proceso automático.**

```js
const MANUAL_FIELDS_ACTIVE = ['category', 'subcategory', 'firstUploadDate', 'title', 'brand'];
const MANUAL_FIELDS_SOLD   = ['soldPriceReal', 'soldDateReal', 'isBundle', 'category', 'subcategory', 'firstUploadDate', 'title', 'brand'];
```

| # | Campo | Tipo | Notas |
|---|-------|------|-------|
| 1 | `firstUploadDate` | ISO String | Fecha real de subida a Vinted |
| 2 | `category` | String | Categoría del diccionario |
| 3 | `title` | String | Título curado |
| 4 | `brand` | String | Marca curada |
| 5 | `soldPriceReal` | Number? | Precio real de venta — solo `updateSaleData()` puede tocarlo si el producto no tenía valor |
| 6 | `soldDateReal` | ISO String? | Fecha real de cierre — idem |
| 7 | `isBundle` | Boolean | Init: `false`. Solo editable en `SoldEditDetailView` |

---

## 3. STACK TÉCNICO

- **Framework:** React Native 0.76 + Expo SDK 52 (bare workflow)
- **Storage:** react-native-mmkv + FileSystem (doble capa)
- **Dispositivo:** Poco X7 Pro · Android 14 · 393dp · 120Hz
- **Bundle ID:** `com.perdigon85.resellhub`
- **Build:** `agent-deploy.ps1 v5.3` + EAS CLI

---

## 4. NAVEGACIÓN CANÓNICA (App.jsx)

```
Tab 1: Inicio     → DashboardScreen
Tab 2: Inventario → ProductsScreen
Tab 3: Vendidos   → SoldHistoryScreen
Tab 4: Stats      → AdvancedStatsScreen
Tab 5: Config     → SettingsScreen
Tab 6: Importar   → VintedImportScreen       ← NUNCA cambiar a LogsScreen

Stack (no tabs):
  name="ProductDetail"    → ProductDetailScreen
  name="SoldEditDetail"   → SoldEditDetailView
  name="Logs"             → LogsScreen         ← NUNCA como Tab
  name="Deduplication"    → DeduplicationScreen
  name="Intelligence"     → BusinessIntelligenceScreen

tabBarStyle: backgroundColor '#FFFFFF', borderTopColor '#EAEDF0'
```

**Verificación:**
```bash
grep -c "Tab.Screen" App.jsx          # → 6
grep "VintedImportScreen" App.jsx     # → tab label "Importar"
grep "LogsScreen" App.jsx             # → solo en Stack.Screen name="Logs"
grep "autoRestoreIfNeeded" App.jsx    # → debe aparecer ANTES de setIsReady(true)
```

---

## 5. MODELO DE DATOS

```js
{
  // Actualizables en import:
  id, price, description, images: String[],
  status: 'available'|'sold'|'active',
  views, favorites, createdAt,

  // LOS 7 SAGRADOS — nunca tocar en imports:
  firstUploadDate, category, title, brand,
  soldPriceReal, soldDateReal, isBundle,

  // Legacy (fallback solo lectura):
  // soldPrice, soldDate

  // Sistema:
  subcategory, priceHistory: [{oldPrice,newPrice,date,source}],
  repostOf, repostTo, repostCount, lastRepostDate,
  stale, staleDetectedAt, lastSync, lastActivity,
}
```

---

## 6. DESIGN SYSTEM v2 — theme.js

**Todas las pantallas importan desde `'../theme'`. Sin DS local.**

```js
import { DS, SPACE, RADIUS, SHADOW, TXT, BTN, BTN_TEXT, CARD,
  LAYOUT, FONT_SIZE, FONT_FAMILY, MONTH_NAMES, MONTH_NAMES_SHORT,
  ttsColor, ttsEmoji, fmtPrice, fmtDate, fmtDateLong } from '../theme';
```

### Paleta DS v2

```js
export const DS = {
  brand:        '#FF4F1A',              brandDim:   'rgba(255,79,26,0.10)',
  brandMid:     'rgba(255,79,26,0.18)', brandLight: '#FFF2EE',
  white:        '#FFFFFF',  surface:    '#FFFFFF',
  surface2:     '#F6F5F3',  surface3:   '#EFEDE9',
  border:       'rgba(0,0,0,0.07)',     borderMed:  'rgba(0,0,0,0.12)',
  borderStrong: 'rgba(0,0,0,0.20)',
  text:         '#0F0E0D',  text2:      '#5A5752',  text3: '#A09C97',
  success:      '#1A9E6E',  successLight:'#E8F7F2', successDim:'rgba(26,158,110,0.10)',
  warning:      '#D4820A',  warningLight:'#FEF3E2', warningDim:'rgba(212,130,10,0.10)',
  danger:       '#D63B3B',  dangerLight: '#FDEAEA', dangerDim: 'rgba(214,59,59,0.10)',
  blue:         '#1A68D4',  blueLight:   '#E8F1FD', blueDim:   'rgba(26,104,212,0.10)',
  purple:       '#7248D4',  purpleLight: '#F0EAFF', purpleDim: 'rgba(114,72,212,0.10)',
};
```

### Cambios de paleta v1 → v2

| Token | v1 (antes) | v2 (ahora) |
|-------|-----------|-----------|
| `brand` | `#FF6B35` | `#FF4F1A` |
| `surface2` | `#F8F9FA` | `#F6F5F3` |
| `success` | `#00D9A3` | `#1A9E6E` |
| `warning` | `#FFB800` | `#D4820A` |
| `danger` | `#E63946` | `#D63B3B` |
| `blue` | `#004E89` | `#1A68D4` |

### Tokens adicionales

```js
SPACE  = { 1:4, 2:8, 3:12, 4:16, 5:20, 6:24, 8:32, 10:40, 12:48, 16:64 }
RADIUS = { sm:8, md:12, lg:18, xl:24, full:999 }
FONT_FAMILY = { body: Platform.select({ios:'System', android:'sans-serif'}),
                mono: Platform.select({ios:'Menlo', android:'monospace'}) }
FONT_SIZE = { xs:10, sm:12, base:14, md:16, lg:18, xl:20, '2xl':24, '3xl':28, '4xl':34 }
```

### Helpers

```js
ttsColor(tts, config)   // → DS.success | DS.warning | DS.danger
ttsEmoji(tts, config)   // → '⚡' | '🟡' | '⚓'
fmtPrice(value)         // → "89€" o "89,50€"
fmtDate(iso)            // → "12 abr 2026"
fmtDateLong(iso)        // → "12 de abril de 2026"
```

---

## 7. MAPA DE FICHEROS

### Servicios

| Fichero | Descripción |
|---------|-------------|
| `services/DatabaseService.js` | CRÍTICO — toda la lógica de datos |
| `services/VintedParserService.js` | Parsers + VintedSalesDB + matchHistoryToInventory |
| `services/BackupService.js` | Backup FileSystem doble capa |
| `services/IntelligenceService.js` | Motor BI Bayesian Blend |
| `services/LogService.js` | Logging global |
| `services/AIService.js` | GPT-4o análisis productos |
| `services/ImageProcessingService.js` | Anti-hash, galería, cámara |
| `services/NotificationService.js` | Notificaciones locales |
| `services/authService.js` | Token MMKV |

### Pantallas

| Fichero | Tab/Stack | Último sprint |
|---------|-----------|---------------|
| `screens/DashboardScreen.jsx` | Tab 1 | S14 |
| `screens/ProductsScreen.jsx` | Tab 2 | S14 |
| `screens/SoldHistoryScreen.jsx` | Tab 3 | S14 |
| `screens/AdvancedStatsScreen.jsx` | Tab 4 | S14 |
| `screens/SettingsScreen.jsx` | Tab 5 | S14 |
| `screens/VintedImportScreen.jsx` | Tab 6 | S14 |
| `screens/ProductDetailScreen.jsx` | Stack | S14 |
| `screens/SoldEditDetailView.jsx` | Stack | S14 |
| `screens/DeduplicationScreen.jsx` | Stack | S14 NUEVO |
| `screens/BusinessIntelligenceScreen.jsx` | Stack | S14 NUEVO |
| `screens/LogsScreen.jsx` | Stack | S14 |
| `screens/DebugScreen.jsx` | Stack | S14 |

### Raíz

| Fichero | Descripción |
|---------|-------------|
| `App.jsx` | Navegación + auth + splash + autoRestore |
| `theme.js` | Design System v2 — única fuente visual |
| `agent-deploy.ps1 v5.3` | Deploy Windows |
| `CLAUDE.md` | Instrucciones Claude Projects |
| `.claude/RULES.md` | Reglas maestras agentes |
| `resellhub_v4.2.mdc` | Reglas Cursor IDE |
| `eas.json` / `app.json` | Config EAS/Expo |

---

## 8. MMKV KEYS

| Key | Instancia | Propietario | Sagrado |
|-----|-----------|-------------|---------|
| `products` | `storage` (default) | DatabaseService | — |
| `app_user_config` | `storage` | DatabaseService | — |
| `app_pin` | `storage` | AuthService | ✅ |
| `app_password` | `storage` | AuthService | ✅ |
| `session_authed_until` | `storage` | AuthService | ✅ |
| `custom_dictionary` | `storage` | DatabaseService | — |
| `custom_dictionary_full` | `storage` | DatabaseService | — |
| `import_log` | `storage` | DatabaseService | — |
| `emergency_backup` | `new MMKV({id:'backup-storage'})` | LogsScreen | ✅ |
| `schema_version` | `storage` | Migration | ✅ |
| `vinted_sales_history` | `new MMKV({id:'vinted-parser'})` | VintedSalesDB | — |

**FileSystem (doble capa):**
```
<documentDirectory>/resellhub_auto_backup.json
→ Backup automático debounce 3s tras cada escritura MMKV
→ Restaurado en App.jsx si MMKV vacío al arrancar
```

---

## 9. DATABASE SERVICE — API

### Métodos de datos

```js
// Productos
getAllProducts()                          → Product[]
saveAllProducts(arr)                      → void  [→_triggerBackup]
importFromVinted(products)                → {created, updated, skipped}
deleteProduct(id)                         → void
markAsSold(id, soldPriceReal, soldDateReal, isBundle)  → void
updateSaleData(id, {soldPriceReal, soldDateReal, status})  → bool  // bypass MANUAL_FIELDS
updateProductSmart(id, updates)           → void

// Config y diccionarios
getConfig()                              → Config
saveConfig(config)                       → void  [→_triggerBackup]
getDictionary()                          → Dict
saveDictionary(dict)                     → void  [→_triggerBackup]
getFullDictionary()                      → FullDict
saveFullDictionary(dict)                 → void  [→_triggerBackup]
autoRegisterCategories(newCats)          → void

// Estadísticas
getBusinessKPIs()                        → KPIs
getCategoryStats()                       → CatStats
getMonthlyHistory()                      → MonthData[]  // ⚠️ getMonth()+1
getAnnualHistory()                       → YearData[]
getSmartAlerts()                         → Alert[]
getSmartInsights()                       → Insight[]
getActiveProductsWithDiagnostic()        → Product[]

// Export/Import
exportFullDatabase()                     → Payload  // excluye PIN/password
importFullDatabase(payload)              → {products, salesRecords, configRestored, errors}
clearDatabase()                          → void  [→_triggerBackup]
```

### Contrato getBusinessKPIs() — KPIs canónicos (Sprint 9.1)

```js
// ✅ CAMPOS VÁLIDOS:
{ totalRecaudacion, recaudacionThisMonth, rotacion, avgPrecioVenta,
  soldCount, activeCount, staleCount, soldThisMonth,
  avgTTS, totalViews, totalFavorites,
  bestCat, worstCat, topSubcategory }

// ❌ CAMPOS ELIMINADOS — nunca usar:
// totalProfit, avgProfit, totalRevenue, revenueThisMonth
```

**Guard obligatorio en UI:**
```js
// ✅ CORRECTO:
(kpis?.totalRecaudacion ?? 0).toFixed(0)
// ❌ CRASH:
kpis.totalRecaudacion.toFixed(0)
```

### DEFAULT_CONFIG completo

```js
{
  ttsLightning:'7', ttsAnchor:'30', priceBoostPct:'10', priceCutPct:'10',
  daysInvisible:'60', viewsInvisible:'20', daysDesinterest:'45',
  daysCritical:'90', staleMultiplier:'1.5', criticalMonthThreshold:'6',
  hotViews:'50', hotFavs:'10', hotDays:'30',
  daysAlmostReady:'30', favsAlmostReady:'8',
  opportunityFavs:'8', opportunityDays:'20',
  autoDetectCategory: false, defaultImportCategory:'Otros',
  notifRepost: false, notifStale: false,
  seasonalMap: { 0:[],1:[],2:[],3:[],4:[],5:[],6:[],7:[],8:[],9:[],10:[],11:[] },
}
```

---

## 10. MOTOR TTS

```js
// calcTTS(product):
if (!product.soldDateReal) return null;   // nunca contamina estadísticas
const start = product.firstUploadDate || product.createdAt;
return daysBetween(start, product.soldDateReal);

// ttsLabel(tts, config):
// ≤ ttsLightning (7d)  → ⚡ RELÁMPAGO → +priceBoostPct%
// ≤ ttsAnchor   (30d)  → 🟡 NORMAL
// >  ttsAnchor  (30d)  → ⚓ ANCLA     → -priceCutPct%
```

---

## 11. VINTED IMPORT — Modos C/D/E

```
Fichero JSON adjunto (DocumentPicker)
  → detectContentType()
      ├── json_products        → MODO C: parseJsonProducts()
      │     → importFromVinted()
      ├── json_sales_current   → MODO D: parseJsonSalesCurrent()
      │     → matchHistoryToInventory(items, soldDateReal)
      └── json_sales_history   → MODO E: parseJsonSalesHistory()
            → VintedSalesDB.saveRecords()
            → matchHistoryToInventory(ventas)
```

**Scripts de consola:**
- `scriptEscaparate.js` → página escaparate → json_products (Modo C)
- `scriptVentasActuales.js` → `/my-orders/sold` → json_sales_current (Modo D)
- `scriptHistorialVentas.js` → `/balance` → json_sales_history (Modo E)

**Handlers correctos en VintedImportScreen:**
```js
// Modo C — importar inventario
handleConfirmC: DatabaseService.importFromVinted(selected)

// Modo D — ventas año actual
handleConfirmD: matchHistoryToInventory(selected, soldDateReal)

// Modo E — historial completo
handleConfirmE: VintedSalesDB.saveRecords(selected)
              + matchHistoryToInventory(selected.filter(i=>i.type==='venta'))
```

**matchHistoryToInventory — protección campos sagrados:**
```
firstUploadDate → NUNCA toca
category, title, brand → NUNCA toca
soldPriceReal → solo si producto.soldPriceReal es null/0
soldDateReal  → solo si producto.soldDateReal es null
isBundle      → NUNCA toca
```

**VintedSalesDB:**
```js
VintedSalesDB.saveRecords(records)   // dedup por orderId
VintedSalesDB.getAllRecords()
VintedSalesDB.getStats()             // agrupado por mes con soldDateReal||date
```

**Bug crítico corregido:** `getMonth()` en `VintedSalesDB.getStats()` necesita `+1`.

---

## 12. BACKUP SERVICE — API

```js
BackupService.triggerAutoBackup(getDatabasePayload)  // debounce 3s
BackupService.autoRestoreIfNeeded(getProductCount, restorePayload)
  // → {restored:bool, products:N, source:'mmkv'|'file'|'none'|'error'}
BackupService.getBackupInfo()
  // → {exists, date, products, sizeKB, path}
BackupService.exportToShare(payload)    // expo-sharing (no Share.share — truncado Android 13+)
BackupService.importFromFile(restorePayload)
  // → {success, products, salesRecords, configRestored, errors}
BackupService.deleteAutoBackup()
```

**CRÍTICO:** `exportToShare` debe usar `expo-sharing + Sharing.shareAsync(uri)`, no `Share.share({message})`. En Android 13+ con >200KB el intent trunca silenciosamente.

---

## 13. INTELIGENCIA SERVICE — API

```js
IntelligenceService.getCategoryAnalysis()        // análisis + score oportunidad
IntelligenceService.getPriceRecommendation(prod) // precio óptimo con justificación
IntelligenceService.getPublishWindowStatus(cat)  // ventana óptima ahora
IntelligenceService.getProductOpportunities()    // ranking activos por score 0-100
IntelligenceService.getPersonalLearnings()       // insights narrativos
IntelligenceService.getCategoryComparisonData()  // personal vs mercado
IntelligenceService.getMonthlyTrendData()        // historial mensual + benchmark
IntelligenceService.generateFullIntelligence()   // async — orquesta todo
```

**Bayesian Blend:** `alpha=0.3` → 30% global / 70% personal (cuando ≥10 ventas)

**Benchmarks Vinted España:**

| Categoría | TTS | Precio | Demanda |
|-----------|-----|--------|---------|
| Videojuegos | 8d | 18€ | 0.88 |
| Calzado | 10d | 14€ | 0.85 |
| Ropa Niño | 12d | 6€ | 0.82 |
| Ropa Mujer | 16d | 9€ | 0.80 |
| Juguetes | 15d | 8€ | 0.78 |
| Electrónica | 18d | 25€ | 0.72 |
| Disfraces | 9d | 10€ | 0.65 |
| Libros | 22d | 4€ | 0.60 |
| Hogar | 25d | 12€ | 0.58 |

---

## 14. PANTALLAS — PATRONES CRÍTICOS

### SettingsScreen — Regla 9 (stale closure)

```js
// OBLIGATORIO para el diccionario:
const dictionaryRef = useRef({});
const [dictionary, setDictionary] = useState({});

const updateDictionary = useCallback((updater) => {
  if (typeof updater === 'function') {
    setDictionary(prev => {
      const next = updater(prev);
      dictionaryRef.current = next;  // siempre fresco
      return next;
    });
  } else {
    dictionaryRef.current = updater;
    setDictionary(updater);
  }
}, []);

// Handler lee del REF:
const handleSaveDictionary = () => {
  DatabaseService.saveFullDictionary(dictionaryRef.current);  // ← ref, nunca closure
};
```

**Anti-patrón a evitar:**
```js
❌ DatabaseService.saveFullDictionary(dictionary);  // stale closure
❌ new MMKV().set('custom_dictionary_full', ...)    // instancia distinta = datos perdidos
✅ DatabaseService.saveFullDictionary(dictionaryRef.current)
```

### ProductDetailScreen / SoldEditDetailView — Regla 12 (useEffect scope)

```js
// CatModal / CategoryModal — useEffect DENTRO del componente:
function CatModal({ visible, currentCat, ... }) {
  const [dict, setDict] = useState(() => loadDictionaryWithFallbacks());

  React.useEffect(() => {        // ← 2 espacios: DENTRO del componente
    if (!visible) return;
    setDict(loadDictionaryWithFallbacks());
  }, [visible, currentCat]);    // ← si está a 0 espacios → bug silencioso
```

### Patrón loadDictionaryWithFallbacks

```js
function loadDictionaryWithFallbacks() {
  const full = DatabaseService.getFullDictionary();
  if (full && Object.keys(full).length > 0) return full;
  const legacy = DatabaseService.getDictionary();
  if (legacy && Object.keys(legacy).length > 0) {
    const normalized = {};
    Object.entries(legacy).forEach(([cat, val]) => {
      normalized[cat] = Array.isArray(val)
        ? { tags: val, subcategories: {} }
        : { tags: val?.tags || [], subcategories: val?.subcategories || {} };
    });
    return normalized;
  }
  return {};
}
```

### Config — Patrón canónico

```js
// ✅ Pantallas con reload en foco (Dashboard, Products, SoldHistory, AdvancedStats):
const [config, setConfig] = useState(() => DatabaseService.getConfig());
// Refrescar en foco:
useFocusEffect(() => setConfig(DatabaseService.getConfig()));

// ✅ Componentes de edición (SoldEditDetail, ProductDetail):
const cfg = DatabaseService.getConfig();

// ❌ NUNCA:
const [config, setConfig] = useState(null);  // crash antes del useEffect
```

### LogsScreen — Backup correcto

```js
// CORRECTO — instancia específica:
const backupStorage = new MMKV({ id: 'backup-storage' });
backupStorage.set('emergency_backup', JSON.stringify(data));
backupStorage.getString('emergency_backup');

// INCORRECTO — métodos inexistentes en DatabaseService:
❌ DatabaseService.backupData()
❌ DatabaseService.recoverData()
❌ DatabaseService.resetAll()
```

### SoldHistoryScreen — Imágenes

```js
// CORRECTO:
source={{ uri: p.images?.[0] || p.thumbnail || p.image }}
// + TouchableOpacity a nivel tarjeta (no View)

// INCORRECTO (campos inexistentes en schema):
source={{ uri: p.thumbnail || p.image }}
```

### ProductsScreen — useMemo correcto

```js
// CORRECTO (Hotfix3 — dead code eliminado):
const filtered = useMemo(() => {
  let arr = products;
  if (filter === 'hot')           arr = arr.filter(p => p.isHot);
  else if (filter === 'stagnant') arr = arr.filter(p => p.isCold || p.isCritical);
  else if (filter === 'critical') arr = arr.filter(p => p.severity?.type === 'CRÍTICO');
  if (filterCat) arr = arr.filter(p => p.category === filterCat);
  if (filterSub) arr = arr.filter(p => p.subcategory === filterSub);
  return arr;
}, [products, filter, filterCat, filterSub, sortBy]);
```

---

## 15. DEDUPLICATION SCREEN

```js
// Detectar grupos duplicados:
function findDuplicateGroups(products) {
  const normTitle = t => (t||'').toLowerCase().replace(/[^\w\s]/g,' ').replace(/\s+/g,' ').trim();
  const map = {};
  products.forEach(p => {
    const k = normTitle(p.title);
    if (!map[k]) map[k] = [];
    map[k].push(p);
  });
  return Object.values(map).filter(g => g.length > 1);
}

// Detectar repostOf corruptos:
function findCorruptRepostOf(products) {
  const ids = new Set(products.map(p => String(p.id)));
  return products.filter(p => p.repostOf && !ids.has(String(p.repostOf)));
}
```

**Regla de conservación:** `status==='sold'` > `firstUploadDate` más antiguo.
**Los 7 Sagrados del producto conservado nunca se tocan.**

---

## 16. FLUJOS PRINCIPALES

### Arranque App
```
App.jsx mount
→ checkAuth()
→ BackupService.autoRestoreIfNeeded()   ← ANTES de setIsReady(true)
→ setIsReady(true)
```

### Venta
```
ProductDetailScreen → [Vendido] → SoldModal (precio + fecha)
→ DatabaseService.markAsSold(id, soldPriceReal, soldDateReal, false)
→ _triggerBackup()
→ navigate('SoldHistory')
```

### Import Vinted
```
VintedImportScreen → DocumentPicker → FileSystem.readAsStringAsync
→ detectContentType → parser correspondiente
→ Preview + checkboxes → ConfirmModal
→ handleConfirmC/D/E → _triggerBackup → LogService
```

### Business Intelligence
```
AdvancedStatsScreen → botón [BI] → navigate('Intelligence')
→ IntelligenceService.generateFullIntelligence()
→ 5 tabs: Aprendizajes / Oportunidades / Comparativa / Tendencias / Categorías
```

---

## 17. BUGS CRÍTICOS DOCUMENTADOS (corregidos en sus sprints)

| # | Fichero | Bug | Sprint fix |
|---|---------|-----|------------|
| B1 | `DatabaseService.js` | `getMonth()` sin `+1` → estadísticas mensuales rotas | S9 |
| B2 | `VintedImportScreen.jsx` | `getInventory/saveInventory/bulkInsert` → TypeError | S14 |
| B3 | `SettingsScreen.jsx` | `new MMKV()` directo → dict no persiste | Hotfix5 |
| B4 | `SettingsScreen.jsx` | Sin `dictionaryRef` → stale closure → subcategorías perdidas | S13b |
| B5 | `ProductDetailScreen.jsx` | `CatModal.useEffect` fuera del componente | S12 |
| B6 | `SoldEditDetailView.jsx` | `CategoryModal.useEffect` fuera del componente | S12 |
| B7 | `SoldHistoryScreen.jsx` | `p.thumbnail/p.image` → sin imágenes + tarjeta inerte | Hotfix5 |
| B8 | `VintedParserService.js` | `matchHistoryToInventory` usaba `updateProduct` en vez de `updateSaleData` | S8fix |
| B9 | `LogsScreen.jsx` | `DatabaseService.backupData/recoverData/resetAll` no existen | S8fix |
| B10 | `DashboardScreen.jsx` | `kpis.totalRevenue` eliminado → undefined | S9.2 |
| B11 | `BackupService.js` | `Share.share` truncado Android 13+ >200KB | Hotfix5 |
| B12 | `ProductsScreen.jsx` | Dead code en useMemo → `filterCat` nunca aplicaba | Hotfix3 |
| B13 | `SettingsScreen.jsx` | Typo `seEffect` → dict no carga → subcategorías invisibles | S13 |

---

## 18. SCRIPT DE VERIFICACIÓN RÁPIDA

```bash
# B1: Bug mes 0-based
grep -n "getMonth()" services/DatabaseService.js | grep -v "+1"
# → vacío = OK

# B2: Métodos inexistentes VintedImportScreen
grep -n "getInventory\|saveInventory\|bulkInsert" screens/VintedImportScreen.jsx
# → vacío = OK

# B3/B4: SettingsScreen MMKV y ref
grep -n "new MMKV()" screens/SettingsScreen.jsx         # → vacío = OK
grep -n "dictionaryRef" screens/SettingsScreen.jsx      # → debe aparecer

# B5/B6: useEffect en modales
grep -n "seEffect" screens/ProductDetailScreen.jsx screens/SoldEditDetailView.jsx
# → vacío = OK

# B7: Imágenes SoldHistoryScreen
grep -n "p\.thumbnail\b" screens/SoldHistoryScreen.jsx  # → solo como fallback

# B8: updateSaleData en matchHistory
grep -n "updateProduct\b" services/VintedParserService.js  # → vacío = OK
grep -n "updateSaleData" services/VintedParserService.js   # → debe aparecer

# B9: LogsScreen métodos inexistentes
grep -n "backupData\|recoverData\|resetAll" screens/LogsScreen.jsx  # → vacío = OK

# B10: KPIs eliminados
grep -rn "totalRevenue\|totalProfit\|revenueThisMonth" screens/  # → vacío = OK

# B11: BackupService export
grep -n "shareAsync\|Share\.share" services/BackupService.js
# → shareAsync debe ser el método principal

# B12: Dead code filterCat
grep -n "return products" screens/ProductsScreen.jsx    # → no debe estar antes de filterCat

# B13: Typo seEffect
grep -rn "\.seEffect" screens/  # → vacío = OK

# Navegación canónica
grep -c "Tab.Screen" App.jsx                            # → 6
grep "tabBarLabel.*Importar" App.jsx                   # → debe aparecer
grep -c "Stack.Screen.*Logs\|name=\"Logs\"" App.jsx    # → debe aparecer

# _triggerBackup en escrituras
grep -n "_triggerBackup" services/DatabaseService.js   # → ≥6 apariciones

# DS local en pantallas (debe ser 0 — todos importan de '../theme')
grep -rn "const DS = {" screens/                       # → vacío = OK

# Sprint 14 nuevos archivos
ls services/IntelligenceService.js screens/BusinessIntelligenceScreen.jsx screens/DeduplicationScreen.jsx theme.js 2>&1
```

---

## 19. CHECKLIST PRE-ENTREGA

```
[ ] 6 Tab.Screen en App.jsx — Tab 6 = VintedImportScreen "Importar"
[ ] LogsScreen = Stack.Screen "Logs" únicamente
[ ] Stack.Screen "Intelligence" y "Deduplication" registrados
[ ] autoRestoreIfNeeded() ANTES de setIsReady(true)
[ ] Todos los hooks antes de early returns (Regla 3)
[ ] Guards (??0) en todos los .toFixed() sobre KPIs (Regla 14)
[ ] _triggerBackup() en los 6 métodos de escritura DatabaseService (Regla 5)
[ ] dictionaryRef + updateDictionary en SettingsScreen (Regla 9)
[ ] useEffect DENTRO de CatModal y CategoryModal (Sprint 12)
[ ] DatabaseService.saveFullDictionary() — nunca new MMKV() directo (Hotfix5)
[ ] handleConfirmC/D/E usan métodos correctos (Sprint 14)
[ ] p.images?.[0] en SoldHistoryScreen + TouchableOpacity (Hotfix5)
[ ] getMonth()+1 en getMonthlyHistory (Sprint 9)
[ ] KPIs eliminados no referenciados: totalRevenue, totalProfit (Sprint 9.1)
[ ] Todas las pantallas importan DS de '../theme' (Sprint 14)
[ ] Sin DS locales en screens/ (Sprint 14)
[ ] Sin seEffect typos (Sprint 13)
[ ] Archivos entregados COMPLETOS — nunca fragmentos (Regla 8)
[ ] SYSTEM_DESIGN.md actualizado con el sprint entregado
```

---

## 20. HISTORIAL DE SPRINTS (referencia)

| Sprint | Descripción | Archivos clave |
|--------|-------------|---------------|
| S1 v4.2 | 7 Campos Sagrados + soldPriceReal modal | DatabaseService, ProductDetailScreen |
| S2+S3 | Categorías globales + DEFAULT_CONFIG +7 params | DatabaseService, todas las pantallas |
| S4 | Light DS + CalPicker + SoldEditDetailView rewrite | SoldEditDetailView, DashboardScreen |
| S5 | VintedParserService + VintedImportScreen (clipboard) | VintedParserService, VintedImportScreen |
| S6 | 3 modos A/B/C + parseVintedContent | VintedParserService, VintedImportScreen |
| S6fix | SyntaxError ProductsScreen + deploy v5.0 | ProductsScreen, agent-deploy.ps1 |
| H2 | DS undefined ProductsScreen + PS1 encoding | ProductsScreen, agent-deploy.ps1 |
| H3 | Dead code filterCat + sustitución archivos | ProductsScreen |
| S7 | Modos D/E + scriptVentas/Historial + deploy v5.2 | VintedParserService, VintedImportScreen |
| H4 | JAVA_HOME auto-detection + deploy v5.3 | agent-deploy.ps1 |
| S8 | DocumentPicker + Tab Importar + matchHistoryToInventory | App.jsx, VintedImportScreen |
| S8fix | LogsScreen backupStorage + updateSaleData | LogsScreen, DatabaseService |
| S9 | Estadísticas anuales + getMonth+1 fix + export BBDD | DatabaseService, AdvancedStatsScreen |
| S9.1 | KPIs canónicos (totalRecaudacion, rotacion) | DatabaseService, Dashboard |
| S9.2 | Fix DashboardScreen KPIs eliminados | DashboardScreen |
| S10 | BackupService doble capa FileSystem | BackupService, App.jsx, SettingsScreen |
| S10.1 | Fix Tab 6 → Importar (regresión S10) + .mdc v4.2 | App.jsx |
| S11 | Subcategorías filtros + inferCategoryFromTitle + Claude Projects | DatabaseService, VintedParserService, pantallas |
| S12 | Fix useEffect fuera de componente → subcategorías invisibles | ProductDetailScreen, SoldEditDetailView |
| H5 | Export expo-sharing + imágenes vendidos + categorías MMKV | BackupService, SoldHistoryScreen, SettingsScreen |
| S13 | Fix typo seEffect (Regla 8) | SettingsScreen |
| S13b | Fix stale closure dictionaryRef (Regla 9) | SettingsScreen |
| **S14** | **DS v2 theme.js + IntelligenceService + BI Screen + DeduplicationScreen** | theme.js, IntelligenceService, todas las pantallas |

---

*SYSTEM_DESIGN.md — ResellHub v4.3 · Sprint 14 · Junio 2026*
*[LIBRARIAN] · Mantener actualizado tras cada sprint*
