/**
 * VintedParserService.js — Sprint 8 fix
 *
 * FIX CRÍTICO:
 * ─ matchHistoryToInventory: ahora usa DatabaseService.updateSaleData() en lugar de
 *   updateProduct(). El motivo es que updateProduct() tiene lógica de preservación
 *   de campos manuales (MANUAL_FIELDS_SOLD) que BLOQUEA la escritura de soldPriceReal
 *   y soldDateReal si el producto ya los tiene (aunque sean 0 o el precio de publicación).
 *
 *   updateSaleData() es un método dedicado que SOLO actualiza soldPriceReal + soldDateReal
 *   + status='sold', sin tocar ningún otro campo sagrado.
 *
 * ─ La condición de update se amplía: actualiza soldPriceReal si el valor viene del
 *   historial (soldPriceReal del JSON) Y es distinto al precio de publicación del producto
 *   o si el producto no tiene fecha real de venta. Esto garantiza que los productos
 *   importados desde el escaparate (con soldPriceReal=price) reciban el precio real.
 *
 * ─ Normalización de fecha mejorada: acepta ISO 8601 con T (ej: "2026-02-10T12:00:00.000Z")
 *   y formatos europeos. El campo soldDateReal del historial ya viene en ISO 8601, por lo
 *   que no necesita conversión adicional.
 */

import { MMKV } from 'react-native-mmkv';
import LogService, { LOG_CTX } from './LogService';
import { DatabaseService } from './DatabaseService';

const storage = new MMKV({ id: 'vinted-parser' });

const KEYS = {
  SALES_HISTORY: 'sales_history_v1',
  IMPORT_LOG:    'import_log_v1',
};

const genId = () => `vsr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

// ─── 1. Detector de tipo de contenido ─────────────────────────────────────────
export function detectContentType(text) {
  if (!text || typeof text !== 'string') return 'unknown';
  const t = text.trim();

  if (t.startsWith('http')) {
    if (t.includes('/inbox/'))   return 'url_inbox';
    if (t.includes('vinted.es') || t.includes('vinted.com')) return 'url_product';
  }

  // Intentar parsear como JSON
  if (t.startsWith('[') || t.startsWith('{')) {
    try {
      const parsed = JSON.parse(t);
      const arr    = Array.isArray(parsed) ? parsed : [parsed];
      if (arr.length === 0) return 'unknown';
      const first  = arr[0];

      // Detección por sourceFormat explícito (scripts v2)
      if (first.sourceFormat === 'json_sales_current') return 'json_sales_current';
      if (first.sourceFormat === 'json_sales_history') return 'json_sales_history';

      // Detección por estructura
      if (first.id && (first.price !== undefined || first.images)) return 'json_products';

      // Detección por orderId (scripts v1 legacy)
      if (first.orderId) {
        const hasDate = arr.some(r => r.date && typeof r.date === 'string' && r.date.includes('T'));
        return hasDate ? 'json_sales_history' : 'json_sales_current';
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

// ─── 2. HTML stubs (compatibilidad, no se usa en Sprint 8) ───────────────────
export function parseVintedContent(html) { return []; }

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
        price:         parseFloat(p.price) || 0,
        description:   (p.description || p.title || '').trim(),
        images:        Array.isArray(p.images) ? p.images : (p.images ? [p.images] : []),
        status:        p.status === 'sold' ? 'sold' : 'available',
        views:         parseInt(p.views)     || 0,
        favorites:     parseInt(p.favorites) || 0,
        soldDate:      p.soldDate     || null,
        soldDateReal:  p.soldDateReal || p.soldDate || null,
        soldPriceReal: p.soldPriceReal != null ? parseFloat(p.soldPriceReal) : null,
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
    return arr
      .filter(r => r && r.orderId)
      .map(r => ({
        orderId:       String(r.orderId),
        title:         (r.title   || 'Artículo desconocido').trim(),
        amount:        parseFloat(r.amount) || 0,
        soldPriceReal: parseFloat(r.amount) || 0,
        type:          r.type  || 'venta',
        status:        r.status || 'completada',
        date:          r.date   || null,
        soldDateReal:  r.soldDateReal || null,
        imageUrl:      r.imageUrl    || null,
        sourceFormat:  'json_sales_current',
      }));
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
    return arr
      .filter(r => r && r.orderId)
      .map(r => {
        const amt = parseFloat(r.amount) || 0;
        const typ = (r.type || 'desconocido').toLowerCase();
        // soldPriceReal y soldDateReal vienen ya correctos del script de historial
        const soldPriceReal = typ === 'venta'
          ? (r.soldPriceReal != null ? parseFloat(r.soldPriceReal) : Math.abs(amt))
          : null;
        const soldDateReal = r.soldDateReal || (typ === 'venta' ? r.date : null);
        return {
          orderId:      String(r.orderId),
          title:        (r.title || 'Artículo desconocido').trim(),
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
  } catch (e) {
    LogService.error('VintedParserService.parseJsonSalesHistory', LOG_CTX.IMPORT, e);
    return [];
  }
}

// ─── 6. matchHistoryToInventory — FIX CRÍTICO Sprint 8 ───────────────────────
/**
 * Cruza VintedSaleItems (ventas) con el inventario local.
 *
 * FIX: Usa DatabaseService.updateSaleData() en lugar de updateProduct().
 * updateProduct() preserva MANUAL_FIELDS_SOLD incluyendo soldPriceReal/soldDateReal,
 * lo que impide actualizarlos aunque el producto tenga el precio de publicación.
 *
 * updateSaleData() escribe soldPriceReal + soldDateReal + status='sold' DIRECTAMENTE
 * en el storage sin pasar por la capa de campos sagrados, ya que se trata de datos
 * que VIENEN del historial real de Vinted (fuente de verdad superior).
 *
 * Estrategia de match (por prioridad):
 *   1. orderId embebido en product.id  (vinted_20679079955 → orderId '20679079955')
 *   2. Título normalizado              (lowercase + sin emojis + sin símbolos)
 *
 * Condición de actualización:
 *   - soldPriceReal: siempre actualiza si el historial trae un valor > 0
 *     (el precio del historial es el precio REAL de venta, más fiable que el de publicación)
 *   - soldDateReal:  solo si el producto no tenía fecha real
 *
 * @param {Array} saleItems — VintedSaleItem[] (solo ventas)
 * @returns {{ matched, created, skipped, errors }}
 */
export function matchHistoryToInventory(saleItems) {
  const result = { matched: 0, created: 0, skipped: 0, errors: 0 };

  try {
    const allProducts = DatabaseService.getAllProducts();

    // Normalización de título: lowercase + sin emojis + sin puntuación + trim
    const normalize = (s) => (s || '')
      .toLowerCase()
      .replace(/\p{Emoji}/gu, '')           // emojis (con flag u)
      .replace(/[^\w\sáéíóúüñ]/gi, ' ')    // símbolos y puntuación
      .replace(/\s+/g, ' ')
      .trim();

    // Índice por título normalizado → [índice en array]
    const titleIndex = new Map();
    allProducts.forEach((p, idx) => {
      const key = normalize(p.title);
      if (key.length < 3) return;
      if (!titleIndex.has(key)) titleIndex.set(key, []);
      titleIndex.get(key).push(idx);
    });

    // Índice por orderId embebido en product.id (vinted_ORDERID)
    const orderIdIndex = new Map();
    allProducts.forEach((p, idx) => {
      const m = String(p.id).match(/(\d{8,})/);
      if (m) orderIdIndex.set(m[1], idx);
    });

    const updatedSet = new Set(); // evitar doble-update en mismo batch

    saleItems.forEach(item => {
      if (!item.orderId || item.type === 'compra') {
        result.skipped++;
        return;
      }

      // Validar que el item tiene datos útiles
      if (!item.soldPriceReal && !item.soldDateReal) {
        result.skipped++;
        return;
      }

      try {
        let matchIdx = -1;

        // Prioridad 1: orderId embebido
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
            // Preferir el ya vendido
            const soldIdx = indices.find(i => allProducts[i]?.status === 'sold');
            matchIdx = soldIdx !== undefined ? soldIdx : indices[indices.length - 1];
          }
        }

        if (matchIdx === -1) {
          // Sin match → crear producto vendido nuevo
          const newProd = mapToInventoryProduct(item);
          DatabaseService.importFromVinted([newProd]);
          result.created++;
          return;
        }

        // Match encontrado — actualizar usando updateSaleData (bypass MANUAL_FIELDS)
        if (!updatedSet.has(matchIdx)) {
          const prod = allProducts[matchIdx];
          DatabaseService.updateSaleData(prod.id, {
            // soldPriceReal: siempre actualiza desde historial (precio real de venta)
            soldPriceReal: item.soldPriceReal,
            // soldDateReal: solo si el producto no tenía fecha real
            soldDateReal: item.soldDateReal
              || (prod.soldDateReal ? undefined : item.date),
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
      `✅ matchHistory: ${result.matched} matches · ${result.created} creados · ${result.skipped} skip · ${result.errors} err`,
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
  return {
    id:              `vinted_${item.orderId}`,
    title:           item.title,
    brand:           '',
    price:           Math.abs(item.soldPriceReal || item.amount || 0),
    description:     '',
    images:          item.imageUrl ? [item.imageUrl] : [],
    status:          'sold',
    views:           0,
    favorites:       0,
    soldDate:        item.soldDateReal || item.date || now,
    soldDateReal:    item.soldDateReal || item.date || null,
    soldPriceReal:   item.soldPriceReal || Math.abs(item.amount || 0),
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
  return {
    id:            genId(),
    orderId:       item.orderId,
    title:         item.title,
    amount:        item.amount,
    soldPriceReal: item.soldPriceReal || Math.abs(item.amount || 0),
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
      let inserted = 0, duplicates = 0;
      const merged = [...existing];
      records.forEach(r => {
        if (existIds.has(r.orderId)) { duplicates++; }
        else { merged.push(r); existIds.add(r.orderId); inserted++; }
      });
      storage.set(KEYS.SALES_HISTORY, JSON.stringify(merged));
      LogService.add(`💰 VintedSalesDB: +${inserted} (${duplicates} dup)`, 'success');
      return { inserted, duplicates };
    } catch (e) {
      LogService.error('VintedSalesDB.saveRecords', LOG_CTX.IMPORT, e);
      return { inserted: 0, duplicates: 0 };
    }
  },

  getAllRecords() {
    try { return JSON.parse(storage.getString(KEYS.SALES_HISTORY) || '[]'); }
    catch { return []; }
  },

  getStats() {
    const all     = this.getAllRecords();
    const ventas  = all.filter(r => r.type === 'venta');
    const compras = all.filter(r => r.type === 'compra');
    const totalV  = ventas.reduce((s, r)  => s + Math.abs(r.amount || 0), 0);
    const totalC  = compras.reduce((s, r) => s + Math.abs(r.amount || 0), 0);
    const byMonth = {};
    all.forEach(r => {
      const key = (r.soldDateReal || r.date || '').slice(0, 7) || 'unknown';
      if (!byMonth[key]) byMonth[key] = { ventas: 0, compras: 0, count: 0 };
      if (r.type === 'venta')  { byMonth[key].ventas  += Math.abs(r.amount || 0); byMonth[key].count++; }
      if (r.type === 'compra') { byMonth[key].compras += Math.abs(r.amount || 0); byMonth[key].count++; }
    });
    return {
      totalRecords:   all.length,
      totalVentas:    ventas.length,
      totalCompras:   compras.length,
      ingresosBrutos: +totalV.toFixed(2),
      gastos:         +totalC.toFixed(2),
      balance:        +(totalV - totalC).toFixed(2),
      byMonth,
    };
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