import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, RefreshControl, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { DatabaseService } from '../services/DatabaseService';

const { width } = Dimensions.get('window');

export default function DashboardScreen({ navigation }) {
  const [stats, setStats] = useState({
    totalEarned: 0,
    activeProducts: 0,
    vintedVisits: 0,
    vintedFavs: 0,
    tagStats: [],
    alerts: [] // Nuevo: Lista de avisos inteligentes
  });
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = () => {
    const data = DatabaseService.getAllProducts() || [];
    const config = DatabaseService.getConfig(); // Traemos tus ajustes
    const now = new Date();
    
    const sold = data.filter(p => p.status === 'sold');
    const active = data.filter(p => p.status === 'available' || p.status === 'active');

    // --- LÓGICA DE ALERTAS EN TIEMPO REAL ---
    const alerts = [];
    active.forEach(p => {
      const uploadDate = new Date(p.firstUploadDate || p.createdAt);
      const daysOld = Math.floor((now - uploadDate) / (1000 * 60 * 60 * 24));
      const views = Number(p.views) || 0;

      if (daysOld >= parseInt(config.daysCritical)) {
        alerts.push({ type: 'CRITICAL', title: p.title, icon: 'alert-circle', color: '#FF4D4D', msg: 'Excedido límite de días' });
      } else if (daysOld >= parseInt(config.daysInvisible) && views < parseInt(config.viewsInvisible)) {
        alerts.push({ type: 'INVISIBLE', title: p.title, icon: 'eye-off', color: '#888', msg: 'Nadie está viendo esto' });
      } else if (p.favorites > 8 && daysOld > 20) {
        alerts.push({ type: 'OPPORTUNITY', title: p.title, icon: 'zap', color: '#00D9A3', msg: '¡Muchos favs! Haz una oferta' });
      }
    });

    // 1. Totales y Gráficas (Mantenemos tu lógica original)
    const totalVisits = data.reduce((acc, p) => acc + (Number(p.views) || 0), 0);
    const totalFavs = data.reduce((acc, p) => acc + (Number(p.favorites) || 0), 0);

    setStats({
      totalEarned: sold.reduce((acc, p) => acc + (Number(p.soldPrice || p.price) || 0), 0),
      activeProducts: active.length,
      vintedVisits: totalVisits,
      vintedFavs: totalFavs,
      tagStats: [], // Aquí iría tu lógica de tags simplificada
      alerts: alerts.slice(0, 3) // Solo mostramos las 3 más urgentes
    });
  };

  useEffect(() => {
    loadStats();
    const unsubscribe = navigation.addListener('focus', loadStats);
    return unsubscribe;
  }, [navigation]);

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadStats} />}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.date}>{new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' }).toUpperCase()}</Text>
          <Text style={styles.greeting}>Hola de nuevo 👋</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
          <Icon name="settings" size={22} color="#1A1A2E" />
        </TouchableOpacity>
      </View>

      {/* 1. SECCIÓN DE ALERTAS (NUEVO) */}
      {stats.alerts.length > 0 && (
        <View style={styles.alertSection}>
          <Text style={styles.sectionTitle}>Acciones Prioritarias</Text>
          {stats.alerts.map((alert, index) => (
            <TouchableOpacity 
              key={index} 
              style={[styles.alertCard, { borderLeftColor: alert.color }]}
              onPress={() => navigation.navigate('Stock')}
            >
              <View style={[styles.alertIcon, { backgroundColor: alert.color + '15' }]}>
                <Icon name={alert.icon} size={18} color={alert.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.alertTitle} numberOfLines={1}>{alert.title}</Text>
                <Text style={styles.alertMsg}>{alert.msg}</Text>
              </View>
              <Icon name="chevron-right" size={16} color="#DDD" />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* 2. RESUMEN FINANCIERO */}
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { backgroundColor: '#1A1A2E' }]}>
          <Text style={styles.statLabelLight}>GANANCIAS</Text>
          <Text style={styles.statValue}>{stats.totalEarned}€</Text>
          <View style={styles.miniProgress} />
        </View>
        <View style={[styles.statCard, { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#EEE' }]}>
          <Text style={styles.statLabel}>EN STOCK</Text>
          <Text style={[styles.statValue, { color: '#1A1A2E' }]}>{stats.activeProducts}</Text>
          <Text style={styles.statSubText}>Artículos activos</Text>
        </View>
      </View>

      {/* 3. IMPACTO VINTED */}
      <View style={styles.vintedStatsContainer}>
        <View style={styles.vintedStatBox}>
          <Icon name="eye" size={18} color="#4EA8DE" />
          <View>
            <Text style={styles.vintedValue}>{stats.vintedVisits}</Text>
            <Text style={styles.vintedLabel}>Vistas totales</Text>
          </View>
        </View>
        <View style={styles.vintedStatBox}>
          <Icon name="heart" size={18} color="#FF4D4D" />
          <View>
            <Text style={styles.vintedValue}>{stats.vintedFavs}</Text>
            <Text style={styles.vintedLabel}>Interacciones</Text>
          </View>
        </View>
      </View>

      {/* 4. ACCESO RÁPIDO A INVENTARIO */}
      <TouchableOpacity 
        style={styles.mainActionCard}
        onPress={() => navigation.navigate('Stock')}
      >
        <View>
          <Text style={styles.actionTitle}>Gestionar Inventario</Text>
          <Text style={styles.actionDesc}>Revisar diagnósticos y resubidas</Text>
        </View>
        <View style={styles.actionCircle}>
          <Icon name="arrow-right" size={20} color="#FFF" />
        </View>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { paddingHorizontal: 25, paddingTop: 60, paddingBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date: { fontSize: 10, fontWeight: '900', color: '#FF6B35', letterSpacing: 1.5 },
  greeting: { fontSize: 24, fontWeight: '900', color: '#1A1A2E', marginTop: 2 },
  
  sectionTitle: { fontSize: 12, fontWeight: '900', color: '#BBB', marginHorizontal: 25, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  
  // Estilos Alertas
  alertSection: { marginBottom: 25 },
  alertCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', marginHorizontal: 25, padding: 15, borderRadius: 20, marginBottom: 10, borderLeftWidth: 5, elevation: 2 },
  alertIcon: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  alertTitle: { fontSize: 13, fontWeight: '800', color: '#1A1A2E' },
  alertMsg: { fontSize: 11, color: '#999', marginTop: 2 },

  // Stats Grid
  statsGrid: { flexDirection: 'row', paddingHorizontal: 25, gap: 15, marginBottom: 15 },
  statCard: { flex: 1, padding: 20, borderRadius: 25, justifyContent: 'center' },
  statLabelLight: { color: 'rgba(255,255,255,0.5)', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  statLabel: { color: '#BBB', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  statValue: { fontSize: 26, fontWeight: '900', color: '#FFF', marginVertical: 4 },
  statSubText: { fontSize: 10, color: '#999', fontWeight: '700' },
  miniProgress: { width: 40, height: 4, backgroundColor: '#00D9A3', borderRadius: 2, marginTop: 10 },

  // Vinted Stats
  vintedStatsContainer: { flexDirection: 'row', marginHorizontal: 25, gap: 10, marginBottom: 25 },
  vintedStatBox: { flex: 1, backgroundColor: '#FFF', padding: 15, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#EEE' },
  vintedValue: { fontSize: 16, fontWeight: '800', color: '#1A1A2E' },
  vintedLabel: { fontSize: 9, color: '#999', fontWeight: 'bold' },

  // Botón Principal
  mainActionCard: { backgroundColor: '#1A1A2E', marginHorizontal: 25, padding: 25, borderRadius: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actionTitle: { color: '#FFF', fontSize: 18, fontWeight: '900' },
  actionDesc: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 4 },
  actionCircle: { width: 45, height: 45, backgroundColor: '#4EA8DE', borderRadius: 23, justifyContent: 'center', alignItems: 'center' }
});