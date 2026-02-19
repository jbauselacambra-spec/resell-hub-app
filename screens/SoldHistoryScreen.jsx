import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { DatabaseService } from '../services/DatabaseService';

export default function SoldHistoryScreen({ navigation }) {
  const [soldProducts, setSoldProducts] = useState([]);

  const loadSoldData = () => {
    const data = DatabaseService.getAllProducts();
    // Filtramos solo los vendidos y los ordenamos por fecha de venta (más reciente primero)
    const filtered = data
      .filter(p => p.status === 'sold')
      .sort((a, b) => new Date(b.soldAt) - new Date(a.soldAt));
    setSoldProducts(filtered);
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadSoldData);
    return unsubscribe;
  }, [navigation]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Historial de Ventas</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{soldProducts.length} Items</Text>
        </View>
      </View>

      <FlatList
        data={soldProducts}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingBottom: 100 }}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.soldCard} 
            onPress={() => navigation.navigate('ProductDetail', { product: item })}
          >
            <Image source={{ uri: item.images[0] }} style={styles.thumbnail} />
            <View style={styles.cardInfo}>
              <Text style={styles.productTitle}>{item.title}</Text>
              <Text style={styles.soldDate}>Vendido el {new Date(item.soldAt).toLocaleDateString()}</Text>
              <View style={styles.priceRow}>
                <Text style={styles.originalPrice}>{item.price}€</Text>
                <Icon name="arrow-right" size={14} color="#CCC" />
                <Text style={styles.finalPrice}>{item.soldPrice}€</Text>
              </View>
            </View>
            <View style={styles.checkIcon}>
              <Icon name="check-circle" size={24} color="#00D9A3" />
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="shopping-cart" size={50} color="#EEE" />
            <Text style={styles.emptyText}>Aún no has realizado ventas</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { padding: 25, paddingTop: 60, backgroundColor: '#FFF', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#1A1A2E' },
  badge: { backgroundColor: '#E8FBF6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  badgeText: { color: '#00D9A3', fontWeight: 'bold', fontSize: 12 },
  soldCard: { flexDirection: 'row', backgroundColor: '#FFF', marginHorizontal: 20, marginTop: 15, padding: 12, borderRadius: 20, alignItems: 'center', elevation: 2 },
  thumbnail: { width: 70, height: 70, borderRadius: 15, backgroundColor: '#EEE' },
  cardInfo: { flex: 1, marginLeft: 15 },
  productTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
  soldDate: { fontSize: 12, color: '#999', marginVertical: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  originalPrice: { fontSize: 13, color: '#BBB', textDecorationLine: 'line-through' },
  finalPrice: { fontSize: 16, fontWeight: '800', color: '#00D9A3' },
  checkIcon: { marginLeft: 10 },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyText: { color: '#CCC', marginTop: 10, fontWeight: '600' }
});