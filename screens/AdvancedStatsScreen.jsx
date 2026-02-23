import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { DatabaseService } from '../services/DatabaseService';

const { width } = Dimensions.get('window');

export default function AdvancedStatsScreen({ navigation }) { 
  const [data, setData] = useState([]);
  const [alerts, setAlerts] = useState([]); 

  const loadData = () => {
    // 1. Cargar datos para KPIs y Gráficos
    const all = DatabaseService.getAllProducts().filter(p => p.status === 'sold');
    setData(all);

    // 2. Cargar Alertas Estratégicas (Basadas en tu estrategia de estancamiento/meses)
    if (DatabaseService.getSmartAlerts) {
      setAlerts(DatabaseService.getSmartAlerts());
    }
  };

  useEffect(() => {
    loadData();
    const unsubscribe = navigation.addListener('focus', () => loadData());
    return unsubscribe;
  }, [navigation]);

  const stats = useMemo(() => {
    const categories = {};
    const monthlyHistory = {}; 
    let totalDays = 0;
    let totalProfit = 0;

    data.forEach(p => {
      const cat = p.category || 'Otros';
      const sellDate = new Date(p.soldDate || p.soldAt || new Date());
      const monthLabel = sellDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
      
      const start = new Date(p.firstUploadDate || p.createdAt);
      const end = new Date(p.soldDate || p.soldAt);
      const days = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
      const profit = Number(p.soldPrice || p.price) - Number(p.price);

      if (!categories[cat]) categories[cat] = { count: 0, days: 0, profit: 0 };
      categories[cat].count++;
      categories[cat].days += days;
      categories[cat].profit += profit;

      if (!monthlyHistory[monthLabel]) monthlyHistory[monthLabel] = { profit: 0, sales: 0 };
      monthlyHistory[monthLabel].profit += profit;
      monthlyHistory[monthLabel].sales += 1;

      totalDays += days;
      totalProfit += profit;
    });

    return { 
      categories, 
      avgDays: (totalDays / data.length || 0).toFixed(1), 
      totalProfit,
      monthList: Object.keys(monthlyHistory).map(m => ({ name: m, ...monthlyHistory[m] })).reverse()
    };
  }, [data]);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.subTitle}>ANÁLISIS ESTRATÉGICO</Text>
        <Text style={styles.title}>Rendimiento de Negocio</Text>
      </View>

      {/* BLOQUE 1: KPIs */}
      <View style={styles.kpiRow}>
        <View style={[styles.kpiCard, { backgroundColor: '#1A1A2E' }]}>
          <Icon name="clock" size={20} color="#00D9A3" />
          <Text style={styles.kpiValue}>{stats.avgDays}d</Text>
          <Text style={styles.kpiLabel}>TIEMPO MEDIO</Text>
        </View>
        <View style={[styles.kpiCard, { backgroundColor: '#00D9A3' }]}>
          <Icon name="trending-up" size={20} color="#FFF" />
          <Text style={[styles.kpiValue, { color: '#FFF' }]}>{stats.totalProfit.toFixed(2)}€</Text>
          <Text style={[styles.kpiLabel, { color: '#FFF', opacity: 0.8 }]}>BENEFICIO TOTAL</Text>
        </View>
      </View>

      {/* BLOQUE 2: SLIDER DE ALERTAS (Estrategia en tiempo real) */}
      <View style={styles.alertSliderContainer}>
        <View style={styles.alertSliderHeader}>
            <Text style={styles.sectionTitleSmall}>Asistente de Ventas</Text>
            <Text style={styles.alertCount}>{alerts.length} avisos</Text>
        </View>
        
        <ScrollView 
          horizontal 
          pagingEnabled 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sliderContent}
        >
          {alerts.length > 0 ? (
            alerts.map((alert, index) => (
              <View key={index} style={[styles.alertSlide, alert.priority === 'high' && styles.alertHigh]}>
                <View style={styles.alertRow}>
                  <Icon 
                    name={alert.type === 'seasonal' ? "zap" : "clock"} 
                    size={16} 
                    color={alert.priority === 'high' ? "#FF4D4D" : "#FF6B35"} 
                  />
                  <Text style={styles.alertTitle} numberOfLines={1}>{alert.title}</Text>
                </View>
                <Text style={styles.alertMsg} numberOfLines={2}>{alert.message}</Text>
                <View style={styles.alertFooter}>
                    <Text style={styles.alertAction}>💡 {alert.action}</Text>
                    <Text style={styles.slideIndicator}>{index + 1}/{alerts.length}</Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.alertSlideEmpty}>
                <Text style={styles.emptyText}>Inventario optimizado. No hay alertas.</Text>
            </View>
          )}
        </ScrollView>
      </View>

      {/* BLOQUE 3: RANKING POR CATEGORÍA */}
      <Text style={styles.sectionTitle}>Rentabilidad por Categoría</Text>
      {Object.keys(stats.categories).map(cat => {
        const c = stats.categories[cat];
        return (
          <View key={cat} style={styles.catRow}>
            <View style={styles.catInfo}>
              <Text style={styles.catName}>{cat}</Text>
              <Text style={styles.catSub}>{c.count} ventas · {(c.days / c.count).toFixed(0)}d media</Text>
            </View>
            <Text style={[styles.profitText, { color: c.profit >= 0 ? '#00D9A3' : '#FF4D4D' }]}>
              {c.profit >= 0 ? '+' : ''}{c.profit.toFixed(2)}€
            </Text>
          </View>
        );
      })}
      
      {/* HISTORIAL MENSUAL (Vitamina visual) */}
      <Text style={styles.sectionTitle}>Historial Mensual</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{paddingLeft: 20, marginBottom: 40}}>
          {stats.monthList.map((m, i) => (
              <View key={i} style={styles.monthCard}>
                  <Text style={styles.monthName}>{m.name}</Text>
                  <Text style={styles.monthProfit}>{m.profit.toFixed(2)}€</Text>
                  <Text style={styles.monthSales}>{m.sales} ventas</Text>
              </View>
          ))}
      </ScrollView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { padding: 25, paddingTop: 60, backgroundColor: '#FFF' },
  subTitle: { color: '#00D9A3', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  title: { fontSize: 24, fontWeight: '800', color: '#1A1A2E' },
  kpiRow: { flexDirection: 'row', padding: 20, gap: 15 },
  kpiCard: { flex: 1, padding: 20, borderRadius: 25, elevation: 4 },
  kpiValue: { fontSize: 22, fontWeight: '900', color: '#00D9A3', marginTop: 10 },
  kpiLabel: { fontSize: 9, fontWeight: '800', color: 'rgba(255,255,255,0.5)', marginTop: 5 },
  
  // Estilos del Slider de Alertas
  alertSliderContainer: { marginVertical: 10 },
  alertSliderHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 25, marginBottom: 10, alignItems: 'center' },
  sectionTitleSmall: { fontSize: 14, fontWeight: '800', color: '#1A1A2E' },
  alertCount: { fontSize: 10, fontWeight: 'bold', color: '#FF6B35', backgroundColor: '#FFF0EB', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  sliderContent: { paddingLeft: 20, paddingRight: 20 },
  alertSlide: { width: width - 60, backgroundColor: '#FFF', marginRight: 15, padding: 15, borderRadius: 20, borderLeftWidth: 6, borderLeftColor: '#FF6B35', elevation: 3 },
  alertHigh: { borderLeftColor: '#FF4D4D' },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  alertTitle: { fontSize: 13, fontWeight: '800', color: '#1A1A2E', flex: 1 },
  alertMsg: { fontSize: 12, color: '#666', lineHeight: 16, height: 32 },
  alertFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 },
  alertAction: { fontSize: 10, fontWeight: '900', color: '#00D9A3' },
  slideIndicator: { fontSize: 10, color: '#CCC', fontWeight: 'bold' },
  
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1A1A2E', marginLeft: 25, marginTop: 25, marginBottom: 15 },
  catRow: { flexDirection: 'row', backgroundColor: '#FFF', marginHorizontal: 20, marginBottom: 10, padding: 20, borderRadius: 20, alignItems: 'center', elevation: 2 },
  catInfo: { flex: 1 },
  catName: { fontSize: 16, fontWeight: '800', color: '#1A1A2E' },
  catSub: { fontSize: 12, color: '#999', marginTop: 2 },
  profitText: { fontSize: 16, fontWeight: '900' },

  monthCard: { backgroundColor: '#1A1A2E', padding: 15, borderRadius: 18, marginRight: 12, width: 120 },
  monthName: { color: '#00D9A3', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  monthProfit: { color: '#FFF', fontSize: 16, fontWeight: '900', marginVertical: 4 },
  monthSales: { color: 'rgba(255,255,255,0.5)', fontSize: 10 },
  emptyText: { color: '#BBB', fontSize: 12, textAlign: 'center' }
});