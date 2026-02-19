import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { DatabaseService } from '../services/DatabaseService';

export default function SoldHistoryScreen({ navigation }) {
  const [soldProducts, setSoldProducts] = useState([]);

  const loadSoldData = () => {
    try {
      const data = DatabaseService.getAllProducts();
      
      // LOG DE DEPURACIÓN: Verás esto en tu consola de terminal
      console.log("DEBUG: Total en DB:", data.length);

      // Filtramos con una validación extra para evitar errores si status es undefined
      const filtered = data.filter(p => p && p.status === 'sold');
      
      console.log("DEBUG: Total Vendidos:", filtered.length);

      // Ordenar por fecha de venta
      const sorted = filtered.sort((a, b) => {
        return new Date(b.soldAt || 0) - new Date(a.soldAt || 0);
      });

      setSoldProducts(sorted);
    } catch (error) {
      console.error("Error cargando historial:", error);
    }
  };

  useEffect(() => {
    // 1. CARGA INICIAL: Importante para cuando la pantalla se monta por primera vez
    loadSoldData();

    // 2. CARGA AL ENTRAR: Para cuando vuelves de la pantalla de detalle
    const unsubscribe = navigation.addListener('focus', () => {
      loadSoldData();
    });

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
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={{ paddingBottom: 100 }}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.soldCard}             
            onPress={() => navigation.navigate('SoldDetail', { product: item })}
          >
            <Image 
              source={{ uri: item.images && item.images[0] ? item.images[0] : 'https://via.placeholder.com/150' }} 
              style={styles.thumbnail} 
            />
            <View style={styles.cardInfo}>
              <Text style={styles.productTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.soldDate}>
                Vendido el {item.soldAt ? new Date(item.soldAt).toLocaleDateString() : 'Fecha desconocida'}
              </Text>
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
            <View style={styles.emptyIconCircle}>
              <Icon name="shopping-cart" size={40} color="#DDD" />
            </View>
            <Text style={styles.emptyText}>No hay ventas registradas</Text>
            <Text style={styles.emptySubText}>Los productos que vendas aparecerán aquí automáticamente.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { 
    padding: 25, 
    paddingTop: 60, 
    backgroundColor: '#FFF', 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0'
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#1A1A2E' },
  badge: { backgroundColor: '#E8FBF6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  badgeText: { color: '#00D9A3', fontWeight: 'bold', fontSize: 12 },
  soldCard: { 
    flexDirection: 'row', 
    backgroundColor: '#FFF', 
    marginHorizontal: 20, 
    marginTop: 15, 
    padding: 12, 
    borderRadius: 20, 
    alignItems: 'center', 
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5
  },
  thumbnail: { width: 70, height: 70, borderRadius: 15, backgroundColor: '#F0F0F0' },
  cardInfo: { flex: 1, marginLeft: 15 },
  productTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
  soldDate: { fontSize: 12, color: '#999', marginVertical: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  originalPrice: { fontSize: 13, color: '#BBB', textDecorationLine: 'line-through' },
  finalPrice: { fontSize: 16, fontWeight: '800', color: '#00D9A3' },
  checkIcon: { marginLeft: 10 },
  emptyContainer: { alignItems: 'center', marginTop: 100, paddingHorizontal: 40 },
  emptyIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', marginBottom: 20, elevation: 2 },
  emptyText: { color: '#1A1A2E', fontSize: 18, fontWeight: '700' },
  emptySubText: { color: '#999', textAlign: 'center', marginTop: 8, lineHeight: 20 }
});