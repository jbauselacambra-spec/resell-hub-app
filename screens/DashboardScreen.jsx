import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, RefreshControl, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { DatabaseService } from '../services/DatabaseService';

const { width } = Dimensions.get('window');

const SEASONAL_MAP = {
  0: { advice: "Céntrate en Abrigos y Tecnología.", tags: ["invierno", "chaqueta", "electrónica", "móvil"] },
  1: { advice: "Momento de Disfraces y San Valentín.", tags: ["carnaval", "regalo", "joya", "disfraz"] },
  2: { advice: "Ropa de entretiempo y Deporte.", tags: ["deporte", "zapatillas", "sudadera"] },
  3: { advice: "Artículos de Jardín y Terraza.", tags: ["hogar", "jardín", "terraza"] },
  4: { advice: "Preparativos de Comuniones y Bodas.", tags: ["vestido", "traje", "boda", "fiesta"] },
  5: { advice: "Equipamiento de Verano y Playa.", tags: ["bañador", "piscina", "playa", "gafas"] },
  6: { advice: "Liquidación de Verano y Viajes.", tags: ["maleta", "viaje", "verano"] },
  7: { advice: "Preparación 'Vuelta al Cole'.", tags: ["mochila", "libro", "escolar", "estuche"] },
  8: { advice: "Tecnología y Escritorios.", tags: ["pc", "ordenador", "oficina", "tablet"] },
  9: { advice: "Ropa de lluvia y Halloween.", tags: ["botas", "disfraz", "halloween", "lluvia"] },
  10: { advice: "Adelanto de Navidad y Juguetes.", tags: ["juguete", "consola", "regalo", "nintendo", "ps5"] },
  11: { advice: "Regalos y Ropa de Fiesta.", tags: ["fiesta", "lujo", "reloj", "navidad"] }
};

export default function DashboardScreen({ navigation }) {
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalRevenue: "0.00",
    soldCount: 0,
    activeCount: 0,
    avgDaysToSell: 0,
    velocityData: [],
    topCategory: 'N/A',
    coldStockCount: 0,
    seasonalAdvice: '',
    personalInsight: 'Analizando...',
    recommendedCount: 0,
    targetMonthName: ''
  });

  const loadDashboardData = () => {
    // Protección: Si getAllProducts devuelve null/undefined, usamos array vacío
    const allProducts = DatabaseService.getAllProducts() || [];
    const basicStats = DatabaseService.getStats() || { revenue: "0.00" };
    
    const sold = allProducts.filter(p => p.status === 'sold');
    const active = allProducts.filter(p => p.status !== 'sold');

    const nextMonthIndex = (new Date().getMonth() + 1) % 12;
    const monthInfo = SEASONAL_MAP[nextMonthIndex];
    const targetMonthName = new Date(0, nextMonthIndex).toLocaleDateString('es-ES', { month: 'long' });

    const historyInTargetMonth = sold.filter(p => {
      if (!p.soldAt) return false;
      const saleMonth = new Date(p.soldAt).getMonth();
      return saleMonth === nextMonthIndex;
    });

    const personalCatCounts = historyInTargetMonth.reduce((acc, p) => {
      const cat = p.category || "Otros"; // Evita undefined en el historial
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {});

    const bestPersonalCat = Object.keys(personalCatCounts).sort((a, b) => personalCatCounts[b] - personalCatCounts[a])[0] || "Sin historial";

    // --- CORRECCIÓN CRÍTICA: Verificación de existencia antes de .toLowerCase() ---
    const recommendations = active.filter(p => {
      const category = (p.category || "").toLowerCase(); // Safe check
      const title = (p.title || "").toLowerCase();       // Safe check
      
      const matchesGlobal = monthInfo.tags.some(tag => 
        category.includes(tag.toLowerCase()) || title.includes(tag.toLowerCase())
      );
      const matchesPersonal = p.category === bestPersonalCat;
      return matchesGlobal || matchesPersonal;
    });

    const coldStock = active.filter(p => {
      if (!p.createdAt) return false;
      const diff = Math.ceil((new Date() - new Date(p.createdAt)) / (1000 * 60 * 60 * 24));
      return diff >= 30;
    }).length;

    let avgDays = 0;
    let categorySpeeds = {};
    if (sold.length > 0) {
      const totalDays = sold.reduce((sum, p) => {
        if (!p.createdAt || !p.soldAt) return sum;
        const diff = Math.ceil((new Date(p.soldAt) - new Date(p.createdAt)) / (1000 * 60 * 60 * 24));
        return sum + Math.max(0, diff);
      }, 0);
      avgDays = (totalDays / sold.length).toFixed(1);

      sold.forEach(p => {
        if (!p.createdAt || !p.soldAt) return;
        const cat = p.category || "Otros"; // Evita undefined en el cálculo de velocidad
        const diff = Math.ceil((new Date(p.soldAt) - new Date(p.createdAt)) / (1000 * 60 * 60 * 24));
        if (!categorySpeeds[cat]) categorySpeeds[cat] = { total: 0, count: 0 };
        categorySpeeds[cat].total += diff;
        categorySpeeds[cat].count += 1;
      });
    }

    const velocityArray = Object.keys(categorySpeeds).map(cat => ({
      name: cat,
      avg: (categorySpeeds[cat].total / categorySpeeds[cat].count).toFixed(1)
    })).sort((a, b) => a.avg - b.avg);

    setStats({
      totalRevenue: basicStats.revenue || "0.00",
      soldCount: sold.length,
      activeCount: active.length,
      avgDaysToSell: avgDays,
      velocityData: velocityArray,
      topCategory: velocityArray.length > 0 ? velocityArray[0].name : 'N/A',
      coldStockCount: coldStock,
      seasonalAdvice: monthInfo.advice,
      personalInsight: bestPersonalCat,
      recommendedCount: recommendations.length,
      targetMonthName: targetMonthName
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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.dateText}>{new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
        <Text style={styles.title}>Smart Business</Text>
      </View>

      <View style={styles.mainCard}>
        <Text style={styles.mainLabel}>BALANCE TOTAL</Text>
        <Text style={styles.mainValue}>{stats.totalRevenue}€</Text>
        <View style={styles.dividerLight} />
        <View style={styles.mainRow}>
          <View>
            <Text style={styles.subLabel}>Velocidad Media</Text>
            <Text style={styles.subValue}>{stats.avgDaysToSell} días</Text>
          </View>
          <View style={styles.verticalDivider} />
          <View>
            <Text style={styles.subLabel}>Tu categoría Top</Text>
            <Text style={styles.subValue}>{stats.topCategory}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Estrategia de Anticipación</Text>
      <View style={styles.strategyCard}>
        <View style={styles.strategyHeader}>
          <View style={styles.monthBadge}>
            <Text style={styles.monthBadgeText}>PLANIFICAR {stats.targetMonthName.toUpperCase()}</Text>
          </View>
          <Icon name="zap" size={18} color="#FFD700" />
        </View>
        
        <Text style={styles.strategyAdvice}>{stats.seasonalAdvice}</Text>
        
        <View style={styles.personalInsightBox}>
          <Icon name="activity" size={14} color="#4EA8DE" />
          <Text style={styles.personalInsightText}>
            En tu historial, <Text style={{fontWeight:'800'}}>"{stats.personalInsight}"</Text> es lo que mejor te funciona en {stats.targetMonthName}.
          </Text>
        </View>

        {stats.recommendedCount > 0 ? (
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('Inventario')}
          >
            <Text style={styles.actionButtonText}>
              Actualizar {stats.recommendedCount} productos ahora
            </Text>
            <Icon name="arrow-right" size={16} color="#FFF" />
          </TouchableOpacity>
        ) : (
          <Text style={styles.noStockText}>No tienes stock para la demanda de {stats.targetMonthName}.</Text>
        )}
      </View>

      <View style={[styles.alertCard, { borderColor: stats.coldStockCount > 0 ? '#FF6B35' : '#00D9A3' }]}>
        <Icon name="alert-triangle" size={20} color={stats.coldStockCount > 0 ? '#FF6B35' : '#00D9A3'} />
        <Text style={styles.alertText}>
          {stats.coldStockCount > 0 
            ? `Atención: ${stats.coldStockCount} productos estancados (+30 días).`
            : "¡Inventario optimizado! Sin productos estancados."}
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Días para vender</Text>
      <View style={styles.analysisCard}>
        {stats.velocityData.length > 0 ? stats.velocityData.map((item, i) => (
          <View key={i} style={styles.catRow}>
            <Text style={styles.catName} numberOfLines={1}>{item.name}</Text>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { 
                width: `${Math.min(100, (parseFloat(item.avg) / 30) * 100)}%`,
                backgroundColor: parseFloat(item.avg) < 7 ? '#00D9A3' : '#4EA8DE' 
              }]} />
            </View>
            <Text style={styles.catValue}>{item.avg}d</Text>
          </View>
        )) : <Text style={styles.noStockText}>Sin datos de ventas aún.</Text>}
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

// Mismos estilos proporcionados en tu archivo original
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { paddingHorizontal: 25, paddingTop: 60, marginBottom: 20 },
  dateText: { color: '#999', fontSize: 13, textTransform: 'uppercase', fontWeight: '700' },
  title: { fontSize: 28, fontWeight: '900', color: '#1A1A2E' },
  mainCard: { marginHorizontal: 25, backgroundColor: '#1A1A2E', borderRadius: 30, padding: 25, elevation: 8 },
  mainLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '800' },
  mainValue: { color: '#FFF', fontSize: 38, fontWeight: '900', marginVertical: 5 },
  dividerLight: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 15 },
  mainRow: { flexDirection: 'row', justifyContent: 'space-between' },
  verticalDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.1)' },
  subLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '700' },
  subValue: { color: '#00D9A3', fontSize: 15, fontWeight: '800' },
  sectionTitle: { marginHorizontal: 25, marginTop: 30, marginBottom: 15, fontSize: 14, fontWeight: '800', color: '#1A1A2E', textTransform: 'uppercase' },
  strategyCard: { marginHorizontal: 25, backgroundColor: '#FFF', padding: 20, borderRadius: 25, elevation: 4 },
  strategyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  monthBadge: { backgroundColor: '#4EA8DE20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  monthBadgeText: { color: '#4EA8DE', fontSize: 10, fontWeight: '800' },
  strategyAdvice: { fontSize: 16, fontWeight: '800', color: '#1A1A2E', marginBottom: 12 },
  personalInsightBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 15, backgroundColor: '#F8F9FA', padding: 10, borderRadius: 12 },
  personalInsightText: { fontSize: 12, color: '#555', flex: 1, lineHeight: 18 },
  actionButton: { backgroundColor: '#1A1A2E', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 15, borderRadius: 15, gap: 10 },
  actionButtonText: { color: '#FFF', fontWeight: '700', fontSize: 12 },
  noStockText: { color: '#999', fontSize: 12, fontStyle: 'italic', textAlign: 'center' },
  alertCard: { marginHorizontal: 25, marginTop: 15, backgroundColor: '#FFF', padding: 15, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1 },
  alertText: { fontSize: 13, fontWeight: '600', color: '#444' },
  analysisCard: { marginHorizontal: 25, backgroundColor: '#FFF', padding: 20, borderRadius: 25, elevation: 2 },
  catRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  catName: { width: 85, fontSize: 12, fontWeight: '700', color: '#666' },
  progressBg: { flex: 1, height: 6, backgroundColor: '#F0F0F0', borderRadius: 3, marginHorizontal: 10 },
  progressFill: { height: '100%', borderRadius: 3 },
  catValue: { width: 35, fontSize: 12, fontWeight: '800', color: '#1A1A2E', textAlign: 'right' }
});