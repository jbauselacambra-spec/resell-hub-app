# SKILL: api-contract-sync

## Cuándo usar esta skill

Usar esta skill SIEMPRE que:
- Se modifique el contrato de un servicio compartido (DatabaseService, VintedParserService, etc.)
- Se renombren, eliminen o añadan campos en métodos como `getBusinessKPIs()`, `getCategoryStats()`, etc.
- Aparezca el error `TypeError: Cannot read property 'X' of undefined` en un Screen
- Se haga un sprint que cambia la forma del objeto retornado por un método

---

## El Problema

Cuando un servicio cambia su contrato (los campos que retorna), **todos** los componentes que consumen ese servicio deben actualizarse en el **mismo sprint**. Si se actualiza solo algunos, los demás crashean en producción.

```
// DatabaseService.getBusinessKPIs() Sprint 9 retornaba:
{ totalRevenue, totalProfit, revenueThisMonth, soldCount, ... }

// DatabaseService.getBusinessKPIs() Sprint 9.1 retorna:
{ totalRecaudacion, rotacion, recaudacionThisMonth, soldCount, ... }

// Consumidores que usaban el contrato viejo:
DashboardScreen     → kpis.totalRevenue.toFixed()    // ← CRASH
AdvancedStatsScreen → kpis.totalProfit               // ← campo inexistente
SoldHistoryScreen   → kpis.revenueThisMonth          // ← CRASH
```

---

## Protocolo obligatorio al modificar un contrato

### Paso 1: Auditoría de consumidores

Antes de modificar cualquier método de servicio, ejecutar:

```bash
# Encontrar todos los ficheros que usan el método
grep -rn "getBusinessKPIs\|getCategoryStats\|getMonthlyHistory" screens/ --include="*.jsx"

# Encontrar todos los campos del objeto que se va a cambiar
grep -rn "kpis\.\|catStats\.\|monthHistory\." screens/ --include="*.jsx" | grep -v "setKpis\|setCatStats"
```

### Paso 2: Tabla de migración

Crear explícitamente la tabla ANTES de escribir código:

| Campo viejo | Campo nuevo | Pantallas afectadas |
|---|---|---|
| `totalRevenue` | `totalRecaudacion` | DashboardScreen, AdvancedStatsScreen |
| `totalProfit` | `rotacion` | DashboardScreen, SoldHistoryScreen |
| `revenueThisMonth` | `recaudacionThisMonth` | DashboardScreen |

### Paso 3: Actualizar TODOS los consumidores en el mismo sprint

```
❌ INCORRECTO — Sprint parcial:
Sprint 9.1: Actualiza DatabaseService ✅ + AdvancedStatsScreen ✅
            Deja DashboardScreen ❌ → crash en producción

✅ CORRECTO — Sprint completo:
Sprint 9.1: Actualiza DatabaseService ✅
            + AdvancedStatsScreen ✅
            + SoldHistoryScreen ✅
            + DashboardScreen ✅
```

---

## Mapa de consumidores por servicio en ResellHub

### `DatabaseService.getBusinessKPIs()` — Consumidores

| Pantalla | Campos accedidos |
|---|---|
| `DashboardScreen` | `totalRecaudacion`, `recaudacionThisMonth`, `rotacion`, `avgPrecioVenta`, `soldCount`, `activeCount`, `soldThisMonth`, `avgTTS`, `bestCat`, `worstCat`, `topSubcategory`, `staleCount` |
| `AdvancedStatsScreen` | `avgTTS`, `soldCount`, `totalRecaudacion`, `rotacion`, `soldThisMonth`, `topSubcategory` |
| `SoldHistoryScreen` | Calcula sus propios KPIs internamente desde `getAllProducts()` — NO usa getBusinessKPIs |

### `DatabaseService.getCategoryStats()` — Consumidores

| Pantalla | Campos accedidos |
|---|---|
| `AdvancedStatsScreen` | `name`, `avgTTS`, `count`, `totalRecaudacion`, `avgPrecio`, `color`, `emoji`, `label`, `advice`, `subcategoryStats` |

### `DatabaseService.getMonthlyHistory()` — Consumidores

| Pantalla | Campos accedidos |
|---|---|
| `AdvancedStatsScreen` | `label`, `month`, `year`, `recaudacion`, `sales`, `bundles`, `topCategory`, `categoryBreakdown` |

---

## Contrato actual de getBusinessKPIs() — Sprint 9.1+

```typescript
interface BusinessKPIs {
  // Financiero
  totalRecaudacion:     number;   // suma de soldPriceReal — ingresos reales
  recaudacionThisMonth: number;   // recaudación del mes actual
  rotacion:             number;   // % catálogo vendido = sold/(sold+active) × 100
  avgPrecioVenta:       number;   // precio medio de venta

  // Conteos
  soldCount:   number;   // total productos vendidos
  activeCount: number;   // total productos activos (no vendidos)
  staleCount:  number;   // productos activos marcados como stale
  soldThisMonth: number; // ventas del mes actual

  // Velocidad
  avgTTS: number;        // TTS medio en días (0 = sin datos)

  // Métricas de engagement
  totalViews:     number;
  totalFavorites: number;

  // Referencias a categorías
  bestCat:        CategoryStat | null;   // categoría con menor avgTTS
  worstCat:       CategoryStat | null;   // categoría con mayor avgTTS
  topSubcategory: SubcategoryStat | null; // subcategoría con menor avgTTS

  // ❌ CAMPOS ELIMINADOS (Sprint 9.1):
  // totalRevenue    → reemplazado por totalRecaudacion
  // totalProfit     → eliminado (siempre ≤ 0 en 2ª mano)
  // revenueThisMonth → reemplazado por recaudacionThisMonth
}
```

---

## Regla de defensa: nunca llamar .toFixed() sin guard

```jsx
// ❌ PELIGROSO — crash si el campo no existe
<Text>{kpis.totalRevenue.toFixed(0)}€</Text>

// ✅ SEGURO — protegido aunque el campo sea undefined
<Text>{(kpis.totalRecaudacion ?? 0).toFixed(0)}€</Text>

// ✅ TAMBIÉN SEGURO — pero menos explícito
<Text>{Number(kpis.totalRecaudacion || 0).toFixed(0)}€</Text>
```

**Regla de oro:** Siempre usar `?? 0` o `|| 0` como fallback antes de llamar a métodos numéricos como `.toFixed()`, `.toLocaleString()`, etc.

---

## Herramienta de diagnóstico rápido

Cuando aparece `TypeError: Cannot read property 'X' of undefined`:

```bash
# 1. Identificar el campo que falla (del error stack)
# Error: Cannot read property 'toFixed' of undefined → buscar .toFixed()

# 2. Encontrar qué campo es undefined
grep -n "toFixed\|toLocaleString\|toFixed" screens/DashboardScreen.jsx

# 3. Verificar si ese campo existe en el servicio
grep -n "totalRevenue\|totalProfit\|revenueThisMonth" services/DatabaseService.js | grep "return"

# 4. Buscar el campo correcto en el return del servicio
grep -A40 "static getBusinessKPIs" services/DatabaseService.js | grep "return {" -A30
```

---

## Registro de migraciones de contrato en ResellHub

| Sprint | Método | Campo eliminado | Campo nuevo | Pantallas actualizadas |
|---|---|---|---|---|
| 9.1 | `getBusinessKPIs()` | `totalRevenue` | `totalRecaudacion` | AdvancedStatsScreen ✅, DashboardScreen ❌ (pendiente) |
| 9.1 | `getBusinessKPIs()` | `totalProfit` | `rotacion` | AdvancedStatsScreen ✅, DashboardScreen ❌ (pendiente) |
| 9.1 | `getBusinessKPIs()` | `revenueThisMonth` | `recaudacionThisMonth` | DashboardScreen ❌ (pendiente) |
| 9.2 | — | — | — | DashboardScreen ✅ **CERRADO** |
| 9.1 | `getCategoryStats()` | `totalProfit`, `avgProfit` | `totalRecaudacion`, `avgPrecio` | AdvancedStatsScreen ✅ |
| 9.1 | `getMonthlyHistory()` | `profit` | `recaudacion` | AdvancedStatsScreen ✅ |
