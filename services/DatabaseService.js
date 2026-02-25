import Constants from 'expo-constants';
import { MMKV } from 'react-native-mmkv';
import LogService, { LOG_CTX } from './LogService';

// ─────────────────────────────────────────────
// STORAGE KEYS
// ─────────────────────────────────────────────
const KEYS = {
  PRODUCTS:        'products',
  CONFIG:          'app_user_config',
  DICTIONARY:      'custom_dictionary',       // formato legacy (array de strings por categoría)
  FULL_DICTIONARY: 'custom_dictionary_full',  // formato nuevo (con subcategorías)
  IMPORT_LOG:      'import_log',              // historial de importaciones
};

// ─────────────────────────────────────────────
// CAMPOS MANUALES — NUNCA sobreescribir en import
// ─────────────────────────────────────────────
/**
 * Lista de campos que el usuario edita a mano y que el JSON de Vinted
 * no puede sobreescribir, aunque el producto cambie de precio, ID, etc.
 *
 * Activos:
 *   - category / subcategory: asignada manualmente
 *   - firstUploadDate:        fecha real de subida (el JSON trae la de extracción)
 *   - seoTags:                tags generados o editados manualmente
 *
 * Vendidos (campos extra):
 *   - soldPrice:    precio final real de venta
 *   - soldDate:     fecha real de cierre
 *   - isBundle:     si fue vendido en lote
 */
const MANUAL_FIELDS_ACTIVE = ['category', 'subcategory', 'firstUploadDate'];
const MANUAL_FIELDS_SOLD   = ['soldPrice', 'soldDate', 'isBundle', 'category', 'subcategory', 'firstUploadDate'];

// ─────────────────────────────────────────────
// DEFAULTS
// ─────────────────────────────────────────────
const DEFAULT_CONFIG = {
  // Umbrales de diagnóstico (días)
  daysInvisible:          '60',
  viewsInvisible:         '20',
  daysDesinterest:        '45',
  daysCritical:           '90',
  // TTS speed buckets
  ttsLightning:           '7',
  ttsAnchor:              '30',
  priceBoostPct:          '10',
  priceCutPct:            '10',
  // Inteligencia de estancamiento
  staleMultiplier:        '1.5',
  criticalMonthThreshold: '6',
  // Importación
  preserveCategory:       true,
  preserveUploadDate:     true,
  preserveSoldPrice:      true,
  preserveSoldDate:       true,
  preserveIsBundle:       true,
  autoDetectCategory:     true,
  autoGenerateSeoTags:    true,
  // Notificaciones
  notifEnabled:           true,
  notifDays:              '3',
  notifCritical:          true,
  notifStale:             true,
  notifSeasonal:          true,
  notifOpportunity:       true,
  // Calendario estacional — ARRAY por mes (multiples categorías)
  seasonalMap: {
    0:  ['Juguetes'],           // Enero  – post-reyes
    1:  ['Ropa'],               // Feb    – San Valentín
    2:  ['Calzado'],            // Marzo  – primavera
    3:  ['Accesorios'],         // Abril
    4:  ['Calzado'],            // Mayo   – verano
    5:  ['Entretenimiento'],    // Junio
    6:  ['Lotes'],              // Julio  – rebajas
    7:  ['Juguetes'],           // Agosto – vuelta al cole
    8:  ['Ropa'],               // Sep    – otoño
    9:  ['Disfraces'],          // Oct    – Halloween
    10: ['Juguetes'],           // Nov    – Black Friday
    11: ['Juguetes'],           // Dic    – Navidad
  },
};

const DEFAULT_DICTIONARY_LEGACY = {
  'Juguetes':        ['tuc tuc', 'lego', 'playmobil', 'muñeca', 'juguete', 'aeropuerto', 'coche', 'pista', 'tren', 'barco', 'avión', 'peluche'],
  'Ropa':            ['abrigo', 'chaqueta', 'parka', 'plumífero', 'gabardina', 'sfera', 'zara', 'bershka', 'h&m', 'mango', 'pull&bear', 'stradivarius', 'primark'],
  'Lotes':           ['lote', 'pack', 'conjunto', 'set'],
  'Calzado':         ['zapatos', 'zapatillas', 'botas', 'deportivas', 'tenis', 'sandalias'],
  'Entretenimiento': ['videojuegos', 'juego de mesa', 'dados', 'cartas', 'muñecos', 'coleccionables', 'figuras', 'puzzles', 'rompecabezas', 'drones'],
  'Disfraces':       ['disfraz', 'carnaval', 'halloween', 'cosplay', 'traje'],
  'Libros':          ['libro', 'novela', 'cómic', 'manual', 'guía'],
  'Accesorios':      ['bolso', 'cartera', 'cinturón', 'gorro', 'bufanda', 'guantes', 'joyería', 'reloj'],
  'Otros':           [],
};

// ─────────────────────────────────────────────
// HELPERS (pure functions, no side effects)
// ─────────────────────────────────────────────

/** Días entre dos fechas ISO. Siempre ≥ 1. */
export function daysBetween(isoA, isoB) {
  if (!isoA || !isoB) return 0;
  return Math.max(1, Math.round((new Date(isoB) - new Date(isoA)) / 86_400_000));
}

/** Días desde una fecha ISO hasta hoy. */
export function daysFromNow(isoDate) {
  if (!isoDate) return 0;
  return daysBetween(isoDate, new Date().toISOString());
}

/**
 * Calcula el TTS (Time-to-Sell) de un producto.
 * Usa firstUploadDate > createdAt como fecha de origen.
 * Usa soldDate > soldAt como fecha de venta.
 */
export function calcTTS(product) {
  const start = product.firstUploadDate || product.createdAt;
  const end   = product.soldDate       || product.soldAt;
  if (!start || !end) return null;
  return daysBetween(start, end);
}

/**
 * Clasifica un TTS en velocidad de venta.
 * Usa los umbrales configurables si se pasan.
 */
export function ttsLabel(avgTTS, config) {
  const lightning = parseInt(config?.ttsLightning || 7);
  const anchor    = parseInt(config?.ttsAnchor    || 30);
  if (avgTTS <= lightning)  return { emoji: '⚡', label: 'RELÁMPAGO', color: '#00D9A3', advice: `Sube el precio un ${config?.priceBoostPct || 10}%` };
  if (avgTTS <= anchor)     return { emoji: '🟡', label: 'NORMAL',    color: '#FFB800', advice: 'Mantén precio, mejora fotos/título' };
  return                           { emoji: '⚓', label: 'ANCLA',     color: '#E63946', advice: `Baja precio un ${config?.priceCutPct || 10}% o republica` };
}

/**
 * Devuelve la severidad de un producto activo según días en stock.
 */
export function getProductSeverity(daysOld, views, favorites, config) {
  const cfg = config || DEFAULT_CONFIG;
  const limitInvisible   = parseInt(cfg.daysInvisible   || 60);
  const limitDesinterest = parseInt(cfg.daysDesinterest  || 45);
  const limitCritical    = parseInt(cfg.daysCritical     || 90);
  const viewsLimit       = parseInt(cfg.viewsInvisible   || 20);

  if (daysOld >= limitCritical)
    return { type: 'CRÍTICO',    color: '#E63946', icon: 'alert-circle',  msg: 'Republicar urgente',       priority: 4 };
  if (daysOld >= limitInvisible && views < viewsLimit)
    return { type: 'INVISIBLE',  color: '#888888', icon: 'eye-off',       msg: `Bajas vistas (<${viewsLimit})`, priority: 3 };
  if (daysOld >= limitDesinterest && favorites === 0 && views > viewsLimit)
    return { type: 'DESINTERÉS', color: '#FF6B35', icon: 'trending-down', msg: 'Revisar precio/desc',      priority: 2 };
  if (daysOld >= 30 && favorites > 8)
    return { type: 'CASI LISTO', color: '#00D9A3', icon: 'zap',           msg: 'Haz una oferta ahora',    priority: 1 };
  return null;
}

/**
 * Intenta detectar si un producto del JSON actualizado es una resubida
 * de uno ya existente (mismo título + misma marca pero ID diferente).
 */
function detectRepost(existingProducts, newProduct) {
  const normTitle = (s) => (s || '').toLowerCase().trim();
  const t1 = normTitle(newProduct.title);
  const b1 = normTitle(newProduct.brand);
  if (!t1 || t1 === 'producto') return null;
  return existingProducts.find(p =>
    String(p.id) !== String(newProduct.id) &&
    normTitle(p.title) === t1 &&
    normTitle(p.brand) === b1 &&
    p.status !== 'sold'
  ) || null;
}

// ─────────────────────────────────────────────
// STORAGE INIT
// ─────────────────────────────────────────────
let storage;
try {
  storage = new MMKV();
  LogService.add('🚀 MMKV iniciado', 'info');
} catch (e) {
  LogService.add('❌ Fallo crítico MMKV: ' + e.message, 'error');
}
// ─────────────────────────────────────────────
// PRODUCCION O DESARROLLO  
// ─────────────────────────────────────────────
export const getEnv = () => {
  // __DEV__ es una variable global de React Native que es true 
  // cuando corres la app localmente y false cuando es una build de producción
  if (__DEV__) return 'development';
  
  // Si no es dev, revisamos el owner o el perfil de EAS
  const isPreview = Constants.expoConfig.releaseChannel === 'preview';
  return isPreview ? 'preview' : 'production';
};

const ENV = getEnv();

// ─────────────────────────────────────────────
// DATABASE SERVICE
// ─────────────────────────────────────────────
export class DatabaseService {

  // ── CONFIG ──────────────────────────────────

  static getConfig() {
    try {
      const raw = storage.getString(KEYS.CONFIG);
      const saved = raw ? JSON.parse(raw) : {};

    if (ENV === 'development') {
        console.log("🛠️ Estás en modo Desarrollo");
    }
    else if (ENV === 'preview') { 
        console.log("👀 Estás en modo Preview") ;
    }


      // Normalizar seasonalMap: garantizar arrays
      if (saved.seasonalMap) {
        for (let i = 0; i < 12; i++) {
          const val = saved.seasonalMap[i];
          if (!Array.isArray(val)) {
            saved.seasonalMap[i] = val ? [val] : [];
          }
        }
      }
      return { ...DEFAULT_CONFIG, ...saved };
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  }

  static saveConfig(config) {
    try {
      storage.set(KEYS.CONFIG, JSON.stringify(config));
      LogService.add('⚙️ Configuración guardada', 'info');
      return true;
    } catch (e) {
      LogService.add('❌ Error al guardar config: ' + e.message, 'error');
      return false;
    }
  }

  // ── DICTIONARY (LEGACY + FULL) ───────────────

  /** Formato legacy: { category: [tag, tag, ...] } — usado por detectCategory */
  static getDictionary() {
    try {
      const raw = storage.getString(KEYS.DICTIONARY);
      return raw ? JSON.parse(raw) : { ...DEFAULT_DICTIONARY_LEGACY };
    } catch {
      return { ...DEFAULT_DICTIONARY_LEGACY };
    }
  }

  static saveDictionary(dict) {
    try {
      storage.set(KEYS.DICTIONARY, JSON.stringify(dict));
      LogService.add('📚 Diccionario (legacy) actualizado', 'info');
      return true;
    } catch (e) {
      LogService.add('❌ Error diccionario legacy: ' + e.message, 'error');
      return false;
    }
  }

  /** Formato completo: { category: { tags: [], subcategories: { name: { tags: [] } } } } */
  static getFullDictionary() {
    try {
      const raw = storage.getString(KEYS.FULL_DICTIONARY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  static saveFullDictionary(dict) {
    try {
      storage.set(KEYS.FULL_DICTIONARY, JSON.stringify(dict));
      LogService.add('📚 Diccionario (full) actualizado', 'info');
      return true;
    } catch (e) {
      LogService.add('❌ Error diccionario full: ' + e.message, 'error');
      return false;
    }
  }

  /**
   * Detecta categoría usando el diccionario legacy (flat tags).
   * También comprueba subcategorías si está disponible el diccionario full.
   * Devuelve { category, subcategory }.
   */
  static detectCategory(text) {
    if (!text) return { category: 'Otros', subcategory: null };
    const dict  = this.getDictionary();
    const lower = text.toLowerCase();

    // 1. Buscar en diccionario legacy
    for (const [cat, kws] of Object.entries(dict)) {
      if (kws.some(k => lower.includes(k.toLowerCase()))) {
        // 2. Intentar afinar con subcategorías (diccionario full)
        const full = this.getFullDictionary();
        if (full && full[cat]?.subcategories) {
          for (const [sub, subData] of Object.entries(full[cat].subcategories)) {
            if ((subData.tags || []).some(k => lower.includes(k.toLowerCase()))) {
              return { category: cat, subcategory: sub };
            }
          }
        }
        return { category: cat, subcategory: null };
      }
    }
    return { category: 'Otros', subcategory: null };
  }

  static addKeywordToDictionary(category, keyword) {
    try {
      const dict = this.getDictionary();
      if (!dict[category]) dict[category] = [];
      const kw = keyword.toLowerCase().trim();
      if (!dict[category].includes(kw)) {
        dict[category].push(kw);
        this.saveDictionary(dict);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Devuelve los tags de una categoría (y subcategoría opcional) del diccionario full.
   * Reemplaza la función generateSEOTags — ya no usamos SEO tags como campo.
   */
  static getCategoryTags(category, subcategory) {
    const full    = this.getFullDictionary();
    const legacy  = this.getDictionary();
    if (full && full[category]) {
      const catTags = full[category].tags || [];
      const subTags = subcategory ? (full[category].subcategories?.[subcategory]?.tags || []) : [];
      return [...new Set([...catTags, ...subTags])];
    }
    return legacy[category] || [];
  }

  // ── PRODUCTS BASE ────────────────────────────

  static getAllProducts() {
    try {
      const raw = storage.getString(KEYS.PRODUCTS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  static saveAllProducts(products) {
    try {
      storage.set(KEYS.PRODUCTS, JSON.stringify(products));
      return true;
    } catch (e) {
      LogService.add('❌ Error al guardar productos: ' + e.message, 'error');
      return false;
    }
  }

  // Alias para compatibilidad
  static saveProducts(products) { return this.saveAllProducts(products); }

  static updateProduct(updated) {
    try {
      const all = this.getAllProducts();
      const idx = all.findIndex(p => String(p.id) === String(updated.id));
      if (idx === -1) return false;
      // Preservar campos manuales en update manual
      all[idx] = {
        ...all[idx],
        ...updated,
        category:        updated.category        || all[idx].category,
        subcategory:     updated.subcategory      ?? all[idx].subcategory,
        firstUploadDate: updated.firstUploadDate  || all[idx].firstUploadDate,
        seoTags:         updated.seoTags          || all[idx].seoTags,
      };
      this.saveAllProducts(all);
      LogService.add(`✏️ Actualizado: ${all[idx].title}`, 'success');
      return true;
    } catch (e) {
      LogService.add('❌ Error al actualizar: ' + e.message, 'error');
      return false;
    }
  }

  static deleteProduct(productId) {
    try {
      const all = this.getAllProducts().filter(p => String(p.id) !== String(productId));
      this.saveAllProducts(all);
      LogService.add(`🗑️ Producto ${productId} eliminado`, 'info');
      return true;
    } catch {
      return false;
    }
  }

  static markAsRepublicated(productId) {
    try {
      const all = this.getAllProducts();
      const idx = all.findIndex(p => String(p.id) === String(productId));
      if (idx === -1) return false;
      all[idx].firstUploadDate = new Date().toISOString();
      all[idx].lastActivity    = new Date().toISOString();
      all[idx].repostCount     = (all[idx].repostCount || 0) + 1;
      all[idx].lastRepostDate  = new Date().toISOString();
      this.saveAllProducts(all);
      LogService.add(`🔄 Resubido: ${all[idx].title}`, 'success');
      return true;
    } catch {
      return false;
    }
  }

  static markAsSold(productId, soldPrice, soldDate, isBundle) {
    try {
      const all = this.getAllProducts();
      const idx = all.findIndex(p => String(p.id) === String(productId));
      if (idx === -1) return false;
      all[idx].status    = 'sold';
      all[idx].soldPrice = soldPrice != null ? soldPrice : (all[idx].soldPrice || all[idx].price);
      all[idx].soldDate  = soldDate  || all[idx].soldDate  || new Date().toISOString();
      all[idx].soldAt    = all[idx].soldDate;
      if (isBundle !== undefined) all[idx].isBundle = isBundle;
      this.saveAllProducts(all);
      LogService.add(`✅ Vendido: ${all[idx].title} por ${all[idx].soldPrice}€`, 'success');
      return true;
    } catch {
      return false;
    }
  }

  static updateProductSmart(productId, updates) {
    const all = this.getAllProducts();
    const idx = all.findIndex(p => String(p.id) === String(productId));
    if (idx === -1) return false;
    const old = all[idx];
    const priceHistory = old.priceHistory || [];
    if (updates.price && Number(updates.price) !== Number(old.price)) {
      priceHistory.push({ oldPrice: old.price, newPrice: updates.price, date: new Date().toISOString() });
    }
    all[idx] = { ...old, ...updates, priceHistory, lastActivity: new Date().toISOString() };
    return this.saveAllProducts(all);
  }

  // ── IMPORT INTELIGENTE ─────────────────────────────────────────────────────
  /**
   * Importa productos desde el JSON de Vinted (scraping).
   *
   * Reglas de fusión (por orden de prioridad):
   *
   * 1. Si el producto existe (mismo ID):
   *    — Actualiza campos de Vinted (precio, vistas, favoritos, status, descripción, imágenes)
   *    — PRESERVA campos manuales según config (category, firstUploadDate, soldPrice, soldDate, isBundle)
   *    — Si el precio ha cambiado → guarda en priceHistory
   *
   * 2. Si el producto NO existe por ID:
   *    a) Busca posible resubida (mismo título + marca, ID diferente)
   *       — Si la encuentra, vincula con repostOf + conserva historial del original
   *    b) Si no hay coincidencia → producto nuevo
   *       — Detecta categoría automáticamente (si config.autoDetectCategory)
   *       — Genera SEO tags (si config.autoGenerateSeoTags)
   *
   * 3. Productos que estaban en la BD pero no vienen en el JSON actualizado:
   *    — Se marcan como 'stale' para revisión manual (no se eliminan)
   *
   * Campos NUNCA sobreescritos en activos:   category, subcategory, firstUploadDate, seoTags
   * Campos NUNCA sobreescritos en vendidos:  + soldPrice, soldDate, isBundle
   */
  static importFromVinted(newProducts) {
    try {
      const config  = this.getConfig();
      const current = this.getAllProducts();
      const map     = new Map(current.map(p => [String(p.id), p]));
      const now     = new Date().toISOString();

      // IDs que llegan en el JSON nuevo
      const incomingIds = new Set(newProducts.map(p => String(p.id)));

      let created = 0, updated = 0, reposted = 0, priceChanged = 0;

      newProducts.forEach(p => {
        if (!p.id || String(p.id).includes('image')) return;
        const id  = String(p.id);
        const old = map.get(id);

        if (old) {
          // ─── PRODUCTO EXISTENTE: merge inteligente ────────────────────────
          const isSold      = old.status === 'sold' || p.status === 'sold';
          const manualFields = isSold ? MANUAL_FIELDS_SOLD : MANUAL_FIELDS_ACTIVE;
          const priceHistory = old.priceHistory || [];

          // Detectar cambio de precio
          if (Number(p.price) !== Number(old.price)) {
            priceHistory.push({
              oldPrice: old.price,
              newPrice: p.price,
              date: now,
              source: 'vinted_import',
            });
            priceChanged++;
          }

          // Detectar si volvió a estar activo (resubida detectada por Vinted)
          const wasReactivated = old.status === 'sold' && p.status === 'available';

          const merged = { ...old, ...p, id };

          // Restaurar campos manuales
          manualFields.forEach(field => {
            if (old[field] !== undefined && old[field] !== null && config[`preserve${capitalize(field)}`] !== false) {
              merged[field] = old[field];
            }
          });

          // firstUploadDate: el JSON siempre trae la fecha de extracción → ignorar
          if (config.preserveUploadDate && old.firstUploadDate) {
            merged.firstUploadDate = old.firstUploadDate;
          } else if (!merged.firstUploadDate) {
            merged.firstUploadDate = p.createdAt || now;
          }

          // Si fue reactivado, actualizar firstUploadDate solo si no hay una previa
          if (wasReactivated && !old.firstUploadDate) {
            merged.firstUploadDate = now;
          }

          merged.priceHistory = priceHistory;
          merged.lastSync     = now;

          map.set(id, merged);
          updated++;
        } else {
          // ─── PRODUCTO NUEVO: ¿es una resubida? ───────────────────────────
          const repostOriginal = detectRepost(current, p);
          const detected       = config.autoDetectCategory !== false
            ? this.detectCategory(`${p.title} ${p.description} ${p.brand}`)
            : { category: 'Otros', subcategory: null };

          const newEntry = {
            ...p,
            id,
            category:        detected.category,
            subcategory:     detected.subcategory,
            firstUploadDate: p.createdAt || now,
            isBundle:        false,
            soldPrice:       p.soldPrice || null,
            soldDate:        p.soldAt    || null,
            priceHistory:    [],
            status:          p.status || 'active',
            lastSync:        now,
          };

          if (repostOriginal) {
            // Vincular con el original
            newEntry.repostOf        = repostOriginal.id;
            newEntry.category        = repostOriginal.category        || newEntry.category;
            newEntry.subcategory     = repostOriginal.subcategory     || newEntry.subcategory;
            newEntry.firstUploadDate = repostOriginal.firstUploadDate || newEntry.firstUploadDate;
            newEntry.priceHistory    = repostOriginal.priceHistory    || [];
            // Marcar el original como resubido
            if (map.has(String(repostOriginal.id))) {
              const orig = map.get(String(repostOriginal.id));
              orig.repostTo     = id;
              orig.repostedAt   = now;
              orig.repostCount  = (orig.repostCount || 0) + 1;
              map.set(String(repostOriginal.id), orig);
            }
            reposted++;
          } else {
            created++;
          }

          map.set(id, newEntry);
        }
      });

      // Marcar productos no presentes en el JSON como 'stale' (no eliminar)
      map.forEach((product, id) => {
        if (!incomingIds.has(id) && product.status !== 'sold') {
          map.set(id, { ...product, stale: true, staleDetectedAt: product.staleDetectedAt || now });
        } else if (incomingIds.has(id)) {
          // Si vuelve a aparecer, ya no está stale
          const updated = map.get(id);
          if (updated.stale) {
            delete updated.stale;
            delete updated.staleDetectedAt;
            map.set(id, updated);
          }
        }
      });

      const final = Array.from(map.values());
      this.saveAllProducts(final);

      // Log de importación
      const importEntry = {
        date:         now,
        total:        final.length,
        incoming:     newProducts.length,
        created,
        updated,
        reposted,
        priceChanged,
      };
      this._addImportLog(importEntry);

      LogService.logImportResult({ success: true, count: final.length, created, updated, reposted, priceChanged });
      return { success: true, count: final.length, created, updated, reposted, priceChanged };
    } catch (e) {
      LogService.add('❌ Error en import: ' + e.message, 'error');
      return { success: false, error: e.message };
    }
  }

  static _addImportLog(entry) {
    try {
      const raw  = storage.getString(KEYS.IMPORT_LOG);
      const logs = raw ? JSON.parse(raw) : [];
      logs.unshift(entry);
      // Mantener solo los últimos 50 imports
      if (logs.length > 50) logs.length = 50;
      storage.set(KEYS.IMPORT_LOG, JSON.stringify(logs));
    } catch {/* silent */ }
  }

  static getImportLog() {
    try {
      const raw = storage.getString(KEYS.IMPORT_LOG);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  // ── ANALYTICS — FUENTE ÚNICA DE VERDAD ───────

  /**
   * Estadísticas por categoría basadas en productos VENDIDOS.
   * Incluye TTS medio, beneficio medio, conteo.
   */
  static getCategoryStats() {
    const config = this.getConfig();
    const sold   = this.getAllProducts().filter(p => p.status === 'sold');
    const map    = {};

    sold.forEach(p => {
      const cat    = p.category || 'Otros';
      const tts    = calcTTS(p);
      const profit = Number(p.soldPrice || p.price) - Number(p.price);

      if (!map[cat]) map[cat] = { count: 0, totalTTS: 0, totalProfit: 0, ttsList: [], subcategories: {} };
      map[cat].count++;
      map[cat].totalProfit += profit;
      if (tts !== null) {
        map[cat].totalTTS += tts;
        map[cat].ttsList.push(tts);
      }

      // Acumular subcategoría si existe
      if (p.subcategory) {
        const sub = p.subcategory;
        if (!map[cat].subcategories[sub]) map[cat].subcategories[sub] = { count: 0, totalTTS: 0, ttsList: [] };
        map[cat].subcategories[sub].count++;
        if (tts !== null) {
          map[cat].subcategories[sub].totalTTS += tts;
          map[cat].subcategories[sub].ttsList.push(tts);
        }
      }
    });

    return Object.entries(map).map(([name, d]) => {
      const avgTTS = d.ttsList.length ? Math.round(d.totalTTS / d.ttsList.length) : 999;
      const speed  = ttsLabel(avgTTS, config);

      // Subcategorías enriquecidas
      const subcategoryStats = Object.entries(d.subcategories).map(([sName, sd]) => {
        const sAvgTTS = sd.ttsList.length ? Math.round(sd.totalTTS / sd.ttsList.length) : 999;
        return { name: sName, count: sd.count, avgTTS: sAvgTTS, ...ttsLabel(sAvgTTS, config) };
      }).sort((a, b) => a.avgTTS - b.avgTTS);

      return {
        name,
        count:           d.count,
        avgTTS,
        totalProfit:     d.totalProfit,
        avgProfit:       d.count ? +(d.totalProfit / d.count).toFixed(2) : 0,
        subcategoryStats,
        ...speed,
      };
    }).sort((a, b) => a.avgTTS - b.avgTTS);
  }

  /**
   * Historial de ventas agrupado por mes.
   */
  static getMonthlyHistory() {
    const sold = this.getAllProducts().filter(p => p.status === 'sold');
    const map  = {};

    sold.forEach(p => {
      const date  = new Date(p.soldDate || p.soldAt || p.createdAt);
      const key   = `${date.getFullYear()}-${String(date.getMonth()).padStart(2,'0')}`;
      const label = date.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
      const profit = Number(p.soldPrice || p.price) - Number(p.price);

      if (!map[key]) map[key] = { key, label, month: date.getMonth(), year: date.getFullYear(), profit: 0, sales: 0, revenue: 0, bundles: 0 };
      map[key].profit  += profit;
      map[key].sales   += 1;
      map[key].revenue += Number(p.soldPrice || p.price);
      if (p.isBundle) map[key].bundles += 1;
    });

    return Object.values(map).sort((a, b) => b.key.localeCompare(a.key));
  }

  /**
   * KPIs globales del negocio.
   */
  static getBusinessKPIs() {
    const config = this.getConfig();
    const all     = this.getAllProducts();
    const sold    = all.filter(p => p.status === 'sold');
    const active  = all.filter(p => p.status !== 'sold');
    const now     = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const totalRevenue   = sold.reduce((s, p) => s + Number(p.soldPrice || p.price), 0);
    const totalProfit    = sold.reduce((s, p) => s + (Number(p.soldPrice || p.price) - Number(p.price)), 0);
    const totalViews     = all.reduce((s, p)  => s + Number(p.views     || 0), 0);
    const totalFavorites = all.reduce((s, p)  => s + Number(p.favorites || 0), 0);

    const soldThisMonth    = sold.filter(p => p.soldAt && new Date(p.soldAt) >= firstOfMonth).length;
    const revenueThisMonth = sold
      .filter(p => p.soldAt && new Date(p.soldAt) >= firstOfMonth)
      .reduce((s, p) => s + Number(p.soldPrice || p.price), 0);

    const ttsList = sold.map(p => calcTTS(p)).filter(Boolean);
    const avgTTS  = ttsList.length ? Math.round(ttsList.reduce((a, b) => a + b, 0) / ttsList.length) : 0;

    const catStats = this.getCategoryStats();
    const bestCat  = catStats[0] || null;
    const worstCat = catStats.length ? catStats[catStats.length - 1] : null;

    // Stale products count
    const staleCount = active.filter(p => p.stale).length;

    return {
      totalRevenue,
      totalProfit,
      totalViews,
      totalFavorites,
      soldCount:       sold.length,
      activeCount:     active.length,
      staleCount,
      soldThisMonth,
      revenueThisMonth,
      avgTTS,
      bestCat,
      worstCat,
    };
  }

  /**
   * Devuelve productos activos enriquecidos con diagnóstico.
   */
  static getActiveProductsWithDiagnostic() {
    const config  = this.getConfig();
    const active  = this.getAllProducts().filter(p => p.status !== 'sold');
    const now     = new Date();

    return active.map(p => {
      const uploadDate = new Date(p.firstUploadDate || p.createdAt || now);
      const daysOld    = Math.max(0, Math.floor((now - uploadDate) / 86_400_000));
      const views      = Number(p.views     || 0);
      const favorites  = Number(p.favorites || 0);
      const severity   = getProductSeverity(daysOld, views, favorites, config);

      const limitCritical    = parseInt(config.daysCritical    || 90);
      const limitDesinterest = parseInt(config.daysDesinterest || 45);

      return {
        ...p,
        daysOld,
        severity,
        isCritical: daysOld >= limitCritical,
        isCold:     daysOld >= limitDesinterest && daysOld < limitCritical,
        isHot:      (views > 50 || favorites > 10) && daysOld < 30,
      };
    });
  }

  /**
   * Alertas inteligentes — FUENTE ÚNICA para Dashboard y AdvancedStats.
   * Usa seasonalMap como array de categorías por mes.
   */
  static getSmartAlerts() {
    const config      = this.getConfig();
    const catStats    = this.getCategoryStats();
    const products    = this.getActiveProductsWithDiagnostic();
    const now         = new Date();
    const currentMonth = now.getMonth();
    const seasonalMap  = config.seasonalMap || DEFAULT_CONFIG.seasonalMap;
    const multiplier   = parseFloat(config.staleMultiplier        || 1.5);
    const criticalMos  = parseInt(config.criticalMonthThreshold   || 6);
    const alerts       = [];

    const catTTSMap = Object.fromEntries(catStats.map(c => [c.name, c.avgTTS]));

    // Categorías activas este mes (ahora es array)
    const seasonalCats = Array.isArray(seasonalMap[currentMonth])
      ? seasonalMap[currentMonth]
      : (seasonalMap[currentMonth] ? [seasonalMap[currentMonth]] : []);

    products.forEach(p => {
      const cat       = p.category || 'Otros';
      const catAvgTTS = catTTSMap[cat] || 30;

      // 1. ESTANCAMIENTO
      if (p.daysOld > catAvgTTS * multiplier) {
        alerts.push({
          type:      'stale',
          priority:  p.daysOld > catAvgTTS * multiplier * 2 ? 'high' : 'medium',
          productId: p.id,
          title:     p.title,
          message:   `Lleva ${p.daysOld}d. La media de ${cat} es ${catAvgTTS}d.`,
          action:    'REVISAR PRECIO',
          icon:      'clock',
        });
      }

      // 2. ESTACIONALIDAD (multi-categoría)
      if (seasonalCats.includes(cat)) {
        alerts.push({
          type:      'seasonal',
          priority:  'high',
          productId: p.id,
          title:     `🔥 Temporada de ${cat}`,
          message:   `${p.title} encaja con el mes actual. ¡Es el momento!`,
          action:    'REPUBLICAR / SUBIR',
          icon:      'zap',
        });
      }

      // 3. CRÍTICO
      if (p.daysOld > criticalMos * 30) {
        alerts.push({
          type:      'critical',
          priority:  'high',
          productId: p.id,
          title:     `CRÍTICO: ${p.title}`,
          message:   `Supera ${criticalMos} meses sin venderse.`,
          action:    'REPUBLICAR URGENTE',
          icon:      'alert-circle',
        });
      }

      // 4. OPORTUNIDAD
      if (p.favorites > 8 && p.daysOld > 20) {
        alerts.push({
          type:      'opportunity',
          priority:  'medium',
          productId: p.id,
          title:     `💡 Oportunidad: ${p.title}`,
          message:   `${p.favorites} personas lo han favoriteado. Haz una oferta.`,
          action:    'HACER OFERTA',
          icon:      'heart',
        });
      }
    });

    const order = { critical: 0, stale: 1, seasonal: 2, opportunity: 3 };
    return alerts.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority === 'high' ? -1 : 1;
      return (order[a.type] || 9) - (order[b.type] || 9);
    });
  }

  /**
   * Smart Insights: recomendaciones accionables de negocio.
   */
  static getSmartInsights() {
    const catStats     = this.getCategoryStats();
    const kpis         = this.getBusinessKPIs();
    const config       = this.getConfig();
    const now          = new Date();
    const currentMonth = now.getMonth();
    const seasonalMap  = config.seasonalMap || DEFAULT_CONFIG.seasonalMap;
    const monthNames   = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const insights     = [];

    if (catStats[0]) {
      insights.push({
        type:    'star',
        icon:    '⚡',
        title:   `${catStats[0].name} vende en ${catStats[0].avgTTS}d de media`,
        message: `Busca más stock de ${catStats[0].name}. ${catStats[0].advice}.`,
        color:   catStats[0].color,
      });
    }

    const anchor = catStats.find(c => c.avgTTS > parseInt(config.ttsAnchor || 30));
    if (anchor) {
      insights.push({
        type:    'anchor',
        icon:    '⚓',
        title:   `${anchor.name} tarda ${anchor.avgTTS}d en venderse`,
        message: `${anchor.advice}. Evalúa reducir stock de esta categoría.`,
        color:   '#E63946',
      });
    }

    // Multi-categorías estacionales
    const seasonalCats = Array.isArray(seasonalMap[currentMonth])
      ? seasonalMap[currentMonth]
      : (seasonalMap[currentMonth] ? [seasonalMap[currentMonth]] : []);

    if (seasonalCats.length > 0) {
      insights.push({
        type:    'seasonal',
        icon:    '📅',
        title:   `${monthNames[currentMonth]}: temporada de ${seasonalCats.join(' y ')}`,
        message: `Publica o republica tus ${seasonalCats.join(', ')} ahora para aprovechar la demanda estacional.`,
        color:   '#FFB800',
      });
    }

    const target = parseInt(config.ttsAnchor || 30) - 9; // 21 días por defecto
    if (kpis.avgTTS > 0) {
      if (kpis.avgTTS > target) {
        insights.push({
          type:    'benchmark',
          icon:    '📊',
          title:   `Tu TTS medio es ${kpis.avgTTS}d (objetivo: ${target}d)`,
          message: 'Mejora fotos y reduce precio inicial para acelerar las ventas.',
          color:   '#FF6B35',
        });
      } else {
        insights.push({
          type:    'benchmark',
          icon:    '🏆',
          title:   `¡TTS ${kpis.avgTTS}d! Por debajo del objetivo de ${target}d`,
          message: `Estás vendiendo muy bien. Prueba a subir los precios un ${config.priceBoostPct || 10}%.`,
          color:   '#00D9A3',
        });
      }
    }

    return insights;
  }

  // ── LEGACY COMPAT ────────────────────────────

  /** @deprecated Usa getBusinessKPIs() */
  static getStats() {
    const kpis = this.getBusinessKPIs();
    return { sold: kpis.soldThisMonth };
  }

  /** @deprecated Usa getCategoryStats() */
  static getAdvancedStats() {
    const cats = this.getCategoryStats();
    return Object.fromEntries(cats.map(c => [c.name, {
      count:      c.count,
      totalDiff:  c.totalProfit,
      totalDays:  c.avgTTS * c.count,
    }]));
  }

  // ── CLEAR / BACKUP ───────────────────────────

  static async clearDatabase() {
    storage.set(KEYS.PRODUCTS, JSON.stringify([]));
    LogService.add('🔥 Base de datos borrada', 'info');
    return true;
  }
}

// ─── Helpers privados ─────────────────────────────────────────────────────
function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
}
