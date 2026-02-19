import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { DatabaseService } from '../services/DatabaseService';

const { width } = Dimensions.get('window');

export default function DashboardScreen({ navigation }) {
  const [stats, setStats] = useState({ totalSold: 0, revenue: 0, activeItems: 0 });

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      const all = DatabaseService.getAllProducts();
      const sold = all.filter(p => p.status === 'sold');
      
      const totalRevenue = sold.reduce((acc, curr) => acc + parseFloat(curr.soldPrice || 0), 0);
      
      setStats({
        totalSold: sold.length,
        revenue: totalRevenue.toFixed(2),
        activeItems: all.length - sold.length
      });
    });
    return unsubscribe;
  }, [navigation]);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Resumen de Negocio</Text>
        <Text style={styles.subGreeting}>Esto es lo que has logrado hasta hoy</Text>
      </View>

      <View style={styles.statsGrid}>
        {/* Tarjeta de Ingresos Totales */}
        <View style={[styles.statCard, { width: width - 40, backgroundColor: '#1A1A2E' }]}>
          <View style={styles.iconCircle}><Icon name="dollar-sign" size={24} color="#00D9A3" /></View>
          <Text style={styles.statLabel}>Ingresos Totales</Text>
          <Text style={styles.revenueValue}>{stats.revenue}€</Text>
        </View>

        <View style={styles.row}>
          {/* Tarjeta de Ventas Realizadas */}
          <View style={styles.statCardSmall}>
            <Icon name="shopping-bag" size={20} color="#FF6B35" />
            <Text style={styles.statValue}>{stats.totalSold}</Text>
            <Text style={styles.statLabelSmall}>Ventas</Text>
          </View>

          {/* Tarjeta de Stock Activo */}
          <View style={styles.statCardSmall}>
            <Icon name="package" size={20} color="#004E89" />
            <Text style={styles.statValue}>{stats.activeItems}</Text>
            <Text style={styles.statLabelSmall}>En Stock</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { padding: 30, paddingTop: 70 },
  greeting: { fontSize: 28, fontWeight: '800', color: '#1A1A2E' },
  subGreeting: { fontSize: 16, color: '#999', marginTop: 5 },
  statsGrid: { paddingHorizontal: 20, gap: 15 },
  statCard: { padding: 25, borderRadius: 25, elevation: 5, marginBottom: 10 },
  statCardSmall: { flex: 1, backgroundColor: '#FFF', padding: 20, borderRadius: 20, alignItems: 'center', elevation: 2 },
  iconCircle: { backgroundColor: 'rgba(0,217,163,0.1)', width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  statLabel: { color: '#AAA', fontSize: 14, fontWeight: '600' },
  revenueValue: { color: '#FFF', fontSize: 42, fontWeight: '900', marginTop: 5 },
  row: { flexDirection: 'row', gap: 15 },
  statValue: { fontSize: 24, fontWeight: '800', color: '#1A1A2E', marginTop: 10 },
  statLabelSmall: { color: '#999', fontSize: 12, fontWeight: '600' }
});