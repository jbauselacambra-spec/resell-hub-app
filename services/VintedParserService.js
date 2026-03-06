/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VintedParserService.js  — Sprint 6 · feature/vinted-import-mobile (fix)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Parsers 100% offline para los 3 formatos de importación de Vinted:
 *
 *   FORMATO A  'html_sales_current'
 *     → HTML de "Mis pedidos / Año actual" (data-testid="my-orders-item")
 *     → Extrae: orderId, title, soldPriceReal, status (desde SVG title), imageUrl
 *     → NO contiene fecha de venta → soldDateReal queda null (se edita en la app)
 *
 *   FORMATO B  'html_sales_history'
 *     → HTML de "Historial de transacciones" (pile__element / Cell__suffix)
 *     → Extrae: orderId, type (venta/compra), title, amount, date (ISO)
 *
 *   FORMATO C  'json_products'
 *     → JSON generado por el script de consola del escaparate
 *     → Extrae: array completo de productos activos y vendidos
 *     → Pasa directamente a DatabaseService.importFromVinted()
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { MMKV } from 'react-native-mmkv';
import LogService, { LOG_CTX } from './LogService';

const storage = new MMKV({ id: 'vinted-parser' });
const KEYS = {
  SALES_HISTORY: 'vinted_sales_history',
  IMPORT_LOG:    'vinted_import_log',
};

// ─── Utilidades ───────────────────────────────────────────────────────────────
function genId() {
  return `vsr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function stripTags(html) {
  if (!html) return '';
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseEuros(str) {
  if (!str) return 0;
  const clean = str.replace(/[€\s]/g, '').replace(',', '.').trim();
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

const MONTHS_ES = {
  enero:1, febrero:2, marzo:3, abril:4, mayo:5, junio:6,
  julio:7, agosto:8, septiembre:9, octubre:10, noviembre:11, diciembre:12,
};
function parseSpanishDate(str) {
  if (!str) return null;
  const m = str.trim().toLowerCase().match(/(\d{1,2})\s+de\s+([a-záéíóúü]+)\s+de\s+(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${String(MONTHS_ES[m[2]] || 1).padStart(2,'0')}-${m[1].padStart(2,'0')}T12:00:00.000Z`;
}

// ─── 1. Detección de tipo ─────────────────────────────────────────────────────
export function detectContentType(text) {
  if (!text || typeof text !== 'string') return 'unknown';
  const t = text.trim();

  // Formato C: JSON array de productos (script de consola)
  if (t.startsWith('[') || t.startsWith('{')) {
    try {
      const parsed = JSON.parse(t);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      if (arr.length > 0 && (arr[0].id !== undefined || arr[0].title !== undefined)) {
        return 'json_products';
      }
    } catch { /* no es JSON válido */ }
  }

  // URL de producto Vinted
  if (/^https?:\/\/(www\.)?vinted\.(es|fr|com|de|pl|be|nl|it|pt|at|cz|sk|hu|ro|lt|lv|ee)\/items?\//i.test(t))
    return 'url_product';

  // URL de pedido
  if (/^https?:\/\/(www\.)?vinted\.[a-z]+\/inbox\//i.test(t))
    return 'url_inbox';

  // Formato A: HTML historial año actual (data-testid="my-orders-item")
  if (t.includes('my-orders-item') || t.includes('data-testid="my-orders-item'))
    return 'html_sales_current';

  // Formato B: HTML historial general (pile__element o Cell__title + Compra/Venta)
  if (t.includes('pile__element') ||
     (t.includes('Cell__title') && (t.includes('Compra') || t.includes('Venta'))))
    return 'html_sales_history';

  // HTML genérico de Vinted
  if (t.includes('web_ui__Cell') || t.includes('vinted.net/t/'))
    return 'html_generic';

  return 'unknown';
}

// ─── 2. Parser Formato A: "Mis pedidos / Año actual" ─────────────────────────
/**
 * El estado real viene del SVG <title>Estado de la transacción: Completada</title>
 * El precio viene en Text__subtitle (primer h3 con valor numérico)
 * La fecha de venta NO está disponible en este formato → soldDateReal = null
 */
export function parseHtmlSalesCurrent(html) {
  const results = [];
  if (!html) return results;

  // Cada item está separado por un href=/inbox/N
  const itemRegex = /href="\/inbox\/(\d+)"[^>]*>([\s\S]*?)(?=href="\/inbox\/\d+"|$)/g;
  let match;

  while ((match = itemRegex.exec(html)) !== null) {
    const orderId = match[1];
    const block   = match[2];

    // Título: en data-testid="my-orders-item--title"
    const titleMatch = block.match(/data-testid="my-orders-item--title"[^>]*>([\s\S]*?)<\/div>/) ||
                       block.match(/Cell__title[^>]*>([\s\S]*?)<\/div>/);
    const title = titleMatch ? stripTags(titleMatch[1]) : 'Artículo desconocido';

    // Precio: primera h3 con Text__subtitle que tenga valor numérico
    const priceBlocks = [...block.matchAll(/Text__subtitle[^>]*>([\s\S]*?)<\/h3>/g)];
    let soldPriceReal = 0;
    for (const pb of priceBlocks) {
      const v = parseEuros(stripTags(pb[1]));
      if (v > 0) { soldPriceReal = v; break; }
    }

    // Estado: desde SVG <title>Estado de la transacción: X</title>
    const svgStatus = block.match(/<title>Estado de la transacci[oó]n:\s*([^<]+)<\/title>/i);
    // Fallback: texto "Pedido finalizado"
    const pedidoStatus = block.match(/Pedido\s+(finalizado|en proceso|cancelado|devuelto)/i);
    let status = 'desconocido';
    if (svgStatus) {
      const raw = svgStatus[1].trim().toLowerCase();
      if (raw.includes('complet') || raw.includes('finaliz')) status = 'completada';
      else if (raw.includes('proceso')) status = 'en_proceso';
      else if (raw.includes('cancel')) status = 'cancelada';
      else status = svgStatus[1].trim();
    } else if (pedidoStatus) {
      const raw = pedidoStatus[1].toLowerCase();
      status = raw.includes('finaliz') ? 'completada' : raw.includes('proceso') ? 'en_proceso' : 'cancelada';
    }

    // Imagen
    const imgMatch = block.match(/src="(https:\/\/images\d*\.vinted\.net[^"]+)"/);
    const imageUrl = imgMatch ? imgMatch[1] : null;

    // Nota: soldDateReal NO está disponible en Formato A
    // El usuario deberá confirmarla en el modal de edición
    results.push({
      orderId,
      title,
      soldPriceReal,
      amount: soldPriceReal,          // alias para compatibilidad de UI
      type:         'venta',
      status,
      date:         null,             // ← No disponible en Formato A
      soldDateReal: null,             // ← El usuario lo completa en la app
      imageUrl,
      sourceFormat: 'html_current',
    });
  }

  return results;
}

// ─── 3. Parser Formato B: "Historial de transacciones" ───────────────────────
/**
 * Estructura real del HTML:
 *   <a href="/inbox/N">
 *     <div class="Cell__content">
 *       <div class="Cell__title">Compra|Venta</div>
 *       <div class="Cell__body">Título artículo</div>
 *     </div>
 *     <div class="Cell__suffix">
 *       <div>
 *         <h2 class="...Text__warning">-24,85 €</h2>
 *         24 de febrero de 2026
 *       </div>
 *     </div>
 *   </a>
 */
export function parseHtmlSalesHistory(html) {
  const results = [];
  if (!html) return results;

  // Split por cada href de inbox para obtener bloques individuales
  const itemRegex = /href="\/inbox\/(\d+)"[^>]*>([\s\S]*?)(?=href="\/inbox\/\d+"|<\/li>|$)/g;
  let match;

  while ((match = itemRegex.exec(html)) !== null) {
    const orderId = match[1];
    const block   = match[2];

    // Tipo (Compra / Venta) — en Cell__heading > Cell__title
    const typeMatch = block.match(/Cell__title[^>]*>([\s\S]*?)<\/div>/);
    const typeRaw   = typeMatch ? stripTags(typeMatch[1]).toLowerCase() : '';
    const type      = typeRaw.includes('venta') ? 'venta' : typeRaw.includes('compra') ? 'compra' : 'unknown';

    // Título del artículo — en Cell__body
    const bodyMatch = block.match(/Cell__body[^>]*>([\s\S]*?)<\/div>/);
    const title     = bodyMatch ? stripTags(bodyMatch[1]) : 'Artículo desconocido';

    // Sufijo: contiene el importe (h2) + la fecha (texto plano después del h2)
    const suffixMatch = block.match(/Cell__suffix[^>]*>([\s\S]*?)(?:<\/div>\s*<\/div>\s*<\/a>|$)/);
    let amount = 0;
    let date   = null;

    if (suffixMatch) {
      const suffixContent = suffixMatch[1];

      // Importe desde cualquier h2
      const h2Match = suffixContent.match(/<h2[^>]*>([\s\S]*?)<\/h2>/);
      if (h2Match) {
        const rawAmt = stripTags(h2Match[1]);
        const parsed = parseEuros(rawAmt);
        // Normalizar: ventas positivas, compras negativas
        amount = type === 'venta' ? Math.abs(parsed) : -Math.abs(parsed);
      }

      // Fecha: texto que queda después de eliminar el h2 y sus tags
      const afterH2 = suffixContent.replace(/<h2[\s\S]*?<\/h2>/, '');
      const dateText = stripTags(afterH2);
      date = parseSpanishDate(dateText);
    }

    results.push({
      orderId,
      title,
      amount,
      soldPriceReal: type === 'venta' ? Math.abs(amount) : null,
      type,
      status:       type === 'venta' ? 'completada' : 'pagado',
      date,
      soldDateReal: type === 'venta' ? date : null,
      imageUrl:     null,             // Formato B no incluye imágenes
      sourceFormat: 'html_history',
    });
  }

  return results;
}

// ─── 4. Parser Formato C: JSON del script de consola ─────────────────────────
/**
 * El script produce un array JSON con:
 *   { id, title, brand, price, description, images, status, views, favorites, soldDate, createdAt }
 * Lo pasamos directamente a DatabaseService.importFromVinted() que ya conoce este schema.
 * Solo validamos y normalizamos campos críticos.
 */
export function parseJsonProducts(text) {
  try {
    const raw = typeof text === 'string' ? JSON.parse(text) : text;
    const arr = Array.isArray(raw) ? raw : [raw];

    return arr
      .filter(p => p && (p.id || p.title))
      .map(p => ({
        ...p,
        id:              p.id          || `vinted_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
        title:           (p.title      || 'Sin título').trim(),
        brand:           (p.brand      || 'Genérico').trim(),
        price:           parseFloat(p.price) || 0,
        description:     (p.description || p.title || '').trim(),
        images:          Array.isArray(p.images) ? p.images : (p.images ? [p.images] : []),
        status:          p.status === 'sold' ? 'sold' : 'available',
        views:           parseInt(p.views)     || 0,
        favorites:       parseInt(p.favorites) || 0,
        soldDate:        p.soldDate     || null,
        soldDateReal:    p.soldDateReal || p.soldDate || null,
        soldPriceReal:   p.soldPriceReal || p.price  || null,
        createdAt:       p.createdAt    || new Date().toISOString(),
      }));
  } catch (e) {
    LogService.error('VintedParserService.parseJsonProducts', LOG_CTX.IMPORT, e);
    return [];
  }
}

// ─── 5. Dispatcher principal ──────────────────────────────────────────────────
export function parseVintedContent(text) {
  const type = detectContentType(text);
  switch (type) {
    case 'html_sales_current':  return { type, items: parseHtmlSalesCurrent(text),  products: null };
    case 'html_sales_history':  return { type, items: parseHtmlSalesHistory(text),  products: null };
    case 'json_products':       return { type, items: null, products: parseJsonProducts(text) };
    case 'html_generic': {
      const a = parseHtmlSalesCurrent(text);
      const b = parseHtmlSalesHistory(text);
      return { type, items: [...a, ...b], products: null };
    }
    default: return { type, items: [], products: null };
  }
}

// alias retrocompatible (Sprint 5)
export function parseVintedHtml(html) {
  const r = parseVintedContent(html);
  return r.items || [];
}

// ─── 6. Mappers ───────────────────────────────────────────────────────────────

/** VintedSaleItem → InternalProduct (para importFromVinted) */
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

/** VintedSaleItem → SaleRecord (para VintedSalesDB) */
export function mapToSaleRecord(item) {
  const now = new Date().toISOString();
  return {
    id:           genId(),
    orderId:      item.orderId,
    title:        item.title,
    amount:       item.amount,
    soldPriceReal:item.soldPriceReal || Math.abs(item.amount || 0),
    soldDateReal: item.soldDateReal  || item.date || null,
    type:         item.type,
    date:         item.date || now,
    imageUrl:     item.imageUrl,
    status:       item.status,
    importedAt:   now,
    sourceFormat: item.sourceFormat,
    // Placeholders fase 2:
    // monthYear:       (item.date || now).slice(0, 7),
    // category:        null,
    // profit:          null,
    // linkedProductId: null,
  };
}

// ─── 7. VintedSalesDB — Historial económico (MMKV) ────────────────────────────
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
      LogService.success(`VintedSalesDB: +${inserted} (${duplicates} dup)`, LOG_CTX.IMPORT);
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
    const all    = this.getAllRecords();
    const ventas = all.filter(r => r.type === 'venta');
    const compras= all.filter(r => r.type === 'compra');
    const totalV = ventas.reduce( (s,r) => s + (r.amount  || 0), 0);
    const totalC = compras.reduce((s,r) => s + Math.abs(r.amount || 0), 0);
    const byMonth = {};
    all.forEach(r => {
      const key = (r.date || '').slice(0, 7) || 'unknown';
      if (!byMonth[key]) byMonth[key] = { ventas: 0, compras: 0, count: 0 };
      if (r.type === 'venta')  { byMonth[key].ventas  += r.amount  || 0; byMonth[key].count++; }
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
    LogService.warn('VintedSalesDB: historial borrado', LOG_CTX.IMPORT);
  },
};

// ─── 8. Log de importaciones ──────────────────────────────────────────────────
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
