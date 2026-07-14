/**
 * ProductsScreen.jsx — Sprint 11 + Feature: Eliminar + Ordenar
 *
 * REFACTORIZADO para usar theme.js (ResellHub Design System v2)
 * - Eliminar producto: swipe-to-delete con confirmación Alert
 * - Ordenar inventario: por fecha de subida, tiempo en stock, precio
 *   Panel de ordenación desplegable con iconos de dirección asc/desc
 *
 * [FIX post-auditoría]
 * - useMemo `filtered`: la rama de ordenación por precio llamaba
 *   `b.parseFloat(a.price)` — `b` es un objeto producto, no tiene el
 *   método `.parseFloat`. Esto crasheaba la pantalla con
 *   `TypeError: b.parseFloat is not a function` en cuanto el usuario
 *   elegía "Mayor precio" o "Menor precio" en el panel de ordenación.
 *   Corregido a `parseFloat(b.price) || 0`.
 *   (El bug histórico de Hotfix 3 — dead code en este mismo useMemo,
 *   que rompía `filterCat` — ya estaba corregido; este es uno nuevo.)
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, Alert, ScrollView, Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { DatabaseService } from '../services/DatabaseService';
import LogService, { LOG_CTX } from '../services/LogService';

// ── Importar Design System ───────────────────────────────────────────────────
import {
  DS, SPACE, RADIUS, SHADOW, TXT, BTN, BTN_TEXT, CARD, BADGE, BADGE_TEXT,
  LAYOUT, MONTH_NAMES, ttsColor, ttsEmoji, fmtPrice, fmtDate,FONT_FAMILY
} from '../theme';

// ─── Opciones de ordenación ────────────────────────────────────────────────────
const SORT_OPTIONS = [
  { id: 'date_desc',   label: 'Más reciente',   icon: 'calendar',      field: 'firstUploadDate', dir: 'desc' },
  { id: 'date_asc',    label: 'Más antiguo',    icon: 'calendar',      field: 'firstUploadDate', dir: 'asc'  },
  { id: 'days_desc',   label: 'Más tiempo',     icon: 'clock',         field: 'daysOld',          dir: 'desc' },
  { id: 'days_asc',    label: 'Menos tiempo',   icon: 'clock',         field: 'daysOld',          dir: 'asc'  },
  { id: 'price_desc',  label: 'Mayor precio',   icon: 'trending-up',   field: 'price',            dir: 'desc' },
  { id: 'price_asc',   label: 'Menor precio',   icon: 'trending-down', field: 'price',            dir: 'asc'  },
];

export default function ProductsScreen({ navigation }) {
  // ── HOOKS — antes de cualquier early return (Regla 12) ─────────────────────
  const [products,    setProducts]    = useState([]);
  const [filter,      setFilter]      = useState('all');
  const [filterCat,   setFilterCat]   = useState(null);
  const [filterSub,   setFilterSub]   = useState(null);
  const [sortId,      setSortId]      = useState('date_desc');
  const [showSort,    setShowSort]    = useState(false);
  const [config,      setConfig]      = useState(() => DatabaseService.getConfig());

  const loadData = () => {
    try {
      const enriched = DatabaseService.getActiveProductsWithDiagnostic();
      setProducts(enriched);
      setConfig(DatabaseService.getConfig());
      LogService.debug(`ProductsScreen: ${enriched.length} productos cargados`, LOG_CTX.UI);
    } catch (e) {
      LogService.error('ProductsScreen.loadData', LOG_CTX.DB, e.message);
    }
  };

  useEffect(() => {
    loadData();
    const unsub = navigation.addListener('focus', loadData);
    return unsub;
  }, [navigation]);

  const currentMonth = new Date().getMonth();

  // Resumen de diagnósticos para chips superiores
  const counts = useMemo(() => ({
    critical:    products.filter(p => p.severity?.type === 'CRÍTICO').length,
    invisible:   products.filter(p => p.severity?.type === 'INVISIBLE').length,
    desinterest: products.filter(p => p.severity?.type === 'DESINTERÉS').length,
    opportunity: products.filter(p => p.severity?.type === 'CASI LISTO').length,
    stagnant:    products.filter(p => p.isCold || p.isCritical).length,
  }), [products]);

  // ── filtered + sorted ──────────────────────────────────────────────────────
const filtered = useMemo(() => {
  let arr = products;
  
  // Filtros de diagnóstico
  if (filter === 'critical')    arr = arr.filter(p => p.severity?.type === 'CRÍTICO');
  else if (filter === 'invisible')   arr = arr.filter(p => p.severity?.type === 'INVISIBLE');
  else if (filter === 'desinterest') arr = arr.filter(p => p.severity?.type === 'DESINTERÉS');
  else if (filter === 'opportunity') arr = arr.filter(p => p.severity?.type === 'CASI LISTO');
  else if (filter === 'hot') {
    // Hot incluye: productos marcados isHot O productos con severity CASI LISTO
    arr = arr.filter(p => p.isHot === true || p.severity?.type === 'CASI LISTO');
  }
  else if (filter === 'stagnant')    arr = arr.filter(p => p.isCold || p.isCritical);
  
  // Filtro de categoría
  if (filterCat) arr = arr.filter(p => p.category === filterCat);
  if (filterSub) arr = arr.filter(p => p.subcategory === filterSub);

  // Ordenación
  const opt = SORT_OPTIONS.find(o => o.id === sortId) || SORT_OPTIONS[0];
  return [...arr].sort((a, b) => {
    let vA, vB;
    if (opt.field === 'firstUploadDate') {
      vA = a.firstUploadDate ? new Date(a.firstUploadDate).getTime() : 0;
      vB = b.firstUploadDate ? new Date(b.firstUploadDate).getTime() : 0;
    } else if (opt.field === 'daysOld') {
      vA = a.daysOld || 0;
      vB = b.daysOld || 0;
    } else {
      // [FIX] Antes: `b.parseFloat(a.price)` — b no tiene método parseFloat,
      // y además el argumento apuntaba a `a.price` en vez de `b.price`.
      // Esto crasheaba la pantalla al elegir "Mayor precio" / "Menor precio".
      vA = parseFloat(a.price) || 0;
      vB = parseFloat(b.price) || 0;
    }
    return opt.dir === 'desc' ? vB - vA : vA - vB;
  });
}, [products, filter, filterCat, filterSub, sortId]);

  // ── Eliminar producto ──────────────────────────────────────────────────────
  const handleDelete = (item) => {
    Alert.alert(
      'Eliminar producto',
      `¿Seguro que quieres eliminar "${item.title}"?\n\nEsta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            DatabaseService.deleteProduct(item.id);
            LogService.add(`🗑️ Eliminado: ${item.title}`, 'info');
            loadData();
          },
        },
      ],
    );
  };

  const handleRepublish = (id) => {
    Alert.alert('Confirmar Resubida', '¿Has resubido este artículo? Se reseteará la antigüedad.', [
      { text: 'No', style: 'cancel' },
      { text: 'Sí', onPress: () => { DatabaseService.markAsRepublicated(id); loadData(); } },
    ]);
  };

  const currentSort = SORT_OPTIONS.find(o => o.id === sortId) || SORT_OPTIONS[0];

  const renderItem = ({ item }) => {
    const sev = item.severity;
    const borderColor = sev ? sev.color : (item.isHot ? DS.danger : 'transparent');

    return (
      <TouchableOpacity
        style={[styles.card, { borderColor, borderWidth: sev || item.isHot ? 2 : 0 }]}
        onPress={() => {
          LogService.info(`ProductsScreen → ProductDetail: ${item.title}`, LOG_CTX.NAV);
          navigation.navigate('ProductDetail', { product: item });
        }}
        activeOpacity={0.85}
      >
        <Image source={{ uri: item.images?.[0] }} style={styles.cardImage} />

        {/* Price badge */}
        <View style={styles.priceBadge}>
          <Text style={styles.priceText}>{fmtPrice(item.price)}</Text>
        </View>

        {/* Severity / hot badge */}
        <View style={styles.topRight}>
          {sev ? (
            <View style={[styles.sevBadge, { backgroundColor: sev.color }]}>
              <Text style={styles.sevText}>{sev.type}</Text>
            </View>
          ) : item.isHot ? (
            <View style={[styles.sevBadge, { backgroundColor: DS.danger }]}>
              <Text style={styles.sevText}>🔥 HOT</Text>
            </View>
          ) : null}
        </View>

        {/* Delete button */}
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => handleDelete(item)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="trash-2" size={14} color={DS.danger} />
        </TouchableOpacity>

        {/* Card info */}
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.cardCat} numberOfLines={1}>
            {item.category}{item.subcategory ? ` › ${item.subcategory}` : ''}
          </Text>

          {/* Diagnostic box */}
          {item.diagnostic && (
            <View style={[styles.diagBox, { backgroundColor: item.diagnostic.color + '15' }]}>
              <Text style={[styles.diagText, { color: item.diagnostic.color }]}>
                {item.diagnostic.emoji} {item.diagnostic.label}
              </Text>
            </View>
          )}

          {/* Days old */}
          {item.daysOld > 0 && (
            <Text style={styles.daysText}>📅 {item.daysOld} días</Text>
          )}

          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Icon name="eye" size={10} color={DS.text3} />
              <Text style={styles.statText}>{item.views || 0}</Text>
            </View>
            <View style={styles.statItem}>
              <Icon name="heart" size={10} color={DS.text3} />
              <Text style={styles.statText}>{item.likes || 0}</Text>
            </View>
          </View>

          {/* Republish button if needed */}
          {item.diagnostic?.isLowVisibility && (
            <TouchableOpacity
              style={styles.republishBtn}
              onPress={() => handleRepublish(item.id)}
            >
              <Icon name="refresh-cw" size={10} color="#FFF" />
              <Text style={styles.republishText}>RESUBIR</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const allCats = Array.from(new Set(products.map(p => p.category))).filter(Boolean);
  const allSubs = filterCat
    ? Array.from(new Set(products.filter(p => p.category === filterCat).map(p => p.subcategory))).filter(Boolean)
    : [];

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerSub}>INVENTARIO</Text>
            <Text style={styles.headerTitle}>Productos</Text>
          </View>
          {/* Sort toggle button */}
          <TouchableOpacity
            style={styles.sortToggleBtn}
            onPress={() => setShowSort(!showSort)}
          >
            <Icon name="sliders" size={14} color={DS.text2} />
            <Text style={styles.sortToggleTxt}>Ordenar</Text>
          </TouchableOpacity>
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
      </View>

{/* Diagnostic KPIs */}
<View style={styles.kpiPanel}>
  <TouchableOpacity 
    style={styles.kpiItem}
    onPress={() => setFilter('critical')}
    activeOpacity={0.7}
  >
    <Text style={[styles.kpiVal, { color: DS.danger }]}>{counts.critical}</Text>
    <Text style={styles.kpiLab}>Crítico</Text>
  </TouchableOpacity>
  
  <View style={styles.kpiDivider} />
  
  <TouchableOpacity 
    style={styles.kpiItem}
    onPress={() => setFilter('invisible')}
    activeOpacity={0.7}
  >
    <Text style={[styles.kpiVal, { color: DS.warning }]}>{counts.invisible}</Text>
    <Text style={styles.kpiLab}>Invisible</Text>
  </TouchableOpacity>
  
  <View style={styles.kpiDivider} />
  
  <TouchableOpacity 
    style={styles.kpiItem}
    onPress={() => setFilter('desinterest')}
    activeOpacity={0.7}
  >
    <Text style={[styles.kpiVal, { color: DS.blue }]}>{counts.desinterest}</Text>
    <Text style={styles.kpiLab}>Desinterés</Text>
  </TouchableOpacity>
  
  <View style={styles.kpiDivider} />
  
  <TouchableOpacity 
    style={styles.kpiItem}
    onPress={() => setFilter('opportunity')}
    activeOpacity={0.7}
  >
    <Text style={[styles.kpiVal, { color: DS.success }]}>{counts.opportunity}</Text>
    <Text style={styles.kpiLab}>Casi listo</Text>
  </TouchableOpacity>
</View>

      {/* Category filters */}
      {allCats.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: LAYOUT.screenPadH, gap: SPACE[2] }}
          style={{ maxHeight: 120, marginBottom: SPACE[3] }}
        >
          <TouchableOpacity
            style={[styles.catChipOuter, !filterCat && { backgroundColor: DS.brand, borderWidth: 1, borderColor: DS.brand }]}
            onPress={() => { setFilterCat(null); setFilterSub(null); }}
          >
            <Text style={[styles.catChipOuterTxt, !filterCat && { color: '#FFF' }]}>Todas</Text>
          </TouchableOpacity>
          {allCats.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[styles.catChipOuter, filterCat === cat && { backgroundColor: DS.brand, borderWidth: 1, borderColor: DS.brand }]}
              onPress={() => { setFilterCat(cat); setFilterSub(null); }}
            >
              <Text style={[styles.catChipOuterTxt, filterCat === cat && { color: '#FFF' }]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Subcategory filters */}
      {allSubs.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: LAYOUT.screenPadH, gap: SPACE[2], marginBottom: SPACE[3] }}
        >
          <TouchableOpacity
            style={[styles.subChip, !filterSub && { backgroundColor: DS.blueLight, borderColor: DS.blue }]}
            onPress={() => setFilterSub(null)}
          >
            <Text style={[styles.subChipTxt, !filterSub && { color: DS.blue }]}>Todas</Text>
          </TouchableOpacity>
          {allSubs.map(sub => (
            <TouchableOpacity
              key={sub}
              style={[styles.subChip, filterSub === sub && { backgroundColor: DS.blueLight, borderColor: DS.blue }]}
              onPress={() => setFilterSub(sub)}
            >
              <Text style={[styles.subChipTxt, filterSub === sub && { color: DS.blue }]}>{sub}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Seasonal advice panel */}
    {/*  <View style={styles.advicePanel}>
        <View style={styles.adviceIcon}>
          <Icon name="trending-up" size={18} color={DS.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.adviceTitle}>Estado del mes</Text>
          <Text style={styles.adviceText}>
            {(() => {
              const seasonalCats = Array.isArray(config?.seasonalMap?.[currentMonth])
                ? config.seasonalMap[currentMonth]
                : (config?.seasonalMap?.[currentMonth] ? [config.seasonalMap[currentMonth]] : []);
              const labels = seasonalCats.map(s => s.includes(' › ') ? s.split(' › ')[1] : s);
              const catsText = labels.length > 0
                ? `${MONTH_NAMES[currentMonth]}: temporada de ${labels.join(' y ')}.`
                : `${MONTH_NAMES[currentMonth]}: sin categorías estacionales configuradas.`;
              const stagnantText = counts.stagnant > 0
                ? ` Tienes ${counts.stagnant} artículos estancados.`
                : ' ¡Todo bajo control!';
              return catsText + stagnantText;
            })()}
          </Text>
        </View>
      </View> */}                              

      {/* Filter bar */}
      <View style={styles.filterBar}>
        {[
          { id: 'all',      label: 'Todos',         count: products.length },
          { id: 'stagnant', label: '❄️ Estancados',  count: counts.stagnant,   color: DS.blue },
          { id: 'hot',      label: '⚡ Hot',          count: counts.opportunity + products.filter(p => p.isHot).length, color: DS.danger },
        ].map(f => (
          <TouchableOpacity
            key={f.id}
            style={[styles.filterBtn, filter === f.id && { backgroundColor: f.color || DS.text }]}
            onPress={() => setFilter(f.id)}
          >
            <Text style={[styles.filterText, filter === f.id && { color: '#FFF' }]}>
              {f.label} {f.count > 0 ? `(${f.count})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Contador de resultados + orden activo */}
      <View style={styles.resultsBar}>
        <Text style={styles.resultsCount}>
          {filtered.length} producto{filtered.length !== 1 ? 's' : ''}
        </Text>
        <View style={styles.activeSortBadge}>
          <Icon name={currentSort.icon} size={10} color={DS.brand} />
          <Text style={styles.activeSortTxt}>{currentSort.label}</Text>
        </View>
      </View>

      <FlatList
        data={filtered}
        renderItem={renderItem}
        keyExtractor={item => String(item.id)}
        numColumns={2}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="inbox" size={40} color={DS.border} />
            <Text style={styles.emptyText}>No hay productos en esta vista.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DS.surface2 },

  // Header
  header: {
    paddingHorizontal: LAYOUT.screenPadH,
    paddingTop: LAYOUT.headerPadT,
    paddingBottom: SPACE[3],
    backgroundColor: DS.white,
    borderBottomWidth: 1,
    borderBottomColor: DS.border,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  headerSub: { ...TXT.label, color: DS.brand },
  headerTitle: { ...TXT.display },

  // Sort toggle
  sortToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE[1],
    backgroundColor: DS.surface3,
    paddingHorizontal: SPACE[3],
    paddingVertical: SPACE[2],
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: DS.borderMed,
  },
  sortToggleTxt: { ...TXT.caption, fontWeight: '700' },

  // Sort panel
  sortPanel: {
    marginTop: SPACE[3],
    backgroundColor: DS.surface2,
    borderRadius: RADIUS.md,
    padding: SPACE[3],
    borderWidth: 1,
    borderColor: DS.border,
  },
  sortPanelTitle: { ...TXT.label, marginBottom: SPACE[2] },
  sortGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE[2] },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE[1],
    paddingHorizontal: SPACE[2] + 2,
    paddingVertical: SPACE[2] - 2,
    borderRadius: RADIUS.full,
    backgroundColor: DS.white,
    borderWidth: 1,
    borderColor: DS.border,
  },
  sortChipTxt: { ...TXT.caption, fontWeight: '600' },

 // KPI Panel (mismo estilo que SoldHistoryScreen)
kpiPanel: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: DS.surface2,
  borderRadius: RADIUS.md,
  padding: SPACE[2] + 2,
  marginHorizontal: LAYOUT.screenPadH,
  marginBottom: SPACE[3],
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
  // Advice panel
  advicePanel: {
    flexDirection: 'row',
    gap: SPACE[3],
    alignItems: 'center',
    backgroundColor: DS.white,
    marginHorizontal: LAYOUT.screenPadH,
    padding: SPACE[3] + 2,
    borderRadius: RADIUS.lg,
    marginBottom: SPACE[3],
    ...SHADOW.md,
  },
  adviceIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    backgroundColor: DS.brandLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adviceTitle: { ...TXT.caption, fontWeight: '900', color: DS.text, marginBottom: 2 },
  adviceText: { ...TXT.caption, lineHeight: 16 },

  // Filter bar
  filterBar: {
    flexDirection: 'row',
    gap: SPACE[2],
    paddingHorizontal: LAYOUT.screenPadH,
    marginBottom: SPACE[2],
  },
  filterBtn: {
    flex: 1,
    paddingVertical: SPACE[2],
    borderRadius: RADIUS.sm,
    backgroundColor: DS.white,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: DS.border,
  },
  filterText: { ...TXT.caption, fontWeight: '700' },

  // Results bar
  resultsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: LAYOUT.screenPadH,
    marginBottom: SPACE[2],
  },
  resultsCount: { ...TXT.caption, fontWeight: '600' },
  activeSortBadge: { flexDirection: 'row', alignItems: 'center', gap: SPACE[1] },
  activeSortTxt: { ...TXT.label, fontSize: 10, color: DS.brand, fontWeight: '700' },

  // List
  list: { paddingHorizontal: LAYOUT.screenPadH, paddingBottom: 120 },

  // Card
  card: {
    flex: 1,
    margin: SPACE[1],
    ...CARD.default,
    padding: 0,
    overflow: 'hidden',
    borderRadius: RADIUS.lg,
    ...SHADOW.md,
  },
  cardImage: { width: '100%', aspectRatio: 1, backgroundColor: DS.surface3 },
  priceBadge: {
    position: 'absolute',
    top: SPACE[2],
    left: SPACE[2],
    backgroundColor: DS.brand,
    paddingHorizontal: SPACE[2],
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  priceText: { ...TXT.priceSm, color: '#FFF', fontSize: 12 },
  topRight: { position: 'absolute', top: SPACE[2], right: SPACE[2] },
  sevBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: SPACE[2] - 1,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  sevText: { ...TXT.label, color: '#FFF', fontSize: 8 },

  // Delete button
  deleteBtn: {
    position: 'absolute',
    bottom: SPACE[2],
    right: SPACE[2],
    zIndex: 10,
    backgroundColor: DS.dangerLight,
    borderRadius: RADIUS.sm,
    padding: SPACE[1] + 1,
    borderWidth: 1,
    borderColor: DS.danger + '40',
  },

  // Card info
  cardInfo: { padding: SPACE[2] + 2, gap: SPACE[1], paddingBottom: 28 },
  cardTitle: { ...TXT.title, fontSize: 12, lineHeight: 16 },
  cardCat: { ...TXT.caption, fontWeight: '500' },
  diagBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE[1],
    paddingHorizontal: SPACE[2] - 2,
    paddingVertical: 3,
    borderRadius: SPACE[2] - 2,
  },
  diagText: { fontSize: 9, fontWeight: '700' },
  daysText: { ...TXT.caption, fontSize: 10, color: DS.text3 },
  statsRow: { flexDirection: 'row', gap: SPACE[2] + 2 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statText: { ...TXT.caption, fontSize: 10 },
  republishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE[1],
    backgroundColor: DS.brand,
    borderRadius: RADIUS.sm,
    paddingVertical: SPACE[1] + 1,
    marginTop: 2,
  },
  republishText: { color: '#FFF', fontSize: 9, fontWeight: '900' },

  // Empty state
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { ...TXT.heading, color: DS.text3, marginTop: SPACE[3] },

  // Category chips
  catChipOuter: {
    paddingHorizontal: SPACE[3],
    paddingVertical: SPACE[1] + 1,
    borderRadius: RADIUS.full,
    backgroundColor: DS.surface3,
    marginVertical: SPACE[1],
  },
  catChipOuterTxt: { ...TXT.caption, fontWeight: '700' },
  subChip: {
    paddingHorizontal: SPACE[2] + 2,
    paddingVertical: SPACE[1],
    borderRadius: RADIUS.md,
    backgroundColor: DS.surface3,
    marginVertical: 3,
    borderWidth: 1,
    borderColor: DS.border,
  },
  subChipTxt: { ...TXT.caption, fontWeight: '700', color: DS.text2 },
});