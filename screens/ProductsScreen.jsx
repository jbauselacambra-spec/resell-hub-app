/**
 * ProductsScreen.jsx — Sprint 11 + Feature: Eliminar + Ordenar
 *
 * [UI_SPECIALIST] Nuevas features:
 * - Eliminar producto: swipe-to-delete con confirmación Alert
 * - Ordenar inventario: por fecha de subida, tiempo en stock, precio
 *   Panel de ordenación desplegable con iconos de dirección asc/desc
 *
 * [QA_ENGINEER] Sin cambios en lógica de filtrado de categorías ni hooks.
 * Los 7 Campos Sagrados intactos. deleteProduct() de DatabaseService.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, Alert, ScrollView, Platform, Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { DatabaseService } from '../services/DatabaseService';
import LogService, { LOG_CTX } from '../services/LogService';

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                     'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// ─── Design System Light canónico ─────────────────────────────────────────────
const DS = {
  bg:       '#F8F9FA',
  white:    '#FFFFFF',
  surface2: '#F0F2F5',
  border:   '#EAEDF0',
  primary:  '#FF6B35',
  primaryBg:'#FFF2EE',
  success:  '#00D9A3',
  successBg:'#E8FBF6',
  warning:  '#FFB800',
  warningBg:'#FFF8E0',
  danger:   '#E63946',
  dangerBg: '#FFEBEC',
  blue:     '#004E89',
  blueBg:   '#EAF2FB',
  text:     '#1A1A2E',
  textMed:  '#5C6070',
  textLow:  '#A0A5B5',
  mono:     Platform.OS === 'android' ? 'monospace' : 'Courier New',
};

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
    if (filter === 'hot')           arr = arr.filter(p => p.isHot);
    else if (filter === 'stagnant') arr = arr.filter(p => p.isCold || p.isCritical);
    else if (filter === 'critical') arr = arr.filter(p => p.severity?.type === 'CRÍTICO');
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
          <Text style={styles.priceText}>{item.price}€</Text>
        </View>

        {/* Severity / hot badge */}
        <View style={styles.topRight}>
          {sev ? (
            <View style={[styles.sevBadge, { backgroundColor: sev.color }]}>
              <Text style={styles.sevText}>{sev.type}</Text>
            </View>
          ) : item.isHot ? (
            <View style={[styles.sevBadge, { backgroundColor: DS.danger }]}>
              <Icon name="zap" size={9} color="#FFF" />
              <Text style={styles.sevText}>HOT</Text>
            </View>
          ) : null}
        </View>

        {/* Botón eliminar en esquina superior izquierda del contenido */}
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => handleDelete(item)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <Icon name="trash-2" size={11} color={DS.danger} />
        </TouchableOpacity>

        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          {(item.category || item.brand) ? (
            <Text style={styles.cardCat} numberOfLines={1}>
              {item.category || ''}{item.subcategory ? ` › ${item.subcategory}` : ''}{item.brand ? ` · ${item.brand}` : ''}
            </Text>
          ) : null}

          {sev ? (
            <View style={[styles.diagBox, { backgroundColor: sev.color + '15' }]}>
              <Icon name={sev.icon} size={10} color={sev.color} />
              <Text style={[styles.diagText, { color: sev.color }]}>{sev.msg}</Text>
            </View>
          ) : (
            <Text style={[styles.daysText, item.isCold ? { color: '#4EA8DE' } : { color: '#999' }]}>
              🗓 {item.daysOld}d en stock {item.isCold ? '❄️' : ''}
            </Text>
          )}

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Icon name="eye"   size={11} color="#999" />
              <Text style={styles.statText}>{item.views || 0}</Text>
            </View>
            <View style={styles.statItem}>
              <Icon name="heart" size={11} color="#999" />
              <Text style={styles.statText}>{item.favorites || 0}</Text>
            </View>
          </View>

          {(item.isCold || item.isCritical) && (
            <TouchableOpacity
              style={[styles.republishBtn, item.isCritical && { backgroundColor: DS.danger }]}
              onPress={() => handleRepublish(item.id)}
            >
              <Icon name="refresh-cw" size={9} color="#FFF" />
              <Text style={styles.republishText}>REPUBLICAR</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {/* Título + botón ordenar */}
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerSub}>ESTRATEGIA DE STOCK</Text>
            <Text style={styles.headerTitle}>Mi Inventario</Text>
          </View>
          <TouchableOpacity
            style={[styles.sortToggleBtn, showSort && { backgroundColor: DS.primary }]}
            onPress={() => setShowSort(s => !s)}
            activeOpacity={0.7}
          >
            <Icon name="sliders" size={14} color={showSort ? '#FFF' : DS.textMed} />
            <Text style={[styles.sortToggleTxt, showSort && { color: '#FFF' }]}>
              {currentSort.label}
            </Text>
            <Icon
              name={showSort ? 'chevron-up' : 'chevron-down'}
              size={12}
              color={showSort ? '#FFF' : DS.textLow}
            />
          </TouchableOpacity>
        </View>

        {/* Panel de ordenación desplegable */}
        {showSort && (
          <View style={styles.sortPanel}>
            <Text style={styles.sortPanelTitle}>ORDENAR POR</Text>
            <View style={styles.sortGrid}>
              {SORT_OPTIONS.map(opt => {
                const active = sortId === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.sortChip, active && { backgroundColor: DS.primary, borderColor: DS.primary }]}
                    onPress={() => { setSortId(opt.id); setShowSort(false); }}
                    activeOpacity={0.7}
                  >
                    <Icon name={opt.icon} size={12} color={active ? '#FFF' : DS.textMed} />
                    <Text style={[styles.sortChipTxt, active && { color: '#FFF', fontWeight: '800' }]}>
                      {opt.label}
                    </Text>
                    <Icon
                      name={opt.dir === 'desc' ? 'arrow-down' : 'arrow-up'}
                      size={10}
                      color={active ? 'rgba(255,255,255,0.7)' : DS.textLow}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </View>

      {/* ── Chips Categoría + Subcategoría en 2 niveles ──────────────────────── */}
      {(() => {
        const cats = [...new Set(products.map(p => p.category).filter(Boolean))].sort();
        if (cats.length < 2) return null;

        const availSubs = filterCat
          ? [...new Set(
              products
                .filter(p => p.category === filterCat && p.subcategory)
                .map(p => p.subcategory)
            )].sort()
          : [];

        return (
          <View style={{ marginBottom: 4 }}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ paddingLeft: 20, marginBottom: 2 }}
              contentContainerStyle={{ gap: 6, paddingRight: 20 }}
            >
              <TouchableOpacity
                style={[styles.catChipOuter, !filterCat && { backgroundColor: DS.primary }]}
                onPress={() => { setFilterCat(null); setFilterSub(null); }}
              >
                <Text style={[styles.catChipOuterTxt, !filterCat && { color: '#FFF' }]}>
                  Todas
                </Text>
              </TouchableOpacity>
              {cats.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catChipOuter, filterCat === cat && { backgroundColor: DS.primary }]}
                  onPress={() => {
                    if (filterCat === cat) { setFilterCat(null); setFilterSub(null); }
                    else { setFilterCat(cat); setFilterSub(null); }
                  }}
                >
                  <Text style={[styles.catChipOuterTxt, filterCat === cat && { color: '#FFF' }]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {filterCat && availSubs.length >= 2 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ paddingLeft: 28, marginBottom: 2 }}
                contentContainerStyle={{ gap: 5, paddingRight: 20 }}
              >
                <TouchableOpacity
                  style={[styles.subChip, !filterSub && { backgroundColor: DS.blue }]}
                  onPress={() => setFilterSub(null)}
                >
                  <Text style={[styles.subChipTxt, !filterSub && { color: '#FFF' }]}>
                    Todas las subs
                  </Text>
                </TouchableOpacity>
                {availSubs.map(sub => (
                  <TouchableOpacity
                    key={sub}
                    style={[styles.subChip, filterSub === sub && { backgroundColor: DS.blue }]}
                    onPress={() => setFilterSub(filterSub === sub ? null : sub)}
                  >
                    <Text style={[styles.subChipTxt, filterSub === sub && { color: '#FFF' }]}>
                      › {sub}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        );
      })()}

      {/* Diagnosis chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
      >
        {counts.critical > 0 && (
          <TouchableOpacity style={[styles.chip, { borderColor: DS.danger }]} onPress={() => setFilter('critical')}>
            <Text style={styles.chipNum}>{counts.critical}</Text>
            <Text style={styles.chipLab}>Críticos</Text>
          </TouchableOpacity>
        )}
        {counts.invisible > 0 && (
          <TouchableOpacity style={[styles.chip, { borderColor: '#888' }]} onPress={() => setFilter('stagnant')}>
            <Text style={styles.chipNum}>{counts.invisible}</Text>
            <Text style={styles.chipLab}>Invisibles</Text>
          </TouchableOpacity>
        )}
        {counts.desinterest > 0 && (
          <TouchableOpacity style={[styles.chip, { borderColor: DS.primary }]} onPress={() => setFilter('stagnant')}>
            <Text style={styles.chipNum}>{counts.desinterest}</Text>
            <Text style={styles.chipLab}>Sin interés</Text>
          </TouchableOpacity>
        )}
        {counts.opportunity > 0 && (
          <TouchableOpacity style={[styles.chip, { borderColor: DS.success }]} onPress={() => setFilter('hot')}>
            <Text style={styles.chipNum}>{counts.opportunity}</Text>
            <Text style={styles.chipLab}>Casi listos</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Seasonal advice panel */}
      <View style={styles.advicePanel}>
        <View style={styles.adviceIcon}>
          <Icon name="trending-up" size={18} color={DS.primary} />
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
      </View>

      {/* Filter bar */}
      <View style={styles.filterBar}>
        {[
          { id: 'all',      label: 'Todos',         count: products.length },
          { id: 'stagnant', label: '❄️ Estancados',  count: counts.stagnant,   color: '#4EA8DE' },
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
          <Icon name={currentSort.icon} size={10} color={DS.primary} />
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
            <Icon name="inbox" size={40} color="#DDD" />
            <Text style={styles.emptyText}>No hay productos en esta vista.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: DS.bg },

  header:      { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12,
                 backgroundColor: DS.white, borderBottomWidth: 1, borderBottomColor: DS.border },
  headerTop:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  headerSub:   { fontSize: 9, fontWeight: '900', color: DS.primary, letterSpacing: 2 },
  headerTitle: { fontSize: 26, fontWeight: '900', color: DS.text },

  // Sort toggle
  sortToggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 5,
                   backgroundColor: DS.surface2, paddingHorizontal: 12, paddingVertical: 8,
                   borderRadius: 20, borderWidth: 1, borderColor: DS.border },
  sortToggleTxt: { fontSize: 11, fontWeight: '700', color: DS.textMed },

  // Sort panel
  sortPanel:      { marginTop: 12, backgroundColor: DS.bg, borderRadius: 14,
                    padding: 12, borderWidth: 1, borderColor: DS.border },
  sortPanelTitle: { fontSize: 9, fontWeight: '900', color: DS.textLow,
                    letterSpacing: 1.5, marginBottom: 8 },
  sortGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  sortChip:       { flexDirection: 'row', alignItems: 'center', gap: 5,
                    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20,
                    backgroundColor: DS.white, borderWidth: 1, borderColor: DS.border },
  sortChipTxt:    { fontSize: 11, fontWeight: '600', color: DS.textMed },

  chipScroll: { maxHeight: 72, marginBottom: 12 },
  chip: {
    backgroundColor: DS.white, borderWidth: 2, borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 8,
    alignItems: 'center', minWidth: 80,
  },
  chipNum: { fontSize: 16, fontWeight: '900', color: DS.text },
  chipLab: { fontSize: 8, fontWeight: '700', color: '#666' },

  advicePanel: {
    flexDirection: 'row', gap: 12, alignItems: 'center',
    backgroundColor: DS.white, marginHorizontal: 20, padding: 14,
    borderRadius: 16, marginBottom: 12,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
  },
  adviceIcon:  { width: 40, height: 40, borderRadius: 20, backgroundColor: DS.primaryBg,
                 justifyContent: 'center', alignItems: 'center' },
  adviceTitle: { fontSize: 11, fontWeight: '900', color: DS.text, marginBottom: 2 },
  adviceText:  { fontSize: 11, color: '#666', lineHeight: 16 },

  filterBar:  { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 6 },
  filterBtn:  { flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: DS.white,
                alignItems: 'center', borderWidth: 1, borderColor: DS.border },
  filterText: { fontSize: 11, fontWeight: '700', color: '#666' },

  // Contador
  resultsBar:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                     paddingHorizontal: 20, marginBottom: 8 },
  resultsCount:    { fontSize: 11, color: DS.textLow, fontWeight: '600' },
  activeSortBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  activeSortTxt:   { fontSize: 10, color: DS.primary, fontWeight: '700' },

  list: { paddingHorizontal: 16, paddingBottom: 120 },

  card: {
    flex: 1, margin: 4, backgroundColor: DS.white, borderRadius: 16, overflow: 'hidden',
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  cardImage:   { width: '100%', aspectRatio: 1, backgroundColor: '#F0F0F0' },
  priceBadge:  { position: 'absolute', top: 8, left: 8, backgroundColor: DS.primary,
                 paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  priceText:   { color: '#FFF', fontWeight: '900', fontSize: 12 },
  topRight:    { position: 'absolute', top: 8, right: 8 },
  sevBadge:    { flexDirection: 'row', alignItems: 'center', gap: 3,
                 paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10 },
  sevText:     { color: '#FFF', fontWeight: '900', fontSize: 8 },

  // Botón eliminar — esquina superior izquierda sobre la tarjeta (fuera de imagen)
  deleteBtn:   { position: 'absolute', bottom: 8, right: 8, zIndex: 10,
                 backgroundColor: DS.dangerBg, borderRadius: 8, padding: 5,
                 borderWidth: 1, borderColor: DS.danger + '40' },

  cardInfo:    { padding: 10, gap: 4, paddingBottom: 28 },
  cardTitle:   { fontSize: 12, fontWeight: '700', color: DS.text, lineHeight: 16 },
  cardCat:     { fontSize: 10, color: '#666', fontWeight: '500' },
  diagBox:     { flexDirection: 'row', alignItems: 'center', gap: 4,
                 paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  diagText:    { fontSize: 9, fontWeight: '700' },
  daysText:    { fontSize: 10, color: '#999' },
  statsRow:    { flexDirection: 'row', gap: 10 },
  statItem:    { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statText:    { fontSize: 10, color: '#999' },
  republishBtn:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                 gap: 4, backgroundColor: DS.primary, borderRadius: 8, paddingVertical: 5,
                 marginTop: 2 },
  republishText:{ color: '#FFF', fontSize: 9, fontWeight: '900' },
  empty:       { alignItems: 'center', paddingTop: 60 },
  emptyText:   { fontSize: 16, fontWeight: '700', color: '#999', marginTop: 12 },

  // Chips 2 niveles
  catChipOuter: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
                  backgroundColor: '#F0F0F0', marginVertical: 4 },
  catChipOuterTxt: { fontSize: 11, fontWeight: '700', color: '#666' },
  subChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 16,
             backgroundColor: DS.blueBg, marginVertical: 3,
             borderWidth: 1, borderColor: DS.blue + '30' },
  subChipTxt: { fontSize: 10, fontWeight: '700', color: DS.blue },
});
