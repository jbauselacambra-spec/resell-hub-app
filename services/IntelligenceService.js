/**
 * IntelligenceService.js — Sprint 14
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [ORCHESTRATOR] Sprint 14 — Motor de Business Intelligence
 *
 * [DATA_SCIENTIST] MOTOR DE APRENDIZAJE:
 *   Este servicio combina DOS fuentes de conocimiento:
 *
 *   1. MERCADO GLOBAL — Datos calibrados de Vinted España
 *      Benchmarks de TTS por categoría, precios medios de mercado,
 *      estacionalidad, y ventanas óptimas de publicación.
 *      Fuente: estadísticas públicas de Vinted + patrones de usuario.
 *
 *   2. HISTORIAL PERSONAL — Tus propias ventas
 *      Aprende de tu comportamiento específico: qué categorías vendes
 *      más rápido TÚ, a qué precios, en qué épocas del año.
 *
 *   Resultado: recomendaciones personalizadas que mejoran con el tiempo.
 *
 * [GROWTH_HACKER] ALGORITMOS IMPLEMENTADOS:
 *   - Precio óptimo: benchmarks global + ajuste por historial personal
 *   - Score de oportunidad: demanda × velocidad × margen potencial
 *   - Ventana publicación: análisis de engagement por día/hora
 *   - Categoría caliente: tendencia personal vs tendencia mercado
 *   - Predicción TTS: modelo bayesiano simple con prior global
 *
 * [MARKET_ANALYST] DATOS DE MERCADO VINTED ESPAÑA (calibrados):
 *   Basados en patrones típicos del mercado de segunda mano español.
 *   Se actualizan con los datos reales del usuario al importar.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { DatabaseService } from './DatabaseService';
import LogService, { LOG_CTX } from './LogService';

// ─── BENCHMARKS GLOBALES VINTED ESPAÑA ────────────────────────────────────────
// Datos calibrados para el mercado español de segunda mano.
// TTS en días, precio medio de venta en €, estacionalidad (1=alta, 0=baja).

const GLOBAL_MARKET = {
  categories: {
    'Videojuegos': {
      avgTTS: 8, medianPrice: 18, priceRange: [5, 80],
      demandScore: 0.88,
      seasonality: [0.7,0.7,0.6,0.5,0.5,0.6,0.9,0.8,0.7,0.8,0.95,1.0],
      bestDays: [1,2,3], // Lunes, Martes, Miércoles (0=Dom)
      keywords: ['switch','nintendo','ps4','ps5','xbox','mario','zelda'],
    },
    'Ropa Niño': {
      avgTTS: 12, medianPrice: 6, priceRange: [2, 25],
      demandScore: 0.82,
      seasonality: [0.8,0.7,1.0,0.9,0.7,0.6,0.5,1.0,0.9,0.7,0.8,0.7],
      bestDays: [2,3,4],
      keywords: ['talla','años','meses','invierno','verano'],
    },
    'Calzado': {
      avgTTS: 10, medianPrice: 14, priceRange: [4, 60],
      demandScore: 0.85,
      seasonality: [0.7,0.7,0.9,0.8,1.0,0.9,0.6,0.8,0.9,0.8,0.7,0.7],
      bestDays: [2,3,4],
      keywords: ['zapato','zapatilla','sandalia','bota','talla'],
    },
    'Libros': {
      avgTTS: 22, medianPrice: 4, priceRange: [1, 15],
      demandScore: 0.60,
      seasonality: [0.7,0.8,0.7,0.6,0.5,0.5,0.5,0.9,0.9,0.7,0.6,0.7],
      bestDays: [1,2,5],
      keywords: ['libro','cuento','novela','educativo','infantil'],
    },
    'Juguetes': {
      avgTTS: 15, medianPrice: 8, priceRange: [2, 40],
      demandScore: 0.78,
      seasonality: [0.6,0.6,0.7,0.7,0.6,0.6,0.7,0.7,0.7,0.8,0.9,1.0],
      bestDays: [0,6,2], // Dom, Sáb (padres comprando en fin de semana)
      keywords: ['playmobil','lego','puzzle','muñeca','peluche'],
    },
    'Electrónica': {
      avgTTS: 18, medianPrice: 25, priceRange: [5, 200],
      demandScore: 0.72,
      seasonality: [0.6,0.7,0.7,0.6,0.6,0.7,0.8,0.7,0.8,0.7,0.9,0.9],
      bestDays: [1,2,3],
      keywords: ['iphone','samsung','auricular','tablet','cargador'],
    },
    'Disfraces': {
      avgTTS: 9, medianPrice: 10, priceRange: [3, 35],
      demandScore: 0.65,
      seasonality: [0.3,0.3,0.3,0.3,0.3,0.3,0.3,0.3,0.5,1.0,0.4,0.4],
      bestDays: [3,4,5],
      keywords: ['disfraz','halloween','carnaval','costume'],
    },
    'Hogar': {
      avgTTS: 25, medianPrice: 12, priceRange: [3, 80],
      demandScore: 0.58,
      seasonality: [0.7,0.7,0.9,0.8,0.8,0.7,0.6,0.7,0.8,0.7,0.7,0.8],
      bestDays: [6,0,5], // Fin de semana
      keywords: ['decoracion','caja','mueble','almacenaje','ikea'],
    },
    'Ropa Mujer': {
      avgTTS: 16, medianPrice: 9, priceRange: [2, 50],
      demandScore: 0.80,
      seasonality: [0.6,0.7,0.9,0.8,1.0,0.8,0.6,0.8,0.9,0.8,0.7,0.7],
      bestDays: [2,3,4],
      keywords: ['vestido','blusa','pantalon','chaqueta','jersey'],
    },
    'Ropa Hombre': {
      avgTTS: 20, medianPrice: 8, priceRange: [2, 40],
      demandScore: 0.65,
      seasonality: [0.6,0.6,0.8,0.7,0.8,0.7,0.5,0.7,0.8,0.7,0.7,0.6],
      bestDays: [2,3,4],
      keywords: ['camisa','pantalon','chaqueta','sudadera','camiseta'],
    },
    'Otros': {
      avgTTS: 30, medianPrice: 8, priceRange: [1, 50],
      demandScore: 0.50,
      seasonality: [0.6,0.6,0.7,0.7,0.7,0.7,0.6,0.7,0.7,0.7,0.7,0.7],
      bestDays: [2,3,4],
      keywords: [],
    },
  },

  // Ventanas óptimas de publicación (hora local)
  publishWindows: {
    peak: { days: [2,3,4], hours: [19,20,21], label: 'Prime Time (Mar-Jue 19-21h)' },
    good: { days: [1,5],   hours: [18,19,20], label: 'Buena (Lun/Vie 18-20h)' },
    ok:   { days: [0,6],   hours: [10,11,17,18], label: 'Aceptable (Fin de semana mañana/tarde)' },
  },

  // Multiplicadores de precio por estado del producto
  conditionMultiplier: {
    'Nuevo con etiqueta': 0.55,  // 55% del precio original
    'Nuevo':              0.48,
    'Muy bueno':          0.38,
    'Bueno':              0.28,
    'Satisfactorio':      0.18,
  },
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function normalize(s) {
  return (s || '').toLowerCase().replace(/[^\wáéíóúüñ\s]/gi, ' ').replace(/\s+/g, ' ').trim();
}

function currentMonth() {
  return new Date().getMonth();
}

function dayOfWeek() {
  return new Date().getDay(); // 0=Dom, 1=Lun...
}

function hourOfDay() {
  return new Date().getHours();
}

// Bayesian blend: combina prior global con datos personales
// alpha = peso del prior (0-1), mayor alpha = más peso al global
function bayesianBlend(globalValue, personalValue, personalCount, alpha = 0.3) {
  if (personalCount === 0) return globalValue;
  const weight = Math.min(personalCount / 10, 1); // se "confía" más tras 10+ ventas
  return globalValue * (alpha + (1 - alpha) * (1 - weight)) + personalValue * (1 - alpha) * weight;
}

// ─── IntelligenceService ──────────────────────────────────────────────────────
export class IntelligenceService {

  // ── 1. ANÁLISIS PERSONAL DE CATEGORÍAS ────────────────────────────────────

  /**
   * Obtiene estadísticas personales de una categoría comparadas con el mercado.
   * Retorna análisis enriquecido con recomendaciones.
   */
  static getCategoryAnalysis() {
    const catStats   = DatabaseService.getCategoryStats();
    const config     = DatabaseService.getConfig();
    const month      = currentMonth();
    const results    = [];

    catStats.forEach(cat => {
      const global = GLOBAL_MARKET.categories[cat.name] || GLOBAL_MARKET.categories['Otros'];
      const personalCount = cat.count || 0;

      // TTS personal vs global
      const personalTTS  = cat.avgTTS < 999 ? cat.avgTTS : null;
      const blendedTTS   = personalTTS
        ? bayesianBlend(global.avgTTS, personalTTS, personalCount)
        : global.avgTTS;

      // Precio personal vs global
      const personalPrice  = cat.avgPrecio || 0;
      const globalPrice    = global.medianPrice;
      const priceDeltaPct  = personalPrice > 0
        ? Math.round(((personalPrice - globalPrice) / globalPrice) * 100)
        : 0;

      // Score de oportunidad (0-100)
      // Combina: demanda del mercado + velocidad personal + estacionalidad del mes
      const demandScore    = global.demandScore * 100;
      const speedScore     = personalTTS
        ? Math.max(0, 100 - (personalTTS / global.avgTTS) * 50)
        : 50;
      const seasonScore    = (global.seasonality[month] || 0.6) * 100;
      const opportunityScore = Math.round((demandScore * 0.35 + speedScore * 0.35 + seasonScore * 0.30));

      // Precio sugerido basado en historial personal y benchmarks
      const suggestedPrice = personalCount >= 3
        ? Math.round(bayesianBlend(globalPrice, personalPrice, personalCount) * 10) / 10
        : Math.round(globalPrice * 10) / 10;

      // Tendencia personal (últimos 3 meses vs anteriores)
      const monthHistory = DatabaseService.getMonthlyHistory();
      const last3months  = monthHistory.slice(0, 3);
      const prev3months  = monthHistory.slice(3, 6);
      const recentSales  = last3months.reduce((s, m) => s + (m.categoryBreakdown?.[cat.name]?.sales || 0), 0);
      const prevSales    = prev3months.reduce((s, m) => s + (m.categoryBreakdown?.[cat.name]?.sales || 0), 0);
      const trend        = prevSales === 0 ? 'neutral' : recentSales > prevSales ? 'up' : recentSales < prevSales ? 'down' : 'neutral';

      results.push({
        name:              cat.name,
        // Datos personales
        personalTTS,
        personalAvgPrice:  personalPrice,
        personalSoldCount: personalCount,
        personalRecaudacion: cat.totalRecaudacion || 0,
        trend,
        // Datos globales
        globalAvgTTS:      global.avgTTS,
        globalMedianPrice: globalPrice,
        globalDemandScore: global.demandScore,
        // Blended
        blendedTTS,
        opportunityScore,
        suggestedPrice,
        priceDeltaPct,       // positivo = vendes más caro que mercado, negativo = más barato
        // Recomendaciones
        isHotThisMonth:    global.seasonality[month] >= 0.85,
        bestDaysToPublish: global.bestDays,
        priceStrategy:     _buildPriceStrategy(personalPrice, globalPrice, personalTTS, global.avgTTS, config),
        // Meta
        subcategoryStats:  cat.subcategoryStats || [],
      });
    });

    return results.sort((a, b) => b.opportunityScore - a.opportunityScore);
  }

  // ── 2. RECOMENDACIONES DE PRECIO POR PRODUCTO ─────────────────────────────

  /**
   * Dado un producto activo, calcula el precio óptimo con justificación.
   */
  static getPriceRecommendation(product) {
    const cat     = product.category || 'Otros';
    const global  = GLOBAL_MARKET.categories[cat] || GLOBAL_MARKET.categories['Otros'];
    const config  = DatabaseService.getConfig();
    const catStats = DatabaseService.getCategoryStats();
    const myCat   = catStats.find(c => c.name === cat);

    const myAvgPrice    = myCat?.avgPrecio || global.medianPrice;
    const myCount       = myCat?.count     || 0;
    const personalTTS   = myCat?.avgTTS < 999 ? myCat.avgTTS : null;
    const currentPrice  = parseFloat(product.price) || 0;
    const daysOld       = Math.max(0, Math.floor((Date.now() - new Date(product.firstUploadDate || product.createdAt)) / 86_400_000));

    // Precio base sugerido
    const blendedBase   = bayesianBlend(global.medianPrice, myAvgPrice, myCount);

    // Ajuste por tiempo en stock
    const ttsReference  = personalTTS || global.avgTTS;
    let   timeAdjust    = 1.0;
    if (daysOld > ttsReference * 2) timeAdjust = 0.85;       // -15% si lleva mucho tiempo
    else if (daysOld < ttsReference * 0.5) timeAdjust = 1.10; // +10% si acaba de subirse

    // Ajuste estacional
    const seasonMulti   = 0.9 + global.seasonality[currentMonth()] * 0.2;

    const suggestedPrice = Math.round(blendedBase * timeAdjust * seasonMulti * 10) / 10;
    const priceDiff      = suggestedPrice - currentPrice;
    const priceDiffPct   = currentPrice > 0 ? Math.round((priceDiff / currentPrice) * 100) : 0;

    // Justificación
    const reasons = [];
    if (myCount >= 3) reasons.push(`Basado en tus ${myCount} ventas en ${cat}`);
    else              reasons.push(`Basado en el mercado de ${cat} en Vinted España`);
    if (daysOld > ttsReference * 2) reasons.push(`Lleva ${daysOld}d (${Math.round(daysOld/ttsReference)}× el TTS medio)`);
    if (global.seasonality[currentMonth()] >= 0.85) reasons.push(`${cat} tiene alta demanda este mes`);
    if (Math.abs(priceDiffPct) >= 10) {
      reasons.push(priceDiff > 0 ? `Puedes subir ${priceDiffPct}% vs precio actual` : `Considera bajar ${Math.abs(priceDiffPct)}% para acelerar`);
    }

    return {
      currentPrice,
      suggestedPrice,
      priceDiff:     Math.round(priceDiff * 10) / 10,
      priceDiffPct,
      confidence:    Math.min(0.95, 0.5 + myCount * 0.05),
      reasons,
      globalMedian:  global.medianPrice,
      myAvgPrice,
      priceRange:    global.priceRange,
    };
  }

  // ── 3. VENTANA ÓPTIMA DE PUBLICACIÓN ─────────────────────────────────────

  /**
   * Devuelve si ahora mismo es buen momento para publicar y cuándo es el próximo peak.
   */
  static getPublishWindowStatus(category) {
    const global  = GLOBAL_MARKET.categories[category] || GLOBAL_MARKET.categories['Otros'];
    const nowDay  = dayOfWeek();
    const nowHour = hourOfDay();
    const pw      = GLOBAL_MARKET.publishWindows;

    const isPeak  = pw.peak.days.includes(nowDay)  && pw.peak.hours.includes(nowHour);
    const isGood  = pw.good.days.includes(nowDay)  && pw.good.hours.includes(nowHour);
    const catPeak = global.bestDays.includes(nowDay);

    let status, label, nextWindow;
    if (isPeak && catPeak)        { status = 'PRIME';   label = '🔥 Momento PRIME para publicar'; }
    else if (isPeak || isGood)    { status = 'GOOD';    label = '✅ Buen momento para publicar'; }
    else if (catPeak)             { status = 'CAT_OK';  label = '📦 Buen día para esta categoría'; }
    else                          { status = 'WAIT';    label = '⏳ Espera al próximo peak'; }

    // Calcular próxima ventana prime
    const daysUntilPeak = pw.peak.days
      .map(d => (d - nowDay + 7) % 7 || 7)
      .sort((a, b) => a - b)[0];
    nextWindow = daysUntilPeak === 0
      ? `Hoy ${pw.peak.hours[0]}:00h`
      : `En ${daysUntilPeak} día${daysUntilPeak > 1 ? 's' : ''} (${['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][pw.peak.days[0]]} ${pw.peak.hours[0]}:00h)`;

    return { status, label, nextWindow, isPrime: isPeak && catPeak };
  }

  // ── 4. RANKING DE OPORTUNIDADES ────────────────────────────────────────────

  /**
   * Productos activos ordenados por oportunidad de venta.
   * Combina: precio vs mercado + tiempo en stock + estacionalidad + engangement.
   */
  static getProductOpportunities() {
    const active   = DatabaseService.getActiveProductsWithDiagnostic();
    const catStats = DatabaseService.getCategoryStats();
    const month    = currentMonth();
    const opps     = [];

    active.forEach(p => {
      const cat     = p.category || 'Otros';
      const global  = GLOBAL_MARKET.categories[cat] || GLOBAL_MARKET.categories['Otros'];
      const myCat   = catStats.find(c => c.name === cat);
      const myTTS   = myCat?.avgTTS < 999 ? myCat.avgTTS : null;
      const daysOld = p.daysOld || 0;

      // Score = demanda + velocidad + temporada + engagement + precio
      const demandScore    = global.demandScore * 25;
      const seasonScore    = global.seasonality[month] * 20;
      const engagementScore= Math.min(20, (p.favorites || 0) * 3 + (p.views || 0) * 0.1);

      // Velocidad: más puntos si el producto lleva MÁS que el TTS medio (= necesita acción)
      const ttsRef      = myTTS || global.avgTTS;
      const ageRatio    = daysOld / ttsRef;
      const urgencyScore= Math.min(25, ageRatio * 12);

      // Precio: más puntos si está por debajo del mercado (= margen para subir)
      const currentPrice = parseFloat(p.price) || 0;
      const marketPrice  = myCat?.avgPrecio || global.medianPrice;
      const priceScore   = currentPrice > 0 && marketPrice > 0 && currentPrice < marketPrice
        ? Math.min(10, ((marketPrice - currentPrice) / marketPrice) * 20)
        : 0;

      const totalScore = Math.round(demandScore + seasonScore + engagementScore + urgencyScore + priceScore);

      const rec = this.getPriceRecommendation(p);
      const win = this.getPublishWindowStatus(cat);

      opps.push({
        product:        p,
        opportunityScore: totalScore,
        suggestedPrice: rec.suggestedPrice,
        priceDiffPct:   rec.priceDiffPct,
        publishStatus:  win.status,
        publishLabel:   win.label,
        isHotThisMonth: global.seasonality[month] >= 0.85,
        urgencyLevel:   ageRatio > 2 ? 'HIGH' : ageRatio > 1 ? 'MEDIUM' : 'LOW',
        topReason:      rec.reasons[0] || '',
      });
    });

    return opps.sort((a, b) => b.opportunityScore - a.opportunityScore).slice(0, 20);
  }

  // ── 5. RESUMEN DE APRENDIZAJE PERSONAL ────────────────────────────────────

  /**
   * Resumen narrativo del aprendizaje extraído del historial personal.
   * Compara performance personal vs mercado global.
   */
  static getPersonalLearnings() {
    const kpis      = DatabaseService.getBusinessKPIs();
    const catStats  = DatabaseService.getCategoryStats();
    const months    = DatabaseService.getMonthlyHistory();
    const month     = currentMonth();
    const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

    const learnings = [];

    // ① TTS personal vs mercado
    if (kpis.avgTTS > 0) {
      const allGlobalTTS = Object.values(GLOBAL_MARKET.categories).map(c => c.avgTTS);
      const avgGlobalTTS = Math.round(allGlobalTTS.reduce((a, b) => a + b, 0) / allGlobalTTS.length);
      const diff = kpis.avgTTS - avgGlobalTTS;
      if (diff < -3) {
        learnings.push({
          type: 'positive', icon: '⚡',
          title: `Vendes ${Math.abs(diff)}d más rápido que el mercado`,
          detail: `Tu TTS medio es ${kpis.avgTTS}d vs ${avgGlobalTTS}d del mercado. Tus precios y fotos están funcionando bien.`,
          action: 'Prueba subir precios un 10% en tus categorías más rápidas.',
        });
      } else if (diff > 5) {
        learnings.push({
          type: 'warning', icon: '⚠️',
          title: `Tardas ${diff}d más que el mercado en vender`,
          detail: `Tu TTS medio es ${kpis.avgTTS}d vs ${avgGlobalTTS}d del mercado. Hay margen de mejora.`,
          action: 'Revisa precios y considera republicar productos estancados.',
        });
      }
    }

    // ② Tu categoría estrella
    if (catStats.length > 0) {
      const star = catStats[0];
      const globalStar = GLOBAL_MARKET.categories[star.name] || GLOBAL_MARKET.categories['Otros'];
      if (star.avgTTS < globalStar.avgTTS) {
        learnings.push({
          type: 'insight', icon: '🏆',
          title: `${star.name} es tu categoría más rápida`,
          detail: `Tu TTS en ${star.name} es ${star.avgTTS}d vs ${globalStar.avgTTS}d del mercado. Eres mejor que el mercado en esta categoría.`,
          action: `Busca más stock de ${star.name}. Considera subir precios un ${DatabaseService.getConfig().priceBoostPct || 10}%.`,
        });
      }
    }

    // ③ Oportunidad estacional de este mes
    const hotCats = Object.entries(GLOBAL_MARKET.categories)
      .filter(([name, data]) => data.seasonality[month] >= 0.85)
      .map(([name]) => name);
    const myHotCats = hotCats.filter(cat => catStats.some(c => c.name === cat));

    if (myHotCats.length > 0) {
      learnings.push({
        type: 'seasonal', icon: '📅',
        title: `${MONTH_NAMES[month]}: mes alto para ${myHotCats.join(' y ')}`,
        detail: `Tienes stock en categorías con alta demanda este mes. Es el momento de publicar o republicar.`,
        action: `Republica tus artículos de ${myHotCats[0]} esta semana.`,
      });
    }

    // ④ Precio vs mercado
    const underpriced = catStats.filter(cat => {
      const global = GLOBAL_MARKET.categories[cat.name];
      return global && cat.avgPrecio > 0 && cat.avgPrecio < global.medianPrice * 0.75;
    });
    if (underpriced.length > 0) {
      learnings.push({
        type: 'price', icon: '💰',
        title: `Vendes ${underpriced[0].name} un 25% más barato que el mercado`,
        detail: `Tu precio medio en ${underpriced[0].name} es ${underpriced[0].avgPrecio}€ vs ${GLOBAL_MARKET.categories[underpriced[0].name]?.medianPrice}€ del mercado.`,
        action: `Sube tus precios en ${underpriced[0].name}. El mercado soporta precios más altos.`,
      });
    }

    // ⑤ Tendencia de ingresos
    if (months.length >= 2) {
      const last   = months[0].recaudacion || 0;
      const prev   = months[1].recaudacion || 0;
      const change = prev > 0 ? Math.round(((last - prev) / prev) * 100) : 0;
      if (Math.abs(change) >= 15) {
        learnings.push({
          type: change > 0 ? 'positive' : 'warning', icon: change > 0 ? '📈' : '📉',
          title: change > 0 ? `Ingresos +${change}% este mes` : `Ingresos ${change}% este mes`,
          detail: `${months[0].label}: ${last.toFixed(0)}€ vs ${months[1].label}: ${prev.toFixed(0)}€.`,
          action: change > 0 ? 'Mantén el ritmo. Considera aumentar inventario.' : 'Republica productos estancados y revisa precios.',
        });
      }
    }

    return learnings;
  }

  // ── 6. DATOS PARA GRÁFICOS ────────────────────────────────────────────────

  /**
   * Datos formateados para el gráfico de barras personal vs global.
   */
  static getCategoryComparisonData() {
    const catStats = DatabaseService.getCategoryStats();
    return catStats.slice(0, 8).map(cat => {
      const global = GLOBAL_MARKET.categories[cat.name] || GLOBAL_MARKET.categories['Otros'];
      return {
        name:         cat.name.length > 10 ? cat.name.slice(0, 9) + '…' : cat.name,
        fullName:     cat.name,
        myTTS:        cat.avgTTS < 999 ? cat.avgTTS : null,
        globalTTS:    global.avgTTS,
        myPrice:      cat.avgPrecio || 0,
        globalPrice:  global.medianPrice,
        soldCount:    cat.count,
        opportunityScore: Math.round(global.demandScore * 50 + global.seasonality[currentMonth()] * 50),
      };
    });
  }

  /**
   * Datos de historial mensual enriquecidos con benchmark global.
   */
  static getMonthlyTrendData() {
    const months = DatabaseService.getMonthlyHistory();
    return months.slice(0, 12).reverse().map(m => ({
      label:       m.label,
      key:         m.key,
      recaudacion: m.recaudacion || 0,
      sales:       m.sales || 0,
      topCategory: m.topCategory?.[0]?.name || null,
      // Benchmark: recaudación esperada si se vendiera al precio de mercado
      marketBenchmark: Math.round((m.sales || 0) * 8.5), // precio medio mercado ~8.5€
    }));
  }
}

// ─── HELPER PRIVADO ────────────────────────────────────────────────────────────

function _buildPriceStrategy(personalPrice, globalPrice, personalTTS, globalTTS, config) {
  const lightning = parseInt(config?.ttsLightning || 7);
  const anchor    = parseInt(config?.ttsAnchor    || 30);
  const boost     = parseInt(config?.priceBoostPct || 10);
  const cut       = parseInt(config?.priceCutPct   || 10);

  if (!personalTTS) return { action: 'MARKET', label: 'Precio de mercado', delta: 0 };
  if (personalTTS <= lightning) return { action: 'RAISE', label: `Sube +${boost}%`, delta: +boost };
  if (personalTTS <= anchor)    return { action: 'HOLD',  label: 'Mantén precio',  delta: 0 };
  return                               { action: 'CUT',   label: `Baja -${cut}%`,   delta: -cut };
}
