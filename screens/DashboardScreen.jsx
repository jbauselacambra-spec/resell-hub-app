/**
 * DashboardScreen.jsx — Sprint 9.2
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [ORCHESTRATOR] Sprint 9.2 — Fix contrato KPIs en DashboardScreen
 *
 * [QA_ENGINEER] BUG CRÍTICO CORREGIDO:
 * ─────────────────────────────────────────────────────────────────
 *   ERROR:  TypeError: Cannot read property 'toFixed' of undefined
 *   SCREEN: DashboardScreen
 *
 *   CAUSA RAÍZ:
 *   El Sprint 9.1 actualizó el contrato de DatabaseService.getBusinessKPIs()
 *   eliminando/renombrando campos legacy, PERO DashboardScreen no fue
 *   actualizado para consumir el nuevo contrato. Resultado: campos undefined
 *   sobre los que se llamaba .toFixed() → crash inmediato en el render.
 *
 *   MAPA COMPLETO DE CAMBIOS EN EL CONTRATO:
 *   ┌──────────────────────────────┬──────────────────────────────────┐
 *   │ Campo VIEJO (Sprint ≤ 9)     │ Campo NUEVO (Sprint 9.1+)        │
 *   ├──────────────────────────────┼──────────────────────────────────┤
 *   │ kpis.totalRevenue            │ kpis.totalRecaudacion            │
 *   │ kpis.totalProfit             │ ELIMINADO → usar rotacion        │
 *   │ kpis.revenueThisMonth        │ kpis.recaudacionThisMonth        │
 *   └──────────────────────────────┴──────────────────────────────────┘
 *
 *   CAMPOS SIN CAMBIOS (ya correctos):
 *   avgTTS, soldCount, activeCount, staleCount, soldThisMonth,
 *   bestCat, worstCat, topSubcategory, totalViews, totalFavorites
 *   (nuevos) rotacion, avgPrecioVenta
 *
 * [DATA_SCIENTIST] Rediseño KPI Card principal:
 *   ANTES: "INGRESOS TOTALES" (totalRevenue) + "beneficio neto" (totalProfit)
 *   AHORA: "RECAUDADO" (totalRecaudacion) + "rotación X%" (rotacion)
 *          En 2ª mano el "beneficio" es siempre ≤ 0 → métrica sin valor.
 *          "Rotación" = % del catálogo liquidado → KPI de liquidez real.
 *
 * [ARCHITECT] Contrato esperado de getBusinessKPIs() tras Sprint 9.1:
 *   {
 *     totalRecaudacion:    number,   // suma de soldPriceReal
 *     recaudacionThisMonth: number,  // recaudación del mes actual
 *     rotacion:            number,   // % catálogo vendido (0-100)
 *     avgPrecioVenta:      number,   // precio medio de venta
 *     totalViews:          number,
 *     totalFavorites:      number,
 *     soldCount:           number,
 *     activeCount:         number,
 *     staleCount:          number,
 *     soldThisMonth:       number,
 *     avgTTS:              number,
 *     bestCat:             object|null,
 *     worstCat:            object|null,
 *     topSubcategory:      object|null,
 *   }
 *
 * [UI_SPECIALIST] Sin cambios visuales estructurales — mismo DS Light.
 *   Solo se actualizan los labels y campos referenciados.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  RefreshControl, Animated, Dimensions, Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { DatabaseService } from '../services/DatabaseService';

const { width } = Dimensions.get('window');

// ─── Design System Light ─────────────────────────────────────────────────────
const AMOLED = {
  bg:       '#F8F9FA',
  surface:  '#FFFFFF',
  surface2: '#F0F2F5',
  border:   '#EAEDF0',
  primary:  '#FF6B35',
  success:  '#00D9A3',
  warning:  '#FFB800',
  danger:   '#E63946',
  blue:     '#004E89',
  textHi:   '#1A1A2E',
  textMed:  '#5C6070',
  textLow:  '#A0A5B5',
  mono:     Platform.OS === 'android' ? 'monospace' : 'Courier New',
};

const MONTH_EMOJIS = ['🎁','💘','🌱','☀️','🏖️','🔥','💰','🎒','🍂','🎃','🛍️','🎄'];
const MONTH_NAMES  = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio',
                      'Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// ─── Pantalla ─────────────────────────────────────────────────────────────────
export default function DashboardScreen({ navigation }) {
  // ── [QA_ENGINEER] ZONA DE HOOKS — sin early returns entre ellos ──────────
  const [kpis,       setKpis]       = useState(null);
  const [insights,   setInsights]   = useState([]);
  const [alerts,     setAlerts]     = useState([]);
  const [config,     setConfig]     = useState(() => DatabaseService.getConfig());
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useState(new Animated.Value(0))[0];

  const currentMonth = new Date().getMonth();

  const loadData = () => {
    setConfig(DatabaseService.getConfig());
    setKpis(DatabaseService.getBusinessKPIs());
    setInsights(DatabaseService.getSmartInsights());
    setAlerts(DatabaseService.getSmartAlerts().slice(0, 4));
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
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
  // ── FIN ZONA DE HOOKS ─────────────────────────────────────────────────────

  if (!kpis) return null;

  // Seasonal banner — dinámico desde config.seasonalMap
  const seasonalCats = Array.isArray(config.seasonalMap?.[currentMonth])
    ? config.seasonalMap[currentMonth]
    : (config.seasonalMap?.[currentMonth] ? [config.seasonalMap[currentMonth]] : []);
  const seasonalTip = seasonalCats.length > 0
    ? `${MONTH_NAMES[currentMonth]}: temporada de ${seasonalCats.join(' y ')}. Publica o republica ahora.`
    : `${MONTH_NAMES[currentMonth]}: configura categorías estacionales en Settings.`;

  return (
    <Animated.ScrollView
      style={[styles.container, { opacity: fadeAnim }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={AMOLED.primary} />
      }
    >
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.dateLabel}>
            {new Date().toLocaleDateString('es-ES', {
              weekday: 'long', day: 'numeric', month: 'long',
            }).toUpperCase()}
          </Text>
          <Text style={styles.greeting}>Mi Negocio 📦</Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('Settings')}
          style={styles.settingsBtn}
        >
          <Icon name="settings" size={20} color={AMOLED.textHi} />
        </TouchableOpacity>
      </View>

      {/* ── SEASONAL BANNER ───────────────────────────────────────────────── */}
      <TouchableOpacity
        style={styles.seasonBanner}
        onPress={() => navigation.navigate('Stock')}
        activeOpacity={0.7}
      >
        <Text style={styles.seasonEmoji}>{MONTH_EMOJIS[currentMonth]}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.seasonLabel}>CATEGORÍAS DE HOY</Text>
          <Text style={styles.seasonText}>{seasonalTip}</Text>
        </View>
        <Icon name="chevron-right" size={16} color={AMOLED.warning} />
      </TouchableOpacity>

      {/* ── KPI FINANCIERO ────────────────────────────────────────────────── */}
      {/*
       * [DATA_SCIENTIST] Sprint 9.2 — Campos actualizados:
       *   totalRecaudacion     (era totalRevenue)
       *   recaudacionThisMonth (era revenueThisMonth)
       *   rotacion             (reemplaza totalProfit — en 2ª mano siempre ≤ 0)
       */}
      <View style={styles.kpiRow}>
        <View style={[styles.kpiCard, { backgroundColor: AMOLED.surface }]}>
          <Text style={styles.kpiLabelLight}>RECAUDADO TOTAL</Text>
          {/* [FIX] era kpis.totalRevenue.toFixed(0) → kpis.totalRecaudacion.toFixed(0) */}
          <Text style={styles.kpiValueLight}>{kpis.totalRecaudacion.toFixed(0)}€</Text>
          <Text style={styles.kpiSub}>{kpis.soldCount} ventas cerradas</Text>
          <View style={styles.kpiDivider} />
          {/* [FIX] era kpis.totalProfit → ELIMINADO. Ahora muestra rotación */}
          <Text style={[styles.kpiSub, { color: kpis.rotacion >= 50 ? AMOLED.success : AMOLED.warning }]}>
            {kpis.rotacion}% rotación del stock
          </Text>
          {kpis.avgPrecioVenta > 0 && (
            <Text style={[styles.kpiSub, { color: AMOLED.textMed, marginTop: 2 }]}>
              precio medio: {kpis.avgPrecioVenta}€
            </Text>
          )}
        </View>

        <View style={styles.kpiRight}>
          <View style={[styles.kpiSmall, { borderColor: AMOLED.border }]}>
            <Text style={styles.kpiSmallLabel}>EN STOCK</Text>
            <Text style={styles.kpiSmallValue}>{kpis.activeCount}</Text>
            <Text style={styles.kpiSmallSub}>artículos</Text>
          </View>
          <View style={[styles.kpiSmall, { borderColor: '#00D9A315', backgroundColor: '#00D9A308' }]}>
            <Text style={styles.kpiSmallLabel}>ESTE MES</Text>
            <Text style={[styles.kpiSmallValue, { color: AMOLED.success }]}>{kpis.soldThisMonth}</Text>
            <Text style={styles.kpiSmallSub}>vendidos</Text>
          </View>
        </View>
      </View>

      {/* ── RECAUDACIÓN ESTE MES ──────────────────────────────────────────── */}
      {/* [FIX] era kpis.revenueThisMonth → kpis.recaudacionThisMonth */}
      {kpis.recaudacionThisMonth > 0 && (
        <View style={styles.monthRecCard}>
          <Icon name="trending-up" size={14} color={AMOLED.success} />
          <Text style={styles.monthRecText}>
            <Text style={{ fontWeight: '900', color: AMOLED.success }}>
              {kpis.recaudacionThisMonth.toFixed(0)}€
            </Text>
            {' '}recaudados este mes · {kpis.soldThisMonth} ventas
          </Text>
        </View>
      )}

      {/* ── TTS METRIC ────────────────────────────────────────────────────── */}
      <View style={styles.ttsCard}>
        <View style={styles.ttsLeft}>
          <Text style={styles.ttsLabel}>TIME-TO-SELL MEDIO</Text>
          <Text style={styles.ttsValue}>{kpis.avgTTS > 0 ? `${kpis.avgTTS}d` : '—'}</Text>
          <Text style={styles.ttsSub}>tiempo medio de venta</Text>
        </View>
        <View style={styles.ttsDivider} />
        <View style={styles.ttsRight}>
          {kpis.bestCat && (() => {
            const bestSub = kpis.bestCat.subcategoryStats?.[0];
            return (
              <View style={styles.ttsStatRow}>
                <Text style={styles.ttsStatEmoji}>⚡</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ttsStatLabel}>RELÁMPAGO</Text>
                  <Text style={styles.ttsStatValue}>
                    {kpis.bestCat.name} · {kpis.bestCat.avgTTS}d
                  </Text>
                  {bestSub && (
                    <Text style={{ fontSize: 10, color: AMOLED.success, marginTop: 2 }}>
                      › {bestSub.name} · {bestSub.avgTTS}d
                    </Text>
                  )}
                </View>
              </View>
            );
          })()}

          {kpis.worstCat && kpis.worstCat.name !== kpis.bestCat?.name && (() => {
            const worstSub = kpis.worstCat.subcategoryStats
              ?.slice()
              .sort((a, b) => b.avgTTS - a.avgTTS)?.[0];
            return (
              <View style={[styles.ttsStatRow, { marginTop: 8 }]}>
                <Text style={styles.ttsStatEmoji}>⚓</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ttsStatLabel}>ANCLA</Text>
                  <Text style={[styles.ttsStatValue, { color: AMOLED.danger }]}>
                    {kpis.worstCat.name} · {kpis.worstCat.avgTTS}d
                  </Text>
                  {worstSub && (
                    <Text style={{ fontSize: 10, color: AMOLED.danger, marginTop: 2 }}>
                      › {worstSub.name} · {worstSub.avgTTS}d
                    </Text>
                  )}
                </View>
              </View>
            );
          })()}

          {kpis.topSubcategory && (
            <View style={[styles.ttsStatRow, { marginTop: 8 }]}>
              <Text style={styles.ttsStatEmoji}>🏆</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.ttsStatLabel}>TOP SUBCATEGORÍA</Text>
                <Text style={[styles.ttsStatValue, { color: AMOLED.warning }]}>
                  {kpis.topSubcategory.parentCategory} › {kpis.topSubcategory.name} · {kpis.topSubcategory.avgTTS}d
                </Text>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={styles.ttsBtn}
            onPress={() => navigation.navigate('Stats')}
            activeOpacity={0.7}
          >
            <Text style={styles.ttsBtnText}>Ver análisis</Text>
            <Icon name="arrow-right" size={12} color={AMOLED.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── SMART INSIGHTS ────────────────────────────────────────────────── */}
      {insights.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💡 SMART INSIGHTS</Text>
          {insights.map((ins, i) => (
            <View key={i} style={[styles.insightCard, { borderLeftColor: ins.color }]}>
              <Text style={styles.insightEmoji}>{ins.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.insightTitle}>{ins.title}</Text>
                <Text style={styles.insightMsg}>{ins.message}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* ── ALERTAS PRIORITARIAS ──────────────────────────────────────────── */}
      {alerts.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🚨 ALERTAS</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Stats', { tab: 'alerts' })}>
              <Text style={styles.sectionLink}>Ver todas →</Text>
            </TouchableOpacity>
          </View>
          {alerts.map((alert, i) => {
            const bgColor = alert.color || AMOLED.primary;
            return (
              <View key={i} style={[styles.alertCard, { borderLeftColor: bgColor }]}>
                <View style={[styles.alertIcon, { backgroundColor: bgColor + '18' }]}>
                  <Text style={{ fontSize: 14 }}>{alert.icon || '⚠️'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.alertTitle}>{alert.title}</Text>
                  <Text style={styles.alertMsg} numberOfLines={2}>{alert.message}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* ── ACCIONES RÁPIDAS ──────────────────────────────────────────────── */}
      <View style={styles.quickRow}>
        <TouchableOpacity
          style={styles.quickCard}
          onPress={() => navigation.navigate('Stock')}
          activeOpacity={0.7}
        >
          <View style={[styles.quickIcon, { backgroundColor: AMOLED.surface2 }]}>
            <Icon name="package" size={20} color={AMOLED.textMed} />
          </View>
          <Text style={styles.quickLabel}>Inventario</Text>
          <Text style={styles.quickSub}>{kpis.activeCount} activos</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickCard}
          onPress={() => navigation.navigate('History')}
          activeOpacity={0.7}
        >
          <View style={[styles.quickIcon, { backgroundColor: '#00D9A3' }]}>
            <Icon name="check-circle" size={20} color="#FFF" />
          </View>
          <Text style={styles.quickLabel}>Vendidos</Text>
          <Text style={styles.quickSub}>{kpis.soldCount} totales</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickCard}
          onPress={() => navigation.navigate('Stats')}
          activeOpacity={0.7}
        >
          <View style={[styles.quickIcon, { backgroundColor: AMOLED.primary }]}>
            <Icon name="bar-chart-2" size={20} color="#FFF" />
          </View>
          <Text style={styles.quickLabel}>Analytics</Text>
          <Text style={styles.quickSub}>TTS & Rotación</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 50 }} />
    </Animated.ScrollView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AMOLED.bg },

  header: {
    paddingHorizontal: 25, paddingTop: 60, paddingBottom: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: AMOLED.bg,
  },
  dateLabel:   { fontSize: 9, fontWeight: '900', color: AMOLED.primary, letterSpacing: 1.5 },
  greeting:    { fontSize: 26, fontWeight: '900', color: AMOLED.textHi, marginTop: 2 },
  settingsBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: AMOLED.surface, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: AMOLED.border,
  },

  seasonBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: AMOLED.surface, borderLeftWidth: 4, borderLeftColor: AMOLED.warning,
    marginHorizontal: 20, marginVertical: 12,
    padding: 14, borderRadius: 16, elevation: 1,
  },
  seasonEmoji: { fontSize: 24 },
  seasonLabel: { fontSize: 8, fontWeight: '900', color: AMOLED.warning, letterSpacing: 1.5, marginBottom: 2 },
  seasonText:  { fontSize: 12, color: AMOLED.textMed, lineHeight: 17 },

  kpiRow:  { flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginBottom: 12 },
  kpiCard: { flex: 1.3, padding: 18, borderRadius: 24, borderWidth: 1, borderColor: AMOLED.border, elevation: 1 },
  kpiLabelLight: { color: AMOLED.textLow, fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  kpiValueLight: { color: AMOLED.blue, fontSize: 28, fontWeight: '900', fontFamily: AMOLED.mono, marginTop: 6, letterSpacing: -0.5 },
  kpiSub:        { color: AMOLED.textMed, fontSize: 10, marginTop: 4 },
  kpiDivider:    { height: 1, backgroundColor: AMOLED.border, marginVertical: 8 },
  kpiRight:  { flex: 1, gap: 10 },
  kpiSmall: {
    flex: 1, backgroundColor: AMOLED.surface, borderWidth: 1,
    borderRadius: 18, padding: 14, justifyContent: 'center',
  },
  kpiSmallLabel: { fontSize: 8, fontWeight: '900', color: AMOLED.textMed, letterSpacing: 1 },
  kpiSmallValue: { fontSize: 22, fontWeight: '900', fontFamily: AMOLED.mono, color: AMOLED.textHi, marginVertical: 2 },
  kpiSmallSub:   { fontSize: 9, color: AMOLED.textLow },

  monthRecCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 20, marginBottom: 12, padding: 12,
    backgroundColor: '#00D9A308', borderRadius: 12,
    borderWidth: 1, borderColor: '#00D9A322',
  },
  monthRecText: { fontSize: 12, color: AMOLED.textMed, flex: 1 },

  ttsCard: {
    flexDirection: 'row', backgroundColor: AMOLED.surface,
    marginHorizontal: 20, borderRadius: 20, padding: 18,
    marginBottom: 16, elevation: 2, gap: 16,
    borderWidth: 1, borderColor: AMOLED.border,
  },
  ttsLeft:      { alignItems: 'flex-start', justifyContent: 'center' },
  ttsLabel:     { fontSize: 9, fontWeight: '900', color: AMOLED.textMed, letterSpacing: 1.5 },
  ttsValue:     { fontSize: 32, fontWeight: '900', fontFamily: AMOLED.mono, color: AMOLED.primary, lineHeight: 38 },
  ttsSub:       { fontSize: 10, color: AMOLED.textLow, marginTop: 2 },
  ttsDivider:   { width: 1, backgroundColor: AMOLED.border, alignSelf: 'stretch' },
  ttsRight:     { flex: 1, justifyContent: 'center' },
  ttsStatRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ttsStatEmoji: { fontSize: 18 },
  ttsStatLabel: { fontSize: 8, fontWeight: '900', color: AMOLED.textMed, letterSpacing: 1 },
  ttsStatValue: { fontSize: 12, fontWeight: '800', fontFamily: AMOLED.mono, color: AMOLED.success },
  ttsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: 12, backgroundColor: AMOLED.primary + '22',
    alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
  },
  ttsBtnText: { fontSize: 10, fontWeight: '800', color: AMOLED.primary },

  section:       { marginHorizontal: 20, marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle:  { fontSize: 11, fontWeight: '900', color: AMOLED.textMed, letterSpacing: 1.5 },
  sectionLink:   { fontSize: 11, fontWeight: '700', color: AMOLED.primary },

  insightCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: AMOLED.surface, borderRadius: 16, padding: 14,
    marginBottom: 8, borderLeftWidth: 4, elevation: 1,
  },
  insightEmoji: { fontSize: 20, marginTop: 2 },
  insightTitle: { fontSize: 12, fontWeight: '800', color: AMOLED.textHi, marginBottom: 3 },
  insightMsg:   { fontSize: 11, color: AMOLED.textMed, lineHeight: 16 },

  alertCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: AMOLED.surface2, borderRadius: 14, padding: 12,
    marginBottom: 8, borderLeftWidth: 4,
  },
  alertIcon:  { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  alertTitle: { fontSize: 12, fontWeight: '800', color: AMOLED.textHi },
  alertMsg:   { fontSize: 11, color: AMOLED.textMed, marginTop: 2 },

  quickRow: {
    flexDirection: 'row', paddingHorizontal: 20, gap: 10,
    marginBottom: 16,
  },
  quickCard: {
    flex: 1, backgroundColor: AMOLED.surface, borderRadius: 18, padding: 14,
    alignItems: 'center', gap: 6, borderWidth: 1, borderColor: AMOLED.border, elevation: 1,
  },
  quickIcon:  { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  quickLabel: { fontSize: 11, fontWeight: '800', color: AMOLED.textHi },
  quickSub:   { fontSize: 9, color: AMOLED.textLow },
});