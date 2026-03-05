import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Dimensions,
  TouchableOpacity, Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { DatabaseService } from '../services/DatabaseService';

const { width } = Dimensions.get('window');
const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

export default function AdvancedStatsScreen({ navigation }) {
  const [catStats,     setCatStats]     = useState([]);
  const [monthHistory, setMonthHistory] = useState([]);
  const [alerts,       setAlerts]       = useState([]);
  const [kpis,         setKpis]         = useState(null);
  const [config,       setConfig]       = useState(() => DatabaseService.getConfig()); // init síncrono
  const [activeTab,    setActiveTab]    = useState('tts');     // 'tts' | 'monthly' | 'alerts'
  const [selectedCat,  setSelectedCat]  = useState(null);
  const [expandedSub,  setExpandedSub]  = useState(null);     // 'CatName|SubName'

  const loadData = () => {
    const cfg = DatabaseService.getConfig();
    setConfig(cfg);
    setCatStats(DatabaseService.getCategoryStats());
    setMonthHistory(DatabaseService.getMonthlyHistory());
    setAlerts(DatabaseService.getSmartAlerts());
    setKpis(DatabaseService.getBusinessKPIs());
  };

  useEffect(() => {
    loadData();
    const unsub = navigation.addListener('focus', loadData);
    return unsub;
  }, [navigation]);

  if (!kpis) return null; // config nunca es null (init síncrono)

  // Thresholds from config (dynamic)
  const ttsLightning  = parseInt(config.ttsLightning  || 7);
  const ttsAnchor     = parseInt(config.ttsAnchor     || 30);
  const priceBoostPct = parseInt(config.priceBoostPct || 10);
  const priceCutPct   = parseInt(config.priceCutPct   || 10);
  const staleMultiplier = parseFloat(config.staleMultiplier || 1.5);

  // Max profit for chart scale
  const maxMonthlyProfit = Math.max(...monthHistory.map(m => Math.abs(m.profit)), 1);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      {/* ── HEADER ─────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.headerEyebrow}>ANÁLISIS ESTRATÉGICO</Text>
        <Text style={styles.headerTitle}>Speed Intelligence</Text>
      </View>

      {/* ── KPI STRIP ───────────────────────────── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.kpiStrip} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
        {[
          { label: 'TTS MEDIO',    value: kpis.avgTTS > 0 ? `${kpis.avgTTS}d` : '—', color: '#1A1A2E',  textColor: '#FFF' },
          { label: 'BENEFICIO',    value: `+${kpis.totalProfit.toFixed(0)}€`,          color: '#00D9A3',  textColor: '#FFF' },
          { label: 'VENDIDOS',     value: kpis.soldCount,                              color: '#FFF',     textColor: '#1A1A2E', border: '#EEE' },
          { label: 'EN STOCK',     value: kpis.activeCount,                            color: '#FFF',     textColor: '#1A1A2E', border: '#EEE' },
          { label: 'ESTE MES',     value: `${kpis.soldThisMonth} vendidos`,            color: '#FF6B35',  textColor: '#FFF' },
          kpis.topSubcategory
            ? { label: '⚡ TOP SUB', value: `${kpis.topSubcategory.name} ${kpis.topSubcategory.avgTTS}d`, color: '#004E89', textColor: '#FFF' }
            : null,
        ].filter(Boolean).map((k, i) => (
          <View key={i} style={[styles.kpiChip, { backgroundColor: k.color, borderWidth: k.border ? 1 : 0, borderColor: k.border }]}>
            <Text style={[styles.kpiChipLabel, { color: k.textColor === '#FFF' ? 'rgba(255,255,255,0.6)' : '#BBB' }]}>{k.label}</Text>
            <Text style={[styles.kpiChipValue, { color: k.textColor }]}>{k.value}</Text>
          </View>
        ))}
      </ScrollView>

      {/* ── TABS ────────────────────────────────── */}
      <View style={styles.tabBar}>
        {[
          { id: 'tts',     label: '⚡ Velocidad' },
          { id: 'monthly', label: '📈 Por Mes' },
          { id: 'alerts',  label: `🚨 Alertas (${alerts.length})` },
        ].map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ════════════════════════════════════════
          TAB: TTS POR CATEGORÍA
      ════════════════════════════════════════ */}
      {activeTab === 'tts' && (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Ranking Time-to-Sell por Categoría</Text>
          <Text style={styles.panelSub}>
            {`⚡ ≤${ttsLightning}d sube +${priceBoostPct}% · 🟡 ${ttsLightning+1}-${ttsAnchor}d mantén · ⚓ >${ttsAnchor}d baja -${priceCutPct}%`}
          </Text>

          {catStats.length === 0 && (
            <View style={styles.empty}>
              <Icon name="inbox" size={40} color="#DDD" />
              <Text style={styles.emptyText}>Sin datos de ventas todavía.</Text>
              <Text style={styles.emptySubText}>Marca productos como vendidos para ver el análisis TTS.</Text>
            </View>
          )}

          {catStats.map((cat, i) => {
            const barW = Math.min(100, Math.round((ttsAnchor / Math.max(cat.avgTTS, 1)) * 100));
            const expanded = selectedCat === cat.name;
            return (
              <TouchableOpacity
                key={cat.name}
                style={[styles.catCard, expanded && { borderColor: cat.color + '55', borderWidth: 1.5 }]}
                onPress={() => setSelectedCat(expanded ? null : cat.name)}
                activeOpacity={0.8}
              >
                {/* Rank + header */}
                <View style={styles.catHeaderRow}>
                  <Text style={styles.catRank}>#{i + 1}</Text>
                  <Text style={styles.catName}>{cat.name}</Text>
                  <View style={[styles.speedBadge, { backgroundColor: cat.color + '18', borderColor: cat.color + '44' }]}>
                    <Text style={[styles.speedBadgeText, { color: cat.color }]}>{cat.emoji} {cat.label}</Text>
                  </View>
                </View>

                {/* TTS Bar */}
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${barW}%`, backgroundColor: cat.color }]} />
                </View>

                {/* Stats row */}
                <View style={styles.catStatRow}>
                  <View style={styles.catStat}>
                    <Text style={styles.catStatVal}>{cat.avgTTS}d</Text>
                    <Text style={styles.catStatLab}>TTS Medio</Text>
                  </View>
                  <View style={styles.catStat}>
                    <Text style={styles.catStatVal}>{cat.count}</Text>
                    <Text style={styles.catStatLab}>Ventas</Text>
                  </View>
                  <View style={styles.catStat}>
                    <Text style={[styles.catStatVal, { color: cat.totalProfit >= 0 ? '#00D9A3' : '#E63946' }]}>
                      {cat.totalProfit >= 0 ? '+' : ''}{cat.totalProfit.toFixed(0)}€
                    </Text>
                    <Text style={styles.catStatLab}>Beneficio</Text>
                  </View>
                  <View style={styles.catStat}>
                    <Text style={[styles.catStatVal, { color: cat.avgProfit >= 0 ? '#00D9A3' : '#E63946' }]}>
                      {cat.avgProfit >= 0 ? '+' : ''}{cat.avgProfit}€
                    </Text>
                    <Text style={styles.catStatLab}>Beneficio/venta</Text>
                  </View>
                </View>

                {/* Expanded recommendation */}
                {expanded && (
                  <View style={[styles.recommendation, { borderLeftColor: cat.color }]}>
                    <Text style={[styles.recTitle, { color: cat.color }]}>💡 ESTRATEGIA RECOMENDADA</Text>
                    <Text style={styles.recText}>{cat.advice}.</Text>
                    {cat.avgTTS <= ttsLightning  && <Text style={styles.recDetail}>Esta categoría vuela. Busca más stock de {cat.name} y sube los precios un {priceBoostPct}%.</Text>}
                    {cat.avgTTS > ttsLightning && cat.avgTTS <= ttsAnchor && <Text style={styles.recDetail}>Rendimiento normal. Mejora el título y las fotos para acelerar.</Text>}
                    {cat.avgTTS > ttsAnchor && <Text style={styles.recDetail}>Producto lento. Baja el precio un {priceCutPct}% o republica. Si lleva más de {Math.round(ttsAnchor * staleMultiplier)}d considera hacer un lote.</Text>}
                  </View>
                )}

                {/* Subcategory breakdown — expandable */}
                {expanded && cat.subcategoryStats && cat.subcategoryStats.length > 0 && (
                  <View style={styles.subSection}>
                    <Text style={styles.subSectionTitle}>SUBCATEGORÍAS</Text>
                    {cat.subcategoryStats.map(sub => {
                      const subKey = `${cat.name}|${sub.name}`;
                      const subExpanded = expandedSub === subKey;
                      const subBarW = Math.min(100, Math.round((ttsAnchor / Math.max(sub.avgTTS, 1)) * 100));
                      return (
                        <TouchableOpacity
                          key={sub.name}
                          style={[styles.subCard, { borderLeftColor: sub.color + '88' }]}
                          onPress={() => setExpandedSub(subExpanded ? null : subKey)}
                          activeOpacity={0.8}
                        >
                          <View style={styles.subHeaderRow}>
                            <Icon name="corner-down-right" size={12} color={sub.color} />
                            <Text style={styles.subName}>{sub.name}</Text>
                            <View style={[styles.speedBadge, { backgroundColor: sub.color + '18', borderColor: sub.color + '44' }]}>
                              <Text style={[styles.speedBadgeText, { color: sub.color }]}>{sub.emoji} {sub.label}</Text>
                            </View>
                          </View>
                          <View style={styles.barTrack}>
                            <View style={[styles.barFill, { width: `${subBarW}%`, backgroundColor: sub.color + 'BB' }]} />
                          </View>
                          <View style={styles.catStatRow}>
                            <View style={styles.catStat}>
                              <Text style={styles.catStatVal}>{sub.avgTTS}d</Text>
                              <Text style={styles.catStatLab}>TTS</Text>
                            </View>
                            <View style={styles.catStat}>
                              <Text style={styles.catStatVal}>{sub.count}</Text>
                              <Text style={styles.catStatLab}>Ventas</Text>
                            </View>
                            <View style={styles.catStat}>
                              <Text style={[styles.catStatVal, { color: sub.avgProfit >= 0 ? '#00D9A3' : '#E63946' }]}>
                                {sub.avgProfit >= 0 ? '+' : ''}{sub.avgProfit}€
                              </Text>
                              <Text style={styles.catStatLab}>Benef/venta</Text>
                            </View>
                          </View>
                          {subExpanded && sub.tags && sub.tags.length > 0 && (
                            <View style={styles.tagsRow}>
                              {sub.tags.slice(0, 8).map(tag => (
                                <View key={tag} style={styles.tagChip}>
                                  <Text style={styles.tagChipTxt}>#{tag}</Text>
                                </View>
                              ))}
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* ════════════════════════════════════════
          TAB: HISTORIAL MENSUAL
      ════════════════════════════════════════ */}
      {activeTab === 'monthly' && (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Historial de Beneficios por Mes</Text>
          <Text style={styles.panelSub}>Beneficio = Precio venta – Precio publicación</Text>

          {monthHistory.length === 0 && (
            <View style={styles.empty}>
              <Icon name="calendar" size={40} color="#DDD" />
              <Text style={styles.emptyText}>Sin historial mensual todavía.</Text>
            </View>
          )}

          {/* Mini bar chart últimos 6 meses */}
          {monthHistory.length > 0 && (
            <View style={styles.chartWrap}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chartRow}>
                  {[...monthHistory].reverse().slice(0, 8).map((m, i) => {
                    const pct = Math.abs(m.profit) / maxMonthlyProfit;
                    const isCurrent = m.month === new Date().getMonth() && m.year === new Date().getFullYear();
                    return (
                      <View key={i} style={styles.chartCol}>
                        <Text style={styles.chartBarLabel}>
                          {m.profit > 0 ? `+${m.profit.toFixed(0)}€` : `${m.profit.toFixed(0)}€`}
                        </Text>
                        <View style={styles.chartBarTrack}>
                          <View style={[
                            styles.chartBarFill,
                            { height: `${Math.max(pct * 100, 5)}%`, backgroundColor: isCurrent ? '#FF6B35' : (m.profit >= 0 ? '#00D9A3' : '#E63946') },
                          ]} />
                        </View>
                        <Text style={[styles.chartMonthLabel, isCurrent && { color: '#FF6B35' }]}>
                          {MONTH_NAMES[m.month]}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Table */}
          {monthHistory.map((m, i) => {
            const topCat = m.topCategory?.[0] || null;
            return (
              <View key={i} style={styles.monthRow}>
                <View style={styles.monthLeft}>
                  <Text style={styles.monthLabel}>{m.label}</Text>
                  <Text style={styles.monthSales}>{m.sales} ventas · {m.revenue.toFixed(0)}€ ingresos</Text>
                  {topCat && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                      <View style={{ backgroundColor: '#FF6B3515', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 9, fontWeight: '800', color: '#FF6B35' }}>
                          ⚡ {topCat.name} · +{topCat.profit >= 0 ? '' : ''}{topCat.profit.toFixed(0)}€ · {topCat.sales}u
                        </Text>
                      </View>
                      {topCat.topSub && (
                        <View style={{ backgroundColor: '#004E8912', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                          <Text style={{ fontSize: 9, fontWeight: '700', color: '#004E89' }}>
                            › {topCat.topSub.name} · {topCat.topSub.sales}u
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                  {m.bundles > 0 && (
                    <Text style={{ fontSize: 9, color: '#888', marginTop: 2 }}>📦 {m.bundles} lotes</Text>
                  )}
                </View>
                <Text style={[styles.monthProfit, { color: m.profit >= 0 ? '#00D9A3' : '#E63946' }]}>
                  {m.profit >= 0 ? '+' : ''}{m.profit.toFixed(2)}€
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* ════════════════════════════════════════
          TAB: ALERTAS
      ════════════════════════════════════════ */}
      {activeTab === 'alerts' && (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Alertas Inteligentes</Text>
          <Text style={styles.panelSub}>Basadas en TTS medio de tu historial y tu configuración</Text>

          {alerts.length === 0 && (
            <View style={styles.empty}>
              <Text style={{ fontSize: 40 }}>✅</Text>
              <Text style={styles.emptyText}>Inventario optimizado. Sin alertas.</Text>
            </View>
          )}

          {alerts.map((alert, i) => {
            const colorMap = { critical: '#E63946', stale: '#FF6B35', seasonal: '#FFB800', opportunity: '#00D9A3' };
            const c = colorMap[alert.type] || '#FF6B35';
            return (
              <TouchableOpacity
                key={i}
                style={[styles.alertCard, { borderLeftColor: c }]}
                onPress={() => navigation.navigate('Stock')}
              >
                <View style={styles.alertTop}>
                  <View style={[styles.alertIconWrap, { backgroundColor: c + '18' }]}>
                    <Icon name={alert.icon || 'alert-circle'} size={16} color={c} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.alertTitle} numberOfLines={1}>{alert.title}</Text>
                    <Text style={styles.alertMsg}>{alert.message}</Text>
                    {(alert.category || alert.subcategory) && (
                      <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                        {alert.category && (
                          <View style={[styles.alertCatChip, { backgroundColor: c + '15' }]}>
                            <Text style={[styles.alertCatChipTxt, { color: c }]}>{alert.category}</Text>
                          </View>
                        )}
                        {alert.subcategory && (
                          <View style={[styles.alertCatChip, { backgroundColor: '#004E8915' }]}>
                            <Text style={[styles.alertCatChipTxt, { color: '#004E89' }]}>{alert.subcategory}</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                  {alert.priority === 'high' && (
                    <View style={[styles.priorityBadge, { backgroundColor: c + '20' }]}>
                      <Text style={[styles.priorityText, { color: c }]}>URGENTE</Text>
                    </View>
                  )}
                </View>
                <View style={styles.alertFooter}>
                  <Text style={[styles.alertAction, { color: c }]}>💡 {alert.action}</Text>
                  <Icon name="chevron-right" size={14} color="#DDD" />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <View style={{ height: 50 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#F8F9FA' },

  header: {
    paddingHorizontal: 25, paddingTop: 60, paddingBottom: 20,
    backgroundColor: '#FFF',
  },
  headerEyebrow: { fontSize: 9, fontWeight: '900', color: '#00D9A3', letterSpacing: 2 },
  headerTitle:   { fontSize: 26, fontWeight: '900', color: '#1A1A2E', marginTop: 2 },

  kpiStrip: { paddingVertical: 16 },
  kpiChip: {
    paddingHorizontal: 16, paddingVertical: 14, borderRadius: 18, minWidth: 110,
  },
  kpiChipLabel: { fontSize: 8, fontWeight: '900', letterSpacing: 1.5, marginBottom: 4 },
  kpiChipValue: { fontSize: 18, fontWeight: '900' },

  tabBar: {
    flexDirection: 'row', marginHorizontal: 20, marginBottom: 16,
    backgroundColor: '#F0F0F0', borderRadius: 14, padding: 3,
  },
  tab:           { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  tabActive:     { backgroundColor: '#FFF', elevation: 2 },
  tabText:       { fontSize: 10, fontWeight: '700', color: '#999' },
  tabTextActive: { color: '#1A1A2E', fontWeight: '900' },

  panel: {
    marginHorizontal: 20, backgroundColor: '#FFF',
    borderRadius: 24, padding: 20, marginBottom: 20, elevation: 2,
  },
  panelTitle: { fontSize: 15, fontWeight: '900', color: '#1A1A2E', marginBottom: 4 },
  panelSub:   { fontSize: 10, color: '#999', marginBottom: 18, lineHeight: 16 },

  empty:       { alignItems: 'center', padding: 30 },
  emptyText:   { fontSize: 14, fontWeight: '700', color: '#CCC', marginTop: 12 },
  emptySubText:{ fontSize: 11, color: '#DDD', marginTop: 6, textAlign: 'center' },

  catCard: {
    backgroundColor: '#F8F9FA', borderRadius: 18,
    padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'transparent',
  },
  catHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  catRank:      { fontSize: 10, fontWeight: '900', color: '#DDD', width: 20 },
  catName:      { fontSize: 15, fontWeight: '800', color: '#1A1A2E', flex: 1 },
  speedBadge:   { borderWidth: 1, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  speedBadgeText: { fontSize: 9, fontWeight: '900' },
  barTrack:     { height: 5, backgroundColor: '#E8E8E8', borderRadius: 3, marginBottom: 14, overflow: 'hidden' },
  barFill:      { height: '100%', borderRadius: 3 },
  catStatRow:   { flexDirection: 'row', justifyContent: 'space-between' },
  catStat:      { alignItems: 'center' },
  catStatVal:   { fontSize: 14, fontWeight: '900', color: '#1A1A2E' },
  catStatLab:   { fontSize: 8, color: '#999', marginTop: 2 },

  recommendation: {
    marginTop: 14, padding: 12, backgroundColor: '#FFF',
    borderRadius: 12, borderLeftWidth: 3,
  },
  recTitle:  { fontSize: 9, fontWeight: '900', letterSpacing: 1, marginBottom: 6 },
  recText:   { fontSize: 12, fontWeight: '700', color: '#1A1A2E', marginBottom: 4 },
  recDetail: { fontSize: 11, color: '#666', lineHeight: 16 },

  chartWrap: { marginBottom: 20, height: 140 },
  chartRow:  { flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 8, paddingHorizontal: 4 },
  chartCol:  { alignItems: 'center', width: 56 },
  chartBarLabel: { fontSize: 8, color: '#999', marginBottom: 4, textAlign: 'center' },
  chartBarTrack: { width: 28, height: 80, backgroundColor: '#F0F0F0', borderRadius: 6, overflow: 'hidden', justifyContent: 'flex-end' },
  chartBarFill:  { width: '100%', borderRadius: 6 },
  chartMonthLabel: { fontSize: 10, color: '#BBB', marginTop: 4, fontWeight: '700' },

  monthRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  monthLeft:   { flex: 1 },
  monthLabel:  { fontSize: 14, fontWeight: '800', color: '#1A1A2E', textTransform: 'capitalize' },
  monthSales:  { fontSize: 10, color: '#999', marginTop: 2 },
  monthProfit: { fontSize: 16, fontWeight: '900' },

  alertCard: {
    backgroundColor: '#F8F9FA', borderLeftWidth: 4,
    borderRadius: 16, padding: 14, marginBottom: 12,
  },
  alertTop:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  alertIconWrap:{ width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  alertTitle:   { fontSize: 12, fontWeight: '800', color: '#1A1A2E' },
  alertMsg:     { fontSize: 11, color: '#666', marginTop: 2, lineHeight: 15 },
  priorityBadge:{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  priorityText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  alertFooter:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  alertAction:  { fontSize: 10, fontWeight: '900' },

  alertCatChip:    { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  alertCatChipTxt: { fontSize: 9, fontWeight: '800' },

  subSection:      { marginTop: 12, borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingTop: 10 },
  subSectionTitle: { fontSize: 8, fontWeight: '900', color: '#BBB', letterSpacing: 1.5, marginBottom: 8 },
  subCard: {
    backgroundColor: '#FFF', borderLeftWidth: 3,
    borderRadius: 12, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: '#F0F0F0',
  },
  subHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  subName:      { fontSize: 13, fontWeight: '700', color: '#1A1A2E', flex: 1 },

  tagsRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 8 },
  tagChip:     { backgroundColor: '#004E8915', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  tagChipTxt:  { fontSize: 9, color: '#004E89', fontWeight: '700' },
});