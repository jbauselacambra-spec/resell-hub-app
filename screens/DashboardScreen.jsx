import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, RefreshControl } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { DatabaseService } from '../services/DatabaseService';

const { width } = Dimensions.get('window');

export default function DashboardScreen({ navigation }) {
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalRevenue: "0.00",
    soldCount: 0,
    activeCount: 0,
    avgDaysToSell: 0,
    velocityData: [],
    topCategory: 'N/A'
  });

  const loadDashboardData = () => {
    const allProducts = DatabaseService.getAllProducts();
    const basicStats = DatabaseService.getStats();
    
    // Filtrar productos
    const sold = allProducts.filter(p => p.status === 'sold');
    const active = allProducts.filter(p => p.status !== 'sold');

    // Cálculo de Velocidad de Venta (Pilar 1 de tu estrategia)
    let avgDays = 0;
    let categorySpeeds = {};

    if (sold.length > 0) {
      const totalDays = sold.reduce((sum, p) => {
        const start = new Date(p.createdAt);
        const end = new Date(p.soldAt || new Date());
        const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        return sum + Math.max(0, diff);
      }, 0);
      avgDays = (totalDays / sold.length).toFixed(1);

      // Agrupar por categoría para ver cuál rota más rápido
      sold.forEach(p => {
        const diff = Math.ceil((new Date(p.soldAt) - new Date(p.createdAt)) / (1000 * 60 * 60 * 24));
        if (!categorySpeeds[p.category]) categorySpeeds[p.category] = { total: 0, count: 0 };
        categorySpeeds[p.category].total += Math.max(0, diff);
        categorySpeeds[p.category].count += 1;
      });
    }

    const velocityArray = Object.keys(categorySpeeds).map(cat => ({
      name: cat,
      avg: (categorySpeeds[cat].total / categorySpeeds[cat].count).toFixed(1)
    })).sort((a, b) => a.avg - b.avg); // Los más rápidos primero

    setStats({
      totalRevenue: basicStats.revenue,
      soldCount: sold.length,
      activeCount: active.length,
      avgDaysToSell: avgDays,
      velocityData: velocityArray,
      topCategory: velocityArray.length > 0 ? velocityArray[0].name : 'N/A'
    });
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadDashboardData);
    loadDashboardData();
    return unsubscribe;
  }, [navigation]);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    loadDashboardData();
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  return (
    <ScrollView 
      style={styles.container} 
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.dateText}>{new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
        <Text style={styles.title}>Análisis de Negocio</Text>
      </View>

      {/* TARJETA PRINCIPAL: INGRESOS */}
      <View style={styles.mainCard}>
        <Text style={styles.mainLabel}>INGRESOS TOTALES</Text>
        <Text style={styles.mainValue}>{stats.totalRevenue}€</Text>
        <View style={styles.dividerLight} />
        <View style={styles.mainRow}>
          <View>
            <Text style={styles.subLabel}>Velocidad Media</Text>
            <Text style={styles.subValue}>{stats.avgDaysToSell} días</Text>
          </View>
          <View style={styles.verticalDivider} />
          <View>
            <Text style={styles.subLabel}>Más Rápido</Text>
            <Text style={styles.subValue}>{stats.topCategory}</Text>
          </View>
        </View>
      </View>

      {/* MÉTRICAS DE INVENTARIO */}
      <Text style={styles.sectionTitle}>Estado del Flujo</Text>
      <View style={styles.row}>
        <View style={[styles.miniCard, { borderLeftColor: '#00D9A3', borderLeftWidth: 4 }]}>
          <Text style={styles.miniLabel}>VENDIDOS</Text>
          <Text style={styles.miniValue}>{stats.soldCount}</Text>
        </View>
        <View style={[styles.miniCard, { borderLeftColor: '#FF6B35', borderLeftWidth: 4 }]}>
          <Text style={styles.miniLabel}>EN STOCK</Text>
          <Text style={styles.miniValue}>{stats.activeCount}</Text>
        </View>
      </View>

      {/* PILAR 1: ANÁLISIS DE VELOCIDAD POR CATEGORÍA */}
      <Text style={styles.sectionTitle}>Rotación por Categoría (Días)</Text>
      <View style={styles.analysisCard}>
        {stats.velocityData.length > 0 ? stats.velocityData.map((item, i) => (
          <View key={i} style={styles.catRow}>
            <View style={styles.catInfo}>
              <Icon name="zap" size={14} color={item.avg < 7 ? "#00D9A3" : "#999"} />
              <Text style={styles.catName} numberOfLines={1}>{item.name}</Text>
            </View>
            <View style={styles.progressBg}>
              <View 
                style={[
                  styles.progressFill, 
                  { 
                    width: `${Math.min(100, (item.avg / 30) * 100)}%`,
                    backgroundColor: item.avg < 7 ? '#00D9A3' : '#004E89'
                  }
                ]} 
              />
            </View>
            <Text style={styles.catValue}>{item.avg}d</Text>
          </View>
        )) : (
          <Text style={styles.noData}>Vende productos para ver el análisis de velocidad</Text>
        )}
      </View>

      {/* CONSEJO ESTRATÉGICO */}
      <View style={styles.adviceCard}>
        <Icon name="trending-up" size={20} color="#FF6B35" />
        <Text style={styles.adviceText}>
          {stats.avgDaysToSell > 15 
            ? "Tu dinero tarda más de 2 semanas en volver. Considera ajustar precios en categorías lentas." 
            : "¡Excelente rotación! Tienes un flujo de caja muy saludable."}
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
  title: { fontSize: 28, fontWeight: '900', color: '#1A1A2E' },
  
  mainCard: { marginHorizontal: 25, backgroundColor: '#1A1A2E', borderRadius: 30, padding: 25, elevation: 10, shadowColor: '#1A1A2E', shadowOpacity: 0.3, shadowRadius: 10 },
  mainLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  mainValue: { color: '#FFF', fontSize: 42, fontWeight: '900', marginVertical: 5 },
  dividerLight: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 15 },
  mainRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  verticalDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.1)' },
  subLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '700' },
  subValue: { color: '#00D9A3', fontSize: 16, fontWeight: '800' },

  sectionTitle: { marginHorizontal: 25, marginTop: 30, marginBottom: 15, fontSize: 15, fontWeight: '800', color: '#1A1A2E', textTransform: 'uppercase', letterSpacing: 1 },
  row: { flexDirection: 'row', marginHorizontal: 25, gap: 15 },
  miniCard: { flex: 1, backgroundColor: '#FFF', padding: 20, borderRadius: 20, elevation: 2 },
  miniLabel: { fontSize: 11, color: '#999', fontWeight: '800' },
  miniValue: { fontSize: 28, fontWeight: '900', color: '#1A1A2E', marginTop: 5 },

  analysisCard: { marginHorizontal: 25, backgroundColor: '#FFF', padding: 20, borderRadius: 25, elevation: 2 },
  catRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  catInfo: { width: 100, flexDirection: 'row', alignItems: 'center', gap: 5 },
  catName: { fontSize: 13, fontWeight: '700', color: '#444' },
  progressBg: { flex: 1, height: 6, backgroundColor: '#F0F0F0', borderRadius: 3, marginHorizontal: 10, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  catValue: { width: 40, fontSize: 13, fontWeight: '800', color: '#1A1A2E', textAlign: 'right' },
  noData: { textAlign: 'center', color: '#999', padding: 10, fontSize: 13 },

  adviceCard: { marginHorizontal: 25, marginTop: 25, backgroundColor: '#FFF', padding: 20, borderRadius: 20, flexDirection: 'row', gap: 15, alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: '#DDD' },
  adviceText: { flex: 1, fontSize: 13, color: '#666', lineHeight: 18, fontWeight: '600' }
});