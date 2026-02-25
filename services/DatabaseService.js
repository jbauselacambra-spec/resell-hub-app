import { MMKV } from 'react-native-mmkv';
import LogService from './LogService';

// ─────────────────────────────────────────────
// STORAGE KEYS
// ─────────────────────────────────────────────
const KEYS = {
  PRODUCTS:   'products',
  CONFIG:     'app_user_config',
  DICTIONARY: 'custom_dictionary',
};

// ─────────────────────────────────────────────
// DEFAULTS
// ─────────────────────────────────────────────
const DEFAULT_CONFIG = {
  // Umbrales de diagnóstico (días)
  daysInvisible:          '60',
  viewsInvisible:         '20',
  daysDesinterest:        '45',
  daysCritical:           '90',
  // Inteligencia de estancamiento
  staleMultiplier:        '1.5',   // x media de la categoría
  criticalMonthThreshold: '6',     // meses antes de republicar obligatorio
  // Calendario estacional (índice mes → categoría prioritaria)
  seasonalMap: {
    0: 'Juguetes',      // Enero  – post-reyes
    1: 'Ropa',          // Feb    – San Valentín
    2: 'Calzado',       // Marzo  – primavera
    3: 'Accesorios',    // Abril
    4: 'Calzado',       // Mayo   – verano
    5: 'Entretenimiento',// Junio
    6: 'Lotes',         // Julio  – rebajas
    7: 'Juguetes',      // Agosto – vuelta al cole
    8: 'Ropa',          // Sep    – otoño
    9: 'Disfraces',     // Oct    – Halloween
    10: 'Juguetes',     // Nov    – Black Friday
    11: 'Juguetes',     // Dic    – Navidad
  },
};

const DEFAULT_DICTIONARY = {
  'Juguetes':        ['tuc tuc', 'lego', 'playmobil', 'muñeca', 'juguete', 'aeropuerto', 'coche', 'pista', 'tren', 'barco', 'avión', 'peluche'],
  'Ropa':            ['abrigo', 'chaqueta', 'parka', 'plumífero', 'gabardina', 'sfera', 'zara', 'bershka', 'h&m', 'mango', 'pull&bear', 'stradivarius', 'primark'],
  'Lotes':           ['lote', 'pack', 'conjunto', 'set'],
  'Calzado':         ['zapatos', 'zapatillas', 'botas', 'deportivas', 'tenis', 'sandalias'],
  'Entretenimiento': ['videojuegos', 'juego de mesa', 'dados', 'cartas', 'muñecos', 'coleccionables', 'figuras', 'puzzles', 'rompecabezas', 'drones'],
  'Disfraces':       ['disfraz', 'carnaval', 'halloween', 'cosplay', 'traje'],
  'Libros':          ['libro', 'novela', 'cómic', 'manual', 'guía'],
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
 * ⚡ RELÁMPAGO ≤7d · 🟡 NORMAL 8-30d · ⚓ ANCLA >30d
 */
export function ttsLabel(avgTTS) {
  if (avgTTS <= 7)  return { emoji: '⚡', label: 'RELÁMPAGO', color: '#00D9A3', advice: 'Sube el precio un 10-15%' };
  if (avgTTS <= 30) return { emoji: '🟡', label: 'NORMAL',    color: '#FFB800', advice: 'Mantén precio, mejora fotos/título' };
  return              { emoji: '⚓', label: 'ANCLA',     color: '#E63946', advice: 'Baja precio o republica urgente' };
}

/**
 * Devuelve la severidad de un producto activo según días en stock.
 * Usa la config del usuario.
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
// DATABASE SERVICE
// ─────────────────────────────────────────────
export class DatabaseService {

  // ── CONFIG ──────────────────────────────────

  static getConfig() {
    try {
      const raw = storage.getString(KEYS.CONFIG);
      return raw ? { ...DEFAULT_CONFIG, ...JSON.parse(raw) } : { ...DEFAULT_CONFIG };
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

  // ── DICTIONARY ──────────────────────────────

  static getDictionary() {
    try {
      const raw = storage.getString(KEYS.DICTIONARY);
      return raw ? JSON.parse(raw) : { ...DEFAULT_DICTIONARY };
    } catch {
      return { ...DEFAULT_DICTIONARY };
    }
  }

  static saveDictionary(dict) {
    try {
      storage.set(KEYS.DICTIONARY, JSON.stringify(dict));
      LogService.add('📚 Diccionario actualizado', 'info');
      return true;
    } catch (e) {
      LogService.add('❌ Error diccionario: ' + e.message, 'error');
      return false;
    }
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

  static detectCategory(text) {
    if (!text) return 'Otros';
    const dict = this.getDictionary();
    const lower = text.toLowerCase();
    for (const [cat, kws] of Object.entries(dict)) {
      if (kws.some(k => lower.includes(k.toLowerCase()))) return cat;
    }
    return 'Otros';
  }

  static generateSEOTags(category, brand, title) {
    const tags = new Set([category.toLowerCase()]);
    if (brand && brand.toLowerCase() !== 'genérico') tags.add(brand.toLowerCase());
    const dict = this.getDictionary();
    (title || '').toLowerCase().split(' ').forEach(w => {
      if (w.length > 3) {
        tags.add(w);
        for (const [cat, kws] of Object.entries(dict)) {
          if (kws.includes(w)) tags.add(cat.toLowerCase());
        }
      }
    });
    tags.add('vinted');
    return Array.from(tags).join(', ');
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
      all[idx] = {
        ...all[idx],
        ...updated,
        category:        updated.category        || all[idx].category,
        firstUploadDate: updated.firstUploadDate || all[idx].firstUploadDate,
        seoTags:         updated.seoTags         || all[idx].seoTags,
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
      this.saveAllProducts(all);
      LogService.add(`🔄 Resubido: ${all[idx].title}`, 'success');
      return true;
    } catch {
      return false;
    }
  }

  static markAsSold(productId, soldPrice, soldDate) {
    try {
      const all = this.getAllProducts();
      const idx = all.findIndex(p => String(p.id) === String(productId));
      if (idx === -1) return false;
      all[idx].status    = 'sold';
      all[idx].soldPrice = soldPrice || all[idx].price;
      all[idx].soldDate  = soldDate  || new Date().toISOString();
      all[idx].soldAt    = all[idx].soldDate;
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

  // ── IMPORT ───────────────────────────────────

  static importFromVinted(newProducts) {
    try {
      const current = this.getAllProducts();
      const map = new Map(current.map(p => [String(p.id), p]));

      newProducts.forEach(p => {
        if (!p.id || String(p.id).includes('image')) return;
        const id  = String(p.id);
        const old = map.get(id);
        const cat = old?.category || this.detectCategory(`${p.title} ${p.description}`);
        map.set(id, {
          ...p,
          category:        cat,
          firstUploadDate: old?.firstUploadDate || p.createdAt || new Date().toISOString(),
          seoTags:         old?.seoTags         || this.generateSEOTags(cat, p.brand, p.title),
          isBundle:        old?.isBundle        ?? false,
          soldPrice:       old?.soldPrice       || p.soldPrice || null,
          soldDate:        old?.soldDate        || p.soldAt    || null,
          priceHistory:    old?.priceHistory    || [],
          status:          p.status             || 'active',
          lastSync:        new Date().toISOString(),
        });
      });

      const final = Array.from(map.values());
      this.saveAllProducts(final);
      LogService.add(`✅ Sincronizados ${final.length} productos`, 'success');
      return { success: true, count: final.length };
    } catch (e) {
      LogService.add('❌ Error en import: ' + e.message, 'error');
      return { success: false, error: e.message };
    }
  }

  // ── ANALYTICS — FUENTE ÚNICA DE VERDAD ───────

  /**
   * Estadísticas por categoría basadas en productos VENDIDOS.
   * Incluye TTS medio, beneficio medio, conteo.
   * Usada por AdvancedStatsScreen, DashboardScreen y SpeedScreen.
   */
  static getCategoryStats() {
    const sold = this.getAllProducts().filter(p => p.status === 'sold');
    const map  = {};

    sold.forEach(p => {
      const cat    = p.category || 'Otros';
      const tts    = calcTTS(p);
      const profit = Number(p.soldPrice || p.price) - Number(p.price);

      if (!map[cat]) map[cat] = { count: 0, totalTTS: 0, totalProfit: 0, ttsList: [] };
      map[cat].count++;
      map[cat].totalProfit += profit;
      if (tts !== null) {
        map[cat].totalTTS += tts;
        map[cat].ttsList.push(tts);
      }
    });

    // Enriquecer con métricas derivadas
    return Object.entries(map).map(([name, d]) => {
      const avgTTS = d.ttsList.length ? Math.round(d.totalTTS / d.ttsList.length) : 999;
      const speed  = ttsLabel(avgTTS);
      return {
        name,
        count:       d.count,
        avgTTS,
        totalProfit: d.totalProfit,
        avgProfit:   d.count ? +(d.totalProfit / d.count).toFixed(2) : 0,
        ...speed,
      };
    }).sort((a, b) => a.avgTTS - b.avgTTS);
  }

  /**
   * Historial de ventas agrupado por mes.
   * Usado por AdvancedStatsScreen y DashboardScreen.
   */
  static getMonthlyHistory() {
    const sold = this.getAllProducts().filter(p => p.status === 'sold');
    const map  = {};

    sold.forEach(p => {
      const date  = new Date(p.soldDate || p.soldAt || p.createdAt);
      const key   = `${date.getFullYear()}-${String(date.getMonth()).padStart(2,'0')}`;
      const label = date.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
      const profit = Number(p.soldPrice || p.price) - Number(p.price);

      if (!map[key]) map[key] = { key, label, month: date.getMonth(), year: date.getFullYear(), profit: 0, sales: 0, revenue: 0 };
      map[key].profit  += profit;
      map[key].sales   += 1;
      map[key].revenue += Number(p.soldPrice || p.price);
    });

    return Object.values(map).sort((a, b) => b.key.localeCompare(a.key));
  }

  /**
   * KPIs globales del negocio.
   * Dashboard principal.
   */
  static getBusinessKPIs() {
    const all     = this.getAllProducts();
    const sold    = all.filter(p => p.status === 'sold');
    const active  = all.filter(p => p.status !== 'sold');
    const now     = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const totalRevenue   = sold.reduce((s, p) => s + Number(p.soldPrice || p.price), 0);
    const totalProfit    = sold.reduce((s, p) => s + (Number(p.soldPrice || p.price) - Number(p.price)), 0);
    const totalViews     = all.reduce((s, p)  => s + Number(p.views     || 0), 0);
    const totalFavorites = all.reduce((s, p)  => s + Number(p.favorites || 0), 0);

    const soldThisMonth  = sold.filter(p => p.soldAt && new Date(p.soldAt) >= firstOfMonth).length;
    const revenueThisMonth = sold
      .filter(p => p.soldAt && new Date(p.soldAt) >= firstOfMonth)
      .reduce((s, p) => s + Number(p.soldPrice || p.price), 0);

    const ttsList = sold.map(p => calcTTS(p)).filter(Boolean);
    const avgTTS  = ttsList.length ? Math.round(ttsList.reduce((a, b) => a + b, 0) / ttsList.length) : 0;

    const catStats = this.getCategoryStats();
    const bestCat  = catStats[0] || null;
    const worstCat = catStats.length ? catStats[catStats.length - 1] : null;

    return {
      totalRevenue,
      totalProfit,
      totalViews,
      totalFavorites,
      soldCount:       sold.length,
      activeCount:     active.length,
      soldThisMonth,
      revenueThisMonth,
      avgTTS,
      bestCat,
      worstCat,
    };
  }

  /**
   * Devuelve productos activos enriquecidos con diagnóstico.
   * Fuente única para ProductsScreen y Dashboard alertas.
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
   * Combina: estancamiento, estacionalidad, y umbrales críticos.
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

    // Mapa de TTS medio por categoría para comparar
    const catTTSMap = Object.fromEntries(catStats.map(c => [c.name, c.avgTTS]));

    products.forEach(p => {
      const cat      = p.category || 'Otros';
      const catAvgTTS = catTTSMap[cat] || 30;

      // 1. ESTANCAMIENTO — más lento que la media de su categoría
      if (p.daysOld > catAvgTTS * multiplier) {
        alerts.push({
          type:     'stale',
          priority: p.daysOld > catAvgTTS * multiplier * 2 ? 'high' : 'medium',
          productId: p.id,
          title:    p.title,
          message:  `Lleva ${p.daysOld}d. La media de ${cat} es ${catAvgTTS}d.`,
          action:   'REVISAR PRECIO',
          icon:     'clock',
        });
      }

      // 2. ESTACIONALIDAD — categoría prioritaria este mes
      if (seasonalMap[currentMonth] === cat) {
        alerts.push({
          type:     'seasonal',
          priority: 'high',
          productId: p.id,
          title:    `🔥 Temporada de ${cat}`,
          message:  `${p.title} encaja con el mes actual. ¡Es el momento!`,
          action:   'REPUBLICAR / SUBIR',
          icon:     'zap',
        });
      }

      // 3. CRÍTICO — supera el umbral de meses configurado
      if (p.daysOld > criticalMos * 30) {
        alerts.push({
          type:     'critical',
          priority: 'high',
          productId: p.id,
          title:    `CRÍTICO: ${p.title}`,
          message:  `Supera ${criticalMos} meses sin venderse.`,
          action:   'REPUBLICAR URGENTE',
          icon:     'alert-circle',
        });
      }

      // 4. OPORTUNIDAD — muchos favs, sin oferta aún
      if (p.favorites > 8 && p.daysOld > 20) {
        alerts.push({
          type:     'opportunity',
          priority: 'medium',
          productId: p.id,
          title:    `💡 Oportunidad: ${p.title}`,
          message:  `${p.favorites} personas lo han favoriteado. Haz una oferta.`,
          action:   'HACER OFERTA',
          icon:     'heart',
        });
      }
    });

    // Ordenar: high primero, luego por tipo
    const order = { critical: 0, stale: 1, seasonal: 2, opportunity: 3 };
    return alerts.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority === 'high' ? -1 : 1;
      return (order[a.type] || 9) - (order[b.type] || 9);
    });
  }

  /**
   * Smart Insights: recomendaciones accionables de negocio.
   * Usadas en el Dashboard como tarjetas de decisión.
   */
  static getSmartInsights() {
    const catStats    = this.getCategoryStats();
    const kpis        = this.getBusinessKPIs();
    const now         = new Date();
    const currentMonth = now.getMonth();
    const config      = this.getConfig();
    const seasonalMap  = config.seasonalMap || DEFAULT_CONFIG.seasonalMap;
    const monthNames   = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const insights     = [];

    // 1. Categoría estrella
    if (catStats[0]) {
      insights.push({
        type:    'star',
        icon:    '⚡',
        title:   `${catStats[0].name} vende en ${catStats[0].avgTTS}d de media`,
        message: `Busca más stock de ${catStats[0].name}. ${catStats[0].advice}.`,
        color:   catStats[0].color,
      });
    }

    // 2. Categoría más lenta
    const anchor = catStats.find(c => c.avgTTS > 30);
    if (anchor) {
      insights.push({
        type:    'anchor',
        icon:    '⚓',
        title:   `${anchor.name} tarda ${anchor.avgTTS}d en venderse`,
        message: `${anchor.advice}. Evalúa reducir stock de esta categoría.`,
        color:   '#E63946',
      });
    }

    // 3. Tip estacional
    const seasonalCat = seasonalMap[currentMonth];
    if (seasonalCat) {
      insights.push({
        type:    'seasonal',
        icon:    '📅',
        title:   `${monthNames[currentMonth]}: temporada de ${seasonalCat}`,
        message: `Publica o republica tus ${seasonalCat} ahora para aprovechar la demanda estacional.`,
        color:   '#FFB800',
      });
    }

    // 4. TTS global vs objetivo
    if (kpis.avgTTS > 0) {
      const target = 21; // 3 semanas como benchmark
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
          message: 'Estás vendiendo muy bien. Prueba a subir los precios un 10%.',
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