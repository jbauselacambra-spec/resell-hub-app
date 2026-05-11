/**
 * BusinessIntelligenceScreen.jsx — Sprint 14
 *
 * REFACTORIZADO para usar theme.js (ResellHub Design System v2)
 * Pantalla de Business Intelligence.
 *
 * Secciones:
 *   1. Aprendizajes personales (tarjetas de insight)
 *   2. Ranking de oportunidades (productos activos priorizados)
 *   3. Comparativa personal vs mercado por categoría (gráfico de barras)
 *   4. Historial mensual con benchmark (gráfico de línea)
 *   5. Análisis de categorías con score de oportunidad
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Dimensions, RefreshControl, FlatList,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { IntelligenceService } from '../services/IntelligenceService';
import { DatabaseService } from '../services/DatabaseService';
import LogService, { LOG_CTX } from '../services/LogService';

// ── Importar Design System ───────────────────────────────────────────────────
import {
  DS, SPACE, RADIUS, SHADOW, TXT, BTN, BTN_TEXT, CARD,
  LAYOUT, FONT_SIZE, FONT_FAMILY,
} from '../theme';

const { width } = Dimensions.get('window');
const BAR_MAX_H = 90;

// ─── Colores de estado de aprendizaje ─────────────────────────────────────────
const LEARNING_COLORS = {
  positive: { bg: DS.successLight, border: DS.success, text: DS.success },
  warning:  { bg: DS.dangerLight,  border: DS.danger,  text: DS.danger  },
  insight:  { bg: DS.blueLight,    border: DS.blue,    text: DS.blue    },
  seasonal: { bg: DS.warningLight, border: DS.warning, text: DS.warning },
  price:    { bg: DS.purpleLight,  border: DS.purple,  text: DS.purple  },
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
          <Text style={[styles.learningDetail, { color: DS.text2 }]}>{item.detail}</Text>
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
  const scoreColor   = opportunityScore >= 70 ? DS.success : opportunityScore >= 45 ? DS.warning : DS.text2;

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
              <View style={[styles.urgencyBadge, { backgroundColor: DS.brandLight, borderColor: DS.brand + '50' }]}>
                <Text style={[styles.urgencyTxt, { color: DS.brand }]}>🔥 MES CALIENTE</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <View style={styles.oppPriceRow}>
        <View style={styles.oppPriceStat}>
          <Text style={styles.oppPriceLabel}>PRECIO ACTUAL</Text>
          <Text style={[styles.oppPriceVal, { fontFamily: FONT_FAMILY.mono }]}>{product.price}€</Text>
        </View>
        <Icon name="arrow-right" size={14} color={DS.text3} />
        <View style={styles.oppPriceStat}>
          <Text style={styles.oppPriceLabel}>SUGERIDO</Text>
          <Text style={[styles.oppPriceVal, { color: priceDiffPct >= 0 ? DS.success : DS.danger, fontFamily: FONT_FAMILY.mono }]}>
            {suggestedPrice}€ {priceDiffPct !== 0 ? `(${priceDiffPct > 0 ? '+' : ''}${priceDiffPct}%)` : ''}
          </Text>
        </View>
      </View>

      <View style={styles.oppPublishRow}>
        <Icon name="clock" size={11} color={DS.text2} />
        <Text style={styles.oppPublishTxt}>{publishLabel}</Text>
      </View>
    </View>
  );
}

// ─── PANTALLA PRINCIPAL ───────────────────────────────────────────────────────
export default function BusinessIntelligenceScreen({ navigation }) {
  // ── HOOKS ──────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('learnings');
  const [refreshing, setRefreshing] = useState(false);
  const [intel, setIntel] = useState(null);
  const [chartMode, setChartMode] = useState('count'); // 'count' | 'price'
  const [expandedCat, setExpandedCat] = useState(null);

  const loadIntelligence = useCallback(async () => {
    try {
      const data = await IntelligenceService.generateFullIntelligence();
      setIntel(data);
      LogService.debug('Intelligence: datos cargados', LOG_CTX.UI);
    } catch (e) {
      LogService.error('Intelligence.loadIntelligence', LOG_CTX.UI, e.message);
    }
  }, []);

  useEffect(() => {
    loadIntelligence();
    const unsub = navigation.addListener('focus', loadIntelligence);
    return unsub;
  }, [navigation, loadIntelligence]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadIntelligence();
    setRefreshing(false);
  };

  const handleLearningAction = (item) => {
    LogService.info(`Intelligence: action on learning: ${item.title}`, LOG_CTX.UI);
    // Navegar o ejecutar acción según item.actionType
  };

  if (!intel) {
    return (
      <View style={styles.root}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Icon name="arrow-left" size={18} color={DS.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerEyebrow}>INTELIGENCIA</Text>
            <Text style={styles.headerTitle}>Cargando...</Text>
          </View>
        </View>
      </View>
    );
  }

  const tabs = [
    { id: 'learnings',    label: 'Aprendizajes',    icon: 'zap'          },
    { id: 'opportunities',label: 'Oportunidades',   icon: 'trending-up'  },
    { id: 'comparison',   label: 'Comparativa',     icon: 'bar-chart-2'  },
    { id: 'trends',       label: 'Tendencias',      icon: 'activity'     },
    { id: 'categories',   label: 'Categorías',      icon: 'grid'         },
  ];

  const renderTabContent = () => {
    if (activeTab === 'learnings') {
      return (
        <View style={styles.contentPad}>
          <Text style={styles.sectionHint}>
            📊 Insights personalizados basados en tu actividad de venta
          </Text>
          {intel.learnings && intel.learnings.length > 0 ? (
            intel.learnings.map((item, i) => (
              <LearningCard key={i} item={item} onAction={handleLearningAction} />
            ))
          ) : (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>💡</Text>
              <Text style={styles.emptyTitle}>Aún no hay insights</Text>
              <Text style={styles.emptySub}>Sigue vendiendo para generar aprendizajes personalizados</Text>
            </View>
          )}

          {intel.publishWindow && (
            <View style={[styles.publishWindowCard, { borderColor: DS.brand, backgroundColor: DS.brandLight }]}>
              <View style={styles.publishWindowHeader}>
                <Icon name="calendar" size={16} color={DS.brand} />
                <Text style={[styles.publishWindowTitle, {color: DS.brand}]}>Ventana óptima de publicación</Text>
              </View>
              <Text style={styles.publishWindowNext}>
                Próxima ventana: <Text style={styles.publishWindowPrime}>{intel.publishWindow.next}</Text>
              </Text>
              <Text style={styles.publishWindowNext}>
                Mejor día: <Text style={styles.publishWindowPrime}>{intel.publishWindow.bestDay}</Text>
              </Text>
            </View>
          )}
        </View>
      );
    }

    if (activeTab === 'opportunities') {
      return (
        <View style={styles.contentPad}>
          <Text style={styles.sectionHint}>
            🎯 Productos activos ordenados por score de oportunidad
          </Text>
          {intel.opportunities && intel.opportunities.length > 0 ? (
            <FlatList
              data={intel.opportunities}
              renderItem={({ item }) => <OpportunityCard item={item} />}
              keyExtractor={(item, i) => String(item.product.id || i)}
              scrollEnabled={false}
              contentContainerStyle={{ gap: SPACE[2] + 2 }}
            />
          ) : (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={styles.emptyTitle}>Sin oportunidades detectadas</Text>
              <Text style={styles.emptySub}>Añade productos a tu inventario para ver recomendaciones</Text>
            </View>
          )}
        </View>
      );
    }

    if (activeTab === 'comparison') {
      return (
        <View style={styles.contentPad}>
          <Text style={styles.sectionHint}>
            📊 Compara tu rendimiento vs mercado por categoría
          </Text>
          {intel.categoryComparison && intel.categoryComparison.length > 0 ? (
            <View style={styles.chartCard}>
              <View style={styles.chartHeader}>
                <Text style={styles.chartTitle}>Personal vs Mercado</Text>
                <View style={styles.modeToggle}>
                  <TouchableOpacity
                    style={[styles.modeBtn, chartMode === 'count' && styles.modeBtnActive]}
                    onPress={() => setChartMode('count')}
                  >
                    <Text style={[styles.modeBtnTxt, chartMode === 'count' && styles.modeBtnTxtActive]}>
                      Vendidos
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modeBtn, chartMode === 'price' && styles.modeBtnActive]}
                    onPress={() => setChartMode('price')}
                  >
                    <Text style={[styles.modeBtnTxt, chartMode === 'price' && styles.modeBtnTxtActive]}>
                      Precio
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={styles.chartSubtitle}>
                {chartMode === 'count' ? 'Cantidad vendida' : 'Precio promedio'} por categoría
              </Text>

              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.barGroupsRow}>
                  {intel.categoryComparison.map((cat, i) => {
                    const myVal = chartMode === 'count' ? cat.mySold : cat.myAvgPrice;
                    const mkVal = chartMode === 'count' ? cat.marketSold : cat.marketAvgPrice;
                    const max = Math.max(myVal, mkVal, 1);
                    const myH = (myVal / max) * BAR_MAX_H;
                    const mkH = (mkVal / max) * BAR_MAX_H;

                    return (
                      <View key={i} style={styles.barGroup}>
                        <View style={styles.barPairRow}>
                          <View style={styles.barWrapper}>
                            <View style={[styles.bar, { height: myH, backgroundColor: DS.brand }]} />
                            <Text style={[styles.barVal, { color: DS.brand }]}>
                              {chartMode === 'count' ? myVal : `${myVal}€`}
                            </Text>
                          </View>
                          <View style={styles.barWrapper}>
                            <View style={[styles.bar, { height: mkH, backgroundColor: DS.blue }]} />
                            <Text style={[styles.barVal, { color: DS.blue }]}>
                              {chartMode === 'count' ? mkVal : `${mkVal}€`}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.barLabel}>{cat.category}</Text>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>

              <View style={styles.legend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: DS.brand }]} />
                  <Text style={styles.legendTxt}>Personal</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: DS.blue }]} />
                  <Text style={styles.legendTxt}>Mercado</Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>📊</Text>
              <Text style={styles.emptyTitle}>Sin datos de comparación</Text>
              <Text style={styles.emptySub}>Necesitas al menos una venta en cada categoría</Text>
            </View>
          )}
        </View>
      );
    }

    if (activeTab === 'trends') {
      return (
        <View style={styles.contentPad}>
          <Text style={styles.sectionHint}>
            📈 Evolución mensual de tus ventas vs benchmark de mercado
          </Text>
          {intel.monthlyTrend && intel.monthlyTrend.length > 0 ? (
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Historial mensual</Text>
              <Text style={styles.chartSubtitle}>Últimos {intel.monthlyTrend.length} meses</Text>

              <View style={styles.summaryTable}>
                <Text style={styles.summaryTableTitle}>Resumen</Text>
                <View style={styles.summaryTableHeader}>
                  <Text style={[styles.summaryCell, {fontWeight:'700', color: DS.text}]}>Mes</Text>
                  <Text style={[styles.summaryCell, {fontWeight:'700', color: DS.text}]}>Vendidos</Text>
                  <Text style={[styles.summaryCell, {fontWeight:'700', color: DS.text}]}>Ingresos</Text>
                  <Text style={[styles.summaryCell, {fontWeight:'700', color: DS.text}]}>TTS</Text>
                </View>
                {intel.monthlyTrend.map((m, i) => (
                  <View key={i} style={styles.summaryRow}>
                    <Text style={[styles.summaryCell, {fontWeight:'700', color: DS.text}]}>{m.month}</Text>
                    <Text style={styles.summaryCell}>{m.sold}</Text>
                    <Text style={[styles.summaryCell, {fontFamily: FONT_FAMILY.mono}]}>{m.revenue}€</Text>
                    <Text style={[styles.summaryCell, {fontFamily: FONT_FAMILY.mono}]}>{m.avgTTS}d</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>📈</Text>
              <Text style={styles.emptyTitle}>Sin historial de tendencias</Text>
              <Text style={styles.emptySub}>Completa más ventas para ver la evolución mensual</Text>
            </View>
          )}
        </View>
      );
    }

    if (activeTab === 'categories') {
      return (
        <View style={styles.contentPad}>
          <Text style={styles.sectionHint}>
            🏷️ Análisis detallado por categoría con score de oportunidad
          </Text>
          {intel.categoryIntel && intel.categoryIntel.length > 0 ? (
            <FlatList
              data={intel.categoryIntel}
              renderItem={({ item: cat }) => {
                const isExpanded = expandedCat === cat.category;
                const scoreColor = cat.opportunityScore >= 70 ? DS.success : cat.opportunityScore >= 45 ? DS.warning : DS.text2;

                return (
                  <TouchableOpacity
                    style={[styles.catIntelCard, { marginBottom: SPACE[2] + 2 }]}
                    onPress={() => setExpandedCat(isExpanded ? null : cat.category)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.catIntelHeader}>
                      <View style={[styles.scoreRing, { borderColor: scoreColor }]}>
                        <Text style={[styles.scoreRingNum, { color: scoreColor }]}>{cat.opportunityScore}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE[2] }}>
                          <Text style={styles.catIntelName}>{cat.category}</Text>
                          {cat.isHotThisMonth && (
                            <Text style={styles.hotBadge}>🔥 HOT</Text>
                          )}
                        </View>
                        <View style={styles.catIntelMetaRow}>
                          <Text style={styles.catIntelMeta}>{cat.activeListing} activos</Text>
                          <Text style={styles.catIntelDot}>•</Text>
                          <Text style={styles.catIntelMeta}>{cat.totalSold} vendidos</Text>
                        </View>
                      </View>
                      <Icon name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={DS.text2} />
                    </View>

                    {isExpanded && (
                      <View style={styles.catIntelExpanded}>
                        <View style={styles.catCompRow}>
                          <View style={styles.catCompStat}>
                            <Text style={styles.catCompLabel}>TTS MEDIO</Text>
                            <Text style={[styles.catCompVal, {fontFamily: FONT_FAMILY.mono}]}>{cat.avgTTS}d</Text>
                          </View>
                          <View style={styles.catCompStat}>
                            <Text style={styles.catCompLabel}>PRECIO MEDIO</Text>
                            <Text style={[styles.catCompVal, {fontFamily: FONT_FAMILY.mono}]}>{cat.avgPrice}€</Text>
                          </View>
                          <View style={styles.catCompStat}>
                            <Text style={styles.catCompLabel}>MARGEN</Text>
                            <Text style={[styles.catCompVal, {color: DS.success, fontFamily: FONT_FAMILY.mono}]}>
                              {cat.avgMargin}%
                            </Text>
                          </View>
                        </View>

                        <View style={[styles.strategyBox, { backgroundColor: DS.blueLight }]}>
                          <Text style={styles.strategyLabel}>ESTRATEGIA RECOMENDADA</Text>
                          <Text style={[styles.strategyVal, { color: DS.blue }]}>{cat.strategy}</Text>
                        </View>

                        {cat.priceDelta && (
                          <Text style={styles.catPriceDelta}>
                            {cat.priceDelta > 0
                              ? `↗ Tus precios son ${cat.priceDelta}% más altos que el mercado`
                              : `↘ Tus precios son ${Math.abs(cat.priceDelta)}% más bajos que el mercado`}
                          </Text>
                        )}

                        {cat.subcategories && cat.subcategories.length > 0 && (
                          <View style={styles.subCatSection}>
                            <Text style={styles.subCatSectionTitle}>SUBCATEGORÍAS</Text>
                            {cat.subcategories.map((sub, i) => (
                              <View key={i} style={styles.subCatRow}>
                                <Text style={styles.subCatName}>{sub.name}</Text>
                                <Text style={[styles.subCatTTS, { color: DS.blue, fontFamily: FONT_FAMILY.mono }]}>
                                  {sub.avgTTS}d
                                </Text>
                                <Text style={styles.subCatCount}>({sub.count})</Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }}
              keyExtractor={(item, i) => item.category || String(i)}
              scrollEnabled={false}
            />
          ) : (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>🏷️</Text>
              <Text style={styles.emptyTitle}>Sin datos de categorías</Text>
              <Text style={styles.emptySub}>Vende productos en diferentes categorías para ver el análisis</Text>
            </View>
          )}
        </View>
      );
    }

    return null;
  };

  return (
    <View style={styles.root}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={18} color={DS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerEyebrow}>INTELIGENCIA</Text>
          <Text style={styles.headerTitle}>Business Intelligence</Text>
        </View>
        <View style={styles.headerBadge}>
          <Icon name="zap" size={12} color={DS.purple} />
          <Text style={styles.headerBadgeTxt}>AI-POWERED</Text>
        </View>
      </View>

      {/* KPI STRIP */}
      <View style={styles.kpiStrip}>
        <View style={styles.kpiItem}>
          <Text style={[styles.kpiVal, {fontFamily: FONT_FAMILY.mono}]}>{intel.kpis?.totalInsights || 0}</Text>
          <Text style={styles.kpiLab}>INSIGHTS</Text>
        </View>
        <View style={styles.kpiDivider} />
        <View style={styles.kpiItem}>
          <Text style={[styles.kpiVal, {fontFamily: FONT_FAMILY.mono}]}>{intel.kpis?.topOpportunities || 0}</Text>
          <Text style={styles.kpiLab}>OPORTUNIDADES</Text>
        </View>
        <View style={styles.kpiDivider} />
        <View style={styles.kpiItem}>
          <Text style={[styles.kpiVal, {color: DS.success, fontFamily: FONT_FAMILY.mono}]}>
            {intel.kpis?.avgScore || 0}
          </Text>
          <Text style={styles.kpiLab}>SCORE MEDIO</Text>
        </View>
      </View>

      {/* TABS */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
        <View style={styles.tabBar}>
          {tabs.map(tab => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, activeTab === tab.id && styles.tabActive]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Text style={[styles.tabTxt, activeTab === tab.id && styles.tabTxtActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* CONTENT */}
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={DS.brand} />}
      >
        {renderTabContent()}
      </ScrollView>
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: DS.surface2 },

  header:       { flexDirection: 'row', alignItems: 'center', gap: SPACE[2] + 2,
                  paddingTop: LAYOUT.headerPadT, paddingHorizontal: LAYOUT.screenPadH, paddingBottom: SPACE[3] + 2,
                  backgroundColor: DS.white, borderBottomWidth: 1, borderBottomColor: DS.border },
  backBtn:      { width: 36, height: 36, borderRadius: RADIUS.lg, backgroundColor: DS.surface3,
                  justifyContent: 'center', alignItems: 'center' },
  headerEyebrow:{ ...TXT.label, color: DS.purple, fontSize: 9 },
  headerTitle:  { ...TXT.heading, fontSize: 20 },
  headerBadge:  { flexDirection: 'row', alignItems: 'center', gap: SPACE[1], backgroundColor: DS.purpleLight,
                  paddingHorizontal: SPACE[2] + 2, paddingVertical: SPACE[1] + 1, borderRadius: RADIUS.md },
  headerBadgeTxt:{ fontSize: 11, fontWeight: '900', color: DS.purple },

  kpiStrip:     { flexDirection: 'row', backgroundColor: DS.white, borderBottomWidth: 1,
                  borderBottomColor: DS.border, paddingVertical: SPACE[2] + 2 },
  kpiItem:      { flex: 1, alignItems: 'center' },
  kpiVal:       { fontSize: 18, fontWeight: '900', color: DS.text },
  kpiLab:       { ...TXT.label, fontSize: 8, marginTop: 2, textAlign: 'center' },
  kpiDivider:   { width: 1, backgroundColor: DS.border, marginVertical: SPACE[1] },

  tabScroll:    { maxHeight: 50, backgroundColor: DS.white, borderBottomWidth: 1, borderBottomColor: DS.border },
  tabBar:       { paddingHorizontal: SPACE[3], gap: SPACE[1], alignItems: 'center', paddingVertical: SPACE[2] },
  tab:          { paddingHorizontal: SPACE[3], paddingVertical: SPACE[1] + 2, borderRadius: RADIUS.full },
  tabActive:    { backgroundColor: DS.purple + '18' },
  tabTxt:       { fontSize: 11, fontWeight: '600', color: DS.text2 },
  tabTxtActive: { color: DS.purple, fontWeight: '800' },

  content:      { flex: 1 },
  contentPad:   { padding: LAYOUT.screenPadH, paddingBottom: 40 },

  sectionHint:  { fontSize: 11, color: DS.text3, marginBottom: SPACE[3], lineHeight: 16 },

  // Learning cards
  learningCard: { borderLeftWidth: 4, borderRadius: RADIUS.lg, padding: SPACE[3] + 2, marginBottom: SPACE[2] + 2 },
  learningHeader:{ flexDirection: 'row', alignItems: 'flex-start', gap: SPACE[2] },
  learningIcon: { fontSize: 18, lineHeight: 22 },
  learningTitle:{ flex: 1, fontSize: 13, fontWeight: '800', lineHeight: 18 },
  learningDetail:{ fontSize: 12, lineHeight: 17, marginTop: SPACE[2], marginLeft: 26 },
  learningActionBtn:{ flexDirection: 'row', alignItems: 'center', gap: SPACE[1] + 2, alignSelf: 'flex-start',
                      paddingHorizontal: SPACE[3], paddingVertical: SPACE[1] + 2, borderRadius: RADIUS.md, marginTop: SPACE[2] + 2, marginLeft: 26 },
  learningActionTxt:{ fontSize: 11, fontWeight: '800', color: '#FFF' },

  // Publish window
  publishWindowCard:{ borderWidth: 1.5, borderRadius: RADIUS.lg, padding: SPACE[3] + 2, marginTop: SPACE[2] },
  publishWindowHeader:{ flexDirection: 'row', alignItems: 'center', gap: SPACE[2], marginBottom: SPACE[1] + 2 },
  publishWindowTitle:{ fontSize: 14, fontWeight: '700' },
  publishWindowNext:{ fontSize: 12, color: DS.text2, marginLeft: 24 },
  publishWindowPrime:{ fontSize: 12, color: DS.brand, fontWeight: '700', marginLeft: 24 },

  // Opportunity cards
  oppCard:      { ...CARD.default, marginBottom: SPACE[2] + 2, ...SHADOW.md },
  oppHeader:    { flexDirection: 'row', gap: SPACE[3], alignItems: 'flex-start', marginBottom: SPACE[3] },
  oppScoreCircle:{ width: 52, height: 52, borderRadius: 26, backgroundColor: DS.surface2,
                   justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  oppScoreNum:  { fontSize: 18, fontWeight: '900' },
  oppScoreLbl:  { fontSize: 8, color: DS.text3, fontWeight: '700' },
  oppTitle:     { fontSize: 13, fontWeight: '800', color: DS.text, marginBottom: 3 },
  oppCat:       { fontSize: 10, color: DS.text2, marginBottom: SPACE[1] + 1 },
  oppRow:       { flexDirection: 'row', gap: SPACE[1] + 1, flexWrap: 'wrap' },
  urgencyBadge: { paddingHorizontal: SPACE[2] - 1, paddingVertical: 2, borderRadius: RADIUS.sm, borderWidth: 1 },
  urgencyTxt:   { fontSize: 9, fontWeight: '900' },
  oppPriceRow:  { flexDirection: 'row', alignItems: 'center', gap: SPACE[2] + 2, marginBottom: SPACE[2],
                  backgroundColor: DS.surface2, borderRadius: RADIUS.md, padding: SPACE[2] + 2 },
  oppPriceStat: { flex: 1, alignItems: 'center' },
  oppPriceLabel:{ ...TXT.label, fontSize: 8, marginBottom: 3 },
  oppPriceVal:  { fontSize: 16, fontWeight: '900' },
  oppPublishRow:{ flexDirection: 'row', alignItems: 'center', gap: SPACE[1] + 2 },
  oppPublishTxt:{ fontSize: 11, color: DS.text2 },

  // Charts
  chartCard:    { ...CARD.default, marginBottom: SPACE[3] + 2, ...SHADOW.md },
  chartHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACE[1] },
  chartTitle:   { ...TXT.heading, fontSize: 15 },
  chartSubtitle:{ fontSize: 10, color: DS.text3, marginBottom: SPACE[3] + 2 },
  modeToggle:   { flexDirection: 'row', gap: SPACE[1] },
  modeBtn:      { paddingHorizontal: SPACE[2] + 2, paddingVertical: SPACE[1], borderRadius: RADIUS.md, backgroundColor: DS.surface2 },
  modeBtnActive:{ backgroundColor: DS.purple },
  modeBtnTxt:   { fontSize: 11, fontWeight: '700', color: DS.text2 },
  modeBtnTxtActive:{ color: '#FFF' },
  barGroupsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACE[1] + 2, paddingHorizontal: SPACE[1],
                  paddingBottom: SPACE[1], minHeight: BAR_MAX_H + 50 },
  barGroup:     { alignItems: 'center', width: 56 },
  barPairRow:   { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: BAR_MAX_H, marginBottom: SPACE[1] },
  barWrapper:   { alignItems: 'center', width: 24 },
  bar:          { width: 20, borderRadius: RADIUS.sm - 2, borderTopLeftRadius: RADIUS.sm + 2, borderTopRightRadius: RADIUS.sm + 2 },
  barVal:       { fontSize: 8, fontWeight: '700', marginTop: 2, textAlign: 'center' },
  barLabel:     { fontSize: 8, color: DS.text3, fontWeight: '600', textAlign: 'center', lineHeight: 11 },
  legend:       { flexDirection: 'row', gap: SPACE[3], marginTop: SPACE[2] + 2, flexWrap: 'wrap' },
  legendItem:   { flexDirection: 'row', alignItems: 'center', gap: SPACE[1] + 1 },
  legendDot:    { width: 8, height: 8, borderRadius: 4 },
  legendTxt:    { fontSize: 10, color: DS.text2 },

  // Summary table
  summaryTable:      { backgroundColor: DS.white, borderRadius: RADIUS.lg, overflow: 'hidden',
                        borderWidth: 1, borderColor: DS.border, marginTop: SPACE[3] + 2 },
  summaryTableTitle: { fontSize: 13, fontWeight: '800', color: DS.text, padding: SPACE[3], paddingBottom: SPACE[1] + 2 },
  summaryTableHeader:{ flexDirection: 'row', paddingHorizontal: SPACE[3], paddingVertical: SPACE[2],
                        backgroundColor: DS.surface2 },
  summaryRow:        { flexDirection: 'row', paddingHorizontal: SPACE[3], paddingVertical: SPACE[2] + 1,
                        borderTopWidth: 1, borderTopColor: DS.border },
  summaryCell:       { flex: 1, fontSize: 11, color: DS.text2, textAlign: 'center' },

  // Category intel cards
  catIntelCard: { ...CARD.default, ...SHADOW.md },
  catIntelHeader:{ flexDirection: 'row', alignItems: 'center', gap: SPACE[3] },
  scoreRing:    { width: 48, height: 48, borderRadius: 24, borderWidth: 2.5,
                  justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  scoreRingNum: { fontSize: 15, fontWeight: '900' },
  catIntelName: { ...TXT.heading, fontSize: 15 },
  hotBadge:     { fontSize: 10, fontWeight: '900', color: DS.brand,
                  backgroundColor: DS.brandLight, paddingHorizontal: SPACE[1] + 2, paddingVertical: 2, borderRadius: RADIUS.sm },
  catIntelMetaRow:{ flexDirection: 'row', alignItems: 'center', gap: SPACE[1], marginTop: 3, flexWrap: 'wrap' },
  catIntelMeta: { fontSize: 11, color: DS.text2 },
  catIntelDot:  { fontSize: 11, color: DS.text3 },
  catIntelExpanded:{ borderTopWidth: 1, borderTopColor: DS.border, marginTop: SPACE[3], paddingTop: SPACE[3], gap: SPACE[2] + 2 },
  catCompRow:   { flexDirection: 'row', justifyContent: 'space-around' },
  catCompStat:  { alignItems: 'center' },
  catCompLabel: { ...TXT.label, fontSize: 8, marginBottom: 3 },
  catCompVal:   { fontSize: 15, fontWeight: '900', color: DS.text },
  strategyBox:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                  borderRadius: RADIUS.md, padding: SPACE[2] + 2 },
  strategyLabel:{ ...TXT.label, fontSize: 9 },
  strategyVal:  { fontSize: 14, fontWeight: '900' },
  catPriceDelta:{ fontSize: 11, color: DS.text2, fontStyle: 'italic' },
  subCatSection:{ gap: SPACE[1] + 2 },
  subCatSectionTitle:{ ...TXT.label, fontSize: 8 },
  subCatRow:    { flexDirection: 'row', alignItems: 'center', gap: SPACE[1] + 2 },
  subCatName:   { flex: 1, fontSize: 12, color: DS.text2 },
  subCatTTS:    { fontSize: 11, fontWeight: '700', width: 28, textAlign: 'right' },
  subCatCount:  { fontSize: 10, color: DS.text3, width: 45, textAlign: 'right' },

  // Empty states
  emptyBox:     { alignItems: 'center', padding: 40, gap: SPACE[2] + 2 },
  emptyIcon:    { fontSize: 40 },
  emptyTitle:   { ...TXT.heading, color: DS.text2, textAlign: 'center' },
  emptySub:     { ...TXT.caption, color: DS.text3, textAlign: 'center', lineHeight: 18, paddingHorizontal: 20 },
});