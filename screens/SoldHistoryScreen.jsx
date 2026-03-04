import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image,
  StyleSheet, Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { DatabaseService } from '../services/DatabaseService';

const { width } = Dimensions.get('window');

export default function SoldHistoryScreen({ navigation }) {
  const [soldProducts, setSoldProducts] = useState([]);
  const [filterType,   setFilterType]   = useState('date'); // 'date' | 'profit' | 'tts' | 'category'
  const [filterCat,    setFilterCat]    = useState(null);  // null = todas
  const [config,       setConfig]       = useState(null);

  const loadData = () => {
    const all    = DatabaseService.getAllProducts();
    const sold   = all.filter(p => p && p.status === 'sold');
    setSoldProducts(sold);
    setConfig(DatabaseService.getConfig());
  };

  useEffect(() => {
    loadData();
    const unsub = navigation.addListener('focus', loadData);
    return unsub;
  }, [navigation]);

  // KPIs del historial
  const kpis = useMemo(() => {
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
  }, [soldProducts]);

  // Sorted list
  const sorted = useMemo(() => {
    const arr = [...soldProducts];
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
  }, [soldProducts, filterType, filterCat]);

  const renderItem = ({ item }) => {
    const original = Number(item.price || 0);
    const sold     = Number(item.soldPriceReal || item.soldPrice || item.price || 0);
    const diff     = sold - original;
    const start    = item.firstUploadDate || item.createdAt;
    const end      = item.soldDateReal || item.soldDate || item.soldAt;
    const tts      = start && end ? Math.max(1, Math.round((new Date(end) - new Date(start)) / 86_400_000)) : null;

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
            <Text style={styles.date}>{new Date(item.soldDateReal || item.soldDate || item.soldAt || '').toLocaleDateString('es-ES')}</Text>
            {tts !== null && (
              <>
                <Text style={styles.dot}>·</Text>
                <Text style={[styles.ttsChip, { color: tts <= ttsLightning ? '#00D9A3' : tts <= ttsAnchor ? '#FFB800' : '#E63946' }]}>
                  {tts <= ttsLightning ? '⚡' : tts <= ttsAnchor ? '🟡' : '⚓'} {tts}d
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

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Historial de Ventas</Text>

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
            <Text style={[styles.kpiVal, { color: kpis.avgTTS <= ttsLightning ? '#00D9A3' : kpis.avgTTS <= ttsAnchor ? '#FFB800' : '#E63946' }]}>
              {kpis.avgTTS > 0 ? `${kpis.avgTTS}d` : '—'}
            </Text>
            <Text style={styles.kpiLab}>TTS Medio</Text>
          </View>
        </View>
      </View>

      {/* Category quick-filter */}
      {(() => {
        const cats = [...new Set(soldProducts.map(p => p.category || 'Otros'))];
        if (cats.length < 2) return null;
        return (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 16, marginBottom: 8 }} contentContainerStyle={{ gap: 6 }}>
            <TouchableOpacity
              style={[styles.catChip, !filterCat && { backgroundColor: '#FF6B35' }]}
              onPress={() => setFilterCat(null)}
            >
              <Text style={[styles.catChipTxt, !filterCat && { color: '#FFF' }]}>Todas</Text>
            </TouchableOpacity>
            {cats.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[styles.catChip, filterCat === cat && { backgroundColor: '#FF6B35' }]}
                onPress={() => setFilterCat(filterCat === cat ? null : cat)}
              >
                <Text style={[styles.catChipTxt, filterCat === cat && { color: '#FFF' }]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        );
      })()}

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
            <Text style={[styles.filterText, filterType === f.id && { color: '#FFF' }]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={sorted}
        keyExtractor={item => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="shopping-bag" size={40} color="#DDD" />
            <Text style={styles.emptyText}>Sin ventas registradas todavía.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#F8F9FA' },
  header:      { padding: 25, paddingTop: 60, backgroundColor: '#FFF' },
  headerTitle: { fontSize: 24, fontWeight: '900', color: '#1A1A2E', marginBottom: 16 },

  kpiPanel: {
    flexDirection: 'row', backgroundColor: '#F8F9FA',
    borderRadius: 18, padding: 14, alignItems: 'center',
    borderWidth: 1, borderColor: '#EEE',
  },
  kpiItem:    { flex: 1, alignItems: 'center' },
  kpiVal:     { fontSize: 16, fontWeight: '900', color: '#1A1A2E' },
  kpiLab:     { fontSize: 8,  fontWeight: '700', color: '#999', marginTop: 2 },
  kpiDivider: { width: 1, height: 30, backgroundColor: '#EEE' },

  filterBar: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 12, gap: 8 },
  filterBtn: {
    flex: 1, paddingVertical: 9, borderRadius: 12,
    backgroundColor: '#FFF', borderWidth: 1, borderColor: '#EEE', alignItems: 'center',
  },
  filterBtnActive: { backgroundColor: '#1A1A2E', borderColor: '#1A1A2E' },
  filterText:      { fontSize: 10, fontWeight: '800', color: '#666' },

  card: {
    flexDirection: 'row', backgroundColor: '#FFF',
    marginHorizontal: 20, marginBottom: 10,
    padding: 12, borderRadius: 20, alignItems: 'center', elevation: 2,
  },
  thumbnail:   { width: 82, height: 82, borderRadius: 16 },
  cardContent: { flex: 1, marginLeft: 12 },
  titleRow:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title:       { fontSize: 13, fontWeight: '800', color: '#1A1A2E', flex: 1 },
  lote:        { backgroundColor: '#F0EFFF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  loteText:    { color: '#6C63FF', fontSize: 8, fontWeight: '900' },
  metaRow:     { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 3, gap: 2 },
  category:    { fontSize: 10, fontWeight: '900', color: '#FF6B35' },
  dot:         { color: '#DDD', marginHorizontal: 3 },
  date:        { fontSize: 10, color: '#999' },
  ttsChip:     { fontSize: 10, fontWeight: '800' },
  catChip:     { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F0F0F0', borderWidth: 1, borderColor: '#E0E0E0' },
  catChipTxt:  { fontSize: 11, fontWeight: '700', color: '#666' },
  priceRow:    { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 },
  priceLabel:  { fontSize: 7,  fontWeight: '900', color: '#CCC' },
  priceOriginal: { fontSize: 12, fontWeight: '700', color: '#CCC', textDecorationLine: 'line-through' },
  priceFinal:  { fontSize: 16, fontWeight: '900', color: '#1A1A2E' },
  diffBadge:   { marginLeft: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  diffText:    { fontSize: 10, fontWeight: '900' },
  statsRow:    { flexDirection: 'row', gap: 10, marginTop: 6 },
  statMini:    { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statText:    { fontSize: 10, fontWeight: '700', color: '#999' },
  empty:       { alignItems: 'center', paddingTop: 60 },
  emptyText:   { color: '#CCC', fontSize: 13, marginTop: 12 },
});