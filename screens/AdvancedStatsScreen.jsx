/**
 * AdvancedStatsScreen.jsx — Sprint 9.1
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [QA_ENGINEER] BUG CRÍTICO CORREGIDO:
 *   ERROR: "Rendered more hooks than during the previous render"
 *   CAUSA: useMemo estaba declarado DESPUÉS de `if (!kpis) return null`
 *          → violación de React Rules of Hooks (hooks condicionales)
 *   FIX:   TODOS los hooks se declaran ANTES de cualquier return condicional.
 *          El early return se mueve al final de la zona de hooks.
 *
 * [DATA_SCIENTIST + PRODUCT_OWNER] REDISEÑO KPIs:
 *   ELIMINADO: "Beneficio" (soldPrice - price) → siempre ≤ 0 en segunda mano
 *   NUEVO:     "Recaudación" → ingresos reales por categoría/mes/año
 *              "Precio medio" → ayuda a calibrar el precio de publicación
 *              "Rotación" → % del catálogo liquidado (KPI de liquidez)
 *
 * [UI_SPECIALIST] Tabs: ⚡ Velocidad | 📈 Por Mes | 📅 Por Año | 🚨 Alertas
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Dimensions,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { DatabaseService } from '../services/DatabaseService';

const { width } = Dimensions.get('window');
const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

// ─── Design System ────────────────────────────────────────────────────────────
const DS = {
  bg:        '#F8F9FA',
  white:     '#FFFFFF',
  surface2:  '#F0F2F5',
  border:    '#EAEDF0',
  primary:   '#FF6B35',
  success:   '#00D9A3',
  warning:   '#FFB800',
  danger:    '#E63946',
  blue:      '#004E89',
  text:      '#1A1A2E',
  textMed:   '#5C6070',
  textLow:   '#A0A5B5',
   purple:  '#6C63FF',
};

// ─── Helper: agrupar meses por año (client-side) ───────────────────────────────
function groupByYear(monthHistory) {
  const map = {};
  monthHistory.forEach(m => {
    const y = String(m.year);
    if (!map[y]) map[y] = { year: m.year, label: y, recaudacion: 0, sales: 0, bundles: 0, months: [], catTotals: {} };
    map[y].recaudacion += m.recaudacion || 0;
    map[y].sales       += m.sales       || 0;
    map[y].bundles     += m.bundles     || 0;
    map[y].months.push(m);
    Object.entries(m.categoryBreakdown || {}).forEach(([cat, d]) => {
      if (!map[y].catTotals[cat]) map[y].catTotals[cat] = { recaudacion: 0, sales: 0 };
      map[y].catTotals[cat].recaudacion += d.recaudacion || 0;
      map[y].catTotals[cat].sales       += d.sales       || 0;
    });
  });
  return Object.values(map).map(y => {
    const sortedMonths = [...y.months].sort((a, b) => b.recaudacion - a.recaudacion);
    const topCats = Object.entries(y.catTotals)
      .sort((a, b) => b[1].recaudacion - a[1].recaudacion)
      .map(([name, d]) => ({ name, recaudacion: +(d.recaudacion.toFixed(2)), sales: d.sales }));
    return {
      ...y,
      recaudacion:              +(y.recaudacion.toFixed(2)),
      avgMensualRecaudacion:    y.months.length ? +(y.recaudacion / y.months.length).toFixed(2) : 0,
      avgMonthlySales:          y.months.length ? +(y.sales / y.months.length).toFixed(1) : 0,
      monthCount:               y.months.length,
      bestMonth:                sortedMonths[0] || null,
      topCategory:              topCats[0]      || null,
      topCategories:            topCats,
    };
  }).sort((a, b) => b.year - a.year);
}

// ─── Pantalla ─────────────────────────────────────────────────────────────────
export default function AdvancedStatsScreen({ navigation }) {
  // ── [QA_ENGINEER] TODOS los hooks ANTES de cualquier return condicional ──
  const [catStats,     setCatStats]     = useState([]);
  const [monthHistory, setMonthHistory] = useState([]);
  const [alerts,       setAlerts]       = useState([]);
  const [kpis,         setKpis]         = useState(null);
  const [config,       setConfig]       = useState(() => DatabaseService.getConfig());
  const [activeTab,    setActiveTab]    = useState('tts');
  const [selectedCat,  setSelectedCat]  = useState(null);
  const [expandedSub,  setExpandedSub]  = useState(null);
  const [expandedYear, setExpandedYear] = useState(null);

  useEffect(() => {
    const load = () => {
      setConfig(DatabaseService.getConfig());
      setCatStats(DatabaseService.getCategoryStats());
      setMonthHistory(DatabaseService.getMonthlyHistory());
      setAlerts(DatabaseService.getSmartAlerts());
      setKpis(DatabaseService.getBusinessKPIs());
    };
    load();
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation]);

  // ── [QA_ENGINEER] useMemo ANTES del early return — Rules of Hooks ──
  const annualHistory    = useMemo(() => groupByYear(monthHistory), [monthHistory]);
  const maxAnnualRec     = useMemo(() => Math.max(...annualHistory.map(y => y.recaudacion), 1), [annualHistory]);
  const maxMonthlyRec    = useMemo(() => Math.max(...monthHistory.map(m => m.recaudacion), 1), [monthHistory]);
  const multiYear        = annualHistory.length > 1;

  // ── Early return DESPUÉS de todos los hooks ──
  if (!kpis) return null;

  const ttsLightning    = parseInt(config.ttsLightning  || 7);
  const ttsAnchor       = parseInt(config.ttsAnchor     || 30);
  const priceBoostPct   = parseInt(config.priceBoostPct || 10);
  const priceCutPct     = parseInt(config.priceCutPct   || 10);
  const staleMultiplier = parseFloat(config.staleMultiplier || 1.5);

  const tabs = [
    { id: 'tts',     label: '⚡ Velocidad' },
    { id: 'monthly', label: '📈 Por Mes'  },
    { id: 'annual',  label: '📅 Por Año'  },
    { id: 'alerts',  label: `🚨 Alertas (${alerts.length})` },
  ];

  return (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false}>

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <View style={s.header}>
        <Text style={s.headerEyebrow}>ANÁLISIS ESTRATÉGICO</Text>
        <Text style={s.headerTitle}>Speed Intelligence</Text>

          {/* Nuevo Botón */}
          <View style={s.headerBadge}>
                 <TouchableOpacity
                     style={setAlerts.importBtn}
                     onPress={() => navigation.navigate('Intelligence')}
                   >
                     <Icon name="cpu" size={14} color={DS.purple} />
                  <Text style={s.headerBadgeTxt}>Bussines Intelligence</Text>
                   </TouchableOpacity>
                </View>

       
         


          
      </View>

      {/* ── KPI STRIP ─────────────────────────────────────────────────────── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.kpiStrip}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
        {[
          { label: 'TTS MEDIO',    value: kpis.avgTTS > 0 ? `${kpis.avgTTS}d` : '—',            color: DS.surface2, textColor: DS.text, border: DS.border },
          { label: 'VENDIDOS',     value: kpis.soldCount,                                          color: DS.success,  textColor: '#FFF' },
          { label: 'RECAUDADO',    value: `${kpis.totalRecaudacion.toFixed(0)}€`,                  color: DS.blue,     textColor: '#FFF' },
          { label: 'ROTACIÓN',     value: `${kpis.rotacion}%`,                                     color: kpis.rotacion >= 50 ? DS.success : DS.warning, textColor: '#FFF' },
          { label: 'ESTE MES',     value: `${kpis.soldThisMonth} vtas`,                            color: DS.primary,  textColor: '#FFF' },
          kpis.topSubcategory
            ? { label: '⚡ TOP SUB', value: `${kpis.topSubcategory.name} ${kpis.topSubcategory.avgTTS}d`, color: DS.blue, textColor: '#FFF' }
            : null,
        ].filter(Boolean).map((k, i) => (
          <View key={i} style={[s.kpiChip, { backgroundColor: k.color, borderWidth: k.border ? 1 : 0, borderColor: k.border }]}>
            <Text style={[s.kpiChipLabel, { color: k.textColor === '#FFF' ? 'rgba(255,255,255,0.65)' : DS.textLow }]}>{k.label}</Text>
            <Text style={[s.kpiChipValue, { color: k.textColor }]}>{k.value}</Text>
          </View>
        ))}
      </ScrollView>

      {/* ── TABS ──────────────────────────────────────────────────────────── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabBarWrap}
        contentContainerStyle={s.tabBar}>
        {tabs.map(tab => (
          <TouchableOpacity key={tab.id} style={[s.tab, activeTab === tab.id && s.tabActive]}
            onPress={() => setActiveTab(tab.id)} activeOpacity={0.7}>
            <Text style={[s.tabText, activeTab === tab.id && s.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ════════════════════════════════════════════════════════════════════
          TAB: TTS POR CATEGORÍA
      ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'tts' && (
        <View style={s.panel}>
          <Text style={s.panelTitle}>Ranking Time-to-Sell por Categoría</Text>
          <Text style={s.panelSub}>
            {`⚡ ≤${ttsLightning}d sube +${priceBoostPct}% · 🟡 ${ttsLightning+1}–${ttsAnchor}d mantén · ⚓ >${ttsAnchor}d baja -${priceCutPct}%`}
          </Text>

          {catStats.length === 0 && (
            <View style={s.empty}>
              <Icon name="inbox" size={40} color="#DDD" />
              <Text style={s.emptyText}>Sin datos de ventas todavía.</Text>
              <Text style={s.emptySubText}>Marca productos como vendidos para ver el análisis TTS.</Text>
            </View>
          )}

          {catStats.map((cat, i) => {
            const barW    = Math.min(100, Math.round((ttsAnchor / Math.max(cat.avgTTS, 1)) * 100));
            const expanded = selectedCat === cat.name;
            return (
              <TouchableOpacity key={cat.name}
                style={[s.catCard, expanded && { borderColor: cat.color + '55', borderWidth: 1.5 }]}
                onPress={() => setSelectedCat(expanded ? null : cat.name)}
                activeOpacity={0.7}>
                <View style={s.catHeaderRow}>
                  <Text style={s.catRank}>#{i + 1}</Text>
                  <Text style={s.catName}>{cat.name}</Text>
                  <View style={[s.speedBadge, { backgroundColor: cat.color + '18', borderColor: cat.color + '44' }]}>
                    <Text style={[s.speedBadgeText, { color: cat.color }]}>{cat.emoji} {cat.label}</Text>
                  </View>
                </View>
                <View style={s.barTrack}>
                  <View style={[s.barFill, { width: `${barW}%`, backgroundColor: cat.color }]} />
                </View>
                <View style={s.catStatRow}>
                  <View style={s.catStat}>
                    <Text style={s.catStatVal}>{cat.avgTTS}d</Text>
                    <Text style={s.catStatLab}>TTS Medio</Text>
                  </View>
                  <View style={s.catStat}>
                    <Text style={s.catStatVal}>{cat.count}</Text>
                    <Text style={s.catStatLab}>Ventas</Text>
                  </View>
                  <View style={s.catStat}>
                    <Text style={[s.catStatVal, { color: DS.blue }]}>
                      {cat.totalRecaudacion.toFixed(0)}€
                    </Text>
                    <Text style={s.catStatLab}>Recaudado</Text>
                  </View>
                  <View style={s.catStat}>
                    <Text style={[s.catStatVal, { color: DS.textMed }]}>
                      {cat.avgPrecio}€
                    </Text>
                    <Text style={s.catStatLab}>Precio medio</Text>
                  </View>
                </View>

                {expanded && (
                  <View style={[s.recommendation, { borderLeftColor: cat.color }]}>
                    <Text style={[s.recTitle, { color: cat.color }]}>💡 ESTRATEGIA RECOMENDADA</Text>
                    <Text style={s.recText}>{cat.advice}.</Text>
                    {cat.avgTTS <= ttsLightning  && <Text style={s.recDetail}>Esta categoría vuela. Busca más stock y sube los precios un {priceBoostPct}%.</Text>}
                    {cat.avgTTS > ttsLightning && cat.avgTTS <= ttsAnchor && <Text style={s.recDetail}>Rendimiento normal. Mejora el título y las fotos para acelerar.</Text>}
                    {cat.avgTTS > ttsAnchor && <Text style={s.recDetail}>Producto lento. Baja el precio un {priceCutPct}% o republica. Si lleva más de {Math.round(ttsAnchor * staleMultiplier)}d considera un lote.</Text>}
                    <Text style={[s.recDetail, { color: DS.blue, marginTop: 4 }]}>
                      Precio medio de venta en esta categoría: {cat.avgPrecio}€
                    </Text>
                  </View>
                )}

                {expanded && cat.subcategoryStats?.length > 0 && (
                  <View style={s.subSection}>
                    <Text style={s.subSectionTitle}>SUBCATEGORÍAS</Text>
                    {cat.subcategoryStats.map(sub => {
                      const subKey      = `${cat.name}|${sub.name}`;
                      const subExpanded = expandedSub === subKey;
                      const subBarW     = Math.min(100, Math.round((ttsAnchor / Math.max(sub.avgTTS, 1)) * 100));
                      return (
                        <TouchableOpacity key={sub.name}
                          style={[s.subCard, { borderLeftColor: sub.color + '88' }]}
                          onPress={() => setExpandedSub(subExpanded ? null : subKey)}
                          activeOpacity={0.7}>
                          <View style={s.subHeaderRow}>
                            <Icon name="corner-down-right" size={12} color={sub.color} />
                            <Text style={s.subName}>{sub.name}</Text>
                            <View style={[s.speedBadge, { backgroundColor: sub.color + '18', borderColor: sub.color + '44' }]}>
                              <Text style={[s.speedBadgeText, { color: sub.color }]}>{sub.emoji} {sub.label}</Text>
                            </View>
                          </View>
                          <View style={s.barTrack}>
                            <View style={[s.barFill, { width: `${subBarW}%`, backgroundColor: sub.color + 'BB' }]} />
                          </View>
                          <View style={s.catStatRow}>
                            <View style={s.catStat}><Text style={s.catStatVal}>{sub.avgTTS}d</Text><Text style={s.catStatLab}>TTS</Text></View>
                            <View style={s.catStat}><Text style={s.catStatVal}>{sub.count}</Text><Text style={s.catStatLab}>Ventas</Text></View>
                            <View style={s.catStat}>
                              <Text style={[s.catStatVal, { color: DS.textMed }]}>{sub.avgPrecio}€</Text>
                              <Text style={s.catStatLab}>Precio medio</Text>
                            </View>
                          </View>
                          {subExpanded && sub.tags?.length > 0 && (
                            <View style={s.tagsRow}>
                              {sub.tags.slice(0, 8).map(tag => (
                                <View key={tag} style={s.tagChip}>
                                  <Text style={s.tagChipTxt}>#{tag}</Text>
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

      {/* ════════════════════════════════════════════════════════════════════
          TAB: HISTORIAL MENSUAL
      ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'monthly' && (
        <View style={s.panel}>
          <Text style={s.panelTitle}>Recaudación por Mes</Text>
          <Text style={s.panelSub}>Ingresos reales cobrados cada mes</Text>

          {monthHistory.length === 0 && (
            <View style={s.empty}>
              <Icon name="calendar" size={40} color="#DDD" />
              <Text style={s.emptyText}>Sin historial mensual todavía.</Text>
            </View>
          )}

          {monthHistory.length > 0 && (
            <View style={s.chartWrap}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={s.chartRow}>
                  {[...monthHistory].reverse().slice(0, 12).map((m, i) => {
                    const pct       = m.recaudacion / maxMonthlyRec;
                    const isCurrent = m.month === new Date().getMonth() && m.year === new Date().getFullYear();
                    return (
                      <View key={i} style={s.chartCol}>
                        <Text style={s.chartBarLabel}>{m.recaudacion.toFixed(0)}€</Text>
                        <View style={s.chartBarTrack}>
                          <View style={[
                            s.chartBarFill,
                            { height: `${Math.max(pct * 100, 5)}%`, backgroundColor: isCurrent ? DS.primary : DS.blue },
                          ]} />
                        </View>
                        <Text style={[s.chartMonthLabel, isCurrent && { color: DS.primary, fontWeight: '900' }]}>
                          {MONTH_NAMES[m.month]}{multiYear ? `\n${m.year}` : ''}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          )}

          {monthHistory.map((m, i) => {
            const topCat = m.topCategory?.[0] || null;
            return (
              <View key={i} style={s.monthRow}>
                <View style={s.monthLeft}>
                  <Text style={s.monthLabel}>{m.label}</Text>
                  <Text style={s.monthSales}>{m.sales} ventas</Text>
                  {topCat && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 3 }}>
                      <View style={s.topCatChip}>
                        <Text style={s.topCatTxt}>⚡ {topCat.name} · {topCat.recaudacion.toFixed(0)}€ · {topCat.sales}u</Text>
                      </View>
                      {topCat.topSub && (
                        <View style={s.topSubChip}>
                          <Text style={s.topSubTxt}>› {topCat.topSub.name} · {topCat.topSub.sales}u</Text>
                        </View>
                      )}
                    </View>
                  )}
                  {m.bundles > 0 && (
                    <Text style={{ fontSize: 9, color: DS.textLow, marginTop: 2 }}>📦 {m.bundles} lotes</Text>
                  )}
                </View>
                <Text style={[s.monthValue, { color: DS.blue }]}>
                  {m.recaudacion.toFixed(0)}€
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          TAB: HISTORIAL ANUAL
      ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'annual' && (
        <View style={s.panel}>
          <Text style={s.panelTitle}>Resumen Anual de Ventas</Text>
          <Text style={s.panelSub}>Recaudación acumulada por año</Text>

          {annualHistory.length === 0 && (
            <View style={s.empty}>
              <Icon name="calendar" size={40} color="#DDD" />
              <Text style={s.emptyText}>Sin datos anuales todavía.</Text>
              <Text style={s.emptySubText}>Marca productos como vendidos para ver el resumen anual.</Text>
            </View>
          )}

          {annualHistory.length > 0 && (
            <View style={s.annualChartWrap}>
              {annualHistory.slice(0, 5).map(y => {
                const pct        = y.recaudacion / maxAnnualRec;
                const isThisYear = y.year === new Date().getFullYear();
                const barColor   = isThisYear ? DS.primary : DS.blue;
                return (
                  <View key={y.year} style={s.annualBarRow}>
                    <Text style={[s.annualBarYearLabel, isThisYear && { color: DS.primary, fontWeight: '900' }]}>
                      {y.label}
                    </Text>
                    <View style={s.annualBarTrack}>
                      <View style={[s.annualBarFill, { width: `${Math.max(pct * 100, 3)}%`, backgroundColor: barColor }]} />
                    </View>
                    <Text style={[s.annualBarValue, { color: barColor }]}>
                      {y.recaudacion.toFixed(0)}€
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          {annualHistory.map(y => {
            const isExpanded = expandedYear === y.year;
            const isThisYear = y.year === new Date().getFullYear();
            return (
              <TouchableOpacity key={y.year}
                style={[s.yearCard, isThisYear && { borderColor: DS.primary + '44', borderWidth: 1.5 }]}
                onPress={() => setExpandedYear(isExpanded ? null : y.year)}
                activeOpacity={0.7}>
                <View style={s.yearHeader}>
                  <View style={s.yearBadge}>
                    <Text style={s.yearBadgeText}>{y.label}</Text>
                    {isThisYear && <View style={s.currentYearDot} />}
                  </View>
                  <View style={s.yearKpis}>
                    <View style={s.yearKpi}>
                      <Text style={[s.yearKpiVal, { color: DS.blue }]}>{y.recaudacion.toFixed(0)}€</Text>
                      <Text style={s.yearKpiLab}>Recaudado</Text>
                    </View>
                    <View style={s.yearKpi}>
                      <Text style={s.yearKpiVal}>{y.sales}</Text>
                      <Text style={s.yearKpiLab}>Ventas</Text>
                    </View>
                    <View style={s.yearKpi}>
                      <Text style={s.yearKpiVal}>{y.monthCount}</Text>
                      <Text style={s.yearKpiLab}>Meses</Text>
                    </View>
                  </View>
                  <Icon name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={DS.textLow} />
                </View>

                <View style={s.yearChips}>
                  <View style={[s.yearChip, { backgroundColor: DS.surface2 }]}>
                    <Text style={s.yearChipTxt}>📊 {y.avgMonthlySales} vtas/mes</Text>
                  </View>
                  <View style={[s.yearChip, { backgroundColor: DS.surface2 }]}>
                    <Text style={s.yearChipTxt}>💰 {y.avgMensualRecaudacion}€/mes</Text>
                  </View>
                  {y.topCategory && (
                    <View style={[s.yearChip, { backgroundColor: DS.primary + '15' }]}>
                      <Text style={[s.yearChipTxt, { color: DS.primary }]}>⚡ {y.topCategory.name}</Text>
                    </View>
                  )}
                  {y.bundles > 0 && (
                    <View style={[s.yearChip, { backgroundColor: DS.surface2 }]}>
                      <Text style={s.yearChipTxt}>📦 {y.bundles} lotes</Text>
                    </View>
                  )}
                </View>

                {isExpanded && (
                  <View style={s.yearExpanded}>
                    {y.topCategories?.length > 0 && (
                      <View style={s.yearSection}>
                        <Text style={s.yearSectionTitle}>TOP CATEGORÍAS {y.label}</Text>
                        {y.topCategories.slice(0, 5).map((cat, ci) => (
                          <View key={cat.name} style={s.yearCatRow}>
                            <Text style={s.yearCatRank}>#{ci + 1}</Text>
                            <Text style={s.yearCatName}>{cat.name}</Text>
                            <Text style={s.yearCatSales}>{cat.sales}u</Text>
                            <Text style={[s.yearCatValue, { color: DS.blue }]}>{cat.recaudacion.toFixed(0)}€</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {y.bestMonth && (
                      <View style={[s.bestMonthCard, { borderLeftColor: DS.success }]}>
                        <Text style={s.bestMonthLabel}>🏆 MEJOR MES</Text>
                        <Text style={s.bestMonthValue}>{y.bestMonth.label}</Text>
                        <Text style={s.bestMonthSub}>{y.bestMonth.recaudacion.toFixed(0)}€ · {y.bestMonth.sales} ventas</Text>
                      </View>
                    )}

                    <Text style={[s.yearSectionTitle, { marginTop: 12 }]}>DESGLOSE POR MES</Text>
                    {[...y.months].sort((a, b) => a.month - b.month).map(m => (
                      <View key={m.key} style={s.yearMonthRow}>
                        <Text style={s.yearMonthName}>{MONTH_NAMES[m.month]}</Text>
                        <Text style={s.yearMonthSales}>{m.sales}u</Text>
                        <Text style={[s.yearMonthValue, { color: DS.blue }]}>{m.recaudacion.toFixed(0)}€</Text>
                      </View>
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          TAB: ALERTAS
      ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'alerts' && (
        <View style={s.panel}>
          <Text style={s.panelTitle}>Alertas Inteligentes</Text>
          <Text style={s.panelSub}>Basadas en TTS, estacionalidad y tiempo en stock</Text>

          {alerts.length === 0 && (
            <View style={s.empty}>
              <Icon name="bell-off" size={40} color="#DDD" />
              <Text style={s.emptyText}>Sin alertas en este momento. ¡Todo en orden!</Text>
            </View>
          )}

          {alerts.map((alert, i) => {
            const bgColor = alert.color || DS.primary;
            return (
              <View key={i} style={[s.alertCard, { borderLeftColor: bgColor }]}>
                <View style={s.alertTop}>
                  <View style={[s.alertIconWrap, { backgroundColor: bgColor + '18' }]}>
                    <Text style={{ fontSize: 16 }}>{alert.icon || '⚠️'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.alertTitle}>{alert.title}</Text>
                    <Text style={s.alertMsg}>{alert.message}</Text>
                  </View>
                  {alert.priority && (
                    <View style={[s.priorityBadge, { backgroundColor: bgColor + '18' }]}>
                      <Text style={[s.priorityText, { color: bgColor }]}>{alert.priority.toUpperCase()}</Text>
                    </View>
                  )}
                </View>
                {(alert.category || alert.subcategory) && (
                  <View style={s.alertFooter}>
                    {alert.category && (
                      <View style={[s.alertCatChip, { backgroundColor: bgColor + '15' }]}>
                        <Text style={[s.alertCatChipTxt, { color: bgColor }]}>
                          {alert.category}{alert.subcategory ? ` › ${alert.subcategory}` : ''}
                        </Text>
                      </View>
                    )}
                    <Text style={[s.alertAction, { color: bgColor }]}>{alert.action || 'Ver producto →'}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: DS.bg },
  header:       { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12, backgroundColor: DS.white, borderBottomWidth: 1, borderBottomColor: DS.border },
  headerEyebrow:{ fontSize: 10, fontWeight: '900', color: DS.textLow, letterSpacing: 2, marginBottom: 2 },
  headerTitle:  { fontSize: 26, fontWeight: '900', color: DS.text },
  headerBadge:  { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: DS.purpleBg,
                  paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  headerBadgeTxt:{ fontSize: 11, fontWeight: '900', color: DS.purple },
  kpiStrip:     { maxHeight: 90 },
  kpiChip:      { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, minWidth: 100, justifyContent: 'center', alignItems: 'center' },
  kpiChipLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5, marginBottom: 3 },
  kpiChipValue: { fontSize: 15, fontWeight: '900' },

  tabBarWrap:   { backgroundColor: DS.white, borderBottomWidth: 1, borderBottomColor: DS.border },
  tabBar:       { paddingHorizontal: 16, paddingVertical: 8, gap: 8, flexDirection: 'row' },
  tab:          { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: DS.surface2 },
  tabActive:    { backgroundColor: DS.primary },
  tabText:      { fontSize: 12, fontWeight: '700', color: DS.textMed },
  tabTextActive:{ color: '#FFF' },

  panel:        { padding: 16 },
  panelTitle:   { fontSize: 17, fontWeight: '900', color: DS.text, marginBottom: 4 },
  panelSub:     { fontSize: 11, color: DS.textMed, marginBottom: 16, lineHeight: 15 },

  empty:        { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText:    { fontSize: 14, color: DS.textLow, fontWeight: '700' },
  emptySubText: { fontSize: 11, color: DS.textLow, textAlign: 'center' },

  catCard:      { backgroundColor: DS.white, borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'transparent', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  catHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  catRank:      { fontSize: 10, fontWeight: '900', color: '#DDD', width: 20 },
  catName:      { fontSize: 15, fontWeight: '800', color: DS.text, flex: 1 },
  speedBadge:   { borderWidth: 1, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  speedBadgeText: { fontSize: 9, fontWeight: '900' },
  barTrack:     { height: 5, backgroundColor: DS.border, borderRadius: 3, marginBottom: 14, overflow: 'hidden' },
  barFill:      { height: '100%', borderRadius: 3 },
  catStatRow:   { flexDirection: 'row', justifyContent: 'space-between' },
  catStat:      { alignItems: 'center' },
  catStatVal:   { fontSize: 14, fontWeight: '900', color: DS.text },
  catStatLab:   { fontSize: 8, color: DS.textLow, marginTop: 2 },

  recommendation: { marginTop: 14, padding: 12, backgroundColor: DS.surface2, borderRadius: 12, borderLeftWidth: 3 },
  recTitle:     { fontSize: 9, fontWeight: '900', letterSpacing: 1, marginBottom: 6 },
  recText:      { fontSize: 12, fontWeight: '700', color: DS.text, marginBottom: 4 },
  recDetail:    { fontSize: 11, color: DS.textMed, lineHeight: 16 },

  subSection:      { marginTop: 12, borderTopWidth: 1, borderTopColor: DS.border, paddingTop: 10 },
  subSectionTitle: { fontSize: 8, fontWeight: '900', color: '#BBB', letterSpacing: 1.5, marginBottom: 8 },
  subCard:      { backgroundColor: DS.white, borderLeftWidth: 3, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: DS.border },
  subHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  subName:      { fontSize: 13, fontWeight: '700', color: DS.text, flex: 1 },
  tagsRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 8 },
  tagChip:      { backgroundColor: DS.blue + '15', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  tagChipTxt:   { fontSize: 9, color: DS.blue, fontWeight: '700' },

  chartWrap:    { marginBottom: 20, height: 140 },
  chartRow:     { flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 8, paddingHorizontal: 4 },
  chartCol:     { alignItems: 'center', width: 56 },
  chartBarLabel:{ fontSize: 8, color: DS.textLow, marginBottom: 4, textAlign: 'center' },
  chartBarTrack:{ width: 28, height: 80, backgroundColor: DS.border, borderRadius: 6, overflow: 'hidden', justifyContent: 'flex-end' },
  chartBarFill: { width: '100%', borderRadius: 6 },
  chartMonthLabel: { fontSize: 9, color: '#BBB', marginTop: 4, fontWeight: '700', textAlign: 'center' },

  monthRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: DS.border },
  monthLeft:    { flex: 1, marginRight: 12 },
  monthLabel:   { fontSize: 14, fontWeight: '800', color: DS.text, textTransform: 'capitalize' },
  monthSales:   { fontSize: 10, color: DS.textLow, marginTop: 2 },
  monthValue:   { fontSize: 16, fontWeight: '900' },
  topCatChip:   { backgroundColor: DS.primary + '15', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  topCatTxt:    { fontSize: 9, fontWeight: '800', color: DS.primary },
  topSubChip:   { backgroundColor: DS.blue + '12', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  topSubTxt:    { fontSize: 9, fontWeight: '700', color: DS.blue },

  annualChartWrap: { backgroundColor: DS.white, borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  annualBarRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  annualBarYearLabel: { width: 36, fontSize: 12, fontWeight: '700', color: DS.textMed, textAlign: 'right' },
  annualBarTrack:  { flex: 1, height: 18, backgroundColor: DS.surface2, borderRadius: 9, overflow: 'hidden' },
  annualBarFill:   { height: '100%', borderRadius: 9, minWidth: 6 },
  annualBarValue:  { width: 58, fontSize: 11, fontWeight: '900', textAlign: 'right' },

  yearCard:     { backgroundColor: DS.white, borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: DS.border, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  yearHeader:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  yearBadge:    { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: DS.surface2, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  yearBadgeText:{ fontSize: 15, fontWeight: '900', color: DS.text },
  currentYearDot:{ width: 6, height: 6, borderRadius: 3, backgroundColor: DS.primary },
  yearKpis:     { flex: 1, flexDirection: 'row', gap: 4, justifyContent: 'flex-end' },
  yearKpi:      { alignItems: 'center', minWidth: 50 },
  yearKpiVal:   { fontSize: 13, fontWeight: '900', color: DS.text },
  yearKpiLab:   { fontSize: 7, color: DS.textLow, marginTop: 1, textTransform: 'uppercase' },
  yearChips:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  yearChip:     { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  yearChipTxt:  { fontSize: 10, fontWeight: '700', color: DS.textMed },
  yearExpanded: { borderTopWidth: 1, borderTopColor: DS.border, marginTop: 12, paddingTop: 12 },
  yearSection:  { marginBottom: 12 },
  yearSectionTitle: { fontSize: 8, fontWeight: '900', color: '#BBB', letterSpacing: 1.5, marginBottom: 8 },
  yearCatRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: DS.border },
  yearCatRank:  { fontSize: 10, fontWeight: '900', color: DS.textLow, width: 20 },
  yearCatName:  { flex: 1, fontSize: 13, fontWeight: '700', color: DS.text },
  yearCatSales: { fontSize: 11, color: DS.textLow, width: 30, textAlign: 'right' },
  yearCatValue: { fontSize: 13, fontWeight: '900', width: 55, textAlign: 'right' },
  bestMonthCard:{ backgroundColor: DS.surface2, borderRadius: 12, padding: 12, borderLeftWidth: 3, marginBottom: 8 },
  bestMonthLabel:{ fontSize: 8, fontWeight: '900', color: DS.success, letterSpacing: 1 },
  bestMonthValue:{ fontSize: 15, fontWeight: '900', color: DS.text, textTransform: 'capitalize', marginTop: 2 },
  bestMonthSub: { fontSize: 11, color: DS.textMed, marginTop: 2 },
  yearMonthRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: DS.border },
  yearMonthName:{ width: 36, fontSize: 11, fontWeight: '700', color: DS.textMed },
  yearMonthSales:{ flex: 1, fontSize: 10, color: DS.textLow },
  yearMonthValue:{ fontSize: 12, fontWeight: '900', width: 55, textAlign: 'right' },

  alertCard:    { backgroundColor: DS.surface2, borderLeftWidth: 4, borderRadius: 16, padding: 14, marginBottom: 12 },
  alertTop:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  alertIconWrap:{ width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  alertTitle:   { fontSize: 12, fontWeight: '800', color: DS.text },
  alertMsg:     { fontSize: 11, color: DS.textMed, marginTop: 2, lineHeight: 15 },
  priorityBadge:{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  priorityText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  alertFooter:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  alertAction:  { fontSize: 10, fontWeight: '900' },
  alertCatChip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  alertCatChipTxt: { fontSize: 9, fontWeight: '800' },
});