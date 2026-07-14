/**
 * DashboardScreen.jsx — Design System v2
 *
 * [UI_SPECIALIST] Rediseño completo con DS v2:
 * - Tipografía DM Sans / DM Mono
 * - Tokens de color, radios y espaciado del theme
 * - KPI strip: card accent brand + cards neutras
 * - Alertas de resubida: barra de staleness compacta
 * - Chart de barras TTS simplificado y legible
 * - Inventario reciente con tabs limpios
 *
 * [FIX post-auditoría]
 * - Banner estacional: parsea 'Categoría › Subcategoría' → muestra solo el label
 *   corto, igual que ProductsScreen. Antes mostraba el string crudo completo.
 * - fadeAnim: lazy initializer (useState(() => new Animated.Value(0))) para no
 *   instanciar un Animated.Value nuevo y descartado en cada render.
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, RefreshControl, Animated, Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { DatabaseService } from '../services/DatabaseService';
import {
  DS, RADIUS, SPACE, FONT_SIZE, FONT_FAMILY,
  TRACKING, LAYOUT, MONTH_NAMES, fmtPrice,
} from '../theme';

// ─── Constantes ───────────────────────────────────────────────────────────────
const BAR_MAX_H = 72;

// ─── Helper: label corto para items de seasonalMap ────────────────────────────
// seasonalMap puede contener 'Categoría' o 'Categoría › Subcategoría' (Sprint 11).
// Para mostrar en banners cortos, siempre usamos solo la parte más específica.
function seasonalLabel(item) {
  if (!item || typeof item !== 'string') return item;
  return item.includes(' › ') ? item.split(' › ')[1] : item;
}

// ─── Componentes auxiliares ───────────────────────────────────────────────────

/** Badge de velocidad TTS */
function SpeedBadge({ avgTTS, config }) {
  const lightning = parseInt(config?.ttsLightning || 7);
  const anchor    = parseInt(config?.ttsAnchor    || 30);
  if (avgTTS <= lightning) return (
    <View style={[s.badge, { backgroundColor: DS.successDim }]}>
      <Text style={[s.badgeTxt, { color: DS.success }]}>⚡ {avgTTS}d</Text>
    </View>
  );
  if (avgTTS <= anchor) return (
    <View style={[s.badge, { backgroundColor: DS.warningDim }]}>
      <Text style={[s.badgeTxt, { color: DS.warning }]}>🟡 {avgTTS}d</Text>
    </View>
  );
  return (
    <View style={[s.badge, { backgroundColor: DS.dangerDim }]}>
      <Text style={[s.badgeTxt, { color: DS.danger }]}>⚓ {avgTTS}d</Text>
    </View>
  );
}

/** Tarjeta KPI */
function KpiCard({ label, value, sub, accent, color }) {
  return (
    <View style={[s.kpiCard, accent && s.kpiCardAccent]}>
      <Text style={[s.kpiLabel, accent && s.kpiLabelAccent]}>{label}</Text>
      <Text style={[s.kpiValue, accent && s.kpiValueAccent, color && { color }]}>
        {value}
      </Text>
      {sub ? (
        <Text style={[s.kpiSub, accent && s.kpiSubAccent]}>{sub}</Text>
      ) : null}
    </View>
  );
}

/** Alerta de resubida */
function AlertCard({ product, daysThreshold = 60, onRepost }) {
  const days = Math.floor(
    (Date.now() - new Date(product.firstUploadDate || product.createdAt)) / 86_400_000
  );
  const pct      = Math.min(100, Math.round((days / 90) * 100));
  const isCrit   = days > 75;
  const barColor = isCrit ? DS.danger : DS.warning;

  return (
    <TouchableOpacity style={s.alertCard} activeOpacity={0.75}>
      <View style={[s.alertDot, { backgroundColor: barColor + '25' }]}>
        <Icon name={isCrit ? 'alert-circle' : 'clock'} size={16} color={barColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.alertTitle} numberOfLines={1}>{product.title}</Text>
        <Text style={s.alertMeta}>{product.brand || 'Sin marca'} · {product.category || 'Sin categoría'}</Text>
        <View style={s.alertBottom}>
          <View style={s.stalenessTrack}>
            <View style={[s.stalenessFill, { width: `${pct}%`, backgroundColor: barColor }]} />
          </View>
          <View style={[s.daysBadge, { backgroundColor: barColor + '18' }]}>
            <Text style={[s.daysBadgeText, { color: barColor }]}>{days}d</Text>
          </View>
        </View>
      </View>
      <TouchableOpacity style={s.repostBtn} onPress={() => onRepost?.(product)} activeOpacity={0.8}>
        <Icon name="refresh-cw" size={13} color="#fff" />
        <Text style={s.repostBtnText}>Resubir</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

/** Tarjeta de producto compacta */
function ProductRow({ product, onPress }) {
  const statusConfig = {
    sold:          { label: 'Vendido',   bg: DS.blueDim,    color: DS.blue    },
    needs_repost:  { label: 'Resubir',   bg: DS.warningDim, color: DS.warning },
    available:     { label: 'Activo',    bg: DS.successDim, color: DS.success },
  };
  const st = statusConfig[product.status] || statusConfig.available;

  return (
    <TouchableOpacity style={s.productRow} onPress={onPress} activeOpacity={0.7}>
      <View style={s.productImgBox}>
        {product.images?.[0] ? (
          <View style={{ width: '100%', height: '100%' }} />
        ) : (
          <Icon name="package" size={22} color={DS.text3} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.productBrand}>{product.brand || 'Sin marca'}</Text>
        <Text style={s.productTitle} numberOfLines={1}>{product.title}</Text>
        <View style={s.productMeta}>
          <Text style={s.productPrice}>{fmtPrice(product.price)}</Text>
          <View style={[s.productBadge, { backgroundColor: st.bg }]}>
            <Text style={[s.productBadgeText, { color: st.color }]}>{st.label}</Text>
          </View>
        </View>
      </View>
      <View style={s.productViews}>
        <Icon name="eye" size={12} color={DS.text3} />
        <Text style={s.productViewsText}>{product.views || 0}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────────────────
export default function DashboardScreen({ navigation }) {

  const [kpis,       setKpis]       = useState(null);
  const [insights,   setInsights]   = useState([]);
  const [alerts,     setAlerts]     = useState([]);
  const [config,     setConfig]     = useState(() => DatabaseService.getConfig());
  const [catStats,   setCatStats]   = useState([]);
  const [products,   setProducts]   = useState([]);
  const [activeTab,  setActiveTab]  = useState('activos');
  const [refreshing, setRefreshing] = useState(false);
  // [FIX] lazy initializer — evita instanciar un Animated.Value nuevo (y
  // descartado) en cada render. Igual que el patrón usado para `config`.
  const fadeAnim = useState(() => new Animated.Value(0))[0];

  const loadData = () => {
    setConfig(DatabaseService.getConfig());
    setKpis(DatabaseService.getBusinessKPIs());
    setInsights(DatabaseService.getSmartInsights());
    setAlerts(DatabaseService.getSmartAlerts().slice(0, 3));
    setCatStats(DatabaseService.getCategoryStats().slice(0, 5));
    setProducts(DatabaseService.getActiveProductsWithDiagnostic());
    Animated.timing(fadeAnim, {
      toValue: 1, duration: 350, useNativeDriver: true,
    }).start();
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();
    const unsub = navigation.addListener('focus', loadData);
    return unsub;
  }, [navigation]);

  if (!kpis) return null;

  const currentMonth = new Date().getMonth();
  const seasonalCats = Array.isArray(config.seasonalMap?.[currentMonth])
    ? config.seasonalMap[currentMonth]
    : [];

  // Filtro de inventario
  const filteredProducts = (() => {
    switch (activeTab) {
      case 'activos':    return products.filter(p => p.status !== 'sold');
      case 'estancados': return products.filter(p => p.isCold || p.isCritical);
      case 'vendidos':   return DatabaseService.getAllProducts().filter(p => p.status === 'sold').slice(0, 5);
      default:           return products;
    }
  })();

  // Datos del chart TTS
  const chartData = catStats.filter(c => c.avgTTS < 999);
  const maxTTS    = Math.max(...chartData.map(c => c.avgTTS), 1);

  return (
    <Animated.ScrollView
      style={[s.container, { opacity: fadeAnim }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={DS.brand}
          colors={[DS.brand]}
        />
      }
    >

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <View style={s.header}>
        <View>
          <Text style={s.headerDate}>
            {new Date().toLocaleDateString('es-ES', {
              weekday: 'long', day: 'numeric', month: 'long',
            }).toUpperCase()}
          </Text>
          <Text style={s.headerTitle}>Mi stock activo</Text>
        </View>
        <TouchableOpacity
          style={s.headerBtn}
          onPress={() => navigation.navigate('Settings')}
          activeOpacity={0.7}
        >
          <Icon name="settings" size={19} color={DS.text2} />
        </TouchableOpacity>
      </View>

      <View style={s.content}>

        {/* ── BANNER ESTACIONAL ──────────────────────────────────────────── */}
        {seasonalCats.length > 0 && (
          <TouchableOpacity
            style={s.seasonalBanner}
            onPress={() => navigation.navigate('Stock')}
            activeOpacity={0.75}
          >
            <View style={s.seasonalDot} />
            <Text style={s.seasonalText}>
              {MONTH_NAMES[currentMonth]}: temporada de{' '}
              <Text style={{ fontWeight: '600', color: DS.warning }}>
                {/* [FIX] parsear 'Cat › Sub' → mostrar solo el label específico,
                    igual que ProductsScreen. Antes mostraba el string crudo. */}
                {seasonalCats.slice(0, 2).map(seasonalLabel).join(' y ')}
              </Text>
            </Text>
            <Icon name="chevron-right" size={15} color={DS.warning} />
          </TouchableOpacity>
        )}

        {/* ── KPI STRIP ──────────────────────────────────────────────────── */}
        <View style={s.kpiStrip}>
          <KpiCard
            label="RECAUDADO"
            value={`${(kpis.totalRecaudacion ?? 0).toFixed(0)}€`}
            sub={`${kpis.soldCount} ventas`}
            accent
          />
          <View style={s.kpiRight}>
            <KpiCard
              label="EN STOCK"
              value={kpis.activeCount}
              sub="artículos"
            />
            <KpiCard
              label="ALERTAS"
              value={kpis.staleCount}
              sub="+60 días"
              color={kpis.staleCount > 0 ? DS.danger : DS.success}
            />
          </View>
        </View>

        {/* ── TTS METRIC ─────────────────────────────────────────────────── */}
        <View style={s.ttsCard}>
          <View style={s.ttsStat}>
            <Text style={s.ttsLabel}>TIME-TO-SELL MEDIO</Text>
            <Text style={s.ttsValue}>
              {kpis.avgTTS > 0 ? `${kpis.avgTTS}d` : '—'}
            </Text>
          </View>
          <View style={s.ttsDivider} />
          <View style={s.ttsRight}>
            {kpis.bestCat && (
              <View style={s.ttsRow}>
                <Icon name="zap" size={12} color={DS.success} />
                <Text style={s.ttsRowLabel}>
                  <Text style={{ color: DS.success, fontWeight: '600' }}>Rápido · </Text>
                  {kpis.bestCat.name} {kpis.bestCat.avgTTS}d
                </Text>
              </View>
            )}
            {kpis.worstCat && kpis.worstCat.name !== kpis.bestCat?.name && (
              <View style={[s.ttsRow, { marginTop: 5 }]}>
                <Icon name="anchor" size={12} color={DS.danger} />
                <Text style={s.ttsRowLabel}>
                  <Text style={{ color: DS.danger, fontWeight: '600' }}>Ancla · </Text>
                  {kpis.worstCat.name} {kpis.worstCat.avgTTS}d
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={s.ttsBtn}
              onPress={() => navigation.navigate('Stats')}
              activeOpacity={0.7}
            >
              <Text style={s.ttsBtnText}>Ver análisis</Text>
              <Icon name="arrow-right" size={12} color={DS.brand} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── ALERTAS DE RESUBIDA ─────────────────────────────────────────── */}
        {(() => {
          const stale = products.filter(p => {
            const days = Math.floor(
              (Date.now() - new Date(p.firstUploadDate || p.createdAt)) / 86_400_000
            );
            return days >= (parseInt(config.daysInvisible) || 60);
          }).slice(0, 3);

          if (stale.length === 0) return null;

          return (
            <>
              <View style={s.sectionHeader}>
                <View style={s.sectionTitleRow}>
                  <View style={[s.sectionDot, { backgroundColor: DS.danger }]} />
                  <Text style={s.sectionTitle}>Resubir ahora</Text>
                </View>
                <TouchableOpacity onPress={() => navigation.navigate('Stock')}>
                  <Text style={s.sectionLink}>Ver todos</Text>
                </TouchableOpacity>
              </View>
              {stale.map(p => (
                <AlertCard
                  key={p.id}
                  product={p}
                  onRepost={(prod) => {
                    DatabaseService.markAsRepublicated(prod.id);
                    loadData();
                  }}
                />
              ))}
            </>
          );
        })()}

        {/* ── CHART TTS ──────────────────────────────────────────────────── */}
        {chartData.length > 0 && (
          <>
            <View style={s.sectionHeader}>
              <View style={s.sectionTitleRow}>
                <View style={[s.sectionDot, { backgroundColor: DS.blue }]} />
                <Text style={s.sectionTitle}>Velocidad por categoría</Text>
              </View>
            </View>
            <View style={s.chartCard}>
              <Text style={s.chartTitle}>
                Time-to-Sell
                <Text style={s.chartSub}> · días promedio</Text>
              </Text>
              <View style={s.chartBars}>
                {chartData.slice(0, 6).map((cat) => {
                  const pct = Math.round((cat.avgTTS / maxTTS) * BAR_MAX_H);
                  const barH = Math.max(pct, 6);
                  const barColor =
                    cat.avgTTS <= parseInt(config.ttsLightning || 7)  ? DS.success :
                    cat.avgTTS <= parseInt(config.ttsAnchor    || 30) ? DS.warning : DS.danger;
                  return (
                    <View key={cat.name} style={s.barCol}>
                      <Text style={[s.barVal, { color: barColor }]}>
                        {cat.avgTTS}d
                      </Text>
                      <View style={[s.bar, { height: barH, backgroundColor: barColor }]} />
                      <Text style={s.barLabel} numberOfLines={1}>
                        {cat.name.length > 7 ? cat.name.slice(0, 6) + '…' : cat.name}
                      </Text>
                    </View>
                  );
                })}
              </View>
              <View style={s.chartLegend}>
                {[
                  { color: DS.success, label: `Rápido <${config.ttsLightning || 7}d` },
                  { color: DS.warning, label: `Normal`                                },
                  { color: DS.danger,  label: `Ancla >${config.ttsAnchor || 30}d`    },
                ].map(l => (
                  <View key={l.label} style={s.legendItem}>
                    <View style={[s.legendDot, { backgroundColor: l.color }]} />
                    <Text style={s.legendText}>{l.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        )}

        {/* ── SMART INSIGHTS ─────────────────────────────────────────────── */}
        {insights.length > 0 && (
          <>
            <View style={s.sectionHeader}>
              <View style={s.sectionTitleRow}>
                <View style={[s.sectionDot, { backgroundColor: DS.purple }]} />
                <Text style={s.sectionTitle}>Insights</Text>
              </View>
            </View>
            {insights.slice(0, 2).map((ins, i) => (
              <View key={i} style={[s.insightCard, { borderLeftColor: ins.color || DS.brand }]}>
                <Text style={s.insightIcon}>{ins.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.insightTitle}>{ins.title}</Text>
                  <Text style={s.insightMsg}>{ins.message}</Text>
                </View>
              </View>
            ))}
          </>
        )}

        {/* ── INVENTARIO RECIENTE ─────────────────────────────────────────── */}
        <View style={s.sectionHeader}>
          <View style={s.sectionTitleRow}>
            <View style={[s.sectionDot, { backgroundColor: DS.blue }]} />
            <Text style={s.sectionTitle}>Inventario</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Stock')}>
            <Text style={s.sectionLink}>Ver todo</Text>
          </TouchableOpacity>
        </View>

        {/* Tabs inventario */}
        <View style={s.tabBar}>
          {[
            { id: 'activos',    label: 'Activos'    },
            { id: 'estancados', label: 'Estancados' },
            { id: 'vendidos',   label: 'Vendidos'   },
          ].map(tab => (
            <TouchableOpacity
              key={tab.id}
              style={[s.tabBtn, activeTab === tab.id && s.tabBtnActive]}
              onPress={() => setActiveTab(tab.id)}
              activeOpacity={0.7}
            >
              <Text style={[s.tabLabel, activeTab === tab.id && s.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {filteredProducts.length === 0 ? (
          <View style={s.emptyState}>
            <Icon name="inbox" size={32} color={DS.text3} />
            <Text style={s.emptyText}>Sin productos en esta vista</Text>
          </View>
        ) : (
          filteredProducts.slice(0, 5).map(p => (
            <ProductRow
              key={p.id}
              product={p}
              onPress={() => navigation.navigate('ProductDetail', { product: p })}
            />
          ))
        )}

        {/* ── ACCIONES RÁPIDAS ────────────────────────────────────────────── */}
        <View style={s.quickRow}>
          {[
            { icon: 'package',    label: 'Inventario', sub: `${kpis.activeCount} activos`, screen: 'Stock'   },
            { icon: 'check',      label: 'Vendidos',   sub: `${kpis.soldCount} totales`,   screen: 'History' },
            { icon: 'bar-chart-2',label: 'Analytics',  sub: 'TTS & Rotación',              screen: 'Stats'   },
          ].map(q => (
            <TouchableOpacity
              key={q.screen}
              style={s.quickCard}
              onPress={() => navigation.navigate(q.screen)}
              activeOpacity={0.7}
            >
              <View style={s.quickIconBox}>
                <Icon name={q.icon} size={18} color={DS.text2} />
              </View>
              <Text style={s.quickLabel}>{q.label}</Text>
              <Text style={s.quickSub}>{q.sub}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: LAYOUT.tabBarH + SPACE[4] }} />
      </View>
    </Animated.ScrollView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: DS.surface2 },

  // Header
  header: {
    flexDirection:    'row',
    justifyContent:   'space-between',
    alignItems:       'flex-start',
    paddingHorizontal: LAYOUT.screenPadH,
    paddingTop:        LAYOUT.headerPadT,
    paddingBottom:     SPACE[4],
    backgroundColor:   DS.surface,
    borderBottomWidth: 1,
    borderBottomColor: DS.border,
  },
  headerDate: {
    fontSize:      9,
    fontWeight:    '600',
    color:         DS.brand,
    letterSpacing: TRACKING.widest,
    marginBottom:  3,
  },
  headerTitle: {
    fontSize:      26,
    fontWeight:    '700',
    color:         DS.text,
    letterSpacing: -0.4,
  },
  headerBtn: {
    width:           42,
    height:          42,
    borderRadius:    RADIUS.md,
    backgroundColor: DS.surface3,
    alignItems:      'center',
    justifyContent:  'center',
  },

  content: { paddingHorizontal: LAYOUT.screenPadH, paddingTop: SPACE[5] },

  // Seasonal banner
  seasonalBanner: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              SPACE[2],
    backgroundColor:  DS.warningLight,
    borderWidth:      1,
    borderColor:      DS.warningDim,
    borderRadius:     RADIUS.md,
    paddingHorizontal: SPACE[4],
    paddingVertical:  SPACE[3],
    marginBottom:     SPACE[4],
  },
  seasonalDot: {
    width:           7,
    height:          7,
    borderRadius:    4,
    backgroundColor: DS.warning,
  },
  seasonalText: {
    flex:      1,
    fontSize:  FONT_SIZE.sm,
    color:     DS.text2,
    lineHeight: FONT_SIZE.sm * 1.4,
  },

  // KPI strip
  kpiStrip: {
    flexDirection:  'row',
    gap:             SPACE[2],
    marginBottom:    SPACE[3],
  },
  kpiCard: {
    backgroundColor: DS.surface,
    borderRadius:    RADIUS.lg,
    borderWidth:     1,
    borderColor:     DS.border,
    padding:         SPACE[4],
    flex:            1,
    justifyContent:  'space-between',
  },
  kpiCardAccent: {
    backgroundColor: DS.brand,
    borderColor:     DS.brand,
    flex:            1.4,
  },
  kpiLabel: {
    fontSize:      9,
    fontWeight:    '700',
    color:         DS.text3,
    letterSpacing: TRACKING.wider,
    textTransform: 'uppercase',
    marginBottom:  SPACE[1],
  },
  kpiLabelAccent: { color: 'rgba(255,255,255,0.65)' },
  kpiValue: {
    fontSize:      22,
    fontWeight:    '700',
    color:         DS.text,
    letterSpacing: -0.5,
    fontFamily:    FONT_FAMILY.mono,
  },
  kpiValueAccent: { color: '#FFFFFF' },
  kpiSub: { fontSize: 10, color: DS.text3, marginTop: SPACE[1] },
  kpiSubAccent: { color: 'rgba(255,255,255,0.55)' },
  kpiRight: { flex: 1, gap: SPACE[2] },

  // TTS card
  ttsCard: {
    flexDirection:   'row',
    backgroundColor: DS.surface,
    borderRadius:    RADIUS.lg,
    borderWidth:     1,
    borderColor:     DS.border,
    padding:         SPACE[4],
    marginBottom:    SPACE[5],
    gap:             SPACE[4],
    alignItems:      'center',
  },
  ttsStat:  { alignItems: 'center' },
  ttsLabel: {
    fontSize:      8,
    fontWeight:    '700',
    color:         DS.text3,
    letterSpacing: TRACKING.wider,
    textTransform: 'uppercase',
    marginBottom:  SPACE[1],
  },
  ttsValue: {
    fontSize:   30,
    fontWeight: '700',
    color:      DS.brand,
    fontFamily: FONT_FAMILY.mono,
    letterSpacing: -1,
  },
  ttsDivider: { width: 1, height: 40, backgroundColor: DS.border },
  ttsRight:   { flex: 1 },
  ttsRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SPACE[2],
  },
  ttsRowLabel: { fontSize: 12, color: DS.text2, flex: 1 },
  ttsBtn: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              SPACE[1],
    marginTop:        SPACE[3],
    backgroundColor:  DS.brandDim,
    alignSelf:        'flex-start',
    paddingHorizontal: SPACE[3],
    paddingVertical:   SPACE[1],
    borderRadius:     RADIUS.full,
  },
  ttsBtnText: { fontSize: 11, fontWeight: '600', color: DS.brand },

  // Secciones
  sectionHeader: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   SPACE[3],
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE[2] },
  sectionDot: { width: 7, height: 7, borderRadius: 4 },
  sectionTitle: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: DS.text, letterSpacing: 0.1 },
  sectionLink:  { fontSize: FONT_SIZE.sm, fontWeight: '600', color: DS.brand },

  // Alert card
  alertCard: {
    backgroundColor: DS.surface,
    borderRadius:    RADIUS.lg,
    borderWidth:     1,
    borderColor:     DS.border,
    padding:         SPACE[3],
    flexDirection:   'row',
    alignItems:      'center',
    gap:             SPACE[3],
    marginBottom:    SPACE[2],
  },
  alertDot: {
    width:           38,
    height:          38,
    borderRadius:    RADIUS.md,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  alertTitle: { fontSize: FONT_SIZE.sm + 1, fontWeight: '600', color: DS.text, marginBottom: 2 },
  alertMeta:  { fontSize: FONT_SIZE.xs, color: DS.text3, marginBottom: SPACE[2] },
  alertBottom: { flexDirection: 'row', alignItems: 'center', gap: SPACE[2] },
  stalenessTrack: {
    flex:            1,
    height:          3,
    backgroundColor: DS.surface3,
    borderRadius:    2,
    overflow:        'hidden',
  },
  stalenessFill: { height: '100%', borderRadius: 2 },
  daysBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.full },
  daysBadgeText: { fontSize: 10, fontWeight: '700', fontFamily: FONT_FAMILY.mono },
  repostBtn: {
    backgroundColor: DS.brand,
    borderRadius:    RADIUS.sm,
    paddingVertical: SPACE[2],
    paddingHorizontal: SPACE[3],
    flexDirection:   'row',
    alignItems:      'center',
    gap:             4,
    flexShrink:      0,
  },
  repostBtnText: { fontSize: 11, fontWeight: '700', color: '#fff' },

  // Badge genérico
  badge: { paddingHorizontal: SPACE[2], paddingVertical: 2, borderRadius: RADIUS.full, alignSelf: 'flex-start' },
  badgeTxt: { fontSize: FONT_SIZE.xs, fontWeight: '700' },

  // Chart
  chartCard: {
    backgroundColor: DS.surface,
    borderRadius:    RADIUS.lg,
    borderWidth:     1,
    borderColor:     DS.border,
    padding:         SPACE[4],
    marginBottom:    SPACE[5],
  },
  chartTitle: { fontSize: FONT_SIZE.sm + 1, fontWeight: '600', color: DS.text, marginBottom: SPACE[4] },
  chartSub:   { fontSize: FONT_SIZE.xs, fontWeight: '400', color: DS.text3 },
  chartBars: {
    flexDirection: 'row',
    alignItems:    'flex-end',
    gap:           SPACE[2],
    height:        BAR_MAX_H + 30,
    marginBottom:  SPACE[3],
  },
  barCol:  { flex: 1, alignItems: 'center', gap: SPACE[1] },
  barVal:  { fontSize: 9, fontWeight: '700', fontFamily: FONT_FAMILY.mono },
  bar:     { width: '100%', borderRadius: 4, minHeight: 4 },
  barLabel:{ fontSize: 9, color: DS.text3, fontWeight: '500', textAlign: 'center' },
  chartLegend: { flexDirection: 'row', gap: SPACE[4], flexWrap: 'wrap' },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:   { width: 7, height: 7, borderRadius: 4 },
  legendText:  { fontSize: 10, color: DS.text2 },

  // Insights
  insightCard: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    gap:            SPACE[3],
    backgroundColor: DS.surface,
    borderRadius:   RADIUS.lg,
    borderWidth:    1,
    borderColor:    DS.border,
    borderLeftWidth: 3,
    padding:        SPACE[4],
    marginBottom:   SPACE[2],
  },
  insightIcon:  { fontSize: 18, lineHeight: 22 },
  insightTitle: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: DS.text, marginBottom: 3 },
  insightMsg:   { fontSize: 11, color: DS.text2, lineHeight: 16 },

  // Tabs inventario
  tabBar: {
    flexDirection:   'row',
    gap:             SPACE[1],
    backgroundColor: DS.surface3,
    borderRadius:    RADIUS.md,
    padding:         3,
    marginBottom:    SPACE[3],
  },
  tabBtn: {
    flex:           1,
    alignItems:     'center',
    paddingVertical: SPACE[2],
    borderRadius:   RADIUS.sm,
  },
  tabBtnActive: { backgroundColor: DS.surface },
  tabLabel: {
    fontSize:  11,
    fontWeight: '600',
    color:     DS.text3,
  },
  tabLabelActive: { color: DS.text },

  // Product row
  productRow: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            SPACE[3],
    backgroundColor: DS.surface,
    borderRadius:   RADIUS.lg,
    borderWidth:    1,
    borderColor:    DS.border,
    padding:        SPACE[3],
    marginBottom:   SPACE[2],
  },
  productImgBox: {
    width:           60,
    height:          60,
    borderRadius:    RADIUS.md,
    backgroundColor: DS.surface3,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  productBrand: {
    fontSize:      9,
    fontWeight:    '700',
    color:         DS.brand,
    textTransform: 'uppercase',
    letterSpacing: TRACKING.wide,
    marginBottom:  2,
  },
  productTitle: {
    fontSize:    FONT_SIZE.sm + 1,
    fontWeight:  '600',
    color:       DS.text,
    marginBottom: 5,
  },
  productMeta:      { flexDirection: 'row', alignItems: 'center', gap: SPACE[2] },
  productPrice: {
    fontSize:   FONT_SIZE.base,
    fontWeight: '700',
    color:      DS.brand,
    fontFamily: FONT_FAMILY.mono,
  },
  productBadge: {
    paddingHorizontal: SPACE[2],
    paddingVertical:   2,
    borderRadius:      RADIUS.full,
  },
  productBadgeText: { fontSize: 10, fontWeight: '700' },
  productViews: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           3,
  },
  productViewsText: { fontSize: 11, color: DS.text3 },

  // Empty
  emptyState: {
    alignItems:    'center',
    paddingVertical: SPACE[6],
    gap:           SPACE[2],
  },
  emptyText: { fontSize: FONT_SIZE.sm, color: DS.text3 },

  // Quick actions
  quickRow: { flexDirection: 'row', gap: SPACE[2], marginTop: SPACE[4] },
  quickCard: {
    flex:            1,
    backgroundColor: DS.surface,
    borderRadius:    RADIUS.lg,
    borderWidth:     1,
    borderColor:     DS.border,
    padding:         SPACE[3],
    alignItems:      'center',
    gap:             SPACE[1],
  },
  quickIconBox: {
    width:           40,
    height:          40,
    borderRadius:    RADIUS.md,
    backgroundColor: DS.surface3,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    SPACE[1],
  },
  quickLabel: { fontSize: 11, fontWeight: '700', color: DS.text, textAlign: 'center' },
  quickSub:   { fontSize: 9,  fontWeight: '400', color: DS.text3, textAlign: 'center' },
});