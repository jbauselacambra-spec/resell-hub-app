/**
 * VintedParserService.js — Sprint 9
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [ORCHESTRATOR] Agentes activos: [ARCHITECT] [DATA_SCIENTIST] [QA_ENGINEER]
 *
 * CAMBIOS SPRINT 9:
 * ─────────────────
 *
 * [QA_ENGINEER] — Filtro de precios negativos (QA-002 data_integrity):
 *
 *   PROBLEMA: El historial de Vinted incluye registros con amount negativo
 *   para compras, y ocasionalmente ventas con amount=0 o negativo por
 *   devoluciones o ajustes. Si estos se importan al inventario, corrompían
 *   soldPriceReal con valores negativos, distorsionando todas las estadísticas.
 *
 *   FILTRO APLICADO EN:
 *   1. parseJsonSalesCurrent() → filtra items con soldPriceReal <= 0
 *   2. parseJsonSalesHistory() → filtra type='venta' con soldPriceReal <= 0
 *   3. mapToInventoryProduct() → Math.abs() protege price y soldPriceReal
 *   4. mapToSaleRecord() → Math.abs() + guardia >= 0
 *   5. matchHistoryToInventory() → skip si soldPriceReal <= 0
 *   6. VintedSalesDB.saveRecords() → filtra ventas con amount <= 0
 *
 *   El filtro es SILENCIOSO (no lanza error): el item se registra como
 *   'skipped' en el resultado de matchHistoryToInventory.
 *   LogService registra cuántos items fueron filtrados.
 *
 * [ARCHITECT] — Sprint 8 fix mantenido:
 *   matchHistoryToInventory usa DatabaseService.updateSaleData()
 *   (bypass MANUAL_FIELDS_SOLD) — ya documentado en Sprint 8 fix.
 *
 * [DATA_SCIENTIST] — VintedSalesDB.getStats() corregido:
 *   BUG: usaba r.date en lugar de r.soldDateReal para agrupar por mes.
 *   r.date puede ser null en el Modo D (ventas actuales sin fecha ISO).
 *   DESPUÉS: key = (r.soldDateReal || r.date || '').slice(0, 7)
 *   → Ahora los meses de VintedSalesDB coinciden con getMonthlyHistory().
 *
 *   NUEVO: VintedSalesDB.getAnnualStats()
 *   Agrega byMonth por año para consistencia con DatabaseService.getAnnualHistory().
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { MMKV } from 'react-native-mmkv';
import LogService, { LOG_CTX } from './LogService';
import { DatabaseService } from './DatabaseService';

const storage = new MMKV({ id: 'vinted-parser' });

const KEYS = {
  SALES_HISTORY: 'sales_history_v1',
  IMPORT_LOG:    'import_log_v1',
};

// [QA_ENGINEER] Constante de precio mínimo válido
const MIN_VALID_PRICE = 0.01;

const genId = () => `vsr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

// ─── 1. Detector de tipo de contenido ────────────────────────────────────────
export function detectContentType(text) {
  if (!text || typeof text !== 'string') return 'unknown';
  const t = text.trim();

  if (t.startsWith('http')) {
    if (t.includes('/inbox/'))   return 'url_inbox';
    if (t.includes('vinted.es') || t.includes('vinted.com')) return 'url_product';
  }

  if (t.startsWith('[') || t.startsWith('{')) {
    try {
      const parsed = JSON.parse(t);
      const arr    = Array.isArray(parsed) ? parsed : [parsed];
      if (arr.length === 0) return 'unknown';
      const first  = arr[0];

      if (first.sourceFormat === 'json_sales_current') return 'json_sales_current';
      if (first.sourceFormat === 'json_sales_history') return 'json_sales_history';
      if (first.id && (first.price !== undefined || first.images)) return 'json_products';

      if (first.orderId) {
        const hasDate = arr.some(r => r.date && typeof r.date === 'string' && r.date.includes('T'));
        return hasDate ? 'json_sales_history' : 'json_sales_current';
      }

      // [MIGRATION_MANAGER] Detectar export completo de BBDD
      if (first.exportedBy?.includes('ResellHub') && Array.isArray(first.products)) {
        return 'json_full_export';
      }
    } catch { /* no es JSON */ }
  }

  if (t.includes('<!DOCTYPE html') || t.includes('<html')) {
    if (t.includes('my-orders'))  return 'html_sales_current';
    if (t.includes('balance'))    return 'html_sales_history';
    return 'html_generic';
  }

  return 'unknown';
}

// ─── 2. HTML stubs (compatibilidad) ──────────────────────────────────────────
export function parseVintedContent(text) {
  const type = detectContentType(text);
  switch (type) {
    case 'json_sales_current': return { type, items: parseJsonSalesCurrent(text), products: null };
    case 'json_sales_history': return { type, items: parseJsonSalesHistory(text), products: null };
    case 'json_products':      return { type, items: null, products: parseJsonProducts(text) };
    default:                   return { type, items: [], products: null };
  }
}

// ─── 3. Parser JSON escaparate (Modo C) ───────────────────────────────────────
export function parseJsonProducts(text) {
  try {
    const raw = typeof text === 'string' ? JSON.parse(text) : text;
    const arr = Array.isArray(raw) ? raw : [raw];
    return arr
      .filter(p => p && (p.id || p.title))
      .map(p => ({
        ...p,
        id:            p.id || `vinted_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title:         (p.title      || 'Sin título').trim(),
        brand:         (p.brand      || 'Genérico').trim(),
        // [QA_ENGINEER] precio nunca negativo en escaparate
        price:         Math.max(0, parseFloat(p.price) || 0),
        description:   (p.description || p.title || '').trim(),
        images:        Array.isArray(p.images) ? p.images : (p.images ? [p.images] : []),
        status:        p.status === 'sold' ? 'sold' : 'available',
        views:         parseInt(p.views)     || 0,
        favorites:     parseInt(p.favorites) || 0,
        soldDate:      p.soldDate     || null,
        soldDateReal:  p.soldDateReal || p.soldDate || null,
        // [QA_ENGINEER] soldPriceReal null si no viene o es <= 0
        soldPriceReal: (p.soldPriceReal != null && parseFloat(p.soldPriceReal) > 0)
          ? parseFloat(p.soldPriceReal)
          : null,
        createdAt:     p.createdAt    || new Date().toISOString(),
      }));
  } catch (e) {
    LogService.error('VintedParserService.parseJsonProducts', LOG_CTX.IMPORT, e);
    return [];
  }
}

// ─── 4. Parser JSON ventas actuales (Modo D) ──────────────────────────────────
export function parseJsonSalesCurrent(text) {
  try {
    const raw = typeof text === 'string' ? JSON.parse(text) : text;
    const arr = Array.isArray(raw) ? raw : [raw];

    let filteredNegative = 0;
    const result = arr
      .filter(r => {
        if (!r || !r.orderId) return false;
        // [QA_ENGINEER] Filtrar compras
        if ((r.type || '').toLowerCase() === 'compra') return false;
        // [QA_ENGINEER] Filtrar precios negativos o cero
        const amt = parseFloat(r.amount || 0);
        if (amt <= 0) { filteredNegative++; return false; }
        return true;
      })
      .map(r => {
        const amt = parseFloat(r.amount || 0);
        const soldPrice = Math.max(MIN_VALID_PRICE, parseFloat(r.soldPriceReal || 0) || amt);
        return {
          orderId:       String(r.orderId),
          title:         (r.title || 'Artículo desconocido').trim(),
          amount:        amt,
          soldPriceReal: soldPrice,
          type:          r.type  || 'venta',
          status:        r.status || 'completada',
          date:          r.date  || null,
          soldDateReal:  r.soldDateReal || null,
          imageUrl:      r.imageUrl    || null,
          sourceFormat:  'json_sales_current',
        };
      });

    if (filteredNegative > 0) {
      LogService.add(
        `⚠️ parseJsonSalesCurrent: ${filteredNegative} items con precio ≤ 0 descartados`,
        'warn',
      );
    }
    return result;
  } catch (e) {
    LogService.error('VintedParserService.parseJsonSalesCurrent', LOG_CTX.IMPORT, e);
    return [];
  }
}

// ─── 5. Parser JSON historial completo (Modo E) ───────────────────────────────
export function parseJsonSalesHistory(text) {
  try {
    const raw = typeof text === 'string' ? JSON.parse(text) : text;
    const arr = Array.isArray(raw) ? raw : [raw];

    let filteredNegative = 0;
    const result = arr
      .filter(r => {
        if (!r || !r.orderId) return false;
        const typ = (r.type || '').toLowerCase();
        // [QA_ENGINEER] Filtrar ventas con precio negativo o cero
        if (typ === 'venta') {
          const amt = parseFloat(r.amount || 0);
          const spr = parseFloat(r.soldPriceReal || 0);
          if (amt <= 0 && spr <= 0) { filteredNegative++; return false; }
        }
        return true;
      })
      .map(r => {
        const amt  = parseFloat(r.amount || 0);
        const typ  = (r.type || 'desconocido').toLowerCase();

        // [QA_ENGINEER] soldPriceReal siempre >= MIN_VALID_PRICE para ventas
        const rawSoldPrice = parseFloat(r.soldPriceReal || 0) || Math.abs(amt);
        const soldPriceReal = typ === 'venta'
          ? Math.max(MIN_VALID_PRICE, rawSoldPrice)
          : null;

        const soldDateReal = r.soldDateReal || (typ === 'venta' ? r.date : null);

        return {
          orderId:      String(r.orderId),
          title:        (r.title || 'Artículo desconocido').trim(),
          // [QA_ENGINEER] amount: positivo para ventas, negativo para compras
          amount:       typ === 'venta' ? Math.abs(amt) : -Math.abs(amt),
          soldPriceReal,
          type:         typ,
          status:       r.status || (typ === 'venta' ? 'completada' : 'pagado'),
          date:         r.date   || null,
          soldDateReal,
          imageUrl:     null,
          sourceFormat: 'json_sales_history',
        };
      });

    if (filteredNegative > 0) {
      LogService.add(
        `⚠️ parseJsonSalesHistory: ${filteredNegative} ventas con precio ≤ 0 descartadas`,
        'warn',
      );
    }
    return result;
  } catch (e) {
    LogService.error('VintedParserService.parseJsonSalesHistory', LOG_CTX.IMPORT, e);
    return [];
  }
}

// ─── 6. matchHistoryToInventory — Sprint 8 fix + Sprint 9 filtro ─────────────
/**
 * [ARCHITECT] + [DATA_SCIENTIST] + [QA_ENGINEER]
 *
 * Cruza VintedSaleItems (ventas) con el inventario local.
 * Sprint 8: usa DatabaseService.updateSaleData() (bypass MANUAL_FIELDS).
 * Sprint 9: filtra explícitamente soldPriceReal <= 0 antes de actualizar.
 */
export function matchHistoryToInventory(saleItems) {
  const result = { matched: 0, created: 0, skipped: 0, errors: 0, filteredNegative: 0 };

  try {
    const allProducts = DatabaseService.getAllProducts();

    const normalize = (s) => (s || '')
      .toLowerCase()
      .replace(/\p{Emoji}/gu, '')
      .replace(/[^\w\sáéíóúüñ]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const titleIndex = new Map();
    allProducts.forEach((p, idx) => {
      const key = normalize(p.title);
      if (key.length < 3) return;
      if (!titleIndex.has(key)) titleIndex.set(key, []);
      titleIndex.get(key).push(idx);
    });

    const orderIdIndex = new Map();
    allProducts.forEach((p, idx) => {
      const m = String(p.id).match(/(\d{8,})/);
      if (m) orderIdIndex.set(m[1], idx);
    });

    const updatedSet = new Set();

    saleItems.forEach(item => {
      // [QA_ENGINEER] Skip compras
      if (!item.orderId || item.type === 'compra') {
        result.skipped++;
        return;
      }

      // [QA_ENGINEER] FILTRO CLAVE: no importar precios negativos o cero
      if (!item.soldPriceReal || item.soldPriceReal <= 0) {
        result.filteredNegative++;
        LogService.add(
          `⛔ matchHistory: "${item.title}" descartado — soldPriceReal inválido (${item.soldPriceReal})`,
          'warn',
        );
        return;
      }

      // [QA_ENGINEER] Skip si no tiene datos útiles
      if (!item.soldPriceReal && !item.soldDateReal) {
        result.skipped++;
        return;
      }

      try {
        let matchIdx = -1;

        // Prioridad 1: orderId embebido en product.id
        if (orderIdIndex.has(item.orderId)) {
          matchIdx = orderIdIndex.get(item.orderId);
        }

        // Prioridad 2: título normalizado
        if (matchIdx === -1) {
          const key     = normalize(item.title);
          const indices = titleIndex.get(key) || [];
          if (indices.length === 1) {
            matchIdx = indices[0];
          } else if (indices.length > 1) {
            const soldIdx = indices.find(i => allProducts[i]?.status === 'sold');
            matchIdx = soldIdx !== undefined ? soldIdx : indices[indices.length - 1];
          }
        }

        if (matchIdx === -1) {
          const newProd = mapToInventoryProduct(item);
          DatabaseService.importFromVinted([newProd]);
          result.created++;
          return;
        }

        if (!updatedSet.has(matchIdx)) {
          const prod = allProducts[matchIdx];
          // [ARCHITECT] updateSaleData bypasa MANUAL_FIELDS_SOLD
          DatabaseService.updateSaleData(prod.id, {
            soldPriceReal: item.soldPriceReal,
            soldDateReal:  item.soldDateReal || (!prod.soldDateReal ? item.date : undefined),
            status: 'sold',
          });
          updatedSet.add(matchIdx);
          result.matched++;
        } else {
          result.skipped++;
        }
      } catch (innerErr) {
        LogService.error('matchHistoryToInventory item', LOG_CTX.IMPORT, innerErr);
        result.errors++;
      }
    });

    LogService.add(
      `✅ matchHistory: ${result.matched} matches · ${result.created} creados · ${result.skipped} skip · ${result.filteredNegative} filtrados(precio≤0) · ${result.errors} err`,
      'success',
    );
  } catch (e) {
    LogService.error('matchHistoryToInventory', LOG_CTX.IMPORT, e);
    result.errors++;
  }

  return result;
}

// ─── 7. Mappers ──────────────────────────────────────────────────────────────

export function mapToInventoryProduct(item) {
  const now = new Date().toISOString();
  // [QA_ENGINEER] Precio siempre positivo
  const safePrice = Math.max(MIN_VALID_PRICE, Math.abs(item.soldPriceReal || item.amount || 0));
  return {
    id:              `vinted_${item.orderId}`,
    title:           item.title,
    brand:           '',
    price:           safePrice,
    description:     '',
    images:          item.imageUrl ? [item.imageUrl] : [],
    status:          'sold',
    views:           0,
    favorites:       0,
    soldDate:        item.soldDateReal || item.date || now,
    soldDateReal:    item.soldDateReal || item.date || null,
    soldPriceReal:   safePrice,
    createdAt:       item.soldDateReal  || item.date || now,
    firstUploadDate: item.soldDateReal  || item.date || now,
    category:        'Otros',
    subcategory:     null,
    isBundle:        false,
    priceHistory:    [],
    repostCount:     0,
    lastSync:        now,
    source:          `vinted_${item.sourceFormat}_import`,
  };
}

export function mapToSaleRecord(item) {
  const now = new Date().toISOString();
  // [QA_ENGINEER] Precio siempre positivo en el record
  const safePrice = Math.max(MIN_VALID_PRICE, Math.abs(item.soldPriceReal || item.amount || 0));
  return {
    id:            genId(),
    orderId:       item.orderId,
    title:         item.title,
    amount:        item.amount,
    soldPriceReal: safePrice,
    soldDateReal:  item.soldDateReal  || item.date || null,
    type:          item.type,
    date:          item.date || now,
    imageUrl:      item.imageUrl,
    status:        item.status,
    importedAt:    now,
    sourceFormat:  item.sourceFormat,
  };
}

// ─── 8. VintedSalesDB — Historial económico (MMKV) ────────────────────────────
export const VintedSalesDB = {
  saveRecords(records) {
    try {
      const raw      = storage.getString(KEYS.SALES_HISTORY);
      const existing = raw ? JSON.parse(raw) : [];
      const existIds = new Set(existing.map(r => r.orderId));
      let inserted = 0, duplicates = 0, filteredNeg = 0;
      const merged = [...existing];
      records.forEach(r => {
        // [QA_ENGINEER] No guardar registros con precio inválido (ventas)
        if (r.type === 'venta' && (!r.soldPriceReal || r.soldPriceReal <= 0)) {
          // Intentar rescatar con amount
          if (!r.amount || r.amount <= 0) { filteredNeg++; return; }
          r.soldPriceReal = Math.abs(r.amount);
        }
        if (existIds.has(r.orderId)) { duplicates++; }
        else { merged.push(r); existIds.add(r.orderId); inserted++; }
      });
      storage.set(KEYS.SALES_HISTORY, JSON.stringify(merged));
      const msg = `💰 VintedSalesDB: +${inserted} (${duplicates} dup${filteredNeg > 0 ? `, ${filteredNeg} filtrados` : ''})`;
      LogService.add(msg, 'success');
      return { inserted, duplicates, filteredNeg };
    } catch (e) {
      LogService.error('VintedSalesDB.saveRecords', LOG_CTX.IMPORT, e);
      return { inserted: 0, duplicates: 0, filteredNeg: 0 };
    }
  },

  getAllRecords() {
    try { return JSON.parse(storage.getString(KEYS.SALES_HISTORY) || '[]'); }
    catch { return []; }
  },

  /**
   * [DATA_SCIENTIST] getStats() corregido:
   * BUG FIX: usaba r.date en lugar de r.soldDateReal para agrupar por mes.
   * r.date puede ser null en Modo D. Ahora: soldDateReal || date.
   * NUEVO: también agrupa por año (byYear).
   */
  getStats() {
    const all     = this.getAllRecords();
    const ventas  = all.filter(r => r.type === 'venta');
    const compras = all.filter(r => r.type === 'compra');

    // [QA_ENGINEER] Usar soldPriceReal para ventas, no amount (que puede ser negativo)
    const totalV = ventas.reduce((s, r)  => s + Math.max(0, r.soldPriceReal || r.amount || 0), 0);
    const totalC = compras.reduce((s, r) => s + Math.abs(r.amount || 0), 0);

    const byMonth = {};
    const byYear  = {};

    all.forEach(r => {
      // [DATA_SCIENTIST] FIX: usar soldDateReal primero para agrupar
      const dateStr = r.soldDateReal || r.date || '';
      const monthKey = dateStr.slice(0, 7) || 'unknown'; // "2026-02"
      const yearKey  = dateStr.slice(0, 4) || 'unknown'; // "2026"

      // Por mes
      if (!byMonth[monthKey]) byMonth[monthKey] = { ventas: 0, compras: 0, count: 0, revenue: 0 };
      if (r.type === 'venta') {
        const v = Math.max(0, r.soldPriceReal || r.amount || 0);
        byMonth[monthKey].ventas  += v;
        byMonth[monthKey].revenue += v;
        byMonth[monthKey].count++;
      }
      if (r.type === 'compra') {
        byMonth[monthKey].compras += Math.abs(r.amount || 0);
        byMonth[monthKey].count++;
      }

      // Por año
      if (!byYear[yearKey]) byYear[yearKey] = { ventas: 0, compras: 0, count: 0, revenue: 0 };
      if (r.type === 'venta') {
        const v = Math.max(0, r.soldPriceReal || r.amount || 0);
        byYear[yearKey].ventas  += v;
        byYear[yearKey].revenue += v;
        byYear[yearKey].count++;
      }
      if (r.type === 'compra') {
        byYear[yearKey].compras += Math.abs(r.amount || 0);
        byYear[yearKey].count++;
      }
    });

    return {
      totalRecords:   all.length,
      totalVentas:    ventas.length,
      totalCompras:   compras.length,
      ingresosBrutos: +totalV.toFixed(2),
      gastos:         +totalC.toFixed(2),
      balance:        +(totalV - totalC).toFixed(2),
      byMonth,
      byYear,
    };
  },

  /**
   * [DATA_SCIENTIST] NUEVO: getAnnualStats()
   * Retorna array ordenado de años para usar en AdvancedStatsScreen.
   */
  getAnnualStats() {
    const stats = this.getStats();
    return Object.entries(stats.byYear)
      .filter(([y]) => y !== 'unknown' && y.length === 4)
      .map(([year, d]) => ({
        year:           parseInt(year),
        label:          year,
        ingresos:       +(d.ventas.toFixed(2)),
        gastos:         +(d.compras.toFixed(2)),
        balance:        +((d.ventas - d.compras).toFixed(2)),
        totalVentas:    d.count,
      }))
      .sort((a, b) => b.year - a.year);
  },

  clear() {
    storage.delete(KEYS.SALES_HISTORY);
    LogService.add('⚠️ VintedSalesDB: historial borrado', 'warn');
  },
};

// ─── 9. Log de importaciones ──────────────────────────────────────────────────
export function logImportEvent(type, count, details = {}) {
  try {
    const raw  = storage.getString(KEYS.IMPORT_LOG);
    const logs = raw ? JSON.parse(raw) : [];
    logs.unshift({ type, count, details, at: new Date().toISOString() });
    storage.set(KEYS.IMPORT_LOG, JSON.stringify(logs.slice(0, 50)));
  } catch { /* silent */ }
}

export function getImportLog() {
  try { return JSON.parse(storage.getString(KEYS.IMPORT_LOG) || '[]'); }
  catch { return []; }
}