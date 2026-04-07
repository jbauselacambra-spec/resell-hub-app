/**
 * BusinessIntelligenceScreen.jsx — Sprint 14
 *
 * [UI_SPECIALIST] Pantalla de Business Intelligence.
 * Nueva pantalla accesible desde Stats (tab existente) como sección expandida,
 * o directamente via navigation.navigate('Intelligence').
 *
 * Secciones:
 *   1. Aprendizajes personales (tarjetas de insight)
 *   2. Ranking de oportunidades (productos activos priorizados)
 *   3. Comparativa personal vs mercado por categoría (gráfico de barras)
 *   4. Historial mensual con benchmark (gráfico de línea)
 *   5. Análisis de categorías con score de oportunidad
 *
 * [QA_ENGINEER] Cumple:
 *   - Hooks antes de early returns (Regla 12)
 *   - DS Light canónico
 *   - FlatList para listas > 5 items
 *   - try/catch en todas las cargas de datos
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Dimensions, Platform, RefreshControl, FlatList,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { IntelligenceService } from '../services/IntelligenceService';
import { DatabaseService } from '../services/DatabaseService';
import LogService, { LOG_CTX } from '../services/LogService';

const { width } = Dimensions.get('window');
const BAR_MAX_H = 90;

// ─── Design System Light Canónico ─────────────────────────────────────────────
const DS = {
  bg:        '#F8F9FA',
  white:     '#FFFFFF',
  surface2:  '#F0F2F5',
  border:    '#EAEDF0',
  primary:   '#FF6B35',
  primaryBg: '#FFF2EE',
  success:   '#00D9A3',
  successBg: '#E8FBF6',
  warning:   '#FFB800',
  warningBg: '#FFF8E7',
  danger:    '#E63946',
  dangerBg:  '#FFF0F1',
  blue:      '#004E89',
  blueBg:    '#EAF2FB',
  purple:    '#7B61FF',
  purpleBg:  '#F0EFFE',
  text:      '#1A1A2E',
  textMed:   '#5C6070',
  textLow:   '#A0A5B5',
  mono:      Platform.OS === 'android' ? 'monospace' : 'Courier New',
};

// ─── Colores de estado de aprendizaje ─────────────────────────────────────────
const LEARNING_COLORS = {
  positive: { bg: DS.successBg, border: DS.success, text: DS.success },
  warning:  { bg: DS.dangerBg,  border: DS.danger,  text: DS.danger  },
  insight:  { bg: DS.blueBg,    border: DS.blue,    text: DS.blue    },
  seasonal: { bg: DS.warningBg, border: DS.warning, text: DS.warning },
  price:    { bg: DS.purpleBg,  border: DS.purple,  text: DS.purple  },
};

// ─── Componente: Tarjeta de insight ───────────────────────────────────────────
function LearningCard({ item, onAction }) {
  const [expanded, setExpanded] = useState(false);
  const colors = LEARNING_COLORS[item.type] || LEARNING_COLORS.insight;

  return (
    <TouchableOpacity
      style={[styles.learningCard, { borderLeftColor: colors.border, backgroundColor: colors.bg }]}
      onPress={() => setExpanded(e => !e)}
      activeOpacity={0.75}
    >
      <View style={styles.learningHeader}>
        <Text style={styles.learningIcon}>{item.icon}</Text>
        <Text style={[styles.learningTitle, { color: colors.text }]} numberOfLines={expanded ? undefined : 2}>
          {item.title}
        </Text>
        <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={colors.text} />
      </View>
      {expanded && (
        <>
          <Text style={[styles.learningDetail, { color: DS.textMed }]}>{item.detail}</Text>
          <TouchableOpacity
            style={[styles.learningActionBtn, { backgroundColor: colors.border }]}
            onPress={() => onAction && onAction(item)}
            activeOpacity={0.7}
          >
            <Icon name="zap" size={12} color="#FFF" />
            <Text style={styles.learningActionTxt}>{item.action}</Text>
          </TouchableOpacity>
        </>
      )}
    </TouchableOpacity>
  );
}

// ─── Componente: Tarjeta de oportunidad ───────────────────────────────────────
function OpportunityCard({ item }) {
  const { product, opportunityScore, suggestedPrice, priceDiffPct, publishLabel, isHotThisMonth, urgencyLevel } = item;
  const urgencyColor = urgencyLevel === 'HIGH' ? DS.danger : urgencyLevel === 'MEDIUM' ? DS.warning : DS.success;
  const scoreColor   = opportunityScore >= 70 ? DS.success : opportunityScore >= 45 ? DS.warning : DS.textMed;

  return (
    <View style={styles.oppCard}>
      <View style={styles.oppHeader}>
        <View style={styles.oppScoreCircle}>
          <Text style={[styles.oppScoreNum, { color: scoreColor }]}>{opportunityScore}</Text>
          <Text style={styles.oppScoreLbl}>score</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.oppTitle} numberOfLines={1}>{product.title}</Text>
          <Text style={styles.oppCat}>{product.category}{product.subcategory ? ` › ${product.subcategory}` : ''}</Text>
          <View style={styles.oppRow}>
            <View style={[styles.urgencyBadge, { backgroundColor: urgencyColor + '20', borderColor: urgencyColor + '50' }]}>
              <Text style={[styles.urgencyTxt, { color: urgencyColor }]}>{urgencyLevel}</Text>
            </View>
            {isHotThisMonth && (
              <View style={[styles.urgencyBadge, { backgroundColor: DS.primaryBg, borderColor: DS.primary + '50' }]}>
                <Text style={[styles.urgencyTxt, { color: DS.primary }]}>🔥 MES CALIENTE</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <View style={styles.oppPriceRow}>
        <View style={styles.oppPriceStat}>
          <Text style={styles.oppPriceLabel}>PRECIO ACTUAL</Text>
          <Text style={[styles.oppPriceVal, { fontFamily: DS.mono }]}>{product.price}€</Text>
        </View>
        <Icon name="arrow-right" size={14} color={DS.textLow} />
        <View style={styles.oppPriceStat}>
          <Text style={styles.oppPriceLabel}>SUGERIDO</Text>
          <Text style={[styles.oppPriceVal, { color: priceDiffPct >= 0 ? DS.success : DS.danger, fontFamily: DS.mono }]}>
            {suggestedPrice}€ {priceDiffPct !== 0 ? `(${priceDiffPct > 0 ? '+' : ''}${priceDiffPct}%)` : ''}
          </Text>
        </View>
      </View>

      <View style={styles.oppPublishRow}>
        <Icon name="clock" size={11} color={DS.textMed} />
        <Text style={styles.oppPublishTxt}>{publishLabel}</Text>
      </View>
    </View>
  );
}

// ─── Componente: Gráfico de barras comparativo TTS ────────────────────────────
function CategoryComparisonChart({ data }) {
  const [mode, setMode] = useState('tts'); // 'tts' | 'price'
  const maxTTS   = Math.max(...data.filter(d => d.myTTS).map(d => Math.max(d.myTTS, d.globalTTS)), 1);
  const maxPrice = Math.max(...data.map(d => Math.max(d.myPrice, d.globalPrice)), 1);

  return (
    <View style={styles.chartCard}>
      <View style={styles.chartHeader}>
        <Text style={styles.chartTitle}>Tú vs Mercado Global</Text>
        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'tts' && styles.modeBtnActive]}
            onPress={() => setMode('tts')} activeOpacity={0.7}
          >
            <Text style={[styles.modeBtnTxt, mode === 'tts' && styles.modeBtnTxtActive]}>TTS</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'price' && styles.modeBtnActive]}
            onPress={() => setMode('price')} activeOpacity={0.7}
          >
            <Text style={[styles.modeBtnTxt, mode === 'price' && styles.modeBtnTxtActive]}>Precio</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.chartSubtitle}>
        {mode === 'tts' ? 'Días medios hasta venta (menos = mejor)' : 'Precio medio de venta en €'}
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.barGroupsRow}>
          {data.map((d, i) => {
            const myVal   = mode === 'tts' ? d.myTTS      : d.myPrice;
            const glbVal  = mode === 'tts' ? d.globalTTS  : d.globalPrice;
            const maxVal  = mode === 'tts' ? maxTTS       : maxPrice;
            const myH     = myVal  ? Math.round((myVal  / maxVal) * BAR_MAX_H) : 0;
            const glbH    = Math.round((glbVal / maxVal) * BAR_MAX_H);
            const isBetter = mode === 'tts'
              ? (myVal && myVal < glbVal)
              : (myVal && myVal > glbVal * 0.9);
            return (
              <View key={d.name} style={styles.barGroup}>
                <View style={styles.barPairRow}>
                  {/* Mi barra */}
                  <View style={styles.barWrapper}>
                    {myH > 0 ? (
                      <View style={[styles.bar, {
                        height: myH,
                        backgroundColor: isBetter ? DS.success : DS.primary,
                      }]} />
                    ) : (
                      <View style={[styles.bar, { height: 6, backgroundColor: DS.border }]} />
                    )}
                    <Text style={[styles.barVal, { color: myH > 0 ? DS.text : DS.textLow }]}>
                      {myVal ? `${myVal}${mode === 'tts' ? 'd' : '€'}` : '—'}
                    </Text>
                  </View>
                  {/* Barra global */}
                  <View style={styles.barWrapper}>
                    <View style={[styles.bar, { height: glbH, backgroundColor: DS.blue + '80' }]} />
                    <Text style={[styles.barVal, { color: DS.textMed }]}>
                      {glbVal}{mode === 'tts' ? 'd' : '€'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.barLabel} numberOfLines={2}>{d.name}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Leyenda */}
      <View style={styles.legend}>
        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: DS.primary }]} /><Text style={styles.legendTxt}>Mis ventas</Text></View>
        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: DS.blue + '80' }]} /><Text style={styles.legendTxt}>Mercado global</Text></View>
        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: DS.success }]} /><Text style={styles.legendTxt}>Mejor que mercado</Text></View>
      </View>
    </View>
  );
}

// ─── Componente: Historial mensual con barras ─────────────────────────────────
function MonthlyTrendChart({ data }) {
  if (!data || data.length === 0) return null;
  const maxVal = Math.max(...data.map(d => Math.max(d.recaudacion, d.marketBenchmark)), 1);
  const currentKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  return (
    <View style={styles.chartCard}>
      <Text style={styles.chartTitle}>Historial de Ingresos</Text>
      <Text style={styles.chartSubtitle}>Tus ingresos vs benchmark de mercado (últimos 12 meses)</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.barGroupsRow}>
          {data.map((m, i) => {
            const recH  = Math.round((m.recaudacion  / maxVal) * BAR_MAX_H);
            const benchH= Math.round((m.marketBenchmark / maxVal) * BAR_MAX_H);
            const isCurr = m.key === currentKey;
            return (
              <View key={m.key} style={styles.barGroup}>
                <View style={styles.barPairRow}>
                  <View style={styles.barWrapper}>
                    <View style={[styles.bar, { height: Math.max(recH, 3), backgroundColor: isCurr ? DS.primary : DS.success }]} />
                    <Text style={[styles.barVal, { color: isCurr ? DS.primary : DS.text }]}>
                      {m.recaudacion > 0 ? `${m.recaudacion.toFixed(0)}€` : '—'}
                    </Text>
                  </View>
                  <View style={styles.barWrapper}>
                    <View style={[styles.bar, { height: Math.max(benchH, 3), backgroundColor: DS.blue + '50' }]} />
                    <Text style={[styles.barVal, { color: DS.textMed }]}>
                      {m.marketBenchmark}€
                    </Text>
                  </View>
                </View>
                <Text style={[styles.barLabel, isCurr && { color: DS.primary, fontWeight: '800' }]} numberOfLines={2}>
                  {m.label.slice(0, 6)}{isCurr ? '\n↑' : ''}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
      <View style={styles.legend}>
        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: DS.success }]} /><Text style={styles.legendTxt}>Mis ingresos</Text></View>
        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: DS.blue + '50' }]} /><Text style={styles.legendTxt}>Benchmark mercado</Text></View>
        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: DS.primary }]} /><Text style={styles.legendTxt}>Mes actual</Text></View>
      </View>
    </View>
  );
}

// ─── Componente: Tarjeta de categoría con score ────────────────────────────────
function CategoryIntelCard({ cat }) {
  const [expanded, setExpanded] = useState(false);
  const scoreColor = cat.opportunityScore >= 70 ? DS.success : cat.opportunityScore >= 50 ? DS.warning : DS.textMed;
  const trendIcon  = cat.trend === 'up' ? '📈' : cat.trend === 'down' ? '📉' : '➡️';

  return (
    <TouchableOpacity
      style={styles.catIntelCard}
      onPress={() => setExpanded(e => !e)}
      activeOpacity={0.75}
    >
      <View style={styles.catIntelHeader}>
        <View style={[styles.scoreRing, { borderColor: scoreColor }]}>
          <Text style={[styles.scoreRingNum, { color: scoreColor }]}>{cat.opportunityScore}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.catIntelName}>{cat.name}</Text>
            <Text>{trendIcon}</Text>
            {cat.isHotThisMonth && <Text style={styles.hotBadge}>🔥 HOT</Text>}
          </View>
          <View style={styles.catIntelMetaRow}>
            <Text style={styles.catIntelMeta}>{cat.personalSoldCount} ventas</Text>
            <Text style={styles.catIntelDot}>·</Text>
            <Text style={styles.catIntelMeta}>
              {cat.personalTTS ? `${cat.personalTTS}d TTS` : 'Sin historial'}
            </Text>
            <Text style={styles.catIntelDot}>·</Text>
            <Text style={[styles.catIntelMeta, { color: DS.blue }]}>
              {cat.suggestedPrice}€ sugerido
            </Text>
          </View>
        </View>
        <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={DS.textLow} />
      </View>

      {expanded && (
        <View style={styles.catIntelExpanded}>
          {/* Comparativa TTS */}
          <View style={styles.catCompRow}>
            <View style={styles.catCompStat}>
              <Text style={styles.catCompLabel}>MI TTS</Text>
              <Text style={[styles.catCompVal, {
                color: cat.personalTTS && cat.personalTTS < cat.globalAvgTTS ? DS.success : DS.warning,
              }]}>{cat.personalTTS ? `${cat.personalTTS}d` : '—'}</Text>
            </View>
            <Icon name="vs" size={10} color={DS.textLow} style={{ alignSelf: 'center' }} />
            <Text style={{ color: DS.textLow, alignSelf: 'center', fontSize: 9, fontWeight: '900' }}>vs</Text>
            <View style={styles.catCompStat}>
              <Text style={styles.catCompLabel}>MERCADO</Text>
              <Text style={[styles.catCompVal, { color: DS.blue }]}>{cat.globalAvgTTS}d</Text>
            </View>
            <View style={styles.catCompStat}>
              <Text style={styles.catCompLabel}>MI PRECIO</Text>
              <Text style={styles.catCompVal}>{cat.personalAvgPrice > 0 ? `${cat.personalAvgPrice}€` : '—'}</Text>
            </View>
            <View style={styles.catCompStat}>
              <Text style={styles.catCompLabel}>MERCADO</Text>
              <Text style={[styles.catCompVal, { color: DS.blue }]}>{cat.globalMedianPrice}€</Text>
            </View>
          </View>

          {/* Estrategia de precio */}
          <View style={[styles.strategyBox, {
            backgroundColor: cat.priceStrategy.action === 'RAISE' ? DS.successBg : cat.priceStrategy.action === 'CUT' ? DS.dangerBg : DS.surface2,
          }]}>
            <Text style={styles.strategyLabel}>ESTRATEGIA PRECIO</Text>
            <Text style={[styles.strategyVal, {
              color: cat.priceStrategy.action === 'RAISE' ? DS.success : cat.priceStrategy.action === 'CUT' ? DS.danger : DS.textMed,
            }]}>
              {cat.priceStrategy.label}
            </Text>
          </View>

          {/* Diferencia precio */}
          {cat.priceDeltaPct !== 0 && (
            <Text style={styles.catPriceDelta}>
              {cat.priceDeltaPct > 0
                ? `Vendes un ${cat.priceDeltaPct}% más caro que el mercado`
                : `Vendes un ${Math.abs(cat.priceDeltaPct)}% más barato que el mercado`}
            </Text>
          )}

          {/* Subcategorías top */}
          {cat.subcategoryStats?.length > 0 && (
            <View style={styles.subCatSection}>
              <Text style={styles.subCatSectionTitle}>SUBCATEGORÍAS</Text>
              {cat.subcategoryStats.slice(0, 3).map(sub => (
                <View key={sub.name} style={styles.subCatRow}>
                  <Icon name="corner-down-right" size={10} color={DS.textLow} />
                  <Text style={styles.subCatName}>{sub.name}</Text>
                  <Text style={[styles.subCatTTS, { color: sub.avgTTS < cat.globalAvgTTS ? DS.success : DS.warning }]}>
                    {sub.avgTTS}d
                  </Text>
                  <Text style={styles.subCatCount}>{sub.count} ventas</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Pantalla Principal ────────────────────────────────────────────────────────
export default function BusinessIntelligenceScreen({ navigation }) {

  // ── HOOKS — antes de cualquier early return (Regla 12) ──────────────────────
  const [learnings,    setLearnings]    = useState([]);
  const [opps,         setOpps]         = useState([]);
  const [catCompData,  setCatCompData]  = useState([]);
  const [monthlyData,  setMonthlyData]  = useState([]);
  const [catIntel,     setCatIntel]     = useState([]);
  const [activeTab,    setActiveTab]    = useState('insights');
  const [refreshing,   setRefreshing]   = useState(false);
  const [loaded,       setLoaded]       = useState(false);

  const TABS = [
    { id: 'insights',     label: '💡 Insights',    icon: 'zap' },
    { id: 'opps',         label: '🎯 Oportunidades',icon: 'target' },
    { id: 'comparison',   label: '📊 Comparativa', icon: 'bar-chart-2' },
    { id: 'categories',   label: '🏷 Categorías',  icon: 'tag' },
  ];

  const loadData = useCallback(() => {
    try {
      setLearnings(IntelligenceService.getPersonalLearnings());
      setOpps(IntelligenceService.getProductOpportunities());
      setCatCompData(IntelligenceService.getCategoryComparisonData());
      setMonthlyData(IntelligenceService.getMonthlyTrendData());
      setCatIntel(IntelligenceService.getCategoryAnalysis());
      setLoaded(true);
      LogService.info('BusinessIntelligence: datos cargados', LOG_CTX.UI);
    } catch (e) {
      LogService.error('BusinessIntelligenceScreen.loadData', LOG_CTX.UI, e);
    }
  }, []);

  useEffect(() => {
    loadData();
    const unsub = navigation.addListener('focus', loadData);
    return unsub;
  }, [navigation, loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
    setRefreshing(false);
  }, [loadData]);

  // ── RENDER: Header KPI strip ────────────────────────────────────────────────
  const renderKPIStrip = () => {
    const kpis = DatabaseService.getBusinessKPIs();
    const catAnalysis = catIntel[0]; // Mejor categoría por oportunidad

    return (
      <View style={styles.kpiStrip}>
        <View style={styles.kpiItem}>
          <Text style={styles.kpiVal}>{opps.length}</Text>
          <Text style={styles.kpiLab}>Oportunidades</Text>
        </View>
        <View style={styles.kpiDivider} />
        <View style={styles.kpiItem}>
          <Text style={[styles.kpiVal, { color: DS.success }]}>
            {catIntel.filter(c => c.isHotThisMonth).length}
          </Text>
          <Text style={styles.kpiLab}>Cats. calientes</Text>
        </View>
        <View style={styles.kpiDivider} />
        <View style={styles.kpiItem}>
          <Text style={[styles.kpiVal, { color: DS.primary }]}>
            {kpis.avgTTS > 0 ? `${kpis.avgTTS}d` : '—'}
          </Text>
          <Text style={styles.kpiLab}>Tu TTS medio</Text>
        </View>
        <View style={styles.kpiDivider} />
        <View style={styles.kpiItem}>
          <Text style={[styles.kpiVal, { color: DS.blue }]}>
            {catAnalysis ? catAnalysis.opportunityScore : '—'}
          </Text>
          <Text style={styles.kpiLab}>Score top cat.</Text>
        </View>
      </View>
    );
  };

  // ── RENDER: Tab Insights ────────────────────────────────────────────────────
  const renderInsights = () => (
    <View>
      {learnings.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyIcon}>🧠</Text>
          <Text style={styles.emptyTitle}>Sin suficientes datos</Text>
          <Text style={styles.emptySub}>
            Importa tu historial de ventas desde la pestaña Importar para generar insights personalizados.
          </Text>
        </View>
      ) : (
        learnings.map((item, i) => (
          <LearningCard key={i} item={item} onAction={(l) => {
            LogService.info(`BI: insight action tapped — ${l.title}`, LOG_CTX.UI);
          }} />
        ))
      )}

      {/* Sección: Ventana publicación actual */}
      {catIntel.length > 0 && (() => {
        const win = IntelligenceService.getPublishWindowStatus(catIntel[0]?.name || 'Otros');
        return (
          <View style={[styles.publishWindowCard, {
            borderColor: win.isPrime ? DS.primary : DS.border,
            backgroundColor: win.isPrime ? DS.primaryBg : DS.white,
          }]}>
            <View style={styles.publishWindowHeader}>
              <Icon name="clock" size={16} color={win.isPrime ? DS.primary : DS.textMed} />
              <Text style={[styles.publishWindowTitle, { color: win.isPrime ? DS.primary : DS.text }]}>
                {win.label}
              </Text>
            </View>
            {!win.isPrime && (
              <Text style={styles.publishWindowNext}>Próximo peak: {win.nextWindow}</Text>
            )}
            {win.isPrime && (
              <Text style={styles.publishWindowPrime}>
                ⚡ Estás en el momento óptimo de publicación. ¡Publica ahora!
              </Text>
            )}
          </View>
        );
      })()}
    </View>
  );

  // ── RENDER: Tab Oportunidades ───────────────────────────────────────────────
  const renderOpportunities = () => (
    <View>
      {opps.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyIcon}>🎯</Text>
          <Text style={styles.emptyTitle}>Sin productos activos</Text>
          <Text style={styles.emptySub}>Importa tu inventario para ver oportunidades de venta.</Text>
        </View>
      ) : (
        <>
          <Text style={styles.sectionHint}>
            Productos ordenados por score de oportunidad. Combina demanda del mercado, tu historial y temporada.
          </Text>
          <FlatList
            data={opps}
            keyExtractor={item => String(item.product.id)}
            renderItem={({ item }) => <OpportunityCard item={item} />}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          />
        </>
      )}
    </View>
  );

  // ── RENDER: Tab Comparativa ─────────────────────────────────────────────────
  const renderComparison = () => (
    <View>
      {catCompData.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyIcon}>📊</Text>
          <Text style={styles.emptyTitle}>Sin datos de categorías</Text>
          <Text style={styles.emptySub}>Importa y marca productos como vendidos para ver la comparativa.</Text>
        </View>
      ) : (
        <>
          <CategoryComparisonChart data={catCompData} />
          <MonthlyTrendChart data={monthlyData} />
          {/* Tabla resumen */}
          <View style={styles.summaryTable}>
            <Text style={styles.summaryTableTitle}>Resumen por categoría</Text>
            <View style={styles.summaryTableHeader}>
              <Text style={[styles.summaryCell, { flex: 2 }]}>Categoría</Text>
              <Text style={styles.summaryCell}>Mi TTS</Text>
              <Text style={styles.summaryCell}>Mercado</Text>
              <Text style={styles.summaryCell}>Score</Text>
            </View>
            {catCompData.map((d, i) => (
              <View key={d.fullName} style={[styles.summaryRow, i % 2 === 0 && { backgroundColor: DS.surface2 }]}>
                <Text style={[styles.summaryCell, { flex: 2, color: DS.text, fontWeight: '600' }]} numberOfLines={1}>
                  {d.fullName}
                </Text>
                <Text style={[styles.summaryCell, {
                  color: d.myTTS && d.myTTS < d.globalTTS ? DS.success : DS.warning,
                  fontWeight: '700',
                }]}>
                  {d.myTTS ? `${d.myTTS}d` : '—'}
                </Text>
                <Text style={[styles.summaryCell, { color: DS.blue }]}>{d.globalTTS}d</Text>
                <Text style={[styles.summaryCell, {
                  color: d.opportunityScore >= 70 ? DS.success : d.opportunityScore >= 50 ? DS.warning : DS.textMed,
                  fontWeight: '800',
                }]}>{d.opportunityScore}</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );

  // ── RENDER: Tab Categorías ──────────────────────────────────────────────────
  const renderCategories = () => (
    <View>
      {catIntel.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyIcon}>🏷</Text>
          <Text style={styles.emptyTitle}>Sin categorías con ventas</Text>
          <Text style={styles.emptySub}>Importa tu historial para ver el análisis de categorías.</Text>
        </View>
      ) : (
        <>
          <Text style={styles.sectionHint}>
            Score de oportunidad = demanda de mercado + tu velocidad de venta + temporada actual.
          </Text>
          <FlatList
            data={catIntel}
            keyExtractor={item => item.name}
            renderItem={({ item }) => <CategoryIntelCard cat={item} />}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          />
        </>
      )}
    </View>
  );

  const renderTab = () => {
    switch (activeTab) {
      case 'insights':   return renderInsights();
      case 'opps':       return renderOpportunities();
      case 'comparison': return renderComparison();
      case 'categories': return renderCategories();
      default:           return renderInsights();
    }
  };

  // ── RENDER PRINCIPAL ────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={18} color={DS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerEyebrow}>MOTOR DE APRENDIZAJE</Text>
          <Text style={styles.headerTitle}>Business Intelligence</Text>
        </View>
        <View style={styles.headerBadge}>
          <Icon name="cpu" size={14} color={DS.purple} />
          <Text style={styles.headerBadgeTxt}>IA</Text>
        </View>
      </View>

      {/* KPI Strip */}
      {loaded && renderKPIStrip()}

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={styles.tabScroll} contentContainerStyle={styles.tabBar}
      >
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabTxt, activeTab === tab.id && styles.tabTxtActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Contenido */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentPad}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={DS.primary} />}
      >
        {!loaded ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>⏳</Text>
            <Text style={styles.emptyTitle}>Cargando análisis...</Text>
          </View>
        ) : renderTab()}
        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: DS.bg },

  header:       { flexDirection: 'row', alignItems: 'center', gap: 10,
                  paddingTop: 52, paddingHorizontal: 16, paddingBottom: 14,
                  backgroundColor: DS.white, borderBottomWidth: 1, borderBottomColor: DS.border },
  backBtn:      { width: 36, height: 36, borderRadius: 18, backgroundColor: DS.surface2,
                  justifyContent: 'center', alignItems: 'center' },
  headerEyebrow:{ fontSize: 9, fontWeight: '900', color: DS.purple, letterSpacing: 1.5 },
  headerTitle:  { fontSize: 20, fontWeight: '900', color: DS.text },
  headerBadge:  { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: DS.purpleBg,
                  paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  headerBadgeTxt:{ fontSize: 11, fontWeight: '900', color: DS.purple },

  kpiStrip:     { flexDirection: 'row', backgroundColor: DS.white, borderBottomWidth: 1,
                  borderBottomColor: DS.border, paddingVertical: 10 },
  kpiItem:      { flex: 1, alignItems: 'center' },
  kpiVal:       { fontSize: 18, fontWeight: '900', color: DS.text },
  kpiLab:       { fontSize: 8, color: DS.textLow, fontWeight: '600', marginTop: 2, textAlign: 'center' },
  kpiDivider:   { width: 1, backgroundColor: DS.border, marginVertical: 4 },

  tabScroll:    { maxHeight: 50, backgroundColor: DS.white, borderBottomWidth: 1, borderBottomColor: DS.border },
  tabBar:       { paddingHorizontal: 12, gap: 4, alignItems: 'center', paddingVertical: 8 },
  tab:          { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  tabActive:    { backgroundColor: DS.purple + '18' },
  tabTxt:       { fontSize: 11, fontWeight: '600', color: DS.textMed },
  tabTxtActive: { color: DS.purple, fontWeight: '800' },

  content:      { flex: 1 },
  contentPad:   { padding: 16, paddingBottom: 40 },

  sectionHint:  { fontSize: 11, color: DS.textLow, marginBottom: 12, lineHeight: 16 },

  // Learning cards
  learningCard: { borderLeftWidth: 4, borderRadius: 14, padding: 14, marginBottom: 10 },
  learningHeader:{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  learningIcon: { fontSize: 18, lineHeight: 22 },
  learningTitle:{ flex: 1, fontSize: 13, fontWeight: '800', lineHeight: 18 },
  learningDetail:{ fontSize: 12, lineHeight: 17, marginTop: 8, marginLeft: 26 },
  learningActionBtn:{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
                      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, marginTop: 10, marginLeft: 26 },
  learningActionTxt:{ fontSize: 11, fontWeight: '800', color: '#FFF' },

  // Publish window
  publishWindowCard:{ borderWidth: 1.5, borderRadius: 14, padding: 14, marginTop: 8 },
  publishWindowHeader:{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  publishWindowTitle:{ fontSize: 14, fontWeight: '700' },
  publishWindowNext:{ fontSize: 12, color: DS.textMed, marginLeft: 24 },
  publishWindowPrime:{ fontSize: 12, color: DS.primary, fontWeight: '700', marginLeft: 24 },

  // Opportunity cards
  oppCard:      { backgroundColor: DS.white, borderRadius: 16, padding: 14,
                  borderWidth: 1, borderColor: DS.border,
                  shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  oppHeader:    { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginBottom: 12 },
  oppScoreCircle:{ width: 52, height: 52, borderRadius: 26, backgroundColor: DS.surface2,
                   justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  oppScoreNum:  { fontSize: 18, fontWeight: '900' },
  oppScoreLbl:  { fontSize: 8, color: DS.textLow, fontWeight: '700' },
  oppTitle:     { fontSize: 13, fontWeight: '800', color: DS.text, marginBottom: 3 },
  oppCat:       { fontSize: 10, color: DS.textMed, marginBottom: 5 },
  oppRow:       { flexDirection: 'row', gap: 5, flexWrap: 'wrap' },
  urgencyBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, borderWidth: 1 },
  urgencyTxt:   { fontSize: 9, fontWeight: '900' },
  oppPriceRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8,
                  backgroundColor: DS.surface2, borderRadius: 10, padding: 10 },
  oppPriceStat: { flex: 1, alignItems: 'center' },
  oppPriceLabel:{ fontSize: 8, color: DS.textLow, fontWeight: '700', letterSpacing: 0.5, marginBottom: 3 },
  oppPriceVal:  { fontSize: 16, fontWeight: '900' },
  oppPublishRow:{ flexDirection: 'row', alignItems: 'center', gap: 6 },
  oppPublishTxt:{ fontSize: 11, color: DS.textMed },

  // Charts
  chartCard:    { backgroundColor: DS.white, borderRadius: 18, padding: 16, marginBottom: 14,
                  borderWidth: 1, borderColor: DS.border,
                  shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  chartHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  chartTitle:   { fontSize: 15, fontWeight: '800', color: DS.text },
  chartSubtitle:{ fontSize: 10, color: DS.textLow, marginBottom: 14 },
  modeToggle:   { flexDirection: 'row', gap: 4 },
  modeBtn:      { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: DS.surface2 },
  modeBtnActive:{ backgroundColor: DS.purple },
  modeBtnTxt:   { fontSize: 11, fontWeight: '700', color: DS.textMed },
  modeBtnTxtActive:{ color: '#FFF' },
  barGroupsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, paddingHorizontal: 4,
                  paddingBottom: 4, minHeight: BAR_MAX_H + 50 },
  barGroup:     { alignItems: 'center', width: 56 },
  barPairRow:   { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: BAR_MAX_H,
                  marginBottom: 4 },
  barWrapper:   { alignItems: 'center', width: 24 },
  bar:          { width: 20, borderRadius: 4, borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  barVal:       { fontSize: 8, fontWeight: '700', marginTop: 2, textAlign: 'center' },
  barLabel:     { fontSize: 8, color: DS.textLow, fontWeight: '600', textAlign: 'center', lineHeight: 11 },
  legend:       { flexDirection: 'row', gap: 12, marginTop: 10, flexWrap: 'wrap' },
  legendItem:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:    { width: 8, height: 8, borderRadius: 4 },
  legendTxt:    { fontSize: 10, color: DS.textMed },

  // Summary table
  summaryTable:      { backgroundColor: DS.white, borderRadius: 14, overflow: 'hidden',
                        borderWidth: 1, borderColor: DS.border, marginTop: 14 },
  summaryTableTitle: { fontSize: 13, fontWeight: '800', color: DS.text, padding: 12, paddingBottom: 6 },
  summaryTableHeader:{ flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8,
                        backgroundColor: DS.surface2 },
  summaryRow:        { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 9,
                        borderTopWidth: 1, borderTopColor: DS.border },
  summaryCell:       { flex: 1, fontSize: 11, color: DS.textMed, textAlign: 'center' },

  // Category intel cards
  catIntelCard: { backgroundColor: DS.white, borderRadius: 16, padding: 14,
                  borderWidth: 1, borderColor: DS.border,
                  shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  catIntelHeader:{ flexDirection: 'row', alignItems: 'center', gap: 12 },
  scoreRing:    { width: 48, height: 48, borderRadius: 24, borderWidth: 2.5,
                  justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  scoreRingNum: { fontSize: 15, fontWeight: '900' },
  catIntelName: { fontSize: 15, fontWeight: '800', color: DS.text },
  hotBadge:     { fontSize: 10, fontWeight: '900', color: DS.primary,
                  backgroundColor: DS.primaryBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  catIntelMetaRow:{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3, flexWrap: 'wrap' },
  catIntelMeta: { fontSize: 11, color: DS.textMed },
  catIntelDot:  { fontSize: 11, color: DS.textLow },
  catIntelExpanded:{ borderTopWidth: 1, borderTopColor: DS.border, marginTop: 12, paddingTop: 12, gap: 10 },
  catCompRow:   { flexDirection: 'row', justifyContent: 'space-around' },
  catCompStat:  { alignItems: 'center' },
  catCompLabel: { fontSize: 8, fontWeight: '900', color: DS.textLow, letterSpacing: 0.5, marginBottom: 3 },
  catCompVal:   { fontSize: 15, fontWeight: '900', color: DS.text },
  strategyBox:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                  borderRadius: 10, padding: 10 },
  strategyLabel:{ fontSize: 9, fontWeight: '900', color: DS.textLow, letterSpacing: 0.5 },
  strategyVal:  { fontSize: 14, fontWeight: '900' },
  catPriceDelta:{ fontSize: 11, color: DS.textMed, fontStyle: 'italic' },
  subCatSection:{ gap: 6 },
  subCatSectionTitle:{ fontSize: 8, fontWeight: '900', color: DS.textLow, letterSpacing: 1 },
  subCatRow:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  subCatName:   { flex: 1, fontSize: 12, color: DS.textMed },
  subCatTTS:    { fontSize: 11, fontWeight: '700', width: 28, textAlign: 'right' },
  subCatCount:  { fontSize: 10, color: DS.textLow, width: 45, textAlign: 'right' },

  // Empty states
  emptyBox:     { alignItems: 'center', padding: 40, gap: 10 },
  emptyIcon:    { fontSize: 40 },
  emptyTitle:   { fontSize: 16, fontWeight: '800', color: DS.textMed, textAlign: 'center' },
  emptySub:     { fontSize: 12, color: DS.textLow, textAlign: 'center', lineHeight: 18, paddingHorizontal: 20 },
});
