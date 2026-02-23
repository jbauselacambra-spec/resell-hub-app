import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, StyleSheet, Dimensions } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { DatabaseService } from '../services/DatabaseService';

const { width } = Dimensions.get('window');

export default function SoldHistoryScreen({ navigation }) {
  const [soldProducts, setSoldProducts] = useState([]);
  const [filterType, setFilterType] = useState('date'); // 'date' o 'profit'

  const loadSoldData = () => {
    try {
      const data = DatabaseService.getAllProducts() || [];
      const filtered = data.filter(p => p && p.status === 'sold');
      setSoldProducts(filtered);
    } catch (error) {
      console.error("Error cargando historial:", error);
    }
  };

  useEffect(() => {
    loadSoldData();
    const unsubscribe = navigation.addListener('focus', loadSoldData);
    return unsubscribe;
  }, [navigation]);

  // --- LÓGICA DE ESTADÍSTICAS PARA EL PANEL (Estilo ProductList) ---
  const stats = useMemo(() => {
    const totalRevenue = soldProducts.reduce((sum, p) => sum + Number(p.soldPrice || p.price || 0), 0);
    const totalProfit = soldProducts.reduce((sum, p) => {
      const diff = Number(p.soldPrice || p.price || 0) - Number(p.price || 0);
      return sum + diff;
    }, 0);

    return {
      monthlySales: soldProducts.length,
      revenue: totalRevenue.toFixed(2),
      profit: totalProfit.toFixed(2)
    };
  }, [soldProducts]);

  // --- ORDENACIÓN ---
  const sortedProducts = useMemo(() => {
    let result = [...soldProducts];
    if (filterType === 'date') {
      result.sort((a, b) => new Date(b.soldDate || b.soldAt) - new Date(a.soldDate || a.soldAt));
    } else {
      result.sort((a, b) => {
        const profitA = Number(a.soldPrice || a.price) - Number(a.price);
        const profitB = Number(b.soldPrice || b.price) - Number(b.price);
        return profitB - profitA;
      });
    }
    return result;
  }, [soldProducts, filterType]);

  const renderItem = ({ item }) => {
    const original = Number(item.price || 0);
    const sold = Number(item.soldPrice || item.price || 0);
    const diff = sold - original;

    return (
      <TouchableOpacity 
        style={styles.soldCard}             
        onPress={() => navigation.navigate('SoldEditDetail', { product: item })}
      >
        <Image source={{ uri: item.images?.[0] }} style={styles.thumbnail} />
        
        <View style={styles.cardInfo}>
          <View style={styles.titleRow}>
            <Text style={styles.productTitle} numberOfLines={1}>{item.title}</Text>
            {item.isBundle && (
              <View style={styles.bundleBadge}>
                <Text style={styles.bundleText}>LOTE</Text>
              </View>
            )}
          </View>

          {/* Categoría y Fecha */}
          <View style={styles.metaRow}>
            <Text style={styles.categoryText}>{item.category || 'Otros'}</Text>
            <Text style={styles.dot}>•</Text>
            <Text style={styles.soldDateText}>
              {new Date(item.soldDate || item.soldAt).toLocaleDateString()}
            </Text>
          </View>

          {/* Comparativa de Precios */}
          <View style={styles.priceRow}>
            <View>
              <Text style={styles.priceLabel}>INICIAL</Text>
              <Text style={styles.originalPrice}>{original}€</Text>
            </View>
            <Icon name="arrow-right" size={12} color="#CCC" style={{ marginHorizontal: 5, marginTop: 10 }} />
            <View>
              <Text style={styles.priceLabel}>FINAL</Text>
              <Text style={styles.finalPrice}>{sold}€</Text>
            </View>
            <View style={[styles.diffBadge, { backgroundColor: diff >= 0 ? '#E8FBF6' : '#FFEBEB' }]}>
              <Text style={[styles.diffText, { color: diff >= 0 ? '#00D9A3' : '#FF4D4D' }]}>
                {diff >= 0 ? '+' : ''}{diff.toFixed(2)}€
              </Text>
            </View>
          </View>

          {/* Visitas y Favoritos */}
          <View style={styles.statsRow}>
            <View style={styles.statMini}>
              <Icon name="eye" size={12} color="#999" />
              <Text style={styles.statMiniText}>{item.views || 0}</Text>
            </View>
            <View style={styles.statMini}>
              <Icon name="heart" size={12} color="#999" />
              <Text style={styles.statMiniText}>{item.favorites || 0}</Text>
            </View>
          </View>
        </View>
        <Icon name="chevron-right" size={18} color="#EEE" />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Historial de Ventas</Text>

        {/* PANEL RECOMPANEL (Mismo diseño que ProductList) */}
        <View style={styles.recomPanel}>
          <View style={styles.recomIcon}>
            <Icon name="trending-up" size={20} color="#FF6B35" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.recomTitle}>Estado del Mes</Text>
            <Text style={styles.recomDesc}>
              Llevas {stats.monthlySales} ventas finalizadas. El beneficio acumulado es de {stats.profit}€.
            </Text>
          </View>
        </View>
      </View>

      {/* FILTROS DE ORDENACIÓN */}
      <View style={styles.filterContainer}>
        <TouchableOpacity 
          style={[styles.filterBtn, filterType === 'date' && styles.filterBtnActive]}
          onPress={() => setFilterType('date')}
        >
          <Icon name="calendar" size={14} color={filterType === 'date' ? '#FFF' : '#1A1A2E'} />
          <Text style={[styles.filterBtnText, filterType === 'date' && { color: '#FFF' }]}>Por Fecha</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.filterBtn, filterType === 'profit' && styles.filterBtnActive]}
          onPress={() => setFilterType('profit')}
        >
          <Icon name="trending-up" size={14} color={filterType === 'profit' ? '#FFF' : '#1A1A2E'} />
          <Text style={[styles.filterBtnText, filterType === 'profit' && { color: '#FFF' }]}>Por Ganancia</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={sortedProducts}
        keyExtractor={item => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { padding: 25, paddingTop: 60, backgroundColor: '#FFF' },
  headerTitle: { fontSize: 24, fontWeight: '900', color: '#1A1A2E', marginBottom: 20 },
  
  // PANEL RECOMPANEL (COPIADO DE PRODUCTLIST)
  recomPanel: { flexDirection: 'row', backgroundColor: '#FFF5F2', padding: 15, borderRadius: 20, alignItems: 'center', gap: 15, borderWidth: 1, borderColor: '#FFE0D6' },
  recomIcon: { width: 40, height: 40, backgroundColor: '#FFF', borderRadius: 12, justifyContent: 'center', alignItems: 'center', elevation: 2 },
  recomTitle: { fontSize: 14, fontWeight: '800', color: '#1A1A2E' },
  recomDesc: { fontSize: 12, color: '#666', marginTop: 2 },

  filterContainer: { flexDirection: 'row', paddingHorizontal: 25, paddingVertical: 10, gap: 10 },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#EEE' },
  filterBtnActive: { backgroundColor: '#1A1A2E', borderColor: '#1A1A2E' },
  filterBtnText: { fontSize: 12, fontWeight: '800', color: '#1A1A2E' },

  soldCard: { flexDirection: 'row', backgroundColor: '#FFF', marginHorizontal: 20, marginBottom: 12, padding: 12, borderRadius: 22, alignItems: 'center', elevation: 2 },
  thumbnail: { width: 85, height: 85, borderRadius: 18 },
  cardInfo: { flex: 1, marginLeft: 15 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  productTitle: { fontSize: 14, fontWeight: '800', color: '#1A1A2E', maxWidth: '70%' },
  bundleBadge: { backgroundColor: '#F0EFFF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  bundleText: { color: '#6C63FF', fontSize: 8, fontWeight: '900' },
  
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  categoryText: { fontSize: 10, fontWeight: '900', color: '#FF6B35' },
  dot: { marginHorizontal: 5, color: '#CCC' },
  soldDateText: { fontSize: 10, color: '#999', fontWeight: '600' },

  priceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  priceLabel: { fontSize: 7, fontWeight: '900', color: '#BBB', marginBottom: -2 },
  originalPrice: { fontSize: 13, fontWeight: '700', color: '#BBB', textDecorationLine: 'line-through' },
  finalPrice: { fontSize: 18, fontWeight: '900', color: '#1A1A2E' },
  diffBadge: { marginLeft: 10, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  diffText: { fontSize: 10, fontWeight: '900' },

  statsRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  statMini: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statMiniText: { fontSize: 11, fontWeight: '700', color: '#999' }
});