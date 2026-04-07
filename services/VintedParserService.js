/**
 * VintedParserService.js — Sprint 11
 *
 * [ARCHITECT] + [DATA_SCIENTIST] + [QA_ENGINEER]
 *
 * Cambios Sprint 11:
 * - inferCategoryFromTitle(): clasificador de 8 categorías por regex sobre título
 * - mapToInventoryProduct(): detectCategory(DB) → inferCategoryFromTitle() → 'Otros'
 * - mapToInventoryProduct(): firstUploadDate=null para evitar TTS=0 falso
 * - mapToSaleRecord(): incluye category + subcategory para stats desglosadas
 * - matchHistoryToInventory(): _enrichedItems con categoría del producto matchado
 */

import { MMKV } from 'react-native-mmkv';
import { DatabaseService } from './DatabaseService';
import LogService, { LOG_CTX } from './LogService';

// ─── Storage ──────────────────────────────────────────────────────────────────
const storage = new MMKV({ id: 'vinted-parser' });

const KEYS = {
  SALES_HISTORY: 'vinted_sales_history',
  IMPORT_LOG:    'import_log',
};

const MIN_VALID_PRICE = 0.01;

// ─── Helper ───────────────────────────────────────────────────────────────────
function genId() {
  return `vsr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ─── 0. Inferencia de categoría desde título ──────────────────────────────────
/**
 * [DATA_SCIENTIST] Sprint 11
 * Clasificador de categorías por regex sobre el título del producto.
 * Se usa como fallback cuando DatabaseService.detectCategory() no encuentra match
 * en el diccionario local del usuario.
 *
 * Cobertura validada contra JSONs reales de historial de ventas del usuario.
 */
function inferCategoryFromTitle(title) {
  if (!title) return { category: 'Otros', subcategory: null };
  const t = title.toLowerCase();

  // ── Videojuegos ──────────────────────────────────────────────────────────
  if (/\b(zelda|mario|kirby|pokemon|splatoon|pikmin|xenoblade|donkey kong|metroid|switch|xbox|playstation|ps[234]|nintendo|game boy|wii|gamecube|nds|3ds|steam|hyrule|warriors|strikers)\b/.test(t)) {
    let sub = null;
    if (/switch/.test(t) || /zelda|mario|kirby|pokemon|splatoon|pikmin|xenoblade|donkey kong|hyrule|strikers/.test(t)) sub = 'Nintendo Switch';
    if (/xbox/.test(t)) sub = 'Xbox';
    if (/playstation|ps[234]/.test(t)) sub = 'PlayStation';
    if (/game boy|gameboy/.test(t)) sub = 'Game Boy';
    return { category: 'Videojuegos', subcategory: sub };
  }

  // ── Libros ───────────────────────────────────────────────────────────────
  if (/\b(libro|cuento|lectura|novela|comic|editorial|coleccion|educativo|escolar|interactivo|calculo|financiero|teoria|ejercicios|patrulla canina|ovejita|pepo)\b/.test(t)) {
    let sub = null;
    if (/infantil|niño|peque|cuento|patrulla|ovejita|pepo|interactivo/.test(t)) sub = 'Infantil';
    else if (/calculo|financiero|teoria|escolar|educativo/.test(t)) sub = 'Educativo';
    return { category: 'Libros', subcategory: sub };
  }

  // ── Ropa niño ────────────────────────────────────────────────────────────
  if (/\b(talla \d|talla [0-9][-–][0-9]|años|meses|talla [0-9]{2}|anorak|sudadera|pijama|abrigo|chaqueta|camiseta|pantalon|body|babero|pack ropa|pack invierno|pack pijama|pack sudadera|gorro|jersey)\b/.test(t)) {
    let sub = null;
    if (/anorak|abrigo|chaqueta|acolchado/.test(t)) sub = 'Abrigos';
    else if (/sudadera/.test(t)) sub = 'Sudaderas';
    else if (/pijama/.test(t)) sub = 'Pijamas';
    else if (/pack invierno|pack ropa|pack pijama|pack sudadera|pack/.test(t)) sub = 'Packs';
    else if (/gorro/.test(t)) sub = 'Accesorios';
    return { category: 'Ropa Niño', subcategory: sub };
  }

  // ── Calzado ──────────────────────────────────────────────────────────────
  if (/\b(zapato|zapatilla|sandalia|bota|calzado|nike|adidas|skechers|converse|tenis|vestir talla)\b/.test(t)) {
    let sub = null;
    if (/zapatilla|skechers|nike|adidas|converse|tenis/.test(t)) sub = 'Zapatillas';
    else if (/zapato|vestir/.test(t)) sub = 'Zapatos';
    else if (/sandalia/.test(t)) sub = 'Sandalias';
    else if (/bota/.test(t)) sub = 'Botas';
    return { category: 'Calzado', subcategory: sub };
  }

  // ── Juegos de mesa (antes que Juguetes para mayor precisión) ─────────────
  if (/\b(juego de mesa|goula|ravensburger|headu|orchard|3 little pigs|happy chickens|parchis|dominó|ajedrez|memoria)\b/.test(t)) {
    return { category: 'Juguetes', subcategory: 'Juegos de mesa' };
  }

  // ── Juguetes ─────────────────────────────────────────────────────────────
  if (/\b(juguete|puzzle|playmobil|lego|muñeco|muñeca|figura|peluche|cochecito|coche|bebe|montessori|kinder|maletín|médico|doctor|autobus|autobús|dinosaurio|coches)\b/.test(t)) {
    let sub = null;
    if (/puzzle/.test(t)) sub = 'Puzzles';
    else if (/playmobil|lego|figura|kinder/.test(t)) sub = 'Figuras';
    else if (/montessori/.test(t)) sub = 'Educativo';
    else if (/maletín|médico|doctor/.test(t)) sub = 'Juego simbólico';
    else if (/autobus|autobús|coche|coches/.test(t)) sub = 'Vehículos';
    return { category: 'Juguetes', subcategory: sub };
  }

  // ── Disfraces ────────────────────────────────────────────────────────────
  if (/\b(disfraz|disfra|costume|cavernicola|policia|vaquero|joker|superhero|batman|spiderman)\b/.test(t)) {
    return { category: 'Disfraces', subcategory: null };
  }

  // ── Electrónica ──────────────────────────────────────────────────────────
  if (/\b(lámpara|lampara|led|usb|webcam|cargador|auricular|altavoz|teclado|raton|electronico|cable|fhd|hd|4mp|batwing)\b/.test(t)) {
    let sub = null;
    if (/lámpara|lampara|led|luz|batwing/.test(t)) sub = 'Iluminación';
    else if (/webcam|camara/.test(t)) sub = 'Periféricos';
    return { category: 'Electrónica', subcategory: sub };
  }

  // ── Hogar / Almacenaje ───────────────────────────────────────────────────
  if (/\b(caja|almacenaje|organizador|estante|ikea|mueble|decoracion|lekman)\b/.test(t)) {
    return { category: 'Hogar', subcategory: 'Almacenaje' };
  }

  return { category: 'Otros', subcategory: null };
}

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

      // Detectar export completo de BBDD
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

// ─── 3. Parser JSON escaparate (Modo C) ──────────────────────────────────────
export function parseJsonProducts(text) {
  try {
    const raw = typeof text === 'string' ? JSON.parse(text) : text;
    const arr = Array.isArray(raw) ? raw : [raw];
    return arr
      .filter(p => p && (p.id || p.title))
      .map(p => ({
        ...p,
        id:            p.id || `vinted_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title: (() => {
                        const t = (p.title || '').trim();
                        if (t && t !== 'Producto sin título' && t !== 'Sin título') return t;
                        // Extraer título real de la description (formato: "Título real. Marca: X")
                        const desc = (p.description || '').trim();
                        if (desc) {
                          const firstPart = desc.split('. Marca:')[0].trim();
                          if (firstPart.length > 5) return firstPart;
                          const firstSentence = desc.split('.')[0].trim();
                          if (firstSentence.length > 5) return firstSentence;
                        }
                        return 'Sin título';
                      })(),
        brand:         (p.brand       || 'Genérico').trim(),
        price:         Math.max(0, parseFloat(p.price) || 0),
        description:   (p.description || p.title || '').trim(),
        images:        Array.isArray(p.images) ? p.images : (p.images ? [p.images] : []),
        status:        p.status === 'sold' ? 'sold' : 'available',
        views:         parseInt(p.views)     || 0,
        favorites:     parseInt(p.favorites) || 0,
        soldDate:      p.soldDate     || null,
        soldDateReal:  p.soldDateReal || p.soldDate || null,
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
        if ((r.type || '').toLowerCase() === 'compra') return false;
        const amt = parseFloat(r.amount || 0);
        if (amt <= 0) { filteredNegative++; return false; }
        return true;
      })
      .map(r => {
        const amt       = parseFloat(r.amount || 0);
        const soldPrice = Math.max(MIN_VALID_PRICE, parseFloat(r.soldPriceReal || 0) || amt);
        return {
          orderId:       String(r.orderId),
          title:         (r.title || 'Artículo desconocido').trim(),
          amount:        amt,
          soldPriceReal: soldPrice,
          type:          r.type   || 'venta',
          status:        r.status || 'completada',
          date:          r.date   || null,
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

        const rawSoldPrice  = parseFloat(r.soldPriceReal || 0) || Math.abs(amt);
        const soldPriceReal = typ === 'venta'
          ? Math.max(MIN_VALID_PRICE, rawSoldPrice)
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

// ─── 6. matchHistoryToInventory ───────────────────────────────────────────────
/**
 * [ARCHITECT] + [DATA_SCIENTIST] + [QA_ENGINEER]
 *
 * Sprint 8:   usa DatabaseService.updateSaleData() (bypass MANUAL_FIELDS)
 * Sprint 9:   filtra soldPriceReal <= 0 antes de actualizar
 * Sprint 11:  _enrichedItems con category/subcategory del producto matchado
 *             para que VintedSalesDB guarde SaleRecords con categoría correcta
 */
export function matchHistoryToInventory(saleItems) {
  const result = {
    matched: 0,
    created: 0,
    skipped: 0,
    errors: 0,
    filteredNegative: 0,
    _enrichedItems: [],   // [Sprint 11] items enriquecidos con categoría para el caller
  };

  try {
    const allProducts = DatabaseService.getAllProducts();

    const normalize = (s) => (s || '')
      .toLowerCase()
      .replace(/\p{Emoji}/gu, '')
      .replace(/[^\w\sáéíóúüñ]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Índice por título normalizado
    const titleIndex = new Map();
    allProducts.forEach((p, idx) => {
      const key = normalize(p.title);
      if (key.length < 3) return;
      if (!titleIndex.has(key)) titleIndex.set(key, []);
      titleIndex.get(key).push(idx);
    });

    // Índice por orderId embebido en product.id (formato "vinted_XXXXXXXXXXX")
    const orderIdIndex = new Map();
    allProducts.forEach((p, idx) => {
      const m = String(p.id).match(/(\d{8,})/);
      if (m) orderIdIndex.set(m[1], idx);
    });

    const updatedSet = new Set();

    saleItems.forEach(item => {
      // Ignorar compras
      if (!item.orderId || item.type === 'compra') {
        result.skipped++;
        return;
      }

      // [QA_ENGINEER] Filtrar precios inválidos
      if (!item.soldPriceReal || item.soldPriceReal <= 0) {
        result.filteredNegative++;
        LogService.add(
          `⛔ matchHistory: "${item.title}" descartado — soldPriceReal inválido (${item.soldPriceReal})`,
          'warn',
        );
        return;
      }

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

        // Sin match → crear producto nuevo
        if (matchIdx === -1) {
          const newProd = mapToInventoryProduct(item);
          DatabaseService.importFromVinted([newProd]);
          // [Sprint 11] Enriquecer con la categoría inferida para el SaleRecord
          result._enrichedItems.push({
            ...item,
            category:    newProd.category,
            subcategory: newProd.subcategory,
          });
          result.created++;
          return;
        }

        if (!updatedSet.has(matchIdx)) {
          const prod = allProducts[matchIdx];

          // [Sprint 11] Propagar categoría del producto inventario al SaleRecord
          const enrichedItem = {
            ...item,
            category:    prod.category    || item.category    || null,
            subcategory: prod.subcategory || item.subcategory || null,
          };
          result._enrichedItems.push(enrichedItem);

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
      `✅ matchHistory: ${result.matched} matches · ${result.created} creados · ` +
      `${result.skipped} skip · ${result.filteredNegative} filtrados(precio≤0) · ${result.errors} err`,
      'success',
    );
  } catch (e) {
    LogService.error('matchHistoryToInventory', LOG_CTX.IMPORT, e);
    result.errors++;
  }

  return result;
}

// ─── 7. Mappers ──────────────────────────────────────────────────────────────

/**
 * [DATA_SCIENTIST] Sprint 11
 *
 * Cambios vs Sprint 9:
 * 1. Inferencia de categoría: detectCategory(DB tags) → inferCategoryFromTitle() → 'Otros'
 * 2. firstUploadDate: null (no contamina calcTTS con TTS=0 falso)
 *    El usuario puede editarlo manualmente en SoldEditDetailView.
 */
export function mapToInventoryProduct(item) {
  const now = new Date().toISOString();
  const safePrice = Math.max(MIN_VALID_PRICE, Math.abs(item.soldPriceReal || item.amount || 0));

  // Inferencia de categoría — 3 niveles de fallback
  let category    = item.category    || null;
  let subcategory = item.subcategory || null;

  if (!category) {
    // Nivel 1: detectCategory de DatabaseService (usa los tags del diccionario del usuario)
    const detected = DatabaseService.detectCategory(item.title, item.brand || '');
    if (detected) {
      category = detected;
      // subcategory permanece null — el diccionario legacy no la infiere
    } else {
      // Nivel 2: clasificador por palabras clave sobre el título
      const inferred = inferCategoryFromTitle(item.title);
      category    = inferred.category;
      subcategory = inferred.subcategory;
    }
  }

  return {
    id:              `vinted_${item.orderId}`,
    title:           item.title,
    brand:           item.brand || '',
    price:           safePrice,
    description:     '',
    images:          item.imageUrl ? [item.imageUrl] : [],
    status:          'sold',
    views:           0,
    favorites:       0,
    soldDate:        item.soldDateReal || item.date || now,
    soldDateReal:    item.soldDateReal || item.date || null,
    soldPriceReal:   safePrice,
    // [DATA_SCIENTIST] FIX Sprint 11: firstUploadDate = null si no lo conocemos.
    // calcTTS() devuelve null → no contamina avgTTS con TTS=0 falso.
    // El usuario puede editar firstUploadDate manualmente en SoldEditDetailView.
    createdAt:       item.soldDateReal || item.date || now,
    firstUploadDate: item.firstUploadDate || null,
    category,
    subcategory,
    isBundle:        item.isBundle || false,
    priceHistory:    [],
    repostCount:     0,
    lastSync:        now,
    source:          `vinted_${item.sourceFormat}_import`,
  };
}

/**
 * [DATA_SCIENTIST] Sprint 11
 *
 * Cambio vs Sprint 9: incluye category + subcategory para que
 * VintedSalesDB.getStats() pueda desglosar por categoría en el futuro
 * y getMonthlyHistory() / getAnnualHistory() lo puedan consumir.
 */
export function mapToSaleRecord(item) {
  const now = new Date().toISOString();
  const safePrice = Math.max(MIN_VALID_PRICE, Math.abs(item.soldPriceReal || item.amount || 0));
  return {
    id:            genId(),
    orderId:       item.orderId,
    title:         item.title,
    amount:        item.amount,
    soldPriceReal: safePrice,
    soldDateReal:  item.soldDateReal || item.date || null,
    type:          item.type,
    date:          item.date || now,
    imageUrl:      item.imageUrl || null,
    status:        item.status,
    // [Sprint 11] Categoría para stats desglosadas
    category:      item.category    || null,
    subcategory:   item.subcategory || null,
    importedAt:    now,
    sourceFormat:  item.sourceFormat,
  };
}

// ─── 8. VintedSalesDB — Historial económico (MMKV) ───────────────────────────
export const VintedSalesDB = {

  saveRecords(records) {
    try {
      const raw      = storage.getString(KEYS.SALES_HISTORY);
      const existing = raw ? JSON.parse(raw) : [];
      const existIds = new Set(existing.map(r => r.orderId));
      let inserted = 0, duplicates = 0, filteredNeg = 0;
      const merged = [...existing];

      records.forEach(r => {
        // [QA_ENGINEER] No guardar ventas con precio inválido
        if (r.type === 'venta' && (!r.soldPriceReal || r.soldPriceReal <= 0)) {
          if (!r.amount || r.amount <= 0) { filteredNeg++; return; }
          r.soldPriceReal = Math.abs(r.amount);
        }
        if (existIds.has(r.orderId)) {
          duplicates++;
        } else {
          merged.push(r);
          existIds.add(r.orderId);
          inserted++;
        }
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
   * [DATA_SCIENTIST] getStats()
   *
   * Sprint 9 fix: usaba r.date en lugar de r.soldDateReal para agrupar por mes.
   * Sprint 11:    usa soldPriceReal (no amount) para ingresos — más preciso.
   */
  getStats() {
    const all     = this.getAllRecords();
    const ventas  = all.filter(r => r.type === 'venta');
    const compras = all.filter(r => r.type === 'compra');

    const totalV = ventas.reduce((s, r)  => s + Math.max(0, r.soldPriceReal || r.amount || 0), 0);
    const totalC = compras.reduce((s, r) => s + Math.abs(r.amount || 0), 0);

    const byMonth = {};
    const byYear  = {};

    all.forEach(r => {
      // [Sprint 9 FIX] usar soldDateReal primero para agrupar
      const dateStr  = r.soldDateReal || r.date || '';
      const monthKey = dateStr.slice(0, 7) || 'unknown';
      const yearKey  = dateStr.slice(0, 4) || 'unknown';

      if (!byMonth[monthKey]) byMonth[monthKey] = { ventas: 0, compras: 0, count: 0, revenue: 0 };
      if (!byYear[yearKey])   byYear[yearKey]   = { ventas: 0, compras: 0, count: 0, revenue: 0 };

      if (r.type === 'venta') {
        const v = Math.max(0, r.soldPriceReal || r.amount || 0);
        byMonth[monthKey].ventas  += v;
        byMonth[monthKey].revenue += v;
        byMonth[monthKey].count++;
        byYear[yearKey].ventas    += v;
        byYear[yearKey].revenue   += v;
        byYear[yearKey].count++;
      }
      if (r.type === 'compra') {
        const c = Math.abs(r.amount || 0);
        byMonth[monthKey].compras += c;
        byMonth[monthKey].count++;
        byYear[yearKey].compras   += c;
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
   * [DATA_SCIENTIST] getAnnualStats()
   * Retorna array ordenado de años para AdvancedStatsScreen tab "Por Año".
   */
  getAnnualStats() {
    const stats = this.getStats();
    return Object.entries(stats.byYear)
      .filter(([y]) => y !== 'unknown' && y.length === 4)
      .map(([year, d]) => ({
        year:        parseInt(year),
        label:       year,
        ingresos:    +(d.ventas.toFixed(2)),
        gastos:      +(d.compras.toFixed(2)),
        balance:     +((d.ventas - d.compras).toFixed(2)),
        totalVentas: d.count,
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