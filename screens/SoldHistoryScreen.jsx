/**
 * SoldHistoryScreen.jsx — Historial de Ventas
 *
 * REFACTORIZADO para usar theme.js (ResellHub Design System v2)
 * - Eliminar producto vendido: confirmación Alert + deleteProduct()
 * - Ordenar vendidos: por fecha de venta, precio de venta, TTS
 *   Panel desplegable con opciones asc/desc
 *
 * [FIX post-auditoría — CRÍTICO]
 * El archivo reimplementaba el cálculo de TTS localmente en 3 sitios
 * (KPI "TTS Medio", ordenación por TTS, badge de cada tarjeta) con un
 * fallback a `soldDate`/`soldAt` (fechas legacy auto-extraídas por el
 * scraper). El Motor TTS documentado en SYSTEM_DESIGN.md (sección 10) es
 * explícito: `calcTTS()` SOLO cuenta productos con `soldDateReal`
 * confirmado manualmente por el usuario — es una decisión de negocio del
 * Sprint 1 v4.2 para no contaminar estadísticas con fechas no fiables.
 * Las 3 reimplementaciones locales rompían esa regla y contaminaban el
 * promedio "TTS Medio" con productos sin fecha de venta real confirmada.
 * Fix: se elimina `calcItemTTS()` local y se usa `calcTTS()` importado
 * de DatabaseService.js (fuente única de verdad, Regla 1).
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, ActivityIndicator, Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { DatabaseService, calcTTS } from '../services/DatabaseService';
import LogService from '../services/LogService';

// ── Importar Design System ───────────────────────────────────────────────────
import {
  DS, SPACE, RADIUS, SHADOW, TXT, BTN, BTN_TEXT, CARD,
  LAYOUT, FONT_SIZE, FONT_FAMILY,
  ttsColor, ttsEmoji, fmtPrice, fmtDate,
} from '../theme';

// ─── Opciones de ordenación ────────────────────────────────────────────────────
const SORT_OPTIONS = [
  { id: 'date_desc',  label: 'Más reciente',  icon: 'calendar',      field: 'soldDateReal', dir: 'desc' },
  { id: 'date_asc',   label: 'Más antiguo',   icon: 'calendar',      field: 'soldDateReal', dir: 'asc'  },
  { id: 'price_desc', label: 'Mayor precio',  icon: 'trending-up',   field: 'soldPrice',    dir: 'desc' },
  { id: 'price_asc',  label: 'Menor precio',  icon: 'trending-down', field: 'soldPrice',    dir: 'asc'  },
  { id: 'tts_asc',    label: 'Más rápido',    icon: 'zap',           field: 'tts',          dir: 'asc'  },
  { id: 'tts_desc',   label: 'Más lento',     icon: 'anchor',        field: 'tts',          dir: 'desc' },
];

export default function SoldHistoryScreen({ navigation }) {

  // ── HOOKS primero — antes de cualquier early return ──────────────────────────
  const [config,       setConfig]     = useState(() => DatabaseService.getConfig());
  const [soldProducts, setSold]       = useState([]);
  const [filterType,   setFilterType] = useState('date');
  const [filterCat,    setFilterCat]  = useState(null);
  const [filterSub,    setFilterSub]  = useState(null);
  const [sortId,       setSortId]     = useState('date_desc');
  const [showSort,     setShowSort]   = useState(false);
  const [loading,      setLoading]    = useState(true);

  const loadData = () => {
    try {
      setLoading(true);
      const all  = DatabaseService.getAllProducts();
      const sold = all.filter(p => p.status === 'sold');
      setSold(sold);
      setConfig(DatabaseService.getConfig());
    } catch (e) {
      LogService.add('❌ SoldHistoryScreen.loadData: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsub = navigation.addListener('focus', loadData);
    return unsub;
  }, [navigation]);

  const ttsLightning = parseInt(config?.ttsLightning || 7);
  const ttsAnchor    = parseInt(config?.ttsAnchor    || 30);

  // KPIs
  // [FIX] calcTTS() canónico — antes reimplementaba el cálculo con fallback
  // a soldDate/soldAt, contaminando el promedio con ventas sin soldDateReal.
  const kpis = useMemo(() => {
    if (!soldProducts.length) return { count: 0, recaudacion: 0, avgPrecio: 0, avgTTS: 0 };
    const count       = soldProducts.length;
    const recaudacion = soldProducts.reduce(
      (s, p) => s + Math.max(0, Number(p.soldPriceReal || p.soldPrice || p.price || 0)), 0,
    );
    const avgPrecio = count ? +(recaudacion / count).toFixed(0) : 0;
    const ttsList = soldProducts
      .map(p => calcTTS(p))
      .filter(v => v !== null);
    const avgTTS = ttsList.length
      ? Math.round(ttsList.reduce((a, b) => a + b, 0) / ttsList.length)
      : 0;
    return { count, recaudacion, avgPrecio, avgTTS };
  }, [soldProducts]);

  const allCats = useMemo(
    () => [...new Set(soldProducts.map(p => p.category).filter(Boolean))].sort(),
    [soldProducts],
  );

  const availSubs = useMemo(() => {
    if (!filterCat) return [];
    return [...new Set(
      soldProducts
        .filter(p => p.category === filterCat && p.subcategory)
        .map(p => p.subcategory)
    )].sort();
  }, [soldProducts, filterCat]);

  // Lista ordenada + filtrada
  // [FIX] calcTTS() canónico en vez de calcItemTTS() local con fallback legacy
  const sorted = useMemo(() => {
    let arr = filterCat
      ? soldProducts.filter(p => p.category === filterCat)
      : soldProducts;
    if (filterSub) arr = arr.filter(p => p.subcategory === filterSub);

    const opt = SORT_OPTIONS.find(o => o.id === sortId) || SORT_OPTIONS[0];
    return [...arr].sort((a, b) => {
      let vA, vB;
      if (opt.field === 'soldDateReal') {
        vA = new Date(a.soldDateReal || a.soldDate || a.soldAt || 0).getTime();
        vB = new Date(b.soldDateReal || b.soldDate || b.soldAt || 0).getTime();
      } else if (opt.field === 'soldPrice') {
        vA = Math.max(0, Number(a.soldPriceReal || a.soldPrice || a.price || 0));
        vB = Math.max(0, Number(b.soldPriceReal || b.soldPrice || b.price || 0));
      } else {
        // tts — [FIX] calcTTS() canónico, null → 9999 (va al final del orden)
        vA = calcTTS(a) ?? 9999;
        vB = calcTTS(b) ?? 9999;
      }
      return opt.dir === 'desc' ? vB - vA : vA - vB;
    });
  }, [soldProducts, filterCat, filterSub, sortId]);

  const avgTtsColor = kpis.avgTTS > 0 && kpis.avgTTS <= ttsLightning
    ? DS.success
    : kpis.avgTTS > 0 && kpis.avgTTS <= ttsAnchor ? DS.warning : DS.danger;

  const currentSort = SORT_OPTIONS.find(o => o.id === sortId) || SORT_OPTIONS[0];

  // ── Eliminar vendido ───────────────────────────────────────────────────────
  const handleDelete = (item) => {
    Alert.alert(
      'Eliminar registro de venta',
      `¿Seguro que quieres eliminar "${item.title}" del historial?\n\nEsta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            DatabaseService.deleteProduct(item.id);
            LogService.add(`🗑️ Vendido eliminado: ${item.title}`, 'info');
            loadData();
          },
        },
      ],
    );
  };

  // ── renderItem ─────────────────────────────────────────────────────────────
  const renderItem = ({ item: p }) => {
    const soldAmt = Math.max(0, Number(p.soldPriceReal || p.soldPrice || p.price || 0));
    const soldDateStr = (() => {
      const d = p.soldDateReal || p.soldDate || p.soldAt;
      if (!d) return '—';
      try {
        return new Date(d).toLocaleDateString('es-ES', {
          day: '2-digit', month: 'short', year: 'numeric',
        });
      } catch { return '—'; }
    })();

    // [FIX] calcTTS() canónico — antes calcItemTTS() local con fallback legacy
    const tts = calcTTS(p);
    const ttsCol = tts && tts > 0
      ? (tts <= ttsLightning ? DS.success : tts <= ttsAnchor ? DS.warning : DS.danger)
      : DS.text3;
    const ttsLbl = tts && tts > 0
      ? (tts <= ttsLightning ? '⚡' : tts <= ttsAnchor ? '🟡' : '⚓')
      : '';

    return (
      <View style={styles.card}>
        <TouchableOpacity
          style={{ flexDirection: 'row', flex: 1 }}
          onPress={() => navigation.navigate('ProductDetail', { product: p })}
          activeOpacity={0.7}
        >
          {p.images?.[0] ? (
            <Image source={{ uri: p.images[0] }} style={styles.thumbnail} />
          ) : (
            <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
              <Icon name="image" size={24} color={DS.border} />
            </View>
          )}

          <View style={styles.cardBody}>
            <Text style={styles.cardTitle} numberOfLines={2}>{p.title}</Text>
            {p.category && (
              <Text style={styles.cardMeta}>
                {p.category}{p.subcategory ? ` › ${p.subcategory}` : ''}
              </Text>
            )}
            <View style={styles.cardRow}>
              <Text style={styles.cardPrice}>{fmtPrice(soldAmt)}</Text>
              {tts !== null && (
                <View style={[styles.ttsChip, { backgroundColor: ttsCol + '15', borderColor: ttsCol + '40' }]}>
                  <Text style={[styles.ttsChipTxt, { color: ttsCol }]}>
                    {ttsLbl} {tts}d
                  </Text>
                </View>
              )}
              {p.isBundle && (
                <View style={styles.bundleChip}>
                  <Text style={styles.bundleChipTxt}>
                    📦 {p.bundleQty || 2}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.cardDate}>🗓️ {soldDateStr}</Text>
          </View>
        </TouchableOpacity>

        {/* Botón eliminar */}
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => handleDelete(p)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="trash-2" size={14} color={DS.danger} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Historial de ventas</Text>
          <View style={styles.headerRight}>
            {/* Sort toggle */}
            <TouchableOpacity
              style={styles.sortToggleBtn}
              onPress={() => setShowSort(!showSort)}
            >
              <Icon name="sliders" size={14} color={DS.text2} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Sort panel */}
        {showSort && (
          <View style={styles.sortPanel}>
            <Text style={styles.sortPanelTitle}>ORDENAR POR</Text>
            <View style={styles.sortGrid}>
              {SORT_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.id}
                  style={[
                    styles.sortChip,
                    sortId === opt.id && { backgroundColor: DS.brandLight, borderColor: DS.brand },
                  ]}
                  onPress={() => {
                    setSortId(opt.id);
                    setShowSort(false);
                  }}
                >
                  <Icon name={opt.icon} size={12} color={sortId === opt.id ? DS.brand : DS.text2} />
                  <Text style={[
                    styles.sortChipTxt,
                    sortId === opt.id && { color: DS.brand, fontWeight: '700' },
                  ]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* KPI Panel */}
        <View style={styles.kpiPanel}>
          <View style={styles.kpiItem}>
            <Text style={[styles.kpiVal, { color: DS.success }]}>{kpis.count}</Text>
            <Text style={styles.kpiLab}>Ventas</Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiItem}>
            <Text style={[styles.kpiVal, { color: DS.blue }]}>{kpis.recaudacion.toFixed(0)}€</Text>
            <Text style={styles.kpiLab}>Recaudado</Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiItem}>
            <Text style={[styles.kpiVal, { color: DS.text2 }]}>{kpis.avgPrecio}€</Text>
            <Text style={styles.kpiLab}>Precio medio</Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiItem}>
            <Text style={[styles.kpiVal, { color: avgTtsColor }]}>
              {kpis.avgTTS > 0 ? `${kpis.avgTTS}d` : '—'}
            </Text>
            <Text style={styles.kpiLab}>TTS Medio</Text>
          </View>
        </View>

        <Text style={styles.ttsLegend}>
          ⚡≤{ttsLightning}d · 🟡{ttsLightning + 1}–{ttsAnchor}d · ⚓&gt;{ttsAnchor}d (según Settings)
        </Text>
      </View>

      {/* ── Filtro Categoría + Subcategoría 2 niveles ─────────────────────── */}
      {allCats.length >= 2 && (
        <View style={{ marginBottom: SPACE[1] }}>
          <FlatList
            horizontal
            data={[null, ...allCats]}
            keyExtractor={item => item ?? '__all__'}
            showsHorizontalScrollIndicator={false}
            style={{ maxHeight: 44, paddingHorizontal: SPACE[3] }}
            contentContainerStyle={{ gap: SPACE[2] - 2, alignItems: 'center', paddingVertical: SPACE[2] - 2 }}
            renderItem={({ item: cat }) => (
              <TouchableOpacity
                style={[styles.catChip, filterCat === cat && { backgroundColor: DS.brand, borderColor: DS.brand }]}
                onPress={() => { setFilterCat(cat); setFilterSub(null); }}
              >
                <Text style={[styles.catChipTxt, filterCat === cat && { color: '#FFF', fontWeight: '700' }]}>
                  {cat ?? 'Todas'}
                </Text>
              </TouchableOpacity>
            )}
          />
          {filterCat && availSubs.length >= 2 && (
            <FlatList
              horizontal
              data={[null, ...availSubs]}
              keyExtractor={item => item ?? '__allsub__'}
              showsHorizontalScrollIndicator={false}
              style={{ maxHeight: 36, paddingLeft: SPACE[5], marginTop: SPACE[1] }}
              contentContainerStyle={{ gap: SPACE[1] + 1, alignItems: 'center', paddingVertical: SPACE[1] }}
              renderItem={({ item: sub }) => (
                <TouchableOpacity
                  style={[styles.subChip, filterSub === sub && { backgroundColor: DS.blue, borderColor: DS.blue }]}
                  onPress={() => setFilterSub(sub)}
                >
                  <Text style={[styles.subChipTxt, filterSub === sub && { color: '#FFF', fontWeight: '800' }]}>
                    {sub ? `› ${sub}` : 'Todas'}
                  </Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      )}

      {/* Contador + orden activo */}
      <View style={styles.resultsBar}>
        <Text style={styles.resultsCount}>
          {sorted.length} venta{sorted.length !== 1 ? 's' : ''}
        </Text>
        <View style={styles.activeSortBadge}>
          <Icon name={currentSort.icon} size={10} color={DS.brand} />
          <Text style={styles.activeSortTxt}>{currentSort.label}</Text>
        </View>
      </View>

      {/* LISTA */}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={DS.brand} size="large" />
      ) : (
        <FlatList
          data={sorted}
          renderItem={renderItem}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Icon name="shopping-bag" size={40} color={DS.border} />
              <Text style={styles.emptyText}>Sin ventas todavía.</Text>
              <Text style={styles.emptySub}>
                Marca productos como vendidos para ver tu historial.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DS.surface2 },

  // Header
  header: {
    backgroundColor: DS.white,
    paddingTop: LAYOUT.headerPadT,
    paddingHorizontal: LAYOUT.screenPadH,
    paddingBottom: SPACE[3],
    borderBottomWidth: 1,
    borderBottomColor: DS.border,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACE[3],
  },
  headerTitle: { ...TXT.heading, fontSize: 22 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: SPACE[2] },

  sortToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE[1],
    paddingHorizontal: SPACE[2] + 2,
    paddingVertical: SPACE[2] - 1,
    borderRadius: RADIUS.full,
    backgroundColor: DS.surface3,
    borderWidth: 1,
    borderColor: DS.border,
  },

  // Sort panel
  sortPanel: {
    backgroundColor: DS.surface2,
    borderRadius: RADIUS.md,
    padding: SPACE[3],
    marginBottom: SPACE[2] + 2,
    borderWidth: 1,
    borderColor: DS.border,
  },
  sortPanelTitle: { ...TXT.label, marginBottom: SPACE[2] },
  sortGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE[2] - 2 },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE[1],
    paddingHorizontal: SPACE[2] + 1,
    paddingVertical: SPACE[2] - 2,
    borderRadius: RADIUS.full,
    backgroundColor: DS.white,
    borderWidth: 1,
    borderColor: DS.border,
  },
  sortChipTxt: { ...TXT.caption, fontWeight: '600' },

  // KPI Panel
  kpiPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DS.surface2,
    borderRadius: RADIUS.md,
    padding: SPACE[2] + 2,
    marginBottom: SPACE[2],
  },
  kpiItem: { flex: 1, alignItems: 'center' },
  kpiVal: { fontSize: 18, fontWeight: '900', color: DS.text, fontFamily: FONT_FAMILY.mono },
  kpiLab: { ...TXT.label, fontSize: 9, marginTop: 1 },
  kpiDivider: {
    width: 1,
    height: 28,
    backgroundColor: DS.border,
    marginHorizontal: SPACE[1],
  },
  ttsLegend: {
    fontSize: 10,
    color: DS.text3,
    textAlign: 'center',
    marginTop: SPACE[1],
    marginBottom: SPACE[1],
  },

  // Category chips
  catChip: {
    paddingHorizontal: SPACE[3],
    paddingVertical: SPACE[1] + 1,
    borderRadius: RADIUS.full,
    backgroundColor: DS.white,
    borderWidth: 1,
    borderColor: DS.border,
  },
  catChipTxt: { fontSize: 12, fontWeight: '600', color: DS.text2 },
  subChip: {
    paddingHorizontal: SPACE[2] + 2,
    paddingVertical: 3,
    borderRadius: RADIUS.md,
    backgroundColor: DS.blueLight,
    borderWidth: 1,
    borderColor: DS.blue + '28',
  },
  subChipTxt: { fontSize: 10, fontWeight: '700', color: DS.blue },

  // Results bar
  resultsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: LAYOUT.screenPadH,
    paddingVertical: SPACE[2] - 2,
  },
  resultsCount: { ...TXT.caption, fontWeight: '600' },
  activeSortBadge: { flexDirection: 'row', alignItems: 'center', gap: SPACE[1] },
  activeSortTxt: { ...TXT.label, fontSize: 10, color: DS.brand, fontWeight: '700' },

  // List
  list: { padding: SPACE[3], gap: SPACE[2] },
  card: {
    flexDirection: 'row',
    backgroundColor: DS.white,
    borderRadius: RADIUS.md,
    padding: SPACE[2] + 2,
    alignItems: 'flex-start',
    ...SHADOW.sm,
  },

  // Thumbnail
  thumbnail: {
    width: 72,
    height: 72,
    borderRadius: RADIUS.sm,
    marginRight: SPACE[2] + 2,
    backgroundColor: DS.surface3,
  },
  thumbnailPlaceholder: { justifyContent: 'center', alignItems: 'center' },

  // Card body
  cardBody: { flex: 1, gap: 3 },
  cardTitle: { ...TXT.title, fontSize: 13, lineHeight: 17 },
  cardMeta: { fontSize: 10, color: DS.text2, fontWeight: '500' },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE[2] - 2,
    flexWrap: 'wrap',
    marginTop: SPACE[1],
  },
  cardPrice: { fontSize: 15, fontWeight: '900', color: DS.text, fontFamily: FONT_FAMILY.mono },
  cardDate: { fontSize: 10, color: DS.text3, marginTop: SPACE[1] },

  // Chips
  ttsChip: {
    paddingHorizontal: SPACE[2] - 1,
    paddingVertical: 2,
    borderRadius: RADIUS.sm - 2,
    borderWidth: 1,
  },
  ttsChipTxt: { fontSize: 11, fontWeight: '700' },
  bundleChip: {
    paddingHorizontal: SPACE[2] - 2,
    paddingVertical: 2,
    borderRadius: RADIUS.sm - 2,
    backgroundColor: DS.purpleLight,
  },
  bundleChipTxt: { fontSize: 10, fontWeight: '700', color: DS.purple },

  // Card actions
  cardActions: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: SPACE[1],
    gap: SPACE[3],
    alignSelf: 'stretch',
  },
  deleteBtn: {
    backgroundColor: DS.dangerLight,
    borderRadius: RADIUS.sm,
    padding: SPACE[2] - 2,
    borderWidth: 1,
    borderColor: DS.danger + '40',
  },

  // Empty state
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { ...TXT.heading, color: DS.text2, marginTop: SPACE[3] },
  emptySub: {
    ...TXT.caption,
    color: DS.text3,
    textAlign: 'center',
    marginTop: SPACE[1],
    paddingHorizontal: 40,
  },
});