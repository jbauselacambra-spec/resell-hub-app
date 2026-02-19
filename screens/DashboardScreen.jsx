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
  7: { advice: "Preparación 'Vuelta al Cole'.", tags: ["mochila", "libro", "escolar"] },
  8: { advice: "Novedades de Otoño y Electrónica.", tags: ["otoño", "abrigo", "consola"] },
  9: { advice: "Halloween y Decoración de Hogar.", tags: ["disfraz", "halloween", "casa"] },
  10: { advice: "Black Friday y Regalos Anticipados.", tags: ["oferta", "regalo", "gaming"] },
  11: { advice: "Campaña de Navidad y Reyes Magos.", tags: ["juguete", "navidad", "lujo"] }
};

export default function DashboardScreen({ navigation }) {
  const [stats, setStats] = useState({
    totalEarned: 0,
    activeProducts: 0,
    vintedVisits: 0,
    vintedFavs: 0,
    tagStats: []
  });
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = () => {
    const data = DatabaseService.getAllProducts() || [];
    const sold = data.filter(p => p.status === 'sold');
    const active = data.filter(p => p.status === 'available');

    // 1. Calcular totales de Vinted
    const totalVisits = data.reduce((acc, p) => acc + (Number(p.views) || 0), 0);
    const totalFavs = data.reduce((acc, p) => acc + (Number(p.favorites) || 0), 0);

    // 2. Lógica de Gráfica por Etiquetas (SEO Tags)
    const tagMap = {};
    data.forEach(p => {
      // Usamos seoTags o brand como etiquetas
      const tags = p.seoTags ? p.seoTags.split(',').map(t => t.trim().toLowerCase()) : [];
      if (p.brand) tags.push(p.brand.toLowerCase());
      
      const uniqueTags = [...new Set(tags)];
      uniqueTags.forEach(tag => {
        if (!tag || tag === 'importado') return; // Limpiamos etiquetas genéricas
        if (!tagMap[tag]) tagMap[tag] = 0;
        tagMap[tag] += (Number(p.views) || 0);
      });
    });

    const sortedTags = Object.keys(tagMap)
      .map(tag => ({ name: tag, views: tagMap[tag] }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 5); // Top 5 etiquetas

    setStats({
      totalEarned: sold.reduce((acc, p) => acc + (p.soldPrice || 0), 0),
      activeProducts: active.length,
      vintedVisits: totalVisits,
      vintedFavs: totalFavs,
      tagStats: sortedTags
    });
  };

  useEffect(() => {
    loadStats();
    const unsubscribe = navigation.addListener('focus', loadStats);
    return unsubscribe;
  }, [navigation]);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    loadStats();
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const currentMonth = new Date().getMonth();
  const currentAdvice = SEASONAL_MAP[currentMonth];

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4EA8DE" />}
    >
      <View style={styles.header}>
        <Text style={styles.greeting}>Tu Resumen</Text>
        <Text style={styles.date}>{new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
      </View>

      {/* Grid de Ventas */}
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { backgroundColor: '#1A1A2E' }]}>
          <Icon name="trending-up" size={20} color="#00D9A3" />
          <Text style={styles.statValue}>{stats.totalEarned}€</Text>
          <Text style={styles.statLabel}>Ganancias</Text>
        </View>
        <View style={styles.statCard}>
          <Icon name="package" size={20} color="#4EA8DE" />
          <Text style={[styles.statValue, { color: '#1A1A2E' }]}>{stats.activeProducts}</Text>
          <Text style={styles.statLabel}>En Stock</Text>
        </View>
      </View>

      {/* Impacto Vinted */}
      <View style={styles.vintedStatsContainer}>
        <View style={styles.vintedStatBox}>
          <Icon name="eye" size={20} color="#4EA8DE" />
          <Text style={styles.vintedValue}>{stats.vintedVisits}</Text>
          <Text style={styles.vintedLabel}>Visitas</Text>
        </View>
        <View style={styles.vintedStatBox}>
          <Icon name="heart" size={20} color="#FF4D4D" />
          <Text style={styles.vintedValue}>{stats.vintedFavs}</Text>
          <Text style={styles.vintedLabel}>Favoritos</Text>
        </View>
      </View>

      {/* GRÁFICA DE RENDIMIENTO */}
      <Text style={styles.sectionTitle}>Visitas por Etiqueta</Text>
      <View style={styles.chartCard}>
        {stats.tagStats.length > 0 ? (
          stats.tagStats.map((item, index) => {
            const maxViews = stats.tagStats[0].views || 1;
            const barWidth = (item.views / maxViews) * 100;
            return (
              <View key={index} style={styles.chartRow}>
                <Text style={styles.tagName}>{item.name}</Text>
                <View style={styles.barContainer}>
                  <View style={[styles.bar, { width: `${barWidth}%` }]} />
                  <Text style={styles.barValue}>{item.views}</Text>
                </View>
              </View>
            );
          })
        ) : (
          <Text style={styles.noDataText}>Sin datos de Vinted</Text>
        )}
      </View>

      {/* Estrategia Estacional */}
      <View style={styles.analysisCard}>
        <Text style={styles.strategyAdvice}>{currentAdvice.advice}</Text>
        <View style={styles.personalInsightBox}>
          <Icon name="info" size={14} color="#4EA8DE" />
          <Text style={styles.personalInsightText}>Buscan: {currentAdvice.tags.join(', ')}</Text>
        </View>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => navigation.navigate('Stock')} // DESTINO CORREGIDO SEGÚN TU APP.JSX
        >
          <Text style={styles.actionButtonText}>REVISAR MI STOCK</Text>
          <Icon name="arrow-right" size={16} color="#FFF" />
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: { padding: 25, paddingTop: 60 },
  greeting: { fontSize: 28, fontWeight: '900', color: '#1A1A2E' },
  date: { fontSize: 14, color: '#999', marginTop: 5, textTransform: 'capitalize' },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: '#1A1A2E', marginHorizontal: 25, marginTop: 20, marginBottom: 15, textTransform: 'uppercase', letterSpacing: 1 },
  
  statsGrid: { flexDirection: 'row', paddingHorizontal: 25, gap: 15, marginBottom: 15 },
  statCard: { flex: 1, padding: 20, borderRadius: 25, backgroundColor: '#F8F9FA' },
  statValue: { fontSize: 22, fontWeight: '900', color: '#FFF', marginVertical: 8 },
  statLabel: { fontSize: 11, color: '#999', fontWeight: 'bold' },

  vintedStatsContainer: { flexDirection: 'row', marginHorizontal: 25, gap: 10, marginBottom: 10 },
  vintedStatBox: { flex: 1, backgroundColor: '#F8F9FA', padding: 15, borderRadius: 20, alignItems: 'center' },
  vintedValue: { fontSize: 18, fontWeight: '800', color: '#1A1A2E', marginTop: 5 },
  vintedLabel: { fontSize: 10, color: '#666', fontWeight: 'bold' },

  chartCard: { marginHorizontal: 25, backgroundColor: '#FFF', padding: 20, borderRadius: 25, borderWidth: 1, borderColor: '#F0F0F0' },
  chartRow: { marginBottom: 15 },
  tagName: { fontSize: 11, fontWeight: 'bold', color: '#1A1A2E', marginBottom: 5, textTransform: 'capitalize' },
  barContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bar: { height: 6, backgroundColor: '#4EA8DE', borderRadius: 3 },
  barValue: { fontSize: 10, color: '#999', fontWeight: 'bold' },
  noDataText: { textAlign: 'center', color: '#BBB', fontSize: 12 },

  analysisCard: { marginHorizontal: 25, backgroundColor: '#FFF', padding: 20, borderRadius: 25, marginTop: 20, borderWidth: 1, borderColor: '#F0F0F0' },
  strategyAdvice: { fontSize: 16, fontWeight: '800', color: '#1A1A2E', marginBottom: 10 },
  personalInsightBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20, backgroundColor: '#F8F9FA', padding: 10, borderRadius: 12 },
  personalInsightText: { fontSize: 11, color: '#666', flex: 1 },
  actionButton: { backgroundColor: '#1A1A2E', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 16, borderRadius: 18, gap: 10 },
  actionButtonText: { color: '#FFF', fontWeight: '800', fontSize: 12 }
});