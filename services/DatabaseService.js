/**
 * DatabaseService.js — Sprint 9.1
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [ORCHESTRATOR] FULL-TEAM · Sprint 9.1 — Fix + Rediseño KPIs
 *
 * [PRODUCT_OWNER] DECISIÓN DE NEGOCIO:
 *   En segunda mano NUNCA se vende por más del precio de coste.
 *   El "beneficio" (soldPrice - price) es siempre negativo o cero →
 *   MÉTRICA INÚTIL y confusa.
 *
 *   Nuevo modelo KPI para segunda mano:
 *     • recaudacion  → dinero real ingresado (soldPriceReal). MÉTRICA CLAVE.
 *     • avgPrecio    → precio medio de venta por categoría (útil para fijar precios).
 *     • rotacion     → cuántas unidades se han vendido / activas (% liquidación).
 *     • TTS          → sigue siendo el KPI principal de velocidad.
 *
 * [DATA_SCIENTIST] BUGS CORREGIDOS:
 *   BUG #1 — getMonthlyHistory() key usaba getMonth() sin +1
 *            → "2026-00" en lugar de "2026-01" para enero
 *   BUG #2 — soldAmt negativo: Math.max(0, ...) en todos los cálculos
 *   BUG #3 — Fecha inválida: isNaN(date) → return sin procesar
 *
 * [ARCHITECT] CAMBIOS DE SCHEMA:
 *   getCategoryStats():  totalProfit/avgProfit → totalRecaudacion/avgPrecio
 *   getMonthlyHistory(): profit/profit → recaudacion/recaudacion (ya no hay diff)
 *   getBusinessKPIs():   totalProfit → eliminado; totalRecaudacion + rotacion
 *   getAnnualHistory():  profit → recaudacion
 *   groupByYear():       profit → recaudacion (client-side en AdvancedStats)
 *
 * [LIBRARIAN] COMPATIBILIDAD:
 *   Los campos legacy totalProfit/avgProfit se eliminan del contrato público.
 *   SoldHistoryScreen, AdvancedStatsScreen y DashboardScreen actualizados.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import Constants from 'expo-constants';
import { MMKV } from 'react-native-mmkv';
import LogService, { LOG_CTX } from './LogService';
// [Sprint 10] BackupService: persistencia ante rebuilds de APK
import { BackupService } from './BackupService';

// ─── STORAGE KEYS ─────────────────────────────────────────────────────────────
const KEYS = {
  PRODUCTS:        'products',
  CONFIG:          'app_user_config',
  DICTIONARY:      'custom_dictionary',
  FULL_DICTIONARY: 'custom_dictionary_full',
  IMPORT_LOG:      'import_log',
};

// ─── LOS 7 CAMPOS SAGRADOS (Sprint 1 v4.2) ───────────────────────────────────
const MANUAL_FIELDS_ACTIVE = ['category', 'subcategory', 'firstUploadDate', 'title', 'brand'];
const MANUAL_FIELDS_SOLD   = ['soldPriceReal', 'soldDateReal', 'isBundle', 'category', 'subcategory', 'firstUploadDate', 'title', 'brand'];

// ─── DEFAULT CONFIG ────────────────────────────────────────────────────────────
const DEFAULT_CONFIG = {
  daysInvisible:            '60',
  viewsInvisible:           '20',
  daysDesinterest:          '45',
  daysCritical:             '90',
  ttsLightning:             '7',
  ttsAnchor:                '30',
  priceBoostPct:            '10',
  priceCutPct:              '10',
  staleMultiplier:          '1.5',
  criticalMonthThreshold:   '6',
  hotViews:                 '50',
  hotFavs:                  '10',
  hotDays:                  '30',
  daysAlmostReady:          '30',
  favsAlmostReady:          '8',
  opportunityFavs:          '8',
  opportunityDays:          '20',
  autoDetectCategory:       false,
  defaultImportCategory:    'Otros',
  notifRepost:              false,
  notifStale:               false,
  seasonalMap: {
    0:[], 1:[], 2:[], 3:[], 4:[], 5:[],
    6:[], 7:[], 8:[], 9:[], 10:[], 11:[],
  },
};

// ─── STORAGE INIT ─────────────────────────────────────────────────────────────
let storage;
try {
  storage = new MMKV();
  LogService.add('🚀 MMKV iniciado', 'info');
} catch (e) {
  LogService.add('❌ Fallo crítico MMKV: ' + e.message, 'error');
}

// ─── [Sprint 10] BACKUP HELPER ────────────────────────────────────────────────
// Fire-and-forget tras cada escritura. Evita circular dependency con exportFullDatabase.
function _triggerBackup() {
  BackupService.triggerAutoBackup(() => {
    try {
      let salesHistory = [];
      try { const { VintedSalesDB } = require('./VintedParserService'); salesHistory = VintedSalesDB.getAllRecords(); } catch { /* ok */ }
      let importLog = [];
      try { importLog = JSON.parse(storage.getString('import_log') || '[]'); } catch { /* ok */ }
      return {
        schemaVersion:  storage.getString('schema_version') || '2.1',
        exportedAt:     new Date().toISOString(),
        exportedBy:     'ResellHub_exportFullDatabase_v9',
        products:       JSON.parse(storage.getString('products') || '[]'),
        config:         JSON.parse(storage.getString('app_user_config') || '{}'),
        dictionary:     JSON.parse(storage.getString('custom_dictionary') || '{}'),
        dictionaryFull: JSON.parse(storage.getString('custom_dictionary_full') || '{}'),
        salesHistory, importLog,
      };
    } catch (e) {
      LogService.add('⚠️ _triggerBackup payload error: ' + e.message, 'warn');
      return null;
    }
  });
}

// ─── ENV ──────────────────────────────────────────────────────────────────────
export const getEnv = () => {
  if (__DEV__) return 'development';
  const isPreview = Constants.expoConfig?.releaseChannel === 'preview';
  return isPreview ? 'preview' : 'production';
};
const ENV = getEnv();

// ─── HELPERS EXPORTADOS ────────────────────────────────────────────────────────

/**
 * [DATA_SCIENTIST] TTS calculator — usa exclusivamente soldDateReal.
 */
export function calcTTS(product) {
  if (!product.soldDateReal) return null;
  const start = product.firstUploadDate || product.createdAt;
  if (!start) return null;
  const ms = new Date(product.soldDateReal) - new Date(start);
  if (ms <= 0) return 1;
  return Math.round(ms / 86_400_000);
}

/**
 * [DATA_SCIENTIST] Etiqueta TTS dinámica según config.
 */
export function ttsLabel(avgTTS, config) {
  const lightning = parseInt(config?.ttsLightning  || 7);
  const anchor    = parseInt(config?.ttsAnchor     || 30);
  const boostPct  = parseInt(config?.priceBoostPct || 10);
  const cutPct    = parseInt(config?.priceCutPct   || 10);
  if (avgTTS <= lightning) return { emoji: '⚡', label: 'RELÁMPAGO', color: '#00D9A3', advice: `Sube el precio un ${boostPct}%`, threshold: lightning };
  if (avgTTS <= anchor)    return { emoji: '🟡', label: 'NORMAL',    color: '#FFB800', advice: 'Mantén precio, mejora fotos/título', threshold: anchor };
  return                          { emoji: '⚓', label: 'ANCLA',     color: '#E63946', advice: `Baja precio un ${cutPct}% o republica`, threshold: anchor };
}

/**
 * Severidad de un producto activo según días en stock.
 */
export function getProductSeverity(daysOld, views, favorites, config) {
  const cfg              = config || DEFAULT_CONFIG;
  const limitInvisible   = parseInt(cfg.daysInvisible   || 60);
  const limitDesinterest = parseInt(cfg.daysDesinterest || 45);
  const limitCritical    = parseInt(cfg.daysCritical    || 90);
  const viewsLimit       = parseInt(cfg.viewsInvisible  || 20);
  if (daysOld >= limitCritical)    return { type: 'CRÍTICO',    color: '#E63946', icon: 'alert-circle',  msg: 'Republicar urgente',       priority: 4 };
  if (daysOld >= limitInvisible && views < viewsLimit)
                                   return { type: 'INVISIBLE',  color: '#888888', icon: 'eye-off',       msg: `Bajas vistas (<${viewsLimit})`, priority: 3 };
  if (daysOld >= limitDesinterest && favorites === 0 && views > viewsLimit)
                                   return { type: 'DESINTERÉS', color: '#FF6B35', icon: 'trending-down', msg: 'Revisar precio/desc',      priority: 2 };
  const limitAlmostReady = parseInt(cfg.daysAlmostReady || 30);
  const favsAlmostReady  = parseInt(cfg.favsAlmostReady || 8);
  if (daysOld >= limitAlmostReady && favorites > favsAlmostReady)
                                   return { type: 'CASI LISTO', color: '#00D9A3', icon: 'zap',           msg: 'Haz una oferta ahora',    priority: 1 };
  return null;
}

const GENERIC_TITLES = new Set([
  'producto sin título', 'sin título', 'artículo', 'product', 'item', '',
]);

function detectRepost(existingProducts, newProduct) {
  const norm = (s) => (s || '').toLowerCase().trim();
  const t1   = norm(newProduct.title);
  const b1   = norm(newProduct.brand);

  // No hacer match en títulos genéricos o muy cortos
  if (GENERIC_TITLES.has(t1) || t1.length < 15) return null;
  const hasLetters = /[a-záéíóúüñ]{3}/i.test(t1);
  if (!hasLetters) return null;

  const newPrice = parseFloat(newProduct.price) || 0;

  return existingProducts.find(p => {
    if (p.status === 'sold') return false;
    if (String(p.id) === String(newProduct.id)) return false;
    if (norm(p.title) !== t1 || norm(p.brand) !== b1) return false;
    // Precio similar (±50%) para evitar falsos positivos
    const existPrice = parseFloat(p.price) || 0;
    if (newPrice > 0 && existPrice > 0) {
      const ratio = newPrice / existPrice;
      if (ratio < 0.5 || ratio > 2.0) return false;
    }
    return true;
  }) || null;
}
// ─────────────────────────────────────────────────────────────────────────────
// DATABASE SERVICE
// ─────────────────────────────────────────────────────────────────────────────
export class DatabaseService {

  // ── CONFIG ────────────────────────────────────────────────────────────────

  static getConfig() {
    try {
      const raw   = storage.getString(KEYS.CONFIG);
      const saved = raw ? JSON.parse(raw) : {};
      if (ENV === 'development') console.log('🛠️ Modo Desarrollo');
      if (saved.seasonalMap) {
        for (let i = 0; i < 12; i++) {
          const val = saved.seasonalMap[i];
          if (!Array.isArray(val)) saved.seasonalMap[i] = val ? [val] : [];
        }
      }
      return { ...DEFAULT_CONFIG, ...saved };
    } catch { return { ...DEFAULT_CONFIG }; }
  }

  // ─────────────────────────────────────────────────────────────────────────────
// INSERCIÓN 1: Después de `static getConfig()`, antes de `static saveConfig()`
// ─────────────────────────────────────────────────────────────────────────────
 
  /**
   * [DATA_SCIENTIST] Sprint 11
   * Parsea un item del seasonalMap.
   * Si contiene ' › ', es una subcategoría específica.
   * Si no, es una categoría entera.
   *
   * @param {string} item — item del seasonalMap
   * @returns {{ cat: string, sub: string|null }}
   */
  static parseSeasonalItem(item) {
    if (!item || typeof item !== 'string') return { cat: '', sub: null };
    const idx = item.indexOf(' › ');
    if (idx === -1) return { cat: item, sub: null };
    return { cat: item.slice(0, idx), sub: item.slice(idx + 3) };
  }
 
  /**
   * [DATA_SCIENTIST] Sprint 11
   * Comprueba si un producto coincide con algún item del seasonalMap del mes.
   * Soporta tanto categorías (match si product.category === cat) como
   * subcategorías específicas (match si category === cat AND subcategory === sub).
   *
   * Retrocompatible: strings sin ' › ' se comportan como antes.
   *
   * @param {object} product — producto con { category, subcategory }
   * @param {string[]} seasonalItems — array del seasonalMap[monthIdx]
   * @returns {boolean}
   */
  static productMatchesSeasonal(product, seasonalItems) {
    if (!Array.isArray(seasonalItems) || !product) return false;
    return seasonalItems.some(item => {
      const { cat, sub } = this.parseSeasonalItem(item);
      if (!sub) return product.category === cat;
      return product.category === cat && product.subcategory === sub;
    });
  }
 
 

  static saveConfig(config) {
    try {
      storage.set(KEYS.CONFIG, JSON.stringify(config));
      LogService.add('⚙️ Configuración guardada', 'info');
      _triggerBackup(); // [Sprint 10]
      return true;
    } catch (e) {
      LogService.add('❌ Error al guardar config: ' + e.message, 'error');
      return false;
    }
  }

  // ── DICTIONARY ────────────────────────────────────────────────────────────

  static getDictionary() {
    try { return JSON.parse(storage.getString(KEYS.DICTIONARY) || '{}'); }
    catch { return {}; }
  }
  static saveDictionary(dict) {
    try { storage.set(KEYS.DICTIONARY, JSON.stringify(dict)); _triggerBackup(); return true; }
    catch { return false; }
  }

 static getFullDictionary() {
    try {
      const r = storage.getString(KEYS.FULL_DICTIONARY);
      if (!r) return null;
      // Copia profunda al leer para evitar mutaciones externas
      return JSON.parse(r);
    } catch (e) {
      LogService.add('❌ getFullDictionary error: ' + e.message, 'error');
      return null;
    }
  }

static saveFullDictionary(dict) {
    try {
      // Copia profunda limpia ANTES de serializar
      // Evita que referencias internas de React corrompan JSON.stringify
      const cleanDict = JSON.parse(JSON.stringify(dict));
      storage.set(KEYS.FULL_DICTIONARY, JSON.stringify(cleanDict));
 
      // Verificación inmediata de lo guardado
      const readBack = storage.getString(KEYS.FULL_DICTIONARY);
      if (readBack) {
        const verified = JSON.parse(readBack);
        const catCount = Object.keys(verified).length;
        const subCount = Object.values(verified).reduce((acc, cat) => {
          return acc + Object.keys(cat?.subcategories || {}).length;
        }, 0);
        LogService.add(
          `✅ saveFullDictionary: ${catCount} cats, ${subCount} subcats`,
          'success',
        );
      }
      _triggerBackup();
      return true;
    } catch (e) {
      LogService.add('❌ saveFullDictionary error: ' + e.message, 'error');
      return false;
    }
  }

  static getCategoryTags(category, subcategory) {
    const full   = this.getFullDictionary();
    const legacy = this.getDictionary();
    if (full && full[category]) {
      const catTags = full[category].tags || [];
      const subTags = subcategory ? (full[category].subcategories?.[subcategory]?.tags || []) : [];
      return [...new Set([...catTags, ...subTags])];
    }
    return legacy[category] || [];
  }
  static detectCategory(title, brand) {
    const config = this.getConfig();
    if (!config.autoDetectCategory) return null;
    const dict = this.getDictionary();
    const text = `${title} ${brand}`.toLowerCase();
    for (const [cat, tags] of Object.entries(dict)) {
      const tagList = Array.isArray(tags) ? tags : (tags.tags || []);
      if (tagList.some(t => text.includes(t.toLowerCase()))) return cat;
    }
    return null;
  }

  // ── PRODUCTS BASE ─────────────────────────────────────────────────────────

  static getAllProducts() {
    try { return JSON.parse(storage.getString(KEYS.PRODUCTS) || '[]'); }
    catch { return []; }
  }
  static saveAllProducts(products) {
    try {
      storage.set(KEYS.PRODUCTS, JSON.stringify(products));
      _triggerBackup(); // [Sprint 10] backup automático tras cada cambio de inventario
      return true;
    } catch (e) { LogService.add('❌ Error al guardar productos: ' + e.message, 'error'); return false; }
  }
  static saveProducts(products) { return this.saveAllProducts(products); }

  static updateProduct(updated) {
    try {
      const all = this.getAllProducts();
      const idx = all.findIndex(p => String(p.id) === String(updated.id));
      if (idx === -1) return false;
      all[idx] = {
        ...all[idx], ...updated,
        category:        updated.category        || all[idx].category,
        subcategory:     updated.subcategory      ?? all[idx].subcategory,
        firstUploadDate: updated.firstUploadDate  || all[idx].firstUploadDate,
      };
      this.saveAllProducts(all);
      return true;
    } catch { return false; }
  }

  static deleteProduct(productId) {
    try {
      this.saveAllProducts(this.getAllProducts().filter(p => String(p.id) !== String(productId)));
      return true;
    } catch { return false; }
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
    } catch { return false; }
  }

  static markAsSold(productId, soldPrice, soldDate, isBundle) {
    try {
      const all = this.getAllProducts();
      const idx = all.findIndex(p => String(p.id) === String(productId));
      if (idx === -1) return false;
      all[idx].status        = 'sold';
      all[idx].soldPriceReal = soldPrice != null ? soldPrice : (all[idx].soldPriceReal || all[idx].soldPrice || all[idx].price);
      all[idx].soldDateReal  = soldDate  || all[idx].soldDateReal  || new Date().toISOString();
      all[idx].soldAt        = all[idx].soldDateReal;
      all[idx].soldDate      = all[idx].soldDateReal;
      if (isBundle !== undefined) all[idx].isBundle = isBundle;
      this.saveAllProducts(all);
      LogService.add(`✅ Vendido: ${all[idx].title} por ${all[idx].soldPriceReal}€`, 'success');
      return true;
    } catch { return false; }
  }

  /**
   * [ARCHITECT] Bypass MANUAL_FIELDS — usado por matchHistoryToInventory.
   * Sprint 8 fix + Sprint 9 reconfirmado.
   */
  static updateSaleData(productId, { soldPriceReal, soldDateReal, status } = {}) {
    try {
      const all = this.getAllProducts();
      const idx = all.findIndex(p => String(p.id) === String(productId));
      if (idx === -1) { LogService.add('⚠️ updateSaleData: ' + productId + ' no encontrado', 'warn'); return false; }
      if (soldPriceReal != null && soldPriceReal > 0) all[idx].soldPriceReal = soldPriceReal;
      if (soldDateReal) { all[idx].soldDateReal = soldDateReal; all[idx].soldAt = soldDateReal; all[idx].soldDate = soldDateReal; }
      if (status) all[idx].status = status;
      this.saveAllProducts(all);
      LogService.add(`💰 updateSaleData: ${all[idx].title} → ${soldPriceReal}€`, 'success');
      return true;
    } catch (e) { LogService.add('❌ updateSaleData error: ' + e.message, 'error'); return false; }
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

  // ── IMPORT INTELIGENTE ────────────────────────────────────────────────────

  static importFromVinted(newProducts) {
    try {
      const config  = this.getConfig();
      const current = this.getAllProducts();
      const map     = new Map(current.map(p => [String(p.id), p]));


      // [FIX anti-duplicados] Índice de sold con precio conocido
      const _normTitle = (s) =>
        (s || '').toLowerCase().replace(/[^\wáéíóúüñ\s]/gi, ' ').replace(/\s+/g, ' ').trim();
      const _soldByTitle = new Map();
      current.forEach(ex => {
        if (ex.status === 'sold' && ex.soldPriceReal) {
          const key = _normTitle(ex.title);
          if (!_soldByTitle.has(key)) _soldByTitle.set(key, []);
          _soldByTitle.get(key).push(ex);
        }
      });

      const now     = new Date().toISOString();
      const incomingIds = new Set(newProducts.map(p => String(p.id)));
      let created = 0, updated = 0, reposted = 0, priceChanged = 0;

      newProducts.forEach(p => {
        if (!p.id || String(p.id).includes('image')) return;
        const id  = String(p.id);
        const old = map.get(id);
        if (old) {
          const isSold       = old.status === 'sold' || p.status === 'sold';
          const manualFields = isSold ? MANUAL_FIELDS_SOLD : MANUAL_FIELDS_ACTIVE;
          const merged       = { ...old, ...p };
          manualFields.forEach(field => { if (old[field] !== undefined && old[field] !== null) merged[field] = old[field]; });
          if (Number(p.price) !== Number(old.price) && p.price) {
            merged.priceHistory = [...(old.priceHistory || []), { oldPrice: old.price, newPrice: p.price, date: now }];
            priceChanged++;
          }
          merged.lastSync = now;
          map.set(id, merged);
          updated++;
        } else {
          const existing       = Array.from(map.values());

          // [FIX anti-duplicados] Skip si ya existe sold con este título y precio real
          if (p.status === 'sold') {
            const _key = _normTitle(p.title);
            const _existing = _soldByTitle.get(_key) || [];
            if (_existing.length > 0) {
              LogService.debug(`Skip dup sold: "${p.title}" → ya existe ${_existing[0].id}`, LOG_CTX.IMPORT);
              return;
            }
          }


          const repostOriginal = detectRepost(existing, p);
          const newEntry       = {
            ...p, isBundle: false, lastSync: now,
            createdAt: p.createdAt || now,
            category:  p.category || this.detectCategory(p.title, p.brand) || config.defaultImportCategory || 'Otros',
          };
          if (!newEntry.firstUploadDate) newEntry.firstUploadDate = now;
          if (repostOriginal) {
            newEntry.repostOf        = repostOriginal.id;
            newEntry.firstUploadDate = repostOriginal.firstUploadDate;
            newEntry.priceHistory    = repostOriginal.priceHistory || [];
            const orig = map.get(String(repostOriginal.id));
            if (orig) { orig.repostTo = id; orig.repostedAt = now; orig.repostCount = (orig.repostCount || 0) + 1; map.set(String(repostOriginal.id), orig); }
            reposted++;
          } else { created++; }
          map.set(id, newEntry);

          // [FIX anti-duplicados] Registrar en índice al crear nuevo sold con precio
          if (newEntry.status === 'sold' && newEntry.soldPriceReal) {
            const _k = _normTitle(newEntry.title);
            if (!_soldByTitle.has(_k)) _soldByTitle.set(_k, []);
            _soldByTitle.get(_k).push(newEntry);
          }

        }
      });

      map.forEach((product, id) => {
        if (!incomingIds.has(id) && product.status !== 'sold') {
          map.set(id, { ...product, stale: true, staleDetectedAt: product.staleDetectedAt || now });
        } else if (incomingIds.has(id)) {
          const upd = map.get(id);
          if (upd?.stale) { delete upd.stale; delete upd.staleDetectedAt; map.set(id, upd); }
        }
      });

      const final = Array.from(map.values());
      this.saveAllProducts(final);
      this._addImportLog({ date: now, total: final.length, incoming: newProducts.length, created, updated, reposted, priceChanged });
      LogService.logImportResult?.({ success: true, count: final.length, created, updated, reposted, priceChanged });
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
      if (logs.length > 50) logs.length = 50;
      storage.set(KEYS.IMPORT_LOG, JSON.stringify(logs));
    } catch { /* silent */ }
  }

  static getImportLog() {
    try { return JSON.parse(storage.getString(KEYS.IMPORT_LOG) || '[]'); }
    catch { return []; }
  }

  // ── ANALYTICS — FUENTE ÚNICA DE VERDAD ───────────────────────────────────

  /**
   * [DATA_SCIENTIST] Estadísticas por categoría basadas en productos VENDIDOS.
   *
   * Sprint 9.1 — REDISEÑO KPIs:
   *   ELIMINADO:  totalProfit, avgProfit (diff soldPrice - price)
   *   NUEVO:      totalRecaudacion → suma de soldPriceReal (ingreso real)
   *               avgPrecio        → precio medio de venta (útil para fijar precios)
   *   RAZÓN: en segunda mano siempre se vende igual o más barato que el precio
   *          publicado. El "beneficio" sería siempre 0 o negativo → sin valor.
   *          Lo que sí importa es cuánto dinero genera cada categoría (recaudación)
   *          y a qué precio medio se vende (para calibrar el precio de publicación).
   */
  static getCategoryStats() {
    const config = this.getConfig();
    const sold   = this.getAllProducts().filter(p => p.status === 'sold');
    const map    = {};

    sold.forEach(p => {
      const cat         = p.category || 'Otros';
      const tts         = calcTTS(p);
      // [QA_ENGINEER] Sprint 9.1: recaudacion — siempre >= 0
      const recaudacion = Math.max(0, Number(p.soldPriceReal || p.soldPrice || p.price || 0));

      if (!map[cat]) map[cat] = { count: 0, totalTTS: 0, totalRecaudacion: 0, ttsList: [], subcategories: {} };
      map[cat].count++;
      map[cat].totalRecaudacion += recaudacion;
      if (tts !== null) { map[cat].totalTTS += tts; map[cat].ttsList.push(tts); }

      if (p.subcategory) {
        const sub = p.subcategory;
        if (!map[cat].subcategories[sub]) map[cat].subcategories[sub] = { count: 0, totalTTS: 0, ttsList: [], totalRecaudacion: 0 };
        map[cat].subcategories[sub].count++;
        map[cat].subcategories[sub].totalRecaudacion += recaudacion;
        if (tts !== null) { map[cat].subcategories[sub].totalTTS += tts; map[cat].subcategories[sub].ttsList.push(tts); }
      }
    });

    const fullDict = this.getFullDictionary() || {};
    return Object.entries(map).map(([name, d]) => {
      const avgTTS    = d.ttsList.length ? Math.round(d.totalTTS / d.ttsList.length) : 999;
      const speed     = ttsLabel(avgTTS, config);
      const dictEntry = fullDict[name] || {};

      const subcategoryStats = Object.entries(d.subcategories).map(([sName, sd]) => {
        const sAvgTTS = sd.ttsList.length ? Math.round(sd.totalTTS / sd.ttsList.length) : 999;
        return {
          name:             sName,
          count:            sd.count,
          avgTTS:           sAvgTTS,
          // avgPrecio: precio medio de venta de la subcategoría
          avgPrecio:        sd.count ? +(sd.totalRecaudacion / sd.count).toFixed(2) : 0,
          totalRecaudacion: +(sd.totalRecaudacion.toFixed(2)),
          tags:             dictEntry.subcategories?.[sName]?.tags || [],
          ...ttsLabel(sAvgTTS, config),
        };
      }).sort((a, b) => a.avgTTS - b.avgTTS);

      return {
        name,
        count:            d.count,
        avgTTS,
        totalRecaudacion: +(d.totalRecaudacion.toFixed(2)),
        // avgPrecio: precio medio de venta — útil para calibrar el precio de publicación
        avgPrecio:        d.count ? +(d.totalRecaudacion / d.count).toFixed(2) : 0,
        tags:             dictEntry.tags || [],
        subcategoryStats,
        ...speed,
      };
    }).sort((a, b) => a.avgTTS - b.avgTTS);
  }

  /**
   * [DATA_SCIENTIST] Historial de ventas agrupado por mes.
   *
   * Sprint 9.1 — REDISEÑO KPIs + FIXES:
   *   FIX #1: key usa getMonth()+1 → ISO correcto (enero="2026-01")
   *   FIX #2: recaudacion = Math.max(0, ...) — sin negativos
   *   FIX #3: validar fecha → skip si inválida
   *   ELIMINADO: campo "profit" (soldAmt - price) → siempre ≤ 0 en segunda mano
   *   NUEVO: "recaudacion" = ingreso real de ese mes
   */
  static getMonthlyHistory() {
    const sold = this.getAllProducts().filter(p => p.status === 'sold');
    const map  = {};

    sold.forEach(p => {
      const raw  = p.soldDateReal || p.soldDate || p.soldAt || p.createdAt;
      const date = raw ? new Date(raw) : new Date();
      // FIX #3: saltar fechas inválidas
      if (isNaN(date.getTime())) return;

      // FIX #1: getMonth() es 0-based → +1 para key ISO correcta
      const key   = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleString('es-ES', { month: 'long', year: 'numeric' });

      // FIX #2: recaudacion siempre >= 0
      const recaudacion = Math.max(0, Number(p.soldPriceReal || p.soldPrice || p.price || 0));
      const cat         = p.category    || 'Otros';
      const sub         = p.subcategory || null;

      if (!map[key]) map[key] = {
        key, label,
        month: date.getMonth(),
        year:  date.getFullYear(),
        recaudacion: 0, sales: 0, bundles: 0,
        categoryBreakdown: {},
      };

      map[key].recaudacion += recaudacion;
      map[key].sales       += 1;
      if (p.isBundle) map[key].bundles += 1;

      const cb = map[key].categoryBreakdown;
      if (!cb[cat]) cb[cat] = { recaudacion: 0, sales: 0, subcategories: {} };
      cb[cat].recaudacion += recaudacion;
      cb[cat].sales       += 1;
      if (sub) {
        if (!cb[cat].subcategories[sub]) cb[cat].subcategories[sub] = { recaudacion: 0, sales: 0 };
        cb[cat].subcategories[sub].recaudacion += recaudacion;
        cb[cat].subcategories[sub].sales       += 1;
      }
    });

    return Object.values(map)
      .map(m => ({
        ...m,
        recaudacion: +(m.recaudacion.toFixed(2)),
        // Top categoría del mes (mayor recaudación)
        topCategory: Object.entries(m.categoryBreakdown)
          .sort((a, b) => b[1].recaudacion - a[1].recaudacion)
          .map(([name, d]) => ({
            name,
            recaudacion: +(d.recaudacion.toFixed(2)),
            sales:       d.sales,
            topSub: Object.entries(d.subcategories || {})
              .sort((a, b) => b[1].recaudacion - a[1].recaudacion)
              .map(([sName, sd]) => ({ name: sName, recaudacion: +(sd.recaudacion.toFixed(2)), sales: sd.sales }))[0] || null,
          })),
      }))
      .sort((a, b) => b.key.localeCompare(a.key));
  }

  /**
   * [ARCHITECT] Sprint 9 — Historial por AÑO.
   * Usa getMonthlyHistory() como fuente. Ordenado por año descendente.
   */
  static getAnnualHistory() {
    const months  = this.getMonthlyHistory();
    const yearMap = {};

    months.forEach(m => {
      const y = String(m.year);
      if (!yearMap[y]) yearMap[y] = { year: m.year, label: y, recaudacion: 0, sales: 0, bundles: 0, months: [], catTotals: {} };
      yearMap[y].recaudacion += m.recaudacion || 0;
      yearMap[y].sales       += m.sales       || 0;
      yearMap[y].bundles     += m.bundles     || 0;
      yearMap[y].months.push(m);
      Object.entries(m.categoryBreakdown || {}).forEach(([cat, d]) => {
        if (!yearMap[y].catTotals[cat]) yearMap[y].catTotals[cat] = { recaudacion: 0, sales: 0 };
        yearMap[y].catTotals[cat].recaudacion += d.recaudacion || 0;
        yearMap[y].catTotals[cat].sales       += d.sales       || 0;
      });
    });

    return Object.values(yearMap).map(y => {
      const sortedMonths = [...y.months].sort((a, b) => b.recaudacion - a.recaudacion);
      const topCats = Object.entries(y.catTotals)
        .sort((a, b) => b[1].recaudacion - a[1].recaudacion)
        .map(([name, d]) => ({ name, recaudacion: +(d.recaudacion.toFixed(2)), sales: d.sales }));
      return {
        year:                  y.year,
        label:                 y.label,
        recaudacion:           +(y.recaudacion.toFixed(2)),
        sales:                 y.sales,
        bundles:               y.bundles,
        monthCount:            y.months.length,
        avgMensualRecaudacion: y.months.length ? +(y.recaudacion / y.months.length).toFixed(2) : 0,
        avgMonthlySales:       y.months.length ? +(y.sales / y.months.length).toFixed(1) : 0,
        bestMonth:             sortedMonths[0] || null,
        topCategory:           topCats[0]      || null,
        topCategories:         topCats,
      };
    }).sort((a, b) => b.year - a.year);
  }

  /**
   * [DATA_SCIENTIST] KPIs globales del negocio.
   *
   * Sprint 9.1 — REDISEÑO:
   *   ELIMINADO: totalProfit (soldPrice - price) → siempre ≤ 0 en segunda mano
   *   NUEVO:     totalRecaudacion → suma de ingresos reales
   *              rotacion         → % de unidades liquidadas = sold/(sold+active)
   *              avgPrecioVenta   → precio medio de venta (para calibrar publicaciones)
   */
  static getBusinessKPIs() {
    const all          = this.getAllProducts();
    const sold         = all.filter(p => p.status === 'sold');
    const active       = all.filter(p => p.status !== 'sold');
    const now          = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const totalRecaudacion = sold.reduce((s, p) =>
      s + Math.max(0, Number(p.soldPriceReal || p.soldPrice || p.price || 0)), 0);

    const totalViews     = all.reduce((s, p) => s + Number(p.views     || 0), 0);
    const totalFavorites = all.reduce((s, p) => s + Number(p.favorites || 0), 0);

    const soldThisMonth          = sold.filter(p => p.soldDateReal && new Date(p.soldDateReal) >= firstOfMonth).length;
    const recaudacionThisMonth   = sold
      .filter(p => p.soldDateReal && new Date(p.soldDateReal) >= firstOfMonth)
      .reduce((s, p) => s + Math.max(0, Number(p.soldPriceReal || p.soldPrice || p.price || 0)), 0);

    // rotacion: % del stock total que ya se ha vendido
    const totalUnidades = sold.length + active.length;
    const rotacion      = totalUnidades > 0 ? Math.round((sold.length / totalUnidades) * 100) : 0;

    // avgPrecioVenta: precio medio al que se venden los productos
    const avgPrecioVenta = sold.length > 0 ? +(totalRecaudacion / sold.length).toFixed(2) : 0;

    const ttsList = sold.map(p => calcTTS(p)).filter(Boolean);
    const avgTTS  = ttsList.length ? Math.round(ttsList.reduce((a, b) => a + b, 0) / ttsList.length) : 0;

    const catStats = this.getCategoryStats();
    const bestCat  = catStats[0] || null;
    const worstCat = catStats.length ? catStats[catStats.length - 1] : null;
    const staleCount = active.filter(p => p.stale).length;

    const topSubcategory = catStats
      .flatMap(c => (c.subcategoryStats || []).map(s => ({ ...s, parentCategory: c.name })))
      .filter(s => s.avgTTS < 999 && s.count > 0)
      .sort((a, b) => a.avgTTS - b.avgTTS)[0] || null;

    return {
      totalRecaudacion,
      recaudacionThisMonth,
      rotacion,          // % liquidación — 0 a 100
      avgPrecioVenta,    // precio medio de venta
      totalViews,
      totalFavorites,
      soldCount:         sold.length,
      activeCount:       active.length,
      staleCount,
      soldThisMonth,
      avgTTS,
      bestCat,
      worstCat,
      topSubcategory,
    };
  }

  /**
   * Productos activos enriquecidos con diagnóstico.
   */
  static getActiveProductsWithDiagnostic() {
    const config = this.getConfig();
    const active = this.getAllProducts().filter(p => p.status !== 'sold');
    const now    = new Date();
    return active.map(p => {
      const uploadDate = new Date(p.firstUploadDate || p.createdAt || now);
      const daysOld    = Math.max(0, Math.floor((now - uploadDate) / 86_400_000));
      const views      = Number(p.views     || 0);
      const favorites  = Number(p.favorites || 0);
      const severity   = getProductSeverity(daysOld, views, favorites, config);
      const hotViews = parseInt(config.hotViews || 50);
      const hotFavs  = parseInt(config.hotFavs  || 10);
      const hotDays  = parseInt(config.hotDays  || 30);
      return {
        ...p, daysOld, severity,
        isCritical: daysOld >= parseInt(config.daysCritical    || 90),
        isCold:     daysOld >= parseInt(config.daysDesinterest || 45) && daysOld < parseInt(config.daysCritical || 90),
        isHot:      (views > hotViews || favorites > hotFavs) && daysOld < hotDays,
      };
    });
  }

  /**
   * Alertas inteligentes — FUENTE ÚNICA para Dashboard y AdvancedStats.
   */
  static getSmartAlerts() {
    const config       = this.getConfig();
    const catStats     = this.getCategoryStats();
    const products     = this.getActiveProductsWithDiagnostic();
    const now          = new Date();
    const currentMonth = now.getMonth();
    const seasonalMap  = config.seasonalMap || DEFAULT_CONFIG.seasonalMap;
    const multiplier   = parseFloat(config.staleMultiplier      || 1.5);
    const criticalMos  = parseInt(config.criticalMonthThreshold || 6);
    const alerts       = [];
    const catTTSMap    = Object.fromEntries(catStats.map(c => [c.name, c.avgTTS]));
    const seasonalCats = Array.isArray(seasonalMap[currentMonth])
      ? seasonalMap[currentMonth]
      : (seasonalMap[currentMonth] ? [seasonalMap[currentMonth]] : []);

    products.forEach(p => {
      const cat          = p.category || 'Otros';
      const ttsAnchorVal = parseInt(config.ttsAnchor || 30);
      const catAvgTTS    = catTTSMap[cat] || ttsAnchorVal;
      const sub          = p.subcategory;
      const subStats     = sub ? catStats.find(c => c.name === cat)?.subcategoryStats?.find(s => s.name === sub) : null;
      const effTTS       = subStats?.avgTTS || catAvgTTS;
      const effLabel     = sub ? `${cat} › ${sub}` : cat;

      // 1. ESTANCAMIENTO
      if (p.daysOld > effTTS * multiplier) {
        alerts.push({
          type: 'stale', priority: p.daysOld > effTTS * multiplier * 2 ? 'high' : 'medium',
          productId: p.id, title: p.title,
          message: `Lleva ${p.daysOld}d. Media de ${effLabel}: ${effTTS}d. Baja ${parseInt(config.priceCutPct||10)}% o republica.`,
          action: 'REVISAR PRECIO', icon: 'clock', category: cat, subcategory: sub || null, effectiveTTS: effTTS,
        });
      }
     // 2. ESTACIONALIDAD — Sprint 11: soporta 'Cat' y 'Cat › Sub' en seasonalMap
      const productSeasonalKey = sub ? `${cat} › ${sub}` : null;
      const isSeasonalCat = seasonalCats.includes(cat);
      const isSeasonalSub = !!productSeasonalKey && seasonalCats.includes(productSeasonalKey);
      if (isSeasonalCat || isSeasonalSub) {
        const seasonalLabel = isSeasonalSub ? `${cat} › ${sub}` : cat;
        alerts.push({
          type: 'seasonal', priority: 'high', productId: p.id,
          title: `🔥 Temporada de ${seasonalLabel}`,
          message: `${p.title}${sub ? ` (${sub})` : ''} encaja con este mes. Republica y sube un ${parseInt(config.priceBoostPct||10)}%.`,
          action: 'REPUBLICAR / SUBIR', icon: 'zap', category: cat, subcategory: sub || null,
        });
      }
      // 3. CRÍTICO
      if (p.daysOld > criticalMos * 30) {
        alerts.push({
          type: 'critical', priority: 'high', productId: p.id,
          title: `CRÍTICO: ${p.title}`,
          message: `${cat}${sub ? ` › ${sub}` : ''} · ${p.daysOld}d (>${criticalMos} meses) sin venderse.`,
          action: 'REPUBLICAR URGENTE', icon: 'alert-circle', category: cat, subcategory: sub || null,
        });
      }
      // 4. OPORTUNIDAD
      const oppFavs = parseInt(config.opportunityFavs || 8);
      const oppDays = parseInt(config.opportunityDays || 20);
      if (p.favorites > oppFavs && p.daysOld > oppDays) {
        alerts.push({
          type: 'opportunity', priority: 'medium', productId: p.id,
          title: `💡 Oportunidad: ${p.title}`,
          message: `${p.favorites} favs (${cat}${sub ? ` · ${sub}` : ''}). Haz una oferta.`,
          action: 'HACER OFERTA', icon: 'heart', category: cat, subcategory: sub || null,
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
    const MONTH_NAMES  = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const insights     = [];
    const ttsLightning = parseInt(config.ttsLightning || 7);
    const ttsAnchor    = parseInt(config.ttsAnchor    || 30);
    const priceBoostPct= parseInt(config.priceBoostPct|| 10);

    if (catStats[0]) {
      const starCat = catStats[0];
      const starSub = starCat.subcategoryStats?.find(s => s.avgTTS <= ttsLightning) || starCat.subcategoryStats?.[0];
      insights.push({
        type: 'star', icon: '⚡',
        title: `${starCat.name} vende en ${starCat.avgTTS}d de media${starSub ? ` · ${starSub.name} en ${starSub.avgTTS}d` : ''}`,
        message: `Busca más stock de ${starCat.name}. ${starSub?.avgTTS <= ttsLightning ? `"${starSub.name}" vuela — sube precio un ${priceBoostPct}%.` : starCat.advice + '.'}`,
        color: '#00D9A3',
      });
    }
    const anchor = catStats[catStats.length - 1];
    if (anchor && anchor.avgTTS > ttsAnchor) {
      const anchorSub = anchor.subcategoryStats?.slice().sort((a, b) => b.avgTTS - a.avgTTS)[0];
      insights.push({
        type: 'anchor', icon: '⚓',
        title: `${anchor.name} lleva ${anchor.avgTTS}d de media`,
        message: `Baja precios un ${parseInt(config.priceCutPct||10)}% o republica${anchorSub ? ` (especialmente "${anchorSub.name}" con ${anchorSub.avgTTS}d)` : ''}.`,
        color: '#E63946',
      });
    }
    const seasonalCats = Array.isArray(seasonalMap[currentMonth])
      ? seasonalMap[currentMonth]
      : (seasonalMap[currentMonth] ? [seasonalMap[currentMonth]] : []);
    if (seasonalCats.length > 0) {
      insights.push({
        type: 'seasonal', icon: '📅',
        title: `${MONTH_NAMES[currentMonth]}: temporada de ${seasonalCats.join(' y ')}`,
        message: `Publica o republica ahora. Sube un ${priceBoostPct}% en estas categorías.`,
        color: '#FFB800',
      });
    }
    const target = parseInt(config.ttsAnchor || 30);
    if (kpis.avgTTS > 0) {
      if (kpis.avgTTS > target) {
        insights.push({ type: 'benchmark', icon: '📊', title: `TTS medio ${kpis.avgTTS}d — por encima del objetivo (${target}d)`, message: `Revisa precios de categorías lentas. Baja un ${parseInt(config.priceCutPct||10)}%.`, color: '#FF6B35' });
      } else {
        insights.push({ type: 'benchmark', icon: '🏆', title: `TTS ${kpis.avgTTS}d — por debajo del objetivo de ${target}d`, message: `Vendes muy bien. Prueba a subir precios un ${priceBoostPct}%.`, color: '#00D9A3' });
      }
    }
    return insights;
  }

  // ── EXPORT / IMPORT BBDD ──────────────────────────────────────────────────

  static exportFullDatabase() {
    try {
      let salesHistory = [];
      try { const { VintedSalesDB } = require('./VintedParserService'); salesHistory = VintedSalesDB.getAllRecords(); } catch { /* ok */ }
      let importLog = [];
      try { importLog = JSON.parse(storage.getString(KEYS.IMPORT_LOG) || '[]'); } catch { /* ok */ }
      const payload = {
        schemaVersion: storage.getString('schema_version') || '2.1',
        exportedAt:    new Date().toISOString(),
        exportedBy:    'ResellHub_exportFullDatabase_v9',
        products:      this.getAllProducts(),
        config:        this.getConfig(),
        dictionary:    this.getDictionary()     || {},
        dictionaryFull:this.getFullDictionary() || {},
        salesHistory, importLog,
      };
      LogService.add(`📤 Export BBDD: ${payload.products.length} productos`, 'success');
      return payload;
    } catch (e) { LogService.add('❌ exportFullDatabase error: ' + e.message, 'error'); return null; }
  }

  static importFullDatabase(payload) {
    const result = { products: 0, salesRecords: 0, configRestored: false, errors: [] };
    try {
      if (!payload || !payload.exportedBy?.includes('ResellHub')) { result.errors.push('Payload inválido'); return result; }
      if (Array.isArray(payload.products) && payload.products.length > 0) {
        const existing = this.getAllProducts();
        if (existing.length === 0) { this.saveAllProducts(payload.products); result.products = payload.products.length; }
        else { const r = this.importFromVinted(payload.products); result.products = (r.created || 0) + (r.updated || 0); }
      }
      if (payload.dictionary && Object.keys(payload.dictionary).length > 0) storage.set(KEYS.DICTIONARY, JSON.stringify(payload.dictionary));
      if (payload.dictionaryFull && Object.keys(payload.dictionaryFull).length > 0) storage.set(KEYS.FULL_DICTIONARY, JSON.stringify(payload.dictionaryFull));
      
      // [FIX] Restaurar config, dictionary y dictionaryFull siempre,
        // independientemente de si se crearon productos nuevos.
        if (payload.config) {
          this.saveConfig(payload.config);
          result.configRestored = true;
        }
        if (payload.dictionary && Object.keys(payload.dictionary).length > 0) {
          storage.set(KEYS.DICTIONARY, JSON.stringify(payload.dictionary));
        }
        if (payload.dictionaryFull && Object.keys(payload.dictionaryFull).length > 0) {
          storage.set(KEYS.FULL_DICTIONARY, JSON.stringify(payload.dictionaryFull));
        }
      
      if (Array.isArray(payload.salesHistory) && payload.salesHistory.length > 0) {
        try { const { VintedSalesDB } = require('./VintedParserService'); const r = VintedSalesDB.saveRecords(payload.salesHistory); result.salesRecords = r.inserted || 0; }
        catch (e) { result.errors.push('salesHistory: ' + e.message); }
      }
      LogService.add(`📥 Import BBDD: ${result.products} productos, ${result.salesRecords} ventas`, 'success');
      _triggerBackup(); // [Sprint 10] sincronizar backup tras restauración completa
    } catch (e) { result.errors.push(e.message); LogService.add('❌ importFullDatabase error: ' + e.message, 'error'); }
    return result;
  }

  // ── LEGACY COMPAT ──────────────────────────────────────────────────────────
  /** @deprecated Usa getBusinessKPIs() */
  static getStats() { return { sold: this.getBusinessKPIs().soldThisMonth }; }
  /** @deprecated Usa getCategoryStats() */
  static getAdvancedStats() {
    return Object.fromEntries(this.getCategoryStats().map(c => [c.name, { count: c.count, totalRecaudacion: c.totalRecaudacion, totalDays: c.avgTTS * c.count }]));
  }

  // ── CLEAR ─────────────────────────────────────────────────────────────────
  static async clearDatabase() {
    storage.set(KEYS.PRODUCTS, JSON.stringify([]));
    _triggerBackup(); // [Sprint 10] reflejar el borrado en el backup también
    LogService.add('🔥 Base de datos borrada', 'info');
    return true;
  }
}