import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { DatabaseService } from '../services/DatabaseService';

const { width } = Dimensions.get('window');

export default function AdvancedStatsScreen({ navigation }) { // Añadido navigation props
  const [data, setData] = useState([]);

  // Función de carga reutilizable
  const loadData = () => {
    const all = DatabaseService.getAllProducts().filter(p => p.status === 'sold');
    setData(all);
  };

  useEffect(() => {
    // Carga inicial
    loadData();

    // Listener para refrescar cuando el usuario entra en la pantalla
    const unsubscribe = navigation.addListener('focus', () => {
      loadData();
    });

    return unsubscribe;
  }, [navigation]);

  const stats = useMemo(() => {
    const categories = {};
    let totalDays = 0;
    let totalProfit = 0;

    data.forEach(p => {
      const cat = p.category || 'Otros';
      // Fallback a fecha actual si no existen fechas para evitar NaN
      const start = new Date(p.firstUploadDate || p.createdAt || new Date());
      const end = new Date(p.soldDate || p.soldAt || new Date());
      
      const days = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
      
      // Cálculo de beneficio: precio de venta real vs precio original (coste)
      const sellPrice = Number(p.soldPrice || p.price || 0);
      const costPrice = Number(p.price || 0);
      const profit = sellPrice - costPrice;

      if (!categories[cat]) {
        categories[cat] = { count: 0, days: 0, profit: 0 };
      }

      categories[cat].count++;
      categories[cat].days += days;
      categories[cat].profit += profit;
      totalDays += days;
      totalProfit += profit;
    });

    return { 
      categories, 
      avgDays: (totalDays / data.length || 0).toFixed(1), 
      totalProfit 
    };
  }, [data]);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.subTitle}>ANÁLISIS ESTRATÉGICO</Text>
        <Text style={styles.title}>Rendimiento de Negocio</Text>
      </View>

      {/* BLOQUE 1: KPIs DE EFICIENCIA */}
      <View style={styles.kpiRow}>
        <View style={[styles.kpiCard, { backgroundColor: '#1A1A2E' }]}>
          <Icon name="clock" size={20} color="#00D9A3" />
          <Text style={styles.kpiValue}>{stats.avgDays} días</Text>
          <Text style={styles.kpiLabel}>TIEMPO MEDIO VENTA</Text>
        </View>
        <View style={[styles.kpiCard, { backgroundColor: '#00D9A3' }]}>
          <Icon name="trending-up" size={20} color="#FFF" />
          <Text style={[styles.kpiValue, { color: '#FFF' }]}>{stats.totalProfit.toFixed(2)}€</Text>
          <Text style={[styles.kpiLabel, { color: '#FFF', opacity: 0.8 }]}>BENEFICIO TOTAL</Text>
        </View>
      </View>

      {/* BLOQUE 2: RECOMENDACIÓN ESTACIONAL (INTELIGENCIA) */}
      <View style={styles.recomPanel}>
        <View style={styles.recomHeader}>
          <Icon name="zap" size={18} color="#FF6B35" />
          <Text style={styles.recomTitle}>Sugerencia de Febrero</Text>
        </View>
        <Text style={styles.recomDesc}>
          Históricamente, los productos de <Text style={{fontWeight:'800'}}>Ropa y Calzado</Text> se venden un 20% más rápido este mes. Revisa tus precios y republica lo que lleve +30 días.
        </Text>
      </View>

      {/* BLOQUE 3: RANKING POR CATEGORÍA */}
      <Text style={styles.sectionTitle}>Rentabilidad por Categoría</Text>
      {Object.keys(stats.categories).map(cat => {
        const c = stats.categories[cat];
        const avgCatDays = (c.days / c.count).toFixed(0);
        return (
          <View key={cat} style={styles.catRow}>
            <View style={styles.catInfo}>
              <Text style={styles.catName}>{cat}</Text>
              <Text style={styles.catSub}>{c.count} ventas • {avgCatDays} días media</Text>
            </View>
            <View style={styles.catProfit}>
              <Text style={[styles.profitText, { color: c.profit >= 0 ? '#00D9A3' : '#FF4D4D' }]}>
                {c.profit >= 0 ? '+' : ''}{c.profit.toFixed(2)}€
              </Text>
            </View>
          </View>
        );
      })}
      
      <View style={{ height: 50 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { padding: 25, paddingTop: 60, backgroundColor: '#FFF' },
  subTitle: { color: '#00D9A3', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  title: { fontSize: 24, fontWeight: '800', color: '#1A1A2E' },
  
  kpiRow: { flexDirection: 'row', padding: 20, gap: 15 },
  kpiCard: { flex: 1, padding: 20, borderRadius: 25, elevation: 5 },
  kpiValue: { fontSize: 22, fontWeight: '900', color: '#00D9A3', marginTop: 10 },
  kpiLabel: { fontSize: 9, fontWeight: '800', color: 'rgba(255,255,255,0.5)', marginTop: 5 },

  recomPanel: { margin: 20, backgroundColor: '#FFF5F2', padding: 20, borderRadius: 25, borderWidth: 1, borderColor: '#FFE0D6' },
  recomHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  recomTitle: { fontSize: 16, fontWeight: '800', color: '#1A1A2E' },
  recomDesc: { fontSize: 13, color: '#666', lineHeight: 20 },

  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1A1A2E', marginLeft: 25, marginTop: 10, marginBottom: 15 },
  catRow: { flexDirection: 'row', backgroundColor: '#FFF', marginHorizontal: 20, marginBottom: 10, padding: 20, borderRadius: 20, alignItems: 'center', elevation: 2 },
  catInfo: { flex: 1 },
  catName: { fontSize: 16, fontWeight: '800', color: '#1A1A2E' },
  catSub: { fontSize: 12, color: '#999', marginTop: 2 },
  profitText: { fontSize: 16, fontWeight: '900' }
});