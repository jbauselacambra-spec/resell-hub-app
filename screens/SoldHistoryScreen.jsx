/**
 * SoldHistoryScreen.jsx — Sprint 9.1 · FIX BUG-B (Hotfix 5)
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * [DEBUGGER] ROOT CAUSE BUG-B (doble fallo):
 *
 *   FALLO 1 — Imágenes no cargan:
 *     renderItem usaba `p.thumbnail || p.image` para la imagen.
 *     Los productos de Vinted almacenan la URL en `p.images[0]`
 *     (campo canónico desde Sprint 1). thumbnail/image no existen.
 *     Fix: usar `p.images?.[0] || p.thumbnail || p.image`
 *          con Image source={uri} protegido por guard.
 *
 *   FALLO 2 — No navega al detalle al pulsar la tarjeta:
 *     El renderItem devolvía un <View> sin TouchableOpacity envolvente
 *     a nivel de tarjeta. Solo la imagen y algunos elementos tenían
 *     onPress; el cuerpo de texto de la tarjeta era inerte.
 *     Fix: Envolver toda la tarjeta en <TouchableOpacity
 *            onPress={() => navigation.navigate('SoldEditDetail', {product: p})}>
 *
 * [QA_ENGINEER] VERIFICACIÓN:
 *   - images[0] → URL remota Vinted → <Image source={{uri}} />
 *   - Si no hay imagen → placeholder con icono "package"
 *   - Toda la tarjeta es pulsable → navega a SoldEditDetailView
 *   - Los 7 Campos Sagrados no se tocan
 *   - Hooks antes de early returns (Regla 12 ✅)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { DatabaseService } from '../services/DatabaseService';
import LogService from '../services/LogService';

// ─── Paleta canónica DS Light ─────────────────────────────────────────────────
const C = {
  bg:      '#F8F9FA',
  white:   '#FFFFFF',
  primary: '#FF6B35',
  blue:    '#004E89',
  success: '#00D9A3',
  warning: '#FFB800',
  danger:  '#E63946',
  purple:  '#6C63FF',
  text:    '#1A1A2E',
  textMed: '#5C6070',
  textLow: '#A0A5B5',
  border:  '#EAEDF0',
};

// ─── Componente principal ─────────────────────────────────────────────────────
export default function SoldHistoryScreen({ navigation }) {

  // ── HOOKS primero — antes de cualquier early return (Regla 12) ──────────────
  const [config, setConfig]         = useState(() => DatabaseService.getConfig());
  const [soldProducts, setSold]     = useState([]);
  const [filterType, setFilterType] = useState('date');
  const [filterCat, setFilterCat]   = useState(null);
  const [loading, setLoading]       = useState(true);

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

  // Umbrales dinámicos desde config
  const ttsLightning = parseInt(config?.ttsLightning || 7);
  const ttsAnchor    = parseInt(config?.ttsAnchor    || 30);

  // KPIs
  const kpis = useMemo(() => {
    if (!soldProducts.length) return { count: 0, recaudacion: 0, avgPrecio: 0, avgTTS: 0 };
    const count       = soldProducts.length;
    const recaudacion = soldProducts.reduce(
      (s, p) => s + Math.max(0, Number(p.soldPriceReal || p.soldPrice || p.price || 0)), 0,
    );
    const avgPrecio   = count ? +(recaudacion / count).toFixed(0) : 0;

    // TTS medio (solo productos con soldDateReal)
    const ttsList = soldProducts.map(p => {
      const s = p.firstUploadDate || p.createdAt;
      const e = p.soldDateReal || p.soldDate || p.soldAt;
      if (!s || !e) return null;
      return Math.max(1, Math.round((new Date(e) - new Date(s)) / 86_400_000));
    }).filter(v => v !== null);

    const avgTTS = ttsList.length ? Math.round(ttsList.reduce((a, b) => a + b, 0) / ttsList.length) : 0;
    return { count, recaudacion, avgPrecio, avgTTS };
  }, [soldProducts]);

  // Categorías únicas para filtro
  const allCats = useMemo(
    () => [...new Set(soldProducts.map(p => p.category).filter(Boolean))].sort(),
    [soldProducts],
  );

  // Lista ordenada + filtrada
  const sorted = useMemo(() => {
    let arr = filterCat
      ? soldProducts.filter(p => p.category === filterCat)
      : soldProducts;

    if (filterType === 'precio') {
      return [...arr].sort((a, b) => {
        const aP = Math.max(0, Number(a.soldPriceReal || a.soldPrice || a.price || 0));
        const bP = Math.max(0, Number(b.soldPriceReal || b.soldPrice || b.price || 0));
        return bP - aP;
      });
    }
    if (filterType === 'tts') {
      return [...arr].sort((a, b) => {
        const ttsOf = p => {
          const s = p.firstUploadDate || p.createdAt;
          const e = p.soldDateReal    || p.soldDate || p.soldAt;
          return (s && e) ? Math.max(1, Math.round((new Date(e) - new Date(s)) / 86_400_000)) : 9999;
        };
        return ttsOf(a) - ttsOf(b);
      });
    }
    // default: por fecha más reciente
    return [...arr].sort((a, b) => {
      const dA = new Date(a.soldDateReal || a.soldDate || a.soldAt || 0);
      const dB = new Date(b.soldDateReal || b.soldDate || b.soldAt || 0);
      return dB - dA;
    });
  }, [soldProducts, filterType, filterCat]);

  const avgTtsColor = kpis.avgTTS > 0 && kpis.avgTTS <= ttsLightning
    ? C.success
    : kpis.avgTTS > 0 && kpis.avgTTS <= ttsAnchor ? C.warning : C.danger;

  // ── renderItem — FIX BUG-B ───────────────────────────────────────────────────
  const renderItem = ({ item: p }) => {
    const soldAmt = Math.max(0, Number(p.soldPriceReal || p.soldPrice || p.price || 0));

    const soldDateStr = (() => {
      const d = p.soldDateReal || p.soldDate || p.soldAt;
      if (!d) return '—';
      return new Date(d).toLocaleDateString('es-ES', {
        day: '2-digit', month: 'short', year: 'numeric',
      });
    })();

    const tts = (() => {
      const s = p.firstUploadDate || p.createdAt;
      const e = p.soldDateReal    || p.soldDate || p.soldAt;
      if (!s || !e) return null;
      return Math.max(1, Math.round((new Date(e) - new Date(s)) / 86_400_000));
    })();

    const ttsColor = !tts ? '#999'
      : tts <= ttsLightning ? C.success
      : tts <= ttsAnchor    ? C.warning
      :                       C.danger;
    const ttsEmoji = !tts ? '' : tts <= ttsLightning ? '⚡' : tts <= ttsAnchor ? '🟡' : '⚓';

    // ── FIX: imagen correcta desde p.images[0] (campo canónico Vinted) ──────
    // Antes: p.thumbnail || p.image  → siempre undefined → sin imagen
    // Ahora: p.images?.[0] con fallbacks legacy
    const imageUri = p.images?.[0] || p.thumbnail || p.image || null;

    return (
      // ── FIX: TouchableOpacity envuelve toda la tarjeta → navega al detalle ──
      <TouchableOpacity
        style={styles.card}
        onPress={() => {
          LogService.add(`SoldHistory → SoldEditDetail: ${p.title}`, 'info');
          navigation.navigate('SoldEditDetail', { product: p });
        }}
        activeOpacity={0.75}
      >
        {/* Imagen del producto */}
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
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

          {/* Categoría + subcategoría + marca */}
          {(p.category || p.subcategory || p.brand) && (
            <Text style={styles.cardMeta} numberOfLines={1}>
              {p.category}{p.subcategory ? ` › ${p.subcategory}` : ''}
              {p.brand ? ` · ${p.brand}` : ''}
            </Text>
          )}

          {/* Precio + TTS + Bundle */}
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

        {/* Flecha indicando que es pulsable */}
        <Icon name="chevron-right" size={16} color={C.textLow} style={{ alignSelf: 'center' }} />
      </TouchableOpacity>
    );
  };

  // ── RENDER ────────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>

      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Historial de Ventas</Text>
         <TouchableOpacity
  style={styles.importBtn}
  onPress={() => navigation.navigate('Import')} // <--- Cambiado de 'VintedImportScreen' a 'Import'
>
  <Icon name="download" size={13} color={C.purple} />
  <Text style={styles.importBtnTxt}>Importar</Text>
</TouchableOpacity>
        </View>

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

      {/* FILTRO CATEGORÍA */}
      {allCats.length >= 2 && (
        <FlatList
          horizontal
          data={[null, ...allCats]}
          keyExtractor={item => item ?? '__all__'}
          showsHorizontalScrollIndicator={false}
          style={{ maxHeight: 44, paddingHorizontal: 12, marginBottom: 4 }}
          contentContainerStyle={{ gap: 6, alignItems: 'center', paddingVertical: 6 }}
          renderItem={({ item: cat }) => (
            <TouchableOpacity
              style={[styles.catChip, filterCat === cat && { backgroundColor: C.primary }]}
              onPress={() => setFilterCat(cat)}
            >
              <Text style={[styles.catChipTxt, filterCat === cat && { color: '#FFF' }]}>
                {cat ?? 'Todas'}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}

      {/* FILTRO ORDEN */}
      <View style={styles.filterBar}>
        {[
          { id: 'date',   label: '🗓 Por Fecha'    },
          { id: 'precio', label: '💰 Por Precio'   },
          { id: 'tts',    label: '⚡ Por Velocidad' },
        ].map(f => (
          <TouchableOpacity
            key={f.id}
            style={[styles.filterBtn, filterType === f.id && styles.filterBtnActive]}
            onPress={() => setFilterType(f.id)}
          >
            <Text style={[styles.filterText, filterType === f.id && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
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

// ─── Estilos ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: C.bg },

  // Header
  header:     { backgroundColor: C.white, paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  headerRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  headerTitle:{ fontSize: 22, fontWeight: '900', color: C.text },
  importBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: '#F0EEFF', borderWidth: 1, borderColor: '#DDD8FF' },
  importBtnTxt:{ fontSize: 12, fontWeight: '700', color: '#6C63FF' },

  // KPIs
  kpiPanel:   { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bg, borderRadius: 12, padding: 10, marginBottom: 8 },
  kpiItem:    { flex: 1, alignItems: 'center' },
  kpiVal:     { fontSize: 18, fontWeight: '900', color: C.text },
  kpiLab:     { fontSize: 9, color: C.textLow, fontWeight: '600', marginTop: 1 },
  kpiDivider: { width: 1, height: 28, backgroundColor: C.border, marginHorizontal: 4 },
  ttsLegend:  { fontSize: 10, color: C.textLow, textAlign: 'center', marginTop: 2, marginBottom: 4 },

  // Filtro cat
  catChip:    { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: C.white, borderWidth: 1, borderColor: C.border },
  catChipTxt: { fontSize: 12, fontWeight: '600', color: C.textMed },

  // Filtro orden
  filterBar:  { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  filterBtn:  { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 8, backgroundColor: C.white, borderWidth: 1, borderColor: C.border },
  filterBtnActive: { backgroundColor: C.primary, borderColor: C.primary },
  filterText: { fontSize: 11, fontWeight: '600', color: C.textMed },
  filterTextActive: { color: '#FFF' },

  // Tarjeta — FIX: ahora es TouchableOpacity completo
  list:       { padding: 12, gap: 8 },
  card:       {
    flexDirection: 'row',
    backgroundColor: C.white,
    borderRadius: 14,
    padding: 10,
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  // Imagen — FIX: carga desde images[0]
  thumbnail:  { width: 72, height: 72, borderRadius: 10, marginRight: 10, backgroundColor: C.bg },
  thumbnailPlaceholder: { justifyContent: 'center', alignItems: 'center' },

  // Contenido tarjeta
  cardBody:   { flex: 1, gap: 3 },
  cardTitle:  { fontSize: 13, fontWeight: '700', color: C.text, lineHeight: 17 },
  cardMeta:   { fontSize: 10, color: C.textMed, fontWeight: '500' },
  cardRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 2 },
  cardPrice:  { fontSize: 15, fontWeight: '900', color: C.text },
  cardDate:   { fontSize: 10, color: C.textLow, marginTop: 2 },

  // Chips
  ttsChip:    { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  ttsChipTxt: { fontSize: 11, fontWeight: '700' },
  bundleChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: '#EAE8FF' },
  bundleChipTxt:{ fontSize: 10, fontWeight: '700', color: '#6C63FF' },

  // Empty
  empty:      { alignItems: 'center', paddingTop: 60 },
  emptyText:  { fontSize: 16, fontWeight: '700', color: C.textMed, marginTop: 12 },
  emptySub:   { fontSize: 13, color: C.textLow, textAlign: 'center', marginTop: 4, paddingHorizontal: 40 },
});