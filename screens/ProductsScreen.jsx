import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, Text, FlatList, TouchableOpacity, Image, 
  StyleSheet, Dimensions, Alert 
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { DatabaseService } from '../services/DatabaseService';

const { width } = Dimensions.get('window');

export default function ProductsScreen({ navigation }) {
  const [products, setProducts] = useState([]);
  const [filter, setFilter] = useState('all'); 

  const loadData = () => {
    try {
      const data = DatabaseService.getAllProducts() || [];
      setProducts(data.filter(p => p && p.status !== 'sold'));
    } catch (error) {
      console.error("Error al cargar inventario:", error);
    }
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadData);
    loadData();
    return unsubscribe;
  }, [navigation]);

  const processedData = useMemo(() => {
    const now = new Date();
    const stats = DatabaseService.getStats();

    const items = products.map(item => {
      // Prioridad absoluta a la fecha manual de subida
      const uploadDate = new Date(item.firstUploadDate || item.createdAt);
      const daysOld = Math.floor((now - uploadDate) / (1000 * 60 * 60 * 24));
      
      const isNew = daysOld <= 7;
      const isHot = (item.views > 50 || item.favorites > 10) && daysOld < 30;
      // Ajustado a 45 días para detectar tus productos de 54 días
      const isCold = daysOld >= 45; 

      return { ...item, daysOld, isHot, isCold, isNew };
    });

    const toRepublicateCount = items.filter(i => i.isCold).length;
    return { items, toRepublicateCount, monthlySales: stats.sold };
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (filter === 'hot') return processedData.items.filter(p => p.isHot);
    if (filter === 'republish') return processedData.items.filter(p => p.isCold);
    return processedData.items;
  }, [processedData.items, filter]);

  const handleMarkRepublicated = (id) => {
    Alert.alert(
      "Confirmar Resubida",
      "¿Has resubido este artículo? Se reseteará su antigüedad a 0 días.",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Sí, resubido", 
          onPress: () => {
            DatabaseService.markAsRepublicated(id);
            loadData();
          } 
        }
      ]
    );
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={[styles.card, item.isCold && styles.cardCold]} 
      onPress={() => navigation.navigate('ProductDetail', { product: item })}
    >
      <Image source={{ uri: item.images[0] }} style={styles.cardImage} />
      
      <View style={styles.cardPriceTag}>
        <Text style={styles.cardPriceText}>{item.price}€</Text>
      </View>

      <View style={styles.badgeContainer}>
        {item.isHot && (
          <View style={[styles.tempBadge, { backgroundColor: '#FF4D4D' }]}>
            <Icon name="zap" size={10} color="#FFF" />
            <Text style={styles.tempText}>HOT</Text>
          </View>
        )}
        {item.isNew && !item.isHot && (
          <View style={[styles.tempBadge, { backgroundColor: '#00D9A3' }]}>
            <Text style={styles.tempText}>NUEVO</Text>
          </View>
        )}
      </View>

      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.cardBrand}>{item.brand || 'Vinted'}</Text>
        
        <Text style={[styles.timeText, item.isCold && {color: '#FF4D4D', fontWeight: '900'}]}>
          🗓 {item.daysOld} días en stock {item.isCold ? '❄️' : ''}
        </Text>
        
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Icon name="eye" size={12} color="#666" />
            <Text style={styles.statText}>{item.views || 0}</Text>
          </View>
          <View style={styles.statItem}>
            <Icon name="heart" size={12} color="#666" />
            <Text style={styles.statText}>{item.favorites || 0}</Text>
          </View>
        </View>

        {item.isCold && (
          <View style={styles.republishBox}>
            <View style={styles.republishAlert}>
              <Icon name="wind" size={10} color="#33b5e5" />
              <Text style={styles.republishAlertText}>ESTANCADO (+45 DÍAS)</Text>
            </View>
            <TouchableOpacity 
              style={styles.doneBtn} 
              onPress={() => handleMarkRepublicated(item.id)}
            >
              <Text style={styles.doneBtnText}>MARCAR RESUBIDO</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSubtitle}>ANÁLISIS DE VENTAS</Text>
          <Text style={styles.headerTitle}>Mi Inventario</Text>
        </View>
      </View>

      <View style={styles.recomPanel}>
        <View style={styles.recomIcon}>
          <Icon name="trending-up" size={20} color="#FF6B35" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.recomTitle}>Estado del Mes</Text>
          <Text style={styles.recomDesc}>
            Llevas {processedData.monthlySales} ventas. Tienes {processedData.toRepublicateCount} productos para resubir hoy.
          </Text>
        </View>
      </View>

      <View style={styles.filterBar}>
        <TouchableOpacity 
          style={[styles.filterTab, filter === 'all' && styles.filterTabActive]} 
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterTabText, filter === 'all' && styles.filterTextActive]}>Todos</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.filterTab, filter === 'hot' && styles.filterTabActiveHot]} 
          onPress={() => setFilter('hot')}
        >
          <Icon name="zap" size={12} color={filter === 'hot' ? '#FFF' : '#FF4D4D'} />
          <Text style={[styles.filterTabText, filter === 'hot' && styles.filterTextActive]}>Calientes</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.filterTab, filter === 'republish' && styles.filterTabActiveCold]} 
          onPress={() => setFilter('republish')}
        >
          <Icon name="refresh-cw" size={12} color={filter === 'republish' ? '#FFF' : '#33b5e5'} />
          <Text style={[styles.filterTabText, filter === 'republish' && styles.filterTextActive]}>Republicar</Text>
        </TouchableOpacity>
      </View>

      <FlatList 
        data={filteredProducts} 
        renderItem={renderItem} 
        keyExtractor={item => item.id} 
        numColumns={2} 
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No hay productos para republicar.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { paddingHorizontal: 25, paddingTop: 60, paddingBottom: 15 },
  headerSubtitle: { color: '#FF6B35', fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  headerTitle: { fontSize: 28, fontWeight: '900', color: '#1A1A2E' },
  recomPanel: { flexDirection: 'row', backgroundColor: '#FFF', marginHorizontal: 20, padding: 15, borderRadius: 20, alignItems: 'center', gap: 15, marginBottom: 20, elevation: 2 },
  recomIcon: { width: 40, height: 40, backgroundColor: '#FFF2EE', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  recomTitle: { fontSize: 14, fontWeight: '900', color: '#1A1A2E' },
  recomDesc: { fontSize: 11, color: '#666', marginTop: 2 },
  filterBar: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 15, gap: 10 },
  filterTab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 15, paddingVertical: 10, borderRadius: 25, backgroundColor: '#EEE' },
  filterTabActive: { backgroundColor: '#1A1A2E' },
  filterTabActiveHot: { backgroundColor: '#FF4D4D' },
  filterTabActiveCold: { backgroundColor: '#33b5e5' },
  filterTabText: { fontSize: 11, fontWeight: '800', color: '#666' },
  filterTextActive: { color: '#FFF' },
  listContent: { paddingHorizontal: 15, paddingBottom: 100 },
  card: { width: (width / 2) - 22, margin: 7, backgroundColor: '#FFF', borderRadius: 22, overflow: 'hidden', elevation: 3 },
  cardCold: { borderWidth: 2, borderColor: '#33b5e544' },
  cardImage: { width: '100%', height: 160 },
  cardPriceTag: { position: 'absolute', top: 10, left: 10, backgroundColor: '#00D9A3', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  cardPriceText: { color: '#FFF', fontWeight: '900', fontSize: 12 },
  badgeContainer: { position: 'absolute', top: 10, right: 10, gap: 5 },
  tempBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, gap: 4 },
  tempText: { color: '#FFF', fontSize: 9, fontWeight: '900' },
  cardInfo: { padding: 12 },
  cardTitle: { fontSize: 13, fontWeight: '800', color: '#1A1A2E' },
  cardBrand: { fontSize: 10, color: '#999', marginVertical: 2 },
  timeText: { fontSize: 10, color: '#666', fontWeight: '800', marginVertical: 4 },
  statsRow: { flexDirection: 'row', gap: 12, marginTop: 4, borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingTop: 8 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 11, fontWeight: '700', color: '#444' },
  republishBox: { marginTop: 10, gap: 5 },
  republishAlert: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 6, backgroundColor: '#33b5e510', borderRadius: 8 },
  republishAlertText: { color: '#33b5e5', fontSize: 8, fontWeight: '900' },
  doneBtn: { backgroundColor: '#1A1A2E', paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  doneBtnText: { color: '#FFF', fontSize: 9, fontWeight: '900' },
  emptyContainer: { marginTop: 50, alignItems: 'center' },
  emptyText: { color: '#999', fontSize: 14, fontWeight: '600' }
});