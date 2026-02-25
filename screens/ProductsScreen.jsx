import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image,
  StyleSheet, Dimensions, Alert, ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { DatabaseService } from '../services/DatabaseService';

const { width } = Dimensions.get('window');

const SEASONAL_ADVICE = {
  0: 'Enero: Mueve Juguetes y Abrigos post-reyes.',
  1: 'Febrero: Accesorios y Ropa formal (San Valentín).',
  2: 'Marzo: Calzado deportivo y ropa de primavera.',
  3: 'Abril: Vestidos y Accesorios de entretiempo.',
  4: 'Mayo: Prepara Calzado de verano y Bañadores.',
  5: 'Junio: Temporada alta — Electrónica portátil.',
  6: 'Julio: Rebajas — ajusta precios y publica Lotes.',
  7: 'Agosto: Vuelta al cole — Libros y Calzado infantil.',
  8: 'Septiembre: Chaquetas y Entretenimiento familiar.',
  9: 'Octubre: ¡Momento de los Disfraces! Republica ya.',
  10: 'Noviembre: Black Friday — Electrónica y Lotes.',
  11: 'Diciembre: Navidad — Juguetes y Coleccionables.',
};

export default function ProductsScreen({ navigation }) {
  const [products, setProducts]     = useState([]);
  const [filter,   setFilter]       = useState('all');
  const [config,   setConfig]       = useState(null);

  const loadData = () => {
    // Fuente única: getActiveProductsWithDiagnostic ya aplica la config
    const enriched = DatabaseService.getActiveProductsWithDiagnostic();
    setProducts(enriched);
    setConfig(DatabaseService.getConfig());
  };

  useEffect(() => {
    loadData();
    const unsub = navigation.addListener('focus', loadData);
    return unsub;
  }, [navigation]);

  const currentMonth = new Date().getMonth();

  // Resumen de diagnósticos para las chips superiores
  const counts = useMemo(() => ({
    critical:    products.filter(p => p.severity?.type === 'CRÍTICO').length,
    invisible:   products.filter(p => p.severity?.type === 'INVISIBLE').length,
    desinterest: products.filter(p => p.severity?.type === 'DESINTERÉS').length,
    opportunity: products.filter(p => p.severity?.type === 'CASI LISTO').length,
    stagnant:    products.filter(p => p.isCold || p.isCritical).length,
  }), [products]);

  const filtered = useMemo(() => {
    if (filter === 'hot')      return products.filter(p => p.isHot);
    if (filter === 'stagnant') return products.filter(p => p.isCold || p.isCritical);
    if (filter === 'critical') return products.filter(p => p.severity?.type === 'CRÍTICO');
    return products;
  }, [products, filter]);

  const handleRepublish = (id) => {
    Alert.alert('Confirmar Resubida', '¿Has resubido este artículo? Se reseteará la antigüedad.', [
      { text: 'No', style: 'cancel' },
      { text: 'Sí', onPress: () => { DatabaseService.markAsRepublicated(id); loadData(); } },
    ]);
  };

  const renderItem = ({ item }) => {
    const sev = item.severity;
    const borderColor = sev ? sev.color : (item.isHot ? '#E63946' : 'transparent');

    return (
      <TouchableOpacity
        style={[styles.card, { borderColor, borderWidth: sev || item.isHot ? 2 : 0 }]}
        onPress={() => navigation.navigate('ProductDetail', { product: item })}
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
            <View style={[styles.sevBadge, { backgroundColor: '#E63946' }]}>
              <Icon name="zap" size={9} color="#FFF" />
              <Text style={styles.sevText}>HOT</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>

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
              style={[styles.republishBtn, item.isCritical && { backgroundColor: '#E63946' }]}
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
        <Text style={styles.headerSub}>ESTRATEGIA DE STOCK</Text>
        <Text style={styles.headerTitle}>Mi Inventario</Text>
      </View>

      {/* Diagnosis chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
        {counts.critical > 0 && (
          <TouchableOpacity style={[styles.chip, { borderColor: '#E63946' }]} onPress={() => setFilter('critical')}>
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
          <TouchableOpacity style={[styles.chip, { borderColor: '#FF6B35' }]} onPress={() => setFilter('stagnant')}>
            <Text style={styles.chipNum}>{counts.desinterest}</Text>
            <Text style={styles.chipLab}>Sin interés</Text>
          </TouchableOpacity>
        )}
        {counts.opportunity > 0 && (
          <TouchableOpacity style={[styles.chip, { borderColor: '#00D9A3' }]} onPress={() => setFilter('hot')}>
            <Text style={styles.chipNum}>{counts.opportunity}</Text>
            <Text style={styles.chipLab}>Casi listos</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Seasonal advice panel */}
      <View style={styles.advicePanel}>
        <View style={styles.adviceIcon}>
          <Icon name="trending-up" size={18} color="#FF6B35" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.adviceTitle}>Estado del mes</Text>
          <Text style={styles.adviceText}>
            {SEASONAL_ADVICE[currentMonth]}
            {counts.stagnant > 0 ? ` Tienes ${counts.stagnant} artículos estancados.` : ' ¡Todo bajo control!'}
          </Text>
        </View>
      </View>

      {/* Filter bar */}
      <View style={styles.filterBar}>
        {[
          { id: 'all',      label: 'Todos',      count: products.length },
          { id: 'stagnant', label: '❄️ Estancados', count: counts.stagnant, color: '#4EA8DE' },
          { id: 'hot',      label: '⚡ Hot',       count: counts.opportunity + products.filter(p => p.isHot).length, color: '#E63946' },
        ].map(f => (
          <TouchableOpacity
            key={f.id}
            style={[styles.filterBtn, filter === f.id && { backgroundColor: f.color || '#1A1A2E' }]}
            onPress={() => setFilter(f.id)}
          >
            <Text style={[styles.filterText, filter === f.id && { color: '#FFF' }]}>
              {f.label} {f.count > 0 ? `(${f.count})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
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
  container:  { flex: 1, backgroundColor: '#F8F9FA' },
  header:     { paddingHorizontal: 25, paddingTop: 60, paddingBottom: 16 },
  headerSub:  { fontSize: 9, fontWeight: '900', color: '#FF6B35', letterSpacing: 2 },
  headerTitle:{ fontSize: 28, fontWeight: '900', color: '#1A1A2E' },

  chipScroll: { maxHeight: 72, marginBottom: 12 },
  chip: {
    backgroundColor: '#FFF', borderWidth: 2, borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 8,
    alignItems: 'center', minWidth: 80,
  },
  chipNum: { fontSize: 16, fontWeight: '900', color: '#1A1A2E' },
  chipLab: { fontSize: 8,  fontWeight: '700', color: '#666' },

  advicePanel: {
    flexDirection: 'row', gap: 12, alignItems: 'center',
    backgroundColor: '#FFF', marginHorizontal: 20, padding: 14,
    borderRadius: 18, marginBottom: 14, elevation: 1,
  },
  adviceIcon:  { width: 38, height: 38, backgroundColor: '#FFF2EE', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  adviceTitle: { fontSize: 13, fontWeight: '900', color: '#1A1A2E', marginBottom: 2 },
  adviceText:  { fontSize: 11, color: '#666', lineHeight: 16 },

  filterBar: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 14 },
  filterBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 22,
    backgroundColor: '#EEE', alignItems: 'center',
  },
  filterText: { fontSize: 10, fontWeight: '800', color: '#666' },

  list: { paddingHorizontal: 12, paddingBottom: 100 },
  card: {
    width: (width / 2) - 20, margin: 6, backgroundColor: '#FFF',
    borderRadius: 20, overflow: 'hidden', elevation: 3,
  },
  cardImage:  { width: '100%', height: 155 },
  priceBadge: {
    position: 'absolute', top: 10, left: 10,
    backgroundColor: '#00D9A3', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  priceText: { color: '#FFF', fontWeight: '900', fontSize: 12 },
  topRight:  { position: 'absolute', top: 10, right: 10 },
  sevBadge:  { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  sevText:   { color: '#FFF', fontSize: 8, fontWeight: '900' },
  cardInfo:  { padding: 10 },
  cardTitle: { fontSize: 12, fontWeight: '800', color: '#1A1A2E', marginBottom: 4 },
  diagBox:   { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4, borderRadius: 6, marginBottom: 4 },
  diagText:  { fontSize: 9, fontWeight: '800', flex: 1 },
  daysText:  { fontSize: 9, fontWeight: '700', marginBottom: 4 },
  statsRow:  { flexDirection: 'row', gap: 10, borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingTop: 6, marginTop: 2 },
  statItem:  { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statText:  { fontSize: 11, fontWeight: '700', color: '#666' },
  republishBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    backgroundColor: '#1A1A2E', paddingVertical: 7,
    borderRadius: 10, marginTop: 6,
  },
  republishText: { color: '#FFF', fontSize: 8, fontWeight: '900' },
  empty:     { alignItems: 'center', paddingTop: 60 },
  emptyText: { color: '#CCC', fontSize: 13, marginTop: 12 },
});