/**
 * SoldHistoryScreen.jsx — Sprint 11 + Feature: Eliminar + Ordenar
 *
 * [UI_SPECIALIST] Nuevas features:
 * - Eliminar producto vendido: confirmación Alert + deleteProduct()
 * - Ordenar vendidos: por fecha de venta, precio de venta, TTS
 *   Panel desplegable con opciones asc/desc
 *
 * [QA_ENGINEER] Hooks antes de early returns (Regla 12).
 * Los 7 Campos Sagrados intactos — eliminar no los toca.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, ActivityIndicator, Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { DatabaseService } from '../services/DatabaseService';
import LogService from '../services/LogService';

// ─── Paleta canónica DS Light ─────────────────────────────────────────────────
const C = {
  bg:      '#F8F9FA',
  white:   '#FFFFFF',
  surface2:'#F0F2F5',
  primary: '#FF6B35',
  primaryBg:'#FFF2EE',
  blue:    '#004E89',
  blueBg:  '#EAF2FB',
  success: '#00D9A3',
  successBg:'#E8FBF6',
  warning: '#FFB800',
  danger:  '#E63946',
  dangerBg:'#FFEBEC',
  purple:  '#6C63FF',
  text:    '#1A1A2E',
  textMed: '#5C6070',
  textLow: '#A0A5B5',
  border:  '#EAEDF0',
};

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

  // ── HOOKS primero — antes de cualquier early return (Regla 12) ──────────────
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
  const kpis = useMemo(() => {
    if (!soldProducts.length) return { count: 0, recaudacion: 0, avgPrecio: 0, avgTTS: 0 };
    const count       = soldProducts.length;
    const recaudacion = soldProducts.reduce(
      (s, p) => s + Math.max(0, Number(p.soldPriceReal || p.soldPrice || p.price || 0)), 0,
    );
    const avgPrecio = count ? +(recaudacion / count).toFixed(0) : 0;
    const ttsList = soldProducts.map(p => {
      const s = p.firstUploadDate || p.createdAt;
      const e = p.soldDateReal    || p.soldDate || p.soldAt;
      if (!s || !e) return null;
      return Math.max(1, Math.round((new Date(e) - new Date(s)) / 86_400_000));
    }).filter(v => v !== null);
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

  // Calcular TTS para cada producto (helper)
  const calcItemTTS = (p) => {
    const s = p.firstUploadDate || p.createdAt;
    const e = p.soldDateReal    || p.soldDate || p.soldAt;
    if (!s || !e) return null;
    return Math.max(1, Math.round((new Date(e) - new Date(s)) / 86_400_000));
  };

  // Lista ordenada + filtrada
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
        // tts
        vA = calcItemTTS(a) ?? 9999;
        vB = calcItemTTS(b) ?? 9999;
      }
      return opt.dir === 'desc' ? vB - vA : vA - vB;
    });
  }, [soldProducts, filterCat, filterSub, sortId]);

  const avgTtsColor = kpis.avgTTS > 0 && kpis.avgTTS <= ttsLightning
    ? C.success
    : kpis.avgTTS > 0 && kpis.avgTTS <= ttsAnchor ? C.warning : C.danger;

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
      return new Date(d).toLocaleDateString('es-ES', {
        day: '2-digit', month: 'short', year: 'numeric',
      });
    })();
    const tts = calcItemTTS(p);
    const ttsColor = !tts ? '#999'
      : tts <= ttsLightning ? C.success
      : tts <= ttsAnchor    ? C.warning
      : C.danger;
    const ttsEmoji = !tts ? '' : tts <= ttsLightning ? '⚡' : tts <= ttsAnchor ? '🟡' : '⚓';
    const imageUri = p.images?.[0] || p.thumbnail || p.image || null;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => {
          LogService.add(`SoldHistory → SoldEditDetail: ${p.title}`, 'info');
          navigation.navigate('SoldEditDetail', { product: p });
        }}
        activeOpacity={0.75}
      >
        {/* Imagen */}
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.thumbnail} resizeMode="cover" />
        ) : (
          <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
            <Icon name="package" size={22} color="#CCC" />
          </View>
        )}

        {/* Contenido */}
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {p.title || 'Sin título'}
          </Text>
          {(p.category || p.subcategory || p.brand) && (
            <Text style={styles.cardMeta} numberOfLines={1}>
              {p.category}{p.subcategory ? ` › ${p.subcategory}` : ''}
              {p.brand ? ` · ${p.brand}` : ''}
            </Text>
          )}
          <View style={styles.cardRow}>
            <Text style={styles.cardPrice}>{soldAmt.toFixed(0)}€</Text>
            {tts !== null && (
              <View style={[styles.ttsChip, { backgroundColor: ttsColor + '20', borderColor: ttsColor + '50' }]}>
                <Text style={[styles.ttsChipTxt, { color: ttsColor }]}>
                  {ttsEmoji} {tts}d
                </Text>
              </View>
            )}
            {p.isBundle && (
              <View style={styles.bundleChip}>
                <Text style={styles.bundleChipTxt}>📦 Lote</Text>
              </View>
            )}
          </View>
          <Text style={styles.cardDate}>{soldDateStr}</Text>
        </View>

        {/* Acciones: editar + eliminar */}
        <View style={styles.cardActions}>
          <Icon name="chevron-right" size={15} color={C.textLow} />
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => handleDelete(p)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <Icon name="trash-2" size={14} color={C.danger} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>

      {/* HEADER */}
      <View style={styles.header}>
        {/* Fila título + botón sort */}
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Historial de Ventas</Text>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.importBtn}
              onPress={() => navigation.navigate('Import')}
            >
              <Icon name="download" size={13} color={C.purple} />
              <Text style={styles.importBtnTxt}>Importar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sortToggleBtn, showSort && { backgroundColor: C.primary }]}
              onPress={() => setShowSort(s => !s)}
              activeOpacity={0.7}
            >
              <Icon name="sliders" size={13} color={showSort ? '#FFF' : C.textMed} />
              <Icon
                name={showSort ? 'chevron-up' : 'chevron-down'}
                size={11}
                color={showSort ? '#FFF' : C.textLow}
              />
            </TouchableOpacity>
          </View>
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
                    style={[styles.sortChip, active && { backgroundColor: C.primary, borderColor: C.primary }]}
                    onPress={() => { setSortId(opt.id); setShowSort(false); }}
                    activeOpacity={0.7}
                  >
                    <Icon name={opt.icon} size={11} color={active ? '#FFF' : C.textMed} />
                    <Text style={[styles.sortChipTxt, active && { color: '#FFF', fontWeight: '800' }]}>
                      {opt.label}
                    </Text>
                    <Icon
                      name={opt.dir === 'desc' ? 'arrow-down' : 'arrow-up'}
                      size={9}
                      color={active ? 'rgba(255,255,255,0.7)' : C.textLow}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* KPI PANEL */}
        <View style={styles.kpiPanel}>
          <View style={styles.kpiItem}>
            <Text style={styles.kpiVal}>{kpis.count}</Text>
            <Text style={styles.kpiLab}>Ventas</Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiItem}>
            <Text style={[styles.kpiVal, { color: C.blue }]}>{kpis.recaudacion.toFixed(0)}€</Text>
            <Text style={styles.kpiLab}>Recaudado</Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiItem}>
            <Text style={[styles.kpiVal, { color: C.textMed }]}>{kpis.avgPrecio}€</Text>
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
        <View style={{ marginBottom: 4 }}>
          <FlatList
            horizontal
            data={[null, ...allCats]}
            keyExtractor={item => item ?? '__all__'}
            showsHorizontalScrollIndicator={false}
            style={{ maxHeight: 44, paddingHorizontal: 12 }}
            contentContainerStyle={{ gap: 6, alignItems: 'center', paddingVertical: 6 }}
            renderItem={({ item: cat }) => (
              <TouchableOpacity
                style={[styles.catChip, filterCat === cat && { backgroundColor: C.primary }]}
                onPress={() => { setFilterCat(cat); setFilterSub(null); }}
              >
                <Text style={[styles.catChipTxt, filterCat === cat && { color: '#FFF' }]}>
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
              style={{ maxHeight: 36, paddingLeft: 20, marginTop: 2 }}
              contentContainerStyle={{ gap: 5, alignItems: 'center', paddingVertical: 4 }}
              renderItem={({ item: sub }) => (
                <TouchableOpacity
                  style={[styles.subChip, filterSub === sub && { backgroundColor: C.blue }]}
                  onPress={() => setFilterSub(sub)}
                >
                  <Text style={[styles.subChipTxt, filterSub === sub && { color: '#FFF' }]}>
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
          <Icon name={currentSort.icon} size={10} color={C.primary} />
          <Text style={styles.activeSortTxt}>{currentSort.label}</Text>
        </View>
      </View>

      {/* LISTA */}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={C.primary} size="large" />
      ) : (
        <FlatList
          data={sorted}
          renderItem={renderItem}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Icon name="shopping-bag" size={40} color="#DDD" />
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
  container: { flex: 1, backgroundColor: C.bg },

  header:      { backgroundColor: C.white, paddingTop: 52, paddingHorizontal: 16,
                 paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  headerTop:   { flexDirection: 'row', alignItems: 'center',
                 justifyContent: 'space-between', marginBottom: 12 },
  headerTitle: { fontSize: 22, fontWeight: '900', color: C.text },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  importBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4,
                  paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
                  backgroundColor: '#F0EEFF', borderWidth: 1, borderColor: '#DDD8FF' },
  importBtnTxt: { fontSize: 12, fontWeight: '700', color: '#6C63FF' },

  sortToggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 4,
                   paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20,
                   backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border },

  // Sort panel
  sortPanel:      { backgroundColor: C.bg, borderRadius: 14, padding: 12,
                    marginBottom: 10, borderWidth: 1, borderColor: C.border },
  sortPanelTitle: { fontSize: 9, fontWeight: '900', color: C.textLow,
                    letterSpacing: 1.5, marginBottom: 8 },
  sortGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sortChip:       { flexDirection: 'row', alignItems: 'center', gap: 4,
                    paddingHorizontal: 9, paddingVertical: 6, borderRadius: 20,
                    backgroundColor: C.white, borderWidth: 1, borderColor: C.border },
  sortChipTxt:    { fontSize: 11, fontWeight: '600', color: C.textMed },

  kpiPanel:  { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bg,
               borderRadius: 12, padding: 10, marginBottom: 8 },
  kpiItem:   { flex: 1, alignItems: 'center' },
  kpiVal:    { fontSize: 18, fontWeight: '900', color: C.text },
  kpiLab:    { fontSize: 9, color: C.textLow, fontWeight: '600', marginTop: 1 },
  kpiDivider:{ width: 1, height: 28, backgroundColor: C.border, marginHorizontal: 4 },
  ttsLegend: { fontSize: 10, color: C.textLow, textAlign: 'center', marginTop: 2, marginBottom: 4 },

  catChip:    { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
                backgroundColor: C.white, borderWidth: 1, borderColor: C.border },
  catChipTxt: { fontSize: 12, fontWeight: '600', color: C.textMed },
  subChip:    { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 14,
                backgroundColor: C.blueBg, borderWidth: 1, borderColor: C.blue + '28' },
  subChipTxt: { fontSize: 10, fontWeight: '700', color: C.blue },

  resultsBar:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                     paddingHorizontal: 16, paddingVertical: 6 },
  resultsCount:    { fontSize: 11, color: C.textLow, fontWeight: '600' },
  activeSortBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  activeSortTxt:   { fontSize: 10, color: C.primary, fontWeight: '700' },

  list: { padding: 12, gap: 8 },
  card: { flexDirection: 'row', backgroundColor: C.white, borderRadius: 14,
          padding: 10, alignItems: 'flex-start',
          shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4,
          shadowOffset: { width: 0, height: 2 }, elevation: 2 },

  thumbnail:            { width: 72, height: 72, borderRadius: 10, marginRight: 10, backgroundColor: C.bg },
  thumbnailPlaceholder: { justifyContent: 'center', alignItems: 'center' },

  cardBody:  { flex: 1, gap: 3 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: C.text, lineHeight: 17 },
  cardMeta:  { fontSize: 10, color: C.textMed, fontWeight: '500' },
  cardRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 2 },
  cardPrice: { fontSize: 15, fontWeight: '900', color: C.text },
  cardDate:  { fontSize: 10, color: C.textLow, marginTop: 2 },

  ttsChip:    { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  ttsChipTxt: { fontSize: 11, fontWeight: '700' },
  bundleChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
                backgroundColor: '#EAE8FF' },
  bundleChipTxt: { fontSize: 10, fontWeight: '700', color: '#6C63FF' },

  // Acciones de la tarjeta (columna derecha)
  cardActions: { flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
                 paddingLeft: 4, gap: 12, alignSelf: 'stretch' },
  deleteBtn:   { backgroundColor: C.dangerBg, borderRadius: 8, padding: 6,
                 borderWidth: 1, borderColor: C.danger + '40' },

  empty:    { alignItems: 'center', paddingTop: 60 },
  emptyText:{ fontSize: 16, fontWeight: '700', color: C.textMed, marginTop: 12 },
  emptySub: { fontSize: 13, color: C.textLow, textAlign: 'center',
              marginTop: 4, paddingHorizontal: 40 },
});
