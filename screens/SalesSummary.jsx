import React, { useState, useEffect } from 'react';
import { ScrollView, View, Text, StyleSheet, SafeAreaView, RefreshControl } from 'react-native';
import { StatCard } from '../components/molecules/StatCard';
import { DatabaseService } from '../services/DatabaseService';

const SalesSummary = () => {
  const [stats, setStats] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Cargar estadísticas reales desde MMKV
  const loadStats = () => {
    const data = DatabaseService.getStats();
    setStats(data);
  };

  useEffect(() => {
    loadStats();
  }, []);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    loadStats();
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  if (!stats) return null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.headerTitle}>ResellHub Stats</Text>
        
        <View style={styles.grid}>
          {/* Datos conectados a DatabaseService.updateStats() */}
          <StatCard 
            icon="shopping-bag" 
            value={stats.total || 0} 
            label="Total Productos" 
            type="info" 
          />
          <StatCard 
            icon="check-circle" 
            value={stats.sold || 0} 
            label="Vendidos" 
            type="success" 
            color="#00D9A3" // Success color
          />
          <StatCard 
            icon="alert-triangle" 
            value={stats.needsRepost || 0} 
            label="Alertas" 
            type="warning" 
            color="#FFB800" // Warning color
          />
        </View>

        {/* Sección de Ingresos Reales */}
        <View style={styles.revenueCard}>
          <Text style={styles.revenueLabel}>Ingresos Totales</Text>
          <Text style={styles.revenueValue}>{stats.totalRevenue.toFixed(2)}€</Text>
          <Text style={styles.avgText}>
            Tiempo medio de venta: {stats.avgSaleTime} días
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA', // Gray 50
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100, // Fix Poco X7 Pro
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A2E', // Gray 900
    marginBottom: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  revenueCard: {
    marginTop: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    elevation: 3, // Shadow spec
    alignItems: 'center',
  },
  revenueLabel: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
  },
  revenueValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#004E89', // Secondary Blue
    marginVertical: 8,
  },
  avgText: {
    fontSize: 12,
    color: '#00D9A3',
    fontWeight: '600',
  }
});

export default SalesSummary;