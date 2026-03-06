import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image,
  StyleSheet, Dimensions, ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { DatabaseService } from '../services/DatabaseService';

const { width } = Dimensions.get('window');

export default function SoldHistoryScreen({ navigation }) {
  const [soldProducts, setSoldProducts] = useState([]);
  const [filterType,   setFilterType]   = useState('date'); // 'date' | 'profit' | 'tts'
  const [filterCat,    setFilterCat]    = useState(null);   // null = todas
  const [config,       setConfig]       = useState(() => DatabaseService.getConfig()); // init síncrono — nunca null

  const loadData = () => {
    const all  = DatabaseService.getAllProducts();
    const sold = all.filter(p => p && p.status === 'sold');
    setSoldProducts(sold);
    setConfig(DatabaseService.getConfig());
  };

  useEffect(() => {
    loadData();
    const unsub = navigation.addListener('focus', loadData);
    return unsub;
  }, [navigation]);

  // Refresh config en foco (puede cambiar desde Settings)
  if (!config) return null; // salvaguarda (nunca ocurre con init síncrono)

  // Umbrales dinámicos desde Settings — SIEMPRE desde config
  const ttsLightning = parseInt(config.ttsLightning || 7);
  const ttsAnchor    = parseInt(config.ttsAnchor    || 30);

  // KPIs del historial
  const kpis = (() => {
    const revenue = soldProducts.reduce((s, p) => s + Number(p.soldPriceReal || p.soldPrice || p.price || 0), 0);
    const profit  = soldProducts.reduce((s, p) => s + (Number(p.soldPriceReal || p.soldPrice || p.price || 0) - Number(p.price || 0)), 0);
    const ttsList = soldProducts.map(p => {
      const start = p.firstUploadDate || p.createdAt;
      const end   = p.soldDateReal || p.soldDate || p.soldAt;
      if (!start || !end) return null;
      return Math.max(1, Math.round((new Date(end) - new Date(start)) / 86_400_000));
    }).filter(Boolean);
    const avgTTS = ttsList.length ? Math.round(ttsList.reduce((a, b) => a + b, 0) / ttsList.length) : 0;
    return { revenue, profit, avgTTS, count: soldProducts.length };
  })();

  // Lista ordenada + filtrada
  const sorted = (() => {
    let arr = [...soldProducts];
    if (filterType === 'date') {
      arr.sort((a, b) => new Date(b.soldDateReal || b.soldDate || b.soldAt || 0) - new Date(a.soldDateReal || a.soldDate || a.soldAt || 0));
    } else if (filterType === 'profit') {
      arr.sort((a, b) => {
        const pA = Number(a.soldPriceReal || a.soldPrice || a.price) - Number(a.price);
        const pB = Number(b.soldPriceReal || b.soldPrice || b.price) - Number(b.price);
        return pB - pA;
      });
    } else if (filterType === 'tts') {
      arr.sort((a, b) => {
        const ttsOf = p => {
          const s = p.firstUploadDate || p.createdAt;
          const e = p.soldDateReal || p.soldDate || p.soldAt;
          return s && e ? Math.round((new Date(e) - new Date(s)) / 86_400_000) : 999;
        };
        return ttsOf(a) - ttsOf(b);
      });
    }
    if (filterCat) arr = arr.filter(p => p.category === filterCat);
    return arr;
  })();

  // Categorías únicas para el filtro rápido
  const allCats = [...new Set(soldProducts.map(p => p.category || 'Otros'))];

  const renderItem = ({ item }) => {
    const original = Number(item.price || 0);
    const sold     = Number(item.soldPriceReal || item.soldPrice || item.price || 0);
    const diff     = sold - original;
    const start    = item.firstUploadDate || item.createdAt;
    const end      = item.soldDateReal || item.soldDate || item.soldAt;
    const tts      = start && end ? Math.max(1, Math.round((new Date(end) - new Date(start)) / 86_400_000)) : null;

    // ttsLightning y ttsAnchor ya están disponibles (declarados tras guard)
    const ttsColor = tts === null ? '#999'
      : tts <= ttsLightning ? '#00D9A3'
      : tts <= ttsAnchor    ? '#FFB800'
      : '#E63946';
    const ttsEmoji = tts === null ? '' : tts <= ttsLightning ? '⚡' : tts <= ttsAnchor ? '🟡' : '⚓';

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('SoldEditDetail', { product: item })}
      >
        <Image source={{ uri: item.images?.[0] }} style={styles.thumbnail} />

        <View style={styles.cardContent}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
            {item.isBundle && <View style={styles.lote}><Text style={styles.loteText}>LOTE</Text></View>}
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.category}>{item.category || 'Otros'}</Text>
            {item.subcategory ? (
              <>
                <Text style={styles.dot}>›</Text>
                <Text style={[styles.category, { color: '#004E89' }]}>{item.subcategory}</Text>
              </>
            ) : null}
            <Text style={styles.dot}>·</Text>
            <Text style={styles.date}>
              {new Date(item.soldDateReal || item.soldDate || item.soldAt || '').toLocaleDateString('es-ES')}
            </Text>
            {tts !== null && (
              <>
                <Text style={styles.dot}>·</Text>
                <Text style={[styles.ttsChip, { color: ttsColor }]}>
                  {ttsEmoji} {tts}d
                </Text>
              </>
            )}
          </View>

          <View style={styles.priceRow}>
            <View>
              <Text style={styles.priceLabel}>PRECIO INICIAL</Text>
              <Text style={styles.priceOriginal}>{original}€</Text>
            </View>
            <Icon name="arrow-right" size={12} color="#DDD" style={{ marginTop: 10 }} />
            <View>
              <Text style={styles.priceLabel}>PRECIO FINAL</Text>
              <Text style={styles.priceFinal}>{sold}€</Text>
            </View>
            <View style={[styles.diffBadge, { backgroundColor: diff >= 0 ? '#E8FBF6' : '#FFEBEB' }]}>
              <Text style={[styles.diffText, { color: diff >= 0 ? '#00D9A3' : '#E63946' }]}>
                {diff >= 0 ? '+' : ''}{diff.toFixed(2)}€
              </Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statMini}><Icon name="eye" size={11} color="#999" /><Text style={styles.statText}>{item.views || 0}</Text></View>
            <View style={styles.statMini}><Icon name="heart" size={11} color="#999" /><Text style={styles.statText}>{item.favorites || 0}</Text></View>
          </View>
        </View>
        <Icon name="chevron-right" size={16} color="#EEE" />
      </TouchableOpacity>
    );
  };

  // KPI avgTTS color usando umbrales dinámicos
  const avgTtsColor = kpis.avgTTS <= ttsLightning ? '#00D9A3'
    : kpis.avgTTS <= ttsAnchor ? '#FFB800'
    : '#E63946';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{flexDirection:'row', alignItems:'center', justifyContent:'space-between'}}>
          <Text style={styles.headerTitle}>Historial de Ventas</Text>
          <TouchableOpacity
            style={{flexDirection:'row', alignItems:'center', gap:5, backgroundColor:'#F0EFFE', paddingHorizontal:12, paddingVertical:8, borderRadius:12}}
            onPress={() => navigation.navigate('VintedImport')}
          >
            <Icon name="download" size={13} color="#6C63FF"/>
            <Text style={{fontSize:11, fontWeight:'800', color:'#6C63FF'}}>Importar</Text>
          </TouchableOpacity>
        </View>

        {/* KPI panel */}
        <View style={styles.kpiPanel}>
          <View style={styles.kpiItem}>
            <Text style={styles.kpiVal}>{kpis.count}</Text>
            <Text style={styles.kpiLab}>Ventas</Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiItem}>
            <Text style={[styles.kpiVal, { color: '#00D9A3' }]}>+{kpis.profit.toFixed(0)}€</Text>
            <Text style={styles.kpiLab}>Beneficio</Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiItem}>
            <Text style={styles.kpiVal}>{kpis.revenue.toFixed(0)}€</Text>
            <Text style={styles.kpiLab}>Ingresos</Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiItem}>
            <Text style={[styles.kpiVal, { color: avgTtsColor }]}>
              {kpis.avgTTS > 0 ? `${kpis.avgTTS}d` : '—'}
            </Text>
            <Text style={styles.kpiLab}>TTS Medio</Text>
          </View>
        </View>

        {/* Leyenda TTS dinámica */}
        <Text style={styles.ttsLegend}>
          ⚡≤{ttsLightning}d · 🟡{ttsLightning+1}–{ttsAnchor}d · ⚓&gt;{ttsAnchor}d (según Settings)
        </Text>
      </View>

      {/* Category quick-filter */}
      {allCats.length >= 2 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ paddingHorizontal: 16, marginBottom: 8, maxHeight: 44 }}
          contentContainerStyle={{ gap: 6, alignItems: 'center' }}
        >
          <TouchableOpacity
            style={[styles.catChip, !filterCat && { backgroundColor: '#FF6B35' }]}
            onPress={() => setFilterCat(null)}
          >
            <Text style={[styles.catChipTxt, !filterCat && { color: '#FFF' }]}>Todas</Text>
          </TouchableOpacity>
          {allCats.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[styles.catChip, filterCat === cat && { backgroundColor: '#FF6B35' }]}
              onPress={() => setFilterCat(filterCat === cat ? null : cat)}
            >
              <Text style={[styles.catChipTxt, filterCat === cat && { color: '#FFF' }]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Filter bar */}
      <View style={styles.filterBar}>
        {[
          { id: 'date',   label: '🗓 Por Fecha' },
          { id: 'profit', label: '💰 Por Beneficio' },
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

      <FlatList
        data={sorted}
        renderItem={renderItem}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="shopping-bag" size={40} color="#DDD" />
            <Text style={styles.emptyText}>Sin ventas todavía.</Text>
            <Text style={styles.emptySub}>Marca productos como vendidos para ver tu historial.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
    backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#1A1A2E', marginBottom: 14 },

  kpiPanel:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  kpiItem:   { alignItems: 'center' },
  kpiVal:    { fontSize: 18, fontWeight: '900', color: '#1A1A2E', fontFamily: 'monospace' },
  kpiLab:    { fontSize: 9, color: '#999', fontWeight: '700', marginTop: 2 },
  kpiDivider:{ width: 1, height: 28, backgroundColor: '#F0F0F0' },

  ttsLegend: { fontSize: 9, color: '#BBB', textAlign: 'center', marginTop: 10, letterSpacing: 0.3 },

  catChip:    { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F0F0F0', borderWidth: 1, borderColor: '#E0E0E0' },
  catChipTxt: { fontSize: 11, fontWeight: '700', color: '#666' },

  filterBar: {
    flexDirection: 'row', marginHorizontal: 16, marginVertical: 10,
    backgroundColor: '#F0F0F0', borderRadius: 14, padding: 3,
  },
  filterBtn:       { flex: 1, paddingVertical: 8, borderRadius: 12, alignItems: 'center' },
  filterBtnActive: { backgroundColor: '#FFF', elevation: 2 },
  filterText:      { fontSize: 10, fontWeight: '700', color: '#999' },
  filterTextActive:{ color: '#1A1A2E', fontWeight: '900' },

  list:  { paddingHorizontal: 16, paddingBottom: 40 },
  card:  {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFF', borderRadius: 16, padding: 12,
    marginBottom: 10, elevation: 1,
  },
  thumbnail: { width: 64, height: 64, borderRadius: 12, backgroundColor: '#F0F0F0' },
  cardContent: { flex: 1 },
  titleRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  title:     { fontSize: 13, fontWeight: '800', color: '#1A1A2E', flex: 1 },
  lote:      { backgroundColor: '#004E8920', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  loteText:  { fontSize: 8, fontWeight: '900', color: '#004E89' },
  metaRow:   { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginBottom: 6 },
  category:  { fontSize: 10, fontWeight: '900', color: '#FF6B35' },
  dot:       { fontSize: 10, color: '#CCC' },
  date:      { fontSize: 10, color: '#999' },
  ttsChip:   { fontSize: 10, fontWeight: '800', fontFamily: 'monospace' },
  priceRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  priceLabel:    { fontSize: 8, color: '#999', fontWeight: '700' },
  priceOriginal: { fontSize: 13, fontWeight: '700', color: '#999' },
  priceFinal:    { fontSize: 13, fontWeight: '900', color: '#1A1A2E' },
  diffBadge:     { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 'auto' },
  diffText:      { fontSize: 12, fontWeight: '900', fontFamily: 'monospace' },
  statsRow:  { flexDirection: 'row', gap: 10 },
  statMini:  { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statText:  { fontSize: 10, color: '#999' },
  empty:     { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 15, fontWeight: '700', color: '#CCC', marginTop: 12 },
  emptySub:  { fontSize: 11, color: '#DDD', marginTop: 6, textAlign: 'center' },
});
