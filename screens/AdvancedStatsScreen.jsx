/**
 * AdvancedStatsScreen.jsx — Design System v2
 *
 * [UI_SPECIALIST] Rediseño completo con DS v2:
 * - Tabs: Velocidad | Por Mes | Por Año | Alertas
 * - KPI strip brand + neutros
 * - Cards de categoría con barra de progreso y stats limpias
 * - Historial mensual con barras verticales
 * - Alertas con iconos semánticos
 * Hooks antes de early returns (Regla 12).
 *
 * [FIX post-auditoría]
 * - Gráfico mensual: el orden .reverse().slice(0,12) era incorrecto.
 *   monthHistory viene DESCENDENTE (más reciente primero) desde
 *   DatabaseService.getMonthlyHistory(). Al invertir primero y luego
 *   cortar, se mostraban los 12 meses MÁS ANTIGUOS en vez de los más
 *   recientes cuando había >12 meses de historial (típico tras un
 *   import Modo E multi-año). Corregido a .slice(0,12).reverse().
 * - Limpieza: imports muertos `Platform` y `width` (sin uso real).
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { DatabaseService } from '../services/DatabaseService';
import {
  DS, RADIUS, SPACE, FONT_SIZE, FONT_FAMILY,
  TRACKING, LAYOUT, MONTH_NAMES_SHORT, fmtPrice,
} from '../theme';

const BAR_H = 80;

// ─── groupByYear helper ───────────────────────────────────────────────────────
function groupByYear(monthHistory) {
  const map = {};
  monthHistory.forEach(m => {
    const y = String(m.year);
    if (!map[y]) map[y] = {
      year: m.year, label: y,
      recaudacion: 0, sales: 0, bundles: 0,
      months: [], catTotals: {},
    };
    map[y].recaudacion += m.recaudacion || 0;
    map[y].sales       += m.sales       || 0;
    map[y].bundles      += m.bundles     || 0;
    map[y].months.push(m);
    Object.entries(m.categoryBreakdown || {}).forEach(([cat, d]) => {
      if (!map[y].catTotals[cat]) map[y].catTotals[cat] = { recaudacion: 0, sales: 0 };
      map[y].catTotals[cat].recaudacion += d.recaudacion || 0;
      map[y].catTotals[cat].sales       += d.sales       || 0;
    });
  });
  return Object.values(map).map(y => {
    const topCats = Object.entries(y.catTotals)
      .sort((a, b) => b[1].recaudacion - a[1].recaudacion)
      .map(([name, d]) => ({ name, recaudacion: +(d.recaudacion.toFixed(2)), sales: d.sales }));
    const sortedM = [...y.months].sort((a, b) => b.recaudacion - a.recaudacion);
    return {
      ...y,
      recaudacion:           +(y.recaudacion.toFixed(2)),
      avgMensualRecaudacion: y.months.length ? +(y.recaudacion / y.months.length).toFixed(2) : 0,
      avgMonthlySales:       y.months.length ? +(y.sales       / y.months.length).toFixed(1)  : 0,
      monthCount:            y.months.length,
      bestMonth:             sortedM[0] || null,
      topCategory:           topCats[0] || null,
      topCategories:         topCats,
    };
  }).sort((a, b) => b.year - a.year);
}

// ─── Componentes auxiliares ───────────────────────────────────────────────────

function KpiChip({ label, value, color }) {
  return (
    <View style={[s.kpiChip, color && { backgroundColor: color + '15' }]}>
      <Text style={s.kpiChipLabel}>{label}</Text>
      <Text style={[s.kpiChipValue, { color: color || DS.text }]}>{value}</Text>
    </View>
  );
}

function SpeedBadge({ avgTTS, config }) {
  const lightning = parseInt(config?.ttsLightning || 7);
  const anchor    = parseInt(config?.ttsAnchor    || 30);
  const color = avgTTS <= lightning ? DS.success : avgTTS <= anchor ? DS.warning : DS.danger;
  const label = avgTTS <= lightning ? '⚡ Rápido' : avgTTS <= anchor ? '🟡 Normal' : '⚓ Ancla';
  return (
    <View style={[s.speedBadge, { backgroundColor: color + '18' }]}>
      <Text style={[s.speedBadgeText, { color }]}>{label}</Text>
    </View>
  );
}

function CatCard({ cat, config, expanded, onToggle, expandedSub, onToggleSub }) {
  const anchor = parseInt(config?.ttsAnchor || 30);
  const pct    = Math.min(100, Math.round((anchor / Math.max(cat.avgTTS, 1)) * 100));
  const color  =
    cat.avgTTS <= parseInt(config?.ttsLightning || 7) ? DS.success :
    cat.avgTTS <= anchor ? DS.warning : DS.danger;

  return (
    <TouchableOpacity
      style={s.catCard}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      {/* Header de categoría */}
      <View style={s.catHeader}>
        <View style={s.catLeft}>
          <Text style={s.catName}>{cat.name}</Text>
          <SpeedBadge avgTTS={cat.avgTTS} config={config} />
        </View>
        <Icon
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={15}
          color={DS.text3}
        />
      </View>

      {/* Barra de progreso */}
      <View style={s.barTrack}>
        <View style={[s.barFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>

      {/* Stats */}
      <View style={s.catStats}>
        {[
          { val: `${cat.avgTTS}d`, lbl: 'TTS' },
          { val: cat.count,        lbl: 'Ventas' },
          { val: `${cat.totalRecaudacion.toFixed(0)}€`, lbl: 'Recaud.', color: DS.blue },
          { val: `${cat.avgPrecio}€`, lbl: 'P.medio' },
        ].map((st, i) => (
          <View key={i} style={s.catStat}>
            <Text style={[s.catStatVal, st.color && { color: st.color }]}>
              {st.val}
            </Text>
            <Text style={s.catStatLbl}>{st.lbl}</Text>
          </View>
        ))}
      </View>

      {/* Expandido: recomendación */}
      {expanded && (
        <View style={[s.recommendation, { borderLeftColor: color }]}>
          <Text style={[s.recTitle, { color }]}>ESTRATEGIA RECOMENDADA</Text>
          <Text style={s.recText}>{cat.advice}.</Text>
          {cat.tags?.length > 0 && (
            <View style={s.tagsRow}>
              {cat.tags.slice(0, 6).map(tag => (
                <View key={tag} style={s.tagChip}>
                  <Text style={s.tagChipText}>#{tag}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Subcategorías */}
          {cat.subcategoryStats?.length > 0 && (
            <View style={s.subSection}>
              <Text style={s.subSectionTitle}>SUBCATEGORÍAS</Text>
              {cat.subcategoryStats.map(sub => {
                const subKey = `${cat.name}|${sub.name}`;
                const isExpSub = expandedSub === subKey;
                const subColor =
                  sub.avgTTS <= parseInt(config?.ttsLightning || 7) ? DS.success :
                  sub.avgTTS <= parseInt(config?.ttsAnchor    || 30) ? DS.warning : DS.danger;
                return (
                  <TouchableOpacity
                    key={sub.name}
                    style={[s.subCard, { borderLeftColor: subColor + '88' }]}
                    onPress={() => onToggleSub?.(subKey)}
                    activeOpacity={0.7}
                  >
                    <View style={s.subHeader}>
                      <Icon name="corner-down-right" size={11} color={subColor} />
                      <Text style={s.subName}>{sub.name}</Text>
                      <View style={[s.speedBadge, { backgroundColor: subColor + '18' }]}>
                        <Text style={[s.speedBadgeText, { color: subColor }]}>
                          {sub.avgTTS}d
                        </Text>
                      </View>
                    </View>
                    <View style={s.catStats}>
                      <View style={s.catStat}><Text style={s.catStatVal}>{sub.avgTTS}d</Text><Text style={s.catStatLbl}>TTS</Text></View>
                      <View style={s.catStat}><Text style={s.catStatVal}>{sub.count}</Text><Text style={s.catStatLbl}>Ventas</Text></View>
                      <View style={s.catStat}><Text style={[s.catStatVal, { color: DS.text3 }]}>{sub.avgPrecio}€</Text><Text style={s.catStatLbl}>P.medio</Text></View>
                    </View>
                    {isExpSub && sub.tags?.length > 0 && (
                      <View style={s.tagsRow}>
                        {sub.tags.slice(0, 6).map(tag => (
                          <View key={tag} style={s.tagChip}>
                            <Text style={s.tagChipText}>#{tag}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────────────────
export default function AdvancedStatsScreen({ navigation }) {

  // ── HOOKS antes de cualquier return condicional ──────────────────────────
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

  const annualHistory = useMemo(() => groupByYear(monthHistory), [monthHistory]);
  const maxMonthlyRec = useMemo(
    () => Math.max(...monthHistory.map(m => m.recaudacion), 1),
    [monthHistory],
  );
  const maxAnnualRec = useMemo(
    () => Math.max(...annualHistory.map(y => y.recaudacion), 1),
    [annualHistory],
  );
  const multiYear = annualHistory.length > 1;

  // ── Early return después de hooks ───────────────────────────────────────
  if (!kpis) return null;

  const ttsLightning  = parseInt(config.ttsLightning  || 7);
  const ttsAnchor     = parseInt(config.ttsAnchor     || 30);
  const priceBoostPct = parseInt(config.priceBoostPct || 10);
  const priceCutPct   = parseInt(config.priceCutPct   || 10);

  const TABS = [
    { id: 'tts',     label: '⚡ Velocidad' },
    { id: 'monthly', label: '📈 Por Mes'   },
    { id: 'annual',  label: '📅 Por Año'   },
    { id: 'alerts',  label: `🚨 Alertas (${alerts.length})` },
  ];

  return (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false}>

      {/* ── HEADER ───────────────────────────────────────────────────────── */}
      <View style={s.header}>
        <View>
          <Text style={s.headerEyebrow}>ANÁLISIS ESTRATÉGICO</Text>
          <Text style={s.headerTitle}>Speed Intelligence</Text>
        </View>
        <TouchableOpacity
          style={s.intelligenceBtn}
          onPress={() => navigation.navigate('Intelligence')}
          activeOpacity={0.7}
        >
          <Icon name="cpu" size={15} color={DS.purple} />
          <Text style={s.intelligenceBtnText}>BI</Text>
        </TouchableOpacity>
      </View>

      {/* ── KPI CHIPS ────────────────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.kpiScroll}
        contentContainerStyle={s.kpiScrollContent}
      >
        <KpiChip label="TTS MEDIO" value={kpis.avgTTS > 0 ? `${kpis.avgTTS}d` : '—'} color={DS.text2} />
        <KpiChip label="VENDIDOS"  value={kpis.soldCount}    color={DS.success} />
        <KpiChip label="RECAUDADO" value={`${(kpis.totalRecaudacion ?? 0).toFixed(0)}€`} color={DS.blue} />
        <KpiChip label="ROTACIÓN"  value={`${kpis.rotacion}%`} color={kpis.rotacion >= 50 ? DS.success : DS.warning} />
        <KpiChip label="ESTE MES"  value={`${kpis.soldThisMonth} vtas`} color={DS.brand} />
        {kpis.topSubcategory && (
          <KpiChip
            label="TOP SUB"
            value={`${kpis.topSubcategory.name} ${kpis.topSubcategory.avgTTS}d`}
            color={DS.blue}
          />
        )}
      </ScrollView>

      {/* ── TABS ─────────────────────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.tabBarScroll}
        contentContainerStyle={s.tabBarContent}
      >
        {TABS.map(tab => (
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
      </ScrollView>

      <View style={s.panel}>

        {/* ══════════ TAB: VELOCIDAD ══════════ */}
        {activeTab === 'tts' && (
          <>
            <Text style={s.panelTitle}>Ranking TTS por Categoría</Text>
            <Text style={s.panelSub}>
              {`⚡ ≤${ttsLightning}d sube +${priceBoostPct}% · 🟡 ${ttsLightning + 1}–${ttsAnchor}d mantén · ⚓ >${ttsAnchor}d baja -${priceCutPct}%`}
            </Text>

            {catStats.length === 0 ? (
              <View style={s.empty}>
                <Icon name="inbox" size={36} color={DS.text3} />
                <Text style={s.emptyText}>Sin datos de ventas todavía</Text>
                <Text style={s.emptySub}>Marca productos como vendidos para ver el TTS</Text>
              </View>
            ) : (
              catStats.map((cat, i) => (
                <CatCard
                  key={cat.name}
                  cat={cat}
                  config={config}
                  expanded={selectedCat === cat.name}
                  onToggle={() => setSelectedCat(selectedCat === cat.name ? null : cat.name)}
                  expandedSub={expandedSub}
                  onToggleSub={(key) => setExpandedSub(expandedSub === key ? null : key)}
                />
              ))
            )}
          </>
        )}

        {/* ══════════ TAB: POR MES ══════════ */}
        {activeTab === 'monthly' && (
          <>
            <Text style={s.panelTitle}>Recaudación mensual</Text>
            <Text style={s.panelSub}>Ingresos reales cobrados cada mes</Text>

            {monthHistory.length === 0 ? (
              <View style={s.empty}>
                <Icon name="calendar" size={36} color={DS.text3} />
                <Text style={s.emptyText}>Sin historial mensual todavía</Text>
              </View>
            ) : (
              <>
                {/* Gráfico de barras horizontal scroll */}
                <View style={s.chartWrap}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={s.chartRow}>
                      {/* [FIX] Antes: .reverse().slice(0,12) cogía los 12 meses
                          MÁS ANTIGUOS (bug de orden). Ahora: slice(0,12) coge
                          los 12 más recientes (monthHistory viene desc) y
                          .reverse() los pone en orden cronológico para el eje X. */}
                      {[...monthHistory].slice(0, 12).reverse().map((m, i) => {
                        const pct     = m.recaudacion / maxMonthlyRec;
                        const barH    = Math.max(Math.round(pct * BAR_H), 4);
                        const isCurr  = m.month === new Date().getMonth() && m.year === new Date().getFullYear();
                        const barColor = isCurr ? DS.brand : DS.blue;
                        return (
                          <View key={i} style={s.chartCol}>
                            <Text style={[s.chartBarVal, { color: barColor }]}>
                              {m.recaudacion.toFixed(0)}€
                            </Text>
                            <View style={s.chartBarTrack}>
                              <View style={[s.chartBarFill, { height: barH, backgroundColor: barColor }]} />
                            </View>
                            <Text style={[s.chartBarLabel, isCurr && { color: DS.brand, fontWeight: '700' }]}>
                              {MONTH_NAMES_SHORT[m.month]}
                              {multiYear ? `\n${m.year}` : ''}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </ScrollView>
                </View>

                {/* Lista de meses */}
                {monthHistory.map((m, i) => {
                  const topCat = m.topCategory?.[0] || null;
                  return (
                    <View key={i} style={s.monthRow}>
                      <View style={s.monthLeft}>
                        <Text style={s.monthLabel}>{m.label}</Text>
                        <Text style={s.monthSales}>{m.sales} ventas</Text>
                        {topCat && (
                          <View style={s.topCatRow}>
                            <View style={s.topCatChip}>
                              <Text style={s.topCatText}>⚡ {topCat.name} · {topCat.recaudacion.toFixed(0)}€</Text>
                            </View>
                            {topCat.topSub && (
                              <View style={s.topSubChip}>
                                <Text style={s.topSubText}>› {topCat.topSub.name}</Text>
                              </View>
                            )}
                          </View>
                        )}
                      </View>
                      <Text style={s.monthValue}>{m.recaudacion.toFixed(0)}€</Text>
                    </View>
                  );
                })}
              </>
            )}
          </>
        )}

        {/* ══════════ TAB: POR AÑO ══════════ */}
        {activeTab === 'annual' && (
          <>
            <Text style={s.panelTitle}>Resumen anual de ventas</Text>
            <Text style={s.panelSub}>Recaudación acumulada por año</Text>

            {annualHistory.length === 0 ? (
              <View style={s.empty}>
                <Icon name="calendar" size={36} color={DS.text3} />
                <Text style={s.emptyText}>Sin datos anuales todavía</Text>
              </View>
            ) : (
              <>
                {/* Barras anuales */}
                <View style={s.annualChartWrap}>
                  {annualHistory.slice(0, 5).map(y => {
                    const pct      = y.recaudacion / maxAnnualRec;
                    const isThisYr = y.year === new Date().getFullYear();
                    const barColor = isThisYr ? DS.brand : DS.blue;
                    return (
                      <View key={y.year} style={s.annualBarRow}>
                        <Text style={[s.annualBarYear, isThisYr && { color: DS.brand, fontWeight: '700' }]}>
                          {y.label}
                        </Text>
                        <View style={s.annualBarTrack}>
                          <View style={[s.annualBarFill, { width: `${Math.max(pct * 100, 2)}%`, backgroundColor: barColor }]} />
                        </View>
                        <Text style={[s.annualBarVal, { color: barColor }]}>
                          {y.recaudacion.toFixed(0)}€
                        </Text>
                      </View>
                    );
                  })}
                </View>

                {/* Cards anuales */}
                {annualHistory.map(y => {
                  const isExp    = expandedYear === y.year;
                  const isThisYr = y.year === new Date().getFullYear();
                  return (
                    <TouchableOpacity
                      key={y.year}
                      style={[s.yearCard, isThisYr && s.yearCardAccent]}
                      onPress={() => setExpandedYear(isExp ? null : y.year)}
                      activeOpacity={0.7}
                    >
                      <View style={s.yearHeader}>
                        <View style={s.yearBadge}>
                          <Text style={s.yearBadgeText}>{y.label}</Text>
                          {isThisYr && <View style={s.yearDot} />}
                        </View>
                        <View style={s.yearKpis}>
                          <View style={s.yearKpi}>
                            <Text style={[s.yearKpiVal, { color: DS.blue }]}>{y.recaudacion.toFixed(0)}€</Text>
                            <Text style={s.yearKpiLbl}>Recaudado</Text>
                          </View>
                          <View style={s.yearKpi}>
                            <Text style={s.yearKpiVal}>{y.sales}</Text>
                            <Text style={s.yearKpiLbl}>Ventas</Text>
                          </View>
                          <View style={s.yearKpi}>
                            <Text style={s.yearKpiVal}>{y.monthCount}</Text>
                            <Text style={s.yearKpiLbl}>Meses</Text>
                          </View>
                        </View>
                        <Icon name={isExp ? 'chevron-up' : 'chevron-down'} size={15} color={DS.text3} />
                      </View>

                      {/* Chips resumen */}
                      <View style={s.yearChips}>
                        <View style={s.yearChip}>
                          <Text style={s.yearChipText}>{y.avgMonthlySales} vtas/mes</Text>
                        </View>
                        <View style={s.yearChip}>
                          <Text style={s.yearChipText}>{y.avgMensualRecaudacion}€/mes</Text>
                        </View>
                        {y.topCategory && (
                          <View style={[s.yearChip, { backgroundColor: DS.brandDim }]}>
                            <Text style={[s.yearChipText, { color: DS.brand }]}>
                              ⚡ {y.topCategory.name}
                            </Text>
                          </View>
                        )}
                      </View>

                      {isExp && (
                        <View style={s.yearExpanded}>
                          {y.topCategories?.length > 0 && (
                            <>
                              <Text style={s.yearSectionTitle}>TOP CATEGORÍAS {y.label}</Text>
                              {y.topCategories.slice(0, 5).map((cat, ci) => (
                                <View key={cat.name} style={s.yearCatRow}>
                                  <Text style={s.yearCatRank}>#{ci + 1}</Text>
                                  <Text style={s.yearCatName}>{cat.name}</Text>
                                  <Text style={s.yearCatSales}>{cat.sales}u</Text>
                                  <Text style={[s.yearCatValue, { color: DS.blue }]}>
                                    {cat.recaudacion.toFixed(0)}€
                                  </Text>
                                </View>
                              ))}
                            </>
                          )}
                          {y.bestMonth && (
                            <View style={s.bestMonthCard}>
                              <Text style={s.bestMonthLabel}>MEJOR MES</Text>
                              <Text style={s.bestMonthValue}>{y.bestMonth.label}</Text>
                              <Text style={s.bestMonthSub}>
                                {y.bestMonth.recaudacion.toFixed(0)}€ · {y.bestMonth.sales} ventas
                              </Text>
                            </View>
                          )}
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </>
            )}
          </>
        )}

        {/* ══════════ TAB: ALERTAS ══════════ */}
        {activeTab === 'alerts' && (
          <>
            <Text style={s.panelTitle}>Alertas inteligentes</Text>
            <Text style={s.panelSub}>Basadas en TTS, estacionalidad y tiempo en stock</Text>

            {alerts.length === 0 ? (
              <View style={s.empty}>
                <Icon name="bell-off" size={36} color={DS.text3} />
                <Text style={s.emptyText}>Sin alertas ahora mismo</Text>
                <Text style={s.emptySub}>Todo el inventario en buen estado</Text>
              </View>
            ) : (
              alerts.map((alert, i) => {
                const bgColor = alert.color || DS.brand;
                return (
                  <View key={i} style={[s.alertCard, { borderLeftColor: bgColor }]}>
                    <View style={[s.alertIconBox, { backgroundColor: bgColor + '18' }]}>
                      <Text style={{ fontSize: 15 }}>{alert.icon || '⚠️'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.alertTitle}>{alert.title}</Text>
                      <Text style={s.alertMsg}>{alert.message}</Text>
                      {(alert.category || alert.subcategory) && (
                        <View style={s.alertFooter}>
                          <View style={[s.alertCatChip, { backgroundColor: bgColor + '15' }]}>
                            <Text style={[s.alertCatText, { color: bgColor }]}>
                              {alert.category}{alert.subcategory ? ` › ${alert.subcategory}` : ''}
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>
                    {alert.priority === 'high' && (
                      <View style={[s.priorityDot, { backgroundColor: bgColor }]} />
                    )}
                  </View>
                );
              })
            )}
          </>
        )}

      </View>

      <View style={{ height: LAYOUT.tabBarH + SPACE[4] }} />
    </ScrollView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: DS.surface2 },

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
  headerEyebrow: {
    fontSize:      9,
    fontWeight:    '700',
    color:         DS.brand,
    letterSpacing: TRACKING.widest,
    textTransform: 'uppercase',
    marginBottom:  3,
  },
  headerTitle: {
    fontSize:      24,
    fontWeight:    '700',
    color:         DS.text,
    letterSpacing: -0.4,
  },
  intelligenceBtn: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              5,
    backgroundColor:  DS.purpleDim,
    paddingHorizontal: SPACE[3],
    paddingVertical:  SPACE[2],
    borderRadius:     RADIUS.full,
  },
  intelligenceBtnText: { fontSize: 12, fontWeight: '700', color: DS.purple },

  // KPI Scroll
  kpiScroll:        { backgroundColor: DS.surface, borderBottomWidth: 1, borderBottomColor: DS.border },
  kpiScrollContent: { paddingHorizontal: LAYOUT.screenPadH, paddingVertical: SPACE[3], gap: SPACE[2] },
  kpiChip: {
    paddingHorizontal: SPACE[3],
    paddingVertical:   SPACE[2],
    borderRadius:      RADIUS.md,
    backgroundColor:   DS.surface3,
    alignItems:        'center',
    minWidth:          80,
  },
  kpiChipLabel: { fontSize: 9, fontWeight: '700', color: DS.text3, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 3 },
  kpiChipValue: { fontSize: 15, fontWeight: '700', fontFamily: FONT_FAMILY.mono },

  // Tabs
  tabBarScroll:  { backgroundColor: DS.surface, borderBottomWidth: 1, borderBottomColor: DS.border },
  tabBarContent: { paddingHorizontal: LAYOUT.screenPadH, paddingVertical: SPACE[3], gap: SPACE[2] },
  tabBtn: {
    paddingHorizontal: SPACE[4],
    paddingVertical:   SPACE[2],
    borderRadius:      RADIUS.full,
    backgroundColor:   DS.surface3,
  },
  tabBtnActive:  { backgroundColor: DS.brand },
  tabLabel:      { fontSize: 12, fontWeight: '600', color: DS.text2 },
  tabLabelActive:{ color: '#fff' },

  panel: { padding: LAYOUT.screenPadH, paddingTop: SPACE[5] },
  panelTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: DS.text, letterSpacing: -0.3, marginBottom: SPACE[1] },
  panelSub:   { fontSize: FONT_SIZE.xs, color: DS.text3, marginBottom: SPACE[4], lineHeight: 15 },

  // Empty
  empty:     { alignItems: 'center', paddingVertical: SPACE[8], gap: SPACE[2] },
  emptyText: { fontSize: FONT_SIZE.base, fontWeight: '600', color: DS.text2 },
  emptySub:  { fontSize: FONT_SIZE.sm, color: DS.text3, textAlign: 'center' },

  // Cat card
  catCard: {
    backgroundColor: DS.surface,
    borderRadius:    RADIUS.lg,
    borderWidth:     1,
    borderColor:     DS.border,
    padding:         SPACE[4],
    marginBottom:    SPACE[2],
  },
  catHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   SPACE[3],
  },
  catLeft:     { flexDirection: 'row', alignItems: 'center', gap: SPACE[2], flex: 1 },
  catName:     { fontSize: FONT_SIZE.base, fontWeight: '600', color: DS.text },
  barTrack:    { height: 4, backgroundColor: DS.surface3, borderRadius: 2, marginBottom: SPACE[3], overflow: 'hidden' },
  barFill:     { height: '100%', borderRadius: 2 },
  catStats:    { flexDirection: 'row' },
  catStat:     { flex: 1, alignItems: 'center', borderRightWidth: 1, borderRightColor: DS.border },
  catStatVal:  { fontSize: 14, fontWeight: '700', color: DS.text, fontFamily: FONT_FAMILY.mono },
  catStatLbl:  { fontSize: 8, color: DS.text3, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 2 },

  speedBadge:     { paddingHorizontal: SPACE[2], paddingVertical: 2, borderRadius: RADIUS.full },
  speedBadgeText: { fontSize: 10, fontWeight: '700' },

  recommendation: {
    marginTop:      SPACE[4],
    padding:        SPACE[3],
    backgroundColor: DS.surface2,
    borderRadius:   RADIUS.md,
    borderLeftWidth: 3,
  },
  recTitle: { fontSize: 9, fontWeight: '700', letterSpacing: 0.8, marginBottom: SPACE[2] },
  recText:  { fontSize: 12, color: DS.text2, lineHeight: 17, marginBottom: SPACE[2] },
  tagsRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE[1], marginTop: SPACE[2] },
  tagChip:  { backgroundColor: DS.blueDim, paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  tagChipText: { fontSize: 10, color: DS.blue, fontWeight: '600' },

  subSection:      { marginTop: SPACE[3], borderTopWidth: 1, borderTopColor: DS.border, paddingTop: SPACE[3] },
  subSectionTitle: { fontSize: 8, fontWeight: '700', color: DS.text3, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: SPACE[2] },
  subCard: {
    backgroundColor: DS.surface,
    borderLeftWidth: 3,
    borderRadius:    RADIUS.md,
    borderWidth:     1,
    borderColor:     DS.border,
    padding:         SPACE[3],
    marginBottom:    SPACE[2],
  },
  subHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACE[2], marginBottom: SPACE[2] },
  subName:   { fontSize: 13, fontWeight: '600', color: DS.text, flex: 1 },

  // Chart mensual
  chartWrap:     { backgroundColor: DS.surface3, borderRadius: RADIUS.md, padding: SPACE[3], marginBottom: SPACE[4] },
  chartRow:      { flexDirection: 'row', alignItems: 'flex-end', gap: SPACE[3], height: BAR_H + 40 },
  chartCol:      { alignItems: 'center', width: 52 },
  chartBarVal:   { fontSize: 9, fontWeight: '700', fontFamily: FONT_FAMILY.mono, marginBottom: SPACE[1] },
  chartBarTrack: { width: 28, height: BAR_H, backgroundColor: DS.border, borderRadius: 5, justifyContent: 'flex-end', overflow: 'hidden' },
  chartBarFill:  { width: '100%', borderRadius: 5 },
  chartBarLabel: { fontSize: 9, color: DS.text3, marginTop: SPACE[1], fontWeight: '600', textAlign: 'center' },

  monthRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    paddingVertical: SPACE[3],
    borderBottomWidth: 1,
    borderBottomColor: DS.border,
  },
  monthLeft: { flex: 1, marginRight: SPACE[3] },
  monthLabel:{ fontSize: FONT_SIZE.base, fontWeight: '600', color: DS.text, textTransform: 'capitalize' },
  monthSales:{ fontSize: FONT_SIZE.xs, color: DS.text3, marginTop: 2, marginBottom: SPACE[1] },
  monthValue:{ fontSize: FONT_SIZE.lg, fontWeight: '700', color: DS.blue, fontFamily: FONT_FAMILY.mono },
  topCatRow: { flexDirection: 'row', gap: SPACE[1], flexWrap: 'wrap', marginTop: 3 },
  topCatChip:{ backgroundColor: DS.brandDim, paddingHorizontal: 7, paddingVertical: 2, borderRadius: RADIUS.full },
  topCatText:{ fontSize: 9, fontWeight: '700', color: DS.brand },
  topSubChip:{ backgroundColor: DS.blueDim, paddingHorizontal: 7, paddingVertical: 2, borderRadius: RADIUS.full },
  topSubText:{ fontSize: 9, fontWeight: '600', color: DS.blue },

  // Annual chart
  annualChartWrap: {
    backgroundColor: DS.surface,
    borderRadius:    RADIUS.lg,
    borderWidth:     1,
    borderColor:     DS.border,
    padding:         SPACE[4],
    marginBottom:    SPACE[4],
  },
  annualBarRow:  { flexDirection: 'row', alignItems: 'center', gap: SPACE[3], marginBottom: SPACE[3] },
  annualBarYear: { width: 38, fontSize: 12, fontWeight: '600', color: DS.text2, textAlign: 'right' },
  annualBarTrack:{ flex: 1, height: 14, backgroundColor: DS.surface3, borderRadius: 7, overflow: 'hidden' },
  annualBarFill: { height: '100%', borderRadius: 7, minWidth: 4 },
  annualBarVal:  { width: 52, fontSize: 12, fontWeight: '700', fontFamily: FONT_FAMILY.mono, textAlign: 'right' },

  yearCard: {
    backgroundColor: DS.surface,
    borderRadius:    RADIUS.lg,
    borderWidth:     1,
    borderColor:     DS.border,
    padding:         SPACE[4],
    marginBottom:    SPACE[2],
  },
  yearCardAccent: { borderColor: DS.brandMid },
  yearHeader:     { flexDirection: 'row', alignItems: 'center', gap: SPACE[3], marginBottom: SPACE[3] },
  yearBadge:      { flexDirection: 'row', alignItems: 'center', gap: SPACE[1], backgroundColor: DS.surface3, borderRadius: RADIUS.md, paddingHorizontal: SPACE[3], paddingVertical: SPACE[2] },
  yearBadgeText:  { fontSize: 16, fontWeight: '700', color: DS.text },
  yearDot:        { width: 6, height: 6, borderRadius: 3, backgroundColor: DS.brand },
  yearKpis:       { flex: 1, flexDirection: 'row', gap: SPACE[2], justifyContent: 'flex-end' },
  yearKpi:        { alignItems: 'center' },
  yearKpiVal:     { fontSize: 13, fontWeight: '700', color: DS.text, fontFamily: FONT_FAMILY.mono },
  yearKpiLbl:     { fontSize: 8, color: DS.text3, textTransform: 'uppercase', marginTop: 1 },
  yearChips:      { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE[1], marginBottom: SPACE[1] },
  yearChip:       { borderRadius: RADIUS.sm, paddingHorizontal: SPACE[2], paddingVertical: 3, backgroundColor: DS.surface3 },
  yearChipText:   { fontSize: 10, fontWeight: '600', color: DS.text2 },
  yearExpanded:   { borderTopWidth: 1, borderTopColor: DS.border, marginTop: SPACE[3], paddingTop: SPACE[3] },
  yearSectionTitle: { fontSize: 8, fontWeight: '700', color: DS.text3, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: SPACE[3] },
  yearCatRow:    { flexDirection: 'row', alignItems: 'center', gap: SPACE[2], paddingVertical: SPACE[2], borderBottomWidth: 1, borderBottomColor: DS.border },
  yearCatRank:   { fontSize: 10, fontWeight: '700', color: DS.text3, width: 20 },
  yearCatName:   { flex: 1, fontSize: 13, fontWeight: '600', color: DS.text },
  yearCatSales:  { fontSize: 11, color: DS.text3, width: 28, textAlign: 'right' },
  yearCatValue:  { fontSize: 13, fontWeight: '700', fontFamily: FONT_FAMILY.mono, width: 52, textAlign: 'right' },
  bestMonthCard: { backgroundColor: DS.successDim, borderRadius: RADIUS.md, padding: SPACE[3], marginTop: SPACE[3] },
  bestMonthLabel:{ fontSize: 8, fontWeight: '700', color: DS.success, letterSpacing: 1, textTransform: 'uppercase' },
  bestMonthValue:{ fontSize: 15, fontWeight: '700', color: DS.text, textTransform: 'capitalize', marginTop: 2 },
  bestMonthSub:  { fontSize: 11, color: DS.text2, marginTop: 2 },

  // Alert card
  alertCard: {
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
  alertIconBox:{ width: 32, height: 32, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  alertTitle:  { fontSize: 12, fontWeight: '700', color: DS.text, marginBottom: 3 },
  alertMsg:    { fontSize: 11, color: DS.text2, lineHeight: 16 },
  alertFooter: { marginTop: SPACE[2] },
  alertCatChip:{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.full, alignSelf: 'flex-start' },
  alertCatText:{ fontSize: 10, fontWeight: '700' },
  priorityDot: { width: 7, height: 7, borderRadius: 4, marginTop: 4, flexShrink: 0 },
});