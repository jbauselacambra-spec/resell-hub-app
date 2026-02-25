import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Animated, Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { DatabaseService } from '../services/DatabaseService';

const { width } = Dimensions.get('window');

const MONTH_SEASONAL_TIPS = {
  0:  { emoji: '🎁', tip: 'Enero – Post-reyes. Mueve Juguetes sobrantes y Abrigos.' },
  1:  { emoji: '💘', tip: 'Febrero – San Valentín. Accesorios y Ropa formal.' },
  2:  { emoji: '🌱', tip: 'Marzo – Primavera. Calzado deportivo y ropa ligera.' },
  3:  { emoji: '☀️', tip: 'Abril – Entretiempo. Vestidos y Accesorios.' },
  4:  { emoji: '🏖️', tip: 'Mayo – Pre-verano. Bañadores y Sandalias.' },
  5:  { emoji: '🔥', tip: 'Junio – Pico verano. Electrónica portátil.' },
  6:  { emoji: '💰', tip: 'Julio – Rebajas. Ajusta precios y publica Lotes.' },
  7:  { emoji: '🎒', tip: 'Agosto – Vuelta al cole. Libros y Calzado infantil.' },
  8:  { emoji: '🍂', tip: 'Septiembre – Otoño. Chaquetas y Entretenimiento.' },
  9:  { emoji: '🎃', tip: 'Octubre – Halloween. ¡Republica Disfraces YA!' },
  10: { emoji: '🛍️', tip: 'Noviembre – Black Friday. Electrónica y Lotes.' },
  11: { emoji: '🎄', tip: 'Diciembre – Navidad. Juguetes y Coleccionables.' },
};

export default function DashboardScreen({ navigation }) {
  const [kpis, setKpis]       = useState(null);
  const [insights, setInsights] = useState([]);
  const [alerts, setAlerts]   = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useState(new Animated.Value(0))[0];

  const currentMonth = new Date().getMonth();
  const seasonal = MONTH_SEASONAL_TIPS[currentMonth];

  const loadData = () => {
    const k = DatabaseService.getBusinessKPIs();
    const i = DatabaseService.getSmartInsights();
    const a = DatabaseService.getSmartAlerts().slice(0, 4);
    setKpis(k);
    setInsights(i);
    setAlerts(a);

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

  if (!kpis) return null;

  const alertColorMap = { critical: '#E63946', stale: '#FF6B35', seasonal: '#FFB800', opportunity: '#00D9A3' };

  return (
    <Animated.ScrollView
      style={[styles.container, { opacity: fadeAnim }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6B35" />}
    >
      {/* ── HEADER ─────────────────────────────── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.dateLabel}>
            {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}
          </Text>
          <Text style={styles.greeting}>Mi Negocio 📦</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.settingsBtn}>
          <Icon name="settings" size={20} color="#1A1A2E" />
        </TouchableOpacity>
      </View>

      {/* ── SEASONAL BANNER ─────────────────────── */}
      <TouchableOpacity style={styles.seasonBanner} onPress={() => navigation.navigate('Stock')}>
        <Text style={styles.seasonEmoji}>{seasonal.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.seasonLabel}>CONSEJO DE HOY</Text>
          <Text style={styles.seasonText}>{seasonal.tip}</Text>
        </View>
        <Icon name="chevron-right" size={16} color="#FFB800" />
      </TouchableOpacity>

      {/* ── KPI FINANCIERO ──────────────────────── */}
      <View style={styles.kpiRow}>
        <View style={[styles.kpiCard, { backgroundColor: '#1A1A2E' }]}>
          <Text style={styles.kpiLabelLight}>INGRESOS TOTALES</Text>
          <Text style={styles.kpiValueLight}>{kpis.totalRevenue.toFixed(0)}€</Text>
          <Text style={styles.kpiSub}>{kpis.soldCount} ventas cerradas</Text>
          <View style={styles.kpiDivider} />
          <Text style={[styles.kpiSub, { color: '#00D9A3' }]}>
            +{kpis.totalProfit.toFixed(0)}€ beneficio neto
          </Text>
        </View>

        <View style={styles.kpiRight}>
          <View style={[styles.kpiSmall, { borderColor: '#EEE' }]}>
            <Text style={styles.kpiSmallLabel}>EN STOCK</Text>
            <Text style={styles.kpiSmallValue}>{kpis.activeCount}</Text>
            <Text style={styles.kpiSmallSub}>artículos</Text>
          </View>
          <View style={[styles.kpiSmall, { borderColor: '#00D9A315', backgroundColor: '#00D9A308' }]}>
            <Text style={styles.kpiSmallLabel}>ESTE MES</Text>
            <Text style={[styles.kpiSmallValue, { color: '#00D9A3' }]}>{kpis.soldThisMonth}</Text>
            <Text style={styles.kpiSmallSub}>vendidos</Text>
          </View>
        </View>
      </View>

      {/* ── TTS METRIC ──────────────────────────── */}
      <View style={styles.ttsCard}>
        <View style={styles.ttsLeft}>
          <Text style={styles.ttsLabel}>TIME-TO-SELL MEDIO</Text>
          <Text style={styles.ttsValue}>{kpis.avgTTS > 0 ? `${kpis.avgTTS}d` : '—'}</Text>
          <Text style={styles.ttsSub}>tiempo medio de venta</Text>
        </View>
        <View style={styles.ttsDivider} />
        <View style={styles.ttsRight}>
          {kpis.bestCat && (
            <View style={styles.ttsStatRow}>
              <Text style={styles.ttsStatEmoji}>⚡</Text>
              <View>
                <Text style={styles.ttsStatLabel}>RELÁMPAGO</Text>
                <Text style={styles.ttsStatValue}>{kpis.bestCat.name} · {kpis.bestCat.avgTTS}d</Text>
              </View>
            </View>
          )}
          {kpis.worstCat && kpis.worstCat.name !== kpis.bestCat?.name && (
            <View style={[styles.ttsStatRow, { marginTop: 8 }]}>
              <Text style={styles.ttsStatEmoji}>⚓</Text>
              <View>
                <Text style={styles.ttsStatLabel}>ANCLA</Text>
                <Text style={[styles.ttsStatValue, { color: '#E63946' }]}>{kpis.worstCat.name} · {kpis.worstCat.avgTTS}d</Text>
              </View>
            </View>
          )}
          <TouchableOpacity style={styles.ttsBtn} onPress={() => navigation.navigate('Stats')}>
            <Text style={styles.ttsBtnText}>Ver análisis</Text>
            <Icon name="arrow-right" size={12} color="#FF6B35" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── SMART INSIGHTS ──────────────────────── */}
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

      {/* ── ALERTAS PRIORITARIAS ─────────────────── */}
      {alerts.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>⚠️ ACCIONES PRIORITARIAS</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Stats')}>
              <Text style={styles.seeAll}>Ver todas</Text>
            </TouchableOpacity>
          </View>
          {alerts.map((alert, i) => {
            const color = alertColorMap[alert.type] || '#FF6B35';
            return (
              <TouchableOpacity
                key={i}
                style={[styles.alertCard, { borderLeftColor: color }]}
                onPress={() => navigation.navigate('Stock')}
              >
                <View style={[styles.alertIcon, { backgroundColor: color + '18' }]}>
                  <Icon name={alert.icon || 'alert-circle'} size={16} color={color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.alertTitle} numberOfLines={1}>{alert.title}</Text>
                  <Text style={styles.alertMsg} numberOfLines={1}>{alert.message}</Text>
                </View>
                <View style={[styles.alertActionChip, { borderColor: color + '44' }]}>
                  <Text style={[styles.alertActionText, { color }]}>{alert.action}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* ── IMPACTO VINTED ──────────────────────── */}
      <View style={styles.vintedRow}>
        <View style={styles.vintedBox}>
          <Icon name="eye" size={16} color="#4EA8DE" />
          <Text style={styles.vintedVal}>{kpis.totalViews.toLocaleString()}</Text>
          <Text style={styles.vintedLab}>Vistas totales</Text>
        </View>
        <View style={styles.vintedBox}>
          <Icon name="heart" size={16} color="#E63946" />
          <Text style={styles.vintedVal}>{kpis.totalFavorites.toLocaleString()}</Text>
          <Text style={styles.vintedLab}>Favoritos totales</Text>
        </View>
        <View style={styles.vintedBox}>
          <Icon name="trending-up" size={16} color="#FF6B35" />
          <Text style={styles.vintedVal}>{kpis.revenueThisMonth.toFixed(0)}€</Text>
          <Text style={styles.vintedLab}>Ingresado este mes</Text>
        </View>
      </View>

      {/* ── QUICK ACTIONS ───────────────────────── */}
      <View style={styles.quickRow}>
        <TouchableOpacity style={styles.quickCard} onPress={() => navigation.navigate('Stock')}>
          <View style={[styles.quickIcon, { backgroundColor: '#1A1A2E' }]}>
            <Icon name="package" size={20} color="#FFF" />
          </View>
          <Text style={styles.quickLabel}>Inventario</Text>
          <Text style={styles.quickSub}>{kpis.activeCount} activos</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.quickCard} onPress={() => navigation.navigate('History')}>
          <View style={[styles.quickIcon, { backgroundColor: '#00D9A3' }]}>
            <Icon name="check-circle" size={20} color="#FFF" />
          </View>
          <Text style={styles.quickLabel}>Vendidos</Text>
          <Text style={styles.quickSub}>{kpis.soldCount} totales</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.quickCard} onPress={() => navigation.navigate('Stats')}>
          <View style={[styles.quickIcon, { backgroundColor: '#FF6B35' }]}>
            <Icon name="bar-chart-2" size={20} color="#FFF" />
          </View>
          <Text style={styles.quickLabel}>Analytics</Text>
          <Text style={styles.quickSub}>TTS & Rentab.</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 50 }} />
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },

  header: {
    paddingHorizontal: 25, paddingTop: 60, paddingBottom: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#FFF',
  },
  dateLabel: { fontSize: 9, fontWeight: '900', color: '#FF6B35', letterSpacing: 1.5 },
  greeting:  { fontSize: 26, fontWeight: '900', color: '#1A1A2E', marginTop: 2 },
  settingsBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F8F9FA', justifyContent: 'center', alignItems: 'center',
  },

  seasonBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFFBEA', borderLeftWidth: 4, borderLeftColor: '#FFB800',
    marginHorizontal: 20, marginVertical: 12,
    padding: 14, borderRadius: 16,
  },
  seasonEmoji: { fontSize: 24 },
  seasonLabel: { fontSize: 8, fontWeight: '900', color: '#FFB800', letterSpacing: 1.5, marginBottom: 2 },
  seasonText:  { fontSize: 12, color: '#666', lineHeight: 17 },

  kpiRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginBottom: 12 },
  kpiCard: {
    flex: 1.3, padding: 18, borderRadius: 24,
  },
  kpiLabelLight: { color: 'rgba(255,255,255,0.45)', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  kpiValueLight: { color: '#FFF', fontSize: 28, fontWeight: '900', marginTop: 6, letterSpacing: -0.5 },
  kpiSub:        { color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 4 },
  kpiDivider:    { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 8 },
  kpiRight: { flex: 1, gap: 10 },
  kpiSmall: {
    flex: 1, backgroundColor: '#FFF', borderWidth: 1,
    borderRadius: 18, padding: 14, justifyContent: 'center',
  },
  kpiSmallLabel: { fontSize: 8, fontWeight: '900', color: '#BBB', letterSpacing: 1 },
  kpiSmallValue: { fontSize: 22, fontWeight: '900', color: '#1A1A2E', marginVertical: 2 },
  kpiSmallSub:   { fontSize: 9, color: '#999' },

  ttsCard: {
    flexDirection: 'row', backgroundColor: '#FFF',
    marginHorizontal: 20, borderRadius: 20, padding: 18,
    marginBottom: 16, elevation: 2, gap: 16,
  },
  ttsLeft:  { alignItems: 'flex-start', justifyContent: 'center' },
  ttsLabel: { fontSize: 9, fontWeight: '900', color: '#BBB', letterSpacing: 1.5 },
  ttsValue: { fontSize: 32, fontWeight: '900', color: '#1A1A2E', lineHeight: 38 },
  ttsSub:   { fontSize: 10, color: '#999', marginTop: 2 },
  ttsDivider: { width: 1, backgroundColor: '#F0F0F0', alignSelf: 'stretch' },
  ttsRight: { flex: 1, justifyContent: 'center' },
  ttsStatRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ttsStatEmoji: { fontSize: 18 },
  ttsStatLabel: { fontSize: 8, fontWeight: '900', color: '#BBB', letterSpacing: 1 },
  ttsStatValue: { fontSize: 12, fontWeight: '800', color: '#00D9A3' },
  ttsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: 12, backgroundColor: '#FFF2EE',
    alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
  },
  ttsBtnText: { fontSize: 10, fontWeight: '800', color: '#FF6B35' },

  section:     { paddingHorizontal: 20, marginBottom: 16 },
  sectionRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle:{ fontSize: 11, fontWeight: '900', color: '#BBB', letterSpacing: 1.5 },
  seeAll:      { fontSize: 10, fontWeight: '800', color: '#FF6B35' },

  insightCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: '#FFF', borderLeftWidth: 4,
    padding: 14, borderRadius: 16, marginBottom: 10, elevation: 1,
  },
  insightEmoji: { fontSize: 20, marginTop: 1 },
  insightTitle: { fontSize: 13, fontWeight: '800', color: '#1A1A2E', marginBottom: 2 },
  insightMsg:   { fontSize: 11, color: '#666', lineHeight: 16 },

  alertCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFF', borderLeftWidth: 4,
    padding: 14, borderRadius: 16, marginBottom: 10, elevation: 1,
  },
  alertIcon: {
    width: 34, height: 34, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  alertTitle:      { fontSize: 12, fontWeight: '800', color: '#1A1A2E' },
  alertMsg:        { fontSize: 10, color: '#999', marginTop: 2 },
  alertActionChip: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  alertActionText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },

  vintedRow: {
    flexDirection: 'row', marginHorizontal: 20, gap: 10, marginBottom: 16,
  },
  vintedBox: {
    flex: 1, backgroundColor: '#FFF', padding: 14, borderRadius: 18,
    alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#EEE',
  },
  vintedVal: { fontSize: 15, fontWeight: '900', color: '#1A1A2E' },
  vintedLab: { fontSize: 8, color: '#999', fontWeight: '700', textAlign: 'center' },

  quickRow: {
    flexDirection: 'row', marginHorizontal: 20, gap: 10, marginBottom: 10,
  },
  quickCard: {
    flex: 1, backgroundColor: '#FFF', borderRadius: 20,
    padding: 16, alignItems: 'center', gap: 6, elevation: 1,
  },
  quickIcon:  { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  quickLabel: { fontSize: 11, fontWeight: '800', color: '#1A1A2E' },
  quickSub:   { fontSize: 9, color: '#999' },
});