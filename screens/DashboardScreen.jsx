import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { DatabaseService } from '../services/DatabaseService';

const { width } = Dimensions.get('window');

export default function DashboardScreen({ navigation }) {
  const [data, setData] = useState({
    totalRevenue: 0,
    soldCount: 0,
    activeCount: 0,
    avgSale: 0,
    topCategory: 'N/A',
    categoryAnalysis: []
  });

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', calculateAnalytics);
    return unsubscribe;
  }, [navigation]);

  const calculateAnalytics = () => {
    const all = DatabaseService.getAllProducts();
    const sold = all.filter(p => p.status === 'sold');
    const active = all.filter(p => p.status !== 'sold');

    // Cálculo de ingresos
    const revenue = sold.reduce((acc, curr) => acc + parseFloat(curr.soldPrice || 0), 0);
    
    // Ticket Medio (Decisión: ¿Estoy vendiendo barato o caro?)
    const avg = sold.length > 0 ? (revenue / sold.length).toFixed(2) : 0;

    // Análisis por categorías (Decisión: ¿En qué debo invertir más?)
    const cats = {};
    sold.forEach(p => {
      cats[p.category] = (cats[p.category] || 0) + parseFloat(p.soldPrice);
    });
    
    const categoryArray = Object.keys(cats).map(name => ({
      name,
      value: cats[name]
    })).sort((a, b) => b.value - a.value);

    setData({
      totalRevenue: revenue.toFixed(2),
      soldCount: sold.length,
      activeCount: active.length,
      avgSale: avg,
      topCategory: categoryArray[0]?.name || 'N/A',
      categoryAnalysis: categoryArray.slice(0, 3) // Top 3
    });
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.dateText}>{new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
        <Text style={styles.title}>Panel de Control</Text>
      </View>

      {/* TARJETA PRINCIPAL: CAJA TOTAL */}
      <View style={styles.mainCard}>
        <Text style={styles.mainLabel}>INGRESOS NETOS</Text>
        <Text style={styles.mainValue}>{data.totalRevenue}€</Text>
        <View style={styles.divider} />
        <View style={styles.mainRow}>
          <View>
            <Text style={styles.subLabel}>Ticket Medio</Text>
            <Text style={styles.subValue}>{data.avgSale}€</Text>
          </View>
          <View style={styles.verticalDivider} />
          <View>
            <Text style={styles.subLabel}>Top Categoría</Text>
            <Text style={styles.subValue}>{data.topCategory}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Estado del Inventario</Text>
      <View style={styles.row}>
        <View style={[styles.miniCard, { borderLeftColor: '#00D9A3', borderLeftWidth: 4 }]}>
          <Text style={styles.miniLabel}>VENDIDOS</Text>
          <Text style={styles.miniValue}>{data.soldCount}</Text>
        </View>
        <View style={[styles.miniCard, { borderLeftColor: '#FF6B35', borderLeftWidth: 4 }]}>
          <Text style={styles.miniLabel}>EN STOCK</Text>
          <Text style={styles.miniValue}>{data.activeCount}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Rendimiento por Categoría</Text>
      <View style={styles.analysisCard}>
        {data.categoryAnalysis.length > 0 ? data.categoryAnalysis.map((cat, i) => (
          <View key={i} style={styles.catRow}>
            <View style={styles.catInfo}>
              <Icon name="tag" size={14} color="#666" />
              <Text style={styles.catName}>{cat.name}</Text>
            </View>
            <View style={styles.progressBg}>
               {/* Barra de progreso visual */}
              <View style={[styles.progressFill, { width: `${(cat.value / data.totalRevenue) * 100}%` }]} />
            </View>
            <Text style={styles.catValue}>{cat.value}€</Text>
          </View>
        )) : <Text style={styles.noData}>Sin datos de ventas aún</Text>}
      </View>

      <View style={styles.adviceCard}>
        <Icon name="zap" size={20} color="#FFD700" />
        <Text style={styles.adviceText}>
          {data.activeCount > data.soldCount * 2 
            ? "Consejo: Tienes mucho stock acumulado. Considera rebajar artículos antiguos." 
            : "Consejo: El ritmo de ventas es bueno. ¡Sigue buscando productos similares!"}
        </Text>
      </View>
      
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FA' },
  header: { paddingHorizontal: 25, paddingTop: 60, marginBottom: 20 },
  dateText: { color: '#999', fontSize: 13, textTransform: 'uppercase', fontWeight: '700' },
  title: { fontSize: 32, fontWeight: '900', color: '#1A1A2E' },
  
  mainCard: { marginHorizontal: 25, backgroundColor: '#1A1A2E', borderRadius: 30, padding: 25, elevation: 10, shadowColor: '#1A1A2E', shadowOpacity: 0.3, shadowRadius: 10 },
  mainLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  mainValue: { color: '#FFF', fontSize: 48, fontWeight: '900', marginVertical: 5 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 15 },
  mainRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  verticalDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.1)' },
  subLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '700' },
  subValue: { color: '#00D9A3', fontSize: 18, fontWeight: '800' },

  sectionTitle: { marginHorizontal: 25, marginTop: 30, marginBottom: 15, fontSize: 16, fontWeight: '800', color: '#1A1A2E' },
  row: { flexDirection: 'row', marginHorizontal: 25, gap: 15 },
  miniCard: { flex: 1, backgroundColor: '#FFF', padding: 20, borderRadius: 20, elevation: 2 },
  miniLabel: { fontSize: 11, color: '#999', fontWeight: '800' },
  miniValue: { fontSize: 28, fontWeight: '900', color: '#1A1A2E', marginTop: 5 },

  analysisCard: { marginHorizontal: 25, backgroundColor: '#FFF', padding: 20, borderRadius: 25, elevation: 2 },
  catRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  catInfo: { width: 90, flexDirection: 'row', alignItems: 'center', gap: 5 },
  catName: { fontSize: 13, fontWeight: '700', color: '#444' },
  progressBg: { flex: 1, height: 8, backgroundColor: '#F0F0F0', borderRadius: 4, marginHorizontal: 10, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#004E89', borderRadius: 4 },
  catValue: { width: 60, fontSize: 13, fontWeight: '800', color: '#1A1A2E', textAlign: 'right' },
  noData: { textAlign: 'center', color: '#999', padding: 10 },

  adviceCard: { marginHorizontal: 25, marginTop: 25, backgroundColor: '#FFF', padding: 20, borderRadius: 20, flexDirection: 'row', gap: 15, alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: '#DDD' },
  adviceText: { flex: 1, fontSize: 13, color: '#666', lineHeight: 18, fontWeight: '600' }
});